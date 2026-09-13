"use strict";

/* ============================================================
   STORAGE & STATE
   ============================================================ */
const STORAGE_KEY = "prep-tracker:data:v1";

const DEFAULT_SETTINGS = {
  startDate: "2026-09-11",
  dailyTargetHours: 8,
  rrbTargetHours: 5,
  cuetTargetHours: 3,
  subjects: {
    "RRB JE": ["Electrical Engineering", "Mathematics", "General Awareness", "General Science"],
    "CUET": ["Physics", "Chemistry", "Mathematics", "GAT", "Computer Science"],
  },
};

function cloneSettings() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

function emptyData() {
  return { sessions: [], days: {}, topics: [], mockTests: [], plans: {}, settings: cloneSettings() };
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw);
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      days: parsed.days && typeof parsed.days === "object" ? parsed.days : {},
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      mockTests: Array.isArray(parsed.mockTests) ? parsed.mockTests : [],
      plans: parsed.plans && typeof parsed.plans === "object" ? parsed.plans : {},
      settings: Object.assign(cloneSettings(), parsed.settings || {}),
    };
  } catch (e) {
    console.error("Failed to load saved data, starting fresh.", e);
    return emptyData();
  }
}

let DATA = loadData();

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ============================================================
   DATE HELPERS
   ============================================================ */
function pad2(n) { return String(n).padStart(2, "0"); }

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dstr(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

function fmtDate(d, opts) {
  return d.toLocaleDateString("en-IN", opts);
}

function dayNumber(startDate, dateStr) {
  const diff = Math.round((toDate(dateStr) - toDate(startDate)) / 86400000);
  return diff + 1;
}

function isBeforeStart(startDate, dateStr) {
  return toDate(dateStr) < toDate(startDate);
}

function minutesBetween(start, end) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return mins;
}

