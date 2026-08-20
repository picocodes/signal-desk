import { randomUUID } from "node:crypto";
import { pool } from "./db.js";

export type WorkspaceInput = { siteName: string; siteUrl: string; audience: string; offer: string; tone: string };
export type Workspace = WorkspaceInput & { topics: Array<Record<string, unknown>> };
const mapWorkspace = (r: Record<string, unknown>): WorkspaceInput => ({
  siteName: String(r.site_name), siteUrl: String(r.site_url), audience: String(r.audience),
  offer: String(r.offer), tone: String(r.tone)
});

export async function getWorkspace(): Promise<Workspace> {
  const workspace = await pool.query("select * from workspace where id = 1");
  const topics = await pool.query("select id, title, keyword, intent, status, score, evidence, due from topics order by score desc, created_at");
  return { ...mapWorkspace(workspace.rows[0]), topics: topics.rows };
}

export async function saveWorkspace(input: WorkspaceInput) {
  await pool.query("update workspace set site_name=$1, site_url=$2, audience=$3, offer=$4, tone=$5, updated_at=now() where id=1", [input.siteName, input.siteUrl, input.audience, input.offer, input.tone]);
  return getWorkspace();
}

export async function generateDemoPlan() {
  const current = await getWorkspace();
  const offer = current.offer.split(/[,.]/)[0] || "your service";
  const rows = [
    [`How to evaluate ${offer.toLowerCase()}`, `${offer.toLowerCase()} evaluation`, "commercial", 91, 6, "Sep 04"],
    [`The practical guide to ${offer.toLowerCase()}`, `${offer.toLowerCase()} guide`, "informational", 84, 8, "Sep 09"],
    [`Common ${offer.toLowerCase()} mistakes`, `${offer.toLowerCase()} mistakes`, "informational", 76, 5, "Sep 16"],
    [`${current.siteName || "Your product"} alternatives: an honest comparison`, `${current.siteName.toLowerCase()} alternatives`, "commercial", 73, 7, "Sep 23"]
  ];
  await pool.query("delete from topics where status = 'opportunity'");
  for (const row of rows) await pool.query("insert into topics (id,title,keyword,intent,status,score,evidence,due) values ($1,$2,$3,$4,'opportunity',$5,$6,$7)", [randomUUID(), ...row]);
  return getWorkspace();
}

export async function advanceTopic(id: string) {
  const stages = ["opportunity", "brief", "draft", "scheduled", "published"];
  const found = await pool.query("select status from topics where id=$1", [id]);
  if (!found.rowCount) throw new Error("Topic not found");
  const next = stages[Math.min(stages.indexOf(found.rows[0].status) + 1, stages.length - 1)];
  await pool.query("update topics set status=$1 where id=$2", [next, id]);
  return getWorkspace();
}
