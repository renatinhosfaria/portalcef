'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

interface ProductCardCarouselProps {
  images: string[];
  fallbackImage?: string;
  productName: string;
}

export function ProductCardCarousel({
  images,
  fallbackImage,
  productName,
}: ProductCardCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

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

  const handlePrevious = (e: React.MouseEvent) => {
    e.preventDefault();
    setCurrentIndex(
      (prev) => (prev - 1 + displayImages.length) % displayImages.length
    );
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    setCurrentIndex((prev) => (prev + 1) % displayImages.length);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-100">
      <motion.div
        drag={hasMultiple ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={(e: unknown, { offset }: { offset: { x: number; y: number } }) => {
          const swipeThreshold = 50;
          if (offset.x > swipeThreshold) {
            handlePrevious(e as unknown as React.MouseEvent);
          } else if (offset.x < -swipeThreshold) {
            handleNext(e as unknown as React.MouseEvent);
          }
        }}
        className="absolute inset-0"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative w-full h-full"
          >
            <Image
              src={displayImages[currentIndex]}
              alt={`${productName} - imagem ${currentIndex + 1}`}
              fill
              unoptimized
              className="object-cover object-center"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {hasMultiple && (
        <>
          <button
            onClick={handlePrevious}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white rounded-full p-1.5 shadow-sm border border-slate-200 transition-colors duration-150 opacity-0 group-hover:opacity-100"
            aria-label="Imagem anterior"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white rounded-full p-1.5 shadow-sm border border-slate-200 transition-colors duration-150 opacity-0 group-hover:opacity-100"
            aria-label="Próxima imagem"
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </>
      )}

      {hasMultiple && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 z-10">
          {displayImages.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.preventDefault();
                setCurrentIndex(index);
              }}
              className={`h-1.5 rounded-full transition-all duration-150 ${
                index === currentIndex
                  ? 'bg-white w-3'
                  : 'bg-white/50 w-1.5 hover:bg-white/75'
              }`}
              aria-label={`Ver imagem ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
