import { describe, it, expect } from 'vitest';

import {
  MAX_DISPLAY_TEXT_CODE_POINTS,
  MAX_FILENAME_TITLE_CODE_POINTS,
  buildScoreFilename,
  filenameTimestamp,
  sanitizeDisplayText,
  sanitizeFilenamePart,
} from '../exportFilename.js';

describe('sanitizeFilenamePart', () => {
  it('通常の曲名はそのまま残す', () => {
    expect(sanitizeFilenamePart('夜明けのうた')).toBe('夜明けのうた');
  });

  it('パス区切りとWindowsで使えない文字を除去する', () => {
    expect(sanitizeFilenamePart('a/b\\c:d*e?f"g<h>i|j')).toBe('abcdefghij');
  });

  it('親ディレクトリへ抜ける名前を作れない', () => {
    expect(sanitizeFilenamePart('../../etc/passwd')).toBe('etcpasswd');
  });

  it('制御文字を除去する', () => {
    expect(sanitizeFilenamePart('a\u0000b\u001Fc\u007Fd')).toBe('abcd');
  });

  it('双方向制御文字を除去する（拡張子の偽装を防ぐ）', () => {
    expect(sanitizeFilenamePart('gnp\u202E.exe')).toBe('gnp.exe');
  });

  it('空白は _ に畳み、端の空白・ドット・アンダースコアを削る', () => {
    expect(sanitizeFilenamePart('  夜明け  の うた ... ')).toBe('夜明け_の_うた');
  });

  it('末尾のドットを残さない（Windowsが黙って落とすため）', () => {
    expect(sanitizeFilenamePart('song...')).toBe('song');
  });

  it('Windowsの予約デバイス名には _ を前置する', () => {
    expect(sanitizeFilenamePart('CON')).toBe('_CON');
    expect(sanitizeFilenamePart('nul.txt')).toBe('_nul.txt');
    expect(sanitizeFilenamePart('COM1')).toBe('_COM1');
    expect(sanitizeFilenamePart('LPT9')).toBe('_LPT9');
  });

  it('予約名に見えるだけの名前はそのまま', () => {
    expect(sanitizeFilenamePart('console')).toBe('console');
  });

  it('上限を超えたらコードポイント単位で切る', () => {
    const long = 'あ'.repeat(MAX_FILENAME_TITLE_CODE_POINTS + 10);
    expect(sanitizeFilenamePart(long)).toBe('あ'.repeat(MAX_FILENAME_TITLE_CODE_POINTS));
  });

  it('サロゲートペアを割らない', () => {
    const emoji = '🎵';
    const title = emoji.repeat(MAX_FILENAME_TITLE_CODE_POINTS + 5);
    const result = sanitizeFilenamePart(title);
    expect(result).toBe(emoji.repeat(MAX_FILENAME_TITLE_CODE_POINTS));
    expect(result).not.toMatch(/[\uD800-\uDFFF]/u);
  });

  it('切った跡に端の記号を残さない', () => {
    const title = `${'あ'.repeat(MAX_FILENAME_TITLE_CODE_POINTS - 1)} うた`;
    expect(sanitizeFilenamePart(title)).toBe('あ'.repeat(MAX_FILENAME_TITLE_CODE_POINTS - 1));
  });

  it('空・非文字列・記号だけの曲名は Untitled になる', () => {
    expect(sanitizeFilenamePart('')).toBe('Untitled');
    expect(sanitizeFilenamePart('   ')).toBe('Untitled');
    expect(sanitizeFilenamePart('///')).toBe('Untitled');
    expect(sanitizeFilenamePart(undefined)).toBe('Untitled');
    expect(sanitizeFilenamePart(null)).toBe('Untitled');
    expect(sanitizeFilenamePart(42)).toBe('Untitled');
    expect(sanitizeFilenamePart({ toString: () => 'x' })).toBe('Untitled');
  });

  it('fallback と maxCodePoints を差し替えられる', () => {
    expect(sanitizeFilenamePart('', { fallback: 'preset' })).toBe('preset');
    expect(sanitizeFilenamePart('abcdef', { maxCodePoints: 3 })).toBe('abc');
  });
});

describe('filenameTimestamp', () => {
  it('ローカル時刻の YYYYMMDD-HHMMSS', () => {
    expect(filenameTimestamp(new Date(2026, 7, 25, 14, 30, 12))).toBe('20260825-143012');
  });

  it('1桁の月日時分秒を0詰めする', () => {
    expect(filenameTimestamp(new Date(2026, 0, 2, 3, 4, 5))).toBe('20260102-030405');
  });

  it('不正な日付はエポックへ落とす', () => {
    expect(filenameTimestamp(new Date(NaN))).toBe(filenameTimestamp(new Date(0)));
    expect(filenameTimestamp('2026-08-25')).toBe(filenameTimestamp(new Date(0)));
  });
});

describe('buildScoreFilename', () => {
  const date = new Date(2026, 7, 25, 14, 30, 12);

  it('Sky_曲名_日時.拡張子 の形', () => {
    expect(buildScoreFilename('月の光', 'pdf', date))
      .toBe('Sky_月の光_20260825-143012.pdf');
  });

  it('曲名が無ければ Untitled を入れる', () => {
    expect(buildScoreFilename('', 'json', date)).toBe('Sky_Untitled_20260825-143012.json');
  });

  it('曲名にパス区切りがあってもファイル名は1階層のまま', () => {
    const filename = buildScoreFilename('../evil', 'zip', date);
    expect(filename).toBe('Sky_evil_20260825-143012.zip');
    expect(filename).not.toMatch(/[/\\]/u);
  });
});

describe('sanitizeDisplayText', () => {
  it('空白や記号はファイル名と違ってそのまま残す', () => {
    expect(sanitizeDisplayText('Twinkle Little Star', 'Untitled')).toBe('Twinkle Little Star');
    expect(sanitizeDisplayText('夜明け／うた', 'Untitled')).toBe('夜明け／うた');
  });

  it('制御文字と双方向制御文字は落とす', () => {
    expect(sanitizeDisplayText('a\u0000b\u001Fc\u202Ed', 'Untitled')).toBe('abcd');
  });

  it('前後の空白を削る', () => {
    expect(sanitizeDisplayText('  うた  ', 'Untitled')).toBe('うた');
  });

  it('空・非文字列は fallback', () => {
    expect(sanitizeDisplayText('', 'Untitled')).toBe('Untitled');
    expect(sanitizeDisplayText('   ', 'Untitled')).toBe('Untitled');
    expect(sanitizeDisplayText(undefined, 'Untitled')).toBe('Untitled');
    expect(sanitizeDisplayText(42, 'Untitled')).toBe('Untitled');
  });

  it('上限を超えたらコードポイント単位で切る', () => {
    const long = 'あ'.repeat(MAX_DISPLAY_TEXT_CODE_POINTS + 10);
    expect(sanitizeDisplayText(long, 'Untitled'))
      .toBe('あ'.repeat(MAX_DISPLAY_TEXT_CODE_POINTS));
  });
});
