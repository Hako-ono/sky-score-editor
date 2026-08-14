import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import NoteGridSvg from '../NoteGridSvg.jsx';

const renderGrid = (props) => renderToStaticMarkup(
  <NoteGridSvg
    onToggleKey={() => {}}
    interactive={false}
    {...props}
  />,
);

const countSecondHighlights = (markup) => (
  markup.match(/highlight-layer2/g) ?? []
).length;

describe('NoteGridSvg layer colors', () => {
  it('0・7・14番の円＋ひし形をそれぞれ1つの複合pathとして描く', () => {
    const markup = renderGrid({ keys: [] });

    expect(markup.match(/<path class="sky-symbol"/g)).toHaveLength(3);
    expect(markup.match(/<polygon class="sky-symbol"/g)).toHaveLength(6);
    expect(markup.match(/<circle class="sky-symbol"/g)).toHaveLength(6);
  });

  it('単層譜面を初期レイヤーから切り替えると全押鍵へ色2クラスを付ける', () => {
    const existingLayer = renderGrid({
      selectedKeys: [],
      otherKeys: [0, 7],
      usesTwoLayers: false,
      usesSecondHighlightColor: true,
    });
    const newlyEnteredLayer = renderGrid({
      selectedKeys: [4],
      otherKeys: [],
      usesTwoLayers: false,
      usesSecondHighlightColor: true,
    });

    expect(countSecondHighlights(existingLayer)).toBe(2);
    expect(countSecondHighlights(newlyEnteredLayer)).toBe(1);
  });

  it('単層譜面の初期表示は従来どおり色1だけを使う', () => {
    const markup = renderGrid({
      selectedKeys: [],
      otherKeys: [0, 7],
      usesTwoLayers: false,
      usesSecondHighlightColor: false,
    });

    expect(countSecondHighlights(markup)).toBe(0);
  });

  it('二層譜面では画面用基準を無視して非選択側だけを色2にする', () => {
    const markup = renderGrid({
      selectedKeys: [0],
      otherKeys: [1],
      usesTwoLayers: true,
      usesSecondHighlightColor: true,
    });

    expect(countSecondHighlights(markup)).toBe(1);
  });
});
