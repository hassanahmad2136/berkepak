// web/scripts/port-saleor-to-supabase.mjs
// Usage: node web/scripts/port-saleor-to-supabase.mjs  (run from project root)
//   OR:  cd web && node scripts/port-saleor-to-supabase.mjs
// Idempotent: safe to re-run. Uses upsert on slug.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local manually (no dotenv dependency)
const envPath = resolve(__dirname, "../.env.local");
let envContent;
try {
  envContent = readFileSync(envPath, "utf8");
} catch {
  console.error("Could not read web/.env.local — trying .env");
  envContent = readFileSync(resolve(__dirname, "../.env"), "utf8");
}
const env = Object.fromEntries(
  envContent
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const [k, ...v] = l.split("=");
      return [k.trim(), v.join("=").trim().replace(/^['"]|['"]$/g, "")];
    })
);

// Allow process.env overrides (useful for targeting local vs remote)
const SALEOR_URL =
  process.env["NEXT_PUBLIC_SALEOR_API_URL"] ??
  env["NEXT_PUBLIC_SALEOR_API_URL"] ?? "http://localhost:8000/graphql/";
const SALEOR_TOKEN =
  process.env["SALEOR_APP_TOKEN"] ?? env["SALEOR_APP_TOKEN"] ?? "";
const SUPABASE_URL =
  process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? env["NEXT_PUBLIC_SUPABASE_URL"];
const SUPABASE_SERVICE_KEY =
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? env["SUPABASE_SERVICE_ROLE_KEY"];

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in web/.env.local"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const PRODUCTS_QUERY = `
  query FetchAllProducts($after: String) {
    products(first: 100, channel: "default-channel", after: $after) {
      pageInfo { hasNextPage endCursor }
      edges { node {
        id slug name
        category { name }
        attributes { attribute { name slug } values { name } }
        description
        channelListings { isPublished channel { slug } }
        variants {
          id name
          pricing { price { gross { amount } } }
          attributes { attribute { name } values { name } }
        }
        media { url }
      }}
    }
  }
`;

async function fetchAllFromSaleor() {
  let all = [],
    cursor = null,
    hasNext = true;
  while (hasNext) {
    const res = await fetch(SALEOR_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(SALEOR_TOKEN ? { Authorization: `Bearer ${SALEOR_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        query: PRODUCTS_QUERY,
        variables: { after: cursor },
      }),
    });
    if (!res.ok) {
      console.error(`HTTP ${res.status} from Saleor: ${await res.text()}`);
      process.exit(1);
    }
    const json = await res.json();
    if (json.errors) {
      console.error(
        "Saleor GraphQL error:",
        JSON.stringify(json.errors, null, 2)
      );
      process.exit(1);
    }
    const page = json.data.products;
    all.push(...page.edges.map((e) => e.node));
    hasNext = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor;
  }
  return all;
}

function attr(product, ...names) {
  for (const name of names) {
    const found = product.attributes.find(
      (a) =>
        a.attribute.name.toLowerCase() === name.toLowerCase() ||
        a.attribute.slug.toLowerCase() === name.toLowerCase()
    );
    if (found?.values[0]?.name) return found.values[0].name;
  }
  return null;
}

function numAttr(product, ...names) {
  const v = attr(product, ...names);
  return v ? parseInt(v) || null : null;
}

function findVariant(product, nameHint) {
  return product.variants.find((v) =>
    v.name.toLowerCase().includes(nameHint.toLowerCase())
  );
}

function mapProduct(p) {
  const suitVariant = findVariant(p, "suit");
  const meterVariant =
    findVariant(p, "meter") ?? findVariant(p, "metre");
  const pricePerSuit = suitVariant?.pricing?.price?.gross?.amount ?? 0;
  const pricePerMeter = meterVariant?.pricing?.price?.gross?.amount ?? 0;

  // description: Saleor stores as Slate/EditorJS JSON or plain string
  let description = "";
  if (typeof p.description === "string") {
    try {
      const parsed = JSON.parse(p.description);
      if (parsed?.blocks) {
        description = parsed.blocks
          .map((b) => b.data?.text ?? "")
          .filter(Boolean)
          .join("\n");
      } else {
        description = p.description;
      }
    } catch {
      description = p.description;
    }
  } else if (p.description?.blocks) {
    description = p.description.blocks
      .map((b) => b.data?.text ?? "")
      .filter(Boolean)
      .join("\n");
  }

  return {
    slug: p.slug,
    name: p.name,
    category: p.category?.name ?? "Uncategorized",
    weave_type: attr(p, "weave", "weave-type", "weave_type"),
    gsm: numAttr(p, "gsm"),
    thread_count: numAttr(p, "thread-count", "thread_count", "thread count"),
    composition: attr(p, "composition") ?? "",
    description,
    short_description:
      attr(p, "short-description", "short_description") ?? "",
    price_per_suit: pricePerSuit,
    price_per_meter: pricePerMeter,
    meters_per_suit:
      parseFloat(
        attr(p, "meters-per-suit", "meters_per_suit") ?? "2.75"
      ) || 2.75,
    images: p.media?.map((m) => m.url) ?? [],
    is_new: attr(p, "is-new", "is_new")?.toLowerCase() === "true",
    is_featured:
      attr(p, "is-featured", "is_featured")?.toLowerCase() === "true",
    is_active:
      p.channelListings?.some(
        (cl) => cl.channel.slug === "default-channel" && cl.isPublished
      ) ?? false,
  };
}

