import { create } from "zustand";
import type { CommandRecord, Session } from "@jvmscope/core/browser";

interface SessionStoreState {
  sessions: Record<string, Session>;
  activeSessionId?: string;
  commandChunks: Record<string, string[]>; // sessionId -> flattened output lines

  upsertSession: (session: Session) => void;
  setStatus: (sessionId: string, status: Session["status"]) => void;
  setActiveSession: (sessionId: string | undefined) => void;
  appendChunk: (sessionId: string, chunk: string) => void;
  recordCommand: (sessionId: string, record: CommandRecord) => void;
  removeSession: (sessionId: string) => void;
}

export const useSessionStore = create<SessionStoreState>((set) => ({
  sessions: {},
  activeSessionId: undefined,
  commandChunks: {},

  upsertSession: (session) =>
    set((state) => ({ sessions: { ...state.sessions, [session.id]: session } })),

  setStatus: (sessionId, status) =>
    set((state) => {
      const existing = state.sessions[sessionId];
      if (!existing) return state;
      return { sessions: { ...state.sessions, [sessionId]: { ...existing, status } } };
    }),

  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),

  appendChunk: (sessionId, chunk) =>
    set((state) => ({
      commandChunks: {
        ...state.commandChunks,
        [sessionId]: [...(state.commandChunks[sessionId] ?? []), chunk],
      },
    })),

  recordCommand: (sessionId, record) =>
    set((state) => {
      const existing = state.sessions[sessionId];
      if (!existing) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...existing, commandLog: [...existing.commandLog, record] },
        },
      };
    }),

  removeSession: (sessionId) =>
    set((state) => {
      const { [sessionId]: _removed, ...rest } = state.sessions;
      return {
        sessions: rest,
        activeSessionId: state.activeSessionId === sessionId ? undefined : state.activeSessionId,
      };
    }),
}));
