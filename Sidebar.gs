/**
 * 音声入力サイドバー（Sidebar.html）の表示を担当する。
 * 実際の音声認識処理はブラウザ側のWeb Speech APIで行い、
 * ここではサイドバーの表示とHTMLテンプレートの部品読み込みのみを担当する。
 */
var Sidebar = (function () {
  function show() {
    var template = HtmlService.createTemplateFromFile('Sidebar');
    var html = template
      .evaluate()
      .setTitle('AI議事録 音声入力')
      .setWidth(340);
    SpreadsheetApp.getUi().showSidebar(html);
  }

  return {
    show: show,
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
