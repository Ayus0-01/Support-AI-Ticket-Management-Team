import { useState, useEffect, useRef } from 'react';
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
  Ticket as ApiTicket,
  TimelineEvent,
} from "../services/ticketService";

import {
  Bot, Sun, Moon, LayoutDashboard, Ticket, PlusCircle, Sparkles, BarChart3,
  BookOpen, Users, Settings, LogOut, Search, Bell, HelpCircle, MessageSquare,
  Send, ChevronRight, Tag, Menu, X, Ticket as TicketIcon,
  AlertCircle, Zap, ShieldCheck,
} from 'lucide-react';
import ResolutionPanel from "../components/resolution/ResolutionPanel";
import KnowledgeBaseWorkspace from "../components/knowledge-base/KnowledgeBasePage";
import SuggestedArticles from "../components/knowledge-base/SuggestedArticles";

interface DashboardProps {
  onNavigate: (page: string) => void;
  initialPage?: NavPage;
}

export type NavPage = 'Dashboard' | 'My queue' | 'My Tickets' | 'Create Ticket' | 'AI Assistant' | 'Reports' | 'Knowledge Base' | 'Users' | 'Settings' | 'Taxonomy' | 'SLA policies';

const AI_QUICK_ACTIONS = ['Summarize tickets', 'Show unresolved tickets', 'Draft reply', 'Escalate ticket'];
const AUTO_CATEGORY = 'Not sure — let AI decide';

const formatCategoryLabel = (category: string) => category
  .replace(/[_-]+/g, ' ')
  .toLocaleLowerCase()
  .replace(/\b\p{L}/gu, (character) => character.toLocaleUpperCase());