function hoursLabel(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function startOfWeekMon(d) {
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  const res = new Date(d);
  res.setDate(d.getDate() - day);
  return res;
}

function monthGridDays(monthDate) {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = startOfWeekMon(firstOfMonth);
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ============================================================
   CRUD
   ============================================================ */
function addSession(s) {
  DATA.sessions.push(Object.assign({ id: uid(), createdAt: new Date().toISOString() }, s));
  save();
}
function updateSession(id, patch) {
  const i = DATA.sessions.findIndex((x) => x.id === id);
  if (i >= 0) DATA.sessions[i] = Object.assign({}, DATA.sessions[i], patch);
  save();
}
function deleteSession(id) {
  DATA.sessions = DATA.sessions.filter((x) => x.id !== id);
  save();
}
function setDayStatus(date, status, note) {
  const existing = DATA.days[date] || {};
  DATA.days[date] = {
    date,
    status: status !== undefined ? status : existing.status,
    note: note !== undefined ? note : existing.note,
  };
  save();
}
function addTopic(t) {
  DATA.topics.push(Object.assign({ id: uid() }, t));
  save();
}
function updateTopic(id, patch) {
  const i = DATA.topics.findIndex((x) => x.id === id);
  if (i >= 0) DATA.topics[i] = Object.assign({}, DATA.topics[i], patch);
  save();
}
function deleteTopic(id) {
  DATA.topics = DATA.topics.filter((x) => x.id !== id);
  save();
}
function addMockTest(m) {
  DATA.mockTests.push(Object.assign({ id: uid() }, m));
  save();
}
function updateMockTest(id, patch) {
  const i = DATA.mockTests.findIndex((x) => x.id === id);
  if (i >= 0) DATA.mockTests[i] = Object.assign({}, DATA.mockTests[i], patch);
  save();
}
function deleteMockTest(id) {
  DATA.mockTests = DATA.mockTests.filter((x) => x.id !== id);
  save();
}
function savePlan(date, plan) {
  DATA.plans[date] = plan;
  save();
}
function getPlan(date) {
  return DATA.plans[date] || {
    date, mainTarget: "", rrbTarget: "", cuetTarget: "", topicsToCover: "",
    questionsTarget: 0, reflection: "", checklist: [],
  };
}
function updateSettings(patch) {
  DATA.settings = Object.assign({}, DATA.settings, patch);
  save();
}

/* ============================================================
   NAV, MODALS, SHARED RENDER HELPERS
   ============================================================ */
const TABS = ["dashboard", "log", "plan", "calendar", "syllabus", "mocks", "analytics", "settings"];

function currentTab() {
  return TABS.find((t) => !document.getElementById("tab-" + t).classList.contains("hidden")) || "dashboard";
}

function showTab(tab) {
  TABS.forEach((t) => {
    document.getElementById("tab-" + t).classList.toggle("hidden", t !== tab);
  });
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  renderTab(tab);
}

function renderTab(tab) {
  if (tab === "dashboard") renderDashboard();
  if (tab === "log") renderLog();
  if (tab === "plan") renderPlan();
  if (tab === "calendar") renderCalendar();
  if (tab === "syllabus") renderSyllabus();
  if (tab === "mocks") renderMocks();
  if (tab === "analytics") renderAnalytics();
  if (tab === "settings") renderSettings();
}

function openModal(id) { document.getElementById(id).classList.remove("hidden"); }
function closeModal(id) { document.getElementById(id).classList.add("hidden"); }

function badgeExam(exam) {
  return `<span class="badge ${exam === "RRB JE" ? "amber" : "teal"}">${esc(exam)}</span>`;
}

function subjectOptionsHTML(exam) {
  return DATA.settings.subjects[exam].map((s) => `<option>${esc(s)}</option>`).join("");
}

function emptyState(title, hint) {
  return `<div class="empty"><strong>${esc(title)}</strong><span>${esc(hint)}</span></div>`;
}

function renderMeter(elId, value, max, colorVarName, label) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  document.getElementById(elId).innerHTML = `
    <div class="meter-label"><span>${esc(label)}</span><span>${Math.round(pct)}%</span></div>
    <div class="meter-track"><div class="meter-fill" style="width:${pct}%;background:var(${colorVarName})"></div></div>
  `;
}

/* Wire up static modal close controls & nav once, at load */
function wireStaticControls() {
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.classList.add("hidden"); });
  });
  document.getElementById("nav").addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-btn");
    if (btn) showTab(btn.dataset.tab);
  });
  document.body.addEventListener("click", (e) => {
    const link = e.target.closest("[data-tab-link]");
    if (link) { e.preventDefault(); showTab(link.dataset.tabLink); }
  });
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function renderDashboard() {
  const today = todayStr();
  const day = dayNumber(DATA.settings.startDate, today);
  document.getElementById("dashDate").textContent = fmtDate(toDate(today), { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  document.getElementById("dashTitle").textContent = day > 0 ? `Prep Day ${day}` : "Preparation not started yet";
  document.getElementById("dayline").textContent = `Day ${day > 0 ? day : "—"} of prep`;

  const todaySessions = DATA.sessions.filter((s) => s.date === today).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const rrbMin = todaySessions.filter((s) => s.exam === "RRB JE").reduce((a, s) => a + s.durationMinutes, 0);
  const cuetMin = todaySessions.filter((s) => s.exam === "CUET").reduce((a, s) => a + s.durationMinutes, 0);
  const totalMin = rrbMin + cuetMin;
  const attempted = todaySessions.reduce((a, s) => a + s.questionsAttempted, 0);
  const correct = todaySessions.reduce((a, s) => a + s.questionsCorrect, 0);
  const accuracy = attempted > 0 ? ((correct / attempted) * 100).toFixed(1) + "%" : "—";

  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const dStr = dstr(cursor);
    const hasSession = DATA.sessions.some((s) => s.date === dStr && s.durationMinutes > 0);
    const status = (DATA.days[dStr] || {}).status;
    if (status === "Rest") { cursor.setDate(cursor.getDate() - 1); continue; }
    if (!hasSession) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const revisionQueue = DATA.topics.filter((t) => t.status === "Needs Revision");

  document.getElementById("dashStats").innerHTML = `
    <div class="panel"><div class="stat"><span class="label">Studied today</span><span class="value mono">${hoursLabel(totalMin)}</span><span class="sub">of ${DATA.settings.dailyTargetHours}h target</span></div></div>
    <div class="panel"><div class="stat"><span class="label">Accuracy today</span><span class="value mono accent-teal">${accuracy}</span><span class="sub">${correct}/${attempted} correct</span></div></div>
    <div class="panel"><div class="stat"><span class="label">Study streak</span><span class="value mono accent-green">${streak}d</span><span class="sub">consecutive study days</span></div></div>
    <div class="panel"><div class="stat"><span class="label">Topics to revise</span><span class="value mono accent-red">${revisionQueue.length}</span><span class="sub">flagged Needs Revision</span></div></div>
  `;

  renderMeter("meterRRB", rrbMin / 60, DATA.settings.rrbTargetHours, "--blue", `${hoursLabel(rrbMin)} of ${DATA.settings.rrbTargetHours}h`);
  renderMeter("meterCUET", cuetMin / 60, DATA.settings.cuetTargetHours, "--teal", `${hoursLabel(cuetMin)} of ${DATA.settings.cuetTargetHours}h`);

  document.getElementById("todaySessions").innerHTML = todaySessions.length === 0
    ? emptyState("No sessions logged yet today", "Tap 'Add today's session' when you sit down to study — even a quick 20-minute block counts.")
    : todaySessions.map((s) => `
      <div class="list-row">
        <div class="row-main-line">
          <div>${badgeExam(s.exam)} <strong>${esc(s.subject)}</strong> · ${esc(s.topic || "—")}</div>
          <div class="muted small">${esc(s.studyType)} · ${s.startTime}–${s.endTime}</div>
        </div>
        <span class="mono muted small">${hoursLabel(s.durationMinutes)}</span>
      </div>`).join("");

  const recent = [...DATA.sessions].sort((a, b) => (a.date + a.startTime < b.date + b.startTime ? 1 : -1)).slice(0, 6);
  document.getElementById("recentSessions").innerHTML = recent.length === 0
    ? `<p class="muted small">Nothing logged yet.</p>`
    : recent.map((s) => `
      <div class="list-row">
        <span class="mono muted small">${s.date}</span>
        <span class="row-main-line">${esc(s.subject)}</span>
        <span class="mono small">${hoursLabel(s.durationMinutes)}</span>
      </div>`).join("");

  document.getElementById("revisionQueue").innerHTML = revisionQueue.length === 0
    ? `<p class="muted small">No topics flagged for revision. Mark weak topics in Syllabus.</p>`
    : revisionQueue.slice(0, 5).map((t) => `
      <div class="list-row">
        <span class="row-main-line">${esc(t.topic)}</span>
        ${badgeExam(t.exam)}
      </div>`).join("");
}

/* ============================================================
   SESSION MODAL (add/edit study session)
   ============================================================ */
let editingSessionId = null;

function blankSession(defaultDate) {
  return {
    date: defaultDate, startTime: "09:00", endTime: "10:00", manualDuration: false,
    exam: "RRB JE", subject: DATA.settings.subjects["RRB JE"][0] || "", topic: "", subtopic: "",
    studyType: "Reading", questionsAttempted: 0, questionsCorrect: 0, notes: "", confidence: "Medium",
    completed: true, durationMinutes: 60,
  };
}

function openSessionModal(defaultDate, session) {
  editingSessionId = session ? session.id : null;
  document.getElementById("sessionModalTitle").textContent = session ? "Edit study session" : "Add study session";
  document.getElementById("sSave").textContent = session ? "Save changes" : "Add session";

  const s = session || blankSession(defaultDate);

  document.getElementById("sDate").value = s.date;
  document.getElementById("sStart").value = s.startTime;
  document.getElementById("sEnd").value = s.endTime;
  document.getElementById("sManual").checked = !!s.manualDuration;
  document.getElementById("sManualMins").value = s.durationMinutes;
  document.getElementById("sManualMins").classList.toggle("hidden", !s.manualDuration);
  document.getElementById("sExam").value = s.exam;
  document.getElementById("sSubject").innerHTML = subjectOptionsHTML(s.exam);
  document.getElementById("sSubject").value = s.subject;
  document.getElementById("sTopic").value = s.topic;
  document.getElementById("sSubtopic").value = s.subtopic;
  document.getElementById("sType").value = s.studyType;
  document.getElementById("sConfidence").value = s.confidence;
  document.getElementById("sQAttempted").value = s.questionsAttempted;
  document.getElementById("sQCorrect").value = s.questionsCorrect;
  document.getElementById("sNotes").value = s.notes;
  document.getElementById("sCompleted").checked = s.completed;
  updateDerivedDuration();
  openModal("sessionModal");
}

function updateDerivedDuration() {
  const derived = minutesBetween(document.getElementById("sStart").value || "00:00", document.getElementById("sEnd").value || "00:00");
  document.getElementById("sDerived").textContent = document.getElementById("sManual").checked ? "" : `= ${derived} min`;
}

function wireSessionModal() {
  document.getElementById("sStart").addEventListener("input", updateDerivedDuration);
  document.getElementById("sEnd").addEventListener("input", updateDerivedDuration);
  document.getElementById("sManual").addEventListener("change", (e) => {
    document.getElementById("sManualMins").classList.toggle("hidden", !e.target.checked);
    updateDerivedDuration();
  });
  document.getElementById("sExam").addEventListener("change", (e) => {
    document.getElementById("sSubject").innerHTML = subjectOptionsHTML(e.target.value);
  });

  document.getElementById("btnAddSession").addEventListener("click", () => openSessionModal(todayStr()));
  document.getElementById("btnAddSession2").addEventListener("click", () => openSessionModal(todayStr()));

  document.getElementById("sSave").addEventListener("click", () => {
    const manual = document.getElementById("sManual").checked;
    const start = document.getElementById("sStart").value;
    const end = document.getElementById("sEnd").value;
    const manualMins = Number(document.getElementById("sManualMins").value || 0);
    const duration = manual ? manualMins : minutesBetween(start, end);
    const date = document.getElementById("sDate").value;

    if (!date || !start || !end) { alert("Please fill date, start time and end time."); return; }

    const payload = {
      date, startTime: start, endTime: end, manualDuration: manual, durationMinutes: duration,
      exam: document.getElementById("sExam").value,
      subject: document.getElementById("sSubject").value,
      topic: document.getElementById("sTopic").value,
      subtopic: document.getElementById("sSubtopic").value,
      studyType: document.getElementById("sType").value,
      confidence: document.getElementById("sConfidence").value,
      questionsAttempted: Number(document.getElementById("sQAttempted").value || 0),
      questionsCorrect: Number(document.getElementById("sQCorrect").value || 0),
      notes: document.getElementById("sNotes").value,
      completed: document.getElementById("sCompleted").checked,
    };

    if (editingSessionId) updateSession(editingSessionId, payload);
    else addSession(payload);

    closeModal("sessionModal");
    renderTab(currentTab());
  });
}

/* ============================================================
   DAILY LOG
   ============================================================ */
function renderLog() {
  const query = document.getElementById("logSearch").value.trim().toLowerCase();
  const examFilter = document.getElementById("logExamFilter").value;

  const filtered = [...DATA.sessions]
    .filter((s) => examFilter === "All" || s.exam === examFilter)
    .filter((s) => !query || [s.subject, s.topic, s.subtopic, s.notes].join(" ").toLowerCase().includes(query))
    .sort((a, b) => (a.date + a.startTime < b.date + b.startTime ? 1 : -1));

  document.getElementById("logList").innerHTML = filtered.length === 0
    ? emptyState("No study sessions match", "Try clearing filters, or add your first session for today.")
    : filtered.map((s) => {
      const acc = s.questionsAttempted > 0 ? Math.round((s.questionsCorrect / s.questionsAttempted) * 100) : null;
      return `
      <div class="list-row has-actions" data-id="${s.id}">
        <span class="mono muted small row-fixed">${s.date}</span>
        <div class="row-main">
          <div>${badgeExam(s.exam)} <strong>${esc(s.subject)}</strong>${s.topic ? ` <span class="muted small">· ${esc(s.topic)}</span>` : ""} <span class="badge">${esc(s.studyType)}</span>${!s.completed ? ' <span class="badge red">Incomplete</span>' : ""}</div>
          <div class="muted small">${s.startTime}–${s.endTime} · ${hoursLabel(s.durationMinutes)}${acc !== null ? ` · ${s.questionsCorrect}/${s.questionsAttempted} (${acc}% acc.)` : ""}${s.notes ? ` · ${esc(s.notes)}` : ""}</div>
        </div>
        <div class="row-actions">
          <button class="btn ghost dup-btn">Duplicate</button>
          <button class="btn ghost edit-btn">Edit</button>
          <button class="btn danger del-btn">Delete</button>
        </div>
      </div>`;
    }).join("");

  document.querySelectorAll("#logList .edit-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.closest("[data-id]").dataset.id;
      openSessionModal(todayStr(), DATA.sessions.find((x) => x.id === id));
    });
  });
  document.querySelectorAll("#logList .del-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.closest("[data-id]").dataset.id;
      if (confirm("Delete this session?")) { deleteSession(id); renderLog(); }
    });
  });
  document.querySelectorAll("#logList .dup-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.closest("[data-id]").dataset.id;
      const s = DATA.sessions.find((x) => x.id === id);
      const clone = Object.assign({}, s, { date: todayStr() });
      delete clone.id; delete clone.createdAt;
      addSession(clone);
      renderLog();
    });
  });
}

