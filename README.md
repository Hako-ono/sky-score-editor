# Sky楽譜エディター

Sky: 星を紡ぐ子どもたちの 15 鍵楽譜を JSON から生成し、鍵・テキスト・改行を編集して
PDF / JSON に出力するツール。ブラウザだけで完結する静的サイトで、音源・フォントを含め
外部サーバへの依存はありません。

本ツールは非公式のファンメイドツールであり、thatgamecompany, inc. とは関係ありません。

## セットアップ

```bash
npm install
npm run dev      # 開発サーバ
npm run build    # 本番ビルド (dist/)
npm run preview  # ビルド結果をプレビュー
```

Node 20.19+ / 22.12+ を推奨（Vite 8 の要件）。

## テスト

```bash
npm test         # vitest run のエイリアス
npm run lint     # ESLint
```

## 主な機能

**編集**
- 15 鍵のトグル、歌詞テキスト、強制改行、グリッドの挿入・削除。
- Undo / Redo（Ctrl+Z / Ctrl+Shift+Z、連続テキスト入力は 1 履歴に集約）、Ctrl+S で JSON 保存。
- 「新規作成」で JSON なしから空の楽譜を作成でき、曲名・作曲者・作詞者・譜面作成者・
  BPM・拍子・キー・調性を編集できる。
- localStorage への自動保存と復元、未保存インジケータ、フッターからの下書き削除。

**再生**
- Tone.js による再生。BPM とキー（トランスポーズ）を再生中にも変更できる。
- 再生位置を行単位で追尾する。

**PDF 出力**
- 配色プリセット（印刷用＋四季×明暗）とカスタム配色、3 書体 × Regular / Bold から
  選ぶ埋め込みフォント。
- 文字サイズ・1 ページあたりの行数・2 面付け・余白、ページ番号や柱などのページ装飾、
  曲情報のデザイン 4 種と独立表紙、背景画像。
- 設定は localStorage に保存され、保存・共有用 URL と QR カードとして書き出し／読み込みできる
  （楽譜の内容と背景画像は含めない）。

**表示**
- ライト / ダーク / システム追従のテーマ。
- モバイルではグリッド一覧を簡略化し、タップで拡大するカルーセル UI に切り替える。
- 3000 グリッドまでを想定し、グリッド一覧は可視範囲だけを描画する（仮想化）。
- URL に `?debug=1` を付けたときだけ、内部状態を表示する診断オーバレイが出る。

## 入力フォーマット

1. **元楽譜形式** — `[{ bpm, songNotes: [{ time, key: "1Key0" }, ...] }]`
   （`1KeyN` / `2KeyN` の所属を別レイヤーとして保持。`name` / `title` があれば
   タイトルとして取り込む）
2. **エディタ形式** — 本ツールが保存する形式
   `{ formatVersion, title, bpm, grids: [{ type, keys, layer2Keys, text, forceBreakAfter }] }`

文字コードはUTF-8のほか、参照元アプリが出力するBOM付きUTF-16LEにも対応します。

2レイヤー譜面では、画面全体の選択レイヤーを切り替えて表示・編集できます。同じ鍵は
再生時に重複して鳴らず、PDFでは選択側と非選択側を別色で描きます。選択レイヤー自体は
JSONや下書き、PDF設定には保存されません。

`examples/sample_original.json` に動作確認用の短い楽譜を同梱。

## 日本語フォント

- **画面表示**: `@fontsource/noto-sans-jp`（Noto Sans JP、SIL OFL 1.1）を npm 依存として
  自前ホスト。`src/main.jsx` で `400.css` / `500.css` / `700.css` を import しており、
  ビルド時に `dist/assets/` へ同梱される（外部サーバへの通信なし）。
- **PDF 埋め込み**: ゴシック（Zen Kaku Gothic New）／明朝（Shippori Mincho）／
  丸ゴシック（Zen Maru Gothic）の3書体から選択できる（`src/constants/config.js` の
  `PDF_FONTS`）。いずれも `public/fonts/` に TTF 実体をコミット済みで、選択された
  書体だけを実行時に取得して埋め込む。直近に使った1書体だけを base64 キャッシュし、
  切り替えると差し替わる。選択はツールバーの「配色」欄の隣に置いた「書体」欄から行い、
  localStorage（`sky-score-editor:pdf-prefs:v1`）に保存されて次回に引き継がれる。
  画面表示とは別の書体群になっているのは、jsPDF の `addFont` が TrueType 形式のみ
  対応で OTF/CFF 非対応、`@fontsource/noto-sans-jp` は woff/woff2 のみの配布で
  埋め込みに使える実体を含まないため。

## ディレクトリ構成

```
src/
├─ constants/config.js     設定・グリッド幾何・記号配置・配色
├─ lib/
│  ├─ parseScore.js        JSON 解析(2形式) / 直列化 / 和音→グリッド変換
│  ├─ layout.js            列数・強制改行に沿った行分割 / ページ割り
│  ├─ pdfExport.js         jsPDF + svg2pdf。フォント遅延読込・ページ SVG 生成
│  └─ draftStorage.js      localStorage 下書き保存
├─ state/scoreReducer.js   楽譜状態の純粋リデューサ
├─ hooks/
│  ├─ useUndoableScore.js  undo/redo 履歴 + 連続入力の集約
│  └─ useKeyboardShortcuts.js
├─ components/             Toolbar / ScoreCanvas / GridCard / NoteGridSvg / …
├─ App.jsx                 状態統合・ファイル IO・自動保存・PDF
└─ styles/index.css        テーマトークン(light/dark)・レスポンシブ
```

