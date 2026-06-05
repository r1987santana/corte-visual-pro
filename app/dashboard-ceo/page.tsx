import DashboardCEOClient from "@/components/DashboardCEOClient";
import AIAlertPanel from "@/components/ai/AIAlertPanel";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <div className="grid gap-6 p-6 xl:grid-cols-[1fr_420px]">
        <section className="min-w-0">
          <DashboardCEOClient />
        </section>

        <aside className="xl:sticky xl:top-6 xl:h-fit">
          <AIAlertPanel />
        </aside>
      </div>
    </main>
  );
}
