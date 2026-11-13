"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const router = useRouter();

  const { user, isAuthenticated, isLoading } = useAuth();

  const isAuthorized = useMemo(() => {
    if (!allowedRoles.length) return true;

    return user && allowedRoles.includes(user.role);
  }, [allowedRoles, user]);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !user) {
      router.replace("/login");
      return;
    }

    if (!isAuthorized) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, user, isAuthorized, router]);

  if (isLoading) {
    return (
      <LoadingSpinner
        fullScreen
        size="lg"
        message="Checking authentication..."
      />
    );
  }

  if (!isAuthenticated || !user || !isAuthorized) {
    return null;
  }

  return children;
}
