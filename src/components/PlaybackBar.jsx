import { useT } from '../i18n/LanguageContext.jsx';

export default function PlaybackBar({
  playbackState,
  onTogglePlayPause,
  onStop,
  isAutoScroll,
  setIsAutoScroll,
}) {
  const t = useT();
  const isPlaying = playbackState === 'playing';

  return (
    <div className="playback-bar">
      <div className="playback-bar__transport">
        <button
          type="button"
          className="btn btn--lg btn--primary playback-bar__play"
          onClick={onTogglePlayPause}
        >
          {isPlaying
            ? t('ui.playbackBar.pause')
            : playbackState === 'paused'
              ? t('ui.playbackBar.resume')
              : t('ui.playbackBar.restart')}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onStop}
          disabled={playbackState === 'stopped'}
        >
          {t('ui.playbackBar.stop')}
        </button>
        <span className="v-sep" aria-hidden="true" />
        {/* 状態はラベルではなく押し込み表現で示す。ラベルに ON/OFF を
            持たせると「押すとどうなるか」と「今どうか」が混ざり、
            さらに文字数が変わってボタンの幅が動く */}
        <button
          type="button"
          className="btn btn--toggle"
          onClick={() => setIsAutoScroll(!isAutoScroll)}
          aria-pressed={isAutoScroll}
          title={t('ui.playbackBar.autoScrollTitle')}
        >
          {t('ui.playbackBar.autoScroll')}
        </button>
      </div>
    </div>
  );
}
