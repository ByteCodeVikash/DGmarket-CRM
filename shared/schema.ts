import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, decimal, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums as const arrays for type safety
export const userRoles = ["admin", "manager", "sales", "support", "client"] as const;
export const leadSources = ["facebook", "instagram", "google", "website", "referral"] as const;
export const leadStatuses = ["new", "interested", "follow_up", "converted", "not_interested"] as const;
export const pipelineStages = ["new_lead", "contacted", "qualified", "proposal_sent", "negotiation", "won", "lost"] as const;
export const taskStatuses = ["pending", "in_progress", "done"] as const;
export const taskPriorities = ["low", "medium", "high"] as const;
export const serviceStatuses = ["active", "paused", "completed"] as const;
export const invoiceStatuses = ["draft", "sent", "paid", "overdue", "cancelled"] as const;
export const paymentMethods = ["cash", "bank_transfer", "upi", "card", "cheque"] as const;

// Users table with RBAC
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("sales"),
  phone: text("phone"),
  avatar: text("avatar"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Leads table
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  mobile: text("mobile").notNull(),
  city: text("city"),
  source: text("source").notNull().default("website"),
  status: text("status").notNull().default("new"),
  pipelineStage: text("pipeline_stage").notNull().default("new_lead"),
  ownerId: varchar("owner_id").references(() => users.id),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Lead notes for timeline
export const leadNotes = pgTable("lead_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  type: text("type").notNull().default("note"), // note, call, email, whatsapp
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Follow-ups
export const followUps = pgTable("follow_ups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  scheduledAt: timestamp("scheduled_at").notNull(),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  isCompleted: boolean("is_completed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Clients (converted leads)
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id),
  userId: varchar("user_id").references(() => users.id), // for client portal login
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address"),
  city: text("city"),
  gstNumber: text("gst_number"),
  contractStartDate: date("contract_start_date"),
  contractEndDate: date("contract_end_date"),
  ownerId: varchar("owner_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Services
export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Client Services (linking clients to services)
export const clientServices = pgTable("client_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id").notNull().references(() => services.id),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("active"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Tasks
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("pending"),
  dueDate: timestamp("due_date"),
  assigneeId: varchar("assignee_id").references(() => users.id),
  creatorId: varchar("creator_id").notNull().references(() => users.id),
  leadId: varchar("lead_id").references(() => leads.id, { onDelete: "set null" }),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Quotations
export const quotations = pgTable("quotations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quotationNumber: text("quotation_number").notNull().unique(),
  leadId: varchar("lead_id").references(() => leads.id),
  clientId: varchar("client_id").references(() => clients.id),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  packageName: text("package_name").notNull(),
  items: text("items").notNull(), // JSON string of items
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  validUntil: date("valid_until"),
  notes: text("notes"),
  status: text("status").notNull().default("draft"), // draft, sent, accepted, rejected
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Invoices
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull().unique(),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  quotationId: varchar("quotation_id").references(() => quotations.id),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  items: text("items").notNull(), // JSON string
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  dueDate: date("due_date").notNull(),
  status: text("status").notNull().default("draft"),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurringDay: integer("recurring_day"), // day of month for recurring
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Payments
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  method: text("method").notNull().default("bank_transfer"),
  reference: text("reference"),
  notes: text("notes"),
  receivedById: varchar("received_by_id").notNull().references(() => users.id),
  paymentDate: date("payment_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Campaigns
export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  platform: text("platform").notNull(), // facebook, google, instagram
  budget: decimal("budget", { precision: 10, scale: 2 }).notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  status: text("status").notNull().default("active"),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Activity log for audit
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id"),
  details: text("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Notifications
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("info"),
  isRead: boolean("is_read").notNull().default(false),
  link: text("link"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  leads: many(leads),
  tasks: many(tasks),
  clients: many(clients),
  followUps: many(followUps),
  notifications: many(notifications),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  owner: one(users, { fields: [leads.ownerId], references: [users.id] }),
  campaign: one(campaigns, { fields: [leads.campaignId], references: [campaigns.id] }),
  notes: many(leadNotes),
  followUps: many(followUps),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  lead: one(leads, { fields: [clients.leadId], references: [leads.id] }),
  owner: one(users, { fields: [clients.ownerId], references: [users.id] }),
  services: many(clientServices),
  invoices: many(invoices),
  tasks: many(tasks),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLeadNoteSchema = createInsertSchema(leadNotes).omit({ id: true, createdAt: true });
export const insertFollowUpSchema = createInsertSchema(followUps).omit({ id: true, createdAt: true });
export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true });
export const insertServiceSchema = createInsertSchema(services).omit({ id: true, createdAt: true });
export const insertClientServiceSchema = createInsertSchema(clientServices).omit({ id: true, createdAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, completedAt: true });
export const insertQuotationSchema = createInsertSchema(quotations).omit({ id: true, createdAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true });
export const insertCampaignSchema = createInsertSchema(campaigns).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type LeadNote = typeof leadNotes.$inferSelect;
export type InsertLeadNote = z.infer<typeof insertLeadNoteSchema>;
export type FollowUp = typeof followUps.$inferSelect;
export type InsertFollowUp = z.infer<typeof insertFollowUpSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type ClientService = typeof clientServices.$inferSelect;
export type InsertClientService = z.infer<typeof insertClientServiceSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Quotation = typeof quotations.$inferSelect;
export type InsertQuotation = z.infer<typeof insertQuotationSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
