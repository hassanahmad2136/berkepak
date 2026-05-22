const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = 'https://qlluilxjenwctwahignx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsbHVpbHhqZW53Y3R3YWhpZ254Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTQ5ODUsImV4cCI6MjA5MzQ5MDk4NX0.o5t6VOZt8xGffBgpX0gausX9XHdNt8AWlvuvosHfZpQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from("products")
    .select("*");
  
  if (error) {
    console.error("Products table query failed:", error);
  } else {
    console.log("Products table content:", JSON.stringify(data, null, 2));
  }
}

main();
