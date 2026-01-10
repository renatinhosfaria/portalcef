'use client';

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
        <div className="relative w-full h-[400px] rounded-[2.5rem] overflow-hidden mb-12 group">
            {/* Background Gradient & Pattern */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand-900 to-brand-800">
                <div className="absolute inset-0 bg-[url('/patterns/grid.svg')] opacity-10"></div>
                {/* Abstract Shapes */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 group-hover:translate-x-1/4 transition-transform duration-700"></div>
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-essencia-green/20 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4"></div>
            </div>

            {/* Content */}
            <div className="relative h-full flex flex-col justify-center px-8 md:px-16 max-w-4xl">
                <div className="space-y-2 mb-6">
                    <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-brand-100 text-sm font-medium tracking-wide animate-fade-in-up">
                        👋 {greeting}, família!
                    </span>
                </div>

                <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-6 leading-tight animate-fade-in-up animate-delay-100">
                    Prepare-se para o <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-essencia-green to-brand-200">
                        Volta às Aulas
                    </span>
                </h1>

                <p className="text-lg text-brand-100/80 max-w-xl mb-8 leading-relaxed animate-fade-in-up animate-delay-200">
                    Encontre todos os uniformes e materiais do {schoolName} em um só lugar.
                    Qualidade, conforto e praticidade para o dia a dia.
                </p>

                <div className="flex gap-4 animate-fade-in-up animate-delay-200">
                    <button className="bg-white text-brand-900 font-bold px-8 py-3.5 rounded-xl hover:bg-brand-50 transform hover:-translate-y-0.5 transition-all shadow-lg shadow-black/5">
                        Ver Catálogo Completo
                    </button>
                </div>
            </div>
        </div>
    );
}
