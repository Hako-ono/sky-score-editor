import { describe, it, expect } from 'vitest';

import {
  splitIntoRows,
  paginateRows,
  columnsForBits,
  resolveColumnsPerPage,
} from '../layout.js';

/* ============================================================
 * この関数が満たすべき契約
 * ------------------------------------------------------------
 * splitIntoRows(grids, columns) -> Array<Array<{ grid, index }>>
 *   - grids は配列（forEach を持つ値）である必要がある。
 *     それ以外（null/undefined/文字列/数値/プレーンオブジェクト）は Error を投げる。
 *   - 各行の要素は生の grid ではなく { grid, index } でラップされる。
 *     index は grids 配列内での元の位置（0始まり）。
 *   - 行は必ず1要素以上を持つ（空行を生成してはならない）。
 *   - 行が終わる条件: current.length が columns 以上になったとき、
 *     または grid.forceBreakAfter が厳密に true のときのみ
 *     （'false' や {} のような truthy 値では改行してはならない。信頼境界）。
 *   - columns が 0 以下・非有限・数値変換不能な値でも無限ループしない。
 *     そのような値は grids.length（0 なら 1）へフォールバックし、
 *     小数は切り捨てて使う。
 *   - grids の要素が null/undefined など forceBreakAfter を参照できない
 *     値だと Error を投げる（不正な要素を暗黙に無視してはならない）。
 *
 * paginateRows(rows, maxRows) -> Array<Array<row>>
 *   - rows を maxRows 行ずつのページへ分割する。
 *   - maxRows が 0 以下・非有限・数値変換不能な値でも無限ループ・
 *     メモリ枯渇を起こさない。そのような値は rows.length（0 なら 1）へ
 *     フォールバックし、小数は切り捨てて使う。
 *   - 空ページを生成してはならない。
 *   - rows 自体の中身は一切変換されない（スライスするだけ）。
 * ============================================================ */

const g = (i, forceBreakAfter = false) => ({
  type: 'note',
  keys: [i % 15],
  text: `g${i}`,
  forceBreakAfter,
});

const makeGrids = (n) => Array.from({ length: n }, (_, i) => g(i));

/** splitIntoRows の出力から元の grid だけを順序保存で取り出す */
const unwrapGrids = (rows) => rows.flat().map((item) => item.grid);

/** splitIntoRows: 元の配列の順序・個数・要素が保存されているか */
function expectSplitPreservesOrder(inputGrids, rows) {
  const flat = unwrapGrids(rows);
  expect(flat).toHaveLength(inputGrids.length);
  expect(flat.map((x) => x && x.text)).toEqual(inputGrids.map((x) => x && x.text));
}

/** splitIntoRows: index フィールドが元の配列位置と一致しているか */
function expectIndicesMatchPosition(inputGrids, rows) {
  const flatItems = rows.flat();
  expect(flatItems.map((item) => item.index)).toEqual(inputGrids.map((_, i) => i));
}

/** paginateRows: 行配列の順序・個数が保存されているか（rows は不透明に扱われる） */
function expectPaginatePreservesOrder(inputRows, pages) {
  expect(pages.flat()).toEqual(inputRows);
}

function expectNoEmptyGroups(groups) {
  for (const grp of groups) {
    expect(Array.isArray(grp)).toBe(true);
    expect(grp.length).toBeGreaterThan(0);
  }
}

/* ============================================================
 * splitIntoRows：正常系
 * ============================================================ */

describe('splitIntoRows 正常系', () => {
  it('columns ごとに等分され、順序・個数・index が保存される', () => {
    const grids = makeGrids(35);
    const rows = splitIntoRows(grids, 16);

    expect(Array.isArray(rows)).toBe(true);
    expectNoEmptyGroups(rows);
    expectSplitPreservesOrder(grids, rows);
    expectIndicesMatchPosition(grids, rows);
    for (const row of rows) expect(row.length).toBeLessThanOrEqual(16);
    expect(rows[0]).toHaveLength(16);
  });

  it('forceBreakAfter は行を強制的に終わらせる', () => {
    const grids = [g(0), g(1), g(2, true), g(3), g(4)];
    const rows = splitIntoRows(grids, 16);

    expectSplitPreservesOrder(grids, rows);
    expect(rows[0].map((item) => item.grid.text)).toEqual(['g0', 'g1', 'g2']);
    expect(rows[1].map((item) => item.grid.text)).toEqual(['g3', 'g4']);
  });
});

