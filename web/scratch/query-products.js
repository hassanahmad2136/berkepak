const path = require("path");
const { loadEnvConfig } = require("@next/env");

// Load Next.js environment configuration
const projectDir = path.resolve(__dirname, "..");
loadEnvConfig(projectDir);

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Environment variables missing.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug");
  
  if (error) {
    console.error("Query failed:", error);
  } else {
    console.log("All products in database:");
    data.forEach(p => {
      console.log(`- ID: ${p.id} | Slug: ${p.slug} | Name: ${p.name}`);
    });
  }
}

main();