function wireLog() {
  document.getElementById("logSearch").addEventListener("input", renderLog);
  document.getElementById("logExamFilter").addEventListener("change", renderLog);
}

/* ============================================================
   DAILY PLAN
   ============================================================ */
function renderPlan() {
  const dateInput = document.getElementById("planDate");
  if (!dateInput.value) dateInput.value = todayStr();
  const date = dateInput.value;
  const plan = getPlan(date);

  document.getElementById("planMain").value = plan.mainTarget;
  document.getElementById("planRRB").value = plan.rrbTarget;
  document.getElementById("planCUET").value = plan.cuetTarget;
  document.getElementById("planTopics").value = plan.topicsToCover;
  document.getElementById("planQTarget").value = plan.questionsTarget;
  document.getElementById("planReflection").value = plan.reflection;

  const doneCount = plan.checklist.filter((t) => t.done).length;
  document.getElementById("planChecklistCount").textContent = `${doneCount}/${plan.checklist.length}`;
  document.getElementById("planChecklist").innerHTML = plan.checklist.map((t) => `
    <div class="list-row has-actions" data-id="${t.id}">
      <div class="row-main check-label" style="margin:0">
        <input type="checkbox" class="chk-toggle" ${t.done ? "checked" : ""} />
        <span class="row-main-line${t.done ? " muted" : ""}" ${t.done ? 'style="text-decoration:line-through"' : ""}>${esc(t.text)}</span>
      </div>
      <div class="row-actions"><button class="btn ghost chk-remove">Remove</button></div>
    </div>`).join("");

  document.querySelectorAll("#planChecklist .chk-toggle").forEach((cb) => {
    cb.addEventListener("change", () => {
      const id = cb.closest("[data-id]").dataset.id;
      const p = getPlan(date);
      p.checklist = p.checklist.map((t) => (t.id === id ? Object.assign({}, t, { done: !t.done }) : t));
      savePlan(date, p);
      renderPlan();
    });
  });
  document.querySelectorAll("#planChecklist .chk-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest("[data-id]").dataset.id;
      const p = getPlan(date);
      p.checklist = p.checklist.filter((t) => t.id !== id);
      savePlan(date, p);
      renderPlan();
    });
  });
}

