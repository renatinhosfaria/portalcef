'use client';

import { ShoppingBag, Building2, MapPin, ChevronRight, Loader2, AlertCircle, HelpCircle } from 'lucide-react';
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
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-[#A3D154] animate-spin mx-auto mb-4" />
          <p className="font-medium text-stone-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <div className="bg-white rounded-2xl border-2 border-stone-200 shadow-lg max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="font-display text-xl font-bold text-stone-800 mb-2">Erro ao carregar</h2>
          <p className="text-sm text-stone-600 mb-6 leading-relaxed">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary w-full"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  if (schools.length === 1 && schools[0].units.length === 1) {
    const school = schools[0];
    const unit = school.units[0];

    if (typeof window !== 'undefined') {
      window.location.href = `/${school.id}/${unit.id}`;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-[#A3D154] animate-spin mx-auto mb-4" />
          <p className="font-medium text-stone-600">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16 animate-fade-in-down">
          <div className="relative inline-block mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#A3D154] to-[#8FBD3F] flex items-center justify-center shadow-xl mx-auto">
              <ShoppingBag className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#F59E0B] rounded-full border-4 border-white shadow-lg" />
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-stone-800 tracking-tight mb-4">
            Loja de <span className="text-gradient-brand">Uniformes</span>
          </h1>
          <p className="text-lg text-stone-600 max-w-xl mx-auto">
            Selecione sua escola e unidade para acessar o catálogo completo
          </p>
        </div>

        {/* School/Unit Selector */}
        <div className="space-y-6">
          {schools.map((school, schoolIndex) => (
            <div
              key={school.id}
              className="bg-white rounded-2xl border-2 border-stone-200 shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 animate-fade-in-up"
              style={{ animationDelay: `${schoolIndex * 100}ms` }}
            >
              <div className="flex items-center gap-4 px-6 py-4 border-b-2 border-stone-100 bg-gradient-to-r from-stone-50 to-white">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <h2 className="font-display font-bold text-lg text-stone-800">{school.name}</h2>
              </div>

              <div className="divide-y-2 divide-stone-100">
                {school.units.map((unit) => (
                  <Link
                    key={unit.id}
                    href={`/${school.id}/${unit.id}`}
                    className="group flex items-center justify-between px-6 py-4 hover:bg-gradient-to-r hover:from-[#A3D154]/5 hover:to-[#F59E0B]/5 transition-all duration-200"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#A3D154] to-[#8FBD3F] flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all duration-200">
                        <MapPin className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-display font-semibold text-stone-800 group-hover:text-[#5a7a1f] transition-colors duration-200 mb-0.5">
                          {unit.name}
                        </h3>
                        <p className="text-xs text-stone-500 font-medium">Ver catálogo completo</p>
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 text-stone-300 group-hover:text-[#F59E0B] group-hover:translate-x-1 transition-all duration-200" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-12 animate-fade-in delay-300">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-white rounded-xl border-2 border-stone-200 text-sm font-medium text-stone-600 shadow-sm">
            <HelpCircle className="w-5 h-5 text-[#F59E0B]" />
            <span>Dúvidas? Entre em contato com a secretaria</span>
          </div>
        </div>
      </div>
    </div>
  );
}
