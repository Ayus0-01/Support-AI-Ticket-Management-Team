import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { createTicket, getMyTickets, getTicketDetails, Ticket as ApiTicket } from "../services/ticketService";

import {
  Bot, Sun, Moon, LayoutDashboard, Ticket, PlusCircle, Sparkles, BarChart3,
  BookOpen, Users, Settings, LogOut, Search, Bell, HelpCircle, MessageSquare,
  Send, ChevronRight, Tag, Filter, Menu, X, TrendingUp, Ticket as TicketIcon,
  PlayCircle, CheckCircle2, AlertCircle, Zap, ShieldCheck,
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (page: string) => void;
  initialPage?: NavPage;
}

type NavPage = 'Dashboard' | 'My queue' | 'My Tickets' | 'Create Ticket' | 'AI Assistant' | 'Reports' | 'Knowledge Base' | 'Users' | 'Settings' | 'Taxonomy' | 'SLA policies';

interface Ticket {
  id: string;
  subject: string;
  category: 'Bug' | 'Other' | 'Login' | 'Feature Request' | 'Billing' | 'Integration';
  priority: 'High' | 'Medium' | 'Low';
  status: 'In Progress' | 'Resolved' | 'Open';
}

const TICKETS: Ticket[] = [
  { id: 'TCK-128', subject: 'Sample Bug issue #1119',            category: 'Bug',             priority: 'High',   status: 'In Progress' },
  { id: 'TCK-127', subject: 'Sample Other issue #1118',          category: 'Other',           priority: 'Low',    status: 'Resolved'    },
  { id: 'TCK-126', subject: 'Sample Login issue #1117',          category: 'Login',           priority: 'Medium', status: 'In Progress' },
  { id: 'TCK-125', subject: 'Sample Bug issue #1116',            category: 'Bug',             priority: 'High',   status: 'In Progress' },
  { id: 'TCK-124', subject: 'Sample Feature Request issue #1115',category: 'Feature Request', priority: 'Medium', status: 'Resolved'    },
  { id: 'TCK-123', subject: 'Sample Billing issue #1114',        category: 'Billing',         priority: 'High',   status: 'Open'        },
  { id: 'TCK-122', subject: 'Sample Integration issue #1113',    category: 'Integration',     priority: 'Low',    status: 'Open'        },
  { id: 'TCK-121', subject: 'Sample Bug issue #1112',            category: 'Bug',             priority: 'Medium', status: 'Resolved'    },
];

interface TicketCard {
  id: string;
  subject: string;
  category: string;
  subcategory: string;
  requester: string;
  raised: string;
  priority: string;
  status: string;
  statusDetail: string;
  statusTone: 'green' | 'blue' | 'amber' | 'gray';
  assigned: string;
}

const MY_TICKETS: TicketCard[] = [
  {
    id: 'IT-2026-004521',
    subject: 'VPN connection failing on corporate network',
    category: 'VPN',
    subcategory: 'Connection failure',
    requester: 'Priya Sharma · Finance',
    raised: '12 min ago',
    priority: 'P2',
    status: 'AI processing',
    statusDetail: 'First response due in 48 min',
    statusTone: 'blue',
    assigned: 'Unassigned',
  },
  {
    id: 'IT-2026-004488',
    subject: 'VPN disconnects every few minutes',
    category: 'VPN',
    subcategory: 'Connection failure',
    requester: 'Ramesh N. · Finance',
    raised: '2 days ago',
    priority: 'P3',
    status: 'In progress',
    statusDetail: 'Assigned to Network Team',
    statusTone: 'amber',
    assigned: 'Network Team',
  },
  {
    id: 'IT-2026-004401',
    subject: 'Request: Adobe Acrobat Pro licence',
    category: 'Software',
    subcategory: 'Licensing',
    requester: 'Deeepa R. · Operations',
    raised: '5 days ago',
    priority: 'P4',
    status: 'Waiting on you',
    statusDetail: 'Manager approval needed',
    statusTone: 'gray',
    assigned: 'Manager review',
  },
];

const STATS = [
  { label: 'TOTAL TICKETS', value: 1284, change: '+18.4%', icon: TicketIcon,    bg: 'bg-blue-50',   iconBg: 'bg-blue-100',   iconColor: 'text-blue-500'  },
  { label: 'OPEN TICKETS',  value: 312,  change: '+6.2%',  icon: AlertCircle,   bg: 'bg-amber-50',  iconBg: 'bg-amber-100',  iconColor: 'text-amber-500' },
  { label: 'IN PROGRESS',   value: 547,  change: '+11.3%', icon: PlayCircle,    bg: 'bg-purple-50', iconBg: 'bg-purple-100', iconColor: 'text-purple-500'},
  { label: 'RESOLVED',      value: 425,  change: '+22.7%', icon: CheckCircle2,  bg: 'bg-green-50',  iconBg: 'bg-green-100',  iconColor: 'text-green-500' },
];

