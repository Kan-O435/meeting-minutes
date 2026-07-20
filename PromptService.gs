/**
 * Gemini（および将来の他LLM）へ渡す、要約・ネクストアクション抽出用プロンプトの生成を担当する。
 */
var PromptService = (function () {
  function buildMinutesPrompt(transcript) {
    return [
      'あなたは優秀な会議アシスタントです。',
      '以下の会議の文字起こしを読み、「要約」と「ネクストアクション」を日本語でまとめ、',
      '必ず次のJSON形式のみを出力してください。説明文やMarkdownのコードブロック記法は付けないこと。',
      '',
      '# 制約',
      '- summaryには、主要な議題・話し合われた内容・決定事項・未決事項を簡潔にまとめること。',
      '- nextActionsには、会話の中で明確に読み取れるタスクのみを含めること。',
      '- 担当者(owner)や期限(dueDate)が会話の中に明示されていない場合は、絶対に推測や補完をせず"未定"と記載すること。',
      '- 該当するネクストアクションが存在しない場合は、nextActionsを空配列 [] とすること。',
      '',
      '# 出力JSON形式',
      '{',
      '  "summary": "会議の要約",',
      '  "nextActions": [',
      '    {',
      '      "task": "実行する作業",',
      '      "owner": "担当者または未定",',
      '      "dueDate": "期限または未定",',
      '      "note": "補足"',
      '    }',
      '  ]',
      '}',
      '',
      '# 会議の文字起こし',
      '"""',
      transcript,
      '"""',
    ].join('\n');
  }

  return {
    buildMinutesPrompt: buildMinutesPrompt,
  };
})();
