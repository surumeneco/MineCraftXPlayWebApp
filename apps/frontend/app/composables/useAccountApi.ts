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
  const get = <T>(path: string) => $fetch<T>(`${apiBase}${path}`, { credentials: 'include' })
  const mutate = <T>(path: string, method: 'PATCH' | 'POST' | 'DELETE', body?: unknown) =>
    $fetch<T>(`${apiBase}${path}`, {
      method, credentials: 'include',
      headers: { 'X-XPlay-CSRF': auth.session.value.csrf_token ?? '' },
      ...(body === undefined ? {} : { body }),
    })
  return { get, mutate }
}

export function accountError(error: unknown): string {
  const issue = error as { data?: { message?: string | string[] }; message?: string }
  return Array.isArray(issue?.data?.message)
    ? issue.data.message.join('、')
    : issue?.data?.message || issue?.message || '操作に失敗しました。'
}
