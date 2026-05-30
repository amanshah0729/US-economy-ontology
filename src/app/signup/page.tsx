"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { useAuth } from "@/components/auth/AuthProvider";
import { auth } from "@/lib/firebase";
import { joinOrgViaInvite } from "@/lib/db";

function SignupInner() {
  const params = useSearchParams();
  const inviteToken = params.get("invite");
  useAuth(); // ensure provider present

  // If signing up through an invite link, join the org right after auth, then
  // land on the app (which will now see an orgId and skip onboarding).
  const onAuthed = inviteToken
    ? async () => {
        const user = auth.currentUser;
        if (user) await joinOrgViaInvite(inviteToken, user);
      }
    : undefined;

  return <AuthForm mode="signup" onAuthed={onAuthed} redirectTo="/" />;
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupInner />
    </Suspense>
  );
}
