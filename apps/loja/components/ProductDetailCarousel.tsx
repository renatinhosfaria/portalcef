'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

interface ProductDetailCarouselProps {
  images: string[];
  fallbackImage?: string;
  productName: string;
}

export function ProductDetailCarousel({
  images,
  fallbackImage,
  productName,
}: ProductDetailCarouselProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const displayImages = images.length > 0
    ? images
    : fallbackImage
      ? [fallbackImage]
      : [
          `https://ui-avatars.com/api/?name=${encodeURIComponent(
            productName
          )}&background=f0fdf4&color=166534&size=400&font-size=0.33`,
        ];

  const hasMultiple = displayImages.length > 1;

  const handlePrevious = () => {
    setSelectedIndex(
      (prev) => (prev - 1 + displayImages.length) % displayImages.length
    );
  };

  const handleNext = () => {
    setSelectedIndex((prev) => (prev + 1) % displayImages.length);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Main Image */}
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-100 border border-slate-200">
        <motion.div
          drag={hasMultiple ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(e: unknown, { offset }: { offset: { x: number; y: number } }) => {
            if (offset.x > 50) handlePrevious();
            if (offset.x < -50) handleNext();
          }}
          className="absolute inset-0"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full h-full"
            >
              <Image
                src={displayImages[selectedIndex]}
                alt={`${productName} - imagem ${selectedIndex + 1} de ${displayImages.length}`}
                fill
                className="object-cover"
                priority={selectedIndex === 0}
                sizes="(max-width: 768px) 100vw, 50vw"
                unoptimized
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {hasMultiple && (
          <>
            <button
              onClick={handlePrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/95 p-2 shadow-sm border border-slate-200 hover:bg-white transition-colors duration-150"
              aria-label="Imagem anterior"
            >
              <ChevronLeft className="h-5 w-5 text-slate-600" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/95 p-2 shadow-sm border border-slate-200 hover:bg-white transition-colors duration-150"
              aria-label="Próxima imagem"
            >
              <ChevronRight className="h-5 w-5 text-slate-600" />
            </button>
          </>
        )}

        {hasMultiple && (
          <div className="absolute top-2 right-2 bg-slate-800/80 text-white text-xs font-medium px-2 py-1 rounded tabular-nums">
            {selectedIndex + 1} / {displayImages.length}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {hasMultiple && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {displayImages.map((image, index) => (
            <button
              key={index}
              onClick={() => setSelectedIndex(index)}
              className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border-2 transition-colors duration-150 ${
                index === selectedIndex
                  ? 'border-[#A3D154]'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              aria-label={`Ver imagem ${index + 1}`}
              aria-current={index === selectedIndex ? 'true' : undefined}
            >
              <Image
                src={image}
                alt={`${productName} miniatura ${index + 1}`}
                fill
                className="object-cover"
                sizes="64px"
                unoptimized
              />
            </button>
          ))}
        </div>
      )}

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Exibindo imagem {selectedIndex + 1} de {displayImages.length}
      </div>
    </div>
  );
}
