import { Component } from 'react';
import { t } from '../i18n/index.js';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught an error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text)' }}>
          <h2>{t('ui.errorBoundary.title')}</h2>
          <p>{t('ui.errorBoundary.body')}</p>
          <button className="btn btn--primary" onClick={() => window.location.reload()}>
            {t('ui.errorBoundary.reload')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
