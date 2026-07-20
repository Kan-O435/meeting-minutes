/**
 * LLM Provider（現在はGeminiのみ）の選択・呼び出し・レスポンス解析を担当する。
 * Provider固有のHTTP通信は各Provider（例: GeminiProvider）へ委譲する。
 */
var LlmService = (function () {
  var CODE_FENCE_PATTERN = /^```[a-zA-Z]*\s*\n?([\s\S]*?)\n?```$/;

  /**
   * LLMレスポンスがMarkdownのコードブロック（```json ... ```）で
   * 囲まれていた場合に取り除く。囲まれていなければそのまま返す。
   */
  function stripMarkdownCodeFence(text) {
    var trimmed = (text || '').trim();
    var match = trimmed.match(CODE_FENCE_PATTERN);
    return match ? match[1].trim() : trimmed;
  }

  function normalizeMinutesResponse_(data) {
    if (!data || typeof data.summary !== 'string') {
      throw new Error('JSON_SHAPE_ERROR');
    }

    var rawNextActions = Array.isArray(data.nextActions) ? data.nextActions : [];
    var nextActions = rawNextActions
      .map(function (item) {
        return {
          task: item && item.task ? String(item.task).trim() : '',
          owner: item && item.owner ? String(item.owner).trim() : '未定',
          dueDate: item && item.dueDate ? String(item.dueDate).trim() : '未定',
          note: item && item.note ? String(item.note).trim() : '',
        };
      })
      .filter(function (item) {
        return item.task.length > 0;
      });

    return { summary: data.summary.trim(), nextActions: nextActions };
  }

  /**
   * LLMからの生テキスト（Markdownコードブロックを含む可能性がある）を
   * パースし、summary/nextActionsの形へ正規化する。
   */
  function parseMinutesJson(rawText) {
    var jsonText = stripMarkdownCodeFence(rawText);
    var data;
    try {
      data = JSON.parse(jsonText);
    } catch (err) {
      throw new Error('JSON_PARSE_ERROR');
    }
    return normalizeMinutesResponse_(data);
  }

  /**
   * ネクストアクション配列を、シートへ書き込むための表示用テキストへ整形する。
   */
  function formatNextActionsText(nextActions) {
    if (!nextActions || nextActions.length === 0) {
      return 'ネクストアクションはありません。';
    }

    return nextActions
      .map(function (item, index) {
        var lines = [
          (index + 1) + '. タスク：' + item.task,
          '   担当者：' + item.owner,
          '   期限：' + item.dueDate,
        ];
        if (item.note) {
          lines.push('   補足：' + item.note);
        }
        return lines.join('\n');
      })
      .join('\n\n');
  }

  /**
   * 文字起こしを受け取り、要約とネクストアクション（表示用テキスト）を生成する。
   * Provider選択は現状Gemini固定。将来的にはPropertiesServiceの設定値等で切り替える。
   */
  function generateMinutes(transcript) {
    var prompt = PromptService.buildMinutesPrompt(transcript);
    var rawText = GeminiProvider.generateContent(prompt);

    var parsed;
    try {
      parsed = parseMinutesJson(rawText);
    } catch (err) {
      console.error('LLMレスポンスのJSON解析に失敗しました: ' + err + ' / raw=' + rawText);
      throw new Error('AIの応答を解析できませんでした。もう一度お試しください。');
    }

    return {
      summary: parsed.summary,
      nextActionsText: formatNextActionsText(parsed.nextActions),
    };
  }

  return {
    generateMinutes: generateMinutes,
    stripMarkdownCodeFence: stripMarkdownCodeFence,
    parseMinutesJson: parseMinutesJson,
    formatNextActionsText: formatNextActionsText,
  };
})();

// Node環境（テスト実行時）向けに、純粋関数のみをエクスポートする。
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    stripMarkdownCodeFence: LlmService.stripMarkdownCodeFence,
    parseMinutesJson: LlmService.parseMinutesJson,
    formatNextActionsText: LlmService.formatNextActionsText,
  };
}
