import { describe, it, expect } from 'vitest';

import { computeVisibleRowRange, computeRowOffsetY } from '../virtualRows.js';

/* ============================================================
 * この関数が満たすべき契約
 * ------------------------------------------------------------
 * computeVisibleRowRange({
 *   scrollY, viewportHeight, canvasTop, rowPitch, rowCount, overscanPx,
 * }) -> { startRow, endRow }   // endRow は含まない端（half-open）
 *
 *   - 0 <= startRow <= endRow <= rowCount が常に成り立つ。
 *     startRow / endRow は必ず有限の整数（NaN / Infinity / 小数を返さない）。
 *   - rowCount が 0・負・非整数・非有限・数値でない → 空の範囲（0, 0）。
 *   - scrollY が負（iOS のラバーバンド）→ 0 として扱う。
 *   - scrollY / canvasTop が非有限・数値でない → 0 として扱う。
 *   - rowPitch が 0・負・非有限・数値でない → 全域（0 〜 rowCount）。
 *   - viewportHeight が 0以下・非有限・数値でない → 全域（0 〜 rowCount）。
 *   - overscanPx が負・非有限・数値でない → 0 として扱う。
 *   - 可視帯 [scrollY - overscanPx, scrollY + viewportHeight + overscanPx) と
 *     少しでも重なる行は必ず範囲に含まれる（行を飛ばさない）。
 *   - 返る件数は (viewportHeight + 2 * overscanPx) / rowPitch 程度に収まる。
 *     **入力が巨大でも出力が巨大にならないことが防御の要点である（信頼境界）。**
 *   - 副作用を持たない。引数オブジェクトを書き換えない。同じ入力なら同じ結果。
 *
 * computeRowOffsetY({ rowIndex, canvasTop, rowPitch }) -> number
 *   - 行の文書内 Y 座標（その行の上端）を返す。正常時は
 *     canvasTop + rowIndex * rowPitch。
 *   - 返り値は必ず有限の数（NaN / Infinity を返さない）。
 *   - canvasTop / rowPitch / rowIndex が非有限・数値でない場合も
 *     防御的に正規化する（layout.js の normalizePositiveInt と同じ流儀）。
 *   - rowIndex について単調非減少。
 *   - computeVisibleRowRange との整合：ある行の Y 座標へスクロールしたとき、
 *     その行は必ず可視範囲に含まれる。
 *
 * ------------------------------------------------------------
 * このファイルについての注意
 * ------------------------------------------------------------
 * ・このファイルは仕様そのものである。1行も書き換えないこと。
 *   実装と食い違った場合はテストを直さず報告して止まること。
 * ・「極端に小さい rowPitch のときに返る件数を抑えること」（下記 E-06）は
 *   素直な算術（endRow = ceil(bandBottom / rowPitch)）では満たせない。
 *   「行間隔が極端に小さくても、返る行数が画面に収まる程度に留まること」を
 *   防御の要点として優先し、契約に加えてある。
 * ============================================================ */

/** 実測に近い既定値。デスクトップの行ピッチ概算は 260px（contain-intrinsic-size） */
const VP = 800;
const PITCH = 260;
const TOP = 120;

/** MAX_GRIDS = 3000 を 4列で並べたときの行数 */
const ROWS_3000 = 750;

const args = (over = {}) => ({
  scrollY: 0,
  viewportHeight: VP,
  canvasTop: TOP,
  rowPitch: PITCH,
  rowCount: ROWS_3000,
  overscanPx: 0,
  ...over,
});

/**
 * 戻り値の形と不変条件。maxRowCount は「正規化後に期待される行数の上限」。
 * 異常な rowCount を渡した場合は 0 を渡す。
 */
function expectRangeInvariants(range, maxRowCount) {
  expect(range).toBeTypeOf('object');
  expect(range).not.toBeNull();
  const { startRow, endRow } = range;
  expect(Number.isInteger(startRow)).toBe(true);
  expect(Number.isInteger(endRow)).toBe(true);
  expect(startRow).toBeGreaterThanOrEqual(0);
  expect(endRow).toBeGreaterThanOrEqual(startRow);
  expect(endRow).toBeLessThanOrEqual(maxRowCount);
}

