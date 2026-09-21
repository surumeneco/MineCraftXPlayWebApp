import { userFacingError } from '../utils/user-error'

export type DiscordIdentity = { discord_id: string; username: string; display_name: string }
export type MinecraftIdentity = { id: string; edition: 'je' | 'be'; username: string }
export type MergedAccount = { id: string; name: string; merged_at: string }
export type AccountRecord = {
  id: string
  name: string
  created_at: string
  is_admin: boolean
  is_protected: boolean
  discord_ids: string[]
  discord_profiles: DiscordIdentity[]
  minecraft_ids: MinecraftIdentity[]
  merged_sources: MergedAccount[]
}

export function useAccountApi() {
  const { public: { apiBase } } = useRuntimeConfig()
  const auth = useAccountSession()
  const { showError } = useUiFeedback()
  async function get<T>(path: string): Promise<T> {
    try { return await $fetch<T>(`${apiBase}${path}`, { credentials: 'include' }) }
    catch (error) { showError(error); throw error }
  }
  async function mutate<T>(path: string, method: 'PATCH' | 'POST' | 'DELETE', body?: unknown): Promise<T> {
    try {
      return await $fetch<T>(`${apiBase}${path}`, {
        method, credentials: 'include',
        headers: { 'X-XPlay-CSRF': auth.session.value.csrf_token ?? '' },
        ...(body === undefined ? {} : { body }),
      })
    } catch (error) { showError(error); throw error }
  }
  return { get, mutate }
}

export const accountError = userFacingError
