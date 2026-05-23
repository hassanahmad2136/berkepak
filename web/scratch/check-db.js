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

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("--- Supabase Database Diagnostics ---");
  
  // 1. Check products count and sample
  const { data: products, error: pErr } = await supabase
    .from("products")
    .select("id, slug, name")
    .limit(5);
    
  if (pErr) {
    console.error("Failed to query products:", pErr.message);
  } else {
    console.log(`Products table row count fetched: ${products.length}`);
    console.log("Sample products in DB:", products);
  }
  
  // 2. Check product_colors count and sample
  const { data: colors, error: cErr } = await supabase
    .from("product_colors")
    .select("id, product_id, color_name, stock")
    .limit(10);
    
  if (cErr) {
    console.error("Failed to query product_colors:", cErr.message);
  } else {
    console.log(`Product_colors table row count fetched: ${colors.length}`);
    console.log("Sample colors in DB:", colors);
  }
}

main().catch(console.error);
