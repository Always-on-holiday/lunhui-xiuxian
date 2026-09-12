import { env } from "cloudflare:workers";

type RouteContext = { params: Promise<{ code: string }> };

function cleanCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6);
}

function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 16) : "";
}

async function loadRoom(code: string) {
  const room = await env.DB.prepare(
    "SELECT code, pvp_enabled AS pvpEnabled, created_at AS createdAt, time_offset_days AS timeOffsetDays FROM rooms WHERE code = ?"
  ).bind(code).first<{ code: string; pvpEnabled: number; createdAt: string; timeOffsetDays: number }>();

  if (!room) return null;

  const result = await env.DB.prepare(
    "SELECT id, name, is_host AS isHost, joined_at AS joinedAt FROM players WHERE room_code = ? AND left_at IS NULL ORDER BY is_host DESC, joined_at ASC"
  ).bind(code).all<{ id: string; name: string; isHost: number; joinedAt: string }>();

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - Date.parse(room.createdAt)) / 60000));
  return {
    code: room.code,
    pvpEnabled: room.pvpEnabled === 1,
    createdAt: room.createdAt,
    worldDay: elapsedMinutes + room.timeOffsetDays + 1,
    players: result.results.map((player) => ({ ...player, isHost: player.isHost === 1 })),
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { code: rawCode } = await context.params;
    const code = cleanCode(rawCode);
    const body = await request.json() as { playerId?: unknown; days?: unknown };
    const playerId = typeof body.playerId === "string" ? body.playerId : "";
    const days = typeof body.days === "number" ? Math.floor(body.days) : 0;

    if (!playerId) {
      return Response.json({ error: "缺少角色凭证。" }, { status: 400 });
    }
    if (days < 1 || days > 3650) {
      return Response.json({ error: "单次行动耗时应在 1 到 3650 天之间。" }, { status: 400 });
    }

    const advanced = await env.DB.prepare(
      "UPDATE rooms SET time_offset_days = time_offset_days + ? WHERE code = ? AND EXISTS (SELECT 1 FROM players WHERE room_code = ? AND id = ? AND left_at IS NULL)"
    ).bind(days, code, code, playerId).run();
    if ((advanced.meta.changes ?? 0) !== 1) {
      return Response.json({ error: "角色不在这个世界中。" }, { status: 403 });
    }

    const room = await loadRoom(code);
    return Response.json({ room });
  } catch (error) {
    console.error("advance world time failed", error);
    return Response.json({ error: "天道暂时无法推进。" }, { status: 500 });
  }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { code: rawCode } = await context.params;
    const code = cleanCode(rawCode);
    const room = await loadRoom(code);
    if (!room) {
      return Response.json({ error: "没有找到这个世界。" }, { status: 404 });
    }
    return Response.json({ room });
  } catch (error) {
    console.error("load room failed", error);
    return Response.json({ error: "世界暂时无法读取。" }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { code: rawCode } = await context.params;
    const code = cleanCode(rawCode);
    const body = await request.json() as { name?: unknown };
    const name = cleanName(body.name);

    if (code.length !== 6) {
      return Response.json({ error: "房间码应为六位。" }, { status: 400 });
    }
    if (name.length < 2) {
      return Response.json({ error: "道号至少需要两个字符。" }, { status: 400 });
    }

    const room = await env.DB.prepare("SELECT code FROM rooms WHERE code = ?").bind(code).first();
    if (!room) {
      return Response.json({ error: "没有找到这个世界。" }, { status: 404 });
    }

    const existing = await env.DB.prepare(
      "SELECT id, left_at AS leftAt FROM players WHERE room_code = ? AND name = ?"
    ).bind(code, name).first<{ id: string; leftAt: string | null }>();
    if (existing) {
      if (existing.leftAt !== null) {
        const resumed = await env.DB.prepare(
          "UPDATE players SET left_at = NULL WHERE id = ? AND (SELECT COUNT(*) FROM players WHERE room_code = ? AND left_at IS NULL) < 4"
        ).bind(existing.id, code).run();
        if ((resumed.meta.changes ?? 0) !== 1) {
          return Response.json({ error: "这个世界已经有四位修士。" }, { status: 409 });
        }
      }
      return Response.json({ code, playerId: existing.id, resumed: true });
    }

    const playerId = crypto.randomUUID();
    const now = new Date().toISOString();
    const joined = await env.DB.prepare(
      "INSERT INTO players (id, room_code, name, is_host, joined_at) SELECT ?, ?, ?, 0, ? WHERE (SELECT COUNT(*) FROM players WHERE room_code = ? AND left_at IS NULL) < 4"
    ).bind(playerId, code, name, now, code).run();

    if ((joined.meta.changes ?? 0) !== 1) {
      return Response.json({ error: "这个世界已经有四位修士。" }, { status: 409 });
    }

    return Response.json({ code, playerId }, { status: 201 });
  } catch (error) {
    console.error("join room failed", error);
    return Response.json({ error: "暂时无法进入世界，请稍后再试。" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { code: rawCode } = await context.params;
    const code = cleanCode(rawCode);
    const playerId = new URL(request.url).searchParams.get("playerId") ?? "";
    if (!playerId) {
      return Response.json({ error: "缺少角色凭证。" }, { status: 400 });
    }
    await env.DB.prepare(
      "UPDATE players SET left_at = ? WHERE room_code = ? AND id = ?"
    ).bind(new Date().toISOString(), code, playerId).run();
    return Response.json({ ok: true });
  } catch (error) {
    console.error("leave room failed", error);
    return Response.json({ error: "暂时无法离开世界。" }, { status: 500 });
  }
}
