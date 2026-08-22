import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/LanguageContext.jsx';
import { PlaybackAidsIcon } from './icons.jsx';

function SegmentedControl({ label, value, options, onChange }) {
  return (
    <div className="playback-aids__field">
      <span className="playback-aids__label">{label}</span>
      <div className="playback-aids__segments" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            className="playback-aids__segment"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PlaybackAidsPanel({ settings, onChange }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscape, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape, true);
    };
  }, [open]);

  const update = (key, value) => onChange({ ...settings, [key]: value });
  const clicksAudible = settings.metronomeEnabled || settings.countInBars > 0;
  return (
    <div className="playback-aids" ref={rootRef}>
      <button
        type="button"
        className="btn btn--toggle playback-bar__icon playback-aids__trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t('ui.playbackAids.title')}
        title={t('ui.playbackAids.title')}
      >
        <PlaybackAidsIcon size={20} />
      </button>
      {open && (
        <div className="playback-aids__panel" role="dialog" aria-label={t('ui.playbackAids.title')}>
          <div className="playback-aids__heading">{t('ui.playbackAids.title')}</div>
          <SegmentedControl
            label={t('ui.playbackAids.speed')}
            value={settings.speed}
            onChange={(value) => update('speed', value)}
            options={[0.25, 0.5, 1].map((value) => ({
              value,
              label: t('ui.playbackAids.speedValue', { value }),
            }))}
          />
          <div className="playback-aids__switch-row">
            <span className="playback-aids__label">{t('ui.playbackAids.metronome')}</span>
            <button
              type="button"
              className="playback-aids__switch"
              role="switch"
              aria-checked={settings.metronomeEnabled}
              aria-label={t('ui.playbackAids.metronome')}
              onClick={() => update('metronomeEnabled', !settings.metronomeEnabled)}
            >
              <span />
            </button>
          </div>
          <SegmentedControl
            label={t('ui.playbackAids.countIn')}
            value={settings.countInBars}
            onChange={(value) => update('countInBars', value)}
            options={[
              { value: 0, label: t('ui.playbackAids.off') },
              { value: 1, label: t('ui.playbackAids.oneBar') },
              { value: 2, label: t('ui.playbackAids.twoBars') },
            ]}
          />
          {/* テンポとクリック音量は、鳴るものが1つも無ければ効かない。
              押しても何も起きない操作を出したままにしない */}
          {clicksAudible && (
            <>
              <SegmentedControl
                label={t('ui.playbackAids.tempo')}
                value={settings.gridsPerBeat}
                onChange={(value) => update('gridsPerBeat', value)}
                options={[
                  { value: 4, label: t('ui.playbackAids.tempoQuarter') },
                  { value: 2, label: t('ui.playbackAids.tempoHalf') },
                ]}
              />
              <SegmentedControl
                label={t('ui.playbackAids.volume')}
                value={settings.clickVolume}
                onChange={(value) => update('clickVolume', value)}
                options={[
                  { value: 'low', label: t('ui.playbackAids.low') },
                  { value: 'medium', label: t('ui.playbackAids.medium') },
                  { value: 'high', label: t('ui.playbackAids.high') },
                ]}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
