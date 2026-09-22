export type SiteImageVersion = {
  id: string
  resource_id: string
  version_number: number
  name: string
  note: string
  static_path: string | null
  uploaded_by: string | null
  created_at: string
  mime_type: string | null
}
export type SiteImageResource = {
  id: string
  key: string
  name: string
  description: string
  created_at: string
  versions: SiteImageVersion[]
}
export type SiteImagePreset = {
  id: string
  name: string
  description: string
  is_default: boolean
  created_at: string
  items: Array<{ resource_id: string; version_id: string | null }>
}
export type SiteImagePresetList = {
  active_preset_id: string
  revision: number
  presets: SiteImagePreset[]
}
export type SiteImagePresetEvent = {
  id: string
  previous_name: string
  next_name: string
  applied_by: string | null
  applied_at: string
}

export function useSiteImageApi() {
  const { public: { apiBase } } = useRuntimeConfig()
  const auth = useAccountSession()
  const { showError } = useUiFeedback()
  async function get<T>(path: string): Promise<T> {
    try { return await $fetch<T>(`${apiBase}${path}`, { credentials: 'include' }) }
    catch (error) { showError(error); throw error }
  }
  async function mutate<T>(path: string, method: 'POST' | 'PATCH' | 'PUT', body?: unknown): Promise<T> {
    try {
      const result = await $fetch<T>(`${apiBase}${path}`, {
        method, credentials: 'include',
        headers: { 'X-XPlay-CSRF': auth.session.value.csrf_token ?? '' },
        ...(body === undefined ? {} : { body }),
      })
      await refreshNuxtData('site-image-manifest')
      return result
    } catch (error) { showError(error); throw error }
  }
  async function upload<T>(resourceId: string, file: File, name: string, note: string): Promise<T> {
    try {
      const result = await $fetch<T>(`${apiBase}/admin/site-images/resources/${resourceId}/versions/file`, {
        method: 'POST', credentials: 'include',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-XPlay-CSRF': auth.session.value.csrf_token ?? '',
          'X-XPlay-Image-Name': encodeURIComponent(name),
          'X-XPlay-Image-Note': encodeURIComponent(note),
          'X-XPlay-Image-Mime': file.type,
        },
        body: file,
      })
      await refreshNuxtData('site-image-manifest')
      return result
    } catch (error) { showError(error); throw error }
  }
  function preview(version: SiteImageVersion): string {
    return version.static_path ?? `${apiBase}/admin/site-images/versions/${version.id}/file`
  }
  return { get, mutate, upload, preview }
}
