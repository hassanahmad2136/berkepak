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
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase configuration in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function run() {
  console.log("Checking Supabase connection...");
  
  // Try to query a products table
  const { data: productsData, error: productsError } = await supabase
    .from('products')
    .select('*')
    .limit(1);
    
  if (productsError) {
    console.log("Querying 'products' table failed. Error code:", productsError.code);
    console.log("Error details:", productsError.message);
  } else {
    console.log("Successfully queried 'products' table! Found count:", productsData.length);
    console.log("Sample product:", productsData[0]);
  }

  // Try to query 'orders' table to verify general connection
  const { data: ordersData, error: ordersError } = await supabase
    .from('orders')
    .select('id')
    .limit(1);
    
  if (ordersError) {
    console.error("Failed to query 'orders' table:", ordersError.message);
  } else {
    console.log("Successfully connected and queried 'orders' table. Order ID sample:", ordersData[0]?.id || "none");
  }
  
  // Try querying current schema's tables
  const { data: tablesData, error: tablesError } = await supabase
    .rpc('get_tables'); // In case a helper RPC exists, otherwise we will see if we get a method error
    
  if (tablesError) {
    console.log("Helper RPC get_tables failed (expected if not defined):", tablesError.message);
  } else {
    console.log("Tables list from RPC:", tablesData);
  }
}

run().catch(console.error);
