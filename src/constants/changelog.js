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
    date: '2026-08-18',
    kind: 'feature',
    text: {
      ja: 'タイ語・ベトナム語・ロシア語に対応しました。',
      en: 'Added Thai, Vietnamese, and Russian.',
    },
  },
  {
    id: 'lang-en-ko-zh',
    date: '2026-08-17',
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
