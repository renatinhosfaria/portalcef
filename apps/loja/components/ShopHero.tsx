'use client';

import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ShopHero({ schoolName = 'Portal CEF' }: { schoolName?: string }) {
  const [greeting, setGreeting] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Bom dia');
    else if (hour < 18) setGreeting('Boa tarde');
    else setGreeting('Boa noite');

    setMounted(true);
  }, []);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden mb-12 bg-gradient-hero noise-texture">
      {/* Background decorativo com as cores da marca */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Verde - canto superior direito */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#A3D154] rounded-full opacity-30 blur-[100px] -translate-y-1/2 translate-x-1/3 animate-float" />

        {/* Laranja - canto inferior esquerdo */}
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#F59E0B] rounded-full opacity-25 blur-[90px] translate-y-1/3 -translate-x-1/4 animate-float" style={{ animationDelay: '1s' }} />

        {/* Verde secundário - meio */}
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-[#A3D154] rounded-full opacity-20 blur-[70px] -translate-x-1/2 -translate-y-1/2 animate-float" style={{ animationDelay: '2s' }} />

        {/* Gradiente overlay para mais profundidade */}
        <div className="absolute inset-0 bg-gradient-to-br from-stone-900/50 via-transparent to-stone-900/30" />

        {/* Grid pattern sutil */}
        <div className="absolute inset-0 opacity-[0.05]" style={{
          backgroundImage: `linear-gradient(rgba(163, 209, 84, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(163, 209, 84, 0.4) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      {/* Content */}
      <div className="relative py-12 px-6 md:px-10 lg:px-12 max-w-3xl">
        {/* Greeting Badge */}
        <div className={`mb-6 ${mounted ? 'animate-fade-in-down' : 'opacity-0'}`}>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-sm font-semibold backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-[#FCD34D]" />
            {greeting}, bem-vindo!
          </span>
        </div>

        {/* Main Title */}
        <h1 className={`font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-6 leading-[1.1] ${mounted ? 'animate-fade-in-up delay-100' : 'opacity-0'}`}>
          Uniformes escolares{' '}
          <span className="relative inline-block">
            <span className="text-gradient-brand relative z-10">com qualidade</span>
            {/* Underline decorativo */}
            <svg className="absolute -bottom-2 left-0 w-full h-3 text-[#F59E0B]" viewBox="0 0 200 12" fill="none" preserveAspectRatio="none">
              <path d="M2 10C30 3 70 0 100 2C130 4 170 8 198 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          </span>
          {' '}do {schoolName}
        </h1>

        {/* Description */}
        <p className={`font-body text-lg text-stone-300 max-w-2xl leading-relaxed ${mounted ? 'animate-fade-in-up delay-200' : 'opacity-0'}`}>
          Encontre todos os uniformes e materiais escolares em um só lugar.
        </p>
      </div>

      {/* Decorative Elements */}
      <div className="absolute bottom-0 right-0 w-72 h-72 opacity-20 pointer-events-none">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <defs>
            <linearGradient id="heroGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A3D154" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r="80" fill="none" stroke="url(#heroGradient)" strokeWidth="3" strokeDasharray="5 5" className="animate-spin" style={{ animationDuration: '20s' }} />
          <circle cx="100" cy="100" r="60" fill="none" stroke="url(#heroGradient)" strokeWidth="3" strokeDasharray="3 3" className="animate-spin" style={{ animationDuration: '15s', animationDirection: 'reverse' }} />
        </svg>
      </div>
    </div>
  );
}
