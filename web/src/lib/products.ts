/**
 * Product data-access layer.
 *
 * Tries Saleor GraphQL first; falls back to the static catalog below
 * when the backend is unavailable or not configured. This means the
 * storefront never shows an empty page regardless of backend status.
 */

import type { Product } from "./types";
import { isSaleorConfigured, saleorFetch, SaleorError } from "./saleor/client";
import { PRODUCTS_QUERY, PRODUCT_BY_SLUG_QUERY } from "./saleor/queries";
import {
  transformProducts,
  transformProduct,
  type SaleorProductsResponse,
  type SaleorSingleProductResponse,
} from "./saleor/transforms";

// ---------------------------------------------------------------------------
// Default channel slug used by the Saleor backend
// ---------------------------------------------------------------------------
const CHANNEL = process.env.NEXT_PUBLIC_SALEOR_CHANNEL ?? "default-channel";

// =========================================================================
// Static fallback catalog (27 products from Rate List 1-1-2026)
// =========================================================================

const STATIC_PRODUCTS: Product[] = [
  {
    "id": "p-001",
    "slug": "platinum-string",
    "name": "Platinum String",
    "category": "cotton",
    "weave": "plain",
    "gsm": 140,
    "threadCount": 240,
    "composition": "100% Giza Egyptian Cotton",
    "colorName": "Royal White",
    "colorHex": "#FCFBF7",
    "pricePerMeter": 2440,
    "pricePerSuit": 10990,
    "metersPerSuit": 4.5,
    "images": [
      "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Ultra-premium, high-count formal cotton.",
    "description": "Our signature high-count Egyptian cotton fabric. Woven with double-spun yarns for an incredibly crisp structure, deep luster, and clean drape. The absolute pinnacle of formal menswear fabrics.",
    "available": true,
    "isFeatured": true,
    "isNew": true
  },
  {
    "id": "p-003",
    "slug": "silver-string",
    "name": "Silver String",
    "category": "cotton",
    "weave": "dobby",
    "gsm": 145,
    "threadCount": 200,
    "composition": "100% Combed Premium Cotton",
    "colorName": "Silver Blue",
    "colorHex": "#D3D9E0",
    "pricePerMeter": 1530,
    "pricePerSuit": 6890,
    "metersPerSuit": 4.5,
    "images": [
      "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "High-quality, everyday formal structured cotton.",
    "description": "A textured dobby-weave cotton engineered for crisp daily wear. Resists creasing beautifully while maintaining an airy, premium feel against the skin.",
    "available": true,
    "isNew": true
  },
  {
    "id": "p-005",
    "slug": "prominence-gold",
    "name": "Prominence Gold",
    "category": "blended",
    "weave": "twill",
    "gsm": 160,
    "composition": "65% Micro-fiber Polyester / 35% Viscose",
    "colorName": "Soft Cream",
    "colorHex": "#F5EAD4",
    "pricePerMeter": 1290,
    "pricePerSuit": 5490,
    "metersPerSuit": 4.25,
    "images": [
      "https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Wrinkle-resistant formal wash & wear blend.",
    "description": "Premium wrinkle-resistant wash & wear. Features a heavy-drape twill construction with a luxurious, soft-brushed finish for the ultimate crease-free convenience.",
    "available": true
  },
  {
    "id": "p-011",
    "slug": "ever-green",
    "name": "Ever Green",
    "category": "blended",
    "weave": "plain",
    "gsm": 170,
    "composition": "70% Viscose / 30% Polyester",
    "colorName": "Sage Green",
    "colorHex": "#7C8D76",
    "pricePerMeter": 2000,
    "pricePerSuit": 8490,
    "metersPerSuit": 4.25,
    "images": [
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Durable, all-weather everyday wash & wear.",
    "description": "An exceptionally durable plain-weave blend that performs beautifully through all four seasons. Soft viscose drape combined with polyester strength.",
    "available": true,
    "isFeatured": true
  },
  {
    "id": "p-020",
    "slug": "sun-stone",
    "name": "Sun Stone",
    "category": "blended",
    "weave": "plain",
    "gsm": 130,
    "composition": "60% Poly / 40% Viscose",
    "colorName": "Sunlight Gold",
    "colorHex": "#E6C89C",
    "pricePerMeter": 1130,
    "pricePerSuit": 4790,
    "metersPerSuit": 4.25,
    "images": [
      "https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Ultra-lightweight seasonal summer wash & wear.",
    "description": "Engineered specifically to beat the intense mid-summer heat. A breathable plain weave offering maximum airflow and a dry, cool skin touch.",
    "available": true
  },
  {
    "id": "p-031",
    "slug": "emerald-textured",
    "name": "Emerald Textured",
    "category": "cotton",
    "weave": "dobby",
    "gsm": 180,
    "threadCount": 260,
    "composition": "100% Egyptian Combed Cotton",
    "colorName": "Deep Olive",
    "colorHex": "#3F4E3F",
    "pricePerMeter": 2820,
    "pricePerSuit": 12690,
    "metersPerSuit": 4.5,
    "images": [
      "https://images.unsplash.com/photo-1597484211029-f07cc5ec00a3?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1597484211029-f07cc5ec00a3?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Luxury textured mid-season structured fabric.",
    "description": "An elegant, heavy dobby weave with architectural texture. Highly breathable yet structured, perfect for formal evening wear and sherwanis.",
    "available": true,
    "isFeatured": true,
    "isNew": true
  },
  {
    "id": "p-032",
    "slug": "hi-silky",
    "name": "Hi Silky",
    "category": "blended",
    "weave": "satin",
    "gsm": 145,
    "composition": "80% Filament Viscose / 20% Polyester",
    "colorName": "Midnight Blue",
    "colorHex": "#1D2E44",
    "pricePerMeter": 1690,
    "pricePerSuit": 7190,
    "metersPerSuit": 4.25,
    "images": [
      "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Highly smooth, fluid wash & wear with a silky finish.",
    "description": "Woven using ultra-fine filament viscose to replicate the luxurious touch and liquid fall of pure silk, but with the crease resistance of modern synthetics.",
    "available": true
  },
  {
    "id": "p-050",
    "slug": "monsoon-plus",
    "name": "Moonsoon Plus",
    "category": "blended",
    "weave": "twill",
    "gsm": 220,
    "composition": "65% Poly / 35% Viscose Heavy Blend",
    "colorName": "Slate Grey",
    "colorHex": "#5E6065",
    "pricePerMeter": 3290,
    "pricePerSuit": 13990,
    "metersPerSuit": 4.25,
    "images": [
      "https://images.unsplash.com/photo-1618220179428-22790b461013?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1618220179428-22790b461013?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Heavyweight premium mid-season blend.",
    "description": "A heavy-fall twill engineered for cooler autumn and transition seasons. Wrinkle-resistant, robust, and luxurious to hold.",
    "available": true,
    "isNew": true
  },
  {
    "id": "p-051",
    "slug": "monsoon",
    "name": "Moonsoon",
    "category": "blended",
    "weave": "plain",
    "gsm": 150,
    "composition": "60% Poly / 40% Viscose Summer Weight",
    "colorName": "Ocean Blue",
    "colorHex": "#2B4E6B",
    "pricePerMeter": 1810,
    "pricePerSuit": 7690,
    "metersPerSuit": 4.25,
    "images": [
      "https://images.unsplash.com/photo-1528459199954-0d107384a5d3?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1528459199954-0d107384a5d3?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Light-to-medium weight summer-friendly blend.",
    "description": "A highly resilient summer blend offering exceptional breathability and quick-dry characteristics for humid monsoon days.",
    "available": true
  },
  {
    "id": "p-056",
    "slug": "topaz",
    "name": "TOPAZ",
    "category": "blended",
    "weave": "dobby",
    "gsm": 160,
    "composition": "Premium Jewel Microfiber",
    "colorName": "Royal Navy",
    "colorHex": "#1A2535",
    "pricePerMeter": 1760,
    "pricePerSuit": 7490,
    "metersPerSuit": 4.25,
    "images": [
      "https://images.unsplash.com/photo-1603252109303-2751441dd157?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1603252109303-2751441dd157?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Micro-fiber jewel series offering crisp folds.",
    "description": "Part of our exclusive Jewel series. A clean dobby weave crafted from advanced micro-fibers, ensuring incredibly sharp lines and crisp collar structure.",
    "available": true
  },
  {
    "id": "p-060",
    "slug": "zircon",
    "name": "ZIRCON",
    "category": "blended",
    "weave": "plain",
    "gsm": 155,
    "composition": "Standard Resilient Microfiber Blend",
    "colorName": "Steel Blue",
    "colorHex": "#4A6B82",
    "pricePerMeter": 1500,
    "pricePerSuit": 6390,
    "metersPerSuit": 4.25,
    "images": [
      "https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Everyday jewel-series resilient wash & wear.",
    "description": "Wrinkle-free jewel series designed for robust, everyday use. Resists staining and maintains a sharp, fresh aesthetic all day long.",
    "available": true
  },
  {
    "id": "p-070",
    "slug": "rainfall",
    "name": "Rainfall",
    "category": "blended",
    "weave": "dobby",
    "gsm": 180,
    "composition": "Textured Poly-Viscose Blend",
    "colorName": "Storm Grey",
    "colorHex": "#70737C",
    "pricePerMeter": 1570,
    "pricePerSuit": 6690,
    "metersPerSuit": 4.25,
    "images": [
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Seasonal textured mid-weight wash & wear.",
    "description": "A uniquely textured plain weave that features horizontal slub inflections mimicking rainfall, providing a beautiful modern organic look.",
    "available": true
  },
  {
    "id": "p-080",
    "slug": "hot-sapphire",
    "name": "Hot Sapphire",
    "category": "blended",
    "weave": "satin",
    "gsm": 140,
    "composition": "Premium Breathable Poly-Viscose",
    "colorName": "Sapphire Blue",
    "colorHex": "#1E3A8A",
    "pricePerMeter": 1290,
    "pricePerSuit": 5490,
    "metersPerSuit": 4.25,
    "images": [
      "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Dynamic, summer-optimized microfiber satin.",
    "description": "A cool-feel micro-satin that reflects light elegantly. Extremely lightweight and optimized to stay dry in high-temperature environments.",
    "available": true
  },
  {
    "id": "p-090",
    "slug": "flash-opal",
    "name": "Flash Opal",
    "category": "blended",
    "weave": "plain",
    "gsm": 150,
    "composition": "Subtle Luster Poly-Viscose",
    "colorName": "Soft Pearl",
    "colorHex": "#EDE9E3",
    "pricePerMeter": 1340,
    "pricePerSuit": 5690,
    "metersPerSuit": 4.25,
    "images": [
      "https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Subtle luster, soft skin-feel blended fabric.",
    "description": "Part of our exquisite Opal series. Features a subtle, organic luster that looks exceptionally refined under evening lights.",
    "available": true
  },
  {
    "id": "p-100",
    "slug": "hony-opal",
    "name": "Hony Opal",
    "category": "blended",
    "weave": "plain",
    "gsm": 150,
    "composition": "Soft-Touch Poly-Viscose",
    "colorName": "Honey Cream",
    "colorHex": "#EED9B3",
    "pricePerMeter": 1340,
    "pricePerSuit": 5690,
    "metersPerSuit": 4.25,
    "images": [
      "https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Soft skin-feel, crease-resistant honey blend.",
    "description": "A brushed poly-viscose blend with an extremely soft hand-feel, prioritizing comfort for all-day formal wearing.",
    "available": true
  },
  {
    "id": "p-110",
    "slug": "jelly-opal",
    "name": "Jelly Opal",
    "category": "blended",
    "weave": "plain",
    "gsm": 150,
    "composition": "Smooth Poly-Viscose",
    "colorName": "Creamy Beige",
    "colorHex": "#E7DEC7",
    "pricePerMeter": 1340,
    "pricePerSuit": 5690,
    "metersPerSuit": 4.25,
    "images": [
      "https://images.unsplash.com/photo-1528459199954-0d107384a5d3?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1528459199954-0d107384a5d3?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Smooth, easy-care fluid blended Opal weave.",
    "description": "A highly practical everyday fabric that sheds wrinkles immediately. The perfect choice for travelers and professionals.",
    "available": true
  },
  {
    "id": "p-120",
    "slug": "onyx-opal",
    "name": "Onyx Opal",
    "category": "blended",
    "weave": "plain",
    "gsm": 150,
    "composition": "Resilient Basic Poly-Viscose",
    "colorName": "Dark Charcoal",
    "colorHex": "#292A2C",
    "pricePerMeter": 1060,
    "pricePerSuit": 4490,
    "metersPerSuit": 4.25,
    "images": [
      "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Economy everyday wear, durable matte finish.",
    "description": "Robust and matte-finished basic blend from our Opal series. Offers maximum value without compromising on clean formal presentation.",
    "available": true
  },
  {
    "id": "p-130",
    "slug": "gypsy-ruby",
    "name": "Gypsy Ruby",
    "category": "blended",
    "weave": "plain",
    "gsm": 130,
    "composition": "Lightweight Resilient Poly Blend",
    "colorName": "Ruby Maroon",
    "colorHex": "#6B1D2F",
    "pricePerMeter": 870,
    "pricePerSuit": 3690,
    "metersPerSuit": 4.25,
    "images": [
      "https://images.unsplash.com/photo-1597484211029-f07cc5ec00a3?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1597484211029-f07cc5ec00a3?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Basic lightweight everyday economy fabric.",
    "description": "Our most economical wash & wear blend. Highly resilient and lightweight, perfect for casual summer home suits.",
    "available": true
  },
  {
    "id": "p-140",
    "slug": "pink-gold",
    "name": "Pink Gold",
    "category": "blended",
    "weave": "plain",
    "gsm": 155,
    "composition": "Metallic Luster Poly-Viscose",
    "colorName": "Dusty Rose",
    "colorHex": "#D3A297",
    "pricePerMeter": 1200,
    "pricePerSuit": 5090,
    "metersPerSuit": 4.25,
    "images": [
      "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Mid-tier luster blended wash & wear.",
    "description": "Woven using bi-color yarns that produce a shifting pink-gold reflection. A statement fabric for semi-formal events.",
    "available": true
  },
  {
    "id": "p-150",
    "slug": "cool-sapphire",
    "name": "Cool Sapphire",
    "category": "blended",
    "weave": "plain",
    "gsm": 135,
    "composition": "Cool-Touch Summer Microfiber",
    "colorName": "Icy Blue",
    "colorHex": "#D2E4F0",
    "pricePerMeter": 1570,
    "pricePerSuit": 6690,
    "metersPerSuit": 4.25,
    "images": [
      "https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Icy, cool-touch summer microfiber blend.",
    "description": "An advanced micro-fiber wash & wear featuring chemical-free cool-touch technology. Provides maximum relief during high summer peaks.",
    "available": true
  },
  {
    "id": "p-160",
    "slug": "lava-rock-bohski",
    "name": "LAVA ROCK BOHSKI",
    "category": "silk",
    "weave": "plain",
    "gsm": 160,
    "composition": "Premium Silk-Alternative Micro-Viscose",
    "colorName": "Classic Cream",
    "colorHex": "#FFFDD0",
    "pricePerMeter": 1290,
    "pricePerSuit": 5490,
    "metersPerSuit": 4.25,
    "images": [
      "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Heavy fluid Boski fall silk alternative.",
    "description": "Crafted specifically to match the rich off-white luster, heavy liquid drape, and soft cool touch of premium traditional Chinese silk Boski.",
    "available": true,
    "isFeatured": true
  },
  {
    "id": "p-170",
    "slug": "marget",
    "name": "Marget",
    "category": "blended",
    "weave": "twill",
    "gsm": 175,
    "composition": "Classic Corporate Poly-Viscose",
    "colorName": "Desert Taupe",
    "colorHex": "#B5A693",
    "pricePerMeter": 1570,
    "pricePerSuit": 6690,
    "metersPerSuit": 4.25,
    "images": [
      "https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Workplace crease-resistant twill fabric.",
    "description": "Engineered specifically for daily office and workplace wear. Extremely resilient against wrinkles and heavy friction.",
    "available": true
  },
  {
    "id": "p-180",
    "slug": "slub-cotton",
    "name": "Slub Cotton",
    "category": "cotton",
    "weave": "plain",
    "gsm": 145,
    "threadCount": 160,
    "composition": "100% Organic Slub Cotton",
    "colorName": "Slub White",
    "colorHex": "#FAF9F6",
    "pricePerMeter": 1290,
    "pricePerSuit": 5790,
    "metersPerSuit": 4.5,
    "images": [
      "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Pure cotton featuring a textured, raised weave.",
    "description": "Woven using irregular slub yarns to provide a rich, textured, natural organic look. Light, exceptionally breathable, and classic.",
    "available": true
  },
  {
    "id": "p-190",
    "slug": "fashion-dream",
    "name": "Fashion Dream",
    "category": "blended",
    "weave": "dobby",
    "gsm": 180,
    "composition": "Structured Poly-Viscose Blend",
    "colorName": "Plum Slate",
    "colorHex": "#4E3E52",
    "pricePerMeter": 1570,
    "pricePerSuit": 6690,
    "metersPerSuit": 4.25,
    "images": [
      "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Crease-resistant formal dobby drape.",
    "description": "A modern structural weave that falls beautifully. Crease-resistant and styled with a unique double-tone weave pattern.",
    "available": true
  },
  {
    "id": "p-200",
    "slug": "fancy-cotton",
    "name": "Fancy Cotton",
    "category": "cotton",
    "weave": "jacquard",
    "gsm": 150,
    "threadCount": 180,
    "composition": "100% Luxury Cotton",
    "colorName": "Fancy White",
    "colorHex": "#FFFFFF",
    "pricePerMeter": 1490,
    "pricePerSuit": 6690,
    "metersPerSuit": 4.5,
    "images": [
      "https://images.unsplash.com/photo-1597484211029-f07cc5ec00a3?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1597484211029-f07cc5ec00a3?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Premium luxury cotton with unique self-print.",
    "description": "Features a beautiful self-pattern jacquard weave. Light and airy, making it highly suitable for upscale semi-formal summer gatherings.",
    "available": true
  },
  {
    "id": "p-210",
    "slug": "inovative",
    "name": "Inovative",
    "category": "blended",
    "weave": "plain",
    "gsm": 165,
    "composition": "Four-way Stretch Microfiber",
    "colorName": "Charcoal Grey",
    "colorHex": "#3A3B3C",
    "pricePerMeter": 1170,
    "pricePerSuit": 4990,
    "metersPerSuit": 4.25,
    "images": [
      "https://images.unsplash.com/photo-1618220179428-22790b461013?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1618220179428-22790b461013?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Modern stretch microfiber, ultimate comfort.",
    "description": "A highly innovative, flexible microfiber blend offering modern comfort and slight stretch. Crease-resistant and exceptionally cool.",
    "available": true
  },
  {
    "id": "p-220",
    "slug": "frasco",
    "name": "Frasco",
    "category": "blended",
    "weave": "twill",
    "gsm": 170,
    "composition": "Structured Everyday Poly-Viscose",
    "colorName": "Ash Grey",
    "colorHex": "#A8A9AD",
    "pricePerMeter": 1290,
    "pricePerSuit": 5490,
    "metersPerSuit": 4.25,
    "images": [
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=600&auto=format&fit=crop"
    ],
    "shortDescription": "Durable, everyday workplace twill wash & wear.",
    "description": "A classic daily wash & wear that has been twill-woven for robust protection against wear and tear. Resists creases permanently.",
    "available": true
  }
];

// =========================================================================
// In-memory product cache (for synchronous client-side lookups)
// =========================================================================

let cachedProducts: Product[] = STATIC_PRODUCTS;
const productMapById = new Map<string, Product>(
  STATIC_PRODUCTS.map((p) => [p.id, p]),
);
const productMapBySlug = new Map<string, Product>(
  STATIC_PRODUCTS.map((p) => [p.slug, p]),
);

function updateCache(products: Product[]) {
  cachedProducts = products;
  productMapById.clear();
  productMapBySlug.clear();
  for (const p of products) {
    productMapById.set(p.id, p);
    productMapBySlug.set(p.slug, p);
  }
}

// =========================================================================
// Async data-fetching functions (used by Server Components / Actions)
// =========================================================================

export async function getProducts(): Promise<Product[]> {
  if (!isSaleorConfigured()) return STATIC_PRODUCTS;

  try {
    const data = await saleorFetch<SaleorProductsResponse>(PRODUCTS_QUERY, {
      channel: CHANNEL,
      first: 100,
    });
    const products = transformProducts(data);
    if (products.length > 0) {
      updateCache(products);
      return products;
    }
  } catch (err) {
    if (err instanceof SaleorError) {
      console.warn("[BerkePak] Saleor unavailable, using static catalog:", err.message);
    } else {
      console.warn("[BerkePak] Saleor fetch failed, using static catalog:", err);
    }
  }

  return STATIC_PRODUCTS;
}

export async function getProductBySlugAsync(
  slug: string,
): Promise<Product | undefined> {
  if (!isSaleorConfigured()) {
    return STATIC_PRODUCTS.find((p) => p.slug === slug);
  }

  try {
    const data = await saleorFetch<SaleorSingleProductResponse>(
      PRODUCT_BY_SLUG_QUERY,
      { slug, channel: CHANNEL },
    );
    if (data.product) {
      const product = transformProduct(data.product);
      productMapById.set(product.id, product);
      productMapBySlug.set(product.slug, product);
      return product;
    }
  } catch (err) {
    console.warn("[BerkePak] Saleor slug lookup failed, using static:", err);
  }

  return STATIC_PRODUCTS.find((p) => p.slug === slug);
}

export async function getProductByIdAsync(
  id: string,
): Promise<Product | undefined> {
  if (productMapById.has(id)) return productMapById.get(id);
  await getProducts();
  return productMapById.get(id) ?? STATIC_PRODUCTS.find((p) => p.id === id);
}

export async function getNewArrivalsAsync(): Promise<Product[]> {
  const all = await getProducts();
  return all.filter((p) => p.isNew);
}

export async function getFeaturedAsync(): Promise<Product[]> {
  const all = await getProducts();
  return all.filter((p) => p.isFeatured);
}

// =========================================================================
// Synchronous accessors (for client components reading cached data)
// =========================================================================

export const products: Product[] = STATIC_PRODUCTS;

export function getProductBySlug(slug: string): Product | undefined {
  return productMapBySlug.get(slug) ?? STATIC_PRODUCTS.find((p) => p.slug === slug);
}

export function getProductById(id: string): Product | undefined {
  return productMapById.get(id) ?? STATIC_PRODUCTS.find((p) => p.id === id);
}

export function getNewArrivals(): Product[] {
  return cachedProducts.filter((p) => p.isNew);
}

export function getFeatured(): Product[] {
  return cachedProducts.filter((p) => p.isFeatured);
}
