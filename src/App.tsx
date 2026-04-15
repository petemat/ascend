import { useEffect, useState } from "react";
import silhouette from "./assets/silhouette.jpg";
import {
  loadState,
  saveState,
  type AscendState,
  type WorkoutSession,
  type ExerciseSet,
  type PlannedWorkout,
  type PlannedExercise,
} from "./seed";

type Tab = "dashboard" | "workouts" | "progress" | "plan";

type RunStep = { exId: string; setNo: number };

type RunState = {
  open: boolean;
  planned: PlannedWorkout | null;

  // execution order (supports supersets)
  sequence: RunStep[];
  seqIndex: number;

  // editable during run
  currentWeightKg: number;
  currentReps: number;

  // collected
  results: Array<{ exId: string; repsBySet: number[]; weightKg: number }>;
  startedAt: number | null;

  rest: null | {
    kind: "set" | "exercise";
    totalSec: number;
    untilMs: number;
    // applied when rest ends
    advance: {
      seqIndex: number;
      currentWeightKg: number;
      currentReps: number;
      results: Array<{ exId: string; repsBySet: number[]; weightKg: number }>;
    };
  };
};

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

function startOfWeekMonday(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

function isoDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function MiniCalendar(props: { sessions: WorkoutSession[]; onPickDate?: (iso: string) => void }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const workoutDays = new Set(props.sessions.map((s) => s.date));

  const start = startOfWeekMonday(today);
  start.setDate(start.getDate() - 7 * 3); // show current + last 3 weeks

  const days: Date[] = [];
  for (let i = 0; i < 28; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }

  const labels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] text-white/70 font-semibold">Training</div>
          <div className="text-[11px] text-white/35">
            {today.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </div>
        </div>
        <div className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/65">
          4w
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-y-2">
        {labels.map((l) => (
          <div key={l} className="text-[10px] text-white/35 text-center">
            {l}
          </div>
        ))}

        {days.map((d) => {
          const isToday = d.getTime() === today.getTime();
          const inMonth = d.getMonth() === today.getMonth();
          const dayIso = isoDate(d);
          const hasWorkout = workoutDays.has(dayIso);

          return (
            <button
              key={d.toISOString()}
              type="button"
              className="flex flex-col items-center"
              onClick={() => props.onPickDate?.(dayIso)}
            >
              <div
                className={cn(
                  "w-9 h-9 rounded-2xl flex items-center justify-center text-sm tabular-nums",
                  isToday
                    ? "border border-gold-300/35 bg-white/[0.06] text-white/90 shadow-glow"
                    : "border border-transparent",
                  inMonth ? "text-white/85" : "text-white/35",
                  hasWorkout ? "" : "hover:bg-white/[0.03]"
                )}
              >
                {d.getDate()}
              </div>
              <div className="h-2 mt-1 flex items-center justify-center">
                {hasWorkout ? <div className="w-2 h-2 rounded-full bg-gold-300/80" /> : <div className="w-2 h-2" />}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function DashboardView(props: { sessions: WorkoutSession[]; onPickDate?: (iso: string) => void }) {
  const sessions = props.sessions;

  const last = sessions.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];

  // simple "strength progress" proxy: best total volume over last 10 sessions
  const last10 = sessions.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 10).reverse();
  const volumes = last10.map((s) => s.exercises.reduce((sum, e) => sum + (e.weightKg || 0) * (e.setDetails?.reduce((a, r) => a + r, 0) || e.sets * e.reps), 0));

  const totalBest = Math.round(Math.max(0, ...volumes));

  return (
    <div className="space-y-4">
      <MiniCalendar sessions={sessions} onPickDate={props.onPickDate} />

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

function WorkoutSuccessScreen(props: {
  session: WorkoutSession | null;
  onClose: () => void;
  onGoWorkouts: () => void;
  onGoDashboard: () => void;
}) {
  const s = props.session;
  if (!s) return null;

  const mins = typeof s.durationSec === "number" ? Math.max(1, Math.round(s.durationSec / 60)) : null;

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={props.onClose} />

      <div className="absolute left-0 right-0 top-0 bottom-0 mx-auto max-w-[520px] px-4 py-10">
        <div className="h-full flex items-center justify-center">
          <div className="w-full rounded-[32px] border border-white/10 bg-black/60 backdrop-blur-2xl shadow-card overflow-hidden">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-gold-300/25 shadow-glow flex items-center justify-center">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="rgba(241,195,93,0.95)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-lg text-white/90 font-semibold">Workout completed</div>
                    <div className="text-[12px] text-white/45 mt-0.5">{fmtDate(s.date)} · {s.title}</div>
                  </div>
                </div>
                <button className="text-white/55 hover:text-white/80" onClick={props.onClose}>
                  Close
                </button>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="text-[10px] text-white/40">Duration</div>
                  <div className="text-sm text-white/85 font-semibold tabular-nums">{mins ? `${mins} min` : "—"}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="text-[10px] text-white/40">Exercises</div>
                  <div className="text-sm text-white/85 font-semibold tabular-nums">{s.exercises.length}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="text-[10px] text-white/40">Sets</div>
                  <div className="text-sm text-white/85 font-semibold tabular-nums">
                    {s.exercises.reduce((sum, e) => sum + (e.setDetails?.length ?? e.sets ?? 0), 0)}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <div className="text-[12px] text-white/55 mb-2">Nice work. Keep the streak alive.</div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    className="rounded-2xl py-3 border border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.06]"
                    onClick={props.onGoDashboard}
                  >
                    Back to Dashboard
                  </button>
                  <button
                    className="rounded-2xl py-3 border border-gold-300/30 bg-white/[0.06] text-gold-200 shadow-glow"
                    onClick={props.onGoWorkouts}
                  >
                    View in History
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

// (unused) rep-range parser reserved for progression v2

function roundToStep(x: number, step: number) {
  return Math.round(x / step) * step;
}

function weightOptions(base: number, step = 2.5, spanSteps = 6) {
  const opts: number[] = [];
  const b = roundToStep(base, step);
  for (let i = -spanSteps; i <= spanSteps; i++) {
    const v = Math.max(0, roundToStep(b + i * step, step));
    if (!opts.includes(v)) opts.push(v);
  }
  return opts;
}

function repsOptions(max = 30) {
  return Array.from({ length: max + 1 }, (_, i) => i);
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
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  onUpsertSession: (s: WorkoutSession) => void;
  onDeleteSession: (id: string) => void;
}) {
  const sessionsSorted = props.sessions.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selected = props.selectedId ? props.sessions.find((s) => s.id === props.selectedId) : null;

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
    props.onSelectId(s.id);
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg text-white/90 font-semibold">{selected.title}</div>
            <div className="text-[12px] text-white/45 mt-1">
              {fmtDate(selected.date)} · {selected.exercises.length} exercises
              {typeof selected.durationSec === "number" ? ` · ${Math.round(selected.durationSec / 60)} min` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-4 py-2 rounded-2xl border border-white/10 bg-white/[0.04] text-white/75 hover:text-white/90"
              onClick={() => props.onSelectId(null)}
            >
              Back
            </button>
            <button
              className="px-4 py-2 rounded-2xl border border-white/10 bg-white/[0.04] text-white/65 hover:text-white/90"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </button>
          </div>
        </div>

        <Card title="Exercises">
          {selected.exercises.length ? (
            <div className="space-y-3">
              {selected.exercises.map((e) => {
                const weightLabel = e.weightKg === 0 ? "BW" : `${e.weightKg} kg`;
                const isTimed = (e.weightNote ?? "").toLowerCase().includes("sec");
                const details = e.setDetails?.length ? e.setDetails : Array.from({ length: e.sets }, () => e.reps);
                const setLabel = details.join(" · ");
                return (
                  <div key={e.id} className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm text-white/90 font-medium">{e.name}</div>
                      <div className="text-[12px] text-white/45 mt-1">
                        {weightLabel}
                        {e.weightNote ? ` (${e.weightNote})` : ""} · {e.sets} sets
                      </div>
                      <div className="text-[12px] text-white/45 mt-1">
                        {isTimed ? `Time: ${setLabel}s` : `Reps: ${setLabel}`}
                      </div>
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

        <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete workout?">
          <div className="text-sm text-white/70">This will remove the workout from history.</div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              className="rounded-2xl py-3 border border-white/10 bg-white/[0.04] text-white/75"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
            <button
              className="rounded-2xl py-3 border border-white/10 bg-white/[0.04] text-white/90"
              onClick={() => {
                props.onDeleteSession(selected.id);
                setConfirmDelete(false);
                props.onSelectId(null);
              }}
            >
              Delete
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
          <button key={s.id} className="w-full text-left" onClick={() => props.onSelectId(s.id)}>
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

function buildRunSequence(planned: PlannedWorkout): RunStep[] {
  const seq: RunStep[] = [];
  const exs = planned.exercises;

  for (let i = 0; i < exs.length; i++) {
    const e = exs[i]!;
    const sid = e.supersetId;

    if (!sid) {
      for (let s = 1; s <= e.sets; s++) seq.push({ exId: e.id, setNo: s });
      continue;
    }

    // collect contiguous superset block
    const block: PlannedExercise[] = [e];
    let j = i + 1;
    while (j < exs.length && exs[j]?.supersetId === sid) {
      block.push(exs[j]!);
      j++;
    }

    const maxSets = Math.max(...block.map((b) => b.sets));
    for (let set = 1; set <= maxSets; set++) {
      for (const b of block) {
        if (set <= b.sets) seq.push({ exId: b.id, setNo: set });
      }
    }

    i = j - 1;
  }

  return seq;
}

function computeNextWorkout(sessions: WorkoutSession[]): PlannedWorkout {
  const sorted = sessions.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const last = sorted[0];
  const lastByName = new Map<string, ExerciseSet>();

  for (const s of sorted) {
    for (const e of s.exercises) {
      if (!lastByName.has(e.name)) lastByName.set(e.name, e);
    }
  }

  const baseExercises = last
    ? Array.from(new Map(last.exercises.map((e) => [e.name, e])).values())
    : Array.from(lastByName.values()).slice(0, 8);

  const planned: PlannedExercise[] = baseExercises.slice(0, 9).map((e) => {
    const reps = e.reps ?? 10;
    const plannedTarget = Math.max(6, Math.min(15, reps));

    // Simple progression v1: if last setDetails all >= plannedTarget and same weight appears >=2 times in history, bump.
    const hist = sorted
      .flatMap((s) => s.exercises.filter((x) => x.name === e.name))
      .slice(0, 10);

    const lastTwoSameWeight = hist.filter((h) => h.weightKg === e.weightKg).slice(0, 2);
    const achieved = (ex: ExerciseSet) => {
      const repsArr = ex.setDetails?.length ? ex.setDetails : Array.from({ length: ex.sets }, () => ex.reps);
      return repsArr.every((r) => r >= plannedTarget);
    };

    const bump = lastTwoSameWeight.length === 2 && lastTwoSameWeight.every(achieved);
    const nextWeight = e.weightKg === 0 ? 0 : bump ? roundToStep(e.weightKg + 2.5, 2.5) : e.weightKg;

    return {
      id: uid("px"),
      name: e.name,
      category: e.category,
      weightKg: nextWeight,
      sets: Math.max(1, e.sets ?? 3),
      targetReps: plannedTarget,
    };
  });

  return {
    id: uid("pw"),
    date: isoToday(),
    title: last ? `Next: ${last.title}` : "Next Workout",
    exercises: planned,
    createdAt: Date.now(),
  };
}

function WheelPicker(props: { value: number; options: number[]; onChange: (v: number) => void; label: string }) {
  const itemH = 40;
  const pad = 60; // makes the selected item sit between the two lines (center window)
  const ref = useState<{ el: HTMLDivElement | null }>({ el: null })[0];
  const snapTimer = useState<{ t: any }>({ t: null })[0];

  function clampIdx(idx: number) {
    return Math.max(0, Math.min(props.options.length - 1, idx));
  }

  function setIdx(idx: number, snap: boolean) {
    const i = clampIdx(idx);
    const v = props.options[i];
    props.onChange(v);
    if (snap && ref.el) {
      ref.el.scrollTo({ top: i * itemH, behavior: "smooth" });
    }
  }

  // Keep scroll position aligned to the controlled value.
  useEffect(() => {
    const el = ref.el;
    if (!el) return;
    const idx = Math.max(0, props.options.indexOf(props.value));
    const targetTop = idx * itemH;
    // Only adjust if we're far off (avoid fighting user scroll)
    if (Math.abs(el.scrollTop - targetTop) > itemH * 0.6) {
      el.scrollTo({ top: targetTop, behavior: "auto" });
    }
  }, [props.value, props.options]);

  return (
    <div className="flex-1">
      <div className="text-[11px] text-white/45 mb-2">{props.label}</div>
      <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-10 border-y border-gold-300/25 bg-white/[0.02]" />
        <div
          ref={(el) => {
            ref.el = el;
          }}
          className="h-40 overflow-y-auto snap-y snap-mandatory px-2"
          style={{
            paddingTop: pad,
            paddingBottom: pad,
            scrollPaddingTop: pad,
            scrollPaddingBottom: pad,
          }}
          onScroll={(e) => {
            const el = e.currentTarget;
            const idx = Math.round(el.scrollTop / itemH);
            setIdx(idx, false);

            // magnetic snap after user stops scrolling
            if (snapTimer.t) clearTimeout(snapTimer.t);
            snapTimer.t = setTimeout(() => {
              const idx2 = Math.round(el.scrollTop / itemH);
              setIdx(idx2, true);
            }, 140);
          }}
          onTouchEnd={(e) => {
            const el = e.currentTarget;
            const idx = Math.round(el.scrollTop / itemH);
            setIdx(idx, true);
          }}
          onMouseUp={(e) => {
            const el = e.currentTarget;
            const idx = Math.round(el.scrollTop / itemH);
            setIdx(idx, true);
          }}
        >
          {props.options.map((o) => (
            <div
              key={o}
              className={cn(
                "h-10 snap-center flex items-center justify-center text-sm",
                o === props.value ? "text-gold-200" : "text-white/65"
              )}
            >
              {o}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlanView(props: {
  sessions: WorkoutSession[];
  plannedWorkout: PlannedWorkout | null | undefined;
  onPlan: (p: PlannedWorkout) => void;
  onStart: (p: PlannedWorkout) => void;
  onLoadTodayPlan: () => void;
  onResume: () => void;
  hasResume: boolean;
}) {
  const planned = props.plannedWorkout ?? null;
  return (
    <div className="space-y-4">
      <div className="text-lg text-white/90 font-semibold">Progression / Plan</div>

      {props.hasResume ? (
        <Card title="In Progress">
          <div className="text-sm text-white/90 font-medium">Workout in progress</div>
          <div className="text-[12px] text-white/45 mt-1">Resume where you left off.</div>
          <button
            className="mt-4 w-full rounded-2xl py-3 border border-gold-300/30 bg-white/[0.06] text-gold-200 shadow-glow"
            onClick={props.onResume}
          >
            Resume
          </button>
        </Card>
      ) : null}

      <Card title="Next Workout">
        <div className="text-sm text-white/90 font-medium">{planned ? planned.title : "No plan yet"}</div>
        <div className="text-[12px] text-white/45 mt-1">{planned ? `${planned.exercises.length} exercises` : "Generate a plan based on your history."}</div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            className="rounded-2xl py-3 border border-white/10 bg-white/[0.04] text-white/80"
            onClick={props.onLoadTodayPlan}
          >
            Load Today
          </button>
          <button
            className="rounded-2xl py-3 border border-white/10 bg-white/[0.04] text-white/80"
            onClick={() => props.onPlan(computeNextWorkout(props.sessions))}
          >
            Generate
          </button>
        </div>

        <button
          className={cn(
            "mt-3 w-full rounded-2xl py-3 border border-gold-300/30 bg-white/[0.06] text-gold-200 shadow-glow",
            planned ? "" : "opacity-40"
          )}
          onClick={() => planned && props.onStart(planned)}
          disabled={!planned}
        >
          Start
        </button>
      </Card>

      {planned ? (
        <Card title="Targets">
          <div className="space-y-4">
            {(() => {
              const out: any[] = [];
              const exs = planned.exercises;
              for (let i = 0; i < exs.length; i++) {
                const e = exs[i]!;
                if (!e.supersetId) {
                  out.push(
                    <div key={e.id} className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm text-white/90 font-medium">{e.name}</div>
                        <div className="text-[12px] text-white/45 mt-1">
                          {e.weightKg === 0 ? "BW" : `${e.weightKg} kg`} · {e.sets} sets · target {e.targetReps}
                        </div>
                      </div>
                      <div className="text-[11px] text-white/35">Next</div>
                    </div>
                  );
                  continue;
                }

                const sid = e.supersetId;
                const block: PlannedExercise[] = [e];
                let j = i + 1;
                while (j < exs.length && exs[j]?.supersetId === sid) {
                  block.push(exs[j]!);
                  j++;
                }

                out.push(
                  <div key={`superset-${sid}-${i}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[12px] text-white/75 font-semibold">Superset {sid}</div>
                      <div className="text-[11px] text-white/35">Alternating</div>
                    </div>
                    <div className="mt-3 space-y-3">
                      {block.map((b) => (
                        <div key={b.id} className="flex items-center justify-between gap-4">
                          <div>
                            <div className="text-sm text-white/90 font-medium">{b.name}</div>
                            <div className="text-[12px] text-white/45 mt-1">
                              {b.weightKg === 0 ? "BW" : `${b.weightKg} kg`} · {b.sets} sets · target {b.targetReps}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );

                i = j - 1;
              }
              return out;
            })()}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function fmtElapsed(ms: number) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function RunWorkoutModal(props: {
  run: RunState;
  onClose: () => void;
  onUpdate: (patch: Partial<RunState>) => void;
  onFinish: (session: WorkoutSession) => void;
}) {
  const planned = props.run.planned;
  if (!props.run.open || !planned) return null;
  const plannedLocal = planned;

  const step = props.run.sequence[props.run.seqIndex];
  const ex = step ? plannedLocal.exercises.find((x) => x.id === step.exId)! : plannedLocal.exercises[0]!;
  const setNo = step ? step.setNo : 1;

  const weightOpts = weightOptions(ex.weightKg, 2.5, 8);
  const repsOpts = repsOptions(30);

  function next() {
    // prevent double-actions while resting
    if (props.run.rest) return;

    // append rep into results
    const existing = props.run.results.find((r) => r.exId === ex.id);
    const reps = props.run.currentReps;
    const weight = props.run.currentWeightKg;

    const results = existing
      ? props.run.results.map((r) => (r.exId === ex.id ? { ...r, weightKg: weight, repsBySet: [...r.repsBySet, reps] } : r))
      : [...props.run.results, { exId: ex.id, weightKg: weight, repsBySet: [reps] }];

    const isLastStep = props.run.seqIndex >= props.run.sequence.length - 1;

    if (isLastStep) {
      // build WorkoutSession
      const finishedAt = Date.now();
      const startedAtMs = props.run.startedAt ?? finishedAt;

      const exercises: ExerciseSet[] = plannedLocal.exercises.map((p) => {
        const rr = results.find((r) => r.exId === p.id);
        const setDetails = rr?.repsBySet?.length ? rr.repsBySet : Array.from({ length: p.sets }, () => p.targetReps);
        return {
          id: uid("ex"),
          name: p.name,
          category: p.category,
          weightKg: rr ? rr.weightKg : p.weightKg,
          sets: p.sets,
          reps: setDetails[0] ?? p.targetReps,
          setDetails,
          source: "confirmed",
        };
      });

      const session: WorkoutSession = {
        id: uid("ws"),
        date: plannedLocal.date,
        title: plannedLocal.title.replace(/^Next:\s*/i, ""),
        source: "confirmed",
        exercises,
        startedAt: startedAtMs,
        finishedAt,
        durationSec: Math.max(0, Math.round((finishedAt - startedAtMs) / 1000)),
      };

      props.onFinish(session);
      return;
    }

    const nextStep = props.run.sequence[props.run.seqIndex + 1];
    const nextEx = nextStep ? plannedLocal.exercises.find((x) => x.id === nextStep.exId) : null;

    const sameExercise = !!nextEx && nextEx.id === ex.id;
    const sameSuperset = !!nextEx && !!ex.supersetId && nextEx.supersetId === ex.supersetId;

    // Advance patch is applied AFTER rest.
    const restSec = sameSuperset ? 60 : sameExercise ? 90 : 150;
    const nextPatch = {
      seqIndex: props.run.seqIndex + 1,
      currentWeightKg: nextEx ? nextEx.weightKg : props.run.currentWeightKg,
      currentReps: nextEx ? nextEx.targetReps : props.run.currentReps,
      results,
    };

    props.onUpdate({
      rest: {
        kind: sameSuperset || sameExercise ? "set" : "exercise",
        totalSec: restSec,
        untilMs: Date.now() + restSec * 1000,
        advance: nextPatch,
      },
      results,
    });
  }

  const startedAt = props.run.startedAt ?? Date.now();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // Rest timer auto-advance
  useEffect(() => {
    if (!props.run.open) return;
    const rest = props.run.rest;
    if (!rest) return;
    if (Date.now() < rest.untilMs) return;
    props.onUpdate({
      rest: null,
      seqIndex: rest.advance.seqIndex,
      currentWeightKg: rest.advance.currentWeightKg,
      currentReps: rest.advance.currentReps,
      results: rest.advance.results,
    });
  }, [props.run.open, props.run.rest, props.onUpdate]);

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/70" onClick={props.onClose} />
      <div className="absolute left-0 right-0 bottom-0 mx-auto max-w-[520px] px-4 pb-28">
        <div className="rounded-3xl border border-white/10 bg-black/60 backdrop-blur-2xl shadow-card overflow-hidden">
          <div className="px-5 pt-4 pb-3 flex items-center justify-between">
            <div>
              <div className="text-sm text-white/85 font-semibold">{ex.name}</div>
              <div className="text-[11px] text-white/45 mt-1">
                Set {setNo}/{ex.sets} · Step {props.run.seqIndex + 1}/{props.run.sequence.length} · {fmtElapsed(now - startedAt)}
              </div>
            </div>
            <button className="text-white/55 hover:text-white/80" onClick={props.onClose}>
              Exit
            </button>
          </div>

          <div className="px-5 pb-5">
            {props.run.rest ? (
              (() => {
                const remainingSec = Math.max(0, Math.ceil((props.run.rest!.untilMs - now) / 1000));
                const pct = props.run.rest!.totalSec ? remainingSec / props.run.rest!.totalSec : 0;
                return (
                  <div>
                    <div className="text-[11px] text-white/45 mb-2">Rest ({props.run.rest!.kind})</div>
                    <div className="text-5xl font-semibold tracking-tight tabular-nums text-white/90">
                      {fmtClock(remainingSec)}
                    </div>
                    <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-gold-300/70"
                        style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%` }}
                      />
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <button
                        className="rounded-2xl py-3 border border-white/10 bg-white/[0.04] text-white/75"
                        onClick={() => {
                          const rest = props.run.rest!;
                          props.onUpdate({
                            rest: null,
                            seqIndex: rest.advance.seqIndex,
                            currentWeightKg: rest.advance.currentWeightKg,
                            currentReps: rest.advance.currentReps,
                            results: rest.advance.results,
                          });
                        }}
                      >
                        Skip
                      </button>
                      <button
                        className="rounded-2xl py-3 border border-white/10 bg-white/[0.04] text-white/75"
                        onClick={() => {
                          const rest = props.run.rest!;
                          props.onUpdate({
                            rest: {
                              ...rest,
                              totalSec: rest.totalSec + 15,
                              untilMs: rest.untilMs + 15000,
                            },
                          });
                        }}
                      >
                        +15s
                      </button>
                      <button
                        className="rounded-2xl py-3 border border-white/10 bg-white/[0.04] text-white/75"
                        onClick={() => {
                          const rest = props.run.rest!;
                          props.onUpdate({
                            rest: {
                              ...rest,
                              totalSec: Math.max(1, rest.totalSec - 15),
                              untilMs: Math.max(Date.now(), rest.untilMs - 15000),
                            },
                          });
                        }}
                      >
                        -15s
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <WheelPicker
                    label="Weight (kg)"
                    value={props.run.currentWeightKg}
                    options={weightOpts}
                    onChange={(v) => props.onUpdate({ currentWeightKg: v })}
                  />
                  <WheelPicker
                    label="Reps"
                    value={props.run.currentReps}
                    options={repsOpts}
                    onChange={(v) => props.onUpdate({ currentReps: v })}
                  />
                </div>

                <button className="mt-4 w-full rounded-2xl py-3 border border-gold-300/30 bg-white/[0.06] text-gold-200 shadow-glow" onClick={next}>
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [state, setState] = useState<AscendState>(() => loadState());
  const [successSession, setSuccessSession] = useState<WorkoutSession | null>(null);
  const [workoutsSelectedId, setWorkoutsSelectedId] = useState<string | null>(null);
  const [bgLoaded, setBgLoaded] = useState(false);
  const debug = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";

  const RUN_STORAGE_KEY = "ascend.run.v1";
  const [run, setRun] = useState<RunState>(() => {
    try {
      const raw = localStorage.getItem(RUN_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const planned: PlannedWorkout | null = parsed?.planned ?? null;
        const sequence: RunStep[] = Array.isArray(parsed?.sequence)
          ? parsed.sequence
          : planned
            ? buildRunSequence(planned)
            : [];

        return {
          open: false, // never auto-open modal
          planned,
          sequence,
          seqIndex: parsed?.seqIndex ?? 0,
          currentWeightKg: parsed?.currentWeightKg ?? 0,
          currentReps: parsed?.currentReps ?? 10,
          results: Array.isArray(parsed?.results) ? parsed.results : [],
          startedAt: parsed?.startedAt ?? null,
          rest: parsed?.rest ?? null,
        } as RunState;
      }
    } catch {}
    return {
      open: false,
      planned: null,
      sequence: [],
      seqIndex: 0,
      currentWeightKg: 0,
      currentReps: 10,
      results: [],
      startedAt: null,
      rest: null,
    };
  });

  useEffect(() => {
    try {
      const { open, ...persist } = run;
      localStorage.setItem(RUN_STORAGE_KEY, JSON.stringify(persist));
    } catch {}
  }, [run]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const sessions = state.workoutSessions;

  const swipe = useState<{ x: number; y: number; t: number; active: boolean }>({ x: 0, y: 0, t: 0, active: false })[0];
  const tabOrder: Tab[] = ["dashboard", "workouts", "progress", "plan"];

  function shiftTab(delta: number) {
    const i = tabOrder.indexOf(tab);
    const j = Math.max(0, Math.min(tabOrder.length - 1, i + delta));
    if (j !== i) setTab(tabOrder[j]!);
  }

  const overlaysOpen = run.open || !!successSession; // if overlays are up, avoid accidental navigation

  function onSwipeStart(t: { clientX: number; clientY: number } | null | undefined) {
    if (overlaysOpen) return;
    if (!t) return;
    swipe.x = t.clientX;
    swipe.y = t.clientY;
    swipe.t = Date.now();
    swipe.active = true;
  }

  function onSwipeEnd(t: { clientX: number; clientY: number } | null | undefined) {
    if (overlaysOpen) return;
    if (!swipe.active) return;
    swipe.active = false;
    if (!t) return;

    const dx = t.clientX - swipe.x;
    const dy = t.clientY - swipe.y;
    const dt = Date.now() - swipe.t;

    // Horizontal swipe: avoid triggering during vertical scroll.
    if (dt > 700) return;
    if (Math.abs(dx) < 60) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.2) return;

    if (dx < 0) shiftTab(+1); // swipe left -> next
    else shiftTab(-1); // swipe right -> prev
  }

  return (
    <div
      className="min-h-screen bg-noir-950"
      onTouchStartCapture={(e) => onSwipeStart(e.touches[0])}
      onTouchEndCapture={(e) => onSwipeEnd(e.changedTouches[0])}
    >
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
        <div className="flex items-center justify-center">
          <div className="text-sm text-white/80 font-semibold">
            {tab === "dashboard" ? "Dashboard" : tab === "workouts" ? "Workout History" : tab === "progress" ? "Progress" : "Progression / Plan"}
          </div>
        </div>

        <div className="mt-6">
          {tab === "dashboard" && (
            <DashboardView
              sessions={sessions}
              onPickDate={(iso) => {
                const match = sessions
                  .filter((s) => s.date === iso)
                  .slice()
                  .sort((a, b) => String(b.id).localeCompare(String(a.id)))[0];
                if (match) setWorkoutsSelectedId(match.id);
                setTab("workouts");
              }}
            />
          )}
          {tab === "workouts" && (
            <WorkoutsView
              sessions={sessions}
              selectedId={workoutsSelectedId}
              onSelectId={setWorkoutsSelectedId}
              onUpsertSession={(s) =>
                setState((prev) => {
                  const next = prev.workoutSessions.some((x) => x.id === s.id)
                    ? prev.workoutSessions.map((x) => (x.id === s.id ? s : x))
                    : [s, ...prev.workoutSessions];
                  return { ...prev, workoutSessions: next };
                })
              }
              onDeleteSession={(id) =>
                setState((prev) => ({
                  ...prev,
                  workoutSessions: prev.workoutSessions.filter((s) => s.id !== id),
                }))
              }
            />
          )}
          {tab === "progress" && <ProgressView />}
          {tab === "plan" && (
            <PlanView
              sessions={sessions}
              plannedWorkout={state.plannedWorkout}
              onPlan={(p) => setState((prev) => ({ ...prev, plannedWorkout: p }))}
              onLoadTodayPlan={() => {
                const p: PlannedWorkout = {
                  id: uid("pw"),
                  date: isoToday(),
                  title: "Today: Push (Longevity)",
                  createdAt: Date.now(),
                  exercises: [
                    // A) Chest + Shoulder
                    {
                      id: uid("px"),
                      name: "Incline DB Press (1x12@17.5, 2x8-10@20)",
                      category: "chest",
                      weightKg: 20,
                      sets: 3,
                      targetReps: 10,
                    },
                    {
                      id: uid("px"),
                      name: "Lateral Raise (6-7 kg)",
                      category: "shoulders",
                      weightKg: 6,
                      sets: 3,
                      targetReps: 12,
                      supersetId: "A",
                    },
                    {
                      id: uid("px"),
                      name: "Push-Up (max clean)",
                      category: "chest",
                      weightKg: 0,
                      sets: 3,
                      targetReps: 15,
                      supersetId: "A",
                    },

                    // B) Shoulder + Triceps
                    {
                      id: uid("px"),
                      name: "Dumbbell Shoulder Press (12.5-15 kg)",
                      category: "shoulders",
                      weightKg: 12.5,
                      sets: 3,
                      targetReps: 12,
                      supersetId: "B",
                    },
                    {
                      id: uid("px"),
                      name: "Triceps (Dips or Cable)",
                      category: "arms",
                      weightKg: 0,
                      sets: 3,
                      targetReps: 12,
                      supersetId: "B",
                    },
                    {
                      id: uid("px"),
                      name: "Face Pull (25 kg)",
                      category: "shoulders",
                      weightKg: 25,
                      sets: 3,
                      targetReps: 15,
                    },

                    // C) Legs (short)
                    {
                      id: uid("px"),
                      name: "Goblet Squat (17.5-20 kg)",
                      category: "legs",
                      weightKg: 17.5,
                      sets: 3,
                      targetReps: 15,
                    },
                    {
                      id: uid("px"),
                      name: "Lunges (optional) — 10/leg",
                      category: "legs",
                      weightKg: 0,
                      sets: 2,
                      targetReps: 10,
                    },

                    // D) Core
                    {
                      id: uid("px"),
                      name: "Leg Raise",
                      category: "core",
                      weightKg: 0,
                      sets: 3,
                      targetReps: 15,
                      supersetId: "D",
                    },
                    {
                      id: uid("px"),
                      name: "Plank (45-60s)",
                      category: "core",
                      weightKg: 0,
                      sets: 3,
                      targetReps: 60,
                      supersetId: "D",
                    },
                  ],
                };
                setState((prev) => ({ ...prev, plannedWorkout: p }));
              }}
              hasResume={!!run.planned}
              onResume={() => setRun((prev) => ({ ...prev, open: true }))}
              onStart={(p) => {
                const sequence = buildRunSequence(p);
                const firstStep = sequence[0];
                const firstEx = firstStep ? p.exercises.find((x) => x.id === firstStep.exId) : p.exercises[0];
                setRun({
                  open: true,
                  planned: p,
                  sequence,
                  seqIndex: 0,
                  currentWeightKg: firstEx?.weightKg ?? 0,
                  currentReps: firstEx?.targetReps ?? 10,
                  results: [],
                  startedAt: Date.now(),
                  rest: null,
                } as RunState);
              }}
            />
          )}
        </div>
      </div>

      <BottomNav tab={tab} onTab={setTab} />

      <RunWorkoutModal
        run={run}
        onClose={() => setRun((prev) => ({ ...prev, open: false }))}
        onUpdate={(patch) => setRun((prev) => ({ ...prev, ...patch }))}
        onFinish={(session) => {
          setState((prev) => ({
            ...prev,
            workoutSessions: [session, ...prev.workoutSessions],
            plannedWorkout: null,
          }));
          setRun({
            open: false,
            planned: null,
            sequence: [],
            seqIndex: 0,
            currentWeightKg: 0,
            currentReps: 10,
            results: [],
            startedAt: null,
            rest: null,
          });
          try {
            localStorage.removeItem("ascend.run.v1");
          } catch {}
          setSuccessSession(session);
        }}
      />

      <WorkoutSuccessScreen
        session={successSession}
        onClose={() => setSuccessSession(null)}
        onGoDashboard={() => {
          setSuccessSession(null);
          setTab("dashboard");
        }}
        onGoWorkouts={() => {
          setSuccessSession(null);
          setTab("workouts");
        }}
      />
    </div>
  );
}
