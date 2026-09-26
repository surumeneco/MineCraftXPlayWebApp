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

/** Mirrors the one-time database seed until the public API responds. */
export const initialHomeLayout: HomeLayoutResponse = {
  revision: 0,
  links: [
    { key:'info.notice',group:'info',title:'お知らせ',url:'/info/notice' },
    { key:'info.about',group:'info',title:'コミュニティ概要',url:'/info/about' },
    { key:'info.operators',group:'info',title:'運営メンバー紹介',url:'/info/operators' },
    { key:'info.server',group:'info',title:'サーバー情報',url:'/info/server' },
    { key:'info.rules',group:'info',title:'運営方針とルール',url:'/info/rules' },
    { key:'lists.territories',group:'lists',title:'領地一覧',url:'/territories' },
    { key:'applications.territories',group:'applications',title:'領地申請',url:'/territories/apply' },
  ],
  data: {
    categories: [
      { id:'legacy-quick-links',title:'クイックリンク',cards: [
        { id:'legacy-ofuse',type:'custom',title:'ご支援はこちらから',note:'',url:'https://ofuse.me/mofupark',image:{static_path:'/images/card-ofuse.jpg'},new_tab:true },
        { id:'legacy-bluemap',type:'custom',title:'Bluemapを見る',note:'',url:'/bluemap/',image:{static_path:'/images/bluemap.png'},new_tab:false },
      ] },
      { id:'legacy-site-guide',title:'サイト案内',cards: [
        { id:'legacy-info',type:'custom',title:'情報',url:'/info',image:{static_path:'/images/card-default.svg'} },
        { id:'legacy-lists',type:'custom',title:'一覧',url:'/lists',image:{static_path:'/images/card-default.svg'} },
        { id:'legacy-applications',type:'custom',title:'申請',url:'/applications',image:{static_path:'/images/card-default.svg'} },
      ] },
    ],
    hubs: [
      { key:'info.notice',note:'',image:{static_path:'/images/card-default.svg'} },
      { key:'info.about',note:'',image:{static_path:'/images/card-default.svg'} },
      { key:'info.operators',note:'',image:{static_path:'/images/card-default.svg'} },
      { key:'info.server',note:'',image:{static_path:'/images/card-default.svg'} },
      { key:'info.rules',note:'',image:{static_path:'/images/card-default.svg'} },
      { key:'lists.territories',note:'',image:{static_path:'/images/card-default.svg'} },
      { key:'applications.territories',note:'',image:{static_path:'/images/card-default.svg'} },
    ],
  },
}

export function useHomeLayout() {
  const { public: { apiBase, bluemapBase } } = useRuntimeConfig()
  const response = useFetch<HomeLayoutResponse>(`${apiBase}/home-layout`, {
    key: 'home-layout', server: false, lazy: true,
    default: () => structuredClone(initialHomeLayout),
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
