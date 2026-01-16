import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Plus,
  Receipt,
  MoreHorizontal,
  Trash2,
  Edit,
  Loader2,
  Download,
  Send,
  CreditCard,
  RefreshCw,
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Invoice, Client, invoiceStatuses, paymentMethods } from "@shared/schema";

const invoiceFormSchema = z.object({
  clientId: z.string().min(1, "Please select a client"),
  items: z.string().min(1, "Items are required"),
  subtotal: z.string().min(1, "Subtotal is required"),
  tax: z.string().default("0"),
  total: z.string().min(1, "Total is required"),
  dueDate: z.string().min(1, "Due date is required"),
  status: z.string().default("draft"),
  isRecurring: z.boolean().default(false),
  recurringDay: z.string().optional(),
});

type InvoiceFormData = z.infer<typeof invoiceFormSchema>;

const paymentFormSchema = z.object({
  amount: z.string().min(1, "Amount is required").refine(
    (val) => Number(val) > 0,
    { message: "Amount must be greater than 0" }
  ),
  method: z.string().min(1, "Payment method is required"),
  paymentDate: z.string().min(1, "Payment date is required"),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentFormSchema>;

interface InvoiceWithClient extends Invoice {
  client?: Client;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  cancelled: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
};

export default function InvoicesPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<InvoiceWithClient | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery<InvoiceWithClient[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      clientId: "",
      items: "",
      subtotal: "",
      tax: "0",
      total: "",
      dueDate: "",
      status: "draft",
      isRecurring: false,
      recurringDay: "",
    },
  });

  const paymentForm = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      amount: "",
      method: "bank_transfer",
      paymentDate: format(new Date(), "yyyy-MM-dd"),
      reference: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      const response = await apiRequest("POST", "/api/invoices", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setIsCreateOpen(false);
      form.reset();
      toast({ title: "Invoice created", description: "New invoice has been created successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InvoiceFormData }) => {
      const response = await apiRequest("PATCH", `/api/invoices/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setEditingInvoice(null);
      form.reset();
      toast({ title: "Invoice updated", description: "Invoice has been updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/invoices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setDeleteId(null);
      toast({ title: "Invoice deleted", description: "Invoice has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async (data: PaymentFormData & { invoiceId: string }) => {
      const response = await apiRequest("POST", "/api/payments", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      setPaymentInvoice(null);
      paymentForm.reset();
      toast({ title: "Payment recorded", description: "Payment has been recorded successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handlePaymentSubmit = (data: PaymentFormData) => {
    if (!paymentInvoice) return;
    paymentMutation.mutate({
      ...data,
      invoiceId: paymentInvoice.id,
    });
  };

  const handleRecordPayment = (invoice: InvoiceWithClient) => {
    const dueAmount = Number(invoice.total) - Number(invoice.paidAmount);
    setPaymentInvoice(invoice);
    paymentForm.reset({
      amount: dueAmount.toString(),
      method: "bank_transfer",
      paymentDate: format(new Date(), "yyyy-MM-dd"),
      reference: "",
      notes: "",
    });
  };

  const handleSubmit = (data: InvoiceFormData) => {
    const cleanedData: any = { ...data };
    if (!cleanedData.clientId) delete cleanedData.clientId;
    if (!cleanedData.dueDate) delete cleanedData.dueDate;
    if (editingInvoice) {
      updateMutation.mutate({ id: editingInvoice.id, data: cleanedData });
    } else {
      createMutation.mutate(cleanedData);
    }
  };

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    form.reset({
      clientId: invoice.clientId,
      items: invoice.items,
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      total: invoice.total,
      dueDate: invoice.dueDate,
      status: invoice.status,
      isRecurring: invoice.isRecurring,
      recurringDay: invoice.recurringDay?.toString() || "",
    });
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
      key: "invoice",
      header: "Invoice",
      cell: (invoice: InvoiceWithClient) => (
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{invoice.invoiceNumber}</p>
            {invoice.isRecurring && (
              <Badge variant="outline" className="text-xs">
                <RefreshCw className="mr-1 h-3 w-3" />
                Recurring
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{invoice.client?.companyName}</p>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      cell: (invoice: InvoiceWithClient) => (
        <div>
          <p className="font-medium">{formatCurrency(invoice.total)}</p>
          <p className="text-xs text-muted-foreground">
            Paid: {formatCurrency(invoice.paidAmount)}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (invoice: InvoiceWithClient) => (
        <Badge className={statusColors[invoice.status]}>
          {invoice.status}
        </Badge>
      ),
    },
    {
      key: "dueDate",
      header: "Due Date",
      cell: (invoice: InvoiceWithClient) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(invoice.dueDate), "MMM d, yyyy")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (invoice: InvoiceWithClient) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid={`button-actions-${invoice.id}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(invoice)} data-testid={`button-edit-${invoice.id}`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.open(`/api/invoices/${invoice.id}/pdf`, "_blank")} data-testid={`button-pdf-${invoice.id}`}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </DropdownMenuItem>
            {invoice.status !== "paid" && (
              <DropdownMenuItem onClick={() => handleRecordPayment(invoice)} data-testid={`button-payment-${invoice.id}`}>
                <CreditCard className="mr-2 h-4 w-4" />
                Record Payment
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => setDeleteId(invoice.id)}
              data-testid={`button-delete-${invoice.id}`}
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

  const isFormOpen = isCreateOpen || editingInvoice !== null;

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Invoices"
        description="Manage your invoices and billing"
        actions={
          <Dialog open={isFormOpen} onOpenChange={(open) => {
            if (!open) {
              setIsCreateOpen(false);
              setEditingInvoice(null);
              form.reset();
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateOpen(true)} data-testid="button-add-invoice">
                <Plus className="mr-2 h-4 w-4" />
                Create Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingInvoice ? "Edit Invoice" : "Create Invoice"}</DialogTitle>
                <DialogDescription>
                  {editingInvoice ? "Update the invoice details below." : "Enter the invoice details below."}
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-invoice-client">
                              <SelectValue placeholder="Select client" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clients.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.companyName}
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
                    name="items"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Items (JSON)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder='[{"name": "SEO Services", "quantity": 1, "price": 10000}]'
                            {...field}
                            data-testid="input-invoice-items"
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
                            <Input type="number" placeholder="10000" {...field} data-testid="input-invoice-subtotal" />
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
                            <Input type="number" placeholder="1800" {...field} data-testid="input-invoice-tax" />
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
                            <Input type="number" placeholder="11800" {...field} data-testid="input-invoice-total" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Due Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-invoice-due" />
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
                              <SelectTrigger data-testid="select-invoice-status">
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {invoiceStatuses.map((status) => (
                                <SelectItem key={status} value={status} className="capitalize">
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <FormField
                      control={form.control}
                      name="isRecurring"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-recurring"
                            />
                          </FormControl>
                          <FormLabel className="font-normal">Monthly Recurring</FormLabel>
                        </FormItem>
                      )}
                    />
                    {form.watch("isRecurring") && (
                      <FormField
                        control={form.control}
                        name="recurringDay"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>Recurring Day (1-28)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                max="28"
                                placeholder="15"
                                {...field}
                                data-testid="input-recurring-day"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="button-submit-invoice"
                    >
                      {(createMutation.isPending || updateMutation.isPending) && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {editingInvoice ? "Update Invoice" : "Create Invoice"}
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
          data={invoices}
          isLoading={isLoading}
          emptyMessage="No invoices found. Create your first invoice to get started."
        />
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this invoice? This action cannot be undone.
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

      <Dialog open={paymentInvoice !== null} onOpenChange={(open) => {
        if (!open) {
          setPaymentInvoice(null);
          paymentForm.reset();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {paymentInvoice && (
                <>Record payment for invoice {paymentInvoice.invoiceNumber} - Due: {formatCurrency(String(Number(paymentInvoice.total) - Number(paymentInvoice.paidAmount)))}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(handlePaymentSubmit)} className="space-y-4">
              <FormField
                control={paymentForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="10000" {...field} data-testid="input-payment-amount" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={paymentForm.control}
                  name="method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-payment-method">
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {paymentMethods.map((method) => (
                            <SelectItem key={method} value={method} className="capitalize">
                              {method.replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={paymentForm.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-payment-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={paymentForm.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Transaction ID or reference" {...field} data-testid="input-payment-reference" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={paymentForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Additional notes" {...field} data-testid="input-payment-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPaymentInvoice(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={paymentMutation.isPending} data-testid="button-submit-payment">
                  {paymentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Record Payment
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
