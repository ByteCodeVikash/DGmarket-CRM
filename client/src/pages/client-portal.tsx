import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Receipt,
  Download,
  FileText,
  BarChart3,
  Loader2,
  Building2,
  Calendar,
  DollarSign,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatsCard } from "@/components/stats-card";
import { useAuth } from "@/hooks/use-auth";
import { Invoice, Quotation } from "@shared/schema";

interface PortalData {
  invoices: Invoice[];
  quotations: Quotation[];
  totalSpent: number;
  pendingPayments: number;
  activeServices: number;
}

export default function ClientPortalPage() {
  const { user } = useAuth();

  const { data: portalData, isLoading } = useQuery<PortalData>({
    queryKey: ["/api/portal/data"],
  });

  const formatCurrency = (value: number | string) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(value));
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      paid: "default",
      sent: "secondary",
      draft: "outline",
      overdue: "destructive",
      cancelled: "outline",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const handleDownloadInvoice = (invoiceId: string) => {
    window.open(`/api/invoices/${invoiceId}/pdf`, "_blank");
  };

  const handleDownloadQuotation = (quotationId: string) => {
    window.open(`/api/quotations/${quotationId}/pdf`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="flex flex-col">
        <PageHeader title="Client Portal" description="Welcome to your client dashboard" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Client Portal"
        description={`Welcome back, ${user?.name || "Client"}! View your invoices, quotations, and account summary.`}
      />

      <div className="flex-1 space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatsCard
            title="Total Spent"
            value={formatCurrency(portalData?.totalSpent || 0)}
            icon={DollarSign}
          />
          <StatsCard
            title="Pending Payments"
            value={formatCurrency(portalData?.pendingPayments || 0)}
            icon={Receipt}
          />
          <StatsCard
            title="Active Services"
            value={portalData?.activeServices || 0}
            icon={Building2}
          />
        </div>

        <Tabs defaultValue="invoices" className="space-y-4">
          <TabsList>
            <TabsTrigger value="invoices" data-testid="tab-portal-invoices">
              <Receipt className="mr-2 h-4 w-4" />
              Invoices
            </TabsTrigger>
            <TabsTrigger value="quotations" data-testid="tab-portal-quotations">
              <FileText className="mr-2 h-4 w-4" />
              Quotations
            </TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-portal-reports">
              <BarChart3 className="mr-2 h-4 w-4" />
              Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle>Your Invoices</CardTitle>
                <CardDescription>View and download your invoices</CardDescription>
              </CardHeader>
              <CardContent>
                {portalData?.invoices && portalData.invoices.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {portalData.invoices.map((invoice) => (
                        <TableRow key={invoice.id} data-testid={`portal-invoice-${invoice.id}`}>
                          <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                          <TableCell>
                            {invoice.createdAt && format(new Date(invoice.createdAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            {invoice.dueDate && format(new Date(invoice.dueDate), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>{formatCurrency(invoice.total)}</TableCell>
                          <TableCell>{formatCurrency(invoice.paidAmount)}</TableCell>
                          <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadInvoice(invoice.id)}
                              data-testid={`button-download-invoice-${invoice.id}`}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Receipt className="h-10 w-10 mb-2" />
                    <p>No invoices found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quotations">
            <Card>
              <CardHeader>
                <CardTitle>Your Quotations</CardTitle>
                <CardDescription>View and download your quotations</CardDescription>
              </CardHeader>
              <CardContent>
                {portalData?.quotations && portalData.quotations.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quotation #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Valid Until</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {portalData.quotations.map((quotation) => (
                        <TableRow key={quotation.id} data-testid={`portal-quotation-${quotation.id}`}>
                          <TableCell className="font-medium">{quotation.quotationNumber}</TableCell>
                          <TableCell>
                            {quotation.createdAt && format(new Date(quotation.createdAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            {quotation.validUntil && format(new Date(quotation.validUntil), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>{formatCurrency(quotation.total)}</TableCell>
                          <TableCell>
                            <Badge variant={quotation.status === "accepted" ? "default" : "secondary"}>
                              {quotation.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadQuotation(quotation.id)}
                              data-testid={`button-download-quotation-${quotation.id}`}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <FileText className="h-10 w-10 mb-2" />
                    <p>No quotations found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>Account Summary</CardTitle>
                <CardDescription>Overview of your account activity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <Receipt className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Invoices</p>
                        <p className="text-2xl font-bold">{portalData?.invoices?.length || 0}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-2">
                        <DollarSign className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Paid Invoices</p>
                        <p className="text-2xl font-bold">
                          {portalData?.invoices?.filter((i) => i.status === "paid").length || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-amber-100 dark:bg-amber-900/30 p-2">
                        <Calendar className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Pending Invoices</p>
                        <p className="text-2xl font-bold">
                          {portalData?.invoices?.filter((i) => i.status !== "paid" && i.status !== "cancelled").length || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Quotations</p>
                        <p className="text-2xl font-bold">{portalData?.quotations?.length || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
