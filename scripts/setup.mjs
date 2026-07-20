#!/usr/bin/env node
/**
 * 初期セットアップの取りまとめスクリプト。
 * 1. .envからGemini APIキーをApps Scriptへ同期する（失敗しても継続する）
 * 2. Apps Scriptへコードをpushする（失敗しても継続する）
 * 最後に、実行結果と残っている手動作業を日本語でまとめて表示する。
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncSecrets } from './sync-secrets.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: projectRoot, stdio: 'inherit' });
    child.on('close', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

async function main() {
  console.log('=== セットアップを開始します ===');

  console.log('\n[1/2] Gemini APIキーの同期');
  let secretsSynced = false;
  try {
    const result = await syncSecrets();
    secretsSynced = result.success;
    if (secretsSynced) {
      console.log('→ 成功しました。');
    } else {
      console.log('→ 自動同期に失敗しました（詳細は npm run sync:secrets を個別実行して確認してください）。');
    }
  } catch (err) {
    console.log('→ 同期をスキップしました: ' + err.message);
  }

  console.log('\n[2/2] Apps Scriptへのpush（clasp push）');
  const pushed = await runCommand('npx', ['clasp', 'push']);
  console.log(pushed ? '→ 成功しました。' : '→ 失敗しました。');

  console.log('\n=== セットアップ結果 ===');
  console.log('Gemini APIキー自動同期: ' + (secretsSynced ? '成功' : '未完了'));
  console.log('clasp push: ' + (pushed ? '成功' : '未完了'));

  if (!secretsSynced) {
    console.log(
      '\n未完了: Gemini APIキーはスプレッドシートの「AI議事録」→「APIキーを設定」から手動登録してください。'
    );
  }
  if (!pushed) {
    console.log(
      '未完了: 「npx clasp login」でログイン後、Apps Script APIを有効化してから「npx clasp push」を再実行してください。'
    );
  }
}

main();
