<template>
  <div class="mb-3">
    <label :for="fieldId" class="form-label">領地画像（任意・1枚）</label>
    <div class="d-flex flex-wrap gap-3 align-items-start">
      <img v-if="source" :src="source" alt="選択中の領地画像" class="territory-image-preview border rounded" />
      <div v-else class="territory-image-preview territory-image-empty border rounded text-body-secondary">画像が設定されていません</div>
      <div class="flex-grow-1">
        <input :id="fieldId" type="file" class="form-control" accept="image/png,image/jpeg,image/webp,image/svg+xml"
          :disabled="uploading" @change="uploadFile" />
        <p class="small text-body-secondary mt-1 mb-2">JPEG / PNG / WebP / 静的SVG。画像を選ばなくても申請できます。</p>
        <button v-if="modelValue" type="button" class="btn btn-outline-secondary btn-sm"
          :disabled="uploading" @click="clear">画像を解除</button>
        <p v-if="uploading" role="status" class="mt-2 mb-0">画像を登録しています…</p>
        <p v-if="error" class="text-danger small mt-2 mb-0" role="alert">{{ error }}</p>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { userFacingError } from '../../utils/user-error'
const props = defineProps<{ modelValue: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [string | null]; uploading: [boolean] }>()
const fieldId = useId()
const auth = useAccountSession()
const { public: { apiBase } } = useRuntimeConfig()
const uploading = ref(false), error = ref(''), localSource = ref('')
let requestNumber = 0
const source = computed(() => localSource.value || (props.modelValue ? `${apiBase}/territory-images/${props.modelValue}` : ''))
function release() {
  if (localSource.value) URL.revokeObjectURL(localSource.value)
  localSource.value = ''
}
function clear() {
  requestNumber++
  release()
  emit('update:modelValue', null)
}
async function uploadFile(event: Event) {
  const element = event.target as HTMLInputElement
  const file = element.files?.[0]
  if (!file) return
  const current = ++requestNumber
  error.value = ''
  release()
  localSource.value = URL.createObjectURL(file)
  uploading.value = true
  emit('uploading', true)
  try {
    const saved = await $fetch<{ image_id: string }>(`${apiBase}/territory-images/file`, {
      method: 'POST', credentials: 'include',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-XPlay-CSRF': auth.session.value.csrf_token ?? '',
        'X-XPlay-Image-Mime': file.type,
      },
      body: file,
    })
    if (current === requestNumber) emit('update:modelValue', saved.image_id)
  } catch (cause) {
    if (current === requestNumber) {
      error.value = userFacingError(cause)
      release()
    }
  } finally {
    if (current === requestNumber) {
      uploading.value = false
      emit('uploading', false)
    }
    element.value = ''
  }
}
onBeforeUnmount(() => { requestNumber++; release() })
</script>
<style scoped>
.territory-image-preview { width: min(100%, 16rem); height: 10rem; object-fit: cover; }
.territory-image-empty { display: flex; align-items: center; justify-content: center; padding: 1rem; text-align: center; }
</style>
