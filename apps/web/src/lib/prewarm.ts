/**
 * Render's free tier spins the API down after ~15 minutes idle; the first
 * request after that takes 30-60s to wake it back up. Firing a cheap,
 * throwaway request as soon as the app loads -- instead of waiting for the
 * user's first real search -- means that wake-up happens while they're
 * still reading the page, not after they've already started waiting on a
 * search result.
 */
export function prewarmApi(): void {
  fetch("/api/nodes/1").catch(() => {
    // Ignored -- this is a best-effort wake-up ping, not a real request.
  });
}
