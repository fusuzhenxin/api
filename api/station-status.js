const { getStationStatus } = require("../lib/station-status");

function json(data, status, cache) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": cache },
  });
}

async function GET() {
  try {
    const result = await getStationStatus({ force: false });
    const cache = result.stale
      ? "public, max-age=60"
      : "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";
    return json(result.payload, 200, cache);
  } catch (err) {
    console.error(err);
    return json({ ok: false }, 503, "no-store");
  }
}

module.exports = { GET };
