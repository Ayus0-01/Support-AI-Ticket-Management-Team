import { useState, useEffect } from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import LandingPage from '@/pages/LandingPage';
import SignInPage from '@/pages/SignInPage';
import SignUpPage from '@/pages/SignUpPage';
import UserDashboard from '@/pages/user/UserDashboard';
import AgentDashboard from '@/pages/agent/AgentDashboard';
import AdminDashboard from '@/pages/admin/AdminDashboard';

type Page = 'home' | 'signin' | 'signup' | 'dashboard' | 'agent-dashboard' | 'admin-dashboard';

function AppContent() {
  const [page, setPage] = useState<Page>('home');
  const { isAuthenticated, user } = useAuth();
  const [dashboardActive, setDashboardActive] = useState<string | undefined>(undefined);

  const navigate = (p: string) => {
    // allow target formats like 'dashboard:My Tickets' to open dashboard on a specific subpage
    if (p.startsWith('dashboard:')) {
      const [, sub] = p.split(':');
      if (!isAuthenticated) {
        // if not authenticated, go to signin and remember desired subpage
        setPage('signin');
        setDashboardActive(sub);
        return;
      }
      setDashboardActive(sub);
      
      if (user?.role === 'Admin') {
        setPage('admin-dashboard');
      } else if (user?.role === 'Agent') {
        setPage('agent-dashboard');
      } else {
        setPage('dashboard');
      }
      return;
    }

    if (p === 'dashboard') {
      if (!isAuthenticated) {
        setPage('signin');
        setDashboardActive(undefined);
        return;
      }
      if (user?.role === 'Admin') {
        setPage('admin-dashboard');
      } else if (user?.role === 'Agent') {
        setPage('agent-dashboard');
      } else {
        setPage('dashboard');
      }
      return;
    }

    // navigating to other pages should clear any pending dashboard target
    setDashboardActive(undefined);
    setPage(p as Page);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      if (page === 'signin' || page === 'signup' || page === 'home') {
        if (user.role === 'Admin') {
          setPage('admin-dashboard');
        } else if (user.role === 'Agent') {
          setPage('agent-dashboard');
        } else {
          setPage('dashboard');
        }
      } else if (page === 'dashboard' && user.role === 'Admin') {
        setPage('admin-dashboard');
      } else if (page === 'dashboard' && user.role === 'Agent') {
        setPage('agent-dashboard');
      } else if (page === 'agent-dashboard' && user.role === 'Admin') {
        setPage('admin-dashboard');
      } else if (page === 'agent-dashboard' && user.role === 'User') {
        setPage('dashboard');
      } else if (page === 'admin-dashboard' && user.role !== 'Admin') {
        setPage(user.role === 'Agent' ? 'agent-dashboard' : 'dashboard');
      }
    } else {
      if (page === 'dashboard' || page === 'agent-dashboard' || page === 'admin-dashboard') {
        setPage('signin');
      }
    }
  }, [isAuthenticated, user, page]);

  if (page === 'signin') {
    return <SignInPage onNavigate={navigate} />;
  }
  if (page === 'signup') {
    return <SignUpPage onNavigate={navigate} />;
  }
  if (page === 'dashboard') {
    return <UserDashboard onNavigate={navigate} initialTab={dashboardActive as any} />;
  }
  if (page === 'agent-dashboard') {
    return <AgentDashboard onNavigate={navigate} />;
  }
  if (page === 'admin-dashboard') {
    return <AdminDashboard onNavigate={navigate} />;
  }
  return (
    <>
      <Navbar onNavigate={navigate} />
      <LandingPage onNavigate={navigate} />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}