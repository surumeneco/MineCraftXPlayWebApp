// Quill Toolbar Module: https://quilljs.com/docs/modules/toolbar
// Each nested array is a Snow toolbar group, in left-to-right order.
// The false options restore normal text, left alignment, or a non-list paragraph.
export const noticeToolbarOptions = [
  [{ header: [false, 3, 4, 5, 6] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ color: [] }, { background: [] }],
  [{ size: ['small', false, 'large', 'huge'] }],
  [{ align: [false, 'center', 'right', 'justify'] }],
  ['blockquote', 'code-block'],
  [{ list: [false, 'ordered', 'bullet', 'check'] }],
  ['clean'],
  ['link', 'image'],
]
