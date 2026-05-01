/**
 * Next.js instrumentation hook (auto-loaded). Suppresses a known harmless
 * unhandled rejection from the wagmi → metamask-sdk connector chain that
 * touches `indexedDB` during SSR. The page still serves 200; without this
 * silencer, `next dev` logs are spammy.
 *
 * Real errors with anything *other than* indexedDB still surface normally
 * (Next's own unhandledRejection logger handles them).
 */
export async function register() {
  if (typeof process === 'undefined') return
  process.on('unhandledRejection', (reason) => {
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
          ? reason
          : String(reason ?? '')
    if (message.includes('indexedDB is not defined')) {
      // Swallow — known harmless wagmi connector noise during SSR.
      return
    }
    // Re-throw so Next's default logger handles it like normal.
    throw reason
  })
}
