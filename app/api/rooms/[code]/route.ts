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
    "SELECT code, pvp_enabled AS pvpEnabled, created_at AS createdAt, world_started_at AS worldStartedAt, cycle FROM rooms WHERE code = ?"
  ).bind(code).first<{ code: string; pvpEnabled: number; createdAt: string; worldStartedAt: string | null; cycle: number }>();

  if (!room) return null;

  const result = await env.DB.prepare(
    `SELECT id, name, is_host AS isHost, joined_at AS joinedAt,
      life_status AS lifeStatus, death_day AS deathDay,
      revive_deadline_day AS reviveDeadlineDay, soul_power AS soulPower,
      last_soul_action_day AS lastSoulActionDay,
      pending_spirit_loss AS pendingSpiritLoss, realm, level,
      current_spirit AS currentSpirit, max_spirit AS maxSpirit
    FROM players WHERE room_code = ? AND left_at IS NULL
    ORDER BY is_host DESC, joined_at ASC`
  ).bind(code).all<{
    id: string;
    name: string;
    isHost: number;
    joinedAt: string;
    lifeStatus: "alive" | "soul" | "rebirth";
    deathDay: number | null;
    reviveDeadlineDay: number | null;
    soulPower: number;
    lastSoulActionDay: number | null;
    pendingSpiritLoss: number;
    realm: string | null;
    level: number;
    currentSpirit: number;
    maxSpirit: number;
  }>();

  const worldStartedAt = room.worldStartedAt ?? room.createdAt;
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - Date.parse(worldStartedAt)) / 60000));
  return {
    code: room.code,
    pvpEnabled: room.pvpEnabled === 1,
    createdAt: room.createdAt,
    cycle: room.cycle,
    worldDay: elapsedMinutes + 1,
    players: result.results.map((player) => ({ ...player, isHost: player.isHost === 1 })),
  };
}

