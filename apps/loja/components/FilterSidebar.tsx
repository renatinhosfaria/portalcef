'use client';

import { Grid3X3, Package, Shirt, Backpack } from 'lucide-react';

type FilterSidebarProps = {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  activeSize: string;
  onSizeChange: (size: string) => void;
};

const CATEGORIES = [
  { id: '', label: 'Ver Todos', icon: Grid3X3 },
  { id: 'UNIFORME_DIARIO', label: 'Uniforme Diário', icon: Shirt },
  { id: 'UNIFORME_EDUCACAO_FISICA', label: 'Ed. Física', icon: Package },
  { id: 'ACESSORIO', label: 'Acessórios', icon: Backpack },
];

const SIZES = ['2', '4', '6', '8', '10', '12', '14', '16', 'P', 'M', 'G', 'GG'];

export function FilterSidebar({
  activeCategory,
  onCategoryChange,
  activeSize,
  onSizeChange
}: FilterSidebarProps) {
  return (
    <aside className="w-full space-y-4">
      {/* Categories */}
      <div className="bg-white rounded-lg p-4 border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Categorias</h3>
        <div className="space-y-1">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => onCategoryChange(cat.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors duration-150 text-sm ${
                  activeCategory === cat.id
                    ? 'bg-[#A3D154]/10 text-[#5a7a1f] font-medium'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sizes */}
      <div className="bg-white rounded-lg p-4 border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Tamanhos</h3>
        <div className="grid grid-cols-4 gap-1.5">
          {SIZES.map((size) => (
            <button
              key={size}
              onClick={() => onSizeChange(activeSize === size ? '' : size)}
              className={`h-9 flex items-center justify-center rounded-md text-sm font-medium transition-colors duration-150 ${
                activeSize === size
                  ? 'bg-[#A3D154] text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
