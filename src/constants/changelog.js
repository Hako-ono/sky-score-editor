// 更新履歴。新しい順に並べる。
//
// 本文だけはここに直接持たせている。辞書（src/i18n/dict/）へ入れると
// 1件追加するたび12言語ぶんの追記が必要になり、履歴が更新されなくなるため。
// 日本語以外の表示言語では en を使う（全言語の翻訳は追わないという運用上の割り切り）。
//
// id は同じ日付の項目が並んでもReactのkeyが衝突しないように付けている。
// kind は 'feature' | 'improve' | 'fix' の3種。表示名は辞書側にある。
export const CHANGELOG = [
  {
    id: 'export-filename',
    date: '2026-08-25',
    kind: 'improve',
    text: {
      ja: '保存するファイルの名前に曲名が入るようになりました（例：Sky_月の光_20260825-143012.pdf）。曲名が未入力のときは「Untitled」になります。',
      en: 'Saved files are now named with the song title (for example, Sky_Moonlight_20260825-143012.pdf). Scores with no title are saved as "Untitled".',
    },
  },
  {
    id: 'range-edit',
    date: '2026-08-23',
    kind: 'feature',
    text: {
      ja: 'グリッドを範囲で選んで、コピー・カット・削除・貼り付けができるようになりました。',
      en: 'You can now select a range of grids to copy, cut, delete, and paste.',
    },
  },
  {
    id: 'edit-mode-removed',
    date: '2026-08-23',
    kind: 'improve',
    text: {
      ja: '編集モードをなくしました。グリッドの追加や削除は、紫色のキャレットの挿入位置や選択した範囲に対して行います。',
      en: 'Removed edit mode. Grids are added and removed at the purple caret or across the selected range.',
    },
  },
  {
    id: 'caret-playback',
    date: '2026-08-23',
    kind: 'feature',
    text: {
      ja: '再生の開始位置を紫色のキャレットで指定できるようになりました。範囲を選んでいるときは、その範囲だけを再生します。',
      en: 'The purple caret now sets where playback starts. With a range selected, only that range plays.',
    },
  },
  {
    id: 'loop-playback',
    date: '2026-08-23',
    kind: 'feature',
    text: {
      ja: '再生をくり返すループ機能を追加しました。',
      en: 'Added looping playback.',
    },
  },
  {
    id: 'playback-aids',
    date: '2026-08-23',
    kind: 'feature',
    text: {
      ja: 'メトロノーム・カウントイン・再生速度（0.25x／0.5x）を追加しました。',
      en: 'Added a metronome, a count-in, and playback speeds (0.25x / 0.5x).',
    },
  },
  {
    id: 'pdf-custom-tokens',
    date: '2026-08-20',
    kind: 'feature',
    text: {
      ja: 'カスタム配色に「詳細色2（上級者向け）」の設定を追加しました。',
      en: 'Added an "Advanced colors" section to the custom palette.',
    },
  },
  {
    id: 'pdf-preview',
    date: '2026-08-19',
    kind: 'feature',
    text: {
      ja: '楽譜のサイト内プレビュー機能を追加しました。',
      en: 'Added an in-site preview for the generated PDF.',
    },
  },
  {
    id: 'png-export',
    date: '2026-08-18',
    kind: 'feature',
    text: {
      ja: '楽譜をPNG画像で保存できるようになりました。',
      en: 'You can now save scores as PNG images.',
    },
  },
  {
    id: 'lang-pt-es-id',
    date: '2026-08-18',
    kind: 'feature',
    text: {
      ja: 'ポルトガル語・スペイン語・インドネシア語に対応しました。',
      en: 'Added Portuguese, Spanish, and Indonesian.',
    },
  },
  {
    id: 'lang-th-vi-ru',
    date: '2026-08-17',
    kind: 'feature',
    text: {
      ja: 'タイ語・ベトナム語・ロシア語に対応しました。',
      en: 'Added Thai, Vietnamese, and Russian.',
    },
  },
  {
    id: 'lang-en-ko-zh',
    date: '2026-08-16',
    kind: 'feature',
    text: {
      ja: '英語・韓国語・中国語（簡体字／繁体字）に対応しました。',
      en: 'Added English, Korean, and Chinese (Simplified / Traditional).',
    },
  },
];

// これより多い項目は入れ子の details へ畳む。
export const CHANGELOG_VISIBLE_COUNT = 6;

export function getChangelogText(entry, language) {
  if (language === 'ja') return entry.text.ja;
  return entry.text.en ?? entry.text.ja;
}
