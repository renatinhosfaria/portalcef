'use client';

import { Calendar, Clock, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

export function PreLaunchBanner() {
  const [mounted, setMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    setMounted(true);

    const calculateTimeLeft = () => {
      const launchDate = new Date('2026-01-20T00:00:00');
      const now = new Date();
      const difference = launchDate.getTime() - now.getTime();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden mb-12 bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900">
      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Efeitos de luz animados */}
        <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-[#A3D154] rounded-full opacity-20 blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#F59E0B] rounded-full opacity-20 blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />

        {/* Listras decorativas */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#A3D154] to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#F59E0B] to-transparent" />
        </div>

        {/* Padrão de pontos */}
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: `radial-gradient(circle, rgba(163, 209, 84, 0.6) 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      {/* Content */}
      <div className="relative py-16 px-6 md:px-12 lg:px-16">
        <div className="max-w-5xl mx-auto">
          {/* Badge de Status */}
          <div className={`flex justify-center mb-8 ${mounted ? 'animate-fade-in-down' : 'opacity-0'}`}>
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#A3D154] to-[#8FBD3F] shadow-xl shadow-[#A3D154]/30">
              <Sparkles className="w-4 h-4 text-white animate-spin" style={{ animationDuration: '3s' }} />
              <span className="font-display text-sm font-bold text-white uppercase tracking-wider">
                Pré-Lançamento
              </span>
            </div>
          </div>

          {/* Título Principal */}
          <div className="text-center mb-12">
            <h1 className={`font-display text-4xl md:text-5xl lg:text-7xl font-black text-white mb-4 leading-[1.1] ${mounted ? 'animate-fade-in-up delay-100' : 'opacity-0'}`}>
              Em Breve
              <br />
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-[#A3D154] via-[#8FBD3F] to-[#F59E0B] bg-clip-text text-transparent">
                  Algo Incrível!
                </span>
                {/* Efeito de brilho */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 blur-xl animate-pulse" />
              </span>
            </h1>
            <p className={`font-body text-xl md:text-2xl text-stone-300 max-w-2xl mx-auto ${mounted ? 'animate-fade-in-up delay-200' : 'opacity-0'}`}>
              Nossa loja de uniformes abre suas portas em
            </p>
          </div>

          {/* Data de Lançamento */}
          <div className={`flex justify-center mb-10 ${mounted ? 'animate-scale-in delay-300' : 'opacity-0'}`}>
            <div className="inline-flex items-center gap-4 px-8 py-5 rounded-2xl bg-white/10 backdrop-blur-md border-2 border-white/20 shadow-2xl">
              <Calendar className="w-8 h-8 text-[#F59E0B]" />
              <div className="text-left">
                <p className="text-xs text-stone-400 font-medium uppercase tracking-wide mb-1">Lançamento</p>
                <p className="font-display text-3xl md:text-4xl font-black text-white">
                  20 de Janeiro
                </p>
              </div>
            </div>
          </div>

          {/* Countdown Timer */}
          <div className={`grid grid-cols-4 gap-4 md:gap-6 max-w-3xl mx-auto mb-12 ${mounted ? 'animate-fade-in-up delay-500' : 'opacity-0'}`}>
            {[
              { label: 'Dias', value: timeLeft.days },
              { label: 'Horas', value: timeLeft.hours },
              { label: 'Min', value: timeLeft.minutes },
              { label: 'Seg', value: timeLeft.seconds },
            ].map((item, index) => (
              <div
                key={item.label}
                className="relative group"
                style={{ animationDelay: `${500 + index * 100}ms` }}
              >
                {/* Glow effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-[#A3D154] to-[#F59E0B] rounded-2xl opacity-0 group-hover:opacity-30 blur-xl transition-opacity duration-500" />

                <div className="relative bg-white/10 backdrop-blur-md border-2 border-white/20 rounded-2xl p-4 md:p-6 text-center">
                  <div className="font-display text-3xl md:text-5xl font-black text-white mb-2 tabular-nums">
                    {String(item.value).padStart(2, '0')}
                  </div>
                  <div className="text-xs md:text-sm font-bold text-stone-400 uppercase tracking-wider">
                    {item.label}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Call to Action */}
          <div className={`text-center ${mounted ? 'animate-fade-in delay-700' : 'opacity-0'}`}>
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <Clock className="w-5 h-5 text-[#A3D154]" />
              <span className="text-stone-300 font-medium">
                Prepare-se para aproveitar as melhores ofertas!
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Elementos decorativos flutuantes */}
      <div className="absolute top-10 right-10 w-20 h-20 opacity-20 pointer-events-none animate-float">
        <div className="w-full h-full rounded-full border-4 border-[#A3D154]" />
      </div>
      <div className="absolute bottom-10 left-10 w-16 h-16 opacity-20 pointer-events-none animate-float" style={{ animationDelay: '1.5s' }}>
        <div className="w-full h-full rounded-full border-4 border-[#F59E0B]" />
      </div>
    </div>
  );
}
