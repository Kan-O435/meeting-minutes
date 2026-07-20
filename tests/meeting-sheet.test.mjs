import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGasModule } from './load-gs.mjs';

const { buildMeetingSheetBaseName, resolveUniqueSheetName, formatMeetingTimestamp } =
  loadGasModule('MeetingService.gs');

test('formatMeetingTimestamp は1桁の値を0埋めする', () => {
  const d = new Date(2026, 6, 21, 9, 5, 3);
  assert.equal(formatMeetingTimestamp(d), '20260721_090503');
});

test('buildMeetingSheetBaseName は接頭辞付きの名前を生成する', () => {
  const d = new Date(2026, 6, 21, 10, 30, 0);
  assert.equal(buildMeetingSheetBaseName(d), '会議_20260721_103000');
});

test('resolveUniqueSheetName は重複がなければそのまま返す', () => {
  assert.equal(resolveUniqueSheetName('会議_20260721_103000', ['シート1']), '会議_20260721_103000');
});

test('resolveUniqueSheetName は重複時に連番を付与する', () => {
  const existing = ['会議_20260721_103000'];
  assert.equal(resolveUniqueSheetName('会議_20260721_103000', existing), '会議_20260721_103000_2');
});

test('resolveUniqueSheetName は空いている連番まで繰り上げる', () => {
  const existing = ['会議_20260721_103000', '会議_20260721_103000_2', '会議_20260721_103000_3'];
  assert.equal(resolveUniqueSheetName('会議_20260721_103000', existing), '会議_20260721_103000_4');
});
