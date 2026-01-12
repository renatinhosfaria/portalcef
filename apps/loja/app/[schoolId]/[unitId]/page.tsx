'use client';

import { use, useCallback, useEffect, useState } from 'react';

import { FilterSidebar } from '@/components/FilterSidebar';
import { LoadingSkeleton } from '@/components/Loading';
import { ProductCard } from '@/components/ProductCard';
import { ShopHeader } from '@/components/ShopHeader';
import { ShopHero } from '@/components/ShopHero';

interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  category: string;
  availableStock: number;
}

// API response types
interface ApiInventory {
  quantity: number;
  reservedQuantity: number;
}

interface ApiVariant {
  inventory?: ApiInventory[];
  availableStock?: number;
}

interface ApiProduct {
  id: string;
  name: string;
  basePrice: number;
  imageUrl?: string;
  category: string;
  variants?: ApiVariant[];
}

export default function CatalogPage({
  params,
}: {
  params: Promise<{ schoolId: string; unitId: string }>;
}) {
  const resolvedParams = use(params);
  const { schoolId, unitId } = resolvedParams;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [sizeFilter, setSizeFilter] = useState<string>('');

  useEffect(() => {
    localStorage.setItem('cef_shop_school_id', schoolId);
    localStorage.setItem('cef_shop_unit_id', unitId);
  }, [schoolId, unitId]);

  const fetchProducts = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
        setError(null);
      }

      const params = new URLSearchParams();
      if (categoryFilter) params.append('category', categoryFilter);
      if (sizeFilter) params.append('size', sizeFilter);
      params.append('inStock', 'true');

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(`/api/shop/catalog/${schoolId}/${unitId}${queryString}`);

      if (!response.ok) {
        throw new Error('Falha ao carregar produtos');
      }

      const result = await response.json();

      if (result.success && result.data) {
        // Transform products to flat format for ProductCard
        const transformedProducts: Product[] = result.data.map((product: ApiProduct) => {
          // Calculate total available stock across all variants
          const totalStock = product.variants?.reduce((sum: number, variant: ApiVariant) => {
            // Backend returns pre-calculated availableStock per variant
            if (typeof variant.availableStock === 'number') {
              return sum + variant.availableStock;
            }
            // Fallback for direct inventory access (if backend changes)
            const inventoryStock = variant.inventory?.reduce((invSum: number, inv: ApiInventory) => {
              return invSum + (inv.quantity - inv.reservedQuantity);
            }, 0) || 0;
            return sum + inventoryStock;
          }, 0) || 0;

          return {
            id: product.id,
            name: product.name,
            price: product.basePrice / 100, // Convert cents to float
            imageUrl: product.imageUrl || undefined,
            category: product.category,
            availableStock: totalStock,
          };
        });

        setProducts(transformedProducts);
      } else {
        setProducts([]);
      }
    } catch (err: unknown) {
      console.error('Error fetching products:', err);
      const message = err instanceof Error ? err.message : 'Erro ao carregar produtos';
      setError(message);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [schoolId, unitId, categoryFilter, sizeFilter]);

  // Initial load
  useEffect(() => {
    fetchProducts(false);
  }, [fetchProducts]);

  // Polling for stock updates (every 30s)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchProducts(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchProducts]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <ShopHeader />
        <div className="pt-24 max-w-7xl mx-auto px-4 py-8">
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 shadow-sm max-w-md w-full text-center border border-slate-200">
          <div className="w-12 h-12 rounded-lg bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold tracking-tight mb-2 text-slate-800">Ops, algo deu errado</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <button
            onClick={() => fetchProducts()}
            className="w-full bg-[#A3D154] text-white font-semibold py-3 rounded-lg hover:bg-[#8FBD3F] transition-colors duration-150"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <ShopHeader />

      <main className="pt-24 pb-12 px-4 lg:px-6 max-w-7xl mx-auto">
        {/* Banner Hero */}
        <ShopHero />

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters - Desktop Sticky */}
          <div className="w-full lg:w-64 flex-shrink-0">
            <div className="lg:sticky lg:top-28">
              <FilterSidebar
                activeCategory={categoryFilter}
                onCategoryChange={setCategoryFilter}
                activeSize={sizeFilter}
                onSizeChange={setSizeFilter}
              />
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold tracking-tight text-slate-800">
                {categoryFilter ? (
                  <span className="flex items-center gap-2">
                    Resultados para <span className="text-[#5a7a1f]">{categoryFilter.replace(/_/g, ' ')}</span>
                  </span>
                ) : (
                  'Produtos em Destaque'
                )}
              </h2>
              <span className="text-sm text-slate-500 font-medium tabular-nums">
                {products.length} produtos encontrados
              </span>
            </div>

            {products.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center border border-dashed border-slate-300">
                <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-slate-800 mb-2">Nenhum produto encontrado</h3>
                <p className="text-slate-500 mb-6 max-w-md mx-auto">
                  Não encontramos produtos com os filtros selecionados. Tente limpar os filtros para ver tudo.
                </p>
                <button
                  onClick={() => {
                    setCategoryFilter('');
                    setSizeFilter('');
                  }}
                  className="px-6 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors duration-150"
                >
                  Limpar Filtros
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                {products.map((product, index) => (
                  <div
                    key={product.id}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <ProductCard
                      schoolId={schoolId}
                      unitId={unitId}
                      {...product}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
