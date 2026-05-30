"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import type { UserDoc } from "@/lib/types";

type AuthContextValue = {
  user: User | null;
  userDoc: UserDoc | null;
  orgId: string | null;
  loading: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Create the users/{uid} doc on first sign-in. If it already exists, only
// refresh the profile fields — never touch orgId (would clobber membership).
async function ensureUserDoc(user: User) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const displayName =
    user.displayName ?? user.email?.split("@")[0] ?? "User";
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email ?? "",
      displayName,
      photoURL: user.photoURL ?? null,
      orgId: null,
      createdAt: serverTimestamp(),
    });
  } else {
    await updateDoc(ref, {
      email: user.email ?? "",
      displayName,
      photoURL: user.photoURL ?? null,
    });
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  // Track auth state. When signed in, subscribe to the user's Firestore doc
  // (so orgId changes — e.g. after creating/joining an org — flow through live).
  useEffect(() => {
    let unsubDoc: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      unsubDoc?.();
      unsubDoc = null;
      setUser(u);

      if (!u) {
        setUserDoc(null);
        setLoading(false);
        return;
      }

      unsubDoc = onSnapshot(doc(db, "users", u.uid), (snap) => {
        setUserDoc(snap.exists() ? (snap.data() as UserDoc) : null);
        setLoading(false);
      });
    });

    return () => {
      unsubDoc?.();
      unsubAuth();
    };
  }, []);

  const signInEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpEmail = async (
    email: string,
    password: string,
    displayName: string,
  ) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) await updateProfile(cred.user, { displayName });
    await ensureUserDoc(cred.user);
  };

  const signInGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    await ensureUserDoc(cred.user);
  };

  const signOutUser = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userDoc,
        orgId: userDoc?.orgId ?? null,
        loading,
        signInEmail,
        signUpEmail,
        signInGoogle,
        signOutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
