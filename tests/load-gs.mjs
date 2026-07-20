import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * .gsファイルはApps Script専用の拡張子でNodeのrequireが解決できないため、
 * ソースを読み込みCommonJS形式として評価することでテスト対象の純粋関数のみを取り出す。
 */
export function loadGasModule(relativePathFromProjectRoot) {
  const fullPath = path.join(__dirname, '..', relativePathFromProjectRoot);
  const code = fs.readFileSync(fullPath, 'utf8');
  const module = { exports: {} };
  const evaluate = new Function('module', 'exports', code);
  evaluate(module, module.exports);
  return module.exports;
}
