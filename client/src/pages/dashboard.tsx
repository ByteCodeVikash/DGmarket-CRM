import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Users,
  UserCheck,
  PhoneCall,
  DollarSign,
  TrendingUp,
  Clock,
  Calendar,
  ArrowUpRight,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatsCard } from "@/components/stats-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
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
} from "recharts";

interface DashboardStats {
  totalLeads: number;
  todayFollowUps: number;
  convertedClients: number;
  totalRevenue: number;
  pendingPayments: number;
  activeTeamMembers: number;
  recentLeads: Array<{
    id: string;
    name: string;
    source: string;
    status: string;
    createdAt: string;
  }>;
  upcomingFollowUps: Array<{
    id: string;
    leadName: string;
    scheduledAt: string;
  }>;
  monthlyLeads: Array<{ month: string; count: number }>;
  leadsBySource: Array<{ source: string; count: number }>;
  conversionRate: number;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"];

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here's an overview of your business."
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatsCard
            title="Total Leads"
            value={stats?.totalLeads || 0}
            icon={Users}
            trend={{ value: 12, isPositive: true }}
          />
          <StatsCard
            title="Today's Follow-ups"
            value={stats?.todayFollowUps || 0}
            icon={PhoneCall}
          />
          <StatsCard
            title="Converted Clients"
            value={stats?.convertedClients || 0}
            icon={UserCheck}
            trend={{ value: 8, isPositive: true }}
          />
          <StatsCard
            title="Total Revenue"
            value={formatCurrency(stats?.totalRevenue || 0)}
            icon={DollarSign}
            trend={{ value: 15, isPositive: true }}
          />
          <StatsCard
            title="Pending Payments"
            value={formatCurrency(stats?.pendingPayments || 0)}
            icon={Clock}
          />
          <StatsCard
            title="Conversion Rate"
            value={`${stats?.conversionRate || 0}%`}
            icon={TrendingUp}
          />
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Monthly Leads Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Lead Trends</CardTitle>
              <CardDescription>Monthly lead acquisition over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={stats?.monthlyLeads || []}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="leadGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="month"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      className="fill-muted-foreground"
                    />
                    <YAxis
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      className="fill-muted-foreground"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#leadGradient)"
                    />
                  </AreaChart>
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
              <div className="flex h-[280px] items-center gap-8">
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={stats?.leadsBySource || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="count"
                      >
                        {stats?.leadsBySource?.map((_, index) => (
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
                  {stats?.leadsBySource?.map((item, index) => (
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

        {/* Recent Activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Leads */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold">Recent Leads</CardTitle>
                <CardDescription>Latest leads added to the system</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/leads" data-testid="link-view-all-leads">
                  View All
                  <ArrowUpRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats?.recentLeads?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No leads yet. Start adding leads to see them here.
                  </p>
                ) : (
                  stats?.recentLeads?.map((lead) => (
                    <div
                      key={lead.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                      data-testid={`lead-item-${lead.id}`}
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{lead.name}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs capitalize">
                            {lead.source}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(lead.createdAt), "MMM d, h:mm a")}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant={lead.status === "new" ? "default" : "secondary"}
                        className="capitalize"
                      >
                        {lead.status.replace("_", " ")}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Follow-ups */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold">Upcoming Follow-ups</CardTitle>
                <CardDescription>Scheduled calls and meetings</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/follow-ups" data-testid="link-view-all-followups">
                  View All
                  <ArrowUpRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats?.upcomingFollowUps?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No upcoming follow-ups scheduled.
                  </p>
                ) : (
                  stats?.upcomingFollowUps?.map((followUp) => (
                    <div
                      key={followUp.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                          <Calendar className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{followUp.leadName}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(followUp.scheduledAt), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
