// The existing notice integration suite exercises successful publication. Route
// only internal Bot deliveries to a deterministic fake; local Nest HTTP requests
// continue to use the real fetch implementation.
const actualFetch = globalThis.fetch.bind(globalThis)
const fakeBot = 'http://127.0.0.1:39099/internal/notices'
process.env.NOTICE_BOT_URL = 'http://127.0.0.1:39099'
process.env.NOTICE_NOTIFY_SECRET = 'test-shared-secret-not-for-production'
process.env.NOTICE_PUBLIC_BASE_URL = 'http://localhost:3000'
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url === fakeBot) return Promise.resolve(new Response(null, { status: 204 }))
  return actualFetch(input, init)
}) as typeof fetch
