const LOCAL_DOMAINS = ['localhost', '127.0.0.1', '::1', '[::1]'];

/**
 * Checks if the provided Window environment is running on a local host.
 * Safely handles null or undefined window references (SSR-safe).
 */
export function isLocalhost(win?: Window | null): boolean {
  if (!win?.location?.hostname) {
    return false;
  }
  return LOCAL_DOMAINS.includes(win.location.hostname);
}
