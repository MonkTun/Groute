// Global error handler — catches module init crashes that React error boundaries miss.
// Must use require() below (not import) to preserve execution order.
const originalHandler = ErrorUtils.getGlobalHandler()
ErrorUtils.setGlobalHandler((error, isFatal) => {
  if (isFatal) {
    console.error('[GROUTE FATAL]', error?.message, error?.stack)
  }
  originalHandler(error, isFatal)
})

// Load polyfills before anything else (must run before Supabase client initializes)
require('./lib/polyfills')

// Then load the normal Expo Router entry
require('expo-router/entry')
