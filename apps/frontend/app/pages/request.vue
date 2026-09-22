<template>
  <section>
    <UiPageTitle title="要望を送る" />
    <form @submit.prevent="submit">
      <div class="mb-3">
        <label for="request-content" class="form-label">要望</label>
        <textarea
          id="request-content"
          v-model="content"
          class="form-control"
          :class="{ 'is-invalid': validationError }"
          rows="8"
          :disabled="busy"
          :aria-invalid="!!validationError"
          :aria-describedby="validationError ? 'request-error' : 'request-count'"
          required
        />
        <div v-if="validationError" id="request-error" class="invalid-feedback" role="alert">{{ validationError }}</div>
        <div id="request-count" class="form-text">{{ content.length }} / 2000文字</div>
      </div>
      <button type="submit" class="btn btn-primary" :disabled="busy">
        {{ busy ? '送信中…' : '送る' }}
      </button>
    </form>
  </section>
</template>

<script setup lang="ts">
const { public: { apiBase } } = useRuntimeConfig()
const { showError, showSuccess } = useUiFeedback()
const content = ref('')
const busy = ref(false)
const validationError = ref('')

watch(content, () => { validationError.value = '' })

async function submit() {
  if (busy.value) return
  if (!content.value.trim()) {
    validationError.value = '要望を入力してください。'
    return
  }
  if (content.value.length > 2000) {
    validationError.value = '要望は2000文字以内で入力してください。'
    return
  }
  validationError.value = ''
  busy.value = true
  try {
    await $fetch(`${apiBase}/requests`, { method: 'POST', body: { content: content.value } })
    content.value = ''
    showSuccess('要望を送信しました。')
  } catch (error) {
    showError(error)
  } finally {
    busy.value = false
  }
}
</script>
