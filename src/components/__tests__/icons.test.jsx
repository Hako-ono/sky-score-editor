import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CopyIcon, PasteIcon } from '../icons.jsx';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('操作バーのアイコン', () => {
  it('コピーは前面のカードに輪郭より細い線を2本描く', () => {
    const markup = renderToStaticMarkup(<CopyIcon size={20} />);
    expect(markup).toContain('M10.8 12h5.4M10.8 15.2h5.4');
    expect(markup).toContain('stroke-width="1.6"');
  });

  it('貼り付けは並べても壊れないよう毎回別のマスクIDを使う', () => {
    const markup = renderToStaticMarkup(
      <>
        <PasteIcon size={20} />
        <PasteIcon size={20} />
      </>,
    );
    const maskIds = [...markup.matchAll(/<mask id="([^"]+)"/g)].map((match) => match[1]);
    expect(maskIds).toHaveLength(2);
    expect(new Set(maskIds).size).toBe(2);
    maskIds.forEach((maskId) => {
      const references = markup.match(
        new RegExp(`mask="url\\(#${escapeRegExp(maskId)}\\)"`, 'g'),
      );
      expect(references).toHaveLength(2);
    });
  });
});
