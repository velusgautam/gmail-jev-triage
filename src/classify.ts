import type { EmailMeta } from "./gmail.js";

const ENDPOINT = "https://api.beatapi.io/v1/systemone";
export const JEV_MODEL = process.env.JEV_MODEL?.trim() || "jev-1.13";

export const CATEGORIES = [
  "fraud",
  "marketing",
  "important",
  "old_or_obsolete",
  "no_longer_needed",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  fraud: "Fraud",
  marketing: "Flagged for Delete",
  important: "Important",
  old_or_obsolete: "Old-Obsolete",
  no_longer_needed: "No-Longer-Needed",
};

const CRITERIA: Record<Category, string> = {
  fraud: "Phishing, scams, impersonation, or anything that looks suspicious.",
  marketing: "Promotions, newsletters, sales pitches and other bulk marketing.",
  important: "Personal, financial, legal or work mail the user probably still needs.",
  old_or_obsolete: "Time-sensitive mail (an event, offer, code or deadline) whose date has passed.",
  no_longer_needed: "Routine notifications, receipts or confirmations with no reason to keep them.",
};

export interface Classification {
  category: Category;
  confidence: number;
}

export async function classifyEmail(meta: EmailMeta): Promise<Classification> {
  const today = new Date().toISOString().slice(0, 10);

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.BEATAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: JEV_MODEL,
      state:
        `A personal Gmail message. Today is ${today}.\n` +
        `Subject: ${meta.subject}\nFrom: ${meta.from}\n` +
        `Date: ${meta.date}\nSnippet: ${meta.snippet}`,
      questions: {
        category: {
          type: "choice",
          instructions: "Which category does this email belong in?",
          criteria: CRITERIA,
        },
      },
    }),
  });

  if (!res.ok) {
    const err: any = new Error(`Jev API ${res.status}: ${await res.text()}`);
    err.status = res.status;
    err.retryAfter = Number(res.headers.get("retry-after")) || undefined;
    throw err;
  }

  const body = (await res.json()) as {
    answers: { category: { choice: Category; confidence: number } };
  };
  const { choice, confidence } = body.answers.category;
  return { category: choice, confidence };
}
