# Development & Auditing Guide

This document describes how to run local development servers, inspect performance traces, and run Lighthouse audits correctly across different operating systems.

---

## 🛠️ Required Setup: Standalone Terminal Requirement

> [!IMPORTANT]
> To launch Chrome in debug mode and run Lighthouse/Performance tracing via MCP servers, you **MUST** execute the developer commands in a **standalone terminal** (e.g., macOS `Terminal.app` or `iTerm2`) rather than VS Code's integrated terminal.
>
> - **OS Scope:** This sandbox limitation **primarily affects macOS** (due to Apple's strict application isolation policies) and **Linux systems** if VS Code is installed via sandboxed/containerized packages like **Snap** or **Flatpak**. It is typically not an issue on Windows.

### Why VS Code's Integrated Terminal Fails (macOS & Sandboxed Linux):

1. **Host Directory Access Limits (App Sandboxing):** VS Code is a sandboxed application in these environments. Child processes spawned by VS Code's integrated terminal inherit its sandbox, which strictly blocks writing configuration or port discovery files directly into standard user system folders (like `~/Library/Application Support/Google/Chrome/` where the debug active-port files are generated on macOS).
2. **Port Forwarding / Proxying:** VS Code automatically hooks into local ports (like `9222` and `5005`) to manage port forwarding, which interferes with Chrome's raw WebSocket remote debugging handshake.
3. **Loopback/Socket Isolation:** Sandboxing can prevent VS Code processes from making local network handshakes to loopback sockets like `127.0.0.1:9222/json/version` over standard HTTP requests.

Using a standalone terminal runs commands directly in user space, bypassing these restrictions.

---

## 🚀 Step-by-Step Developer Workflow

Follow this procedure to run and inspect your application:

### Step 1: Open a Standalone Terminal

Launch your terminal application of choice (e.g., Terminal, iTerm2).

### Step 2: Start the Chrome Debug Instance

In your terminal, launch the isolated, clean-profile Chrome debugger:

```bash
npm run chrome:debug
```

_This starts Chrome on debug port `9222` with a temporary, isolated user profile (`/tmp/chrome-debug-profile`). This guarantees your daily personal tabs and cookies are untouched, and shields the audit from extension noise._

### Step 3: Run the Application Server

In another tab or window of your standalone terminal, build and preview the app locally:

```bash
npm run preview
```

_This starts the static file server via `serve` on port `5005` with single-page-app routing enabled._

### Step 4: Load the App in the Debugger Window

Because the Chrome debugging instance starts with a completely fresh, isolated profile, it will open to a blank page.

- **Action:** Copy `http://localhost:5005` and paste it into the address bar of the newly opened Chrome debugger window to load the application.

### Step 5: Run Audits and Performance Traces

You can now use your AI agents or Lighthouse CLI to execute diagnostics on `http://localhost:5005` safely and accurately.

### Step 6: Post-Audit Cleanup

Once you are done with auditing and performance tracing, close the Chrome debugger session completely for clean resource reclamation:

```bash
npm run chrome:debug:stop
```

_This terminates the background debugging process on port `9222`, removes the generated active-port configuration files, and purges the temporary `/tmp/chrome-debug-profile` directory._

---

## 📈 Understanding Your Auditing Scores

### Best Practices Score (reCAPTCHA vs. Mocking)

If your **Best Practices** score shows **77/100** due to third-party cookies from `recaptcha/enterprise.js`, this is expected:

- **Why it happens:** Firebase App Check relies on Google reCAPTCHA Enterprise to verify clients. On the web, reCAPTCHA must use cookies to perform risk evaluations. Lighthouse flags all third-party cookies as privacy flags since browsers are deprecating them.
- **How to get 100 locally:** If you want a perfect Best Practices score for local testing, you can modify `src/app/core/services/config.service.ts` to swap `ReCaptchaEnterpriseProvider` for the standard **Debug Provider** when on `localhost`.

### Security Headers (serve.json)

Local static previews use `serve`. To mock and test production security headers locally, you can create a `serve.json` file in your root folder:

```json
{
  "headers": [
    {
      "source": "**",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "object-src 'none'; base-uri 'self'; script-src 'self' 'unsafe-eval' https://www.google.com https://www.gstatic.com; frame-ancestors 'none';"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        }
      ]
    }
  ]
}
```

_Adding this file will instantly make Lighthouse pass your security headers audits on `localhost`._
