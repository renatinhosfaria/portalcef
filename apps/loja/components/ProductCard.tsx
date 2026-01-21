'use client';

import { AlertCircle, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

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
  const [isHovered, setIsHovered] = useState(false);

  const isLowStock = availableStock > 0 && availableStock < 5;
  const isOutOfStock = availableStock === 0;

  return (
    <Link
      href={`/${schoolId}/${unitId}/produto/${id}`}
      className="group block relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Card Container com efeito glow */}
      <div className="shop-card-featured h-full flex flex-col">
        {/* Glow effect no hover */}
        <div className="absolute -inset-1 bg-gradient-to-r from-[#A3D154] to-[#F59E0B] rounded-2xl opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500" />

        {/* Image Container */}
        <div className="relative aspect-[4/5] overflow-hidden bg-stone-100 rounded-t-xl">
          <ProductCardCarousel
            images={images || []}
            fallbackImage={imageUrl}
            productName={name}
          />

          {/* Gradient overlay no hover */}
          <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'
            }`} />

          {/* Status Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
            {isOutOfStock && (
              <span className="badge badge-danger animate-fade-in-down shadow-lg">
                Esgotado
              </span>
            )}
            {isLowStock && (
              <span className="badge badge-warning animate-fade-in-down flex items-center gap-1 shadow-lg">
                <AlertCircle className="w-3 h-3" />
                Restam {availableStock}
              </span>
            )}
          </div>

          {/* Promoção badge (exemplo) */}
          {availableStock > 10 && (
            <div className="absolute top-3 right-3 z-10">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F59E0B] text-white text-xs font-bold shadow-lg animate-glow-pulse">
                <Sparkles className="w-3 h-3" />
                Em Estoque
              </span>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="p-5 flex-1 flex flex-col">
          {/* Category */}
          <span className="text-xs font-bold text-[#F59E0B] uppercase tracking-wider mb-2">
            {category.replace(/_/g, ' ')}
          </span>

          {/* Product Name */}
          <h3 className="font-display font-semibold text-stone-800 text-base leading-tight mb-3 line-clamp-2 min-h-[2.5rem] group-hover:text-[#5a7a1f] transition-colors duration-200">
            {name}
          </h3>

          {/* Price and Stock Info */}
          <div className="mt-auto flex items-end justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-stone-500 font-medium mb-0.5">A partir de</span>
              <span className="font-display text-2xl font-bold text-stone-900 tabular-nums">
                R$ {price.toFixed(2).replace('.', ',')}
              </span>
            </div>

            {isOutOfStock ? (
              <span className="text-xs text-red-500 font-semibold">Indisponível</span>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F0FDF4] border border-[#A3D154]/20">
                <div className="w-2 h-2 rounded-full bg-[#A3D154] animate-pulse" />
                <span className="text-xs text-[#5a7a1f] font-semibold">Disponível</span>
              </div>
            )}
          </div>
        </div>

        {/* Hover accent line */}
        <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#A3D154] to-[#F59E0B] transform origin-left transition-transform duration-300 ease-out ${isHovered ? 'scale-x-100' : 'scale-x-0'
          }`} />
      </div>
    </Link>
  );
}
