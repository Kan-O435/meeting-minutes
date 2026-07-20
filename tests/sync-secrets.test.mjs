import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateApiKey } from '../scripts/sync-secrets.mjs';

test('validateApiKey は前後の空白を取り除いた値を返す', () => {
  assert.equal(validateApiKey('  abc123  '), 'abc123');
});

test('validateApiKey は空文字で例外を投げる', () => {
  assert.throws(() => validateApiKey(''), /GEMINI_API_KEY/);
});

test('validateApiKey は未定義で例外を投げる', () => {
  assert.throws(() => validateApiKey(undefined), /GEMINI_API_KEY/);
});

test('validateApiKey は空白のみで例外を投げる', () => {
  assert.throws(() => validateApiKey('   '), /GEMINI_API_KEY/);
});
