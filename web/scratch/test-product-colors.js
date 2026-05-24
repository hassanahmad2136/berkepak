const path = require("path");
const { loadEnvConfig } = require("@next/env");

// Load Next.js environment configuration
const projectDir = path.resolve(__dirname, "..");
loadEnvConfig(projectDir);

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Supabase credentials not found.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from("product_colors")
    .select("*")
    .limit(5);
  
  if (error) {
    console.error("product_colors query failed:", error.message);
  } else {
    console.log("product_colors table exists! Sample data:", data);
  }
}

main();