/**
 * 可視帯と重なる行がすべて範囲に含まれているか（行を飛ばしていないか）。
 * rowCount が大きい入力では使わないこと（全行を走査するため）。
 */
function expectCoversViewport(input, range) {
  const { scrollY, viewportHeight, canvasTop, rowPitch, rowCount } = input;
  const overscanPx = input.overscanPx ?? 0;
  const bandTop = scrollY - overscanPx;
  const bandBottom = scrollY + viewportHeight + overscanPx;

  for (let i = 0; i < rowCount; i += 1) {
    const rowTop = canvasTop + i * rowPitch;
    const rowBottom = rowTop + rowPitch;
    // 半開区間同士の交差。接するだけ（rowBottom === bandTop）は交差ではない。
    if (rowBottom > bandTop && rowTop < bandBottom) {
      expect(i).toBeGreaterThanOrEqual(range.startRow);
      expect(i).toBeLessThan(range.endRow);
    }
  }
}

/**
 * 返る件数が画面ぶんに収まっているか。
 * 端の丸めで前後1行ずつ余分に含まれることは許容する（slack）。
 * 「ちょうどの境界で startRow が 1 か 2 か」は仕様から一意に決まらないため、
 * 厳密な一致ではなくこの緩みで検証している。
 */
function expectRangeIsTight(input, range, slack = 2) {
  const overscanPx = input.overscanPx ?? 0;
  const ideal = (input.viewportHeight + 2 * overscanPx) / input.rowPitch;
  expect(range.endRow - range.startRow).toBeLessThanOrEqual(Math.ceil(ideal) + slack);
}

/* ============================================================
 * computeVisibleRowRange：正常系
 * ============================================================ */

describe('computeVisibleRowRange 正常系', () => {
  it('先頭では 0 行目から始まり、画面ぶんの行だけを返す', () => {
    const input = args();
    const range = computeVisibleRowRange(input);

    expectRangeInvariants(range, ROWS_3000);
    expect(range.startRow).toBe(0);
    expectCoversViewport(input, range);
    expectRangeIsTight(input, range);
  });

  it('スクロールすると範囲が下へ移動し、件数は増えない', () => {
    const input = args({ scrollY: 5000 });
    const range = computeVisibleRowRange(input);

    expectRangeInvariants(range, ROWS_3000);
    expect(range.startRow).toBeGreaterThan(0);
    expectCoversViewport(input, range);
    expectRangeIsTight(input, range);
  });

  it('overscanPx のぶんだけ範囲が上下に広がる', () => {
    const withoutOverscan = computeVisibleRowRange(args({ scrollY: 5000 }));
    const input = args({ scrollY: 5000, overscanPx: VP });
    const withOverscan = computeVisibleRowRange(input);

    expectRangeInvariants(withOverscan, ROWS_3000);
    expect(withOverscan.startRow).toBeLessThanOrEqual(withoutOverscan.startRow);
    expect(withOverscan.endRow).toBeGreaterThanOrEqual(withoutOverscan.endRow);
    expectCoversViewport(input, withOverscan);
    expectRangeIsTight(input, withOverscan);
  });

  it('末尾までスクロールしても endRow は rowCount を超えない', () => {
    const input = args({ scrollY: TOP + ROWS_3000 * PITCH + 10000, overscanPx: VP });
    const range = computeVisibleRowRange(input);

    expectRangeInvariants(range, ROWS_3000);
    expect(range.endRow).toBe(ROWS_3000);
  });

  it('一覧が画面より下にあるとき（canvasTop が大きい）空の範囲になる', () => {
    const range = computeVisibleRowRange(args({ canvasTop: 100000 }));
    expectRangeInvariants(range, ROWS_3000);
    expect(range.endRow - range.startRow).toBe(0);
  });
});

/* ============================================================
 * computeVisibleRowRange：出力の爆発（防御の要点）
 * ============================================================ */

