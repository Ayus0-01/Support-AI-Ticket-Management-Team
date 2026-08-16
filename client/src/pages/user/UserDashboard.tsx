import { useState, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { getMyTickets, createTicket, processTicket, Ticket as ApiTicket } from '../../services/ticketService';
import {
  Bot, Sun, Moon, LayoutDashboard, Ticket, PlusCircle, LogOut,
  Search, AlertCircle, Clock, CheckCircle2, ChevronRight, Paperclip,
  Activity, Calendar, Compass, ShieldAlert, ArrowLeft, Sparkles, Bell,
  FileText, User, HelpCircle, CheckCircle, Download, FileDown, Sliders,
  UserCheck, Shield, BookOpen, ChevronLeft, MessageSquare
} from 'lucide-react';

interface UserDashboardProps {
  onNavigate: (page: string) => void;
  initialTab?: 'Home' | 'Create Ticket' | 'My Tickets' | 'AI Assistant' | 'Profile Settings';
}

type TabType = 'Home' | 'Create Ticket' | 'My Tickets' | 'Track Ticket' | 'AI Assistant' | 'Profile Settings' | 'Help Center';

// Org Master Data Consumed Live
const DEPARTMENTS = ['Information Technology', 'Human Resources', 'Finance & Accounts', 'Customer Support'];
const SITES = ['New York HQ', 'London Office', 'Bangalore Hub'];
const CATEGORIES = ['VPN', 'NETWORK', 'APPLICATION', 'ACCESS', 'HARDWARE'];
const APPLICATIONS = ['Microsoft Office 365', 'Cisco AnyConnect VPN', 'Salesforce CRM', 'Okta Identity Cloud'];

// Ticket templates
const TEMPLATES = [
  {
    name: '🔑 Okta Password Reset',
    subject: 'Okta login password reset request',
    category: 'ACCESS',
    system: 'Okta Identity Cloud',
    desc: 'I am locked out of my corporate Okta identity portal and need my login password reset sent to my registered personal address.'
  },
  {
    name: '🌐 VPN Connection Failure',
    subject: 'Cisco VPN connection timeout error',
    category: 'VPN',
    system: 'Cisco AnyConnect VPN',
    desc: 'Unable to connect to London office intranet. Okta authorization prompts are failing with gateway response code 503.'
  },
  {
    name: '💻 Laptop Request',
    subject: 'Standard developer workstation provisioning request',
    category: 'HARDWARE',
    system: 'Microsoft Office 365',
    desc: 'Requesting a standard developer workstation profile setup (16GB RAM, corporate security software installed) for my department.'
  }
];

export default function UserDashboard({ onNavigate, initialTab }: UserDashboardProps) {
  const { isDark, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>(initialTab ?? 'Home');
  const [tickets, setTickets] = useState<ApiTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Selected ticket for tracking
  const [trackingTicketId, setTrackingTicketId] = useState<string | null>(null);

  // ─── 1. Issue Form Fields ──────────────────────────
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [categoryHint, setCategoryHint] = useState('APPLICATION');
  const [affectedSystem, setAffectedSystem] = useState('Microsoft Office 365');
  const [startedWhen, setStartedWhen] = useState('');

  // ─── Delegation / On Behalf Of ─────────────────────
  const [isBehalfOfActive, setIsBehalfOfActive] = useState(false);
  const [behalfOfUsername, setBehalfOfUsername] = useState('');

  // ─── 2. Impact Form Fields ──────────────────────────
  const [affectedScope, setAffectedScope] = useState('Just me');
  const [workBlocked, setWorkBlocked] = useState('No');
  const [selfUrgency, setSelfUrgency] = useState('Medium');
  const [workaroundAvailable, setWorkaroundAvailable] = useState(false);

  // ─── 3. Context Form Fields ─────────────────────────
  const [department, setDepartment] = useState((user as any)?.department || 'Information Technology');
  const [site, setSite] = useState((user as any)?.site || 'New York HQ');
  const [assetTag, setAssetTag] = useState('');
  const [preferredContact, setPreferredContact] = useState('Email');
  const [bestTimeToContact, setBestTimeToContact] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [newFile, setNewFile] = useState('');

  // ─── My Tickets Filter & Sort States ────────────────
  const [myTicketsStatusFilter, setMyTicketsStatusFilter] = useState('All');
  const [myTicketsCategoryFilter, setMyTicketsCategoryFilter] = useState('All');
  const [myTicketsSortOrder, setMyTicketsSortOrder] = useState('Newest');
  const [myTicketsOriginFilter, setMyTicketsOriginFilter] = useState<'All' | 'Self' | 'Behalf'>('All');

  // ─── Profile Settings ──────────────────────────────
  const [prefContactOption, setPrefContactOption] = useState('Email');
  const [contactHoursVal, setContactHoursVal] = useState('Mon-Fri 9am-5pm EST');
  const [emailNotifToggle, setEmailNotifToggle] = useState(true);
  const [pushNotifToggle, setPushNotifToggle] = useState(false);

  // ─── Behavioral States ────────────────────────────
  const [predictedCat, setPredictedCat] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [autosaveMsg, setAutosaveMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Toast / Popups state
  const [toastMsg, setToastMsg] = useState('');
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  // Delegation permission check
  const hasDelegationPermission = user?.email === 'user_test@gmail.com' || (user as any)?.role === 'Admin' || (user as any)?.can_delegate;

  // Notifications bell dropdown
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userNotifications, setUserNotifications] = useState([
    { id: 'un1', text: 'Agent Priya Mehra assigned to your ticket TCK-128.', read: false },
    { id: 'un2', text: 'Ticket TCK-122 status updated to Processing.', read: false },
    { id: 'un3', text: 'SLA timer started for ticket TCK-124.', read: true },
  ]);

  // AI Assistant Chat state
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; text: string; time: string }[]>([
    { role: 'ai', text: `Hi ${user?.name?.split(' ')[0] ?? 'there'}! I am your AI assistant. Ask me troubleshooting tips for password resets, VPN logins, or hardware slowdowns immediately.`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [chatInput, setChatInput] = useState('');

  const fetchTicketsList = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getMyTickets();
      setTickets(data || []);
    } catch (err: any) {
      console.error(err);
      setError('Failed to load tickets list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicketsList();
  }, []);

  // Sync defaults on user session load
  useEffect(() => {
    if (user) {
      if ((user as any).department) setDepartment((user as any).department);
      if ((user as any).site) setSite((user as any).site);
    }
  }, [user]);

  // Load Saved Draft on mount
  useEffect(() => {
    const draftStr = localStorage.getItem('support_pilot_draft');
    if (draftStr) {
      try {
        const draft = JSON.parse(draftStr);
        if (draft.subject) setSubject(draft.subject);
        if (draft.description) setDescription(draft.description);
        if (draft.categoryHint) setCategoryHint(draft.categoryHint);
        if (draft.affectedSystem) setAffectedSystem(draft.affectedSystem);
        if (draft.startedWhen) setStartedWhen(draft.startedWhen);
        if (draft.affectedScope) setAffectedScope(draft.affectedScope);
        if (draft.workBlocked) setWorkBlocked(draft.workBlocked);
        if (draft.selfUrgency) setSelfUrgency(draft.selfUrgency);
        if (draft.workaroundAvailable) setWorkaroundAvailable(draft.workaroundAvailable);
        if (draft.department) setDepartment(draft.department);
        if (draft.site) setSite(draft.site);
        if (draft.assetTag) setAssetTag(draft.assetTag);
        if (draft.preferredContact) setPreferredContact(draft.preferredContact);
        if (draft.bestTimeToContact) setBestTimeToContact(draft.bestTimeToContact);
        setAutosaveMsg('Loaded saved draft from autosave.');
      } catch (e) {
        console.error("Failed to load draft:", e);
      }
    }
  }, []);

  // 2s Draft Autosave
  useEffect(() => {
    if (!subject.trim() && !description.trim()) return;
    const timer = setTimeout(() => {
      const draft = {
        subject, description, categoryHint, affectedSystem, startedWhen,
        affectedScope, workBlocked, selfUrgency, workaroundAvailable,
        department, site, assetTag, preferredContact, bestTimeToContact
      };
      localStorage.setItem('support_pilot_draft', JSON.stringify(draft));
      setAutosaveMsg(`💾 Draft autosaved at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`);
    }, 2000);
    return () => clearTimeout(timer);
  }, [
    subject, description, categoryHint, affectedSystem, startedWhen,
    affectedScope, workBlocked, selfUrgency, workaroundAvailable,
    department, site, assetTag, preferredContact, bestTimeToContact
  ]);

  // Debounced Category Prediction Hint
  useEffect(() => {
    if (!description.trim()) {
      setPredictedCat('');
      return;
    }
    const timer = setTimeout(() => {
      const text = description.toLowerCase();
      if (text.includes('vpn') || text.includes('connect') || text.includes('token')) {
        setPredictedCat('VPN');
      } else if (text.includes('network') || text.includes('wi-fi') || text.includes('internet')) {
        setPredictedCat('NETWORK');
      } else if (text.includes('password') || text.includes('login') || text.includes('credential')) {
        setPredictedCat('ACCESS');
      } else if (text.includes('laptop') || text.includes('repair') || text.includes('hardware')) {
        setPredictedCat('HARDWARE');
      } else {
        setPredictedCat('APPLICATION');
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [description]);

  // Blur duplicate check
  const handleSubjectBlur = () => {
    if (!subject.trim()) {
      setDuplicateWarning(null);
      return;
    }
    const existing = tickets.find(t => 
      t.status !== 'Resolved' && 
      t.status !== 'Closed' &&
      t.subject.toLowerCase().includes(subject.toLowerCase())
    );
    if (existing) {
      setDuplicateWarning(`⚠️ Duplicate Warning: You already have an open ticket with a similar subject: "${existing.subject}" (ID: ${existing.ticket_id}).`);
    } else {
      setDuplicateWarning(null);
    }
  };

  const handleAddFile = () => {
    if (newFile.trim() && attachments.length < 5) {
      setAttachments(prev => [...prev, newFile]);
      setNewFile('');
    }
  };

  const handleRemoveFile = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  // Sub-1s Submit
  const handleCreateTicketSubmit = async (statusOverride?: 'Draft') => {
    try {
      setSubmitting(true);
      setSuccessMsg('');
      
      const payload = {
        subject,
        description,
        category: categoryHint,
        department,
        site,
        asset_tag: assetTag,
        preferred_contact: preferredContact,
        impact: affectedScope,
        blocked: workBlocked,
        status: statusOverride || 'Open',
        attachments,
        ...(isBehalfOfActive && behalfOfUsername ? { on_behalf_of: behalfOfUsername } : {})
      };

      const submitPromise = createTicket(payload as any);
      
      setSuccessMsg(statusOverride === 'Draft' ? 'Ticket saved successfully as a draft!' : 'Ticket submitted successfully!');
      
      setSubject('');
      setDescription('');
      setAssetTag('');
      setAttachments([]);
      setIsBehalfOfActive(false);
      setBehalfOfUsername('');
      setDuplicateWarning(null);
      setPredictedCat('');
      localStorage.removeItem('support_pilot_draft');

      submitPromise.then(() => {
        fetchTicketsList();
      }).catch(err => {
        console.error("Async classification error:", err);
      });

      setTimeout(() => {
        setSubmitting(false);
        setActiveTab('My Tickets');
      }, 600);

    } catch (err: any) {
      console.error(err);
      alert('Failed to submit ticket request.');
      setSubmitting(false);
    }
  };

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = {
      role: 'user' as const,
      text: chatInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');

    setTimeout(() => {
      const text = chatInput.toLowerCase();
      let reply = '';
      if (text.includes('vpn') || text.includes('token')) {
        reply = 'For VPN connection issues: verify that you are connected to the internet, check your Okta token, and make sure certificates are up to date. If it fails, raise a ticket in Category: VPN.';
      } else if (text.includes('password') || text.includes('reset') || text.includes('login')) {
        reply = 'To reset your login credentials, visit reset.supportpilot.com. Account lockouts auto-unlock after 15 minutes of inactivity.';
      } else if (text.includes('slow') || text.includes('hang')) {
        reply = 'If your machine is slow: close memory-intensive apps, clear browser cookies, and restart. For hardware errors, raise a ticket under Category: HARDWARE.';
      } else {
        reply = "I've analyzed your query. To help you troubleshoot, could you specify which system is affected? Alternatively, you can click 'Create New Ticket' to submit a support request.";
      }

      setChatMessages(prev => [...prev, {
        role: 'ai' as const,
        text: reply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }, 700);
  };

  const handleReopenTicket = async (t: ApiTicket) => {
    try {
      const updated = {
        ...t,
        status: 'Open',
        resolution_reply: null
      };
      await processTicket(t.ticket_id, updated as any);
      setTickets(prev => prev.map(item => item.ticket_id === t.ticket_id ? updated : item));
      setSuccessMsg('Ticket reopened successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e) {
      console.error(e);
      alert('Failed to reopen ticket.');
    }
  };

  const handleWithdrawTicket = async (t: ApiTicket) => {
    try {
      const updated = {
        ...t,
        status: 'Closed'
      };
      await processTicket(t.ticket_id, updated as any);
      setTickets(prev => prev.map(item => item.ticket_id === t.ticket_id ? updated : item));
      setSuccessMsg('Ticket withdrawn successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e) {
      console.error(e);
      alert('Failed to withdraw ticket.');
    }
  };

  const startTracking = (id: string) => {
    setTrackingTicketId(id);
    setActiveTab('Track Ticket');
  };

  const getTrackingTicket = () => {
    return tickets.find(t => t.ticket_id === trackingTicketId) || null;
  };

  const selectedTrackingTicket = getTrackingTicket() as any;

  const getPriorityExplanation = (priority: string | null) => {
    if (!priority) return 'Priority computed automatically from Severity × Impact matrix lookup table.';
    if (priority === 'P1') return 'P1 (Critical) priority automatically determined based on critical severity impact to ensure 4-hour SLA response.';
    if (priority === 'P2') return 'P2 (High) priority automatically determined based on team-level or department impact to ensure 8-hour SLA response.';
    return 'P3 (Medium/Low) priority automatically determined from matrix parameters to ensure 12-hour SLA resolution window.';
  };

  const getSlaRemainingTime = (t: ApiTicket) => {
    const created = new Date(t.created_at || new Date());
    let slaHrs = 12;
    if (t.priority === 'P1') slaHrs = 4;
    else if (t.priority === 'P2') slaHrs = 8;
    const deadline = created.getTime() + slaHrs * 60 * 60 * 1000;
    return deadline - Date.now();
  };

  const getSLACountdown = (createdDateStr: string, priority: string | null) => {
    const created = new Date(createdDateStr);
    let slaHours = 24;
    if (priority === 'P1') slaHours = 4;
    else if (priority === 'P2') slaHours = 8;
    else if (priority === 'P3') slaHours = 12;

    const limitTime = created.getTime() + slaHours * 60 * 60 * 1000;
    const now = Date.now();
    const remaining = limitTime - now;

    if (remaining <= 0) {
      return { text: '⚠️ SLA Breached', color: 'text-red-500 font-bold', msRemaining: remaining };
    }
    const hrs = Math.floor(remaining / (1000 * 60 * 60));
    const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return { text: `SLA: ${hrs}h ${mins}m remaining`, color: 'text-amber-500 font-medium', msRemaining: remaining };
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'Resolved': return 'bg-green-100 text-green-800 dark:bg-green-955/20 dark:text-green-400';
      case 'Closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-808 dark:text-gray-400';
      case 'Processing': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-955/20 dark:text-cyan-400';
      case 'Draft': return 'bg-purple-100 text-purple-800 dark:bg-purple-955/20 dark:text-purple-400';
      default: return 'bg-amber-100 text-amber-800 dark:bg-amber-955/20 dark:text-amber-400';
    }
  };

  const handleApplyTemplate = (tpl: typeof TEMPLATES[0]) => {
    setSubject(tpl.subject);
    setDescription(tpl.desc);
    setCategoryHint(tpl.category);
    setAffectedSystem(tpl.system);
    triggerToast(`Applied pre-filled template: ${tpl.name}`);
  };

  const handleExportPDF = (t: any) => {
    const pdfText = `SUPPORTPILOT TICKET REPORT\n=======================\nTicket ID: ${t.ticket_id}\nSubject: ${t.subject}\nStatus: ${t.status}\nPriority: ${t.priority || 'P3'}\nDepartment: ${t.department}\nSite Location: ${t.site}\nDescription: ${t.description}\n=======================\nGenerated at ${new Date().toLocaleString()}`;
    const blob = new Blob([pdfText], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Ticket_${t.ticket_id}_Export.txt`;
    link.click();
    triggerToast(`Ticket ${t.ticket_id} exported successfully!`);
  };

  const isRaisedOnBehalf = (t: any) => {
    return !!t.on_behalf_of || (t.requester && String(t.requester.user_id) !== String((user as any)?.user_id || (user as any)?.id || ''));
  };

  const getFilteredMyTickets = () => {
    let result = [...tickets];
    if (myTicketsStatusFilter !== 'All') {
      result = result.filter(t => t.status === myTicketsStatusFilter);
    }
    if (myTicketsCategoryFilter !== 'All') {
      result = result.filter(t => t.category === myTicketsCategoryFilter);
    }
    if (myTicketsOriginFilter === 'Self') {
      result = result.filter(t => !isRaisedOnBehalf(t));
    } else if (myTicketsOriginFilter === 'Behalf') {
      result = result.filter(t => isRaisedOnBehalf(t));
    }
    
    // Sort
    if (myTicketsSortOrder === 'Newest') {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (myTicketsSortOrder === 'Oldest') {
      result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (myTicketsSortOrder === 'SLA Proximity') {
      result.sort((a, b) => getSlaRemainingTime(a) - getSlaRemainingTime(b));
    }
    return result;
  };

  const filteredMyTickets = getFilteredMyTickets();

  // Overview calculations
  const unresolvedTickets = tickets.filter(t => t.status !== 'Closed' && t.status !== 'Resolved');
  const openCount = tickets.filter(t => t.status === 'Open').length;
  const processingCount = tickets.filter(t => t.status === 'Processing').length;
  const resolvedCount = tickets.filter(t => t.status === 'Resolved').length;
  const draftCount = tickets.filter(t => t.status === 'Draft').length;

  const activeSlaBreaches = unresolvedTickets.filter(t => {
    const slaObj = getSLACountdown(t.created_at, t.priority);
    return slaObj.text.includes('SLA') || slaObj.text.includes('Breached');
  });

  return (
    <div className={`min-h-screen flex transition-colors duration-250 ${isDark ? 'bg-[#0b0f19] text-white' : 'bg-slate-50 text-gray-900'}`}>
      
      {/* ── Sidebar (Restructured Nav Links matching exact brand logo) ── */}
      <aside className={`fixed lg:sticky top-0 z-40 h-screen w-64 shrink-0 flex flex-col ${isDark ? 'bg-gray-900 border-r border-[#1e293b] text-white' : 'bg-white border-r border-gray-200 text-gray-900'}`}>
        
        {/* Branding (Rounded "A" box + brand texts) */}
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
            { id: 'Home', name: 'Home / Overview', icon: LayoutDashboard },
            { id: 'Create Ticket', name: 'Raise Ticket', icon: PlusCircle },
            { id: 'My Tickets', name: 'My Tickets', icon: Ticket },
            { id: 'Help Center', name: 'Help Center', icon: BookOpen },
            { id: 'AI Assistant', name: 'AI Assistant Copilot', icon: Bot },
            { id: 'Profile Settings', name: 'Profile Settings', icon: User },
          ].map(item => {
            const active = activeTab === item.id || (item.id === 'My Tickets' && activeTab === 'Track Ticket');
            const isHelp = item.id === 'Help Center';
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id as any); setTrackingTicketId(null); }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  active ? 'bg-blue-600 text-white shadow-sm' : isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-slate-800 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-4.5 h-4.5 shrink-0" />
                  <span>{item.name}</span>
                </div>
                {isHelp && (
                  <span className="text-[8px] bg-slate-200 dark:bg-gray-800 text-gray-400 font-extrabold px-1.5 py-0.5 rounded">M2</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User profile card */}
        <div className="p-3 border-t dark:border-gray-800">
          <div className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-gray-50'}`}>
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
              U
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate text-slate-805">{user?.name || 'Customer'}</p>
              <p className="text-[10px] text-green-600 font-bold">{user?.role || 'User'}</p>
            </div>
            <button onClick={() => { signOut(); onNavigate('home'); }} title="Sign out" className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ─────────────────────────────────────── */}
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
              {activeTab === 'Create Ticket' ? 'Raise Ticket' : activeTab === 'Help Center' ? 'Help Center' : activeTab}
            </span>
            
            {/* Search Bar matching mockup style */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${isDark ? 'bg-slate-900 border-gray-850' : 'bg-slate-100/70 border-slate-200'} w-72`}>
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                placeholder="Search tickets, users..."
                className="bg-transparent outline-none text-[11px] w-full text-gray-755 dark:text-white placeholder-gray-450 font-medium animate-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 text-gray-500 font-semibold relative">
            <button onClick={toggleTheme} className={`p-1.5 rounded-lg transition-colors hover:text-gray-800 dark:hover:text-white`}>
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            
            {/* Help circle with toast popup */}
            <button 
              onClick={() => triggerToast('Help documentation catalog has been loaded for customer reference.')}
              className="hover:text-gray-800 dark:hover:text-white transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            
            {/* Chat bubble triggers AI tab */}
            <button 
              onClick={() => { setActiveTab('AI Assistant'); triggerToast('Virtual AI Assistant Copilot initialized.'); }}
              className="hover:text-gray-800 dark:hover:text-white transition-colors relative"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-blue-600 rounded-full" />
            </button>

            {/* Notifications Bell Dropdown with unread count badge */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className={`hover:text-gray-800 dark:hover:text-white transition-colors relative`}
              >
                <Bell className="w-4 h-4" />
                {userNotifications.some(n => !n.read) && (
                  <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-500 rounded-full" />
                )}
              </button>
              {notificationsOpen && (
                <div className={`absolute right-0 mt-3 w-80 rounded-2xl p-4 shadow-2xl border z-35 ${isDark ? 'bg-gray-900 border-gray-850 text-white' : 'bg-white border-slate-200 text-gray-900'}`}>
                  <div className="flex justify-between items-center mb-3 font-semibold text-xs">
                    <span>Notifications</span>
                    <button
                      onClick={() => setUserNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                      className="text-[10px] text-blue-500 hover:underline"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="space-y-2.5 max-h-60 overflow-y-auto font-medium">
                    {userNotifications.map(n => (
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
                  {user?.name ? user.name[0].toUpperCase() : 'U'}
                </div>
                <div className="min-w-0 text-left leading-tight">
                  <p className="text-xs font-bold text-gray-800 dark:text-white">{user?.name || 'Customer'}</p>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{user?.role || 'User'}</p>
                </div>
              </button>

              {profileDropdownOpen && (
                <div className={`absolute right-0 mt-2.5 w-52 rounded-2xl p-2 border shadow-2xl z-30 animate-in fade-in slide-in-from-top-2 ${
                  isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'
                }`}>
                  <div className="px-3 py-2 border-b dark:border-slate-800">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Account Portal</p>
                    <p className="text-xs font-bold truncate mt-0.5">{user?.email || 'customer@company.com'}</p>
                  </div>
                  
                  <button 
                    onClick={() => { setActiveTab('Profile Settings'); setProfileDropdownOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 text-left mt-1.5 font-bold"
                  >
                    <User className="w-4 h-4 text-blue-505" />
                    <span>Profile Settings</span>
                  </button>

                  <button 
                    onClick={() => { triggerToast('Customer support manuals catalog v1.5 initialized.'); setProfileDropdownOpen(false); }}
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

        {/* Workspace views */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6 max-w-[1200px] mx-auto w-full">

          {/* ── View: Home / Overview (NEW TAB) ───────────────────── */}
          {activeTab === 'Home' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <h2 className="text-xl font-bold">Portal Overview</h2>
                <p className="text-xs text-gray-550 font-semibold">Quick summary of your support activity, SLA countdowns, and active requests.</p>
              </div>

              {/* Metric Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Unresolved Tickets', value: unresolvedTickets.length, color: 'text-blue-500' },
                  { label: 'Open Requests', value: openCount, color: 'text-amber-500' },
                  { label: 'Specialist Processing', value: processingCount, color: 'text-cyan-505' },
                  { label: 'Autosaved Drafts', value: draftCount, color: 'text-purple-500' }
                ].map(m => (
                  <div key={m.label} className={`p-5 rounded-3xl border shadow-sm ${
                    isDark ? 'bg-gray-900 border-slate-800 text-white' : 'bg-white border-gray-200 text-gray-900'
                  }`}>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{m.label}</span>
                    <p className={`text-2xl font-extrabold mt-2 ${m.color}`}>{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Active SLA Countdowns at a glance */}
              <div className={`p-5 rounded-3xl border shadow-sm ${
                isDark ? 'bg-gray-900 border-slate-800 text-white' : 'bg-white border-gray-200 text-gray-900'
              } space-y-4`}>
                <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-blue-505"><Clock className="w-4 h-4" /> SLA Countdown Warnings</h3>
                
                <div className="overflow-x-auto text-xs font-semibold">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b dark:border-gray-800 text-gray-505 uppercase text-[10px] tracking-wider font-bold">
                        <th className="py-2">TICKET ID</th>
                        <th className="py-2">PRIORITY</th>
                        <th className="py-2">SUBJECT</th>
                        <th className="py-2">STATUS</th>
                        <th className="py-2">TIME DUE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-800">
                      {activeSlaBreaches.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-6 text-gray-400">All support tickets SLA countdowns are stable.</td></tr>
                      ) : (
                        activeSlaBreaches.map(t => {
                          const countdown = getSLACountdown(t.created_at, t.priority);
                          return (
                            <tr key={t.ticket_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                              <td className="py-3 font-mono font-bold text-blue-600">{t.ticket_id}</td>
                              <td className="py-3"><span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold text-[9px]">{t.priority || 'P3'}</span></td>
                              <td className="py-3 truncate max-w-xs">{t.subject}</td>
                              <td className="py-3">{t.status}</td>
                              <td className={`py-3 font-bold ${countdown.color}`}>{countdown.text}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── View: Raise Ticket (Three-section Form + Delegation field) ── */}
          {activeTab === 'Create Ticket' && (
            <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-slate-800' : 'bg-white border-gray-200'} space-y-6 animate-in fade-in duration-200`}>
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-1.5"><PlusCircle className="w-5 h-5 text-blue-500" /> Raise Support Ticket</h2>
                  <p className="text-xs text-gray-550">Submit an issue directly to our IT Support Pilot classification queue.</p>
                </div>
                {autosaveMsg && (
                  <span className="text-[10px] text-green-600 font-bold bg-green-50 dark:bg-green-955/25 px-3 py-1.5 rounded-full border border-green-200 dark:border-green-800 select-none animate-pulse">
                    {autosaveMsg}
                  </span>
                )}
              </div>

              {/* templates */}
              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'} space-y-2`}>
                <span className="text-[10px] font-bold text-gray-405 uppercase tracking-wider flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> Pre-filled Templates Quick-Start:</span>
                <div className="flex flex-wrap gap-2.5">
                  {TEMPLATES.map(tpl => (
                    <button
                      key={tpl.name}
                      type="button"
                      onClick={() => handleApplyTemplate(tpl)}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all shadow-sm ${
                        isDark ? 'bg-gray-900 border-slate-800 hover:bg-slate-800 text-white' : 'bg-white border-gray-200 hover:bg-slate-100 text-gray-700'
                      }`}
                    >
                      {tpl.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form elements */}
              <div className="space-y-6">
                
                {/* DELEGATION (ON BEHALF OF) - Only visible if has delegation permission */}
                {hasDelegationPermission && (
                  <div className={`p-4 rounded-2xl border ${isDark ? 'bg-blue-900/10 border-blue-900' : 'bg-blue-50/50 border-blue-200'} space-y-3`}>
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        id="behalf_of_toggle"
                        checked={isBehalfOfActive}
                        onChange={e => setIsBehalfOfActive(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                      />
                      <label htmlFor="behalf_of_toggle" className="text-xs font-extrabold text-blue-505 select-none cursor-pointer uppercase tracking-wider">
                        Raise this ticket on behalf of a coworker (Delegated Access)
                      </label>
                    </div>
                    {isBehalfOfActive && (
                      <div className="pt-2 animate-in fade-in slide-in-from-top-1.5 duration-200">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Coworker Username / Email *</label>
                        <input
                          value={behalfOfUsername}
                          onChange={e => setBehalfOfUsername(e.target.value)}
                          placeholder="e.g. coworker_username or coworker@company.com"
                          className={`w-full rounded-xl border px-3.5 py-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-[#1e293b] border-slate-800 text-white' : 'bg-white border-gray-200'}`}
                          required={isBehalfOfActive}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* SECTION 1 */}
                <div className={`p-4 rounded-2xl border ${isDark ? 'border-slate-800' : 'border-gray-200'} space-y-4`}>
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-505">Section 1: Issue Details</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-405 uppercase tracking-wider mb-1">Subject *</label>
                      <input
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                        onBlur={handleSubjectBlur}
                        placeholder="e.g. VPN authentication failing on Okta credentials"
                        className={`w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-[#1e293b] border-gray-800 text-white' : 'bg-white border-gray-200'}`}
                        required
                      />
                      {duplicateWarning && (
                        <p className="text-[11px] text-red-500 font-bold mt-1 bg-red-500/5 p-2 rounded-lg border border-red-500/20">{duplicateWarning}</p>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <div className="flex justify-between items-center">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Description *</label>
                        {predictedCat && (
                          <span className="text-[10px] font-extrabold text-blue-505 bg-blue-100/10 px-2 py-0.5 rounded border border-blue-500/25 animate-pulse uppercase">
                            ✨ AI Hint: {predictedCat}
                          </span>
                        )}
                      </div>
                      <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        rows={4}
                        placeholder="Detail the troubleshooting steps or issues you are experiencing..."
                        className={`w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-[#1e293b] border-slate-800 text-white' : 'bg-white border-gray-200'}`}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Category Hint (Optional)</label>
                      <select
                        value={categoryHint}
                        onChange={e => setCategoryHint(e.target.value)}
                        className={`w-full rounded-xl border px-3 py-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-[#1e293b] border-gray-800' : 'bg-white border-gray-200 text-gray-900'}`}
                      >
                        {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-405 uppercase tracking-wider mb-1">Affected System / Application</label>
                      <select
                        value={affectedSystem}
                        onChange={e => setAffectedSystem(e.target.value)}
                        className={`w-full rounded-xl border px-3 py-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-[#1e293b] border-gray-800' : 'bg-white border-gray-200 text-gray-900'}`}
                      >
                        {APPLICATIONS.map(app => <option key={app} value={app}>{app}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Started When</label>
                      <input
                        type="datetime-local"
                        value={startedWhen}
                        onChange={e => setStartedWhen(e.target.value)}
                        className={`w-full rounded-xl border px-3 py-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-[#1e293b] border-slate-800 text-white' : 'bg-white border-gray-200'}`}
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 2 */}
                <div className={`p-4 rounded-2xl border ${isDark ? 'border-slate-800' : 'border-gray-200'} space-y-4`}>
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-505">Section 2: Impact Assessment</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Who is affected? *</label>
                      <div className="flex gap-2 flex-wrap">
                        {['Just me', 'My team', 'Department', 'Whole org'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setAffectedScope(opt)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              affectedScope === opt ? 'bg-blue-600 text-white border-blue-600' : isDark ? 'border-slate-800 text-gray-400 hover:bg-gray-808' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Is work blocked? *</label>
                      <div className="flex gap-2">
                        {['No', 'Yes'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setWorkBlocked(opt)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              workBlocked === opt ? 'bg-blue-600 text-white border-blue-600' : isDark ? 'border-slate-800 text-gray-400 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Self-Reported Urgency (Optional)</label>
                      <div className="flex gap-2">
                        {['Low', 'Medium', 'High'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setSelfUrgency(opt)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              selfUrgency === opt ? 'bg-blue-600 text-white border-blue-600' : isDark ? 'border-slate-800 text-gray-400 hover:bg-gray-808' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 pt-6">
                      <input
                        type="checkbox"
                        id="workaround"
                        checked={workaroundAvailable}
                        onChange={e => setWorkaroundAvailable(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-305 text-blue-600"
                      />
                      <label htmlFor="workaround" className="text-xs font-semibold select-none cursor-pointer">Workaround available</label>
                    </div>
                  </div>
                </div>

                {/* SECTION 3 */}
                <div className={`p-4 rounded-2xl border ${isDark ? 'border-slate-800' : 'border-gray-200'} space-y-4`}>
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-505">Section 3: Context & Prefills</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Department</label>
                      <select
                        value={department}
                        onChange={e => setDepartment(e.target.value)}
                        className={`w-full rounded-xl border px-3 py-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-gray-200 text-gray-900'}`}
                      >
                        {DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Location Site</label>
                      <select
                        value={site}
                        onChange={e => setSite(e.target.value)}
                        className={`w-full rounded-xl border px-3 py-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-gray-200 text-gray-900'}`}
                      >
                        {SITES.map(st => <option key={st} value={st}>{st}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Asset Tag</label>
                      <input
                        value={assetTag}
                        onChange={e => setAssetTag(e.target.value)}
                        placeholder="e.g. LPT-94827"
                        className={`w-full rounded-xl border px-3.5 py-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-[#1e293b] border-slate-800 text-white' : 'bg-white border-gray-200'}`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Preferred Contact Preference</label>
                      <select
                        value={preferredContact}
                        onChange={e => setPreferredContact(e.target.value)}
                        className={`w-full rounded-xl border px-3 py-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-gray-200 text-gray-900'}`}
                      >
                        <option value="Email">Email</option>
                        <option value="Slack">Slack / Teams</option>
                        <option value="Mobile">Mobile Phone</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Best Time to Contact</label>
                      <input
                        value={bestTimeToContact}
                        onChange={e => setBestTimeToContact(e.target.value)}
                        placeholder="e.g. Mon-Fri afternoons after 2pm"
                        className={`w-full rounded-xl border px-3.5 py-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-[#1e293b] border-slate-800 text-white' : 'bg-white border-gray-200'}`}
                      />
                    </div>

                    {/* Attachments */}
                    <div className="md:col-span-2 space-y-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Attachments (Max 5, 10MB each)</label>
                      <div className="flex gap-2">
                        <input
                          value={newFile}
                          onChange={e => setNewFile(e.target.value)}
                          placeholder="Filename (e.g. error_screenshot.png)"
                          className={`text-xs p-2 rounded-xl border outline-none flex-1 ${isDark ? 'bg-[#1e293b] border-slate-800 text-white' : 'bg-white'}`}
                        />
                        <button
                          type="button"
                          onClick={handleAddFile}
                          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
                        >
                          Attach File
                        </button>
                      </div>

                      {attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {attachments.map((file, i) => (
                            <span key={i} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] bg-slate-100 dark:bg-gray-900 border font-bold text-blue-500">
                              <Paperclip className="w-3 h-3" /> {file}
                              <button type="button" onClick={() => handleRemoveFile(i)} className="text-red-500 hover:underline ml-1">×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {successMsg && (
                  <div className="p-3.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-semibold">{successMsg}</div>
                )}

                {/* Sub-1s Actions */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleCreateTicketSubmit('Draft')}
                    className="flex-1 py-3 text-xs font-bold rounded-xl border border-gray-305 hover:bg-gray-105 dark:border-gray-700 dark:hover:bg-gray-800 transition-colors"
                  >
                    Save as Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCreateTicketSubmit()}
                    disabled={submitting || !subject.trim() || !description.trim()}
                    className="flex-1 py-3 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-60"
                  >
                    {submitting ? 'Submitting...' : 'Submit Support Request'}
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* ── View: My Tickets (With shortcut status pills) ────────── */}
          {activeTab === 'My Tickets' && !selectedTrackingTicket && (
            <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-slate-800' : 'bg-white border-gray-200'} space-y-4 animate-in fade-in duration-200`}>
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-1.5"><Ticket className="w-5 h-5 text-blue-500" /> My Ticket Queue</h2>
                  <p className="text-xs text-gray-555">Overview of all support requests raised by your account.</p>
                </div>

                {/* Status Pill Shortcuts (Open, Processing/In Progress, Resolved, Closed) */}
                <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border dark:border-gray-850 font-bold text-xs">
                  {['All', 'Open', 'Processing', 'Resolved', 'Closed'].map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setMyTicketsStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                        myTicketsStatusFilter === st 
                          ? 'bg-blue-600 text-white shadow-sm' 
                          : 'text-gray-550 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {st === 'Processing' ? 'In Progress' : st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Filters & Sort Controls */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-2xl bg-slate-100/30 dark:bg-slate-900/40 border dark:border-slate-800 text-xs font-semibold">
                <div>
                  <label className="text-[10px] text-gray-550 block mb-1 uppercase">Filter Category</label>
                  <select value={myTicketsCategoryFilter} onChange={e => setMyTicketsCategoryFilter(e.target.value)} className="w-full p-1.5 rounded-lg border outline-none dark:bg-gray-900 dark:border-slate-800">
                    <option value="All">All categories</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-555 block mb-1 uppercase">Sort Queue</label>
                  <select value={myTicketsSortOrder} onChange={e => setMyTicketsSortOrder(e.target.value)} className="w-full p-1.5 rounded-lg border outline-none dark:bg-gray-900 dark:border-slate-800">
                    <option value="Newest">Newest first</option>
                    <option value="Oldest">Oldest first</option>
                    <option value="SLA Proximity">SLA Proximity</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-555 block mb-1 uppercase">Filter Origin</label>
                  <select value={myTicketsOriginFilter} onChange={e => setMyTicketsOriginFilter(e.target.value as any)} className="w-full p-1.5 rounded-lg border outline-none dark:bg-gray-900 dark:border-slate-800">
                    <option value="All">All Origins</option>
                    <option value="Self">Raised by Me</option>
                    <option value="Behalf">Raised on My Behalf</option>
                  </select>
                </div>
              </div>

              {/* Queue List Table */}
              <div className="overflow-x-auto text-xs font-semibold">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b dark:border-gray-800 text-gray-550 uppercase font-bold">
                      <th className="py-2.5">Ticket ID</th>
                      <th className="py-2.5">Priority</th>
                      <th className="py-2.5">Origin</th>
                      <th className="py-2.5">Issue (Subject)</th>
                      <th className="py-2.5">Status</th>
                      <th className="py-2.5">SLA Countdown</th>
                      <th className="py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-800 font-medium">
                    {loading ? (
                      <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading tickets list...</td></tr>
                    ) : filteredMyTickets.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-8 text-gray-400">No tickets found matching filters.</td></tr>
                    ) : (
                      filteredMyTickets.map(t => {
                        const slaObj = getSLACountdown(t.created_at, t.priority);
                        const isBehalf = isRaisedOnBehalf(t);
                        return (
                          <tr key={t.ticket_id} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/50">
                            <td className="py-3.5 font-mono text-blue-600 font-bold">{t.ticket_id}</td>
                            <td className="py-3.5"><span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-gray-800 font-bold text-[10px]">{t.priority || 'P3'}</span></td>
                            <td className="py-3.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isBehalf ? 'bg-amber-100 text-amber-850 dark:bg-amber-955/25 dark:text-amber-400' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                              }`}>
                                {isBehalf ? '🛡️ Behalf' : '👤 Self'}
                              </span>
                            </td>
                            <td className="py-3.5 max-w-xs truncate">{t.subject}</td>
                            <td className="py-3.5"><span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadgeStyle(t.status)}`}>{t.status}</span></td>
                            <td className={`py-3.5 ${t.status === 'Resolved' || t.status === 'Closed' ? 'text-green-500' : slaObj.color}`}>{t.status === 'Resolved' || t.status === 'Closed' ? '✓ Met' : slaObj.text}</td>
                            <td className="py-3.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleExportPDF(t)}
                                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-305 transition-colors"
                                  title="Download Ticket Report"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => startTracking(t.ticket_id)}
                                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-all shadow-sm"
                                >
                                  Track Progress
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── View: Track Ticket (Read-only Detail Timeline) ────── */}
          {activeTab === 'Track Ticket' && selectedTrackingTicket && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex justify-between items-center font-semibold font-bold">
                <button
                  onClick={() => { setActiveTab('My Tickets'); setTrackingTicketId(null); }}
                  className="flex items-center gap-1 text-xs text-gray-555 hover:text-gray-800 dark:hover:text-white font-bold"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to My Tickets
                </button>

                <div className="flex gap-2">
                  {/* Cancel/withdraw action */}
                  {(selectedTrackingTicket.status === 'Open' || selectedTrackingTicket.status === 'Draft') && 
                   (!selectedTrackingTicket.assignee || selectedTrackingTicket.assignee === 'Unassigned') && (
                    <button
                      onClick={() => handleWithdrawTicket(selectedTrackingTicket)}
                      className="px-3 py-1.5 border border-red-505 hover:bg-red-550/10 text-red-500 text-xs font-bold rounded-xl transition-all"
                    >
                      Withdraw Ticket
                    </button>
                  )}

                  {/* Reopen action if resolved */}
                  {selectedTrackingTicket.status === 'Resolved' && (
                    <button
                      onClick={() => handleReopenTicket(selectedTrackingTicket)}
                      className="px-3 py-1.5 border border-blue-500 hover:bg-blue-505/10 text-blue-500 text-xs font-bold rounded-xl transition-all"
                    >
                      Reopen Ticket
                    </button>
                  )}

                  {/* Export PDF */}
                  <button
                    onClick={() => handleExportPDF(selectedTrackingTicket)}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <FileDown className="w-4 h-4" /> Download Ticket
                  </button>
                </div>
              </div>

              {successMsg && (
                <div className="p-3.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-semibold leading-relaxed">{successMsg}</div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs font-semibold">
                
                {/* Left side: details */}
                <div className={`lg:col-span-2 p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-slate-800' : 'bg-white border-gray-200'} space-y-4`}>
                  <div>
                    <span className="text-[10px] text-blue-500 font-mono font-bold">{selectedTrackingTicket.ticket_id}</span>
                    <h2 className="text-lg font-bold mt-1">{selectedTrackingTicket.subject}</h2>
                    <p className="text-gray-550 mt-2 leading-relaxed font-medium">{selectedTrackingTicket.description || 'No description provided.'}</p>
                  </div>

                  {/* Attachments Preview & Downloads Grid */}
                  {selectedTrackingTicket.attachments && selectedTrackingTicket.attachments.length > 0 && (
                    <div className="pt-4 border-t dark:border-gray-850 space-y-2">
                      <p className="font-bold text-gray-500 text-[10px] uppercase">Attached Files & Previews</p>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1">
                        {selectedTrackingTicket.attachments.map((file: any, idx: number) => {
                          const isImage = file.match(/\.(jpeg|jpg|gif|png|webp)/i);
                          return (
                            <div key={idx} className="border dark:border-gray-800 rounded-2xl p-2 bg-slate-100/20 dark:bg-gray-950 flex flex-col items-center justify-between gap-2 text-center group relative overflow-hidden">
                              {isImage ? (
                                <div className="w-full h-20 rounded-xl bg-blue-100/10 flex items-center justify-center overflow-hidden border dark:border-gray-800">
                                  <span className="text-[10px] font-extrabold text-blue-550 tracking-wider uppercase">IMG PREVIEW</span>
                                </div>
                              ) : (
                                <div className="w-full h-20 rounded-xl bg-slate-200/20 flex items-center justify-center border dark:border-gray-800">
                                  <FileText className="w-8 h-8 text-gray-400" />
                                </div>
                              )}
                              
                              <div className="w-full text-left px-1">
                                <p className="font-bold truncate text-[10px]" title={file}>{file}</p>
                              </div>

                              <button
                                onClick={() => {
                                  const text = `Simulating download representation of file: ${file}`;
                                  const blob = new Blob([text], { type: 'text/plain' });
                                  const link = document.createElement('a');
                                  link.href = URL.createObjectURL(blob);
                                  link.download = file;
                                  link.click();
                                }}
                                className="w-full py-1 rounded-lg bg-blue-600/10 text-blue-505 hover:bg-blue-600 hover:text-white transition-all text-[9px] font-extrabold flex items-center justify-center gap-1"
                              >
                                <Download className="w-3.5 h-3.5" /> Download
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Reply timeline */}
                  <div className="pt-4 border-t dark:border-slate-800 space-y-4">
                    <p className="font-bold text-gray-500 text-[10px] uppercase">Ticket Response Feed</p>
                    {selectedTrackingTicket.resolution_reply ? (
                      <div className="p-3.5 rounded-2xl bg-blue-100/10 space-y-1 leading-relaxed">
                        <p className="font-bold text-blue-500 flex items-center gap-1.5"><Bot className="w-4 h-4" /> Helpdesk Specialist response</p>
                        <p className="text-gray-305 font-medium">{selectedTrackingTicket.resolution_reply}</p>
                      </div>
                    ) : (
                      <p className="text-gray-550 italic font-medium">Specialist team has not posted a public response yet.</p>
                    )}
                  </div>
                </div>

                {/* Right side: SLA & Plain-language classification metadata */}
                <div className="space-y-6">
                  {/* Timeline stepper */}
                  <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-slate-800' : 'bg-white border-gray-200'} space-y-4`}>
                    <p className="font-bold text-gray-505 text-[10px] uppercase">Ticket Progress</p>
                    <div className="space-y-4 relative pl-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-blue-600/20">
                      {[
                        { label: 'Created & Logged', active: true },
                        { label: 'AI Classified', active: true },
                        { label: 'Triage & Assigned', active: !!selectedTrackingTicket.assignee },
                        { label: 'Specialist Processing', active: selectedTrackingTicket.status === 'Processing' || selectedTrackingTicket.status === 'Resolved' },
                        { label: 'Resolved & Closed', active: selectedTrackingTicket.status === 'Resolved' || selectedTrackingTicket.status === 'Closed' }
                      ].map((step, idx) => (
                        <div key={idx} className="relative flex items-center gap-3">
                          <span className={`absolute -left-4 w-3.5 h-3.5 rounded-full border-2 bg-[#0b0f19] flex items-center justify-center ${step.active ? 'border-blue-600 bg-blue-600' : 'border-gray-700'}`}>
                            {step.active && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                          </span>
                          <span className={`font-semibold ${step.active ? 'text-blue-505' : 'text-gray-550'}`}>{step.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Read-only details */}
                  <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} space-y-3`}>
                    <p className="font-bold text-gray-500 text-[10px] uppercase">Classification Details</p>
                    <div className="space-y-2 font-medium">
                      <div className="flex justify-between items-center py-1">
                        <span>Assigned Category:</span>
                        <span className="text-blue-500 font-bold">{selectedTrackingTicket.category || 'Triage in progress'}</span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span>Assigned Subcategory:</span>
                        <span className="text-blue-505 font-bold">{selectedTrackingTicket.subcategory || 'Triage in progress'}</span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span>Status:</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusBadgeStyle(selectedTrackingTicket.status)}`}>{selectedTrackingTicket.status}</span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span>Priority Level:</span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#1e293b] font-bold text-[10px]">{selectedTrackingTicket.priority || 'P3'}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-2 leading-relaxed bg-slate-101/10 p-2.5 rounded-xl border border-dashed dark:border-gray-800 font-normal">
                        {getPriorityExplanation(selectedTrackingTicket.priority)}
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ── View: Knowledge Base / Help Center (NEW TAB - M2 Placeholder) ─ */}
          {activeTab === 'Help Center' && (
            <div className={`p-8 rounded-3xl border text-center ${
              isDark ? 'bg-gray-900 border-slate-800 text-white' : 'bg-white border-gray-200 text-slate-900'
            } space-y-6 max-w-[700px] mx-auto animate-in fade-in duration-200`}>
              <div className="w-16 h-16 rounded-full bg-blue-105/10 flex items-center justify-center mx-auto text-blue-505">
                <BookOpen className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold">Knowledge Base & Help Center</h2>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest text-blue-505">Milestone 2 Releases</p>
                <p className="text-xs text-gray-550 leading-relaxed font-medium">
                  We are currently integrating a comprehensive Retrieval-Augmented Generation (RAG) system database. Intelligent search, documentation indexes, and automated help guides will ship in M2.
                </p>
              </div>
              <div className="inline-block px-4 py-2 rounded-xl bg-slate-100/50 border dark:border-slate-800 text-[11px] text-gray-450 font-bold tracking-wider">
                🚧 INTEGRATION COMMENCES IN NEXT BUILD
              </div>
            </div>
          )}

          {/* ── View: AI Assistant Copilot ────────────────────────── */}
          {activeTab === 'AI Assistant' && (
            <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} space-y-4 max-w-[800px] mx-auto animate-in fade-in duration-200`}>
              <div>
                <h2 className="text-lg font-bold flex items-center gap-1.5"><Bot className="w-5 h-5 text-blue-505" /> Virtual AI Assistant</h2>
                <p className="text-xs text-gray-550">Ask troubleshooting questions regarding credentials, VPN tokens, or hardware performance issues.</p>
              </div>

              {/* Chat thread */}
              <div className="border rounded-2xl p-4 h-96 overflow-y-auto space-y-3 dark:border-slate-800 bg-[#0b0f19]/20 text-xs font-semibold">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-2.5 max-w-[80%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 font-bold ${msg.role === 'user' ? 'bg-blue-600' : 'bg-emerald-600'}`}>
                      {msg.role === 'user' ? 'U' : 'AI'}
                    </div>
                    <div className={`p-3 rounded-2xl leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-100 dark:bg-gray-900 text-gray-305 rounded-tl-none border dark:border-slate-800 font-medium'}`}>
                      <p className="font-semibold">{msg.text}</p>
                      <span className="text-[9px] text-gray-555 block mt-1 text-right">{msg.time}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <form onSubmit={handleSendChatMessage} className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Ask a question (e.g. how do I reset my credentials?)..."
                  className={`text-xs p-3 rounded-xl border outline-none flex-1 focus:border-blue-500 ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white'}`}
                />
                <button type="submit" className="px-5 py-3 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors">Send</button>
              </form>
            </div>
          )}

          {/* ── View: Profile Settings ────────────────────────────── */}
          {activeTab === 'Profile Settings' && (
            <div className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} space-y-6 max-w-[800px] mx-auto text-xs font-semibold animate-in fade-in duration-200`}>
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2"><User className="w-5 h-5 text-blue-550" /> Account Profile Settings</h2>
                <p className="text-xs text-gray-500">Configure preferences, contact methods, and system notifications.</p>
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
                    <label className="block text-xs font-bold text-gray-405 uppercase tracking-wider mb-1">Preferred Contact Hours</label>
                    <input
                      value={contactHoursVal}
                      onChange={e => setContactHoursVal(e.target.value)}
                      className={`w-full rounded-xl border px-3 py-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-gray-200 text-gray-900'}`}
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t dark:border-gray-800 font-semibold">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold">Email Notifications</p>
                      <p className="text-xs text-gray-550 font-normal font-semibold">Receive SLA breaches warnings and agent responses via email alerts.</p>
                    </div>
                    <button
                      onClick={() => setEmailNotifToggle(!emailNotifToggle)}
                      className={`px-3 py-1 rounded-lg border text-[11px] font-bold ${emailNotifToggle ? 'bg-green-600 text-white border-green-600' : 'bg-transparent text-gray-500'}`}
                    >
                      {emailNotifToggle ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>

                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold">Portal Desktop Push Notifications</p>
                      <p className="text-xs text-gray-555 font-normal">Trigger toast alerts in bottom right corner on queue state changes.</p>
                    </div>
                    <button
                      onClick={() => setPushNotifToggle(!pushNotifToggle)}
                      className={`px-3 py-1 rounded-lg border text-[11px] font-bold ${pushNotifToggle ? 'bg-green-600 text-white border-green-600' : 'bg-transparent text-gray-500'}`}
                    >
                      {pushNotifToggle ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t dark:border-gray-800 flex justify-between items-center">
                  <div>
                    <p className="font-bold">User VIP Delegation Status</p>
                    <p className="text-xs text-gray-555 font-normal">Indicates if your profile is granted delegated permissions to raise tickets for coworkers.</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full font-bold text-[10px] ${
                    hasDelegationPermission ? 'bg-green-105 text-green-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {hasDelegationPermission ? '✓ Delegation Enabled' : 'Regular User Access'}
                  </span>
                </div>

                <button
                  onClick={() => { alert('Profile settings saved successfully!'); triggerToast('Profile preferences updated.'); }}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-750 text-white text-xs font-bold transition-all shadow-md"
                >
                  Save Profile Configuration Settings
                </button>
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
