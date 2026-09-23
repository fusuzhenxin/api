const { acceptApply } = require("../lib/apply-mail");

function json(data, status) {
  return Response.json(data, {
    status: status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch (err) {
    return json({ ok: false, error: "提交内容无法读取" }, 400);
  }
  const result = await acceptApply(body);
  if (result.ok) return json({ ok: true }, 200);
  if (result.error) return json({ ok: false, error: result.error }, 400);
  return json({ ok: false }, 502);
}

module.exports = { POST };
