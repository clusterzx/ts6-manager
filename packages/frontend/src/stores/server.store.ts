import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ServerStore {
  selectedConfigId: number | null;
  selectedSid: number | null;
  setServer: (configId: number, sid?: number) => void;
  setSid: (sid: number) => void;
  clearServer: () => void;
}

export const useServerStore = create<ServerStore>()(
  persist(
    (set) => ({
      selectedConfigId: null,
      selectedSid: null,
      setServer: (configId, sid) =>
        set({ selectedConfigId: configId, selectedSid: sid ?? null }),
      setSid: (sid) => set({ selectedSid: sid }),
      clearServer: () => set({ selectedConfigId: null, selectedSid: null }),
    }),
    { name: 'ts6-server' },
  ),
);