function savePlanField(field, value) {
  const date = document.getElementById("planDate").value || todayStr();
  const p = getPlan(date);
  p[field] = value;
  savePlan(date, p);
}

function wirePlan() {
  const fieldMap = { planMain: "mainTarget", planRRB: "rrbTarget", planCUET: "cuetTarget", planTopics: "topicsToCover", planReflection: "reflection" };
  Object.keys(fieldMap).forEach((id) => {
    document.getElementById(id).addEventListener("change", (e) => savePlanField(fieldMap[id], e.target.value));
  });
  document.getElementById("planQTarget").addEventListener("change", (e) => savePlanField("questionsTarget", Number(e.target.value || 0)));
  document.getElementById("planDate").addEventListener("change", renderPlan);

  document.getElementById("btnAddTask").addEventListener("click", () => {
    const input = document.getElementById("planNewTask");
    const text = input.value.trim();
    if (!text) return;
    const date = document.getElementById("planDate").value || todayStr();
    const p = getPlan(date);
    p.checklist.push({ id: uid(), text, done: false });
    savePlan(date, p);
    input.value = "";
    renderPlan();
  });
  document.getElementById("planNewTask").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); document.getElementById("btnAddTask").click(); }
  });
}

/* ============================================================
   CALENDAR
   ============================================================ */
let calMonth = new Date();

function dayStatsFor(dateStr) {
  const sessions = DATA.sessions.filter((s) => s.date === dateStr);
  const total = sessions.reduce((a, s) => a + s.durationMinutes, 0);
  const rrb = sessions.filter((s) => s.exam === "RRB JE").reduce((a, s) => a + s.durationMinutes, 0);
  const cuet = sessions.filter((s) => s.exam === "CUET").reduce((a, s) => a + s.durationMinutes, 0);
  return { total, rrb, cuet, sessions };
}

function renderCalendar() {
  document.getElementById("calMonthLabel").textContent = fmtDate(calMonth, { month: "long", year: "numeric" });
  const days = monthGridDays(calMonth);
  document.getElementById("calGrid").innerHTML = days.map((d) => {
    const dateStr = dstr(d);
    const inMonth = d.getMonth() === calMonth.getMonth();
    const stat = dayStatsFor(dateStr);
    const record = DATA.days[dateStr];
    let toneClass = "";
    if (record && record.status === "Completed") toneClass = "st-green";
    else if (record && record.status === "Missed") toneClass = "st-red";
    else if (record && record.status === "Partial") toneClass = "st-amber";
    else if (stat.total > 0) toneClass = "st-amber";
    return `
      <div class="cal-cell ${inMonth ? "" : "dim"} ${toneClass}" data-date="${dateStr}">
        <span class="cal-num">${d.getDate()}</span>
        ${stat.total > 0
          ? `<span class="cal-hrs">${hoursLabel(stat.total)}</span>`
          : record && record.status ? `<span class="cal-hrs status-label">${record.status}</span>` : ""}
      </div>`;
  }).join("");

  document.querySelectorAll("#calGrid .cal-cell").forEach((cell) => {
    cell.addEventListener("click", () => openDayModal(cell.dataset.date));
  });
}

