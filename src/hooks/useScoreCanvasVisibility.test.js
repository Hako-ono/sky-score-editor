import { describe, expect, it } from 'vitest';
import { scoreCanvasInitialVisibility } from './useScoreCanvasVisibility.js';

function canvasWithRect(rect) {
  return { getBoundingClientRect: () => rect };
}

const viewport = { innerHeight: 800, innerWidth: 400 };

describe('scoreCanvasInitialVisibility', () => {
  it('操作バーに隠れない領域へキャンバスが入っていれば表示中とする', () => {
    expect(scoreCanvasInitialVisibility(canvasWithRect({
      top: 700,
      right: 390,
      bottom: 900,
      left: 10,
      width: 380,
      height: 200,
    }), 80, viewport)).toBe(true);
  });

  it('キャンバスが操作バーの背後にしかなければ表示中に数えない', () => {
    expect(scoreCanvasInitialVisibility(canvasWithRect({
      top: 730,
      right: 390,
      bottom: 900,
      left: 10,
      width: 380,
      height: 170,
    }), 80, viewport)).toBe(false);
  });

  it('負値や非数の高さは下端余白なしとして扱う', () => {
    const canvas = canvasWithRect({
      top: 790,
      right: 390,
      bottom: 900,
      left: 10,
      width: 380,
      height: 110,
    });
    expect(scoreCanvasInitialVisibility(canvas, -20, viewport)).toBe(true);
    expect(scoreCanvasInitialVisibility(canvas, 'invalid', viewport)).toBe(true);
  });
});
