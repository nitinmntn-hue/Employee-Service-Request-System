"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  loginUser,
  registerUser,
  getCurrentUser,
} from "@/services/auth.service";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    setUser(null);
  }, []);

  // Verify the saved session with the backend.
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      const token = localStorage.getItem("accessToken");

      if (!token) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const result = await getCurrentUser();

        if (!result?.success || !result.data?.user) {
          throw new Error("Invalid session");
        }

        if (isMounted) {
          const currentUser = result.data.user;

          setUser(currentUser);
          localStorage.setItem("user", JSON.stringify(currentUser));
        }
      } catch (error) {
        clearSession();
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [clearSession]);

  const saveSession = useCallback((result) => {
    if (!result?.success || !result.data?.token || !result.data?.user) {
      throw new Error(result?.message || "Authentication failed.");
    }

    const { token, user: loggedInUser } = result.data;

    if (loggedInUser.status !== "ACTIVE") {
      throw new Error("Your account is not active.");
    }

    localStorage.setItem("accessToken", token);
    localStorage.setItem("user", JSON.stringify(loggedInUser));

    setUser(loggedInUser);

    return loggedInUser;
  }, []);

  const login = useCallback(
    async (credentials) => {
      const result = await loginUser(credentials);
      return saveSession(result);
    },
    [saveSession],
  );

  const register = useCallback(
    async (userData) => {
      const result = await registerUser(userData);
      return saveSession(result);
    },
    [saveSession],
  );

  const logout = useCallback(() => {
    clearSession();
    router.replace("/login");
  }, [clearSession, router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isLoading: loading,
        login,
        register,
        logout,
        isAuthenticated: Boolean(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
