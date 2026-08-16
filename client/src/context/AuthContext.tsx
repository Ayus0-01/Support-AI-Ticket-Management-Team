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

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  signIn: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  signOut: () => void;
  register: (
    username: string,
    email: string,
    password: string,
    mobile: string,
    role: "User" | "Agent" | "Admin"
  ) => Promise<{ success: boolean; message?: string }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,

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
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("access");
      if (token && !user) {
        try {
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
        } catch (err) {
          console.error("Auto auth check failed:", err);
          localStorage.removeItem("access");
          localStorage.removeItem("refresh");
        }
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
      if (error.response) {
        if (error.response.data?.message) {
          message = error.response.data.message;
        } else if (error.response.data?.email) {
          message = Array.isArray(error.response.data.email) ? error.response.data.email[0] : String(error.response.data.email);
        } else if (error.response.status === 500) {
          message = "Internal Server Error (500) from backend.";
        }
      } else {
        message = "Unable to connect to the backend server. Please verify it is running on port 8000.";
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