describe('computeVisibleRowRange 出力が入力に比例して爆発しないこと', () => {
  it('E-01. rowCount が 3000グリッド相当（750行）でも返る件数は画面ぶんに収まる', () => {
    const input = args({ scrollY: 40000, overscanPx: VP });
    const range = computeVisibleRowRange(input);

    expectRangeInvariants(range, ROWS_3000);
    expectRangeIsTight(input, range);
    expect(range.endRow - range.startRow).toBeLessThan(30);
  });

  it('E-02. rowCount が桁違いに巨大（1e9・MAX_SAFE_INTEGER）でも件数は画面ぶんに収まる', () => {
    for (const rowCount of [1e6, 1e9, Number.MAX_SAFE_INTEGER]) {
      const input = args({ rowCount, scrollY: 1000, overscanPx: VP });
      const range = computeVisibleRowRange(input);

      expectRangeInvariants(range, rowCount);
      expectRangeIsTight(input, range);
    }
  }, 2000);

  it('E-03. viewportHeight が巨大でも rowCount を超えない', () => {
    const input = args({ viewportHeight: 1e12 });
    const range = computeVisibleRowRange(input);

    expectRangeInvariants(range, ROWS_3000);
    expect(range.endRow).toBeLessThanOrEqual(ROWS_3000);
  });

  it('E-04. overscanPx が巨大でも rowCount を超えない', () => {
    const input = args({ overscanPx: 1e12, scrollY: 5000 });
    const range = computeVisibleRowRange(input);

    expectRangeInvariants(range, ROWS_3000);
  });

  it('E-05. scrollY / canvasTop が桁あふれを起こす大きさでも整数を返す', () => {
    // 内部の引き算・足し算が Infinity や NaN を生んでも、
    // それがそのまま startRow / endRow に出てはならない。
    const cases = [
      { scrollY: 1e308, canvasTop: -1e308 },
      { scrollY: 1e308, canvasTop: 1e308 },
      { scrollY: Number.MAX_VALUE, canvasTop: -Number.MAX_VALUE, viewportHeight: Number.MAX_VALUE },
      { scrollY: Number.MAX_SAFE_INTEGER, canvasTop: -Number.MAX_SAFE_INTEGER },
    ];
    for (const over of cases) {
      const range = computeVisibleRowRange(args({ ...over, overscanPx: 1e308 }));
      expectRangeInvariants(range, ROWS_3000);
    }
  });

  it('E-06. rowPitch が極端に小さくても、返る件数が描画不能な規模にならない', () => {
    // 素直な算術（endRow = ceil(bandBottom / rowPitch)）をそのまま実装すると
    // rowPitch が微小なとき endRow が rowCount まで伸び、全行を描くことになる。
    // 「行間隔が極端に小さくても返る行数が画面に収まる程度に留まること」は
    // 防御の要点として定めた性質であるため、下限クランプが必要になる。
    for (const rowPitch of [1e-9, 1e-300, Number.MIN_VALUE, 0.0001]) {
      const range = computeVisibleRowRange(
        args({ rowPitch, rowCount: 1e9, viewportHeight: VP, overscanPx: VP })
      );
      expectRangeInvariants(range, 1e9);
      expect(range.endRow - range.startRow).toBeLessThanOrEqual(4000);
    }
  }, 2000);

  it('E-07. 巨大な入力の組み合わせでも現実的な時間で返る（ループを回していないこと）', () => {
    const start = performance.now();
    for (let i = 0; i < 2000; i += 1) {
      computeVisibleRowRange(
        args({ rowCount: Number.MAX_SAFE_INTEGER, scrollY: i * 1e6, overscanPx: VP })
      );
    }
    expect(performance.now() - start).toBeLessThan(500);
  }, 5000);
});

/* ============================================================
 * computeVisibleRowRange：異常な rowCount
 * ============================================================ */

describe('computeVisibleRowRange rowCount の異常値', () => {
  it.each([0, -1, -1000, 2.5, 0.5, NaN, Infinity, -Infinity, null, undefined, {}, [], 'abc', true])(
    'R-01. rowCount が %p のとき空の範囲を返す',
    (rowCount) => {
      const range = computeVisibleRowRange(args({ rowCount }));
      expect(range.startRow).toBe(0);
      expect(range.endRow).toBe(0);
    }
  );

  it('R-02. rowCount が異常なら rowPitch / viewportHeight も異常でも空のまま', () => {
    // 「rowPitch 異常 → 全域」と「rowCount 異常 → 空」が衝突する組み合わせ。
    // 全域 = 0〜rowCount = 0〜0 なので、どちらの規則でも空に収束する。
    for (const rowCount of [0, -5, NaN, undefined, {}]) {
      for (const rowPitch of [0, -1, NaN, undefined]) {
        const range = computeVisibleRowRange(args({ rowCount, rowPitch }));
        expect(range.startRow).toBe(0);
        expect(range.endRow).toBe(0);
      }
    }
  });

  it('R-03. rowCount が 1 のとき、先頭では 0〜1 を返す', () => {
    const range = computeVisibleRowRange(args({ rowCount: 1 }));
    expect(range.startRow).toBe(0);
    expect(range.endRow).toBe(1);
  });
});

