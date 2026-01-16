import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setupAuth, seedAdminUser, hashPassword } from "./auth";
import { User, Lead, Client, leadSources } from "@shared/schema";
import { z } from "zod";

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

function requireRole(...roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = req.user as User;
    if (!roles.includes(user.role) && user.role !== "admin") {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}

export async function registerRoutes(server: Server, app: Express) {
  // Setup authentication
  setupAuth(app);
  
  // Seed admin user
  await seedAdminUser();

  // Lead Capture API - Public endpoint for external website forms
  const captureLeadSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    mobile: z.string().min(10, "Mobile must be at least 10 digits"),
    email: z.string().email().optional().or(z.literal("")),
    city: z.string().optional(),
    source: z.enum(leadSources).optional().default("website"),
    notes: z.string().optional(),
    campaignId: z.string().optional(),
    // UTM tracking fields
    utmSource: z.string().optional(),
    utmMedium: z.string().optional(),
    utmCampaign: z.string().optional(),
    utmContent: z.string().optional(),
    utmTerm: z.string().optional(),
  });

  app.post("/api/leads/capture", async (req, res) => {
    try {
      // Validate request body with Zod
      const parseResult = captureLeadSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: parseResult.error.errors.map(e => ({
            field: e.path.join("."),
            message: e.message
          }))
        });
      }
      
      const data = parseResult.data;
      
      // Check for duplicate lead by mobile or email
      const existingLead = await storage.findLeadByMobileOrEmail(
        data.mobile,
        data.email || undefined
      );
      
      if (existingLead) {
        return res.status(409).json({
          success: false,
          message: "A lead with this mobile number or email already exists",
          leadId: existingLead.id
        });
      }
      
      // Create the lead with proper source and UTM tracking
      const lead = await storage.createLead({
        name: data.name,
        mobile: data.mobile,
        email: data.email || null,
        city: data.city || null,
        source: data.source,
        status: "new",
        notes: data.notes || null,
        campaignId: data.campaignId || null,
        ownerId: null, // Will be assigned later by CRM user
        // UTM tracking fields
        utmSource: data.utmSource || null,
        utmMedium: data.utmMedium || null,
        utmCampaign: data.utmCampaign || null,
        utmContent: data.utmContent || null,
        utmTerm: data.utmTerm || null,
      });
      
      res.status(201).json({
        success: true,
        message: "Lead captured successfully",
        leadId: lead.id
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const leads = await storage.getAllLeads();
      const clients = await storage.getAllClients();
      const followUps = await storage.getAllFollowUps();
      const invoices = await storage.getAllInvoices();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const todayFollowUps = followUps.filter(f => {
        const scheduled = new Date(f.scheduledAt);
        return scheduled >= today && scheduled < tomorrow && !f.isCompleted;
      }).length;
      
      const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
      const pendingPayments = invoices
        .filter(inv => inv.status !== "paid" && inv.status !== "cancelled")
        .reduce((sum, inv) => sum + (Number(inv.total) - Number(inv.paidAmount)), 0);
      
      const convertedLeads = leads.filter(l => l.status === "converted").length;
      const conversionRate = leads.length > 0 ? Math.round((convertedLeads / leads.length) * 100) : 0;
      
      // Recent leads
      const recentLeads = leads.slice(0, 5).map(l => ({
        id: l.id,
        name: l.name,
        source: l.source,
        status: l.status,
        createdAt: l.createdAt,
      }));
      
      // Upcoming follow-ups
      const upcomingFollowUps = await Promise.all(
        followUps
          .filter(f => !f.isCompleted && new Date(f.scheduledAt) >= today)
          .slice(0, 5)
          .map(async f => {
            let leadName = "Unknown";
            if (f.leadId) {
              const lead = await storage.getLead(f.leadId);
              leadName = lead?.name || "Unknown";
            }
            return {
              id: f.id,
              leadName,
              scheduledAt: f.scheduledAt,
            };
          })
      );
      
      // Monthly leads
      const monthlyLeads: { month: string; count: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const month = date.toLocaleString("default", { month: "short" });
        const year = date.getFullYear();
        const monthStart = new Date(year, date.getMonth(), 1);
        const monthEnd = new Date(year, date.getMonth() + 1, 0);
        const count = leads.filter(l => {
          const created = new Date(l.createdAt);
          return created >= monthStart && created <= monthEnd;
        }).length;
        monthlyLeads.push({ month, count });
      }
      
      // Leads by source
      const sourceMap = new Map<string, number>();
      leads.forEach(l => {
        sourceMap.set(l.source, (sourceMap.get(l.source) || 0) + 1);
      });
      const leadsBySource = Array.from(sourceMap.entries()).map(([source, count]) => ({ source, count }));
      
      // Invoices due soon (within 2 days)
      const twoDaysFromNow = new Date(today);
      twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
      twoDaysFromNow.setHours(23, 59, 59, 999);
      
      const upcomingInvoices = await Promise.all(
        invoices
          .filter(inv => {
            if (inv.status === "paid" || inv.status === "cancelled") return false;
            const dueDate = new Date(inv.dueDate);
            return dueDate >= today && dueDate <= twoDaysFromNow;
          })
          .slice(0, 10)
          .map(async inv => {
            const client = await storage.getClient(inv.clientId);
            return {
              id: inv.id,
              invoiceNumber: inv.invoiceNumber,
              clientName: client?.companyName || "Unknown",
              total: inv.total,
              paidAmount: inv.paidAmount,
              dueAmount: (Number(inv.total) - Number(inv.paidAmount)).toString(),
              dueDate: inv.dueDate,
              isRecurring: inv.isRecurring,
            };
          })
      );
      
      // Team members count (non-client users)
      const allUsers = await storage.getAllUsers();
      const activeTeamMembers = allUsers.filter(u => u.role !== "client").length;
      
      // Converted leads count (leads with status="converted")
      const convertedLeadsCount = leads.filter(l => l.status === "converted").length;
      
      res.json({
        totalLeads: leads.length,
        todayFollowUps,
        convertedClients: convertedLeadsCount,
        totalRevenue,
        pendingPayments,
        conversionRate,
        activeTeamMembers,
        recentLeads,
        upcomingFollowUps,
        monthlyLeads,
        leadsBySource,
        upcomingInvoices,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Users CRUD
  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const sanitized = users.map(({ password, ...u }) => u);
      res.json(sanitized);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/users", requireRole("admin", "manager"), async (req, res) => {
    try {
      const { password, ...userData } = req.body;
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({ ...userData, password: hashedPassword });
      const { password: _, ...sanitized } = user;
      res.status(201).json(sanitized);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/users/:id", requireRole("admin", "manager"), async (req, res) => {
    try {
      const { id } = req.params;
      const { password, ...updates } = req.body;
      if (password) {
        updates.password = await hashPassword(password);
      }
      const user = await storage.updateUser(id, updates);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password: _, ...sanitized } = user;
      res.json(sanitized);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/users/:id", requireRole("admin"), async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Leads CRUD
  app.get("/api/leads", requireAuth, async (req, res) => {
    try {
      let leads = await storage.getAllLeads();
      const { search, status, source, score, sortBy, sortOrder, page, limit } = req.query;
      
      if (search && typeof search === "string") {
        const searchLower = search.toLowerCase();
        leads = leads.filter(lead => 
          lead.name.toLowerCase().includes(searchLower) ||
          lead.mobile.toLowerCase().includes(searchLower) ||
          (lead.email && lead.email.toLowerCase().includes(searchLower)) ||
          (lead.city && lead.city.toLowerCase().includes(searchLower))
        );
      }
      
      if (status && typeof status === "string" && status !== "all") {
        leads = leads.filter(lead => lead.status === status);
      }
      
      if (source && typeof source === "string" && source !== "all") {
        leads = leads.filter(lead => lead.source === source);
      }
      
      // Temperature (score) filter
      if (score && typeof score === "string" && score !== "all") {
        leads = leads.filter(lead => lead.score === score);
      }
      
      if (sortBy && typeof sortBy === "string") {
        const order = sortOrder === "asc" ? 1 : -1;
        leads.sort((a: any, b: any) => {
          if (a[sortBy] < b[sortBy]) return -1 * order;
          if (a[sortBy] > b[sortBy]) return 1 * order;
          return 0;
        });
      }
      
      const totalCount = leads.length;
      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 50;
      const startIndex = (pageNum - 1) * limitNum;
      const paginatedLeads = leads.slice(startIndex, startIndex + limitNum);
      
      res.json({
        data: paginatedLeads,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum)
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Export leads to CSV (must be before :id route)
  app.get("/api/leads/export", requireAuth, async (req, res) => {
    try {
      let leads = await storage.getAllLeads();
      
      // Apply filters
      const { status, source, search } = req.query;
      
      if (status && status !== "all") {
        leads = leads.filter(l => l.status === status);
      }
      
      if (source && source !== "all") {
        leads = leads.filter(l => l.source === source);
      }
      
      if (search && typeof search === "string") {
        const query = search.toLowerCase();
        leads = leads.filter(l => 
          l.name.toLowerCase().includes(query) ||
          l.email?.toLowerCase().includes(query) ||
          l.mobile.includes(query) ||
          l.city?.toLowerCase().includes(query)
        );
      }
      
      // Generate CSV content
      const headers = ["Name", "Email", "Mobile", "City", "Source", "Status", "Notes", "Created At"];
      const csvRows = [headers.join(",")];
      
      for (const lead of leads) {
        const row = [
          `"${(lead.name || "").replace(/"/g, '""')}"`,
          `"${(lead.email || "").replace(/"/g, '""')}"`,
          `"${(lead.mobile || "").replace(/"/g, '""')}"`,
          `"${(lead.city || "").replace(/"/g, '""')}"`,
          `"${(lead.source || "").replace(/"/g, '""')}"`,
          `"${(lead.status || "").replace(/"/g, '""')}"`,
          `"${(lead.notes || "").replace(/"/g, '""')}"`,
          `"${lead.createdAt ? new Date(lead.createdAt).toISOString() : ""}"`,
        ];
        csvRows.push(row.join(","));
      }
      
      const csvContent = csvRows.join("\n");
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="leads_export_${Date.now()}.csv"`);
      res.send(csvContent);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/leads/:id", requireAuth, async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      res.json(lead);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/leads", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const { mobile, email } = req.body;
      
      const existingLead = await storage.findLeadByMobileOrEmail(mobile, email);
      if (existingLead) {
        const duplicateField = existingLead.mobile === mobile ? "mobile number" : "email";
        return res.status(400).json({ message: `A lead with this ${duplicateField} already exists` });
      }
      
      const lead = await storage.createLead({ ...req.body, ownerId: req.body.ownerId || user.id });
      res.status(201).json(lead);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/leads/:id", requireAuth, async (req, res) => {
    try {
      const { mobile, email } = req.body;
      
      if (mobile || email) {
        const existingLead = await storage.findLeadByMobileOrEmail(mobile || "", email, req.params.id);
        if (existingLead) {
          const duplicateField = mobile && existingLead.mobile === mobile ? "mobile number" : "email";
          return res.status(400).json({ message: `A lead with this ${duplicateField} already exists` });
        }
      }
      
      const lead = await storage.updateLead(req.params.id, req.body);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      res.json(lead);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/leads/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteLead(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Bulk Import leads via CSV
  app.post("/api/leads/import", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const { csvData } = req.body;
      
      if (!csvData || !Array.isArray(csvData)) {
        return res.status(400).json({ message: "Invalid CSV data" });
      }
      
      const results = {
        success: [] as any[],
        failed: [] as { row: number; data: any; error: string }[],
        total: csvData.length,
      };
      
      const validSources = ["facebook", "instagram", "google", "website", "referral"];
      const validStatuses = ["new", "interested", "follow_up", "converted", "not_interested"];
      
      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        const rowNum = i + 1;
        
        // Validate required fields
        if (!row.name || typeof row.name !== "string" || row.name.trim().length < 2) {
          results.failed.push({ row: rowNum, data: row, error: "Name is required (min 2 characters)" });
          continue;
        }
        
        if (!row.mobile || typeof row.mobile !== "string" || row.mobile.trim().length < 10) {
          results.failed.push({ row: rowNum, data: row, error: "Mobile is required (min 10 digits)" });
          continue;
        }
        
        // Validate optional fields
        const source = row.source && validSources.includes(row.source.toLowerCase()) 
          ? row.source.toLowerCase() 
          : "website";
        const status = row.status && validStatuses.includes(row.status.toLowerCase()) 
          ? row.status.toLowerCase() 
          : "new";
        
        // Check for duplicates
        const existingLead = await storage.findLeadByMobileOrEmail(row.mobile.trim(), row.email?.trim());
        if (existingLead) {
          results.failed.push({ row: rowNum, data: row, error: "Duplicate lead (mobile or email already exists)" });
          continue;
        }
        
        try {
          const lead = await storage.createLead({
            name: row.name.trim(),
            email: row.email?.trim() || null,
            mobile: row.mobile.trim(),
            city: row.city?.trim() || null,
            source,
            status,
            notes: row.notes?.trim() || null,
            ownerId: user.id,
          });
          results.success.push({ row: rowNum, lead });
        } catch (err: any) {
          results.failed.push({ row: rowNum, data: row, error: err.message });
        }
      }
      
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Follow-ups CRUD
  app.get("/api/follow-ups", requireAuth, async (req, res) => {
    try {
      const followUps = await storage.getAllFollowUps();
      const withLeads = await Promise.all(
        followUps.map(async f => {
          let lead: Lead | undefined;
          if (f.leadId) {
            lead = await storage.getLead(f.leadId);
          }
          return { ...f, lead };
        })
      );
      res.json(withLeads);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ICS Export for Google Calendar
  app.get("/api/follow-ups/export/ics", requireAuth, async (req, res) => {
    try {
      const followUps = await storage.getAllFollowUps();
      
      // Filter to only upcoming/pending follow-ups
      const pendingFollowUps = followUps.filter(f => !f.isCompleted);
      
      // Build ICS file content
      const icsLines: string[] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//MarketPro CRM//Follow-ups//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
      ];
      
      for (const followUp of pendingFollowUps) {
        // Get lead/client info for event title
        let contactName = "Contact";
        let contactPhone = "";
        
        if (followUp.leadId) {
          const lead = await storage.getLead(followUp.leadId);
          if (lead) {
            contactName = lead.name;
            contactPhone = lead.mobile || "";
          }
        } else if (followUp.clientId) {
          const client = await storage.getClient(followUp.clientId);
          if (client) {
            contactName = client.contactName;
            contactPhone = client.phone || "";
          }
        }
        
        const scheduledDate = new Date(followUp.scheduledAt);
        const endDate = new Date(scheduledDate.getTime() + 30 * 60 * 1000); // 30 min duration
        
        // Format dates for ICS (YYYYMMDDTHHMMSSZ)
        const formatICSDate = (date: Date) => {
          return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
        };
        
        // Escape special characters per RFC5545
        const escapeICS = (text: string) => {
          return text
            .replace(/\\/g, "\\\\")
            .replace(/;/g, "\\;")
            .replace(/,/g, "\\,")
            .replace(/\n/g, "\\n");
        };
        
        const title = contactPhone 
          ? `Follow-up: ${contactName} (${contactPhone})`
          : `Follow-up: ${contactName}`;
        
        const description = followUp.notes 
          ? escapeICS(followUp.notes)
          : "";
        
        icsLines.push("BEGIN:VEVENT");
        icsLines.push(`UID:${followUp.id}@marketpro-crm`);
        icsLines.push(`DTSTAMP:${formatICSDate(new Date())}`);
        icsLines.push(`DTSTART:${formatICSDate(scheduledDate)}`);
        icsLines.push(`DTEND:${formatICSDate(endDate)}`);
        icsLines.push(`SUMMARY:${escapeICS(title)}`);
        if (description) {
          icsLines.push(`DESCRIPTION:${description}`);
        }
        icsLines.push("STATUS:CONFIRMED");
        icsLines.push("END:VEVENT");
      }
      
      icsLines.push("END:VCALENDAR");
      
      const icsContent = icsLines.join("\r\n");
      
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=follow-ups.ics");
      res.send(icsContent);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/follow-ups", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const followUp = await storage.createFollowUp({ ...req.body, userId: user.id });
      
      let leadName = "a lead";
      if (req.body.leadId) {
        const lead = await storage.getLead(req.body.leadId);
        if (lead) {
          leadName = lead.name;
          // Update lastActivityAt and recalculate score
          await storage.updateLead(lead.id, { lastActivityAt: new Date() });
        }
      }
      
      await storage.createNotification({
        userId: user.id,
        title: "Follow-up Scheduled",
        message: `Follow-up with ${leadName} scheduled for ${new Date(req.body.scheduledAt).toLocaleString()}`,
        type: "follow_up",
        link: `/follow-ups`,
      });
      
      res.status(201).json(followUp);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/follow-ups/:id", requireAuth, async (req, res) => {
    try {
      const followUp = await storage.updateFollowUp(req.params.id, req.body);
      if (!followUp) {
        return res.status(404).json({ message: "Follow-up not found" });
      }
      res.json(followUp);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/follow-ups/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteFollowUp(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Clients CRUD
  app.get("/api/clients", requireAuth, async (req, res) => {
    try {
      const clients = await storage.getAllClients();
      res.json(clients);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/clients/:id", requireAuth, async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/clients", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const client = await storage.createClient({ ...req.body, ownerId: req.body.ownerId || user.id });
      res.status(201).json(client);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/clients/:id", requireAuth, async (req, res) => {
    try {
      const client = await storage.updateClient(req.params.id, req.body);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/clients/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteClient(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Services CRUD
  app.get("/api/services", requireAuth, async (req, res) => {
    try {
      const services = await storage.getAllServices();
      res.json(services);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/services", requireRole("admin", "manager"), async (req, res) => {
    try {
      const service = await storage.createService(req.body);
      res.status(201).json(service);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/services/:id", requireRole("admin", "manager"), async (req, res) => {
    try {
      const service = await storage.updateService(req.params.id, req.body);
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }
      res.json(service);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/services/:id", requireRole("admin"), async (req, res) => {
    try {
      await storage.deleteService(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Seed default services
  app.post("/api/services/seed", requireRole("admin"), async (req, res) => {
    try {
      const existingServices = await storage.getAllServices();
      if (existingServices.length > 0) {
        return res.json({ message: "Services already seeded", count: existingServices.length });
      }

      const defaultServices = [
        { name: "Facebook Ads", description: "Facebook advertising campaign management", basePrice: "15000" },
        { name: "Google Ads", description: "Google Ads campaign setup and optimization", basePrice: "20000" },
        { name: "SEO", description: "Search engine optimization services", basePrice: "25000" },
        { name: "Website Design", description: "Custom website design and development", basePrice: "50000" },
        { name: "Social Media Management", description: "Complete social media management", basePrice: "18000" },
        { name: "Content Writing", description: "Professional content writing services", basePrice: "10000" },
      ];

      const createdServices = [];
      for (const service of defaultServices) {
        const created = await storage.createService(service);
        createdServices.push(created);
      }

      res.status(201).json({ message: "Services seeded successfully", services: createdServices });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Packages CRUD
  app.get("/api/packages", requireAuth, async (req, res) => {
    try {
      const packages = await storage.getAllPackages();
      res.json(packages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/packages", requireRole("admin", "manager"), async (req, res) => {
    try {
      const pkg = await storage.createPackage(req.body);
      res.status(201).json(pkg);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/packages/:id", requireRole("admin", "manager"), async (req, res) => {
    try {
      const pkg = await storage.updatePackage(req.params.id, req.body);
      if (!pkg) {
        return res.status(404).json({ message: "Package not found" });
      }
      res.json(pkg);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/packages/:id", requireRole("admin"), async (req, res) => {
    try {
      await storage.deletePackage(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Seed default packages
  app.post("/api/packages/seed", requireRole("admin"), async (req, res) => {
    try {
      const existingPackages = await storage.getAllPackages();
      if (existingPackages.length > 0) {
        return res.json({ message: "Packages already seeded", count: existingPackages.length });
      }

      const defaultPackages = [
        { 
          name: "Basic", 
          description: "Essential digital marketing services", 
          price: "15000",
          features: JSON.stringify(["Social Media Setup", "Basic SEO", "Monthly Report"])
        },
        { 
          name: "Standard", 
          description: "Comprehensive marketing solution", 
          price: "30000",
          features: JSON.stringify(["Facebook Ads", "Google Ads", "SEO Optimization", "Weekly Reports", "Content Calendar"])
        },
        { 
          name: "Premium", 
          description: "Complete digital transformation", 
          price: "50000",
          features: JSON.stringify(["All Standard Features", "Website Design", "24/7 Support", "Dedicated Manager", "Advanced Analytics"])
        },
      ];

      const createdPackages = [];
      for (const pkg of defaultPackages) {
        const created = await storage.createPackage(pkg);
        createdPackages.push(created);
      }

      res.status(201).json({ message: "Packages seeded successfully", packages: createdPackages });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Client Services CRUD
  app.get("/api/client-services", requireAuth, async (req, res) => {
    try {
      const clientId = req.query.clientId as string;
      if (clientId) {
        const clientServices = await storage.getClientServices(clientId);
        // Get service details for each client service
        const withServices = await Promise.all(
          clientServices.map(async (cs) => {
            const service = await storage.getService(cs.serviceId);
            return { ...cs, service };
          })
        );
        res.json(withServices);
      } else {
        const allClientServices = await storage.getAllClientServices();
        const withServices = await Promise.all(
          allClientServices.map(async (cs) => {
            const service = await storage.getService(cs.serviceId);
            const client = await storage.getClient(cs.clientId);
            return { ...cs, service, client };
          })
        );
        res.json(withServices);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/client-services", requireAuth, async (req, res) => {
    try {
      const { clientId, serviceId, status = "active" } = req.body;
      
      // Get the service to fetch its default price
      const service = await storage.getService(serviceId);
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }
      
      const clientService = await storage.createClientService({
        clientId,
        serviceId,
        status,
        price: req.body.price || service.basePrice,
      });
      res.status(201).json(clientService);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/client-services/:id", requireAuth, async (req, res) => {
    try {
      const clientService = await storage.updateClientService(req.params.id, req.body);
      if (!clientService) {
        return res.status(404).json({ message: "Client service not found" });
      }
      res.json(clientService);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/client-services/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteClientService(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Convert Lead to Client
  app.post("/api/leads/:id/convert", requireAuth, async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      // Check if lead is already converted
      if (lead.status === "converted") {
        return res.status(400).json({ message: "Lead is already converted to a client" });
      }

      // Create client from lead data
      const clientData = {
        leadId: lead.id,
        companyName: req.body.companyName || lead.name,
        contactName: lead.name,
        email: lead.email || "",
        phone: lead.mobile,
        city: lead.city || "",
        ownerId: lead.ownerId,
        contractStartDate: req.body.contractStartDate,
        contractEndDate: req.body.contractEndDate,
      };

      const client = await storage.createClient(clientData);

      // Update lead status to converted
      await storage.updateLead(lead.id, { status: "converted" });

      res.status(201).json(client);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Tasks CRUD
  app.get("/api/tasks", requireAuth, async (req, res) => {
    try {
      const tasks = await storage.getAllTasks();
      const withRelations = await Promise.all(
        tasks.map(async t => {
          let assignee;
          let lead;
          let client;
          
          if (t.assigneeId) {
            const user = await storage.getUser(t.assigneeId);
            if (user) {
              const { password, ...sanitized } = user;
              assignee = sanitized;
            }
          }
          
          if (t.leadId) {
            lead = await storage.getLead(t.leadId);
          }
          
          if (t.clientId) {
            client = await storage.getClient(t.clientId);
          }
          
          return { ...t, assignee, lead, client };
        })
      );
      res.json(withRelations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/tasks", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const task = await storage.createTask({ ...req.body, creatorId: user.id });
      res.status(201).json(task);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const task = await storage.updateTask(req.params.id, req.body);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(task);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteTask(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Quotations CRUD
  app.get("/api/quotations", requireAuth, async (req, res) => {
    try {
      const quotations = await storage.getAllQuotations();
      const withRelations = await Promise.all(
        quotations.map(async q => {
          let lead, client;
          if (q.leadId) lead = await storage.getLead(q.leadId);
          if (q.clientId) client = await storage.getClient(q.clientId);
          return { ...q, lead, client };
        })
      );
      res.json(withRelations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/quotations", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const count = (await storage.getAllQuotations()).length + 1;
      const quotationNumber = `QT-${new Date().getFullYear()}-${String(count).padStart(4, "0")}`;
      const quotation = await storage.createQuotation({
        ...req.body,
        quotationNumber,
        createdById: user.id,
      });
      res.status(201).json(quotation);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/quotations/:id", requireAuth, async (req, res) => {
    try {
      const quotation = await storage.updateQuotation(req.params.id, req.body);
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }
      res.json(quotation);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/quotations/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteQuotation(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Quotation PDF
  app.get("/api/quotations/:id/pdf", requireAuth, async (req, res) => {
    try {
      const quotation = await storage.getQuotation(req.params.id);
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }
      const client = quotation.clientId ? await storage.getClient(quotation.clientId) : null;
      const lead = quotation.leadId ? await storage.getLead(quotation.leadId) : null;
      
      const formatCurrency = (amount: string | number) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(amount) || 0);
      };
      
      // Parse items - could be JSON string or already parsed
      let items: any[] = [];
      try {
        items = typeof quotation.items === 'string' ? JSON.parse(quotation.items) : quotation.items;
        if (!Array.isArray(items)) items = [];
      } catch { items = []; }
      
      const itemsHtml = items.map((item: any) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${item.description || item.name || 'Item'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity || 1}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatCurrency(item.price || item.unitPrice || 0)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatCurrency((item.quantity || 1) * (item.price || item.unitPrice || 0))}</td>
        </tr>
      `).join('');
      
      // Get recipient name from client or lead
      const recipientName = client?.companyName || client?.contactName || lead?.name || 'N/A';
      const recipientEmail = client?.email || lead?.email || '';
      const recipientPhone = client?.phone || lead?.mobile || '';

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Quotation ${quotation.quotationNumber}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #1a202c; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
            .company { font-size: 24px; font-weight: bold; color: #2563eb; }
            .quotation-title { font-size: 32px; font-weight: bold; color: #1e40af; margin-bottom: 8px; }
            .quotation-number { color: #64748b; font-size: 14px; }
            .details { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .details-section { flex: 1; }
            .details-section h3 { color: #64748b; font-size: 12px; text-transform: uppercase; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #f1f5f9; padding: 12px; text-align: left; font-weight: 600; color: #475569; }
            .totals { text-align: right; }
            .totals-row { display: flex; justify-content: flex-end; padding: 8px 0; }
            .totals-label { width: 150px; color: #64748b; }
            .totals-value { width: 150px; text-align: right; font-weight: 600; }
            .grand-total { font-size: 18px; color: #1e40af; border-top: 2px solid #e2e8f0; padding-top: 12px; }
            .notes { background: #f8fafc; padding: 20px; border-radius: 8px; margin-top: 30px; }
            .notes h3 { color: #64748b; font-size: 12px; text-transform: uppercase; margin-bottom: 8px; }
            .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px; }
            .package-badge { background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 4px; font-weight: 600; display: inline-block; margin-top: 8px; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="company">MarketPro CRM</div>
              <div style="color: #64748b; font-size: 14px;">Digital Marketing Solutions</div>
            </div>
            <div style="text-align: right;">
              <div class="quotation-title">QUOTATION</div>
              <div class="quotation-number">${quotation.quotationNumber}</div>
              <div class="package-badge">${quotation.packageName}</div>
            </div>
          </div>
          
          <div class="details">
            <div class="details-section">
              <h3>Bill To</h3>
              <div style="font-weight: 600;">${recipientName}</div>
              <div style="color: #64748b;">${recipientEmail}</div>
              <div style="color: #64748b;">${recipientPhone}</div>
            </div>
            <div class="details-section" style="text-align: right;">
              <h3>Details</h3>
              <div><strong>Date:</strong> ${new Date(quotation.createdAt).toLocaleDateString('en-IN')}</div>
              <div><strong>Valid Until:</strong> ${quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString('en-IN') : 'N/A'}</div>
              <div><strong>Status:</strong> ${quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}</div>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Unit Price</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml || '<tr><td colspan="4" style="padding: 12px; text-align: center; color: #64748b;">No items</td></tr>'}
            </tbody>
          </table>
          
          <div class="totals">
            <div class="totals-row">
              <span class="totals-label">Subtotal:</span>
              <span class="totals-value">${formatCurrency(quotation.subtotal)}</span>
            </div>
            <div class="totals-row">
              <span class="totals-label">Tax:</span>
              <span class="totals-value">${formatCurrency(quotation.tax)}</span>
            </div>
            <div class="totals-row grand-total">
              <span class="totals-label">Total:</span>
              <span class="totals-value">${formatCurrency(quotation.total)}</span>
            </div>
          </div>
          
          ${quotation.notes ? `
          <div class="notes">
            <h3>Notes</h3>
            <p style="margin: 0; color: #475569;">${quotation.notes}</p>
          </div>
          ` : ''}
          
          <div class="footer">
            <p>Thank you for your business!</p>
            <p>Generated by MarketPro CRM</p>
          </div>
        </body>
        </html>
      `;
      
      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Email quotation (placeholder)
  app.post("/api/quotations/:id/email", requireAuth, async (req, res) => {
    try {
      const quotation = await storage.getQuotation(req.params.id);
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }
      
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email address is required" });
      }
      
      // In production, integrate with email service like SendGrid, Nodemailer, etc.
      // For now, log and return success
      console.log(`[Email] Sending quotation ${quotation.quotationNumber} to ${email}`);
      
      // Update quotation status to 'sent' if it's a draft
      if (quotation.status === 'draft') {
        await storage.updateQuotation(quotation.id, { status: 'sent' });
      }
      
      res.json({ 
        success: true, 
        message: `Quotation ${quotation.quotationNumber} sent to ${email}`,
        note: "Email functionality placeholder - integrate with email service for production"
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Invoices CRUD
  app.get("/api/invoices", requireAuth, async (req, res) => {
    try {
      const invoices = await storage.getAllInvoices();
      const withClients = await Promise.all(
        invoices.map(async inv => {
          const client = await storage.getClient(inv.clientId);
          return { ...inv, client };
        })
      );
      res.json(withClients);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/invoices", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const count = (await storage.getAllInvoices()).length + 1;
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count).padStart(4, "0")}`;
      const invoice = await storage.createInvoice({
        ...req.body,
        invoiceNumber,
        createdById: user.id,
        paidAmount: "0",
      });
      res.status(201).json(invoice);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/invoices/:id", requireAuth, async (req, res) => {
    try {
      const invoice = await storage.updateInvoice(req.params.id, req.body);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/invoices/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteInvoice(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Invoice PDF generation
  app.get("/api/invoices/:id/pdf", requireAuth, async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      const client = await storage.getClient(invoice.clientId);
      
      const formatCurrency = (amount: string | number) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(amount) || 0);
      };
      
      let items: any[] = [];
      try {
        items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
        if (!Array.isArray(items)) items = [];
      } catch { items = []; }
      
      const itemsHtml = items.map((item: any) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${item.description || item.name || 'Item'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity || 1}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatCurrency(item.price || item.unitPrice || 0)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatCurrency((item.quantity || 1) * (item.price || item.unitPrice || 0))}</td>
        </tr>
      `).join('');

      const dueAmount = Number(invoice.total) - Number(invoice.paidAmount);
      const statusColor = invoice.status === 'paid' ? '#10b981' : invoice.status === 'overdue' ? '#ef4444' : '#3b82f6';

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Invoice ${invoice.invoiceNumber}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #1a202c; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
            .company { font-size: 24px; font-weight: bold; color: #2563eb; }
            .invoice-title { font-size: 32px; font-weight: bold; color: #1e40af; margin-bottom: 8px; }
            .invoice-number { color: #64748b; font-size: 14px; }
            .status-badge { background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 4px; font-weight: 600; text-transform: uppercase; font-size: 12px; }
            .details { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .details-section { flex: 1; }
            .details-section h3 { color: #64748b; font-size: 12px; text-transform: uppercase; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #f1f5f9; padding: 12px; text-align: left; font-weight: 600; color: #475569; }
            .totals { text-align: right; }
            .totals-row { display: flex; justify-content: flex-end; padding: 8px 0; }
            .totals-label { width: 150px; color: #64748b; }
            .totals-value { width: 150px; text-align: right; font-weight: 600; }
            .grand-total { font-size: 18px; color: #1e40af; border-top: 2px solid #e2e8f0; padding-top: 12px; }
            .due-amount { font-size: 16px; color: ${dueAmount > 0 ? '#ef4444' : '#10b981'}; }
            .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="company">MarketPro CRM</div>
              <p style="color: #64748b; font-size: 14px;">Digital Marketing Agency</p>
            </div>
            <div style="text-align: right;">
              <div class="invoice-title">INVOICE</div>
              <div class="invoice-number">${invoice.invoiceNumber}</div>
              <span class="status-badge">${invoice.status.toUpperCase()}</span>
            </div>
          </div>
          
          <div class="details">
            <div class="details-section">
              <h3>Bill To</h3>
              <p style="font-weight: 600; margin: 0;">${client?.companyName || 'N/A'}</p>
              <p style="margin: 4px 0; color: #64748b;">${client?.contactName || ''}</p>
              <p style="margin: 4px 0; color: #64748b;">${client?.email || ''}</p>
              <p style="margin: 4px 0; color: #64748b;">${client?.phone || ''}</p>
            </div>
            <div class="details-section" style="text-align: right;">
              <h3>Invoice Details</h3>
              <p style="margin: 4px 0;"><strong>Date:</strong> ${new Date(invoice.createdAt).toLocaleDateString()}</p>
              <p style="margin: 4px 0;"><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
              ${invoice.isRecurring ? `<p style="margin: 4px 0;"><strong>Recurring:</strong> Day ${invoice.recurringDay} of month</p>` : ''}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Unit Price</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-row">
              <span class="totals-label">Subtotal:</span>
              <span class="totals-value">${formatCurrency(invoice.subtotal)}</span>
            </div>
            <div class="totals-row">
              <span class="totals-label">Tax:</span>
              <span class="totals-value">${formatCurrency(invoice.tax)}</span>
            </div>
            <div class="totals-row grand-total">
              <span class="totals-label">Total:</span>
              <span class="totals-value">${formatCurrency(invoice.total)}</span>
            </div>
            <div class="totals-row">
              <span class="totals-label">Paid:</span>
              <span class="totals-value">${formatCurrency(invoice.paidAmount)}</span>
            </div>
            <div class="totals-row due-amount">
              <span class="totals-label">Balance Due:</span>
              <span class="totals-value">${formatCurrency(dueAmount)}</span>
            </div>
          </div>

          <div class="footer">
            <p>Thank you for your business!</p>
            <p>Generated on ${new Date().toLocaleDateString()}</p>
          </div>
        </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `inline; filename="invoice-${invoice.invoiceNumber}.html"`);
      res.send(html);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Payments CRUD
  app.get("/api/payments", requireAuth, async (req, res) => {
    try {
      const payments = await storage.getAllPayments();
      const withInvoices = await Promise.all(
        payments.map(async p => {
          const invoice = await storage.getInvoice(p.invoiceId);
          let client;
          if (invoice) {
            client = await storage.getClient(invoice.clientId);
          }
          return { ...p, invoice: invoice ? { ...invoice, client } : undefined };
        })
      );
      res.json(withInvoices);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/payments", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const { invoiceId, amount } = req.body;
      
      // Validate payment amount
      if (!invoiceId || !amount || Number(amount) <= 0) {
        return res.status(400).json({ message: "Invalid payment amount" });
      }
      
      // Check invoice exists and calculate due amount
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      const dueAmount = Number(invoice.total) - Number(invoice.paidAmount);
      if (dueAmount <= 0) {
        return res.status(400).json({ message: "Invoice is already fully paid" });
      }
      
      // Clamp payment to due amount (prevent overpayment)
      const paymentAmount = Math.min(Number(amount), dueAmount);
      
      const payment = await storage.createPayment({
        ...req.body,
        amount: paymentAmount.toString(),
        receivedById: user.id,
      });
      res.status(201).json(payment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/payments/:id", requireAuth, async (req, res) => {
    try {
      await storage.deletePayment(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Campaigns CRUD
  app.get("/api/campaigns", requireAuth, async (req, res) => {
    try {
      const campaigns = await storage.getAllCampaigns();
      const leads = await storage.getAllLeads();
      const withStats = campaigns.map(c => {
        const campaignLeads = leads.filter(l => l.campaignId === c.id);
        return {
          ...c,
          leadsCount: campaignLeads.length,
          conversions: campaignLeads.filter(l => l.status === "converted").length,
        };
      });
      res.json(withStats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/campaigns", requireRole("admin", "manager"), async (req, res) => {
    try {
      const user = req.user as User;
      const campaign = await storage.createCampaign({ ...req.body, createdById: user.id });
      res.status(201).json(campaign);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/campaigns/:id", requireRole("admin", "manager"), async (req, res) => {
    try {
      const campaign = await storage.updateCampaign(req.params.id, req.body);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/campaigns/:id", requireRole("admin"), async (req, res) => {
    try {
      await storage.deleteCampaign(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Notifications
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const notifications = await storage.getNotifications(user.id);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      await storage.markNotificationRead(req.params.id);
      res.json({ message: "Notification marked as read" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Client Portal
  app.get("/api/portal/data", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      
      // Find client record linked to this user (via email or direct lookup)
      const clients = await storage.getAllClients();
      const clientServices = await storage.getAllClientServices();
      const allInvoices = await storage.getAllInvoices();
      const allQuotations = await storage.getAllQuotations();
      
      // Find clients where user email matches client email, or user is owner
      const userClients = clients.filter(c => 
        c.email === user.email || c.ownerId === user.id
      );
      const clientIds = userClients.map(c => c.id);
      
      // Filter invoices and quotations for this client
      const invoices = allInvoices.filter(inv => clientIds.includes(inv.clientId));
      const quotations = allQuotations.filter(q => q.clientId && clientIds.includes(q.clientId));
      
      // Calculate totals
      const totalSpent = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
      const pendingPayments = invoices
        .filter(inv => inv.status !== "paid" && inv.status !== "cancelled")
        .reduce((sum, inv) => sum + (Number(inv.total) - Number(inv.paidAmount)), 0);
      const activeServices = clientServices.filter(cs => 
        clientIds.includes(cs.clientId) && cs.status === "active"
      ).length;
      
      res.json({
        invoices,
        quotations,
        totalSpent,
        pendingPayments,
        activeServices,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Reports
  app.get("/api/reports", requireAuth, async (req, res) => {
    try {
      const leads = await storage.getAllLeads();
      const clients = await storage.getAllClients();
      const invoices = await storage.getAllInvoices();
      const users = await storage.getAllUsers();
      
      // Monthly leads
      const monthlyLeads: { month: string; leads: number; conversions: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const month = date.toLocaleString("default", { month: "short" });
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        const monthLeads = leads.filter(l => {
          const created = new Date(l.createdAt);
          return created >= monthStart && created <= monthEnd;
        });
        monthlyLeads.push({
          month,
          leads: monthLeads.length,
          conversions: monthLeads.filter(l => l.status === "converted").length,
        });
      }
      
      // Leads by source
      const sourceMap = new Map<string, number>();
      leads.forEach(l => sourceMap.set(l.source, (sourceMap.get(l.source) || 0) + 1));
      const leadsBySource = Array.from(sourceMap.entries()).map(([source, count]) => ({ source, count }));
      
      // Leads by status
      const statusMap = new Map<string, number>();
      leads.forEach(l => statusMap.set(l.status, (statusMap.get(l.status) || 0) + 1));
      const leadsByStatus = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));
      
      // Revenue by month
      const revenueByMonth: { month: string; revenue: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const month = date.toLocaleString("default", { month: "short" });
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        const revenue = invoices
          .filter(inv => {
            const created = new Date(inv.createdAt);
            return created >= monthStart && created <= monthEnd;
          })
          .reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
        revenueByMonth.push({ month, revenue });
      }
      
      // Team performance
      const teamPerformance = users
        .filter(u => u.role !== "client")
        .map(u => {
          const userLeads = leads.filter(l => l.ownerId === u.id);
          return {
            name: u.name,
            leads: userLeads.length,
            conversions: userLeads.filter(l => l.status === "converted").length,
          };
        });
      
      const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
      const convertedCount = leads.filter(l => l.status === "converted").length;
      const conversionRate = leads.length > 0 ? Math.round((convertedCount / leads.length) * 100) : 0;
      
      res.json({
        monthlyLeads,
        leadsBySource,
        leadsByStatus,
        revenueByMonth,
        teamPerformance,
        totalLeads: leads.length,
        totalClients: clients.length,
        totalRevenue,
        conversionRate,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // CSV Export
  app.get("/api/reports/export", requireAuth, async (req, res) => {
    try {
      const { type } = req.query;
      
      if (type === "leads") {
        const leads = await storage.getAllLeads();
        const csv = [
          "Name,Email,Mobile,City,Source,Status,Created At",
          ...leads.map(l => 
            `"${l.name}","${l.email || ""}","${l.mobile}","${l.city || ""}","${l.source}","${l.status}","${l.createdAt}"`
          ),
        ].join("\n");
        
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=leads.csv");
        res.send(csv);
      } else {
        res.status(400).json({ message: "Invalid export type" });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==========================================
  // ADVANCED FEATURES APIs
  // ==========================================

  // AI Lead Scoring - Calculate score based on engagement signals
  function calculateLeadScore(
    lead: Lead, 
    followUps: any[], 
    notes: any[], 
    callLogs: any[] = []
  ): { score: string; leadScore: number; reason: string } {
    let points = 50; // Start at neutral
    const reasons: string[] = [];

    // 1. Call/WhatsApp interactions count
    const callCount = callLogs.filter(c => c.leadId === lead.id).length;
    const whatsappNotes = notes.filter(n => n.type === "whatsapp" || n.type === "call").length;
    const totalInteractions = callCount + whatsappNotes;
    
    if (totalInteractions >= 5) { points += 20; reasons.push(`${totalInteractions} interactions`); }
    else if (totalInteractions >= 2) { points += 10; reasons.push(`${totalInteractions} interactions`); }
    else if (totalInteractions > 0) { points += 5; reasons.push("Has interaction"); }

    // 2. Budget match (if budget exists)
    if (lead.budget) {
      const budgetVal = parseFloat(lead.budget.toString());
      if (budgetVal >= 50000) { points += 25; reasons.push("High budget"); }
      else if (budgetVal >= 20000) { points += 15; reasons.push("Good budget"); }
      else if (budgetVal >= 5000) { points += 10; reasons.push("Has budget"); }
    }

    // 3. Interest level
    if (lead.interestLevel === "high") { points += 20; reasons.push("High interest"); }
    else if (lead.interestLevel === "medium") { points += 10; reasons.push("Medium interest"); }
    else if (lead.interestLevel === "low") { points -= 10; reasons.push("Low interest"); }

    // 4. Last activity time (recent activity increases score)
    const lastActivity = lead.lastActivityAt ? new Date(lead.lastActivityAt) : new Date(lead.createdAt);
    const daysSinceActivity = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceActivity <= 1) { points += 20; reasons.push("Active today"); }
    else if (daysSinceActivity <= 3) { points += 15; reasons.push("Active recently"); }
    else if (daysSinceActivity <= 7) { points += 10; reasons.push("Active this week"); }
    else if (daysSinceActivity > 30) { points -= 15; reasons.push("Inactive >30d"); }

    // 5. Engagement signals
    if (lead.email) { points += 5; reasons.push("Has email"); }
    if (lead.city) { points += 3; reasons.push("Location provided"); }
    
    // 6. Source quality
    if (lead.source === "referral") { points += 15; reasons.push("Referral"); }
    else if (lead.source === "google") { points += 10; reasons.push("Google"); }
    else if (lead.source === "website") { points += 8; reasons.push("Website"); }
    
    // 7. Pipeline progress
    if (lead.pipelineStage === "negotiation") { points += 25; reasons.push("Negotiation"); }
    else if (lead.pipelineStage === "proposal_sent") { points += 20; reasons.push("Proposal sent"); }
    else if (lead.pipelineStage === "qualified") { points += 15; reasons.push("Qualified"); }
    else if (lead.pipelineStage === "contacted") { points += 5; reasons.push("Contacted"); }
    
    // 8. Status signals
    if (lead.status === "interested") { points += 15; reasons.push("Interested"); }
    else if (lead.status === "converted") { points += 30; reasons.push("Converted"); }
    else if (lead.status === "not_interested") { points -= 30; reasons.push("Not interested"); }
    
    // 9. Follow-up engagement
    const completedFollowUps = followUps.filter(f => f.isCompleted).length;
    if (completedFollowUps >= 3) { points += 15; reasons.push(`${completedFollowUps} completed follow-ups`); }
    else if (completedFollowUps > 0) { points += 8; reasons.push("Has follow-ups"); }

    // Clamp points to 0-100
    const leadScore = Math.max(0, Math.min(100, points));

    // Determine temperature tier
    let score: string;
    if (leadScore >= 70) score = "hot";
    else if (leadScore >= 40) score = "warm";
    else score = "cold";

    return { score, leadScore, reason: reasons.slice(0, 4).join(", ") };
  }

  // Recalculate lead score endpoint
  app.post("/api/leads/:id/score", requireAuth, requireRole("admin", "manager", "sales"), async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      const followUps = await storage.getAllFollowUps();
      const leadFollowUps = followUps.filter(f => f.leadId === lead.id);
      const notes = await storage.getLeadNotes(lead.id);
      const callLogs = await storage.getCallLogs();
      const leadCallLogs = callLogs.filter(c => c.leadId === lead.id);

      const { score, leadScore, reason } = calculateLeadScore(lead, leadFollowUps, notes, leadCallLogs);
      
      const updated = await storage.updateLead(lead.id, { score, leadScore, scoreReason: reason });
      
      // Log activity
      await storage.createActivityLog({
        userId: (req.user as User).id,
        action: "score_updated",
        entityType: "lead",
        entityId: lead.id,
        details: `Score changed to ${score}: ${reason}`,
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Bulk score all leads
  app.post("/api/leads/score-all", requireAuth, requireRole("admin", "manager"), async (req, res) => {
    try {
      const leads = await storage.getAllLeads();
      const followUps = await storage.getAllFollowUps();
      const callLogs = await storage.getCallLogs();
      let updated = 0;

      for (const lead of leads) {
        const leadFollowUps = followUps.filter(f => f.leadId === lead.id);
        const notes = await storage.getLeadNotes(lead.id);
        const leadCallLogs = callLogs.filter(c => c.leadId === lead.id);
        const { score, leadScore, reason } = calculateLeadScore(lead, leadFollowUps, notes, leadCallLogs);
        await storage.updateLead(lead.id, { score, leadScore, scoreReason: reason });
        updated++;
      }

      res.json({ message: `Scored ${updated} leads`, count: updated });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==========================================
  // AUTOMATION RULES
  // ==========================================
  
  app.get("/api/automation-rules", requireAuth, requireRole("admin", "manager"), async (req, res) => {
    try {
      const rules = await storage.getAllAutomationRules();
      res.json(rules);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const automationRuleSchema = z.object({
    name: z.string().min(1, "Name is required"),
    trigger: z.string().min(1, "Trigger is required"),
    triggerValue: z.string().optional(),
    action: z.string().min(1, "Action is required"),
    actionValue: z.string().optional(),
    isActive: z.boolean().optional().default(true),
  });

  app.post("/api/automation-rules", requireAuth, requireRole("admin", "manager"), async (req, res) => {
    try {
      const parseResult = automationRuleSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Validation failed", errors: parseResult.error.errors });
      }
      const rule = await storage.createAutomationRule({
        ...parseResult.data,
        createdById: (req.user as User).id,
      });
      
      await storage.createActivityLog({
        userId: (req.user as User).id,
        action: "created",
        entityType: "automation_rule",
        entityId: rule.id,
        details: `Created automation rule: ${rule.name}`,
      });

      res.status(201).json(rule);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/automation-rules/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
    try {
      const rule = await storage.updateAutomationRule(req.params.id, req.body);
      if (!rule) {
        return res.status(404).json({ message: "Rule not found" });
      }
      res.json(rule);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/automation-rules/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
    try {
      await storage.deleteAutomationRule(req.params.id);
      res.json({ message: "Rule deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==========================================
  // CALL LOGS
  // ==========================================
  
  app.get("/api/call-logs", requireAuth, async (req, res) => {
    try {
      const { leadId, clientId } = req.query;
      let logs;
      if (leadId) {
        logs = await storage.getCallLogsByLead(leadId as string);
      } else if (clientId) {
        logs = await storage.getCallLogsByClient(clientId as string);
      } else {
        logs = await storage.getAllCallLogs();
      }
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const callLogSchema = z.object({
    leadId: z.string().optional(),
    clientId: z.string().optional(),
    callType: z.enum(["incoming", "outgoing", "missed"]).default("outgoing"),
    duration: z.number().optional(),
    outcome: z.string().optional(),
    notes: z.string().optional(),
    recordingUrl: z.string().optional(),
    calledAt: z.string().optional(),
  });

  app.post("/api/call-logs", requireAuth, async (req, res) => {
    try {
      const parseResult = callLogSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Validation failed", errors: parseResult.error.errors });
      }
      const data = parseResult.data;
      const log = await storage.createCallLog({
        ...data,
        calledAt: data.calledAt ? new Date(data.calledAt) : new Date(),
        userId: (req.user as User).id,
      });
      
      await storage.createActivityLog({
        userId: (req.user as User).id,
        action: "call_logged",
        entityType: "call_log",
        entityId: log.id,
        details: `${log.callType} call - ${log.outcome || "completed"}`,
      });

      res.status(201).json(log);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/call-logs/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteCallLog(req.params.id);
      res.json({ message: "Call log deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==========================================
  // ACTIVITY LOGS (Audit Trail)
  // ==========================================
  
  app.get("/api/activity-logs", requireAuth, requireRole("admin", "manager"), async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getActivityLogs(limit);
      
      // Enrich with user names
      const users = await storage.getAllUsers();
      const enriched = logs.map(log => ({
        ...log,
        userName: users.find(u => u.id === log.userId)?.name || "Unknown",
      }));
      
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==========================================
  // DUPLICATE LEAD DETECTION
  // ==========================================
  
  app.get("/api/leads/duplicates", requireAuth, requireRole("admin", "manager", "sales"), async (req, res) => {
    try {
      const leads = await storage.getAllLeads();
      const duplicates: { lead: Lead; matches: Lead[] }[] = [];
      const processed = new Set<string>();

      for (const lead of leads) {
        if (processed.has(lead.id)) continue;
        
        const matches = leads.filter(l => 
          l.id !== lead.id && 
          !processed.has(l.id) &&
          (l.mobile === lead.mobile || (l.email && lead.email && l.email === lead.email))
        );
        
        if (matches.length > 0) {
          duplicates.push({ lead, matches });
          processed.add(lead.id);
          matches.forEach(m => processed.add(m.id));
        }
      }

      res.json(duplicates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Merge duplicate leads
  app.post("/api/leads/merge", requireAuth, requireRole("admin", "manager"), async (req, res) => {
    try {
      const { primaryId, duplicateIds } = req.body;
      
      if (!primaryId || !duplicateIds || !Array.isArray(duplicateIds)) {
        return res.status(400).json({ message: "Primary ID and duplicate IDs required" });
      }

      const primary = await storage.getLead(primaryId);
      if (!primary) {
        return res.status(404).json({ message: "Primary lead not found" });
      }

      // Merge notes and follow-ups from duplicates to primary
      for (const dupId of duplicateIds) {
        const dupFollowUps = (await storage.getAllFollowUps()).filter(f => f.leadId === dupId);
        for (const fu of dupFollowUps) {
          await storage.createFollowUp({
            ...fu,
            leadId: primaryId,
          });
        }

        const dupNotes = await storage.getLeadNotes(dupId);
        for (const note of dupNotes) {
          await storage.createLeadNote({
            leadId: primaryId,
            userId: note.userId,
            content: `[Merged] ${note.content}`,
            type: note.type,
          });
        }

        // Delete the duplicate
        await storage.deleteLead(dupId);
      }

      await storage.createActivityLog({
        userId: (req.user as User).id,
        action: "leads_merged",
        entityType: "lead",
        entityId: primaryId,
        details: `Merged ${duplicateIds.length} duplicate leads`,
      });

      res.json({ message: `Merged ${duplicateIds.length} duplicates into primary lead` });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==========================================
  // LEAD DISTRIBUTION (Round Robin)
  // ==========================================
  
  app.get("/api/distribution-settings", requireAuth, requireRole("admin", "manager"), async (req, res) => {
    try {
      let settings = await storage.getDistributionSettings();
      if (!settings) {
        settings = await storage.updateDistributionSettings({ isEnabled: false, method: "round_robin" });
      }
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/distribution-settings", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const settings = await storage.updateDistributionSettings(req.body);
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Distribute unassigned leads
  app.post("/api/leads/distribute", requireAuth, requireRole("admin", "manager"), async (req, res) => {
    try {
      const leads = await storage.getAllLeads();
      const unassigned = leads.filter(l => !l.ownerId);
      let distributed = 0;

      for (const lead of unassigned) {
        const assignee = await storage.getNextAssignee();
        if (assignee) {
          await storage.updateLead(lead.id, { 
            ownerId: assignee.id,
            distributedAt: new Date(),
          });
          await storage.updateDistributionSettings({ lastAssignedUserId: assignee.id });
          distributed++;
        }
      }

      await storage.createActivityLog({
        userId: (req.user as User).id,
        action: "leads_distributed",
        entityType: "lead",
        entityId: null,
        details: `Distributed ${distributed} leads via round robin`,
      });

      res.json({ message: `Distributed ${distributed} leads`, count: distributed });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==========================================
  // MARKETING CHECKLISTS
  // ==========================================
  
  app.get("/api/checklists", requireAuth, async (req, res) => {
    try {
      const { clientId } = req.query;
      if (clientId) {
        const checklists = await storage.getChecklistsByClient(clientId as string);
        res.json(checklists);
      } else {
        // Get all clients' checklists
        const clients = await storage.getAllClients();
        const allChecklists = [];
        for (const client of clients) {
          const cls = await storage.getChecklistsByClient(client.id);
          allChecklists.push(...cls.map(c => ({ ...c, clientName: client.companyName })));
        }
        res.json(allChecklists);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const checklistSchema = z.object({
    clientId: z.string().min(1, "Client ID is required"),
    name: z.string().min(1, "Name is required"),
  });

  app.post("/api/checklists", requireAuth, async (req, res) => {
    try {
      const parseResult = checklistSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Validation failed", errors: parseResult.error.errors });
      }
      const checklist = await storage.createChecklist({
        ...parseResult.data,
        createdById: (req.user as User).id,
      });
      res.status(201).json(checklist);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/checklists/:id/items", requireAuth, async (req, res) => {
    try {
      const items = await storage.getChecklistItems(req.params.id);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const checklistItemSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    sortOrder: z.number().optional().default(0),
  });

  app.post("/api/checklists/:id/items", requireAuth, async (req, res) => {
    try {
      const parseResult = checklistItemSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Validation failed", errors: parseResult.error.errors });
      }
      const item = await storage.createChecklistItem({
        ...parseResult.data,
        checklistId: req.params.id,
      });
      res.status(201).json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/checklist-items/:id", requireAuth, async (req, res) => {
    try {
      const updates = { ...req.body };
      if (req.body.isCompleted) {
        updates.completedAt = new Date();
        updates.completedById = (req.user as User).id;
      }
      const item = await storage.updateChecklistItem(req.params.id, updates);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/checklist-items/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteChecklistItem(req.params.id);
      res.json({ message: "Item deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/checklists/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteChecklist(req.params.id);
      res.json({ message: "Checklist deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==========================================
  // KPI DASHBOARD ADVANCED STATS
  // ==========================================
  
  app.get("/api/dashboard/kpis", requireAuth, async (req, res) => {
    try {
      const leads = await storage.getAllLeads();
      const clients = await storage.getAllClients();
      const invoices = await storage.getAllInvoices();
      const followUps = await storage.getAllFollowUps();
      const tasks = await storage.getAllTasks();

      const today = new Date();
      const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

      // This month metrics
      const thisMonthLeads = leads.filter(l => new Date(l.createdAt) >= thisMonth);
      const lastMonthLeads = leads.filter(l => new Date(l.createdAt) >= lastMonth && new Date(l.createdAt) <= lastMonthEnd);
      
      const thisMonthConversions = thisMonthLeads.filter(l => l.status === "converted").length;
      const lastMonthConversions = lastMonthLeads.filter(l => l.status === "converted").length;

      const thisMonthRevenue = invoices
        .filter(i => new Date(i.createdAt) >= thisMonth)
        .reduce((sum, i) => sum + Number(i.paidAmount), 0);
      const lastMonthRevenue = invoices
        .filter(i => new Date(i.createdAt) >= lastMonth && new Date(i.createdAt) <= lastMonthEnd)
        .reduce((sum, i) => sum + Number(i.paidAmount), 0);

      // Lead scores distribution
      const hotLeads = leads.filter(l => l.score === "hot").length;
      const warmLeads = leads.filter(l => l.score === "warm").length;
      const coldLeads = leads.filter(l => l.score === "cold").length;

      // Pending follow-ups
      const pendingFollowUps = followUps.filter(f => !f.isCompleted).length;
      const overdueFollowUps = followUps.filter(f => !f.isCompleted && new Date(f.scheduledAt) < today).length;

      // Task completion rate
      const completedTasks = tasks.filter(t => t.status === "done").length;
      const taskCompletionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

      // Average deal size
      const paidInvoices = invoices.filter(i => Number(i.paidAmount) > 0);
      const avgDealSize = paidInvoices.length > 0 
        ? paidInvoices.reduce((sum, i) => sum + Number(i.paidAmount), 0) / paidInvoices.length 
        : 0;

      res.json({
        leads: {
          total: leads.length,
          thisMonth: thisMonthLeads.length,
          change: thisMonthLeads.length - lastMonthLeads.length,
        },
        conversions: {
          thisMonth: thisMonthConversions,
          change: thisMonthConversions - lastMonthConversions,
          rate: thisMonthLeads.length > 0 ? Math.round((thisMonthConversions / thisMonthLeads.length) * 100) : 0,
        },
        revenue: {
          thisMonth: thisMonthRevenue,
          change: thisMonthRevenue - lastMonthRevenue,
          avgDealSize: Math.round(avgDealSize),
        },
        leadScores: { hot: hotLeads, warm: warmLeads, cold: coldLeads },
        followUps: { pending: pendingFollowUps, overdue: overdueFollowUps },
        tasks: { total: tasks.length, completed: completedTasks, rate: taskCompletionRate },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