function openDayModal(dateStr) {
  const stat = dayStatsFor(dateStr);
  const record = DATA.days[dateStr] || {};
  document.getElementById("dayModalTitle").textContent = dateStr;

  const statuses = ["Completed", "Partial", "Missed", "Rest"];
  document.getElementById("dayModalBody").innerHTML = `
    <div class="day-stats-grid">
      <div><div class="stat-mini-label">Total</div><div class="stat-mini-value">${hoursLabel(stat.total)}</div></div>
      <div><div class="stat-mini-label">RRB JE</div><div class="stat-mini-value">${hoursLabel(stat.rrb)}</div></div>
      <div><div class="stat-mini-label">CUET</div><div class="stat-mini-value">${hoursLabel(stat.cuet)}</div></div>
    </div>
    <div class="status-btn-row">
      ${statuses.map((st) => `<button class="btn ${record.status === st ? "primary" : "ghost"} status-btn" data-status="${st}">${st}</button>`).join("")}
    </div>
    <label class="field">Note for this date<textarea id="dayNote" rows="2">${esc(record.note || "")}</textarea></label>
    ${stat.sessions.length > 0 ? `
      <div>
        <div class="day-sessions-title">Sessions this day</div>
        ${stat.sessions.map((s) => `
          <div class="list-row">
            <span class="row-main-line">${esc(s.subject)} — ${esc(s.topic)}</span>
            <span class="mono muted small">${hoursLabel(s.durationMinutes)}</span>
          </div>`).join("")}
      </div>` : ""}
  `;

  document.querySelectorAll(".status-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setDayStatus(dateStr, btn.dataset.status);
      openDayModal(dateStr);
      renderCalendar();
    });
  });
  document.getElementById("dayNote").addEventListener("blur", (e) => {
    setDayStatus(dateStr, record.status, e.target.value);
  });

  openModal("dayModal");
}

function wireCalendar() {
  document.getElementById("calPrev").addEventListener("click", () => {
    calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1);
    renderCalendar();
  });
  document.getElementById("calNext").addEventListener("click", () => {
    calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1);
    renderCalendar();
  });
}

/* ============================================================
   SYLLABUS
   ============================================================ */
const STATUS_CYCLE = ["Not Started", "In Progress", "Completed", "Needs Revision"];
const STATUS_TONE = { "Not Started": "", "In Progress": "amber", "Completed": "green", "Needs Revision": "red" };

function refreshTopicFormSubjects() {
  const exam = document.getElementById("topicExam").value;
  document.getElementById("topicSubject").innerHTML = subjectOptionsHTML(exam);
}

function renderSyllabus() {
  refreshTopicFormSubjects();

  const examFilter = document.getElementById("synFilterExam").value;
  const subjectFilterEl = document.getElementById("synFilterSubject");
  const allSubjects = examFilter === "All"
    ? [...new Set([...DATA.settings.subjects["RRB JE"], ...DATA.settings.subjects["CUET"]])]
    : DATA.settings.subjects[examFilter];
  const prevSubjectVal = subjectFilterEl.value;
  subjectFilterEl.innerHTML = `<option value="All">All subjects</option>` + allSubjects.map((s) => `<option>${esc(s)}</option>`).join("");
  subjectFilterEl.value = allSubjects.includes(prevSubjectVal) ? prevSubjectVal : "All";

  const subjectFilter = subjectFilterEl.value;
  const statusFilter = document.getElementById("synFilterStatus").value;

  const filtered = DATA.topics.filter((t) =>
    (examFilter === "All" || t.exam === examFilter) &&
    (subjectFilter === "All" || t.subject === subjectFilter) &&
    (statusFilter === "All" || t.status === statusFilter)
  );

  const groups = {};
  filtered.forEach((t) => { (groups[t.subject] = groups[t.subject] || []).push(t); });

  const container = document.getElementById("syllabusGroups");
  if (Object.keys(groups).length === 0) {
    container.innerHTML = emptyState("No topics yet", "Add topics from the official syllabus above — nothing is pre-filled for you.");
    return;
  }

  container.innerHTML = Object.entries(groups).map(([subject, topics]) => {
    const done = topics.filter((t) => t.status === "Completed").length;
    const pct = topics.length > 0 ? Math.round((done / topics.length) * 100) : 0;
    return `
      <div class="panel">
        <div class="panel-head-row"><h3>${esc(subject)}</h3><span class="mono muted small">${done}/${topics.length} done</span></div>
        <div class="meter-track"><div class="meter-fill" style="width:${pct}%;background:var(--green)"></div></div>
        <div style="margin-top:12px">
          ${topics.map((t) => `
            <div class="list-row has-actions" data-id="${t.id}">
              <div class="row-main">
                <div class="row-main-line">${esc(t.topic)}</div>
                <div class="muted small">${esc(t.exam)}${t.revisionCount > 0 ? ` · revised ${t.revisionCount}×` : ""}${t.completionDate ? ` · done ${t.completionDate}` : ""}</div>
              </div>
              <div class="row-actions">
                <button class="badge clickable cycle-status ${STATUS_TONE[t.status]}">${t.status}</button>
                <button class="btn danger del-topic">Delete</button>
              </div>
            </div>`).join("")}
        </div>
      </div>`;
  }).join("");

  container.querySelectorAll(".cycle-status").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest("[data-id]").dataset.id;
      const t = DATA.topics.find((x) => x.id === id);
      const idx = STATUS_CYCLE.indexOf(t.status);
      const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
      const patch = { status: next };
      if (next === "In Progress" && !t.firstStudyDate) patch.firstStudyDate = todayStr();
      if (next === "Completed") patch.completionDate = todayStr();
      if (next === "Needs Revision") patch.revisionCount = (t.revisionCount || 0) + 1;
      updateTopic(id, patch);
      renderSyllabus();
    });
  });
  container.querySelectorAll(".del-topic").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest("[data-id]").dataset.id;
      if (confirm("Delete this topic?")) { deleteTopic(id); renderSyllabus(); }
    });
  });
}

