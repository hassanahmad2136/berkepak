import os
import django
from decimal import Decimal

# Configure Django settings
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "saleor.settings")
django.setup()

from django.utils.timezone import now
from saleor.product.models import (
    Product, ProductType, Category, ProductVariant,
    ProductChannelListing, ProductVariantChannelListing
)
from saleor.channel.models import Channel
from saleor.warehouse.models import Warehouse, Stock

def make_editorjs_description(text):
    return {
        "time": 1653425438149,
        "blocks": [
            {
                "id": "descblock",
                "type": "paragraph",
                "data": {
                    "text": text
                }
            }
        ],
        "version": "2.22.2"
    }

# Core 27 Products from Rate List 1-1-2026
PRODUCTS_DATA = [
  {
    "slug": "platinum-string",
    "name": "Platinum String",
    "category": "cotton",
    "composition": "100% Giza Egyptian Cotton",
    "pricePerSuit": 10990,
    "metersPerSuit": 4.5,
    "description": "Our signature high-count Egyptian cotton fabric. Woven with double-spun yarns for an incredibly crisp structure, deep luster, and clean drape. The absolute pinnacle of formal menswear fabrics."
  },
  {
    "slug": "silver-string",
    "name": "Silver String",
    "category": "cotton",
    "composition": "100% Combed Premium Cotton",
    "pricePerSuit": 6890,
    "metersPerSuit": 4.5,
    "description": "A textured dobby-weave cotton engineered for crisp daily wear. Resists creasing beautifully while maintaining an airy, premium feel against the skin."
  },
  {
    "slug": "prominence-gold",
    "name": "Prominence Gold",
    "category": "blended",
    "composition": "65% Micro-fiber Polyester / 35% Viscose",
    "pricePerSuit": 5490,
    "metersPerSuit": 4.25,
    "description": "Premium wrinkle-resistant wash & wear. Features a heavy-drape twill construction with a luxurious, soft-brushed finish for the ultimate crease-free convenience."
  },
  {
    "slug": "ever-green",
    "name": "Ever Green",
    "category": "blended",
    "composition": "70% Viscose / 30% Polyester",
    "pricePerSuit": 8490,
    "metersPerSuit": 4.25,
    "description": "An exceptionally durable plain-weave blend that performs beautifully through all four seasons. Soft viscose drape combined with polyester strength."
  },
  {
    "slug": "sun-stone",
    "name": "Sun Stone",
    "category": "blended",
    "composition": "60% Poly / 40% Viscose",
    "pricePerSuit": 4790,
    "metersPerSuit": 4.25,
    "description": "Engineered specifically to beat the intense mid-summer heat. A breathable plain weave offering maximum airflow and a dry, cool skin touch."
  },
  {
    "slug": "emerald-textured",
    "name": "Emerald Textured",
    "category": "cotton",
    "composition": "100% Egyptian Combed Cotton",
    "pricePerSuit": 12690,
    "metersPerSuit": 4.5,
    "description": "An elegant, heavy dobby weave with architectural texture. Highly breathable yet structured, perfect for formal evening wear and sherwanis."
  },
  {
    "slug": "hi-silky",
    "name": "Hi Silky",
    "category": "blended",
    "composition": "80% Filament Viscose / 20% Polyester",
    "pricePerSuit": 7190,
    "metersPerSuit": 4.25,
    "description": "Woven using ultra-fine filament viscose to replicate the luxurious touch and liquid fall of pure silk, but with the crease resistance of modern synthetics."
  },
  {
    "slug": "monsoon-plus",
    "name": "Monsoon Plus",
    "category": "blended",
    "composition": "65% Poly / 35% Viscose Heavy Blend",
    "pricePerSuit": 13990,
    "metersPerSuit": 4.25,
    "description": "A heavy-fall twill engineered for cooler autumn and transition seasons. Wrinkle-resistant, robust, and luxurious to hold."
  },
  {
    "slug": "monsoon",
    "name": "Monsoon",
    "category": "blended",
    "composition": "60% Poly / 40% Viscose Summer Weight",
    "pricePerSuit": 7690,
    "metersPerSuit": 4.25,
    "description": "A highly resilient summer blend offering exceptional breathability and quick-dry characteristics for humid monsoon days."
  },
  {
    "slug": "topaz",
    "name": "Topaz",
    "category": "blended",
    "composition": "Premium Jewel Microfiber",
    "pricePerSuit": 7490,
    "metersPerSuit": 4.25,
    "description": "Part of our exclusive Jewel series. A clean dobby weave crafted from advanced micro-fibers, ensuring incredibly sharp lines and crisp collar structure."
  },
  {
    "slug": "zircon",
    "name": "Zircon",
    "category": "blended",
    "composition": "Standard Resilient Microfiber Blend",
    "pricePerSuit": 6390,
    "metersPerSuit": 4.25,
    "description": "Wrinkle-free jewel series designed for robust, everyday use. Resists staining and maintains a sharp, fresh aesthetic all day long."
  },
  {
    "slug": "rainfall",
    "name": "Rainfall",
    "category": "blended",
    "composition": "Textured Poly-Viscose Blend",
    "pricePerSuit": 6690,
    "metersPerSuit": 4.25,
    "description": "A uniquely textured plain weave that features horizontal slub inflections mimicking rainfall, providing a beautiful modern organic look."
  },
  {
    "slug": "hot-sapphire",
    "name": "Hot Sapphire",
    "category": "blended",
    "composition": "Premium Breathable Poly-Viscose",
    "pricePerSuit": 5490,
    "metersPerSuit": 4.25,
    "description": "A cool-feel micro-satin that reflects light elegantly. Extremely lightweight and optimized to stay dry in high-temperature environments."
  },
  {
    "slug": "flash-opal",
    "name": "Flash Opal",
    "category": "blended",
    "composition": "Subtle Luster Poly-Viscose",
    "pricePerSuit": 5690,
    "metersPerSuit": 4.25,
    "description": "Part of our exquisite Opal series. Features a subtle, organic luster that looks exceptionally refined under evening lights."
  },
  {
    "slug": "honey-opal",
    "name": "Honey Opal",
    "category": "blended",
    "composition": "Soft-Touch Poly-Viscose",
    "pricePerSuit": 5690,
    "metersPerSuit": 4.25,
    "description": "A brushed poly-viscose blend with an extremely soft hand-feel, prioritizing comfort for all-day formal wearing."
  },
  {
    "slug": "jelly-opal",
    "name": "Jelly Opal",
    "category": "blended",
    "composition": "Smooth Poly-Viscose",
    "pricePerSuit": 5690,
    "metersPerSuit": 4.25,
    "description": "A highly practical everyday fabric that sheds wrinkles immediately. The perfect choice for travelers and professionals."
  },
  {
    "slug": "onyx-opal",
    "name": "Onyx Opal",
    "category": "blended",
    "composition": "Resilient Basic Poly-Viscose",
    "pricePerSuit": 4490,
    "metersPerSuit": 4.25,
    "description": "Robust and matte-finished basic blend from our Opal series. Offers maximum value without compromising on clean formal presentation."
  },
  {
    "slug": "gypsy-ruby",
    "name": "Gypsy Ruby",
    "category": "blended",
    "composition": "Lightweight Resilient Poly Blend",
    "pricePerSuit": 3690,
    "metersPerSuit": 4.25,
    "description": "Our most economical wash & wear blend. Highly resilient and lightweight, perfect for casual summer home suits."
  },
  {
    "slug": "pink-gold",
    "name": "Pink Gold",
    "category": "blended",
    "composition": "Metallic Luster Poly-Viscose",
    "pricePerSuit": 5090,
    "metersPerSuit": 4.25,
    "description": "Woven using bi-color yarns that produce a shifting pink-gold reflection. A statement fabric for semi-formal events."
  },
  {
    "slug": "cool-sapphire",
    "name": "Cool Sapphire",
    "category": "blended",
    "composition": "Cool-Touch Summer Microfiber",
    "pricePerSuit": 6690,
    "metersPerSuit": 4.25,
    "description": "An advanced micro-fiber wash & wear featuring chemical-free cool-touch technology. Provides maximum relief during high summer peaks."
  },
  {
    "slug": "lava-rock-boski",
    "name": "Lava Rock Boski",
    "category": "silk",
    "composition": "Premium Silk-Alternative Micro-Viscose",
    "pricePerSuit": 5490,
    "metersPerSuit": 4.25,
    "description": "Crafted specifically to match the rich off-white luster, heavy liquid drape, and soft cool touch of premium traditional Chinese silk Boski."
  },
  {
    "slug": "market",
    "name": "Market",
    "category": "blended",
    "composition": "Classic Corporate Poly-Viscose",
    "pricePerSuit": 6690,
    "metersPerSuit": 4.25,
    "description": "Engineered specifically for daily office and workplace wear. Extremely resilient against wrinkles and heavy friction."
  },
  {
    "slug": "slub-cotton",
    "name": "Slub Cotton",
    "category": "cotton",
    "composition": "100% Organic Slub Cotton",
    "pricePerSuit": 5790,
    "metersPerSuit": 4.5,
    "description": "Woven using irregular slub yarns to provide a rich, textured, natural organic look. Light, exceptionally breathable, and classic."
  },
  {
    "slug": "fashion-dream",
    "name": "Fashion Dream",
    "category": "blended",
    "composition": "Structured Poly-Viscose Blend",
    "pricePerSuit": 6690,
    "metersPerSuit": 4.25,
    "description": "A modern structural weave that falls beautifully. Crease-resistant and styled with a unique double-tone weave pattern."
  },
  {
    "slug": "fancy-cotton",
    "name": "Fancy Cotton",
    "category": "cotton",
    "composition": "100% Luxury Cotton",
    "pricePerSuit": 6690,
    "metersPerSuit": 4.5,
    "description": "Features a beautiful self-pattern jacquard weave. Light and airy, making it highly suitable for upscale semi-formal summer gatherings."
  },
  {
    "slug": "innovative",
    "name": "Innovative",
    "category": "blended",
    "composition": "Four-way Stretch Microfiber",
    "pricePerSuit": 4990,
    "metersPerSuit": 4.25,
    "description": "A highly innovative, flexible microfiber blend offering modern comfort and slight stretch. Crease-resistant and exceptionally cool."
  },
  {
    "slug": "fresco",
    "name": "Fresco",
    "category": "blended",
    "composition": "Structured Everyday Poly-Viscose",
    "pricePerSuit": 5490,
    "metersPerSuit": 4.25,
    "description": "A classic daily wash & wear that has been twill-woven for robust protection against wear and tear. Resists creases permanently."
  }
]