const priorityStyle: Record<string, string> = {
  High:   'bg-red-100 text-red-600',
  Medium: 'bg-amber-100 text-amber-600',
  Low:    'bg-green-100 text-green-600',
};
const statusStyle: Record<string, string> = {
  'In Progress': 'bg-blue-100 text-blue-600',
  Resolved:      'bg-green-100 text-green-600',
  Open:          'bg-gray-100 text-gray-600',
};
const darkPriorityStyle: Record<string, string> = {
  High:   'bg-red-500/15 text-red-400',
  Medium: 'bg-amber-500/15 text-amber-400',
  Low:    'bg-green-500/15 text-green-400',
};
const darkStatusStyle: Record<string, string> = {
  'In Progress': 'bg-blue-500/15 text-blue-400',
  Resolved:      'bg-green-500/15 text-green-400',
  Open:          'bg-gray-500/15 text-gray-400',
};

const AI_QUICK_ACTIONS = ['Summarize tickets', 'Show unresolved tickets', 'Draft reply', 'Escalate ticket'];

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

type SidebarItem = { name: NavPage; icon: React.ElementType; badge?: string };
const sidebarGroups: { title: string; items: SidebarItem[] }[] = [
  {
    title: 'Workspace',
    items: [
      { name: 'Dashboard', icon: LayoutDashboard },
      { name: 'My Tickets', icon: Ticket, badge: '127' },
      { name: 'My queue', icon: TicketIcon, badge: '14' },
      { name: 'Create Ticket', icon: PlusCircle },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { name: 'Taxonomy', icon: Tag },
      { name: 'SLA policies', icon: ShieldCheck },
    ],
  },
  {
    title: 'Productivity',
    items: [
      { name: 'AI Assistant', icon: Sparkles, badge: 'BETA' },
      { name: 'Reports', icon: BarChart3 },
      { name: 'Knowledge Base', icon: BookOpen },
    ],
  },
  {
    title: 'Administration',
    items: [
      { name: 'Users', icon: Users },
      { name: 'Settings', icon: Settings },
    ],
  },
];

/* ─── sub-pages ──────────────────────────────────────────────────── */

const MY_TICKET_SUMMARY = [
  { label: 'Received today', value: '127', note: '12% vs yesterday', tone: 'green' },
  { label: 'Classified', value: '124', note: '3 unclassified → general queue', tone: 'gray' },
  { label: 'Classification accuracy', value: '94%', note: 'target ≥ 90%', tone: 'green' },
  { label: 'SLA at risk', value: '6', note: '2 breaching within 1h', tone: 'red' },
] as const;

