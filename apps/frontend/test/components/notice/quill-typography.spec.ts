import { readFile } from 'node:fs/promises'
import { compile } from 'sass'
import { describe, expect, it } from 'vitest'

describe('Quill shared typography and read-only layout', () => {
  it('uses one padding-free Bubble viewer in every read-only Quill component', async () => {
    for (const path of [
      'app/pages/info/notice/[title].vue',
      'app/components/spot/Detail.vue',
      'app/components/company/Introduction.vue',
    ]) {
      const source = await readFile(path,'utf8')
      expect(source).toContain('class="xplay-quill-readonly"')
      expect(source).toMatch(/theme: *['\"]bubble['\"]/)
      expect(source).not.toContain('xplay-notice-readonly')
    }
    const notice = await readFile('app/pages/info/notice/[title].vue','utf8')
    expect(notice).not.toContain('<style>')
  })

  it('builds token-defined paragraph, size and heading styles for Snow and Bubble', () => {
    const css = compile('app/assets/styles/quill-dark-ui.scss').css
    for (const token of ['md','sm','lg','xl','xxl','xs']) expect(css).toContain(`var(--xplay-font-${token})`)
    expect(css).toContain('.xplay-shell .xplay-quill-editor.ql-container.ql-snow')
    expect(css).toContain('.xplay-shell .xplay-quill-readonly.ql-container.ql-bubble')
    expect(css).toMatch(/\.xplay-quill-readonly\.ql-container\.ql-bubble\s*\{\s*height:\s*auto;/)
    expect(css).toMatch(/\.xplay-quill-readonly\.ql-container\.ql-bubble \.ql-editor\s*\{[^}]*padding:\s*0;/)
    expect(css).toContain('overflow-y: visible;')
    expect(css).toContain('.ql-size-small')
    expect(css).toContain('.ql-size-large')
    expect(css).toContain('.ql-size-huge')
    expect(css).toContain('.ql-picker-item[data-value=small]::before')
  })

  it('applies the site heading decoration to Quill h2-h5 as well', () => {
    const css = compile('app/assets/styles/theme.scss').css
    expect(css).toContain('.xplay-shell main h2:not(.xplay-page-title)')
    for (const heading of ['h3','h4','h5']) {
      expect(css).toContain(`.xplay-shell main ${heading} {`)
    }
    expect(css).not.toContain(':not(.ql-editor')
  })
})
