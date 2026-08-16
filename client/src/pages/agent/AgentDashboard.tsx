import { useState, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { getAllTickets, processTicket, Ticket as ApiTicket } from '../../services/ticketService';
import {
  Bot, Sun, Moon, LayoutDashboard, Ticket, PlusCircle, LogOut,
  Search, AlertCircle, Clock, CheckCircle2, ChevronRight, Paperclip,
  Activity, Calendar, Compass, ShieldAlert, ArrowLeft, Sparkles, Bell,
  MessageSquare, UserPlus, ShieldCheck, Save, Filter, ChevronLeft,
  User, BookOpen, CheckCircle, Download, UserCheck, HelpCircle
} from 'lucide-react';

interface AgentDashboardProps {
  onNavigate: (page: string) => void;
}

type AgentTab = 
  | 'Queue' 
  | 'All Tickets' 
  | 'My Assigned' 
  | 'Requester Lookup' 
  | 'Canned Responses' 
  | 'Overrides Log' 
  | 'My Performance' 
  | 'Profile Settings';

export default function AgentDashboard({ onNavigate }: AgentDashboardProps) {
  const { isDark, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<AgentTab>('Queue');
  const [tickets, setTickets] = useState<ApiTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected ticket for Triage Workspace
  const [selectedTicket, setSelectedTicket] = useState<ApiTicket | null>(null);

  // ─── Master List Filters ───────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [assigneeFilter, setAssigneeFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(3);
  
  // Saveable Views
  const [savedViews, setSavedViews] = useState([
    { name: 'Open VPN Queue', filters: { status: 'Open', category: 'VPN', priority: 'All' } },
    { name: 'Critical P1 Alerts', filters: { status: 'All', category: 'All', priority: 'P1' } },
  ]);
  const [newViewName, setNewViewName] = useState('');

  // ─── Comment Details ──────────────────────────────
  const [commentText, setCommentText] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [conversations, setConversations] = useState<Record<string, { sender: string; role: string; text: string; time: string; isInternal: boolean }[]>>({
    'TCK-101': [
      { sender: 'Lakshmi Priya', role: 'admin', text: 'Okta tokens have been validated for this requester.', time: '10 mins ago', isInternal: true },
      { sender: 'System AI', role: 'system', text: 'Ticket automatically classified as ACCESS / Authentication.', time: '12 mins ago', isInternal: false }
    ]
  });

  // ─── Reclassify / Override Fields ──────────────────
  const [categoryVal, setCategoryVal] = useState('');
  const [subcategoryVal, setSubcategoryVal] = useState('');
  const [severityVal, setSeverityVal] = useState('');
  const [priorityVal, setPriorityVal] = useState('');
  const [statusVal, setStatusVal] = useState('');
  const [assigneeVal, setAssigneeVal] = useState('');
  
  // States
  const [transitionError, setTransitionError] = useState('');
  const [reclassifyFeedback, setReclassifyFeedback] = useState('');
  const [processing, setProcessing] = useState(false);

  // ─── Canned Responses State ────────────────────────
  const [cannedResponses, setCannedResponses] = useState([
    { id: 'cr-1', title: '🔑 Okta Password Reset Portal', text: 'To reset your login credentials, please navigate to the support page at reset.supportpilot.com. Let us know if you experience further access locks.' },
    { id: 'cr-2', title: '🌐 VPN Reload Adapter Steps', text: 'Please flush your local dns (run "ipconfig /flushdns" in console) and restart your Cisco AnyConnect client software. If the connection fails, verify corporate access rights.' },
    { id: 'cr-3', title: '💻 Hardware provision inspect', text: 'We have assigned your hardware inquiry to the local IT desk. Please bring your corporate laptop to the Bangalore Hub/HQ site desk for repair inspection.' }
  ]);
  const [newCannedTitle, setNewCannedTitle] = useState('');
  const [newCannedText, setNewCannedText] = useState('');

  // ─── Overrides / Reclassify Log ─────────────────────
  const [overrideLog, setOverrideLog] = useState<{ ticketId: string; timestamp: string; changes: string }[]>([
    { ticketId: 'TCK-102', timestamp: '2026-08-14 10:30 AM', changes: 'Category: VPN ➔ ACCESS, Severity: Normal ➔ Major' },
    { ticketId: 'TCK-105', timestamp: '2026-08-14 02:15 PM', changes: 'Priority: P3 ➔ P2, Category: HARDWARE ➔ APPLICATION' }
  ]);

  // ─── Requester Lookup State ─────────────────────────
  const [lookupSearch, setLookupSearch] = useState('');
  const [lookupResults, setLookupResults] = useState<ApiTicket[]>([]);

  // ─── Profile / Settings State ────────────────────────
  const [prefContactOption, setPrefContactOption] = useState('Email');
  const [contactHoursVal, setContactHoursVal] = useState('Mon-Fri 9am-6pm EST');
  const [emailAlertsToggle, setEmailAlertsToggle] = useState(true);
  const [desktopPushToggle, setDesktopPushToggle] = useState(true);

  // Notifications Bell
  const [bellDropdownOpen, setBellDropdownOpen] = useState(false);
  const [agentNotifications, setAgentNotifications] = useState([
    { id: 'n1', text: '⚠️ SLA BREACH RISK: Ticket TCK-104 is under 1 hour remaining.', read: false },
    { id: 'n2', text: '👤 ASSIGNMENT: You have been assigned ticket TCK-101.', read: false },
    { id: 'n3', text: '💬 @MENTION: Admin Lakshmi commented on TCK-101.', read: true },
  ]);

  // Toast notifications state
  const [toastMsg, setToastMsg] = useState('');
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const loadAllTicketsData = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getAllTickets();
      setTickets(data || []);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch support tickets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllTicketsData();
  }, []);

  // Update dropdown fields when a ticket is selected
  const selectTicket = (t: ApiTicket) => {
    setSelectedTicket(t);
    setCategoryVal(t.category || 'APPLICATION');
    setSubcategoryVal(t.subcategory || 'Authentication');
    setSeverityVal(t.severity || 'Normal');
    setPriorityVal(t.priority || 'P3');
    setStatusVal(t.status || 'Open');
    setAssigneeVal(t.assignee || 'Unassigned');
    setTransitionError('');
    setReclassifyFeedback('');
  };

  // ─── SLA Breach Calculations (Closest Deadline First) ─────────────
  const getSlaRemainingTime = (t: ApiTicket) => {
    const created = new Date(t.created_at || new Date());
    let slaHrs = 12;
    if (t.priority === 'P1') slaHrs = 4;
    else if (t.priority === 'P2') slaHrs = 8;
    const deadline = created.getTime() + slaHrs * 60 * 60 * 1000;
    return deadline - Date.now();
  };

  const getSlaCountdownString = (remainingMs: number) => {
    if (remainingMs <= 0) {
      return { text: '⚠️ SLA Breached', color: 'text-red-500 font-bold' };
    }
    const hrs = Math.floor(remainingMs / (1000 * 60 * 60));
    const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hrs < 2) {
      return { text: `${hrs}h ${mins}m remaining`, color: 'text-red-500 font-bold' };
    }
    return { text: `${hrs}h ${mins}m remaining`, color: 'text-amber-500 font-medium' };
  };

  // ─── Filters & Search ───
  const getFilteredTickets = () => {
    let result = [...tickets];
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.ticket_id.toLowerCase().includes(term) || 
        t.subject.toLowerCase().includes(term) || 
        (t.requester?.username || '').toLowerCase().includes(term)
      );
    }
    
    if (statusFilter !== 'All') {
      result = result.filter(t => t.status === statusFilter);
    }
    if (priorityFilter !== 'All') {
      result = result.filter(t => t.priority === priorityFilter);
    }
    if (categoryFilter !== 'All') {
      result = result.filter(t => t.category === categoryFilter);
    }
    if (assigneeFilter !== 'All') {
      if (assigneeFilter === 'Unassigned') {
        result = result.filter(t => !t.assignee || t.assignee === 'Unassigned');
      } else {
        result = result.filter(t => t.assignee === assigneeFilter);
      }
    }
    
    return result;
  };

  const filteredTickets = getFilteredTickets();

  // SLA Prioritized Queue (Closest Deadline First)
  const sortedQueueTickets = tickets
    .filter(t => t.status !== 'Resolved' && t.status !== 'Closed')
    .sort((a, b) => getSlaRemainingTime(a) - getSlaRemainingTime(b));

  // My Assigned Tickets
  const myAssignedTickets = tickets.filter(t => 
    t.assignee === (user?.name || 'Lakshmi Priya')
  );

  // Near duplicate checks inline
  const getNearDuplicates = (currentT: ApiTicket) => {
    return tickets.filter(t => 
      t.ticket_id !== currentT.ticket_id &&
      t.requester?.username === currentT.requester?.username &&
      t.status !== 'Resolved' &&
      t.status !== 'Closed' &&
      (t.category === currentT.category || t.subject.toLowerCase().includes('vpn') === currentT.subject.toLowerCase().includes('vpn'))
    );
  };

  // Saveable View Action
  const handleSaveView = () => {
    if (!newViewName.trim()) return;
    const newView = {
      name: newViewName,
      filters: { status: statusFilter, category: categoryFilter, priority: priorityFilter }
    };
    setSavedViews(prev => [...prev, newView]);
    setNewViewName('');
    triggerToast(`Saved view filter preset: "${newView.name}"`);
  };

  const applySavedView = (view: typeof savedViews[0]) => {
    setStatusFilter(view.filters.status);
    setCategoryFilter(view.filters.category);
    setPriorityFilter(view.filters.priority);
    triggerToast(`Applied view preset: "${view.name}"`);
  };

  // ─── Status Transition Guard Rule Check ────────────────────────
  const validateStatusTransition = (oldS: string, newS: string) => {
    if (oldS === 'Closed') {
      return 'Closed tickets are archived and cannot transition to other states directly.';
    }
    if (oldS === 'Resolved' && newS === 'Processing') {
      return 'Resolved tickets must be reopened to Open status before processing.';
    }
    if (oldS === 'Open' && newS === 'Closed') {
      return 'Open tickets must be processed or resolved before being closed.';
    }
    return ''; // Valid
  };

  // ─── Actions ────────────────────────────────────────────────
  const handleClaimTicket = async (t: ApiTicket) => {
    try {
      const updated = {
        ...t,
        assignee: user?.name || 'Lakshmi Priya',
        status: 'Processing'
      };
      await processTicket(t.ticket_id, updated);
      // Update local state
      setTickets(prev => prev.map(item => item.ticket_id === t.ticket_id ? updated : item));
      if (selectedTicket?.ticket_id === t.ticket_id) {
        setSelectedTicket(updated);
        setAssigneeVal(updated.assignee || 'Unassigned');
        setStatusVal(updated.status);
      }
      triggerToast(`Successfully claimed ticket ${t.ticket_id}`);
    } catch (e) {
      console.error(e);
      alert('Failed to claim ticket.');
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !selectedTicket) return;

    const newComment = {
      sender: user?.name || 'Lakshmi Priya',
      role: isInternalComment ? 'internal-agent' : 'agent',
      text: commentText,
      time: 'Just now',
      isInternal: isInternalComment
    };

    setConversations(prev => ({
      ...prev,
      [selectedTicket.ticket_id]: [...(prev[selectedTicket.ticket_id] || []), newComment]
    }));

    setCommentText('');
    triggerToast('Response message posted successfully.');
  };

  // End-to-End reclassify override submission with Override Logs
  const handleManualReclassifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    // Check status transition validity
    const tErr = validateStatusTransition(selectedTicket.status, statusVal);
    if (tErr) {
      setTransitionError(`❌ ${tErr}`);
      return;
    }
    setTransitionError('');

    try {
      setProcessing(true);
      setReclassifyFeedback('');

      const updated = {
        ...selectedTicket,
        category: categoryVal,
        subcategory: subcategoryVal,
        severity: severityVal,
        priority: priorityVal,
        status: statusVal,
        assignee: assigneeVal
      };

      await processTicket(selectedTicket.ticket_id, updated);

      // Log previous predicted vs override new values
      const logMsg = `Override saved! Category: ${selectedTicket.category || 'None'} ➔ ${categoryVal} | Severity: ${selectedTicket.severity || 'Normal'} ➔ ${severityVal}`;
      setReclassifyFeedback(`✅ ${logMsg}`);
      triggerToast('Overrides and classification applied.');

      // Push override log details
      const newOverrideEntry = {
        ticketId: selectedTicket.ticket_id,
        timestamp: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        changes: `Category: ${selectedTicket.category || 'APPLICATION'} ➔ ${categoryVal}, Severity: ${selectedTicket.severity || 'Normal'} ➔ ${severityVal}, Priority: ${selectedTicket.priority || 'P3'} ➔ ${priorityVal}`
      };
      setOverrideLog(prev => [newOverrideEntry, ...prev]);

      // Update local master ticket state
      setTickets(prev => prev.map(item => item.ticket_id === selectedTicket.ticket_id ? updated : item));
      setSelectedTicket(updated);
    } catch (err) {
      console.error(err);
      setTransitionError('❌ Failed to save reclassification updates.');
    } finally {
      setProcessing(false);
    }
  };

  const handleLookupSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupSearch.trim()) {
      setLookupResults([]);
      return;
    }
    const term = lookupSearch.toLowerCase();
    const results = tickets.filter(t => 
      (t.requester?.username || '').toLowerCase().includes(term) ||
      (t.requester?.email || '').toLowerCase().includes(term)
    );
    setLookupResults(results);
    triggerToast(`Found ${results.length} query records.`);
  };

  const handleAddCanned = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCannedTitle.trim() || !newCannedText.trim()) return;
    setCannedResponses(prev => [
      ...prev,
      { id: `cr-${Date.now()}`, title: newCannedTitle, text: newCannedText }
    ]);
    setNewCannedTitle('');
    setNewCannedText('');
    triggerToast('New canned response template added.');
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'P1': return 'bg-red-100 text-red-800 dark:bg-red-955/20 dark:text-red-400';
      case 'P2': return 'bg-amber-100 text-amber-800 dark:bg-amber-955/20 dark:text-amber-400';
      default: return 'bg-slate-100 text-slate-800 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'Resolved': return 'bg-green-100 text-green-800 dark:bg-green-955/20 dark:text-green-400';
      case 'Closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-808 dark:text-gray-400';
      case 'Processing': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-955/20 dark:text-cyan-400';
      default: return 'bg-amber-100 text-amber-800 dark:bg-amber-955/20 dark:text-amber-400';
    }
  };

  const nearDuplicates = selectedTicket ? getNearDuplicates(selectedTicket) : [];
  const selectedTicketAny = selectedTicket as any;

  // Performance calculations
  const myResolvedCount = tickets.filter(t => t.status === 'Resolved' && t.assignee === (user?.name || 'Lakshmi Priya')).length;
  const myClosedCount = tickets.filter(t => t.status === 'Closed' && t.assignee === (user?.name || 'Lakshmi Priya')).length;

  return (
    <div className={`min-h-screen flex ${isDark ? 'bg-[#0b0f19] text-white' : 'bg-slate-50 text-gray-900'}`}>
      
      {/* ── Sidebar (Restructured Nav Links matching brand logo) ── */}
      <aside className={`fixed lg:sticky top-0 z-40 h-screen w-64 shrink-0 flex flex-col ${isDark ? 'bg-gray-900 border-r border-[#1e293b] text-white' : 'bg-white border-r border-gray-200 text-gray-900'}`}>
        
        {/* Branding */}
        <div className="h-16 flex items-center gap-2 px-6 border-b dark:border-gray-800">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-extrabold text-lg shadow-sm">
            A
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-tight">AITicketPilot</h1>
            <p className="text-[7.5px] font-bold text-gray-400 mt-0.5 tracking-wider uppercase">SMARTER SUPPORT. FASTER RESOLUTION.</p>
          </div>
        </div>

        {/* Sidebar Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {[
            { id: 'Queue', name: 'Work Queue (SLA Priority)', icon: Clock },
            { id: 'All Tickets', name: 'All Accessible Tickets', icon: LayoutDashboard },
            { id: 'My Assigned', name: 'My Assigned Tickets', icon: UserCheck },
            { id: 'Requester Lookup', name: 'Requester Lookup', icon: Search },
            { id: 'Canned Responses', name: 'Canned Responses', icon: MessageSquare },
            { id: 'Overrides Log', name: 'Overrides / Reclassify Log', icon: ShieldCheck },
            { id: 'My Performance', name: 'My Performance Stats', icon: Activity },
            { id: 'Profile Settings', name: 'Profile & Settings', icon: User },
          ].map(item => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id as any); setSelectedTicket(null); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  active ? 'bg-blue-600 text-white shadow-sm' : isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-slate-100'
                }`}
              >
                <item.icon className="w-4.5 h-4.5 shrink-0" />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* User profile card */}
        <div className="p-3 border-t dark:border-gray-800">
          <div className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-gray-50'}`}>
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
              A
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user?.name || 'Agent Support'}</p>
              <p className="text-[10px] text-green-500 font-semibold">{user?.role || 'Agent'}</p>
            </div>
            <button onClick={() => { signOut(); onNavigate('home'); }} title="Sign out" className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Workspace ────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        
        {/* Mockup Top Header bar (Tab title + Search bar + Moon/Sun + Help circle + Chat + Bell + click avatar dropdown) */}
        <header className={`sticky top-0 z-20 h-16 flex items-center justify-between px-6 border-b shrink-0 transition-colors ${
          isDark ? 'bg-[#0f172a] border-[#1e293b] text-white' : 'bg-white border-gray-200 text-gray-900'
        }`}>
          {/* Active section title */}
          <div className="flex items-center gap-4">
            {/* Branding Logo */}
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-extrabold text-lg shadow-sm shrink-0">
                A
              </div>
              <div className="hidden sm:block text-left leading-none">
                <h1 className={`text-sm font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>AITicketPilot</h1>
                <p className="text-[7.5px] font-bold text-gray-400 mt-0.5 tracking-wider uppercase leading-none">SMARTER SUPPORT. FASTER RESOLUTION.</p>
              </div>
            </div>

            {/* Vertical Divider */}
            <div className={`h-6 w-[1px] shrink-0 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

            <span className="text-sm font-extrabold capitalize text-gray-800 dark:text-white">
              {activeTab === 'Queue' ? 'Work Queue' : activeTab}
            </span>
            
            {/* Search Bar matching mockup style */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100/70 border-slate-200'} w-72`}>
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                placeholder="Search tickets, users..."
                className="bg-transparent outline-none text-[11px] w-full text-gray-755 dark:text-white placeholder-gray-450 font-medium"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 text-gray-505 font-semibold relative">
            <button onClick={toggleTheme} className={`p-1.5 rounded-lg transition-colors hover:text-gray-800 dark:hover:text-white`}>
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            
            {/* Help circle with toast popup */}
            <button 
              onClick={() => triggerToast('Help documentation catalog has been loaded for agent console support.')}
              className="hover:text-gray-800 dark:hover:text-white transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            
            {/* Chat bubble triggers toast */}
            <button 
              onClick={() => triggerToast('Internal AI chat support assistant initialized.')}
              className="hover:text-gray-800 dark:hover:text-white transition-colors relative"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-blue-600 rounded-full" />
            </button>

            {/* Notifications Bell Dropdown with alert badge */}
            <div className="relative">
              <button
                onClick={() => setBellDropdownOpen(!bellDropdownOpen)}
                className={`hover:text-gray-800 dark:hover:text-white transition-colors relative`}
              >
                <Bell className="w-4 h-4" />
                {agentNotifications.some(n => !n.read) && (
                  <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-500 rounded-full" />
                )}
              </button>
              {bellDropdownOpen && (
                <div className={`absolute right-0 mt-3 w-80 rounded-2xl p-4 shadow-2xl border z-35 ${isDark ? 'bg-gray-900 border-gray-850 text-white' : 'bg-white border-slate-200 text-gray-900'}`}>
                  <div className="flex justify-between items-center mb-3 font-semibold text-xs">
                    <span>Agent Alerts</span>
                    <button
                      onClick={() => setAgentNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                      className="text-[10px] text-blue-505 hover:underline"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="space-y-2.5 max-h-60 overflow-y-auto font-medium">
                    {agentNotifications.map(n => (
                      <div key={n.id} className={`p-2.5 rounded-xl text-xs flex gap-2 ${!n.read ? (isDark ? 'bg-[#1e293b]/60 font-semibold' : 'bg-blue-50/50 font-semibold') : ''}`}>
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${!n.read ? 'bg-blue-500' : 'bg-transparent'}`} />
                        <p className="leading-relaxed">{n.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar circle - Clickable dropdown */}
            <div className="relative">
              <button 
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2.5 pl-3 border-l dark:border-slate-800 hover:opacity-85 transition-opacity"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-extrabold text-[13px] shrink-0">
                  {user?.name ? user.name[0].toUpperCase() : 'A'}
                </div>
                <div className="min-w-0 text-left leading-tight">
                  <p className="text-xs font-bold text-gray-800 dark:text-white">{user?.name || 'Agent Support'}</p>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{user?.role || 'Agent'}</p>
                </div>
              </button>

              {profileDropdownOpen && (
                <div className={`absolute right-0 mt-2.5 w-52 rounded-2xl p-2 border shadow-2xl z-30 animate-in fade-in slide-in-from-top-2 ${
                  isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'
                }`}>
                  <div className="px-3 py-2 border-b dark:border-slate-800">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Agent Account</p>
                    <p className="text-xs font-bold truncate mt-0.5">{user?.email || 'agent@company.com'}</p>
                  </div>
                  
                  <button 
                    onClick={() => { setActiveTab('Profile Settings'); setProfileDropdownOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 text-left mt-1.5 font-bold"
                  >
                    <User className="w-4 h-4 text-blue-505" />
                    <span>Profile Settings</span>
                  </button>

                  <button 
                    onClick={() => { triggerToast('Agent handbook procedures v2.4 initialized.'); setProfileDropdownOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 text-left font-bold"
                  >
                    <BookOpen className="w-4 h-4 text-emerald-500" />
                    <span>Help Documentation</span>
                  </button>

                  <button 
                    onClick={() => { setProfileDropdownOpen(false); signOut(); onNavigate('home'); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-955/15 text-left font-bold"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout Session</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* Views content */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6 max-w-[1400px] mx-auto w-full">

          {/* ── Tab: Queue (Primary risk Landing) ──────────────────── */}
          {activeTab === 'Queue' && !selectedTicket && (
            <div className="space-y-6">
              {/* stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'SLA Risk Queue Length', value: sortedQueueTickets.length, color: 'text-blue-500' },
                  { label: 'High Priority (P1/P2)', value: sortedQueueTickets.filter(t => t.priority === 'P1' || t.priority === 'P2').length, color: 'text-red-500' },
                  { label: 'Unassigned Tickets', value: sortedQueueTickets.filter(t => !t.assignee || t.assignee === 'Unassigned').length, color: 'text-amber-500' }
                ].map(m => (
                  <div key={m.label} className={`p-5 rounded-3xl border shadow-sm ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{m.label}</span>
                    <p className={`text-2xl font-extrabold mt-1.5 ${m.color}`}>{m.value}</p>
                  </div>
                ))}
              </div>

              {/* SLA queue list */}
              <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-slate-800' : 'bg-white border-gray-200'} space-y-4`}>
                <h3 className="text-sm font-bold flex items-center gap-1.5 text-blue-500"><Clock className="w-4 h-4" /> SLA-Risk Prioritized Queue (Closest Deadline First)</h3>
                
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b dark:border-gray-800 text-gray-500 uppercase font-bold">
                        <th className="py-2.5">Risk Level</th>
                        <th className="py-2.5">Ticket ID</th>
                        <th className="py-2.5">Priority</th>
                        <th className="py-2.5">Subject</th>
                        <th className="py-2.5">Assignee</th>
                        <th className="py-2.5">SLA Countdown</th>
                        <th className="py-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-800 font-medium">
                      {sortedQueueTickets.map(t => {
                        const remaining = getSlaRemainingTime(t);
                        const slaObj = getSlaCountdownString(remaining);
                        const isClaimedByMe = t.assignee === (user?.name || 'Lakshmi Priya');

                        return (
                          <tr key={t.ticket_id} className={`hover:bg-slate-150/5 dark:hover:bg-slate-800/50 ${remaining <= 3600000 * 2 ? 'bg-red-500/5' : ''}`}>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                remaining <= 0 ? 'bg-red-600 text-white' :
                                remaining <= 3600000 * 2 ? 'bg-red-100 text-red-805 animate-pulse' : 'bg-green-100 text-green-800'
                              }`}>
                                {remaining <= 0 ? 'CRITICAL' : remaining <= 3600000 * 2 ? 'HIGH RISK' : 'STABLE'}
                              </span>
                            </td>
                            <td className="py-3 font-mono text-blue-605 font-bold">{t.ticket_id}</td>
                            <td className="py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getPriorityColor(t.priority)}`}>{t.priority || 'P3'}</span></td>
                            <td className="py-3 truncate max-w-xs">{t.subject}</td>
                            <td className="py-3 text-gray-550">{t.assignee || 'Unassigned'}</td>
                            <td className={`py-3 ${slaObj.color}`}>{slaObj.text}</td>
                            <td className="py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                {!t.assignee || t.assignee === 'Unassigned' ? (
                                  <button
                                    onClick={() => handleClaimTicket(t)}
                                    className="px-3 py-1 rounded bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-755 transition-colors"
                                  >
                                    Claim & Triage
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-gray-400 font-bold">Assigned</span>
                                )}
                                <button
                                  onClick={() => selectTicket(t)}
                                  className="px-2 py-1 rounded border dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-gray-800 text-[11px] font-bold transition-all"
                                >
                                  Open Workspace
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: All Tickets (Master list + views) ────────────── */}
          {activeTab === 'All Tickets' && !selectedTicket && (
            <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} space-y-4`}>
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">Master Operations Registry</h3>
                  <p className="text-xs text-gray-550 font-semibold">Search and reclassify corporate queries directly.</p>
                </div>
                
                {/* Saved view preset badge buttons */}
                <div className="flex gap-2 items-center text-xs">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest font-extrabold flex items-center gap-1"><Filter className="w-3.5 h-3.5" /> Presets:</span>
                  {savedViews.map(v => (
                    <button
                      key={v.name}
                      onClick={() => applySavedView(v)}
                      className="px-2.5 py-1 rounded-lg border dark:border-slate-800 bg-slate-100/50 hover:bg-slate-100 text-blue-505 text-[10px] font-extrabold transition-all"
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Master filters grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 rounded-2xl bg-slate-100/30 dark:bg-gray-950/40 border dark:border-slate-800 text-xs font-semibold">
                <div className="col-span-2 md:col-span-1">
                  <label className="text-[10px] text-gray-550 block mb-1 uppercase">Search Registry</label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-2.5 top-2 text-gray-400" />
                    <input
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Ticket, subject, requester..."
                      className={`w-full text-xs p-1.5 pl-8 rounded-lg border outline-none dark:bg-gray-900 dark:border-gray-800 ${isDark ? 'text-white' : 'text-gray-900'}`}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-550 block mb-1 uppercase">Status</label>
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full p-1.5 rounded-lg border outline-none dark:bg-gray-900 dark:border-gray-800">
                    <option value="All">All statuses</option>
                    <option value="Open">Open</option>
                    <option value="Processing">Processing</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-555 block mb-1 uppercase">Priority</label>
                  <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="w-full p-1.5 rounded-lg border outline-none dark:bg-gray-900 dark:border-gray-800">
                    <option value="All">All priorities</option>
                    <option value="P1">P1</option>
                    <option value="P2">P2</option>
                    <option value="P3">P3</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-555 block mb-1 uppercase">Category</label>
                  <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-full p-1.5 rounded-lg border outline-none dark:bg-gray-900 dark:border-gray-800">
                    <option value="All">All categories</option>
                    <option value="VPN">VPN</option>
                    <option value="NETWORK">NETWORK</option>
                    <option value="APPLICATION">APPLICATION</option>
                    <option value="ACCESS">ACCESS</option>
                    <option value="HARDWARE">HARDWARE</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-550 block mb-1 uppercase">Assignee</label>
                  <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)} className="w-full p-1.5 rounded-lg border outline-none dark:bg-gray-900 dark:border-gray-800">
                    <option value="All">All assignees</option>
                    <option value="Unassigned">Unassigned</option>
                    <option value={user?.name || 'Lakshmi Priya'}>{user?.name || 'Lakshmi Priya'}</option>
                    <option value="Agent Support">Agent Support</option>
                  </select>
                </div>
              </div>

              {/* View Saver Widget */}
              <div className="flex gap-2 items-center p-3 rounded-xl border border-dashed dark:border-slate-800 text-xs font-semibold">
                <input
                  value={newViewName}
                  onChange={e => setNewViewName(e.target.value)}
                  placeholder="View name (e.g. My Access Tickets)..."
                  className="p-1.5 rounded border outline-none dark:bg-slate-900 text-xs dark:border-gray-800"
                />
                <button
                  onClick={handleSaveView}
                  className="px-3 py-1.5 rounded bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors"
                >
                  Save Current Filter View Preset
                </button>
              </div>

              {/* Queue List Table */}
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b dark:border-gray-800 text-gray-505 uppercase font-bold">
                      <th className="py-2.5">Ticket ID</th>
                      <th className="py-2.5">Priority</th>
                      <th className="py-2.5">Category</th>
                      <th className="py-2.5">Subject</th>
                      <th className="py-2.5">Requester</th>
                      <th className="py-2.5">Status</th>
                      <th className="py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-800 font-medium">
                    {filteredTickets.map(t => (
                      <tr key={t.ticket_id} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/50">
                        <td className="py-3.5 font-mono text-blue-650 font-bold">{t.ticket_id}</td>
                        <td className="py-3.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getPriorityColor(t.priority)}`}>{t.priority || 'P3'}</span></td>
                        <td className="py-3.5 text-blue-505 font-bold uppercase">{t.category}</td>
                        <td className="py-3.5 max-w-xs truncate">{t.subject}</td>
                        <td className="py-3.5 text-gray-500">{t.requester?.username || 'user_test'}</td>
                        <td className="py-3.5"><span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-gray-800">{t.status}</span></td>
                        <td className="py-3.5 text-right">
                          <button
                            onClick={() => selectTicket(t)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-755 text-white text-[11px] font-bold shadow-sm transition-all"
                          >
                            Triage & Classify
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Tab: My Assigned (Tickets Claimed by this agent) ──────── */}
          {activeTab === 'My Assigned' && !selectedTicket && (
            <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} space-y-4`}>
              <div>
                <h3 className="text-base font-bold">My Personal Assigned Queue</h3>
                <p className="text-xs text-gray-550 font-semibold">List of support tickets assigned or claimed by your account specialist tier.</p>
              </div>

              <div className="overflow-x-auto text-xs font-semibold">
                <table className="w-full text-left font-medium">
                  <thead>
                    <tr className="border-b dark:border-gray-800 text-gray-550 uppercase font-bold">
                      <th className="py-2.5">Ticket ID</th>
                      <th className="py-2.5">Priority</th>
                      <th className="py-2.5">Category</th>
                      <th className="py-2.5">Subject</th>
                      <th className="py-2.5">Status</th>
                      <th className="py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-800">
                    {myAssignedTickets.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-gray-400">You do not have any claimed tickets in progress.</td></tr>
                    ) : (
                      myAssignedTickets.map(t => (
                        <tr key={t.ticket_id} className="hover:bg-slate-50/50 dark:hover:bg-gray-800/10">
                          <td className="py-3 font-mono text-blue-600 font-bold">{t.ticket_id}</td>
                          <td className="py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getPriorityColor(t.priority)}`}>{t.priority || 'P3'}</span></td>
                          <td className="py-3 text-blue-505 font-bold uppercase">{t.category}</td>
                          <td className="py-3 max-w-xs truncate">{t.subject}</td>
                          <td className="py-3">{t.status}</td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => selectTicket(t)}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold"
                            >
                              Triage Workspace
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Tab: Requester Lookup ─────────────────────────────────── */}
          {activeTab === 'Requester Lookup' && !selectedTicket && (
            <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} space-y-6 max-w-[900px] mx-auto`}>
              <div>
                <h3 className="text-base font-bold flex items-center gap-1.5"><Search className="w-5 h-5 text-blue-505" /> Requester History Lookup</h3>
                <p className="text-xs text-gray-500 font-semibold">Search for a customer to verify their ticket history and classification patterns before opening triage cases.</p>
              </div>

              <form onSubmit={handleLookupSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <input
                    value={lookupSearch}
                    onChange={e => setLookupSearch(e.target.value)}
                    placeholder="Enter requester username or email address (e.g. user_test)..."
                    className={`w-full text-xs p-3 pl-9 border rounded-xl outline-none focus:border-blue-500 ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white'}`}
                  />
                </div>
                <button type="submit" className="px-5 py-3 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow">Search</button>
              </form>

              <div className="space-y-4">
                <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Search Results ({lookupResults.length})</h4>
                
                <div className="overflow-x-auto text-xs font-semibold">
                  <table className="w-full text-left font-medium">
                    <thead>
                      <tr className="border-b dark:border-gray-800 text-gray-550 uppercase text-[10px] font-bold">
                        <th className="py-2">TICKET ID</th>
                        <th className="py-2">PRIORITY</th>
                        <th className="py-2">CATEGORY</th>
                        <th className="py-2">SUBJECT</th>
                        <th className="py-2">STATUS</th>
                        <th className="py-2 text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-800">
                      {lookupResults.length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-6 text-gray-455 italic">Enter search filters above to load ticket history.</td></tr>
                      ) : (
                        lookupResults.map(t => (
                          <tr key={t.ticket_id} className="hover:bg-slate-50/50 dark:hover:bg-gray-800/10">
                            <td className="py-3 font-mono text-blue-600 font-bold">{t.ticket_id}</td>
                            <td className="py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getPriorityColor(t.priority)}`}>{t.priority || 'P3'}</span></td>
                            <td className="py-3 text-blue-505 font-bold uppercase">{t.category}</td>
                            <td className="py-3 truncate max-w-xs">{t.subject}</td>
                            <td className="py-3">{t.status}</td>
                            <td className="py-3 text-right">
                              <button onClick={() => selectTicket(t)} className="px-2.5 py-1.5 rounded-lg border dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-gray-800 text-[10px] font-bold">
                                Triage
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
          )}

          {/* ── Tab: Canned Responses ─────────────────────────────────── */}
          {activeTab === 'Canned Responses' && !selectedTicket && (
            <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} space-y-6 max-w-[800px] mx-auto text-xs font-semibold`}>
              <div>
                <h3 className="text-base font-bold flex items-center gap-1.5"><MessageSquare className="w-5 h-5 text-blue-550" /> Canned Response Templates</h3>
                <p className="text-xs text-gray-555 font-semibold">Manage standard pre-written response messages for common support queries.</p>
              </div>

              {/* Add Canned Response Form */}
              <form onSubmit={handleAddCanned} className="p-4 rounded-2xl bg-slate-100/20 dark:bg-slate-900 border dark:border-slate-800 space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-505">Create New Canned Response</span>
                
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Title / Label</label>
                    <input
                      value={newCannedTitle}
                      onChange={e => setNewCannedTitle(e.target.value)}
                      placeholder="e.g. VPN adapter connection reset instructions"
                      className={`w-full p-2.5 border rounded-xl outline-none focus:border-blue-500 ${isDark ? 'bg-gray-900 border-slate-800 text-white' : 'bg-white'}`}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Response text</label>
                    <textarea
                      value={newCannedText}
                      onChange={e => setNewCannedText(e.target.value)}
                      rows={3}
                      placeholder="Please try the following connection steps..."
                      className={`w-full p-2.5 border rounded-xl outline-none focus:border-blue-500 ${isDark ? 'bg-gray-900 border-slate-800 text-white' : 'bg-white'}`}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-755 text-white font-bold transition-all shadow">
                  Create Template
                </button>
              </form>

              {/* List Canned Responses */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Available templates ({cannedResponses.length})</h4>
                <div className="grid grid-cols-1 gap-3">
                  {cannedResponses.map(cr => (
                    <div key={cr.id} className="p-4 rounded-2xl border dark:border-slate-800 space-y-1 bg-slate-50/50 dark:bg-gray-900/40">
                      <p className="font-extrabold text-blue-550 flex items-center gap-1.5"><MessageSquare className="w-4 h-4 text-emerald-500" /> {cr.title}</p>
                      <p className="text-gray-400 font-medium leading-relaxed mt-1">{cr.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Overrides / Reclassify Log ──────────────────────── */}
          {activeTab === 'Overrides Log' && !selectedTicket && (
            <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} space-y-4 max-w-[900px] mx-auto`}>
              <div>
                <h3 className="text-base font-bold flex items-center gap-1.5"><ShieldCheck className="w-5 h-5 text-emerald-505" /> Overrides & Reclassify Logs</h3>
                <p className="text-xs text-gray-550 font-semibold">History log of categorization and workflow status corrections made by your account for quality auditing.</p>
              </div>

              <div className="overflow-x-auto text-xs font-semibold">
                <table className="w-full text-left font-medium">
                  <thead>
                    <tr className="border-b dark:border-gray-800 text-gray-505 uppercase text-[10px] font-bold">
                      <th className="py-2.5">Ticket ID</th>
                      <th className="py-2.5">Audit Timestamp</th>
                      <th className="py-2.5">Override Action Log</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-800">
                    {overrideLog.map((log, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-gray-800/10">
                        <td className="py-3 font-mono text-blue-600 font-bold">{log.ticketId}</td>
                        <td className="py-3 text-gray-550">{log.timestamp}</td>
                        <td className="py-3 font-mono text-emerald-505 text-[11px] leading-relaxed">{log.changes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Tab: My Performance ──────────────────────────────────── */}
          {activeTab === 'My Performance' && !selectedTicket && (
            <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} space-y-6 max-w-[800px] mx-auto text-xs font-semibold`}>
              <div>
                <h3 className="text-base font-bold flex items-center gap-1.5"><Activity className="w-5 h-5 text-blue-505" /> My Performance Dashboard</h3>
                <p className="text-xs text-gray-555">Personal support metrics and resolved cases summaries.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Resolved Tickets (Total)', value: myResolvedCount + myClosedCount, color: 'text-green-505' },
                  { label: 'SLA Adherence Rate', value: '97.2%', color: 'text-blue-505' },
                  { label: 'Average Response Time', value: '1.4 hours', color: 'text-purple-505' },
                  { label: 'Quality Score Rating', value: '4.85 / 5.00', color: 'text-amber-505' }
                ].map(stat => (
                  <div key={stat.label} className="p-4 rounded-2xl border dark:border-slate-800 bg-slate-50/50 dark:bg-[#1e293b]/20">
                    <span className="text-[10px] text-gray-405 uppercase tracking-wider">{stat.label}</span>
                    <p className={`text-xl font-extrabold mt-1.5 ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3 pt-3 border-t dark:border-gray-800">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Recently Resolved by Me</h4>
                <div className="overflow-x-auto text-[11px]">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b dark:border-gray-800 text-gray-550 uppercase text-[9px]">
                        <th className="py-2">TICKET ID</th>
                        <th className="py-2">SUBJECT</th>
                        <th className="py-2">CATEGORY</th>
                        <th className="py-2">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-800 font-medium">
                      {tickets.filter(t => (t.status === 'Resolved' || t.status === 'Closed') && t.assignee === (user?.name || 'Lakshmi Priya')).map(t => (
                        <tr key={t.ticket_id}>
                          <td className="py-2 font-mono font-bold text-blue-505">{t.ticket_id}</td>
                          <td className="py-2">{t.subject}</td>
                          <td className="py-2 text-[10px] font-bold uppercase">{t.category}</td>
                          <td className="py-2 text-green-550 font-extrabold">{t.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Profile Settings ────────────────────────────────── */}
          {activeTab === 'Profile Settings' && !selectedTicket && (
            <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} space-y-6 max-w-[800px] mx-auto text-xs font-semibold`}>
              <div>
                <h3 className="text-base font-bold flex items-center gap-2"><User className="w-5 h-5 text-blue-550" /> Specialist Profile Settings</h3>
                <p className="text-xs text-gray-500">Configure notifications, contact hours, and settings.</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Contact Method</label>
                    <select
                      value={prefContactOption}
                      onChange={e => setPrefContactOption(e.target.value)}
                      className={`w-full rounded-xl border px-3 py-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}
                    >
                      <option value="Email">Email</option>
                      <option value="Slack">Slack / MS Teams</option>
                      <option value="Mobile">Mobile Phone</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Preferred Operation Hours</label>
                    <input
                      value={contactHoursVal}
                      onChange={e => setContactHoursVal(e.target.value)}
                      className={`w-full rounded-xl border px-3 py-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-[#1e293b] border-gray-800' : 'bg-white border-gray-200 text-gray-900'}`}
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t dark:border-gray-800">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold">Email Notifications alerts</p>
                      <p className="text-xs text-gray-555 font-normal">Receive immediate email alerts for high-risk SLA warnings.</p>
                    </div>
                    <button
                      onClick={() => setEmailAlertsToggle(!emailAlertsToggle)}
                      className={`px-3 py-1 rounded-lg border text-[11px] font-bold ${emailAlertsToggle ? 'bg-green-600 text-white border-green-600' : 'bg-transparent text-gray-505'}`}
                    >
                      {emailAlertsToggle ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>

                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold">Portal Desktop Push notifications</p>
                      <p className="text-xs text-gray-555 font-normal">Trigger toast alerts in bottom right corner on queue state changes.</p>
                    </div>
                    <button
                      onClick={() => setDesktopPushToggle(!desktopPushToggle)}
                      className={`px-3 py-1 rounded-lg border text-[11px] font-bold ${desktopPushToggle ? 'bg-green-600 text-white border-green-600' : 'bg-transparent text-gray-505'}`}
                    >
                      {desktopPushToggle ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t dark:border-gray-800 flex justify-between items-center">
                  <div>
                    <p className="font-bold">Agent Triage Tier Status</p>
                    <p className="text-xs text-gray-555 font-normal">Active specialist operational tier rating.</p>
                  </div>
                  <span className="px-3 py-1 bg-blue-105 text-blue-808 rounded-full font-bold text-[10px]">⭐ Level-2 Triage Engineer</span>
                </div>

                <button
                  onClick={() => alert('Profile settings saved successfully!')}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-750 text-white text-xs font-bold transition-all shadow-md"
                >
                  Save Profile Configuration Settings
                </button>
              </div>
            </div>
          )}

          {/* ── View: Triage Workspace Drawer / Subpanel (When ticket is selected) ── */}
          {selectedTicket && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center font-semibold">
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="flex items-center gap-1 text-xs text-gray-555 hover:text-gray-800 dark:hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Dashboard List
                </button>
                <div className="flex gap-2">
                  <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">
                    Specialist Workspace Mode
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs font-semibold">
                
                {/* LEFT COLUMN: Triage ticket details and comments thread */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Core Ticket Info Card */}
                  <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} space-y-4`}>
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] text-blue-550 font-mono font-bold">{selectedTicket.ticket_id}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusBadgeStyle(selectedTicket.status)}`}>
                          {selectedTicket.status}
                        </span>
                      </div>
                      <h2 className="text-base font-bold mt-1">{selectedTicket.subject}</h2>
                      <p className="text-gray-400 font-medium leading-relaxed mt-2">{selectedTicket.description}</p>
                    </div>

                    {/* Metadata pre-fills */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t dark:border-slate-800 text-xs font-semibold">
                      <div>
                        <span className="text-gray-550 block font-normal">Department</span>
                        <span>{selectedTicketAny.department || 'IT'}</span>
                      </div>
                      <div>
                        <span className="text-gray-555 block font-normal">Location Site</span>
                        <span>{selectedTicketAny.site || 'New York HQ'}</span>
                      </div>
                      <div>
                        <span className="text-gray-555 block font-normal">Asset Tag</span>
                        <span className="font-mono">{selectedTicketAny.asset_tag || 'None'}</span>
                      </div>
                      <div>
                        <span className="text-gray-550 block font-normal">Requester</span>
                        <span className="text-blue-505 font-bold">{selectedTicket.requester?.username || 'user_test'}</span>
                      </div>
                    </div>

                    {/* Attachments */}
                    {selectedTicketAny.attachments && selectedTicketAny.attachments.length > 0 && (
                      <div className="pt-3 border-t dark:border-slate-800">
                        <span className="text-[10px] text-gray-550 uppercase font-bold tracking-wider">User Attachments</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {selectedTicketAny.attachments.map((file: string, i: number) => (
                            <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-blue-505 text-[10px] font-extrabold border dark:border-gray-800">
                              <Paperclip className="w-3.5 h-3.5" /> {file}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Near-duplicates Alert block */}
                  {nearDuplicates.length > 0 && (
                    <div className="p-4 rounded-2xl border border-red-505/20 bg-red-500/5 space-y-2">
                      <span className="text-[10px] font-bold text-red-505 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-red-505" /> Near-Duplicate Warning ({nearDuplicates.length})
                      </span>
                      <p className="text-[11px] text-gray-400 font-medium">This requester has other active tickets in similar categories:</p>
                      <div className="space-y-1.5 pt-1">
                        {nearDuplicates.map(nd => (
                          <div key={nd.ticket_id} className="flex justify-between items-center bg-slate-900/30 p-2 rounded-lg text-[10px] border dark:border-slate-800 font-mono">
                            <span className="text-blue-500 font-bold">{nd.ticket_id}</span>
                            <span className="text-gray-300 truncate max-w-xs">{nd.subject}</span>
                            <span className="px-1.5 py-0.2 rounded bg-slate-800 font-bold">{nd.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reply Log and comments workflow */}
                  <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} space-y-4`}>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Triage Specialist Communications</h3>

                    {/* Timeline Thread */}
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {(conversations[selectedTicket.ticket_id] || []).map((msg, i) => (
                        <div key={i} className={`p-3 rounded-2xl space-y-1 ${
                          msg.isInternal 
                            ? 'bg-purple-955/15 border border-purple-900/30' 
                            : 'bg-slate-100/30 dark:bg-slate-900/40 border dark:border-gray-850'
                        }`}>
                          <div className="flex justify-between items-center">
                            <span className={`font-bold ${msg.isInternal ? 'text-purple-500' : 'text-blue-505'}`}>
                              {msg.sender} ({msg.role})
                            </span>
                            <span className="text-[9px] text-gray-550 font-semibold">{msg.time}</span>
                          </div>
                          <p className="text-gray-300 font-medium leading-relaxed">{msg.text}</p>
                        </div>
                      ))}
                    </div>

                    {/* Form Comment posting */}
                    <form onSubmit={handleAddComment} className="space-y-3 pt-3 border-t dark:border-gray-850">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-xs font-semibold text-gray-500">Post Reply message</label>
                          
                          {/* Visibility Toggle */}
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase ${isInternalComment ? 'text-purple-500' : 'text-blue-500'}`}>
                              {isInternalComment ? '🔒 Internal Note (Team only)' : '🌐 Public Response (Customer sees)'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsInternalComment(!isInternalComment)}
                              className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border text-[9px] font-bold"
                            >
                              Toggle
                            </button>
                          </div>
                        </div>

                        {/* Canned Response Insertion dropdown */}
                        <div className="mb-2">
                          <select
                            onChange={(e) => {
                              const cr = cannedResponses.find(c => c.id === e.target.value);
                              if (cr) {
                                setCommentText(prev => prev ? prev + '\n' + cr.text : cr.text);
                              }
                              e.target.value = '';
                            }}
                            className={`text-[10px] rounded p-1 outline-none font-bold ${
                              isDark ? 'bg-gray-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-gray-700'
                            }`}
                          >
                            <option value="">💡 Insert Canned Response...</option>
                            {cannedResponses.map(cr => (
                              <option key={cr.id} value={cr.id}>{cr.title}</option>
                            ))}
                          </select>
                        </div>

                        <textarea
                          value={commentText}
                          onChange={e => setCommentText(e.target.value)}
                          rows={3}
                          placeholder="Type response details or insert canned template above..."
                          className={`w-full rounded-xl border px-3 py-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-gray-200'}`}
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-750 text-white text-xs font-bold transition-all shadow-md"
                      >
                        Submit Response
                      </button>
                    </form>
                  </div>
                </div>

                {/* RIGHT PANE: AI Classification details & Guarded Reclassifications */}
                <div className="space-y-6">
                  {/* AI Classification Info card */}
                  <div className={`p-5 rounded-3xl border-2 border-cyan-500 bg-cyan-50/5 dark:bg-cyan-955/5 space-y-4`}>
                    <h3 className="font-extrabold text-[11px] text-cyan-600 dark:text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 animate-spin text-blue-505" /> AI Classification Panel
                    </h3>

                    <div className="space-y-3.5 text-xs font-semibold">
                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <span className="text-[10px] text-gray-500 block font-normal">Predicted Category</span>
                          <span>{selectedTicket.category || 'VPN'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-505 block font-normal">Predicted Subcategory</span>
                          <span>{selectedTicket.subcategory || 'Connectivity'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-500 block font-normal">Confidence meter</span>
                          <span className="text-emerald-500 font-mono">92%</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-550 block font-normal">Classification Path</span>
                          <span className="text-purple-500 font-mono">FAST BERT (v1.82)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Manual reclassification overrides form */}
                  <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-slate-800' : 'bg-white border-gray-200'} space-y-4`}>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-550 flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-505" /> Manual Override Reclassification</h3>
                    
                    {transitionError && (
                      <div className="p-3 rounded-xl bg-red-55 border border-red-200 text-red-750 text-xs font-bold leading-relaxed">{transitionError}</div>
                    )}

                    {reclassifyFeedback && (
                      <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold leading-relaxed">{reclassifyFeedback}</div>
                    )}

                    <form onSubmit={handleManualReclassifySubmit} className="space-y-3 font-semibold">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-550 uppercase tracking-wider mb-1">Status Workflow</label>
                        <select value={statusVal} onChange={e => setStatusVal(e.target.value)} className={`w-full text-xs p-2 rounded-xl border outline-none ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}>
                          <option value="Open">Open</option>
                          <option value="Processing">Processing</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Closed">Closed</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Category</label>
                          <select value={categoryVal} onChange={e => setCategoryVal(e.target.value)} className={`w-full text-xs p-2 rounded-xl border outline-none ${isDark ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-gray-200'}`}>
                            <option value="VPN">VPN</option>
                            <option value="NETWORK">NETWORK</option>
                            <option value="APPLICATION">APPLICATION</option>
                            <option value="ACCESS">ACCESS</option>
                            <option value="HARDWARE">HARDWARE</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-550 uppercase tracking-wider mb-1">Subcategory</label>
                          <select value={subcategoryVal} onChange={e => setSubcategoryVal(e.target.value)} className={`w-full text-xs p-2 rounded-xl border outline-none ${isDark ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-gray-200'}`}>
                            <option value="Authentication">Authentication</option>
                            <option value="Connectivity">Connectivity</option>
                            <option value="Security lockout">Security lockout</option>
                            <option value="System crash">System crash</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Priority Override</label>
                          <select value={priorityVal} onChange={e => setPriorityVal(e.target.value)} className={`w-full text-xs p-2 rounded-xl border outline-none ${isDark ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-gray-200'}`}>
                            <option value="P1">P1 (Critical)</option>
                            <option value="P2">P2 (High)</option>
                            <option value="P3">P3 (Medium/Low)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Severity Override</label>
                          <select value={severityVal} onChange={e => setSeverityVal(e.target.value)} className={`w-full text-xs p-2 rounded-xl border outline-none ${isDark ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-gray-200'}`}>
                            <option value="Critical">Critical</option>
                            <option value="Major">Major</option>
                            <option value="Normal">Normal</option>
                            <option value="Minor">Minor</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Assignee Specialist</label>
                        <select value={assigneeVal} onChange={e => setAssigneeVal(e.target.value)} className={`w-full text-xs p-2 rounded-xl border outline-none ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}>
                          <option value="Unassigned">Unassigned</option>
                          <option value={user?.name || 'Lakshmi Priya'}>{user?.name || 'Lakshmi Priya'}</option>
                          <option value="Agent Support">Agent Support</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        disabled={processing}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md disabled:opacity-60"
                      >
                        {processing ? 'Processing Override...' : 'Apply Overrides & Save'}
                      </button>
                    </form>
                  </div>
                </div>

              </div>
            </div>
          )}

        </main>
      </div>

      {/* Floating Toast Notification system */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-55 px-4 py-3 rounded-2xl bg-slate-900 border border-gray-800 text-white shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-bottom-2 duration-300">
          <Sparkles className="w-4 h-4 text-blue-500 animate-pulse" />
          <span>{toastMsg}</span>
        </div>
      )}

    </div>
  );
}
