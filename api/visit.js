const { recordVisit, readVisits } = require("../lib/visits");

function fromResult(result) {
  return new Response(result.body, { status: result.status, headers: result.headers });
}

async function GET(request) {
  try {
    const url = new URL(request.url);
    return fromResult(
      await readVisits({
        key: url.searchParams.get("key") || "",
        format: url.searchParams.get("format") || "",
      })
    );
  } catch (err) {
    console.error(err);
    return new Response("not found", { status: 404, headers: { "cache-control": "no-store" } });
  }
}

async function POST(request) {
  try {
    return fromResult(
      await recordVisit({
        ua: request.headers.get("user-agent") || "",
        body: await request.text(),
      })
    );
  } catch (err) {
    console.error(err);
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  }
}

module.exports = { GET, POST };
