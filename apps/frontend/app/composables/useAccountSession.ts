export interface AccountSessionInfo {
  authenticated: boolean
  account_id?: string
  is_admin?: boolean
  csrf_token?: string
}

export function useAccountSession() {
  const session = useState<AccountSessionInfo>('xplay-account-session', () => ({ authenticated: false }))
  const loaded = useState<boolean>('xplay-account-loaded', () => false)
  const { public: { apiBase } } = useRuntimeConfig()

  async function refresh() {
    try {
      session.value = await $fetch<AccountSessionInfo>(`${apiBase}/auth/session`, { credentials: 'include' })
    } catch {
      session.value = { authenticated: false }
    } finally {
      loaded.value = true
    }
    return session.value
  }

  async function logout() {
    const csrf = session.value.csrf_token
    if (!csrf) throw new Error('認証セッションを確認できません。')
    await $fetch(`${apiBase}/auth/logout`, {
      method: 'POST', credentials: 'include', headers: { 'X-XPlay-CSRF': csrf },
    })
    session.value = { authenticated: false }
    loaded.value = true
  }

  const authenticated = computed(() => session.value.authenticated)
  const isAdmin = computed(() => authenticated.value && session.value.is_admin === true)
  return { session, authenticated, isAdmin, loaded, refresh, logout }
}
