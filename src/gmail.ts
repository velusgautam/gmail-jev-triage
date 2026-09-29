import { google, type gmail_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export const getGmailClient = (auth: OAuth2Client) =>
  google.gmail({ version: "v1", auth });

export interface EmailMeta {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

export async function listMessageIds(
  gmail: gmail_v1.Gmail,
  query: string,
  maxResults: number,
  pageToken?: string
) {
  const res = await gmail.users.messages.list({
    userId: "me",
    q: query, // any search you'd type into Gmail works here
    maxResults,
    pageToken,
  });
  return {
    ids: (res.data.messages ?? []).map((m) => m.id!),
    nextPageToken: res.data.nextPageToken,
  };
}

const header = (h: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string) =>
  h?.find((x) => x.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

export async function getMessageMeta(gmail: gmail_v1.Gmail, id: string): Promise<EmailMeta> {
  const res = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "metadata",
    metadataHeaders: ["Subject", "From", "Date"],
  });
  const h = res.data.payload?.headers;
  return {
    id,
    subject: header(h, "Subject"),
    from: header(h, "From"),
    date: header(h, "Date"),
    snippet: res.data.snippet ?? "",
  };
}

/** Finds a label by name or creates it. "Parent/Child" names nest in Gmail. */
export async function ensureLabel(gmail: gmail_v1.Gmail, name: string): Promise<string> {
  const { data } = await gmail.users.labels.list({ userId: "me" });
  const existing = data.labels?.find((l) => l.name === name);
  if (existing?.id) return existing.id;

  const created = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    },
  });
  return created.data.id!;
}

export async function applyLabel(gmail: gmail_v1.Gmail, messageId: string, labelId: string) {
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: { addLabelIds: [labelId] },
  });
}
