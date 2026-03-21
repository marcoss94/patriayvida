'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type ProductGalleryProps = {
  images: string[];
  productName: string;
};

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const validImages = useMemo(
    () => images.filter((image): image is string => typeof image === 'string' && image.length > 0),
    [images]
  );
  const hasMultipleImages = validImages.length > 1;

  const [selectedIndex, setSelectedIndex] = useState(0);
  const safeSelectedIndex = Math.min(selectedIndex, Math.max(validImages.length - 1, 0));
  const selectedImage = validImages[safeSelectedIndex];

  function moveSelection(delta: number) {
    if (validImages.length <= 1) {
      return;
    }

    const nextIndex = (safeSelectedIndex + delta + validImages.length) % validImages.length;
    setSelectedIndex(nextIndex);
  }

  return (
    <section className="grid gap-3 lg:grid-cols-[74px_minmax(0,1fr)]" aria-label="Galeria del producto">
      {hasMultipleImages ? (
        <div
          className="order-2 flex gap-2 overflow-x-auto pb-1 lg:order-1 lg:max-h-[70vh] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden"
          role="listbox"
          aria-label="Miniaturas del producto"
          aria-orientation="vertical"
        >
          {validImages.map((image, index) => {
            const selected = index === safeSelectedIndex;

            return (
              <button
                key={`${image}-${index}`}
                type="button"
                role="option"
                aria-selected={selected}
                aria-label={`Ver imagen ${index + 1} de ${validImages.length}`}
                className={`relative h-20 w-16 shrink-0 cursor-pointer overflow-hidden rounded-lg border bg-slate-900/70 outline-none transition-colors ${
                  selected
                    ? 'border-red-500 shadow-[0_0_14px_rgba(204,41,54,0.26)]'
                    : 'border-slate-700/70 hover:border-red-400/70'
                }`}
                onClick={() => setSelectedIndex(index)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                    event.preventDefault();
                    moveSelection(1);
                  }

                  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    moveSelection(-1);
                  }
                }}
              >
                <span className="sr-only">Imagen {index + 1}</span>
                <Image
                  src={image}
                  alt={`${productName} - miniatura ${index + 1}`}
                  fill
                  sizes="74px"
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="order-1 relative aspect-[4/5] overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/60 lg:order-2">
        {hasMultipleImages ? (
          <>
            <button
              type="button"
              aria-label="Ver imagen anterior"
              className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/15 bg-slate-950/72 text-white shadow-[0_8px_24px_rgba(15,23,42,0.35)] transition hover:border-red-400/70 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70"
              onClick={() => moveSelection(-1)}
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Ver imagen siguiente"
              className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/15 bg-slate-950/72 text-white shadow-[0_8px_24px_rgba(15,23,42,0.35)] transition hover:border-red-400/70 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70"
              onClick={() => moveSelection(1)}
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        ) : null}
        <Image
          src={selectedImage}
          alt={`${productName} - imagen ${safeSelectedIndex + 1}`}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 48vw"
          className="object-cover"
        />
      </div>
    </section>
  );
}
