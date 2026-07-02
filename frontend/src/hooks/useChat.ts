import { useCallback } from 'react';
import { useChatStore } from '../stores/chat';

export function useChat() {
  const messages = useChatStore((state) => state.messages);
  const addMessage = useChatStore((state) => state.addMessage);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) {
        return;
      }

      addMessage({ role: 'user', content: trimmed });
      addMessage({ role: 'assistant', content: `Echo: ${trimmed}` });
    },
    [addMessage],
  );

  return { messages, sendMessage, stream: false };
}
