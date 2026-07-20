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
- [Web Speech APIの制限](#web-speech-apiの制限)
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
```

`npm run setup`は内部で以下を順に実行します（各ステップは独立しており、片方が失敗してももう片方は実行されます）。

1. `.env`のGemini APIキーをApps ScriptのPropertiesServiceへ同期（`npm run sync:secrets`と同じ処理）
2. `npx clasp push`でApps Scriptへコードを反映

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
- シート作成後、B5（文字起こし欄）が選択された状態になります。
- 可能な環境では、音声入力用のサイドバーが自動的に開きます。

### 音声入力

サイドバーが利用できる環境では、ブラウザのWeb Speech API（日本語・継続認識）で音声入力ができます。「音声入力開始」で開始し、「音声入力停止」で停止すると、確定済みの文字が表示されます。内容を確認・編集し、「シートへ反映」を押すとB5へ追記されます。

音声入力が使えない場合や、サイドバーが表示されない場合は、B5へ直接入力してください（詳細は[Web Speech APIの制限](#web-speech-apiの制限)を参照）。

#### Macの音声入力手順

1. B5セルを選択する。
2. `Fn`キーを2回（または設定した音声入力ショートカット）押して、macOSの音声入力を起動する。
3. 話した内容がB5へ入力される。
4. 完了したら再度ショートカットを押すか、Escキーで音声入力を終了する。

（システム環境設定／システム設定の「キーボード」→「音声入力」で事前に有効化が必要です。）

#### Windowsの音声入力手順

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
Code.gs                    エントリーポイント（onOpen、メニュー、サイドバー起動、秘密情報同期の受け口）
MeetingService.gs          会議シートの作成・レイアウト・開始/生成/終了/クリア
LlmService.gs              LLM Providerの呼び出し制御・レスポンス解析・整形（Provider非依存部分）
GeminiProvider.gs          Gemini APIとの通信・モデル設定・HTTPステータス処理
PromptService.gs           要約・ネクストアクション抽出用プロンプトの生成
PropertyService.gs         Gemini APIキーの保存・取得・状態確認（PropertiesService）
Sidebar.gs                 音声入力サイドバーの表示
Sidebar.html / Styles.html 音声入力サイドバーのUIとWeb Speech APIロジック
appsscript.json            Apps Scriptマニフェスト
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
- サイドバーの表示とWeb Speech APIによる音声入力
- Gemini APIキー入力後の実際のAPI通信
- 会議終了・シートクリアのUIダイアログ挙動

## Web Speech APIの制限

- Web Speech API（`SpeechRecognition` / `webkitSpeechRecognition`）は、Google Apps ScriptのHTMLサイドバー（iframe内）やブラウザの種類・バージョンによって、マイク権限の取得や継続認識が不安定になる場合があります。
- 未対応のブラウザでは、サイドバーが自動的に音声入力ボタンを無効化し、代替手段（B5への直接入力、OS標準の音声入力）を案内します。
- 音声認識が意図せず終了した場合は自動的に再開しますが、利用者が「音声入力停止」を押した場合は再開しません。

## 既知の制限

- Gemini APIの実通信・レスポンス品質は、実際のAPIキーを用いた動作確認が必要です（未確認）。
- 以下はブラウザ上でのみ確認可能なため、実装・静的確認までとし、人間による最終確認が必要です。
  - スプレッドシートのカスタムメニュー表示
  - サイドバーの表示
  - マイク権限の許可
  - Web Speech APIの実動作
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
| サイドバーの音声入力ボタンが押せない | ブラウザがWeb Speech APIに対応していないか、マイク権限が拒否されています。B5へ直接入力するか、OS標準の音声入力を利用してください。 |
| 現在のシートで操作すると「会議シートではありません」と表示される | 「会議を開始」で作成した`会議_...`という名前のシート上で操作してください。 |
