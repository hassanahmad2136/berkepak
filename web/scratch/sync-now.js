const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    } else if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const saleorUrl = env.NEXT_PUBLIC_SALEOR_API_URL || 'http://localhost:8000/graphql/';

const supabase = createClient(supabaseUrl, supabaseKey);

// GraphQL query to fetch products with full details
const query = `
  query GetProducts($channel: String!) {
    products(channel: $channel, first: 100) {
      edges {
        node {
          id
          name
          slug
          description
          seoDescription
          isAvailableForPurchase
          media {
            url
          }
          attributes {
            attribute {
              slug
            }
            values {
              name
              value
            }
          }
          variants {
            id
            name
            sku
            pricing {
              price {
                gross {
                  amount
                }
              }
            }
          }
        }
      }
    }
  }
`;

async function fetchSaleorProducts() {
  const res = await fetch(saleorUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      variables: { channel: env.NEXT_PUBLIC_SALEOR_CHANNEL || 'default-channel' }
    })
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(JSON.stringify(json.errors));
  }
  return json.data.products.edges.map(e => e.node);
}

function attr(attributes, slug) {
  const match = attributes.find(a => a.attribute.slug === slug);
  if (!match || match.values.length === 0) return null;
  return match.values[0].value || match.values[0].name;
}

function numericAttr(attributes, slug, fallback = 0) {
  const val = attr(attributes, slug);
  if (!val) return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function boolAttr(attributes, slug) {
  const val = attr(attributes, slug);
  return val === 'true' || val === '1';
}

function variantPrice(variants, pattern) {
  const match = variants.find(v => 
    v.name.toLowerCase().includes(pattern) || 
    (v.sku || '').toLowerCase().includes(pattern)
  );
  const chosen = match || variants[0];
  return chosen?.pricing?.price?.gross?.amount || 0;
}

function variantId(variants, pattern) {
  const match = variants.find(v => 
    v.name.toLowerCase().includes(pattern) || 
    (v.sku || '').toLowerCase().includes(pattern)
  );
  return match?.id || null;
}

async function main() {
  console.log("Fetching latest product data from Saleor...");
  const nodes = await fetchSaleorProducts();
  console.log(`Fetched ${nodes.length} products from Saleor.`);

  const upserts = nodes.map(node => {
    const a = node.attributes;
    const pricePerMeter = variantPrice(node.variants, 'meter');
    const pricePerSuit = variantPrice(node.variants, 'suit');
    const metersPerSuit = numericAttr(a, 'meters-per-suit', 4.25);
    const resolvedPriceSuit = pricePerSuit || (pricePerMeter * metersPerSuit);

    let fullDesc = '';
    if (node.description) {
      try {
        const parsed = JSON.parse(node.description);
        const blocks = parsed.blocks || [];
        fullDesc = blocks.map(b => b.data?.text || '').filter(Boolean).join(' ');
      } catch {
        fullDesc = node.description;
      }
    }

    let shortDesc = node.seoDescription || '';
    if (!shortDesc && fullDesc) {
      shortDesc = fullDesc.length > 120 ? fullDesc.slice(0, 117) + '...' : fullDesc;
    }

    const images = node.media.map(m => m.url);

    return {
      id: node.id,
      slug: node.slug,
      name: node.name,
      price_per_suit: resolvedPriceSuit,
      price_per_meter: pricePerMeter || null,
      category: attr(a, 'category') || 'cotton',
      weave: attr(a, 'weave') || 'plain',
      gsm: numericAttr(a, 'gsm') || 150,
      thread_count: numericAttr(a, 'thread-count') || null,
      composition: attr(a, 'composition') || '',
      color_name: attr(a, 'color-name') || '',
      color_hex: attr(a, 'color-hex') || '#cccccc',
      meters_per_suit: metersPerSuit,
      images: images.length > 0 ? images : ['/products/placeholder.jpg'],
      short_description: shortDesc,
      description: fullDesc || shortDesc,
      is_new: boolAttr(a, 'is-new') || false,
      is_featured: boolAttr(a, 'is-featured') || false,
      available: node.isAvailableForPurchase !== false,
      suit_variant_id: variantId(node.variants, 'suit'),
      meter_variant_id: variantId(node.variants, 'meter'),
      sku: variantId(node.variants, 'suit') ? node.variants.find(v => v.id === variantId(node.variants, 'suit')).sku : (node.variants[0]?.sku || null),
      updated_at: new Date().toISOString()
    };
  });

  console.log("Emptying product_colors and products tables in Supabase...");
  await supabase.from("product_colors").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("products").delete().neq("id", "none");
  
  const { error } = await supabase.from("products").upsert(upserts, { onConflict: 'id' });
  if (error) {
    console.error("Upsert failed:", error.message);
  } else {
    console.log(`Successfully synced all ${upserts.length} detailed products to Supabase!`);
  }
}

main().catch(console.error);
