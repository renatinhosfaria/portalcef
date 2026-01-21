'use client';

import { Package } from 'lucide-react';
import Image from 'next/image';

interface OrderItemCardProps {
  productName: string;
  variantSize: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  studentName?: string;
  imageUrl?: string;
}

export function OrderItemCard({
  productName,
  variantSize,
  quantity,
  unitPrice,
  subtotal,
  studentName,
  imageUrl,
}: OrderItemCardProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="flex gap-4 p-4 bg-white border border-slate-200 rounded-lg">
      {/* Image */}
      <div className="relative w-16 h-16 flex-shrink-0 bg-slate-100 rounded-lg overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={productName}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Package className="w-6 h-6 text-slate-400" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-slate-800 text-sm truncate">
          {productName}
        </h4>
        <div className="text-xs text-slate-500 mt-0.5">
          Tamanho: <span className="font-medium text-slate-700">{variantSize}</span>
        </div>
        {studentName && (
          <div className="text-xs text-slate-500">
            Aluno: <span className="font-medium text-slate-700">{studentName}</span>
          </div>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
          <span>
            Qtd: <span className="font-medium text-slate-700 tabular-nums">{quantity}</span>
          </span>
          <span className="tabular-nums">{formatCurrency(unitPrice)}</span>
        </div>
      </div>

      {/* Subtotal */}
      <div className="flex-shrink-0 text-right self-center">
        <div className="text-base font-semibold text-slate-800 tabular-nums">
          {formatCurrency(subtotal)}
        </div>
      </div>
    </div>
  );
}
