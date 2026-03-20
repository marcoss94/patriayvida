"use client";

import { create } from "zustand";

type CartPreviewState = {
  isOpen: boolean;
  highlightedVariantId: string | null;
  open: () => void;
  openForVariant: (variantId: string) => void;
  close: () => void;
  setOpen: (open: boolean) => void;
};

export const useCartPreviewStore = create<CartPreviewState>((set) => ({
  isOpen: false,
  highlightedVariantId: null,
  open: () => set({ isOpen: true }),
  openForVariant: (variantId) => set({ isOpen: true, highlightedVariantId: variantId }),
  close: () => set({ isOpen: false }),
  setOpen: (open) => set({ isOpen: open }),
}));