/* ============================================================
 * computeVisibleRowRange：全域フォールバック
 * ============================================================ */

describe('computeVisibleRowRange 全域フォールバック', () => {
  it.each([0, -0, -1, -1e9, NaN, Infinity, -Infinity, null, undefined, {}, [], 'abc', true])(
    'F-01. rowPitch が %p のとき全域（0〜rowCount）を返す',
    (rowPitch) => {
      const range = computeVisibleRowRange(args({ rowPitch, scrollY: 99999 }));
      expect(range.startRow).toBe(0);
      expect(range.endRow).toBe(ROWS_3000);
    }
  );

  it.each([0, -0, -1, -1e9, NaN, Infinity, -Infinity, null, undefined, {}, [], 'abc', true])(
    'F-02. viewportHeight が %p のとき全域（0〜rowCount）を返す',
    (viewportHeight) => {
      const range = computeVisibleRowRange(args({ viewportHeight, scrollY: 99999 }));
      expect(range.startRow).toBe(0);
      expect(range.endRow).toBe(ROWS_3000);
    }
  );

  it('F-03. 全域フォールバックでも rowCount を超えない', () => {
    const range = computeVisibleRowRange(args({ viewportHeight: NaN, rowPitch: NaN }));
    expectRangeInvariants(range, ROWS_3000);
    expect(range.endRow).toBe(ROWS_3000);
  });
});

/* ============================================================
 * computeVisibleRowRange：scrollY / canvasTop / overscanPx の異常値
 * ============================================================ */

