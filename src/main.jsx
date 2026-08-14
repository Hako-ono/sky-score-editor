import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
// 画面表示フォント。Google Fonts への外部依存をなくすため、
// npm パッケージとして自前ホストする（ビルド時に dist/assets へ同梱される）。
import '@fontsource/noto-sans-jp/400.css';
import '@fontsource/noto-sans-jp/500.css';
import '@fontsource/noto-sans-jp/700.css';
import './styles/index.css';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { ActiveGridProvider } from './contexts/ActiveGridContext.jsx';
import { ExpandedGridProvider } from './contexts/ExpandedGridContext.jsx';
import { ScoreGridsProvider } from './contexts/ScoreGridsContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ActiveGridProvider>
        <ExpandedGridProvider>
          <ScoreGridsProvider>
            <App />
          </ScoreGridsProvider>
        </ExpandedGridProvider>
      </ActiveGridProvider>
    </ErrorBoundary>
  </StrictMode>,
);