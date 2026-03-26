export type ProductDescriptionInlineNode =
  | { type: "text"; value: string }
  | { type: "strong"; value: string }
  | { type: "em"; value: string };

export type ProductDescriptionBlock =
  | { type: "paragraph"; lines: ProductDescriptionInlineNode[][] }
  | { type: "list"; items: ProductDescriptionInlineNode[][] };

export type ProductDescriptionToolbarAction =
  | "bold"
  | "italic"
  | "bulletList"
  | "lineBreak";

type ToolbarInput = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

type ToolbarOutput = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

const LIST_ITEM_PATTERN = /^[-*]\s+(.*)$/;

export function parseProductDescription(input: string | null | undefined): ProductDescriptionBlock[] {
  const normalized = normalizeDescription(input);

  if (!normalized) {
    return [];
  }

  const blocks: ProductDescriptionBlock[] = [];
  const paragraphLines: string[] = [];
  const listItems: string[] = [];

  function flushParagraph() {
    if (paragraphLines.length === 0) {
      return;
    }

    blocks.push({
      type: "paragraph",
      lines: paragraphLines.map((line) => parseInlineFormatting(line)),
    });
    paragraphLines.length = 0;
  }

  function flushList() {
    if (listItems.length === 0) {
      return;
    }

    blocks.push({
      type: "list",
      items: listItems.map((item) => parseInlineFormatting(item)),
    });
    listItems.length = 0;
  }

  for (const line of normalized.split("\n")) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const listMatch = trimmed.match(LIST_ITEM_PATTERN);
    if (listMatch) {
      flushParagraph();
      listItems.push(listMatch[1]);
      continue;
    }

    flushList();
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();

  return blocks;
}

export function productDescriptionToPlainText(input: string | null | undefined): string {
  const blocks = parseProductDescription(input);

  return blocks
    .map((block) => {
      if (block.type === "list") {
        return block.items.map((item) => inlineNodesToText(item)).join("\n");
      }

      return block.lines.map((line) => inlineNodesToText(line)).join("\n");
    })
    .join("\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function applyProductDescriptionToolbarAction(
  input: ToolbarInput,
  action: ProductDescriptionToolbarAction,
): ToolbarOutput {
  switch (action) {
    case "bold":
      return wrapSelection(input, "**", "texto en negrita");
    case "italic":
      return wrapSelection(input, "*", "texto en cursiva");
    case "bulletList":
      return convertSelectionToBulletList(input);
    case "lineBreak":
      return insertAtSelection(input, "\n");
    default:
      return input;
  }
}

function normalizeDescription(input: string | null | undefined): string {
  return (input ?? "").replace(/\r\n?/g, "\n").trim();
}

function parseInlineFormatting(text: string): ProductDescriptionInlineNode[] {
  const nodes: ProductDescriptionInlineNode[] = [];
  let index = 0;

  while (index < text.length) {
    if (text.startsWith("**", index)) {
      const closeIndex = text.indexOf("**", index + 2);
      if (closeIndex > index + 2) {
        nodes.push({
          type: "strong",
          value: text.slice(index + 2, closeIndex),
        });
        index = closeIndex + 2;
        continue;
      }
    }

    const currentChar = text[index];
    if (currentChar === "*" || currentChar === "_") {
      const closeIndex = text.indexOf(currentChar, index + 1);
      if (closeIndex > index + 1) {
        nodes.push({
          type: "em",
          value: text.slice(index + 1, closeIndex),
        });
        index = closeIndex + 1;
        continue;
      }
    }

    const nextMarkerIndex = findNextMarkerIndex(text, index + 1);
    nodes.push({
      type: "text",
      value: text.slice(index, nextMarkerIndex),
    });
    index = nextMarkerIndex;
  }

  return nodes.filter((node) => node.value.length > 0);
}

function findNextMarkerIndex(text: string, startIndex: number): number {
  const markerIndexes = [text.indexOf("**", startIndex), text.indexOf("*", startIndex), text.indexOf("_", startIndex)]
    .filter((index) => index >= 0);

  if (markerIndexes.length === 0) {
    return text.length;
  }

  return Math.min(...markerIndexes);
}

function inlineNodesToText(nodes: ProductDescriptionInlineNode[]): string {
  return nodes.map((node) => node.value).join("");
}

function wrapSelection(input: ToolbarInput, marker: string, placeholder: string): ToolbarOutput {
  const selectedText = input.value.slice(input.selectionStart, input.selectionEnd) || placeholder;
  const inserted = `${marker}${selectedText}${marker}`;
  const nextValue =
    input.value.slice(0, input.selectionStart) + inserted + input.value.slice(input.selectionEnd);
  const selectionOffset = marker.length;

  return {
    value: nextValue,
    selectionStart: input.selectionStart + selectionOffset,
    selectionEnd: input.selectionStart + selectionOffset + selectedText.length,
  };
}

function insertAtSelection(input: ToolbarInput, inserted: string): ToolbarOutput {
  const nextValue =
    input.value.slice(0, input.selectionStart) + inserted + input.value.slice(input.selectionEnd);
  const caret = input.selectionStart + inserted.length;

  return {
    value: nextValue,
    selectionStart: caret,
    selectionEnd: caret,
  };
}

function convertSelectionToBulletList(input: ToolbarInput): ToolbarOutput {
  const selectedText = input.value.slice(input.selectionStart, input.selectionEnd);
  const lines = (selectedText || "item de lista")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const listText = lines.map((line) => `- ${line}`).join("\n");
  const nextValue =
    input.value.slice(0, input.selectionStart) + listText + input.value.slice(input.selectionEnd);

  return {
    value: nextValue,
    selectionStart: input.selectionStart,
    selectionEnd: input.selectionStart + listText.length,
  };
}
