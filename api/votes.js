const { dump, getOne, vote } = require("../lib/votes");

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function GET(request) {
  try {
    const url = new URL(request.url);
    const voter = url.searchParams.get("voter") || "";
    const id = url.searchParams.get("id") || "";
    if (id) return json(await getOne(id, voter));
    return json(await dump(voter));
  } catch (err) {
    console.error(err);
    return json({ error: String(err.message || err) }, 400);
  }
}

async function POST(request) {
  try {
    const body = await request.json();
    return json(await vote(body.id, body.dir, body.voter));
  } catch (err) {
    console.error(err);
    return json({ error: String(err.message || err) }, 400);
  }
}

module.exports = { GET, POST };
