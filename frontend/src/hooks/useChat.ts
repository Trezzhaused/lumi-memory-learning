import { useCallback } from 'react';
import { useChatStore } from '../stores/chat';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

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

      try {
        const response = await fetch(`${API_BASE}/api/lumi/public/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': 'browser',
          },
          body: JSON.stringify({ message: trimmed }),
        });

        const data = await response.json();
        addMessage({
          role: 'assistant',
          content: typeof data?.content === 'string' ? data.content : 'No response received.',
        });
      } catch (error) {
        addMessage({
          role: 'assistant',
          content: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    },
    [addMessage],
  );

  return { messages, sendMessage, stream: true };
}
