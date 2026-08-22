import { useT } from '../i18n/LanguageContext.jsx';
import {
  AutoScrollIcon,
  CloseIcon,
  LoopIcon,
  PauseIcon,
  PlayIcon,
  StopIcon,
  ToStartIcon,
} from './icons.jsx';
import PlaybackAidsPanel from './PlaybackAidsPanel.jsx';
import { useRangeSelectionState } from '../contexts/RangeSelectionContext.jsx';
import { selectedRange } from '../lib/rangeSelectionStore.js';

export default function PlaybackBar({
  playbackState,
  onTogglePlayPause,
  onStop,
  onToStart,
  isAutoScroll,
  onToggleAutoScroll,
  loopEnabled,
  onToggleLoop,
  countInBeat,
  playbackAids,
  onSetPlaybackAids,
}) {
  const t = useT();
  const isPlaying = playbackState === 'playing';
  const isPaused = playbackState === 'paused';
  const isCounting = playbackState === 'counting';
  const rangeState = useRangeSelectionState();
  const range = selectedRange(rangeState);
  const isAtStart = range === null && rangeState.caretIndex === 0;
  const loopLabel = t('ui.range.wholeLoopTitle');
  const playLabel = isPlaying
    ? t('ui.playbackBar.pause')
    : isPaused
      ? t('ui.playbackBar.resume')
      : t(range ? 'ui.playbackBar.playSelection' : 'ui.playbackBar.playFromCaret');

  return (
    <div className="playback-bar">
      <div className="playback-bar__status">
        {isCounting ? (
          <div className="playback-bar__countin">
            <span>{t('ui.playbackAids.countIn')}</span>
            <strong aria-hidden="true">{countInBeat ?? ''}</strong>
          </div>
        ) : null}
      </div>
      <div className="playback-bar__console">
        <div className="playback-bar__transport">
          <button
            type="button"
            className={`btn playback-bar__play${
              isCounting ? ' playback-bar__play--counting' : ' btn--primary'
            }`}
            onClick={isCounting ? onStop : onTogglePlayPause}
            aria-label={isCounting ? t('ui.playbackAids.cancel') : playLabel}
            title={isCounting ? t('ui.playbackAids.cancel') : playLabel}
          >
            {isCounting
              ? <CloseIcon size={22} />
              : isPlaying
                ? <PauseIcon size={22} />
                : <PlayIcon size={22} />}
          </button>
          <button
            type="button"
            className={`btn playback-bar__icon playback-bar__stop${
              isCounting ? ' playback-bar__stop--placeholder' : ''
            }`}
            onClick={isPlaying || isPaused ? onStop : onToStart}
            disabled={isCounting || (playbackState === 'stopped' && isAtStart)}
            aria-label={t(isPlaying || isPaused
              ? 'ui.playbackBar.stop'
              : 'ui.playbackBar.toStart')}
            title={t(isPlaying || isPaused
              ? 'ui.playbackBar.stop'
              : 'ui.playbackBar.toStart')}
          >
            {isPlaying || isPaused
              ? <StopIcon size={20} />
              : <ToStartIcon size={20} />}
          </button>
        </div>
        <span className="v-sep" aria-hidden="true" />
        <div className="playback-bar__modes">
          <button
            type="button"
            className="btn btn--toggle playback-bar__icon playback-bar__loop"
            onClick={onToggleLoop}
            aria-pressed={loopEnabled}
            aria-label={loopLabel}
            title={loopLabel}
          >
            <LoopIcon size={20} />
          </button>
          <span className="v-sep" aria-hidden="true" />
          <button
            type="button"
            className="btn btn--toggle playback-bar__icon"
            onClick={onToggleAutoScroll}
            aria-pressed={isAutoScroll}
            aria-label={t('ui.playbackBar.autoScroll')}
            title={t('ui.playbackBar.autoScrollTitle')}
          >
            <AutoScrollIcon size={20} />
          </button>
          <PlaybackAidsPanel settings={playbackAids} onChange={onSetPlaybackAids} />
        </div>
      </div>
    </div>
  );
}
