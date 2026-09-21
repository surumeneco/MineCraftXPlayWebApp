import type { Notice } from '../types/notice'

/** Read-only contract: GET {apiBase}/notices -> published Notice[]. */
export function usePublicNotices() {
  const { public: { apiBase } } = useRuntimeConfig()
  // Client-only until the production server-to-server API address is decided.
  return useFetch<Notice[]>(`${apiBase}/notices`, {
    key: 'public-notices',
    server: false,
    lazy: true,
    default: () => [],
  })
}
