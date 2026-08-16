import { useState, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { Bot, Sun, Moon, ArrowLeft, Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles } from 'lucide-react';

interface SignInPageProps {
  onNavigate: (page: string) => void;
}

const REMEMBER_KEY = 'aiticket_remember';

export default function SignInPage({ onNavigate }: SignInPageProps) {
  const { isDark, toggleTheme } = useTheme();
  const { signIn } = useAuth();

  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(REMEMBER_KEY) ?? 'null'); } catch { return null; }
  })();

  const [email, setEmail] = useState<string>(saved?.email ?? '');
  const [password, setPassword] = useState<string>(saved?.password ?? '');
  const [showPw, setShowPw]     = useState(false);
  const [remember, setRemember] = useState<boolean>(!!saved);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);


  /* Keep saved state in sync when remember toggle changes */
  useEffect(() => {
    if (!remember) localStorage.removeItem(REMEMBER_KEY);
  }, [remember]);

  const attemptSignIn = async (usr: string, pw: string) => {
    setError("");
    setLoading(true);

    try {
      const res = await signIn(usr, pw);
      setLoading(false);

      if (res.success) {
        onNavigate("dashboard");
      } else {
        setError(res.message || "Invalid email or password.");
      }
    } catch (error) {
      setLoading(false);
      setError("Unable to connect to the server.");
      console.error(error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    attemptSignIn(email, password);
  };

  const handleGoogle = () => {
    setGoogleLoading(true);
    setTimeout(async () => {
      const ok = await signIn('lakshmipriya', 'Lakshmi@123');
      setGoogleLoading(false);
      if (ok.success) {
        if (remember) localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email: 'lakshmipriya', password: 'Lakshmi@123' }));
        onNavigate('dashboard');
      } else {
        setError(ok.message || "Google Sign-In failed.");
      }
    }, 900);
  };

  return (
    <div className={`min-h-screen flex ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>

      {/* ── Left brand panel ──────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative p-12 flex-col justify-between overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/login.jpg')" }}
        />
        <div className="absolute inset-0 bg-[rgba(255,255,255,0.18)] backdrop-blur-[1px]" />

        <div className="relative z-10">
          <button onClick={() => onNavigate('home')} className="flex items-center gap-2 text-slate-800">
            <img src="/images/logo.png" alt="AITicketPilot logo" className="h-10 w-10 object-contain shrink-0" />
            <div>
              <p className="font-bold text-base leading-tight text-slate-800">AITicketPilot</p>
              <p className="text-[9px] font-semibold tracking-widest uppercase text-slate-600 opacity-90">Smarter Support. Faster Resolution.</p>
            </div>
          </button>
        </div>

        <div className="relative z-10 text-slate-800 max-w-[700px]">
          <Sparkles className="w-10 h-10 mb-6 text-slate-700 opacity-80" />
          <h2 className="text-4xl font-bold leading-tight text-slate-800 drop-shadow-sm">Resolve tickets faster with your AI copilot.</h2>
          <p className="mt-4 text-slate-700 text-lg drop-shadow-sm">Smart routing, instant replies, and live analytics — all in one workspace.</p>
          <div className="mt-10 space-y-4">
            {['AI-powered ticket routing', 'Instant suggested replies', 'Real-time support analytics'].map(t => (
              <div key={t} className="flex items-center gap-3 text-slate-700 font-semibold">
                <ShieldCheck className="w-5 h-5 shrink-0 text-slate-600" />
                <span className="text-sm">{t}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-slate-600 text-xs font-semibold drop-shadow-sm">© 2026 AITicketPilot. All rights reserved.</p>
      </div>

      {/* ── Right form panel ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col">
        {/* Top row */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <button
            onClick={() => onNavigate('home')}
            className={`flex items-center gap-1.5 text-sm font-medium ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <ArrowLeft className="w-4 h-4" /> Back to home
          </button>
          <button onClick={toggleTheme} className={`p-2 rounded-lg ${isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100'}`}>
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md">

            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-2 mb-8">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <span className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>AITicketPilot</span>
            </div>

            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Welcome back</h1>
            <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Sign in to your support workspace.</p>

            {/* Google sign-in */}
            <button
              onClick={handleGoogle}
              disabled={googleLoading}
              className={`mt-6 w-full flex items-center justify-center gap-3 py-3 rounded-xl border text-sm font-semibold transition-all ${isDark ? 'border-gray-700 text-gray-200 hover:bg-gray-800 bg-gray-900' : 'border-gray-200 text-gray-700 hover:bg-gray-50 bg-white'} disabled:opacity-60`}
            >
              {/* Google "G" SVG */}
              <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {googleLoading ? 'Signing in with Google...' : 'Continue with Google'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className={`flex-1 h-px ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
              <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>or sign in with email</span>
              <div className={`flex-1 h-px ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Email address / Username</label>
                <div className="relative">
                  <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                  <input
                    type="text"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com or username"
                    className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm outline-none transition-colors focus:border-blue-500 ${isDark ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-600' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Password</label>
                  <a href="#" className="text-xs font-medium text-blue-600 hover:text-blue-700">Forgot password?</a>
                </div>
                <div className="relative">
                  <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full pl-10 pr-10 py-3 rounded-xl border text-sm outline-none transition-colors focus:border-blue-500 ${isDark ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-600' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`}
                    required
                  />
                  <button type="button" onClick={() => setShowPw(p => !p)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setRemember(r => !r)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${remember ? 'bg-blue-600 border-blue-600' : isDark ? 'border-gray-600 bg-transparent' : 'border-gray-300 bg-white'}`}
                >
                  {remember && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
                <span className={`text-sm select-none cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`} onClick={() => setRemember(r => !r)}>
                  Remember me — save my password on this device
                </span>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                    </svg>
                    Signing in...
                  </>
                ) : 'Sign In'}
              </button>
            </form>

            <p className={`mt-6 text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Don't have an account?{' '}
              <button onClick={() => onNavigate('signup')} className="font-semibold text-blue-600 hover:text-blue-700"> Get started free </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
