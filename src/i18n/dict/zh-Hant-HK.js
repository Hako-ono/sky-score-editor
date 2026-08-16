export default {
  ui: {
    toolbar: {
      pdf: {
        typography: {
          font: '字體',
          metaSize: '曲目資料（pt）',
        },
      },
    },
    siteFooter: {
      privacySummary: '私隱與本地儲存',
      privacy: {
        storage: '瀏覽器的 localStorage 會儲存四項內容：樂譜草稿、顯示主題、PDF 設定和顯示語言。PDF 背景圖片不會儲存，因此每次匯出都需要重新選擇。只有 URL 包含 {debugQuery} 時，最近的診斷測量值才會儲存到 sessionStorage；關閉分頁後會刪除。',
      },
      license: {
        screenFont: '螢幕字體：Noto Sans JP（SIL Open Font License 1.1）。',
      },
    },
    app: {
      documentTitle: '{title} - Sky 樂譜編輯器',
    },
    pdfPreset: {
      diff: {
        fontId: '字體',
        metaFontSizePt: '曲目資料大小',
      },
      value: {
        fontWeight: {
          regular: '標準',
        },
      },
    },
  },
  pdf: {
    fontWeight: {
      regular: '標準',
    },
  },
};