/* ============================================================
 * splitIntoRows：異常系・敵対的入力
 * ============================================================ */

describe('splitIntoRows 異常系', () => {
  it('01. 空配列は空の結果を返し、例外を投げない', () => {
    const rows = splitIntoRows([], 16);
    expect(rows).toEqual([]);
  });

  it('02. columns が 0・負数でも無限ループしない（比較演算のみのため縮退分割になる）', () => {
    for (const columns of [0, -1, -1000]) {
      const grids = makeGrids(10);
      const rows = splitIntoRows(grids, columns);
      expect(Array.isArray(rows)).toBe(true);
      expectNoEmptyGroups(rows);
      expectSplitPreservesOrder(grids, rows);
    }
  }, 2000);

  it('03. columns が NaN / Infinity / 小数 / 文字列 / undefined でも破綻しない', () => {
    for (const columns of [NaN, Infinity, -Infinity, 2.5, '16', null, undefined, {}]) {
      const grids = makeGrids(10);
      const rows = splitIntoRows(grids, columns);
      expect(Array.isArray(rows)).toBe(true);
      expectNoEmptyGroups(rows);
      expectSplitPreservesOrder(grids, rows);
    }
  }, 2000);

  it('04. columns が 1 でも 1件ずつの行になり、要素は失われない', () => {
    const grids = makeGrids(5);
    const rows = splitIntoRows(grids, 1);
    expectSplitPreservesOrder(grids, rows);
    for (const row of rows) expect(row.length).toBeLessThanOrEqual(1);
  });

  it('05. 全件 forceBreakAfter でも空行を作らない', () => {
    const grids = Array.from({ length: 10 }, (_, i) => g(i, true));
    const rows = splitIntoRows(grids, 16);
    expectNoEmptyGroups(rows);
    expect(rows).toHaveLength(10);
    expectSplitPreservesOrder(grids, rows);
  });

  it('06. 最後の要素の forceBreakAfter が末尾に空行を生まない', () => {
    const grids = [g(0), g(1, true)];
    const rows = splitIntoRows(grids, 16);
    expectNoEmptyGroups(rows);
    expect(rows).toHaveLength(1);
  });

  it('07. 境界ちょうど（columns の倍数）で余分な空行を作らない', () => {
    for (const columns of [4, 12, 16]) {
      const grids = makeGrids(columns * 3);
      const rows = splitIntoRows(grids, columns);
      expect(rows).toHaveLength(3);
      expectNoEmptyGroups(rows);
    }
  });

  it('08. forceBreakAfter が行の境界と重なっても要素を落とさない', () => {
    const grids = makeGrids(16).map((x, i) => (i === 15 ? { ...x, forceBreakAfter: true } : x));
    grids.push(g(16));
    const rows = splitIntoRows(grids, 16);
    expectNoEmptyGroups(rows);
    expectSplitPreservesOrder(grids, rows);
  });

  it('09. forceBreakAfter が非boolean値のとき改行として扱わない', () => {
    const grids = [
      { forceBreakAfter: 'false' }, // 文字列 'false' も truthy
      { forceBreakAfter: 1 },
      { forceBreakAfter: {} },
      { forceBreakAfter: null },
      { forceBreakAfter: undefined },
      { forceBreakAfter: [] }, // 空配列も truthy
    ];

    // columns を grids.length より大きくし、
    // 「columns 個に達したことによる改行」を発生させないようにする。
    // これにより、行が複数に分かれるとすれば
    // forceBreakAfter が原因であることが一意に特定できる。
    const columns = grids.length + 4;

    const rows = splitIntoRows(grids, columns);

    // 非boolean値はどれも改行として扱われてはならないため、
    // 全グリッドが1行にまとまるはずである。
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(grids.length);

    rows[0].forEach((cell, i) => {
      expect(cell.grid).toBe(grids[i]);
      expect(cell.index).toBe(i);
    });
  });

  it('10. grids が配列（forEach を持つ値）でない場合、TypeError 相当の Error を投げる', () => {
    for (const bad of [null, undefined, 'abcdef', 0, {}, { length: 3 }]) {
      expect(() => splitIntoRows(bad, 16)).toThrow(Error);
    }
  });

  it('11. 要素に null / undefined が混ざると Error を投げる（プリミティブは通る）', () => {
    // null.forceBreakAfter / undefined.forceBreakAfter は TypeError。
    // 一方、数値や文字列のプリミティブはプロパティアクセスしても例外にならず
    // undefined を返すだけなので、そこは通過する。
    // ここでは「暗黙に壊れたデータを返すのではなく、きちんと Error として
    // 表面化すること」を検証する。
    const grids = [g(0), null, undefined, 42, 'x', g(1)];
    expect(() => splitIntoRows(grids, 16)).toThrow(Error);
  });

  it('11b. プリミティブ（数値・文字列）だけが混ざる場合は例外にならず処理できる', () => {
    const grids = [g(0), 42, 'x', g(1)];
    const rows = splitIntoRows(grids, 16);
    expect(Array.isArray(rows)).toBe(true);
    // プリミティブ要素も { grid, index } としてそのままラップされる
    const flat = rows.flat();
    expect(flat).toHaveLength(4);
    expect(flat[1].grid).toBe(42);
    expect(flat[2].grid).toBe('x');
  });

  it('12. 上限の 3000 グリッドを現実的な時間で処理できる', () => {
    const grids = makeGrids(3000);
    const start = performance.now();
    const rows = splitIntoRows(grids, 16);
    expect(performance.now() - start).toBeLessThan(500);
    expectSplitPreservesOrder(grids, rows);
  }, 5000);

  it('13. 入力配列・要素を破壊的に変更しない', () => {
    const grids = makeGrids(20);
    const snapshot = JSON.parse(JSON.stringify(grids));
    splitIntoRows(grids, 12);
    expect(grids).toEqual(snapshot);
  });

  it('14. 同じ入力に対して結果が安定している（深い等価性で比較）', () => {
    const grids = [g(0), g(1, true), ...makeGrids(30)];
    expect(splitIntoRows(grids, 12)).toEqual(splitIntoRows(grids, 12));
  });
});

