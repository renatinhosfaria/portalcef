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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#A3D154] animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm max-w-md w-full p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Erro ao carregar</h2>
          <p className="text-sm text-slate-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-[#A3D154] text-white font-medium px-6 py-2.5 rounded-lg hover:bg-[#8FBD3F] transition-colors duration-150 w-full"
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#A3D154] animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-[#A3D154] mb-4">
            <ShoppingBag className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight mb-2">
            Loja de Uniformes
          </h1>
          <p className="text-slate-500">
            Selecione sua escola e unidade para continuar
          </p>
        </div>

        {/* School/Unit Selector */}
        <div className="space-y-4">
          {schools.map((school) => (
            <div key={school.id} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="font-semibold text-slate-800">{school.name}</h2>
              </div>

              <div className="divide-y divide-slate-100">
                {school.units.map((unit) => (
                  <Link
                    key={unit.id}
                    href={`/${school.id}/${unit.id}`}
                    className="group flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors duration-150"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#A3D154]/10 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-[#A3D154]" />
                      </div>
                      <div>
                        <h3 className="font-medium text-slate-800 group-hover:text-[#5a7a1f] transition-colors duration-150">
                          {unit.name}
                        </h3>
                        <p className="text-xs text-slate-400">Ver catálogo</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#A3D154] transition-colors duration-150" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-slate-200 text-sm text-slate-500">
            <HelpCircle className="w-4 h-4" />
            Dúvidas? Entre em contato com a secretaria
          </div>
        </div>
      </div>
    </div>
  );
}
