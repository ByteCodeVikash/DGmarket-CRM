import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MessageSquare, Copy, ExternalLink, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AIMessageGeneratorProps {
  leadId?: string;
  clientId?: string;
  leadName?: string;
  clientName?: string;
}

type MessageType = "whatsapp_followup" | "proposal_followup" | "payment_reminder" | "meeting_scheduling";
type LanguageStyle = "english" | "hindi_english_mixed";

const messageTypeLabels: Record<MessageType, string> = {
  whatsapp_followup: "WhatsApp Follow-up",
  proposal_followup: "Proposal Follow-up",
  payment_reminder: "Payment Reminder",
  meeting_scheduling: "Meeting Scheduling",
};

export function AIMessageGenerator({ leadId, clientId, leadName, clientName }: AIMessageGeneratorProps) {
  const { toast } = useToast();
  const [messageType, setMessageType] = useState<MessageType>("whatsapp_followup");
  const [languageStyle, setLanguageStyle] = useState<LanguageStyle>("english");
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [whatsappLink, setWhatsappLink] = useState("");

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/generate-message", {
        type: messageType,
        leadId,
        clientId,
        languageStyle,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedMessage(data.message);
      setWhatsappLink(data.whatsappLink);
      toast({ title: "Message generated!" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedMessage);
      toast({ title: "Copied to clipboard!" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const openWhatsApp = () => {
    if (whatsappLink) {
      window.open(whatsappLink, "_blank");
    }
  };

  const name = leadName || clientName || "Contact";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wand2 className="h-4 w-4" />
          AI Message Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Message Type</label>
            <Select
              value={messageType}
              onValueChange={(v) => setMessageType(v as MessageType)}
            >
              <SelectTrigger data-testid="select-message-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp_followup">WhatsApp Follow-up</SelectItem>
                <SelectItem value="proposal_followup">Proposal Follow-up</SelectItem>
                <SelectItem value="payment_reminder">Payment Reminder</SelectItem>
                <SelectItem value="meeting_scheduling">Meeting Scheduling</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Language Style</label>
            <Select
              value={languageStyle}
              onValueChange={(v) => setLanguageStyle(v as LanguageStyle)}
            >
              <SelectTrigger data-testid="select-language-style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="english">English</SelectItem>
                <SelectItem value="hindi_english_mixed">Hindi-English Mixed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="w-full"
          data-testid="button-generate-message"
        >
          {generateMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="mr-2 h-4 w-4" />
          )}
          Generate Message for {name}
        </Button>

        {generatedMessage && (
          <div className="space-y-3">
            <Textarea
              value={generatedMessage}
              onChange={(e) => setGeneratedMessage(e.target.value)}
              rows={5}
              className="resize-none"
              data-testid="textarea-generated-message"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={copyToClipboard}
                className="flex-1"
                data-testid="button-copy-message"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
              {whatsappLink && (
                <Button
                  onClick={openWhatsApp}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  data-testid="button-send-whatsapp"
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Send via WhatsApp
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
