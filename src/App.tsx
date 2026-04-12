import { useEffect, useState } from "react";
import silhouette from "./assets/silhouette.jpg";
import { loadState, saveState, type AscendState, type WorkoutSession, type ExerciseSet } from "./seed";

type Tab = "dashboard" | "workouts" | "progress" | "plan";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function fmtDate(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" });
}

function Card(props: { title?: string; children: any; className?: string }) {
  return (
    <div className={cn("rounded-3xl bg-white/[0.04] border border-white/10 shadow-card", props.className)}>
      {props.title ? <div className="px-5 pt-4 text-[12px] text-white/55 tracking-wide">{props.title}</div> : null}
      <div className={cn("px-5 pb-5", props.title ? "pt-3" : "pt-5")}>{props.children}</div>
    </div>
  );
}

function MiniLineChart(props: { values: number[] }) {
  const w = 320;
  const h = 120;
  const pad = 10;
  const { min, max } = props.values.reduce(
    (a, v) => ({ min: Math.min(a.min, v), max: Math.max(a.max, v) }),
    { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY }
  );
  const span = Math.max(1e-9, max - min);
  const pts = props.values.map((v, i) => {
    const x = pad + (i / Math.max(1, props.values.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return { x, y };
  });
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full">
      <defs>
        <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(241,195,93,0.85)" />
          <stop offset="100%" stopColor="rgba(241,195,93,0.18)" />
        </linearGradient>
      </defs>
      <path d={d} fill="none" stroke="url(#gold)" strokeWidth={3} strokeLinecap="round" />
    </svg>
  );
}

function BottomNav(props: { tab: Tab; onTab: (t: Tab) => void }) {
  const items: Array<{ id: Tab; label: string }> = [
    { id: "dashboard", label: "Dashboard" },
    { id: "workouts", label: "Workouts" },
    { id: "progress", label: "Progress" },
    { id: "plan", label: "Plan" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-[520px] px-4 pb-4">
        <div className="rounded-3xl bg-black/50 backdrop-blur-xl border border-white/10 shadow-card">
          <div className="grid grid-cols-4">
            {items.map((it) => {
              const active = props.tab === it.id;
              return (
                <button
                  key={it.id}
                  className={cn(
                    "py-3 text-[11px] tracking-wide",
                    active ? "text-gold-200" : "text-white/55 hover:text-white/80"
                  )}
                  onClick={() => props.onTab(it.id)}
                >
                  <div className={cn("mx-auto w-10 h-1 rounded-full mb-2", active ? "bg-gold-300 shadow-glow" : "bg-white/10")} />
                  {it.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardView(props: { sessions: WorkoutSession[] }) {
  const sessions = props.sessions;

  const last = sessions.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];

  // simple "strength progress" proxy: best total volume over last 10 sessions
  const last10 = sessions.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 10).reverse();
  const volumes = last10.map((s) => s.exercises.reduce((sum, e) => sum + (e.weightKg || 0) * (e.setDetails?.reduce((a, r) => a + r, 0) || e.sets * e.reps), 0));

  const totalBest = Math.round(Math.max(0, ...volumes));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] text-white/55">Strength Progress</div>
          <div className="text-[11px] text-white/35">Last 10 sessions</div>
        </div>
        <div className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/5 text-gold-200">7-day</div>
      </div>

      <div className="text-4xl font-semibold tracking-tight tabular-nums">{totalBest} kg</div>
      <MiniLineChart values={volumes.length ? volumes : [0, 1, 0]} />

      <div className="grid grid-cols-1 gap-4">
        <Card title="Workout Recommendation" className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gold-radial opacity-70" />
          <div className="relative">
            <div className="text-sm text-white/90 font-medium">Plan: Hypertrophy Push Day</div>
            <div className="text-[12px] text-white/45 mt-1">Time: 60 min</div>
            <button className="mt-4 w-full rounded-2xl py-3 border border-white/10 bg-white/[0.06] text-white/85 hover:bg-white/[0.10]">
              View Result
            </button>
          </div>
        </Card>

        <Card title="Last Workout">
          {last ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm text-white/90 font-medium">{last.title}</div>
                <div className="text-[12px] text-white/45 mt-1">{fmtDate(last.date)} · {last.exercises.length} exercises</div>
              </div>
              <div className="text-[12px] text-white/45">Open</div>
            </div>
          ) : (
            <div className="text-sm text-white/50">No sessions yet.</div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Modal(props: { open: boolean; onClose: () => void; title: string; children: any }) {
  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/60" onClick={props.onClose} />
      {/* keep space for bottom nav so modal buttons aren't blocked */}
      <div className="absolute left-0 right-0 bottom-0 mx-auto max-w-[520px] px-4 pb-28">
        <div className="rounded-3xl border border-white/10 bg-black/60 backdrop-blur-2xl shadow-card overflow-hidden">
          <div className="px-5 pt-4 pb-3 flex items-center justify-between">
            <div className="text-sm text-white/85 font-semibold">{props.title}</div>
            <button className="text-white/55 hover:text-white/80" onClick={props.onClose}>
              Close
            </button>
          </div>
          <div className="px-5 pb-5">{props.children}</div>
        </div>
      </div>
    </div>
  );
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

function isoToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function WorkoutsView(props: {
  sessions: WorkoutSession[];
  onUpsertSession: (s: WorkoutSession) => void;
}) {
  const sessionsSorted = props.sessions.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = selectedId ? props.sessions.find((s) => s.id === selectedId) : null;

  const [createOpen, setCreateOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("Strength Training");
  const [draftDate, setDraftDate] = useState(isoToday());

  const [addExOpen, setAddExOpen] = useState(false);
  const [exName, setExName] = useState("Incline Dumbbell Press");
  const [exWeight, setExWeight] = useState(20);
  const [exSets, setExSets] = useState(3);
  const [exReps, setExReps] = useState(10);

  function saveSession(s: WorkoutSession) {
    props.onUpsertSession(s);
  }

  function createSession() {
    const s: WorkoutSession = {
      id: uid("ws"),
      date: draftDate,
      title: draftTitle.trim() || "Workout",
      source: "confirmed",
      exercises: [],
    };
    saveSession(s);
    setSelectedId(s.id);
    setCreateOpen(false);
  }

  function addExercise() {
    if (!selected) return;
    const e: ExerciseSet = {
      id: uid("ex"),
      name: exName.trim() || "Exercise",
      category: "chest",
      weightKg: Number(exWeight) || 0,
      sets: Math.max(1, Number(exSets) || 1),
      reps: Math.max(1, Number(exReps) || 1),
      source: "confirmed",
    };
    saveSession({ ...selected, exercises: [...selected.exercises, e] });
    setAddExOpen(false);
  }

  if (selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg text-white/90 font-semibold">{selected.title}</div>
            <div className="text-[12px] text-white/45 mt-1">{fmtDate(selected.date)} · {selected.exercises.length} exercises</div>
          </div>
          <button
            className="px-4 py-2 rounded-2xl border border-white/10 bg-white/[0.04] text-white/75 hover:text-white/90"
            onClick={() => setSelectedId(null)}
          >
            Back
          </button>
        </div>

        <Card title="Exercises">
          {selected.exercises.length ? (
            <div className="space-y-3">
              {selected.exercises.map((e) => {
                const weightLabel = e.weightKg === 0 ? "BW" : `${e.weightKg} kg`;
                const repsLabel = e.setDetails?.length ? e.setDetails.join(" · ") : `${e.reps}`;
                return (
                  <div key={e.id} className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm text-white/90 font-medium">{e.name}</div>
                      <div className="text-[12px] text-white/45 mt-1">
                        {weightLabel}
                        {e.weightNote ? ` (${e.weightNote})` : ""} · {e.sets} sets
                      </div>
                      <div className="text-[12px] text-white/45 mt-1">Reps: {repsLabel}</div>
                    </div>
                    <div className="text-[11px] text-white/35">{e.source ?? "logged"}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-white/45">No exercises yet. Add your first set.</div>
          )}

          <button
            className="mt-4 w-full rounded-2xl py-3 border border-white/10 bg-white/[0.06] text-white/85 hover:bg-white/[0.10]"
            onClick={() => setAddExOpen(true)}
          >
            Add Exercise
          </button>
        </Card>

        <Modal open={addExOpen} onClose={() => setAddExOpen(false)} title="Add Exercise">
          <div className="space-y-3">
            <div>
              <div className="text-[11px] text-white/45 mb-1">Exercise</div>
              <input
                value={exName}
                onChange={(e) => setExName(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/85 outline-none"
                placeholder="Incline Dumbbell Press"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-[11px] text-white/45 mb-1">kg</div>
                <input
                  type="number"
                  value={exWeight}
                  onChange={(e) => setExWeight(Number(e.target.value))}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/85 outline-none"
                />
              </div>
              <div>
                <div className="text-[11px] text-white/45 mb-1">sets</div>
                <input
                  type="number"
                  value={exSets}
                  onChange={(e) => setExSets(Number(e.target.value))}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/85 outline-none"
                />
              </div>
              <div>
                <div className="text-[11px] text-white/45 mb-1">reps</div>
                <input
                  type="number"
                  value={exReps}
                  onChange={(e) => setExReps(Number(e.target.value))}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/85 outline-none"
                />
              </div>
            </div>

            <button className="w-full rounded-2xl py-3 border border-gold-300/30 bg-white/[0.06] text-gold-200 shadow-glow" onClick={addExercise}>
              Save
            </button>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-lg text-white/90 font-semibold">Workout History</div>
        <button
          className="px-3 py-2 rounded-2xl border border-white/10 bg-white/[0.04] text-white/75 hover:text-white/90"
          onClick={() => setCreateOpen(true)}
        >
          + New
        </button>
      </div>

      <div className="space-y-3">
        {sessionsSorted.map((s) => (
          <button key={s.id} className="w-full text-left" onClick={() => setSelectedId(s.id)}>
            <Card>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm text-white/90 font-medium">{s.title}</div>
                  <div className="text-[12px] text-white/45 mt-1">{fmtDate(s.date)}</div>
                  <div className="text-[12px] text-white/45 mt-1">{s.exercises.length} exercises</div>
                </div>
                <div className="text-[11px] text-white/40">Open</div>
              </div>
            </Card>
          </button>
        ))}
      </div>

      <Card title="Filters">
        <div className="flex gap-2 flex-wrap">
          {[
            { id: "all", label: "All" },
            { id: "strength", label: "Strength" },
            { id: "cardio", label: "Cardio" },
            { id: "recovery", label: "Recovery" },
          ].map((f) => (
            <button key={f.id} className="px-3 py-2 rounded-2xl border border-white/10 bg-white/[0.04] text-white/65 hover:text-white/85">
              {f.label}
            </button>
          ))}
        </div>
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Workout">
        <div className="space-y-3">
          <div>
            <div className="text-[11px] text-white/45 mb-1">Title</div>
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/85 outline-none"
              placeholder="Push / Pull / Legs / Core"
            />
          </div>
          <div>
            <div className="text-[11px] text-white/45 mb-1">Date</div>
            <input
              type="date"
              value={draftDate}
              onChange={(e) => setDraftDate(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/85 outline-none"
            />
          </div>

          <button className="w-full rounded-2xl py-3 border border-gold-300/30 bg-white/[0.06] text-gold-200 shadow-glow" onClick={createSession}>
            Create
          </button>
          <div className="h-12" />
        </div>
      </Modal>
    </div>
  );
}

function ProgressView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-lg text-white/90 font-semibold">Progress</div>
        <div className="text-[11px] text-white/45">Charts</div>
      </div>

      <Card>
        <div className="text-sm text-white/85">Max Weight Lifted</div>
        <div className="mt-3">
          <MiniLineChart values={[2, 3, 2.8, 3.4, 3.1, 3.6]} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button className="rounded-2xl py-3 border border-white/10 bg-white/[0.04] text-white/70">Workouts</button>
          <button className="rounded-2xl py-3 border border-white/10 bg-white/[0.04] text-white/70">Max Sets Completed</button>
        </div>
      </Card>

      <Card title="Today's Goal">
        <div className="text-sm text-white/85 font-medium">80% Success Rate</div>
        <div className="text-[12px] text-white/45 mt-1">You're on track.</div>
      </Card>
    </div>
  );
}

function PlanView() {
  return (
    <div className="space-y-4">
      <div className="text-lg text-white/90 font-semibold">Progression / Plan</div>

      <Card>
        <div className="flex items-center justify-center py-6">
          <div className="relative w-44 h-44 rounded-full border border-white/10 bg-white/[0.02] flex items-center justify-center">
            <div className="absolute inset-3 rounded-full border border-gold-300/30 shadow-glow" />
            <div className="text-center">
              <div className="text-4xl font-semibold text-white/90">75%</div>
              <div className="text-[11px] text-white/45 mt-2">Progress</div>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Next Targets">
        <div className="flex items-center justify-between text-sm text-white/80">
          <div>Weight</div>
          <div className="text-white/90 font-semibold">20 kg</div>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm text-white/80">
          <div>Reps</div>
          <div className="text-white/90 font-semibold">12 × sets</div>
        </div>
      </Card>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [state, setState] = useState<AscendState>(() => loadState());
  const [bgLoaded, setBgLoaded] = useState(false);
  const debug = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";

  useEffect(() => {
    saveState(state);
  }, [state]);

  const sessions = state.workoutSessions;

  return (
    <div className="min-h-screen bg-noir-950">
      {/* Background silhouette: render as <img> (more reliable on mobile than filtered background-image) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Single silhouette layer. If you can't see it, it's simply too subtle -> boost opacity + reduce blur. */}
        <img
          src={silhouette}
          alt=""
          onLoad={() => setBgLoaded(true)}
          className="absolute left-1/2 top-[58%] w-[980px] max-w-none -translate-x-1/2 -translate-y-1/2"
          style={{
            // Make it clearly perceptible while staying premium.
            opacity: debug ? 0.85 : 0.75,
            filter: debug ? "blur(2px)" : "blur(4px)",
          }}
        />
      </div>
      {/* overlay (lighter) */}
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-b from-black/10 via-black/5 to-black/35 z-10" />

      {debug ? (
        !bgLoaded ? (
          <div className="fixed top-2 right-2 z-[70] text-[10px] px-2 py-1 rounded-full border border-white/10 bg-black/40 text-white/60">
            BG loading…
          </div>
        ) : (
          <div className="fixed top-2 right-2 z-[70] text-[10px] px-2 py-1 rounded-full border border-white/10 bg-black/40 text-white/40">
            BG ok
          </div>
        )
      ) : null}

      <div className="relative z-20 mx-auto max-w-[520px] px-4 pt-6 pb-28">
        <div className="flex items-center justify-between">
          <button className="w-10 h-10 rounded-2xl border border-white/10 bg-white/[0.04] text-white/75">←</button>
          <div className="text-sm text-white/80 font-semibold">{tab === "dashboard" ? "Dashboard" : tab === "workouts" ? "Workout History" : tab === "progress" ? "Progress" : "Progression / Plan"}</div>
          <div className="w-10 h-10" />
        </div>

        <div className="mt-6">
          {tab === "dashboard" && <DashboardView sessions={sessions} />}
          {tab === "workouts" && (
            <WorkoutsView
              sessions={sessions}
              onUpsertSession={(s) =>
                setState((prev) => {
                  const next = prev.workoutSessions.some((x) => x.id === s.id)
                    ? prev.workoutSessions.map((x) => (x.id === s.id ? s : x))
                    : [s, ...prev.workoutSessions];
                  return { ...prev, workoutSessions: next };
                })
              }
            />
          )}
          {tab === "progress" && <ProgressView />}
          {tab === "plan" && <PlanView />}
        </div>
      </div>

      <BottomNav tab={tab} onTab={setTab} />
    </div>
  );
}