## 利用にあたって

- 本ツールは、Skyの15鍵の楽譜をつくって編集し、PDFやJSONとして書き出すためのツールです。
- 作った楽譜・歌詞・画像を公開・共有するときは、元になった作品や投稿先のガイドラインを
  ご確認ください。
- 編集内容はブラウザ内に自動保存されますが、ブラウザのデータ消去、プライベートブラウズ、
  保存容量の不足などで失われることがあります。残しておきたい楽譜は「JSONを保存」で、
  お使いの端末にもファイルとして保存してください。
- 本ツールは個人が無償で公開しているものです。継続的な提供や動作、出力結果の正確さを
  保証するものではありません。本ツールの利用によって生じた損害については、法令上
  やむを得ない場合を除き責任を負いません。

## プライバシー・端末内保存

- 読み込んだ楽譜JSON、PDFの背景画像、設定を読み込むためのQR画像は、すべてお使いの
  ブラウザの中だけで処理されます。これらがサーバーへアップロードされることはありません。
- ブラウザのlocalStorageには、楽譜の下書き・表示テーマ・PDF設定の3つを保存します。
  PDFの背景画像は保存しないため、出力のたびに選び直してください。URLに`?debug=1`を
  付けたときだけ、診断用の直近の計測値をsessionStorageに保存します（タブを閉じると消えます）。
- PDF設定の「保存・共有用URL」とQRカードは、PDFの出力設定と入力したプリセット名・メモを
  ブラウザ内でJSON化・圧縮して作成します。含まれるのはそれらだけで、楽譜の内容や背景画像は
  含まれません。設定はURLの「#」以降に埋め込まれ、この部分はブラウザからサーバーへ送信されません。
  他の人に渡すとプリセット名・メモも一緒に渡ります。
- 本ツールはCookie、広告、アクセス解析を使用していません。
- サイトの配信にはCloudflare Pagesを使用しています。ページやファイルを読み込む通信に伴い、
  IPアドレスなどのリクエスト情報をCloudflareが処理する場合があります。上に挙げた
  楽譜JSON・背景画像・QR画像・PDF設定の内容がCloudflareへ送られることはありません。
- 「下書きを削除」で消えるのは楽譜の下書きだけです。テーマとPDF設定も消したい場合は、
  ブラウザのサイトデータ削除機能をお使いください。共用の端末では、使い終わったあとに
  削除することをおすすめします。

## 問い合わせ

不具合、権利に関するご連絡、ライセンス表記の訂正は、Xの[`@Hako_ono_sky`](https://x.com/Hako_ono_sky)への
リプライまたはDMでお知らせください。リプライは公開されるため、個人情報や公開したくない
内容はDMをご利用ください。楽譜・歌詞・画像を添付する場合は、ご自身で共有できるものだけを
選んでください。

## クレジット (Credits & Acknowledgements)

本ツールは以下のオープンソースプロジェクトおよび素材を利用して開発されています。
音源・フォントはいずれも `public/` 配下または npm 依存として自前ホストしており、
実行時に外部サーバへ通信することはありません。

* **音源**: Salamander Grand Piano V3 by Alexander Holm (Licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/))。
  `public/audio/salamander/` に自前ホスト（元データは [Tone.js のサンプルライブラリ](https://tonejs.github.io/audio/salamander/) 経由で取得）。
* **画面表示フォント**: Noto Sans JP (Licensed under [SIL Open Font License 1.1](https://scripts.sil.org/OFL))。
  `@fontsource/noto-sans-jp` として自前ホスト。
* **PDF 埋め込みフォント**: Zen Kaku Gothic New / Shippori Mincho / Zen Maru Gothic
  (いずれも Licensed under [SIL Open Font License 1.1](https://scripts.sil.org/OFL))。
  `google/fonts` リポジトリの各フォントディレクトリから取得し、`public/fonts/` に
  自前ホスト。
* **主要ライブラリ**: React, Vite, Tone.js, jsPDF, svg2pdf.js, qr

アプリのアイコンや画面・PDF の記号は本ツール用に作成したもので、ゲームから抽出した
画像・音声・フォントは使用していません。「Sky: 星を紡ぐ子どもたち」に関する権利は
thatgamecompany, inc. に帰属します。「QRコード」は株式会社デンソーウェーブの登録商標です。

本リポジトリのソースコードは MIT License の下で公開されています。
ただし、フォントファイル（`public/fonts/` 配下の3書体、`@fontsource/noto-sans-jp`）
および音源データ（`public/audio/salamander/`）については、それぞれの権利者が定める
ライセンス（SIL OFL 1.1、CC BY 3.0）が適用されます。

## 第三者ライセンス通知

本番依存パッケージの推移依存を含むソフトウェア、画面表示用フォント、PDF用フォント、
音源の著作権表示とライセンス本文は、[第三者ライセンス通知](public/legal/THIRD_PARTY_NOTICES.txt)
にまとめています。この通知文書を、公開サイトでは `/legal/THIRD_PARTY_NOTICES.txt` から
同一オリジンで参照できます。通知文書には本アプリ本体のMIT Licenseは含まれないため、
本アプリ本体にはルートの `LICENSE` が適用されます。
