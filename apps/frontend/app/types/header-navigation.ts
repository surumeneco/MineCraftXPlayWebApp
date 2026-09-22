export interface HeaderNavigationLink {
  label: string
  to: string
  /** Render a normal anchor for paths served outside Nuxt, such as BlueMap. */
  native?: boolean
  children?: never
}

export interface HeaderNavigationGroup {
  label: string
  children: HeaderNavigationLink[]
  to?: never
  native?: never
}

export type HeaderNavigationItem = HeaderNavigationLink | HeaderNavigationGroup
