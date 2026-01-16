import { useQuery } from "@tanstack/react-query";
import { format, subMonths } from "date-fns";
import {
  TrendingUp,
  Users,
  UserCheck,
  DollarSign,
  Loader2,
  Download,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatsCard } from "@/components/stats-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

interface ReportData {
  monthlyLeads: Array<{ month: string; leads: number; conversions: number }>;
  leadsBySource: Array<{ source: string; count: number }>;
  leadsByStatus: Array<{ status: string; count: number }>;
  revenueByMonth: Array<{ month: string; revenue: number }>;
  teamPerformance: Array<{ name: string; leads: number; conversions: number }>;
  totalLeads: number;
  totalClients: number;
  totalRevenue: number;
  conversionRate: number;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

export default function ReportsPage() {
  const { data: reportData, isLoading } = useQuery<ReportData>({
    queryKey: ["/api/reports"],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleExportCSV = (type: string) => {
    window.open(`/api/reports/export?type=${type}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="flex flex-col">
        <PageHeader title="Reports" description="Analytics and performance metrics" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Reports"
        description="Analytics and performance metrics"
        actions={
          <Button variant="outline" onClick={() => handleExportCSV("leads")} data-testid="button-export-csv">
            <Download className="mr-2 h-4 w-4" />
            Export Leads
          </Button>
        }
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Summary Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Leads"
            value={reportData?.totalLeads || 0}
            icon={Users}
            trend={{ value: 12, isPositive: true }}
          />
          <StatsCard
            title="Total Clients"
            value={reportData?.totalClients || 0}
            icon={UserCheck}
            trend={{ value: 8, isPositive: true }}
          />
          <StatsCard
            title="Total Revenue"
            value={formatCurrency(reportData?.totalRevenue || 0)}
            icon={DollarSign}
            trend={{ value: 15, isPositive: true }}
          />
          <StatsCard
            title="Conversion Rate"
            value={`${reportData?.conversionRate || 0}%`}
            icon={TrendingUp}
          />
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="leads" data-testid="tab-leads-report">Leads</TabsTrigger>
            <TabsTrigger value="revenue" data-testid="tab-revenue">Revenue</TabsTrigger>
            <TabsTrigger value="team" data-testid="tab-team-report">Team</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Monthly Leads & Conversions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Leads & Conversions</CardTitle>
                  <CardDescription>Monthly comparison</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportData?.monthlyLeads || []}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Legend />
                        <Bar dataKey="leads" name="Leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="conversions" name="Conversions" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Leads by Source */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Leads by Source</CardTitle>
                  <CardDescription>Distribution of lead sources</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex h-[300px] items-center gap-6">
                    <div className="flex-1">
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={reportData?.leadsBySource || []}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="count"
                          >
                            {reportData?.leadsBySource?.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                      {reportData?.leadsBySource?.map((item, index) => (
                        <div key={item.source} className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-sm capitalize">{item.source}</span>
                          <span className="text-sm font-medium ml-auto">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="leads" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Leads by Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Leads by Status</CardTitle>
                  <CardDescription>Current pipeline distribution</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportData?.leadsByStatus || []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis dataKey="status" type="category" fontSize={12} tickLine={false} axisLine={false} width={100} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Lead Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Lead Trend</CardTitle>
                  <CardDescription>Monthly lead acquisition</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={reportData?.monthlyLeads || []}>
                        <defs>
                          <linearGradient id="leadGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="leads"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          fill="url(#leadGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="revenue" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Revenue Trend</CardTitle>
                <CardDescription>Monthly revenue over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={reportData?.revenueByMonth || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `₹${value / 1000}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="hsl(var(--chart-2))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--chart-2))", strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Team Performance</CardTitle>
                <CardDescription>Leads and conversions by team member</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData?.teamPerformance || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Bar dataKey="leads" name="Leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="conversions" name="Conversions" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