/* ============================================================
 * paginateRows
 * ============================================================ */

describe('paginateRows 正常系', () => {
  it('maxRows ごとに分割され、行の順序と個数が保存される', () => {
    const rows = Array.from({ length: 7 }, (_, i) => [g(i)]);
    const pages = paginateRows(rows, 3);

    expectNoEmptyGroups(pages);
    expect(pages).toHaveLength(3);
    expect(pages[0]).toHaveLength(3);
    expect(pages[2]).toHaveLength(1);
    expectPaginatePreservesOrder(rows, pages);
  });
});

describe('paginateRows 異常系', () => {
  it('15. 空配列は空の結果を返す', () => {
    expect(paginateRows([], 5)).toEqual([]);
  });

  it(
    '16. maxRows が 0・負数・null でもハングせず、空ページを含まない配列を返す',
    () => {
      const rows = Array.from({ length: 10 }, (_, i) => [g(i)]);
      for (const maxRows of [0, -1, null]) {
        const pages = paginateRows(rows, maxRows);
        expect(Array.isArray(pages)).toBe(true);
        expectNoEmptyGroups(pages);
        expectPaginatePreservesOrder(rows, pages);
      }
    },
    2000
  );

  it(
    '17. 【既知の欠陥を検出】maxRows が NaN / undefined / オブジェクトだと空ページが混入する',
    () => {
      // 1回目の slice(0, i + maxRows) が ToInteger で 0 に丸められ、
      // 空配列が1ページ分紛れ込む。これは「空ページを作らない」契約への違反。
      const rows = Array.from({ length: 10 }, (_, i) => [g(i)]);
      for (const per of [NaN, undefined, {}]) {
        const pages = paginateRows(rows, per);
        expectNoEmptyGroups(pages);
      }
    },
    2000
  );

  it('18. Infinity や小数・数値文字列は破綻しない（実質正の数として機能する）', () => {
    const rows = Array.from({ length: 10 }, (_, i) => [g(i)]);
    for (const per of [Infinity, 2.5, '5']) {
      const pages = paginateRows(rows, per);
      expect(Array.isArray(pages)).toBe(true);
      expectNoEmptyGroups(pages);
      expect(pages.flat()).toHaveLength(10);
    }
  });

  it('19. 割り切れる件数で末尾に空ページを作らない', () => {
    const rows = Array.from({ length: 9 }, (_, i) => [g(i)]);
    const pages = paginateRows(rows, 3);
    expect(pages).toHaveLength(3);
    expectNoEmptyGroups(pages);
  });

  it('20. 空行（長さ0の行）が混ざっていても行数の勘定が狂わない', () => {
    const rows = [[g(0)], [], [g(1)], []];
    const pages = paginateRows(rows, 2);
    expect(pages.flat()).toHaveLength(4);
  });

  it('21. rows が配列でない場合、例外を投げるか空配列を返す', () => {
    for (const bad of [null, undefined, 'abc', 0, {}]) {
      let result;
      try {
        result = paginateRows(bad, 5);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        continue;
      }
      expect(Array.isArray(result)).toBe(true);
    }
  });

  it('22. 入力配列を破壊的に変更しない', () => {
    const rows = Array.from({ length: 6 }, (_, i) => [g(i)]);
    const snapshot = JSON.parse(JSON.stringify(rows));
    paginateRows(rows, 4);
    expect(rows).toEqual(snapshot);
  });

  it('23. splitIntoRows と連結しても 3000 グリッドが1件も失われない', () => {
    const grids = makeGrids(3000).map((x, i) =>
      i % 37 === 0 ? { ...x, forceBreakAfter: true } : x
    );
    const rows = splitIntoRows(grids, 16);
    const pages = paginateRows(rows, 10);

    // pages: Array<Array<row>>, row: Array<{ grid, index }>
    const flatGrids = pages.flat().flat().map((item) => item.grid);
    expect(flatGrids).toHaveLength(3000);
    expect(flatGrids.map((x) => x.text)).toEqual(grids.map((x) => x.text));
  }, 5000);
});

