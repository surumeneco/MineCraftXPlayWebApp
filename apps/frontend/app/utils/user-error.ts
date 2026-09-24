const translations: Record<string, string> = {
  'Invalid UUID': '識別子の形式が正しくありません。',
  'Title is required; whitespace and URL-reserved characters are prohibited': 'タイトルは必須です。空白やURLで使用する記号は指定できません。',
  'Invalid Delta': '本文の形式が正しくありません。',
  'Invalid Delta operations': '本文データの形式が正しくありません。',
  'Tags must be an array': 'タグの指定形式が正しくありません。',
  'Tag must contain 1-20 characters and no whitespace': 'タグ名は1～20文字で入力してください。空白は使用できません。',
  'expected_version must be a positive integer': '編集バージョンが正しくありません。ページを再読み込みしてください。',
  'Invalid image embed': '本文に含まれる画像の形式が正しくありません。',
  'Invalid image URL': '画像のURLが正しくありません。',
  'Image must be uploaded to this server': 'このサーバーにアップロードした画像のみ使用できます。',
  'Invalid notice payload': 'お知らせの入力内容が正しくありません。',
  'Title or tag already exists': 'タイトルまたはタグが既に存在します。',
  'Notice not found': 'お知らせが見つかりません。',
  'Notice was modified; reload it': '他の操作によって記事が更新されました。再読み込みしてください。',
  'Published title cannot change': '公開済みの記事のタイトルは変更できません。',
  'Body cannot be empty': '本文を入力してください。',
  'At least one tag is required for a published notice': '公開中の記事にはタグが1件以上必要です。',
  'At least one tag is required to publish a notice': '公開するにはタグが1件以上必要です。',
  'Already published': 'この記事は既に公開されています。',
  'Only published notices can be unpublished': '公開中の記事のみ公開を取り消せます。',
  'Unpublish before physical deletion': '削除する前に公開を取り消してください。',
  'upload_session_id is required for new images': '新しい画像のアップロード情報がありません。',
  'Image not owned by this editing session': '画像のアップロード期限が切れているか、編集セッションが一致しません。',
  'Account not found': 'アカウントが見つかりません。',
  'Account name must contain 1 to 100 characters': 'アカウント名は1～100文字で入力してください。',
  'Invalid Discord ID': 'Discord IDの形式が正しくありません。',
  'Discord identity not linked': 'Discordアカウントが連携されていません。',
  'Edition must be je or be': 'Minecraftの版はJEまたはBEを選択してください。',
  'Invalid Minecraft name': 'Minecraft名が正しくありません。JEは英数字とアンダースコアの3～16文字、BEは1～32文字で入力してください。',
  'Territory name is required': '領地名を入力してください。',
  'Territory name must contain 1 to 100 characters': '領地名は1～100文字で入力してください。',
  'Invalid territory owner': '領地の所有者指定が正しくありません。',
  'At least three territory coordinates are required': '領地には3点以上の座標が必要です。',
  'Invalid territory coordinate': '領地座標の形式が正しくありません。',
  'Territory coordinates must be integers': '領地のX/Z座標は整数で入力してください。',
  'Territory coordinates must not contain duplicate vertices': '同じ頂点を複数回指定できません。',
  'Territory polygon area must be greater than zero': '面積が0になる領地は申請できません。',
  'Territory polygon must not self-intersect': '領地の境界線を自己交差させることはできません。',
  'Territory polygon must not backtrack along an edge': '領地の境界線を同じ辺上で折り返すことはできません。',
  'Invalid territory boundary replacement': '領地の変更範囲が正しくありません。',
  'Territory boundary replacement indexes must be integers': '領地の変更範囲が正しくありません。',
  'Invalid territory boundary replacement range': '領地の変更範囲は連続する2点以上を指定してください。',
  'Territory boundary replacement must keep existing vertices': '既存境界の全頂点を変更対象にはできません。',
  'Territory boundary replacement coordinates must be an array': '変更後の境界座標の形式が正しくありません。',
  'Link a Minecraft ID before applying for territory': '領地申請にはMinecraft IDの登録が必要です。',
  'Change at least one field before reapplying': '再申請するには元の申請から内容を変更してください。',
  'Change the territory before submitting an edit': '変更申請するには現在の領地から内容を変更してください。',
  'Review reason is required': '差戻・却下理由を入力してください。',
  'Territory notifications are not configured': '領地通知機能が設定されていません。運営へ連絡してください。',
  'Discord territory notification failed; territory changes were not saved': 'Discord通知に失敗したため、領地の変更は保存されませんでした。',
  'Minecraft name is already linked': 'そのMinecraft名は既に登録されています。',
  'Minecraft identity not found': 'Minecraftの登録情報が見つかりません。',
  'Discord identity not found': 'Discordの登録情報が見つかりません。',
  'Cannot remove the last Discord identity': '最後のDiscord連携は解除できません。',
  'Cannot detach a protected initial administrator identity': '初期管理者のDiscord連携は解除できません。',
  'Cannot revoke a protected initial administrator': '初期管理者の権限は解除できません。',
  'Cannot remove the final administrator': '最後の管理者権限は解除できません。',
  'Cannot delete the final administrator': '最後の管理者は削除できません。',
  'Cannot delete a protected initial administrator': '初期管理者は削除できません。',
  'Account has merge history and cannot be physically deleted': '統合履歴があるアカウントは削除できません。',
  'Account owns images; merge into another account before deletion': '画像の所有者となっているため、別のアカウントに統合してから削除してください。',
  'Account is referenced by territories; merge into another account before deletion': '領地の申請者または所有者となっているため、別のアカウントに統合してから削除してください。',
  'Separate the account merge before changing this information': 'この情報を変更する前にアカウントを分離してください。',
  'Separate the merge before removing transferred Minecraft identities': '移動したMinecraft名はアカウントを分離してから解除してください。',
  'Separate the merge before unlinking Discord identities': 'Discord連携を解除する前にアカウントを分離してください。',
  'Separate the merge before changing administrator roles': '管理者権限を変更する前にアカウントを分離してください。',
  'is_admin must be boolean': '管理者権限の指定が正しくありません。',
  'Bad Request': '入力内容を確認してください。',
  Unauthorized: 'ログインが必要です。再度ログインしてください。',
  Forbidden: 'この操作を行う権限がありません。',
  'Not Found': '指定されたデータが見つかりません。',
  Conflict: 'データが競合しています。再読み込みしてください。',
  'Internal server error': 'サーバーでエラーが発生しました。',
}

