"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { subscribeMyOpenTaskCount } from "@/lib/db";

// Live count of open tasks assigned to the current user — drives the tab badge.
export function useMyTaskCount(): number {
  const { orgId, user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!orgId || !user) return;
    const unsub = subscribeMyOpenTaskCount(orgId, user.uid, setCount);
    return () => {
      unsub();
      setCount(0);
    };
  }, [orgId, user]);

  return count;
}
