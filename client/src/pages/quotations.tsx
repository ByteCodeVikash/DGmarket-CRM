import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Plus,
  FileText,
  MoreHorizontal,
  Trash2,
  Edit,
  Loader2,
  Download,
  Send,
  MessageCircle,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Quotation, Lead, Client, Package } from "@shared/schema";

const quotationFormSchema = z.object({
  leadId: z.string().optional(),
  clientId: z.string().optional(),
  packageName: z.string().min(1, "Package name is required"),
  items: z.string().min(1, "Items are required"),
  subtotal: z.coerce.string().min(1, "Subtotal is required"),
  tax: z.coerce.string().default("0"),
  total: z.coerce.string().min(1, "Total is required"),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().default("draft"),
});

type QuotationFormData = z.infer<typeof quotationFormSchema>;

interface QuotationWithRelations extends Quotation {
  lead?: Lead;
  client?: Client;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  accepted: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

// Fallback packages if none in database
const defaultPackages = [
  { name: "Basic", description: "Essential services", price: "15000" },
  { name: "Standard", description: "Popular choice", price: "30000" },
  { name: "Premium", description: "Complete solution", price: "50000" },
];

export default function QuotationsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailQuotation, setEmailQuotation] = useState<QuotationWithRelations | null>(null);
  const [emailAddress, setEmailAddress] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: quotations = [], isLoading } = useQuery<QuotationWithRelations[]>({
    queryKey: ["/api/quotations"],
  });

  const { data: leadsResponse } = useQuery<{ data: Lead[]; pagination: any }>({
    queryKey: ["/api/leads"],
  });
  const leads = leadsResponse?.data || [];

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: dbPackages = [] } = useQuery<Package[]>({
    queryKey: ["/api/packages"],
  });
  
  // Use database packages if available, otherwise fall back to defaults
  const packages = dbPackages.length > 0 
    ? dbPackages.map(p => ({ name: p.name, description: p.description || "", price: p.price }))
    : defaultPackages;

  const form = useForm<QuotationFormData>({
    resolver: zodResolver(quotationFormSchema),
    defaultValues: {
      leadId: "",
      clientId: "",
      packageName: "Basic",
      items: "",
      subtotal: "",
      tax: "0",
      total: "",
      validUntil: "",
      notes: "",
      status: "draft",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: QuotationFormData) => {
      const response = await apiRequest("POST", "/api/quotations", data);
      return response.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/quotations"] });
      setIsCreateOpen(false);
      form.reset();
      toast({ title: "Quotation created", description: "New quotation has been created successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: QuotationFormData }) => {
      const response = await apiRequest("PATCH", `/api/quotations/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/quotations"] });
      setEditingQuotation(null);
      form.reset();
      toast({ title: "Quotation updated", description: "Quotation has been updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/quotations/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/quotations"] });
      setDeleteId(null);
      toast({ title: "Quotation deleted", description: "Quotation has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const emailMutation = useMutation({
    mutationFn: async ({ id, email }: { id: string; email: string }) => {
      const response = await apiRequest("POST", `/api/quotations/${id}/email`, { email });
      return response.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/quotations"] });
      setEmailDialogOpen(false);
      setEmailQuotation(null);
      setEmailAddress("");
      toast({ title: "Email sent", description: "Quotation has been sent via email." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (data: QuotationFormData) => {
    const cleanedData = {
      ...data,
      leadId: data.leadId && data.leadId !== "none" ? data.leadId : undefined,
      clientId: data.clientId && data.clientId !== "none" ? data.clientId : undefined,
      validUntil: data.validUntil || undefined,
    };
    if (editingQuotation) {
      updateMutation.mutate({ id: editingQuotation.id, data: cleanedData });
    } else {
      createMutation.mutate(cleanedData);
    }
  };

  const handleEmailSend = (quotation: QuotationWithRelations) => {
    const defaultEmail = quotation.lead?.email || quotation.client?.email || "";
    setEmailAddress(defaultEmail);
    setEmailQuotation(quotation);
    setEmailDialogOpen(true);
  };

  const handleSendEmail = () => {
    if (emailQuotation && emailAddress) {
      emailMutation.mutate({ id: emailQuotation.id, email: emailAddress });
    }
  };

  const handleEdit = (quotation: Quotation) => {
    setEditingQuotation(quotation);
    form.reset({
      leadId: quotation.leadId || "",
      clientId: quotation.clientId || "",
      packageName: quotation.packageName,
      items: quotation.items,
      subtotal: quotation.subtotal,
      tax: quotation.tax,
      total: quotation.total,
      validUntil: quotation.validUntil || "",
      notes: quotation.notes || "",
      status: quotation.status,
    });
  };

  const handleWhatsAppSend = (quotation: QuotationWithRelations) => {
    const mobile = quotation.lead?.mobile || "";
    const message = `Hi, here's your quotation for ${quotation.packageName} package. Total: ₹${quotation.total}`;
    window.open(`https://wa.me/${mobile.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(value));
  };

  const columns = [
    {
      key: "quotation",
      header: "Quotation",
      cell: (quotation: QuotationWithRelations) => (
        <div>
          <p className="font-medium">{quotation.quotationNumber}</p>
          <p className="text-xs text-muted-foreground">
            {quotation.lead?.name || quotation.client?.companyName || "-"}
          </p>
        </div>
      ),
    },
    {
      key: "package",
      header: "Package",
      cell: (quotation: QuotationWithRelations) => (
        <Badge variant="secondary">{quotation.packageName}</Badge>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      cell: (quotation: QuotationWithRelations) => (
        <span className="font-medium">{formatCurrency(quotation.total)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (quotation: QuotationWithRelations) => (
        <Badge className={statusColors[quotation.status]}>
          {quotation.status}
        </Badge>
      ),
    },
    {
      key: "validUntil",
      header: "Valid Until",
      cell: (quotation: QuotationWithRelations) => (
        <span className="text-sm text-muted-foreground">
          {quotation.validUntil ? format(new Date(quotation.validUntil), "MMM d, yyyy") : "-"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (quotation: QuotationWithRelations) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid={`button-actions-${quotation.id}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(quotation)} data-testid={`button-edit-${quotation.id}`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.open(`/api/quotations/${quotation.id}/pdf`, "_blank")} data-testid={`button-pdf-${quotation.id}`}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleWhatsAppSend(quotation)} data-testid={`button-whatsapp-${quotation.id}`}>
              <MessageCircle className="mr-2 h-4 w-4" />
              Send via WhatsApp
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleEmailSend(quotation)} data-testid={`button-email-${quotation.id}`}>
              <Send className="mr-2 h-4 w-4" />
              Send via Email
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => setDeleteId(quotation.id)}
              data-testid={`button-delete-${quotation.id}`}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      className: "w-[60px]",
    },
  ];

  const isFormOpen = isCreateOpen || editingQuotation !== null;

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Quotations"
        description="Create and manage quotations for leads and clients"
        actions={
          <Dialog open={isFormOpen} onOpenChange={(open) => {
            if (!open) {
              setIsCreateOpen(false);
              setEditingQuotation(null);
              form.reset();
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateOpen(true)} data-testid="button-add-quotation">
                <Plus className="mr-2 h-4 w-4" />
                Create Quotation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingQuotation ? "Edit Quotation" : "Create Quotation"}</DialogTitle>
                <DialogDescription>
                  {editingQuotation ? "Update the quotation details below." : "Enter the quotation details below."}
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="leadId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lead</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "none"}>
                            <FormControl>
                              <SelectTrigger data-testid="select-quotation-lead">
                                <SelectValue placeholder="Select lead" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No Lead</SelectItem>
                              {leads.map((lead) => (
                                <SelectItem key={lead.id} value={lead.id}>
                                  {lead.name}
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
                      name="clientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "none"}>
                            <FormControl>
                              <SelectTrigger data-testid="select-quotation-client">
                                <SelectValue placeholder="Select client" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No Client</SelectItem>
                              {clients.map((client) => (
                                <SelectItem key={client.id} value={client.id}>
                                  {client.companyName || client.contactName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="packageName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Package</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-quotation-package">
                                <SelectValue placeholder="Select package" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {packages.map((pkg) => (
                                <SelectItem key={pkg.name} value={pkg.name}>
                                  {pkg.name} - ₹{pkg.price}
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
                    name="items"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Items (JSON)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder='[{"name": "SEO Services", "quantity": 1, "price": 10000}]'
                            {...field}
                            data-testid="input-quotation-items"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="subtotal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subtotal</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="10000" {...field} data-testid="input-quotation-subtotal" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tax"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tax</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="1800" {...field} data-testid="input-quotation-tax" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="total"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="11800" {...field} data-testid="input-quotation-total" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="validUntil"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valid Until</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-quotation-valid" />
                          </FormControl>
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
                              <SelectTrigger data-testid="select-quotation-status">
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="sent">Sent</SelectItem>
                              <SelectItem value="accepted">Accepted</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
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
                          <Textarea placeholder="Additional notes..." {...field} data-testid="input-quotation-notes" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="button-submit-quotation"
                    >
                      {(createMutation.isPending || updateMutation.isPending) && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {editingQuotation ? "Update Quotation" : "Create Quotation"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex-1 p-6">
        <DataTable
          columns={columns}
          data={quotations}
          isLoading={isLoading}
          emptyMessage="No quotations found. Create your first quotation to get started."
        />
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quotation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this quotation? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={emailDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setEmailDialogOpen(false);
          setEmailQuotation(null);
          setEmailAddress("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Quotation via Email</DialogTitle>
            <DialogDescription>
              Enter the email address to send this quotation to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Address</label>
              <Input
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="Enter email address"
                data-testid="input-email-address"
              />
            </div>
            {emailQuotation && (
              <div className="text-sm text-muted-foreground">
                Sending quotation: <strong>{emailQuotation.quotationNumber}</strong>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendEmail}
              disabled={!emailAddress || emailMutation.isPending}
              data-testid="button-send-email"
            >
              {emailMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
