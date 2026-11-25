import { createContext, useContext, useEffect, useState } from 'react';

const Ctx = createContext(null);
const KEY = 'hc_theme';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; } });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch { /* ไม่มี storage */ }
    window.dispatchEvent(new Event('hc-theme'));
  }, [theme]);
  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}
export const useTheme = () => useContext(Ctx);
