import { create } from 'zustand';
import type { StudioProtectedSessionFailure } from './protected-session-state.js';

export type AuthUser = {
  id: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
};

export type AuthStatus = 'bootstrapping' | 'authenticated' | 'unauthenticated';

interface AppState {
  // Studio stores only Runtime-projected account identity. Auth token values
  // and Runtime defaults never enter renderer state.
  auth: {
    status: AuthStatus;
    user: AuthUser | null;
  };
  bootstrapReady: boolean;
  bootstrapError: string | null;
  bootstrapFailure: StudioProtectedSessionFailure | null;

  setProtectedSessionBound: () => void;
  clearAuthSession: () => void;
  setBootstrapReady: (ready: boolean) => void;
  setBootstrapError: (error: string | null) => void;
  setBootstrapFailure: (failure: StudioProtectedSessionFailure | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  auth: {
    status: 'bootstrapping',
    user: null,
  },
  bootstrapReady: false,
  bootstrapError: null,
  bootstrapFailure: null,

  setProtectedSessionBound() {
    set({ auth: { status: 'authenticated', user: null } });
  },
  clearAuthSession() {
    set({
      auth: { status: 'unauthenticated', user: null },
    });
  },
  setBootstrapReady: (ready) => set({ bootstrapReady: ready }),
  setBootstrapError: (error) => set({ bootstrapError: error }),
  setBootstrapFailure: (failure) => set({ bootstrapFailure: failure }),
}));
