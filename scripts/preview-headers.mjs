// `vite preview` は public/_headers を読まないため、CSP起因の不具合が
// 「本番でしか出ない」のではなく「ヘッダ付き配信でしか再現していない」だけ、
// という状態を開発機で作れないでいた。このスクリプトはその再現手段であり、
// Cloudflare Pages の配信規則を完全再現するものではない
// （マッチ規則は下記 parseHeadersFile / getHeadersForPath 参照）。
//
// Node組み込みモジュールのみを使用し、依存パッケージは追加しない。

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.resolve(projectRoot, 'dist');
const headersFilePath = path.resolve(projectRoot, 'public', '_headers');

const DEFAULT_PORT = 4180; // `vite preview` の既定ポート(4173)と衝突しない値
const port = Number(process.argv[2]) || DEFAULT_PORT;

if (!fs.existsSync(distDir)) {
  console.error('dist/ が見つかりません。先に `npm run build` を実行してください。');
  process.exit(1);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
};

// `_headers` の書式（Netlify発祥、Cloudflare Pagesがそのまま採用）：
// `/` で始まる行がパターン、続くインデント行が `Key: value`。
// `#` で始まる行はコメントとして無視する。
function parseHeadersFile(content) {
  const rules = [];
  let current = null;
  for (const rawLine of content.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.startsWith('#')) continue;
    if (/^\s/.test(rawLine)) {
      if (!current) continue;
      const line = rawLine.trim();
      const sep = line.indexOf(':');
      if (sep === -1) continue;
      current.headers.push([line.slice(0, sep).trim(), line.slice(sep + 1).trim()]);
    } else if (rawLine.startsWith('/')) {
      current = { pattern: rawLine.trim(), headers: [] };
      rules.push(current);
    }
  }
  return rules;
}

// 末尾 `*` は前方一致、それ以外は完全一致。`/*` は prefix が `/` になるため全パスに一致する。
function patternToMatcher(pattern) {
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return (requestPath) => requestPath.startsWith(prefix);
  }
  return (requestPath) => requestPath === pattern;
}

// マッチ規則：ファイル上から順に全マッチを走査し、同じヘッダ名は後にマッチした
// ルールの値で上書きする（後勝ちのマージ）。Cloudflare Pages の実際の規則
// （最長一致優先など）を再現するものではない。目的はCSPを付けた状態で
// 動かすことであり、ヘッダ配信の完全な模倣ではない。
function getHeadersForPath(requestPath, rules) {
  const merged = new Map();
  for (const rule of rules) {
    if (rule.matcher(requestPath)) {
      for (const [key, value] of rule.headers) {
        merged.set(key, value);
      }
    }
  }
  return merged;
}

const rules = fs.existsSync(headersFilePath)
  ? parseHeadersFile(fs.readFileSync(headersFilePath, 'utf-8')).map((rule) => ({
      ...rule,
      matcher: patternToMatcher(rule.pattern),
    }))
  : [];

function resolveFile(requestPathname) {
  // dist/ の外へ出るパス（`..` を含む要求）は素通しにしない
  // （WHATWG URLパーサがdotセグメントを解決済みのため到達しにくいが、
  // 念のため文字列レベルでも拒否する）
  if (requestPathname.includes('..')) return null;

  let filePath = path.join(distDir, requestPathname);
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    stat = null;
  }

  // ディレクトリへのアクセス（`/` を含む）だけを index.html にフォールバックする。
  // 存在しない個別ファイルまで index.html を返すと 404 が消えてしまう
  if (stat && stat.isDirectory()) {
    filePath = path.join(filePath, 'index.html');
    try {
      stat = fs.statSync(filePath);
    } catch {
      return null;
    }
  }

  if (!stat || !stat.isFile()) return null;

  // 実パスでも dist/ の外に出ていないことを確認する
  const resolved = path.resolve(filePath);
  if (resolved !== distDir && !resolved.startsWith(distDir + path.sep)) return null;

  return resolved;
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error(err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  });
});

async function handleRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const requestPathname = decodeURIComponent(url.pathname);

  const filePath = resolveFile(requestPathname);
  if (!filePath) {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  res.setHeader('Content-Type', mime);
  for (const [key, value] of getHeadersForPath(requestPathname, rules)) {
    res.setHeader(key, value);
  }
  res.statusCode = 200;
  fs.createReadStream(filePath).pipe(res);
}

server.listen(port, () => {
  console.log(`_headers を適用したプレビューサーバを起動しました: http://localhost:${port}`);
  console.log('(vite preview とは別ポート。CSPヘッダの確認用。本番配信の完全な模倣ではありません)');
});
