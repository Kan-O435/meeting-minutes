import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGasModule } from './load-gs.mjs';

const { stripMarkdownCodeFence, parseMinutesJson, formatNextActionsText } =
  loadGasModule('LlmService.gs');

test('stripMarkdownCodeFence はコードブロックなしの文字列をそのまま返す', () => {
  const raw = '{"summary":"要約"}';
  assert.equal(stripMarkdownCodeFence(raw), raw);
});

test('stripMarkdownCodeFence は```json付きのコードブロックを取り除く', () => {
  const raw = '```json\n{"summary":"要約"}\n```';
  assert.equal(stripMarkdownCodeFence(raw), '{"summary":"要約"}');
});

test('stripMarkdownCodeFence は言語指定なしのコードブロックも取り除く', () => {
  const raw = '```\n{"summary":"要約"}\n```';
  assert.equal(stripMarkdownCodeFence(raw), '{"summary":"要約"}');
});

test('parseMinutesJson は担当者・期限未記載の項目を「未定」として扱う', () => {
  const raw = JSON.stringify({
    summary: '会議の要約です。',
    nextActions: [{ task: '資料を作成する' }],
  });
  const result = parseMinutesJson(raw);
  assert.equal(result.summary, '会議の要約です。');
  assert.deepEqual(result.nextActions, [
    { task: '資料を作成する', owner: '未定', dueDate: '未定', note: '' },
  ]);
});

test('parseMinutesJson はMarkdownコードブロック付きレスポンスも解析できる', () => {
  const raw =
    '```json\n' +
    JSON.stringify({ summary: '要約', nextActions: [] }) +
    '\n```';
  const result = parseMinutesJson(raw);
  assert.equal(result.summary, '要約');
  assert.deepEqual(result.nextActions, []);
});

test('parseMinutesJson はtaskが空の項目を除外する', () => {
  const raw = JSON.stringify({
    summary: '要約',
    nextActions: [{ task: '' }, { task: 'タスクA', owner: '山田' }],
  });
  const result = parseMinutesJson(raw);
  assert.equal(result.nextActions.length, 1);
  assert.equal(result.nextActions[0].task, 'タスクA');
});

test('parseMinutesJson は不正なJSONで例外を投げる', () => {
  assert.throws(() => parseMinutesJson('これはJSONではありません'));
});

test('parseMinutesJson はsummaryが無い場合に例外を投げる', () => {
  assert.throws(() => parseMinutesJson(JSON.stringify({ nextActions: [] })));
});

test('formatNextActionsText はネクストアクションが無い場合の文言を返す', () => {
  assert.equal(formatNextActionsText([]), 'ネクストアクションはありません。');
});

test('formatNextActionsText は番号付きで担当者・期限・補足を整形する', () => {
  const text = formatNextActionsText([
    { task: '提案資料を作成する', owner: '山田', dueDate: '2026年7月25日', note: '初稿を共有する' },
    { task: '動作確認を行う', owner: '未定', dueDate: '未定', note: '' },
  ]);
  assert.equal(
    text,
    [
      '1. タスク：提案資料を作成する',
      '   担当者：山田',
      '   期限：2026年7月25日',
      '   補足：初稿を共有する',
      '',
      '2. タスク：動作確認を行う',
      '   担当者：未定',
      '   期限：未定',
    ].join('\n')
  );
});
