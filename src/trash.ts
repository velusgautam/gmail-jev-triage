import fs from "node:fs";
import type { gmail_v1 } from "googleapis";

export async function trash(gmail: gmail_v1.Gmail, ids: string[]) {
  const manifest = `trashed-${new Date().toISOString().slice(0, 19).replace(/:/g, "")}.csv`;
  fs.writeFileSync(manifest, "message_id\n");

  for (let i = 0; i < ids.length; i += 1000) {
    const chunk = ids.slice(i, i + 1000);
    await gmail.users.messages.batchModify({
      userId: "me",
      requestBody: { ids: chunk, addLabelIds: ["TRASH"] },
    });
    fs.appendFileSync(manifest, chunk.join("\n") + "\n");
  }
  console.log(`Trashed ${ids.length}. Undo list: ${manifest} (Trash keeps mail for 30 days)`);
}
