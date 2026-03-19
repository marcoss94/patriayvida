import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractStoragePathFromPublicUrl,
  generateSku,
  isAllowedProductImageUrl,
  parseVariantsFromFormData,
  sanitizeFileName,
} from "@/lib/product-admin";

describe("product admin deterministic helpers", () => {
  it("builds predictable SKU values", () => {
    assert.equal(generateSku("camiseta-patria", "XL"), "camiseta-patria-xl");
  });

  it("sanitizes unsafe file names", () => {
    assert.equal(sanitizeFileName("f oto@2026?.png"), "f_oto_2026_.png");
  });

  it("accepts only public product image URLs from supabase", () => {
    assert.equal(
      isAllowedProductImageUrl(
        "https://abc123.supabase.co/storage/v1/object/public/product-images/products/x/photo.webp",
      ),
      true,
    );
    assert.equal(isAllowedProductImageUrl("https://evil.example.com/storage/v1/object/public/product-images/x"), false);
    assert.equal(isAllowedProductImageUrl("not-an-url"), false);
  });

  it("extracts the storage path from valid public URLs", () => {
    assert.equal(
      extractStoragePathFromPublicUrl(
        "https://abc123.supabase.co/storage/v1/object/public/product-images/products/p1/file.png",
      ),
      "products/p1/file.png",
    );
    assert.equal(extractStoragePathFromPublicUrl("https://abc123.supabase.co/other"), null);
  });

  it("parses selected sizes and stock from form data", () => {
    const formData = new FormData();
    formData.set("size_XS", "on");
    formData.set("stock_XS", "3");
    formData.set("size_L", "on");
    formData.set("stock_L", "");

    assert.deepEqual(parseVariantsFromFormData(formData), [
      { size: "XS", stock: 3 },
      { size: "L", stock: 0 },
    ]);
  });
});
