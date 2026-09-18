import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { 
  useAuth,
  Capability,
} from '@/context/AuthContext';
import {
  createTicket,
  getMyTickets,
  getTicketDetails,
  getAgentQueue,
  getTicketCategories,
  checkDuplicateTickets,
  previewClassification,
  overrideClassification,
  transitionTicketStatus,
  addTicketComment,
  getTicketTimeline,
  assignTicket,
  autoAssignTicket,
  getAIPerformance,
  getAgentsWorkload,
  getManagerOverview,
} from "../services/ticketService";
import type {
  Ticket as ApiTicket,
  TimelineEvent,
  AgentWorkload,
  AIPerformanceMetrics,
} from "../services/ticketService";

import {
  createManagedUser,
  getManagedUsers,
  updateManagedUser,
} from "../services/userManagementService";
import type { ManagedUser } from "../services/userManagementService";

import {
  Bot, Sun, Moon, LayoutDashboard, Ticket, PlusCircle, Sparkles, BarChart3,
  BookOpen, Users, Settings, LogOut, Search, Bell, HelpCircle, MessageSquare,
  Send, ChevronRight, Tag, Menu,
  AlertCircle, Zap, ShieldCheck, RefreshCw, UserPlus, Clock, AlertTriangle, UserCheck,
} from 'lucide-react';
import ResolutionPanel from "../components/resolution/ResolutionPanel";
import UserResolutionCard from "../components/resolution/UserResolutionCard";
import { M3WorkflowPanel } from "../components/m3/M3WorkflowPanel";
import KnowledgeBaseWorkspace from "../components/knowledge-base/KnowledgeBasePage";
import SuggestedArticles from "../components/knowledge-base/SuggestedArticles";

interface DashboardProps {
  onNavigate: (page: string) => void;
  initialPage?: NavPage;
}

export type NavPage = 'Dashboard' | 'All Tickets' | 'Ticket Queue' | 'My queue' | 'My Tickets' | 'Create Ticket' | 'Agent Assignment' | 'Escalations' | 'SLA Management' | 'Agent Performance' | 'AI Performance' | 'Reports' | 'Knowledge Base' | 'Notifications' | 'Profile' | 'Users' | 'Settings' | 'Taxonomy' | 'SLA policies';


const AI_QUICK_ACTIONS = ['Summarize tickets', 'Show unresolved tickets', 'Draft reply', 'Escalate ticket'];
const AUTO_CATEGORY = 'Not sure — let AI decide';

const formatCategoryLabel = (category: string) => category
  .replace(/[_-]+/g, ' ')
  .toLocaleLowerCase()
  .replace(/\b\p{L}/gu, (character) => character.toLocaleUpperCase());

type TicketStatusSection = {
  key: string;
  label: string;
  description: string;
  statuses: string[];
};

const TICKET_STATUS_SECTIONS: TicketStatusSection[] = [
  { key: 'open', label: 'Open', description: 'Awaiting support work', statuses: ['Open'] },
  { key: 'in-progress', label: 'In Progress', description: 'Being worked by support', statuses: ['In Progress'] },
  { key: 'resolved', label: 'Resolved', description: 'Completed tickets', statuses: ['Resolved', 'Closed'] },
];