function wireSyllabus() {
  document.getElementById("topicExam").addEventListener("change", refreshTopicFormSubjects);

  document.getElementById("btnAddTopic").addEventListener("click", () => {
    const exam = document.getElementById("topicExam").value;
    const subject = document.getElementById("topicSubject").value;
    const topicInput = document.getElementById("topicName");
    const topic = topicInput.value.trim();
    if (!topic) return;
    addTopic({ exam, subject, topic, status: "Not Started", revisionCount: 0, notes: "" });
    topicInput.value = "";
    renderSyllabus();
  });

  document.getElementById("synFilterExam").addEventListener("change", renderSyllabus);
  document.getElementById("synFilterSubject").addEventListener("change", renderSyllabus);
  document.getElementById("synFilterStatus").addEventListener("change", renderSyllabus);

  refreshTopicFormSubjects();
}

/* ============================================================
   MOCK TESTS
   ============================================================ */
let editingMockId = null;

function blankMock() {
  return {
    date: todayStr(), exam: "RRB JE", testName: "", subject: "", totalQuestions: 0,
    attempted: 0, correct: 0, incorrect: 0, unattempted: 0, marksObtained: 0, maxMarks: 0,
    timeTakenMinutes: 0, notes: "", mistakes: "",
  };
}

function openMockModal(mock) {
  editingMockId = mock ? mock.id : null;
  document.getElementById("mockModalTitle").textContent = mock ? "Edit mock test" : "Add mock test";
  document.getElementById("mSave").textContent = mock ? "Save changes" : "Add test";
  const m = mock || blankMock();
  document.getElementById("mDate").value = m.date;
  document.getElementById("mExam").value = m.exam;
  document.getElementById("mSubject").value = m.subject;
  document.getElementById("mName").value = m.testName;
  document.getElementById("mTotal").value = m.totalQuestions;
  document.getElementById("mAttempted").value = m.attempted;
  document.getElementById("mCorrect").value = m.correct;
  document.getElementById("mIncorrect").value = m.incorrect;
  document.getElementById("mUnattempted").value = m.unattempted;
  document.getElementById("mMarks").value = m.marksObtained;
  document.getElementById("mMaxMarks").value = m.maxMarks;
  document.getElementById("mTime").value = m.timeTakenMinutes;
  document.getElementById("mMistakes").value = m.mistakes;
  document.getElementById("mNotes").value = m.notes;
  openModal("mockModal");
}

function renderMocks() {
  const sorted = [...DATA.mockTests].sort((a, b) => (a.date < b.date ? 1 : -1));
  const chartData = [...DATA.mockTests].sort((a, b) => (a.date > b.date ? 1 : -1))
    .map((m) => ({ date: m.date.slice(5), score: m.maxMarks > 0 ? Math.round((m.marksObtained / m.maxMarks) * 100) : 0 }));

  const chartPanel = document.getElementById("mockChartPanel");
  const chartEl = document.getElementById("mockChart");
  if (chartData.length < 2) {
    chartPanel.classList.add("hidden");
    chartEl.innerHTML = "";
  } else {
    chartPanel.classList.remove("hidden");
    const max = Math.max(100, ...chartData.map((d) => d.score));
    chartEl.className = "chart trend";
    chartEl.innerHTML = chartData.map((d) => `
      <div class="trend-col">
        <span class="mono small">${d.score}%</span>
        <div class="trend-bar" style="height:${(d.score / max) * 120}px"></div>
        <span class="bar-label">${d.date}</span>
      </div>`).join("");
  }

  document.getElementById("mockList").innerHTML = sorted.length === 0
    ? emptyState("No mock tests logged", "Add your first mock test to start tracking accuracy and score trends.")
    : sorted.map((m) => {
      const pct = m.maxMarks > 0 ? ((m.marksObtained / m.maxMarks) * 100).toFixed(1) : "—";
      return `
      <div class="list-row has-actions" data-id="${m.id}">
        <span class="mono muted small row-fixed">${m.date}</span>
        <div class="row-main">
          <div>${badgeExam(m.exam)} <strong>${esc(m.testName || "Untitled test")}</strong></div>
          <div class="muted small">${m.correct}/${m.attempted} correct of ${m.totalQuestions} · ${m.marksObtained}/${m.maxMarks} marks (${pct}%) · ${m.timeTakenMinutes}min</div>
        </div>
        <div class="row-actions">
          <button class="btn ghost edit-mock">Edit</button>
          <button class="btn danger del-mock">Delete</button>
        </div>
      </div>`;
    }).join("");

  document.querySelectorAll("#mockList .edit-mock").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest("[data-id]").dataset.id;
      openMockModal(DATA.mockTests.find((x) => x.id === id));
    });
  });
  document.querySelectorAll("#mockList .del-mock").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest("[data-id]").dataset.id;
      if (confirm("Delete this mock test?")) { deleteMockTest(id); renderMocks(); }
    });
  });
}