/** Japanese text is returned verbatim; untranslated server internals are never shown to users. */
export function userFacingError(error: unknown): string {
  const issue = error as { data?: { message?: string | string[]; statusCode?: number }; response?: { status?: number }; status?: number; statusCode?: number; message?: string }
  const messages = issue?.data?.message
  const values = Array.isArray(messages) ? messages : messages ? [messages] : []
  if (values.length && values.every(value => translations[value] || /[\u3040-\u30ff\u3400-\u9fff]/u.test(value))) {
    return values.map(value => translations[value] ?? value).join('、')
  }
  const status = issue?.response?.status ?? issue?.status ?? issue?.statusCode ?? issue?.data?.statusCode
  if (status === 400 || status === 422) return '入力内容を確認してください。'
  if (status === 401) return 'ログインが必要です。再度ログインしてください。'
  if (status === 403) return 'この操作を行う権限がありません。'
  if (status === 404) return '指定されたデータが見つかりません。'
  if (status === 409) return 'データが競合しています。再読み込みしてください。'
  if (status === 413) return 'データのサイズが上限を超えています。'
  if (status === 429) return 'アクセスが集中しています。時間をおいて再度お試しください。'
  if (typeof status === 'number' && status >= 500) return 'サーバーでエラーが発生しました。時間をおいて再度お試しください。'
  if (issue?.message && /[\u3040-\u30ff\u3400-\u9fff]/u.test(issue.message)) return issue.message
  return '通信または処理に失敗しました。接続を確認して再度お試しください。'
}
