import { useState, type FormEvent } from 'react';
import { useChat } from '../hooks/useChat';

export default function Chat() {
  const { messages, sendMessage, stream } = useChat();
  const [input, setInput] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim()) {
      return;
    }

    await sendMessage(input);
    setInput('');
  };

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/60">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Claude-style chat</p>
          <h2 className="text-2xl font-semibold">LUMI conversations</h2>
        </div>
        <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-sm text-cyan-300">
          {stream ? 'Streaming' : 'Ready'}
        </span>
      </div>

      <div className="mb-4 h-72 space-y-3 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-400">Start a conversation with LUMI.</p>
        ) : (
          messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className="rounded-2xl bg-slate-900/90 p-3 text-sm text-slate-200">
              <p className="mb-1 text-xs uppercase tracking-[0.3em] text-slate-500">{message.role}</p>
              <p>{message.content}</p>
            </div>
          ))
        )}
      </div>

      <form className="flex gap-3" onSubmit={handleSubmit}>
        <input
          className="flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none ring-0"
          placeholder="Ask LUMI to prototype, plan, or create"
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <button className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950" type="submit">
          Send
        </button>
      </form>
    </section>
  );
}
