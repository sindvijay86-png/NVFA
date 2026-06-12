// Vercel serverless proxy to Anthropic API.
// Set ANTHROPIC_API_KEY in Vercel → Project → Settings → Environment Variables.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const { messages, system, max_tokens } = req.body || {};
    if (!Array.isArray(messages)) return res.status(400).json({ error: "messages required" });
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: Math.min(max_tokens || 1500, 3000),
        system: system || "",
        messages,
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    const text = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).join("\n");
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
