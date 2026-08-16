import { useState, useRef } from 'react';
import { useT } from '../i18n/LanguageContext.jsx';
import {
  GRID_CELL_SHAPES,
  CELL_CORNER_RADIUS,
} from '../lib/gridShapes.js';

function SymbolShape({ symbol }) {
  if (symbol.kind === 'polygon') {
    return <polygon className="sky-symbol" points={symbol.points} />;
  }
  if (symbol.kind === 'circle') {
    return (
      <circle
        className="sky-symbol"
        cx={symbol.cx}
        cy={symbol.cy}
        r={symbol.r}
      />
    );
  }
  return <path className="sky-symbol" d={symbol.d} />;
}

/** 記号 (円/ひし形/複合形) を描く */
function Symbols({ symbols }) {
  return (
    <>
      {symbols.map((symbol, i) => (
        <SymbolShape key={i} symbol={symbol} />
      ))}
    </>
  );
}

/**
 * 15 鍵グリッド。各鍵は role="button" の <g>。クリック/Enter/Space で切替。
 * viewBox は 0 0 350 210 (ボタン領域のみ)。
 */
export default function NoteGridSvg({
  keys = [],
  selectedKeys,
  otherKeys = [],
  usesTwoLayers = false,
  usesSecondHighlightColor = false,
  onToggleKey,
  interactive,
}) {
  const t = useT();
  const [focusedIndex, setFocusedIndex] = useState(0);
  const gridRef = useRef(null);
  const selected = Array.isArray(selectedKeys) ? selectedKeys : keys;
  const selectedSet = new Set(selected);
  const otherSet = new Set(Array.isArray(otherKeys) ? otherKeys : []);

  const handleKeyDown = (e, index) => {
    if (!interactive) return;
    const col = index % 5;
    const row = Math.floor(index / 5);
    let nextIndex = index;

    switch (e.key) {
      case 'ArrowRight': nextIndex = row * 5 + Math.min(4, col + 1); break;
      case 'ArrowLeft':  nextIndex = row * 5 + Math.max(0, col - 1); break;
      case 'ArrowDown':  nextIndex = Math.min(14, (row + 1) * 5 + col); break;
      case 'ArrowUp':    nextIndex = Math.max(0, (row - 1) * 5 + col); break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        onToggleKey(index);
        return;
      default: return;
    }

    if (nextIndex !== index) {
      e.preventDefault();
      setFocusedIndex(nextIndex);
      const buttons = gridRef.current?.querySelectorAll('.sky-button');
      if (buttons && buttons[nextIndex]) buttons[nextIndex].focus();
    }
  };

  return (
    <svg
      ref={gridRef}
      className="note-grid-svg"
      viewBox="0 0 350 210"
      xmlns="http://www.w3.org/2000/svg"
      role="group"
      aria-label={t('ui.noteGrid.ariaLabel')}
    >
      {GRID_CELL_SHAPES.map((cell) => {
        const selectedLayer = selectedSet.has(cell.index);
        const otherLayer = otherSet.has(cell.index);
        const active = selectedLayer || (otherLayer && !usesTwoLayers);
        const isSecondLayer = usesTwoLayers
          ? !selectedLayer && otherLayer
          : usesSecondHighlightColor && (selectedLayer || otherLayer);
        const membershipKey = selectedLayer && otherLayer
          ? 'ui.noteGrid.selectedAndOther'
          : selectedLayer
            ? 'ui.noteGrid.selected'
            : otherLayer
              ? 'ui.noteGrid.other'
              : null;
        const position = t(`ui.noteGrid.keyPosition.${cell.index}`);
        const key = position
          ? t('ui.noteGrid.keyWithPosition', { n: cell.index + 1, position })
          : t('ui.noteGrid.key', { n: cell.index + 1 });
        const membership = membershipKey
          ? t('ui.noteGrid.membership', { value: t(membershipKey) })
          : '';
        const label = t('ui.noteGrid.label', {
          key,
          state: t(active ? 'ui.noteGrid.on' : 'ui.noteGrid.off'),
          membership,
        });
        return (
          <g
            key={cell.index}
            className={`sky-button${active ? ' highlight' : ''}${isSecondLayer ? ' highlight-layer2' : ''}`}
            transform={`translate(${cell.cx}, ${cell.cy})`}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? (focusedIndex === cell.index ? 0 : -1) : undefined}
            aria-pressed={interactive ? active : undefined}
            aria-label={interactive ? label : undefined}
            onClick={interactive ? () => {
              setFocusedIndex(cell.index);
              onToggleKey(cell.index);
            } : undefined}
            onFocus={() => setFocusedIndex(cell.index)}
            onKeyDown={(e) => handleKeyDown(e, cell.index)}
          >
            <rect
              className="sky-cell-frame"
              x={cell.frame.x}
              y={cell.frame.y}
              width={cell.frame.width}
              height={cell.frame.height}
              rx={CELL_CORNER_RADIUS}
              ry={CELL_CORNER_RADIUS}
            />
            <Symbols symbols={cell.symbols} />
          </g>
        );
      })}
    </svg>
  );
}
