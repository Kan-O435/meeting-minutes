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
  try {
    Sidebar.show();
  } catch (err) {
    console.error('サイドバー表示に失敗しました: ' + err);
  }
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
 * spreadsheetId/sheetNameは、音声入力ページを別タブ（Webアプリ）で開いた場合にのみ渡される。
 * サイドバー埋め込み時は未指定となり、現在アクティブなスプレッドシート/シートを対象とする。
 */
function sidebar_appendTranscript(text, spreadsheetId, sheetName) {
  return MeetingService.appendTranscript(text, spreadsheetId, sheetName);
}

/**
 * サイドバー表示中に、現在アクティブなシートが会議シートかどうかを確認するために使用する。
 */
function sidebar_getActiveMeetingSheetName(spreadsheetId, sheetName) {
  return MeetingService.getActiveMeetingSheetNameForSidebar(spreadsheetId, sheetName);
}

/**
 * サイドバー内のマイクがiframeの制約で使えない場合に、
 * 同じ音声入力画面を別タブ（Webアプリ）で開くためのURLを取得する。
 * 別タブはトップレベルページとして開かれるため、ブラウザのマイク許可が正常に機能する。
 */
function sidebar_getVoiceInputWebAppUrl() {
  return MeetingService.getVoiceInputWebAppUrl();
}

/**
 * 音声入力ページを別タブ（Webアプリ）として開いたときのエントリーポイント。
 * ?ss=<スプレッドシートID>&sheet=<シート名> をクエリパラメータとして受け取る。
 */
function doGet(e) {
  var params = (e && e.parameter) || {};
  return Sidebar.renderStandalonePage(params.ss, params.sheet);
}

/**
 * npm run sync:secrets (clasp run) からGemini APIキーを登録するためのエントリーポイント。
 * ローカルの秘密情報同期スクリプト以外から呼び出さないこと。
 */
function remoteSetGeminiApiKey(apiKey) {
  return PropertyService.setApiKeyFromSecretSync(apiKey);
}
