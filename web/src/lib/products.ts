import type { Product } from "./types";

export const products: Product[] = [
  {
    id: "p-001",
    slug: "ivory-poplin-cotton",
    name: "Ivory Poplin Cotton",
    category: "cotton",
    weave: "plain",
    gsm: 145,
    threadCount: 220,
    composition: "100% Egyptian Cotton",
    colorName: "Ivory",
    colorHex: "#f4ecd8",
    pricePerMeter: 1850,
    pricePerSuit: 6800,
    metersPerSuit: 3.5,
    images: [
      "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1600&q=80",
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1600&q=80",
    ],
    shortDescription: "Crisp, breathable poplin with a quiet sheen.",
    description:
      "An everyday foundation cloth woven from long-staple Egyptian cotton. Tightly spun yarns deliver a clean drape and a subtle, natural sheen — equally at home in summer kurtas and tailored shirting.",
    isNew: true,
    isFeatured: true,
    available: true,
  },
  {
    id: "p-002",
    slug: "graphite-twill-wool",
    name: "Graphite Twill Wool",
    category: "wool",
    weave: "twill",
    gsm: 320,
    composition: "100% Merino Wool",
    colorName: "Graphite",
    colorHex: "#3a3a3a",
    pricePerMeter: 4250,
    pricePerSuit: 15400,
    metersPerSuit: 3.5,
    images: [
      "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=1600&q=80",
      "https://images.unsplash.com/photo-1551232864-3f0890e580d9?w=1600&q=80",
    ],
    shortDescription: "Mid-weight merino with a soft diagonal hand.",
    description:
      "A versatile suiting wool with a fine 2/2 twill. The yarn is mill-finished for a soft hand without sacrificing structure — ideal for jackets, trousers, and unstitched winter sets.",
    isFeatured: true,
    available: true,
  },
  {
    id: "p-003",
    slug: "ecru-european-linen",
    name: "Ecru European Linen",
    category: "linen",
    weave: "plain",
    gsm: 180,
    composition: "100% European Flax Linen",
    colorName: "Ecru",
    colorHex: "#dcd0b6",
    pricePerMeter: 2400,
    pricePerSuit: 8600,
    metersPerSuit: 3.5,
    images: [
      "https://images.unsplash.com/photo-1565084888279-aca607ecce0c?w=1600&q=80",
      "https://images.unsplash.com/photo-1605518216938-7c31b7b14ad0?w=1600&q=80",
    ],
    shortDescription: "Slow-spun European flax with a lived-in fall.",
    description:
      "Woven in a mid-weight plain construction, this linen settles into a soft, broken-in drape after the first wash. Honest texture, irregular slubs, and a quiet ecru tone.",
    isNew: true,
    available: true,
  },
  {
    id: "p-004",
    slug: "midnight-silk-satin",
    name: "Midnight Silk Satin",
    category: "silk",
    weave: "satin",
    gsm: 95,
    composition: "100% Mulberry Silk",
    colorName: "Midnight",
    colorHex: "#0e1a2b",
    pricePerMeter: 5200,
    pricePerSuit: 18800,
    metersPerSuit: 3.5,
    images: [
      "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=1600&q=80",
      "https://images.unsplash.com/photo-1617137968427-85924c800a22?w=1600&q=80",
    ],
    shortDescription: "Heavyweight silk with a deep liquid lustre.",
    description:
      "A 19 momme mulberry silk satin with a fluid, weighted drape. The dense satin face produces a deep, mirror-like reflection in low light — reserved for formal kurtas and evening shararas.",
    isFeatured: true,
    available: true,
  },
  {
    id: "p-005",
    slug: "sand-jacquard-blend",
    name: "Sand Jacquard Blend",
    category: "blended",
    weave: "jacquard",
    gsm: 240,
    composition: "60% Cotton / 40% Viscose",
    colorName: "Sand",
    colorHex: "#c8b58a",
    pricePerMeter: 2150,
    pricePerSuit: 7600,
    metersPerSuit: 3.5,
    images: [
      "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=1600&q=80",
      "https://images.unsplash.com/photo-1596703263926-eb0762ee17e4?w=1600&q=80",
    ],
    shortDescription: "Tonal jacquard with an architectural relief.",
    description:
      "A self-coloured jacquard with a low-relief geometric pattern. The viscose pickup softens the cotton ground for a smooth hand and gentle sheen.",
    available: true,
  },
  {
    id: "p-006",
    slug: "charcoal-dobby-cotton",
    name: "Charcoal Dobby Cotton",
    category: "cotton",
    weave: "dobby",
    gsm: 165,
    threadCount: 180,
    composition: "100% Combed Cotton",
    colorName: "Charcoal",
    colorHex: "#2e2e2e",
    pricePerMeter: 1650,
    pricePerSuit: 6000,
    metersPerSuit: 3.5,
    images: [
      "https://images.unsplash.com/photo-1612215047504-a5b32413ed94?w=1600&q=80",
      "https://images.unsplash.com/photo-1583744946564-b52ac1c389c8?w=1600&q=80",
    ],
    shortDescription: "Subtle dobby texture in deep charcoal.",
    description:
      "A finely woven cotton dobby with a textured grid that catches the light at close range while reading solid from across the room.",
    available: true,
  },
  {
    id: "p-007",
    slug: "rust-brushed-flannel",
    name: "Rust Brushed Flannel",
    category: "wool",
    weave: "twill",
    gsm: 380,
    composition: "80% Wool / 20% Cashmere",
    colorName: "Rust",
    colorHex: "#9b4a26",
    pricePerMeter: 4900,
    pricePerSuit: 17600,
    metersPerSuit: 3.5,
    images: [
      "https://images.unsplash.com/photo-1604176354204-9268737828e4?w=1600&q=80",
      "https://images.unsplash.com/photo-1606503153255-59d8b8b67e91?w=1600&q=80",
    ],
    shortDescription: "Brushed wool-cashmere with a soft halo.",
    description:
      "A heavily brushed flannel with cashmere content for an unusually soft hand. The rust tone has been built up in two dye passes for depth.",
    isNew: true,
    available: true,
  },
  {
    id: "p-008",
    slug: "porcelain-silk-organza",
    name: "Porcelain Silk Organza",
    category: "silk",
    weave: "plain",
    gsm: 60,
    composition: "100% Mulberry Silk",
    colorName: "Porcelain",
    colorHex: "#f1ecdf",
    pricePerMeter: 3800,
    pricePerSuit: 13600,
    metersPerSuit: 3.5,
    images: [
      "https://images.unsplash.com/photo-1583846783214-7229a91b20ed?w=1600&q=80",
      "https://images.unsplash.com/photo-1603252109612-24fa03d145c8?w=1600&q=80",
    ],
    shortDescription: "Crisp, airy organza with a soft glow.",
    description:
      "A finely woven silk organza — sheer, structured, and luminous. Used for layered dupattas, formal overlays, and sculptural sleeves.",
    available: true,
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function getNewArrivals(): Product[] {
  return products.filter((p) => p.isNew);
}

export function getFeatured(): Product[] {
  return products.filter((p) => p.isFeatured);
}
