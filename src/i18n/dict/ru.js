// Full dictionary with the same key structure as ja.js.
export default {
  "ui": {
    "toolbar": {
      "brand": "Sky",
      "brandJp": "Редактор нот",
      "openScore": "Открыть ноты",
      "newScore": "Создать",
      "notLoaded": "Не загружено",
      "theme": {
        "system": "Системная",
        "light": "Светлая",
        "dark": "Тёмная",
        "select": "Выбрать тему оформления",
        "menu": "Тема оформления",
        "current": "{label} (текущая тема)",
        "switch": "Переключить на {label}"
      },
      "language": {
        "auto": "Авто (настройки устройства)",
        "autoShort": "Авто",
        "select": "Выбрать язык интерфейса",
        "menu": "Язык интерфейса",
        "current": "{label} (текущий язык)",
        "switch": "Переключить на {label}"
      },
      "expandToolbar": "Развернуть",
      "minimizeToolbar": "Свернуть",
      "expandMenu": "Развернуть меню",
      "minimizeMenu": "Свернуть меню",
      "tabs": "Панель инструментов",
      "scoreTab": "Ноты",
      "outputTab": "Экспорт",
      "score": {
        "info": "Данные песни",
        "title": "Название",
        "author": "Композитор",
        "lyricist": "Автор текста",
        "transcribedBy": "Автор",
        "transcribedByPlaceholder": "Автор партитуры",
        "playback": "Настройки воспроизведения",
        "bpm": "BPM",
        "timeSignature": "Размер",
        "fourBeats": "4 доли",
        "threeBeats": "3 доли",
        "unsetBeats": "Не задано",
        "pitch": "Тональность",
        "keyMode": "Лад",
        "actions": "Изменение и сохранение",
        "undo": "Отменить",
        "undoTitle": "Отменить (Ctrl+Z)",
        "redo": "Повторить",
        "redoTitle": "Повторить (Ctrl+Shift+Z)",
        "toggleLayer": "Сменить слой",
        "finishGridEdit": "Завершить редактирование",
        "toggleGridEdit": "Добавить или удалить сетки",
        "clear": "Очистить всё",
        "unsaved": "Есть несохранённые изменения",
        "saveJson": "Сохранить JSON"
      },
      "pdf": {
        "section": {
          "design": "Дизайн",
          "typography": "Типографика",
          "scoreInfo": "Данные песни",
          "page": "Страница",
          "paper": "Бумага"
        },
        "colorsAndBackground": "Цвета и фон",
        "colors": "Используемые цвета",
        "custom": "Свои",
        "preset": {
          "standardGroup": "Стандарт",
          "lightGroup": "Сезонные · светлые",
          "darkGroup": "Сезонные · тёмные"
        },
        "editFinished": "Завершить редактирование",
        "editDetails": "Изменить отдельные цвета",
        "resetColors": "Вернуть цвета по умолчанию",
        "palette": {
          "basic": "Основные цвета",
          "detail": "Детальные цвета",
          "edit": "Выберите цвет для изменения",
          "viewOnly": "Только просмотр",
          "background": "Фон",
          "ink": "Типографика",
          "line": "Линия",
          "surface": "Поверхность клавиш",
          "accent": "Поверхность нажатых клавиш",
          "accentLine": "Рамка нажатых клавиш",
          "accentLayer1": "Поверхность нажатых клавиш 1",
          "accentLineLayer1": "Рамка нажатых клавиш 1",
          "accentLayer2": "Поверхность нажатых клавиш 2",
          "accentLineLayer2": "Рамка нажатых клавиш 2",
          "advanced": "Дополнительные цвета",
          "token": {
            "title": "Название песни",
            "outerFrame": "Рамка сетки",
            "symbol": "Символ",
            "number": "Номер сетки",
            "symbolHighlight": "Символ нажатых клавиш",
            "symbolHighlightLayer1": "Символ нажатых клавиш 1",
            "symbolHighlight2": "Символ нажатых клавиш 2"
          }
        },
        "background": {
          "label": "Фоновое изображение",
          "select": "Выбрать фоновое изображение",
          "selectFile": "Выбрать файл",
          "changeOrRemove": "Изменить или убрать фон",
          "previewAlt": "Предпросмотр фона",
          "change": "Изменить",
          "remove": "Убрать",
          "opacity": "Непрозрачность"
        },
        "note": {
          "darkBackground": "Заливка всей страницы увеличит расход чернил при печати.",
          "contrast": "Цвет фона и текста близки, текст может быть плохо читаем.",
          "mincho": "При первой генерации PDF будет загружено около 8 МБ.",
          "lyricOverflow": "При большем значении символы с наложенными знаками гласных и тонов (สระ, วรรณยุกต์) могут выходить за пределы сетки. Значение по умолчанию — {percent}%."
        },
        "preview": {
          "open": "Открыть увеличенный вид",
          "sync": "Синхронизация",
          "synced": "Актуально",
          "update": "Обновить",
          "updating": "Обновление…",
          "stale": "Настройки изменились. Нажмите «Обновить», чтобы применить.",
          "empty": "Предпросмотр появится после загрузки партитуры.",
          "failed": "Не удалось создать предпросмотр. ({message})",
          "qualityNote": "Предпросмотр имеет более низкое качество, чем настоящий PDF."
        },
        "grid": {
          "title": "Сетка",
          "design": "Дизайн сетки",
          "customSettings": "Свои настройки",
          "reset": "Вернуть значения по умолчанию",
          "number": "Номер сетки",
          "numberAria": "Показ номера сетки",
          "customRadius": "Скругление",
          "customStroke": "Толщина линии",
          "outerRadius": "Скругление внешней рамки",
          "cellRadius": "Скругление клавиш",
          "symbolRadius": "Скругление символов",
          "outerStrokeWidth": "Толщина внешней рамки",
          "cellStrokeWidth": "Толщина линий клавиш",
          "symbolStrokeWidth": "Толщина линий символов"
        },
        "typography": {
          "font": "Шрифт",
          "weight": "Начертание",
          "titleSize": "Название (pt)",
          "metaSize": "Данные песни (pt)",
          "lyricSize": "Текст песни (%)"
        },
        "scoreInfo": {
          "design": "Дизайн данных песни",
          "direction": "Направление",
          "directionAria": "Направление простой компоновки",
          "tempoValue": "Значение ♩",
          "customValue": "Своё значение",
          "keyNotation": "Обозначение тональности",
          "keyModeNotation": "Обозначение лада"
        },
        "page": {
          "number": "Номер страницы",
          "numberPosition": "Положение номера страницы",
          "numberSize": "Размер номера страницы (pt)",
          "runningHeader": "Колонтитул",
          "footer": "Нижний колонтитул"
        },
        "paper": {
          "sheetLayout": "Размещение страниц",
          "maxRows": "Строк на странице",
          "columns": "Столбцов на странице",
          "rowShading": "Затемнять чётные строки",
          "rowShadingAria": "Затенение чётных строк",
          "margin": "Поля",
          "gap": "Интервал сетки"
        },
        "pngDpi": "Разрешение PNG",
        "pngDpiOption": "{dpi}dpi",
        "actionNote": "Если новая вкладка не открывается, PDF будет скачан.",
        "exportSettings": "Экспортировать настройки",
        "importSettings": "Импортировать настройки",
        "processing": "Обработка…",
        "generate": "Создать PDF",
        "generatePng": "Создать PNG",
        "selectFormat": "Выбрать формат экспорта",
        "autoColumns": "{label} ({n} столбцов)"
      }
    },
    "progress": {
      "fontLoading": "Загрузка {font}...",
      "pageGenerating": "Создание страницы PDF {page} / {total}...",
      "pngBuilding": "Создание PNG (1/2): сборка страницы {page} / {total}...",
      "pngRendering": "Создание PNG (2/2): запись страницы {page} / {total}...",
      "pngZipping": "Сборка ZIP..."
    },
    "pdfExport": {
      "error": {
        "noData": "Нет данных для создания PDF.",
        "fontFetch": "Не удалось загрузить шрифт ({status})",
        "fontFormat": "Не удалось загрузить шрифт (неверный формат)"
      }
    },
    "pdfPresetCodec": {
      "field": {
        "name": "Название",
        "memo": "Заметка"
      },
      "error": {
        "field-too-large": "{field} слишком длинное.",
        "invalid-utf8": "Неверная кодировка данных настроек.",
        "base64-encode-failed": "Не удалось создать код настроек.",
        "invalid-base64": "Неверные данные кода настроек.",
        "compressed-too-large": "Данные кода настроек слишком большие.",
        "invalid-input": "Не удалось прочитать код настроек.",
        "input-too-large": "Код настроек слишком длинный.",
        "invalid-code": "Неверный формат кода настроек.",
        "json-too-large": "Распакованные данные слишком большие.",
        "json-too-large-input": "Данные настроек слишком большие.",
        "unsupported-browser": "Для распаковки нужны более новые браузер и функции.",
        "invalid-gzip": "Не удалось распаковать код настроек.",
        "invalid-settings": "Неверный формат данных настроек.",
        "invalid-settings-group": "Неверный формат данных настроек.",
        "invalid-json": "Неверный JSON данных настроек.",
        "invalid-json-format": "Неверный формат данных настроек.",
        "unsupported-version": "Неподдерживаемая версия настроек.",
        "invalid-location": "Не удалось создать URL для настроек."
      }
    },
    "pdfPresetDialog": {
      "error": {
        "inputTooLarge": "URL сохранения и обмена слишком длинный.",
        "invalidInput": "Не удалось прочитать URL сохранения и обмена.",
        "invalidCode": "Неверный формат URL сохранения и обмена.",
        "invalidBase64": "Неверные данные настроек в URL.",
        "compressedTooLarge": "Данные настроек в URL слишком большие.",
        "jsonTooLarge": "Распакованные данные слишком большие.",
        "invalidUtf8": "Неверная кодировка данных настроек.",
        "invalidJson": "Неверный JSON данных настроек.",
        "invalidSettings": "Неверный формат данных настроек.",
        "invalidSettingsGroup": "Неверный формат данных настроек.",
        "unsupportedVersion": "Это настройки более новой версии.",
        "unsupportedBrowser": "Для распаковки настроек из этого URL нужен более новый браузер.",
        "foreignOrigin": "Нельзя загружать URL настроек с другого сайта.",
        "notPdfPreset": "Не удалось прочитать URL настроек PDF.",
        "qrNotFound": "Не удалось найти QR-код на изображении.",
        "decodeFailed": "Не удалось прочитать изображение.",
        "canvasFailed": "Не удалось обработать изображение.",
        "unsupportedType": "Выберите изображение PNG, JPEG или WebP.",
        "fileTooLarge": "Файл изображения слишком большой (максимум 10 МиБ).",
        "encodeFailed": "Не удалось создать QR-карточку. Используйте URL сохранения и обмена.",
        "drawFailed": "Не удалось показать QR-карточку. Используйте URL сохранения и обмена.",
        "saveFailed": "Не удалось сохранить QR-карточку в PNG.",
        "exportCode": "Не удалось создать URL сохранения и обмена.",
        "exportQr": "Не удалось показать QR-карточку.",
        "importCode": "Не удалось загрузить URL сохранения и обмена.",
        "importQr": "Не удалось загрузить настройки PDF из изображения."
      },
      "copy": {
        "success": "{label} скопировано.",
        "failure": "Не удалось скопировать. Выберите текст в поле ниже и скопируйте его."
      },
      "title": {
        "export": "Экспортировать настройки PDF",
        "import": "Импортировать настройки PDF"
      },
      "close": "Закрыть",
      "loading": "Загрузка…",
      "exportLead": "Экспортируйте текущие настройки PDF в виде URL или QR-кода. Оба содержат одни и те же настройки.",
      "info": "Данные пресета",
      "name": "Название пресета",
      "memo": "Заметка",
      "exportHint": "В URL и QR-код входят название и заметка пресета. Учитывайте это при обмене.",
      "qrCard": "QR-карточка",
      "qrUpdate": "Обновление URL и QR-карточки…",
      "qrCardAria": "QR-карточка настроек PDF",
      "saveQrCard": "Сохранить QR-карточку",
      "pngHint": "Можно сохранить и поделиться как PNG.",
      "shareUrl": "URL сохранения и обмена",
      "copyUrl": "Скопировать URL",
      "shareHint": "URL можно сохранить в заметках; при открытии появится экран загрузки настроек.",
      "manualCopy": "URL сохранения и обмена для ручного копирования",
      "exportNote": "URL и QR-код не содержат данные песни и фоновое изображение.",
      "importLead": "Импортируйте настройки PDF из URL или изображения QR-карточки.",
      "source": "Источник",
      "loadUrl": "Загрузить URL",
      "chooseQr": "Выбрать изображение QR",
      "importHint": "Можно загрузить сохранённый PNG QR-карточки. Изображение обрабатывается только на устройстве.",
      "review": "Загруженные настройки",
      "nameValueEmpty": "(Без названия)",
      "memoValueEmpty": "(Без заметки)",
      "diff": "Отличия настроек",
      "diffChange": "{label}：{current} → {imported}",
      "diffEmpty": "Настройки совпадают с текущими.",
      "unchanged": "Без изменений: {labels}",
      "importNote": "Применение настроек не изменит данные песни и фоновое изображение.",
      "cancel": "Отмена",
      "apply": "Применить"
    },
    "siteFooter": {
      "lead": "Это неофициальный фанатский инструмент для «Sky: Children of the Light». Он не связан с thatgamecompany, inc.",
      "originalNotice": "Оригинал: японский",
      "navAria": "Дополнительные ссылки",
      "sourceCode": "Исходный код (GitHub)",
      "github": "GitHub",
      "mitLicense": "MIT License",
      "thirdPartyLicenses": "Лицензии третьих сторон",
      "inquiry": "Связаться (X @Hako_ono_sky)",
      "usageSummary": "Об использовании",
      "usage": {
        "purpose": "Этот инструмент создаёт и редактирует ноты для 15 клавиш Sky и экспортирует их в PDF или JSON.",
        "sharing": "При публикации или обмене нотами, текстом или изображениями проверьте правила исходного произведения и площадки.",
        "autosave": "Изменения автоматически сохраняются в браузере, но могут исчезнуть при очистке данных, в приватном режиме или при нехватке места. Для сохранения используйте «Сохранить JSON» и сохраните файл на устройстве.",
        "disclaimer": "Инструмент бесплатно публикуется частным лицом. Непрерывная работа и точность результатов не гарантируются; ответственность за ущерб от использования не принимается, кроме случаев, предусмотренных законом."
      },
      "changelogSummary": "История обновлений",
      "changelog": {
        "olderSummary": "Более ранние обновления ({n})",
        "kind": {
          "feature": "Новое",
          "improve": "Улучшение",
          "fix": "Исправление"
        }
      },
      "privacySummary": "Конфиденциальность · хранение на устройстве",
      "privacy": {
        "processing": "JSON нот, фоновые изображения PDF и QR-изображения для настроек обрабатываются только в браузере и не загружаются на сервер.",
        "storage": "localStorage хранит черновик, тему, настройки PDF и язык интерфейса. Фон PDF не сохраняется, поэтому выбирайте его заново при каждом экспорте. Только при наличии {debugQuery} в URL последние диагностические измерения сохраняются в sessionStorage (удаляются при закрытии вкладки).",
        "presetSharing": "URL сохранения и QR-карточка настроек PDF создаются в браузере из настроек, названия пресета и заметки в виде сжатого JSON. Других данных там нет: ноты и фон не включаются. Настройки находятся после «#» в URL и не отправляются на сервер. При передаче URL передаются также название пресета и заметка.",
        "noTracking": "Инструмент не использует cookie, рекламу и аналитику посещений.",
        "cloudflare": "Сайт размещён на Cloudflare Pages. При загрузке страниц и файлов Cloudflare может обрабатывать данные запроса, например IP-адрес, но содержимое JSON нот, фона, QR-изображений и настроек PDF не отправляется в Cloudflare.",
        "deleteDraft": "«Удалить черновик» удаляет только черновик нот. Чтобы удалить тему, язык и настройки PDF, используйте очистку данных сайта в браузере. На общем устройстве рекомендуется сделать это после использования."
      },
      "deleteDraftButton": "Удалить черновик",
      "deleteDraftTitle": "Удаление сохранённого черновика",
      "noDraftTitle": "Нет черновика для удаления",
      "licenseSummary": "Материалы · лицензии",
      "license": {
        "source": "Исходный код инструмента опубликован на {github} по лицензии {license}. Его можно копировать, изменять, распространять и использовать в коммерческих целях при сохранении уведомления об авторских правах и текста лицензии. Для указанных звуков и шрифтов действуют лицензии правообладателей (CC BY 3.0, SIL OFL 1.1).",
        "audio": "Звук: Salamander Grand Piano V3 by Alexander Holm (CC BY 3.0).",
        "screenFont": "Шрифт интерфейса: Noto Sans JP (SIL Open Font License 1.1).",
        "pdfFont": "Шрифты, встраиваемые в PDF: Zen Kaku Gothic New, Shippori Mincho, Zen Maru Gothic, DM Sans, Sarasa Gothic SC, Taipei Sans TC, Chiron Hei HK, Wanted Sans, IBM Plex Sans Thai Looped, Be Vietnam Pro и Golos Text (все по SIL Open Font License 1.1).",
        "pdfjs": "Для экспорта в PNG используется Mozilla PDF.js (Apache License 2.0).",
        "localAssets": "Звуки и шрифты размещены на этом сайте и не загружаются с внешних серверов. В экспортируемый PDF встраиваются данные выбранного шрифта (SIL Open Font License 1.1 разрешает встраивание в документы).",
        "rights": "Иконки и символы интерфейса и PDF созданы для этого инструмента либо взяты из общедоступного SVG Wikimedia Commons для смены языка. Из игры не извлекались изображения, звуки и шрифты. Права на «Sky: Children of the Light» принадлежат thatgamecompany, inc.",
        "qrTrademark": "«QR Code» — зарегистрированный товарный знак DENSO WAVE INCORPORATED.",
        "notice": "Уведомления об авторских правах и тексты лицензий используемого ПО и материалов собраны в {noticeLink}.",
        "noticeLink": "Уведомления о лицензиях третьих сторон"
      },
      "note": "Сообщайте об ошибках, вопросах прав и исправлениях лицензий ответом или в DM для {inquiry} в X. Ответы публичны, поэтому личные и непубличные сведения отправляйте в DM. Прикладывайте только ноты, тексты и изображения, которыми вы вправе делиться.",
      "inquiryLink": "@Hako_ono_sky",
      "copyright": "© 2026 Hako · Выпущено по лицензии {license}"
    },
    "app": {
      "documentTitle": "{title} — Редактор нот Sky",
      "documentTitleDefault": "Редактор нот Sky",
      "maxGrids": "Нельзя добавить: достигнут предел сеток ({n}).",
      "autosaveFailed": "Не удалось автоматически сохранить изменения в браузере. Возможно, включён приватный режим или не хватает места. Сохраните копию через «Сохранить JSON».",
      "fileTooLarge": "Файл слишком большой (максимум 10 МБ).",
      "fileType": "Выберите файл JSON (.json) или текстовый файл (.txt).",
      "loadingFile": "Загрузка файла…",
      "loaded": "Загрузка завершена (всего сеток: {n}) — {warning}",
      "loadFailed": "Не удалось загрузить ({message})",
      "confirmNew": "Есть несохранённые изменения. Создать новый файл?",
      "confirmOpen": "Есть несохранённые изменения. Открыть другой файл?",
      "confirmClearDirty": "Есть несохранённые изменения. Очистить всё?",
      "confirmClear": "Все текущие ноты будут удалены. Продолжить?",
      "cleared": "Ноты удалены.",
      "confirmDeleteDraft": "Удалить черновик, сохранённый в браузере?",
      "saveFailed": "Не удалось сохранить ({message})",
      "loadingBackground": "Загрузка фонового изображения…",
      "backgroundFailed": "Не удалось загрузить фоновое изображение.",
      "pdfOpened": "PDF открыт в новой вкладке ({filename})",
      "pdfDownloaded": "PDF скачан ({filename})",
      "pdfFailed": "Не удалось создать PDF ({message})",
      "pngDownloaded": "PNG скачан ({filename})",
      "pngFailed": "Не удалось создать PNG ({message})",
      "pngTooLarge": "Общий размер PNG превысил допустимый предел. Уменьшите разрешение или число страниц.",
      "editFinish": "Завершить редактирование"
    },
    "gridCard": {
      "playFromTitle": "Воспроизвести отсюда",
      "playFrom": "Воспроизвести с сетки {n}",
      "playSingleTitle": "Воспроизвести только эту сетку",
      "playSingle": "Воспроизвести только сетку {n}",
      "layerSwitch": "Сменить слой",
      "breakOn": "Перенести строку после сетки {n}",
      "breakOff": "Убрать перенос после сетки {n}",
      "breakTitle": "Перенести строку после этой сетки",
      "delete": "Удалить сетку {n}",
      "deleteTitle": "Удалить эту сетку",
      "expand": "Развернуть сетку {n}",
      "text": "Текст сетки {n}"
    },
    "gridOverlay": {
      "grid": "Сетка {n}",
      "previous": "Предыдущая сетка",
      "next": "Следующая сетка",
      "close": "Закрыть увеличенный просмотр"
    },
    "playbackBar": {
      "pause": "Пауза",
      "resume": "Продолжить",
      "restart": "Воспроизвести с начала",
      "stop": "Стоп",
      "autoScroll": "Следить",
      "autoScrollTitle": "Автоматически прокручивать воспроизводимую сетку к центру экрана"
    },
    "emptyState": {
      "title": "Нот пока нет",
      "body": "Загрузите существующие ноты через «Открыть ноты». Пустой файл создаётся кнопкой «Создать» на панели инструментов.",
      "hint": "После создания откроется режим редактирования. Нажимайте клавиши на сетке, чтобы добавлять ноты.",
      "restoreDraft": "Восстановить прошлую работу"
    },
    "scrollTopFab": {
      "backToTop": "Вернуться наверх"
    },
    "noteGrid": {
      "ariaLabel": "Сетка из 15 клавиш",
      "key": "Клавиша {n}",
      "keyWithPosition": "Клавиша {n} ({position})",
      "keyPosition": {
        "0": "Сверху слева",
        "1": "",
        "2": "",
        "3": "",
        "4": "Сверху справа",
        "5": "",
        "6": "",
        "7": "По центру",
        "8": "",
        "9": "",
        "10": "Снизу слева",
        "11": "",
        "12": "",
        "13": "",
        "14": "Снизу справа"
      },
      "selectedAndOther": "Выбранный и остальные слои",
      "selected": "Выбранный слой",
      "other": "Остальные слои",
      "on": "Вкл.",
      "off": "Выкл.",
      "membership": "（{value}）",
      "label": "{key} {state}{membership}"
    },
    "scoreCanvas": {
      "list": "Список сеток нот",
      "insertBefore": "Вставить перед сеткой {n}",
      "insertAfter": "Вставить после сетки {n}"
    },
    "statusBar": {
      "close": "Закрыть уведомление"
    },
    "errorBoundary": {
      "title": "При отображении произошла ошибка",
      "body": "Данные повреждены или произошла непредвиденная ошибка.",
      "reload": "Перезагрузить страницу"
    },
    "keyMode": {
      "major": "Мажор",
      "minor": "Минор"
    },
    "pdfPreset": {
      "group": {
        "design": "Дизайн",
        "typography": "Типографика",
        "scoreInfo": "Данные песни",
        "page": "Страница",
        "paper": "Бумага"
      },
      "diff": {
        "presetId": "Цветовая схема",
        "custom": "Своя цветовая схема",
        "gridStyleId": "Форма сетки",
        "customTokens": "Дополнительные цвета",
        "gridStyleCustom": "Параметры формы",
        "gridNumberDisplayId": "Номер сетки",
        "fontId": "Шрифт",
        "fontWeightId": "Начертание",
        "titleFontSizePt": "Размер названия",
        "metaFontSizePt": "Размер данных песни",
        "lyricSizePercent": "Размер текста песни",
        "gridNumberSizePercent": "Размер номера",
        "scoreInfoDesignId": "Дизайн данных песни",
        "mastheadDirectionId": "Направление заголовка",
        "tempoValueModeId": "Значение ♩",
        "customTempoValue": "Своё значение",
        "keyNotationId": "Обозначение тональности",
        "keyModeNotationId": "Обозначение лада",
        "pageNumberFormatId": "Номер страницы",
        "pageNumberPositionId": "Положение номера страницы",
        "pageNumberFontSizePt": "Размер номера страницы",
        "runningHeaderId": "Колонтитул",
        "footerCreditId": "Нижний колонтитул",
        "sheetLayoutId": "Размещение страниц",
        "maxRowsPerPage": "Строк на странице",
        "columnsPerPageId": "Столбцов на странице",
        "rowShadingId": "Затемнять чётные строки",
        "pageMarginId": "Поля",
        "gridGapId": "Интервал сетки"
      },
      "value": {
        "custom": "Свои",
        "customPalette": "Своя цветовая схема",
        "customAdvancedPalette": "Настройка дополнительных цветов",
        "customShape": "Своя форма",
        "preset": {
          "print": "Для печати",
          "springLight": "Весна · светлая",
          "summerLight": "Лето · прохладная",
          "autumnLight": "Осень · тёплая",
          "winterLight": "Зима · снежная",
          "springDark": "Весна · вечерняя",
          "summerDark": "Лето · ночная",
          "autumnDark": "Осень · сумеречная",
          "winterDark": "Зима · ясная"
        },
        "gridStyle": {
          "standard": "Стандарт",
          "soft": "Мягкая",
          "bold": "Массивная",
          "minimal": "Минималистичная"
        },
        "gridNumber": {
          "show": "Показать",
          "none": "Нет"
        },
        "font": {
          "gothic": "Готический",
          "mincho": "Минчо",
          "rounded": "Округлый готический",
          "dmSans": "DM Sans",
          "sarasaSC": "Sarasa Gothic SC",
          "taipeiTC": "Taipei Sans TC",
          "chironHK": "Chiron Hei HK",
          "wantedSans": "Wanted Sans"
        },
        "fontWeight": {
          "regular": "Стандарт",
          "bold": "Жирный"
        },
        "scoreInfoDesign": {
          "score": "Ноты",
          "masthead": "Простая",
          "specSheet": "Подробная",
          "cover": "Обложка"
        },
        "mastheadDirection": {
          "left": "Слева",
          "right": "Справа"
        },
        "tempoValueMode": {
          "quarter": "Значение BPM ÷ 4",
          "half": "Значение BPM ÷ 2",
          "custom": "Свои"
        },
        "keyNotation": {
          "both": "Оба варианта",
          "sharp": "#",
          "flat": "♭"
        },
        "keyModeNotation": {
          "compact": {
            "major": "Нет",
            "minor": "m"
          },
          "english": {
            "major": "major",
            "minor": "minor"
          },
          "japanese": {
            "major": "Мажор",
            "minor": "Минор"
          },
          "traditional": {
            "major": "Мажор (японская запись)",
            "minor": "Минор (японская запись)"
          }
        },
        "pageNumberFormat": {
          "currentTotal": "n / N",
          "current": "n",
          "none": "Нет"
        },
        "pageNumberPosition": {
          "bottomCenter": "По центру",
          "bottomLeft": "Слева",
          "bottomRight": "Справа",
          "bottomOuter": "Внешний край разворота",
          "bottomInner": "Внутренний край разворота"
        },
        "runningHeader": {
          "none": "Нет",
          "title": "Название"
        },
        "footerCredit": {
          "none": "Нет",
          "transcribedBy": "Автор партитуры"
        },
        "sheetLayout": {
          "single": "1 страница на лист",
          "double": "2 страницы на лист"
        },
        "columnsPerPage": {
          "auto": "По размеру",
          "col2": "2 столбца",
          "col3": "3 столбца",
          "col4": "4 столбца",
          "col5": "5 столбцов",
          "col6": "6 столбцов",
          "col7": "7 столбцов",
          "col8": "8 столбцов"
        },
        "rowShading": {
          "none": "Отключено",
          "even": "Включено"
        },
        "margin": {
          "narrow": "Узкие",
          "standard": "Стандарт",
          "wide": "Широкие"
        },
        "gap": {
          "tight": "Плотнее",
          "standard": "Стандарт",
          "loose": "Шире"
        },
        "points": "{value}pt",
        "percent": "{value}%",
        "rows": "{value} строк"
      }
    }
  },
  "pdf": {
    "sheet": {
      "credit": {
        "composer": "Композитор: {value}",
        "lyricist": "Автор текста: {value}",
        "transcribedBy": "Автор партитуры: {value}"
      },
      "composer": "Композитор",
      "lyricist": "Автор текста",
      "transcribedBy": "Автор партитуры",
      "tempo": "Темп",
      "meter": "Размер",
      "key": "Тональность",
      "meterValue": "{beats} доли"
    },
    "margin": {
      "narrow": "Узкие",
      "standard": "Стандарт",
      "wide": "Широкие"
    },
    "gap": {
      "tight": "Плотнее",
      "standard": "Стандарт",
      "loose": "Шире"
    },
    "preset": {
      "print": "Для печати",
      "springLight": "Весна · светлая",
      "summerLight": "Лето · прохладная",
      "autumnLight": "Осень · тёплая",
      "winterLight": "Зима · снежная",
      "springDark": "Весна · вечерняя",
      "summerDark": "Лето · ночная",
      "autumnDark": "Осень · сумеречная",
      "winterDark": "Зима · ясная"
    },
    "font": {
      "gothic": "Готический",
      "mincho": "Минчо",
      "rounded": "Округлый готический",
      "dmSans": "DM Sans",
      "sarasaSC": "Sarasa Gothic SC",
      "taipeiTC": "Taipei Sans TC",
      "chironHK": "Chiron Hei HK",
      "wantedSans": "Wanted Sans",
      "plexThaiLooped": "IBM Plex Sans Thai Looped",
      "beVietnamPro": "Be Vietnam Pro",
      "golosText": "Golos Text"
    },
    "fontWeight": {
      "regular": "Стандарт",
      "bold": "Жирный"
    },
    "gridNumber": {
      "show": "Показать",
      "none": "Нет"
    },
    "sheetLayout": {
      "single": "1 страница на лист",
      "double": "2 страницы на лист"
    },
    "columnsPerPage": {
      "auto": "По размеру",
      "col2": "2 столбца",
      "col3": "3 столбца",
      "col4": "4 столбца",
      "col5": "5 столбцов",
      "col6": "6 столбцов",
      "col7": "7 столбцов",
      "col8": "8 столбцов"
    },
    "rowShading": {
      "none": "Отключено",
      "even": "Включено"
    },
    "firstPageLayout": {
      "editorial": "По левому краю",
      "classic": "По центру",
      "right": "По правому краю",
      "cover": "Отдельная обложка"
    },
    "scoreInfoFormat": {
      "standard": "Стандарт",
      "combined": "Сводный вид",
      "itemized": "По отдельным пунктам",
      "twoColumn": "В 2 столбца"
    },
    "scoreInfoDesign": {
      "score": "Ноты",
      "masthead": "Простая",
      "specSheet": "Подробная",
      "cover": "Обложка"
    },
    "mastheadDirection": {
      "left": "Слева",
      "right": "Справа"
    },
    "tempoValueMode": {
      "quarter": "Значение BPM ÷ 4",
      "half": "Значение BPM ÷ 2",
      "custom": "Свои"
    },
    "pageNumberFormat": {
      "currentTotal": "n / N",
      "current": "n",
      "none": "Нет"
    },
    "pageNumberPosition": {
      "bottomCenter": "По центру",
      "bottomLeft": "Слева",
      "bottomRight": "Справа",
      "bottomOuter": "Внешний край разворота",
      "bottomInner": "Внутренний край разворота"
    },
    "runningHeader": {
      "none": "Нет",
      "title": "Название"
    },
    "footerCredit": {
      "none": "Нет",
      "transcribedBy": "Автор партитуры"
    },
    "keyNotation": {
      "both": "Оба варианта",
      "sharp": "#",
      "flat": "♭"
    },
    "keyModeNotation": {
      "compact": {
        "major": "Нет",
        "minor": "m"
      },
      "english": {
        "major": "major",
        "minor": "minor"
      },
      "japanese": {
        "major": "Мажор",
        "minor": "Минор"
      },
      "traditional": {
        "major": "Мажор (японская запись)",
        "minor": "Минор (японская запись)"
      }
    },
    "gridStyle": {
      "standard": "Стандарт",
      "soft": "Мягкая",
      "bold": "Массивная",
      "minimal": "Минималистичная"
    }
  }
};
