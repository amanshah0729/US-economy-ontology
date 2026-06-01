import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase";
import { nodeByCode } from "@/lib/industry";
import type { Invite, Note, Org, OrgMember, Task, TaskStatus } from "@/lib/types";

// ---------- Industry code expansion ----------

// Given a set of selected NAICS codes, expand each to include all its ancestor
// codes (excluding the synthetic "ROOT"). Lets a note tagged "541511" surface
// under "5415" and "54" via a single array-contains query.
export function expandCodesWithAncestors(codes: string[]): string[] {
  const out = new Set<string>();
  for (const code of codes) {
    out.add(code);
    const entry = nodeByCode.get(code);
    if (entry) {
      for (const a of entry.ancestors) {
        if (a !== "ROOT") out.add(a);
      }
    }
  }
  return [...out];
}

// ---------- Organizations & invites ----------

export async function createOrg(user: User, name: string): Promise<string> {
  const orgRef = doc(collection(db, "organizations"));
  const batch = writeBatch(db);
  batch.set(orgRef, {
    name: name.trim(),
    memberUids: [user.uid],
    createdBy: user.uid,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, "organizations", orgRef.id, "members", user.uid), {
    uid: user.uid,
    displayName: user.displayName ?? user.email?.split("@")[0] ?? "User",
    email: user.email ?? "",
    photoURL: user.photoURL ?? null,
    joinedAt: serverTimestamp(),
  });
  batch.update(doc(db, "users", user.uid), { orgId: orgRef.id });
  await batch.commit();
  return orgRef.id;
}

export async function createInvite(
  orgId: string,
  orgName: string,
  createdBy: string,
): Promise<string> {
  const token = crypto.randomUUID().replace(/-/g, "");
  await setDoc(doc(db, "invites", token), {
    token,
    orgId,
    orgName,
    createdBy,
    createdAt: serverTimestamp(),
    expiresAt: null,
    active: true,
  });
  return token;
}

export async function getInvite(token: string): Promise<Invite | null> {
  const snap = await getDoc(doc(db, "invites", token));
  return snap.exists() ? (snap.data() as Invite) : null;
}

// Join an org via an invite token. Appends the user to memberUids (arrayUnion),
// writes their denormalized member profile, and sets users/{uid}.orgId.
export async function joinOrgViaInvite(token: string, user: User): Promise<void> {
  const invite = await getInvite(token);
  if (!invite || !invite.active) throw new Error("Invite is invalid or expired");

  const batch = writeBatch(db);
  batch.update(doc(db, "organizations", invite.orgId), {
    memberUids: arrayUnion(user.uid),
  });
  batch.set(doc(db, "organizations", invite.orgId, "members", user.uid), {
    uid: user.uid,
    displayName: user.displayName ?? user.email?.split("@")[0] ?? "User",
    email: user.email ?? "",
    photoURL: user.photoURL ?? null,
    joinedAt: serverTimestamp(),
  });
  batch.update(doc(db, "users", user.uid), { orgId: invite.orgId });
  await batch.commit();
}

// Leave the current org: remove self from memberUids, delete the member
// profile doc, and clear users/{uid}.orgId (which flips the gate back to
// onboarding). Notes/tasks the user authored stay with the org.
export async function leaveOrg(orgId: string, uid: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "organizations", orgId), {
    memberUids: arrayRemove(uid),
  });
  batch.delete(doc(db, "organizations", orgId, "members", uid));
  batch.update(doc(db, "users", uid), { orgId: null });
  await batch.commit();
}

// Remove another member from the org (any member can do this). Removes them
// from memberUids and deletes their member profile. We can't clear THEIR
// users/{uid}.orgId (rules forbid cross-user writes) — their own client
// reconciles membership in AuthProvider and falls back to onboarding.
export async function kickMember(
  orgId: string,
  targetUid: string,
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "organizations", orgId), {
    memberUids: arrayRemove(targetUid),
  });
  batch.delete(doc(db, "organizations", orgId, "members", targetUid));
  await batch.commit();
}

