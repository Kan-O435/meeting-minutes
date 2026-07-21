# CLAUDE.md

このファイルは、今後Claude Codeがこのリポジトリを編集する際のルールをまとめたものです。

## プロジェクト概要

Googleスプレッドシート上で動作する、AI会議議事録作成プロトタイプ（Google Apps Script + Gemini API）。

- 会議開始時に、開いているスプレッドシート内の一番左へ会議ごとの新しいシート（`会議_YYYYMMDD_HHmmss`）を作成する。
- B5へ入力された文字起こしをGemini APIへ送信し、B7へ要約、B9へネクストアクションを生成・保存する。
- Chrome拡張機能や独自バックエンドは使用せず、Googleスプレッドシート・Apps Script・Gemini APIのみで完結させる。

## ファイル構成

```text
Code.gs                    エントリーポイント（onOpen、メニュー、サイドバー起動、doGet、秘密情報同期の受け口）
MeetingService.gs          会議シートの作成・レイアウト・開始/生成/終了/クリア
LlmService.gs              LLM Providerの呼び出し制御・レスポンス解析・整形（Provider非依存部分）
GeminiProvider.gs          Gemini APIとの通信・モデル設定・HTTPステータス処理
PromptService.gs           要約・ネクストアクション抽出用プロンプトの生成
PropertyService.gs         Gemini APIキーの保存・取得・状態確認（PropertiesService）
SidebarService.gs / Sidebar.html / Styles.html  音声入力サイドバー
appsscript.json            Apps Scriptマニフェスト
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
- `Sidebar.html`・`SidebarService.gs`・`Code.gs`の`doGet`など、音声入力の「新しいタブで開く」機能（Webアプリ）に関わるファイルを変更した場合は、`clasp push`だけでは反映されない。既存のデプロイIDへ`npx clasp deploy -i <デプロイID>`を実行して再デプロイすること（`npx clasp deployments`でID確認）。

## APIキーに関する禁止事項

- APIキーをソースコード（`.gs`/`.html`）へハードコードしない。
- APIキーの値をUI・`console.log`・Apps Scriptログへ出力しない。
- APIキーを推測・生成・捏造しない。
- APIキーはApps Script側では`PropertiesService`（ScriptProperties）へ保存し、コード内定数として持たない。

## `.env`の扱い

- `.env`はローカル専用とし、絶対にGitへコミットしない（`.gitignore`で`.env`・`.env.*`を除外し、`.env.example`のみ許可している）。
- `.env`はApps Script実行時に直接読み込めないため、`scripts/sync-secrets.mjs`がローカルで読み込み、`clasp run`経由でApps Script側の`remoteSetGeminiApiKey`を呼び出してPropertiesServiceへ保存する。
- 自動同期が失敗する環境（clasp未ログイン、Apps Script API未有効化、権限未承認等）でも、スプレッドシート上の「APIキーを設定」メニューから手動登録できる状態を常に維持すること。

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

利用者向けのメッセージ（メニュー項目、ダイアログ、トースト、サイドバーの文言、エラーメッセージ）はすべて日本語にする。内部エラーログ（`console.error`）も日本語で構わないが、APIキーの値は含めない。

## README更新ルール

機能追加・変更を行った場合、`README.md`の該当セクション（使い方・APIキー管理・テスト・既知の制限・トラブルシューティング等）を実装と一致するように更新すること。実装とREADMEの記述に乖離が生じた状態でコミットしない。
