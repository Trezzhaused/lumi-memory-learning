import { useState, type FormEvent } from 'react';
import { useChat } from '../hooks/useChat';

const quickPrompts = [
  'Draft a launch brief',
  'Summarize my memory',
  'Create a storyboard',
  'Plan a mission',
];

export default function Chat() {
  const { messages, sendMessage, stream } = useChat();
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim() || isSending) {
      return;
    }

    setIsSending(true);
    try {
      await sendMessage(input);
      setInput('');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/60">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Transcript-first chat</p>
          <h2 className="text-2xl font-semibold">LUMI conversations</h2>
        </div>
        <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-sm text-cyan-300">
          {stream ? 'Streaming' : 'Ready'}
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-300 transition hover:border-cyan-400/50 hover:text-slate-100"
            onClick={() => setInput(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="mb-4 h-[28rem] space-y-3 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col justify-between">
            <div className="space-y-3">
              <p className="text-sm text-slate-400">
                Start a conversation with LUMI and keep transcripts, assets, and actions together.
              </p>
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-sm text-slate-200">
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Studio prompt</p>
                <p className="mt-1">Ask for planning, a storyboard, a launch brief, or a mission workflow.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              Ready for the next prompt
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`rounded-2xl border p-3 text-sm ${message.role === 'assistant' ? 'border-cyan-500/20 bg-cyan-500/10 text-slate-100' : 'border-slate-800 bg-slate-900/90 text-slate-200'}`}
            >
              <p className="mb-1 text-xs uppercase tracking-[0.3em] text-slate-500">{message.role}</p>
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            </div>
          ))
        )}
      </div>

      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
        <input
          className="flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none ring-0"
          placeholder="Ask LUMI to prototype, plan, or create"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={isSending}
        />
        <button className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isSending}>
          {isSending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </section>
  );
}
