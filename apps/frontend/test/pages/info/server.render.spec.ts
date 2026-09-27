import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import Server from '../../../app/pages/info/server.vue'

describe('Server information page', () => {
  it('lists the independent chicken plugin and BlueMap territory sync', async () => {
    const wrapper = await mountSuspended(Server)
    const items = wrapper.findAll('li').map(item => item.text())
    expect(items).toContain('TerritoryMapSync：領地情報をBlueMapのマーカーへ同期')
    expect(items).toContain('What a Wonderful Chicken：騎乗・育成できる特殊なニワトリを追加')
    expect(items).toContain('BlueMap：Webマップの生成')
    expect(items).toContain('ClickMobs：Mobの運搬を補助')
  })
})
