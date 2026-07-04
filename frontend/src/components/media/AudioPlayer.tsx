import { useEffect, useState, type ChangeEvent } from 'react';

export default function AudioPlayer({ src: initialSrc = '' }: { src?: string }) {
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
          <p className="text-sm uppercase tracking-[0.3em] text-amber-400">Audio player</p>
          <h2 className="text-2xl font-semibold">Playback and upload</h2>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-sm text-slate-300">
          Voice
        </span>
      </div>

      <label className="mb-4 inline-flex cursor-pointer rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-200">
        Choose audio
        <input className="hidden" type="file" accept="audio/*" onChange={onChange} />
      </label>

      {src ? (
        <audio className="w-full" controls src={src} />
      ) : (
        <p className="text-sm text-slate-400">Upload voice or soundtrack assets and review them in context.</p>
      )}
    </section>
  );
}
