import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserInfo {
  id: number;
  username: string;
  displayName: string;
  role: 'admin' | 'viewer';
}

interface AuthStore {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserInfo | null;
  setAuth: (accessToken: string, refreshToken: string, user: UserInfo) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  isAdmin: () => boolean;
  canWrite: () => boolean;
}

// M9: Tokens stored in localStorage. This is an accepted tradeoff — no XSS vectors
// exist in the frontend (no dangerouslySetInnerHTML, no eval). If XSS is introduced,
// consider moving to httpOnly cookies or in-memory storage.
export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setAuth: (accessToken, refreshToken, user) =>
        set({ accessToken, refreshToken, user }),
      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),
      logout: () =>
        set({ accessToken: null, refreshToken: null, user: null }),
      isAuthenticated: () => !!get().accessToken,
      isAdmin: () => get().user?.role === 'admin',
      canWrite: () => get().user?.role === 'admin',
    }),
    { name: 'ts6-auth' },
  ),
);
