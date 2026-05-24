const fs = require('fs');
const path = require('path');

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

const saleorUrl = env.NEXT_PUBLIC_SALEOR_API_URL || "http://localhost:8000/graphql/";
const saleorToken = env.SALEOR_APP_TOKEN || "";

const headers = { "Content-Type": "application/json" };
if (saleorToken) {
  headers["Authorization"] = `Bearer ${saleorToken}`;
}

async function saleorFetch(query, variables = {}) {
  const res = await fetch(saleorUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json.errors) {
    throw new Error(JSON.stringify(json.errors));
  }
  return json.data;
}

async function main() {
  console.log("Starting Saleor catalog cleanup...");

  // 1. Fetch all products and variants
  const fetchQuery = `
    query AllProducts($channel: String!) {
      products(first: 100, channel: $channel) {
        edges {
          node {
            id
            name
            slug
            variants {
              id
              name
              sku
              trackInventory
            }
          }
        }
      }
    }
  `;

  const data = await saleorFetch(fetchQuery, { channel: env.NEXT_PUBLIC_SALEOR_CHANNEL || "default-channel" });
  const products = data.products.edges.map(e => e.node);

  console.log(`Successfully fetched ${products.length} products from Saleor.`);

  // 2. Process deletions and updates
  const duplicateSlugs = ["inovative", "hony-opal", "lava-rock-bohski", "marget"];
  
  for (const p of products) {
    // A. Handle legacy duplicate deletions
    if (duplicateSlugs.includes(p.slug)) {
      console.log(`Deleting legacy duplicate product: "${p.name}" (Slug: ${p.slug}, ID: ${p.id})...`);
      const delMutation = `
        mutation DeleteProduct($id: ID!) {
          productDelete(id: $id) {
            errors {
              field
              message
            }
          }
        }
      `;
      try {
        const res = await saleorFetch(delMutation, { id: p.id });
        console.log(`Successfully deleted legacy product "${p.name}" in Saleor!`);
      } catch (err) {
        console.error(`Failed to delete product ${p.slug}:`, err.message);
      }
      continue;
    }

    // B. Handle Frasco rename to Fresco
    if (p.slug === "frasco") {
      console.log(`Renaming Frasco to Fresco (ID: ${p.id})...`);
      const updateMutation = `
        mutation UpdateProduct($id: ID!, $input: ProductInput!) {
          productUpdate(id: $id, input: $input) {
            product {
              id
              slug
              name
            }
            errors {
              field
              message
            }
          }
        }
      `;
      try {
        const res = await saleorFetch(updateMutation, {
          id: p.id,
          input: { name: "Fresco", slug: "fresco" }
        });
        console.log(`Successfully renamed Frasco to Fresco in Saleor!`);
      } catch (err) {
        console.error("Failed to rename Frasco:", err.message);
      }
    }

    // C. Set trackInventory: false on all variants to ensure Supabase remains single source of truth for stock
    for (const v of p.variants) {
      console.log(`Setting trackInventory: false on variant "${v.name}" for "${p.name}" (Variant ID: ${v.id})...`);
      const variantUpdateMutation = `
        mutation DisableVariantInventory($id: ID!, $input: ProductVariantInput!) {
          productVariantUpdate(id: $id, input: $input) {
            errors {
              field
              message
            }
          }
        }
      `;
      try {
        await saleorFetch(variantUpdateMutation, {
          id: v.id,
          input: { trackInventory: false }
        });
      } catch (err) {
        console.error(`Failed to disable inventory tracking on variant ${v.id}:`, err.message);
      }
    }
  }

  console.log("\nSaleor catalog cleanup and stock bypass setup successfully completed!");
}

main().catch(err => {
  console.error("Cleanup failed:", err);
});
