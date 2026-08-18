import { useEffect, useRef, useState } from 'react';
import {
  getLanguagePreference,
  LANGUAGE_AUTO,
  LANGUAGE_OPTIONS,
} from '../i18n/index.js';
import { useLanguage, useT } from '../i18n/LanguageContext.jsx';
import { replacePlaceholders } from '../i18n/replacePlaceholders.js';
import { useMenuPosition } from '../hooks/useMenuPosition.js';
import globeIcon from '../assets/Globe_icon.svg';

const LICENSE_URL = `${import.meta.env.BASE_URL}legal/THIRD_PARTY_NOTICES.txt`;
const INQUIRY_URL = 'https://x.com/Hako_ono_sky';
const REPO_URL = 'https://github.com/Hako-ono/sky-score-editor';
const MIT_URL = `${REPO_URL}/blob/main/LICENSE`;
const LANGUAGE_AUTO_LABEL = 'Auto';

function SiteFooter({ hasDraft, onClearDraft }) {
  const t = useT();
  const { language, setLanguage } = useLanguage();
  const languageMenuRef = useRef(null);
  const languageTriggerRef = useRef(null);
  const languageItemRefs = useRef({});
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languagePanelRef = useMenuPosition(languageMenuOpen);
  const [languageSelection, setLanguageSelection] = useState(
    () => getLanguagePreference() ?? LANGUAGE_AUTO,
  );

  useEffect(() => {
    if (!languageMenuOpen) return undefined;
    languageItemRefs.current[languageSelection]?.focus();
    const handleOutsideClick = (e) => {
      if (languageMenuRef.current && !languageMenuRef.current.contains(e.target)) {
        setLanguageMenuOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setLanguageMenuOpen(false);
        languageTriggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [languageMenuOpen, languageSelection]);

  const handleLanguageMenuKeyDown = (e) => {
    const languages = LANGUAGE_OPTIONS.map(({ value }) => value);
    if (e.key === 'Escape') {
      e.preventDefault();
      setLanguageMenuOpen(false);
      languageTriggerRef.current?.focus();
      return;
    }
    if (e.key === 'Tab') {
      setLanguageMenuOpen(false);
      return;
    }
    const focusedIndex = languages.findIndex(
      (language) => languageItemRefs.current[language] === document.activeElement,
    );
    const currentIndex = focusedIndex >= 0 ? focusedIndex : languages.indexOf(languageSelection);
    let nextIndex;
    if (e.key === 'ArrowDown') nextIndex = (currentIndex + 1) % languages.length;
    else if (e.key === 'ArrowUp') nextIndex = (currentIndex - 1 + languages.length) % languages.length;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = languages.length - 1;
    else return;
    e.preventDefault();
    languageItemRefs.current[languages[nextIndex]]?.focus();
  };

  const selectedLanguageOption = LANGUAGE_OPTIONS.find(
    ({ value }) => value === languageSelection,
  ) ?? LANGUAGE_OPTIONS[0];
  const getLanguageOptionLabel = (option) => (
    option.value === LANGUAGE_AUTO ? LANGUAGE_AUTO_LABEL : option.label
  );
  const selectedLanguageTriggerLabel = selectedLanguageOption.value === LANGUAGE_AUTO
    ? `Language: ${LANGUAGE_AUTO_LABEL}`
    : selectedLanguageOption.label;

  return (
    <footer className="site-footer">
      <p className="site-footer__lead">
        {t('ui.siteFooter.lead')}
      </p>

      <nav className="site-footer__links" aria-label={t('ui.siteFooter.navAria')}>
        <a href={REPO_URL} target="_blank" rel="noreferrer">{t('ui.siteFooter.sourceCode')}</a>
        <a href={MIT_URL} target="_blank" rel="noreferrer">{t('ui.siteFooter.mitLicense')}</a>
        <a href={LICENSE_URL}>{t('ui.siteFooter.thirdPartyLicenses')}</a>
        <a href={INQUIRY_URL} target="_blank" rel="noreferrer">{t('ui.siteFooter.inquiry')}</a>
      </nav>

      <details className="site-footer__details">
        <summary className="site-footer__summary">{t('ui.siteFooter.usageSummary')}</summary>
        <div className="site-footer__content">
          <ul className="site-footer__list">
            <li>{t('ui.siteFooter.usage.purpose')}</li>
            <li>{t('ui.siteFooter.usage.sharing')}</li>
            <li>{t('ui.siteFooter.usage.autosave')}</li>
            <li>{t('ui.siteFooter.usage.disclaimer')}</li>
          </ul>
        </div>
      </details>

      <details className="site-footer__details">
        <summary className="site-footer__summary">{t('ui.siteFooter.privacySummary')}</summary>
        <div className="site-footer__content">
          <ul className="site-footer__list">
            <li>{t('ui.siteFooter.privacy.processing')}</li>
            <li>
              {replacePlaceholders(t('ui.siteFooter.privacy.storage'), {
                debugQuery: <code key="debugQuery">?debug=1</code>,
              })}
            </li>
            <li>{t('ui.siteFooter.privacy.presetSharing')}</li>
            <li>{t('ui.siteFooter.privacy.noTracking')}</li>
            <li>{t('ui.siteFooter.privacy.cloudflare')}</li>
            <li>{t('ui.siteFooter.privacy.deleteDraft')}</li>
          </ul>
          <p>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={onClearDraft}
              disabled={!hasDraft}
              title={t(hasDraft ? 'ui.siteFooter.deleteDraftTitle' : 'ui.siteFooter.noDraftTitle')}
            >
              {t('ui.siteFooter.deleteDraftButton')}
            </button>
          </p>
        </div>
      </details>

      <details className="site-footer__details">
        <summary className="site-footer__summary">{t('ui.siteFooter.licenseSummary')}</summary>
        <div className="site-footer__content site-footer__credits">
          <ul className="site-footer__list">
            <li>
              {replacePlaceholders(t('ui.siteFooter.license.source'), {
                github: <a key="github" href={REPO_URL} target="_blank" rel="noreferrer">{t('ui.siteFooter.github')}</a>,
                license: <a key="license" href={MIT_URL} target="_blank" rel="noreferrer">{t('ui.siteFooter.mitLicense')}</a>,
              })}
            </li>
            <li>{t('ui.siteFooter.license.audio')}</li>
            <li>{t('ui.siteFooter.license.screenFont')}</li>
            <li>{t('ui.siteFooter.license.pdfFont')}</li>
            <li>{t('ui.siteFooter.license.pdfjs')}</li>
            <li>{t('ui.siteFooter.license.localAssets')}</li>
            <li>{t('ui.siteFooter.license.rights')}</li>
            <li>{t('ui.siteFooter.license.qrTrademark')}</li>
            <li>
              {replacePlaceholders(t('ui.siteFooter.license.notice'), {
                noticeLink: <a key="noticeLink" href={LICENSE_URL}>{t('ui.siteFooter.license.noticeLink')}</a>,
              })}
            </li>
          </ul>
        </div>
      </details>

      <p className="site-footer__note">
        {replacePlaceholders(t('ui.siteFooter.note'), {
          inquiry: <a key="inquiry" href={INQUIRY_URL} target="_blank" rel="noreferrer">{t('ui.siteFooter.inquiryLink')}</a>,
        })}
      </p>

      <div className="site-footer__controls">
        <div className="language-menu" ref={languageMenuRef}>
          <button
            ref={languageTriggerRef}
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => {
              if (languageMenuOpen) languageTriggerRef.current?.focus();
              setLanguageMenuOpen(!languageMenuOpen);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' && !languageMenuOpen) {
                event.preventDefault();
                setLanguageMenuOpen(true);
              }
            }}
            aria-haspopup="menu"
            aria-expanded={languageMenuOpen}
            aria-controls="site-footer-language-menu"
            aria-label={t('ui.toolbar.language.select')}
            title={t('ui.toolbar.language.select')}
          >
            <img className="language-menu__icon" src={globeIcon} alt="" aria-hidden="true" />
            <span>{selectedLanguageTriggerLabel}</span>
          </button>
          {languageMenuOpen && (
            <div
              ref={languagePanelRef}
              id="site-footer-language-menu"
              className="language-menu__panel"
              role="menu"
              aria-label={t('ui.toolbar.language.menu')}
            >
              {LANGUAGE_OPTIONS.map((option) => {
                const label = getLanguageOptionLabel(option);
                const isSelected = languageSelection === option.value;
                return (
                  <button
                    key={option.value}
                    ref={(element) => {
                      languageItemRefs.current[option.value] = element;
                    }}
                    type="button"
                    role="menuitemradio"
                    className="language-menu__item"
                    aria-checked={isSelected}
                    aria-label={t(
                      isSelected ? 'ui.toolbar.language.current' : 'ui.toolbar.language.switch',
                      { label },
                    )}
                    title={t(
                      isSelected ? 'ui.toolbar.language.current' : 'ui.toolbar.language.switch',
                      { label },
                    )}
                    onClick={() => {
                      setLanguage(option.value);
                      setLanguageSelection(option.value);
                      setLanguageMenuOpen(false);
                      languageTriggerRef.current?.focus();
                    }}
                    onKeyDown={handleLanguageMenuKeyDown}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {language !== 'ja' && (
          <p className="site-footer__original-notice">
            {t('ui.siteFooter.originalNotice')}
          </p>
        )}
      </div>

      <p className="site-footer__copyright">
        {replacePlaceholders(t('ui.siteFooter.copyright'), {
          license: <a key="copyrightLicense" href={MIT_URL} target="_blank" rel="noreferrer">{t('ui.siteFooter.mitLicense')}</a>,
        })}
      </p>
    </footer>
  );
}

export default SiteFooter;
