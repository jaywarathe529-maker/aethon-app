
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "./context/AuthContext";

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const S = {
  get: (k, fallback = null) => { try { const v = localStorage.getItem("aethon_" + k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set: (k, v) => { try { localStorage.setItem("aethon_" + k, JSON.stringify(v)); } catch {} },
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const GOALS = ["Fat Loss", "Muscle Gain", "Body Recomposition", "Strength Building", "General Fitness"];
const TABS = ["dashboard", "body", "workout", "habits", "insights", "profile"];
const TAB_ICONS = { dashboard: "⬡", body: "◈", workout: "△", habits: "◎", insights: "✦", profile: "◐" };
const TAB_LABELS = { dashboard: "Home", body: "Body", workout: "Train", habits: "Habits", insights: "AI", profile: "Me" };
const EXERCISES = ["Bench Press", "Squat", "Deadlift", "OHP", "Pull-Up", "Barbell Row", "Incline Press", "Leg Press", "Cable Fly", "Skull Crusher", "Bicep Curl", "Lateral Raise"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─── UTILITIES ────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n, d = 1) => n == null ? "—" : Number(n).toFixed(d);
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const pct = (v, max) => clamp((v / max) * 100, 0, 100);

function scoreColor(s) {
  if (s >= 80) return "#00e5a0";
  if (s >= 60) return "#f5c518";
  if (s >= 40) return "#ff8c42";
  return "#ff4d6d";
}
function scoreLabel(s) {
  if (s >= 85) return "Excellent";
  if (s >= 70) return "Good Progress";
  if (s >= 55) return "On Track";
  if (s >= 40) return "Needs Work";
  return "Getting Started";
}

// ─── AI INSIGHTS ENGINE (rule-based + Claude API) ─────────────────────────────
function generateLocalInsights(profile, bodyLogs, workouts, habits) {
  const insights = [];
  const recentBody = bodyLogs.slice(-8);
  const recentWorkouts = workouts.slice(-14);
  const recentHabits = habits.slice(-7);

  if (recentBody.length >= 2) {
    const first = recentBody[0], last = recentBody[recentBody.length - 1];
    const wDiff = (last.weight || 0) - (first.weight || 0);
    const wDiff2 = (last.waist || 0) - (first.waist || 0);
    if (wDiff > 1 && Math.abs(wDiff2) < 0.5) insights.push({ type: "positive", text: `Weight increased ${fmt(wDiff)} kg while waist stayed stable — likely muscle gain.`, icon: "◈" });
    if (wDiff < -1 && wDiff2 < -1) insights.push({ type: "positive", text: `Down ${fmt(Math.abs(wDiff))} kg and waist is ${fmt(Math.abs(wDiff2))} cm smaller. Fat loss is happening.`, icon: "✦" });
    if (wDiff > 2 && wDiff2 > 1.5) insights.push({ type: "warning", text: "Weight and waist are both increasing. Consider reviewing nutrition.", icon: "△" });
  }

  const workoutDays = new Set(recentWorkouts.map(w => w.date)).size;
  if (workoutDays >= 5) insights.push({ type: "positive", text: `${workoutDays} training days in the last 2 weeks — excellent consistency.`, icon: "△" });
  if (workoutDays <= 2 && recentWorkouts.length > 0) insights.push({ type: "warning", text: "Workout frequency has dropped significantly. Try to hit at least 4 sessions this week.", icon: "△" });

  if (recentHabits.length >= 5) {
    const avgSleep = recentHabits.reduce((a, h) => a + (h.sleep || 0), 0) / recentHabits.length;
    const avgWater = recentHabits.reduce((a, h) => a + (h.water || 0), 0) / recentHabits.length;
    if (avgSleep < 6.5) insights.push({ type: "warning", text: `Average sleep is only ${fmt(avgSleep)} hours. Poor recovery limits muscle growth significantly.`, icon: "◎" });
    if (avgSleep >= 7.5) insights.push({ type: "positive", text: `Averaging ${fmt(avgSleep)} hours sleep — great recovery foundation.`, icon: "◎" });
    if (avgWater < 2.5) insights.push({ type: "info", text: `Hydration averaging ${fmt(avgWater)}L/day. Aim for 3–4L for optimal performance.`, icon: "◎" });
  }

  const prs = {};
  workouts.forEach(w => {
    if (!prs[w.exercise] || w.weight > prs[w.exercise]) prs[w.exercise] = w.weight;
  });
  const recentPRs = recentWorkouts.filter(w => prs[w.exercise] && w.weight >= prs[w.exercise]);
  if (recentPRs.length > 0) insights.push({ type: "positive", text: `New personal record on ${recentPRs[0].exercise} — strength is progressing.`, icon: "△" });

  if (insights.length === 0) insights.push({ type: "info", text: "Keep logging consistently — insights improve with more data.", icon: "✦" });
  return insights;
}

// ─── FITNESS SCORE ────────────────────────────────────────────────────────────
function calcScore(workouts, habits, bodyLogs) {
  const recentW = workouts.filter(w => {
    const d = new Date(w.date), now = new Date();
    return (now - d) / 864e5 <= 7;
  });
  const recentH = habits.slice(-7);

  const training = clamp((recentW.length / 5) * 25, 0, 25);
  const avgProtein = recentH.length ? recentH.reduce((a, h) => a + (h.protein ? 1 : 0), 0) / recentH.length : 0;
  const avgWater = recentH.length ? recentH.reduce((a, h) => a + clamp((h.water || 0) / 3.5, 0, 1), 0) / recentH.length : 0;
  const nutrition = clamp((avgProtein * 0.6 + avgWater * 0.4) * 25, 0, 25);
  const avgSleep = recentH.length ? recentH.reduce((a, h) => a + clamp((h.sleep || 0) / 8, 0, 1), 0) / recentH.length : 0;
  const recovery = clamp(avgSleep * 25, 0, 25);
  const gymDays = recentH.filter(h => h.gym).length;
  const consistency = clamp((gymDays / 5) * 25, 0, 25);

  return {
    total: Math.round(training + nutrition + recovery + consistency),
    training: Math.round(training),
    nutrition: Math.round(nutrition),
    recovery: Math.round(recovery),
    consistency: Math.round(consistency),
  };
}

// ─── ANIMATED RING ────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 160 }) {
  const r = size * 0.38, cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e1e2e" strokeWidth={size * 0.07} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={size * 0.07}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)", filter: `drop-shadow(0 0 8px ${color}88)` }} />
      <text x={cx} y={cy - 4} textAnchor="middle" fill={color}
        style={{ fontSize: size * 0.22, fontWeight: 700, transform: "rotate(90deg)", transformOrigin: `${cx}px ${cy}px`, fontFamily: "'Syne', sans-serif" }}>
        {score}
      </text>
      <text x={cx} y={cy + size * 0.14} textAnchor="middle" fill="#666"
        style={{ fontSize: size * 0.09, transform: "rotate(90deg)", transformOrigin: `${cx}px ${cy}px`, fontFamily: "'DM Sans', sans-serif" }}>
        {scoreLabel(score)}
      </text>
    </svg>
  );
}

