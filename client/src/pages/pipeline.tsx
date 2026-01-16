import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isPast, isFuture } from "date-fns";
import {
  Phone,
  MessageCircle,
  Calendar,
  GripVertical,
  User,
  Filter,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Lead, User as UserType, FollowUp, pipelineStages, leadSources } from "@shared/schema";

const stageLabels: Record<string, string> = {
  new_lead: "New Lead",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal_sent: "Proposal Sent",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

const stageColors: Record<string, string> = {
  new_lead: "bg-blue-500",
  contacted: "bg-yellow-500",
  qualified: "bg-purple-500",
  proposal_sent: "bg-orange-500",
  negotiation: "bg-pink-500",
  won: "bg-green-500",
  lost: "bg-gray-500",
};

interface LeadWithRelations extends Lead {
  owner?: UserType;
  nextFollowUp?: FollowUp;
}

export default function PipelinePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const { data: leadsResponse, isLoading } = useQuery<{ data: Lead[]; pagination: any }>({
    queryKey: ["/api/leads"],
  });
  const leads = leadsResponse?.data || [];

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const { data: followUps = [] } = useQuery<FollowUp[]>({
    queryKey: ["/api/follow-ups"],
  });

  const usersMap = useMemo(() => {
    const map = new Map<string, UserType>();
    users.forEach((user) => map.set(user.id, user));
    return map;
  }, [users]);

  const nextFollowUpMap = useMemo(() => {
    const map = new Map<string, FollowUp>();
    const pendingFollowUps = followUps
      .filter((f) => !f.completedAt && f.scheduledAt)
      .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
    
    pendingFollowUps.forEach((followUp) => {
      if (followUp.leadId && !map.has(followUp.leadId)) {
        map.set(followUp.leadId, followUp);
      }
    });
    return map;
  }, [followUps]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (ownerFilter !== "all" && lead.ownerId !== ownerFilter) return false;
      if (sourceFilter !== "all" && lead.source !== sourceFilter) return false;
      return true;
    });
  }, [leads, ownerFilter, sourceFilter]);

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const response = await apiRequest("PATCH", `/api/leads/${id}`, { pipelineStage: stage });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Lead updated", description: "Pipeline stage has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    if (draggedLead && draggedLead.pipelineStage !== stage) {
      updateStageMutation.mutate({ id: draggedLead.id, stage });
    }
    setDraggedLead(null);
  };

  const handleTouchStart = (lead: Lead) => {
    setDraggedLead(lead);
  };

  const handleTouchEnd = (stage: string) => {
    if (draggedLead && draggedLead.pipelineStage !== stage) {
      updateStageMutation.mutate({ id: draggedLead.id, stage });
    }
    setDraggedLead(null);
  };

  const handleWhatsApp = (mobile: string) => {
    window.open(`https://wa.me/${mobile.replace(/\D/g, "")}`, "_blank");
  };

  const handleCall = (mobile: string) => {
    window.open(`tel:${mobile}`, "_self");
  };

  const getLeadsByStage = (stage: string) => {
    return filteredLeads.filter((lead) => lead.pipelineStage === stage);
  };

  const clearFilters = () => {
    setOwnerFilter("all");
    setSourceFilter("all");
  };

  const hasActiveFilters = ownerFilter !== "all" || sourceFilter !== "all";

  if (isLoading) {
    return (
      <div className="flex flex-col">
        <PageHeader title="Pipeline" description="Drag and drop leads through your sales funnel" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="animate-pulse text-muted-foreground">Loading pipeline...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Pipeline"
        description="Drag and drop leads through your sales funnel"
      />

      <div className="flex flex-wrap items-center gap-3 px-6 pb-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filters:</span>
        </div>
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-pipeline-owner-filter">
            <SelectValue placeholder="Filter by owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Owners</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-pipeline-source-filter">
            <SelectValue placeholder="Filter by source" />
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
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="gap-1"
            data-testid="button-clear-pipeline-filters"
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
        <div className="text-sm text-muted-foreground ml-auto">
          {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex gap-4 p-6 pt-0 min-w-max">
          {pipelineStages.map((stage) => {
            const stageLeads = getLeadsByStage(stage);
            return (
              <div
                key={stage}
                className="flex flex-col w-[300px] flex-shrink-0"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage)}
                onTouchEnd={() => draggedLead && handleTouchEnd(stage)}
                data-testid={`pipeline-stage-${stage}`}
              >
                <Card className="flex flex-col h-full bg-muted/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${stageColors[stage]}`} />
                        <CardTitle className="text-sm font-medium">
                          {stageLabels[stage]}
                        </CardTitle>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {stageLeads.length}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-3 pt-0 max-h-[calc(100vh-280px)] overflow-y-auto">
                    {stageLeads.length === 0 ? (
                      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                        No leads
                      </div>
                    ) : (
                      stageLeads.map((lead) => {
                        const owner = lead.ownerId ? usersMap.get(lead.ownerId) : undefined;
                        const nextFollowUp = nextFollowUpMap.get(lead.id);
                        const followUpDate = nextFollowUp?.scheduledAt ? new Date(nextFollowUp.scheduledAt) : null;
                        const isOverdue = followUpDate && isPast(followUpDate);

                        return (
                          <Card
                            key={lead.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, lead)}
                            onTouchStart={() => handleTouchStart(lead)}
                            className="cursor-grab active:cursor-grabbing hover-elevate touch-manipulation"
                            data-testid={`pipeline-card-${lead.id}`}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start gap-2">
                                <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                                      <User className="h-3.5 w-3.5 text-primary" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-sm truncate" data-testid={`lead-name-${lead.id}`}>
                                        {lead.name}
                                      </p>
                                      <p className="text-xs text-muted-foreground truncate" data-testid={`lead-phone-${lead.id}`}>
                                        {lead.mobile}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap gap-1">
                                    <Badge variant="secondary" className="text-xs capitalize" data-testid={`lead-source-${lead.id}`}>
                                      {lead.source}
                                    </Badge>
                                    <Badge 
                                      className={`text-xs ${
                                        (lead as any).score === "hot" 
                                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" 
                                          : (lead as any).score === "cold" 
                                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                          : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                      }`}
                                      data-testid={`lead-temp-${lead.id}`}
                                    >
                                      {((lead as any).score || "warm").toUpperCase()}
                                    </Badge>
                                    {owner && (
                                      <Badge variant="outline" className="text-xs" data-testid={`lead-owner-${lead.id}`}>
                                        <User className="h-2.5 w-2.5 mr-1" />
                                        {owner.name}
                                      </Badge>
                                    )}
                                  </div>

                                  {nextFollowUp && followUpDate && (
                                    <div 
                                      className={`flex items-center gap-1 text-xs ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}
                                      data-testid={`lead-followup-${lead.id}`}
                                    >
                                      <Calendar className="h-3 w-3" />
                                      <span>
                                        {isOverdue ? "Overdue: " : "Next: "}
                                        {format(followUpDate, "MMM d, h:mm a")}
                                      </span>
                                    </div>
                                  )}

                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleWhatsApp(lead.mobile);
                                      }}
                                      data-testid={`button-whatsapp-${lead.id}`}
                                    >
                                      <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCall(lead.mobile);
                                      }}
                                      data-testid={`button-call-${lead.id}`}
                                    >
                                      <Phone className="h-3.5 w-3.5 text-blue-600" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