describe('computeVisibleRowRange scrollY・canvasTop・overscanPx の異常値', () => {
  it('S-01. scrollY が負（iOS のラバーバンド）でも先頭からの範囲を返す', () => {
    for (const scrollY of [-1, -300, -100000]) {
      const zero = computeVisibleRowRange(args({ scrollY: 0 }));
      const range = computeVisibleRowRange(args({ scrollY }));
      expectRangeInvariants(range, ROWS_3000);
      // 負のスクロールは 0 として扱われるため、scrollY = 0 と同じ結果になる。
      expect(range).toEqual(zero);
    }
  });

  it('S-02. scrollY が -0 でも 0 と同じ結果になる', () => {
    expect(computeVisibleRowRange(args({ scrollY: -0 }))).toEqual(
      computeVisibleRowRange(args({ scrollY: 0 }))
    );
  });

  it.each([NaN, Infinity, -Infinity, null, undefined, {}, [], 'abc', true])(
    'S-03. scrollY が %p のとき 0 として扱う',
    (scrollY) => {
      const range = computeVisibleRowRange(args({ scrollY }));
      expectRangeInvariants(range, ROWS_3000);
      expect(range).toEqual(computeVisibleRowRange(args({ scrollY: 0 })));
    }
  );

  it.each([NaN, Infinity, -Infinity, null, undefined, {}, [], 'abc', true])(
    'S-04. canvasTop が %p のとき 0 として扱う',
    (canvasTop) => {
      const range = computeVisibleRowRange(args({ canvasTop, scrollY: 3000 }));
      expectRangeInvariants(range, ROWS_3000);
      expect(range).toEqual(computeVisibleRowRange(args({ canvasTop: 0, scrollY: 3000 })));
    }
  );

  it('S-05. canvasTop が負（--ring-space の負マージン）でも行を飛ばさない', () => {
    const input = args({ canvasTop: -37.5, scrollY: 2000, rowCount: 60 });
    const range = computeVisibleRowRange(input);
    expectRangeInvariants(range, 60);
    expectCoversViewport(input, range);
    expectRangeIsTight(input, range);
  });

  it.each([-1, -1e9, NaN, Infinity, -Infinity, null, undefined, {}, [], 'abc', true])(
    'S-06. overscanPx が %p のとき 0 として扱う',
    (overscanPx) => {
      const range = computeVisibleRowRange(args({ overscanPx, scrollY: 3000 }));
      expectRangeInvariants(range, ROWS_3000);
      expect(range).toEqual(computeVisibleRowRange(args({ overscanPx: 0, scrollY: 3000 })));
    }
  );

  it('O-01. 数値に見える文字列・1要素配列は、どちらに解釈されても不変条件を破らない', () => {
    // 仕様は「数値でない値」とだけ定めており、layout.js の
    // normalizePositiveInt は Number() で強制変換する流儀である。
    // '260' を 260 と読むか無効値と読むかは一意に決まらないため、
    // ここでは不変条件だけを検証する。
    for (const value of ['260', ' 260 ', [260], '0x10', '1e3']) {
      const range = computeVisibleRowRange(
        args({ rowPitch: value, scrollY: 3000, overscanPx: value })
      );
      expectRangeInvariants(range, ROWS_3000);
    }
  });

  it('O-02. 引数オブジェクトが無い・空でも不変条件を破らない（例外は許容）', () => {
    for (const bad of [undefined, {}, null, 0, 'x', []]) {
      let range;
      try {
        range = computeVisibleRowRange(bad);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        continue;
      }
      expectRangeInvariants(range, 0);
    }
  });

  it('O-03. Symbol のような変換不能な値でも、壊れた範囲を返さない（例外は許容）', () => {
    for (const key of ['scrollY', 'rowPitch', 'rowCount', 'viewportHeight', 'overscanPx']) {
      let range;
      try {
        range = computeVisibleRowRange(args({ [key]: Symbol('x') }));
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        continue;
      }
      expectRangeInvariants(range, ROWS_3000);
    }
  });

  it('O-04. 呼ぶたびに違う値を返す valueOf を渡しても不変条件を破らない', () => {
    // 同じフィールドを2回以上読んで別々に正規化していると、
    // startRow > endRow のような壊れた範囲を作れてしまう。
    let n = 0;
    const flaky = { valueOf: () => (n++ % 2 === 0 ? 1e9 : 0) };
    for (let i = 0; i < 8; i += 1) {
      const range = computeVisibleRowRange(args({ scrollY: flaky, overscanPx: flaky }));
      expectRangeInvariants(range, ROWS_3000);
    }
  });
});

/* ============================================================
 * computeVisibleRowRange：境界・単調性・浮動小数
 * ============================================================ */

