'use client';

import { ShoppingBag, School, MapPin, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface School {
  id: string;
  name: string;
  units: Unit[];
}

interface Unit {
  id: string;
  name: string;
}

export default function HomePage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSchools() {
      try {
        setError(null);
        const response = await fetch('/api/shop/locations', { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok || !result?.success) {
          throw new Error(result?.error?.message || 'Erro ao carregar escolas');
        }

        setSchools(result.data || []);

      } catch (error) {
        console.error('Failed to fetch schools:', error);
        const message = error instanceof Error ? error.message : 'Erro ao carregar escolas';
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    fetchSchools();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-slate-500">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4">
        <div className="shop-card max-w-md w-full text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-2 text-slate-800">Erro ao carregar</h2>
          <p className="text-slate-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-shop-primary w-full"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  // Se só tem 1 escola e 1 unidade, redireciona automaticamente
  if (schools.length === 1 && schools[0].units.length === 1) {
    const school = schools[0];
    const unit = school.units[0];

    if (typeof window !== 'undefined') {
      window.location.href = `/${school.id}/${unit.id}`;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-slate-500">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] relative overflow-hidden">
      {/* Abstract Background Elements */}
      <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-br from-[#A3D154]/20 to-[#A3D154]/5 rounded-full blur-3xl pointer-events-none opacity-60"></div>
      <div className="absolute top-[40%] left-[-10%] w-[600px] h-[600px] bg-orange-400/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 p-4 py-12 max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#A3D154] shadow-lg shadow-[#A3D154]/30 mb-4">
            <ShoppingBag className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 tracking-tight">
            Loja de Uniformes
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Compre uniformes escolares de forma rápida e segura
          </p>
        </div>

        {/* School/Unit Selector */}
        <div className="space-y-6">
          {schools.map((school) => (
            <div key={school.id} className="shop-card">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <School className="w-6 h-6 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">{school.name}</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {school.units.map((unit) => (
                  <Link
                    key={unit.id}
                    href={`/${school.id}/${unit.id}`}
                    className="group flex items-center justify-between p-6 bg-white rounded-xl border-2 border-slate-200 hover:border-[#A3D154] hover:bg-[#A3D154]/5 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-[#A3D154]/10 flex items-center justify-center group-hover:bg-[#A3D154]/20 transition-colors">
                        <MapPin className="w-6 h-6 text-[#A3D154]" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-800 group-hover:text-[#A3D154] transition-colors">
                          {unit.name}
                        </h3>
                        <p className="text-sm text-slate-500">Ver catálogo</p>
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 text-slate-400 group-hover:text-[#A3D154] group-hover:translate-x-1 transition-all" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/60 backdrop-blur-sm rounded-full border border-slate-200/60">
            <span className="text-2xl">💚</span>
            <p className="text-sm text-slate-600">
              Dúvidas? Entre em contato com a secretaria da sua unidade
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

