import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Phone,
  MessageCircle,
  Mail,
  Trash2,
  Edit,
  User,
  Loader2,
  UserCheck,
  Upload,
  Download,
  FileText,
  CheckCircle2,
  XCircle,
  Wand2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Lead, User as UserType, leadSources, leadStatuses } from "@shared/schema";
import { AIMessageGenerator } from "@/components/ai-message-generator";

interface ImportResult {
  success: { row: number; lead: Lead }[];
  failed: { row: number; data: any; error: string }[];
  total: number;
}

const leadFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email().optional().or(z.literal("")),
  mobile: z.string().min(10, "Mobile number must be at least 10 digits"),
  city: z.string().optional(),
  source: z.string(),
  status: z.string(),
  notes: z.string().optional(),
  ownerId: z.string().optional(),
  interestLevel: z.string().optional(),
  budget: z.string().optional(),
});

type LeadFormData = z.infer<typeof leadFormSchema>;

const scoreColors: Record<string, string> = {
  hot: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  warm: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  cold: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  interested: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  follow_up: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  converted: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  not_interested: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
};

export default function LeadsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [temperatureFilter, setTemperatureFilter] = useState<string>("all");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [messageGeneratorLead, setMessageGeneratorLead] = useState<Lead | null>(null);
  const pageSize = 20;

  const buildLeadsUrl = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.append("search", searchQuery);
    if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
    if (sourceFilter && sourceFilter !== "all") params.append("source", sourceFilter);
    if (temperatureFilter && temperatureFilter !== "all") params.append("score", temperatureFilter);
    params.append("sortBy", sortBy);
    params.append("sortOrder", sortOrder);
    params.append("page", currentPage.toString());
    params.append("limit", pageSize.toString());
    return `/api/leads?${params.toString()}`;
  };

  interface LeadsResponse {
    data: Lead[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }

  const { data: leadsResponse, isLoading } = useQuery<LeadsResponse>({
    queryKey: ["/api/leads", searchQuery, statusFilter, sourceFilter, temperatureFilter, sortBy, sortOrder, currentPage],
    queryFn: async () => {
      const res = await fetch(buildLeadsUrl(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
  });

  const leads = leadsResponse?.data || [];
  const pagination = leadsResponse?.pagination;

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      name: "",
      email: "",
      mobile: "",
      city: "",
      source: "website",
      status: "new",
      notes: "",
      ownerId: "",
      interestLevel: "medium",
      budget: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: LeadFormData) => {
      const response = await apiRequest("POST", "/api/leads", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setIsCreateOpen(false);
      form.reset();
      toast({ title: "Lead created", description: "New lead has been added successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: LeadFormData }) => {
      const response = await apiRequest("PATCH", `/api/leads/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setEditingLead(null);
      form.reset();
      toast({ title: "Lead updated", description: "Lead has been updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/leads/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setDeleteId(null);
      toast({ title: "Lead deleted", description: "Lead has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const response = await apiRequest("POST", `/api/leads/${leadId}/convert`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setConvertingLead(null);
      toast({ title: "Lead converted", description: "Lead has been converted to a client successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (csvData: any[]) => {
      const response = await apiRequest("POST", "/api/leads/import", { csvData });
      return response.json() as Promise<ImportResult>;
    },
    onSuccess: (result) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      if (result.failed.length === 0) {
        toast({ title: "Import successful", description: `${result.success.length} leads imported.` });
      } else {
        toast({ 
          title: "Import completed with errors", 
          description: `${result.success.length} imported, ${result.failed.length} failed.`,
          variant: result.success.length > 0 ? "default" : "destructive"
        });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const parseCSV = (text: string): any[] => {
    const lines = text.split("\n").filter(line => line.trim());
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
    const data: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      
      for (const char of lines[i]) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim().replace(/^"|"$/g, ""));
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^"|"$/g, ""));
      
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      data.push(row);
    }
    
    return data;
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const csvData = parseCSV(text);
      if (csvData.length === 0) {
        toast({ title: "Invalid CSV", description: "The file is empty or has no data rows.", variant: "destructive" });
        return;
      }
      importMutation.mutate(csvData);
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (sourceFilter && sourceFilter !== "all") params.append("source", sourceFilter);
      if (searchQuery) params.append("search", searchQuery);
      
      const response = await fetch(`/api/leads/export?${params.toString()}`, { credentials: "include" });
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads_export_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({ title: "Export successful", description: "Leads exported to CSV." });
    } catch (error: any) {
      toast({ title: "Export failed", description: error.message, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSubmit = (data: LeadFormData) => {
    if (editingLead) {
      updateMutation.mutate({ id: editingLead.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead);
    form.reset({
      name: lead.name,
      email: lead.email || "",
      mobile: lead.mobile,
      city: lead.city || "",
      source: lead.source,
      status: lead.status,
      notes: lead.notes || "",
      ownerId: lead.ownerId || "",
    });
  };

  const handleWhatsApp = (mobile: string) => {
    window.open(`https://wa.me/${mobile.replace(/\D/g, "")}`, "_blank");
  };

  const handleCall = (mobile: string) => {
    window.open(`tel:${mobile}`, "_self");
  };

  const columns = [
    {
      key: "name",
      header: "Lead",
      cell: (lead: Lead) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-medium">{lead.name}</p>
            <p className="text-xs text-muted-foreground">{lead.mobile}</p>
          </div>
        </div>
      ),
    },
    {
      key: "source",
      header: "Source",
      cell: (lead: Lead) => (
        <Badge variant="secondary" className="capitalize">
          {lead.source}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (lead: Lead) => (
        <Badge className={statusColors[lead.status] || ""}>
          {lead.status.replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "score",
      header: "Score",
      cell: (lead: Lead) => {
        const temp = (lead as any).score || "warm";
        const numScore = (lead as any).leadScore ?? 50;
        return (
          <div className="flex items-center gap-2">
            <Badge className={scoreColors[temp] || scoreColors.warm} data-testid={`badge-score-${lead.id}`}>
              {temp.toUpperCase()}
            </Badge>
            <span className="text-xs text-muted-foreground" data-testid={`text-leadscore-${lead.id}`}>
              {numScore}
            </span>
          </div>
        );
      },
    },
    {
      key: "city",
      header: "City",
      cell: (lead: Lead) => (
        <span className="text-muted-foreground">{lead.city || "-"}</span>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      cell: (lead: Lead) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(lead.createdAt), "MMM d, yyyy")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (lead: Lead) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleWhatsApp(lead.mobile)}
            data-testid={`button-whatsapp-${lead.id}`}
          >
            <MessageCircle className="h-4 w-4 text-green-600" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCall(lead.mobile)}
            data-testid={`button-call-${lead.id}`}
          >
            <Phone className="h-4 w-4 text-blue-600" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-testid={`button-actions-${lead.id}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEdit(lead)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setMessageGeneratorLead(lead)}
                data-testid={`button-ai-message-${lead.id}`}
              >
                <Wand2 className="mr-2 h-4 w-4" />
                Generate AI Message
              </DropdownMenuItem>
              {lead.status !== "converted" && (
                <DropdownMenuItem 
                  onClick={() => setConvertingLead(lead)}
                  data-testid={`button-convert-${lead.id}`}
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  Convert to Client
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteId(lead.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      className: "w-[120px]",
    },
  ];

  const isFormOpen = isCreateOpen || editingLead !== null;

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Leads"
        description="Manage and track your sales leads"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={isExporting}
              data-testid="button-export-leads"
            >
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export
            </Button>
            <Dialog open={isImportOpen} onOpenChange={(open) => {
              setIsImportOpen(open);
              if (!open) setImportResult(null);
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-import-leads">
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Import Leads from CSV</DialogTitle>
                  <DialogDescription>
                    Upload a CSV file with columns: name, mobile, email, city, source, status, notes
                  </DialogDescription>
                </DialogHeader>
                
                {!importResult ? (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed rounded-lg p-8 text-center">
                      <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-sm text-muted-foreground mb-4">
                        Upload a CSV file with lead data. Required columns: name, mobile
                      </p>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleImportFile}
                        className="hidden"
                        id="csv-upload"
                        data-testid="input-csv-file"
                      />
                      <label htmlFor="csv-upload">
                        <Button asChild disabled={importMutation.isPending}>
                          <span>
                            {importMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <Upload className="mr-2 h-4 w-4" />
                                Choose CSV File
                              </>
                            )}
                          </span>
                        </Button>
                      </label>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p><strong>Example CSV format:</strong></p>
                      <code className="block bg-muted p-2 rounded text-xs">
                        name,mobile,email,city,source,status<br/>
                        John Doe,9876543210,john@example.com,Mumbai,facebook,new
                      </code>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span className="font-medium">{importResult.success.length} imported</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-red-500" />
                        <span className="font-medium">{importResult.failed.length} failed</span>
                      </div>
                    </div>
                    
                    {importResult.success.length > 0 && (
                      <Progress value={(importResult.success.length / importResult.total) * 100} className="h-2" />
                    )}
                    
                    {importResult.failed.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Failed Rows:</p>
                        <ScrollArea className="h-[200px] border rounded-md p-2">
                          {importResult.failed.map((item, i) => (
                            <div key={i} className="text-xs p-2 border-b last:border-0">
                              <span className="font-medium">Row {item.row}:</span> {item.error}
                              <div className="text-muted-foreground mt-1">
                                Data: {JSON.stringify(item.data)}
                              </div>
                            </div>
                          ))}
                        </ScrollArea>
                      </div>
                    )}
                    
                    <DialogFooter>
                      <Button onClick={() => {
                        setImportResult(null);
                        setIsImportOpen(false);
                      }}>
                        Done
                      </Button>
                    </DialogFooter>
                  </div>
                )}
              </DialogContent>
            </Dialog>
            <Dialog open={isFormOpen} onOpenChange={(open) => {
              if (!open) {
                setIsCreateOpen(false);
                setEditingLead(null);
                form.reset();
              }
            }}>
              <DialogTrigger asChild>
                <Button onClick={() => setIsCreateOpen(true)} data-testid="button-add-lead">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Lead
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingLead ? "Edit Lead" : "Add New Lead"}</DialogTitle>
                <DialogDescription>
                  {editingLead ? "Update the lead information below." : "Enter the lead details below."}
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} data-testid="input-lead-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="mobile"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mobile</FormLabel>
                          <FormControl>
                            <Input placeholder="+91 9876543210" {...field} data-testid="input-lead-mobile" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="john@example.com" {...field} data-testid="input-lead-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="Mumbai" {...field} data-testid="input-lead-city" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="source"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Source</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-lead-source">
                                <SelectValue placeholder="Select source" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {leadSources.map((source) => (
                                <SelectItem key={source} value={source} className="capitalize">
                                  {source}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-lead-status">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {leadStatuses.map((status) => (
                                <SelectItem key={status} value={status} className="capitalize">
                                  {status.replace("_", " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Add any notes about this lead..."
                            {...field}
                            data-testid="input-lead-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="interestLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Interest Level</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value || "medium"}>
                          <FormControl>
                            <SelectTrigger data-testid="select-interest-level">
                              <SelectValue placeholder="Select interest level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="budget"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Budget (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="e.g., 50000"
                            {...field}
                            data-testid="input-lead-budget"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ownerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assigned To</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-lead-owner">
                              <SelectValue placeholder="Select team member" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="button-submit-lead"
                    >
                      {(createMutation.isPending || updateMutation.isPending) && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {editingLead ? "Update Lead" : "Create Lead"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      <div className="flex-1 space-y-4 p-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9"
              data-testid="input-search-leads"
            />
          </div>
          <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}>
            <SelectTrigger className="w-[150px]" data-testid="filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {leadStatuses.map((status) => (
                <SelectItem key={status} value={status} className="capitalize">
                  {status.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={(val) => { setSourceFilter(val); setCurrentPage(1); }}>
            <SelectTrigger className="w-[150px]" data-testid="filter-source">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {leadSources.map((source) => (
                <SelectItem key={source} value={source} className="capitalize">
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={temperatureFilter} onValueChange={(val) => { setTemperatureFilter(val); setCurrentPage(1); }}>
            <SelectTrigger className="w-[150px]" data-testid="filter-temperature">
              <SelectValue placeholder="Temperature" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Temps</SelectItem>
              <SelectItem value="hot">Hot</SelectItem>
              <SelectItem value="warm">Warm</SelectItem>
              <SelectItem value="cold">Cold</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(val) => { setSortBy(val); setCurrentPage(1); }}>
            <SelectTrigger className="w-[150px]" data-testid="filter-sortby">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Date Created</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="source">Source</SelectItem>
              <SelectItem value="city">City</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            data-testid="button-sort-order"
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </Button>
        </div>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={leads}
          isLoading={isLoading}
          emptyMessage="No leads found. Add your first lead to get started."
        />

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-2">
            <p className="text-sm text-muted-foreground">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} leads
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                data-testid="button-prev-page"
              >
                Previous
              </Button>
              <span className="text-sm">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage >= pagination.totalPages}
                data-testid="button-next-page"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this lead? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={convertingLead !== null} onOpenChange={() => setConvertingLead(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert Lead to Client</AlertDialogTitle>
            <AlertDialogDescription>
              Convert "{convertingLead?.name}" to a client? This will create a new client record and mark the lead as converted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-convert">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => convertingLead && convertMutation.mutate(convertingLead.id)}
              data-testid="button-confirm-convert"
            >
              {convertMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Convert"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={messageGeneratorLead !== null} onOpenChange={(open) => !open && setMessageGeneratorLead(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              AI Message Generator
            </DialogTitle>
            <DialogDescription>
              Generate personalized messages for {messageGeneratorLead?.name}
            </DialogDescription>
          </DialogHeader>
          {messageGeneratorLead && (
            <AIMessageGenerator
              leadId={messageGeneratorLead.id}
              leadName={messageGeneratorLead.name}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
