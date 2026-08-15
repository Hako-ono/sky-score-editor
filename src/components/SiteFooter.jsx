const LICENSE_URL = `${import.meta.env.BASE_URL}legal/THIRD_PARTY_NOTICES.txt`;
const INQUIRY_URL = 'https://x.com/Hako_ono_sky';
const REPO_URL = 'https://github.com/Hako-ono/sky-score-editor';
const MIT_URL = `${REPO_URL}/blob/main/LICENSE`;

function SiteFooter({ hasDraft, onClearDraft }) {
  return (
    <footer className="site-footer">
      <p className="site-footer__lead">
        本ツールは「Sky: 星を紡ぐ子どもたち」を楽しむための非公式ファンメイドツールです。thatgamecompany, inc. とは関係ありません。
      </p>

      <nav className="site-footer__links" aria-label="補助リンク">
        <a href={REPO_URL} target="_blank" rel="noreferrer">ソースコード（GitHub）</a>
        <a href={MIT_URL} target="_blank" rel="noreferrer">MIT License</a>
        <a href={LICENSE_URL}>第三者ライセンス</a>
        <a href={INQUIRY_URL} target="_blank" rel="noreferrer">問い合わせ（X @Hako_ono_sky）</a>
      </nav>

      <details className="site-footer__details">
        <summary className="site-footer__summary">利用にあたって</summary>
        <div className="site-footer__content">
          <ul className="site-footer__list">
            <li>
              本ツールは、Skyの15鍵の楽譜をつくって編集し、PDFやJSONとして書き出すためのツールです。
            </li>
            <li>
              作った楽譜・歌詞・画像を公開・共有するときは、元になった作品や投稿先のガイドラインをご確認ください。
            </li>
            <li>
              編集内容はブラウザ内に自動保存されますが、ブラウザのデータ消去、プライベートブラウズ、保存容量の不足などで失われることがあります。残しておきたい楽譜は「JSONを保存」で、お使いの端末にもファイルとして保存してください。
            </li>
            <li>
              本ツールは個人が無償で公開しているものです。継続的な提供や動作、出力結果の正確さを保証するものではありません。本ツールの利用によって生じた損害については、法令上やむを得ない場合を除き責任を負いません。
            </li>
          </ul>
        </div>
      </details>

      <details className="site-footer__details">
        <summary className="site-footer__summary">プライバシー・端末内保存</summary>
        <div className="site-footer__content">
          <ul className="site-footer__list">
            <li>
              読み込んだ楽譜JSON、PDFの背景画像、設定を読み込むためのQR画像は、すべてお使いのブラウザの中だけで処理されます。これらがサーバーへアップロードされることはありません。
            </li>
            <li>
              ブラウザのlocalStorageには、楽譜の下書き・表示テーマ・PDF設定の3つを保存します。PDFの背景画像は保存しないため、出力のたびに選び直してください。URLに<code>?debug=1</code>を付けたときだけ、診断用の直近の計測値をsessionStorageに保存します（タブを閉じると消えます）。
            </li>
            <li>
              PDF設定の「保存・共有用URL」とQRカードは、ブラウザ内だけで作成します。含まれるのはPDFの出力設定と、入力したプリセット名・メモで、楽譜の内容や背景画像は含まれません。設定はURLの「#」以降に埋め込まれ、この部分はブラウザからサーバーへ送信されません。他の人に渡すとプリセット名・メモも一緒に渡ります。
            </li>
            <li>本ツールはCookie、広告、アクセス解析を使用していません。</li>
            <li>
              サイトの配信にはCloudflare Pagesを使用しています。ページやファイルを読み込む通信に伴い、IPアドレスなどのリクエスト情報をCloudflareが処理する場合があります。上に挙げた楽譜JSON・背景画像・QR画像・PDF設定の内容がCloudflareへ送られることはありません。
            </li>
            <li>
              「下書きを削除」で消えるのは楽譜の下書きだけです。テーマとPDF設定も消したい場合は、ブラウザのサイトデータ削除機能をお使いください。共用の端末では、使い終わったあとに削除することをおすすめします。
            </li>
          </ul>
          <p>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={onClearDraft}
              disabled={!hasDraft}
              title={hasDraft ? '保存されている下書きを削除します' : '削除できる下書きはありません'}
            >
              下書きを削除
            </button>
          </p>
        </div>
      </details>

      <details className="site-footer__details">
        <summary className="site-footer__summary">素材・ライセンス</summary>
        <div className="site-footer__content site-footer__credits">
          <ul className="site-footer__list">
            <li>
              本ツールのソースコードは
              <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a>
              で
              <a href={MIT_URL} target="_blank" rel="noreferrer">MIT License</a>
              のもとに公開しています。著作権表示とライセンス本文を残せば、複製・改変・再配布・商用利用ができます。以下の音源・フォントは、それぞれの権利者が定めるライセンス（CC BY 3.0、SIL OFL 1.1）に従ってください。
            </li>
            <li>
              音源: Salamander Grand Piano V3 by Alexander Holm（CC BY 3.0）。
            </li>
            <li>
              画面表示フォント: Noto Sans JP（SIL Open Font License 1.1）。
            </li>
            <li>
              PDF埋め込みフォント: Zen Kaku Gothic New・Shippori Mincho・Zen Maru Gothic（いずれもSIL Open Font License 1.1）。
            </li>
            <li>
              音源・フォントはいずれも本サイト内に置いており、外部のサーバーからは読み込みません。出力したPDFには、選んだ書体のデータが埋め込まれます（SIL Open Font License 1.1は文書への埋め込みを認めています）。
            </li>
            <li>
              アプリのアイコンや画面・PDFの記号は本ツール用に作成したもので、ゲームから抽出した画像・音声・フォントは使用していません。「Sky: 星を紡ぐ子どもたち」に関する権利は thatgamecompany, inc. に帰属します。
            </li>
            <li>「QRコード」は株式会社デンソーウェーブの登録商標です。</li>
            <li>
              本ツールが利用しているオープンソースソフトウェアと素材の著作権表示・ライセンス本文は、<a href={LICENSE_URL}>第三者ライセンス通知</a>にまとめています。
            </li>
          </ul>
        </div>
      </details>

      <p className="site-footer__note">
        不具合、権利に関するご連絡、ライセンス表記の訂正は、Xの<a href={INQUIRY_URL} target="_blank" rel="noreferrer">@Hako_ono_sky</a>へのリプライまたはDMでお知らせください。リプライは公開されるため、個人情報や公開したくない内容はDMをご利用ください。楽譜・歌詞・画像を添付する場合は、ご自身で共有できるものだけを選んでください。
      </p>

      <p className="site-footer__copyright">
        © 2026 Hako ・ Released under the{' '}
        <a href={MIT_URL} target="_blank" rel="noreferrer">MIT License</a>
      </p>
    </footer>
  );
}

export default SiteFooter;