// ─── MINI CHART ───────────────────────────────────────────────────────────────
function Sparkline({ data, color = "#00e5a0", height = 48, width = 200 }) {
  if (!data || data.length < 2) return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 11 }}>Not enough data</div>;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((v - min) / range) * (height - 8) - 4;
        return i === data.length - 1 ? <circle key={i} cx={x} cy={y} r="3" fill={color} /> : null;
      })}
    </svg>
  );
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({ name: "", age: "", gender: "Male", height: "", weight: "", goal: GOALS[0] });

  const steps = [
    { label: "What's your name?", field: "name", type: "text", placeholder: "Your name" },
    { label: "How old are you?", field: "age", type: "number", placeholder: "Age" },
    { label: "Your gender", field: "gender", type: "select", options: ["Male", "Female", "Other"] },
    { label: "Height (cm)", field: "height", type: "number", placeholder: "e.g. 175" },
    { label: "Current weight (kg)", field: "weight", type: "number", placeholder: "e.g. 75" },
    { label: "Primary goal", field: "goal", type: "select", options: GOALS },
  ];

  const cur = steps[step];
  const canNext = data[cur.field]?.toString().trim().length > 0;

  return (
    <div style={{ minHeight: "100vh", background: "#080810", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 30% 20%, #00e5a018 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, #7c3aed18 0%, transparent 60%)", pointerEvents: "none" }} />
      <div style={{ maxWidth: 420, width: "100%", position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 36, fontFamily: "'Syne', sans-serif", fontWeight: 800, letterSpacing: -1, background: "linear-gradient(135deg, #00e5a0, #7c3aed)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 4 }}>AETHON</div>
          <div style={{ color: "#444", fontSize: 13, letterSpacing: 3, textTransform: "uppercase" }}>Fitness Intelligence</div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 32 }}>
            {steps.map((_, i) => (
              <div key={i} style={{ flex: 1, height: 2, borderRadius: 2, background: i <= step ? "#00e5a0" : "#1e1e2e", transition: "background 0.3s" }} />
            ))}
          </div>
        </div>

        <div style={{ background: "#0d0d1a", border: "1px solid #1a1a2e", borderRadius: 16, padding: 32 }}>
          <div style={{ color: "#888", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Step {step + 1} of {steps.length}</div>
          <div style={{ color: "#fff", fontSize: 22, fontWeight: 600, marginBottom: 24, fontFamily: "'Syne', sans-serif" }}>{cur.label}</div>

          {cur.type === "select" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {cur.options.map(opt => (
                <button key={opt} onClick={() => setData(d => ({ ...d, [cur.field]: opt }))}
                  style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${data[cur.field] === opt ? "#00e5a0" : "#1e1e2e"}`, background: data[cur.field] === opt ? "#00e5a012" : "#0a0a14", color: data[cur.field] === opt ? "#00e5a0" : "#888", cursor: "pointer", textAlign: "left", fontSize: 14, transition: "all 0.2s" }}>
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <input type={cur.type} placeholder={cur.placeholder} value={data[cur.field]}
              onChange={e => setData(d => ({ ...d, [cur.field]: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && canNext && (step < steps.length - 1 ? setStep(s => s + 1) : onComplete(data))}
              style={{ width: "100%", padding: "14px 16px", background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 10, color: "#fff", fontSize: 18, outline: "none", fontFamily: "'DM Sans', sans-serif" }}
              autoFocus />
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                style={{ flex: 1, padding: "13px", borderRadius: 10, border: "1px solid #1e1e2e", background: "transparent", color: "#666", cursor: "pointer", fontSize: 14 }}>
                Back
              </button>
            )}
            <button onClick={() => step < steps.length - 1 ? setStep(s => s + 1) : onComplete(data)}
              disabled={!canNext}
              style={{ flex: 2, padding: "13px", borderRadius: 10, border: "none", background: canNext ? "linear-gradient(135deg, #00e5a0, #00b87a)" : "#1e1e2e", color: canNext ? "#080810" : "#333", cursor: canNext ? "pointer" : "not-allowed", fontSize: 14, fontWeight: 700, transition: "all 0.2s" }}>
              {step < steps.length - 1 ? "Continue →" : "Launch Aethon →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ profile, bodyLogs, workouts, habits, score, insights, setTab }) {
  const lastBody = bodyLogs[bodyLogs.length - 1] || {};
  const prevBody = bodyLogs[bodyLogs.length - 2] || {};
  const weightDiff = lastBody.weight && prevBody.weight ? lastBody.weight - prevBody.weight : null;
  const todayH = habits.find(h => h.date === today()) || {};
  const weekWorkouts = workouts.filter(w => { const d = new Date(w.date), n = new Date(); return (n - d) / 864e5 <= 7; });
  const weightData = bodyLogs.slice(-12).map(b => b.weight).filter(Boolean);
  const topInsight = insights[0];

  return (
    <div style={{ padding: "0 0 80px" }}>
      {/* Header */}
      <div style={{ padding: "32px 20px 20px", background: "linear-gradient(180deg, #0d0d1a 0%, transparent 100%)" }}>
        <div style={{ color: "#444", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", fontFamily: "'Syne', sans-serif" }}>
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {profile.name?.split(" ")[0]} 👋
        </div>
      </div>

      {/* Score card */}
      <div style={{ margin: "0 16px 16px", background: "linear-gradient(135deg, #0d0d1a, #0f0f1e)", border: "1px solid #1a1a2e", borderRadius: 20, padding: "24px 20px", display: "flex", alignItems: "center", gap: 20 }}>
        <ScoreRing score={score.total} size={130} />
        <div style={{ flex: 1 }}>
          <div style={{ color: "#444", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Fitness Score</div>
          <div style={{ color: scoreColor(score.total), fontSize: 28, fontWeight: 800, fontFamily: "'Syne', sans-serif", lineHeight: 1 }}>{scoreLabel(score.total)}</div>
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
            {[["Training", score.training, "#00e5a0"], ["Nutrition", score.nutrition, "#7c3aed"], ["Recovery", score.recovery, "#f5c518"], ["Consistency", score.consistency, "#ff8c42"]].map(([label, val, color]) => (
              <div key={label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#444", marginBottom: 2 }}>
                  <span>{label}</span><span style={{ color }}>{val}/25</span>
                </div>
                <div style={{ height: 3, background: "#1e1e2e", borderRadius: 2 }}>
                  <div style={{ height: "100%", width: `${pct(val, 25)}%`, background: color, borderRadius: 2, transition: "width 1s ease" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, margin: "0 16px 16px" }}>
        {[
          { label: "Weight", value: lastBody.weight ? `${lastBody.weight} kg` : "—", sub: weightDiff != null ? `${weightDiff > 0 ? "+" : ""}${fmt(weightDiff)} kg` : "No change", subColor: weightDiff === null ? "#444" : profile.goal === "Fat Loss" ? (weightDiff < 0 ? "#00e5a0" : "#ff4d6d") : (weightDiff > 0 ? "#00e5a0" : "#ff4d6d") },
          { label: "Sessions", value: weekWorkouts.length, sub: "this week", subColor: "#444" },
          { label: "Streak", value: `${todayH.gym ? "🔥" : "—"}`, sub: `${habits.filter(h => h.gym).slice(-7).length}d / 7`, subColor: "#f5c518" },
        ].map(({ label, value, sub, subColor }) => (
          <div key={label} style={{ background: "#0d0d1a", border: "1px solid #1a1a2e", borderRadius: 14, padding: "14px 12px", textAlign: "center" }}>
            <div style={{ color: "#444", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{value}</div>
            <div style={{ fontSize: 11, color: subColor, marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Weight trend */}
      {weightData.length >= 2 && (
        <div style={{ margin: "0 16px 16px", background: "#0d0d1a", border: "1px solid #1a1a2e", borderRadius: 16, padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ color: "#888", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>Weight Trend</div>
            <div style={{ color: "#00e5a0", fontSize: 13, fontWeight: 600 }}>{lastBody.weight} kg</div>
          </div>
          <Sparkline data={weightData} color="#00e5a0" height={56} />
        </div>
      )}

      {/* Today's habits */}
      <div style={{ margin: "0 16px 16px", background: "#0d0d1a", border: "1px solid #1a1a2e", borderRadius: 16, padding: 16 }}>
        <div style={{ color: "#888", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>Today's Habits</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: "Gym", icon: "△", done: todayH.gym, val: todayH.gym ? "Done" : "Not yet" },
            { label: "Water", icon: "◎", done: (todayH.water || 0) >= 3, val: todayH.water ? `${todayH.water}L` : "—" },
            { label: "Sleep", icon: "◐", done: (todayH.sleep || 0) >= 7, val: todayH.sleep ? `${todayH.sleep}h` : "—" },
            { label: "Protein", icon: "◈", done: todayH.protein, val: todayH.protein ? "✓ Hit" : "Not logged" },
          ].map(({ label, icon, done, val }) => (
            <div key={label} style={{ background: done ? "#00e5a008" : "#0a0a14", border: `1px solid ${done ? "#00e5a030" : "#1a1a2e"}`, borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: done ? "#00e5a018" : "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center", color: done ? "#00e5a0" : "#444", fontSize: 14 }}>{icon}</div>
              <div>
                <div style={{ color: "#888", fontSize: 10 }}>{label}</div>
                <div style={{ color: done ? "#00e5a0" : "#555", fontSize: 13, fontWeight: 600 }}>{val}</div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setTab("habits")} style={{ marginTop: 12, width: "100%", padding: "10px", background: "transparent", border: "1px solid #1a1a2e", borderRadius: 10, color: "#444", fontSize: 13, cursor: "pointer" }}>Log today's habits →</button>
      </div>

      {/* AI Insight */}
      {topInsight && (
        <div onClick={() => setTab("insights")} style={{ margin: "0 16px 16px", background: "linear-gradient(135deg, #0a0a14, #0d0d1e)", border: "1px solid #7c3aed44", borderRadius: 16, padding: 16, cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "#7c3aed22", display: "flex", alignItems: "center", justifyContent: "center", color: "#7c3aed", fontSize: 12 }}>✦</div>
            <div style={{ color: "#7c3aed", fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>AI Insight</div>
          </div>
          <div style={{ color: "#ccc", fontSize: 14, lineHeight: 1.6 }}>{topInsight.text}</div>
          <div style={{ color: "#7c3aed", fontSize: 12, marginTop: 8 }}>See all insights →</div>
        </div>
      )}
    </div>
  );
}

// ─── BODY TRACKING ────────────────────────────────────────────────────────────
function BodyTab({ bodyLogs, setBodyLogs }) {
  const [form, setForm] = useState({ weight: "", waist: "", chest: "", arms: "", thighs: "", neck: "" });
  const [saved, setSaved] = useState(false);
  const [activeMetric, setActiveMetric] = useState("weight");

  const fields = [
    { key: "weight", label: "Weight", unit: "kg", color: "#00e5a0" },
    { key: "waist", label: "Waist", unit: "cm", color: "#ff8c42" },
    { key: "chest", label: "Chest", unit: "cm", color: "#7c3aed" },
    { key: "arms", label: "Arms", unit: "cm", color: "#f5c518" },
    { key: "thighs", label: "Thighs", unit: "cm", color: "#ff4d6d" },
    { key: "neck", label: "Neck", unit: "cm", color: "#00d4ff" },
  ];

  const save = () => {
    const entry = { date: today(), ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v ? parseFloat(v) : null])) };
    const existing = bodyLogs.findIndex(b => b.date === today());
    const newLogs = existing >= 0 ? bodyLogs.map((b, i) => i === existing ? { ...b, ...entry } : b) : [...bodyLogs, entry];
    setBodyLogs(newLogs);
    S.set("bodyLogs", newLogs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const chartData = bodyLogs.slice(-12).map(b => b[activeMetric]).filter(Boolean);
  const activeField = fields.find(f => f.key === activeMetric);
  const latest = bodyLogs.length ? bodyLogs[bodyLogs.length - 1] : {};
  const prev = bodyLogs.length > 1 ? bodyLogs[bodyLogs.length - 2] : {};

  return (
    <div style={{ padding: "20px 16px 80px" }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 20 }}>Body Metrics</div>

      {/* Metric selector */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
        {fields.map(f => (
          <button key={f.key} onClick={() => setActiveMetric(f.key)}
            style={{ padding: "8px 14px", borderRadius: 20, border: `1px solid ${activeMetric === f.key ? f.color : "#1e1e2e"}`, background: activeMetric === f.key ? f.color + "18" : "#0d0d1a", color: activeMetric === f.key ? f.color : "#444", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s" }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div style={{ background: "#0d0d1a", border: "1px solid #1a1a2e", borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
          <div>
            <div style={{ color: "#444", fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>{activeField.label}</div>
            <div style={{ color: activeField.color, fontSize: 28, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>
              {latest[activeMetric] ? `${latest[activeMetric]} ${activeField.unit}` : "—"}
            </div>
          </div>
          {latest[activeMetric] && prev[activeMetric] && (
            <div style={{ color: latest[activeMetric] < prev[activeMetric] ? "#00e5a0" : "#ff8c42", fontSize: 13, fontWeight: 600 }}>
              {latest[activeMetric] > prev[activeMetric] ? "+" : ""}{fmt(latest[activeMetric] - prev[activeMetric])} {activeField.unit}
            </div>
          )}
        </div>
        <Sparkline data={chartData} color={activeField.color} height={64} />
        {chartData.length < 2 && <div style={{ color: "#333", fontSize: 12, textAlign: "center", marginTop: 8 }}>Log more entries to see trend</div>}
      </div>

      {/* Log form */}
      <div style={{ background: "#0d0d1a", border: "1px solid #1a1a2e", borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <div style={{ color: "#888", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>Log Today</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {fields.map(f => (
            <div key={f.key}>
              <div style={{ color: "#444", fontSize: 11, marginBottom: 4 }}>{f.label} ({f.unit})</div>
              <div style={{ position: "relative" }}>
                <input type="number" placeholder="—" value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ width: "100%", padding: "10px 32px 10px 12px", background: "#0a0a14", border: `1px solid ${form[f.key] ? f.color + "44" : "#1a1a2e"}`, borderRadius: 10, color: "#fff", fontSize: 15, outline: "none", fontFamily: "'DM Sans', sans-serif" }} />
                <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#333", fontSize: 11 }}>{f.unit}</span>
              </div>
            </div>
          ))}
        </div>
        <button onClick={save} style={{ marginTop: 14, width: "100%", padding: 13, borderRadius: 12, border: "none", background: saved ? "#00b87a" : "linear-gradient(135deg, #00e5a0, #00b87a)", color: "#080810", fontWeight: 700, fontSize: 14, cursor: "pointer", transition: "all 0.2s" }}>
          {saved ? "✓ Saved!" : "Save Entry"}
        </button>
      </div>

      {/* History */}
      {bodyLogs.length > 0 && (
        <div style={{ background: "#0d0d1a", border: "1px solid #1a1a2e", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #1a1a2e", color: "#888", fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>History</div>
          {bodyLogs.slice(-5).reverse().map((b, i) => (
            <div key={i} style={{ padding: "12px 16px", borderBottom: "1px solid #0d0d14", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#444", fontSize: 13 }}>{new Date(b.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
              <div style={{ display: "flex", gap: 12 }}>
                {fields.filter(f => b[f.key]).map(f => (
                  <div key={f.key} style={{ textAlign: "right" }}>
                    <div style={{ color: f.color, fontSize: 13, fontWeight: 600 }}>{b[f.key]}</div>
                    <div style={{ color: "#333", fontSize: 10 }}>{f.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── WORKOUT TRACKING ─────────────────────────────────────────────────────────
function WorkoutTab({ workouts, setWorkouts }) {
  const [exercise, setExercise] = useState(EXERCISES[0]);
  const [sets, setSets] = useState([{ reps: "", weight: "" }]);
  const [saved, setSaved] = useState(false);
  const [activeEx, setActiveEx] = useState(null);

  const todayWorkouts = workouts.filter(w => w.date === today());

  const addSet = () => setSets(s => [...s, { reps: "", weight: "" }]);
  const updateSet = (i, field, val) => setSets(s => s.map((set, idx) => idx === i ? { ...set, [field]: val } : set));

  const saveWorkout = () => {
    const entries = sets.filter(s => s.reps && s.weight).map((s, i) => ({
      id: Date.now() + i, date: today(), exercise, sets: 1, reps: parseInt(s.reps), weight: parseFloat(s.weight)
    }));
    if (!entries.length) return;
    const newW = [...workouts, ...entries];
    setWorkouts(newW);
    S.set("workouts", newW);
    setSets([{ reps: "", weight: "" }]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const prs = useMemo(() => {
    const p = {};
    workouts.forEach(w => { if (!p[w.exercise] || w.weight > p[w.exercise]) p[w.exercise] = w.weight; });
    return p;
  }, [workouts]);

  const exerciseHistory = workouts.filter(w => w.exercise === (activeEx || exercise)).slice(-10);
  const volumeData = exerciseHistory.map(w => w.weight);

  return (
    <div style={{ padding: "20px 16px 80px" }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 20 }}>Workout Log</div>

      {/* Log form */}
      <div style={{ background: "#0d0d1a", border: "1px solid #1a1a2e", borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <div style={{ color: "#888", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>Log Exercise</div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ color: "#444", fontSize: 11, marginBottom: 6 }}>Exercise</div>
          <select value={exercise} onChange={e => setExercise(e.target.value)}
            style={{ width: "100%", padding: "11px 14px", background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 10, color: "#fff", fontSize: 14, outline: "none" }}>
            {EXERCISES.map(ex => <option key={ex}>{ex}</option>)}
          </select>
          {prs[exercise] && <div style={{ color: "#f5c518", fontSize: 11, marginTop: 4 }}>PR: {prs[exercise]} kg</div>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: 8, marginBottom: 8, color: "#444", fontSize: 11, paddingLeft: 4 }}>
          <div></div><div>Reps</div><div>Weight (kg)</div>
        </div>
        {sets.map((set, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center", color: "#444", fontSize: 12 }}>{i + 1}</div>
            <input type="number" placeholder="12" value={set.reps} onChange={e => updateSet(i, "reps", e.target.value)}
              style={{ padding: "10px", background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 10, color: "#fff", fontSize: 14, outline: "none", textAlign: "center" }} />
            <input type="number" placeholder="60" value={set.weight} onChange={e => updateSet(i, "weight", e.target.value)}
              style={{ padding: "10px", background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 10, color: "#fff", fontSize: 14, outline: "none", textAlign: "center" }} />
          </div>
        ))}
        <button onClick={addSet} style={{ width: "100%", padding: "8px", background: "transparent", border: "1px dashed #1e1e2e", borderRadius: 10, color: "#444", fontSize: 13, cursor: "pointer", marginBottom: 12 }}>+ Add Set</button>
        <button onClick={saveWorkout} style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: saved ? "#00b87a" : "linear-gradient(135deg, #00e5a0, #00b87a)", color: "#080810", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          {saved ? "✓ Saved!" : "Log Workout"}
        </button>
      </div>

      {/* PR Board */}
      {Object.keys(prs).length > 0 && (
        <div style={{ background: "#0d0d1a", border: "1px solid #1a1a2e", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ color: "#888", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Personal Records</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(prs).map(([ex, weight]) => (
              <div key={ex} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0a0a14", borderRadius: 10 }}>
                <span style={{ color: "#888", fontSize: 13 }}>{ex}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "#f5c518", fontSize: 13, fontWeight: 700 }}>{weight} kg</span>
                  <span style={{ color: "#f5c518", fontSize: 10 }}>PR</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's log */}
      {todayWorkouts.length > 0 && (
        <div style={{ background: "#0d0d1a", border: "1px solid #1a1a2e", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #1a1a2e", color: "#888", fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>Today</div>
          {todayWorkouts.map((w, i) => (
            <div key={i} style={{ padding: "12px 16px", borderBottom: "1px solid #0d0d14", display: "flex", justifyContent: "space-between" }}>
              <div style={{ color: "#ccc", fontSize: 13 }}>{w.exercise}</div>
              <div style={{ color: "#00e5a0", fontSize: 13 }}>{w.sets} × {w.reps} @ {w.weight}kg</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── HABITS ───────────────────────────────────────────────────────────────────
function HabitsTab({ habits, setHabits }) {
  const todayH = habits.find(h => h.date === today()) || { date: today(), gym: false, water: 0, sleep: 0, protein: false };
  const [form, setForm] = useState(todayH);
  const [saved, setSaved] = useState(false);

  const save = () => {
    const exists = habits.findIndex(h => h.date === today());
    const newH = exists >= 0 ? habits.map((h, i) => i === exists ? form : h) : [...habits, form];
    setHabits(newH);
    S.set("habits", newH);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const streak = (() => {
    let s = 0;
    const sorted = [...habits].sort((a, b) => b.date.localeCompare(a.date));
    for (const h of sorted) { if (h.gym) s++; else break; }
    return s;
  })();

  const weekHabits = habits.slice(-7);
  const consistency = weekHabits.filter(h => h.gym).length;

  return (
    <div style={{ padding: "20px 16px 80px" }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 20 }}>Daily Habits</div>

      {/* Streak */}
      <div style={{ background: "linear-gradient(135deg, #1a0a00, #2a1200)", border: "1px solid #f5c51822", borderRadius: 16, padding: 16, marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontSize: 40 }}>🔥</div>
        <div>
          <div style={{ color: "#f5c518", fontSize: 28, fontWeight: 800, fontFamily: "'Syne', sans-serif" }}>{streak} day streak</div>
          <div style={{ color: "#664", fontSize: 13 }}>{consistency}/7 gym sessions this week</div>
        </div>
      </div>

      {/* Week overview */}
      <div style={{ background: "#0d0d1a", border: "1px solid #1a1a2e", borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <div style={{ color: "#888", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>This Week</div>
        <div style={{ display: "flex", gap: 6 }}>
          {DAYS.map((d, i) => {
            const daysAgo = 6 - i;
            const date = new Date(); date.setDate(date.getDate() - daysAgo);
            const dateStr = date.toISOString().slice(0, 10);
            const h = habits.find(hh => hh.date === dateStr);
            const isToday = dateStr === today();
            return (
              <div key={d} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ color: isToday ? "#fff" : "#333", fontSize: 10, marginBottom: 6 }}>{d}</div>
                <div style={{ width: "100%", aspectRatio: "1", borderRadius: 8, background: h?.gym ? "#00e5a0" : "#1a1a2e", border: isToday ? "1px solid #00e5a044" : "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                  {h?.gym ? "✓" : ""}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Log form */}
      <div style={{ background: "#0d0d1a", border: "1px solid #1a1a2e", borderRadius: 16, padding: 16 }}>
        <div style={{ color: "#888", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>Log Today</div>

        {/* Gym toggle */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid #1a1a2e" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: form.gym ? "#00e5a018" : "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>△</div>
            <div>
              <div style={{ color: "#ccc", fontSize: 14, fontWeight: 500 }}>Gym Session</div>
              <div style={{ color: "#444", fontSize: 11 }}>Did you work out today?</div>
            </div>
          </div>
          <button onClick={() => setForm(f => ({ ...f, gym: !f.gym }))}
            style={{ width: 48, height: 26, borderRadius: 13, border: "none", background: form.gym ? "#00e5a0" : "#1a1a2e", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
            <div style={{ width: 20, height: 20, borderRadius: 10, background: "#fff", position: "absolute", top: 3, left: form.gym ? 25 : 3, transition: "left 0.2s" }} />
          </button>
        </div>

        {/* Water */}
        <div style={{ padding: "14px 0", borderBottom: "1px solid #1a1a2e" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#00d4ff18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>◎</div>
              <div>
                <div style={{ color: "#ccc", fontSize: 14, fontWeight: 500 }}>Water Intake</div>
                <div style={{ color: "#444", fontSize: 11 }}>Target: 3–4 litres</div>
              </div>
            </div>
            <div style={{ color: "#00d4ff", fontSize: 18, fontWeight: 700 }}>{form.water || 0}L</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[1, 2, 3, 4].map(v => (
              <button key={v} onClick={() => setForm(f => ({ ...f, water: v }))}
                style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${form.water >= v ? "#00d4ff44" : "#1a1a2e"}`, background: form.water >= v ? "#00d4ff18" : "#0a0a14", color: form.water >= v ? "#00d4ff" : "#444", cursor: "pointer", fontSize: 13 }}>
                {v}L
              </button>
            ))}
          </div>
        </div>

        {/* Sleep */}
        <div style={{ padding: "14px 0", borderBottom: "1px solid #1a1a2e" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#7c3aed18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>◐</div>
              <div>
                <div style={{ color: "#ccc", fontSize: 14, fontWeight: 500 }}>Sleep Hours</div>
                <div style={{ color: "#444", fontSize: 11 }}>Target: 7–9 hours</div>
              </div>
            </div>
            <div style={{ color: "#7c3aed", fontSize: 18, fontWeight: 700 }}>{form.sleep || 0}h</div>
          </div>
          <input type="range" min="4" max="10" step="0.5" value={form.sleep || 7}
            onChange={e => setForm(f => ({ ...f, sleep: parseFloat(e.target.value) }))}
            style={{ width: "100%", accentColor: "#7c3aed" }} />
          <div style={{ display: "flex", justifyContent: "space-between", color: "#333", fontSize: 10, marginTop: 2 }}>
            <span>4h</span><span>7h</span><span>10h</span>
          </div>
        </div>

        {/* Protein */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#ff8c4218", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>◈</div>
            <div>
              <div style={{ color: "#ccc", fontSize: 14, fontWeight: 500 }}>Protein Goal</div>
              <div style={{ color: "#444", fontSize: 11 }}>Hit your daily target?</div>
            </div>
          </div>
          <button onClick={() => setForm(f => ({ ...f, protein: !f.protein }))}
            style={{ width: 48, height: 26, borderRadius: 13, border: "none", background: form.protein ? "#ff8c42" : "#1a1a2e", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
            <div style={{ width: 20, height: 20, borderRadius: 10, background: "#fff", position: "absolute", top: 3, left: form.protein ? 25 : 3, transition: "left 0.2s" }} />
          </button>
        </div>

        <button onClick={save} style={{ marginTop: 4, width: "100%", padding: 13, borderRadius: 12, border: "none", background: saved ? "#00b87a" : "linear-gradient(135deg, #00e5a0, #00b87a)", color: "#080810", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          {saved ? "✓ Saved!" : "Save Habits"}
        </button>
      </div>
    </div>
  );
}

// ─── AI INSIGHTS ──────────────────────────────────────────────────────────────
function InsightsTab({ profile, bodyLogs, workouts, habits, insights }) {
  const [aiResponse, setAiResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [asked, setAsked] = useState(false);
  const [question, setQuestion] = useState("");

  const askAI = async (q) => {
    setLoading(true);
    setAsked(true);
    setAiResponse("");
    const summary = `
User: ${profile.name}, ${profile.age}y, ${profile.gender}, ${profile.height}cm, Goal: ${profile.goal}
Body logs (last 5): ${bodyLogs.slice(-5).map(b => `${b.date}: weight=${b.weight}kg, waist=${b.waist}cm`).join(" | ")}
Workouts (last 7): ${workouts.slice(-7).map(w => `${w.exercise} ${w.weight}kg x${w.reps}`).join(", ")}
Habits (last 7): ${habits.slice(-7).map(h => `gym=${h.gym}, sleep=${h.sleep}h, water=${h.water}L, protein=${h.protein}`).join(" | ")}
    `.trim();
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: "You are Aethon, a premium AI fitness intelligence coach. Analyze the user's fitness data and provide sharp, actionable insights. Be direct, honest, and specific. Reference their actual numbers. Keep responses concise and powerful. Use bullet points for clarity. Never be generic.",
          messages: [{ role: "user", content: `${summary}\n\nQuestion: ${q || "Analyze my overall progress and give me 3 specific, data-driven insights and recommendations."}` }]
        })
      });
      const data = await res.json();
      setAiResponse(data.content?.[0]?.text || "Unable to generate insights at this time.");
    } catch {
      setAiResponse("Connect to the internet to get AI-powered insights. Your local insights below are always available.");
    }
    setLoading(false);
  };

  const typeColors = { positive: "#00e5a0", warning: "#ff8c42", info: "#7c3aed" };

  return (
    <div style={{ padding: "20px 16px 80px" }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 6 }}>AI Insights</div>
      <div style={{ color: "#444", fontSize: 13, marginBottom: 20 }}>Powered by Claude · Analysing your fitness data</div>

      {/* Ask AI */}
      <div style={{ background: "linear-gradient(135deg, #0d0d1e, #0a0a18)", border: "1px solid #7c3aed44", borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <div style={{ color: "#7c3aed", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>✦ Ask AI Coach</div>
        <input value={question} onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === "Enter" && askAI(question)}
          placeholder="e.g. Why am I not losing weight?"
          style={{ width: "100%", padding: "11px 14px", background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 10, color: "#fff", fontSize: 14, outline: "none", marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }} />
        <div style={{ display: "flex", gap: 8 }}>
          {["Analyse my progress", "Why no results?", "What to improve?"].map(q => (
            <button key={q} onClick={() => { setQuestion(q); askAI(q); }}
              style={{ padding: "7px 12px", borderRadius: 20, border: "1px solid #7c3aed44", background: "#7c3aed11", color: "#7c3aed88", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>
              {q}
            </button>
          ))}
        </div>
        {!asked && (
          <button onClick={() => askAI(question)} style={{ marginTop: 10, width: "100%", padding: 12, borderRadius: 12, border: "none", background: "linear-gradient(135deg, #7c3aed, #5b21b6)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            Get AI Analysis →
          </button>
        )}
        {loading && (
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 16, height: 16, border: "2px solid #7c3aed44", borderTop: "2px solid #7c3aed", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <span style={{ color: "#7c3aed", fontSize: 13 }}>Analysing your data...</span>
          </div>
        )}
        {aiResponse && (
          <div style={{ marginTop: 14, padding: "14px", background: "#0a0a14", borderRadius: 12, border: "1px solid #7c3aed22" }}>
            <div style={{ color: "#ccc", fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{aiResponse}</div>
            <button onClick={() => { setAsked(false); setAiResponse(""); setQuestion(""); }} style={{ marginTop: 10, padding: "7px 14px", background: "transparent", border: "1px solid #1e1e2e", borderRadius: 8, color: "#444", fontSize: 12, cursor: "pointer" }}>Ask another question</button>
          </div>
        )}
      </div>

      {/* Local insights */}
      <div style={{ color: "#444", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Automatic Insights</div>
      {insights.map((ins, i) => (
        <div key={i} style={{ background: "#0d0d1a", border: `1px solid ${typeColors[ins.type]}22`, borderRadius: 14, padding: 16, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: typeColors[ins.type] + "18", display: "flex", alignItems: "center", justifyContent: "center", color: typeColors[ins.type], fontSize: 14, flexShrink: 0 }}>{ins.icon}</div>
            <div>
              <div style={{ display: "inline-block", padding: "2px 8px", borderRadius: 20, background: typeColors[ins.type] + "18", color: typeColors[ins.type], fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>{ins.type}</div>
              <div style={{ color: "#ccc", fontSize: 14, lineHeight: 1.6 }}>{ins.text}</div>
            </div>
          </div>
        </div>
      ))}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
function ProfileTab({ profile, setProfile, onReset }) {
  const { logOut, user } = useAuth();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(profile);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setProfile(form);
    S.set("profile", form);
    setEdit(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const fields = [
    { key: "name", label: "Name", type: "text" },
    { key: "age", label: "Age", type: "number" },
    { key: "gender", label: "Gender", type: "select", options: ["Male", "Female", "Other"] },
    { key: "height", label: "Height (cm)", type: "number" },
    { key: "weight", label: "Weight (kg)", type: "number" },
  ];

  return (
    <div style={{ padding: "20px 16px 80px" }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 20 }}>Profile</div>

      {/* Avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, padding: 20, background: "#0d0d1a", border: "1px solid #1a1a2e", borderRadius: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg, #00e5a0, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700, color: "#fff", fontFamily: "'Syne', sans-serif" }}>
          {profile.name?.[0]?.toUpperCase() || "?"}
        </div>
        <div>
          <div style={{ color: "#fff", fontSize: 18, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>{profile.name || "—"}</div>
          <div style={{ color: "#444", fontSize: 13 }}>{profile.goal}</div>
          <div style={{ color: "#333", fontSize: 12 }}>{profile.age && `${profile.age}y`} {profile.height && `· ${profile.height}cm`} {profile.weight && `· ${profile.weight}kg`}</div>
        </div>
      </div>

      {/* Edit form */}
      <div style={{ background: "#0d0d1a", border: "1px solid #1a1a2e", borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ color: "#888", fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>Details</div>
          <button onClick={() => edit ? save() : setEdit(true)} style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid #1e1e2e", background: edit ? "#00e5a0" : "transparent", color: edit ? "#080810" : "#666", fontSize: 12, cursor: "pointer", fontWeight: edit ? 700 : 400 }}>
            {edit ? "Save" : "Edit"}
          </button>
        </div>
        {fields.map(f => (
          <div key={f.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1a1a2e" }}>
            <div style={{ color: "#444", fontSize: 13 }}>{f.label}</div>
            {edit ? (
              f.type === "select" ? (
                <select value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 8, color: "#fff", padding: "6px 10px", fontSize: 13 }}>
                  {f.options.map(o => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ width: 100, padding: "6px 10px", background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 8, color: "#fff", fontSize: 13, textAlign: "right" }} />
              )
            ) : (
              <div style={{ color: "#ccc", fontSize: 13 }}>{profile[f.key] || "—"}</div>
            )}
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
          <div style={{ color: "#444", fontSize: 13 }}>Goal</div>
          {edit ? (
            <select value={form.goal} onChange={e => setForm(p => ({ ...p, goal: e.target.value }))}
              style={{ background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 8, color: "#fff", padding: "6px 10px", fontSize: 13 }}>
              {GOALS.map(g => <option key={g}>{g}</option>)}
            </select>
          ) : (
            <div style={{ color: "#00e5a0", fontSize: 13 }}>{profile.goal}</div>
          )}
        </div>
      </div>

      {saved && <div style={{ textAlign: "center", color: "#00e5a0", fontSize: 14, marginBottom: 16 }}>✓ Profile updated</div>}

      <button onClick={() => logOut()}
        style={{ width: "100%", padding: 13, borderRadius: 12, border: "1px solid #1e1e2e", background: "transparent", color: "#666", fontSize: 14, cursor: "pointer", marginBottom: 10 }}>
        Sign Out
      </button>

      <button onClick={() => { if (confirm("Reset all data? This cannot be undone.")) { localStorage.clear(); onReset(); } }}
        style={{ width: "100%", padding: 13, borderRadius: 12, border: "1px solid #ff4d6d44", background: "transparent", color: "#ff4d6d88", fontSize: 14, cursor: "pointer" }}>
        Reset All Data
      </button>
    </div>
  );
}

// ─── NAV BAR ──────────────────────────────────────────────────────────────────
function NavBar({ tab, setTab }) {
  return (
    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "rgba(8,8,16,0.95)", backdropFilter: "blur(20px)", borderTop: "1px solid #1a1a2e", display: "flex", zIndex: 100, padding: "8px 0 max(8px, env(safe-area-inset-bottom))" }}>
      {TABS.map(t => (
        <button key={t} onClick={() => setTab(t)}
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "transparent", border: "none", cursor: "pointer", padding: "6px 0" }}>
          <div style={{ fontSize: 18, color: tab === t ? "#00e5a0" : "#333", transition: "color 0.2s", filter: tab === t ? "drop-shadow(0 0 6px #00e5a0)" : "none" }}>{TAB_ICONS[t]}</div>
          <div style={{ fontSize: 9, color: tab === t ? "#00e5a0" : "#333", letterSpacing: 1, textTransform: "uppercase", transition: "color 0.2s" }}>{TAB_LABELS[t]}</div>
        </button>
      ))}
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function Aethon() {
  const [profile, setProfile] = useState(() => S.get("profile"));
  const [bodyLogs, setBodyLogs] = useState(() => S.get("bodyLogs", []));
  const [workouts, setWorkouts] = useState(() => S.get("workouts", []));
  const [habits, setHabits] = useState(() => S.get("habits", []));
  const [tab, setTab] = useState("dashboard");

  const score = useMemo(() => calcScore(workouts, habits, bodyLogs), [workouts, habits, bodyLogs]);
  const insights = useMemo(() => generateLocalInsights(profile || {}, bodyLogs, workouts, habits), [profile, bodyLogs, workouts, habits]);

  const handleOnboard = (data) => {
    const p = { ...data, height: parseFloat(data.height), weight: parseFloat(data.weight), age: parseInt(data.age) };
    setProfile(p);
    S.set("profile", p);
    if (p.weight) {
      const entry = { date: today(), weight: p.weight };
      setBodyLogs([entry]);
      S.set("bodyLogs", [entry]);
    }
  };

  if (!profile) return (
    <>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap" />
      <Onboarding onComplete={handleOnboard} />
    </>
  );

  return (
    <>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap" />
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#080810", color: "#fff", fontFamily: "'DM Sans', sans-serif", position: "relative" }}>
        <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, zIndex: 50, padding: "12px 20px", background: "rgba(8,8,16,0.9)", backdropFilter: "blur(20px)", borderBottom: "1px solid #1a1a2e", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 20, fontFamily: "'Syne', sans-serif", fontWeight: 800, letterSpacing: -0.5, background: "linear-gradient(135deg, #00e5a0, #7c3aed)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AETHON</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ color: scoreColor(score.total), fontSize: 13, fontWeight: 700 }}>{score.total}</div>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: scoreColor(score.total), boxShadow: `0 0 8px ${scoreColor(score.total)}` }} />
          </div>
        </div>
        <div style={{ paddingTop: 56 }}>
          {tab === "dashboard" && <Dashboard profile={profile} bodyLogs={bodyLogs} workouts={workouts} habits={habits} score={score} insights={insights} setTab={setTab} />}
          {tab === "body"      && <BodyTab bodyLogs={bodyLogs} setBodyLogs={setBodyLogs} />}
          {tab === "workout"   && <WorkoutTab workouts={workouts} setWorkouts={setWorkouts} />}
          {tab === "habits"    && <HabitsTab habits={habits} setHabits={setHabits} />}
          {tab === "insights"  && <InsightsTab profile={profile} bodyLogs={bodyLogs} workouts={workouts} habits={habits} insights={insights} />}
          {tab === "profile"   && <ProfileTab profile={profile} setProfile={setProfile} onReset={() => { setProfile(null); setBodyLogs([]); setWorkouts([]); setHabits([]); }} />}
        </div>
        <NavBar tab={tab} setTab={setTab} />
      </div>
    </>
  );
}