async function updateProductColorsFK(catalogRows) {
  console.log("\nUpdating product_colors.catalog_id...");

  const slugToUuid = Object.fromEntries(
    catalogRows.map((r) => [r.slug, r.id])
  );

  // Fetch product_colors rows
  const { data: colorRows, error: colorErr } = await supabase
    .from("product_colors")
    .select("id, product_id, catalog_id");
  if (colorErr) {
    console.error("Error fetching product_colors:", colorErr.message);
    return;
  }

  // Fetch legacy products table: Saleor ID → slug
  const { data: legacyProducts, error: legacyErr } = await supabase
    .from("products")
    .select("id, slug");
  if (legacyErr) {
    console.warn(
      "Could not fetch legacy products table:",
      legacyErr.message
    );
  }

  const saleorIdToSlug = Object.fromEntries(
    (legacyProducts ?? []).map((r) => [r.id, r.slug])
  );

  let updated = 0,
    skipped = 0,
    alreadySet = 0;
  for (const colorRow of colorRows ?? []) {
    // Skip if already populated
    if (colorRow.catalog_id) {
      alreadySet++;
      continue;
    }

    const slug = saleorIdToSlug[colorRow.product_id];
    const catalogId = slug ? slugToUuid[slug] : null;

    if (!catalogId) {
      console.warn(
        `  WARNING: No catalog match: product_colors.id=${colorRow.id} product_id=${colorRow.product_id}`
      );
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from("product_colors")
      .update({ catalog_id: catalogId })
      .eq("id", colorRow.id);

    if (error) {
      console.error(
        `  Error updating colors row ${colorRow.id}:`,
        error.message
      );
      skipped++;
    } else {
      updated++;
    }
  }

  if (alreadySet > 0) console.log(`  Already set: ${alreadySet} rows`);
  console.log(`  Updated: ${updated} | Skipped: ${skipped}`);
  if (skipped === 0) {
    console.log("  OK: Zero orphaned records");
  } else {
    console.log(
      `  WARNING: ${skipped} orphaned records — investigate before running FK swap migration`
    );
  }

  // Verify
  const { count: nullCount } = await supabase
    .from("product_colors")
    .select("*", { count: "exact", head: true })
    .is("catalog_id", null);
  console.log(`  Rows with NULL catalog_id: ${nullCount}`);
}

async function main() {
  console.log("=== Saleor -> Supabase Product Porting Script ===\n");
  console.log(`Saleor: ${SALEOR_URL}`);
  console.log(`Supabase: ${SUPABASE_URL}\n`);

  console.log("Fetching products from Saleor...");
  const products = await fetchAllFromSaleor();
  console.log(`Fetched ${products.length} products`);

  if (products.length === 0) {
    console.error(
      "No products found in Saleor. Is Saleor running and seeded?"
    );
    process.exit(1);
  }

  const rows = products.map(mapProduct);

  // Log sample mapping
  console.log("\nSample mapping (first product):");
  console.log(JSON.stringify(rows[0], null, 2));

  // Upsert into product_catalog (idempotent on slug)
  console.log(`\nUpserting ${rows.length} products to product_catalog...`);
  const { error: upsertErr } = await supabase
    .from("product_catalog")
    .upsert(rows, { onConflict: "slug" });

  if (upsertErr) {
    console.error("Upsert error:", upsertErr.message);
    process.exit(1);
  }
  console.log("Upsert complete");

  // Parity check
  const { count } = await supabase
    .from("product_catalog")
    .select("*", { count: "exact", head: true });

  console.log(`\n=== PARITY CHECK ===`);
  console.log(`  Saleor:   ${products.length}`);
  console.log(`  Supabase: ${count}`);
  console.log(
    count >= products.length
      ? "  PARITY CHECK PASSED"
      : "  PARITY CHECK FAILED"
  );

  // Fetch catalog for FK update
  const { data: catalogRows } = await supabase
    .from("product_catalog")
    .select("id, slug");

  await updateProductColorsFK(catalogRows);

  console.log("\n=== Done ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