function DashboardHeroArt({ isDark, compact = false }: { isDark: boolean; compact?: boolean }) {
  return (
    <div className={`relative w-full overflow-hidden ${compact ? 'h-[180px]' : 'h-[420px]'}`}>
      <svg viewBox="0 0 1400 420" className="h-full w-full" role="img" aria-label="Customer support illustration">
        <defs>
          <linearGradient id="dashPanelBg" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#f2ebc7" />
            <stop offset="100%" stopColor="#efe7ba" />
          </linearGradient>
          <linearGradient id="heroBlue" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#0d6be6" />
            <stop offset="100%" stopColor="#0d4fa8" />
          </linearGradient>
          <linearGradient id="heroBlueSoft" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#67c8ff" />
            <stop offset="100%" stopColor="#1f6ae6" />
          </linearGradient>
        </defs>

        <rect width="1400" height="420" fill="url(#dashPanelBg)" />

        <g opacity="0.18">
          <rect x="38" y="96" width="220" height="160" rx="18" fill="#d1b7c6" />
          <rect x="260" y="110" width="150" height="190" rx="18" fill="#c7d5bc" />
          <rect x="970" y="90" width="240" height="160" rx="18" fill="#d5d5d5" />
        </g>

        <g transform="translate(40 50)">
          <g transform="translate(20 104)">
            <rect x="0" y="18" width="168" height="158" rx="22" fill="#1c6fe4" opacity="0.2" />
            <rect x="20" y="40" width="118" height="110" rx="12" fill="#e4effb" />
            <rect x="33" y="54" width="92" height="52" rx="8" fill="#93a9d9" opacity="0.45" />
            <rect x="38" y="114" width="18" height="20" rx="4" fill="#93a9d9" opacity="0.5" />
            <rect x="60" y="114" width="18" height="20" rx="4" fill="#93a9d9" opacity="0.5" />
            <rect x="82" y="114" width="18" height="20" rx="4" fill="#93a9d9" opacity="0.5" />
            <rect x="104" y="114" width="18" height="20" rx="4" fill="#93a9d9" opacity="0.5" />
          </g>

          <g transform="translate(160 110)">
            <circle cx="0" cy="0" r="14" fill="#f2c6b7" />
            <path d="M-18 40 L-4 22 L18 40 L10 110 L-10 110 Z" fill="#f2c6b7" />
            <path d="M-8 20 Q0 -24 18 10 L30 90 L-30 90 L-18 10 Z" fill="#f8d5cb" />
            <circle cx="0" cy="0" r="10" fill="#0b0d15" />
            <ellipse cx="-18" cy="-16" rx="8" ry="12" fill="#f3d9d1" />
            <ellipse cx="18" cy="-16" rx="8" ry="12" fill="#f3d9d1" />
            <rect x="-22" y="70" width="44" height="60" rx="20" fill="#d7e4ff" opacity="0.3" />
          </g>

          <g transform="translate(350 78)">
            <path d="M10 60 Q108 -10 190 52 L182 176 L20 180 Z" fill="#2aa370" opacity="0.94" />
            <path d="M70 20 L110 20 L126 100 L50 100 Z" fill="#f4f5f7" opacity="0.9" />
            <path d="M70 20 L90 10 L132 16 L126 100 L50 100 Z" fill="#dfe2ea" opacity="0.8" />
            <path d="M46 104 L178 104" stroke="#f2f5f8" strokeWidth="8" strokeLinecap="round" />
            <path d="M54 110 L96 108 L130 110" stroke="#94a6c7" strokeWidth="6" strokeLinecap="round" opacity="0.7" />
            <circle cx="110" cy="40" r="26" fill="#f0d768" />
            <circle cx="110" cy="40" r="12" fill="#fff" opacity="0.8" />
            <path d="M92 110 Q100 90 122 110" stroke="#0d111c" strokeWidth="10" strokeLinecap="round" fill="none" />
            <path d="M58 70 L38 90" stroke="#0d111c" strokeWidth="10" strokeLinecap="round" />
            <path d="M134 68 L167 93" stroke="#0d111c" strokeWidth="10" strokeLinecap="round" />
          </g>

          <g transform="translate(610 45)">
            <g>
              <circle cx="220" cy="180" r="160" fill="#0e5ec7" opacity="0.9" />
              <circle cx="220" cy="180" r="106" fill="#e4eef9" opacity="0.18" />
              <circle cx="220" cy="180" r="140" fill="none" stroke="#1d6be6" strokeWidth="18" opacity="0.6" />
              <circle cx="220" cy="180" r="120" fill="none" stroke="#a8d7ff" strokeWidth="9" opacity="0.7" />
              <path d="M92 183 C120 130, 170 105, 220 105 C278 105, 322 134, 344 183" fill="none" stroke="#0f50b8" strokeWidth="16" opacity="0.55" />
              <circle cx="220" cy="180" r="76" fill="#f0f5ff" />
              <circle cx="220" cy="180" r="60" fill="#f8f8f8" />
              <circle cx="220" cy="180" r="16" fill="#f0bf43" />
              <path d="M214 174 Q226 154 236 176" stroke="#3a4c7d" strokeWidth="9" strokeLinecap="round" fill="none" />
              <path d="M184 152 C196 137, 214 132, 222 142 C224 169, 204 170, 190 176" fill="#0b101e" opacity="0.9" />
              <path d="M252 150 C266 136, 280 136, 292 142 C300 160, 292 176, 274 180" fill="#0b101e" opacity="0.9" />
              <path d="M136 217 C161 253, 185 266, 220 266 C264 266, 286 245, 304 220" fill="none" stroke="#0d101d" strokeWidth="12" strokeLinecap="round" />
            </g>
            <g fill="#f5f7fb">
              <circle cx="110" cy="160" r="21" />
              <circle cx="150" cy="110" r="21" />
              <circle cx="294" cy="116" r="19" />
              <circle cx="332" cy="178" r="20" />
              <circle cx="298" cy="246" r="18" />
              <circle cx="144" cy="254" r="22" />
            </g>
            <g fill="#f3b82f">
              <circle cx="110" cy="160" r="9" />
              <circle cx="150" cy="110" r="9" />
              <circle cx="294" cy="116" r="8" />
              <circle cx="332" cy="178" r="8" />
              <circle cx="298" cy="246" r="8" />
              <circle cx="144" cy="254" r="8" />
            </g>
          </g>

          <g transform="translate(1160 95)">
            <rect x="0" y="30" width="90" height="140" rx="20" fill="#f6f5f5" opacity="0.9" />
            <rect x="18" y="54" width="52" height="68" rx="10" fill="#0f2b78" opacity="0.95" />
            <rect x="24" y="66" width="40" height="14" rx="7" fill="#0d9ae7" opacity="0.85" />
            <rect x="24" y="90" width="40" height="14" rx="7" fill="#72ccff" opacity="0.7" />
            <rect x="26" y="118" width="18" height="18" rx="9" fill="#f1b834" opacity="0.9" />
            <rect x="46" y="118" width="18" height="18" rx="9" fill="#f1b834" opacity="0.9" />
          </g>
        </g>
      </svg>
    </div>
  );
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
        icon: TicketIcon,
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
        name: 'AI Assistant',
        icon: Sparkles,
      },

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

        setQueueTickets(data);
        return;
      }

      setLoading(true);
      setError("");

      const data = await getMyTickets();

      setTickets(data);
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
          "Could not load your tickets."
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
  });

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTickets = filteredTickets.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

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
      .map(row => row.map(value => `\"${String(value).replace(/\"/g, '\\"')}\"`).join(','))
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
      case 'gray': return 'text-slate-600';
      default: return 'text-slate-600';
    }
  };

  const filterField = `w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-colors focus:border-blue-500 ${isDark ? 'bg-gray-950 border-gray-800 text-white' : 'bg-white border-gray-200 text-slate-900'}`;

  // Live ticket workspace. Agent/Admin can operate on queue tickets; users see safe details + timeline.
  if (selectedTicketId) {
    const classification = (detailTicket?.classification || {}) as Record<string, any>;
    const categoryMeta = classification.category || {};
    const subcategoryMeta = classification.subcategory || {};
    const severityMeta = classification.severity || {};
    const priorityMeta = classification.priority || {};
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
      } catch (error: any) {
        setActionError(error?.response?.data?.message || error?.message || 'Could not apply classification override.');
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
      } catch (error: any) {
        setActionError(error?.response?.data?.message || error?.message || 'Could not change ticket status.');
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
      } catch (error: any) {
        setActionError(error?.response?.data?.message || error?.message || 'Could not add the comment.');
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
                    <span className="rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-semibold">{detailTicket.status}</span>
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
    const queueRows = queueTickets;

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
                  <th className="w-12 px-4 py-3"></th>
                  <th className="text-left px-4 py-3 font-semibold">Ticket</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold">Requester</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                {queueLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">Loading agent queue...</td>
                  </tr>
                ) : queueError ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-red-500">{queueError}</td>
                  </tr>
                ) : queueRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">No active tickets in the queue.</td>
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
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${isDark ? 'bg-gray-800 text-gray-200' : 'bg-slate-100 text-slate-700'}`}>
                          {row.status}
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
  const openCount = tickets.filter(t => t.status !== 'Resolved' && t.status !== 'Closed').length;
  const resolvedCount = tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length;

  const dynamicSummary = [
    { label: 'TOTAL TICKETS', value: String(tickets.length), note: 'Total created', tone: 'green' },
    { label: 'OPEN TICKETS', value: String(openCount), note: 'Active queue', tone: 'red' },
    { label: 'RESOLVED', value: String(resolvedCount), note: 'Completed', tone: 'green' },
    { label: 'UNASSIGNED', value: String(tickets.filter(t => !t.assignee || t.assignee === 'Unassigned').length), note: 'Pending assignment', tone: 'gray' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
          <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {openCount} open · {resolvedCount} resolved in the last 30 days
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
) : (
  paginatedTickets.map(row => (    <div key={row.ticket_id} className={`flex items-center justify-between p-4 rounded-2xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-md flex items-center justify-center ${isDark ? 'bg-gray-800 text-gray-200' : 'bg-slate-100 text-slate-700'}`}>
          <TicketIcon className="h-4 w-4" aria-hidden="true" />
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
      <div className="text-right flex flex-col items-end gap-1">
        <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
          {row.status}
        </div>
        <div className="text-xs text-slate-500">
          Assignee: {row.assignee || 'Unassigned'}
        </div>
      </div>
    </div>
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
    value: string;
    confidence: number;
    route?: string;
  };
  subcategory?: {
    value: string;
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
    } catch (error: any) {
      console.error('Create ticket failed:', error);
      setSubmitError(
        error.response?.data?.message ||
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
          {[
            ['Category', preview?.category?.value || (previewLoading ? 'Classifying...' : '—')],
            ['Sub-category', preview?.subcategory?.value || (previewLoading ? 'Classifying...' : '—')],
            ['Severity', 'Final on submit'],
            ['Priority', 'Final on submit'],
            ['Est. first response', 'Final on submit'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between rounded-2xl border px-4 py-3">
              <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{label}</span>
              <span className="text-sm font-semibold text-slate-900">{value}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl bg-slate-100 p-4">
          <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
            <span>Confidence</span>
            <span>{preview?.category?.confidence ? `${Math.round(preview.category.confidence * 100)}%` : '—'}</span>
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

function UsersPage({ isDark }: { isDark: boolean }) {
  const users = [
    {
      name: 'Current User',
      email: 'user@example.com',
      avatar: 'U',
      role: 'User',
      tickets: 0,
    },
  ];
  return (
    <div className="space-y-4">
      <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Users</h2>
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
              {['User', 'Role', 'Tickets Assigned'].map(h => (
                <th key={h} className={`text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
            {users.map(u => (
              <tr key={u.email} className={isDark ? 'hover:bg-gray-800/60' : 'hover:bg-gray-50'}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-xs font-bold">{u.avatar}</div>
                    <div>
                      <p className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{u.name}</p>
                      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${u.role === 'Admin' ? isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-100 text-blue-600' : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>{u.role}</span>
                </td>
                <td className={`px-4 py-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{u.tickets ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

      setHomeTickets(data);
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

  useEffect(() => {
    if (initialPage) {
      setActivePage(initialPage);
    }
  }, [initialPage]);

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
      case 'My Tickets':
        return <MyTicketsPage title="My Tickets" isDark={isDark} selectedTicketId={selectedTicketId} onOpenTicket={handleOpenTicket} onBack={handleBackToList} onRaise={() => setActivePage('Create Ticket')} onOpenKB={openKnowledgeBase} canViewClassification={can('VIEW_CLASSIFICATION')} />;
      case 'My queue':
        if (!can('VIEW_AGENT_QUEUE')) {
          return <MyTicketsPage title="My Tickets" isDark={isDark} selectedTicketId={selectedTicketId} onOpenTicket={handleOpenTicket} onBack={handleBackToList} onRaise={() => setActivePage('Create Ticket')} onOpenKB={openKnowledgeBase} canViewClassification={can('VIEW_CLASSIFICATION')} />;
        }
        return <MyTicketsPage title="My queue" isDark={isDark} selectedTicketId={selectedTicketId} onOpenTicket={handleOpenTicket} onBack={handleBackToList} onRaise={() => setActivePage('Create Ticket')} onOpenKB={openKnowledgeBase} canViewClassification={can('VIEW_CLASSIFICATION')} />;
      case 'Create Ticket': return <CreateTicketPage isDark={isDark} onOpenKnowledgeArticle={openKnowledgeArticle} onOpenTicket={(ticketId) => { setSelectedTicketId(ticketId); setActivePage('My Tickets'); }} onCreated={(createdTicket) => {
        if (createdTicket) {
          setHomeTickets(current => [createdTicket, ...current.filter(ticket => ticket.ticket_id !== createdTicket.ticket_id)]);
        }
        setActivePage('My Tickets');
        setSelectedTicketId(null);
      }} />;
      case 'AI Assistant':  return <AIAssistantPage isDark={isDark} chat={aiChat} setChat={setAiChat} />;
      case 'Reports':       return <ReportsPage isDark={isDark} />;
      case 'Knowledge Base':return <KnowledgeBaseWorkspace isDark={isDark} initialArticleId={knowledgeArticleId} />;
      case 'Users':         return <UsersPage isDark={isDark} />;
      case 'Settings':      return <SettingsPage isDark={isDark} toggleTheme={toggleTheme} />;
      case 'Taxonomy':      return <TaxonomyPage isDark={isDark} />;
      case 'SLA policies':  return <SLAPoliciesPage isDark={isDark} />;
      default:              return null;
    }
  };

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
           {sidebarGroups.map(group => {
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
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Help Center</p>
                  <p className="mt-2 text-sm leading-relaxed">Browse onboarding guides, escalation steps, and SLA policies for your support team.</p>
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
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Messages</p>
                  <p className="mt-2 text-sm leading-relaxed">Customer replies are waiting for review. Use AI to draft responses and prioritize follow-ups.</p>
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
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Alerts</p>
                  <p className="mt-2 text-sm leading-relaxed">Three urgent tickets need attention and two SLA thresholds are approaching the deadline.</p>
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
                const homeOpenCount = homeTickets.filter(t => t.status !== 'Resolved' && t.status !== 'Closed').length;
                const homeUnassignedCount = homeTickets.filter(t => !t.assignee || t.assignee === 'Unassigned').length;

                const dynamicHomeStats = [
                  { label: 'Total Tickets', value: String(homeTickets.length), change: 'Total created', icon: TicketIcon, iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
                  { label: 'Open Queue', value: String(homeOpenCount), change: 'Active tickets', icon: AlertCircle, iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
                  { label: 'Unassigned', value: String(homeUnassignedCount), change: 'Pending team', icon: HelpCircle, iconBg: 'bg-orange-50', iconColor: 'text-orange-600' },
                  { label: 'Avg Response', value: '15m', change: 'Standard SLA', icon: Zap, iconBg: 'bg-green-50', iconColor: 'text-green-600' },
                ];

                return (
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                    {dynamicHomeStats.map(s => (
                      <div key={s.label} className={`relative overflow-hidden p-5 rounded-2xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                        <p className={`text-xs font-semibold tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{s.label}</p>
                        <p className={`text-4xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{s.value}</p>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs text-green-500 font-semibold">{s.change}</span>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-gray-800' : s.iconBg}`}>
                            <s.icon className={`w-5 h-5 ${s.iconColor}`} />
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

              {/* Main two-column */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Recent Tickets table */}
                <div className={`xl:col-span-2 rounded-2xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
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
                    <span className="col-span-9">Subject</span>
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
                          <span className={`col-span-9 text-sm font-medium truncate pr-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t.ticket_id}: {t.subject}</span>
                          <span className="col-span-3">
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">{t.status}</span>
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* AI Assistant panel */}
                <div className={`rounded-2xl border flex flex-col ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`} style={{ minHeight: 440 }}>
                  {/* Header */}
                  <div className={`flex items-center gap-3 px-4 pt-4 pb-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shrink-0">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>AI Assistant</p>
                        <span className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full">BETA</span>
                      </div>
                      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Powered by AITicketPilot AI Agent</p>
                    </div>
                  </div>

                  {/* Chat */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {aiChat.map((m, i) => (
                      <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[88%] px-3.5 py-2.5 text-sm rounded-2xl ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : isDark ? 'bg-gray-800 text-gray-200 rounded-bl-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                          {m.text}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Quick actions */}
                  <div className={`px-4 pb-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
                    <div className="flex flex-wrap gap-2">
                      {AI_QUICK_ACTIONS.slice(0, 2).map(a => (
                        <button key={a} onClick={() => sendAi(a)} className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                          <Zap className="w-3 h-3 text-amber-500" /> {a}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Input */}
                  <div className="p-3">
                    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                      <input
                        value={aiInput}
                        onChange={e => setAiInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendAi()}
                        placeholder="Ask AI anything..."
                        className={`flex-1 bg-transparent outline-none text-sm ${isDark ? 'text-white placeholder-gray-600' : 'text-gray-900 placeholder-gray-400'}`}
                      />
                      <button onClick={() => sendAi()} className="w-8 h-8 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center transition-colors shrink-0">
                        <Send className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  </div>
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

      {/* Floating chat button */}
      <button
        onClick={() => setActivePage('AI Assistant')}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-xl flex items-center justify-center transition-all z-50"
      >
        <MessageSquare className="w-6 h-6" />
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center">3</span>
      </button>
    </div>
  );
}
