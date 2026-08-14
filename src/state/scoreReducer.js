/**
 * 楽譜状態の純粋リデューサ。状態の形は scoreShape.js で集中定義する。
 * すべての操作はイミュータブルに新しい状態を返す。
 */

import { createEmptyGrid } from '../lib/parseScore.js';
import {
  DEFAULT_BPM,
  normalizeKeyMode,
  MAX_GRIDS,
  MAX_METADATA_LENGTH,
  MAX_TEXT_LENGTH,
} from '../constants/config.js';
import { createScore } from './scoreShape.js';

export const initialScore = createScore();

function updateGridAt(grids, index, updater) {
  if (index < 0 || index >= grids.length) return grids;
  return grids.map((g, i) => (i === index ? updater(g) : g));
}

export function scoreReducer(state, action) {
  switch (action.type) {
    // 'LOAD' アクションは useUndoableScore の reset() で
    // 代替されているため未使用。将来の拡張のためにコメントアウト。
    /*
    case 'LOAD':
      return {
        grids: action.grids,
        bpm: action.bpm ?? DEFAULT_BPM,
        title: action.title ?? '',
        pitchLevel: action.pitchLevel ?? 0,
        keyMode: action.keyMode ?? 'major',
        author: action.author ?? '',
        lyricist: action.lyricist ?? '',
        transcribedBy: action.transcribedBy ?? '',
        bitsPerPage: action.bitsPerPage ?? 16,
      };
    */

    case 'NEW_EMPTY':
      return createScore({
        grids: [createEmptyGrid()],
        bpm: action.bpm,
        pitchLevel: action.pitchLevel,
        keyMode: action.keyMode,
      });

    case 'CLEAR':
      return { ...initialScore };

    case 'SET_BPM': {
      // UI（Toolbar の handleBpmBlur / <select>）がここまで妥当な値に整えて
      // 呼んでいるが、reducer はUIを経由しない書き込み口でも壊れないよう
      // 最終防御として同じ範囲に丸める。
      const bpm = typeof action.bpm === 'number' && Number.isFinite(action.bpm)
        ? action.bpm
        : DEFAULT_BPM;
      return { ...state, bpm: Math.max(1, Math.min(bpm, 999)) };
    }

    // SET_TITLE / SET_AUTHOR / SET_LYRICIST / SET_TRANSCRIBED_BY / SET_TEXT は文字数だけを
    // 切り詰め、sanitizeText 相当の制御文字除去（\p{Cc}/\p{Cf}）は行わない。
    // 入力中の文字列に対して毎回それを行うと、日本語入力の変換中の文字列
    // （IME の未確定文字列）に干渉しうるため。制御文字の防御は「外部ファイル
    // を読む経路」の責務であり、そちらは引き続き sanitizeText が担当する。
    case 'SET_TITLE':
      return { ...state, title: String(action.title ?? '').slice(0, MAX_METADATA_LENGTH) };

    case 'SET_AUTHOR':
      return { ...state, author: String(action.author ?? '').slice(0, MAX_METADATA_LENGTH) };

    case 'SET_LYRICIST':
      return { ...state, lyricist: String(action.lyricist ?? '').slice(0, MAX_METADATA_LENGTH) };

    case 'SET_TRANSCRIBED_BY':
      return {
        ...state,
        transcribedBy: String(action.transcribedBy ?? '').slice(0, MAX_METADATA_LENGTH),
      };

    case 'SET_BITS_PER_PAGE': {
      const b = parseInt(action.bitsPerPage, 10);
      return { ...state, bitsPerPage: [4, 12, 16].includes(b) ? b : 16 };
    }

    case 'SET_PITCH_LEVEL': {
      const p = parseInt(action.pitchLevel, 10);
      const safePitch = Number.isNaN(p) ? 0 : Math.max(0, Math.min(p, 11));
      return { ...state, pitchLevel: safePitch };
    }

    case 'SET_KEY_MODE':
      return { ...state, keyMode: normalizeKeyMode(action.keyMode) };

    case 'SET_TEXT':
      return {
        ...state,
        grids: updateGridAt(state.grids, action.gridIndex, (g) => ({
          ...g,
          text: String(action.text ?? '').slice(0, MAX_TEXT_LENGTH),
        })),
      };

    case 'TOGGLE_KEY': {
      const { gridIndex, keyIndex, layer } = action;
      if (
        !Number.isInteger(gridIndex)
        || gridIndex < 0
        || gridIndex >= state.grids.length
        || (layer !== 1 && layer !== 2)
        || !Number.isInteger(keyIndex)
        || keyIndex < 0
        || keyIndex > 14
      ) {
        return state;
      }
      const keyField = layer === 1 ? 'keys' : 'layer2Keys';
      return {
        ...state,
        grids: updateGridAt(state.grids, gridIndex, (g) => {
          const layerKeys = Array.isArray(g[keyField]) ? g[keyField] : [];
          const layer2Keys = Array.isArray(g.layer2Keys) ? g.layer2Keys : [];
          const has = layerKeys.includes(keyIndex);
          const keys = has
            ? layerKeys.filter((k) => k !== keyIndex)
            : [...layerKeys, keyIndex].sort((a, b) => a - b);
          const nextKeys = layer === 1 ? keys : (Array.isArray(g.keys) ? g.keys : []);
          const nextLayer2Keys = layer === 2 ? keys : layer2Keys;
          return {
            ...g,
            keys: nextKeys,
            layer2Keys: nextLayer2Keys,
            type: nextKeys.length > 0 || nextLayer2Keys.length > 0 ? 'note' : 'empty',
          };
        }),
      };
    }

    case 'TOGGLE_BREAK':
      return {
        ...state,
        grids: updateGridAt(state.grids, action.gridIndex, (g) => ({
          ...g,
          forceBreakAfter: !g.forceBreakAfter,
        })),
      };

    case 'INSERT': {
      // UI（handleInsert）が上限で止めて呼んでいるが、reducer は UI を経由
      // しない書き込み口でも壊れないよう最終防御として MAX_GRIDS を超えさせない。
      // 同一参照を返すことで historyReducer が「変化なし」と扱い履歴も積まない。
      if (state.grids.length >= MAX_GRIDS) return state;
      const i = Math.max(0, Math.min(action.insertIndex, state.grids.length));
      const grids = [...state.grids];
      grids.splice(i, 0, createEmptyGrid());
      return { ...state, grids };
    }

    case 'DELETE': {
      const { gridIndex } = action;
      if (gridIndex < 0 || gridIndex >= state.grids.length) return state;
      return {
        ...state,
        grids: state.grids.filter((_, i) => i !== gridIndex),
      };
    }

    default:
      return state;
  }
}

/**
 * 連続入力を 1 つの履歴にまとめるためのキー。
 * 同じキーの操作が連続したときは undo 履歴を積まず置き換える。
 * (テキスト入力・BPM/タイトル変更が対象)
 */
export function coalesceKey(action) {
  switch (action.type) {
    case 'SET_TEXT': return `text:${action.gridIndex}`;
    case 'SET_TITLE': return 'title';
    case 'SET_BPM': return 'bpm';
    case 'SET_PITCH_LEVEL': return 'pitchLevel';
    case 'SET_KEY_MODE': return 'keyMode';
    case 'SET_AUTHOR': return 'author';
    case 'SET_LYRICIST': return 'lyricist';
    case 'SET_TRANSCRIBED_BY': return 'transcribedBy';
    case 'SET_BITS_PER_PAGE': return 'bitsPerPage';
    default: return null;
  }
}
