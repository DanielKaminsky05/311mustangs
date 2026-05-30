import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  ApprovalEntry,
  AttachmentRecord,
  AuditEntry,
  CanonicalTicket,
  CopilotScript,
  DemoCase,
  EvidencePack,
  Operation,
  PipelineMetrics,
  ScheduleAssignment,
} from "./types";

const FIXTURES_DIR = path.join(process.cwd(), "fixtures");

async function readJSON<T>(filename: string): Promise<T> {
  const raw = await fs.readFile(path.join(FIXTURES_DIR, filename), "utf-8");
  return JSON.parse(raw) as T;
}

export async function getPipelineMetrics(): Promise<PipelineMetrics> {
  "use cache";
  cacheLife("minutes");
  cacheTag("fixtures", "pipeline_metrics");
  return readJSON<PipelineMetrics>("pipeline_metrics.json");
}

export async function getCanonicalTickets(): Promise<CanonicalTicket[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("fixtures", "tickets");
  return readJSON<CanonicalTicket[]>("canonical_tickets.json");
}

export async function getTicket(
  ticket_id: string,
): Promise<CanonicalTicket | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("fixtures", "tickets", `ticket:${ticket_id}`);
  const all = await getCanonicalTickets();
  return all.find((t) => t.ticket_id === ticket_id) ?? null;
}

export async function getRecentTickets(limit = 20): Promise<CanonicalTicket[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("fixtures", "tickets");
  const all = await getCanonicalTickets();
  return [...all]
    .sort((a, b) => (a.reported_at < b.reported_at ? 1 : -1))
    .slice(0, limit);
}

export async function getEvidencePacks(): Promise<EvidencePack[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("fixtures", "evidence");
  return readJSON<EvidencePack[]>("evidence_packs.json");
}

export async function getEvidencePack(
  ticket_id: string,
): Promise<EvidencePack | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("fixtures", "evidence", `ticket:${ticket_id}`);
  const all = await getEvidencePacks();
  return all.find((e) => e.ticket_id === ticket_id) ?? null;
}

export async function getAuditEntries(refs: string[]): Promise<AuditEntry[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("fixtures", "audit");
  const all = await readJSON<AuditEntry[]>("audit_logs.json");
  const set = new Set(refs);
  return all.filter((e) => set.has(e.audit_id));
}

export async function getDemoCases(): Promise<DemoCase[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("fixtures", "demo_cases");
  return readJSON<DemoCase[]>("demo_cases.json");
}

export async function getCopilotScripts(): Promise<CopilotScript> {
  "use cache";
  cacheLife("minutes");
  cacheTag("fixtures", "copilot");
  return readJSON<CopilotScript>("copilot_scripts.json");
}

export async function getOperations(): Promise<Operation[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("fixtures", "operations");
  return readJSON<Operation[]>("operations.json");
}

export async function getScheduleAssignments(): Promise<ScheduleAssignment[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("fixtures", "schedule");
  return readJSON<ScheduleAssignment[]>("schedule_assignments.json");
}

export async function getApprovalsQueue(): Promise<
  Array<ApprovalEntry & { evidence: EvidencePack; ticket: CanonicalTicket }>
> {
  "use cache";
  cacheLife("minutes");
  cacheTag("fixtures", "approvals");
  const [entries, evidence, tickets] = await Promise.all([
    readJSON<ApprovalEntry[]>("approvals_queue.json"),
    getEvidencePacks(),
    getCanonicalTickets(),
  ]);
  const evByTicket = new Map(evidence.map((e) => [e.ticket_id, e]));
  const tkByTicket = new Map(tickets.map((t) => [t.ticket_id, t]));
  return entries
    .map((e) => ({
      ...e,
      evidence: evByTicket.get(e.ticket_id)!,
      ticket: tkByTicket.get(e.ticket_id)!,
    }))
    .filter((row) => row.evidence && row.ticket);
}

async function readAttachmentsSafe(): Promise<AttachmentRecord[]> {
  try {
    return await readJSON<AttachmentRecord[]>("request_attachments.json");
  } catch {
    return [];
  }
}

export async function getAttachmentsForRequest(
  request_id: string,
): Promise<AttachmentRecord[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("fixtures", "attachments", `attachments:${request_id}`);
  const all = await readAttachmentsSafe();
  return all.filter((a) => a.request_id === request_id);
}
