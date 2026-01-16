import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isPast } from "date-fns";
import {
  Plus,
  Calendar,
  Check,
  Clock,
  Phone,
  MessageCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FollowUp, Lead } from "@shared/schema";
import { cn } from "@/lib/utils";

const followUpSchema = z.object({
  leadId: z.string().min(1, "Please select a lead"),
  scheduledAt: z.string().min(1, "Please select date and time"),
  notes: z.string().optional(),
});

type FollowUpForm = z.infer<typeof followUpSchema>;

interface FollowUpWithLead extends FollowUp {
  lead?: Lead;
}

export default function FollowUpsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: followUps = [], isLoading } = useQuery<FollowUpWithLead[]>({
    queryKey: ["/api/follow-ups"],
  });

  const { data: leadsResponse } = useQuery<{ data: Lead[]; pagination: any }>({
    queryKey: ["/api/leads"],
  });
  const leads = leadsResponse?.data || [];

  const form = useForm<FollowUpForm>({
    resolver: zodResolver(followUpSchema),
    defaultValues: {
      leadId: "",
      scheduledAt: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FollowUpForm) => {
      const response = await apiRequest("POST", "/api/follow-ups", {
        ...data,
        scheduledAt: new Date(data.scheduledAt).toISOString(),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/follow-ups"] });
      setIsCreateOpen(false);
      form.reset();
      toast({ title: "Follow-up scheduled", description: "Your follow-up has been added to the calendar." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PATCH", `/api/follow-ups/${id}`, { isCompleted: true });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/follow-ups"] });
      toast({ title: "Follow-up completed", description: "The follow-up has been marked as done." });
    },
  });

  const handleSubmit = (data: FollowUpForm) => {
    const cleanedData: any = { ...data };
    if (!cleanedData.leadId) delete cleanedData.leadId;
    createMutation.mutate(cleanedData);
  };

  const handleWhatsApp = (mobile: string) => {
    window.open(`https://wa.me/${mobile.replace(/\D/g, "")}`, "_blank");
  };

  const handleCall = (mobile: string) => {
    window.open(`tel:${mobile}`, "_self");
  };

  const todayFollowUps = followUps.filter(
    (f) => !f.isCompleted && isToday(new Date(f.scheduledAt))
  );

  const missedFollowUps = followUps.filter(
    (f) => !f.isCompleted && isPast(new Date(f.scheduledAt)) && !isToday(new Date(f.scheduledAt))
  );

  const upcomingFollowUps = followUps.filter(
    (f) => !f.isCompleted && !isPast(new Date(f.scheduledAt))
  );

  const completedFollowUps = followUps.filter((f) => f.isCompleted);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getFollowUpsForDay = (day: Date) => {
    return followUps.filter((f) => isSameDay(new Date(f.scheduledAt), day));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const FollowUpCard = ({ followUp }: { followUp: FollowUpWithLead }) => (
    <Card className="hover-elevate" data-testid={`followup-card-${followUp.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-1">
            <p className="font-medium">{followUp.lead?.name || "Unknown Lead"}</p>
            <p className="text-sm text-muted-foreground">{followUp.lead?.mobile}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {format(new Date(followUp.scheduledAt), "MMM d, h:mm a")}
            </div>
            {followUp.notes && (
              <p className="text-sm text-muted-foreground mt-2">{followUp.notes}</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            {!followUp.isCompleted && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => followUp.lead && handleWhatsApp(followUp.lead.mobile)}
                >
                  <MessageCircle className="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => followUp.lead && handleCall(followUp.lead.mobile)}
                >
                  <Phone className="h-4 w-4 text-blue-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => completeMutation.mutate(followUp.id)}
                  disabled={completeMutation.isPending}
                >
                  <Check className="h-4 w-4 text-primary" />
                </Button>
              </>
            )}
            {followUp.isCompleted && (
              <Badge variant="secondary" className="text-xs">
                Done
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Follow-ups"
        description="Manage your scheduled calls and meetings"
        actions={
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-followup">
                <Plus className="mr-2 h-4 w-4" />
                Schedule Follow-up
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule Follow-up</DialogTitle>
                <DialogDescription>Set a reminder to follow up with a lead.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="leadId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lead</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-followup-lead">
                              <SelectValue placeholder="Select a lead" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {leads.map((lead) => (
                              <SelectItem key={lead.id} value={lead.id}>
                                {lead.name} - {lead.mobile}
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
                    name="scheduledAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date & Time</FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            {...field}
                            data-testid="input-followup-datetime"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Add any notes..."
                            {...field}
                            data-testid="input-followup-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-followup">
                      {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Schedule
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex-1 p-6">
        <Tabs defaultValue="list" className="space-y-4">
          <TabsList>
            <TabsTrigger value="list" data-testid="tab-list">List View</TabsTrigger>
            <TabsTrigger value="calendar" data-testid="tab-calendar">Calendar</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-6">
            {/* Missed Follow-ups */}
            {missedFollowUps.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-destructive" />
                  <h3 className="font-semibold text-destructive">Missed ({missedFollowUps.length})</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {missedFollowUps.map((followUp) => (
                    <FollowUpCard key={followUp.id} followUp={followUp} />
                  ))}
                </div>
              </div>
            )}

            {/* Today's Follow-ups */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Today ({todayFollowUps.length})</h3>
              </div>
              {todayFollowUps.length === 0 ? (
                <Card>
                  <CardContent className="flex h-24 items-center justify-center text-muted-foreground">
                    No follow-ups scheduled for today
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {todayFollowUps.map((followUp) => (
                    <FollowUpCard key={followUp.id} followUp={followUp} />
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming Follow-ups */}
            <div className="space-y-3">
              <h3 className="font-semibold">Upcoming ({upcomingFollowUps.length})</h3>
              {upcomingFollowUps.length === 0 ? (
                <Card>
                  <CardContent className="flex h-24 items-center justify-center text-muted-foreground">
                    No upcoming follow-ups
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {upcomingFollowUps.map((followUp) => (
                    <FollowUpCard key={followUp.id} followUp={followUp} />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="calendar">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{format(currentMonth, "MMMM yyyy")}</CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={prevMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={nextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                      {day}
                    </div>
                  ))}
                  {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                    <div key={`empty-${i}`} className="p-2" />
                  ))}
                  {daysInMonth.map((day) => {
                    const dayFollowUps = getFollowUpsForDay(day);
                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "min-h-[80px] rounded-lg border p-2",
                          isToday(day) && "bg-primary/5 border-primary",
                          isPast(day) && !isToday(day) && "opacity-50"
                        )}
                      >
                        <span className={cn(
                          "text-sm font-medium",
                          isToday(day) && "text-primary"
                        )}>
                          {format(day, "d")}
                        </span>
                        <div className="mt-1 space-y-1">
                          {dayFollowUps.slice(0, 2).map((f) => (
                            <div
                              key={f.id}
                              className={cn(
                                "truncate rounded px-1 py-0.5 text-xs",
                                f.isCompleted
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-primary/10 text-primary"
                              )}
                            >
                              {f.lead?.name || "Follow-up"}
                            </div>
                          ))}
                          {dayFollowUps.length > 2 && (
                            <span className="text-xs text-muted-foreground">
                              +{dayFollowUps.length - 2} more
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