const MY_TICKET_ROWS = [
  {
    id: 'IT-2026-004521',
    subject: 'VPN connection failing on corporate network',
    requester: 'Priya Sharma · Finance',
    category: 'VPN',
    subcategory: 'Connection failure',
    severity: 'HIGH',
    priority: 'P2',
    confidence: '92%',
    path: 'FAST',
    sla: '48m',
    assignee: 'Unassigned',
    status: 'AI processing',
    statusDetail: 'First response due in 48 min',
    statusTone: 'blue',
    requesterName: 'Priya Sharma',
    department: 'Finance',
    site: 'Chennai',
    assetTag: 'LT-04821',
    description: 'Unable to connect to VPN since this morning. Error message: "Connection timed out. Please check your network settings and try again." Tried restarting the client but issue persists.',
    affected: 'My team',
    blocked: 'Yes, completely',
    workaround: 'None',
    started: 'Today',
  },
  {
    id: 'IT-2026-004510',
    subject: 'ERP login failing for accounts team',
    requester: 'Vinod P. · Finance',
    category: 'APPLICATION',
    subcategory: 'Authentication',
    severity: 'HIGH',
    priority: 'P2',
    confidence: '90%',
    path: 'FAST',
    sla: '22m',
    assignee: 'Unassigned',
    status: 'Open',
    statusDetail: 'SLA: 22m',
    statusTone: 'amber',
    requesterName: 'Vinod P.',
    department: 'Finance',
    site: 'Chennai',
    assetTag: 'LT-09923',
    description: 'Finance team members are unable to log in to the ERP application. It hangs on the loading screen and then times out.',
    affected: 'My team',
    blocked: 'Yes, completely',
    workaround: 'None',
    started: '1 hour ago',
  },
  {
    id: 'IT-2026-004520',
    subject: 'Cannot access shared finance drive',
    requester: 'Ramesh N. · Finance',
    category: 'ACCESS',
    subcategory: 'Permissions',
    severity: 'MEDIUM',
    priority: 'P3',
    confidence: '88%',
    path: 'FAST',
    sla: '2h 10m',
    assignee: 'Arun K.',
    status: 'In progress',
    statusDetail: 'Assigned to Arun K.',
    statusTone: 'amber',
    requesterName: 'Ramesh N.',
    department: 'Finance',
    site: 'Chennai',
    assetTag: 'LT-01640',
    description: 'User cannot open a shared finance drive and is receiving a permissions error when trying to access the folder.',
    affected: 'My team',
    blocked: 'Yes, completely',
    workaround: 'None',
    started: 'Yesterday',
  },
  {
    id: 'IT-2026-004519',
    subject: 'Entire 4th floor has no network connectivity',
    requester: 'Deepa R. · Operations',
    category: 'NETWORK',
    subcategory: 'Connectivity',
    severity: 'CRITICAL',
    priority: 'P1',
    confidence: '96%',
    path: 'FAST',
    sla: '6m',
    assignee: 'Network Team',
    status: 'In progress',
    statusDetail: 'Assigned to Network Team',
    statusTone: 'red',
    requesterName: 'Deepa R.',
    department: 'Operations',
    site: 'Chennai',
    assetTag: 'LT-06111',
    description: 'The entire 4th floor lost network access and is unable to connect to internal systems.',
    affected: 'Whole org',
    blocked: 'Yes, completely',
    workaround: 'None',
    started: 'Today',
  },
  {
    id: 'IT-2026-004518',
    subject: 'Outlook keeps asking for password after update',
    requester: 'Karthik S. · Sales',
    category: 'EMAIL',
    subcategory: 'Mailbox',
    severity: 'MEDIUM',
    priority: 'P3',
    confidence: '68%',
    path: 'LLM',
    sla: '2h 40m',
    assignee: 'Unassigned',
    status: 'Open',
    statusDetail: 'SLA: 2h 40m',
    statusTone: 'amber',
    requesterName: 'Karthik S.',
    department: 'Sales',
    site: 'Mumbai',
    assetTag: 'LT-03022',
    description: 'After the latest Outlook update, the app keeps prompting for credentials and users cannot send emails.',
    affected: 'My team',
    blocked: 'Partially',
    workaround: 'Yes, use webmail',
    started: 'Earlier this week',
  },
  {
    id: 'IT-2026-004517',
    subject: 'Need help with the thing on my screen',
    requester: 'Suresh M. · Admin',
    category: 'UNCLASSIFIED',
    subcategory: '→ general queue',
    severity: '—',
    priority: 'P3',
    confidence: '31%',
    path: 'LLM',
    sla: '1h 55m',
    assignee: 'Unassigned',
    status: 'Unclassified',
    statusDetail: 'In general queue',
    statusTone: 'gray',
    requesterName: 'Suresh M.',
    department: 'Admin',
    site: 'Delhi',
    assetTag: 'LT-01289',
    description: 'The user sees a strange popup on screen and is unsure what to do next.',
    affected: 'Just me',
    blocked: 'No',
    workaround: 'Yes, restart the app',
    started: 'Today',
  },
] as const;

