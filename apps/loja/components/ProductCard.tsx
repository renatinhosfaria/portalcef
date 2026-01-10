'use client';

import { ShoppingBag, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useCart } from '@/lib/useCart';
import { useState } from 'react';

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  schoolId: string;
  unitId: string;
  imageUrl?: string;
  category: string;
  availableStock: number;
}

export function ProductCard({
  id,
  name,
  price,
  schoolId,
  unitId,
  imageUrl,
  category,
  availableStock,
}: ProductCardProps) {
  const { addItem } = useCart();
  const [isHovered, setIsHovered] = useState(false);

  // Generate valid placeholder URL if no image provided
  const displayImage = imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=f0fdf4&color=166534&size=400&font-size=0.33`;

  const isLowStock = availableStock > 0 && availableStock < 5;
  const isOutOfStock = availableStock === 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isOutOfStock) {
      addItem({
        variantId: id, // Using product ID as variant ID for quick add
        productId: id,
        productName: name,
        variantSize: 'UN',
        quantity: 1,
        unitPrice: price,
        studentName: 'Aluno', // Default student name
        availableStock,
        imageUrl: displayImage
      });
    }
  };

  return (
    <Link
      href={`/${schoolId}/${unitId}/produto/${id}`}
      className="group relative bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-xl hover:shadow-brand-900/5 transition-all duration-300 flex flex-col h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Container */}
      <div className="relative aspect-[4/5] overflow-hidden bg-slate-50">
        <img
          src={displayImage}
          alt={name}
          className="w-full h-full object-cover object-center transform group-hover:scale-110 transition-transform duration-700"
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {isOutOfStock && (
            <span className="px-3 py-1 bg-red-500/90 text-white text-xs font-bold rounded-lg backdrop-blur-sm shadow-sm">
              Esgotado
            </span>
          )}
          {isLowStock && (
            <span className="px-3 py-1 bg-amber-500/90 text-white text-xs font-bold rounded-lg backdrop-blur-sm shadow-sm flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Últimas unidades
            </span>
          )}
        </div>

        {/* Quick Add Button - Slides up on hover */}
        <div
          className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent transition-all duration-300 flex items-end justify-center pb-6 ${isHovered && !isOutOfStock ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
        >
          <button
            onClick={handleAddToCart}
            className="w-full bg-white text-brand-900 font-bold py-3 rounded-xl shadow-lg hover:bg-brand-50 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <ShoppingBag className="w-4 h-4" />
            Adicionar
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-5 flex flex-col flex-grow">
        <div className="text-xs font-medium text-brand-500 mb-1 tracking-wide uppercase">
          {category.replace(/_/g, ' ')}
        </div>
        <h3 className="font-semibold text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-2 mb-2 min-h-[3rem]">
          {name}
        </h3>

        <div className="mt-auto flex items-end justify-between">
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 font-medium">Preço</span>
            <span className="text-xl font-bold text-brand-900">
              R$ {price.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