describe('computeVisibleRowRange 境界と単調性', () => {
  it('B-01. 行境界のちょうど手前・ちょうど・1px 先で、可視の行を落とさない', () => {
    const base = args({ overscanPx: 0, rowCount: 40, canvasTop: 0 });
    const boundary = 2 * PITCH; // 2行目の上端
    for (const delta of [-1, 0, 1]) {
      const input = { ...base, scrollY: boundary + delta };
      const range = computeVisibleRowRange(input);
      expectRangeInvariants(range, 40);
      expectCoversViewport(input, range);
      expectRangeIsTight(input, range);
    }
  });

  it('B-02. 画面上端がちょうど行の上端のとき、その1つ前の行は含まれない（半開区間）', () => {
    const input = args({ overscanPx: 0, rowCount: 40, canvasTop: 0, scrollY: 2 * PITCH });
    const range = computeVisibleRowRange(input);
    // 行1 は [PITCH, 2*PITCH) を占め、画面（[2*PITCH, ...)）とは接するだけ。
    // 端の丸めで1行余分に含めることは許容するが、2行以上は許容しない。
    expect(range.startRow).toBeGreaterThanOrEqual(1);
    expectCoversViewport(input, range);
  });

  it('B-03. 画面下端がちょうど行の上端のとき、その行は含まれない（半開区間）', () => {
    const input = args({
      overscanPx: 0,
      rowCount: 40,
      canvasTop: 0,
      viewportHeight: 3 * PITCH,
      scrollY: 0,
    });
    const range = computeVisibleRowRange(input);
    // 見えるのは行0〜2。行3 は上端がちょうど画面下端に接するだけ。
    expect(range.endRow).toBeGreaterThanOrEqual(3);
    expect(range.endRow).toBeLessThanOrEqual(4);
    expectCoversViewport(input, range);
  });

  it('B-04. 1px 進めるだけでは範囲が戻らない（単調非減少）', () => {
    let prev = null;
    for (let scrollY = 0; scrollY <= 4000; scrollY += 1) {
      const range = computeVisibleRowRange(args({ scrollY, overscanPx: 300 }));
      if (prev) {
        expect(range.startRow).toBeGreaterThanOrEqual(prev.startRow);
        expect(range.endRow).toBeGreaterThanOrEqual(prev.endRow);
      }
      prev = range;
    }
  }, 5000);

  it('B-05. 端数のある rowPitch でも、連続する画面のあいだに隙間ができない', () => {
    // 実測値は整数とは限らない（gap に rem 由来の小数が入る）。
    // 画面を1つぶんずつ送ったとき、前の endRow より後ろから次が始まっては
    // ならない（その間の行が一度も描かれない＝空白になる）。
    const rowPitch = 137.73333333333333;
    const canvasTop = -13.3;
    const rowCount = 400;
    let prev = null;
    for (let scrollY = 0; scrollY < rowCount * rowPitch; scrollY += VP) {
      const input = { ...args(), scrollY, rowPitch, canvasTop, rowCount };
      const range = computeVisibleRowRange(input);
      expectRangeInvariants(range, rowCount);
      expectCoversViewport(input, range);
      if (prev) expect(range.startRow).toBeLessThanOrEqual(prev.endRow);
      prev = range;
    }
  }, 5000);

  it('B-06. 1行ずつ送っても、どの行も必ずどこかの範囲に現れる（飛ばされない）', () => {
    const rowPitch = 259.9999999999999;
    const rowCount = 300;
    const seen = new Set();
    for (let i = 0; i < rowCount; i += 1) {
      const input = { ...args(), scrollY: TOP + i * rowPitch, rowPitch, rowCount, overscanPx: 0 };
      const range = computeVisibleRowRange(input);
      for (let r = range.startRow; r < range.endRow; r += 1) seen.add(r);
    }
    for (let i = 0; i < rowCount; i += 1) expect(seen.has(i)).toBe(true);
  }, 5000);

  it('B-07. 同じ入力に対して常に同じ結果を返す（副作用がない）', () => {
    const input = args({ scrollY: 4321, overscanPx: 200 });
    const first = computeVisibleRowRange(input);
    for (let i = 0; i < 5; i += 1) {
      expect(computeVisibleRowRange(input)).toEqual(first);
    }
  });

  it('B-08. 引数オブジェクトを書き換えない（凍結した入力でも動く）', () => {
    const input = Object.freeze(args({ scrollY: 1234, overscanPx: 300 }));
    const snapshot = { ...input };
    const range = computeVisibleRowRange(input);
    expectRangeInvariants(range, ROWS_3000);
    expect({ ...input }).toEqual(snapshot);
  });
});

/* ============================================================
 * computeRowOffsetY
 * ============================================================ */