function MyTicketsPage({ title, isDark, selectedTicketId, onOpenTicket, onBack, onExport, onRaise, onOpenKB }: { title: string; isDark: boolean; selectedTicketId: string | null; onOpenTicket: (id: string) => void; onBack: () => void; onExport: (ticket: any) => void; onRaise: () => void; onOpenKB: () => void }) {
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [tickets, setTickets] = useState<ApiTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [detailTicket, setDetailTicket] = useState<ApiTicket | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    const loadTickets = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await getMyTickets();
        setTickets(data);
      } catch (err) {
        console.error("Failed to load tickets:", err);
        setError("Could not load your tickets.");
      } finally {
        setLoading(false);
      }
    };

    loadTickets();
  }, []);

  useEffect(() => {
    if (selectedTicketId) {
      const fetchDetail = async () => {
        try {
          setLoadingDetail(true);
          setDetailError("");
          const data = await getTicketDetails(selectedTicketId);
          setDetailTicket(data);
        } catch (err) {
          console.error("Failed to fetch ticket detail:", err);
          setDetailError("Could not fetch ticket details.");
        } finally {
          setLoadingDetail(false);
        }
      };
      fetchDetail();
    } else {
      setDetailTicket(null);
    }
  }, [selectedTicketId]);

  const labelColor = (tone: string) => {
    switch (tone) {
      case 'green': return 'text-emerald-600';
      case 'red': return 'text-red-600';
      case 'gray': return 'text-slate-600';
      default: return 'text-slate-600';
    }
  };

  const filterField = `w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-colors focus:border-blue-500 ${isDark ? 'bg-gray-950 border-gray-800 text-white' : 'bg-white border-gray-200 text-slate-900'}`;

  // If detailed view of a ticket is open, show details page layout fetched from GET /api/tickets/<ticket_id>/
  if (selectedTicketId) {
    return (
      <div className="space-y-6">
        <div className={`rounded-3xl border p-5 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4 dark:border-gray-800">
            <div>
              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Ticket Details</p>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Full ticket details fetched live from database.</p>
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
                {/* Left Column: Core Fields */}
                <div className={`rounded-3xl border p-5 ${isDark ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white'}`}>
                  <p className={`text-xs uppercase tracking-[0.2em] font-semibold ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Ticket Information</p>
                  <p className={`mt-2 text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{detailTicket.subject}</p>
                  <p className="mt-1 text-xs text-blue-600 font-mono font-semibold">{detailTicket.ticket_id}</p>

                  <div className="mt-5 space-y-3 text-sm divide-y divide-gray-100 dark:divide-gray-800">
                    <div className="pt-2 flex justify-between">
                      <span className="text-xs text-slate-500 uppercase">Requester</span>
                      <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{detailTicket.requester?.username || 'User'} ({detailTicket.requester?.email || 'N/A'})</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <span className="text-xs text-slate-500 uppercase">Category</span>
                      <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{detailTicket.category}</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <span className="text-xs text-slate-500 uppercase">Subcategory</span>
                      <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{detailTicket.subcategory || 'N/A'}</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <span className="text-xs text-slate-500 uppercase">Department</span>
                      <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{detailTicket.department || 'N/A'}</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <span className="text-xs text-slate-500 uppercase">Site</span>
                      <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{detailTicket.site || 'N/A'}</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <span className="text-xs text-slate-500 uppercase">Asset Tag</span>
                      <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{detailTicket.asset_tag || 'N/A'}</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <span className="text-xs text-slate-500 uppercase">Preferred Contact</span>
                      <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{detailTicket.preferred_contact || 'Email'}</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Status & System Metadata */}
                <div className={`rounded-3xl border p-5 ${isDark ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white'}`}>
                  <p className={`text-xs uppercase tracking-[0.2em] font-semibold ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Status & System Metadata</p>
                  
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-semibold">{detailTicket.status}</span>
                    {/* Priority Badge (View-Only per IMP rule) */}
                    <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-semibold">Priority: {detailTicket.priority || 'P3'} (View Only)</span>
                    <span className="rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-xs font-semibold">Severity: {detailTicket.severity || 'Normal'}</span>
                  </div>

                  <div className="mt-5 space-y-3 text-sm divide-y divide-gray-100 dark:divide-gray-800">
                    <div className="pt-2 flex justify-between">
                      <span className="text-xs text-slate-500 uppercase">Assignee</span>
                      <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{detailTicket.assignee || 'Unassigned'}</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <span className="text-xs text-slate-500 uppercase">SLA Target</span>
                      <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{detailTicket.sla || 'Standard SLA'}</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <span className="text-xs text-slate-500 uppercase">Confidence</span>
                      <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{detailTicket.confidence ? `${Math.round(detailTicket.confidence * 100)}%` : 'N/A'}</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <span className="text-xs text-slate-500 uppercase">Path</span>
                      <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{detailTicket.path || 'Standard Queue'}</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <span className="text-xs text-slate-500 uppercase">Created At</span>
                      <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{new Date(detailTicket.created_at).toLocaleString()}</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <span className="text-xs text-slate-500 uppercase">Updated At</span>
                      <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{new Date(detailTicket.updated_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Full Description */}
              <div className={`rounded-3xl border p-5 ${isDark ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white'}`}>
                <p className={`text-xs uppercase tracking-[0.2em] font-semibold ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Description</p>
                <p className={`mt-3 leading-7 text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{detailTicket.description}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // If My Queue page layout
  if (title === 'My queue') {
    const queueIds = ['IT-2026-004519', 'IT-2026-004510', 'IT-2026-004521', 'IT-2026-004520', 'IT-2026-004517'];
    const queueRows = queueIds.map(id => MY_TICKET_ROWS.find(r => r.id === id)!).filter(Boolean);

    const getRowNumberColor = (index: number) => {
      switch (index) {
        case 0: return 'text-red-600';
        case 1: return 'text-amber-700';
        case 2: return 'text-blue-600';
        default: return 'text-slate-400 dark:text-gray-500';
      }
    };

    const getCategoryStyle = (category: string) => {
      switch (category.toUpperCase()) {
        case 'NETWORK': return isDark ? 'bg-emerald-950/20 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'APPLICATION': return isDark ? 'bg-amber-950/20 text-amber-400 border-amber-500/20' : 'bg-yellow-50 text-yellow-800 border-yellow-200';
        case 'VPN': return isDark ? 'bg-blue-950/20 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-700 border-blue-200';
        case 'ACCESS': return isDark ? 'bg-emerald-950/20 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
        default: return isDark ? 'bg-gray-800 text-gray-400 border-gray-700' : 'bg-slate-50 text-slate-700 border-slate-200';
      }
    };

    const getPriBadgeStyle = (priority: string) => {
      switch (priority) {
        case 'P1': return 'bg-red-600 text-white';
        case 'P2': return 'bg-amber-600 text-white';
        case 'P3': return 'bg-orange-500 text-white';
        default: return 'bg-slate-500 text-white';
      }
    };

    const getBreachBarColor = (id: string) => {
      switch (id) {
        case 'IT-2026-004519': return 'bg-red-600';
        case 'IT-2026-004510': return 'bg-amber-600';
        case 'IT-2026-004517': return 'bg-amber-500';
        default: return 'bg-emerald-500';
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className={`text-[10px] uppercase tracking-[0.25em] font-semibold ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>Tickets / Queue</p>
            <h2 className={`text-2xl font-bold mt-1.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
          </div>
          <div>
            <select className={`rounded-xl border px-3 py-2 text-xs font-semibold outline-none shadow-sm cursor-pointer ${isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
              <option>Sort: SLA risk (default)</option>
            </select>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border-l-4 ${isDark ? 'bg-emerald-950/10 border-emerald-500/80 border bg-gray-900 border-gray-800' : 'bg-emerald-50/40 border-emerald-500 bg-white border-slate-200'}`}>
          <p className={`text-sm font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-800'}`}>Ordered by time-to-breach, not by creation date</p>
          <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>A P1 raised five minutes ago outranks a P4 raised yesterday. This is the single ordering rule that keeps SLA performance honest.</p>
        </div>

        <div className={`rounded-3xl border overflow-hidden ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className={`border-b text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'bg-gray-900/50 border-gray-800 text-gray-400' : 'bg-slate-50 border-gray-150 text-slate-500'}`}>
                  <th className="w-12 px-4 py-3"></th>
                  <th className="text-left px-4 py-3 font-semibold">Ticket</th>
                  <th className="text-left px-4 py-3 font-semibold">Category</th>
                  <th className="text-center px-4 py-3 font-semibold">Pri</th>
                  <th className="text-left px-4 py-3 font-semibold">Time to Breach</th>
                  <th className="text-left px-4 py-3 font-semibold">Requester</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                {queueRows.map((row, index) => {
                  const isClaim = row.id === 'IT-2026-004519' || row.id === 'IT-2026-004510' || row.id === 'IT-2026-004521';
                  const actionText = isClaim ? 'Claim' : 'Open';
                  
                  return (
                    <tr key={row.id} className={`transition-colors ${isDark ? 'hover:bg-gray-800/40' : 'hover:bg-slate-50/50'}`}>
                      <td className={`px-4 py-4 text-center font-bold text-base ${getRowNumberColor(index)}`}>
                        {index + 1}
                      </td>
                      <td className="px-4 py-4">
                        <button onClick={() => onOpenTicket(row.id)} className={`text-left font-semibold text-sm hover:underline block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {row.subject}
                        </button>
                        <span className="text-xs text-slate-400 dark:text-gray-500 mt-1 block">
                          {row.id} · {row.id === 'IT-2026-004521' ? '12 min ago' : row.id === 'IT-2026-004519' ? '34 min ago' : row.id === 'IT-2026-004520' ? '28 min ago' : '1 hour ago'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${getCategoryStyle(row.category)}`}>
                          {row.category}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded font-semibold text-[11px] ${getPriBadgeStyle(row.priority)}`}>
                          {row.priority}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-1 rounded-full bg-slate-200 dark:bg-gray-800 overflow-hidden">
                            <div className={`h-full w-full ${getBreachBarColor(row.id)}`} />
                          </div>
                          <span className={`text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                            {row.sla}
                          </span>
                        </div>
                      </td>
                      <td className={`px-4 py-4 text-sm font-medium ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                        {row.requesterName}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => onOpenTicket(row.id)}
                          className={`rounded-2xl px-4 py-1.5 text-xs font-semibold border transition ${
                            isClaim
                              ? 'border-emerald-700 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 bg-transparent'
                              : isDark
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
            onClick={() => {}}
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
                placeholder="Ticket no, subject, requester..."
                className={`ml-3 w-full bg-transparent text-sm outline-none ${isDark ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-500'}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <select className={filterField}>
                {['All statuses', 'Open', 'In progress', 'Resolved'].map(option => <option key={option}>{option}</option>)}
              </select>
              <select className={filterField}>
                {['All priorities', 'P1', 'P2', 'P3', 'P4'].map(option => <option key={option}>{option}</option>)}
              </select>
              <select className={filterField}>
                {['All categories', 'VPN', 'Access', 'Network', 'Email', 'Unclassified'].map(option => <option key={option}>{option}</option>)}
              </select>
              <select className={filterField}>
                {['All assignees', 'Unassigned', 'Arun K.', 'Network Team'].map(option => <option key={option}>{option}</option>)}
              </select>
            </div>
          </div>
          <button className="mt-3 inline-flex shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-transparent px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:mt-0">
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
  tickets.map(row => (
    <div key={row.ticket_id} className={`flex items-center justify-between p-4 rounded-2xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-md flex items-center justify-center font-semibold text-xs ${row.priority === 'P1' ? 'bg-red-600 text-white' : row.priority === 'P2' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-white'}`}>
          {row.priority || 'P3'}
        </div>
        <div>
          <button onClick={() => onOpenTicket(row.ticket_id)} className={`font-semibold hover:underline text-left block ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {row.subject}
          </button>
          <div className="text-xs text-slate-500 mt-1">
            {row.ticket_id} · {row.category} {row.subcategory ? `/ ${row.subcategory}` : ''} · created {new Date(row.created_at).toLocaleDateString()}
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
          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Showing {tickets.length > 0 ? 1 : 0}–{tickets.length} of {tickets.length}</p>
          <div className="flex items-center gap-3">
            <button className="rounded-2xl border border-slate-200 bg-transparent px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">← Prev</button>
            <button className="rounded-2xl border border-slate-200 bg-transparent px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateTicketPage({ isDark }: { isDark: boolean }) {
  const [form, setForm] = useState({
    subject: '',
    description: '',
    category: 'Not sure — let AI decide',
    affectedSystem: 'Cisco AnyConnect',
    started: 'Today',
    impact: 'My team',
    blocked: 'Yes, completely',
    workaround: false,
    department: 'Finance',
    location: 'Chennai — DLF IT Park',
    assetTag: 'LT-04821',
    preferredContact: 'Email',
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));
  const submit = async () => {
  try {
    setSubmitting(true);
    setSubmitError("");

    await createTicket({
      subject: form.subject,
      category: form.category,
      description: form.description,
      department: form.department,
      site: form.location,
      asset_tag: form.assetTag,
      preferred_contact: form.preferredContact,
    });

    setSubmitted(true);
  } catch (error) {
    console.error("Create ticket failed:", error);
    setSubmitError("Could not create the ticket.");
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
            <p className="text-sm font-semibold text-yellow-700">You have a similar open ticket</p>
            <p className="mt-2 text-sm text-slate-600">Adding to an existing ticket is usually faster than raising a new one.</p>
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-semibold">VPN disconnects every few minutes</p>
                <p className="text-xs text-slate-500">IT-2026-004488 · In progress · raised 2 days ago</p>
              </div>
              <button type="button" className="self-start rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition">Add to this →</button>
            </div>
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
                  <select value={form.category} onChange={e => set('category', e.target.value)} className={field}>
                    {['Not sure — let AI decide', 'VPN', 'Network', 'Software', 'Hardware', 'Access'].map(c => <option key={c}>{c}</option>)}
                  </select>
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
            <button type="button" className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Save draft</button>
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
            ['Category', 'VPN'],
            ['Sub-category', 'Connection failure'],
            ['Severity', 'HIGH'],
            ['Priority', 'P2'],
            ['Est. first response', '1 hour'],
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
            <span>92%</span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-[92%] rounded-full bg-gradient-to-r from-emerald-500 via-blue-500 to-sky-500" />
          </div>
          <p className="mt-3 text-xs text-slate-500">This is a preview only. Final classification runs after you submit and may differ.</p>
        </div>
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

function KnowledgeBasePage({ isDark }: { isDark: boolean }) {
  const articles = [
    { title: 'How to reset your password', views: 1240, category: 'Login' },
    { title: 'Understanding your invoice', views: 980, category: 'Billing' },
    { title: 'API rate limiting explained', views: 756, category: 'Integration' },
    { title: 'Submitting a feature request', views: 543, category: 'Feature Request' },
    { title: 'Common bug reporting tips', views: 489, category: 'Bug' },
  ];
  return (
    <div className="space-y-4">
      <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Knowledge Base</h2>
      <div className="grid gap-3">
        {articles.map(a => (
          <div key={a.title} className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-colors ${isDark ? 'bg-gray-900 border-gray-800 hover:border-gray-700' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0"><BookOpen className="w-5 h-5 text-white" /></div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{a.title}</p>
              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{a.category} · {a.views.toLocaleString()} views</p>
            </div>
            <ChevronRight className={`w-4 h-4 shrink-0 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
          </div>
        ))}
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
  const { user, signOut } = useAuth();
  // compute simple priority counts for sidebar status view
  const priorityCounts = MY_TICKET_ROWS.reduce((acc: Record<string, number>, t) => {
    acc[t.priority] = (acc[t.priority] || 0) + 1;
    return acc;
  }, {});
  const p1Count = priorityCounts['P1'] ?? 0;
  const p2Count = priorityCounts['P2'] ?? 0;
  const p3Count = priorityCounts['P3'] ?? 0;
  const [activePage, setActivePage] = useState<NavPage>(initialPage ?? 'Dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [quickInfo, setQuickInfo] = useState<'help' | 'messages' | 'alerts' | null>(null);
  const [aiChat, setAiChat] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: `Hi ${user?.name?.split(' ')[0] ?? 'there'}! I am your AI helpdesk assistant. Click on a fast action chip below or ask me anything to get started.` },
  ]);
  const [aiInput, setAiInput] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [homeTickets, setHomeTickets] = useState<ApiTicket[]>([]);
const [loadingHome, setLoadingHome] = useState(true);

useEffect(() => {
  const loadHomeData = async () => {
    try {
      setLoadingHome(true);
      const data = await getMyTickets();
      setHomeTickets(data);
    } catch (err) {
      console.error("Failed to load home tickets:", err);
    } finally {
      setLoadingHome(false);
    }
  };
  loadHomeData();
}, []);
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);

  const selectedTicket = selectedTicketId ? MY_TICKET_ROWS.find(ticket => ticket.id === selectedTicketId) ?? null : null;

  const handleOpenTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId);
  };

  const handleBackToList = () => {
    setSelectedTicketId(null);
  };

  const exportTicketAsPdf = (ticket: (typeof MY_TICKET_ROWS)[number]) => {
    const content = `
      <html>
        <head>
          <title>${ticket.id} - ${ticket.subject}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
            h1 { font-size: 24px; margin-bottom: 4px; }
            p { margin: 0 0 12px; line-height: 1.5; }
            .section { margin-bottom: 18px; }
            .section-title { font-weight: 700; margin-bottom: 8px; }
            .grid { display: grid; grid-template-columns: auto auto; gap: 12px 24px; }
            .label { color: #555; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
            .value { font-weight: 600; }
          </style>
        </head>
        <body>
          <h1>${ticket.subject}</h1>
          <p><strong>${ticket.id}</strong></p>
          <div class="section">
            <div class="section-title">Requester</div>
            <p>${ticket.requesterName}</p>
            <div class="section-title">Description</div>
            <p>${ticket.description}</p>
          </div>
          <div class="section grid">
            <div><span class="label">Department</span><div class="value">${ticket.department}</div></div>
            <div><span class="label">Site</span><div class="value">${ticket.site}</div></div>
            <div><span class="label">Asset tag</span><div class="value">${ticket.assetTag}</div></div>
            <div><span class="label">Priority</span><div class="value">${ticket.priority}</div></div>
          </div>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
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
      

      case 'My queue':
        return <MyTicketsPage title={activePage === 'My queue' ? 'My queue' : 'My Tickets'} isDark={isDark} selectedTicketId={selectedTicketId} onOpenTicket={handleOpenTicket} onBack={handleBackToList} onExport={exportTicketAsPdf} onRaise={() => setActivePage('Create Ticket')} onOpenKB={() => setActivePage('Knowledge Base')} />;
      case 'Create Ticket': return <CreateTicketPage isDark={isDark} />
case 'My Tickets':
        if (!can('VIEW_OWN_TICKETS')) {
          if (can('VIEW_AGENT_QUEUE')) {
            return <MyTicketsPage title="My queue" isDark={isDark} selectedTicketId={selectedTicketId} onOpenTicket={handleOpenTicket} onBack={handleBackToList} onRaise={() => setActivePage('Create Ticket')} onOpenKB={openKnowledgeBase} canViewClassification={can('VIEW_CLASSIFICATION')} />;
          }
          return (
            <div className="p-6 text-red-500 font-semibold text-center">
              Access Denied: You do not have permission to view personal tickets.
            </div>
          );
        }
        return <MyTicketsPage title="My Tickets" isDark={isDark} selectedTicketId={selectedTicketId} onOpenTicket={handleOpenTicket} onBack={handleBackToList} onRaise={() => setActivePage('Create Ticket')} onOpenKB={openKnowledgeBase} canViewClassification={can('VIEW_CLASSIFICATION')} />;
      case 'My queue':
        if (!can('VIEW_AGENT_QUEUE')) {
          return <MyTicketsPage title="My Tickets" isDark={isDark} selectedTicketId={selectedTicketId} onOpenTicket={handleOpenTicket} onBack={handleBackToList} onRaise={() => setActivePage('Create Ticket')} onOpenKB={openKnowledgeBase} canViewClassification={can('VIEW_CLASSIFICATION')} />;
        }
        return <MyTicketsPage title="My queue" isDark={isDark} selectedTicketId={selectedTicketId} onOpenTicket={handleOpenTicket} onBack={handleBackToList} onRaise={() => setActivePage('Create Ticket')} onOpenKB={openKnowledgeBase} canViewClassification={can('VIEW_CLASSIFICATION')} />;
      case 'Create Ticket':
        if (!can('CREATE_TICKET')) {
          return (
            <div className="p-6 text-red-500 font-semibold text-center">
              Access Denied: Support Agents and Admins do not create tickets directly.
            </div>
          );
        }
        return <CreateTicketPage isDark={isDark} onOpenKnowledgeArticle={openKnowledgeArticle} onOpenTicket={(ticketId) => { setSelectedTicketId(ticketId); setActivePage('My Tickets'); }} onCreated={(createdTicket) => {
        if (createdTicket) {
          setHomeTickets(current => [createdTicket, ...current.filter(ticket => ticket.ticket_id !== createdTicket.ticket_id)]);
        }
        setActivePage('My Tickets');
        setSelectedTicketId(null);
      }} />;

      case 'AI Assistant':  return <AIAssistantPage isDark={isDark} chat={aiChat} setChat={setAiChat} />;
      case 'Reports':       return <ReportsPage isDark={isDark} />;
      case 'Knowledge Base':return <KnowledgeBasePage isDark={isDark} />;
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
            {sidebarGroups.map(group => (
              <div key={group.title}>
                <p className={`px-3 text-[11px] font-semibold uppercase tracking-[0.24em] ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>{group.title}</p>
                <div className="mt-2 space-y-1">
                  {group.items.map(item => {
                    const active = activePage === item.name;
                    return (
                      <button
                        key={item.name}
                        onClick={() => { setActivePage(item.name); setSidebarOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all ${active ? 'bg-blue-600 text-white shadow-sm' : isDark ? 'text-gray-300 hover:text-white hover:bg-gray-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                      >
                        <item.icon className="w-4 h-4 shrink-0" />
                        <span>{item.name}</span>
                        {item.badge && (
                          <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600'}`}>{item.badge}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
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
                    <span className="col-span-6">Subject</span>
                    <span className="col-span-2">Category</span>
                    <span className="col-span-2">Priority</span>
                    <span className="col-span-2">Status</span>
                  </div>

                  {/* Rows */}
                  <div className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                    {loadingHome ? (
                      <p className="text-center py-6 text-sm text-gray-500">Loading tickets...</p>
                    ) : homeTickets.length === 0 ? (
                      <p className="text-center py-6 text-sm text-gray-500">No tickets found. Create your first ticket!</p>
                    ) : (
                      homeTickets.slice(0, 5).map(t => (
                        <div key={t.ticket_id} onClick={() => { setSelectedTicketId(t.ticket_id); setActivePage('My Tickets'); }} className={`grid grid-cols-12 items-center px-5 py-3.5 cursor-pointer transition-colors ${isDark ? 'hover:bg-gray-800/60' : 'hover:bg-gray-50'}`}>
                          <span className={`col-span-6 text-sm font-medium truncate pr-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t.ticket_id}: {t.subject}</span>
                          <span className={`col-span-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t.category}</span>
                          <span className="col-span-2">
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">{t.priority || 'P3'}</span>
                          </span>
                          <span className="col-span-2">
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
