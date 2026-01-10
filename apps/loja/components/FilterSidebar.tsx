'use client';

type FilterSidebarProps = {
    activeCategory: string;
    onCategoryChange: (category: string) => void;
    activeSize: string;
    onSizeChange: (size: string) => void;
};

const CATEGORIES = [
    { id: '', label: 'Ver Todos', icon: '🛍️' },
    { id: 'UNIFORME_DIARIO', label: 'Uniforme Diário', icon: '👕' },
    { id: 'UNIFORME_EDUCACAO_FISICA', label: 'Ed. Física', icon: '🏃' },
    { id: 'ACESSORIO', label: 'Acessórios', icon: '🎒' },
];

const SIZES = ['2', '4', '6', '8', '10', '12', '14', '16', 'P', 'M', 'G', 'GG'];

export function FilterSidebar({
    activeCategory,
    onCategoryChange,
    activeSize,
    onSizeChange
}: FilterSidebarProps) {
    return (
        <aside className="w-full space-y-8">
            {/* Categories */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h3 className="text-lg font-bold text-brand-900 mb-4 px-2">Categorias</h3>
                <div className="space-y-1">
                    {CATEGORIES.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => onCategoryChange(cat.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium ${activeCategory === cat.id
                                    ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-200'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                        >
                            <span className="text-lg">{cat.icon}</span>
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Sizes */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h3 className="text-lg font-bold text-brand-900 mb-4 px-2">Tamanhos</h3>
                <div className="grid grid-cols-4 gap-2">
                    {SIZES.map((size) => (
                        <button
                            key={size}
                            onClick={() => onSizeChange(activeSize === size ? '' : size)}
                            className={`aspect-square flex items-center justify-center rounded-lg text-sm font-semibold transition-all duration-200 border ${activeSize === size
                                    ? 'bg-brand-500 text-white border-brand-500 shadow-md shadow-brand-500/20 scale-105'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300 hover:text-brand-700'
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
