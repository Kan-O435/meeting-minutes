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

/**
 * サイドバー(Sidebar.html)からB5へ文字起こしを反映するために呼び出される。
 */
function sidebar_appendTranscript(text) {
  return MeetingService.appendTranscript(text);
}

/**
 * サイドバー表示中に、現在アクティブなシートが会議シートかどうかを確認するために使用する。
 */
function sidebar_getActiveMeetingSheetName() {
  return MeetingService.getActiveMeetingSheetNameForSidebar();
}

/**
 * npm run sync:secrets (clasp run) からGemini APIキーを登録するためのエントリーポイント。
 * ローカルの秘密情報同期スクリプト以外から呼び出さないこと。
 */
function remoteSetGeminiApiKey(apiKey) {
  return PropertyService.setApiKeyFromSecretSync(apiKey);
}