/* ============================================================
 * columnsForBits(bitsPerPage) -> number
 * ------------------------------------------------------------
 * 画面(ScoreCanvas.jsx)とPDF(pdfExport.js)にそれぞれ独立して
 * 存在していた `bitsPerPage === 12 ? 3 : 4` を一本化したもの。
 * bitsPerPage は外部JSON由来の値がそのまま渡りうる前提（信頼境界）で、
 * 12以外はすべて4列にフォールバックする。
 * ============================================================ */

describe('columnsForBits', () => {
  it('12 は 3列', () => {
    expect(columnsForBits(12)).toBe(3);
  });

  it('16 は 4列', () => {
    expect(columnsForBits(16)).toBe(4);
  });

  it('4 は 4列', () => {
    expect(columnsForBits(4)).toBe(4);
  });

  it.each([0, Number.NaN, undefined, null, '12', '16', {}, [], Infinity, -12])(
    '%p のような想定外の値は 4列にフォールバックする',
    (bitsPerPage) => {
      expect(columnsForBits(bitsPerPage)).toBe(4);
    },
  );
});

/* ============================================================
 * resolveColumnsPerPage(columnsPerPageId, bitsPerPage) -> number
 * ------------------------------------------------------------
 * PDF専用の「1ページの列数」設定を実際の列数へ解決する。設定UI
 * （Toolbar.jsx）とPDF出力（pdfExport.js）が同じ値を使うための唯一の
 * 導出元であり、'auto' のときだけ従来どおり拍子から決める。
 * idは共有URL・QR・localStorage経由で外部から届きうるため（信頼境界）、
 * 未知のidは 'auto' へ落ちる。
 * ============================================================ */

describe('resolveColumnsPerPage', () => {
  it("'auto' は拍子から決める従来の挙動と一致する", () => {
    expect(resolveColumnsPerPage('auto', 12)).toBe(columnsForBits(12));
    expect(resolveColumnsPerPage('auto', 16)).toBe(columnsForBits(16));
    expect(resolveColumnsPerPage('auto', 4)).toBe(columnsForBits(4));
  });

  it('固定値は拍子にかかわらずその列数になる', () => {
    expect(resolveColumnsPerPage('col2', 12)).toBe(2);
    expect(resolveColumnsPerPage('col8', 12)).toBe(8);
    expect(resolveColumnsPerPage('col8', 16)).toBe(8);
  });

  it.each(['col1', 'col9', 'col0', '4', 4, '', undefined, null, {}, [], '__proto__', 'toString'])(
    '%p のような未知のidは auto として扱う',
    (columnsPerPageId) => {
      expect(resolveColumnsPerPage(columnsPerPageId, 12)).toBe(3);
      expect(resolveColumnsPerPage(columnsPerPageId, 16)).toBe(4);
    },
  );

  it('splitIntoRows へ渡すと、その列数で折り返して1件も失われない', () => {
    const grids = makeGrids(50);
    const rows = splitIntoRows(grids, resolveColumnsPerPage('col8', 16));
    expect(rows.length).toBe(7);
    expect(rows[0]).toHaveLength(8);
    expect(rows.at(-1)).toHaveLength(2);
    expect(rows.flat()).toHaveLength(50);
  });
});
