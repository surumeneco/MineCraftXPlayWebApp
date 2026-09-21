<template>
  <UiDialog :open="open" :title="title" :message="message" kind="confirmation" preset="confirm-cancel"
    :busy="busy" :buttons="[
      { value: 'cancel', label: 'キャンセル', color: 'outline-secondary' },
      { value: 'yes', label: confirmLabel, color: danger ? 'danger' : 'success' },
    ]" @action="onAction" @close="emit('cancel')" />
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  open: boolean; title: string; message: string; confirmLabel?: string; danger?: boolean; busy?: boolean
}>(), { confirmLabel: '実行する', danger: false, busy: false })
const emit = defineEmits<{ confirm: []; cancel: [] }>()
function onAction(value: string) {
  if (value === 'yes') emit('confirm')
  else emit('cancel')
}
</script>
