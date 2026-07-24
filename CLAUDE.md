# CLAUDE.md

このファイルは、今後Claude Codeがこのリポジトリを編集する際のルールをまとめたものです。

## プロジェクト概要

Googleスプレッドシート上で動作する、AI会議議事録作成プロトタイプ（Google Apps Script + Gemini API）。

- 会議開始時に、開いているスプレッドシート内の一番左へ会議ごとの新しいシート（`会議_YYYYMMDD_HHmmss`）を作成する。
- B5へ入力された文字起こしをGemini APIへ送信し、B7へ要約、B9へネクストアクション、B13へ追客タイミング、B15へ先方の熱量・反応評価（営業商談の分析用途）を生成・保存する。担当者・期限・追客タイミング・熱量評価はいずれも、文字起こしから根拠が読み取れない場合は「未定」/「不明」とし、推測で埋めない。
- Google Apps Script・Gemini APIに加え、音声入力のみApps Script外のオリジン（`docs/index.html`、通常は`npm run voice-input`でlocalhost配信。外部公開したい場合はGitHub Pages等でも可）を利用する。Chrome拡張機能や独自サーバー（DB・常駐バックエンド等）は使用しない。
- 音声入力（Web Speech API）は、Google Apps Scriptが直接配信するページ（サイドバー・Webアプリの`doGet`いずれも）ではマイクへのアクセスがGoogle側の設定で許可されないことを実機検証済み。そのため、音声認識自体はApps Scriptとは別オリジンの`docs/index.html`で行い、認識結果をApps ScriptのWebアプリ（`doPost`、トークン認証付き）へ送信してB5へ書き込む構成にしている。`localhost`はブラウザが安全な文脈として扱うため、外部ホスティングは必須ではない。この制約により「サイドバー内で直接音声入力」は実現できないため、再実装を試みないこと。

## ファイル構成

```text
Code.gs                    エントリーポイント（onOpen、メニュー、doPost API、秘密情報同期の受け口）
MeetingService.gs          会議シートの作成・レイアウト・開始/生成/終了/クリア/リモート追記
LlmService.gs              LLM Providerの呼び出し制御・レスポンス解析・整形（Provider非依存部分）
GeminiProvider.gs          Gemini APIとの通信・モデル設定・HTTPステータス処理
PromptService.gs           要約・ネクストアクション抽出用プロンプトの生成
PropertyService.gs         Gemini APIキー・音声入力ページURL・音声入力トークンの保存/取得/確認（PropertiesService）
appsscript.json            Apps Scriptマニフェスト（webapp設定を含む）
docs/index.html            音声入力ページ本体（Apps Scriptとは別オリジン。Web Speech API + fetchでdoPostへ送信）
scripts/serve-voice-input.mjs  docs/index.htmlをlocalhostで配信する開発用サーバー（npm run voice-input、無依存）
scripts/sync-secrets.mjs   .env → Apps Scriptへの秘密情報同期
scripts/setup.mjs          セットアップ一括実行（秘密情報同期 + clasp push）
tests/                     node --test によるユニットテスト（純粋関数のみを対象）
```

新しいLLM Providerを追加する場合は、`GeminiProvider.gs`と同じインターフェース（`generateContent(prompt)`）を持つ新しいファイル（例: `OpenAIProvider.gs`）を追加し、`LlmService.gs`のProvider選択部分を拡張すること。モデル名は各Providerファイル内の1箇所にのみ定義し、複数箇所へ重複記載しない。

## Gitブランチ規則

機能単位でブランチを作成し、`main`へマージする。

1. `feature/apps-script-base`
2. `feature/create-meeting-sheet`
3. `feature/transcript-input`
4. `feature/gemini-secret-setup`
5. `feature/llm-minutes-generation`
6. `feature/finalize-meeting`
7. `docs/setup-and-usage`

### 各機能のGit運用

1. 最新の`main`からfeatureブランチを作成する（`git switch main && git pull --ff-only origin main && git switch -c feature/xxx`）。
2. 機能を実装し、関係ファイルのみ`git add`する（`git add -A`は使わない）。
3. `git diff --cached`で差分を確認してからコミットする。
4. `npm test`でユニットテストを実行し、通過を確認する。
5. featureブランチをoriginへpushする。
6. `main`へ戻り最新化した上で`git merge --no-ff`でマージする。
7. `main`をoriginへpushする。
8. `npx clasp push`でApps Scriptへ反映する。
9. 次のfeatureブランチを最新の`main`から作成する。

