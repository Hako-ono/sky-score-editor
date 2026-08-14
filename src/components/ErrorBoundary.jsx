import { Component } from 'react';

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
          <h2>表示中にエラーが発生しました</h2>
          <p>データが破損しているか、予期せぬ不具合が発生しました。</p>
          <button className="btn btn--primary" onClick={() => window.location.reload()}>
            ページを再読み込みする
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}