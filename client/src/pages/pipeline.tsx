import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Phone,
  MessageCircle,
  Calendar,
  GripVertical,
  User,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Lead, pipelineStages } from "@shared/schema";

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

export default function PipelinePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);

  const { data: leadsResponse, isLoading } = useQuery<{ data: Lead[]; pagination: any }>({
    queryKey: ["/api/leads"],
  });
  const leads = leadsResponse?.data || [];

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

  const handleWhatsApp = (mobile: string) => {
    window.open(`https://wa.me/${mobile.replace(/\D/g, "")}`, "_blank");
  };

  const handleCall = (mobile: string) => {
    window.open(`tel:${mobile}`, "_self");
  };

  const getLeadsByStage = (stage: string) => {
    return leads.filter((lead) => lead.pipelineStage === stage);
  };

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

      <ScrollArea className="flex-1">
        <div className="flex gap-4 p-6 min-w-max">
          {pipelineStages.map((stage) => {
            const stageLeads = getLeadsByStage(stage);
            return (
              <div
                key={stage}
                className="flex flex-col w-[300px] flex-shrink-0"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage)}
              >
                <Card className="flex flex-col h-full bg-muted/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
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
                  <CardContent className="flex-1 space-y-3 pt-0">
                    {stageLeads.length === 0 ? (
                      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                        No leads
                      </div>
                    ) : (
                      stageLeads.map((lead) => (
                        <Card
                          key={lead.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, lead)}
                          className="cursor-grab active:cursor-grabbing hover-elevate"
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
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm truncate">{lead.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{lead.mobile}</p>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <Badge variant="secondary" className="text-xs capitalize">
                                    {lead.source}
                                  </Badge>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleWhatsApp(lead.mobile);
                                      }}
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
                                    >
                                      <Phone className="h-3.5 w-3.5 text-blue-600" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
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
