import cron from 'node-cron';
import { storage } from './storage';
import type { Lead, AutomationRule } from '@shared/schema';

const WHATSAPP_TEMPLATE = `Hi {name}! Thank you for your interest in our services. We'd love to discuss how we can help you achieve your marketing goals. Reply to this message or call us to get started!`;

async function executeAutomation(rule: AutomationRule, lead: Lead): Promise<{ success: boolean; details: string }> {
  try {
    const existingLog = await storage.getAutomationRunLogByRuleAndLead(rule.id, lead.id);
    if (existingLog) {
      return { success: false, details: 'Rule already executed for this lead' };
    }

    switch (rule.action) {
      case 'send_whatsapp': {
        const message = WHATSAPP_TEMPLATE.replace('{name}', lead.name);
        const waLink = `https://wa.me/${lead.mobile.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
        await storage.createAutomationRunLog({
          ruleId: rule.id,
          leadId: lead.id,
          actionType: 'whatsapp',
          actionResult: 'success',
          details: `WhatsApp link generated: ${waLink}`,
        });
        const user = await storage.getUser(lead.ownerId || rule.createdById);
        if (user) {
          await storage.createNotification({
            userId: user.id,
            type: 'automation',
            title: 'Auto WhatsApp Ready',
            message: `Click to send WhatsApp to ${lead.name}: ${waLink}`,
            link: `/leads/${lead.id}`,
          });
        }
        return { success: true, details: `WhatsApp link generated for ${lead.name}` };
      }

      case 'create_notification': {
        const user = await storage.getUser(lead.ownerId || rule.createdById);
        if (user) {
          await storage.createNotification({
            userId: user.id,
            type: 'reminder',
            title: 'Lead Reminder',
            message: `No activity on lead "${lead.name}" - follow up required`,
            link: `/leads/${lead.id}`,
          });
          await storage.createAutomationRunLog({
            ruleId: rule.id,
            leadId: lead.id,
            actionType: 'notification',
            actionResult: 'success',
            details: `Reminder notification sent to ${user.name}`,
          });
          return { success: true, details: `Notification sent to ${user.name}` };
        }
        return { success: false, details: 'No assigned user found' };
      }

      case 'create_followup': {
        const daysOffset = parseInt(rule.actionValue || '2', 10);
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + daysOffset);

        await storage.createFollowUp({
          leadId: lead.id,
          userId: lead.ownerId || rule.createdById,
          scheduledAt: dueDate,
          notes: `Auto-created follow-up: ${rule.name}`,
        });
        await storage.createAutomationRunLog({
          ruleId: rule.id,
          leadId: lead.id,
          actionType: 'followup',
          actionResult: 'success',
          details: `Follow-up task created for ${dueDate.toLocaleDateString()}`,
        });
        return { success: true, details: `Follow-up created for ${lead.name}` };
      }

      default:
        return { success: false, details: `Unknown action: ${rule.action}` };
    }
  } catch (error) {
    console.error('Automation execution error:', error);
    return { success: false, details: String(error) };
  }
}

async function runAutomations() {
  try {
    const rules = await storage.getActiveAutomationRules();
    const leads = await storage.getAllLeads();
    const now = new Date();

    for (const rule of rules) {
      switch (rule.trigger) {
        case 'new_lead': {
          const delayMinutes = parseInt(rule.triggerValue || '5', 10);
          const cutoffTime = new Date(now.getTime() - delayMinutes * 60 * 1000);
          
          for (const lead of leads) {
            const leadCreatedAt = new Date(lead.createdAt);
            if (leadCreatedAt >= cutoffTime && leadCreatedAt <= now) {
              await executeAutomation(rule, lead);
            }
          }
          break;
        }

        case 'no_activity': {
          const days = parseInt(rule.triggerValue || '1', 10);
          const cutoffTime = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
          
          for (const lead of leads) {
            const lastActivity = lead.lastActivityAt ? new Date(lead.lastActivityAt) : new Date(lead.createdAt);
            if (lastActivity < cutoffTime && lead.status !== 'converted' && lead.status !== 'not_interested') {
              await executeAutomation(rule, lead);
            }
          }
          break;
        }

        case 'status_change': {
          const targetStatus = rule.triggerValue;
          for (const lead of leads) {
            if (lead.pipelineStage === targetStatus || lead.status === targetStatus) {
              await executeAutomation(rule, lead);
            }
          }
          break;
        }
      }
    }
  } catch (error) {
    console.error('Automation scheduler error:', error);
  }
}

export function startAutomationScheduler() {
  console.log('Starting automation scheduler...');
  cron.schedule('*/5 * * * *', () => {
    console.log('Running automation check...');
    runAutomations();
  });
  runAutomations();
}