def main():
    print("Starting Saleor Rate List catalog seed...")

    # 1. Fetch channel and warehouse resources
    channel = Channel.objects.filter(slug="default-channel").first()
    if not channel:
        print("Error: default-channel not found!")
        return

    warehouse = Warehouse.objects.filter(name="Default").first() or Warehouse.objects.first()
    if not warehouse:
        print("Error: No warehouses found in database!")
        return

    # Delete legacy 'frasco' to prevent duplicate items after renaming
    Product.objects.filter(slug="frasco").delete()

    # 2. Get or create Product Type
    product_type, _ = ProductType.objects.get_or_create(
        name="Fabric",
        defaults={
            "slug": "fabric",
            "has_variants": True,
            "is_shipping_required": True,
        }
    )

    # 3. Get or create Categories
    categories = {}
    for cat_name in ["cotton", "blended", "silk", "linen", "wool"]:
        cat, _ = Category.objects.get_or_create(
            name=cat_name.capitalize(),
            defaults={
                "slug": cat_name,
            }
        )
        categories[cat_name] = cat

    # 4. Seed all products
    for data in PRODUCTS_DATA:
        slug = data["slug"]
        name = data["name"]
        cat_key = data["category"]
        composition = data["composition"]
        price_suit = data["pricePerSuit"]
        meters_suit = data["metersPerSuit"]
        price_meter = MathRoundPrice(price_suit / meters_suit)
        desc_text = f"{data['description']} Composition: {composition}."

        print(f"Seeding product: {name} ({slug}) | Category: {cat_key} | Suit Price: {price_suit} PKR")

        # Clean any legacy matches of this slug to ensure idempotency
        Product.objects.filter(slug=slug).delete()

        # Create Product
        product = Product.objects.create(
            name=name,
            slug=slug,
            product_type=product_type,
            category=categories[cat_key],
            description=make_editorjs_description(desc_text),
        )

        # Create Product Channel Listing
        ProductChannelListing.objects.create(
            product=product,
            channel=channel,
            is_published=True,
            visible_in_listings=True,
            published_at=now(),
            available_for_purchase_at=now(),
        )

        # Create Suit Variant
        suit_variant = ProductVariant.objects.create(
            product=product,
            sku=f"{slug}-suit",
            name="By the Suit",
            track_inventory=True,
        )
        ProductVariantChannelListing.objects.create(
            variant=suit_variant,
            channel=channel,
            currency="PKR",
            price_amount=Decimal(price_suit),
            discounted_price_amount=Decimal(price_suit),
        )
        Stock.objects.create(
            warehouse=warehouse,
            product_variant=suit_variant,
            quantity=250, # Initial stock pool of 250 suits
        )


    print("\nSuccessfully seeded all 27 products from the Rate List!")

def MathRoundPrice(price):
    return int(round(price / 10.0)) * 10

if __name__ == "__main__":
    main()
