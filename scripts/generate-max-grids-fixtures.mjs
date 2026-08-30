import { mkdir, stat, writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseScoreJson } from '../src/lib/parseScore.js';
import { createScore } from '../src/state/scoreShape.js';

const OUTPUT_DIR = fileURLToPath(new URL('../test-scores/max-grids/', import.meta.url));
const STANDARD_COUNTS = [4_000, 6_000, 10_000];
const WORST_CASE_COUNTS = [4_000, 6_000, 10_000];
const MAX_TEXT = '負荷'.repeat(50);

function makeStandardGrid(index) {
  const root = index % 15;
  return {
    type: 'note',
    keys: [root, (root + 4) % 15, (root + 7) % 15],
    text: index % 16 === 0 ? `measure-${Math.floor(index / 16) + 1}` : '',
    forceBreakAfter: index % 64 === 63,
  };
}

function makeWorstCaseGrid(index) {
  return {
    type: 'note',
    keys: Array.from({ length: 15 }, (_, key) => key),
    layer2Keys: Array.from({ length: 15 }, (_, key) => 14 - key),
    text: MAX_TEXT,
    forceBreakAfter: index % 2 === 1,
  };
}

function makeScore(count, gridFactory, title) {
  return {
    formatVersion: gridFactory === makeWorstCaseGrid ? 'sky-editor-v2' : 'sky-editor-v1',
    title,
    author: 'MAX_GRIDS regression fixture',
    lyricist: '',
    transcribedBy: 'scripts/generate-max-grids-fixtures.mjs',
    bpm: 120,
    bitsPerPage: 16,
    pitchLevel: 0,
    keyMode: 'major',
    grids: Array.from({ length: count }, (_, index) => gridFactory(index)),
  };
}

async function writeFixture(fileName, score, expectedCount) {
  const json = JSON.stringify(score, null, 2);
  const parseT0 = performance.now();
  const parsed = parseScoreJson(json);
  const parseMs = performance.now() - parseT0;
  if (parsed.grids.length !== expectedCount) {
    throw new Error(`${fileName}: expected ${expectedCount}, got ${parsed.grids.length}`);
  }
  const draftPayload = JSON.stringify({ ...createScore(parsed), savedAt: Date.now() });
  const target = path.join(OUTPUT_DIR, fileName);
  await writeFile(target, json, 'utf8');
  const fileStat = await stat(target);
  return {
    fileName,
    bytes: fileStat.size,
    draftChars: draftPayload.length,
    draftUtf8Bytes: Buffer.byteLength(draftPayload, 'utf8'),
    loaded: parsed.grids.length,
    parseMs,
    warning: parsed.warning,
  };
}

await mkdir(OUTPUT_DIR, { recursive: true });

const results = [];
for (const count of STANDARD_COUNTS) {
  results.push(await writeFixture(
    `max-grids-${count}.json`,
    makeScore(count, makeStandardGrid, `MAX_GRIDS ${count}`),
    count,
  ));
}
for (const count of WORST_CASE_COUNTS) {
  results.push(await writeFixture(
    `max-grids-${count}-worst-case.json`,
    makeScore(count, makeWorstCaseGrid, `MAX_GRIDS ${count} worst case`),
    count,
  ));
}
results.push(await writeFixture(
  'max-grids-10001-over-limit.json',
  makeScore(10_001, makeStandardGrid, 'MAX_GRIDS 10001 over limit'),
  10_000,
));

for (const result of results) {
  const mib = (result.bytes / 1024 / 1024).toFixed(2);
  const draftMib = (result.draftUtf8Bytes / 1024 / 1024).toFixed(2);
  console.log(
    `${result.fileName}: ${mib} MiB / draft ${result.draftChars} chars (${draftMib} MiB UTF-8)`
      + ` / parse ${result.parseMs.toFixed(1)} ms / loaded ${result.loaded}`
      + `${result.warning ? ' / warning' : ''}`,
  );
}
