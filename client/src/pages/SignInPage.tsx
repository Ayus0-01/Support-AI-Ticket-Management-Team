import { useState, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import {
  Bot,
  Sun,
  Moon,
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface SignInPageProps {
  onNavigate: (page: string) => void;
}

const REMEMBER_KEY = 'aiticket_remember';

export default function SignInPage({ onNavigate }: SignInPageProps) {
  const { isDark, toggleTheme } = useTheme();
  const { signIn, isAuthenticated } = useAuth();

  const saved = (() => {
    try {
      return JSON.parse(
        localStorage.getItem(REMEMBER_KEY) ?? 'null'
      );
    } catch {
      return null;
    }
  })();

  const [email, setEmail] = useState<string>(saved?.email ?? '');
  const [password, setPassword] = useState<string>(
    saved?.password ?? ''
  );
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState<boolean>(!!saved);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shouldNavigateToDashboard, setShouldNavigateToDashboard] =
    useState(false);

  useEffect(() => {
    if (!remember) {
      localStorage.removeItem(REMEMBER_KEY);
    }
  }, [remember]);

  useEffect(() => {
    if (shouldNavigateToDashboard && isAuthenticated) {
      setShouldNavigateToDashboard(false);
      onNavigate('dashboard');
    }
  }, [
    isAuthenticated,
    onNavigate,
    shouldNavigateToDashboard,
  ]);

  const attemptSignIn = async (usr: string, pw: string) => {
    setError('');
    setLoading(true);

    try {
      const res = await signIn(usr, pw);

      setLoading(false);

      if (res.success) {
        if (remember) {
          localStorage.setItem(
            REMEMBER_KEY,
            JSON.stringify({
              email: usr,
              password: pw,
            })
          );
        }

        setShouldNavigateToDashboard(true);
      } else {
        setError(
          res.message || 'Invalid email or password.'
        );
      }
    } catch (error) {
      setLoading(false);
      setError('Unable to connect to the server.');
      console.error(error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    attemptSignIn(email, password);
  };

  return (
    <div
      className={`min-h-screen flex ${
        isDark ? 'bg-gray-950' : 'bg-gray-50'
      }`}
    >
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 relative p-12 flex-col justify-between overflow-hidden">

        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/images/login.jpg')",
          }}
        />

        {/* Dark contrast overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950/85 via-slate-950/65 to-gray-950/50 backdrop-blur-[1px]" />

        {/* Stronger overlay for text readability */}
        <div className="absolute inset-0 bg-black/45" />

        {/* Additional subtle gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/30" />

        {/* Brand */}
        <div className="relative z-10">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="inline-flex items-center gap-3 rounded-xl px-2 py-1.5 text-white transition-colors hover:bg-white/10"
          >
            <img
              src="/images/logo.png"
              alt="AITicketPilot logo"
              className="h-10 w-10 object-contain shrink-0"
            />

            <div className="text-left">
              <p className="font-bold text-base leading-tight text-white">
                AITicketPilot
              </p>

              <p className="text-[9px] font-semibold tracking-widest uppercase text-white/90">
                Smarter Support. Faster Resolution.
              </p>
            </div>
          </button>
        </div>

        {/* Marketing content */}
        <div className="relative z-10 text-white max-w-[650px]">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm mb-6">
            <Sparkles className="w-6 h-6 text-white" />
          </div>

          <h2 className="text-4xl font-bold leading-tight text-white drop-shadow-lg">
            Resolve tickets faster with your AI copilot.
          </h2>

          <p className="mt-4 text-white/90 text-lg leading-relaxed drop-shadow-md">
            Smart routing, instant replies, and live analytics — all in one workspace.
          </p>

          <div className="mt-10 space-y-4">
            {[
              'AI-powered ticket routing',
              'Instant suggested replies',
              'Real-time support analytics',
            ].map((text) => (
              <div
                key={text}
                className="flex items-center gap-3 text-white"
              >
                <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>

                <span className="text-sm font-medium drop-shadow-md">
                  {text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-white/80 text-xs">
          © 2026 AITicketPilot. All rights reserved.
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col">

        {/* Top navigation */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isDark
                ? 'text-gray-200 hover:text-white hover:bg-gray-800'
                : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            {isDark ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Login form */}
        <div className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md">

            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-2 mb-8">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>

              <span
                className={`font-bold text-lg ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                AITicketPilot
              </span>
            </div>

            {/* Heading */}
            <div className="mb-7">
              <h1
                className={`text-3xl font-bold tracking-tight ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                Welcome back
              </h1>

              <p
                className={`mt-2 text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                Sign in to your support workspace.
              </p>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >

              {/* Email */}
              <div>
                <label
                  className={`block text-sm font-semibold mb-2 ${
                    isDark
                      ? 'text-gray-200'
                      : 'text-gray-700'
                  }`}
                >
                  Email address
                </label>

                <div className="relative">
                  <Mail
                    className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${
                      isDark
                        ? 'text-gray-500'
                        : 'text-gray-400'
                    }`}
                  />

                  <input
                    type="email"
                    value={email}
                    onChange={(e) =>
                      setEmail(e.target.value)
                    }
                    placeholder="you@example.com"
                    className={`w-full pl-11 pr-4 py-3.5 rounded-xl border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                      isDark
                        ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-600'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    }`}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    className={`text-sm font-semibold ${
                      isDark
                        ? 'text-gray-200'
                        : 'text-gray-700'
                    }`}
                  >
                    Password
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setError(
                        'Password recovery is not available yet.'
                      );
                    }}
                    className="text-xs font-semibold text-blue-500 hover:text-blue-400 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>

                <div className="relative">
                  <Lock
                    className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${
                      isDark
                        ? 'text-gray-500'
                        : 'text-gray-400'
                    }`}
                  />

                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    placeholder="••••••••"
                    className={`w-full pl-11 pr-11 py-3.5 rounded-xl border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                      isDark
                        ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-600'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    }`}
                    required
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPw((previous) => !previous)
                    }
                    aria-label={
                      showPw
                        ? 'Hide password'
                        : 'Show password'
                    }
                    className={`absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors ${
                      isDark
                        ? 'text-gray-500 hover:text-gray-200'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {showPw ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    setRemember((previous) => !previous)
                  }
                  aria-label="Remember me"
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 ${
                    remember
                      ? 'bg-blue-600 border-blue-600'
                      : isDark
                        ? 'border-gray-600 bg-transparent'
                        : 'border-gray-300 bg-white'
                  }`}
                >
                  {remember && (
                    <svg
                      className="w-3 h-3 text-white"
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>

                <span
                  onClick={() =>
                    setRemember((previous) => !previous)
                  }
                  className={`text-sm select-none cursor-pointer ${
                    isDark
                      ? 'text-gray-300'
                      : 'text-gray-600'
                  }`}
                >
                  Remember me — save my password on this device
                </span>
              </div>

              {/* Error */}
              {error && (
                <div
                  className={`p-3.5 rounded-xl border text-sm ${
                    isDark
                      ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : 'bg-red-50 border-red-200 text-red-600'
                  }`}
                >
                  {error}
                </div>
              )}

              {/* Sign In */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />

                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>

                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Register */}
            <p
              className={`mt-7 text-center text-sm ${
                isDark
                  ? 'text-gray-400'
                  : 'text-gray-600'
              }`}
            >
              Don't have an account?{' '}

              <button
                type="button"
                onClick={() => onNavigate('signup')}
                className="font-semibold text-blue-600 hover:text-blue-500 transition-colors"
              >
                Get started free
              </button>
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}