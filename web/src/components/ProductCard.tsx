import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/lib/types";
import type { ProductDiscount } from "@/lib/campaigns";
import { formatPKR } from "@/lib/format";
import { fabricImage, fabricGallery } from "@/lib/placeholder";

interface Props {
  product: Product;
  discount?: ProductDiscount;
}

export function ProductCard({ product, discount }: Props) {
  const gallery = fabricGallery(product.images);
  return (
    <Link href={`/product/${product.slug}`} className="group block">
      <div
        className="relative aspect-[3/4] overflow-hidden bg-mist"
        style={{ viewTransitionName: `product-image-${product.id}` } as React.CSSProperties}
      >
        <Image
          src={fabricImage(gallery[0])}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
        {gallery[1] && (
          <Image
            src={gallery[1]}
            alt=""
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          />
        )}

        {/* Discount badge takes priority over "New" badge */}
        {discount ? (
          <span className="absolute left-0 top-3 bg-ink text-paper px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] uppercase">
            {discount.label}
          </span>
        ) : product.isNew ? (
          <span className="absolute left-3 top-3 bg-paper px-2 py-1 text-[10px] tracking-[0.18em] uppercase">
            New
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-start justify-between gap-3 text-sm">
        <div className="min-w-0">
          <p className="truncate">{product.name}</p>
          <p className="mt-0.5 text-xs text-muted">
            {product.gsm} GSM · {product.weave}
          </p>
        </div>

        <div className="shrink-0 text-right">
          {discount ? (
            <>
              <p className="text-xs text-muted line-through leading-none">
                {formatPKR(product.pricePerSuit)}
              </p>
              <p className="font-semibold text-ink">{formatPKR(discount.discountedPricePerSuit)}</p>
            </>
          ) : (
            <p className="font-semibold text-ink">{formatPKR(product.pricePerSuit)}</p>
          )}
          <p className="mt-0.5 text-xs text-muted font-medium">/ suit</p>
          <p className="mt-1.5 inline-block rounded border border-stone/30 bg-stone/5 px-1.5 py-0.5 text-[10px] text-muted">
            {product.metersPerSuit}m included
          </p>
        </div>
      </div>
    </Link>
  );
}
