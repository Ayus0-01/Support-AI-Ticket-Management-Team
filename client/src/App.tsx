import { useState, useEffect } from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import LandingPage from '@/pages/LandingPage';
import SignInPage from '@/pages/SignInPage';
import SignUpPage from '@/pages/SignUpPage';
import UserDashboard from '@/pages/UserDashboard';
import AgentDashboard from '@/pages/AgentDashboard';
import AdminDashboard from '@/pages/AdminDashboard';
import SupportManagerDashboard from '@/pages/SupportManagerDashboard';
import type { NavPage } from '@/pages/Dashboard';

type Page = 'home' | 'signin' | 'signup' | 'dashboard';

const NAV_PAGES: NavPage[] = [
  'Dashboard',
  'My queue',
  'My Tickets',
  'Create Ticket',
  'Reports',
  'Knowledge Base',
  'Users',
  'Settings',
  'Taxonomy',
  'SLA policies',
  'Agent Assignment',
  'Escalations',
  'SLA Management',
  'Agent Performance',
  'AI Performance',
  'Notifications',
  'Profile',
];

function isNavPage(page: string | null): page is NavPage {
  return page !== null && NAV_PAGES.includes(page as NavPage);
}

function AppContent() {
  const [page, setPage] = useState<Page>(() => {
    return (sessionStorage.getItem("page") as Page) || "home";
  });

  const {
    isAuthenticated,
    user,
    authLoading
  } = useAuth();

  const [dashboardActive, setDashboardActive] = useState<NavPage | undefined>(
    () => {
      const savedPage = sessionStorage.getItem("dashboardActive");

      return isNavPage(savedPage) ? savedPage : undefined;
    }
  );
  useEffect(() => {
    sessionStorage.setItem("page", page);

    if (dashboardActive) {
      sessionStorage.setItem(
        "dashboardActive",
        dashboardActive
      );
    } else if (page !== 'dashboard') {
      sessionStorage.removeItem("dashboardActive");
    }
  }, [page, dashboardActive]);

  const navigate = (p: string) => {
    if (p.startsWith('dashboard:')) {
      const [, sub] = p.split(':');

      const validSub = sub && isNavPage(sub)
        ? sub
        : undefined;

      if (!isAuthenticated) {
        setPage('signin');
        setDashboardActive(validSub);
        return;
      }

  setDashboardActive(validSub);
  setPage('dashboard');
  return;
}

    if (p === 'dashboard') {
      if (!isAuthenticated) {
        setPage('signin');
        setDashboardActive(undefined);
        return;
      }

      setDashboardActive(undefined);
      setPage('dashboard');
      return;
    }

    setDashboardActive(undefined);
    setPage(p as Page);

    window.scrollTo(0, 0);
  };

  useEffect(() => {
    if (
      !authLoading &&
      page === 'dashboard'
      && !isAuthenticated
    ) {
      setPage('signin');
    }
  }, [
    authLoading,
    isAuthenticated,
    page,
  ]);

  if (authLoading) {
  return null;
  }

  if (page === 'signin') {
    return (
      <SignInPage
        onNavigate={navigate}
      />
    );
  }

  if (page === 'signup') {
    return (
      <SignUpPage
        onNavigate={navigate}
      />
    );
  }

  if (page === 'dashboard') {
    if (!user) {
      return null;
    }

    if (user.role === 'Support Manager' || user.role === 'Manager') {
      return (
        <SupportManagerDashboard
          onNavigate={navigate}
          initialPage={dashboardActive}
        />
      );
    }

    if (user.role === 'Agent') {
      return (
        <AgentDashboard
          onNavigate={navigate}
          initialPage={dashboardActive}
        />
      );
    }

    if (user.role === 'Admin') {
      return (
        <AdminDashboard
          onNavigate={navigate}
          initialPage={dashboardActive}
        />
      );
    }

    return (
      <UserDashboard
        onNavigate={navigate}
        initialPage={dashboardActive}
      />
    );
  }

  return (
    <>
      <Navbar onNavigate={navigate} />

      <LandingPage
        onNavigate={navigate}
      />
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
