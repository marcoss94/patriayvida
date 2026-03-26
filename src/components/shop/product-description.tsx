import { Fragment } from "react";
import {
  parseProductDescription,
  type ProductDescriptionInlineNode,
} from "@/lib/product-description";
import { cn } from "@/lib/utils";

type ProductDescriptionTone = "storefront" | "adminPreview";

type ProductDescriptionProps = {
  content: string;
  className?: string;
  tone?: ProductDescriptionTone;
};

const toneStyles: Record<
  ProductDescriptionTone,
  {
    root: string;
    list: string;
    strong: string;
    em: string;
  }
> = {
  storefront: {
    root: "space-y-4 text-sm leading-relaxed text-slate-300",
    list: "space-y-2 pl-5 marker:text-slate-500 list-disc",
    strong: "font-semibold text-slate-100",
    em: "italic text-slate-200",
  },
  adminPreview: {
    root: "space-y-4 text-sm leading-relaxed text-foreground",
    list: "space-y-2 pl-5 marker:text-muted-foreground list-disc",
    strong: "font-semibold text-foreground",
    em: "italic text-foreground/80",
  },
};

export function ProductDescription({
  content,
  className,
  tone = "storefront",
}: ProductDescriptionProps) {
  const blocks = parseProductDescription(content);
  const styles = toneStyles[tone];

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className={cn(styles.root, className)}>
      {blocks.map((block, blockIndex) => {
        if (block.type === "list") {
          return (
            <ul key={`list-${blockIndex}`} className={styles.list}>
              {block.items.map((item, itemIndex) => (
                <li key={`list-item-${blockIndex}-${itemIndex}`}>
                  {renderInlineNodes(item, styles)}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`paragraph-${blockIndex}`}>
            {block.lines.map((line, lineIndex) => (
              <Fragment key={`line-${blockIndex}-${lineIndex}`}>
                {lineIndex > 0 ? <br /> : null}
                {renderInlineNodes(line, styles)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function renderInlineNodes(
  nodes: ProductDescriptionInlineNode[],
  styles: (typeof toneStyles)[ProductDescriptionTone],
) {
  return nodes.map((node, index) => {
    if (node.type === "strong") {
      return (
        <strong key={`strong-${index}`} className={styles.strong}>
          {node.value}
        </strong>
      );
    }

    if (node.type === "em") {
      return (
        <em key={`em-${index}`} className={styles.em}>
          {node.value}
        </em>
      );
    }

    return <Fragment key={`text-${index}`}>{node.value}</Fragment>;
  });
}
