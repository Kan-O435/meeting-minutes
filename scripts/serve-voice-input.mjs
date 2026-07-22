#!/usr/bin/env node
/**
 * docs/index.html（音声入力ページ）をローカルで配信する。
 * localhostはブラウザが「安全な文脈」として扱うため、
 * Google Apps Scriptのドメインでは許可されないマイクアクセスが正常に機能する。
 * 外部ホスティング（GitHub Pages等）を使わずに済むよう、依存ライブラリなしで実装する。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.join(__dirname, '..', 'docs');
const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const server = http.createServer((req, res) => {
  var urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') {
    urlPath = '/index.html';
  }
  var filePath = path.join(docsDir, urlPath);

  // ディレクトリトラバーサル対策: docs配下のファイルのみ配信する
  if (!filePath.startsWith(docsDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    var ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, function () {
  console.log('音声入力ページを起動しました: http://localhost:' + PORT + '/');
  console.log('スプレッドシートの「音声入力ページのURLを設定」に、上記URL（末尾のポート番号込み）を登録してください。');
  console.log('終了するには Ctrl+C を押してください。');
});
