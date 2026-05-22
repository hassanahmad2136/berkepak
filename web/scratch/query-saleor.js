const fetch = require("node-fetch" in global ? "node-fetch" : "globalThis").fetch || globalThis.fetch;

const query = `
  query {
    channels {
      id
      name
      slug
    }
  }
`;

async function main() {
  const url = "http://localhost:8000/graphql/";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer H6h2CEbSvIeRxzz1hxJWoV3ULv607L"
      },
      body: JSON.stringify({ query })
    });
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

main();
