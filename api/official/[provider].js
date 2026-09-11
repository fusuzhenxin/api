const { fetchOfficialFeed } = require("../../lib/official-feed");

async function GET(request) {
  const provider = new URL(request.url).pathname.split("/").pop() || "";
  const result = await fetchOfficialFeed(provider.replace(/[^a-z0-9_-]/gi, ""));
  return new Response(result.body, {
    status: result.status,
    headers: {
      "Content-Type": result.type,
      "Cache-Control": result.status === 200 ? "public, s-maxage=120, stale-while-revalidate=600" : "no-store",
    },
  });
}

module.exports = { GET };
