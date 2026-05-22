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

const query = `
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
            pricing {
              price {
                gross {
                  amount
                  currency
                }
              }
            }
          }
        }
      }
    }
  }
`;

async function run() {
  console.log("Connecting to Saleor at:", saleorUrl);
  console.log("Using token:", saleorToken ? "Yes (configured)" : "No");

  const headers = { "Content-Type": "application/json" };
  if (saleorToken) {
    headers["Authorization"] = `Bearer ${saleorToken}`;
  }

  try {
    const res = await fetch(saleorUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query,
        variables: { channel: env.NEXT_PUBLIC_SALEOR_CHANNEL || "default-channel" }
      })
    });

    if (!res.ok) {
      console.error(`HTTP error! status: ${res.status}`);
      const text = await res.text();
      console.error("Response body:", text);
      return;
    }

    const json = await res.json();
    if (json.errors) {
      console.error("Saleor GraphQL Errors:", json.errors);
      return;
    }

    const products = json.data.products.edges.map(e => e.node);
    console.log(`Found ${products.length} products in Saleor:`);
    products.forEach(p => {
      console.log(`- Product: "${p.name}" (Slug: ${p.slug})`);
      p.variants.forEach(v => {
        const price = v.pricing?.price?.gross;
        console.log(`  * Variant ID: ${v.id}, Name: "${v.name}", SKU: "${v.sku}", Price: ${price ? price.amount + ' ' + price.currency : 'N/A'}`);
      });
    });
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

run();
