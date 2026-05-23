const path = require("path");
const { loadEnvConfig } = require("@next/env");

// Load Next.js environment configuration
const projectDir = path.resolve(__dirname, "..");
loadEnvConfig(projectDir);

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use admin service key to bypass RLS

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Environment variables missing.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function main() {
  console.log("Starting database corrections in Supabase using Service Role Admin client...");

  // 1. Rename Frasco to Fresco
  console.log("Renaming Frasco to Fresco...");
  const { error: renameErr } = await supabase
    .from("products")
    .update({ name: "Fresco", slug: "fresco" })
    .eq("id", "UHJvZHVjdDozMDA=");
  
  if (renameErr) {
    console.error("Failed to rename Frasco:", renameErr);
  } else {
    console.log("Successfully renamed Frasco to Fresco in Supabase!");
  }

  // 2. Delete duplicate legacy rows
  const duplicateIds = [
    { id: "UHJvZHVjdDoyNzI=", slug: "inovative" },
    { id: "UHJvZHVjdDoyNjE=", slug: "hony-opal" },
    { id: "UHJvZHVjdDoyNjc=", slug: "lava-rock-bohski" },
    { id: "UHJvZHVjdDoyNjg=", slug: "marget" }
  ];

  for (const item of duplicateIds) {
    console.log(`Cleaning up legacy duplicate color variants and product row for: ${item.slug} (${item.id})...`);
    
    // Delete variants first to avoid FK constraints
    const { error: varErr } = await supabase
      .from("product_colors")
      .delete()
      .eq("product_id", item.id);
    
    if (varErr) {
      console.warn(`Warning deleting colors for ${item.slug}:`, varErr.message);
    }

    // Delete the product row
    const { error: prodErr } = await supabase
      .from("products")
      .delete()
      .eq("id", item.id);
    
    if (prodErr) {
      console.error(`Failed to delete legacy duplicate product row for ${item.slug}:`, prodErr);
    } else {
      console.log(`Successfully deleted duplicate row ${item.slug}!`);
    }
  }

  // 3. Confirm clean list
  const { data, error: fetchErr } = await supabase
    .from("products")
    .select("id, name, slug");
  
  if (fetchErr) {
    console.error("Final validation fetch failed:", fetchErr);
  } else {
    console.log("\nVerification of database records after spelling repairs:");
    data.forEach(p => {
      console.log(`- Slug: ${p.slug} | Name: ${p.name}`);
    });
  }
}

main();
