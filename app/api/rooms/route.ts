import { env } from "cloudflare:workers";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeRoomCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => CODE_CHARS[value % CODE_CHARS.length]).join("");
}

function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 16) : "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: unknown; pvpEnabled?: unknown };
    const name = cleanName(body.name);
    const pvpEnabled = body.pvpEnabled === true;

    if (name.length < 2) {
      return Response.json({ error: "道号至少需要两个字符。" }, { status: 400 });
    }

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const code = makeRoomCode();
      const hostKey = crypto.randomUUID();
      const playerId = crypto.randomUUID();
      const now = new Date().toISOString();

      const created = await env.DB.prepare(
        "INSERT OR IGNORE INTO rooms (code, host_key, pvp_enabled, created_at) VALUES (?, ?, ?, ?)"
      ).bind(code, hostKey, pvpEnabled ? 1 : 0, now).run();

      if ((created.meta.changes ?? 0) !== 1) continue;

      try {
        await env.DB.prepare(
          "INSERT INTO players (id, room_code, name, is_host, joined_at) VALUES (?, ?, ?, 1, ?)"
        ).bind(playerId, code, name, now).run();
      } catch (error) {
        await env.DB.prepare("DELETE FROM rooms WHERE code = ?").bind(code).run();
        throw error;
      }

      return Response.json({ code, playerId, hostKey }, { status: 201 });
    }

    return Response.json({ error: "世界生成拥挤，请再试一次。" }, { status: 503 });
  } catch (error) {
    console.error("create room failed", error);
    return Response.json({ error: "暂时无法开辟世界，请稍后再试。" }, { status: 500 });
  }
}