function wireMocks() {
  document.getElementById("btnAddMock").addEventListener("click", () => openMockModal(null));

  document.getElementById("mSave").addEventListener("click", () => {
    const date = document.getElementById("mDate").value;
    if (!date) { alert("Please pick a date."); return; }
    const payload = {
      date,
      exam: document.getElementById("mExam").value,
      subject: document.getElementById("mSubject").value,
      testName: document.getElementById("mName").value,
      totalQuestions: Number(document.getElementById("mTotal").value || 0),
      attempted: Number(document.getElementById("mAttempted").value || 0),
      correct: Number(document.getElementById("mCorrect").value || 0),
      incorrect: Number(document.getElementById("mIncorrect").value || 0),
      unattempted: Number(document.getElementById("mUnattempted").value || 0),
      marksObtained: Number(document.getElementById("mMarks").value || 0),
      maxMarks: Number(document.getElementById("mMaxMarks").value || 0),
      timeTakenMinutes: Number(document.getElementById("mTime").value || 0),
      mistakes: document.getElementById("mMistakes").value,
      notes: document.getElementById("mNotes").value,
    };
    if (editingMockId) updateMockTest(editingMockId, payload);
    else addMockTest(payload);
    closeModal("mockModal");
    renderMocks();
  });
}

/* ============================================================
   ANALYTICS
   ============================================================ */
function renderAnalytics() {
  const body = document.getElementById("analyticsBody");

  if (DATA.sessions.length === 0) {
    body.innerHTML = emptyState("Not enough data yet", "Log a few study sessions and analytics will appear here automatically.");
    return;
  }

  const totalMin = DATA.sessions.reduce((a, s) => a + s.durationMinutes, 0);
  const rrbMin = DATA.sessions.filter((s) => s.exam === "RRB JE").reduce((a, s) => a + s.durationMinutes, 0);
  const cuetMin = DATA.sessions.filter((s) => s.exam === "CUET").reduce((a, s) => a + s.durationMinutes, 0);
  const attempted = DATA.sessions.reduce((a, s) => a + s.questionsAttempted, 0);
  const correct = DATA.sessions.reduce((a, s) => a + s.questionsCorrect, 0);
  const accuracy = attempted > 0 ? ((correct / attempted) * 100).toFixed(1) + "%" : "—";
  const missedDays = Object.values(DATA.days).filter((d) => d.status === "Missed").length;

  const weekStart = startOfWeekMon(new Date());
  const weekData = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart); d.setDate(d.getDate() + i);
    const dateStr = dstr(d);
    const mins = DATA.sessions.filter((s) => s.date === dateStr).reduce((a, s) => a + s.durationMinutes, 0);
    weekData.push({ day: d.toLocaleDateString("en-IN", { weekday: "short" }), hours: +(mins / 60).toFixed(1) });
  }
  const maxH = Math.max(1, ...weekData.map((d) => d.hours));

  const subjMap = {};
  DATA.sessions.forEach((s) => { subjMap[s.subject] = (subjMap[s.subject] || 0) + s.durationMinutes / 60; });
  const subjEntries = Object.entries(subjMap).sort((a, b) => b[1] - a[1]);
  const maxSubj = Math.max(1, ...subjEntries.map((e) => e[1]));

  const accMap = {};
  DATA.sessions.forEach((s) => {
    if (s.questionsAttempted === 0) return;
    accMap[s.subject] = accMap[s.subject] || { attempted: 0, correct: 0 };
    accMap[s.subject].attempted += s.questionsAttempted;
    accMap[s.subject].correct += s.questionsCorrect;
  });
  const weak = Object.entries(accMap)
    .map(([subject, v]) => ({ subject, accuracy: (v.correct / v.attempted) * 100 }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 4);

  const revisions = DATA.topics.filter((t) => t.status === "Needs Revision");

  body.innerHTML = `
    <div class="grid stats4">
      <div class="panel"><div class="stat"><span class="label">Total hours</span><span class="value mono">${hoursLabel(totalMin)}</span></div></div>
      <div class="panel"><div class="stat"><span class="label">RRB JE vs CUET</span><span class="value mono accent-teal">${hoursLabel(rrbMin)} / ${hoursLabel(cuetMin)}</span></div></div>
      <div class="panel"><div class="stat"><span class="label">Overall accuracy</span><span class="value mono accent-green">${accuracy}</span></div></div>
      <div class="panel"><div class="stat"><span class="label">Missed days</span><span class="value mono accent-red">${missedDays}</span></div></div>
    </div>
    <div class="panel">
      <h3>This week's hours</h3>
      <div class="chart bars">
        ${weekData.map((d) => `
          <div class="bar-col">
            <span class="mono small">${d.hours}h</span>
            <div class="bar" style="height:${(d.hours / maxH) * 120}px"></div>
            <span class="bar-label">${d.day}</span>
          </div>`).join("")}
      </div>
    </div>
    <div class="grid two">
      <div class="panel">
        <h3>Hours by subject</h3>
        ${subjEntries.map(([subject, hours]) => `
          <div class="subject-bar-row">
            <div class="label"><span>${esc(subject)}</span><span class="mono">${hours.toFixed(1)}h</span></div>
            <div class="meter-track"><div class="meter-fill" style="width:${(hours / maxSubj) * 100}%;background:var(--blue)"></div></div>
          </div>`).join("")}
      </div>
      <div class="panel">
        <h3>Weakest subjects (by accuracy)</h3>
        ${weak.length === 0
          ? `<p class="muted small">Log questions attempted/correct in sessions to see this.</p>`
          : weak.map((w) => `
            <div class="list-row">
              <span class="row-main-line">${esc(w.subject)}</span>
              <span class="mono" style="color:var(--red)">${w.accuracy.toFixed(1)}%</span>
            </div>`).join("")}
      </div>
    </div>
    <div class="panel">
      <h3>Suggested revision</h3>
      ${revisions.length === 0
        ? `<p class="muted small">No topics currently flagged Needs Revision.</p>`
        : `<div class="chips">${revisions.map((t) => `<span class="badge red">${esc(t.subject)} · ${esc(t.topic)}</span>`).join("")}</div>`}
    </div>
  `;
}

