# 0005: Isolated Chrome DevTools Profile with Direct DevToolsActivePort Generation for MCP Automation

- **Status**: Accepted
- **Date**: 2026-09-03

## Context

Recent Chrome security policies (starting with Chrome 130+) strictly prohibit attaching remote debugging flags (`--remote-debugging-port`) to an active default user profile session on macOS. This security restriction prevents unauthorized local processes from attaching a debugger to steal user cookies, session tokens, or credentials.

To run automated performance traces, Lighthouse audits, and DOM inspections using `antigravity-cli` and the `chrome-devtools` MCP server without interrupting daily browser workflows, Chrome must run in an isolated user data directory (`--user-data-dir=/tmp/chrome-debug-profile`).

However, the `chrome-devtools` MCP server discovers the active debugging endpoint by looking for `DevToolsActivePort` exclusively at the default macOS profile path:

```text
~/Library/Application Support/Google/Chrome/DevToolsActivePort
```

Because Chrome runs in an isolated user data directory, and because modern macOS sandboxing or container policies sometimes fail to write the port file to temporary `/tmp` paths reliably, the MCP server fails with a missing port file error.

## Decision

We implemented a standalone Node.js ES Module launcher (`scripts/chrome-debug.mjs`) that automates the debug lifecycle and directly generates the discovery bridge:

1. **Idempotent Process Management**:
   - Inspects port `9222` using `lsof` and terminates any existing stale debug processes before launch.

2. **Isolated Chrome Execution**:
   - Auto-detects the Chrome binary across standard macOS application paths and `process.env.CHROME_PATH`.
   - Spawns Chrome with `--remote-debugging-port=9222`, `--user-data-dir=/tmp/chrome-debug-profile`, `--no-first-run`, `--no-default-browser-check`, and `--disable-sync`.

3. **Direct Port File Generation**:
   - Instead of using a fragile symbolic link, the script actively queries the running Chrome instance over HTTP at `http://127.0.0.1:9222/json/version` using native global `fetch()`.
   - Once Chrome responds, the script extracts the active WebSocket debugger pathname (e.g., `/devtools/browser/uuid`).
   - The script then directly writes the standard `DevToolsActivePort` configuration file to `~/Library/Application Support/Google/Chrome/DevToolsActivePort` containing the port and the active WebSocket path.

4. **Lifecycle Commands**:
   - `start` (default background daemon or `--foreground` with interactive `Ctrl+C` `SIGINT` trap).
   - `stop` (terminates process on port `9222`, removes generated port file, and purges temp directory).
   - `status` (inspects port and file health).

## Security & System Permissions Model

The architecture strictly adheres to the **Principle of Least Privilege (PoLP)** on macOS:

1. **Full Disk Access (FDA) Not Required**:
   - Standard POSIX user permissions are sufficient to manage `/tmp/chrome-debug-profile` and user App Support directories. Full Disk Access remains disabled for Chrome, VS Code, and Terminal.

2. **No Root / Elevated Execution**:
   - All operations execute in user space without requiring `sudo`.

3. **Loopback-Only Network Binding**:
   - Remote debugging binds strictly to `127.0.0.1:9222` (localhost loopback), preventing macOS firewall warnings and eliminating external network exposure.

4. **Zero Session Contamination**:
   - The isolated profile guarantees AI agents and MCP tools cannot access personal cookies, passwords, or personal open tabs.

## Consequences

### Positive

- **Zero Disruption**: Daily browsing tabs and personal sessions remain active without needing to quit Chrome (`Cmd+Q`).
- **Benchmark Purity**: Performance traces and Lighthouse audits are completely isolated from browser extension noise.
- **Seamless AI Tooling**: `antigravity-cli` connects directly to the live browser via native `chrome-devtools` MCP server tools.
- **High Reliability**: Bypasses symlink fragility, `/private/tmp` resolution conflicts, and macOS security sandboxing by writing the configuration file directly based on active HTTP handshakes.

### Negative / Trade-offs

- Requires executing `npm run chrome:debug` before initiating MCP browser interactions.
- Overwrites the default `DevToolsActivePort` file in the user's `~/Library/Application Support/Google/Chrome/` directory during active debug sessions.
