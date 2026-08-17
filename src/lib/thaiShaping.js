const THAI_CHAR_RE = /[\u0E00-\u0E7F]/u;
const UPPER_VOWELS = new Set(['ั', 'ิ', 'ี', 'ึ', 'ื', '็']);
const TONE_MARKS = new Set(['่', '้', '๊', '๋', '์', 'ํ', '๎']);
const UPPER_MARKS = new Set([...UPPER_VOWELS, ...TONE_MARKS]);
const UPPER_MARK_BASES = new Set(['ป', 'ฝ', 'ฟ', 'ฬ']);
const LOWER_MARK_BASES = new Set(['ญ', 'ฐ', 'ฎ', 'ฏ']);
const LOWER_VOWELS = new Set(['ุ', 'ู', 'ฺ']);

// em を単位とする補正値。書体から実測したBoldの最大アウトラインを基に、
// 重なりが残らない側へ丸めてある。声調記号 U+0E4E と上部記号の yMin から
// 0.34em、ฬ と上部記号の x 方向の張り出しから 0.58em、ญ と下部母音の
// y 方向の張り出しから 0.24em。PDFのyは下向きに増えるため、声調記号を
// 持ち上げる補正だけが負になる。
const TONE_RAISE_DY = -0.34;
const UPPER_MARK_SHIFT_DX = 0.58;
const LOWER_VOWEL_SHIFT_DY = 0.24;

function zeroCorrection() {
  return { dx: 0, dy: 0 };
}

function getCorrection(chars, index) {
  const current = chars[index];
  const previous = chars[index - 1];
  if (UPPER_VOWELS.has(previous) && TONE_MARKS.has(current)) {
    return { dx: 0, dy: TONE_RAISE_DY };
  }
  if (UPPER_MARK_BASES.has(previous) && UPPER_MARKS.has(current)) {
    return { dx: UPPER_MARK_SHIFT_DX, dy: 0 };
  }
  if (LOWER_MARK_BASES.has(previous) && LOWER_VOWELS.has(current)) {
    return { dx: 0, dy: LOWER_VOWEL_SHIFT_DY };
  }
  return zeroCorrection();
}

/**
 * タイ文字の記号補正を、PDF描画用に独立したテキストランへ分解して返す。
 * 補正量が同じ文字を1つのランへまとめているのは、3つの補正のどれも要らない
 * タイ文字を通常のテキスト描画経路のまま扱うため。
 */
export function shapeThai(text) {
  const source = String(text);
  if (!THAI_CHAR_RE.test(source)) {
    return [{ text: source, ...zeroCorrection() }];
  }

  const chars = Array.from(source);
  const shaped = [];
  chars.forEach((char, index) => {
    const correction = getCorrection(chars, index);
    const previous = shaped.at(-1);
    if (
      previous
      && previous.dx === correction.dx
      && previous.dy === correction.dy
    ) {
      previous.text += char;
      return;
    }
    shaped.push({ text: char, ...correction });
  });
  return shaped;
}
