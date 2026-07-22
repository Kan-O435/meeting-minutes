/**
 * AI議事録プロトタイプ エントリーポイント。
 * スプレッドシートのメニュー定義と、各機能サービスへの橋渡しのみを担当する。
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('AI議事録')
    .addItem('会議を開始', 'menu_startMeeting')
    .addItem('議事録を生成', 'menu_generateMinutes')
    .addItem('会議を終了', 'menu_endMeeting')
    .addSeparator()
    .addItem('APIキーを設定', 'menu_setApiKey')
    .addItem('APIキー設定状況を確認', 'menu_checkApiKeyStatus')
    .addSeparator()
    .addItem('現在の会議シートをクリア', 'menu_clearMeetingSheet')
    .addSeparator()
    .addItem('音声入力ページのURLを設定', 'menu_setVoiceInputPageUrl')
    .addItem('音声入力トークンを表示', 'menu_showVoiceInputToken')
    .addItem('音声入力トークンを再発行', 'menu_reissueVoiceInputToken')
    .addItem('音声入力ページを開くリンクを表示', 'menu_showVoiceInputLink')
    .addToUi();
}

function menu_startMeeting() {
  MeetingService.startMeeting();
}

function menu_generateMinutes() {
  MeetingService.generateMinutes();
}

function menu_endMeeting() {
  MeetingService.endMeeting();
}

function menu_clearMeetingSheet() {
  MeetingService.clearMeetingSheet();
}

function menu_setApiKey() {
  PropertyService.promptAndSaveApiKey();
}

function menu_checkApiKeyStatus() {
  PropertyService.showApiKeyStatus();
}

function menu_setVoiceInputPageUrl() {
  PropertyService.promptAndSaveVoiceInputPageUrl();
}

function menu_showVoiceInputToken() {
  PropertyService.showVoiceInputToken();
}

function menu_reissueVoiceInputToken() {
  PropertyService.reissueVoiceInputToken();
}

function menu_showVoiceInputLink() {
  PropertyService.showVoiceInputLink();
}

/**
 * npm run sync:secrets (clasp run) からGemini APIキーを登録するためのエントリーポイント。
 * ローカルの秘密情報同期スクリプト以外から呼び出さないこと。
 */
function remoteSetGeminiApiKey(apiKey) {
  return PropertyService.setApiKeyFromSecretSync(apiKey);
}

/**
 * 外部の音声入力ページ（GitHub Pages等）から、Web App API経由で
 * 文字起こしをB5へ追記するためのエントリーポイント。
 * リクエストボディはtext/plainとして送信されたJSON文字列を想定する
 * （Content-Type: application/jsonにするとCORSのpreflightが必要になり、
 * Apps ScriptのWebアプリはpreflight(OPTIONS)を処理できないため）。
 */
function doPost(e) {
  var result;
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!PropertyService.isValidVoiceInputToken(body.token)) {
      result = { ok: false, error: 'トークンが正しくありません。' };
    } else {
      MeetingService.appendTranscriptRemote(body.ss, body.sheet, body.text);
      result = { ok: true };
    }
  } catch (err) {
    console.error('音声入力Web APIでエラーが発生しました: ' + err);
    result = { ok: false, error: String((err && err.message) || err) };
  }

  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
    ContentService.MimeType.JSON
  );
}