function getTicketStatusClasses(status: string | undefined, isDark: boolean) {
  switch (status) {
    case 'Open':
      return isDark
        ? 'border-amber-500/30 bg-amber-500/15 text-amber-300'
        : 'border-amber-200 bg-amber-100 text-amber-800';
    case 'In Progress':
      return isDark
        ? 'border-blue-500/30 bg-blue-500/15 text-blue-300'
        : 'border-blue-200 bg-blue-100 text-blue-800';
    case 'Resolved':
    case 'Closed':
      return isDark
        ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
        : 'border-emerald-200 bg-emerald-100 text-emerald-800';
    default:
      return isDark
        ? 'border-gray-700 bg-gray-800 text-gray-200'
        : 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

function getPriorityBadgeClasses(priority: string | null | undefined, isDark: boolean) {
  const p = (priority || '').toUpperCase();
  switch (p) {
    case 'P1':
      return isDark
        ? 'border-red-500/30 bg-red-500/15 text-red-300'
        : 'border-red-200 bg-red-100 text-red-800';
    case 'P2':
      return isDark
        ? 'border-amber-500/30 bg-amber-500/15 text-amber-300'
        : 'border-amber-200 bg-amber-100 text-amber-800';
    case 'P3':
      return isDark
        ? 'border-blue-500/30 bg-blue-500/15 text-blue-300'
        : 'border-blue-200 bg-blue-100 text-blue-800';
    case 'P4':
      return isDark
        ? 'border-gray-700 bg-gray-800 text-gray-300'
        : 'border-slate-200 bg-slate-100 text-slate-700';
    default:
      return isDark
        ? 'border-gray-700 bg-gray-800/60 text-gray-400'
        : 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

function getSeverityBadgeClasses(severity: string | null | undefined, isDark: boolean) {
  const s = (severity || '').toUpperCase();
  switch (s) {
    case 'CRITICAL':
    case 'P1':
      return isDark
        ? 'border-red-500/30 bg-red-500/15 text-red-300'
        : 'border-red-200 bg-red-100 text-red-800';
    case 'HIGH':
      return isDark
        ? 'border-amber-500/30 bg-amber-500/15 text-amber-300'
        : 'border-amber-200 bg-amber-100 text-amber-800';
    case 'MEDIUM':
      return isDark
        ? 'border-blue-500/30 bg-blue-500/15 text-blue-300'
        : 'border-blue-200 bg-blue-100 text-blue-800';
    case 'LOW':
      return isDark
        ? 'border-gray-700 bg-gray-800 text-gray-300'
        : 'border-slate-200 bg-slate-100 text-slate-700';
    default:
      return isDark
        ? 'border-gray-700 bg-gray-800/60 text-gray-400'
        : 'border-slate-200 bg-slate-50 text-slate-600';
  }
}



type SidebarItem = { name: NavPage; icon: React.ElementType; badge?: string; capability?: Capability };
const sidebarGroups: {
  title: string;
  items: SidebarItem[];
}[] = [
  {
    title: 'Workspace',

    items: [
      {
        name: 'Dashboard',
        icon: LayoutDashboard,
      },

      {
        name: 'My Tickets',
        icon: Ticket,
        capability: 'VIEW_OWN_TICKETS',
      },

      {
        name: 'My queue',
        icon: Ticket,
        capability: 'VIEW_AGENT_QUEUE',
      },

      {
        name: 'Create Ticket',
        icon: PlusCircle,
        capability: 'CREATE_TICKET',
      },
    ],
  },

  {
    title: 'Configuration',

    items: [
      {
        name: 'Taxonomy',
        icon: Tag,
        capability: 'ADMIN_SETTINGS',
      },

      {
        name: 'SLA policies',
        icon: ShieldCheck,
        capability: 'ADMIN_SETTINGS',
      },
    ],
  },

  {
    title: 'Productivity',

    items: [
      {
        name: 'Reports',
        icon: BarChart3,
        capability: 'VIEW_REPORTS',
      },

      {
        name: 'Knowledge Base',
        icon: BookOpen,
      },
    ],
  },

  {
    title: 'Administration',

    items: [
      {
        name: 'Users',
        icon: Users,
        capability: 'MANAGE_USERS',
      },

      {
        name: 'Settings',
        icon: Settings,
        capability: 'ADMIN_SETTINGS',
      },
    ],
  },
];

const managerSidebarGroups: {
  title: string;
  items: SidebarItem[];
}[] = [
  {
    title: 'Management',
    items: [
      { name: 'Dashboard', icon: LayoutDashboard },
      { name: 'All Tickets', icon: Ticket },
      { name: 'Ticket Queue', icon: Ticket },
      { name: 'Agent Assignment', icon: UserPlus },
      { name: 'Escalations', icon: AlertCircle },
      { name: 'SLA Management', icon: ShieldCheck },
    ],
  },
  {
    title: 'Analytics & Performance',
    items: [
      { name: 'Agent Performance', icon: BarChart3 },
      { name: 'AI Performance', icon: Sparkles },
      { name: 'Reports', icon: BarChart3 },
    ],
  },
  {
    title: 'Operations',
    items: [
      { name: 'Notifications', icon: Bell },
      { name: 'Profile', icon: Users },
      { name: 'Knowledge Base', icon: BookOpen },
    ],
  },
];


/* ─── sub-pages ──────────────────────────────────────────────────── */

function MyTicketsPage({ title, isDark, selectedTicketId, onOpenTicket, onBack, onRaise, onOpenKB, canViewClassification }: { title: string; isDark: boolean; selectedTicketId: string | null; onOpenTicket: (id: string) => void; onBack: () => void; onRaise: () => void; onOpenKB: () => void; canViewClassification: boolean }) {
  const { can, user } = useAuth();
  const searchRef = useRef<HTMLInputElement | null>(null);

const [tickets, setTickets] = useState<ApiTicket[]>([]);
const [queueTickets, setQueueTickets] = useState<ApiTicket[]>([]);
const [loading, setLoading] = useState(true);
const [queueLoading, setQueueLoading] = useState(false);
const [error, setError] = useState("");
const [queueError, setQueueError] = useState("");

  const [detailTicket, setDetailTicket] = useState<ApiTicket | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [overrideCategory, setOverrideCategory] = useState("");
  const [overrideSeverity, setOverrideSeverity] = useState("");
  const [commentText, setCommentText] = useState("");
  const [commentVisibility, setCommentVisibility] = useState<"PUBLIC" | "INTERNAL">("PUBLIC");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [assigneeFilter, setAssigneeFilter] = useState("All assignees");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;


useEffect(() => {
  const loadPageData = async () => {
    try {
      if (title === "My queue") {
        setQueueLoading(true);
        setQueueError("");

        const data = await getAgentQueue();
        const sortedQueue = [...data].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setQueueTickets(sortedQueue);
        return;
      }

      setLoading(true);
      setError("");

      if (title === "All Tickets") {
        const data = await getManagerOverview();
        const allTickets = data.all_tickets || [];
        const sortedTickets = [...allTickets].sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        );
        setTickets(sortedTickets);
        return;
      }

      const data = await getMyTickets();
      const sortedTickets = [...data].sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );
      setTickets(sortedTickets);
      
    } catch (err) {
      console.error("Failed to load ticket data:", err);

      if (title === "My queue") {
        const error = err as {
          response?: {
            data?: {
              detail?: string;
              message?: string;
              error?: string;
            };
          };
          message?: string;
        };

        const backendMessage =
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message;

        setQueueError(
          backendMessage ||
          "Could not load the agent queue."
        );
      } else {
        setError(
          title === "All Tickets"
            ? "Could not load all tickets."
            : "Could not load your tickets."
        );
      }
    } finally {
      if (title === "My queue") {
        setQueueLoading(false);
      } else {
        setLoading(false);
      }
    }
  };

  loadPageData();
}, [title]);

  useEffect(() => {
    if (!selectedTicketId) {
      setDetailTicket(null);
      setTimeline([]);
      setActionError("");
      setIsResolving(false);
      setResolutionSummary("");
      return;
    }

    const fetchDetail = async () => {
      try {
        setLoadingDetail(true);
        setDetailError("");
        setActionError("");

        if (title === "My queue") {
          // Agent/Admin tickets come from the queue endpoint. Do not fall back
          // to the employee-owned ticket-detail endpoint when the ticket leaves
          // the active queue (for example, immediately after resolving it).
          const queueTicket = queueTickets.find(
            ticket => ticket.ticket_id === selectedTicketId
          );

          if (queueTicket) {
            setDetailTicket(queueTicket);
            setOverrideCategory(queueTicket.category || "");
            setOverrideSeverity(queueTicket.severity?.toUpperCase() ?? "");
          } else {
            const data = await getTicketDetails(selectedTicketId);
            setDetailTicket(data);
            setOverrideCategory(data.category || "");
            setOverrideSeverity(data.severity?.toUpperCase() ?? "");
          }
        } else {
          const data = await getTicketDetails(selectedTicketId);
          setDetailTicket(data);
          setOverrideCategory(data.category || "");
          setOverrideSeverity(data.severity?.toUpperCase() ?? "");
        }

        setTimelineLoading(true);
        try {
          const timelineData = await getTicketTimeline(selectedTicketId);
          setTimeline(timelineData);
        } catch (timelineError) {
          console.error("Failed to fetch ticket timeline:", timelineError);
          setTimeline([]);
        } finally {
          setTimelineLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch ticket detail:", err);
        setDetailError("Could not fetch ticket details.");
      } finally {
        setLoadingDetail(false);
      }
    };

    fetchDetail();
  }, [selectedTicketId, title, queueTickets]);

  const filteredTickets = tickets.filter(ticket => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term || [
      ticket.ticket_id,
      ticket.subject,
      ticket.description,
      ticket.requester?.username,
      ticket.requester?.email,
    ].some(value => String(value || "").toLowerCase().includes(term));

    const matchesStatus =
      statusFilter === "All statuses" ||
      ticket.status === statusFilter;

    const matchesAssignee =
      assigneeFilter === "All assignees" ||
      (ticket.assignee || "Unassigned") === assigneeFilter;

    return (
      matchesSearch &&
      matchesStatus &&
      matchesAssignee
    );
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTickets = filteredTickets.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const groupedTicketSections = TICKET_STATUS_SECTIONS.map((section) => ({
    ...section,
    total: filteredTickets.filter((ticket) => section.statuses.includes(ticket.status || '')).length,
    tickets: paginatedTickets.filter((ticket) => section.statuses.includes(ticket.status || '')),
  }));
  const unmappedTickets = paginatedTickets.filter(
    (ticket) => !TICKET_STATUS_SECTIONS.some((section) => section.statuses.includes(ticket.status || '')),
  );
  const visibleTicketSections = [
    ...groupedTicketSections,
    ...(unmappedTickets.length > 0 ? [{
      key: 'other',
      label: 'Other status',
      description: 'Tickets returned with another current status',
      statuses: [],
      total: filteredTickets.filter(
        (ticket) => !TICKET_STATUS_SECTIONS.some((section) => section.statuses.includes(ticket.status || '')),
      ).length,
      tickets: unmappedTickets,
    }] : []),
  ].filter((section) => section.tickets.length > 0);

  const exportFilteredTickets = () => {
    if (filteredTickets.length === 0) {
      return;
    }

    const rows = [
      ['Ticket ID', 'Subject', 'Status', 'Assignee', 'Created At'],
      ...filteredTickets.map(ticket => [
        ticket.ticket_id,
        ticket.subject,
        ticket.status || '',
        ticket.assignee || 'Unassigned',
        ticket.created_at,
      ]),
    ];

    const csv = rows
      .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/\s+/g, '-').toLowerCase()}-tickets.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const labelColor = (tone: string) => {
    switch (tone) {
      case 'green': return 'text-emerald-600';
      case 'red': return 'text-red-600';
      case 'amber': return 'text-amber-600';
      case 'blue': return 'text-blue-600';
      case 'gray': return 'text-slate-600';
      default: return 'text-slate-600';
    }
  };

  const filterField = `w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-colors focus:border-blue-500 ${isDark ? 'bg-gray-950 border-gray-800 text-white' : 'bg-white border-gray-200 text-slate-900'}`;

interface TicketClassificationMeta {
  value?: string;
  confidence?: number;
  route?: string;
  reason?: string;
  model_version?: string;
  [key: string]: unknown;
}

  // Live ticket workspace. Agent/Admin can operate on queue tickets; users see safe details + timeline.
  if (selectedTicketId) {
    const classification = (detailTicket?.classification || {}) as TicketClassificationMeta & Record<string, TicketClassificationMeta | string | number | undefined>;
    const categoryMeta = (classification.category || {}) as TicketClassificationMeta;
    const subcategoryMeta = (classification.subcategory || {}) as TicketClassificationMeta;
    const severityMeta = (classification.severity || {}) as TicketClassificationMeta;
    const priorityMeta = (classification.priority || {}) as TicketClassificationMeta;
    const categoryConfidence = detailTicket?.confidence ?? categoryMeta.confidence ?? null;
    const classificationPath = detailTicket?.path || categoryMeta.route || subcategoryMeta.route;
    const priorityReason = detailTicket?.priority_reason || priorityMeta.reason || '';
    const isAgentWorkspace = title === 'My queue' && can('VIEW_AGENT_TICKET');

    const refreshQueueTicket = async () => {
      if (!isAgentWorkspace) return;
      const refreshed = await getAgentQueue();
      setQueueTickets(refreshed);
      const refreshedTicket = refreshed.find(ticket => ticket.ticket_id === selectedTicketId);
      if (refreshedTicket) {
        setDetailTicket(refreshedTicket);
      }
    };

    const handleOverride = async () => {
      if (!isAgentWorkspace) return;
      if (!overrideCategory.trim() && !overrideSeverity.trim()) {
        setActionError('Enter a corrected category or severity.');
        return;
      }

      try {
        setActionBusy(true);
        setActionError("");
        const result = await overrideClassification(selectedTicketId, {
          category: overrideCategory.trim() || undefined,
          severity: overrideSeverity
            ? overrideSeverity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
            : undefined,
        });

        const updatedClassification = result?.updated_classification || {};
        setDetailTicket(current => current ? {
          ...current,
          category: updatedClassification.category ?? null,
          severity: updatedClassification.severity ?? null,
          priority: typeof updatedClassification.priority === 'object'
            ? updatedClassification.priority?.value ?? null
            : updatedClassification.priority ?? null,
          sla: updatedClassification.sla ?? null,
          queue: updatedClassification.queue ?? null,
        } : current);

        await refreshQueueTicket();
        const timelineData = await getTicketTimeline(selectedTicketId);
        setTimeline(timelineData);
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } }; message?: string };
        setActionError(err?.response?.data?.message || err?.message || 'Could not apply classification override.');
      } finally {
        setActionBusy(false);
      }
    };

    const handleStatusChange = async (status: 'In Progress' | 'Resolved') => {
      if (!isAgentWorkspace) return;
      const trimmedResolutionSummary = resolutionSummary.trim();

      if (status === 'Resolved' && !trimmedResolutionSummary) {
        setActionError('Resolution summary is required when resolving a ticket.');
        return;
      }

      try {
        setActionBusy(true);
        setActionError("");
        await transitionTicketStatus(selectedTicketId, {
          status,
          resolution_summary: status === 'Resolved'
            ? trimmedResolutionSummary
            : undefined,
        });
        setDetailTicket(current => current ? {
          ...current,
          status,
          resolution: status === 'Resolved'
            ? { summary: trimmedResolutionSummary, resolved_at: new Date().toISOString() }
            : current.resolution,
        } : current);
        if (status === 'Resolved') {
          setIsResolving(false);
          setResolutionSummary("");
        }
        await refreshQueueTicket();
        const timelineData = await getTicketTimeline(selectedTicketId);
        setTimeline(timelineData);
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } }; message?: string };
        setActionError(err?.response?.data?.message || err?.message || 'Could not change ticket status.');
      } finally {
        setActionBusy(false);
      }
    };

    const handleComment = async () => {
      if (!isAgentWorkspace || !commentText.trim()) return;
      if (commentVisibility === 'INTERNAL' && !can('ADD_INTERNAL_COMMENT')) {
        setActionError('You do not have permission to add internal comments.');
        return;
      }

      try {
        setActionBusy(true);
        setActionError("");
        await addTicketComment(selectedTicketId, {
          comment: commentText.trim(),
          visibility: commentVisibility,
        });
        setCommentText("");
        const timelineData = await getTicketTimeline(selectedTicketId);
        setTimeline(timelineData);
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } }; message?: string };
        setActionError(err?.response?.data?.message || err?.message || 'Could not add the comment.');
      } finally {
        setActionBusy(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className={`rounded-3xl border p-5 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4 dark:border-gray-800">
            <div>
              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Ticket Details</p>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{isAgentWorkspace ? 'Agent workspace — live ticket controls and classification review.' : 'Full ticket details fetched live from the database.'}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={onBack} className="rounded-2xl border border-slate-200 bg-transparent px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-800">
                ← Back to list
              </button>
            </div>
          </div>

          {loadingDetail ? (
            <div className="py-12 text-center text-sm text-gray-500">Loading ticket details...</div>
          ) : detailError ? (
            <div className="py-12 text-center text-sm text-red-500">{detailError}</div>
          ) : detailTicket ? (
            <div className="space-y-6 mt-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className={`rounded-3xl border p-5 ${isDark ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white'}`}>
                  <p className={`text-xs uppercase tracking-[0.2em] font-semibold ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Ticket Information</p>
                  <p className={`mt-2 text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{detailTicket.subject}</p>
                  <p className="mt-1 text-xs text-blue-600 font-mono font-semibold">{detailTicket.ticket_id}</p>
                  <div className="mt-5 space-y-3 text-sm divide-y divide-gray-100 dark:divide-gray-800">
                    <div className="pt-2 flex justify-between gap-4"><span className="text-xs text-slate-500 uppercase shrink-0">Requester</span><span className={`font-medium text-right ${isDark ? 'text-white' : 'text-gray-900'}`}>{detailTicket.requester?.username || user?.username || 'User'} ({detailTicket.requester?.email || user?.email || 'N/A'})</span></div>
                    <div className="pt-2 flex justify-between"><span className="text-xs text-slate-500 uppercase">Department</span><span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{detailTicket.department || 'N/A'}</span></div>
                    <div className="pt-2 flex justify-between"><span className="text-xs text-slate-500 uppercase">Site</span><span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{detailTicket.site || 'N/A'}</span></div>
                    <div className="pt-2 flex justify-between"><span className="text-xs text-slate-500 uppercase">Asset Tag</span><span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{detailTicket.asset_tag || 'N/A'}</span></div>
                    <div className="pt-2 flex justify-between"><span className="text-xs text-slate-500 uppercase">Preferred Contact</span><span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{detailTicket.preferred_contact || 'Email'}</span></div>
                  </div>
                </div>

                <div className={`rounded-3xl border p-5 ${isDark ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white'}`}>
                  <p className={`text-xs uppercase tracking-[0.2em] font-semibold ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Status & System Metadata</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getTicketStatusClasses(detailTicket.status, isDark)}`}>{detailTicket.status}</span>
                    {detailTicket.priority && <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-semibold">Priority: {detailTicket.priority}</span>}
                    {detailTicket.severity && <span className="rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-xs font-semibold">Severity: {detailTicket.severity}</span>}
                  </div>
                  <div className="mt-5 space-y-3 text-sm divide-y divide-gray-100 dark:divide-gray-800">
                    <div className="pt-2 flex justify-between"><span className="text-xs text-slate-500 uppercase">Assignee</span><span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{detailTicket.assignee || 'Unassigned'}</span></div>
                    <div className="pt-2 flex justify-between"><span className="text-xs text-slate-500 uppercase">Queue</span><span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{detailTicket.queue || 'N/A'}</span></div>
                    {(detailTicket.sla?.first_response_due || detailTicket.sla?.priority) && <div className="pt-2 flex justify-between gap-4"><span className="text-xs text-slate-500 uppercase shrink-0">First response due</span><span className={`text-right ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{detailTicket.sla.first_response_due ? new Date(detailTicket.sla.first_response_due).toLocaleString() : detailTicket.sla.priority}</span></div>}
                    {canViewClassification && (
                      <>
                        {categoryConfidence != null && <div className="pt-2 flex justify-between"><span className="text-xs text-slate-500 uppercase">Confidence</span><span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{`${Math.round(categoryConfidence * 100)}%`}</span></div>}
                        {classificationPath && <div className="pt-2 flex justify-between"><span className="text-xs text-slate-500 uppercase">Path</span><span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{classificationPath}</span></div>}
                        {priorityReason && <div className="pt-2 flex justify-between"><span className="text-xs text-slate-500 uppercase">Priority Reason</span><span className={`text-right max-w-[70%] ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{priorityReason}</span></div>}
                      </>
                    )}
                    <div className="pt-2 flex justify-between"><span className="text-xs text-slate-500 uppercase">Created At</span><span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{new Date(detailTicket.created_at).toLocaleString()}</span></div>
                    <div className="pt-2 flex justify-between"><span className="text-xs text-slate-500 uppercase">Updated At</span><span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{new Date(detailTicket.updated_at).toLocaleString()}</span></div>
                  </div>
                </div>
              </div>

              <div className={`rounded-3xl border p-5 ${isDark ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white'}`}>
                <p className={`text-xs uppercase tracking-[0.2em] font-semibold ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Description</p>
                <p className={`mt-3 leading-7 text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{detailTicket.description}</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-4">
                  {[
                    ['Affected', detailTicket.affected_scope || 'N/A'],
                    ['Work blocked', detailTicket.work_blocked || 'N/A'],
                    ['Urgency', detailTicket.urgent_feeling || 'N/A'],
                    ['Workaround', detailTicket.workaround_available ? 'Available' : 'None'],
                  ].map(([label, value]) => (
                    <div key={label} className={`rounded-2xl p-4 ${isDark ? 'bg-gray-900' : 'bg-slate-50'}`}>
                      <p className="text-xs text-slate-500 uppercase">{label}</p>
                      <p className={`mt-2 text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {canViewClassification && (
                <div className={`rounded-3xl border p-5 ${isDark ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={`text-xs uppercase tracking-[0.2em] font-semibold ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>AI Classification</p>
                      <p className={`mt-1 text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Internal agent view</p>
                    </div>
                    {classification?.model_version && <span className="text-xs text-slate-500">{String(classification.model_version)}</span>}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      ['Category', categoryMeta.value || detailTicket.category || 'N/A'],
                      ['Category confidence', categoryMeta.confidence != null ? `${Math.round(categoryMeta.confidence * 100)}%` : categoryConfidence != null ? `${Math.round(categoryConfidence * 100)}%` : 'N/A'],
                      ['Subcategory', subcategoryMeta.value || detailTicket.subcategory || 'N/A'],
                      ['Severity model', severityMeta.value || detailTicket.severity || 'N/A'],
                    ].map(([label, value]) => (
                      <div key={label} className={`rounded-2xl border p-4 ${isDark ? 'border-gray-800 bg-gray-900' : 'border-gray-100 bg-slate-50'}`}>
                        <p className="text-xs text-slate-500 uppercase">{label}</p>
                        <p className={`mt-2 font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{String(value)}</p>
                      </div>
                    ))}
                  </div>
                  {isAgentWorkspace && can('OVERRIDE_CLASSIFICATION') && (
                    <div className="mt-5 border-t pt-5 dark:border-gray-800">
                      <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Override classification</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <input value={overrideCategory} onChange={e => setOverrideCategory(e.target.value)} placeholder="Correct category" className={`rounded-2xl border px-3 py-2.5 text-sm ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
                        <select value={overrideSeverity} onChange={e => setOverrideSeverity(e.target.value)} className={`rounded-2xl border px-3 py-2.5 text-sm ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
                          <option value="">Keep backend severity</option>
                          {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(value => <option key={value}>{value}</option>)}
                        </select>
                      </div>
                      <button onClick={handleOverride} disabled={actionBusy} className="mt-3 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                        {actionBusy ? 'Saving...' : 'Apply override'}
                      </button>
                    </div>
                  )}
                </div>
              )}

                {isAgentWorkspace && (
                  <div className={`rounded-3xl border p-5 ${isDark ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white'}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className={`text-xs uppercase tracking-[0.2em] font-semibold mr-auto ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Agent Actions</p>
                      {detailTicket.status === 'Open' && can('CHANGE_TICKET_STATUS') && <button onClick={() => handleStatusChange('In Progress')} disabled={actionBusy} className="rounded-2xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">Start work</button>}
                      {detailTicket.status === 'In Progress' && can('RESOLVE_TICKET') && !isResolving && <button onClick={() => { setActionError(""); setIsResolving(true); }} disabled={actionBusy} className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Resolve</button>}
                    </div>
                    {isResolving && (
                      <div className={`mt-4 rounded-2xl border p-4 ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-slate-50'}`}>
                        <label htmlFor="resolution-summary" className={`block text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Resolution summary</label>
                        <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Describe how the ticket was resolved. This is required before the ticket can be closed.</p>
                        <textarea
                          id="resolution-summary"
                          value={resolutionSummary}
                          onChange={event => setResolutionSummary(event.target.value)}
                          rows={4}
                          disabled={actionBusy}
                          placeholder="Example: Reset the VPN profile, restarted the client, and confirmed the user could connect."
                          className={`mt-3 w-full rounded-2xl border px-3 py-2.5 text-sm outline-none transition-colors focus:border-emerald-500 disabled:opacity-60 ${isDark ? 'border-gray-700 bg-gray-950 text-white placeholder-gray-500' : 'border-gray-200 bg-white text-gray-900 placeholder-gray-400'}`}
                        />
                        <div className="mt-3 flex flex-wrap justify-end gap-3">
                          <button onClick={() => { setActionError(""); setIsResolving(false); setResolutionSummary(""); }} disabled={actionBusy} className={`rounded-2xl border px-4 py-2 text-sm font-semibold disabled:opacity-50 ${isDark ? 'border-gray-700 text-gray-200 hover:bg-gray-800' : 'border-gray-200 text-slate-700 hover:bg-white'}`}>Cancel</button>
                          <button onClick={() => handleStatusChange('Resolved')} disabled={actionBusy || !resolutionSummary.trim()} className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{actionBusy ? 'Resolving...' : 'Confirm resolve'}</button>
                        </div>
                      </div>
                    )}
                    {actionError && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p>}
                  </div>
                )}

                {isAgentWorkspace && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500"></span>
                      <h3 className={`text-xs font-bold uppercase tracking-[0.2em] ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                        M3 — Autonomous Multi-Agent AI Workflow
                      </h3>
                    </div>
                    <M3WorkflowPanel ticketId={selectedTicketId} isDark={isDark} />
                  </div>
                )}

                {isAgentWorkspace && (
                  <div className="space-y-2 pt-4 border-t border-dashed border-gray-300 dark:border-gray-800">
                    <div className="flex flex-wrap items-center gap-2 px-1">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-500"></span>
                      <h3 className={`text-xs font-bold uppercase tracking-[0.2em] ${isDark ? 'text-indigo-400' : 'text-indigo-700'}`}>
                        M2 — Agent Draft Resolution & Review
                      </h3>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${isDark ? 'bg-indigo-950/60 text-indigo-300 border-indigo-800' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                        Independent Agent Draft Capability
                      </span>
                    </div>
                    <ResolutionPanel
                      ticketId={selectedTicketId}
                      onResponseChanged={async () => {
                        try {
                          await refreshQueueTicket();
                          const timelineData = await getTicketTimeline(selectedTicketId);
                          setTimeline(timelineData);
                        } catch (refreshError) {
                          console.error("Failed to refresh ticket data after resolution update:", refreshError);
                        }
                      }}
                    />
                  </div>
                )}

                {!isAgentWorkspace && detailTicket && (detailTicket.resolution_status === "SENT" || detailTicket.resolution_status === "EDITED_SENT") && (
                  <UserResolutionCard
                    ticket={detailTicket}
                    isDark={isDark}
                    onConfirmed={async () => {
                      try {
                        const updatedTicket = await getTicketDetails(selectedTicketId);
                        setDetailTicket(updatedTicket);
                        const timelineData = await getTicketTimeline(selectedTicketId);
                        setTimeline(timelineData);
                        if (title === 'My Tickets') {
                          const refreshedTickets = await getMyTickets();
                          setTickets(refreshedTickets);
                        }
                      } catch (refreshError) {
                        console.error("Failed to refresh ticket data after user resolution confirmation:", refreshError);
                      }
                    }}
                  />
                )}

              <div className={`rounded-3xl border p-5 ${isDark ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className={`text-xs uppercase tracking-[0.2em] font-semibold ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Timeline</p>
                    <p className={`mt-1 text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Status changes and visible comments</p>
                  </div>
                  {timelineLoading && <span className="text-xs text-slate-500">Loading...</span>}
                </div>
                <div className="mt-4 space-y-3">
                  {!timelineLoading && timeline.length === 0 ? <p className="text-sm text-slate-500">No timeline events yet.</p> : timeline.map((event, index) => (
                    <div key={`${event.created_at}-${index}`} className={`rounded-2xl border p-4 ${isDark ? 'border-gray-800 bg-gray-900' : 'border-gray-100 bg-slate-50'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className={`text-xs font-semibold ${event.event_type === 'STATUS_CHANGE' ? 'text-blue-600' : 'text-emerald-600'}`}>{event.event_type === 'STATUS_CHANGE' ? 'Status change' : `Comment · ${event.visibility || 'PUBLIC'}`}</span>
                        <span className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</span>
                      </div>
                      <p className={`mt-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{event.event_type === 'STATUS_CHANGE' ? `${event.from_status || '—'} → ${event.to_status || '—'}` : event.comment || '—'}</p>
                    </div>
                  ))}
                </div>

                {isAgentWorkspace && (
                  <div className="mt-5 border-t pt-5 dark:border-gray-800">
                    <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Add comment</p>
                    <textarea value={commentText} onChange={e => setCommentText(e.target.value)} rows={3} placeholder="Write a response or internal note..." className={`mt-3 w-full rounded-2xl border px-3 py-2.5 text-sm ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <select value={commentVisibility} onChange={e => setCommentVisibility(e.target.value as "PUBLIC" | "INTERNAL")} className={`rounded-2xl border px-3 py-2.5 text-sm ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
                        <option value="PUBLIC">Public</option>
                        {can('ADD_INTERNAL_COMMENT') && <option value="INTERNAL">Internal</option>}
                      </select>
                      <button onClick={handleComment} disabled={actionBusy || !commentText.trim()} className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Add comment</button>
                    </div>
                  </div>
                )}
              </div>

              {detailTicket.resolution?.summary && (
                <div className={`rounded-3xl border p-5 ${isDark ? 'border-gray-800 bg-emerald-950/10' : 'border-gray-200 bg-emerald-50/50'}`}>
                  <p className={`text-xs uppercase tracking-[0.2em] font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>Resolution</p>
                  <p className={`mt-3 text-sm leading-7 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{detailTicket.resolution.summary}</p>
                  {detailTicket.resolution.resolved_at && <p className="mt-2 text-xs text-slate-500">Resolved {new Date(detailTicket.resolution.resolved_at).toLocaleString()}</p>}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // If My Queue page layout
  if (title === 'My queue') {
    const queueRows = [...queueTickets].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const getRowNumberColor = (index: number) => {
      switch (index) {
        case 0: return 'text-red-600';
        case 1: return 'text-amber-700';
        case 2: return 'text-blue-600';
        default: return 'text-slate-400 dark:text-gray-500';
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className={`text-[10px] uppercase tracking-[0.25em] font-semibold ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
              Tickets / {title === 'My queue' ? 'Queue' : 'My tickets'}
            </p>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border-l-4 ${isDark ? 'bg-emerald-950/10 border-emerald-500/80 border bg-gray-900 border-gray-800' : 'bg-emerald-50/40 border-emerald-500 bg-white border-slate-200'}`}>
          <p className={`text-sm font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-800'}`}>Live assigned tickets</p>
          <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>Open a ticket to review its classification, SLA, and resolution workflow.</p>
        </div>

        <div className={`rounded-3xl border overflow-hidden ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className={`border-b text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'bg-gray-900/50 border-gray-800 text-gray-400' : 'bg-slate-50 border-gray-150 text-slate-500'}`}>
                  <th className="w-12 px-4 py-3">#</th>
                  <th className="text-left px-4 py-3 font-semibold">Ticket</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold">Priority</th>
                  <th className="text-left px-4 py-3 font-semibold">Severity</th>
                  <th className="text-left px-4 py-3 font-semibold">Requester</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                {queueLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">Loading agent queue...</td>
                  </tr>
                ) : queueError ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-red-500">{queueError}</td>
                  </tr>
                ) : queueRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">No active tickets in the queue.</td>
                  </tr>
                ) : queueRows.map((row, index) => {
                  const actionText = 'Open';
                  return (
                    <tr key={row.ticket_id} className={`transition-colors ${isDark ? 'hover:bg-gray-800/40' : 'hover:bg-slate-50/50'}`}>
                      <td className={`px-4 py-4 text-center font-bold text-base ${getRowNumberColor(index)}`}>
                        {index + 1}
                      </td>
                      <td className="px-4 py-4">
                        <button onClick={() => onOpenTicket(row.ticket_id)} className={`text-left font-semibold text-sm hover:underline block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {row.subject}
                        </button>
                        <span className="text-xs text-slate-400 dark:text-gray-500 mt-1 block">
                          {row.ticket_id} · created {new Date(row.created_at).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getTicketStatusClasses(row.status, isDark)}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getPriorityBadgeClasses(row.priority, isDark)}`}>
                          {row.priority || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getSeverityBadgeClasses(row.severity, isDark)}`}>
                          {row.severity || 'N/A'}
                        </span>
                      </td>
                      <td className={`px-4 py-4 text-sm font-medium ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                        {row.requester?.username || 'User'}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => onOpenTicket(row.ticket_id)}
                          className={`rounded-2xl px-4 py-1.5 text-xs font-semibold border transition ${
                            isDark
                              ? 'border-gray-700 text-gray-300 hover:bg-gray-800 bg-transparent'
                              : 'border-slate-300 text-slate-700 hover:bg-slate-50 bg-transparent'
                          }`}
                        >
                          {actionText}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // All tickets card-based list layout (original)
  const openCount = tickets.filter(t => t.status === 'Open').length;
  const inProgressCount = tickets.filter(t => t.status === 'In Progress').length;
  const resolvedCount = tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length;

  const dynamicSummary = [
    { label: 'TOTAL TICKETS', value: String(tickets.length), note: 'Total created', tone: 'gray' },
    { label: 'OPEN', value: String(openCount), note: 'Awaiting support work', tone: 'amber' },
    { label: 'IN PROGRESS', value: String(inProgressCount), note: 'Being worked', tone: 'blue' },
    { label: 'RESOLVED', value: String(resolvedCount), note: 'Completed', tone: 'green' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
          <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {openCount} open · {inProgressCount} in progress · {resolvedCount} resolved
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => { searchRef.current?.focus(); }} title="My tickets" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold bg-slate-50 hover:bg-slate-100 dark:bg-gray-800 dark:hover:bg-gray-700">
              <Ticket className="w-4 h-4" />
              <span>My tickets</span>
            </button>
            <button onClick={onRaise} title="Raise ticket" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700">
              <PlusCircle className="w-4 h-4" />
              <span>Raise ticket</span>
            </button>
            <button onClick={onOpenKB} title="Self help" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold border bg-white hover:bg-slate-50">
              <BookOpen className="w-4 h-4" />
              <span>Self help</span>
            </button>
          </div>
          <button
            type="button"
            onClick={exportFilteredTickets}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            ↓ Export
          </button>
          <button
            type="button"
            onClick={onRaise}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <PlusCircle className="w-4 h-4" />
            + Raise a ticket
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {dynamicSummary.map(card => (
          <div
            key={card.label}
            className={`rounded-3xl border p-5 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}
          >
            <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{card.label}</p>
            <p className={`mt-4 text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{card.value}</p>
            <p className={`mt-2 text-sm ${labelColor(card.tone)}`}>{card.note}</p>
          </div>
        ))}
      </div>

      <div className={`rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
        <div className="border-b px-5 py-4 xl:flex xl:items-center xl:justify-between xl:gap-4">
          <div className="flex flex-1 flex-col gap-3 xl:flex-row xl:items-center">
            <div className={`relative rounded-2xl ${isDark ? 'bg-gray-950' : 'bg-slate-50'} flex items-center px-4 py-3 w-full xl:max-w-md`}>
              <Search className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              <input
                ref={searchRef}
                type="search"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="Ticket no, subject, requester..."
                className={`ml-3 w-full bg-transparent text-sm outline-none ${isDark ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-500'}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }} className={filterField}>
                {['All statuses', 'Open', 'In Progress', 'Resolved', 'Closed'].map(option => <option key={option}>{option}</option>)}
              </select>
              <select value={assigneeFilter} onChange={e => { setAssigneeFilter(e.target.value); setCurrentPage(1); }} className={filterField}>
                <option>All assignees</option>
                {Array.from(new Set(tickets.map(ticket => ticket.assignee || 'Unassigned'))).map(option => <option key={option}>{option}</option>)}
              </select>
            </div>
          </div>
          <button onClick={() => { setSearchTerm(''); setStatusFilter('All statuses'); setAssigneeFilter('All assignees'); setCurrentPage(1); }} className="mt-3 inline-flex shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-transparent px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:mt-0">
            Clear
          </button>
        </div>

        <div>
          <div className="space-y-4 p-4">
           {loading ? (
  <p className="text-center py-6 text-sm text-gray-500">Loading your tickets...</p>
) : error ? (
  <p className="text-center py-6 text-sm text-red-500">{error}</p>
) : tickets.length === 0 ? (
  <p className="text-center py-6 text-sm text-gray-500">No tickets found. Click "Raise ticket" to create one!</p>
) : paginatedTickets.length === 0 ? (
  <p className="text-center py-6 text-sm text-gray-500">No tickets match the current filters.</p>
) : (
  visibleTicketSections.map(section => (
    <section key={section.key} className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-2">
        <div>
          <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{section.label}</h3>
          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{section.description}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getTicketStatusClasses(section.statuses[0], isDark)}`}>{section.total}</span>
      </div>
      {section.tickets.map(row => (
        <div key={row.ticket_id} className={`flex items-center justify-between p-4 rounded-2xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-md flex items-center justify-center ${isDark ? 'bg-gray-800 text-gray-200' : 'bg-slate-100 text-slate-700'}`}>
          <Ticket className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <button onClick={() => onOpenTicket(row.ticket_id)} className={`font-semibold hover:underline text-left block ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {row.subject}
          </button>
          <div className="text-xs text-slate-500 mt-1">
            {row.ticket_id} · created {new Date(row.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>
      <div className="text-right flex flex-col items-end gap-1.5">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getTicketStatusClasses(row.status, isDark)}`}>
            {row.status}
          </span>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getPriorityBadgeClasses(row.priority, isDark)}`}>
            Priority: {row.priority || 'N/A'}
          </span>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getSeverityBadgeClasses(row.severity, isDark)}`}>
            Severity: {row.severity || 'N/A'}
          </span>
        </div>
        <div className="text-xs text-slate-500">
          Assignee: {row.assignee || 'Unassigned'}
        </div>
      </div>
        </div>
      ))}
    </section>
  ))
)}
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Showing {filteredTickets.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredTickets.length)} of {filteredTickets.length}</p>
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={safePage <= 1} className="rounded-2xl border border-slate-200 bg-transparent px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">← Prev</button>
            <button onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))} disabled={safePage >= totalPages} className="rounded-2xl border border-slate-200 bg-transparent px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

type ClassificationPreview = {
  category?: {
    category?: string;
    value?: string;
    confidence: number;
    route?: string;
  };
  subcategory?: {
    subcategory?: string;
    value?: string;
    confidence: number;
    route?: string;
  };
};

type DuplicateCandidate = {
  ticket_id: string;
  subject?: string;
  status?: string;
  score?: number;
  created_at?: string;
};

function CreateTicketPage({ isDark, onCreated, onOpenTicket, onOpenKnowledgeArticle }: { isDark: boolean; onCreated?: (ticket?: ApiTicket) => void; onOpenTicket?: (id: string) => void; onOpenKnowledgeArticle: (articleId: string) => void }) {
  const [form, setForm] = useState(() => {
    try {
      const saved = localStorage.getItem('aiticketpilot_ticket_draft');
      return saved
        ? {
            subject: '',
            description: '',
            category: AUTO_CATEGORY,
            affectedSystem: 'Cisco AnyConnect',
            started: 'Today',
            impact: 'My team',
            blocked: 'Yes, completely',
            workaround: false,
            department: 'Finance',
            location: 'Chennai — DLF IT Park',
            assetTag: 'LT-04821',
            preferredContact: 'Email',
            ...JSON.parse(saved),
          }
        : {
            subject: '',
            description: '',
            category: AUTO_CATEGORY,
            affectedSystem: 'Cisco AnyConnect',
            started: 'Today',
            impact: 'My team',
            blocked: 'Yes, completely',
            workaround: false,
            department: 'Finance',
            location: 'Chennai — DLF IT Park',
            assetTag: 'LT-04821',
            preferredContact: 'Email',
          };
    } catch {
      return {
        subject: '',
        description: '',
        category: AUTO_CATEGORY,
        affectedSystem: 'Cisco AnyConnect',
        started: 'Today',
        impact: 'My team',
        blocked: 'Yes, completely',
        workaround: false,
        department: 'Finance',
        location: 'Chennai — DLF IT Park',
        assetTag: 'LT-04821',
        preferredContact: 'Email',
      };
    }
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [ticketCategories, setTicketCategories] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState("");
  const [preview, setPreview] = useState<ClassificationPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [duplicateChecked, setDuplicateChecked] = useState(false);
  const [duplicateCheckPending, setDuplicateCheckPending] = useState(false);
  const duplicateRequestId = useRef(0);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        setCategoriesLoading(true);
        setCategoriesError("");
        const categories = await getTicketCategories();

        if (!active) {
          return;
        }

        setTicketCategories(categories);
        setForm((current: typeof form) => {
          if (current.category === AUTO_CATEGORY) {
            return current;
          }

          const matchingCategory = categories.find(
            (category) => category.toLocaleLowerCase() === current.category.trim().toLocaleLowerCase(),
          );

          return matchingCategory
            ? { ...current, category: matchingCategory }
            : { ...current, category: AUTO_CATEGORY };
        });
      } catch {
        if (active) {
          setTicketCategories([]);
          setCategoriesError("Specific categories could not be loaded. You can still let AI classify the ticket.");
          setForm((current: typeof form) => current.category === AUTO_CATEGORY ? current : { ...current, category: AUTO_CATEGORY });
        }
      } finally {
        if (active) {
          setCategoriesLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const set = (k: string, v: string | boolean) => {
    if (k === 'subject' || k === 'description') {
      duplicateRequestId.current += 1;
      setDuplicateLoading(false);
      setDuplicateCandidates([]);
      setDuplicateChecked(false);
    }

    setForm((f: typeof form) => ({
      ...f,
      [k]: v,
    }));
  };

  const runDuplicateCheck = async (
    subjectValue: string,
    descriptionValue: string
  ) => {
    const subject = subjectValue.trim();
    const description = descriptionValue.trim();

    if (!subject || !description) {
      setDuplicateCandidates([]);
      setDuplicateChecked(false);
      return;
    }

    const requestId = ++duplicateRequestId.current;

    try {
      setDuplicateLoading(true);
      const duplicates = await checkDuplicateTickets(
        subject,
        description
      );

      if (requestId !== duplicateRequestId.current) {
        return;
      }

      setDuplicateCandidates(duplicates);
      setDuplicateChecked(true);
    } catch (error) {
      if (requestId !== duplicateRequestId.current) {
        return;
      }

      console.error('Duplicate check failed:', error);
      setDuplicateCandidates([]);
      setDuplicateChecked(false);
    } finally {
      if (requestId === duplicateRequestId.current) {
        setDuplicateLoading(false);
      }
    }
  };

  const handleSubjectBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const subject = event.currentTarget.value;

    if (!subject.trim()) {
      setDuplicateCheckPending(false);
      setDuplicateCandidates([]);
      setDuplicateChecked(false);
      return;
    }

    if (!form.description.trim()) {
      // The subject blur is the trigger. Wait for the required description
      // instead of sending an invalid or low-information request.
      setDuplicateCheckPending(true);
      return;
    }

    setDuplicateCheckPending(false);
    void runDuplicateCheck(subject, form.description);
  };

  const handleDescriptionBlur = () => {
    if (!duplicateCheckPending) {
      return;
    }

    setDuplicateCheckPending(false);
    void runDuplicateCheck(form.subject, form.description);
  };

  useEffect(() => {
    if (!form.subject.trim() || !form.description.trim()) {
      setPreview(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setPreviewLoading(true);
        const result = await previewClassification(
          form.subject.trim(),
          form.description.trim()
        );
        setPreview(result);
      } catch (error) {
        console.error('Classification preview failed:', error);
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 800);

    return () => window.clearTimeout(timer);
  }, [form.subject, form.description]);

  const saveDraft = () => {
    localStorage.setItem(
      'aiticketpilot_ticket_draft',
      JSON.stringify(form)
    );
    setSubmitError("Draft saved locally on this device.");
  };

  const submit = async () => {
    if (!form.subject.trim() || !form.description.trim()) {
      setSubmitError("Subject and description are required.");
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError("");

      const affectedScopeMap: Record<string, string> = {
        'Just me': 'JUST_ME',
        'My team': 'TEAM',
        'My department': 'DEPARTMENT',
        'Whole org': 'ORGANISATION',
      };

      const workBlockedMap: Record<string, string> = {
        'Yes, completely': 'YES',
        'Partially': 'PARTIALLY',
        'No': 'NO',
      };

      const payload = {
        subject: form.subject.trim(),
        category: form.category === AUTO_CATEGORY ? '' : form.category,
        description: form.description.trim(),
        department: form.department,
        site: form.location,
        asset_tag: form.assetTag,
        preferred_contact: form.preferredContact.toUpperCase(),
        affected_system: form.affectedSystem.trim(),
        affected_scope: affectedScopeMap[form.impact] || 'JUST_ME',
        work_blocked: workBlockedMap[form.blocked] || 'NO',
        urgent_feeling: 'LOW',
        workaround_available: form.workaround,
      };

      const result = await createTicket(
        payload as Parameters<typeof createTicket>[0]
      );

      localStorage.removeItem('aiticketpilot_ticket_draft');
      setSubmitted(true);
      onCreated?.(result?.ticket);
      console.info('Ticket created:', result?.ticket || result);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      console.error('Create ticket failed:', error);
      setSubmitError(
        err.response?.data?.message ||
        'Could not create the ticket.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const field = `w-full rounded-2xl border px-3 py-2.5 text-sm outline-none transition-colors focus:border-blue-500 ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`;
  const sectionLabel = `text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`;
  const sectionHint = `text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`;
  const buttonBase = `inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition ${isDark ? 'border-gray-700' : 'border-gray-200'}`;
  const optionActive = (active: boolean) => active ? 'bg-blue-600 border-transparent text-white shadow-sm' : isDark ? 'bg-gray-900 text-gray-300 hover:bg-gray-800' : 'bg-white text-gray-700 hover:bg-slate-50';

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
      <div className={`rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
        <div className={`p-6 space-y-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          <div className={`rounded-3xl border px-5 py-4 ${isDark ? 'bg-yellow-950/10 border-yellow-500/20' : 'bg-yellow-50 border-yellow-200'}`}>
            <p className="text-sm font-semibold text-yellow-700">{duplicateLoading ? 'Checking for similar tickets...' : duplicateCandidates.length > 0 ? 'You have a similar open ticket' : duplicateChecked ? 'No likely duplicate found' : 'Duplicate check will run automatically'}</p>
            <p className="mt-2 text-sm text-slate-600">{duplicateCandidates.length > 0 ? 'Adding to an existing ticket is usually faster than raising a new one.' : duplicateChecked ? 'No matching active ticket passed the duplicate threshold.' : 'Leave the subject and description to let the system compare your ticket with recent active tickets.'}</p>
            {duplicateCandidates[0] ? (
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="font-semibold">{duplicateCandidates[0].subject || duplicateCandidates[0].ticket_id}</p>
                  <p className="text-xs text-slate-500">{duplicateCandidates[0].ticket_id} · {duplicateCandidates[0].status || 'Active'}{duplicateCandidates[0].score ? ` · ${(duplicateCandidates[0].score * 100).toFixed(0)}% similarity` : ''}</p>
                </div>
                <button type="button" onClick={() => {
                  if (duplicateCandidates[0]?.ticket_id) {
                    onOpenTicket?.(duplicateCandidates[0].ticket_id);
                  }
                }} className="self-start rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition">Review</button>
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-xl font-bold ${sectionLabel}`}>The issue</p>
                <p className={`text-sm ${sectionHint}`}>Tell us what’s happening</p>
              </div>
              <span className={`text-xs uppercase tracking-[0.25em] ${sectionHint}`}>Step 1</span>
            </div>

            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Subject *</label>
                <input
                  value={form.subject}
                  onChange={e => set('subject', e.target.value)}
                  onBlur={handleSubjectBlur}
                  placeholder="VPN connection failing on corporate network"
                  className={field}
                  required
                />
                <p className="mt-2 text-xs text-slate-500">A clear one-line summary. “Help” or “Urgent” will be rejected.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description *</label>
                <textarea
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  onBlur={handleDescriptionBlur}
                  rows={5}
                  placeholder={'Unable to connect to VPN since this morning. Error message: "Connection timed out. Please check your network settings and try again." Tried restarting the client but issue persists.'}
                  className={field}
                  required
                />
                <p className="mt-2 text-xs text-slate-500">Include: the error message · what you already tried · when it started</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-2">Category (if you know)</label>
                  <select value={form.category} onChange={e => set('category', e.target.value)} className={field} disabled={categoriesLoading || Boolean(categoriesError)}>
                    <option value={AUTO_CATEGORY}>{AUTO_CATEGORY}</option>
                    {ticketCategories.map(category => <option key={category} value={category}>{formatCategoryLabel(category)}</option>)}
                  </select>
                  {categoriesLoading && <p className="mt-2 text-xs text-slate-500">Loading supported categories…</p>}
                  {categoriesError && <p className="mt-2 text-xs text-amber-700">{categoriesError}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Affected system (optional)</label>
                  <input
                    value={form.affectedSystem}
                    onChange={e => set('affectedSystem', e.target.value)}
                    placeholder="Cisco AnyConnect"
                    className={field}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">When did it start? (optional)</label>
                <select value={form.started} onChange={e => set('started', e.target.value)} className={field}>
                  {['Today', 'Yesterday', 'Earlier this week', 'More than a week ago'].map(value => <option key={value}>{value}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className={`space-y-4 rounded-3xl border px-5 py-5 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-lg font-bold ${sectionLabel}`}>Impact</p>
                <p className={`text-sm ${sectionHint}`}>Two questions that set the priority</p>
              </div>
              <span className={`text-xs uppercase tracking-[0.25em] ${sectionHint}`}>Step 2</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-3">Who is affected? *</label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {['Just me', 'My team', 'My department', 'Whole org'].map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => set('impact', option)}
                      className={`${buttonBase} ${option === form.impact ? optionActive(true) : optionActive(false)}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-3">Is your work blocked? *</label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {['Yes, completely', 'Partially', 'No'].map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => set('blocked', option)}
                      className={`${buttonBase} ${option === form.blocked ? optionActive(true) : optionActive(false)}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 items-end">
               
                <label className="inline-flex items-center gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={form.workaround}
                    onChange={e => set('workaround', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  A workaround is available
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-lg font-bold ${sectionLabel}`}>Context</p>
                <p className={`text-sm ${sectionHint}`}>Mostly filled from your profile</p>
              </div>
              <span className={`text-xs uppercase tracking-[0.25em] ${sectionHint}`}>Step 3</span>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-2">Department *</label>
                <select value={form.department} onChange={e => set('department', e.target.value)} className={field}>
                  {['Finance', 'Operations', 'Sales', 'IT', 'HR'].map(value => <option key={value}>{value}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Location / site</label>
                <select value={form.location} onChange={e => set('location', e.target.value)} className={field}>
                  {['Chennai — DLF IT Park', 'Bangalore — Tech Hub', 'Mumbai — Downtown', 'Remote'].map(value => <option key={value}>{value}</option>)}
                </select>
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-2">Asset tag (optional)</label>
                <input value={form.assetTag} onChange={e => set('assetTag', e.target.value)} className={field} placeholder="LT-04821" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Preferred contact</label>
                <div className="grid grid-cols-3 gap-3">
                  {['Email', 'Phone', 'Teams'].map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => set('preferredContact', option)}
                      className={`${buttonBase} ${option === form.preferredContact ? optionActive(true) : optionActive(false)}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Attachments (optional)</label>
              <input type="file" className={field} />
              <p className="mt-2 text-xs text-slate-500">Screenshots or log files. Max 5 files, 10 MB each.</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button type="button" onClick={saveDraft} className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Save draft</button>
            <button type="button" onClick={submit} disabled={submitting} className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">{submitting ? "Submitting..." : "Submit ticket"}</button>
          </div>

          {submitted && <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">Ticket created successfully!</div>}
          {submitError && (
  <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
    {submitError}
  </div>
)}
        </div>
      </div>

      <aside className={`rounded-3xl border p-6 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={`text-sm font-semibold uppercase tracking-[0.24em] ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>AI classification preview</p>
            <p className={`mt-2 text-sm ${sectionHint}`}>Updating as you type</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-700">Live</span>
        </div>

        <div className="mt-6 space-y-4">
          {(() => {
            const rawCategory = preview?.category?.category || preview?.category?.value;
            const rawSubcategory = preview?.subcategory?.subcategory || preview?.subcategory?.value;

            const categoryVal = previewLoading
              ? 'Classifying...'
              : rawCategory && rawCategory !== 'UNCLASSIFIED'
              ? formatCategoryLabel(rawCategory)
              : '—';

            const subcategoryVal = previewLoading
              ? 'Classifying...'
              : rawSubcategory && rawSubcategory !== 'UNCLASSIFIED'
              ? formatCategoryLabel(rawSubcategory)
              : '—';

            return [
              ['Category', categoryVal],
              ['Sub-category', subcategoryVal],
              ['Severity', 'Final on submit'],
              ['Priority', 'Final on submit'],
              ['Est. first response', 'Final on submit'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-2xl border px-4 py-3">
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{label}</span>
                <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</span>
              </div>
            ));
          })()}
        </div>

        <div className="mt-6 rounded-2xl bg-slate-100 p-4">
          <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
            <span>Confidence</span>
            <span>{previewLoading ? 'Classifying...' : preview?.category?.confidence ? `${Math.round(preview.category.confidence * 100)}%` : '—'}</span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-blue-500 to-sky-500" style={{ width: `${Math.round((preview?.category?.confidence || 0) * 100)}%` }} />
          </div>
          <p className="mt-3 text-xs text-slate-500">This FAST-only preview updates while you type. Final severity, priority, SLA, and queue are calculated after submission.</p>
        </div>

        <SuggestedArticles
          subject={form.subject}
          description={form.description}
          affectedSystem={form.affectedSystem}
          category={form.category}
          department={form.department}
          isDark={isDark}
          onOpenArticle={onOpenKnowledgeArticle}
        />
      </aside>
    </div>
  );
}

function ReportsPage({ isDark }: { isDark: boolean }) {
  const bars = [65, 40, 80, 55, 90, 45, 70];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <div className="space-y-6">
      <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Reports</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`p-6 rounded-2xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Tickets This Week</h3>
          <div className="flex items-end gap-3 h-36">
            {bars.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-blue-500 rounded-t-lg" style={{ height: `${h}%` }} />
                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{days[i]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={`p-6 rounded-2xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Tickets by Priority</h3>
          <div className="space-y-3">
            {[['High', 38, 'bg-red-500'], ['Medium', 44, 'bg-amber-500'], ['Low', 18, 'bg-green-500']].map(([label, pct, color]) => (
              <div key={label as string}>
                <div className="flex justify-between text-xs mb-1">
                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{label}</span>
                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{pct}%</span>
                </div>
                <div className={`h-2 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                  <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function getApiErrorMessage(error: unknown, fallback: string) {
  const responseData = (error as { response?: { data?: unknown } })?.response?.data;

  if (typeof responseData === 'object' && responseData !== null) {
    const message = (responseData as { message?: unknown }).message;
    if (typeof message === 'string') return message;

    const firstError = Object.entries(responseData)[0]?.[1];
    if (Array.isArray(firstError)) return String(firstError[0] ?? fallback);
    if (typeof firstError === 'string') return firstError;
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function formatAccountDate(value: string | null) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function UsersPage({ isDark }: { isDark: boolean }) {
  const { can, user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [newAccount, setNewAccount] = useState({
    username: '',
    email: '',
    mobile: '',
    password: '',
    confirmPassword: '',
    role: '',
  });

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const directory = await getManagedUsers();
      setUsers(directory.users);
      setRoles(directory.roles);
      setNewAccount((account) => (
        directory.roles.includes(account.role)
          ? account
          : { ...account, role: directory.roles[0] ?? '' }
      ));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to load the user directory.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  if (!can('MANAGE_USERS')) {
    return (
      <div className={`rounded-2xl border p-6 ${isDark ? 'bg-gray-900 border-gray-800 text-gray-200' : 'bg-white border-gray-200 text-gray-700'}`}>
        Administrator access is required to manage application accounts.
      </div>
    );
  }

  const filteredUsers = users.filter((account) => {
    const matchingText = `${account.username} ${account.email}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    const matchingRole = !roleFilter || account.role === roleFilter;
    const matchingStatus = !statusFilter || (statusFilter === 'active' ? account.is_active : !account.is_active);
    return matchingText && matchingRole && matchingStatus;
  });

  const submitNewAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setActionError('');

    if (newAccount.password !== newAccount.confirmPassword) {
      setActionError('Passwords do not match.');
      return;
    }

    if (!newAccount.role) {
      setActionError('Choose an account role returned by the server.');
      return;
    }

    setIsCreating(true);
    try {
      await createManagedUser({
        username: newAccount.username,
        email: newAccount.email,
        mobile: newAccount.mobile,
        password: newAccount.password,
        role: newAccount.role,
      });
      setNewAccount({
        username: '',
        email: '',
        mobile: '',
        password: '',
        confirmPassword: '',
        role: roles[0] ?? '',
      });
      setIsCreateOpen(false);
      await loadUsers();
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError, 'Unable to create the account.'));
    } finally {
      setIsCreating(false);
    }
  };

  const updateAccount = async (account: ManagedUser, updates: { role?: string; is_active?: boolean }) => {
    setActionId(account.id);
    setActionError('');
    try {
      await updateManagedUser(account.id, updates);
      await loadUsers();
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError, 'Unable to update this account.'));
    } finally {
      setActionId(null);
    }
  };

  const fieldClassName = `w-full rounded-xl border px-3 py-2 text-sm outline-none ${isDark ? 'border-gray-700 bg-gray-800 text-white placeholder-gray-500 focus:border-blue-500' : 'border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:border-blue-500'}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>User Management</h2>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Accounts are loaded from the application database and managed through administrator-only controls.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadUsers()} disabled={isLoading} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${isDark ? 'border-gray-700 text-gray-200 hover:bg-gray-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button type="button" onClick={() => { setActionError(''); setIsCreateOpen((open) => !open); }} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            <UserPlus className="h-4 w-4" /> {isCreateOpen ? 'Close form' : 'Create account'}
          </button>
        </div>
      </div>

      {isCreateOpen && (
        <form onSubmit={submitNewAccount} className={`rounded-2xl border p-5 ${isDark ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'}`}>
          <div className="mb-4">
            <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Create application account</h3>
            <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>The password is used only to create the account and is never returned by the API.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Username
              <input required value={newAccount.username} onChange={(event) => setNewAccount({ ...newAccount, username: event.target.value })} className={`mt-1.5 ${fieldClassName}`} autoComplete="username" />
            </label>
            <label className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Email
              <input required type="email" value={newAccount.email} onChange={(event) => setNewAccount({ ...newAccount, email: event.target.value })} className={`mt-1.5 ${fieldClassName}`} autoComplete="email" />
            </label>
            <label className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Mobile <span className="font-normal opacity-70">(optional)</span>
              <input value={newAccount.mobile} onChange={(event) => setNewAccount({ ...newAccount, mobile: event.target.value })} className={`mt-1.5 ${fieldClassName}`} autoComplete="tel" />
            </label>
            <label className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Role
              <select required value={newAccount.role} onChange={(event) => setNewAccount({ ...newAccount, role: event.target.value })} className={`mt-1.5 ${fieldClassName}`} disabled={!roles.length}>
                {!newAccount.role && <option value="">Choose a role</option>}
                {roles.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </label>
            <label className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Password
              <input required type="password" minLength={8} value={newAccount.password} onChange={(event) => setNewAccount({ ...newAccount, password: event.target.value })} className={`mt-1.5 ${fieldClassName}`} autoComplete="new-password" />
            </label>
            <label className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Confirm password
              <input required type="password" minLength={8} value={newAccount.confirmPassword} onChange={(event) => setNewAccount({ ...newAccount, confirmPassword: event.target.value })} className={`mt-1.5 ${fieldClassName}`} autoComplete="new-password" />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {actionError && <p role="alert" className="text-sm text-red-500">{actionError}</p>}
            <button type="submit" disabled={isCreating || !roles.length} className="ml-auto rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
              {isCreating ? 'Creating account…' : 'Create account'}
            </button>
          </div>
        </form>
      )}

      <div className={`rounded-2xl border p-4 ${isDark ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'}`}>
        <div className="grid gap-3 md:grid-cols-3">
          <input value={query} onChange={(event) => setQuery(event.target.value)} className={fieldClassName} placeholder="Search username or email" aria-label="Search user directory" />
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className={fieldClassName} aria-label="Filter by role">
            <option value="">All roles</option>
            {roles.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={fieldClassName} aria-label="Filter by account status">
            <option value="">All account statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {error ? (
        <div role="alert" className={`rounded-2xl border p-5 text-sm ${isDark ? 'border-red-900 bg-red-950/40 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
          <p>{error}</p>
          <button type="button" onClick={() => void loadUsers()} className="mt-3 font-semibold underline">Try again</button>
        </div>
      ) : (
        <div className={`overflow-hidden rounded-2xl border ${isDark ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-sm">
              <thead className={isDark ? 'bg-gray-800/80 text-gray-400' : 'bg-gray-50 text-gray-500'}>
                <tr>
                  {['Account', 'Role', 'Status', 'Created', 'Last activity', 'Actions'].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                {isLoading ? (
                  <tr><td colSpan={6} className={`px-4 py-10 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading accounts…</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={6} className={`px-4 py-10 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No accounts match the current filters.</td></tr>
                ) : filteredUsers.map((account) => {
                  const isCurrentAccount = account.email === currentUser?.email;
                  const availableRoles = roles.includes(account.role) ? roles : [account.role, ...roles];
                  const isUpdating = actionId === account.id;
                  return (
                    <tr key={account.id} className={isDark ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-400 text-sm font-bold text-white">{account.username.charAt(0).toUpperCase()}</div>
                          <div>
                            <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{account.username}</p>
                            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{account.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select value={account.role} onChange={(event) => void updateAccount(account, { role: event.target.value })} disabled={isCurrentAccount || Boolean(actionId)} className={`rounded-lg border px-2 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${isDark ? 'border-gray-700 bg-gray-800 text-gray-200' : 'border-gray-200 bg-white text-gray-700'}`} aria-label={`Change role for ${account.username}`}>
                          {availableRoles.map((role) => <option key={role} value={role}>{role}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${account.is_active ? (isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-700') : (isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600')}`}>{account.is_active ? 'Active' : 'Inactive'}</span>
                      </td>
                      <td className={`px-4 py-3 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{formatAccountDate(account.created_at)}</td>
                      <td className={`px-4 py-3 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{formatAccountDate(account.last_login_at)}</td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => void updateAccount(account, { is_active: !account.is_active })} disabled={isCurrentAccount || Boolean(actionId)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${isDark ? 'border-gray-700 text-gray-200 hover:bg-gray-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                          {isUpdating ? 'Updating…' : account.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        {isCurrentAccount && <p className={`mt-1 text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Your administrator account is protected.</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {actionError && !isCreateOpen && <p role="alert" className="border-t border-red-200 px-4 py-3 text-sm text-red-500">{actionError}</p>}
        </div>
      )}
    </div>
  );
}

function SettingsPage({ isDark, toggleTheme }: { isDark: boolean; toggleTheme: () => void }) {
  return (
    <div className="max-w-xl space-y-4">
      <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Settings</h2>
      <div className={`p-6 rounded-2xl border space-y-5 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Dark Mode</p>
            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Toggle between light and dark theme</p>
          </div>
          <button onClick={toggleTheme} className={`relative w-11 h-6 rounded-full transition-colors ${isDark ? 'bg-blue-600' : 'bg-gray-200'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isDark ? 'translate-x-5' : ''}`} />
          </button>
        </div>
        {[
          { label: 'Email Notifications', desc: 'Receive updates about ticket activity' },
          { label: 'AI Auto-Replies',     desc: 'Let AI send suggested replies automatically' },
          { label: 'Weekly Reports',      desc: 'Get a summary report every Monday' },
        ].map(s => (
          <div key={s.label} className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{s.label}</p>
              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{s.desc}</p>
            </div>
            <button className="relative w-11 h-6 rounded-full bg-blue-600">
              <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow translate-x-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIAssistantPage({ isDark, chat, setChat }: { isDark: boolean; chat: { role: 'user' | 'ai'; text: string }[]; setChat: React.Dispatch<React.SetStateAction<{ role: 'user' | 'ai'; text: string }[]>> }) {
  const [msg, setMsg] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const send = () => {
    if (!msg.trim()) return;
    const text = msg;
    setMsg('');
    setChat(c => [...c, { role: 'user', text }]);
    setTimeout(() => setChat(c => [...c, { role: 'ai', text: "I've analyzed your request. Based on the current ticket queue, I recommend prioritizing the High-priority bug reports first. Want me to draft responses for them?" }]), 700);
  };
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat]);
  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      <div className="flex items-center gap-3 mb-4">
        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>AI Assistant</h2>
        <span className="text-xs font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">BETA</span>
      </div>
      <div className={`flex-1 overflow-y-auto rounded-2xl border p-5 space-y-4 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
        {chat.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'ai' && <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center mr-2 mt-0.5 shrink-0"><Sparkles className="w-3.5 h-3.5 text-white" /></div>}
            <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-md' : isDark ? 'bg-gray-800 text-gray-200 rounded-bl-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'}`}>{m.text}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className={`mt-3 flex items-center gap-2 px-4 py-3 rounded-2xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
        <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Ask AI anything..." className={`flex-1 bg-transparent outline-none text-sm ${isDark ? 'text-white placeholder-gray-600' : 'text-gray-900 placeholder-gray-400'}`} />
        <button onClick={send} className="w-9 h-9 bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center justify-center transition-colors"><Send className="w-4 h-4 text-white" /></button>
      </div>
    </div>
  );
}

/* ─── Taxonomy Page ──────────────────────────────────────────────── */

function TaxonomyPage({ isDark }: { isDark: boolean }) {
  const categories = [
    { name: 'VPN', subcategories: ['Connection failure', 'Slow connection', 'Split tunneling', 'Certificate issue'], tickets: 312, color: 'bg-blue-500' },
    { name: 'NETWORK', subcategories: ['Connectivity', 'DNS resolution', 'Firewall rules', 'Bandwidth'], tickets: 287, color: 'bg-emerald-500' },
    { name: 'APPLICATION', subcategories: ['Authentication', 'Performance', 'Error/crash', 'Feature request'], tickets: 198, color: 'bg-amber-500' },
    { name: 'ACCESS', subcategories: ['Permissions', 'Account lockout', 'Role change', 'New access request'], tickets: 165, color: 'bg-purple-500' },
    { name: 'EMAIL', subcategories: ['Mailbox', 'Calendar sync', 'Attachment issue', 'Spam/phishing'], tickets: 142, color: 'bg-red-500' },
    { name: 'HARDWARE', subcategories: ['Laptop', 'Monitor', 'Peripheral', 'Replacement'], tickets: 98, color: 'bg-orange-500' },
    { name: 'SOFTWARE', subcategories: ['Licensing', 'Installation', 'Update/patch', 'Compatibility'], tickets: 82, color: 'bg-cyan-500' },
  ];

  const severityMatrix = [
    { level: 'CRITICAL', description: 'Complete system outage or data loss affecting entire organization', sla: '15 min', color: 'bg-red-600 text-white' },
    { level: 'HIGH', description: 'Major functionality impaired, workaround unavailable, team-level impact', sla: '1 hour', color: 'bg-amber-600 text-white' },
    { level: 'MEDIUM', description: 'Partial impairment with workaround available, individual impact', sla: '4 hours', color: 'bg-orange-500 text-white' },
    { level: 'LOW', description: 'Minor inconvenience, cosmetic issue, or informational request', sla: '24 hours', color: 'bg-slate-500 text-white' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Taxonomy</h2>
        <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Categories and sub-categories used by the AI classifier. Taxonomy drives automatic routing, SLA selection, and priority matrix lookups.
        </p>
      </div>

      {/* Category cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {categories.map(cat => (
          <div key={cat.name} className={`rounded-3xl border p-5 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${cat.color}`} />
                <span className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-gray-900'}`}>{cat.name}</span>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-slate-100 text-slate-600'}`}>{cat.tickets} tickets</span>
            </div>
            <div className="space-y-2">
              {cat.subcategories.map(sub => (
                <div key={sub} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-slate-50 text-slate-700'}`}>
                  <ChevronRight className="w-3 h-3 opacity-40" />
                  {sub}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Severity matrix */}
      <div className={`rounded-3xl border p-6 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Severity Matrix</h3>
        <p className={`text-sm mb-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Determines the initial SLA based on category and impact scope.</p>
        <div className="space-y-3">
          {severityMatrix.map(s => (
            <div key={s.level} className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 p-4 rounded-2xl ${isDark ? 'bg-gray-800' : 'bg-slate-50'}`}>
              <span className={`inline-flex items-center justify-center px-3 py-1 rounded-lg text-xs font-bold ${s.color} w-24 shrink-0 text-center`}>{s.level}</span>
              <p className={`flex-1 text-sm ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>{s.description}</p>
              <span className={`text-xs font-semibold shrink-0 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Target: {s.sla}</span>
            </div>
          ))}
        </div>
      </div>

      {/* AI classification info */}
      <div className={`rounded-3xl border-l-4 border-blue-500 p-5 ${isDark ? 'bg-blue-950/10 border border-gray-800' : 'bg-blue-50/50 border border-blue-200'}`}>
        <p className={`text-sm font-semibold ${isDark ? 'text-blue-400' : 'text-blue-800'}`}>AI classification</p>
        <p className={`mt-2 text-sm ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
          AITicketPilot uses a two-stage classifier (c1f-v1.2-1gbm at 47 ms) that maps each incoming ticket to a category → sub-category pair. 
          Confidence scores above 85% are routed automatically via the FAST path. Tickets below this threshold fall to the LLM path for deeper analysis. 
          Corrections made here are saved as training labels to continuously improve the model.
        </p>
      </div>
    </div>
  );
}

/* ─── SLA Policies Page ──────────────────────────────────────────── */

function SLAPoliciesPage({ isDark }: { isDark: boolean }) {
  const policies = [
    { name: 'Critical — P1', firstResponse: '15 min', resolution: '4 hours', calendar: 'Chennai business hrs', escalation: 'Auto-escalate to L3 + manager after 10 min', status: 'Active', tone: 'bg-red-600' },
    { name: 'High — P2', firstResponse: '1 hour', resolution: '8 hours', calendar: 'Chennai business hrs', escalation: 'Auto-escalate to L2 after 45 min', status: 'Active', tone: 'bg-amber-600' },
    { name: 'Medium — P3', firstResponse: '4 hours', resolution: '24 hours', calendar: 'Chennai business hrs', escalation: 'Notify team lead after 3 hours', status: 'Active', tone: 'bg-orange-500' },
    { name: 'Low — P4', firstResponse: '8 hours', resolution: '72 hours', calendar: 'Standard 9-to-5', escalation: 'Weekly review queue', status: 'Active', tone: 'bg-slate-500' },
  ];

  const calendars = [
    { name: 'Chennai business hrs', hours: 'Mon–Sat 09:00–18:00 IST', holidays: 'Indian public holidays excluded', timezone: 'Asia/Kolkata' },
    { name: 'Standard 9-to-5', hours: 'Mon–Fri 09:00–17:00 IST', holidays: 'Indian public holidays excluded', timezone: 'Asia/Kolkata' },
    { name: '24×7', hours: 'Always on', holidays: 'None', timezone: 'UTC' },
  ];

  const rules = [
    { rule: 'Severity raised from MEDIUM → HIGH', condition: 'work_blocked = yes AND affected_scope = team', effect: 'Rules can raise severity but never lower it' },
    { rule: 'Auto-assign to Network Team', condition: 'category = NETWORK AND priority ∈ {P1, P2}', effect: 'Skip general queue, assign directly' },
    { rule: 'SLA pause on awaiting-requester', condition: 'Status changes to "Waiting on requester"', effect: 'SLA timer paused until requester replies' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>SLA Policies</h2>
        <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Service Level Agreements that govern response and resolution timelines. SLA timers start the moment a ticket is classified by the AI engine.
        </p>
      </div>

      {/* SLA policy table */}
      <div className={`rounded-3xl border overflow-hidden ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-slate-50 border-gray-200 text-slate-500'}`}>
                <th className="text-left px-5 py-3">Policy</th>
                <th className="text-left px-5 py-3">First Response</th>
                <th className="text-left px-5 py-3">Resolution</th>
                <th className="text-left px-5 py-3">Calendar</th>
                <th className="text-left px-5 py-3">Escalation</th>
                <th className="text-center px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
              {policies.map(p => (
                <tr key={p.name} className={`transition-colors ${isDark ? 'hover:bg-gray-800/40' : 'hover:bg-slate-50/50'}`}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${p.tone}`} />
                      <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{p.name}</span>
                    </div>
                  </td>
                  <td className={`px-5 py-4 font-medium ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>{p.firstResponse}</td>
                  <td className={`px-5 py-4 font-medium ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>{p.resolution}</td>
                  <td className={`px-5 py-4 text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{p.calendar}</td>
                  <td className={`px-5 py-4 text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{p.escalation}</td>
                  <td className="px-5 py-4 text-center">
                    <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">{p.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Business calendars */}
      <div className={`rounded-3xl border p-6 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Business Calendars</h3>
        <p className={`text-sm mb-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>SLA timers only count time within the selected business calendar.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {calendars.map(cal => (
            <div key={cal.name} className={`rounded-2xl border p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{cal.name}</p>
              <div className="mt-3 space-y-2 text-xs">
                <div className={isDark ? 'text-gray-400' : 'text-slate-500'}><span className="font-medium">Hours:</span> {cal.hours}</div>
                <div className={isDark ? 'text-gray-400' : 'text-slate-500'}><span className="font-medium">Holidays:</span> {cal.holidays}</div>
                <div className={isDark ? 'text-gray-400' : 'text-slate-500'}><span className="font-medium">Timezone:</span> {cal.timezone}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Automation rules */}
      <div className={`rounded-3xl border p-6 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Priority Rules & Automation</h3>
        <p className={`text-sm mb-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Rules that auto-adjust severity, routing, and SLA timers based on ticket context.</p>
        <div className="space-y-3">
          {rules.map(r => (
            <div key={r.rule} className={`p-4 rounded-2xl ${isDark ? 'bg-gray-800' : 'bg-slate-50'}`}>
              <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{r.rule}</p>
              <p className={`mt-1.5 text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                <span className="font-medium">Condition:</span> {r.condition}
              </p>
              <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                <span className="font-medium">Effect:</span> {r.effect}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Info banner */}
      <div className={`rounded-3xl border-l-4 border-emerald-500 p-5 ${isDark ? 'bg-emerald-950/10 border border-gray-800' : 'bg-emerald-50/50 border border-emerald-200'}`}>
        <p className={`text-sm font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-800'}`}>SLA tracking</p>
        <p className={`mt-2 text-sm ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
          SLA timers are tracked in real-time across all active tickets. When a ticket enters the "at-risk" window (≤ 30 min remaining), 
          it automatically surfaces in the My Queue view ordered by time-to-breach. Breached SLAs are flagged in reports and 
          trigger the configured escalation chain.
        </p>
      </div>
    </div>
  );
}

/* ─── Support Manager Sub-Pages ──────────────────────────────────── */

function AgentAssignmentPage({ isDark, onOpenTicket }: { isDark: boolean; onOpenTicket: (id: string) => void }) {
  const [agents, setAgents] = useState<AgentWorkload[]>([]);
  const [tickets, setTickets] = useState<ApiTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Record<string, string>>({});
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const [workloadData, queueData] = await Promise.all([
        getAgentsWorkload(),
        getAgentQueue(),
      ]);
      setAgents(workloadData);
      setTickets(queueData);
    } catch (err) {
      console.error("Failed to load assignment data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleAssign = async (ticketId: string, assigneeName?: string) => {
    const targetAssignee = assigneeName || selectedAgent[ticketId];
    if (!targetAssignee) return;
    try {
      setAssigningId(ticketId);
      setMessage("");
      await assignTicket(ticketId, targetAssignee);
      setMessage(`Ticket ${ticketId} assigned to ${targetAssignee}.`);
      await loadData();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setMessage(`Assignment failed: ${error?.message || 'Error'}`);
    } finally {
      setAssigningId(null);
    }
  };

  const handleAutoAssign = async (ticketId: string) => {
    try {
      setAssigningId(ticketId);
      setMessage("");
      const res = await autoAssignTicket(ticketId);
      setMessage(`Ticket ${ticketId} auto-assigned to ${res?.ticket?.assignee || 'available agent'} based on minimum active workload.`);
      await loadData();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setMessage(`Auto-assignment failed: ${error?.message || 'Error'}`);
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Agent Workload & Ticket Assignment</h2>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Monitor active ticket load across support agents and distribute incoming queue workload efficiently.
          </p>
        </div>
        <button onClick={loadData} className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-gray-800">
          <RefreshCw className="w-4 h-4" /> Refresh Workload
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl border-l-4 ${message.includes('failed') ? 'bg-red-50 border-red-500 text-red-700' : 'bg-emerald-50 border-emerald-500 text-emerald-800'}`}>
          <p className="text-sm font-semibold">{message}</p>
        </div>
      )}

      {/* Workload Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="col-span-full py-6 text-center text-sm text-gray-500">Loading agent workload...</p>
        ) : agents.length === 0 ? (
          <div className={`col-span-full p-6 rounded-3xl border text-center ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
            <p className="text-sm text-gray-500">No support agents registered in the database yet.</p>
          </div>
        ) : (
          agents.map((agent) => {
            const loadState = agent.active_tickets_count === 0
              ? { label: 'Available (0 active)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300' }
              : agent.active_tickets_count <= 2
              ? { label: 'Moderate Load', color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300' }
              : { label: 'Heavy Load (Busy)', color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300' };

            return (
              <div key={agent.username} className={`rounded-3xl border p-5 flex flex-col justify-between space-y-4 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                        {agent.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{agent.username}</p>
                        <p className="text-xs text-gray-500">{agent.email || agent.role}</p>
                      </div>
                    </div>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${loadState.color}`}>
                      {loadState.label}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t dark:border-gray-800">
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Active Load</p>
                      <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{agent.active_tickets_count}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Total Resolved</p>
                      <p className={`text-2xl font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{agent.resolved_tickets_count}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-xs text-slate-500">Primary Domain: <span className="font-semibold">{agent.primary_category}</span></p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Queue Assignment Matrix */}
      <div className={`rounded-3xl border overflow-hidden ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
        <div className="p-5 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 dark:border-gray-800">
          <div>
            <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Pending Ticket Assignment Queue</h3>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Assign or reassign active tickets to available agents based on workload.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-slate-50 border-gray-200 text-slate-500'}`}>
                <th className="px-4 py-3 text-left">Ticket</th>
                <th className="px-4 py-3 text-left">Status / Priority</th>
                <th className="px-4 py-3 text-left">Current Assignee</th>
                <th className="px-4 py-3 text-left">Assign To Agent</th>
                <th className="px-4 py-3 text-right">Workload Auto-Assign</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
              {tickets.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">No open tickets in queue.</td></tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.ticket_id} className={isDark ? 'hover:bg-gray-800/40' : 'hover:bg-slate-50/50'}>
                    <td className="px-4 py-4">
                      <button onClick={() => onOpenTicket(ticket.ticket_id)} className={`font-bold hover:underline text-left block ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {ticket.subject}
                      </button>
                      <span className="text-xs text-blue-600 font-mono font-semibold mt-0.5 block">{ticket.ticket_id} · {ticket.category || 'General'}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getTicketStatusClasses(ticket.status, isDark)}`}>{ticket.status}</span>
                        {ticket.priority && <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-bold">{ticket.priority}</span>}
                      </div>
                    </td>
                    <td className={`px-4 py-4 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {ticket.assignee ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-blue-600"><UserCheck className="w-3.5 h-3.5" /> {ticket.assignee}</span>
                      ) : (
                        <span className="text-amber-600 font-semibold italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedAgent[ticket.ticket_id] || ""}
                          onChange={(e) => setSelectedAgent({ ...selectedAgent, [ticket.ticket_id]: e.target.value })}
                          className={`rounded-2xl border px-3 py-1.5 text-xs font-medium ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                        >
                          <option value="">Select agent...</option>
                          {agents.map((a) => (
                            <option key={a.username} value={a.username}>
                              {a.username} ({a.active_tickets_count} active)
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAssign(ticket.ticket_id)}
                          disabled={!selectedAgent[ticket.ticket_id] || assigningId === ticket.ticket_id}
                          className="rounded-2xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          Assign
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => handleAutoAssign(ticket.ticket_id)}
                        disabled={assigningId === ticket.ticket_id}
                        className="inline-flex items-center gap-1 rounded-2xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Smart Auto-Assign
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EscalationsPage({ isDark, onOpenTicket }: { isDark: boolean; onOpenTicket: (id: string) => void }) {
  const [escalations, setEscalations] = useState<ApiTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEscalations = async () => {
      try {
        setLoading(true);
        const data = await getAgentQueue();
        const filtered = data.filter(t => 
          t.priority === 'P1' || 
          t.severity === 'CRITICAL' || 
          t.severity === 'HIGH' || 
          t.work_blocked === 'YES' ||
          (t.sla && t.sla.priority === 'P1')
        );
        setEscalations(filtered);
      } catch (err) {
        console.error("Failed to fetch escalations:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEscalations();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Escalated & High Severity Tickets</h2>
        <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Critical cases requiring Support Manager attention, priority overrides, or senior agent intervention.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          <p className="text-xs font-semibold text-red-500 uppercase tracking-wider">Critical P1 Escalations</p>
          <p className={`mt-2 text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{escalations.filter(e => e.priority === 'P1').length}</p>
        </div>
        <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">Work Blocked Incidents</p>
          <p className={`mt-2 text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{escalations.filter(e => e.work_blocked === 'YES').length}</p>
        </div>
        <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider">Total Active Escalations</p>
          <p className={`mt-2 text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{escalations.length}</p>
        </div>
      </div>

      <div className={`rounded-3xl border overflow-hidden ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-slate-50 border-gray-200 text-slate-500'}`}>
                <th className="px-4 py-3 text-left">Escalated Ticket</th>
                <th className="px-4 py-3 text-left">Priority / Severity</th>
                <th className="px-4 py-3 text-left">Assignee</th>
                <th className="px-4 py-3 text-left">Work Blocked</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">Loading escalations...</td></tr>
              ) : escalations.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">No active escalations. Excellent SLA performance!</td></tr>
              ) : (
                escalations.map(ticket => (
                  <tr key={ticket.ticket_id} className={isDark ? 'hover:bg-gray-800/40' : 'hover:bg-slate-50/50'}>
                    <td className="px-4 py-4">
                      <button onClick={() => onOpenTicket(ticket.ticket_id)} className={`font-bold hover:underline text-left block ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {ticket.subject}
                      </button>
                      <span className="text-xs text-red-500 font-mono font-semibold block mt-0.5">{ticket.ticket_id} · {ticket.category || 'General'}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-red-100 text-red-800 px-3 py-1 text-xs font-bold">
                        {ticket.priority || 'P1'} · {ticket.severity || 'CRITICAL'}
                      </span>
                    </td>
                    <td className={`px-4 py-4 font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {ticket.assignee || 'Unassigned'}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs font-bold ${ticket.work_blocked === 'YES' ? 'text-red-600' : 'text-slate-500'}`}>
                        {ticket.work_blocked || 'NO'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button onClick={() => onOpenTicket(ticket.ticket_id)} className="rounded-2xl border px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-gray-800">
                        Manage Ticket →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AgentPerformancePage({ isDark }: { isDark: boolean }) {
  const [agents, setAgents] = useState<AgentWorkload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAgentsWorkload().then(setAgents).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Agent Performance & Team Productivity</h2>
        <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Individual resolution throughput, SLA adherence rates, and workload capacity.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          <p className="text-xs font-semibold uppercase text-blue-500">Active Support Agents</p>
          <p className={`mt-2 text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{agents.length}</p>
        </div>
        <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          <p className="text-xs font-semibold uppercase text-emerald-500">Team SLA Compliance</p>
          <p className={`mt-2 text-3xl font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>98.4%</p>
        </div>
        <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          <p className="text-xs font-semibold uppercase text-amber-500">Average Resolution Time</p>
          <p className={`mt-2 text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>2.1 hrs</p>
        </div>
      </div>

      <div className={`rounded-3xl border overflow-hidden ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-slate-50 border-gray-200 text-slate-500'}`}>
                <th className="px-5 py-3 text-left">Support Agent</th>
                <th className="px-5 py-3 text-left">Primary Specialty</th>
                <th className="px-5 py-3 text-center">Active Workload</th>
                <th className="px-5 py-3 text-center">Resolved Tickets</th>
                <th className="px-5 py-3 text-center">SLA Hit Rate</th>
                <th className="px-5 py-3 text-right">Rating</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-500">Loading performance stats...</td></tr>
              ) : agents.map((agent) => (
                <tr key={agent.username} className={isDark ? 'hover:bg-gray-800/40' : 'hover:bg-slate-50/50'}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                        {agent.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{agent.username}</p>
                        <p className="text-xs text-gray-500">{agent.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className={`px-5 py-4 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{agent.primary_category}</td>
                  <td className="px-5 py-4 text-center font-bold">{agent.active_tickets_count}</td>
                  <td className="px-5 py-4 text-center font-bold text-emerald-600">{agent.resolved_tickets_count}</td>
                  <td className="px-5 py-4 text-center font-semibold text-blue-600">98.5%</td>
                  <td className="px-5 py-4 text-right font-bold text-amber-500">4.9 ★</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AIPerformancePage({ isDark }: { isDark: boolean }) {
  const [metrics, setMetrics] = useState<AIPerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAIPerformance().then(setMetrics).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>AI Classifier & Orchestration Performance</h2>
        <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Evaluation of automatic classification accuracy, FAST vs LLM routing ratios, and knowledge gaps.
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-500">Loading AI performance metrics...</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
              <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider">Classification Accuracy</p>
              <p className={`mt-2 text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{metrics?.classification_accuracy || '96.8%'}</p>
            </div>
            <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
              <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">Average Confidence</p>
              <p className={`mt-2 text-3xl font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{metrics?.avg_confidence || '94.2%'}</p>
            </div>
            <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
              <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">Human Overrides</p>
              <p className={`mt-2 text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{metrics?.overrides_count ?? 2}</p>
            </div>
            <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
              <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">KB Gaps Flagged</p>
              <p className={`mt-2 text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{metrics?.kb_gap_count ?? 1}</p>
            </div>
          </div>

          <div className={`p-6 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Two-Stage Classifier Pipeline Overview</h3>
            <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Stage 1 (LightGBM 47ms) handles high-confidence queries via FAST path. Stage 2 (LLM Fallback) resolves ambiguous context.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-slate-50 border-slate-200'}`}>
                <p className="text-xs font-bold text-blue-600 uppercase">FAST Route (Stage 1)</p>
                <p className={`mt-2 text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{metrics?.fast_route_count ?? 85}% of volume</p>
                <p className="mt-1 text-xs text-gray-500">Latency: ~47ms per classification</p>
              </div>
              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-slate-50 border-slate-200'}`}>
                <p className="text-xs font-bold text-indigo-600 uppercase">LLM Route (Stage 2 Fallback)</p>
                <p className={`mt-2 text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{metrics?.llm_route_count ?? 15}% of volume</p>
                <p className="mt-1 text-xs text-gray-500">Invoked when confidence &lt; 85%</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NotificationsPage({ isDark }: { isDark: boolean }) {
  const notifications = [
    { title: 'SLA Risk Alert', desc: 'Ticket IT-2026-000042 (VPN Connection Failure) is within 15 minutes of SLA breach.', time: '5m ago', type: 'risk' },
    { title: 'Agent Overload Warning', desc: 'Agent A has reached 5 active tickets while Agent C has 0 active tickets.', time: '12m ago', type: 'workload' },
    { title: 'New Escalation', desc: 'Customer marked Ticket IT-2026-000038 as Work Blocked (High Severity).', time: '25m ago', type: 'escalation' },
    { title: 'Classification Override Recorded', desc: 'Agent B updated ticket category from Network to Security.', time: '1h ago', type: 'info' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Manager Notifications & System Alerts</h2>
        <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Real-time events regarding SLA risk, agent overload, and customer escalations.
        </p>
      </div>

      <div className="space-y-3">
        {notifications.map((n, i) => (
          <div key={i} className={`p-4 rounded-2xl border flex items-start gap-4 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${n.type === 'risk' ? 'bg-red-100 text-red-600' : n.type === 'workload' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{n.title}</p>
                <span className="text-xs text-gray-500">{n.time}</span>
              </div>
              <p className={`mt-1 text-xs leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{n.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ManagerProfilePage({ isDark }: { isDark: boolean }) {
  const { user } = useAuth();
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Support Manager Profile</h2>
        <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Account credentials, role scope, and system permissions.
        </p>
      </div>

      <div className={`p-6 rounded-3xl border space-y-6 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-4 border-b pb-5 dark:border-gray-800">
          <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
            {user?.avatar || 'M'}
          </div>
          <div>
            <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{user?.name || 'Support Manager'}</h3>
            <p className="text-sm text-green-500 font-semibold flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Role: {user?.role || 'Support Manager'}
            </p>
          </div>
        </div>

        <div className="space-y-4 text-sm divide-y divide-gray-100 dark:divide-gray-800">
          <div className="pt-2 flex justify-between"><span className="text-xs text-gray-500 uppercase">Username</span><span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{user?.username}</span></div>
          <div className="pt-2 flex justify-between"><span className="text-xs text-gray-500 uppercase">Email Address</span><span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{user?.email}</span></div>
          <div className="pt-2 flex justify-between"><span className="text-xs text-gray-500 uppercase">Department Scope</span><span className={isDark ? 'text-gray-200' : 'text-gray-700'}>IT Operations & Customer Support</span></div>
          <div className="pt-2 flex justify-between"><span className="text-xs text-gray-500 uppercase">Assigned Access</span><span className="font-semibold text-blue-600">Full Manager Dashboard & Assignment Control</span></div>
        </div>
      </div>
    </div>
  );
}

/* ─── main dashboard ─────────────────────────────────────────────── */

export default function Dashboard({ onNavigate, initialPage }: DashboardProps) {
  const { isDark, toggleTheme } = useTheme();
  const { user, signOut, can } = useAuth();
  const [activePage, setActivePage] = useState<NavPage>(initialPage ?? 'Dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [quickInfo, setQuickInfo] = useState<'help' | 'messages' | 'alerts' | null>(null);
  const [aiChat, setAiChat] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: `Hi ${user?.name?.split(' ')[0] ?? 'there'}! I am your AI helpdesk assistant. Click on a fast action chip below or ask me anything to get started.` },
  ]);
  const [aiInput, setAiInput] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [knowledgeArticleId, setKnowledgeArticleId] = useState<string | null>(null);
  const [homeTickets, setHomeTickets] = useState<ApiTicket[]>([]);
  const [loadingHome, setLoadingHome] = useState(true);
  const [homeError, setHomeError] = useState("");

useEffect(() => {
  const loadHomeData = async () => {
    try {
      setLoadingHome(true);
      setHomeError("");

      const data = can('VIEW_AGENT_QUEUE')
        ? await getAgentQueue()
        : await getMyTickets();

      const sortedHome = [...data].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setHomeTickets(sortedHome);
    } catch (err) {
      console.error(
        "Failed to load dashboard tickets:",
        err
      );

      setHomeError(
        can('VIEW_AGENT_QUEUE')
          ? "Could not load the agent queue."
          : "Could not load your tickets."
      );
    } finally {
      setLoadingHome(false);
    }
  };

  loadHomeData();
}, [can]);

  // Dashboard owns this state, so persist every sidebar/page change here.
  useEffect(() => {
    sessionStorage.setItem('dashboardActive', activePage);
  }, [activePage]);

  // Redirect Agent / Admin away from restricted pages (Create Ticket, My Tickets)
  useEffect(() => {
    if (activePage === 'Create Ticket' && !can('CREATE_TICKET')) {
      setActivePage(can('VIEW_AGENT_QUEUE') ? 'My queue' : 'Dashboard');
    } else if (activePage === 'My Tickets' && !can('VIEW_OWN_TICKETS')) {
      setActivePage(can('VIEW_AGENT_QUEUE') ? 'My queue' : 'Dashboard');
    }
  }, [activePage, can]);

  useEffect(() => {
    if (initialPage) {
      if (initialPage === 'Create Ticket' && !can('CREATE_TICKET')) {
        setActivePage(can('VIEW_AGENT_QUEUE') ? 'My queue' : 'Dashboard');
      } else if (initialPage === 'My Tickets' && !can('VIEW_OWN_TICKETS')) {
        setActivePage(can('VIEW_AGENT_QUEUE') ? 'My queue' : 'Dashboard');
      } else {
        setActivePage(initialPage);
      }
    }
  }, [initialPage, can]);

  // Compute sidebar priority counts from the live dashboard dataset.
  const priorityCounts = homeTickets.reduce((acc: Record<string, number>, ticket) => {
    const priority = ticket.priority;

    if (!priority) {
      return acc;
    }

    acc[priority] = (acc[priority] || 0) + 1;
    return acc;
  }, {});
  const p1Count = priorityCounts['P1'] ?? 0;
  const p2Count = priorityCounts['P2'] ?? 0;
  const p3Count = priorityCounts['P3'] ?? 0;
  const p4Count = priorityCounts['P4'] ?? 0;

  const handleOpenTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId);
  };

  const handleBackToList = () => {
    setSelectedTicketId(null);
  };

  const openKnowledgeBase = () => {
    setKnowledgeArticleId(null);
    setActivePage('Knowledge Base');
  };

  const openKnowledgeArticle = (articleId: string) => {
    setKnowledgeArticleId(articleId);
    setActivePage('Knowledge Base');
  };

  const sendAi = (text?: string) => {
    const msg = text ?? aiInput;
    if (!msg.trim()) return;
    setAiInput('');
    setAiChat(c => [...c, { role: 'user', text: msg }]);
    setTimeout(() => setAiChat(c => [...c, { role: 'ai', text: "Got it! I've found 3 unresolved High-priority tickets. Shall I draft replies for each one and tag them for follow-up?" }]), 700);
  };

  const quickInfoContent = {
    help: {
      title: 'Help Center',
      text: 'Browse onboarding guides, escalation steps, and SLA policies for your support team.',
    },
    messages: {
      title: 'Messages',
      text: 'Customer replies are waiting for review. Use AI to draft responses and prioritize follow-ups.',
    },
    alerts: {
      title: 'Alerts',
      text: 'Three urgent tickets need attention and two SLA thresholds are approaching the deadline.',
    },
  };

  const handleQuickAction = (type: 'help' | 'messages' | 'alerts') => {
    setQuickInfo(current => (current === type ? null : type));
  };

  const handleSignOut = () => { signOut(); onNavigate('home'); };

  const renderPage = () => {
    switch (activePage) {
      case 'All Tickets':
        return <MyTicketsPage title="All Tickets" isDark={isDark} selectedTicketId={selectedTicketId} onOpenTicket={handleOpenTicket} onBack={handleBackToList} onRaise={() => setActivePage('Create Ticket')} onOpenKB={openKnowledgeBase} canViewClassification={can('VIEW_CLASSIFICATION')} />;
      case 'Ticket Queue':
      case 'My queue':
        if (!can('VIEW_AGENT_QUEUE')) {
          return <MyTicketsPage title="My Tickets" isDark={isDark} selectedTicketId={selectedTicketId} onOpenTicket={handleOpenTicket} onBack={handleBackToList} onRaise={() => setActivePage('Create Ticket')} onOpenKB={openKnowledgeBase} canViewClassification={can('VIEW_CLASSIFICATION')} />;
        }
        return <MyTicketsPage title="My queue" isDark={isDark} selectedTicketId={selectedTicketId} onOpenTicket={handleOpenTicket} onBack={handleBackToList} onRaise={() => setActivePage('Create Ticket')} onOpenKB={openKnowledgeBase} canViewClassification={can('VIEW_CLASSIFICATION')} />;
      case 'My Tickets':
        return <MyTicketsPage title="My Tickets" isDark={isDark} selectedTicketId={selectedTicketId} onOpenTicket={handleOpenTicket} onBack={handleBackToList} onRaise={() => setActivePage('Create Ticket')} onOpenKB={openKnowledgeBase} canViewClassification={can('VIEW_CLASSIFICATION')} />;
      case 'Agent Assignment':
        return <AgentAssignmentPage isDark={isDark} onOpenTicket={(ticketId) => { setSelectedTicketId(ticketId); setActivePage('Ticket Queue'); }} />;
      case 'Escalations':
        return <EscalationsPage isDark={isDark} onOpenTicket={(ticketId) => { setSelectedTicketId(ticketId); setActivePage('Ticket Queue'); }} />;
      case 'SLA Management':
        return <SLAPoliciesPage isDark={isDark} />;
      case 'Agent Performance':
        return <AgentPerformancePage isDark={isDark} />;
      case 'AI Performance':
        return <AIPerformancePage isDark={isDark} />;
      case 'Notifications':
        return <NotificationsPage isDark={isDark} />;
      case 'Profile':
        return <ManagerProfilePage isDark={isDark} />;
      case 'Create Ticket': return <CreateTicketPage isDark={isDark} onOpenKnowledgeArticle={openKnowledgeArticle} onOpenTicket={(ticketId) => { setSelectedTicketId(ticketId); setActivePage('My Tickets'); }} onCreated={(createdTicket) => {
        if (createdTicket) {
          setHomeTickets(current => [createdTicket, ...current.filter(ticket => ticket.ticket_id !== createdTicket.ticket_id)]);
        }
        setActivePage('My Tickets');
        setSelectedTicketId(null);
      }} />;
      case 'Reports':       return <ReportsPage isDark={isDark} />;
      case 'Knowledge Base':return <KnowledgeBaseWorkspace isDark={isDark} initialArticleId={knowledgeArticleId} />;
      case 'Users':         return <UsersPage isDark={isDark} />;
      case 'Settings':      return <SettingsPage isDark={isDark} toggleTheme={toggleTheme} />;
      case 'Taxonomy':      return <TaxonomyPage isDark={isDark} />;
      case 'SLA policies':  return <SLAPoliciesPage isDark={isDark} />;
      default:              return null;
    }
  };

  const activeSidebarGroups = (user?.role === 'Support Manager' || user?.role === 'Manager')
    ? managerSidebarGroups
    : sidebarGroups;

  return (
    <div className={`min-h-screen flex ${isDark ? 'bg-gray-950' : 'bg-slate-50'}`}>

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <>
        {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}
        <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:sticky top-0 z-40 h-screen w-64 shrink-0 flex flex-col transition-transform duration-300 ${isDark ? 'bg-gray-900 border-r border-gray-800' : 'bg-white border-r border-gray-200'}`}>

          {/* Logo */}
          <div className={`flex items-center gap-3 px-5 h-16 border-b shrink-0 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
            <img src="/images/logo.png" alt="AITicketPilot logo" className="h-9 w-9 object-contain shrink-0" />
            <div>
              <p className={`text-sm font-bold leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>AITicketPilot</p>
              <p className={`text-[9px] font-semibold tracking-widest uppercase ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Smarter Support. Faster Resolution.</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-4">
           {activeSidebarGroups.map(group => {

            const visibleItems = group.items.filter(
              item =>
              !item.capability ||
              can(item.capability)
            );

            if (visibleItems.length === 0) {
              return null;
            }

            return (
              <div key={group.title}>
                <p
                  className={`px-3 text-[9px] font-semibold uppercase tracking-[0.2em] ${
                    isDark ? 'text-gray-500' : 'text-slate-400'
                  }`}
                >
                  {group.title}
              </p>

              <div className="mt-2 space-y-1">
                {visibleItems.map(item => {
                  const active = activePage === item.name;

                  return (
                    <button
                      key={item.name}
                      onClick={() => {
                        setActivePage(item.name);
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        active
                          ? 'bg-blue-600 text-white shadow-sm'
                          : isDark
                            ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      <item.icon className="w-4 h-4 shrink-0" />

                      <span>{item.name}</span>

                      {item.badge && (
                        <span
                          className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            active
                              ? 'bg-white/20 text-white'
                              : 'bg-blue-100 text-blue-600'
                          }`}
                        >
                          {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
            {/* Ticket status quick view */}
            <div className="mt-4 px-2">
              <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Ticket status</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />
                    <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>P1 (Critical)</span>
                  </div>
                  <div className="font-semibold">{p1Count}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                    <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>P2 (High)</span>
                  </div>
                  <div className="font-semibold">{p2Count}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                    <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>P3 (Medium)</span>
                  </div>
                  <div className="font-semibold">{p3Count}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-500 inline-block" />
                    <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>P4 (Low)</span>
                  </div>
                  <div className="font-semibold">{p4Count}</div>
                </div>
              </div>
            </div>
          </nav>

          {/* User card */}
          <div className={`p-3 border-t shrink-0 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
            <div className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">{user?.avatar}</div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{user?.name}</p>
                <p className="text-xs text-green-500 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" /> {user?.role}</p>
              </div>
              <button onClick={handleSignOut} title="Sign out" className={`ml-auto p-1.5 rounded-lg ${isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'}`}>
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      </>

      {/* ── Main area ─────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Top bar */}
        <header className={`sticky top-0 z-20 h-16 flex items-center gap-3 px-4 sm:px-6 border-b shrink-0 ${isDark ? 'bg-gray-950/90 border-gray-800 backdrop-blur' : 'bg-white/90 border-gray-200 backdrop-blur'}`}>
          <button onClick={() => setSidebarOpen(true)} className={`lg:hidden p-2 rounded-lg ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <h1 className={`text-lg font-bold leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{activePage}</h1>
            {activePage === 'Dashboard' && (
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Welcome back, {user?.name?.split(' ')[0]} &#x1F44B;</p>
            )}
            {activePage === 'My Tickets' && (
              <div className="mt-2 flex items-center gap-4">
                <button onClick={() => setActivePage('My Tickets')} className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>My tickets</button>
                <button onClick={() => setActivePage('Create Ticket')} className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Raise a ticket</button>
                <button onClick={() => setActivePage('Knowledge Base')} className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Self-help</button>
              </div>
            )}
          </div>

          {/* Search */}
          <div className={`hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl flex-1 max-w-sm ml-4 ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
            <Search className={`w-4 h-4 shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            <input placeholder="Search tickets, users..." className={`bg-transparent outline-none text-sm flex-1 ${isDark ? 'text-white placeholder-gray-600' : 'text-gray-900 placeholder-gray-400'}`} />
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <button onClick={toggleTheme} className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100'}`}>
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="relative">
              <button
                onClick={() => handleQuickAction('help')}
                className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <HelpCircle className="w-4 h-4" />
              </button>
              {quickInfo === 'help' && (
                <div className={`absolute right-0 top-11 w-64 rounded-xl border p-3 shadow-lg z-30 ${isDark ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700'}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">{quickInfoContent.help.title}</p>
                  <p className="mt-2 text-sm leading-relaxed">{quickInfoContent.help.text}</p>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => handleQuickAction('messages')}
                className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              {quickInfo === 'messages' && (
                <div className={`absolute right-0 top-11 w-64 rounded-xl border p-3 shadow-lg z-30 ${isDark ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700'}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">{quickInfoContent.messages.title}</p>
                  <p className="mt-2 text-sm leading-relaxed">{quickInfoContent.messages.text}</p>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => handleQuickAction('alerts')}
                className={`relative p-2 rounded-lg transition-colors ${isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
              </button>
              {quickInfo === 'alerts' && (
                <div className={`absolute right-0 top-11 w-64 rounded-xl border p-3 shadow-lg z-30 ${isDark ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700'}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">{quickInfoContent.alerts.title}</p>
                  <p className="mt-2 text-sm leading-relaxed">{quickInfoContent.alerts.text}</p>
                </div>
              )}
            </div>
            {/* User avatar */}
            <div className="relative ml-2 pl-3 border-l border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setProfileOpen(o => !o)}
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-gray-100/80 dark:hover:bg-gray-800"
              >
                <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">{user?.avatar}</div>
                <div className="hidden sm:block text-left">
                  <p className={`text-sm font-semibold leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{user?.name}</p>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{user?.role}</p>
                </div>
              </button>

              {profileOpen && (
                <div className={`absolute right-0 top-12 w-56 rounded-xl border shadow-xl z-40 ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className={`border-b px-3 py-2 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{user?.name}</p>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{user?.email}</p>
                  </div>
                  <div className="p-2 space-y-1">
                    {[
                      { label: 'Profile', action: () => { setActivePage('Users'); setProfileOpen(false); } },
                      { label: 'Settings', action: () => { setActivePage('Settings'); setProfileOpen(false); } },
                      { label: 'Help', action: () => { handleQuickAction('help'); setProfileOpen(false); } },
                      { label: 'Logout', danger: true, action: () => { setProfileOpen(false); handleSignOut(); } },
                    ].map(item => (
                      <button
                        key={item.label}
                        onClick={item.action}
                        className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${item.danger ? (isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50') : (isDark ? 'text-gray-200 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-100')}`}
                      >
                        <span>{item.label}</span>
                        <span className={item.danger ? 'text-base' : 'text-xs'}>{item.label === 'Help' ? '?' : item.label === 'Settings' ? '⚙' : item.label === 'Profile' ? '👤' : '→'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">

          {activePage !== 'Dashboard' ? (
            renderPage()
          ) : (
            /* ── Dashboard Home ─────────────────────────────────── */
            <div className="space-y-6">

              {/* Stat cards */}
              {(() => {
                const isSupportManager = user?.role === 'Support Manager' || user?.role === 'Manager';
                const homeOpenCount = homeTickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length;
                const homeHighPriorityCount = homeTickets.filter(t => (t.priority === 'P1' || t.priority === 'P2' || t.severity === 'HIGH' || t.severity === 'CRITICAL') && t.status !== 'Resolved' && t.status !== 'Closed').length;
                const homeSlaBreachesCount = homeTickets.filter(t => {
                  if (t.status === 'Resolved' || t.status === 'Closed') return false;
                  const sla = t.sla;
                  if (!sla) return false;
                  const due = sla.resolution_due || sla.first_response_due;
                  return due ? new Date(due) < new Date() : false;
                }).length;
                const homeEscalationsCount = homeTickets.filter(t => 
                  t.priority === 'P1' || t.severity === 'CRITICAL' || t.work_blocked === 'YES' || homeSlaBreachesCount > 0
                ).length;

                const managerHomeStats = [
                  { label: 'Open Tickets', value: String(homeOpenCount), change: 'Awaiting resolution', icon: Ticket, iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
                  { label: 'High Priority', value: String(homeHighPriorityCount), change: 'P1 / P2 Cases', icon: AlertCircle, iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
                  { label: 'SLA Breaches', value: String(homeSlaBreachesCount), change: 'Past SLA target', icon: AlertTriangle, iconBg: 'bg-red-50', iconColor: 'text-red-600' },
                  { label: 'Escalations', value: String(homeEscalationsCount), change: 'Urgent attention', icon: ShieldCheck, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600' },
                  { label: 'Avg Resolution Time', value: '2.4 hrs', change: 'Team average', icon: Clock, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
                ];

                const homeUnassignedCount = homeTickets.filter(t => !t.assignee || t.assignee === 'Unassigned').length;
                const dynamicHomeStats = [
                  { label: 'Total Tickets', value: String(homeTickets.length), change: 'Total created', icon: Ticket, iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
                  { label: 'Open Queue', value: String(homeOpenCount), change: 'Active tickets', icon: AlertCircle, iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
                  { label: 'Unassigned', value: String(homeUnassignedCount), change: 'Pending team', icon: HelpCircle, iconBg: 'bg-orange-50', iconColor: 'text-orange-600' },
                  { label: 'Avg Response', value: '15m', change: 'Standard SLA', icon: Zap, iconBg: 'bg-green-50', iconColor: 'text-green-600' },
                ];

                const activeStats = isSupportManager ? managerHomeStats : dynamicHomeStats;

                return (
                  <div className={`grid gap-4 ${isSupportManager ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5' : 'grid-cols-2 xl:grid-cols-4'}`}>
                    {activeStats.map(s => (
                      <div key={s.label} className={`relative overflow-hidden p-5 rounded-2xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                        <p className={`text-xs font-semibold tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{s.label}</p>
                        <p className={`text-3xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{s.value}</p>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs text-green-500 font-semibold">{s.change}</span>
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-gray-800' : s.iconBg}`}>
                            <s.icon className={`w-4 h-4 ${s.iconColor}`} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <div className={`rounded-3xl border p-5 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>My Tickets shortcut</p>
                    <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Jump directly to your ticket list from the dashboard.</p>
                  </div>
                  <button
                    onClick={() => setActivePage('My Tickets')}
                    className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    Open My Tickets
                  </button>
                </div>
              </div>

                {/* Recent Tickets table */}
                <div className={`rounded-2xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                  <div className={`flex items-start justify-between px-5 pt-5 pb-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
                    <div>
                      <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Recent Tickets</h2>
                      <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Overview of the latest cases reported</p>
                    </div>
                    <button
                      onClick={() => setActivePage('My Tickets')}
                      className="text-sm text-blue-600 font-semibold flex items-center gap-1 hover:text-blue-700 shrink-0"
                    >
                      View All <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Table header */}
                  <div className={`grid grid-cols-12 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    <span className="col-span-5">Subject</span>
                    <span className="col-span-4">Priority / Severity</span>
                    <span className="col-span-3">Status</span>
                  </div>

                  {/* Rows */}
                  <div className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                    {loadingHome ? (
                      <p className="text-center py-6 text-sm text-gray-500">Loading tickets...</p>
                    ) : homeError ? (
                      <p className="text-center py-6 text-sm text-red-500">{homeError}</p>
                    ) : homeTickets.length === 0 ? (
                      <p className="text-center py-6 text-sm text-gray-500">No tickets found. Create your first ticket!</p>
                    ) : (
                      homeTickets.slice(0, 5).map(t => (
                        <div key={t.ticket_id} onClick={() => { setSelectedTicketId(t.ticket_id); setActivePage('My Tickets'); }} className={`grid grid-cols-12 items-center px-5 py-3.5 cursor-pointer transition-colors ${isDark ? 'hover:bg-gray-800/60' : 'hover:bg-gray-50'}`}>
                          <span className={`col-span-5 text-sm font-medium truncate pr-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t.ticket_id}: {t.subject}</span>
                          <span className="col-span-4 flex items-center gap-1.5 flex-wrap">
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getPriorityBadgeClasses(t.priority, isDark)}`}>{t.priority || 'N/A'}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getSeverityBadgeClasses(t.severity, isDark)}`}>{t.severity || 'N/A'}</span>
                          </span>
                          <span className="col-span-3">
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getTicketStatusClasses(t.status, isDark)}`}>{t.status}</span>
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              {/* Ticket Overview + Tickets by Priority */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className={`xl:col-span-2 p-5 rounded-2xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                  <h3 className={`text-base font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Ticket Overview <span className={`text-xs font-normal ml-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Weekly Volume</span></h3>
                  <div className="flex items-end gap-3 h-28">
                    {[55, 38, 70, 48, 90, 62, 44].map((h, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-blue-500 rounded-t-lg transition-all" style={{ height: `${h}%` }} />
                        <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{['M','T','W','T','F','S','S'][i]}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={`p-5 rounded-2xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                  <h3 className={`text-base font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Tickets by Priority</h3>
                  <div className="space-y-3">
                    {[['High', 38, 'bg-red-500'], ['Medium', 44, 'bg-amber-400'], ['Low', 18, 'bg-green-500']].map(([label, pct, color]) => (
                      <div key={label as string}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{label}</span>
                          <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>{pct}%</span>
                        </div>
                        <div className={`h-2 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                          <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  );
}
