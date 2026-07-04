import { useEffect, useState, type ChangeEvent } from 'react';

export default function VideoPlayer({ src: initialSrc = '' }: { src?: string }) {
  const [src, setSrc] = useState(initialSrc);

  useEffect(() => {
    setSrc(initialSrc);
  }, [initialSrc]);

  useEffect(() => {
    return () => {
      if (src.startsWith('blob:')) {
        URL.revokeObjectURL(src);
      }
    };
  }, [src]);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setSrc(objectUrl);
  };

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/60">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-fuchsia-400">Video player</p>
          <h2 className="text-2xl font-semibold">Upload and preview</h2>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-sm text-slate-300">
          Motion
        </span>
      </div>

      <label className="mb-4 inline-flex cursor-pointer rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-200">
        Choose video
        <input className="hidden" type="file" accept="video/*" onChange={onChange} />
      </label>

      {src ? (
        <video className="h-56 w-full rounded-2xl bg-slate-950 object-cover" controls src={src} />
      ) : (
        <p className="text-sm text-slate-400">Upload a video to preview and review it alongside the rest of the studio.</p>
      )}
    </section>
  );
}
