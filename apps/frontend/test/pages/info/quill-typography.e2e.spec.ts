import { expect, test } from '@nuxt/test-utils/playwright'

const delta = { ops: [
  { insert: '本文見出し\n', attributes: { header: 3 } },
  { insert: '通常 ' },
  { insert: '小', attributes: { size: 'small' } },
  { insert: ' ' },
  { insert: '大', attributes: { size: 'large' } },
  { insert: ' ' },
  { insert: '特大', attributes: { size: 'huge' } },
  { insert: '\n' },
] }
const instant = '2026-09-29T05:00:00Z'

test('spot guide, notice and company Bubble bodies share Quill font tokens and no outer padding', async ({ page, goto }) => {
  const fulfill = async (route: import('@playwright/test').Route, body: unknown) => {
    const origin = route.request().headers()['origin'] ?? 'http://localhost:3000'
    await route.fulfill({ status: 200, contentType: 'application/json',
      headers: { 'access-control-allow-origin': new URL(origin).origin,
        'access-control-allow-credentials': 'true' }, body: JSON.stringify(body) })
  }
  await page.route('**/api/auth/session', route => fulfill(route,{ authenticated:false }))
  await page.route('**/api/notices/**', route => fulfill(route,{
    id:1,title:'Quill確認',tags:[],published_at:instant,updated_at:instant,
    is_draft:false,body_delta:delta,
  }))
  await page.route('**/api/spots/public/**', route => fulfill(route,{
    id:'spot-test',kind:'public',name:'スポット表示確認',body_delta:delta,
    main_image_id:null,dimension:'minecraft:overworld',pos_x:0,pos_z:0,
    territory_id:null,territory_name:null,tags:[],status:'published',
    sort_order:0,created_at:instant,updated_at:instant,published_at:instant,version:1,
  }))
  await page.route('**/api/companies/test-company', route => fulfill(route,{
    id:'test-company',name:'企業表示確認',abbreviation:null,is_public:false,status:'approved',tags:[],
    representative:{id:'rep',name:'代表者',minecraft_ids:[]},members:[],
    headquarters:{id:null,name:null},activities:'',image_id:null,map_color:null,
    introduction_delta:delta,applicant:{id:'rep',name:'代表者'},
    applied_at:instant,approved_at:instant,changed_at:instant,
    application_type:'new',pending_changes:false,can_edit:false,can_reapply:false,can_withdraw:false,
  }))

  for (const path of ['/info/notice/Quill確認','/info/public-spots/spot-test','/companies/test-company']) {
    await goto(path,{waitUntil:'hydration'})
    const viewer = page.locator('main .xplay-quill-readonly.ql-container.ql-bubble')
    const body = viewer.locator('.ql-editor')
    await expect(body).toContainText('本文見出し')
    await expect(viewer).toHaveCSS('font-size','16px')
    await expect(body).toHaveCSS('padding-top','0px')
    await expect(body).toHaveCSS('padding-left','0px')
    await expect(body.locator('h3')).toHaveCSS('font-size','20px')
    await expect(body.locator('h3')).toHaveCSS('padding-left','0px')
    await expect(body.locator('h3')).toHaveCSS('border-left-width','0px')
    await expect(body.locator('h3')).toHaveCSS('margin-bottom','0px')
    await expect(body.locator('.ql-size-small')).toHaveCSS('font-size','14px')
    await expect(body.locator('.ql-size-large')).toHaveCSS('font-size','20px')
    await expect(body.locator('.ql-size-huge')).toHaveCSS('font-size','24px')
  }
})
