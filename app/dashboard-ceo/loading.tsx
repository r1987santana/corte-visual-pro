export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-[#020617] p-6 text-white">
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <section className="space-y-6">
          <div className="h-36 animate-pulse rounded-lg border border-cyan-400/15 bg-cyan-500/10" />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="h-28 animate-pulse rounded-lg border border-slate-800 bg-slate-900/70" />
            <div className="h-28 animate-pulse rounded-lg border border-slate-800 bg-slate-900/70" />
            <div className="h-28 animate-pulse rounded-lg border border-slate-800 bg-slate-900/70" />
          </div>
          <div className="h-96 animate-pulse rounded-lg border border-slate-800 bg-slate-900/70" />
        </section>

        <aside className="hidden h-[560px] animate-pulse rounded-lg border border-cyan-400/15 bg-cyan-500/10 xl:block" />
      </div>
    </main>
  );
}
