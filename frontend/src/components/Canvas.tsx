import { Stage, Layer, Rect, Circle } from 'react-konva';

export default function Canvas() {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/60">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-fuchsia-400">Figma-style canvas</p>
          <h2 className="text-2xl font-semibold">Creative workspace</h2>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-sm text-slate-300">
          Draft
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <Stage width={560} height={320}>
          <Layer>
            <Rect x={40} y={40} width={220} height={120} fill="#0f766e" cornerRadius={16} />
            <Circle x={420} y={120} radius={70} fill="#a855f7" />
            <Rect x={120} y={190} width={320} height={70} fill="#1d4ed8" cornerRadius={12} />
          </Layer>
        </Stage>
      </div>
      <p className="mt-3 text-sm text-slate-400">Sketch concepts, layout blocks, and visual directions alongside the chat transcript.</p>
    </section>
  );
}
