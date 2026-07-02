export default function Landing() {
  return (
    <header className="mx-auto flex max-w-7xl flex-col gap-6 px-6 pt-16">
      <div className="inline-flex w-fit items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200">
        Safe autonomy. Total control.
      </div>
      <div className="max-w-3xl space-y-4">
        <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">LUMI</h1>
        <p className="text-lg text-slate-300">
          A locally-run, safety-certified AI operating system with a Claude-style chat experience, an ACE-style artifact experience, and a Figma-style canvas workspace.
        </p>
      </div>
      <div className="flex flex-wrap gap-3 text-sm text-slate-300">
        <span className="rounded-full border border-slate-700 px-3 py-2">Formally verified</span>
        <span className="rounded-full border border-slate-700 px-3 py-2">TEE / HSM secured</span>
        <span className="rounded-full border border-slate-700 px-3 py-2">Zero silent mutations</span>
      </div>
    </header>
  );
}
