"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { OrgOnboarding } from "@/components/org/OrgOnboarding";

// Gates the main app: spinner while resolving auth, redirect to /login when
// signed out, org onboarding when authed-but-orgless, else renders children.
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, orgId, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  if (!user) return null; // redirecting

  if (!orgId) return <OrgOnboarding />;

  return <>{children}</>;
}
