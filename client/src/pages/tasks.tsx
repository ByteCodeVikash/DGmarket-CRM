import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Plus,
  CheckSquare,
  MoreHorizontal,
  Trash2,
  Edit,
  Loader2,
  Calendar,
  User,
  Check,
  Filter,
  X,
  Building2,
  UserCircle,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Task, User as UserType, Lead, Client, taskPriorities, taskStatuses } from "@shared/schema";
import { cn } from "@/lib/utils";

const taskFormSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().optional(),
  priority: z.string(),
  status: z.string(),
  dueDate: z.string().optional(),
  assigneeId: z.string().optional(),
  leadId: z.string().optional(),
  clientId: z.string().optional(),
});

type TaskFormData = z.infer<typeof taskFormSchema>;

interface TaskWithRelations extends Task {
  assignee?: UserType;
  lead?: Lead;
  client?: Client;
}

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function TasksPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showMyTasks, setShowMyTasks] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [dueDateFilter, setDueDateFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery<TaskWithRelations[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: currentUser } = useQuery<UserType>({
    queryKey: ["/api/user"],
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const { data: leadsResponse } = useQuery<{ data: Lead[]; pagination: any }>({
    queryKey: ["/api/leads"],
  });
  const leads = leadsResponse?.data || [];

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      status: "pending",
      dueDate: "",
      assigneeId: "",
      leadId: "",
      clientId: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      const dueDate = data.dueDate && data.dueDate.trim() 
        ? new Date(data.dueDate).toISOString() 
        : null;
      const response = await apiRequest("POST", "/api/tasks", {
        ...data,
        dueDate,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setIsCreateOpen(false);
      form.reset();
      toast({ title: "Task created", description: "New task has been added successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TaskFormData> }) => {
      const response = await apiRequest("PATCH", `/api/tasks/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setEditingTask(null);
      form.reset();
      toast({ title: "Task updated", description: "Task has been updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setDeleteId(null);
      toast({ title: "Task deleted", description: "Task has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (data: TaskFormData) => {
    const cleanedData: any = { ...data };
    if (!cleanedData.assigneeId) delete cleanedData.assigneeId;
    if (!cleanedData.leadId) delete cleanedData.leadId;
    if (!cleanedData.clientId) delete cleanedData.clientId;
    if (!cleanedData.dueDate) delete cleanedData.dueDate;
    if (editingTask) {
      updateMutation.mutate({ id: editingTask.id, data: cleanedData });
    } else {
      createMutation.mutate(cleanedData);
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    form.reset({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd'T'HH:mm") : "",
      assigneeId: task.assigneeId || "",
      leadId: task.leadId || "",
      clientId: task.clientId || "",
    });
  };

  const toggleComplete = (task: Task) => {
    const newStatus = task.status === "done" ? "pending" : "done";
    updateMutation.mutate({ id: task.id, data: { status: newStatus } });
  };

  // Apply filters
  const filterTasks = (taskList: TaskWithRelations[]) => {
    let filtered = taskList;
    
    // My Tasks filter
    if (showMyTasks && currentUser) {
      filtered = filtered.filter(t => t.assigneeId === currentUser.id);
    }
    
    // Assignee filter
    if (assigneeFilter !== "all") {
      filtered = filtered.filter(t => t.assigneeId === assigneeFilter);
    }
    
    // Due date filter
    if (dueDateFilter !== "all") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() + 7);
      
      filtered = filtered.filter(t => {
        if (!t.dueDate) return dueDateFilter === "no_date";
        const dueDate = new Date(t.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        
        switch (dueDateFilter) {
          case "overdue":
            return dueDate < today;
          case "today":
            return dueDate.getTime() === today.getTime();
          case "this_week":
            return dueDate >= today && dueDate <= weekEnd;
          case "no_date":
            return false;
          default:
            return true;
        }
      });
    }
    
    return filtered;
  };

  const filteredTasks = filterTasks(tasks);
  const pendingTasks = filteredTasks.filter((t) => t.status === "pending");
  const inProgressTasks = filteredTasks.filter((t) => t.status === "in_progress");
  const doneTasks = filteredTasks.filter((t) => t.status === "done");

  const hasActiveFilters = showMyTasks || assigneeFilter !== "all" || dueDateFilter !== "all";

  const clearFilters = () => {
    setShowMyTasks(false);
    setAssigneeFilter("all");
    setDueDateFilter("all");
  };

  const isFormOpen = isCreateOpen || editingTask !== null;

  const TaskCard = ({ task }: { task: TaskWithRelations }) => (
    <Card className={cn("hover-elevate", task.status === "done" && "opacity-60")} data-testid={`task-card-${task.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={task.status === "done"}
            onCheckedChange={() => toggleComplete(task)}
            className="mt-1"
          />
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className={cn("font-medium", task.status === "done" && "line-through")}>
                {task.title}
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEdit(task)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setDeleteId(task.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {task.description && (
              <p className="text-sm text-muted-foreground">{task.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={priorityColors[task.priority]} variant="secondary">
                {task.priority}
              </Badge>
              {task.dueDate && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(task.dueDate), "MMM d")}
                </div>
              )}
              {task.assignee && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  {task.assignee.name}
                </div>
              )}
              {task.lead && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <UserCircle className="h-3 w-3" />
                  {task.lead.name}
                </div>
              )}
              {task.client && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  {task.client.companyName}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Tasks"
        description="Manage your tasks and to-dos"
        actions={
          <Dialog open={isFormOpen} onOpenChange={(open) => {
            if (!open) {
              setIsCreateOpen(false);
              setEditingTask(null);
              form.reset();
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateOpen(true)} data-testid="button-add-task">
                <Plus className="mr-2 h-4 w-4" />
                Add Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingTask ? "Edit Task" : "Add New Task"}</DialogTitle>
                <DialogDescription>
                  {editingTask ? "Update the task information below." : "Enter the task details below."}
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Task title" {...field} data-testid="input-task-title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Task description..." {...field} data-testid="input-task-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-task-priority">
                                <SelectValue placeholder="Priority" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {taskPriorities.map((priority) => (
                                <SelectItem key={priority} value={priority} className="capitalize">
                                  {priority}
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
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-task-status">
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {taskStatuses.map((status) => (
                                <SelectItem key={status} value={status} className="capitalize">
                                  {status.replace("_", " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} data-testid="input-task-due" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="assigneeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assign To</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-task-assignee">
                              <SelectValue placeholder="Select team member" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="leadId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Link to Lead</FormLabel>
                          <Select 
                            onValueChange={(val) => field.onChange(val === "none" ? "" : val)} 
                            defaultValue={field.value || "none"}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-task-lead">
                                <SelectValue placeholder="Select lead (optional)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {leads.map((lead) => (
                                <SelectItem key={lead.id} value={lead.id}>
                                  {lead.name}
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
                      name="clientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Link to Client</FormLabel>
                          <Select 
                            onValueChange={(val) => field.onChange(val === "none" ? "" : val)} 
                            defaultValue={field.value || "none"}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-task-client">
                                <SelectValue placeholder="Select client (optional)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
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
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="button-submit-task"
                    >
                      {(createMutation.isPending || updateMutation.isPending) && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {editingTask ? "Update Task" : "Create Task"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex-1 p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant={showMyTasks ? "default" : "outline"}
            size="sm"
            onClick={() => setShowMyTasks(!showMyTasks)}
            data-testid="button-my-tasks"
          >
            <UserCircle className="mr-2 h-4 w-4" />
            My Tasks
          </Button>
          
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-40" data-testid="select-filter-assignee">
              <SelectValue placeholder="Assigned to" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {users.map(user => (
                <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={dueDateFilter} onValueChange={setDueDateFilter}>
            <SelectTrigger className="w-36" data-testid="select-filter-duedate">
              <SelectValue placeholder="Due date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="no_date">No Due Date</SelectItem>
            </SelectContent>
          </Select>
          
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
              <X className="mr-1 h-4 w-4" />
              Clear
            </Button>
          )}
        </div>

        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all-tasks">All ({filteredTasks.length})</TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-pending-tasks">Pending ({pendingTasks.length})</TabsTrigger>
            <TabsTrigger value="in_progress" data-testid="tab-inprogress-tasks">In Progress ({inProgressTasks.length})</TabsTrigger>
            <TabsTrigger value="done" data-testid="tab-done-tasks">Done ({doneTasks.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-3">
            {filteredTasks.length === 0 ? (
              <Card>
                <CardContent className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
                  <CheckSquare className="h-10 w-10" />
                  <p>No tasks found. Create your first task to get started.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pending" className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pendingTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="in_progress" className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {inProgressTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="done" className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {doneTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
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
    </div>
  );
}
