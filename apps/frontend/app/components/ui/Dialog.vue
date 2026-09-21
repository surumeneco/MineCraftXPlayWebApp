<template>
  <dialog ref="dialog" class="xplay-dialog" :aria-labelledby="titleId" :aria-describedby="messageId"
    @cancel.prevent="emit('close')" @click="handleBackdrop">
    <div class="xplay-dialog__surface" role="document">
      <header class="d-flex align-items-center gap-3 pb-3 border-bottom">
        <span class="xplay-dialog__icon" :class="[`xplay-dialog__icon--${kind}`, { 'xplay-dialog__icon--triangle': kind === 'error' && errorShape === 'triangle' }]" aria-hidden="true">
          {{ kind === 'confirmation' ? '?' : kind === 'information' ? 'i' : '!' }}
        </span>
        <h2 :id="titleId" class="h5 mb-0">{{ title }}</h2>
      </header>
      <div :id="messageId" class="py-3 xplay-dialog__message"><slot>{{ message }}</slot></div>
      <footer class="d-flex justify-content-end gap-2 flex-wrap">
        <button v-for="button in effectiveButtons" :key="button.value" type="button" class="btn"
          :class="`btn-${button.color ?? 'secondary'}`" :disabled="busy" @click="emit('action', button.value)">
          {{ busy && button.value === 'yes' ? '処理中…' : button.label }}
        </button>
      </footer>
    </div>
  </dialog>
</template>

<script setup lang="ts">
export type DialogKind = 'confirmation' | 'information' | 'error'
export type DialogPreset = 'yes-no' | 'confirm-cancel' | 'close' | 'cancel' | 'none'
export type DialogButton = { value: string; label: string; color?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark' | 'outline-primary' | 'outline-secondary' | 'outline-danger' }
const props = withDefaults(defineProps<{
  open: boolean
  title: string
  message?: string
  kind?: DialogKind
  preset?: DialogPreset
  buttons?: DialogButton[]
  busy?: boolean
  errorShape?: 'circle' | 'triangle'
}>(), { kind: 'information', preset: 'close', buttons: () => [], busy: false, errorShape: 'circle' })
const emit = defineEmits<{ action: [value: string]; close: [] }>()
const effectiveButtons = computed<DialogButton[]>(() => props.buttons.length ? props.buttons : {
  'yes-no': [{ value: 'no', label: 'いいえ', color: 'outline-secondary' }, { value: 'yes', label: 'はい', color: 'success' }],
  'confirm-cancel': [{ value: 'cancel', label: 'キャンセル', color: 'outline-secondary' }, { value: 'yes', label: '確認する', color: 'primary' }],
  close: [{ value: 'close', label: '閉じる', color: 'primary' }],
  cancel: [{ value: 'cancel', label: 'キャンセル', color: 'outline-secondary' }],
  none: [],
}[props.preset] as DialogButton[])
const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId(), messageId = useId()
watch(() => props.open, async (open) => {
  await nextTick()
  if (!dialog.value) return
  if (open && !dialog.value.open) dialog.value.showModal()
  else if (!open && dialog.value.open) dialog.value.close()
}, { immediate: true })
function handleBackdrop(event: MouseEvent) {
  if (event.target === dialog.value && !props.busy) emit('close')
}
onBeforeUnmount(() => { if (dialog.value?.open) dialog.value.close() })
</script>

<style scoped>
.xplay-dialog { width: min(92vw, 32rem); max-width: 32rem; padding: 0; color: var(--bs-body-color);
  background: var(--bs-body-bg); border: 1px solid var(--bs-border-color); border-radius: .8rem;
  box-shadow: 0 .8rem 2.5rem rgba(0,0,0,.45); }
.xplay-dialog::backdrop { background: rgba(0,0,0,.67); }
.xplay-dialog__surface { padding: 1.3rem; }
.xplay-dialog__message { white-space: pre-wrap; overflow-wrap: anywhere; }
.xplay-dialog__icon { display: inline-flex; flex: 0 0 2rem; align-items: center; justify-content: center; width: 2rem; height: 2rem;
  font-size: 1.25rem; font-weight: 800; border: 2px solid currentColor; border-radius: 50%; line-height: 1; }
.xplay-dialog__icon--confirmation { color: var(--bs-success); }
.xplay-dialog__icon--information { color: var(--bs-info); }
.xplay-dialog__icon--error { color: var(--bs-danger); }
.xplay-dialog__icon--triangle { border-radius: .15rem; clip-path: polygon(50% 0, 100% 100%, 0 100%); }
</style>
