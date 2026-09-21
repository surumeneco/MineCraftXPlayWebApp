export type SiteImageManifest = {
  revision: number
  active_preset_id: string
  images: Record<string, { version_id: string; static_path: string | null } | null>
}

/** The manifest is public; its API request is client-only until SSR API routing is configured. */
export function useSiteImages() {
  const { public: { apiBase } } = useRuntimeConfig()
  const result = useFetch<SiteImageManifest>(`${apiBase}/site-images/manifest`, {
    key: 'site-image-manifest', server: false, lazy: true,
    default: () => ({ revision: 0, active_preset_id: '', images: {} }),
  })
  /** On API failure the bundled image remains available; a deliberate 'none' uses the unset fallback. */
  function image(key: string, offlineFallback = '', unsetFallback = ''): string {
    if (result.status.value !== 'success') return offlineFallback
    const resolved = result.data.value.images[key]
    if (!resolved) return unsetFallback
    return resolved.static_path ?? `${apiBase}/site-images/${encodeURIComponent(key)}?v=${encodeURIComponent(resolved.version_id)}`
  }
  return { ...result, image }
}
