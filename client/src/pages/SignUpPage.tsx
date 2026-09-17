import { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

interface SignUpPageProps {
  onNavigate: (page: string) => void;
}

export default function SignUpPage({ onNavigate }: SignUpPageProps) {
  const { isDark } = useTheme();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill all required fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    const res = await register(
      name,
      email,
      password,
      mobile
    );

    setLoading(false);

    if (res.success) {
      onNavigate('dashboard:My Tickets');
    } else {
      setError(
        res.message || 'Registration failed. Please try again.'
      );
    }
  };

  const inputClass = `
    w-full rounded-xl border px-4 py-3
    outline-none transition-all
    focus:ring-2 focus:ring-blue-500/30
    ${
      isDark
        ? 'bg-slate-900/80 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500'
        : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500'
    }
  `;

  const labelClass = `
    block text-sm font-semibold mb-2
    ${isDark ? 'text-gray-200' : 'text-gray-700'}
  `;

  return (
    <div
      className={`min-h-screen flex items-center justify-center px-4 py-8 ${
        isDark
          ? 'bg-[#050914]'
          : 'bg-gradient-to-br from-blue-50 via-white to-indigo-50'
      }`}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className={`absolute -top-32 -right-32 w-96 h-96 rounded-full blur-3xl ${
            isDark ? 'bg-blue-600/10' : 'bg-blue-400/20'
          }`}
        />

        <div
          className={`absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl ${
            isDark ? 'bg-indigo-600/10' : 'bg-indigo-400/20'
          }`}
        />
      </div>

      {/* Main card */}
      <div
        className={`relative w-full max-w-xl rounded-3xl border shadow-2xl p-7 sm:p-9 ${
          isDark
            ? 'bg-slate-950/90 border-slate-800 shadow-black/30'
            : 'bg-white/95 border-gray-200 shadow-blue-100/50'
        }`}
      >
        {/* Back */}
        <button
          type="button"
          onClick={() => onNavigate('signin')}
          className={`inline-flex items-center gap-2 mb-7 text-sm font-medium transition-colors ${
            isDark
              ? 'text-gray-300 hover:text-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <span className="text-lg">←</span>
          Back to sign in
        </button>

        {/* Logo / Brand */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
            <span className="text-white text-xl font-bold">A</span>
          </div>

          <div>
            <h2
              className={`font-bold text-lg ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              AITicketPilot
            </h2>

            <p
              className={`text-[10px] tracking-widest ${
                isDark ? 'text-gray-500' : 'text-gray-500'
              }`}
            >
              SMARTER SUPPORT. FASTER RESOLUTION.
            </p>
          </div>
        </div>

        {/* Heading */}
        <div className="mb-7">
          <h1
            className={`text-3xl font-bold tracking-tight ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            Create your account
          </h1>

          <p
            className={`mt-2 text-sm ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            Enter your details to create your AITicketPilot account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Username */}
          <div>
            <label className={labelClass}>
              Username <span className="text-red-500">*</span>
            </label>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Enter your username"
            />
          </div>

          {/* Email */}
          <div>
            <label className={labelClass}>
              Email <span className="text-red-500">*</span>
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="Enter your email"
            />
          </div>

          {/* Mobile */}
          <div>
            <label className={labelClass}>
              Mobile number{' '}
              <span
                className={
                  isDark ? 'text-gray-500' : 'text-gray-400'
                }
              >
                (optional)
              </span>
            </label>

            <input
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className={inputClass}
              placeholder="Enter your mobile number"
            />
          </div>

          {/* Password */}
          <div>
            <label className={labelClass}>
              Password <span className="text-red-500">*</span>
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="Create a password"
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className={labelClass}>
              Confirm password <span className="text-red-500">*</span>
            </label>

            <input
              type="password"
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(e.target.value)
              }
              className={inputClass}
              placeholder="Confirm your password"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-between gap-4 pt-2">

            <button
              type="button"
              onClick={() => onNavigate('signin')}
              className={`px-5 py-3 rounded-xl border font-medium transition-all ${
                isDark
                  ? 'border-slate-700 text-gray-300 hover:bg-slate-800 hover:text-white'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            >
              Back
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex-1 max-w-[220px] px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-600/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create account'}
            </button>

          </div>
        </form>

        {/* Footer */}
        <p
          className={`text-center text-xs mt-7 ${
            isDark ? 'text-gray-500' : 'text-gray-500'
          }`}
        >
          By creating an account, you agree to use the
          support workspace responsibly.
        </p>
      </div>
    </div>
  );
}