import { AnnouncementBanner } from "../components/announcement-banner";
import { CalendarWidget } from "../components/calendar-widget";
import { HomeGreeting } from "../components/home-greeting";
import { HomeModuleLinks } from "../components/home-module-links";
import { QuickStats } from "../components/quick-stats";
import { SystemFeed } from "../components/system-feed";

export default function Home() {
  return (
    <div className="min-h-screen pb-10">
      <header className="mb-8">
        <HomeGreeting />
      </header>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-8">
          <section aria-labelledby="estatisticas-titulo">
            <h2 id="estatisticas-titulo" className="sr-only">
              Estatísticas da instituição
            </h2>
            <QuickStats />
          </section>

          <section aria-labelledby="atividades-titulo">
            <SystemFeed titleId="atividades-titulo" />
          </section>
        </div>

        <aside className="sticky top-8 space-y-6 lg:col-span-4">
          <section
            aria-labelledby="avisos-titulo"
            className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
          >
            <AnnouncementBanner titleId="avisos-titulo" />
          </section>

          <section aria-labelledby="agenda-titulo">
            <CalendarWidget titleId="agenda-titulo" />
          </section>

          <HomeModuleLinks />
        </aside>
      </div>
    </div>
  );
}
