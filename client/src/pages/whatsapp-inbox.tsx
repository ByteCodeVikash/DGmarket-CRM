import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  MessageSquare,
  Search,
  Send,
  Phone,
  User,
  Plus,
  MoreVertical,
  ExternalLink,
  StickyNote,
  Tag,
  UserPlus,
  Check,
  Loader2,
  Flame,
  Thermometer,
  Snowflake,
  Archive,
  Trash2,
  Copy,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WhatsappConversation, WhatsappMessage, User as UserType, Lead, Client, QuickReplyTemplate } from "@shared/schema";

type EnrichedConversation = WhatsappConversation & {
  lead?: Lead | null;
  client?: Client | null;
  assignedUser?: UserType | null;
};

type EnrichedMessage = WhatsappMessage & {
  sentByUser?: UserType | null;
};

export default function WhatsAppInboxPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [isNote, setIsNote] = useState(false);
  const [isInbound, setIsInbound] = useState(false);
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateContent, setNewTemplateContent] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<EnrichedConversation[]>({
    queryKey: ["/api/whatsapp/conversations"],
  });

  const { data: conversationData, isLoading: messagesLoading } = useQuery<{
    conversation: WhatsappConversation;
    messages: EnrichedMessage[];
  }>({
    queryKey: ["/api/whatsapp/conversations", selectedConversationId],
    enabled: !!selectedConversationId,
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const { data: templates = [] } = useQuery<QuickReplyTemplate[]>({
    queryKey: ["/api/whatsapp/templates"],
  });

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { conversationId: string; content: string; direction: string; isNote: boolean }) => {
      return apiRequest("POST", "/api/whatsapp/messages", data);
    },
    onSuccess: () => {
      setMessageInput("");
      setIsNote(false);
      qc.invalidateQueries({ queryKey: ["/api/whatsapp/conversations"] });
      qc.invalidateQueries({ queryKey: ["/api/whatsapp/conversations", selectedConversationId] });
    },
    onError: (error: any) => {
      toast({ title: "Error sending message", description: error.message, variant: "destructive" });
    },
  });

  const createConversationMutation = useMutation({
    mutationFn: async (data: { phone: string; contactName?: string }) => {
      const response = await apiRequest("POST", "/api/whatsapp/conversations", data);
      return response as unknown as WhatsappConversation;
    },
    onSuccess: (newConv: WhatsappConversation) => {
      setIsNewConversationOpen(false);
      setNewPhone("");
      setNewContactName("");
      setSelectedConversationId(newConv.id);
      qc.invalidateQueries({ queryKey: ["/api/whatsapp/conversations"] });
      toast({ title: "Conversation created" });
    },
    onError: (error: any) => {
      toast({ title: "Error creating conversation", description: error.message, variant: "destructive" });
    },
  });

  const updateConversationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WhatsappConversation> }) => {
      return apiRequest("PATCH", `/api/whatsapp/conversations/${id}`, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/whatsapp/conversations"] });
      toast({ title: "Conversation updated" });
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/whatsapp/conversations/${id}`);
    },
    onSuccess: () => {
      setSelectedConversationId(null);
      qc.invalidateQueries({ queryKey: ["/api/whatsapp/conversations"] });
      toast({ title: "Conversation deleted" });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/whatsapp/conversations/${id}/read`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/whatsapp/conversations"] });
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: { name: string; content: string }) => {
      return apiRequest("POST", "/api/whatsapp/templates", data);
    },
    onSuccess: () => {
      setNewTemplateName("");
      setNewTemplateContent("");
      qc.invalidateQueries({ queryKey: ["/api/whatsapp/templates"] });
      toast({ title: "Template created" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/whatsapp/templates/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/whatsapp/templates"] });
      toast({ title: "Template deleted" });
    },
  });

  const handleSendMessage = () => {
    if (!selectedConversationId || !messageInput.trim()) return;
    sendMessageMutation.mutate({
      conversationId: selectedConversationId,
      content: messageInput.trim(),
      direction: isInbound ? "in" : "out",
      isNote,
    });
  };

  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
    const conv = conversations.find(c => c.id === id);
    if (conv && conv.unreadCount > 0) {
      markAsReadMutation.mutate(id);
    }
  };

  const openWhatsAppLink = (phone: string, message?: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const url = message 
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/${cleanPhone}`;
    window.open(url, "_blank");
  };

  const getTagIcon = (tag: string | null) => {
    switch (tag) {
      case "hot": return <Flame className="h-3 w-3 text-red-500" />;
      case "cold": return <Snowflake className="h-3 w-3 text-blue-500" />;
      default: return <Thermometer className="h-3 w-3 text-yellow-500" />;
    }
  };

  const getTagColor = (tag: string | null) => {
    switch (tag) {
      case "hot": return "destructive";
      case "cold": return "secondary";
      default: return "outline";
    }
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      conv.phone.includes(query) ||
      conv.contactName?.toLowerCase().includes(query) ||
      conv.lastMessagePreview?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="WhatsApp Inbox"
        description="Manage customer conversations"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsTemplatesOpen(true)} data-testid="button-templates">
              <StickyNote className="mr-2 h-4 w-4" />
              Templates
            </Button>
            <Button onClick={() => setIsNewConversationOpen(true)} data-testid="button-new-conversation">
              <Plus className="mr-2 h-4 w-4" />
              New Conversation
            </Button>
          </div>
        }
      />

      <div className="flex-1 flex gap-4 p-6 overflow-hidden">
        <Card className="w-80 flex flex-col">
          <CardHeader className="pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-conversations"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full">
              {conversationsLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No conversations yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredConversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`p-3 cursor-pointer hover-elevate ${
                        selectedConversationId === conv.id ? "bg-accent" : ""
                      }`}
                      onClick={() => handleSelectConversation(conv.id)}
                      data-testid={`conversation-item-${conv.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {(conv.contactName || conv.phone).charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate">
                              {conv.contactName || conv.phone}
                            </span>
                            <div className="flex items-center gap-1">
                              {getTagIcon(conv.tag)}
                              {conv.unreadCount > 0 && (
                                <Badge variant="default" className="h-5 min-w-5 justify-center">
                                  {conv.unreadCount}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {conv.lastMessagePreview || "No messages yet"}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {conv.lead && (
                              <Badge variant="outline" className="text-xs">Lead</Badge>
                            )}
                            {conv.client && (
                              <Badge variant="outline" className="text-xs">Client</Badge>
                            )}
                            {conv.lastMessageAt && (
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(conv.lastMessageAt), "MMM d, h:mm a")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="flex-1 flex flex-col">
          {!selectedConversationId ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Select a conversation to view messages</p>
                <p className="text-sm">or start a new conversation</p>
              </div>
            </div>
          ) : (
            <>
              <CardHeader className="border-b pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {(selectedConversation?.contactName || selectedConversation?.phone || "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base">
                        {selectedConversation?.contactName || selectedConversation?.phone}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        {selectedConversation?.phone}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectedConversation && openWhatsAppLink(selectedConversation.phone)}
                      data-testid="button-open-whatsapp"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open WhatsApp
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid="button-conversation-actions">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => updateConversationMutation.mutate({ 
                          id: selectedConversationId, 
                          data: { tag: "hot" }
                        })}>
                          <Flame className="mr-2 h-4 w-4 text-red-500" />
                          Mark as Hot
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateConversationMutation.mutate({ 
                          id: selectedConversationId, 
                          data: { tag: "warm" }
                        })}>
                          <Thermometer className="mr-2 h-4 w-4 text-yellow-500" />
                          Mark as Warm
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateConversationMutation.mutate({ 
                          id: selectedConversationId, 
                          data: { tag: "cold" }
                        })}>
                          <Snowflake className="mr-2 h-4 w-4 text-blue-500" />
                          Mark as Cold
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Assign to Team Member
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => updateConversationMutation.mutate({ 
                          id: selectedConversationId, 
                          data: { isArchived: true }
                        })}>
                          <Archive className="mr-2 h-4 w-4" />
                          Archive
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => deleteConversationMutation.mutate(selectedConversationId)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {selectedConversation?.assignedUser && (
                  <Badge variant="outline" className="w-fit mt-2">
                    <User className="mr-1 h-3 w-3" />
                    Assigned to {selectedConversation.assignedUser.name}
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="flex-1 p-0 overflow-hidden">
                <ScrollArea className="h-full p-4">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : conversationData?.messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {conversationData?.messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.direction === "out" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg p-3 ${
                              msg.isNote
                                ? "bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700"
                                : msg.direction === "out"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                            data-testid={`message-${msg.id}`}
                          >
                            {msg.isNote && (
                              <div className="flex items-center gap-1 text-xs text-yellow-700 dark:text-yellow-400 mb-1">
                                <StickyNote className="h-3 w-3" />
                                Internal Note
                              </div>
                            )}
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            <div className={`flex items-center gap-2 mt-1 text-xs ${
                              msg.direction === "out" && !msg.isNote ? "text-primary-foreground/70" : "text-muted-foreground"
                            }`}>
                              <span>{format(new Date(msg.sentAt), "h:mm a")}</span>
                              {msg.sentByUser && <span>by {msg.sentByUser.name}</span>}
                              {msg.direction === "out" && msg.status === "sent" && (
                                <Check className="h-3 w-3" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>

              <div className="border-t p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Button
                    variant={isInbound ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setIsInbound(!isInbound);
                      if (!isInbound) setIsNote(false);
                    }}
                    data-testid="button-toggle-inbound"
                  >
                    {isInbound ? (
                      <>
                        <ArrowDownLeft className="mr-2 h-4 w-4" />
                        Log Inbound
                      </>
                    ) : (
                      <>
                        <ArrowUpRight className="mr-2 h-4 w-4" />
                        Outbound
                      </>
                    )}
                  </Button>
                  <Button
                    variant={isNote ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setIsNote(!isNote);
                      if (!isNote) setIsInbound(false);
                    }}
                    data-testid="button-toggle-note"
                  >
                    <StickyNote className="mr-2 h-4 w-4" />
                    {isNote ? "Adding Note" : "Add Note"}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="button-quick-reply">
                        Quick Reply
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {templates.length === 0 ? (
                        <DropdownMenuItem disabled>No templates yet</DropdownMenuItem>
                      ) : (
                        templates.map((template) => (
                          <DropdownMenuItem
                            key={template.id}
                            onClick={() => setMessageInput(template.content)}
                          >
                            {template.name}
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {messageInput && !isNote && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectedConversation && openWhatsAppLink(selectedConversation.phone, messageInput)}
                      data-testid="button-send-via-whatsapp"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Send via WhatsApp
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Textarea
                    placeholder={isNote ? "Add an internal note..." : "Type a message..."}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    className="resize-none"
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    data-testid="input-message"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || sendMessageMutation.isPending}
                    data-testid="button-send-message"
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      <Dialog open={isNewConversationOpen} onOpenChange={setIsNewConversationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
            <DialogDescription>
              Start a new WhatsApp conversation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Phone Number</label>
              <Input
                placeholder="e.g., 919876543210"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                data-testid="input-new-phone"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Include country code without + sign
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Contact Name (Optional)</label>
              <Input
                placeholder="e.g., John Doe"
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                data-testid="input-new-contact-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewConversationOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createConversationMutation.mutate({ 
                phone: newPhone, 
                contactName: newContactName || undefined 
              })}
              disabled={!newPhone || createConversationMutation.isPending}
              data-testid="button-create-conversation"
            >
              {createConversationMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTemplatesOpen} onOpenChange={setIsTemplatesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Quick Reply Templates</DialogTitle>
            <DialogDescription>
              Manage your quick reply templates for faster responses
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="Template name"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                data-testid="input-template-name"
              />
              <Textarea
                placeholder="Template content..."
                value={newTemplateContent}
                onChange={(e) => setNewTemplateContent(e.target.value)}
                rows={3}
                data-testid="input-template-content"
              />
              <Button
                onClick={() => createTemplateMutation.mutate({ 
                  name: newTemplateName, 
                  content: newTemplateContent 
                })}
                disabled={!newTemplateName || !newTemplateContent || createTemplateMutation.isPending}
                className="w-full"
                data-testid="button-create-template"
              >
                {createTemplateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add Template
              </Button>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Your Templates</h4>
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No templates yet</p>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div key={template.id} className="flex items-start justify-between gap-2 p-2 border rounded">
                      <div>
                        <p className="font-medium text-sm">{template.name}</p>
                        <p className="text-sm text-muted-foreground line-clamp-2">{template.content}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            navigator.clipboard.writeText(template.content);
                            toast({ title: "Copied to clipboard" });
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => deleteTemplateMutation.mutate(template.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
