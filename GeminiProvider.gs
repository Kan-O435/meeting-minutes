/**
 * Gemini API（Generative Language API）との通信を担当するProvider。
 * モデル名はこのファイル内の1箇所にのみ定義する。
 */
var GeminiProvider = (function () {
  var MODEL_NAME = 'gemini-2.5-flash';
  var API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';

  function buildEndpoint_(apiKey) {
    return API_BASE_URL + MODEL_NAME + ':generateContent?key=' + encodeURIComponent(apiKey);
  }

  function extractText_(body) {
    var data;
    try {
      data = JSON.parse(body);
    } catch (err) {
      console.error('Gemini APIレスポンスの解析に失敗しました: ' + err);
      throw new Error('Gemini APIレスポンスの解析に失敗しました。');
    }

    var candidate = data.candidates && data.candidates[0];
    var parts = candidate && candidate.content && candidate.content.parts;
    var text = parts && parts[0] && parts[0].text;

    if (!text) {
      var blockReason = data.promptFeedback && data.promptFeedback.blockReason;
      if (blockReason) {
        console.error('Gemini APIがコンテンツをブロックしました: ' + blockReason);
        throw new Error('Gemini APIが内容の生成をブロックしました（理由: ' + blockReason + '）。');
      }
      console.error('Gemini APIレスポンスにテキストが含まれていません: ' + body);
      throw new Error('Gemini APIから有効な応答が得られませんでした。');
    }

    return text;
  }

  function handleResponse_(response) {
    var status = response.getResponseCode();
    var body = response.getContentText();

    if (status === 200) {
      return extractText_(body);
    }

    if (status === 400) {
      console.error('Gemini APIエラー(400): ' + body);
      throw new Error('Gemini APIへのリクエスト内容が不正です。文字起こしの内容を確認してください。');
    }
    if (status === 401 || status === 403) {
      console.error('Gemini APIエラー(' + status + '): ' + body);
      throw new Error(
        'Gemini APIキーが無効、または権限がありません。「APIキーを設定」から正しいキーを再登録してください。'
      );
    }
    if (status === 404) {
      console.error('Gemini APIエラー(404): ' + body);
      throw new Error('指定されたGeminiモデルが見つかりません（モデル名: ' + MODEL_NAME + '）。');
    }
    if (status === 429) {
      console.error('Gemini APIエラー(429): ' + body);
      throw new Error('Gemini APIのレート制限に達しました。しばらく待ってから再実行してください。');
    }
    if (status >= 500) {
      console.error('Gemini APIエラー(' + status + '): ' + body);
      throw new Error('Gemini APIが一時的に利用できません。しばらく待ってから再実行してください。');
    }

    console.error('Gemini APIエラー(' + status + '): ' + body);
    throw new Error('Gemini APIとの通信でエラーが発生しました（ステータス: ' + status + '）。');
  }

  /**
   * プロンプトを送信し、Geminiが生成したテキスト（JSON文字列を想定）を返す。
   * APIキー未設定・通信失敗・タイムアウト・レート制限等はここで日本語メッセージへ変換する。
   */
  function generateContent(prompt) {
    var apiKey = PropertyService.requireApiKey();

    var payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    };

    var response;
    try {
      response = UrlFetchApp.fetch(buildEndpoint_(apiKey), {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });
    } catch (err) {
      console.error('Gemini APIへの通信に失敗しました: ' + err);
      throw new Error(
        'Gemini APIへの通信に失敗しました（タイムアウトまたはネットワークエラー）。しばらくしてから再実行してください。'
      );
    }

    return handleResponse_(response);
  }

  return {
    MODEL_NAME: MODEL_NAME,
    generateContent: generateContent,
  };
})();
