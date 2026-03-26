import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductDescription } from "@/components/shop/product-description";
import {
  applyProductDescriptionToolbarAction,
  productDescriptionToPlainText,
} from "@/lib/product-description";

describe("product description helpers", () => {
  it("renders lightweight formatting without unsafe html", () => {
    const markup = renderToStaticMarkup(
      createElement(ProductDescription, {
        content: "**Algodon premium**\nCon calce comodo\n\n- Edicion limitada\n- <script>alert(1)</script>",
      }),
    );

    assert.match(markup, /<strong[^>]*>Algodon premium<\/strong>/);
    assert.match(markup, /<br\/>Con calce comodo/);
    assert.match(markup, /<ul/);
    assert.match(markup, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(markup, /<script>alert\(1\)<\/script>/);
  });

  it("reuses the renderer with admin preview styles", () => {
    const markup = renderToStaticMarkup(
      createElement(ProductDescription, {
        content: "**Algodon premium**\n- Hecho en Uruguay",
        tone: "adminPreview",
      }),
    );

    assert.match(markup, /text-foreground/);
    assert.match(markup, /marker:text-muted-foreground/);
    assert.match(markup, /<strong[^>]*>Algodon premium<\/strong>/);
  });

  it("strips formatting for metadata-friendly plain text", () => {
    assert.equal(
      productDescriptionToPlainText("**Frente**\n\n- Algodon\n- _Edicion limitada_"),
      "Frente Algodon Edicion limitada",
    );
  });

  it("applies toolbar actions for admin editing", () => {
    const bold = applyProductDescriptionToolbarAction(
      {
        value: "Remera patria",
        selectionStart: 0,
        selectionEnd: 6,
      },
      "bold",
    );

    assert.equal(bold.value, "**Remera** patria");

    const list = applyProductDescriptionToolbarAction(
      {
        value: "Algodon\nHecha en Uruguay",
        selectionStart: 0,
        selectionEnd: "Algodon\nHecha en Uruguay".length,
      },
      "bulletList",
    );

    assert.equal(list.value, "- Algodon\n- Hecha en Uruguay");
  });
});
