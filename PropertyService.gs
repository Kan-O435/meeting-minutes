/**
 * Gemini APIキーの保存・取得・状態確認を担当するサービス。
 * キーの値そのものをUI・ログへ出力しないことを徹底する。
 */
var PropertyService = (function () {
  var PROPERTY_KEY = 'GEMINI_API_KEY';
  var VOICE_PAGE_URL_KEY = 'VOICE_INPUT_PAGE_URL';
  var VOICE_TOKEN_KEY = 'VOICE_INPUT_TOKEN';
  var PROMPT_TEMPLATE_KEY = 'CUSTOM_PROMPT_TEMPLATE';

  function getScriptProperties_() {
    return PropertiesService.getScriptProperties();
  }

  /**
   * コピー用の値をダイアログで表示する（選択してコピーできるよう入力欄に入れる）。
   */
  function showCopyableDialog_(title, value) {
    var escaped = String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    var html = HtmlService.createHtmlOutput(
      '<div style="font-family:Arial,sans-serif;font-size:13px;padding:4px;">' +
        '<input type="text" value="' + escaped + '" readonly ' +
        'style="width:100%;box-sizing:border-box;padding:6px;font-size:12px;" ' +
        'onclick="this.select();"></div>'
    )
      .setWidth(420)
      .setHeight(80);
    SpreadsheetApp.getUi().showModalDialog(html, title);
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

  // --- 音声入力ページ（GitHub Pages等の外部ホスティング）連携用の設定 ---
  // Gemini APIキーと違い、この値は「利用者自身が外部ページの設定欄へ貼り付ける」ために
  // 表示する必要があるため、意図的にコピー用ダイアログで表示する関数を用意している。

  function getVoiceInputPageUrl() {
    return getScriptProperties_().getProperty(VOICE_PAGE_URL_KEY) || '';
  }

  function promptAndSaveVoiceInputPageUrl() {
    var ui = SpreadsheetApp.getUi();
    var response = ui.prompt(
      '音声入力ページのURLを設定',
      'GitHub Pages等に公開した音声入力ページのURLを入力してください（例: https://ユーザー名.github.io/リポジトリ名/）。',
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() !== ui.Button.OK) {
      return;
    }

    var url = (response.getResponseText() || '').trim();
    if (!url) {
      ui.alert('URLが空です。');
      return;
    }

    getScriptProperties_().setProperty(VOICE_PAGE_URL_KEY, url);
    ui.alert('音声入力ページのURLを保存しました。');
  }

  function getOrCreateVoiceInputToken_() {
    var props = getScriptProperties_();
    var token = props.getProperty(VOICE_TOKEN_KEY);
    if (!token) {
      token = Utilities.getUuid();
      props.setProperty(VOICE_TOKEN_KEY, token);
    }
    return token;
  }

  function isValidVoiceInputToken(token) {
    var expected = getScriptProperties_().getProperty(VOICE_TOKEN_KEY);
    return !!expected && !!token && token === expected;
  }

  /**
   * 音声入力トークンをコピー用ダイアログで表示する（未発行なら新規発行する）。
   * 外部の音声入力ページの設定欄へ一度だけ貼り付けて使う。
   */
  function showVoiceInputToken() {
    var token = getOrCreateVoiceInputToken_();
    showCopyableDialog_('音声入力トークン（外部ページの設定欄へ貼り付けてください）', token);
  }

  /**
   * トークンを漏えいが疑われる場合などに再発行する。
   * 再発行すると、外部ページ側に保存済みの古いトークンは無効になるため、
   * 外部ページの設定欄にも新しい値を貼り直す必要がある。
   */
  function reissueVoiceInputToken() {
    var ui = SpreadsheetApp.getUi();
    var response = ui.alert(
      '音声入力トークンの再発行',
      '現在のトークンを無効化し、新しいトークンを発行します。外部の音声入力ページ側の設定も更新が必要になります。よろしいですか？',
      ui.ButtonSet.YES_NO
    );
    if (response !== ui.Button.YES) {
      return;
    }
    var token = Utilities.getUuid();
    getScriptProperties_().setProperty(VOICE_TOKEN_KEY, token);
    showCopyableDialog_('新しい音声入力トークン（外部ページの設定欄へ貼り直してください）', token);
  }

  /**
   * 現在の会議シートを対象とした、音声入力ページを開くためのURLを
   * コピー用ダイアログで表示する。
   */
  function showVoiceInputLink() {
    var ui = SpreadsheetApp.getUi();
    var pageUrl = getVoiceInputPageUrl();
    if (!pageUrl) {
      ui.alert(
        '音声入力ページのURLが未設定です。「音声入力ページのURLを設定」から先に登録してください。'
      );
      return;
    }

    var sheet;
    try {
      sheet = MeetingService.requireActiveMeetingSheet_();
    } catch (err) {
      ui.alert(err.message);
      return;
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var link =
      pageUrl +
      (pageUrl.indexOf('?') === -1 ? '?' : '&') +
      'ss=' + encodeURIComponent(ss.getId()) +
      '&sheet=' + encodeURIComponent(sheet.getName());

    showCopyableDialog_('音声入力ページを開くリンク', link);
  }

  // --- 要約プロンプトのカスタマイズ ---

  function getCustomPromptTemplate() {
    return getScriptProperties_().getProperty(PROMPT_TEMPLATE_KEY) || '';
  }

  function hasCustomPromptTemplate() {
    return getCustomPromptTemplate().length > 0;
  }

  function saveCustomPromptTemplate(text) {
    var value = (text || '').trim();
    if (!value) {
      getScriptProperties_().deleteProperty(PROMPT_TEMPLATE_KEY);
      return { success: true, usingDefault: true };
    }
    getScriptProperties_().setProperty(PROMPT_TEMPLATE_KEY, value);
    return { success: true, usingDefault: false };
  }

  /**
   * カスタムプロンプトを削除し、デフォルトのテンプレート文字列を返す。
   */
  function resetCustomPromptTemplate() {
    getScriptProperties_().deleteProperty(PROMPT_TEMPLATE_KEY);
    return PromptService.getDefaultPromptTemplate();
  }

  /**
   * 「要約プロンプトを編集」メニューから呼び出される。
   * テキストエリア付きのモーダルダイアログを表示し、保存・デフォルトへ戻すを行える。
   */
  function showPromptEditor() {
    var current = getCustomPromptTemplate() || PromptService.getDefaultPromptTemplate();
    var isCustom = hasCustomPromptTemplate();
    var escaped = current
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    var html = HtmlService.createHtmlOutput(
      '<div style="font-family:Arial,sans-serif;font-size:13px;padding:4px;">' +
        '<p style="margin:0 0 8px;color:#5f6368;line-height:1.5;">' +
        '文字起こしを差し込みたい位置に <code>{{TRANSCRIPT}}</code> を1か所入れてください' +
        '（入れ忘れても末尾に自動で追加されます）。<br>' +
        '出力が <code>summary</code>・<code>nextActions</code>・<code>followUp</code>・' +
        '<code>engagement</code> を含むJSON形式になるよう指示を残してください。' +
        'この形式を崩すと、議事録生成が失敗するようになります。' +
        '</p>' +
        '<textarea id="promptText" style="width:100%;box-sizing:border-box;height:320px;' +
        'font-size:12px;padding:6px;font-family:monospace;">' + escaped + '</textarea>' +
        '<div style="margin-top:8px;">' +
        '<button onclick="save()" style="margin-right:8px;padding:6px 14px;">保存</button>' +
        '<button onclick="resetDefault()" style="padding:6px 14px;">デフォルトに戻す</button>' +
        '<span id="msg" style="margin-left:10px;"></span>' +
        '</div>' +
        '<script>' +
        'function setMsg(text, isError) {' +
        '  var el = document.getElementById("msg");' +
        '  el.textContent = text;' +
        '  el.style.color = isError ? "#d93025" : "#188038";' +
        '}' +
        'function save() {' +
        '  var text = document.getElementById("promptText").value;' +
        '  google.script.run' +
        '    .withSuccessHandler(function () { setMsg("保存しました。", false); })' +
        '    .withFailureHandler(function (err) {' +
        '      setMsg("保存に失敗しました：" + (err && err.message ? err.message : err), true);' +
        '    })' +
        '    .promptEditor_save(text);' +
        '}' +
        'function resetDefault() {' +
        '  google.script.run' +
        '    .withSuccessHandler(function (defaultText) {' +
        '      document.getElementById("promptText").value = defaultText;' +
        '      setMsg("デフォルトに戻しました。", false);' +
        '    })' +
        '    .withFailureHandler(function (err) {' +
        '      setMsg("リセットに失敗しました：" + (err && err.message ? err.message : err), true);' +
        '    })' +
        '    .promptEditor_reset();' +
        '}' +
        '</script>' +
        '</div>'
    )
      .setWidth(540)
      .setHeight(460);

    SpreadsheetApp.getUi().showModalDialog(
      html,
      '要約プロンプトを編集' + (isCustom ? '（カスタム設定中）' : '（デフォルト）')
    );
  }

  return {
    getApiKey: getApiKey,
    hasApiKey: hasApiKey,
    requireApiKey: requireApiKey,
    promptAndSaveApiKey: promptAndSaveApiKey,
    showApiKeyStatus: showApiKeyStatus,
    setApiKeyFromSecretSync: setApiKeyFromSecretSync,
    getVoiceInputPageUrl: getVoiceInputPageUrl,
    promptAndSaveVoiceInputPageUrl: promptAndSaveVoiceInputPageUrl,
    isValidVoiceInputToken: isValidVoiceInputToken,
    showVoiceInputToken: showVoiceInputToken,
    reissueVoiceInputToken: reissueVoiceInputToken,
    showVoiceInputLink: showVoiceInputLink,
    getCustomPromptTemplate: getCustomPromptTemplate,
    hasCustomPromptTemplate: hasCustomPromptTemplate,
    saveCustomPromptTemplate: saveCustomPromptTemplate,
    resetCustomPromptTemplate: resetCustomPromptTemplate,
    showPromptEditor: showPromptEditor,
  };
})();