function boundedNumber(value: unknown, minimum: number, maximum: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return minimum;
  return Math.max(minimum, Math.min(maximum, Math.floor(value)));
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

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { code: rawCode } = await context.params;
    const code = cleanCode(rawCode);
    const body = await request.json() as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";
    const playerId = typeof body.playerId === "string" ? body.playerId : "";
    if (!playerId) return Response.json({ error: "缺少角色凭证。" }, { status: 400 });

    const room = await loadRoom(code);
    if (!room) return Response.json({ error: "没有找到这个世界。" }, { status: 404 });
    const actor = room.players.find((player) => player.id === playerId);
    if (!actor) return Response.json({ error: "你已不在这个世界中。" }, { status: 403 });

    if (action === "sync") {
      if (actor.lifeStatus === "alive") {
        await env.DB.prepare(
          "UPDATE players SET realm = ?, level = ?, current_spirit = ?, max_spirit = ? WHERE room_code = ? AND id = ?"
        ).bind(
          typeof body.realm === "string" ? body.realm.slice(0, 24) : "命数未定",
          boundedNumber(body.level, 1, 1000),
          boundedNumber(body.currentSpirit, 0, 1000000),
          boundedNumber(body.maxSpirit, 0, 1000000),
          code,
          playerId,
        ).run();
      }
    } else if (action === "advance_time") {
      if (actor.lifeStatus !== "alive") return Response.json({ error: "只有在世修士可以推动世界时间。" }, { status: 409 });
      const days = boundedNumber(body.days, 1, 3650);
      await env.DB.prepare(
        "UPDATE rooms SET world_started_at = strftime('%Y-%m-%dT%H:%M:%fZ', COALESCE(world_started_at, created_at), '-' || ? || ' minutes') WHERE code = ?"
      ).bind(days, code).run();
    } else if (action === "begin_life") {
      await env.DB.prepare(
        "UPDATE players SET life_status = 'alive', death_day = NULL, revive_deadline_day = NULL, soul_power = 0, last_soul_action_day = NULL WHERE room_code = ? AND id = ? AND life_status IN ('alive', 'rebirth')"
      ).bind(code, playerId).run();
    } else if (action === "die") {
      let diedNow = false;
      if (actor.lifeStatus === "alive") {
        const deadlineDays = boundedNumber(body.deadlineDays, 1, 30);
        await env.DB.prepare(
          "UPDATE players SET life_status = 'soul', death_day = ?, revive_deadline_day = ?, soul_power = 0, last_soul_action_day = NULL WHERE room_code = ? AND id = ?"
        ).bind(room.worldDay, room.worldDay + deadlineDays, code, playerId).run();
        diedNow = true;
      }
      if (diedNow) {
        const remaining = await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM players WHERE room_code = ? AND left_at IS NULL AND life_status = 'alive'"
        ).bind(code).first<{ count: number }>();
        if ((remaining?.count ?? 0) === 0) {
          const now = new Date().toISOString();
          await env.DB.batch([
            env.DB.prepare("UPDATE rooms SET cycle = cycle + 1, world_started_at = ? WHERE code = ?").bind(now, code),
            env.DB.prepare(
              "UPDATE players SET life_status = 'rebirth', death_day = NULL, revive_deadline_day = NULL, soul_power = 0, last_soul_action_day = NULL, pending_spirit_loss = 0 WHERE room_code = ? AND left_at IS NULL"
            ).bind(code),
          ]);
        }
      }
    } else if (action === "soul_action") {
      if (actor.lifeStatus !== "soul") return Response.json({ error: "只有残魂可以进行这项行动。" }, { status: 409 });
      if ((actor.lastSoulActionDay ?? 0) >= room.worldDay) return Response.json({ error: "今日已经行动过了。" }, { status: 409 });
      const powerGain = boundedNumber(body.powerGain, 0, 2);
      let drained = 0;
      if (body.actionId === "siphon") {
        const targetId = typeof body.targetId === "string" ? body.targetId : "";
        const target = room.players.find((player) => player.id === targetId && player.lifeStatus === "alive");
        if (!target) return Response.json({ error: "没有可以吸取灵力的生者。" }, { status: 409 });
        const floorPercent = boundedNumber(body.floorPercent, 10, 80);
        const maximumPercent = boundedNumber(body.maximumPercent, 1, 20);
        const requested = boundedNumber(body.spiritDrain, 0, 50);
        const safeFloor = Math.ceil(target.maxSpirit * floorPercent / 100);
        const perActionMaximum = Math.max(1, Math.floor(target.maxSpirit * maximumPercent / 100));
        drained = Math.max(0, Math.min(requested, perActionMaximum, target.currentSpirit - safeFloor));
        if (drained > 0) {
          await env.DB.prepare(
            "UPDATE players SET current_spirit = MAX(0, current_spirit - ?), pending_spirit_loss = pending_spirit_loss + ? WHERE room_code = ? AND id = ?"
          ).bind(drained, drained, code, target.id).run();
        }
      }
      await env.DB.prepare(
        "UPDATE players SET soul_power = soul_power + ?, last_soul_action_day = ? WHERE room_code = ? AND id = ? AND life_status = 'soul'"
      ).bind(powerGain, room.worldDay, code, playerId).run();
      const updated = await loadRoom(code);
      const updatedActor = updated?.players.find((player) => player.id === playerId);
      return Response.json({ room: updated, soulPower: updatedActor?.soulPower ?? actor.soulPower + powerGain, drained });
    } else if (action === "revive") {
      const targetId = typeof body.targetId === "string" ? body.targetId : "";
      const target = room.players.find((player) => player.id === targetId);
      if (!target || target.lifeStatus !== "soul") return Response.json({ error: "这名修士当前无需复活。" }, { status: 409 });
      const selfOnly = body.selfOnly === true;
      if (selfOnly) {
        if (targetId !== playerId) return Response.json({ error: "聚魂自返只能用于自己。" }, { status: 403 });
        const soulPowerCost = boundedNumber(body.soulPowerCost, 1, 100);
        if (target.soulPower < soulPowerCost) return Response.json({ error: `魂力不足，还需要 ${soulPowerCost} 点。` }, { status: 409 });
      } else if (actor.lifeStatus !== "alive" || targetId === playerId) {
        return Response.json({ error: "只有生者可以帮助其他残魂还阳。" }, { status: 409 });
      }
      await env.DB.prepare(
        "UPDATE players SET life_status = 'alive', death_day = NULL, revive_deadline_day = NULL, soul_power = 0, last_soul_action_day = NULL WHERE room_code = ? AND id = ?"
      ).bind(code, targetId).run();
    } else if (action === "ack_effects") {
      await env.DB.prepare("UPDATE players SET pending_spirit_loss = 0 WHERE room_code = ? AND id = ?")
        .bind(code, playerId).run();
    } else {
      return Response.json({ error: "未知的世界行动。" }, { status: 400 });
    }

    return Response.json({ room: await loadRoom(code) });
  } catch (error) {
    console.error("update room life state failed", error);
    return Response.json({ error: "天道暂时没有回应这次行动。" }, { status: 500 });
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
