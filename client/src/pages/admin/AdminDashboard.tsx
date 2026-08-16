import { useState, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { getAllTickets, processTicket, createTicket, Ticket as ApiTicket } from '../../services/ticketService';
import {
  Bot, Sun, Moon, LayoutDashboard, Ticket, PlusCircle, LogOut,
  AlertCircle, Clock, CheckCircle2, ChevronRight, Paperclip,
  Activity, Calendar, Compass, ShieldAlert, ArrowLeft, Sparkles, Bell,
  MessageSquare, UserPlus, ShieldCheck, Save, Filter, ChevronLeft,
  Settings, Users, BarChart3, BookOpen, Trash2, Edit2, Plus, Sliders, HelpCircle, User, Search
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigate: (page: string) => void;
}

type AdminTab = 
  | 'Dashboard'
  | 'My Tickets'
  | 'My Queue'
  | 'Create Ticket'
  | 'Taxonomy'
  | 'SLA Policies'
  | 'AI Assistant'
  | 'Reports'
  | 'Knowledge Base'
  | 'Users'
  | 'Settings';

// Org lists
const DEPARTMENTS_LIST = ['Information Technology', 'Human Resources', 'Finance & Accounts', 'Customer Support'];
const SITES_LIST = ['New York HQ', 'London Office', 'Bangalore Hub'];
const CATEGORIES_LIST = ['VPN', 'NETWORK', 'APPLICATION', 'ACCESS', 'HARDWARE'];
const APPLICATIONS_LIST = ['Microsoft Office 365', 'Cisco AnyConnect VPN', 'Salesforce CRM', 'Okta Identity Cloud'];

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

export default function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const { isDark, toggleTheme } = useTheme();
  const { signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>('Dashboard');
  const [tickets, setTickets] = useState<ApiTicket[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected ticket for detailed work
  const [selectedTicket, setSelectedTicket] = useState<ApiTicket | null>(null);

  // Filter state for All Tickets tab
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Overrides log
  const [overrideLogs] = useState([
    { id: 'ov1', ticketId: 'IT-2026-1BE84E', field: 'Category', oldVal: 'General', newVal: 'VPN', agent: 'Priya Mehra', time: '15 mins ago' },
    { id: 'ov2', ticketId: 'IT-2026-9C4836', field: 'Severity', oldVal: 'Normal', newVal: 'Critical', agent: 'Ravi Shankar', time: '1 hr ago' },
  ]);

  // AI Chat Copilot messages
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', text: 'Admin AI Triage Assistant loaded. Ask me about SLA metrics, category taxonomy rules, or model configurations.' }
  ]);
  const [chatInput, setChatInput] = useState('');

  // Org Settings CRUD States
  const [departments, setDepartments] = useState([
    { id: 'd1', name: 'Information Technology', code: 'IT', manager: 'Lakshmi Priya' },
    { id: 'd2', name: 'Human Resources', code: 'HR', manager: 'Sarah Connor' },
    { id: 'd3', name: 'Finance & Accounts', code: 'FIN', manager: 'Bruce Wayne' },
  ]);
  const [newDept, setNewDept] = useState({ name: '', code: '', manager: '' });

  const [sites, setSites] = useState([
    { id: 's1', name: 'New York HQ', calendar: '24x7 Support' },
    { id: 's2', name: 'London Office', calendar: '9x5 GMT' },
  ]);
  const [newSite, setNewSite] = useState({ name: '', calendar: '24x7 Support' });

  // Taxonomy CRUD States
  const [categories, setCategories] = useState([
    { id: 'cat1', name: 'VPN', subcategory: 'Connection Failure', team: 'Network Support', frozen: true },
    { id: 'cat2', name: 'NETWORK', subcategory: 'Wi-Fi Access', team: 'Network Support', frozen: true },
    { id: 'cat3', name: 'APPLICATION', subcategory: 'Authentication', team: 'Core Applications', frozen: false },
    { id: 'cat4', name: 'ACCESS', subcategory: 'Password Reset', team: 'Identity & Access', frozen: false },
  ]);
  const [newCat, setNewCat] = useState({ name: '', subcategory: '', team: '', frozen: false });

  // SLA Policies CRUD States
  const [slaPolicies, setSlaPolicies] = useState([
    { id: 'p1', priority: 'P1', response: '1h', resolution: '4h', calendar: '24x7 Support' },
    { id: 'p2', priority: 'P2', response: '2h', resolution: '8h', calendar: '9x5 Local' },
    { id: 'p3', priority: 'P3', response: '4h', resolution: '12h', calendar: '9x5 Local' },
  ]);

  // Users Management mockup
  const [adminUsers] = useState([
    { name: 'Lakshmipriya Gutti', email: 'lakshmipriya@gmail.com', role: 'Admin', assigned: 32, avatarColor: 'bg-blue-500' },
    { name: 'Priya Mehra', email: 'priya.m@company.com', role: 'Agent', assigned: 21, avatarColor: 'bg-blue-400' },
    { name: 'Ravi Shankar', email: 'ravi.s@company.com', role: 'Agent', assigned: 18, avatarColor: 'bg-blue-500' },
    { name: 'Anita Rao', email: 'anita.r@company.com', role: 'Viewer', assigned: 5, avatarColor: 'bg-blue-400' }
  ]);

  // ─── Ticket Creation Form States ────────────────────
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [categoryHint, setCategoryHint] = useState('APPLICATION');
  const [affectedSystem, setAffectedSystem] = useState('Microsoft Office 365');
  const [startedWhen, setStartedWhen] = useState('');
  const [affectedScope, setAffectedScope] = useState('Just me');
  const [workBlocked, setWorkBlocked] = useState('No');
  const [selfUrgency, setSelfUrgency] = useState('Medium');
  const [workaroundAvailable, setWorkaroundAvailable] = useState(false);
  const [department, setDepartment] = useState('Information Technology');
  const [site, setSite] = useState('New York HQ');
  const [assetTag, setAssetTag] = useState('');
  const [preferredContact, setPreferredContact] = useState('Email');
  const [bestTimeToContact, setBestTimeToContact] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [newFile, setNewFile] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ─── New Popups and Dropdowns States ────────────────
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
  };

  // Toast Auto-clear
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const data = await getAllTickets();
      setTickets(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const getSlaRemainingTime = (t: ApiTicket) => {
    const created = new Date(t.created_at || new Date());
    let slaHrs = 12;
    if (t.priority === 'P1') slaHrs = 4;
    else if (t.priority === 'P2') slaHrs = 8;
    const deadline = created.getTime() + slaHrs * 60 * 60 * 1000;
    return deadline - Date.now();
  };

  const getSLACountdown = (t: ApiTicket) => {
    const remaining = getSlaRemainingTime(t);
    if (remaining <= 0) {
      return { text: '⚠️ SLA Breached', color: 'text-red-500 font-bold' };
    }
    const hrs = Math.floor(remaining / (1000 * 60 * 60));
    const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 65));
    return { text: `SLA: ${hrs}h ${mins}m remaining`, color: 'text-amber-500 font-medium' };
  };

  // filter tickets for queue
  const unresolvedTickets = tickets
    .filter(t => t.status !== 'Closed' && t.status !== 'Resolved')
    .sort((a, b) => getSlaRemainingTime(a) - getSlaRemainingTime(b));

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userText = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text: userText }]);
    setChatInput('');
    
    const txt = userText.toLowerCase();
    setTimeout(() => {
      let reply = 'Admin AI Assistant is analyzing live telemetry... Ready.';
      if (txt.includes('sla')) {
        reply = 'Live SLA metrics: 6 active breach risk warnings are flagged in the active monitor.';
      } else if (txt.includes('ticket')) {
        reply = `Total unresolved ticket volume is ${unresolvedTickets.length}. Let me know if you would like me to triage or prioritize them by SLA risk.`;
      } else if (txt.includes('taxonomy') || txt.includes('category')) {
        reply = 'Taxonomy Database status: VPN, NETWORK, APPLICATION, ACCESS, HARDWARE categories are mapped. Freeze statuses are locked.';
      } else if (txt.includes('help')) {
        reply = 'Try asking: "What are the SLA breaches?", "How many unresolved tickets?", or "Show taxonomy categories".';
      }
      setChatMessages(prev => [...prev, { role: 'ai', text: reply }]);
    }, 600);
  };

  const handleAddDept = () => {
    if (!newDept.name || !newDept.code) return;
    setDepartments(prev => [...prev, { id: 'd_' + Date.now(), ...newDept }]);
    setNewDept({ name: '', code: '', manager: '' });
  };

  const handleAddSite = () => {
    if (!newSite.name) return;
    setSites(prev => [...prev, { id: 's_' + Date.now(), ...newSite }]);
    setNewSite({ name: '', calendar: '24x7 Support' });
  };

  const handleAddCat = () => {
    if (!newCat.name || !newCat.subcategory) return;
    setCategories(prev => [...prev, { id: 'c_' + Date.now(), ...newCat }]);
    setNewCat({ name: '', subcategory: '', team: '', frozen: false });
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

  const handleApplyTemplate = (tpl: typeof TEMPLATES[0]) => {
    setSubject(tpl.subject);
    setDescription(tpl.desc);
    setCategoryHint(tpl.category);
    setAffectedSystem(tpl.system);
  };

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
        attachments
      };

      await createTicket(payload as any);
      setSuccessMsg(statusOverride === 'Draft' ? 'Ticket saved successfully as a draft!' : 'Ticket submitted successfully!');
      
      setSubject('');
      setDescription('');
      setAssetTag('');
      setAttachments([]);
      
      setTimeout(() => {
        setSubmitting(false);
        setSuccessMsg('');
        setActiveTab('Dashboard');
        loadTickets();
      }, 1000);

    } catch (err: any) {
      console.error(err);
      alert('Failed to submit ticket request.');
      setSubmitting(false);
    }
  };

  return (
    <div className={`min-h-screen flex transition-colors duration-250 ${isDark ? 'bg-[#0b0f19] text-white' : 'bg-slate-50 text-gray-900'}`}>
      
      {/* ─── LEFT SIDEBAR (Matching Image 2 Sidebar Items & Brand Logo) ─── */}
      <aside className={`fixed lg:sticky top-0 z-40 h-screen w-64 shrink-0 flex flex-col ${isDark ? 'bg-[#0f172a] border-r border-[#1e293b] text-white' : 'bg-white border-r border-gray-200 text-gray-900'}`}>
        
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

        {/* Sidebar categories and items (Matching Image 2) */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-semibold">
          
          {/* Main items */}
          <div className="space-y-1">
            <button
              onClick={() => { setActiveTab('Dashboard'); setSelectedTicket(null); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'Dashboard' ? 'bg-blue-600 text-white shadow-sm' : isDark ? 'text-gray-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => { setActiveTab('My Tickets'); setSelectedTicket(null); }}
              className={`w-full flex items-center px-3.5 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'My Tickets' ? 'bg-blue-600 text-white shadow-sm' : isDark ? 'text-gray-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              <div className="flex items-center gap-3">
                <Ticket className="w-4 h-4" />
                <span>My Tickets</span>
              </div>
              <span className="ml-auto text-[9px] bg-blue-100 text-blue-800 font-extrabold px-2 py-0.5 rounded-full">127</span>
            </button>

            <button
              onClick={() => { setActiveTab('My Queue'); setSelectedTicket(null); }}
              className={`w-full flex items-center px-3.5 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'My Queue' ? 'bg-blue-600 text-white shadow-sm' : isDark ? 'text-gray-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4" />
                <span>My queue</span>
              </div>
              <span className="ml-auto text-[9px] bg-blue-100 text-blue-800 font-extrabold px-2 py-0.5 rounded-full">14</span>
            </button>

            <button
              onClick={() => { setActiveTab('Create Ticket'); setSelectedTicket(null); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'Create Ticket' ? 'bg-blue-600 text-white shadow-sm' : isDark ? 'text-gray-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Ticket</span>
            </button>
          </div>

          {/* CONFIGURATION */}
          <div className="space-y-1">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider px-3.5 mb-1.5">CONFIGURATION</p>
            {[
              { id: 'Taxonomy', name: 'Taxonomy', icon: Sliders },
              { id: 'SLA Policies', name: 'SLA policies', icon: ShieldAlert }
            ].map(item => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id as any); setSelectedTicket(null); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold transition-all ${active ? 'bg-blue-600 text-white shadow-sm' : isDark ? 'text-gray-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'}`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </div>

          {/* PRODUCTIVITY */}
          <div className="space-y-1">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider px-3.5 mb-1.5">PRODUCTIVITY</p>
            
            {/* AI Assistant with BETA Pill */}
            <button
              onClick={() => { setActiveTab('AI Assistant'); setSelectedTicket(null); }}
              className={`w-full flex items-center px-3.5 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'AI Assistant' ? 'bg-blue-600 text-white shadow-sm' : isDark ? 'text-gray-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              <div className="flex items-center gap-3">
                <Bot className="w-4 h-4" />
                <span>AI Assistant</span>
              </div>
              <span className="ml-auto text-[8px] bg-blue-105 text-blue-800 font-bold px-1.5 py-0.5 rounded uppercase">BETA</span>
            </button>

            {[
              { id: 'Reports', name: 'Reports', icon: BarChart3 },
              { id: 'Knowledge Base', name: 'Knowledge Base', icon: BookOpen }
            ].map(item => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id as any); setSelectedTicket(null); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold transition-all ${active ? 'bg-blue-600 text-white shadow-sm' : isDark ? 'text-gray-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'}`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </div>

          {/* ADMINISTRATION */}
          <div className="space-y-1">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider px-3.5 mb-1.5">ADMINISTRATION</p>
            {[
              { id: 'Users', name: 'Users', icon: Users },
              { id: 'Settings', name: 'Settings', icon: Settings }
            ].map(item => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id as any); setSelectedTicket(null); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold transition-all ${active ? 'bg-blue-600 text-white shadow-sm' : isDark ? 'text-gray-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'}`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </div>

        </nav>

        {/* Profile Card & Logout (Matching Bottom of Image 1 Sidebar, background is white in dark mode!) */}
        <div className="p-3 border-t dark:border-gray-800">
          <div className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-white text-gray-900 shadow-sm' : 'bg-slate-50 text-gray-900'}`}>
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-extrabold text-sm shrink-0">
              U
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate text-slate-805">Lakshmi Priya</p>
              <p className="text-[10px] text-green-600 font-bold">Admin</p>
            </div>
            <button onClick={() => { signOut(); onNavigate('home'); }} title="Sign out" className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-755">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT PANEL (Matching full header layout in mockup screenshot) ─── */}
      <div className="flex-1 min-w-0 flex flex-col">
        
        {/* Full Header bar (Matching exactly: Title + Search bar + Moon + Help + Chat + Bell + Lakshmipriya Gutti Profile avatar) */}
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
              {activeTab === 'My Queue' ? 'Users' : activeTab}
            </span>
            
            {/* Mockup Search Bar */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${isDark ? 'bg-slate-900 border-gray-850' : 'bg-slate-100/70 border-slate-200'} w-72`}>
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                placeholder="Search tickets, users..."
                className="bg-transparent outline-none text-[11px] w-full text-gray-755 dark:text-white placeholder-gray-450 font-medium"
              />
            </div>
          </div>

          {/* Right Header icons row */}
          <div className="flex items-center gap-4 text-gray-500 font-semibold relative">
            <button onClick={toggleTheme} className={`p-1.5 rounded-lg transition-colors hover:text-gray-800 dark:hover:text-white`}>
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            
            {/* Help circle with popup */}
            <button 
              onClick={() => triggerToast('Help documentation catalog has been loaded for administrative reference.')}
              className="hover:text-gray-800 dark:hover:text-white transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            
            {/* Chat bubble with popup */}
            <button 
              onClick={() => setAiDrawerOpen(!aiDrawerOpen)}
              className="hover:text-gray-800 dark:hover:text-white transition-colors relative"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-600 rounded-full animate-ping" />
            </button>
            
            {/* Bell icon with popup */}
            <button 
              onClick={() => triggerToast('Alert Center: 6 running unresolved SLA breach risks require triage attention.')}
              className="hover:text-gray-800 dark:hover:text-white transition-colors relative"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>

            {/* Profile Avatar circle - Clickable toggle menu */}
            <div className="relative">
              <button 
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2.5 pl-3 border-l dark:border-slate-800 hover:opacity-85 transition-opacity"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-extrabold text-[13px] shrink-0">
                  L
                </div>
                <div className="min-w-0 text-left leading-tight">
                  <p className="text-xs font-bold text-gray-800 dark:text-white">Lakshmipriya Gutti</p>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Admin</p>
                </div>
              </button>

              {/* Admin profile action dropdown */}
              {profileDropdownOpen && (
                <div className={`absolute right-0 mt-2.5 w-52 rounded-2xl p-2 border shadow-2xl z-30 animate-in fade-in slide-in-from-top-2 ${
                  isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'
                }`}>
                  <div className="px-3 py-2 border-b dark:border-slate-800">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Admin Account</p>
                    <p className="text-xs font-bold truncate mt-0.5">lakshmipriya@gmail.com</p>
                  </div>
                  
                  <button 
                    onClick={() => { triggerToast('Profile details for Lakshmipriya Gutti are fully active.'); setProfileDropdownOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 text-left mt-1.5"
                  >
                    <User className="w-4 h-4 text-blue-500" />
                    <span>Profile Settings</span>
                  </button>

                  <button 
                    onClick={() => { triggerToast('Help manuals v1.8 telemetry database loaded.'); setProfileDropdownOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
                  >
                    <HelpCircle className="w-4 h-4 text-emerald-500" />
                    <span>Help Documentation</span>
                  </button>

                  <button 
                    onClick={() => { setProfileDropdownOpen(false); signOut(); onNavigate('home'); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-955/15 text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout Session</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Floating AI Copilot Assistant Drawer */}
        {aiDrawerOpen && (
          <div className={`fixed right-6 bottom-20 w-[420px] h-[550px] rounded-3xl border shadow-2xl z-50 flex flex-col transition-all duration-300 animate-in slide-in-from-bottom-5 ${
            isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'
          }`}>
            {/* Header */}
            <div className="p-4 border-b dark:border-gray-850 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold">SupportPilot AI Copilot</h4>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Live System Telemetry</p>
                </div>
              </div>
              <button 
                onClick={() => setAiDrawerOpen(false)}
                className="text-gray-400 hover:text-slate-600 text-lg font-bold px-2 py-1"
              >
                ×
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 text-[11px] font-semibold">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0 font-bold text-[9px] ${msg.role === 'user' ? 'bg-blue-600' : 'bg-emerald-600'}`}>
                    {msg.role === 'user' ? 'U' : 'AI'}
                  </div>
                  <div className={`p-2.5 rounded-2xl leading-normal ${
                    msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-100 dark:bg-gray-950/60 text-gray-850 dark:text-gray-300 rounded-tl-none border dark:border-gray-850'
                  }`}>
                    <p>{msg.text}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendChat} className="p-3 border-t dark:border-slate-800 flex gap-2">
              <input
                placeholder="Ask AI Copilot about SLAs, Taxonomy, or Tickets..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                className={`text-xs p-2.5 rounded-xl border outline-none flex-1 focus:border-blue-500 ${
                  isDark ? 'bg-gray-950 border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'
                }`}
              />
              <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors">
                Query
              </button>
            </form>
          </div>
        )}

        {/* Floating Toast Notification Popups */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className={`p-4 rounded-2xl shadow-2xl border flex items-center gap-2.5 text-xs font-bold ${
              isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-200 text-gray-900'
            }`}>
              <Sparkles className="w-4 h-4 text-blue-500 animate-pulse" />
              <span>{toastMessage}</span>
            </div>
          </div>
        )}

        {/* Dynamic view switch */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6 max-w-[1400px] mx-auto w-full">

          {/* ─── VIEW: Dashboard (EXACTLY AS IMAGE 1 & DARK THEME COMBINED) ───────── */}
          {activeTab === 'Dashboard' && (
            <div className="space-y-6">
              <div>
                <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Admin Oversight Console</h2>
                <p className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Live operational SLA breach risks and ticket category classifications overview.</p>
              </div>

              {/* 4 Cards (Image 1 values, dark theme color styling applied!) */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {[
                  { label: 'UNRESOLVED TICKETS', value: 6, color: 'text-blue-500' },
                  { label: 'SLA BREACH RISK', value: 6, color: 'text-amber-500' },
                  { label: 'UNCLASSIFIED QUEUE SIZE', value: 0, color: 'text-rose-500' },
                  { label: 'MANUAL OVERRIDES LOGS', value: 3, color: 'text-purple-500' }
                ].map(m => (
                  <div key={m.label} className={`p-6 rounded-3xl shadow-sm ${
                    isDark ? 'bg-[#0f172a] text-white' : 'bg-white border border-gray-200 text-gray-900'
                  }`}>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{m.label}</span>
                    <p className={`text-3xl font-extrabold mt-2 ${m.color}`}>{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Active SLA Breaches Monitor (Matching Image 1 & Dark theme rows) */}
              <div className={`p-5 rounded-3xl shadow-sm ${
                isDark ? 'bg-[#0f172a] text-white' : 'bg-white border border-gray-200 text-gray-900'
              } space-y-4`}>
                <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-red-400' : 'text-red-655'}`}><ShieldAlert className="w-4 h-4" /> Active SLA Breaches Monitor</h3>
                
                <div className="overflow-x-auto text-xs font-semibold">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b dark:border-gray-800 text-gray-455 font-bold uppercase text-[10px] tracking-wider">
                        <th className="py-2.5">TICKET ID</th>
                        <th className="py-2.5">PRIORITY</th>
                        <th className="py-2.5">SUBJECT</th>
                        <th className="py-2.5">ASSIGNEE</th>
                        <th className="py-2.5">STATUS</th>
                        <th className="py-2.5">SLA COUNTDOWN</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                      {[
                        'IT-2026-1BE84E', 'IT-2026-9C4836', 'IT-2026-5B6202',
                        'IT-2026-9968CB', 'IT-2026-B29604', 'IT-2026-606063'
                      ].map(id => (
                        <tr key={id}>
                          <td className={`py-3 font-mono font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{id}</td>
                          <td className="py-3"><span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[9px]">P3</span></td>
                          <td className={`py-3 ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>vpn issue</td>
                          <td className="py-3 text-gray-400 font-normal">Unassigned</td>
                          <td className="py-3">Open</td>
                          <td className={`py-3 font-bold flex items-center gap-1 ${isDark ? 'text-red-400' : 'text-red-600'}`}>⚠️ SLA Breached</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── VIEW: My Tickets ───────────────────────────────────── */}
          {activeTab === 'My Tickets' && (
            <div className={`p-6 rounded-3xl ${isDark ? 'bg-[#0f172a] text-white' : 'bg-white border border-gray-200 text-gray-900'} space-y-4`}>
              <h2 className="text-lg font-bold">My Personal Tickets Queue</h2>
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b dark:border-gray-800 text-gray-400 font-bold uppercase">
                      <th className="py-2">Ticket ID</th>
                      <th className="py-2">Subject</th>
                      <th className="py-2">Priority</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-805">
                    <tr>
                      <td className={`py-3 font-mono font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>TCK-122</td>
                      <td className="py-3">MFA credentials setup issue</td>
                      <td className="py-3"><span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-gray-800 font-bold text-[10px]">P2</span></td>
                      <td className="py-3">Processing</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── VIEW: My Queue (INTEGRATED SLA-RISK TICKET QUEUE) ──── */}
          {activeTab === 'My Queue' && (
            <div className={`p-6 rounded-3xl ${isDark ? 'bg-[#0f172a] text-white' : 'bg-white border border-gray-200 text-gray-900'} space-y-4`}>
              <div>
                <h2 className="text-lg font-bold">Triage SLA Risk Queue</h2>
                <p className="text-xs text-gray-550 font-semibold">Queue tickets prioritized by closest remaining SLA response window.</p>
              </div>

              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left font-semibold">
                  <thead>
                    <tr className="border-b dark:border-gray-800 text-gray-455 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-3">TICKET ID</th>
                      <th className="py-3">PRIORITY</th>
                      <th className="py-3">SUBJECT</th>
                      <th className="py-3">CATEGORY</th>
                      <th className="py-3">SLA COUNTDOWN</th>
                      <th className="py-3">STATUS</th>
                      <th className="py-3 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                    {unresolvedTickets.length === 0 ? (
                      // Mock SLA Queue if DB is empty
                      [
                        { id: 'IT-2026-1BE84E', pri: 'P3', sub: 'vpn issue', cat: 'VPN', status: 'Open' },
                        { id: 'IT-2026-9C4836', pri: 'P3', sub: 'vpn issue', cat: 'VPN', status: 'Open' },
                        { id: 'IT-2026-5B6202', pri: 'P3', sub: 'vpn issue', cat: 'VPN', status: 'Open' },
                        { id: 'IT-2026-9968CB', pri: 'P3', sub: 'vpn issue', cat: 'VPN', status: 'Open' }
                      ].map(t => (
                        <tr key={t.id}>
                          <td className={`py-3 font-mono font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{t.id}</td>
                          <td className="py-3"><span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[9px]">{t.pri}</span></td>
                          <td className={`py-3 ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>{t.sub}</td>
                          <td className="py-3 text-blue-500 font-bold">{t.cat}</td>
                          <td className="py-3 text-red-500 font-bold">⚠️ SLA Breached</td>
                          <td className="py-3">{t.status}</td>
                          <td className="py-3 text-right">
                            <button onClick={() => setActiveTab('Dashboard')} className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px]">Triage</button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      unresolvedTickets.map(t => {
                        const countdown = getSLACountdown(t);
                        return (
                          <tr key={t.ticket_id}>
                            <td className={`py-3 font-mono font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{t.ticket_id}</td>
                            <td className="py-3">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                t.priority === 'P1' ? 'bg-red-100 text-red-800' : t.priority === 'P2' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                              }`}>{t.priority || 'P3'}</span>
                            </td>
                            <td className={`py-3 ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>{t.subject}</td>
                            <td className="py-3 text-blue-500 font-bold">{t.category}</td>
                            <td className={`py-3 font-bold ${countdown.color}`}>{countdown.text}</td>
                            <td className="py-3">{t.status}</td>
                            <td className="py-3 text-right">
                              <button onClick={() => setActiveTab('Dashboard')} className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px]">Triage</button>
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

          {/* ─── VIEW: Create Ticket (FULL CREATION MODULE EMBEDDED) ─── */}
          {activeTab === 'Create Ticket' && (
            <div className={`p-6 rounded-3xl ${isDark ? 'bg-[#0f172a] text-white' : 'bg-white border border-gray-200 text-gray-900'} space-y-6`}>
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2"><PlusCircle className="w-5 h-5 text-blue-500" /> Administrative Raise Support Ticket</h2>
                <p className="text-xs text-gray-550">Log tickets directly within the system. Automated ML classification triggers on submission.</p>
              </div>

              {/* templates */}
              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-[#0b0f19]/40 border-slate-800' : 'bg-slate-50/50 border-slate-200'} space-y-2`}>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> Pre-filled Templates Quick-Start:</span>
                <div className="flex flex-wrap gap-2.5">
                  {TEMPLATES.map(tpl => (
                    <button
                      key={tpl.name}
                      type="button"
                      onClick={() => handleApplyTemplate(tpl)}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all shadow-sm ${
                        isDark ? 'bg-gray-900 border-gray-800 hover:bg-gray-800 text-white' : 'bg-white border-gray-200 hover:bg-slate-100'
                      }`}
                    >
                      {tpl.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form elements */}
              <div className="space-y-6">
                
                {/* SECTION 1 */}
                <div className={`p-4 rounded-2xl border ${isDark ? 'border-gray-800' : 'border-gray-200'} space-y-4`}>
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-500">Section 1: Issue Details</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Subject *</label>
                      <input
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                        placeholder="e.g. VPN authentication failing on Okta credentials"
                        className={`w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-[#1e293b] border-gray-800 text-white' : 'bg-white border-gray-200'}`}
                        required
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Description *</label>
                      <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        rows={4}
                        placeholder="Detail the troubleshooting steps or issues you are experiencing..."
                        className={`w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-[#1e293b] border-gray-800 text-white' : 'bg-white border-gray-200'}`}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Category Hint (Optional)</label>
                      <select
                        value={categoryHint}
                        onChange={e => setCategoryHint(e.target.value)}
                        className={`w-full rounded-xl border px-3 py-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-[#1e293b] border-gray-800' : 'bg-white border-gray-200'}`}
                      >
                        {CATEGORIES_LIST.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Affected System / Application</label>
                      <select
                        value={affectedSystem}
                        onChange={e => setAffectedSystem(e.target.value)}
                        className={`w-full rounded-xl border px-3 py-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-[#1e293b] border-gray-800' : 'bg-white border-gray-200'}`}
                      >
                        {APPLICATIONS_LIST.map(app => <option key={app} value={app}>{app}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Started When</label>
                      <input
                        type="datetime-local"
                        value={startedWhen}
                        onChange={e => setStartedWhen(e.target.value)}
                        className={`w-full rounded-xl border px-3 py-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-[#1e293b] border-gray-800 text-white' : 'bg-white border-gray-200'}`}
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 2 */}
                <div className={`p-4 rounded-2xl border ${isDark ? 'border-gray-800' : 'border-gray-200'} space-y-4`}>
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-500">Section 2: Impact Assessment</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Who is affected? *</label>
                      <div className="flex gap-2">
                        {['Just me', 'My team', 'Department', 'Whole org'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setAffectedScope(opt)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              affectedScope === opt ? 'bg-blue-600 text-white border-blue-600' : isDark ? 'border-gray-800 text-gray-400 hover:bg-gray-800' : 'border-gray-255 text-slate-600 hover:bg-slate-100'
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
                              workBlocked === opt ? 'bg-blue-600 text-white border-blue-600' : isDark ? 'border-gray-800 text-gray-400 hover:bg-gray-800' : 'border-gray-255 text-slate-600 hover:bg-slate-100'
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
                              selfUrgency === opt ? 'bg-blue-600 text-white border-blue-600' : isDark ? 'border-gray-800 text-gray-400 hover:bg-gray-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
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
                        className="w-4 h-4 rounded border-gray-300 text-blue-600"
                      />
                      <label htmlFor="workaround" className="text-xs font-semibold select-none cursor-pointer">Workaround available</label>
                    </div>
                  </div>
                </div>

                {/* SECTION 3 */}
                <div className={`p-4 rounded-2xl border ${isDark ? 'border-gray-800' : 'border-gray-200'} space-y-4`}>
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-500">Section 3: Context & Prefills</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Department</label>
                      <select
                        value={department}
                        onChange={e => setDepartment(e.target.value)}
                        className={`w-full rounded-xl border px-3 py-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-[#1e293b] border-gray-800' : 'bg-white border-gray-200'}`}
                      >
                        {DEPARTMENTS_LIST.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Location Site</label>
                      <select
                        value={site}
                        onChange={e => setSite(e.target.value)}
                        className={`w-full rounded-xl border px-3 py-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-[#1e293b] border-gray-800' : 'bg-white border-gray-200'}`}
                      >
                        {SITES_LIST.map(st => <option key={st} value={st}>{st}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Asset Tag</label>
                      <input
                        value={assetTag}
                        onChange={e => setAssetTag(e.target.value)}
                        placeholder="e.g. LPT-94827"
                        className={`w-full rounded-xl border px-3.5 py-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-[#1e293b] border-gray-800 text-white' : 'bg-white border-gray-200'}`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Preferred Contact Preference</label>
                      <select
                        value={preferredContact}
                        onChange={e => setPreferredContact(e.target.value)}
                        className={`w-full rounded-xl border px-3 py-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-[#1e293b] border-gray-800' : 'bg-white border-gray-200'}`}
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
                        className={`w-full rounded-xl border px-3.5 py-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-[#1e293b] border-gray-800 text-white' : 'bg-white border-gray-200'}`}
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
                          className={`text-xs p-2 rounded-xl border outline-none flex-1 ${isDark ? 'bg-[#1e293b] border-gray-800' : 'bg-white'}`}
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
                    className="flex-1 py-3 text-xs font-bold rounded-xl border border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 transition-colors"
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

          {/* ─── VIEW: Taxonomy ─────────────────────────────────────── */}
          {activeTab === 'Taxonomy' && (
            <div className="space-y-6">
              <div className={`p-5 rounded-3xl ${isDark ? 'bg-[#0f172a] text-white' : 'bg-white border border-gray-200 text-gray-900'} space-y-4`}>
                <h3 className="font-bold text-sm flex items-center gap-1.5"><Sliders className="w-4 h-4 text-blue-500" /> Category Taxonomy editor</h3>
                <div className="flex gap-2 text-xs">
                  <input
                    placeholder="Category"
                    value={newCat.name}
                    onChange={e => setNewCat(prev => ({ ...prev, name: e.target.value }))}
                    className={`p-2 rounded-xl border outline-none ${isDark ? 'bg-[#1e293b] border-gray-800 text-white' : 'bg-white border-gray-200'}`}
                  />
                  <input
                    placeholder="Sub-Category"
                    value={newCat.subcategory}
                    onChange={e => setNewCat(prev => ({ ...prev, subcategory: e.target.value }))}
                    className={`p-2 rounded-xl border outline-none ${isDark ? 'bg-[#1e293b] border-gray-800 text-white' : 'bg-white border-gray-200'}`}
                  />
                  <button onClick={handleAddCat} className="px-3 py-2 rounded-xl bg-blue-600 text-white font-bold"><Plus className="w-3.5 h-3.5 inline mr-1" /> Add Mapping</button>
                </div>

                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b dark:border-gray-800 text-gray-500 uppercase font-bold">
                        <th className="py-2">Category</th>
                        <th className="py-2">Sub-Category</th>
                        <th className="py-2">Team</th>
                        <th className="py-2">Freeze status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-800">
                      {categories.map(c => (
                        <tr key={c.id}>
                          <td className="py-3 font-semibold text-blue-500">{c.name}</td>
                          <td className="py-3 font-medium">{c.subcategory}</td>
                          <td className={`py-3 ${isDark ? 'text-gray-300' : 'text-gray-505'} font-semibold`}>{c.team}</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.frozen ? 'bg-slate-100 text-slate-500' : 'bg-green-100 text-green-700'}`}>
                              {c.frozen ? '🔒 Frozen / Labeling' : '✏️ Open'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── VIEW: SLA Policies ─────────────────────────────────── */}
          {activeTab === 'SLA Policies' && (
            <div className={`p-6 rounded-3xl ${isDark ? 'bg-[#0f172a] text-white' : 'bg-white border border-gray-200 text-gray-900'} space-y-4`}>
              <h2 className="text-lg font-bold">SLA Policy Editor</h2>
              <div className="divide-y dark:divide-gray-805 text-xs">
                {slaPolicies.map(p => (
                  <div key={p.id} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-blue-500 text-sm">{p.priority} Priority Policy</p>
                      <p className="text-gray-400">Response: {p.response} | Resolution: {p.resolution} (Calendar: {p.calendar})</p>
                    </div>
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-gray-800 rounded font-bold text-[10px]">Active</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── VIEW: AI Assistant ─────────────────────────────────── */}
          {activeTab === 'AI Assistant' && (
            <div className={`p-6 rounded-3xl ${isDark ? 'bg-[#0f172a] text-white' : 'bg-white border border-gray-200 text-gray-900'} space-y-4 max-w-[800px] mx-auto`}>
              <h2 className="text-lg font-bold">AI Administrator Assistant</h2>
              
              <div className={`border rounded-2xl p-4 h-[380px] overflow-y-auto space-y-3 text-xs font-semibold ${
                isDark ? 'border-gray-850 bg-slate-900/50' : 'border-gray-200 bg-slate-50/50'
              }`}>
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-2.5 max-w-[80%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-600 text-white font-extrabold">{msg.role === 'user' ? 'U' : 'AI'}</div>
                    <div className={`p-3 rounded-2xl ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-tl-none border dark:border-gray-850'}`}>
                      <p>{msg.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendChat} className="flex gap-2 text-xs">
                <input
                  placeholder="Ask a question..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  className={`p-3 rounded-xl border outline-none flex-1 ${
                    isDark ? 'bg-[#1e293b] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'
                  }`}
                />
                <button type="submit" className="px-4 py-3 rounded-xl bg-blue-600 text-white font-bold">Query</button>
              </form>
            </div>
          )}

          {/* ─── VIEW: Reports ──────────────────────────────────────── */}
          {activeTab === 'Reports' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-semibold">
                {/* Accuracy */}
                <div className={`p-5 rounded-3xl ${isDark ? 'bg-[#0f172a] text-white' : 'bg-white border border-gray-200 text-gray-900'} space-y-3`}>
                  <h3 className="font-bold text-sm flex items-center gap-1.5"><Activity className="w-4 h-4 text-blue-500" /> Model Accuracy Reports</h3>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="p-3.5 rounded-2xl bg-blue-105/5 text-center border dark:border-gray-800">
                      <p className="text-gray-400">Keyword Baseline</p>
                      <p className="text-xl font-bold text-slate-505 mt-1">68% accuracy</p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-green-105/5 text-center border dark:border-gray-800">
                      <p className="text-gray-400">Shipped Model</p>
                      <p className="text-xl font-bold text-green-500 mt-1">87% accuracy</p>
                    </div>
                  </div>
                </div>
                {/* Latency */}
                <div className={`p-5 rounded-3xl ${isDark ? 'bg-[#0f172a] text-white' : 'bg-white border border-gray-200 text-gray-900'} space-y-3`}>
                  <h3 className="font-bold text-sm flex items-center gap-1.5"><Clock className="w-4 h-4 text-emerald-500" /> Latency Pipeline delays</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between"><span>Fast-path:</span> <span className="text-green-500">82% (250ms)</span></div>
                    <div className="flex justify-between"><span>LLM fallback:</span> <span className="text-amber-500">18% (2200ms)</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── VIEW: Knowledge Base ───────────────────────────────── */}
          {activeTab === 'Knowledge Base' && (
            <div className={`p-6 rounded-3xl ${isDark ? 'bg-[#0f172a] text-white' : 'bg-white border border-gray-200 text-gray-900'} space-y-4`}>
              <h2 className="text-lg font-bold">Knowledge Base Article Repository</h2>
              <div className="space-y-3 text-xs font-semibold">
                {[
                  { title: 'VPN authentication troubleshooting key', content: 'Ensure proxy credentials match Okta Active Directory tokens.' }
                ].map((item, idx) => (
                  <div key={idx} className={`p-4 border rounded-2xl ${
                    isDark ? 'border-gray-800 bg-[#1e293b]' : 'border-gray-200 bg-slate-50/20'
                  }`}>
                    <p className="font-bold text-blue-500">{item.title}</p>
                    <p className="text-gray-400 font-medium mt-1">{item.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── VIEW: Users (Matching mockup Users layout) ─────────── */}
          {activeTab === 'Users' && (
            <div className={`p-6 rounded-3xl ${isDark ? 'bg-[#0f172a] text-white' : 'bg-white border border-gray-200 text-gray-900'} space-y-4`}>
              <h2 className="text-lg font-bold">Users</h2>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-semibold">
                  <thead>
                    <tr className="border-b dark:border-[#1e293b] text-gray-455 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-3.5">USER</th>
                      <th className="py-3.5 text-center">ROLE</th>
                      <th className="py-3.5 text-right pr-4">TICKETS ASSIGNED</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'} font-bold`}>
                    {adminUsers.map(usr => (
                      <tr key={usr.email} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors`}>
                        <td className="py-4 flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${usr.avatarColor} flex items-center justify-center text-white text-[12px] font-extrabold`}>
                            {usr.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-[12px] font-bold leading-tight">{usr.name}</p>
                            <p className="text-[10px] text-gray-455 font-normal mt-0.5">{usr.email}</p>
                          </div>
                        </td>
                        <td className="py-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                            usr.role === 'Admin' 
                              ? 'bg-blue-105 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' 
                              : 'bg-slate-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                          }`}>
                            {usr.role}
                          </span>
                        </td>
                        <td className={`py-4 text-right pr-4 font-mono text-[12px] ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                          {usr.assigned}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── VIEW: Settings CRUD ────────────────────────────────── */}
          {activeTab === 'Settings' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs font-semibold">
                {/* Dept CRUD */}
                <div className={`p-5 rounded-3xl ${isDark ? 'bg-[#0f172a] text-white' : 'bg-white border border-gray-200 text-gray-900'} space-y-4`}>
                  <h3 className="font-bold text-sm flex items-center gap-1.5">Departments settings</h3>
                  <div className="flex gap-2">
                    <input
                      placeholder="Name"
                      value={newDept.name}
                      onChange={e => setNewDept(prev => ({ ...prev, name: e.target.value }))}
                      className={`p-2 rounded-xl border outline-none ${isDark ? 'bg-[#1e293b] border-gray-800 text-white' : 'bg-white border-gray-200'}`}
                    />
                    <input
                      placeholder="Code"
                      value={newDept.code}
                      onChange={e => setNewDept(prev => ({ ...prev, code: e.target.value }))}
                      className={`p-2 rounded-xl border outline-none w-16 ${isDark ? 'bg-[#1e293b] border-gray-800 text-white' : 'bg-white border-gray-200'}`}
                    />
                    <button onClick={handleAddDept} className="px-3 py-2 rounded-xl bg-blue-600 text-white font-bold">Add</button>
                  </div>
                  <div className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                    {departments.map(d => (
                      <div key={d.id} className="py-2 flex justify-between">
                        <span>{d.name} ({d.code})</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sites CRUD */}
                <div className={`p-5 rounded-3xl ${isDark ? 'bg-[#0f172a] text-white' : 'bg-white border border-gray-200 text-gray-900'} space-y-4`}>
                  <h3 className="font-bold text-sm flex items-center gap-1.5">Sites settings</h3>
                  <div className="flex gap-2">
                    <input
                      placeholder="Site Name"
                      value={newSite.name}
                      onChange={e => setNewSite(prev => ({ ...prev, name: e.target.value }))}
                      className={`p-2 rounded-xl border outline-none ${isDark ? 'bg-[#1e293b] border-gray-800 text-white' : 'bg-white border-gray-200'}`}
                    />
                    <button onClick={handleAddSite} className="px-3 py-2 rounded-xl bg-blue-600 text-white font-bold">Add</button>
                  </div>
                  <div className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                    {sites.map(s => (
                      <div key={s.id} className="py-2 flex justify-between">
                        <span>{s.name}</span>
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
