import { useState, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { User, UserCheck, ShieldCheck } from 'lucide-react';

interface SignUpPageProps {
  onNavigate: (page: string) => void;
}

export default function SignUpPage({ onNavigate }: SignUpPageProps) {
  const { isDark } = useTheme();
  const { register, isAuthenticated } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [role, setRole] = useState<'User'|'Agent'|'Admin'>('User');
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
    mobile,
    role
  );
  setLoading(false);
  if (res.success) {
    onNavigate('dashboard:My Tickets');
  } else {
    setError(res.message || 'Registration failed. Please try again.');
  }
};

  return (
  <div className={`min-h-screen flex ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
    <div className="w-full max-w-md mx-auto p-6">

      <h1
        className={`text-2xl font-bold ${
          isDark ? 'text-white' : 'text-gray-900'
        }`}
      >
        Create your account
      </h1>

      <p
        className={`mt-1 text-sm ${
          isDark ? 'text-gray-400' : 'text-gray-600'
        }`}
      >
        Enter your details to create your account.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">

        {/* Username */}
        <div>
          <label
            className={`block text-sm font-medium mb-1.5 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            Username
          </label>

          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full rounded-xl border px-3 py-2"
            placeholder="Enter your username"
          />
        </div>

        {/* Email */}
        <div>
          <label
            className={`block text-sm font-medium mb-1.5 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            Email
          </label>

          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full rounded-xl border px-3 py-2"
            placeholder="Enter your email"
          />
        </div>

        {/* Mobile - Optional */}
        <div>
          <label
            className={`block text-sm font-medium mb-1.5 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            Mobile number{' '}
            <span className="text-gray-400">(optional)</span>
          </label>

          <input
            value={mobile}
            onChange={e => setMobile(e.target.value)}
            className="w-full rounded-xl border px-3 py-2"
            placeholder="Enter your mobile number"
          />
        </div>

        {/* Role */}
        <div>
          <label
            className={`block text-sm font-medium mb-1.5 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            Account type
          </label>

          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setRole('User')}
              className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-xl border transition-all ${
                role === 'User'
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm font-semibold'
                  : isDark
                  ? 'border-gray-800 bg-gray-900/40 hover:bg-gray-800 text-gray-300'
                  : 'border-gray-250 bg-slate-50 hover:bg-slate-100 text-gray-600'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>User</span>
            </button>
            <button
              type="button"
              onClick={() => setRole('Agent')}
              className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-xl border transition-all ${
                role === 'Agent'
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm font-semibold'
                  : isDark
                  ? 'border-gray-800 bg-gray-900/40 hover:bg-gray-800 text-gray-300'
                  : 'border-gray-250 bg-slate-50 hover:bg-slate-100 text-gray-600'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Agent</span>
            </button>
            <button
              type="button"
              onClick={() => setRole('Admin')}
              className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-xl border transition-all ${
                role === 'Admin'
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm font-semibold'
                  : isDark
                  ? 'border-gray-800 bg-gray-900/40 hover:bg-gray-800 text-gray-300'
                  : 'border-gray-250 bg-slate-50 hover:bg-slate-100 text-gray-600'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          </div>
        </div>

        {/* Password */}
        <div>
          <label
            className={`block text-sm font-medium mb-1.5 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            Password
          </label>

          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full rounded-xl border px-3 py-2"
            placeholder="Create a password"
          />
        </div>

        {/* Confirm Password */}
        <div>
          <label
            className={`block text-sm font-medium mb-1.5 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            Confirm password
          </label>

          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border px-3 py-2"
            placeholder="Confirm your password"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center justify-between gap-3">

          <button
            type="button"
            onClick={() => onNavigate('signin')}
            className="px-4 py-2 rounded-xl border"
          >
            Back
          </button>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white"
          >
            {loading ? 'Creating...' : 'Create account'}
          </button>

        </div>

      </form>

    </div>
  </div>
);
}
