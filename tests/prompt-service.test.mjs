import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGasModule } from './load-gs.mjs';

const { getDefaultPromptTemplate, applyTranscript } = loadGasModule('PromptService.gs');

test('getDefaultPromptTemplate はプレースホルダーと必須JSONキーを含む', () => {
  const template = getDefaultPromptTemplate();
  assert.match(template, /\{\{TRANSCRIPT\}\}/);
  assert.match(template, /"summary"/);
  assert.match(template, /"nextActions"/);
  assert.match(template, /"followUp"/);
  assert.match(template, /"engagement"/);
});

test('applyTranscript はプレースホルダーを文字起こしへ置き換える', () => {
  const result = applyTranscript('前置き\n{{TRANSCRIPT}}\n後書き', 'こんにちは');
  assert.equal(result, '前置き\nこんにちは\n後書き');
});

test('applyTranscript はプレースホルダーが複数あればすべて置き換える', () => {
  const result = applyTranscript('{{TRANSCRIPT}}と{{TRANSCRIPT}}', 'X');
  assert.equal(result, 'XとX');
});

test('applyTranscript はプレースホルダーが無い場合末尾へ文字起こしを追加する', () => {
  const result = applyTranscript('カスタムプロンプト本文', 'こんにちは');
  assert.match(result, /^カスタムプロンプト本文/);
  assert.match(result, /こんにちは/);
});
