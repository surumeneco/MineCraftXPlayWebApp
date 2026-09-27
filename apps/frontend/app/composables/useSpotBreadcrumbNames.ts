import type { SpotKind } from '../types/spot'

/** Share loaded spot names with the global breadcrumb without making a second API request. */
export function useSpotBreadcrumbNames() {
  const names = useState<Record<string, string>>('xplay-spot-breadcrumb-names', () => ({}))
  const key = (kind: SpotKind, id: string) => kind + ':' + id

  function getName(kind: SpotKind, id: string): string {
    return names.value[key(kind, id)] ?? ''
  }
  function remember(kind: SpotKind, id: string, name: string) {
    if (!id || !name) return
    names.value = { ...names.value, [key(kind, id)]: name }
  }
  function forget(kind: SpotKind, id: string) {
    const currentKey = key(kind, id)
    if (!(currentKey in names.value)) return
    const updated = { ...names.value }
    delete updated[currentKey]
    names.value = updated
  }

  return { getName, remember, forget }
}
