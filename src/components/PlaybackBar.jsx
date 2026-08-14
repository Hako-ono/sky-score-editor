export default function PlaybackBar({
  playbackState,
  onTogglePlayPause,
  onStop,
  isAutoScroll,
  setIsAutoScroll,
}) {
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
            ? '一時停止'
            : playbackState === 'paused'
              ? '再開'
              : '最初から再生'}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onStop}
          disabled={playbackState === 'stopped'}
        >
          停止
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
          title="再生中のグリッドを画面中央に自動スクロールします"
        >
          追尾
        </button>
      </div>
    </div>
  );
}
