'use client';

import { useEffect } from 'react';

/**
 * Marks <html> with `in-app` when the page is running inside our own Android /
 * iOS shell rather than a normal mobile browser.
 *
 * Detection uses the JavaScript channels the app injects into every page
 * (LocationBridge / ShareBridge / PullBridge). Those have shipped since the
 * first release, so this works on the builds already on people's phones —
 * which matters, because the whole point is to fix the home page without
 * asking anyone to update the app. The user agent cannot be used: the shell
 * deliberately sends a plain Chrome string.
 *
 * The class currently drives one rule (globals.css): a floor under the home
 * header's top padding, because the shell draws the home page edge to edge
 * while insetting its inner pages.
 */
export default function InAppShellClass() {
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    const inApp = !!(w.ShareBridge || w.LocationBridge || w.PullBridge);
    if (inApp) document.documentElement.classList.add('in-app');

    // The channels are injected on page-finished, which can land after React
    // hydrates. Re-check briefly so the very first paint is not missed.
    if (inApp) return;
    let tries = 0;
    const id = window.setInterval(() => {
      if (w.ShareBridge || w.LocationBridge || w.PullBridge) {
        document.documentElement.classList.add('in-app');
        window.clearInterval(id);
      } else if (++tries > 20) {
        window.clearInterval(id);   // ~4s; it is a normal browser
      }
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
