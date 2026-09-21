import type { BootstrapIconName } from './bootstrap-icon'

export interface FooterExternalLink {
  label: string
  href: string
  icon?: BootstrapIconName
}

export interface FooterInternalLink {
  label: string
  to: string
  icon?: BootstrapIconName
}
