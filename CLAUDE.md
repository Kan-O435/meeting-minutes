# CLAUDE.md

このファイルは、今後Claude Codeがこのリポジトリを編集する際のルールをまとめたものです。
詳細版は `docs/setup-and-usage` ブランチで完成させます。現時点の暫定ルールは以下のとおりです。

## プロジェクト概要

Googleスプレッドシート上で動作する、AI会議議事録作成プロトタイプ（Google Apps Script + Gemini API）。

## 最低限守ること

- APIキーをソースコードへハードコードしない。
- `.env` をGitへコミットしない。
- 破壊的なgit操作（`reset --hard`、`push --force`、`clean -fd` 等）を無許可で行わない。
- UI文言・ユーザー向けメッセージは日本語にする。
