'use client';

import { Grid3X3, Shirt, Backpack, X } from 'lucide-react';

type FilterSidebarProps = {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  activeSize: string;
  onSizeChange: (size: string) => void;
};

const CATEGORIES = [
  { id: '', label: 'Ver Todos', icon: Grid3X3 },
  { id: 'UNIFORME_FEMININO', label: 'Uniforme Feminino', icon: Shirt },
  { id: 'UNIFORME_MASCULINO', label: 'Uniforme Masculino', icon: Shirt },
  { id: 'UNIFORME_UNISSEX', label: 'Uniforme Unissex', icon: Shirt },
  { id: 'ACESSORIO', label: 'Acessórios', icon: Backpack },
];

const SIZES = ['1', '2', '4', '6', '8', '10', '12', '14', '16', 'P', 'M', 'G'];

export function FilterSidebar({
  activeCategory,
  onCategoryChange,
  activeSize,
  onSizeChange
}: FilterSidebarProps) {
  const hasActiveFilters = activeCategory !== '' || activeSize !== '';

  return (
    <aside className="w-full space-y-6">
      {/* Header com Clear Filters */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[#A3D154]/10 to-[#F59E0B]/10 rounded-xl border-2 border-[#A3D154]/20 animate-fade-in">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#A3D154] animate-pulse" />
            <span className="text-sm font-semibold text-stone-700">Filtros Ativos</span>
          </div>
          <button
            onClick={() => {
              onCategoryChange('');
              onSizeChange('');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
          >
            <X className="w-3.5 h-3.5" />
            Limpar
          </button>
        </div>
      )}

      {/* Categories */}
      <div className="bg-white rounded-2xl p-5 border-2 border-stone-200 shadow-sm hover:shadow-md transition-shadow duration-300">
        <h3 className="font-display text-base font-bold text-stone-800 mb-4 flex items-center gap-2">
          <div className="w-1 h-5 bg-gradient-to-b from-[#A3D154] to-[#F59E0B] rounded-full" />
          Categorias
        </h3>
        <div className="space-y-2">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onCategoryChange(cat.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm ${isActive
                  ? 'bg-gradient-to-r from-[#A3D154] to-[#8FBD3F] text-white shadow-lg shadow-[#A3D154]/30 scale-[1.02]'
                  : 'text-stone-600 hover:bg-stone-50 hover:text-stone-800'
                  }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 ${isActive
                  ? 'bg-white/20'
                  : 'bg-stone-100'
                  }`}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <span className="flex-1 text-left">{cat.label}</span>
                {isActive && (
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sizes */}
      <div className="bg-white rounded-2xl p-5 border-2 border-stone-200 shadow-sm hover:shadow-md transition-shadow duration-300">
        <h3 className="font-display text-base font-bold text-stone-800 mb-4 flex items-center gap-2">
          <div className="w-1 h-5 bg-gradient-to-b from-[#A3D154] to-[#F59E0B] rounded-full" />
          Tamanhos
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {SIZES.map((size) => {
            const isActive = activeSize === size;
            return (
              <button
                key={size}
                onClick={() => onSizeChange(activeSize === size ? '' : size)}
                className={`h-11 flex items-center justify-center rounded-xl font-display font-bold text-sm transition-all duration-200 ${isActive
                  ? 'bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-white shadow-lg shadow-[#F59E0B]/30 scale-105'
                  : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border-2 border-stone-200 hover:border-stone-300'
                  }`}
              >
                {size}
              </button>
            );
          })}
        </div>

        {/* Size Guide Link */}
        <button className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-50 text-stone-600 hover:bg-stone-100 text-xs font-semibold transition-colors duration-200">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Guia de Tamanhos
        </button>
      </div>
    </aside>
  );
}
