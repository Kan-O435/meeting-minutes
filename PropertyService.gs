/**
 * Gemini APIキーの保存・取得・状態確認を担当するサービス。
 * キーの値そのものをUI・ログへ出力しないことを徹底する。
 */
var PropertyService = (function () {
  var PROPERTY_KEY = 'GEMINI_API_KEY';

  function getScriptProperties_() {
    return PropertiesService.getScriptProperties();
  }

  function getApiKey() {
    return getScriptProperties_().getProperty(PROPERTY_KEY) || '';
  }

  function hasApiKey() {
    return getApiKey().length > 0;
  }

  function requireApiKey() {
    var key = getApiKey();
    if (!key) {
      throw new Error(
        'Gemini APIキーが設定されていません。「AI議事録」メニューの「APIキーを設定」から登録してください。'
      );
    }
    return key;
  }

  function saveApiKey_(rawKey) {
    var key = (rawKey || '').trim();
    if (!key) {
      throw new Error('APIキーが空です。');
    }
    getScriptProperties_().setProperty(PROPERTY_KEY, key);
    return true;
  }

  /**
   * スプレッドシート上の「APIキーを設定」メニューから呼び出される。
   * 入力値はダイアログにのみ表示され、保存後は破棄する。
   */
  function promptAndSaveApiKey() {
    var ui = SpreadsheetApp.getUi();
    var response = ui.prompt(
      'Gemini APIキーの設定',
      'Gemini APIキーを入力してください（入力内容はこの画面以外には表示されません）。',
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() !== ui.Button.OK) {
      return;
    }

    try {
      saveApiKey_(response.getResponseText());
      ui.alert('Gemini APIキーを保存しました。');
    } catch (err) {
      console.error('APIキーの保存に失敗しました: ' + err.message);
      ui.alert('APIキーの保存に失敗しました。' + err.message);
    }
  }

  /**
   * 「APIキー設定状況を確認」メニューから呼び出される。
   * キーの値は一切表示せず、設定済みかどうかのみを表示する。
   */
  function showApiKeyStatus() {
    var ui = SpreadsheetApp.getUi();
    var status = hasApiKey() ? '設定済み' : '未設定';
    ui.alert('Gemini APIキー：' + status);
  }

  /**
   * npm run sync:secrets（clasp run）経由で呼び出される、
   * .envからの秘密情報同期用エントリーポイント。
   * 呼び出し元以外（UI等）から直接使用しないこと。
   */
  function setApiKeyFromSecretSync(apiKey) {
    saveApiKey_(apiKey);
    return { success: true };
  }

  return {
    getApiKey: getApiKey,
    hasApiKey: hasApiKey,
    requireApiKey: requireApiKey,
    promptAndSaveApiKey: promptAndSaveApiKey,
    showApiKeyStatus: showApiKeyStatus,
    setApiKeyFromSecretSync: setApiKeyFromSecretSync,
  };
})();
