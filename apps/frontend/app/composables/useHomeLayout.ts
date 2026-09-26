export type ManagedCardImage = { image_id?: string; static_path?: string } | null
export type HomeCardConfig = {
  id: string
  type: 'custom' | 'hub'
  title?: string
  note?: string
  url?: string
  image?: ManagedCardImage
  new_tab?: boolean
  hub_key?: string
}
export type HomeCategoryConfig = { id: string; title: string; cards: HomeCardConfig[] }
export type HubCardConfig = { key: string; note: string; image: ManagedCardImage }
export type HubCardLink = { key: string; group: string; title: string; url: string }
export type HomeLayoutData = { categories: HomeCategoryConfig[]; hubs: HubCardConfig[] }
export type HomeLayoutResponse = { revision: number; data: HomeLayoutData; links: HubCardLink[] }

export function useHomeLayout() {
  const { public: { apiBase, bluemapBase } } = useRuntimeConfig()
  const response = useFetch<HomeLayoutResponse>(`${apiBase}/home-layout`, {
    key: 'home-layout', server: false, lazy: true,
  })
  function imageSource(asset: ManagedCardImage | undefined): string | undefined {
    if (asset?.image_id) return `${apiBase}/home-layout/images/${encodeURIComponent(asset.image_id)}`
    return asset?.static_path || undefined
  }
  function destination(url: string): string {
    return url === '/bluemap/' ? bluemapBase : url
  }
  function isNative(url: string): boolean {
    return url === '/bluemap/' || /^https?:\/\//i.test(url)
  }
  return { ...response, imageSource, destination, isNative }
}
