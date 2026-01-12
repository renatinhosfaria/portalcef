'use client';

import { AlertCircle, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useCart } from '@/lib/useCart';

import { ProductCardCarousel } from './ProductCardCarousel';

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  schoolId: string;
  unitId: string;
  imageUrl?: string;
  images?: string[];
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
  images,
  category,
  availableStock,
}: ProductCardProps) {
  const { addItem } = useCart();
  const [isHovered, setIsHovered] = useState(false);

  const isLowStock = availableStock > 0 && availableStock < 5;
  const isOutOfStock = availableStock === 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isOutOfStock) {
      addItem({
        variantId: id,
        productId: id,
        productName: name,
        variantSize: 'UN',
        quantity: 1,
        unitPrice: price,
        studentName: 'Aluno',
        availableStock,
        imageUrl: imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=f0fdf4&color=166534&size=400&font-size=0.33`
      });
    }
  };

  return (
    <Link
      href={`/${schoolId}/${unitId}/produto/${id}`}
      className="group block bg-white rounded-lg border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-md transition-all duration-200"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Container */}
      <div className="relative aspect-[4/5] overflow-hidden bg-slate-50">
        <ProductCardCarousel
          images={images || []}
          fallbackImage={imageUrl}
          productName={name}
        />

        {/* Status Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1.5 z-10">
          {isOutOfStock && (
            <span className="px-2 py-0.5 bg-slate-800 text-white text-xs font-medium rounded">
              Esgotado
            </span>
          )}
          {isLowStock && (
            <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-medium rounded flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Restam {availableStock}
            </span>
          )}
        </div>

        {/* Quick Add Button */}
        {!isOutOfStock && (
          <div
            className={`absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent transition-opacity duration-200 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <button
              onClick={handleAddToCart}
              className="w-full bg-white text-slate-800 font-medium py-2 rounded-lg hover:bg-slate-50 transition-colors duration-150 flex items-center justify-center gap-2 text-sm"
            >
              <ShoppingBag className="w-4 h-4" />
              Adicionar
            </button>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          {category.replace(/_/g, ' ')}
        </span>
        <h3 className="font-medium text-slate-800 mt-1 line-clamp-2 min-h-[2.5rem] text-sm leading-tight">
          {name}
        </h3>
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-lg font-semibold text-slate-800 tabular-nums">
            R$ {price.toFixed(2).replace('.', ',')}
          </span>
          {isOutOfStock && (
            <span className="text-xs text-slate-400">Indisponível</span>
          )}
        </div>
      </div>
    </Link>
  );
}
