const { proxyChannelMonitor } = require("../lib/channel-monitor");

function json(data, status, cache) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": cache },
  });
}

async function GET(request) {
  try {
    const id = new URL(request.url).searchParams.get("id") || "";
    const result = await proxyChannelMonitor(id);
    const cache = result.status === 200 ? "public, max-age=60" : "no-store";
    return json(result.payload, result.status, cache);
  } catch (err) {
    console.error(err);
    return json({ error: "unavailable" }, 502, "no-store");
  }
}

module.exports = { GET };
