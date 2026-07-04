import Chat from './components/Chat';
import Canvas from './components/Canvas';
import ImageUpload from './components/media/ImageUpload';
import VideoPlayer from './components/media/VideoPlayer';
import AudioPlayer from './components/media/AudioPlayer';
import Landing from './pages/Landing';

const capabilityItems = [
  'Chat & planning',
  'Vision & assets',
  'Voice & transcript',
  'Autonomous missions',
  'Memory & knowledge',
];

const statusItems = [
  { label: 'Runtime', value: 'Local-first', detail: 'Ready for studio workflows' },
  { label: 'Memory', value: 'Persistent', detail: 'Cloud or local storage' },
  { label: 'Bridge', value: 'Policy-checked', detail: 'Owner-only actions' },
];

export default function App() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_45%),linear-gradient(135deg,_#020617_0%,_#111827_100%)] text-slate-50">
      <Landing />
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 pb-16 lg:flex-row">
        <aside className="w-full shrink-0 rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/60 lg:w-80">
          <div className="mb-6">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Studio workspace</p>
            <h2 className="mt-2 text-2xl font-semibold">LUMI control center</h2>
            <p className="mt-3 text-sm text-slate-400">
              A polished workspace for narration, planning, media generation, and autonomous action.
            </p>
          </div>

          <nav className="space-y-2">
            {capabilityItems.map((item) => (
              <div
                key={item}
                className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300"
              >
                <span>{item}</span>
                <span className="text-cyan-400">↗</span>
              </div>
            ))}
          </nav>

          <div className="mt-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
            <p className="text-sm font-semibold text-cyan-200">Active mission</p>
            <p className="mt-2 text-sm text-slate-300">
              Draft a launch brief, inspect memory, and prepare assets for the next release.
            </p>
          </div>
        </aside>

        <main className="flex-1 space-y-6">
          <section className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/60">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm uppercase tracking-[0.3em] text-fuchsia-400">Descript-inspired production flow</p>
                <h2 className="mt-2 text-3xl font-semibold">Turn prompts into a polished creative runtime.</h2>
                <p className="mt-3 text-sm text-slate-400">
                  Coordinate chat, voice, media, and memory in a single workspace with a transcript-first experience.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-100">
                  Open mission
                </button>
                <button className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950">
                  Run workflow
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {statusItems.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{item.label}</p>
                  <p className="mt-2 text-lg font-semibold text-slate-100">{item.value}</p>
                  <p className="mt-1 text-sm text-slate-400">{item.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
            <Chat />
            <div className="space-y-6">
              <section className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/60">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-amber-400">Asset pipeline</p>
                    <h3 className="text-2xl font-semibold">Capture, sketch, and review media</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-300">
                      Canvas
                    </span>
                    <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-300">
                      Audio + video
                    </span>
                  </div>
                </div>

                <div className="space-y-6">
                  <Canvas />
                  <ImageUpload />
                  <VideoPlayer />
                  <AudioPlayer />
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
