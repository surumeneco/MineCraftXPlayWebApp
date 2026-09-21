import { userFacingError } from '../utils/user-error'

type Feedback = { kind: 'error' | 'information'; title: string; message: string } | null

export function useUiFeedback() {
  const feedback = useState<Feedback>('xplay-dialog-feedback', () => null)
  const success = useState<string>('xplay-success-feedback', () => '')
  function showError(error: unknown) {
    success.value = ''
    feedback.value = { kind: 'error', title: 'エラー', message: typeof error === 'string' && /[\u3040-\u30ff\u3400-\u9fff]/u.test(error) ? error : userFacingError(error) }
  }
  function showInformation(message: string, title = 'お知らせ') {
    feedback.value = { kind: 'information', title, message }
  }
  function showSuccess(message: string) {
    feedback.value = null
    success.value = message
  }
  function closeFeedback() { feedback.value = null }
  function closeSuccess() { success.value = '' }
  return { feedback, success, showError, showInformation, showSuccess, closeFeedback, closeSuccess }
}
