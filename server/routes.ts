import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setupAuth, seedAdminUser, hashPassword } from "./auth";
import { User, Lead, Client } from "@shared/schema";

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
      
      res.json({
        totalLeads: leads.length,
        todayFollowUps,
        convertedClients: clients.length,
        totalRevenue,
        pendingPayments,
        conversionRate,
        recentLeads,
        upcomingFollowUps,
        monthlyLeads,
        leadsBySource,
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
      const { search, status, source, sortBy, sortOrder, page, limit } = req.query;
      
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

  app.post("/api/follow-ups", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const followUp = await storage.createFollowUp({ ...req.body, userId: user.id });
      
      let leadName = "a lead";
      if (req.body.leadId) {
        const lead = await storage.getLead(req.body.leadId);
        if (lead) leadName = lead.name;
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
      const recipientName = client?.companyName || client?.name || lead?.name || 'N/A';
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
      const payment = await storage.createPayment({
        ...req.body,
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
      const withStats = campaigns.map(c => ({
        ...c,
        leadsCount: leads.filter(l => l.campaignId === c.id).length,
      }));
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
}
