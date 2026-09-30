const { getStationStatus, cronAuthorized } = require("../../lib/station-status");

async function GET(request) {
  if (!cronAuthorized(request.headers.get("authorization"))) {
    return Response.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const result = await getStationStatus({ force: true });
    const count = Object.keys((result.payload && result.payload.stations) || {}).length;
    return Response.json(
      {
        ok: !result.stale,
        fetchedAt: result.payload.fetchedAt,
        count,
        stale: Boolean(result.stale),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

module.exports = { GET };
