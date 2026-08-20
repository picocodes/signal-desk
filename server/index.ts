import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { migrate, pool } from "./db.js";
import { advanceTopic, generateDemoPlan, getWorkspace, saveWorkspace } from "./store.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const workspaceSchema = z.object({ siteName: z.string().min(1).max(100), siteUrl: z.string().url(), audience: z.string().min(3).max(1000), offer: z.string().min(3).max(1000), tone: z.string().min(2).max(240) });
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.get("/health", async (_req, res) => {
  try { await pool.query("select 1"); res.json({ status: "ok", database: "connected", version: process.env.npm_package_version || "0.1.0" }); }
  catch { res.status(503).json({ status: "degraded", database: "unavailable" }); }
});
app.get("/api/workspace", async (_req, res, next) => { try { res.json(await getWorkspace()); } catch (e) { next(e); } });
app.put("/api/workspace", async (req, res, next) => { try { res.json(await saveWorkspace(workspaceSchema.parse(req.body))); } catch (e) { next(e); } });
app.post("/api/plan", async (_req, res, next) => { try { res.json(await generateDemoPlan()); } catch (e) { next(e); } });
app.post("/api/topics/:id/advance", async (req, res, next) => { try { res.json(await advanceTopic(req.params.id)); } catch (e) { next(e); } });

app.use(express.static(path.join(root, "dist"), { maxAge: process.env.NODE_ENV === "production" ? "1h" : 0 }));
app.use((_req, res) => res.sendFile(path.join(root, "dist", "index.html")));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof z.ZodError ? "Check the highlighted business context fields." : error instanceof Error ? error.message : "Unexpected server error";
  res.status(error instanceof z.ZodError ? 400 : 500).json({ message });
});

migrate().then(() => app.listen(port, "0.0.0.0", () => console.log(`SignalDesk listening on ${port}`))).catch(error => { console.error("Startup migration failed", error); process.exit(1); });
