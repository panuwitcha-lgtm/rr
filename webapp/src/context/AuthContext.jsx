import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api().restore().then(setUser).finally(() => setLoading(false)); }, []);

  const login = async (email, password) => {
    const u = await api().login(email, password);
    setUser(u);
    return u;
  };
  const logout = async () => { await api().logout(); setUser(null); };
  const updateProfile = async (patch) => { const u = await api().updateProfile(user, patch); setUser(u); return u; };

  return <Ctx.Provider value={{ user, loading, login, logout, updateProfile }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
