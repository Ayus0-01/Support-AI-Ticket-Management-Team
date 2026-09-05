import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api from "../api";

interface User {
  name: string;
  email: string;
  username: string;
  mobile?: string;
  role: "User" | "Agent" | "Admin";
  avatar: string;
}

export type Capability =
  | "VIEW_DASHBOARD"
  | "CREATE_TICKET"
  | "VIEW_OWN_TICKETS"
  | "VIEW_OWN_TIMELINE"
  | "VIEW_OWN_RESOLUTION"
  | "VIEW_AGENT_QUEUE"
  | "VIEW_AGENT_TICKET"
  | "VIEW_CLASSIFICATION"
  | "OVERRIDE_CLASSIFICATION"
  | "ADD_INTERNAL_COMMENT"
  | "CHANGE_TICKET_STATUS"
  | "RESOLVE_TICKET"
  | "VIEW_ALL_TICKETS"
  | "MANAGE_USERS"
  | "VIEW_REPORTS"
  | "ADMIN_SETTINGS";

const ROLE_CAPABILITIES: Record<
  User["role"],
  Capability[]
> = {
  User: [
    "VIEW_DASHBOARD",
    "CREATE_TICKET",
    "VIEW_OWN_TICKETS",
    "VIEW_OWN_TIMELINE",
    "VIEW_OWN_RESOLUTION",
  ],

  Agent: [
    "VIEW_DASHBOARD",
    "VIEW_AGENT_QUEUE",
    "VIEW_AGENT_TICKET",
    "VIEW_CLASSIFICATION",
    "OVERRIDE_CLASSIFICATION",
    "ADD_INTERNAL_COMMENT",
    "CHANGE_TICKET_STATUS",
    "RESOLVE_TICKET",
  ],

  Admin: [
    "VIEW_DASHBOARD",
    "VIEW_AGENT_QUEUE",
    "VIEW_AGENT_TICKET",
    "VIEW_CLASSIFICATION",
    "OVERRIDE_CLASSIFICATION",
    "ADD_INTERNAL_COMMENT",
    "CHANGE_TICKET_STATUS",
    "RESOLVE_TICKET",
    "VIEW_ALL_TICKETS",
    "MANAGE_USERS",
    "VIEW_REPORTS",
    "ADMIN_SETTINGS",
  ],
};

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  signIn: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  signOut: () => void;
  register: (
    username: string,
    email: string,
    password: string,
    mobile: string,
    role: "User" | "Agent" | "Admin"
  ) => Promise<{ success: boolean; message?: string }>;
  can: (capability: Capability) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  authLoading: true,

  signIn: async (
    _username: string,
    _password: string
  ): Promise<{ success: boolean; message?: string }> => {
    return { success: false };
  },

  signOut: () => {},

  register: async (
  _username: string,
  _email: string,
  _password: string,
  _mobile: string,
  _role: "User" | "Agent" | "Admin"
): Promise<{ success: boolean; message?: string }> => {
  return { success: false };
},
  can: () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const can = (
    capability: Capability
): boolean => {
  if (!user) {
    return false;
  }

  return ROLE_CAPABILITIES[user.role].includes(
    capability
  );
};

  useEffect(() => {
  const checkAuth = async () => {
    const token = localStorage.getItem("access");

    try {
      if (token && !user) {
        const meResponse = await api.get("/api/auth/me/");
        const meData = meResponse.data;

        setUser({
          name: meData.username,
          username: meData.username,
          email: meData.email,
          mobile: meData.mobile,
          role: meData.role,
          avatar: meData.username.charAt(0).toUpperCase(),
        });
      }
    } catch (err) {
      console.error("Auto auth check failed:", err);
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
    } finally {
      setAuthLoading(false);
    }
  };

  checkAuth();
}, []);

  const signIn = async (
    username: string,
    password: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      // 1. Login and get JWT tokens
      const response = await api.post("/api/auth/login/", {
        email: username,
        password: password,
      });

      // Axios stores the response body inside response.data
      const data = response.data;

      // 2. Save JWT tokens
      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);

      // 3. Ask backend who is currently logged in
      const meResponse = await api.get("/api/auth/me/");
      const meData = meResponse.data;

      // 4. Store user information in React state
      setUser({
        name: meData.username,
        username: meData.username,
        email: meData.email,
        mobile: meData.mobile,
        role: meData.role,
        avatar: meData.username.charAt(0).toUpperCase(),
      });

      return { success: true };

    } catch (error: any) {
      console.error("LOGIN ERROR:", error);
      let message = "Invalid email or password.";
      if (error.response?.data?.message) {
        message = error.response.data.message;
      }
      return { success: false, message };
    }
  };

  const register = async (
    username: string,
    email: string,
    password: string,
    mobile: string,
    role: "User" | "Agent" | "Admin"
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await api.post("/api/auth/register/", {
        username,
        email,
        password,
        mobile,
        role,
      });

      const data = response.data;

      // Save the JWT tokens returned by registration
      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);

      // Get the newly registered user's information
      const meResponse = await api.get("/api/auth/me/");
      const meData = meResponse.data;

      setUser({
        name: meData.username,
        username: meData.username,
        email: meData.email,
        mobile: meData.mobile,
        role: meData.role,
        avatar: meData.username.charAt(0).toUpperCase(),
      });

      return { success: true };
    } catch (error: any) {
      console.error("REGISTER ERROR:", error);
      let message = "Registration failed.";
      if (error.response?.data) {
        if (error.response.data.message) {
          message = error.response.data.message;
        } else if (typeof error.response.data === "object") {
          const keys = Object.keys(error.response.data);
          if (keys.length > 0) {
            const firstKey = keys[0];
            const firstErr = error.response.data[firstKey];
            message = Array.isArray(firstErr) ? `${firstKey}: ${firstErr[0]}` : String(firstErr);
          }
        }
      }
      return { success: false, message };
    }
  };

  const signOut = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        authLoading,
        can,
        signIn,
        signOut,
        register,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);