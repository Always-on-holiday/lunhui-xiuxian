import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable("rooms", {
  code: text("code").primaryKey(),
  hostKey: text("host_key").notNull(),
  pvpEnabled: integer("pvp_enabled", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  worldStartedAt: text("world_started_at"),
  cycle: integer("cycle").notNull().default(1),
}, (table) => [
  index("idx_rooms_created_at").on(table.createdAt),
]);

export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  roomCode: text("room_code").notNull().references(() => rooms.code, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isHost: integer("is_host", { mode: "boolean" }).notNull().default(false),
  joinedAt: text("joined_at").notNull(),
  leftAt: text("left_at"),
  lifeStatus: text("life_status").notNull().default("alive"),
  deathDay: integer("death_day"),
  reviveDeadlineDay: integer("revive_deadline_day"),
  soulPower: integer("soul_power").notNull().default(0),
  lastSoulActionDay: integer("last_soul_action_day"),
  pendingSpiritLoss: integer("pending_spirit_loss").notNull().default(0),
  realm: text("realm"),
  level: integer("level").notNull().default(1),
  currentSpirit: integer("current_spirit").notNull().default(0),
  maxSpirit: integer("max_spirit").notNull().default(0),
}, (table) => [
  index("idx_players_room_code").on(table.roomCode),
  uniqueIndex("idx_players_room_name").on(table.roomCode, table.name),
]);