GitHubへのpushやclasp pushが認証エラー等で失敗しても、同じ操作を無限に繰り返さない（最大2回まで再試行し、解消しなければ未完了として記録し、ローカルでのbranch・add・commit・mergeは継続する）。

### コミットメッセージ

`feat: ...` / `fix: ...` / `docs: ...`のように、変更の「なぜ」が伝わる短い日本語または英語の命令形で書く（このリポジトリの既存コミットの書式に合わせる）。

## clasp push

- `.claspignore`により、`node_modules/`・`scripts/`・`.env`系・README/CLAUDE.md・package.json等はpush対象外とする。
- `.gs`・`.html`・`appsscript.json`のみをApps Scriptへpushする。
- push前に`npx clasp status`でpush対象を確認する。
- `appsscript.json`（マニフェスト）を変更した`clasp push`は確認プロンプトが出て自動ではスキップされるため、`npx clasp push --force`を使う。
- `docs/index.html`は`.claspignore`により除外されており、Apps Scriptへはpushされない。`npm run voice-input`でのローカル配信、またはGitHub Pages等の外部ホスティングでのみ公開される。
- `Code.gs`の`doPost`（音声入力API）や`MeetingService.gs`の`appendTranscriptRemote`など、Webアプリとして呼び出される関数を変更した場合は、`clasp push`だけでは既存デプロイに反映されない。既存デプロイIDへ`npx clasp deploy -i <デプロイID>`を実行して再デプロイすること（`npx clasp deployments`でID確認）。

## APIキーに関する禁止事項

- APIキーをソースコード（`.gs`/`.html`）へハードコードしない。
- APIキーの値をUI・`console.log`・Apps Scriptログへ出力しない。
- APIキーを推測・生成・捏造しない。
- APIキーはApps Script側では`PropertiesService`（ScriptProperties）へ保存し、コード内定数として持たない。

## `.env`の扱い

- `.env`はローカル専用とし、絶対にGitへコミットしない（`.gitignore`で`.env`・`.env.*`を除外し、`.env.example`のみ許可している）。
- `.env`はApps Script実行時に直接読み込めないため、`scripts/sync-secrets.mjs`がローカルで読み込み、`clasp run`経由でApps Script側の`remoteSetGeminiApiKey`を呼び出してPropertiesServiceへ保存する。
- 自動同期が失敗する環境（clasp未ログイン、Apps Script API未有効化、権限未承認等）でも、スプレッドシート上の「APIキーを設定」メニューから手動登録できる状態を常に維持すること。

## 音声入力トークンの扱い

- 音声入力トークン（`VOICE_INPUT_TOKEN`）は、音声入力ページ側の設定欄へ利用者自身が貼り付ける必要があるため、Gemini APIキーとは異なり、意図的にコピー用ダイアログで表示する（`PropertyService.showVoiceInputToken` / `reissueVoiceInputToken`）。これは仕様であり、バグではない。
- とはいえログへは出力しない。`console.error`等にトークンの値を書き出さないこと。
- Webアプリのアクセス設定が`ANYONE_ANONYMOUS`のため、トークンはこのAPIに対する唯一の認可手段になっている。`Code.gs`の`doPost`から`PropertyService.isValidVoiceInputToken`の検証を外さないこと。

## テスト方法

```bash
npm test
```

Node.jsの組み込みテストランナー（`node --test`）で、`tests/`配下の`*.test.mjs`を実行する。テスト対象は`.gs`ファイル内の純粋関数（`module.exports`でNode向けにエクスポートしたもの）に限定し、`SpreadsheetApp`等のApps Script API依存部分はテストしない（ブラウザ・Apps Script環境での手動確認に委ねる）。

## 禁止コマンド

以下は無許可で実行しない。

```text
git reset --hard
git clean -fd
git clean -fdx
git push --force
git push -f
rm -rf
```

## 日本語UI

利用者向けのメッセージ（メニュー項目、ダイアログ、トースト、エラーメッセージ）はすべて日本語にする。内部エラーログ（`console.error`）も日本語で構わないが、APIキーの値は含めない。

## README更新ルール

機能追加・変更を行った場合、`README.md`の該当セクション（使い方・APIキー管理・テスト・既知の制限・トラブルシューティング等）を実装と一致するように更新すること。実装とREADMEの記述に乖離が生じた状態でコミットしない。
