import "dotenv/config";
import fs from "node:fs";
import { getAuthorizedClient } from "./auth.js";
import { getGmailClient, listMessageIds, getMessageMeta, ensureLabel, applyLabel } from "./gmail.js";
import { classifyEmail, CATEGORY_LABELS, JEV_MODEL, type Category } from "./classify.js";
import { pool, withJevLimits } from "./throttle.js";

const APPLY = process.argv.includes("--apply"); // default is a dry run
const PREFIX = process.env.LABEL_PREFIX?.trim() || "AI";
const QUERY = process.env.GMAIL_QUERY?.trim() || "in:inbox -is:important";
const MAX = Number(process.env.MAX_MESSAGES ?? 100);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 5);

const PROCESSED = "processed-ids.json";
const processed = new Set<string>(
  fs.existsSync(PROCESSED) ? JSON.parse(fs.readFileSync(PROCESSED, "utf-8")) : []
);

const gmail = getGmailClient(await getAuthorizedClient());
console.log(
  `${APPLY ? "APPLY" : "DRY RUN"} | model ${JEV_MODEL} | concurrency ${CONCURRENCY} | ` +
    `delay ${process.env.REQUEST_DELAY_MS ?? 0}ms | query: ${QUERY}\n`
);

const labelIds = new Map<Category, string>();
if (APPLY) {
  for (const [cat, name] of Object.entries(CATEGORY_LABELS) as [Category, string][]) {
    labelIds.set(cat, await ensureLabel(gmail, `${PREFIX}/${name}`));
  }
}

const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
if (!fs.existsSync("results.csv")) {
  fs.writeFileSync("results.csv", "message_id,date,from,subject,category,confidence,label_applied\n");
}

let classified = 0;
let failed = 0;
let pageToken: string | undefined;

while (classified < MAX) {
  const { ids, nextPageToken } = await listMessageIds(gmail, QUERY, Math.min(50, MAX - classified), pageToken);
  if (ids.length === 0) break;

  const todo = ids.filter((id) => !processed.has(id)).slice(0, MAX - classified);

  await pool(todo, CONCURRENCY, async (id) => {
    try {
      const meta = await getMessageMeta(gmail, id);
      const { category, confidence } = await withJevLimits(() => classifyEmail(meta));
      classified++;

      if (APPLY) await applyLabel(gmail, id, labelIds.get(category)!);

      fs.appendFileSync(
        "results.csv",
        [meta.id, meta.date, meta.from, meta.subject, category].map(esc).join(",") +
          `,${confidence.toFixed(2)},${APPLY ? "yes" : "no"}\n`
      );
      console.log(`[${category.padEnd(16)}] ${confidence.toFixed(2)}  ${meta.from} - ${meta.subject}`);
      processed.add(id);
    } catch (err: any) {
      failed++;
      console.error(`  failed on ${id}: ${err.message ?? err}`);
    }
  });

  fs.writeFileSync(PROCESSED, JSON.stringify([...processed]));
  if (!nextPageToken) break;
  pageToken = nextPageToken;
}

console.log(`\nClassified ${classified}, failed ${failed}.`);
console.log(APPLY ? "Labels applied in Gmail." : "Dry run: nothing was written to Gmail.");