describe('computeRowOffsetY', () => {
  it('Y-01. 正常時は canvasTop + rowIndex * rowPitch を返す', () => {
    expect(computeRowOffsetY({ rowIndex: 0, canvasTop: TOP, rowPitch: PITCH })).toBe(TOP);
    expect(computeRowOffsetY({ rowIndex: 3, canvasTop: TOP, rowPitch: PITCH })).toBe(
      TOP + 3 * PITCH
    );
  });

  it('Y-02. rowIndex について単調非減少', () => {
    let prev = -Infinity;
    for (let i = 0; i < 200; i += 1) {
      const y = computeRowOffsetY({ rowIndex: i, canvasTop: -13.3, rowPitch: 137.7333 });
      expect(y).toBeGreaterThanOrEqual(prev);
      prev = y;
    }
  });

  it.each([NaN, Infinity, -Infinity, null, undefined, {}, [], 'abc', true, -1, -1e9, 2.5])(
    'Y-03. rowIndex が %p でも有限の数を返す',
    (rowIndex) => {
      const y = computeRowOffsetY({ rowIndex, canvasTop: TOP, rowPitch: PITCH });
      expect(Number.isFinite(y)).toBe(true);
    }
  );

  it.each([NaN, Infinity, -Infinity, null, undefined, {}, [], 'abc', true])(
    'Y-04. canvasTop / rowPitch が %p でも有限の数を返す',
    (bad) => {
      expect(Number.isFinite(computeRowOffsetY({ rowIndex: 5, canvasTop: bad, rowPitch: PITCH })))
        .toBe(true);
      expect(Number.isFinite(computeRowOffsetY({ rowIndex: 5, canvasTop: TOP, rowPitch: bad })))
        .toBe(true);
    }
  );

  it('Y-05. 巨大な rowIndex・rowPitch でも Infinity を返さない', () => {
    for (const rowIndex of [1e9, Number.MAX_SAFE_INTEGER, 1e308]) {
      for (const rowPitch of [PITCH, 1e308]) {
        const y = computeRowOffsetY({ rowIndex, canvasTop: 1e308, rowPitch });
        expect(Number.isFinite(y)).toBe(true);
      }
    }
  });

  it('Y-06. 引数オブジェクトが無い場合も有限の数を返すか例外を投げる', () => {
    for (const bad of [undefined, null, {}, 0, 'x']) {
      let y;
      try {
        y = computeRowOffsetY(bad);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        continue;
      }
      expect(Number.isFinite(y)).toBe(true);
    }
  });

  it('Y-07. 同じ入力に対して常に同じ結果を返し、引数を書き換えない', () => {
    const input = Object.freeze({ rowIndex: 7, canvasTop: TOP, rowPitch: PITCH });
    const snapshot = { ...input };
    const first = computeRowOffsetY(input);
    expect(computeRowOffsetY(input)).toBe(first);
    expect({ ...input }).toEqual(snapshot);
  });
});

/* ============================================================
 * 2つの関数の整合
 * ============================================================ */

describe('computeRowOffsetY と computeVisibleRowRange の整合', () => {
  it('C-01. ある行の Y 座標へスクロールすると、その行は必ず可視範囲に入る', () => {
    const rowCount = ROWS_3000;
    for (const canvasTop of [0, TOP, -37.5]) {
      for (const rowPitch of [PITCH, 110, 137.73333333333333]) {
        for (const rowIndex of [0, 1, 2, 17, 100, 374, rowCount - 2, rowCount - 1]) {
          const scrollY = computeRowOffsetY({ rowIndex, canvasTop, rowPitch });
          const range = computeVisibleRowRange({
            scrollY,
            viewportHeight: VP,
            canvasTop,
            rowPitch,
            rowCount,
            overscanPx: 0,
          });
          expect(range.startRow).toBeLessThanOrEqual(rowIndex);
          expect(range.endRow).toBeGreaterThan(rowIndex);
        }
      }
    }
  }, 5000);

  it('C-02. 行が画面下端に来る位置へスクロールしても、その行は可視範囲に入る', () => {
    const rowCount = 400;
    const rowPitch = 137.73333333333333;
    const canvasTop = -13.3;
    for (const rowIndex of [5, 50, 399]) {
      const y = computeRowOffsetY({ rowIndex, canvasTop, rowPitch });
      const scrollY = y - VP + rowPitch;
      const range = computeVisibleRowRange({
        scrollY,
        viewportHeight: VP,
        canvasTop,
        rowPitch,
        rowCount,
        overscanPx: 0,
      });
      expect(range.startRow).toBeLessThanOrEqual(rowIndex);
      expect(range.endRow).toBeGreaterThan(rowIndex);
    }
  });

  it('C-03. 異常な rowPitch でも、両者を組み合わせて壊れた結果にならない', () => {
    for (const rowPitch of [0, -1, NaN, undefined, 'x']) {
      const scrollY = computeRowOffsetY({ rowIndex: 10, canvasTop: TOP, rowPitch });
      expect(Number.isFinite(scrollY)).toBe(true);
      const range = computeVisibleRowRange({
        scrollY,
        viewportHeight: VP,
        canvasTop: TOP,
        rowPitch,
        rowCount: ROWS_3000,
        overscanPx: 0,
      });
      // rowPitch が異常なときは全域を返す契約なので、10行目は必ず含まれる。
      expectRangeInvariants(range, ROWS_3000);
      expect(range.startRow).toBe(0);
      expect(range.endRow).toBe(ROWS_3000);
    }
  });
});
