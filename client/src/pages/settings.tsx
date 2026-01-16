import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  User,
  Bell,
  Lock,
  Building2,
  Loader2,
  Zap,
  Users,
  History,
  RefreshCw,
  Trash2,
  Plus,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

const profileFormSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
});

const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const companyFormSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  companyEmail: z.string().email("Invalid email"),
  companyPhone: z.string().optional(),
  companyAddress: z.string().optional(),
  gstNumber: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;
type PasswordFormData = z.infer<typeof passwordFormSchema>;
type CompanyFormData = z.infer<typeof companyFormSchema>;

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [reminderNotifications, setReminderNotifications] = useState(true);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const companyForm = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      companyName: "MarketPro CRM",
      companyEmail: "contact@marketpro.com",
      companyPhone: "",
      companyAddress: "",
      gstNumber: "",
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const response = await apiRequest("PATCH", "/api/auth/profile", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Profile updated", description: "Your profile has been updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async (data: PasswordFormData) => {
      const response = await apiRequest("PATCH", "/api/auth/password", data);
      return response.json();
    },
    onSuccess: () => {
      passwordForm.reset();
      toast({ title: "Password updated", description: "Your password has been changed successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleProfileSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  const handlePasswordSubmit = (data: PasswordFormData) => {
    updatePasswordMutation.mutate(data);
  };

  const handleCompanySubmit = (data: CompanyFormData) => {
    toast({ title: "Settings saved", description: "Company settings have been updated." });
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Settings"
        description="Manage your account and preferences"
      />

      <div className="flex-1 p-6">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile" data-testid="tab-profile">
              <User className="mr-2 h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="security" data-testid="tab-security">
              <Lock className="mr-2 h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="notifications" data-testid="tab-notifications">
              <Bell className="mr-2 h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="company" data-testid="tab-company">
              <Building2 className="mr-2 h-4 w-4" />
              Company
            </TabsTrigger>
            <TabsTrigger value="advanced" data-testid="tab-advanced">
              <Zap className="mr-2 h-4 w-4" />
              Advanced
            </TabsTrigger>
            <TabsTrigger value="automations" data-testid="tab-automations">
              <RefreshCw className="mr-2 h-4 w-4" />
              Automations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4 max-w-md">
                    <FormField
                      control={profileForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your name" {...field} data-testid="input-profile-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="your@email.com" {...field} data-testid="input-profile-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="+91 9876543210" {...field} data-testid="input-profile-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={updateProfileMutation.isPending} data-testid="button-save-profile">
                      {updateProfileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Changes
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your password to keep your account secure</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4 max-w-md">
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Enter current password" {...field} data-testid="input-current-password" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Enter new password" {...field} data-testid="input-new-password" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Confirm new password" {...field} data-testid="input-confirm-password" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={updatePasswordMutation.isPending} data-testid="button-change-password">
                      {updatePasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Update Password
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Configure how you receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive email updates about your leads</p>
                  </div>
                  <Switch
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                    data-testid="switch-email-notifications"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Follow-up Reminders</p>
                    <p className="text-sm text-muted-foreground">Get reminded about upcoming follow-ups</p>
                  </div>
                  <Switch
                    checked={reminderNotifications}
                    onCheckedChange={setReminderNotifications}
                    data-testid="switch-reminder-notifications"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>Company Settings</CardTitle>
                <CardDescription>Update your company information for invoices and quotations</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...companyForm}>
                  <form onSubmit={companyForm.handleSubmit(handleCompanySubmit)} className="space-y-4 max-w-md">
                    <FormField
                      control={companyForm.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your Company" {...field} data-testid="input-company-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={companyForm.control}
                      name="companyEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Email</FormLabel>
                          <FormControl>
                            <Input placeholder="contact@company.com" {...field} data-testid="input-company-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={companyForm.control}
                      name="companyPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="+91 9876543210" {...field} data-testid="input-company-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={companyForm.control}
                      name="gstNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GST Number</FormLabel>
                          <FormControl>
                            <Input placeholder="27XXXXX1234X1Z5" {...field} data-testid="input-company-gst" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" data-testid="button-save-company">
                      Save Settings
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advanced">
            <AdvancedSettings />
          </TabsContent>

          <TabsContent value="automations">
            <AutomationsSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function AdvancedSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: distributionSettings } = useQuery<any>({
    queryKey: ["/api/distribution-settings"],
  });

  const { data: automationRules } = useQuery<any[]>({
    queryKey: ["/api/automation-rules"],
  });

  const { data: activityLogs } = useQuery<any[]>({
    queryKey: ["/api/activity-logs"],
  });

  const updateDistributionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PATCH", "/api/distribution-settings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/distribution-settings"] });
      toast({ title: "Settings updated" });
    },
  });

  const distributeLeadsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/leads/distribute", {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Leads distributed", description: data.message });
    },
  });

  const scoreAllLeadsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/leads/score-all", {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Leads scored", description: data.message });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            AI Lead Scoring
          </CardTitle>
          <CardDescription>
            Automatically score leads as Hot, Warm, or Cold based on engagement signals
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Lead scoring analyzes: Source quality, pipeline stage, engagement history, recency, and follow-up activity.
          </p>
          <Button 
            onClick={() => scoreAllLeadsMutation.mutate()}
            disabled={scoreAllLeadsMutation.isPending}
            data-testid="button-score-leads"
          >
            {scoreAllLeadsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <RefreshCw className="mr-2 h-4 w-4" />
            Score All Leads
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Lead Distribution (Round Robin)
          </CardTitle>
          <CardDescription>
            Automatically distribute new leads among sales team members
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable Round Robin</p>
              <p className="text-sm text-muted-foreground">
                Automatically assign new leads to sales team members in rotation
              </p>
            </div>
            <Switch
              checked={distributionSettings?.isEnabled || false}
              onCheckedChange={(checked) => updateDistributionMutation.mutate({ isEnabled: checked })}
              data-testid="switch-distribution"
            />
          </div>
          <Button 
            onClick={() => distributeLeadsMutation.mutate()}
            disabled={distributeLeadsMutation.isPending}
            variant="outline"
            data-testid="button-distribute-leads"
          >
            {distributeLeadsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Distribute Unassigned Leads Now
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Activity Log (Audit Trail)
          </CardTitle>
          <CardDescription>
            Recent system activity and audit trail
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activityLogs && activityLogs.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {activityLogs.slice(0, 20).map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{log.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.entityType} - {log.details || "No details"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{log.userName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No activity logs yet. Actions will be recorded as users interact with the system.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AutomationsSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showNewRuleForm, setShowNewRuleForm] = useState(false);
  const [newRule, setNewRule] = useState({
    name: "",
    trigger: "new_lead",
    triggerValue: "5",
    action: "send_whatsapp",
    actionValue: "",
  });

  const { data: automationRules } = useQuery<any[]>({
    queryKey: ["/api/automation-rules"],
  });

  const { data: runLogs } = useQuery<any[]>({
    queryKey: ["/api/automation-run-logs"],
  });

  const createRuleMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/automation-rules", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation-rules"] });
      toast({ title: "Automation rule created" });
      setShowNewRuleForm(false);
      setNewRule({ name: "", trigger: "new_lead", triggerValue: "5", action: "send_whatsapp", actionValue: "" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiRequest("PATCH", `/api/automation-rules/${id}`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation-rules"] });
      toast({ title: "Rule updated" });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/automation-rules/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation-rules"] });
      toast({ title: "Rule deleted" });
    },
  });

  const getTriggerLabel = (trigger: string, value: string) => {
    switch (trigger) {
      case "new_lead": return `Lead created (after ${value || 5} minutes)`;
      case "no_activity": return `No activity (after ${value || 1} day${value !== "1" ? "s" : ""})`;
      case "status_change": return `Status changed to ${value || "proposal"}`;
      default: return trigger;
    }
  };

  const getActionLabel = (action: string, value: string) => {
    switch (action) {
      case "send_whatsapp": return "Send WhatsApp template";
      case "create_notification": return "Create reminder notification";
      case "create_followup": return `Create follow-up task (in ${value || 2} days)`;
      default: return action;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Automation Rules
            </CardTitle>
            <CardDescription>
              Set up automatic follow-ups and notifications based on lead activity
            </CardDescription>
          </div>
          <Button 
            onClick={() => setShowNewRuleForm(!showNewRuleForm)}
            data-testid="button-add-automation"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Rule
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showNewRuleForm && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4 space-y-4">
                <Input
                  placeholder="Rule name"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  data-testid="input-rule-name"
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Trigger</label>
                    <select
                      className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                      value={newRule.trigger}
                      onChange={(e) => setNewRule({ ...newRule, trigger: e.target.value })}
                      data-testid="select-trigger"
                    >
                      <option value="new_lead">Lead Created</option>
                      <option value="no_activity">No Activity</option>
                      <option value="status_change">Status Change</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Trigger Value</label>
                    <Input
                      placeholder={newRule.trigger === "status_change" ? "proposal" : "5"}
                      value={newRule.triggerValue}
                      onChange={(e) => setNewRule({ ...newRule, triggerValue: e.target.value })}
                      data-testid="input-trigger-value"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Action</label>
                    <select
                      className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                      value={newRule.action}
                      onChange={(e) => setNewRule({ ...newRule, action: e.target.value })}
                      data-testid="select-action"
                    >
                      <option value="send_whatsapp">Send WhatsApp Template</option>
                      <option value="create_notification">Create Reminder</option>
                      <option value="create_followup">Create Follow-up Task</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Action Value</label>
                    <Input
                      placeholder={newRule.action === "create_followup" ? "Days offset (e.g. 2)" : "Optional"}
                      value={newRule.actionValue}
                      onChange={(e) => setNewRule({ ...newRule, actionValue: e.target.value })}
                      data-testid="input-action-value"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => createRuleMutation.mutate(newRule)}
                    disabled={!newRule.name || createRuleMutation.isPending}
                    data-testid="button-save-rule"
                  >
                    {createRuleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Rule
                  </Button>
                  <Button variant="outline" onClick={() => setShowNewRuleForm(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {automationRules && automationRules.length > 0 ? (
            <div className="space-y-3">
              {automationRules.map((rule: any) => (
                <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`automation-rule-${rule.id}`}>
                  <div className="flex-1">
                    <p className="font-medium">{rule.name}</p>
                    <p className="text-sm text-muted-foreground">
                      When: {getTriggerLabel(rule.trigger, rule.triggerValue)} → Then: {getActionLabel(rule.action, rule.actionValue)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={(checked) => toggleRuleMutation.mutate({ id: rule.id, isActive: checked })}
                      data-testid={`switch-rule-${rule.id}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteRuleMutation.mutate(rule.id)}
                      data-testid={`button-delete-rule-${rule.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No automation rules yet. Create rules to automate your follow-up workflow.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Automation Run Logs
          </CardTitle>
          <CardDescription>
            Recent automation executions and their results
          </CardDescription>
        </CardHeader>
        <CardContent>
          {runLogs && runLogs.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {runLogs.slice(0, 20).map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50" data-testid={`run-log-${log.id}`}>
                  <div className={`w-2 h-2 mt-2 rounded-full ${log.actionResult === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{log.actionType}</p>
                    <p className="text-xs text-muted-foreground">{log.details || "No details"}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(log.triggeredAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No automation logs yet. Logs will appear when rules are triggered.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
