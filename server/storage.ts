import {
  users, leads, leadNotes, followUps, clients, services, clientServices, packages,
  tasks, quotations, invoices, payments, campaigns, activityLogs, notifications,
  type User, type InsertUser, type Lead, type InsertLead, type LeadNote, type InsertLeadNote,
  type FollowUp, type InsertFollowUp, type Client, type InsertClient, type Service, type InsertService,
  type ClientService, type InsertClientService, type Package, type InsertPackage,
  type Task, type InsertTask, type Quotation, type InsertQuotation,
  type Invoice, type InsertInvoice, type Payment, type InsertPayment, type Campaign, type InsertCampaign,
  type Notification, type InsertNotification
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, like, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  
  // Leads
  getLead(id: string): Promise<Lead | undefined>;
  findLeadByMobileOrEmail(mobile: string, email?: string, excludeId?: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, lead: Partial<InsertLead>): Promise<Lead | undefined>;
  deleteLead(id: string): Promise<void>;
  getAllLeads(): Promise<Lead[]>;
  
  // Lead Notes
  getLeadNotes(leadId: string): Promise<LeadNote[]>;
  createLeadNote(note: InsertLeadNote): Promise<LeadNote>;
  
  // Follow-ups
  getFollowUp(id: string): Promise<FollowUp | undefined>;
  createFollowUp(followUp: InsertFollowUp): Promise<FollowUp>;
  updateFollowUp(id: string, followUp: Partial<InsertFollowUp>): Promise<FollowUp | undefined>;
  deleteFollowUp(id: string): Promise<void>;
  getAllFollowUps(): Promise<FollowUp[]>;
  
  // Clients
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<void>;
  getAllClients(): Promise<Client[]>;
  
  // Services
  getService(id: string): Promise<Service | undefined>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: string, service: Partial<InsertService>): Promise<Service | undefined>;
  deleteService(id: string): Promise<void>;
  getAllServices(): Promise<Service[]>;
  
  // Packages
  getPackage(id: string): Promise<Package | undefined>;
  createPackage(pkg: InsertPackage): Promise<Package>;
  updatePackage(id: string, pkg: Partial<InsertPackage>): Promise<Package | undefined>;
  deletePackage(id: string): Promise<void>;
  getAllPackages(): Promise<Package[]>;
  
  // Tasks
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<void>;
  getAllTasks(): Promise<Task[]>;
  
  // Quotations
  getQuotation(id: string): Promise<Quotation | undefined>;
  createQuotation(quotation: InsertQuotation): Promise<Quotation>;
  updateQuotation(id: string, quotation: Partial<InsertQuotation>): Promise<Quotation | undefined>;
  deleteQuotation(id: string): Promise<void>;
  getAllQuotations(): Promise<Quotation[]>;
  
  // Invoices
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<void>;
  getAllInvoices(): Promise<Invoice[]>;
  
  // Payments
  getPayment(id: string): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  deletePayment(id: string): Promise<void>;
  getAllPayments(): Promise<Payment[]>;
  
  // Campaigns
  getCampaign(id: string): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, campaign: Partial<InsertCampaign>): Promise<Campaign | undefined>;
  deleteCampaign(id: string): Promise<void>;
  getAllCampaigns(): Promise<Campaign[]>;
  
  // Client Services
  getClientServices(clientId: string): Promise<ClientService[]>;
  createClientService(clientService: InsertClientService): Promise<ClientService>;
  updateClientService(id: string, clientService: Partial<InsertClientService>): Promise<ClientService | undefined>;
  deleteClientService(id: string): Promise<void>;
  getAllClientServices(): Promise<ClientService[]>;

  // Notifications
  getNotifications(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  // Leads
  async getLead(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead || undefined;
  }

  async findLeadByMobileOrEmail(mobile: string, email?: string, excludeId?: string): Promise<Lead | undefined> {
    const allLeads = await db.select().from(leads);
    const match = allLeads.find(lead => {
      if (excludeId && lead.id === excludeId) return false;
      if (lead.mobile === mobile) return true;
      if (email && lead.email && lead.email === email) return true;
      return false;
    });
    return match;
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const [lead] = await db.insert(leads).values(insertLead).returning();
    return lead;
  }

  async updateLead(id: string, updates: Partial<InsertLead>): Promise<Lead | undefined> {
    const [lead] = await db.update(leads).set({ ...updates, updatedAt: new Date() }).where(eq(leads.id, id)).returning();
    return lead || undefined;
  }

  async deleteLead(id: string): Promise<void> {
    await db.delete(leads).where(eq(leads.id, id));
  }

  async getAllLeads(): Promise<Lead[]> {
    return db.select().from(leads).orderBy(desc(leads.createdAt));
  }

  // Lead Notes
  async getLeadNotes(leadId: string): Promise<LeadNote[]> {
    return db.select().from(leadNotes).where(eq(leadNotes.leadId, leadId)).orderBy(desc(leadNotes.createdAt));
  }

  async createLeadNote(note: InsertLeadNote): Promise<LeadNote> {
    const [created] = await db.insert(leadNotes).values(note).returning();
    return created;
  }

  // Follow-ups
  async getFollowUp(id: string): Promise<FollowUp | undefined> {
    const [followUp] = await db.select().from(followUps).where(eq(followUps.id, id));
    return followUp || undefined;
  }

  async createFollowUp(insertFollowUp: InsertFollowUp): Promise<FollowUp> {
    const data = {
      ...insertFollowUp,
      scheduledAt: new Date(insertFollowUp.scheduledAt),
    };
    const [followUp] = await db.insert(followUps).values(data).returning();
    return followUp;
  }

  async updateFollowUp(id: string, updates: Partial<InsertFollowUp>): Promise<FollowUp | undefined> {
    const updateData: any = { ...updates };
    if (updates.isCompleted) {
      updateData.completedAt = new Date();
    }
    if (updates.scheduledAt) {
      updateData.scheduledAt = new Date(updates.scheduledAt);
    }
    const [followUp] = await db.update(followUps).set(updateData).where(eq(followUps.id, id)).returning();
    return followUp || undefined;
  }

  async deleteFollowUp(id: string): Promise<void> {
    await db.delete(followUps).where(eq(followUps.id, id));
  }

  async getAllFollowUps(): Promise<FollowUp[]> {
    return db.select().from(followUps).orderBy(desc(followUps.scheduledAt));
  }

  // Clients
  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client || undefined;
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const [client] = await db.insert(clients).values(insertClient).returning();
    return client;
  }

  async updateClient(id: string, updates: Partial<InsertClient>): Promise<Client | undefined> {
    const [client] = await db.update(clients).set(updates).where(eq(clients.id, id)).returning();
    return client || undefined;
  }

  async deleteClient(id: string): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  async getAllClients(): Promise<Client[]> {
    return db.select().from(clients).orderBy(desc(clients.createdAt));
  }

  // Services
  async getService(id: string): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service || undefined;
  }

  async createService(insertService: InsertService): Promise<Service> {
    const [service] = await db.insert(services).values(insertService).returning();
    return service;
  }

  async updateService(id: string, updates: Partial<InsertService>): Promise<Service | undefined> {
    const [service] = await db.update(services).set(updates).where(eq(services.id, id)).returning();
    return service || undefined;
  }

  async deleteService(id: string): Promise<void> {
    await db.delete(services).where(eq(services.id, id));
  }

  async getAllServices(): Promise<Service[]> {
    return db.select().from(services).orderBy(desc(services.createdAt));
  }

  // Packages
  async getPackage(id: string): Promise<Package | undefined> {
    const [pkg] = await db.select().from(packages).where(eq(packages.id, id));
    return pkg || undefined;
  }

  async createPackage(insertPkg: InsertPackage): Promise<Package> {
    const [pkg] = await db.insert(packages).values(insertPkg).returning();
    return pkg;
  }

  async updatePackage(id: string, updates: Partial<InsertPackage>): Promise<Package | undefined> {
    const [pkg] = await db.update(packages).set(updates).where(eq(packages.id, id)).returning();
    return pkg || undefined;
  }

  async deletePackage(id: string): Promise<void> {
    await db.delete(packages).where(eq(packages.id, id));
  }

  async getAllPackages(): Promise<Package[]> {
    return db.select().from(packages).orderBy(desc(packages.createdAt));
  }

  // Tasks
  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task || undefined;
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(insertTask).returning();
    return task;
  }

  async updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined> {
    const updateData: any = { ...updates };
    if (updates.status === "done") {
      updateData.completedAt = new Date();
    }
    const [task] = await db.update(tasks).set(updateData).where(eq(tasks.id, id)).returning();
    return task || undefined;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async getAllTasks(): Promise<Task[]> {
    return db.select().from(tasks).orderBy(desc(tasks.createdAt));
  }

  // Quotations
  async getQuotation(id: string): Promise<Quotation | undefined> {
    const [quotation] = await db.select().from(quotations).where(eq(quotations.id, id));
    return quotation || undefined;
  }

  async createQuotation(insertQuotation: InsertQuotation): Promise<Quotation> {
    const [quotation] = await db.insert(quotations).values(insertQuotation).returning();
    return quotation;
  }

  async updateQuotation(id: string, updates: Partial<InsertQuotation>): Promise<Quotation | undefined> {
    const [quotation] = await db.update(quotations).set(updates).where(eq(quotations.id, id)).returning();
    return quotation || undefined;
  }

  async deleteQuotation(id: string): Promise<void> {
    await db.delete(quotations).where(eq(quotations.id, id));
  }

  async getAllQuotations(): Promise<Quotation[]> {
    return db.select().from(quotations).orderBy(desc(quotations.createdAt));
  }

  // Invoices
  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice || undefined;
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db.insert(invoices).values(insertInvoice).returning();
    return invoice;
  }

  async updateInvoice(id: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [invoice] = await db.update(invoices).set(updates).where(eq(invoices.id, id)).returning();
    return invoice || undefined;
  }

  async deleteInvoice(id: string): Promise<void> {
    await db.delete(invoices).where(eq(invoices.id, id));
  }

  async getAllInvoices(): Promise<Invoice[]> {
    return db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  // Payments
  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment || undefined;
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const [payment] = await db.insert(payments).values(insertPayment).returning();
    
    // Update invoice paid amount
    const invoice = await this.getInvoice(insertPayment.invoiceId);
    if (invoice) {
      const newPaidAmount = (Number(invoice.paidAmount) + Number(insertPayment.amount)).toString();
      const newStatus = Number(newPaidAmount) >= Number(invoice.total) ? "paid" : invoice.status;
      await this.updateInvoice(invoice.id, { paidAmount: newPaidAmount, status: newStatus });
    }
    
    return payment;
  }

  async deletePayment(id: string): Promise<void> {
    const payment = await this.getPayment(id);
    if (payment) {
      const invoice = await this.getInvoice(payment.invoiceId);
      if (invoice) {
        const newPaidAmount = Math.max(0, Number(invoice.paidAmount) - Number(payment.amount)).toString();
        await this.updateInvoice(invoice.id, { paidAmount: newPaidAmount, status: "sent" });
      }
    }
    await db.delete(payments).where(eq(payments.id, id));
  }

  async getAllPayments(): Promise<Payment[]> {
    return db.select().from(payments).orderBy(desc(payments.createdAt));
  }

  // Campaigns
  async getCampaign(id: string): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign || undefined;
  }

  async createCampaign(insertCampaign: InsertCampaign): Promise<Campaign> {
    const [campaign] = await db.insert(campaigns).values(insertCampaign).returning();
    return campaign;
  }

  async updateCampaign(id: string, updates: Partial<InsertCampaign>): Promise<Campaign | undefined> {
    const [campaign] = await db.update(campaigns).set(updates).where(eq(campaigns.id, id)).returning();
    return campaign || undefined;
  }

  async deleteCampaign(id: string): Promise<void> {
    await db.delete(campaigns).where(eq(campaigns.id, id));
  }

  async getAllCampaigns(): Promise<Campaign[]> {
    return db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  }

  // Client Services
  async getClientServices(clientId: string): Promise<ClientService[]> {
    return db.select().from(clientServices).where(eq(clientServices.clientId, clientId)).orderBy(desc(clientServices.createdAt));
  }

  async createClientService(clientService: InsertClientService): Promise<ClientService> {
    const [created] = await db.insert(clientServices).values(clientService).returning();
    return created;
  }

  async updateClientService(id: string, clientService: Partial<InsertClientService>): Promise<ClientService | undefined> {
    const [updated] = await db.update(clientServices).set(clientService).where(eq(clientServices.id, id)).returning();
    return updated || undefined;
  }

  async deleteClientService(id: string): Promise<void> {
    await db.delete(clientServices).where(eq(clientServices.id, id));
  }

  async getAllClientServices(): Promise<ClientService[]> {
    return db.select().from(clientServices).orderBy(desc(clientServices.createdAt));
  }

  // Notifications
  async getNotifications(userId: string): Promise<Notification[]> {
    return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async markNotificationRead(id: string): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  }
}

export const storage = new DatabaseStorage();
