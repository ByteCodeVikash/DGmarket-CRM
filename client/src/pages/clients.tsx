import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Plus,
  Search,
  Building2,
  MoreHorizontal,
  Trash2,
  Edit,
  Phone,
  Mail,
  Loader2,
  Settings,
  X,
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Client, Service, ClientService } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const clientFormSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  contactName: z.string().min(2, "Contact name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(10, "Phone number is required"),
  address: z.string().optional(),
  city: z.string().optional(),
  gstNumber: z.string().optional(),
  contractStartDate: z.string().optional(),
  contractEndDate: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientFormSchema>;

export default function ClientsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [managingServicesClient, setManagingServicesClient] = useState<Client | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const buildClientsUrl = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.append("search", searchQuery);
    const queryString = params.toString();
    return queryString ? `/api/clients?${queryString}` : "/api/clients";
  };

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients", searchQuery],
    queryFn: async () => {
      const res = await fetch(buildClientsUrl(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });

  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  const { data: clientServices = [], refetch: refetchClientServices } = useQuery<ClientService[]>({
    queryKey: ["/api/client-services", managingServicesClient?.id],
    queryFn: async () => {
      if (!managingServicesClient) return [];
      const res = await fetch(`/api/client-services?clientId=${managingServicesClient.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch client services");
      return res.json();
    },
    enabled: !!managingServicesClient,
  });

  const addServiceMutation = useMutation({
    mutationFn: async ({ clientId, serviceId }: { clientId: string; serviceId: string }) => {
      const response = await apiRequest("POST", "/api/client-services", { clientId, serviceId, status: "active" });
      return response.json();
    },
    onSuccess: () => {
      refetchClientServices();
      setSelectedServiceId("");
      toast({ title: "Service added", description: "Service has been assigned to the client." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/client-services/${id}`);
    },
    onSuccess: () => {
      refetchClientServices();
      toast({ title: "Service removed", description: "Service has been removed from the client." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateServiceStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/client-services/${id}`, { status });
      return response.json();
    },
    onSuccess: () => {
      refetchClientServices();
      toast({ title: "Status updated", description: "Service status has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      companyName: "",
      contactName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      gstNumber: "",
      contractStartDate: "",
      contractEndDate: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      const response = await apiRequest("POST", "/api/clients", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setIsCreateOpen(false);
      form.reset();
      toast({ title: "Client created", description: "New client has been added successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ClientFormData }) => {
      const response = await apiRequest("PATCH", `/api/clients/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setEditingClient(null);
      form.reset();
      toast({ title: "Client updated", description: "Client has been updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setDeleteId(null);
      toast({ title: "Client deleted", description: "Client has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (data: ClientFormData) => {
    const cleanedData = {
      ...data,
      contractStartDate: data.contractStartDate || undefined,
      contractEndDate: data.contractEndDate || undefined,
    };
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, data: cleanedData });
    } else {
      createMutation.mutate(cleanedData);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    form.reset({
      companyName: client.companyName,
      contactName: client.contactName,
      email: client.email,
      phone: client.phone,
      address: client.address || "",
      city: client.city || "",
      gstNumber: client.gstNumber || "",
      contractStartDate: client.contractStartDate || "",
      contractEndDate: client.contractEndDate || "",
    });
  };

  const columns = [
    {
      key: "company",
      header: "Company",
      cell: (client: Client) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-medium">{client.companyName}</p>
            <p className="text-xs text-muted-foreground">{client.contactName}</p>
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      cell: (client: Client) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-sm">
            <Mail className="h-3 w-3 text-muted-foreground" />
            {client.email}
          </div>
          <div className="flex items-center gap-1 text-sm">
            <Phone className="h-3 w-3 text-muted-foreground" />
            {client.phone}
          </div>
        </div>
      ),
    },
    {
      key: "city",
      header: "City",
      cell: (client: Client) => (
        <span className="text-muted-foreground">{client.city || "-"}</span>
      ),
    },
    {
      key: "contract",
      header: "Contract",
      cell: (client: Client) => (
        <div className="text-sm">
          {client.contractStartDate ? (
            <span className="text-muted-foreground">
              {format(new Date(client.contractStartDate), "MMM d, yyyy")}
              {client.contractEndDate && (
                <> - {format(new Date(client.contractEndDate), "MMM d, yyyy")}</>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (client: Client) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid={`button-actions-${client.id}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(client)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setManagingServicesClient(client)}
              data-testid={`button-manage-services-${client.id}`}
            >
              <Settings className="mr-2 h-4 w-4" />
              Manage Services
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => setDeleteId(client.id)}
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

  const isFormOpen = isCreateOpen || editingClient !== null;

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Clients"
        description="Manage your client relationships"
        actions={
          <Dialog open={isFormOpen} onOpenChange={(open) => {
            if (!open) {
              setIsCreateOpen(false);
              setEditingClient(null);
              form.reset();
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateOpen(true)} data-testid="button-add-client">
                <Plus className="mr-2 h-4 w-4" />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingClient ? "Edit Client" : "Add New Client"}</DialogTitle>
                <DialogDescription>
                  {editingClient ? "Update the client information below." : "Enter the client details below."}
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Acme Inc." {...field} data-testid="input-client-company" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contactName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} data-testid="input-client-contact" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="john@acme.com" {...field} data-testid="input-client-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="+91 9876543210" {...field} data-testid="input-client-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Business St" {...field} data-testid="input-client-address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="Mumbai" {...field} data-testid="input-client-city" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="gstNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GST Number</FormLabel>
                          <FormControl>
                            <Input placeholder="27XXXXX1234X1Z5" {...field} data-testid="input-client-gst" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="contractStartDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contract Start</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-client-start" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contractEndDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contract End</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-client-end" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="button-submit-client"
                    >
                      {(createMutation.isPending || updateMutation.isPending) && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {editingClient ? "Update Client" : "Create Client"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex-1 space-y-4 p-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-clients"
          />
        </div>

        <DataTable
          columns={columns}
          data={clients}
          isLoading={isLoading}
          emptyMessage="No clients found. Add your first client to get started."
        />
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this client? This action cannot be undone.
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

      <Dialog 
        open={managingServicesClient !== null} 
        onOpenChange={(open) => !open && setManagingServicesClient(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Services</DialogTitle>
            <DialogDescription>
              Assign and manage services for {managingServicesClient?.companyName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex gap-2">
              <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                <SelectTrigger className="flex-1" data-testid="select-service">
                  <SelectValue placeholder="Select a service to add" />
                </SelectTrigger>
                <SelectContent>
                  {services
                    .filter(s => !clientServices.some(cs => cs.serviceId === s.id))
                    .map(service => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => managingServicesClient && selectedServiceId && 
                  addServiceMutation.mutate({ clientId: managingServicesClient.id, serviceId: selectedServiceId })}
                disabled={!selectedServiceId || addServiceMutation.isPending}
                data-testid="button-add-service"
              >
                {addServiceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Assigned Services</h4>
              {clientServices.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No services assigned yet</p>
              ) : (
                <div className="space-y-2">
                  {clientServices.map(cs => {
                    const service = services.find(s => s.id === cs.serviceId);
                    return (
                      <div key={cs.id} className="flex items-center justify-between p-3 border rounded-md">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{service?.name || "Unknown Service"}</span>
                          <Select 
                            value={cs.status} 
                            onValueChange={(status) => updateServiceStatusMutation.mutate({ id: cs.id, status })}
                          >
                            <SelectTrigger className="w-28 h-7" data-testid={`select-status-${cs.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="paused">Paused</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => removeServiceMutation.mutate(cs.id)}
                          data-testid={`button-remove-service-${cs.id}`}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
