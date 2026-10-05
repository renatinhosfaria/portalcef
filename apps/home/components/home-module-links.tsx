"use client";

import { PORTAL_MODULES, hasModuleAccess } from "@essencia/components/shell/module-config";
import { useTenant } from "@essencia/shared/providers/tenant";

export function HomeModuleLinks() {
  const { role } = useTenant();
  const modules = PORTAL_MODULES.filter(
    (module) => module.key !== "home" && hasModuleAccess(role, module.key),
  );

  return (
    <section
      aria-labelledby="acesso-rapido-titulo"
      className="rounded-2xl bg-slate-900 p-5 text-white shadow-xl shadow-slate-900/20"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 id="acesso-rapido-titulo" className="text-lg font-bold">
          Acesso Rápido
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {modules.map(({ href, label, icon: Icon }) => (
          <a
            key={href}
            href={href}
            className="group flex flex-col items-center justify-center gap-2 rounded-xl bg-white/5 p-3 transition-colors hover:bg-white/15"
          >
            <Icon className="h-6 w-6 text-emerald-300 transition-transform group-hover:scale-110" />
            <span className="text-center text-xs font-semibold opacity-80">
              {label}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
