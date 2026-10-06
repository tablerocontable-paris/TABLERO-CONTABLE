import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";
// The Sites operational store is independent of the unapplied Supabase schema.
export const workspace = sqliteTable("paris_workspace", {
  id: text("id").primaryKey(),
  revision: integer("revision").notNull().default(0),
  data: text("data").notNull(),
  updatedAt: text("updated_at").notNull(),
  writeToken: text("write_token").notNull().default(""),
});
export const records = sqliteTable(
  "paris_records",
  {
    collection: text("collection").notNull(),
    id: text("id").notNull(),
    data: text("data").notNull(),
  },
  (table) => [primaryKey({ columns: [table.collection, table.id] })],
);
export const presence = sqliteTable("paris_presence", {
  profileId: text("profile_id").primaryKey(),
  lastSeen: text("last_seen").notNull(),
});
