# meeting-minutes

Googleスプレッドシート + Google Apps Script + Gemini API で動作する、簡易的なAI会議議事録作成プロトタイプです。

会議を開始すると、開いているスプレッドシート内に会議ごとのシートが一番左に作成されます。文字起こし（B5）を入力して「議事録を生成」を実行すると、Gemini APIが要約とネクストアクションを生成し、同じシートへ書き込みます。

## 目次

- [必要環境](#必要環境)
- [セットアップ手順](#セットアップ手順)
- [使い方](#使い方)
  - [会議を開始する](#会議を開始する)
  - [音声入力](#音声入力)
  - [議事録を生成する](#議事録を生成する)
  - [会議を終了する](#会議を終了する)
  - [シートをクリアする](#シートをクリアする)
- [APIキーの管理](#apiキーの管理)
- [`.env`がApps Scriptから直接読めない理由と秘密情報同期の仕組み](#envがapps-scriptから直接読めない理由と秘密情報同期の仕組み)
- [自動同期が利用できない場合の手動設定](#自動同期が利用できない場合の手動設定)
- [ファイル構成](#ファイル構成)
- [テスト](#テスト)
- [既知の制限](#既知の制限)
- [トラブルシューティング](#トラブルシューティング)

## 必要環境

- Node.js 20.6以降（`.env`読み込みに`process.loadEnvFile`を使用するため）
- npm
- Googleアカウント（Googleスプレッドシート・Apps Scriptを利用できること）
- Gemini APIキー（[Google AI Studio](https://aistudio.google.com/app/apikey)で取得）
- clasp（`npm install`でdevDependenciesとして導入されます）

## セットアップ手順

```bash
# 1. 依存パッケージをインストール
npm install

# 2. claspでGoogleアカウントにログイン（ブラウザが開きます）
npx clasp login

# 3. .envを作成し、Gemini APIキーを入力
cp .env.example .env
# .env を開いて GEMINI_API_KEY= の右側にAPIキーを入力する

# 4. セットアップ（秘密情報同期 + Apps Scriptへのpushをまとめて実行）
npm run setup

# 5. （音声入力ページを使う場合のみ・初回1回だけ）WebアプリとしてAPIをデプロイ
npx clasp deploy --description "voice-input api"
npx clasp deployments   # 発行された exec URL を確認
```

`npm run setup`は内部で以下を順に実行します（各ステップは独立しており、片方が失敗してももう片方は実行されます）。

1. `.env`のGemini APIキーをApps ScriptのPropertiesServiceへ同期（`npm run sync:secrets`と同じ処理）
2. `npx clasp push`でApps Scriptへコードを反映

手順5は、音声入力ページ（[音声入力](#音声入力)を参照）を使う場合のみ必要です。コードを更新した後にWebアプリ側へも反映したい場合は、新しいデプロイを増やさず、既存のデプロイIDへ再デプロイしてください。

```bash
npx clasp deploy -i <デプロイID> --description "voice-input api"
```

秘密情報同期だけを個別に実行したい場合：

```bash
npm run sync:secrets
```

セットアップ完了後、対象のGoogleスプレッドシートを開く（または再読み込みする）と、「AI議事録」メニューが表示されます。初回はGoogleアカウントの権限承認ダイアログが表示されるので、内容を確認して許可してください。

## 使い方

### 会議を開始する

スプレッドシートのメニュー「AI議事録」→「会議を開始」を選択します。

- `会議_YYYYMMDD_HHmmss`という名前の新しいシートが一番左に作成されます（例: `会議_20260721_103000`）。
- 同名のシートが既にある場合は、`_2`のように連番が付与されます。
- シート作成後、B5（文字起こし欄）が選択された状態になります。この状態でそのまま文字起こしを入力してください。

### 音声入力

Google Apps Scriptが配信するページ（サイドバー・Webアプリの`doGet`いずれも含む）は、Google側のサーバー設定によってマイクへのアクセスが許可されない構成になっています。これはmacOS/Chrome側のマイク権限設定とは無関係で、開発者側のコードやデプロイ方法を変えても回避できないプラットフォーム側の制約です（実機検証済み）。

このため、音声入力（Web Speech API）を使いたい場合は、**Apps Script以外のオリジンでホストした専用ページ**を使います。`localhost`はブラウザが「安全な文脈」として扱うため、ローカルで動かすだけでマイク許可が正常に機能し、外部への公開は不要です。このページ（`docs/index.html`）は音声認識のみを行い、テキストをApps ScriptのWebアプリ（API）へ送信してB5へ書き込みます。

#### ローカル版 音声入力の使い方（推奨・初回のみ設定が必要）

**初回セットアップ**

1. Apps ScriptをWebアプリとしてデプロイする（未実施の場合）。
   ```bash
   npx clasp deploy --description "voice-input api"
   npx clasp deployments   # 発行されたデプロイの exec URL を確認
   ```
   URLの形式: `https://script.google.com/macros/s/<デプロイID>/exec`
2. ローカルサーバーを起動する。
   ```bash
   npm run voice-input
   ```
   `http://localhost:8787/` が起動します（ポートは環境変数`PORT`で変更可能）。このコマンドを実行している間だけページが使えます。
3. スプレッドシートの「AI議事録」→「**音声入力ページのURLを設定**」で、`http://localhost:8787`（手順2のURL）を登録する。
4. 「AI議事録」→「**音声入力トークンを表示**」でトークンをコピーする（初回は自動発行されます）。
5. ブラウザで `http://localhost:8787/` を直接開き、「設定」を開いて「Apps ScriptWebアプリのURL」（手順1）と「音声入力トークン」（手順4）を貼り付けて保存する（この設定はブラウザのlocalStorageに保存され、次回以降は不要です）。

**使うとき（毎回）**

1. （サーバーを終了している場合）`npm run voice-input` を実行しておく。
2. 会議シート上で「AI議事録」→「**音声入力ページを開くリンクを表示**」を選択し、表示されたリンクをコピーする（このリンクには対象のスプレッドシートID・シート名が含まれます）。
3. コピーしたリンクを新しいタブで開く。
4. 「音声入力開始」→話す→「音声入力停止」→内容を確認・編集し、「シートへ反映」を押す。
5. 元のスプレッドシートのB5に反映されていることを確認する。

**セキュリティ上の注意**

- ページ自体はローカルのみで完結しますが、Apps ScriptのWebアプリAPI（`doPost`）はインターネット上に公開されています。exec URL・音声入力トークン・対象シート情報が漏れると、第三者がB5へ任意のテキストを書き込める状態になります。他人と共有しないでください。
- トークンの漏えいが疑われる場合は、「AI議事録」→「音声入力トークンを再発行」で無効化・再発行できます（再発行後は、`http://localhost:8787/`の設定にも新しいトークンを貼り直してください）。

**別の端末や複数人からも使いたい場合**

`docs/index.html`はそのままGitHub Pages等の外部ホスティングでも動作します（GitHubリポジトリの Settings → Pages → Source: `Deploy from a branch` / Branch: `main` / Folder: `/docs`）。ただしその場合、ページのURLは誰でもアクセスできる公開URLになる点に注意してください（上記のセキュリティ上の注意がより重要になります）。

#### OS標準の音声入力（ローカルサーバーを使わない場合の代替）

ローカルサーバーを起動しない場合でも、OS標準の音声入力でB5へ直接入力すれば同様に利用できます。B5は「会議を開始」直後に自動で選択状態になります。

##### Macの音声入力手順

1. あらかじめ「システム設定」→「キーボード」→「音声入力」を開き、音声入力を**オン**にする（オフのままだと`Fn`キーを押しても何も起動しません）。同じ画面でショートカットキー（既定は`Fn`キー2回連続押し）を確認・変更できます。
2. B5セルを選択する。
3. 設定したショートカット（既定は`Fn`キーを2回）を押して、macOSの音声入力を起動する。
4. 話した内容がB5へ入力される。
5. 完了したら再度ショートカットを押すか、Escキーで音声入力を終了する。

##### Windowsの音声入力手順

1. B5セルを選択する。
2. `Windowsキー + H`を押して、Windowsの音声入力を起動する。
3. 話した内容がB5へ入力される。
4. 完了したらもう一度`Windowsキー + H`を押すか、マイクアイコンをクリックして終了する。

### 議事録を生成する

B5に文字起こしを入力した状態で、「AI議事録」→「議事録を生成」を選択します。

1. 現在のシートが会議シートか確認します（会議シート以外では実行されません）。
2. B5が空の場合は警告して終了します。
3. Gemini APIキーが未設定の場合は警告して終了します。
4. B11が「生成中」になり、Gemini APIへ送信します。
5. 成功するとB7へ要約、B9へネクストアクションが書き込まれ、B11が「完了」になります。
6. 失敗した場合はB11が「エラー」になり、内容を説明するダイアログが表示されます。

同時に複数回実行された場合はロック（LockService）により後続の実行がスキップされます。

### 会議を終了する

「AI議事録」→「会議を終了」を選択すると、B3に現在日時が記録されます。B5に文字起こしがあれば、続けて議事録生成が行われます。終了日時が既に記録されている場合は、上書きするかどうかの確認ダイアログが表示されます。シートはロック・保護されないため、終了後も自由に編集できます。

### シートをクリアする

「AI議事録」→「現在の会議シートをクリア」を選択すると、確認ダイアログの後、B1（会議名）・B3（終了日時）・B5（文字起こし）・B7（要約）・B9（ネクストアクション）がクリアされます。B2（開始日時）は保持されます。会議シート以外では実行できません。

## APIキーの管理

### A. スプレッドシート上から設定する（常に利用可能）

「AI議事録」→「APIキーを設定」からダイアログにGemini APIキーを入力すると、`PropertiesService`（スクリプトプロパティ）へ保存されます。保存後、キーの値は画面にもログにも表示されません。

「APIキー設定状況を確認」を選ぶと、次のように設定状態のみが表示されます（値は表示されません）。

```text
Gemini APIキー：設定済み
```

### B. `.env`から同期する

上記の[セットアップ手順](#セットアップ手順)を参照してください。

### UserProperties と ScriptProperties について

このプロトタイプは`PropertiesService.getScriptProperties()`（ScriptProperties）を使用しています。ScriptPropertiesはスクリプト単位で1つの値を共有するため、単一ユーザーでの利用や検証を想定したこのプロトタイプに適しています。

複数のユーザーがそれぞれ別のAPIキーを使い分けたい場合は、`PropertiesService.getUserProperties()`（UserProperties、実行ユーザーごとに独立した値）への切り替えを検討してください。その場合、`PropertyService.gs`の`getScriptProperties_()`を`getUserProperties()`に置き換えるだけで対応できます。

## `.env`がApps Scriptから直接読めない理由と秘密情報同期の仕組み

Google Apps Scriptはサーバー上（Google側）で実行されるため、開発者のローカルマシンにある`.env`ファイルを実行時に直接読み込むことができません。そのため、次の流れでローカルの秘密情報をApps Script側へ渡します。

```text
.env（ローカルのみ・Git管理対象外）
  ↓ node scripts/sync-secrets.mjs が読み込む
  ↓ npx clasp run remoteSetGeminiApiKey -p '["<APIキー>"]' を呼び出す
  ↓ Code.gs の remoteSetGeminiApiKey → PropertyService.setApiKeyFromSecretSync
  ↓ PropertiesService（ScriptProperties）へ保存
```

`scripts/sync-secrets.mjs`は、APIキーの値を`console.log`などで出力しません。また、`clasp run`へ渡すパラメータはNode.jsの`child_process.spawn`を用いてプロセス引数として直接渡しており、シェル文字列展開やシェル履歴を経由しません（ただし、OS上のプロセス一覧コマンド（`ps`等）からは実行中に見える可能性がある点はCLIツールの構造上の制約として残ります。より厳密に秘密情報を扱いたい場合は、後述のApps Script API（`script.googleapis.com`）を直接呼び出す方式への置き換えを検討してください）。

## 自動同期が利用できない場合の手動設定

`npm run sync:secrets`が次のような理由で失敗することがあります。

- `clasp login`が未実行、または認証セッションが失効している
- [Apps Script API](https://script.google.com/home/usersettings)が無効化されている
- スクリプトの実行権限がまだ一度も承認されていない（Apps Script API経由の実行はブラウザでの権限承認画面を表示できないため、事前にApps Scriptエディタ上で対象の関数を一度手動実行し、権限を承認しておく必要があります）

このような場合は、自動同期を諦めて、スプレッドシート上の「AI議事録」→「APIキーを設定」から手動でAPIキーを登録してください。このプロトタイプの全機能は、自動同期なしでも利用できます。

## ファイル構成

```text
Code.gs                    エントリーポイント（onOpen、メニュー、秘密情報同期の受け口）
MeetingService.gs          会議シートの作成・レイアウト・開始/生成/終了/クリア
LlmService.gs              LLM Providerの呼び出し制御・レスポンス解析・整形（Provider非依存部分）
GeminiProvider.gs          Gemini APIとの通信・モデル設定・HTTPステータス処理
PromptService.gs           要約・ネクストアクション抽出用プロンプトの生成
PropertyService.gs         Gemini APIキー・音声入力トークン等の保存・取得・状態確認（PropertiesService）
appsscript.json            Apps Scriptマニフェスト（Webアプリ設定を含む）
docs/index.html            音声入力ページ本体（Apps Scriptの外側でホスト。通常はローカルサーバーで配信）
scripts/serve-voice-input.mjs  docs/index.htmlをlocalhostで配信する開発用サーバー（npm run voice-input）
scripts/sync-secrets.mjs   .env → Apps Script への秘密情報同期スクリプト
scripts/setup.mjs          セットアップ一括実行スクリプト（秘密情報同期 + clasp push）
tests/                     Node.jsの組み込みテストランナー（node --test）によるユニットテスト
.env.example               .envのひな形
.clasp.json                claspのプロジェクト設定（scriptIdを含む）
.claspignore                clasp push対象外ファイルの指定
```

将来、OpenAI APIやClaude API等を追加する場合は、`LlmService.gs`のProvider選択部分に新しいProvider（例: `OpenAIProvider.gs`）を追加し、`GeminiProvider`と同じインターフェース（`generateContent(prompt)`）を実装してください。

## テスト

```bash
npm test
```

`MeetingService.gs`・`LlmService.gs`・`scripts/sync-secrets.mjs`内の純粋関数（シート名生成、重複回避、Geminiレスポンス解析、Markdownコードブロック除去、ネクストアクション整形、環境変数検証）をNode.jsの組み込みテストランナーでテストしています。

以下は、実際のGoogleスプレッドシート・Apps Script環境が必要なため、ブラウザ上での手動確認が必要です（[人間による確認項目](#既知の制限)を参照）。

- 「AI議事録」メニューの表示
- 会議シート作成・命名・連番回避の実動作
- Gemini APIキー入力後の実際のAPI通信
- 会議終了・シートクリアのUIダイアログ挙動
- ローカル版音声入力ページ（`npm run voice-input`）からのマイク入力・Web APIへの反映

## 既知の制限

- Gemini APIの実通信・レスポンス品質は、実際のAPIキーを用いた動作確認が必要です（未確認）。
- Google Apps Scriptが直接配信するページ（サイドバー・Webアプリの`doGet`いずれも）はGoogle側の設定でマイクへのアクセスができないことを実機検証済みです。音声入力を使う場合は[ローカル版の音声入力ページ](#音声入力)（`npm run voice-input`）を利用してください（OS標準の音声入力も引き続き利用できます）。
- 音声入力ページ用のApps Script Webアプリ（`doPost`）は、アクセス設定を`ANYONE_ANONYMOUS`にしているため、exec URL・トークン・対象シート情報が漏れると第三者がB5へ書き込める状態になります（[音声入力](#音声入力)のセキュリティ上の注意を参照）。
- 以下はブラウザ上でのみ確認可能なため、実装・静的確認までとし、人間による最終確認が必要です。
  - スプレッドシートのカスタムメニュー表示
  - Googleアカウントの初回権限承認
  - シートの見た目（罫線・折り返し・列幅等）
  - Gemini APIキー入力後の実通信
- `npm run sync:secrets` / `npm run setup`によるApps Scriptへの秘密情報自動同期は、`clasp login`・Apps Script API有効化・スクリプト権限の事前承認が整っていない環境では失敗します。その場合は、スプレッドシート上の「APIキーを設定」から手動登録してください。

## トラブルシューティング

| 症状 | 対処 |
| --- | --- |
| `npx clasp push`が「User has not enabled the Apps Script API」で失敗する | https://script.google.com/home/usersettings を開き、Apps Script APIを有効化してから再実行してください。 |
| `npx clasp login`後もpush/runが失敗する | `npx clasp logout`してから再度`npx clasp login`を実行してください。 |
| `npm run sync:secrets`が失敗する | 上記[自動同期が利用できない場合の手動設定](#自動同期が利用できない場合の手動設定)を参照し、スプレッドシート上から手動登録してください。 |
| 「Gemini APIキーが設定されていません」と表示される | 「AI議事録」→「APIキーを設定」からAPIキーを登録してください。 |
| 「Gemini APIキーが無効、または権限がありません」と表示される | APIキーの値が正しいか確認し、再登録してください。 |
| 「Gemini APIのレート制限に達しました」と表示される | しばらく時間をおいてから再実行してください。 |
| JSON解析エラーでB11が「エラー」になる | 文字起こしの内容を短くする、または再実行してください。改善しない場合はApps Scriptの実行ログ（表示 → 実行数）を確認してください。 |
| 現在のシートで操作すると「会議シートではありません」と表示される | 「会議を開始」で作成した`会議_...`という名前のシート上で操作してください。 |
| Macで`Fn`キーを押しても音声入力が起動しない | 「システム設定」→「キーボード」→「音声入力」が オフになっている可能性があります。オンにしてから再度お試しください。 |
