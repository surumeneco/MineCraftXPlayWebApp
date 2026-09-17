export interface HeaderNavigationLink {
  label: string
  to: string
  children?: never
}

export interface HeaderNavigationGroup {
  label: string
  children: HeaderNavigationLink[]
  to?: never
}

export type HeaderNavigationItem = HeaderNavigationLink | HeaderNavigationGroup
