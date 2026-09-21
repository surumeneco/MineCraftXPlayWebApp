<template>
  <dialog ref="dialog" class="xplay-confirm-dialog" :aria-labelledby="titleId" :aria-describedby="messageId"
    @cancel.prevent="emit('cancel')" @click="handleBackdrop">
    <div class="xplay-confirm-dialog__surface" role="document">
      <header class="xplay-confirm-dialog__heading">
        <h2 :id="titleId" class="h5 mb-0">{{ title }}</h2>
      </header>
      <div :id="messageId" class="py-3">{{ message }}</div>
      <footer class="d-flex justify-content-end gap-2 flex-wrap">
        <button ref="cancelButton" type="button" class="btn btn-outline-secondary" :disabled="busy" @click="emit('cancel')">キャンセル</button>
        <button type="button" class="btn" :class="danger ? 'btn-danger' : 'btn-primary'" :disabled="busy" @click="emit('confirm')">
          {{ busy ? '処理中…' : confirmLabel }}
        </button>
      </footer>
    </div>
  </dialog>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  open: boolean; title: string; message: string; confirmLabel?: string; danger?: boolean; busy?: boolean
}>(), { confirmLabel: '実行する', danger: false, busy: false })
const emit = defineEmits<{ confirm: []; cancel: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const cancelButton = ref<HTMLButtonElement | null>(null)
watch(() => props.open, async (open) => {
  await nextTick()
  if (!dialog.value) return
  if (open && !dialog.value.open) {
    dialog.value.showModal()
    cancelButton.value?.focus()
  } else if (!open && dialog.value.open) dialog.value.close()
}, { immediate: true })
function handleBackdrop(event: MouseEvent) {
  if (event.target === dialog.value && !props.busy) emit('cancel')
}
onBeforeUnmount(() => { if (dialog.value?.open) dialog.value.close() })
const titleId = useId(), messageId = useId()
</script>

<style scoped>
.xplay-confirm-dialog { width: min(92vw, 30rem); max-width: 30rem; padding: 0; color: var(--bs-body-color);
  background: var(--bs-body-bg); border: 1px solid var(--bs-border-color); border-radius: .8rem;
  box-shadow: 0 .8rem 2.5rem rgba(0,0,0,.45); }
.xplay-confirm-dialog::backdrop { background: rgba(0,0,0,.67); }
.xplay-confirm-dialog__surface { padding: 1.4rem; }
.xplay-confirm-dialog__heading { border-bottom: 1px solid var(--bs-border-color); padding-bottom: .8rem; }
</style>
