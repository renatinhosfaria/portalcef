'use client';

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
  return (
    <div className="flex gap-4 p-4 border border-gray-200 rounded-lg">
      {/* Image */}
      <div className="relative w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={productName}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-3xl">
            👕
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-gray-900 truncate">
          {productName}
        </h4>
        <div className="text-sm text-muted-foreground mt-1">
          Tamanho: {variantSize}
        </div>
        {studentName && (
          <div className="text-sm text-muted-foreground">
            Aluno: {studentName}
          </div>
        )}
        <div className="flex items-center gap-4 mt-2">
          <span className="text-sm">
            Qtd: <strong>{quantity}</strong>
          </span>
          <span className="text-sm">
            R$ {(unitPrice / 100).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Subtotal */}
      <div className="flex-shrink-0 text-right">
        <div className="text-lg font-bold text-primary">
          R$ {(subtotal / 100).toFixed(2)}
        </div>
      </div>
    </div>
  );
}
