// Vercel serverless: all database actions go through here.
// Env vars needed: SUPABASE_URL, SUPABASE_SERVICE_KEY (service_role key — server only, never in frontend).
// Coach codes are validated server-side on every call.

const SB = () => ({
  url: process.env.SUPABASE_URL,
  headers: {
    apikey: process.env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    "content-type": "application/json",
    Prefer: "return=representation",
  },
});

async function sb(path, opts = {}) {
  const { url, headers } = SB();
  const r = await fetch(`${url}/rest/v1/${path}`, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function getCoach(code) {
  if (!code) return null;
  const rows = await sb(`coaches?code=eq.${encodeURIComponent(code.trim().toUpperCase())}&select=*`);
  return rows[0] || null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const { action, coach_code } = req.body || {};
    const coach = await getCoach(coach_code);
    if (!coach) return res.status(401).json({ error: "अमान्य coach code" });

    switch (action) {
      case "login":
        return res.json({ coach: { code: coach.code, name: coach.name, village: coach.village } });

      case "save_plan": {
        const { title, payload, drills } = req.body;
        const row = await sb("plans", {
          method: "POST",
          body: JSON.stringify([{ coach_code: coach.code, title, payload, drills: drills || [] }]),
        });
        return res.json({ plan: row[0] });
      }

      case "list_plans": {
        const rows = await sb(
          `plans?coach_code=eq.${encodeURIComponent(coach.code)}&select=id,created_at,title,payload&order=created_at.desc&limit=30`
        );
        return res.json({ plans: rows });
      }

      case "recent_drills": {
        const rows = await sb(
          `plans?coach_code=eq.${encodeURIComponent(coach.code)}&select=drills&order=created_at.desc&limit=8`
        );
        const names = [...new Set(rows.flatMap((r) => r.drills || []))].slice(0, 25);
        return res.json({ drills: names });
      }

      case "save_report": {
        const { week_start, sessions, avg_attendance, went_well, challenge, kaizen_moment } = req.body;
        const row = await sb("reports", {
          method: "POST",
          body: JSON.stringify([{ coach_code: coach.code, week_start, sessions, avg_attendance, went_well, challenge, kaizen_moment }]),
        });
        return res.json({ report: row[0] });
      }

      case "list_reports": {
        const rows = await sb(
          `reports?coach_code=eq.${encodeURIComponent(coach.code)}&select=*&order=week_start.desc&limit=60`
        );
        return res.json({ reports: rows });
      }

      default:
        return res.status(400).json({ error: "unknown action" });
    }
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
