/**
 * グリッドが持つ元レイヤーの所属から、画面・再生で共有する派生値を求める。
 * このモジュールは React や外部設定に依存せず、正規化済みグリッドだけを扱う。
 */

function getKeysForLayer(grid, layer) {
  if (!grid || typeof grid !== 'object') return [];
  if (layer === 1) return Array.isArray(grid.keys) ? grid.keys : [];
  if (layer === 2) return Array.isArray(grid.layer2Keys) ? grid.layer2Keys : [];
  return [];
}

export function analyzeScoreLayers(grids) {
  let hasLayer1 = false;
  let hasLayer2 = false;

  if (Array.isArray(grids)) {
    for (const grid of grids) {
      if (!hasLayer1 && getKeysForLayer(grid, 1).length > 0) hasLayer1 = true;
      if (!hasLayer2 && getKeysForLayer(grid, 2).length > 0) hasLayer2 = true;
      if (hasLayer1 && hasLayer2) break;
    }
  }

  return { hasLayer1, hasLayer2, usesTwoLayers: hasLayer1 && hasLayer2 };
}

export function getInitialLayer(grids) {
  const { hasLayer1, hasLayer2 } = analyzeScoreLayers(grids);
  return hasLayer1 || !hasLayer2 ? 1 : 2;
}

export function shouldUseSecondHighlightColor(
  usesTwoLayers,
  selectedLayer,
  standardColorLayer,
) {
  return !usesTwoLayers && selectedLayer !== standardColorLayer;
}

export function getSelectedLayerKeys(grid, selectedLayer) {
  return getKeysForLayer(grid, selectedLayer);
}

export function getKeyTogglePreviewKeys(grid, keyIndex, selectedLayer) {
  if (!grid || typeof grid !== 'object') return [];
  if (!Number.isInteger(keyIndex) || keyIndex < 0 || keyIndex > 14) return [];
  if (selectedLayer !== 1 && selectedLayer !== 2) return [];
  return getKeysForLayer(grid, selectedLayer).includes(keyIndex) ? [] : [keyIndex];
}

export function getOtherLayerKeys(grid, selectedLayer) {
  if (selectedLayer === 1) return getKeysForLayer(grid, 2);
  if (selectedLayer === 2) return getKeysForLayer(grid, 1);
  return [];
}

export function getAudibleKeys(grid) {
  const keys = new Set();
  for (const layer of [1, 2]) {
    for (const key of getKeysForLayer(grid, layer)) {
      if (Number.isInteger(key) && key >= 0 && key <= 14) keys.add(key);
    }
  }
  return Array.from(keys).sort((a, b) => a - b);
}

export function getKeyLayerMembership(grid, keyIndex, selectedLayer) {
  const inSelected = getSelectedLayerKeys(grid, selectedLayer).includes(keyIndex);
  const inOther = getOtherLayerKeys(grid, selectedLayer).includes(keyIndex);

  if (inSelected && inOther) return 'both';
  if (inSelected) return 'selected';
  if (inOther) return 'other';
  return 'none';
}
