#!/usr/bin/env node
/**
 * .env内のGEMINI_API_KEYを読み込み、Apps Script側のPropertiesServiceへ
 * 安全に同期する（clasp run経由でremoteSetGeminiApiKeyを呼び出す）。
 *
 * APIキーの値は、コンソール出力・シェル履歴・ログのいずれにも残さない。
 * clasp runへの引数はNode.js内でプロセス引数として直接渡し、シェル文字列展開を経由しない。
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const envPath = path.join(projectRoot, '.env');

/**
 * APIキーの値そのものを検証する純粋関数（テスト対象）。
 * 前後の空白を取り除いた上で、空文字なら例外を投げる。
 */
export function validateApiKey(rawValue) {
  const value = (rawValue || '').trim();
  if (!value) {
    throw new Error('GEMINI_API_KEYが空です。Gemini APIキーを入力してください。');
  }
  return value;
}

function readGeminiApiKey() {
  if (!existsSync(envPath)) {
    throw new Error(
      '.envファイルが見つかりません。「cp .env.example .env」を実行し、Gemini APIキーを入力してください。'
    );
  }

  process.loadEnvFile(envPath);
  return validateApiKey(process.env.GEMINI_API_KEY);
}

function runClaspSetApiKey(apiKey) {
  return new Promise((resolve) => {
    const child = spawn(
      'npx',
      ['clasp', 'run', 'remoteSetGeminiApiKey', '-p', JSON.stringify([apiKey])],
      {
        cwd: projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      resolve({ success: code === 0, stderr: stderr.trim() });
    });

    child.on('error', (err) => {
      resolve({ success: false, stderr: err.message });
    });
  });
}

/**
 * .envの読み込みからApps Scriptへの同期までを行う。
 * 呼び出し元（npm run sync:secrets / npm run setup）から利用する。
 */
export async function syncSecrets() {
  const apiKey = readGeminiApiKey();
  return runClaspSetApiKey(apiKey);
}

async function main() {
  console.log('Gemini APIキーの同期を開始します…');

  let result;
  try {
    result = await syncSecrets();
  } catch (err) {
    console.error('同期を中止しました: ' + err.message);
    process.exitCode = 1;
    return;
  }

  if (result.success) {
    console.log('Gemini APIキーをApps Script（PropertiesService）へ同期しました。');
  } else {
    console.error('自動同期に失敗しました。考えられる原因:');
    console.error('  ・clasp loginが未実行、または認証が失効している');
    console.error('  ・Apps Script APIが有効化されていない（https://script.google.com/home/usersettings）');
    console.error('  ・スクリプトの権限が未承認（Apps Scriptエディタで一度手動実行して承認が必要）');
    if (result.stderr) {
      console.error('詳細: ' + result.stderr);
    }
    console.error(
      '代わりに、スプレッドシートの「AI議事録」→「APIキーを設定」から手動で登録してください。'
    );
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
