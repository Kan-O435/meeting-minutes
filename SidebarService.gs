/**
 * 音声入力サイドバー（Sidebar.html）の表示を担当する。
 * 実際の音声認識処理はブラウザ側のWeb Speech APIで行い、
 * ここではサイドバーの表示とHTMLテンプレートの部品読み込みのみを担当する。
 */
var Sidebar = (function () {
  function show() {
    var template = HtmlService.createTemplateFromFile('Sidebar');
    template.standalone = false;
    template.spreadsheetId = '';
    template.sheetName = '';

    var html = template
      .evaluate()
      .setTitle('AI議事録 音声入力')
      .setWidth(340);
    SpreadsheetApp.getUi().showSidebar(html);
  }

  /**
   * doGet(e)から呼び出される。サイドバー用と同じHTMLを、
   * 別タブで開くトップレベルページとして描画する。
   * トップレベルページとして開くことで、ブラウザのマイク許可がiframeの制約を受けずに機能する。
   */
  function renderStandalonePage(spreadsheetId, sheetName) {
    var template = HtmlService.createTemplateFromFile('Sidebar');
    template.standalone = true;
    template.spreadsheetId = spreadsheetId || '';
    template.sheetName = sheetName || '';

    return template
      .evaluate()
      .setTitle('AI議事録 音声入力')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  return {
    show: show,
    renderStandalonePage: renderStandalonePage,
  };
})();

/**
 * HtmlServiceのテンプレート（Sidebar.html）はグローバル関数のみを参照できるため、
 * IIFEの外にトップレベル関数として定義する。
 * Sidebar.html内の <?!= include('Styles'); ?> から呼び出される。
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
