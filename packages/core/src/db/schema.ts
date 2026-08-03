import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["admin", "campaign_manager", "agent"]);
export const contactSource = pgEnum("contact_source", ["manual", "csv", "action_network"]);
export const listType = pgEnum("list_type", ["static", "dynamic"]);
export const optOutChannel = pgEnum("opt_out_channel", ["sms", "voice"]);
export const campaignStatus = pgEnum("campaign_status", ["draft", "active", "paused", "completed"]);
export const assignmentStatus = pgEnum("assignment_status", [
  "pending",
  "assigned",
  "sent",
  "skipped",
  "replied",
]);
export const messageDirection = pgEnum("message_direction", ["outbound", "inbound"]);
export const smsMode = pgEnum("sms_mode", ["mock", "live"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: userRole("role").notNull().default("agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: varchar("phone", { length: 20 }).notNull(),
    firstName: varchar("first_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }),
    customFields: jsonb("custom_fields").notNull().default({}),
    source: contactSource("source").notNull().default("manual"),
    actionNetworkId: varchar("action_network_id", { length: 255 }),
    consentSource: varchar("consent_source", { length: 255 }),
    consentedAt: timestamp("consented_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    phoneIdx: uniqueIndex("contacts_phone_idx").on(table.phone),
    actionNetworkIdx: index("contacts_action_network_idx").on(table.actionNetworkId),
  })
);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lists = pgTable("lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  type: listType("type").notNull().default("static"),
  filterQuery: jsonb("filter_query"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const listMemberships = pgTable(
  "list_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    listContactIdx: uniqueIndex("list_memberships_list_contact_idx").on(
      table.listId,
      table.contactId
    ),
  })
);

export const optOuts = pgTable(
  "opt_outs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: varchar("phone", { length: 20 }).notNull(),
    channel: optOutChannel("channel").notNull(),
    source: varchar("source", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    phoneChannelIdx: uniqueIndex("opt_outs_phone_channel_idx").on(table.phone, table.channel),
  })
);

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  listId: uuid("list_id")
    .notNull()
    .references(() => lists.id),
  status: campaignStatus("status").notNull().default("draft"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messageTemplates = pgTable("message_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 255 }).notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const queueAssignments = pgTable(
  "queue_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id),
    agentId: uuid("agent_id").references(() => users.id),
    status: assignmentStatus("status").notNull().default("pending"),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => ({
    campaignContactIdx: uniqueIndex("queue_assignments_campaign_contact_idx").on(
      table.campaignId,
      table.contactId
    ),
  })
);

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Nullable: inbound messages (replies, STOP/START) aren't necessarily tied to a
  // campaign send, and may arrive from numbers we don't have a contact record for.
  campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").references(() => contacts.id),
  agentId: uuid("agent_id").references(() => users.id),
  direction: messageDirection("direction").notNull(),
  body: text("body").notNull(),
  mediaUrls: jsonb("media_urls").notNull().default([]),
  providerMessageId: varchar("provider_message_id", { length: 255 }),
  status: varchar("status", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Single-row settings table (id is always "singleton"). Holds the live/mock SMS
// switch — defaults to mock so a fresh deploy can never send a real text until an
// admin deliberately flips it, and it's checked on every send rather than cached
// at boot so the switch takes effect immediately across all agents.
export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey().default("singleton"),
  smsMode: smsMode("sms_mode").notNull().default("mock"),
  actionNetworkLastSyncedAt: timestamp("action_network_last_synced_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
