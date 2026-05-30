"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { updateTag } from "next/cache";
import type { ApprovalEntry } from "../_server/types";

const META_PATH = path.join(
  process.cwd(),
  "fixtures",
  "approvals_queue.json",
);

export type ApprovalAction =
  | "approve"
  | "override_category"
  | "send_to_human";

export type ApprovalResult =
  | { ok: true; status: ApprovalEntry["status"] }
  | { ok: false; message: string };

export async function approveDecision(
  ticket_id: string,
  action: ApprovalAction,
): Promise<ApprovalResult> {
  let queue: ApprovalEntry[];
  try {
    queue = JSON.parse(await fs.readFile(META_PATH, "utf-8"));
  } catch {
    return { ok: false, message: "Approvals queue not found." };
  }

  const idx = queue.findIndex((e) => e.ticket_id === ticket_id);
  if (idx === -1) return { ok: false, message: "Ticket not in queue." };

  const nextStatus: ApprovalEntry["status"] =
    action === "approve"
      ? "approved"
      : action === "override_category"
        ? "overridden"
        : "sent_to_human";

  queue[idx] = {
    ...queue[idx],
    status: nextStatus,
    decided_at: new Date().toISOString(),
    decided_by: "operator@console",
  };

  await fs.writeFile(META_PATH, JSON.stringify(queue, null, 2), "utf-8");
  updateTag("fixtures");
  updateTag("approvals");
  return { ok: true, status: nextStatus };
}
