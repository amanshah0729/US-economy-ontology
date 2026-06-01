import type { Timestamp } from "firebase/firestore";

// Firestore document shapes. All org-owned docs carry an `orgId` field so the
// data model scopes by field (not nesting) — making a future multi-org change
// a query filter swap rather than a restructure.

export type UserDoc = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  orgId: string | null;
  createdAt: Timestamp;
};

export type Org = {
  id: string;
  name: string;
  memberUids: string[];
  createdBy: string;
  createdAt: Timestamp;
};

// Denormalized member profile under organizations/{orgId}/members/{uid}.
export type OrgMember = {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  joinedAt: Timestamp;
};

export type Invite = {
  token: string;
  orgId: string;
  orgName: string;
  createdBy: string;
  createdAt: Timestamp;
  expiresAt: Timestamp | null;
  active: boolean;
};

export type Note = {
  id: string;
  orgId: string;
  authorUid: string;
  person: string;
  company: string;
  position: string;
  contactDate: Timestamp;
  body: string;
  // Follow-up / next steps captured during the call. Missing on older docs.
  followUp?: string;
  // NAICS codes this note is linked to. Stores the selected code AND all its
  // ancestor codes, so a note tagged "541511" is also found under "5415"/"54".
  linkedCodes: string[];
  aiSorted: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type TaskStatus = "open" | "done";

export type Task = {
  id: string;
  orgId: string;
  title: string;
  description: string;
  assigneeUid: string;
  assignerUid: string;
  status: TaskStatus;
  linkedNoteIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
