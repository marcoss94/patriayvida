import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getUploadErrorMessage } from "@/lib/upload-errors";

describe("getUploadErrorMessage", () => {
  it("translates server action body limit errors", () => {
    assert.equal(
      getUploadErrorMessage(new Error("Body exceeded 1 MB limit.")),
      "La imagen supera el limite que acepta el servidor (1 MB). Proba con un archivo mas liviano.",
    );
  });

  it("falls back to the original error message when present", () => {
    assert.equal(getUploadErrorMessage(new Error("Storage unavailable")), "Storage unavailable");
  });

  it("returns a generic message for unknown errors", () => {
    assert.equal(getUploadErrorMessage(null), "No se pudo subir la imagen. Proba de nuevo.");
  });
});
