import { describe, expect, it } from 'vitest'
import { noticeToolbarOptions } from '../../../app/components/notice/toolbar-options'

describe('Notice toolbar configuration', () => {
  it('keeps every control in the requested left-to-right order', () => {
    expect(noticeToolbarOptions).toEqual([
      [{ header: [false, 3, 4, 5, 6] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ color: [] }, { background: [] }],
      [{ size: ['small', false, 'large', 'huge'] }],
      [{ align: [false, 'center', 'right', 'justify'] }],
      ['blockquote', 'code-block'],
      [{ list: [false, 'ordered', 'bullet', 'check'] }],
      ['clean'],
      ['link', 'image'],
    ])
  })

  it('keeps a reset value for heading, size, alignment and list dropdowns', () => {
    expect(noticeToolbarOptions[0]).toEqual([{ header: [false, 3, 4, 5, 6] }])
    expect(noticeToolbarOptions[3]).toEqual([{ size: ['small', false, 'large', 'huge'] }])
    expect(noticeToolbarOptions[4]).toEqual([{ align: [false, 'center', 'right', 'justify'] }])
    expect(noticeToolbarOptions[6]).toEqual([{ list: [false, 'ordered', 'bullet', 'check'] }])
  })
})
