const { preflightVisit, recordVisit, readVisits } = require("../lib/visits");

function fromResult(result) {
  const body = result.status === 204 || result.status === 304 ? null : result.body;
  return new Response(body, { status: result.status, headers: result.headers });
}

async function GET(request) {
  try {
    const url = new URL(request.url);
    return fromResult(
      await readVisits({
        key: url.searchParams.get("key") || "",
        format: url.searchParams.get("format") || "",
        site: url.searchParams.get("site") || "",
      })
    );
  } catch (err) {
    console.error(err);
    return new Response("not found", { status: 404, headers: { "cache-control": "no-store" } });
  }
}

async function POST(request) {
  const origin = request.headers.get("origin") || "";
  try {
    return fromResult(
      await recordVisit({
        ua: request.headers.get("user-agent") || "",
        origin: origin,
        body: await request.text(),
      })
    );
  } catch (err) {
    console.error(err);
    return fromResult(preflightVisit(origin));
  }
}

async function OPTIONS(request) {
  try {
    return fromResult(preflightVisit(request.headers.get("origin") || ""));
  } catch (err) {
    console.error(err);
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  }
}

module.exports = { GET, POST, OPTIONS };
