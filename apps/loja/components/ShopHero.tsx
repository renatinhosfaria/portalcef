'use client';

import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ShopHero({ schoolName = 'Colégio Essência' }: { schoolName?: string }) {
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Bom dia');
    else if (hour < 18) setGreeting('Boa tarde');
    else setGreeting('Boa noite');
  }, []);

  return (
    <div className="relative w-full rounded-xl overflow-hidden mb-8 bg-slate-900">
      {/* Subtle Background Pattern */}
      <div className="absolute inset-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#A3D154]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#A3D154]/5 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4" />
      </div>

      {/* Content */}
      <div className="relative py-12 px-6 md:px-12 max-w-3xl">
        <div className="mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/10 border border-white/10 text-slate-300 text-sm font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            {greeting}, bem-vindo!
          </span>
        </div>

        <h1 className="text-3xl md:text-4xl font-semibold text-white tracking-tight mb-4 leading-tight">
          Uniformes e materiais <br />
          <span className="text-[#A3D154]">do {schoolName}</span>
        </h1>

        <p className="text-base text-slate-400 max-w-lg mb-6 leading-relaxed">
          Encontre todos os itens escolares em um só lugar.
          Qualidade e praticidade para o dia a dia.
        </p>

        <button className="bg-[#A3D154] text-white font-medium px-6 py-2.5 rounded-lg hover:bg-[#8FBD3F] transition-colors duration-150">
          Ver Catálogo
        </button>
      </div>
    </div>
  );
}
