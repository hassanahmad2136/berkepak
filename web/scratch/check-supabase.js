const path = require("path");
const { loadEnvConfig } = require("@next/env");

// Load Next.js environment configuration
const projectDir = path.resolve(__dirname, "..");
loadEnvConfig(projectDir);

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be defined in your environment.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from("products")
    .select("count", { count: "exact", head: true });
  
  if (error) {
    console.error("Products table query failed:", error);
  } else {
    console.log("Products table exists! Active rows count:", data);
  }
}

main();

