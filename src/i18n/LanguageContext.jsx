import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import {
  getLanguage,
  setLanguage as applyLanguage,
  setLanguagePreference,
  t,
} from './index.js';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => getLanguage());
  const setLanguage = useCallback((nextLanguage) => {
    const appliedLanguage = setLanguagePreference(nextLanguage);
    setLanguageState(appliedLanguage);
  }, []);
  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useT() {
  useContext(LanguageContext);
  return t;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context) return context;
  return { language: getLanguage(), setLanguage: applyLanguage };
}