/* ============================================================
   SETTINGS
   ============================================================ */
function renderSettings() {
  document.getElementById("setDaily").value = DATA.settings.dailyTargetHours;
  document.getElementById("setRRB").value = DATA.settings.rrbTargetHours;
  document.getElementById("setCUET").value = DATA.settings.cuetTargetHours;
  document.getElementById("setStartDate").value = DATA.settings.startDate;

  renderSubjectChips("RRB JE", "subjectsRRB", "amber");
  renderSubjectChips("CUET", "subjectsCUET", "teal");
}

function renderSubjectChips(exam, containerId, tone) {
  const container = document.getElementById(containerId);
  container.innerHTML = DATA.settings.subjects[exam].map((s) => `
    <span class="chip badge ${tone}">${esc(s)} <button data-subject="${esc(s)}" aria-label="Remove ${esc(s)}">×</button></span>
  `).join("");
  container.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const subjects = DATA.settings.subjects[exam].filter((s) => s !== btn.dataset.subject);
      updateSettings({ subjects: Object.assign({}, DATA.settings.subjects, { [exam]: subjects }) });
      renderSettings();
    });
  });
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function toCSV() {
  const headers = ["date", "startTime", "endTime", "durationMinutes", "exam", "subject", "topic", "subtopic", "studyType", "questionsAttempted", "questionsCorrect", "accuracy", "confidence", "completed", "notes"];
  const rows = DATA.sessions.map((s) => {
    const accuracy = s.questionsAttempted > 0 ? ((s.questionsCorrect / s.questionsAttempted) * 100).toFixed(1) : "";
    return [
      s.date, s.startTime, s.endTime, s.durationMinutes, s.exam, s.subject, s.topic, s.subtopic,
      s.studyType, s.questionsAttempted, s.questionsCorrect, accuracy, s.confidence, s.completed,
      String(s.notes || "").replace(/\n/g, " ").replace(/,/g, ";"),
    ].join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

function wireSettings() {
  document.getElementById("setDaily").addEventListener("change", (e) => updateSettings({ dailyTargetHours: Number(e.target.value || 0) }));
  document.getElementById("setRRB").addEventListener("change", (e) => updateSettings({ rrbTargetHours: Number(e.target.value || 0) }));
  document.getElementById("setCUET").addEventListener("change", (e) => updateSettings({ cuetTargetHours: Number(e.target.value || 0) }));
  document.getElementById("setStartDate").addEventListener("change", (e) => updateSettings({ startDate: e.target.value }));

  document.getElementById("btnAddSubjectRRB").addEventListener("click", () => {
    const input = document.getElementById("newSubjectRRB");
    const name = input.value.trim();
    if (!name) return;
    updateSettings({ subjects: Object.assign({}, DATA.settings.subjects, { "RRB JE": [...DATA.settings.subjects["RRB JE"], name] }) });
    input.value = "";
    renderSettings();
  });
  document.getElementById("btnAddSubjectCUET").addEventListener("click", () => {
    const input = document.getElementById("newSubjectCUET");
    const name = input.value.trim();
    if (!name) return;
    updateSettings({ subjects: Object.assign({}, DATA.settings.subjects, { "CUET": [...DATA.settings.subjects["CUET"], name] }) });
    input.value = "";
    renderSettings();
  });

  document.getElementById("btnExportJSON").addEventListener("click", () => {
    downloadFile(`prep-tracker-backup-${todayStr()}.json`, JSON.stringify(DATA, null, 2), "application/json");
  });
  document.getElementById("btnExportCSV").addEventListener("click", () => {
    downloadFile(`prep-tracker-sessions-${todayStr()}.csv`, toCSV(), "text/csv");
  });
  document.getElementById("btnImport").addEventListener("click", () => document.getElementById("fileImport").click());
  document.getElementById("fileImport").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed.sessions || !parsed.settings) throw new Error("Invalid backup file");
        DATA = {
          sessions: parsed.sessions || [], days: parsed.days || {}, topics: parsed.topics || [],
          mockTests: parsed.mockTests || [], plans: parsed.plans || {},
          settings: Object.assign(cloneSettings(), parsed.settings || {}),
        };
        save();
        alert("Backup restored successfully.");
        renderTab(currentTab());
      } catch (err) {
        alert("Could not read this file — make sure it's a valid backup exported from this app.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  document.getElementById("resetZone").addEventListener("click", (e) => {
    const zone = document.getElementById("resetZone");
    if (e.target.id === "btnReset") {
      zone.innerHTML = `
        <div class="toolbar" style="align-items:center">
          <span class="small" style="color:var(--red)">This deletes all sessions, topics, mock tests and plans. Sure?</span>
          <button class="btn danger" id="confirmReset">Yes, delete everything</button>
          <button class="btn ghost" id="cancelReset">Cancel</button>
        </div>`;
    } else if (e.target.id === "confirmReset") {
      DATA = { sessions: [], days: {}, topics: [], mockTests: [], plans: {}, settings: DATA.settings };
      save();
      zone.innerHTML = `<button class="btn danger" id="btnReset">Reset all data</button>`;
      renderTab(currentTab());
    } else if (e.target.id === "cancelReset") {
      zone.innerHTML = `<button class="btn danger" id="btnReset">Reset all data</button>`;
    }
  });
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
  wireStaticControls();
  wireSessionModal();
  wireLog();
  wirePlan();
  wireCalendar();
  wireSyllabus();
  wireMocks();
  wireSettings();
  showTab("dashboard");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