export function subscribeOrg(
  orgId: string,
  cb: (org: Org | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, "organizations", orgId), (snap) => {
    cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Org) : null);
  });
}

export function subscribeOrgMembers(
  orgId: string,
  cb: (members: OrgMember[]) => void,
): Unsubscribe {
  return onSnapshot(collection(db, "organizations", orgId, "members"), (snap) => {
    cb(snap.docs.map((d) => d.data() as OrgMember));
  });
}

// ---------- Notes ----------

export type NoteInput = {
  person: string;
  company: string;
  position: string;
  contactDate: Date;
  body: string;
  followUp: string;
  codes: string[];
};

export async function createNote(
  orgId: string,
  authorUid: string,
  input: NoteInput,
): Promise<string> {
  const ref = await addDoc(collection(db, "notes"), {
    orgId,
    authorUid,
    person: input.person,
    company: input.company,
    position: input.position,
    contactDate: Timestamp.fromDate(input.contactDate),
    body: input.body,
    followUp: input.followUp,
    linkedCodes: expandCodesWithAncestors(input.codes),
    aiSorted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateNote(
  noteId: string,
  input: NoteInput,
): Promise<void> {
  await updateDoc(doc(db, "notes", noteId), {
    person: input.person,
    company: input.company,
    position: input.position,
    contactDate: Timestamp.fromDate(input.contactDate),
    body: input.body,
    followUp: input.followUp,
    linkedCodes: expandCodesWithAncestors(input.codes),
    updatedAt: serverTimestamp(),
  });
}

// Merge AI-returned codes (expanded with ancestors) into the note's links.
export async function updateNoteCodes(
  noteId: string,
  existingCodes: string[],
  newCodes: string[],
): Promise<void> {
  const merged = expandCodesWithAncestors([
    ...new Set([...existingCodes, ...newCodes]),
  ]);
  await updateDoc(doc(db, "notes", noteId), {
    linkedCodes: merged,
    aiSorted: true,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteNoteDoc(noteId: string): Promise<void> {
  await deleteDoc(doc(db, "notes", noteId));
}

export function subscribeOrgNotes(
  orgId: string,
  cb: (notes: Note[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, "notes"),
    where("orgId", "==", orgId),
    orderBy("contactDate", "desc"),
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Note));
  });
}

export function subscribeNotesByCode(
  orgId: string,
  code: string,
  cb: (notes: Note[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, "notes"),
    where("orgId", "==", orgId),
    where("linkedCodes", "array-contains", code),
  );
  return onSnapshot(q, (snap) => {
    const notes = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Note);
    // Sort client-side by contactDate desc to avoid a composite index here.
    notes.sort(
      (a, b) => (b.contactDate?.toMillis() ?? 0) - (a.contactDate?.toMillis() ?? 0),
    );
    cb(notes);
  });
}

// ---------- Tasks ----------

export type TaskInput = {
  title: string;
  description: string;
  assigneeUid: string;
  linkedNoteIds: string[];
};

export async function createTask(
  orgId: string,
  assignerUid: string,
  input: TaskInput,
): Promise<string> {
  const ref = await addDoc(collection(db, "tasks"), {
    orgId,
    title: input.title,
    description: input.description,
    assigneeUid: input.assigneeUid,
    assignerUid,
    status: "open" as TaskStatus,
    linkedNoteIds: input.linkedNoteIds,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function setTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<void> {
  await updateDoc(doc(db, "tasks", taskId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export function subscribeOrgTasks(
  orgId: string,
  cb: (tasks: Task[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, "tasks"),
    where("orgId", "==", orgId),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Task));
  });
}

// Open tasks assigned to a specific user — drives the Tasks tab badge count.
export function subscribeMyOpenTaskCount(
  orgId: string,
  uid: string,
  cb: (count: number) => void,
): Unsubscribe {
  const q = query(
    collection(db, "tasks"),
    where("orgId", "==", orgId),
    where("assigneeUid", "==", uid),
    where("status", "==", "open"),
  );
  return onSnapshot(q, (snap) => cb(snap.size));
}
