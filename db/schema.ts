import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable("rooms", {
  code: text("code").primaryKey(),
  hostKey: text("host_key").notNull(),
  pvpEnabled: integer("pvp_enabled", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
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
}, (table) => [
  index("idx_players_room_code").on(table.roomCode),
  uniqueIndex("idx_players_room_name").on(table.roomCode, table.name),
]);
