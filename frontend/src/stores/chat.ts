import { create } from 'zustand';

type Message = { role: string; content: string };

export const useChatStore = create<{
  messages: Message[];
  addMessage: (m: Message) => void;
}>((set) => ({
  messages: [],
  addMessage: (m) => set((state) => ({ messages: [...state.messages, m] })),
}));
