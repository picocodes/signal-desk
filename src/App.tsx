import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { Topic, Workspace } from "./types";

const stages = ["opportunity", "brief", "draft", "scheduled", "published"] as const;

function StatusMark({ status }: { status: Topic["status"] }) {
  return <span className={`status status--${status}`}><i />{status}</span>;
}

function Onboarding({ current, onSaved }: { current: Workspace; onSaved: (value: Workspace) => void }) {
  const [form, setForm] = useState({ siteName: current.siteName, siteUrl: current.siteUrl, audience: current.audience, offer: current.offer, tone: current.tone });
  const [state, setState] = useState<"idle" | "loading" | "error" | "success">("idle");
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setState("loading");
    try { onSaved(await api.saveWorkspace(form)); setState("success"); } catch { setState("error"); }
  };
  return <section className="setup-panel" aria-labelledby="setup-heading">
    <div><p className="utility">Business context</p><h1 id="setup-heading">Give the engine something true to work from.</h1><p>These details ground every topic, claim, and call to action. You can revise them later.</p></div>
    <form onSubmit={save} data-state={state}>
      <label>Site name<input required value={form.siteName} onChange={e => setForm({ ...form, siteName: e.target.value })} placeholder="Acme Studio" /></label>
      <label>Website URL<input required type="url" value={form.siteUrl} onChange={e => setForm({ ...form, siteUrl: e.target.value })} placeholder="https://example.com" /></label>
      <label>Who buys from you?<textarea required value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })} placeholder="Operations leaders at 20–100 person service firms" /></label>
      <label>What do you sell?<textarea required value={form.offer} onChange={e => setForm({ ...form, offer: e.target.value })} placeholder="A managed client onboarding platform" /></label>
      <label>Writing voice<input required value={form.tone} onChange={e => setForm({ ...form, tone: e.target.value })} placeholder="Direct, experienced, never breathless" /></label>
      <button className="button" disabled={state === "loading"}>{state === "loading" ? "Saving context…" : state === "success" ? "Context saved ✓" : "Save business context"}</button>
      <p className="form-note" role="status">{state === "error" ? "The context could not be saved. Check the connection and try again." : "No invented metrics. No claims outside this source of truth."}</p>
    </form>
  </section>;
}

function TopicRow({ topic, onAdvance }: { topic: Topic; onAdvance: (id: string) => void }) {
  const next = stages[Math.min(stages.indexOf(topic.status) + 1, stages.length - 1)];
  return <article className="topic-row">
    <div className="topic-main"><StatusMark status={topic.status} /><h3>{topic.title}</h3><p>{topic.keyword} · {topic.intent} intent</p></div>
    <dl><div><dt>Priority</dt><dd>{topic.score}/100</dd></div><div><dt>Sources</dt><dd>{topic.evidence}</dd></div><div><dt>Target</dt><dd>{topic.due}</dd></div></dl>
    <button className="row-action" disabled={topic.status === "published"} onClick={() => onAdvance(topic.id)}>{topic.status === "published" ? "Published" : `Move to ${next}`}</button>
  </article>;
}

export function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [planning, setPlanning] = useState(false);
  useEffect(() => { api.workspace().then(setWorkspace).catch(e => setError(e.message)); }, []);
  const counts = useMemo(() => Object.fromEntries(stages.map(stage => [stage, workspace?.topics.filter(t => t.status === stage).length || 0])), [workspace]);
  const plan = async () => { setPlanning(true); try { setWorkspace(await api.generatePlan()); } catch (e) { setError((e as Error).message); } finally { setPlanning(false); } };
  const advance = async (id: string) => { try { setWorkspace(await api.advanceTopic(id)); } catch (e) { setError((e as Error).message); } };
  if (error) return <main className="fatal"><p className="utility">Connection problem</p><h1>The workspace did not load.</h1><p>{error}</p><button className="button" onClick={() => location.reload()}>Try again</button></main>;
  if (!workspace) return <main className="loading" aria-live="polite"><span /><p>Opening the workbench…</p></main>;
  if (!workspace.siteUrl) return <main className="onboarding"><a className="brand" href="/">SignalDesk<span>β</span></a><Onboarding current={workspace} onSaved={setWorkspace} /></main>;
  return <div className="shell">
    <header className="topbar"><a className="brand" href="/">SignalDesk<span>β</span></a><button className="command" aria-label="Search workspace"><kbd>⌘</kbd><span>Search topics, pages, evidence</span><kbd>K</kbd></button><div className="site-switch"><i />{workspace.siteName}</div></header>
    <aside className="rail"><nav aria-label="Workspace"><a className="active" href="#pipeline">Pipeline</a><a href="#calendar">Calendar</a><a href="#evidence">Evidence</a><a href="#site">Site memory</a></nav><div className="rail-foot"><span>Provider</span><strong>Demo mode</strong></div></aside>
    <main className="workbench">
      <section className="work-head"><div><p className="utility">Search workspace</p><h1>Make the next useful page obvious.</h1></div><p>SignalDesk turns your business context into an accountable publishing queue—then watches what searchers actually respond to.</p></section>
      <section className="instrument" aria-label="Pipeline summary">{stages.map(stage => <div key={stage}><strong>{counts[stage]}</strong><span>{stage}</span></div>)}</section>
      <section className="pipeline" id="pipeline">
        <div className="section-head"><div><h2>Content pipeline</h2><p>Every page moves with evidence attached.</p></div><button className="button" onClick={plan} disabled={planning}>{planning ? "Finding opportunities…" : workspace.topics.length ? "Refresh plan" : "Build first plan"}</button></div>
        <div className="topic-list">{workspace.topics.length ? workspace.topics.map(topic => <TopicRow key={topic.id} topic={topic} onAdvance={advance} />) : <div className="empty"><span>↳</span><h3>No topics queued yet</h3><p>Build a first plan from your saved audience, offer, and site context.</p><button className="text-action" onClick={plan}>Build the plan →</button></div>}</div>
      </section>
      <section className="evidence-panel" id="evidence"><div><p className="utility">Quality contract</p><h2>Research before prose.</h2></div><ul><li><span>01</span> Claims resolve to a saved source.</li><li><span>02</span> Search intent chooses the page shape.</li><li><span>03</span> WordPress receives native editable blocks.</li></ul></section>
      <footer className="footer"><p>Publish less guesswork.</p><div><span className="brand">SignalDesk<span>β</span></span><span>Private preview · 2026</span></div></footer>
    </main>
  </div>;
}
