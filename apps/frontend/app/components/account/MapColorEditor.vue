<template>
  <section class="border rounded p-3 my-4">
    <h2 class="h4">BlueMap表示色</h2>
    <p v-if="loading" role="status">表示色を読み込んでいます…</p>
    <template v-else>
      <div class="d-flex gap-3 align-items-center mb-3">
        <span class="color-preview border rounded" :style="{backgroundColor:hex}" aria-hidden="true" />
        <code>{{ hex }}</code>
      </div>
      <div class="row g-3">
        <div class="col-md-4"><label class="form-label" for="map-color-hex">カラーコード</label><input id="map-color-hex" v-model="hexInput" class="form-control" @change="applyHex" /></div>
        <div class="col-md-4"><label class="form-label" for="map-color-rgb">RGB</label><input id="map-color-rgb" v-model="rgbInput" class="form-control" placeholder="255, 0, 0" @change="applyRgbText" /></div>
        <div class="col-md-4"><label class="form-label" for="map-color-hsv">HSV</label><input id="map-color-hsv" v-model="hsvInput" class="form-control" placeholder="0, 100, 100" @change="applyHsvText" /></div>
      </div>
      <div class="row g-3 mt-1">
        <div v-for="key in rgbKeys" :key="key" class="col-md-4">
          <label class="form-label" :for="`rgb-${key}`">{{ key.toUpperCase() }}: {{ color[key] }}</label>
          <input :id="`rgb-${key}`" v-model.number="color[key]" type="range" min="0" max="255" class="form-range" @input="syncFromRgb" />
        </div>
      </div>
      <div class="row g-3">
        <div class="col-md-4"><label class="form-label" for="hue">H: {{ hsv.h }}</label><input id="hue" v-model.number="hsv.h" type="range" min="0" max="359" class="form-range" @input="syncFromHsv" /></div>
        <div class="col-md-4"><label class="form-label" for="sat">S: {{ hsv.s }}%</label><input id="sat" v-model.number="hsv.s" type="range" min="0" max="100" class="form-range" @input="syncFromHsv" /></div>
        <div class="col-md-4"><label class="form-label" for="val">V: {{ hsv.v }}%</label><input id="val" v-model.number="hsv.v" type="range" min="0" max="100" class="form-range" @input="syncFromHsv" /></div>
      </div>
      <p v-if="error" class="text-danger small">{{ error }}</p>
      <button type="button" class="btn btn-primary" :disabled="busy" @click="save">保存</button>
    </template>
  </section>
</template>
<script setup lang="ts">
import { accountError } from '../../composables/useAccountApi'
type Color={r:number;g:number;b:number};type Hsv={h:number;s:number;v:number}
const props=defineProps<{accountId?:string}>()
const {get,mutate}=useAccountApi()
const loading=ref(true),busy=ref(false),error=ref('')
const color=reactive<Color>({r:255,g:0,b:0}),hsv=reactive<Hsv>({h:0,s:100,v:100})
const hexInput=ref('#ff0000'),rgbInput=ref('255, 0, 0'),hsvInput=ref('0, 100, 100')
const rgbKeys=['r','g','b'] as const
const endpoint=computed(()=>props.accountId?`/admin/accounts/${props.accountId}/map-color`:'/accounts/me/map-color')
const hex=computed(()=>`#${[color.r,color.g,color.b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('')}`)
function rgbToHsv(c:Color):Hsv{const r=c.r/255,g=c.g/255,b=c.b/255,max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0;if(d){if(max===r)h=60*(((g-b)/d)%6);else if(max===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4)}if(h<0)h+=360;return{h:Math.round(h)%360,s:Math.round(max?d/max*100:0),v:Math.round(max*100)}}
function hsvToRgb(v:Hsv):Color{const h=((v.h%360)+360)%360,s=v.s/100,val=v.v/100,c=val*s,x=c*(1-Math.abs((h/60)%2-1)),m=val-c;let r=0,g=0,b=0;if(h<60)[r,g]=[c,x];else if(h<120)[r,g]=[x,c];else if(h<180)[g,b]=[c,x];else if(h<240)[g,b]=[x,c];else if(h<300)[r,b]=[x,c];else[r,b]=[c,x];return{r:Math.round((r+m)*255),g:Math.round((g+m)*255),b:Math.round((b+m)*255)}}
function refreshTexts(){hexInput.value=hex.value;rgbInput.value=`${color.r}, ${color.g}, ${color.b}`;hsvInput.value=`${hsv.h}, ${hsv.s}, ${hsv.v}`}
function assign(c:Color){color.r=c.r;color.g=c.g;color.b=c.b;Object.assign(hsv,rgbToHsv(c));refreshTexts()}
function syncFromRgb(){Object.assign(hsv,rgbToHsv(color));refreshTexts()}
function syncFromHsv(){Object.assign(color,hsvToRgb(hsv));refreshTexts()}
function applyHex(){const m=hexInput.value.trim().match(/^#?([0-9a-f]{6})$/i);if(!m){error.value='6桁の16進カラーコードを入力してください。';return}const n=parseInt(m[1],16);error.value='';assign({r:(n>>16)&255,g:(n>>8)&255,b:n&255})}
function parseTriple(text:string,max:[number,number,number]){const parts=text.split(/[,\s]+/).filter(Boolean).map(Number);return parts.length===3&&parts.every((v,i)=>Number.isFinite(v)&&v>=0&&v<=max[i])?parts:null}
function applyRgbText(){const p=parseTriple(rgbInput.value,[255,255,255]);if(!p){error.value='RGBは0～255の3値で入力してください。';return}error.value='';assign({r:Math.round(p[0]),g:Math.round(p[1]),b:Math.round(p[2])})}
function applyHsvText(){const p=parseTriple(hsvInput.value,[359,100,100]);if(!p){error.value='HSVはH=0～359、S/V=0～100で入力してください。';return}error.value='';Object.assign(hsv,{h:Math.round(p[0]),s:Math.round(p[1]),v:Math.round(p[2])});syncFromHsv()}
async function save(){busy.value=true;error.value='';try{assign(await mutate<Color>(endpoint.value,'PATCH',{...color}))}catch(e){error.value=accountError(e)}finally{busy.value=false}}
onMounted(async()=>{try{assign(await get<Color>(endpoint.value))}catch(e){error.value=accountError(e)}finally{loading.value=false}})
</script>
<style scoped>.color-preview{width:3rem;height:3rem;display:inline-block}</style>
