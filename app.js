/* ============================================================
   OpporTune — client application (vanilla JS, no build step)
   ============================================================ */

const APP = document.getElementById("app");

const SKILL_OPTIONS = ["Python", "Java", "JavaScript", "Machine Learning", "Data Science", "React", "SQL", "Node.js", "HTML", "CSS", "Linux", "Networking", "Excel", "Pandas", "Communication"];
const INTEREST_OPTIONS = ["AI/ML", "Web Development", "Data Science", "Cybersecurity", "Entrepreneurship"];
const CATEGORY_OPTIONS = ["Internship", "Hackathon", "Competition", "Scholarship", "Course", "Certification", "Workshop"];
const TRACKER_STATUSES = [
  { key: "interested", label: "Interested", icon: "bookmark", cls: "bg-slate-100 text-slate-700" },
  { key: "applied", label: "Applied", icon: "send", cls: "bg-brand-50 text-brand-700" },
  { key: "interview", label: "Interview", icon: "messages-square", cls: "bg-amber-50 text-amber-700" },
  { key: "result", label: "Result", icon: "flag", cls: "bg-emerald-50 text-emerald-700" },
];

const CATEGORY_ICON = {
  Internship: "briefcase",
  Hackathon: "code-2",
  Competition: "trophy",
  Scholarship: "graduation-cap",
  Course: "book-open",
  Certification: "badge-check",
  Workshop: "hammer",
};

const DEMO_PROFILE = {
  name: "Mihir",
  education: "Diploma in Artificial Intelligence & Machine Learning",
  college: "Government Polytechnic, Pune",
  year: "Final Year",
  skills: ["Python", "Machine Learning", "Pandas", "NumPy", "SQL", "HTML", "CSS", "JavaScript"],
  interests: ["AI/ML", "Data Science", "Web Development"],
  categories: ["Internship", "Hackathon", "Competition", "Course"],
};

/* ---------------- State ---------------- */
const state = {
  route: parseHash(),
  profile: loadJSON("opportune_profile", null),
  saved: new Set(loadJSON("opportune_saved", [])),
  tracker: loadJSON("opportune_tracker", {}),
  opportunities: [],
  meta: { categories: [], skills: [], interests: [], locations: [] },
  matched: [],
  loading: true,
  error: null,
  modalId: null,
  applicationId: null,
  applications: loadJSON("opportune_applications", {}),
  aiOpen: false,
  aiMessages: [
    { role: "assistant", text: "Hi! I'm your built-in Opportunity Assistant (no API key needed). Ask me things like \"which opportunities fit my Python skills?\" or \"why should I apply to the top match?\"" },
  ],
  explore: {
    query: "",
    category: "",
    skill: "",
    location: "",
    remote: "",
    minScore: 0,
    deadlineWithin: "",
  },
  formDraft: null, // working copy for onboarding/profile forms
};

function loadJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* ignore quota errors — demo continues without persistence */
  }
}
function parseHash() {
  const h = window.location.hash.replace(/^#\/?/, "");
  return h || "landing";
}
function navigate(route) {
  window.location.hash = "/" + route;
}
window.addEventListener("hashchange", () => {
  state.route = parseHash();
  guardRoute();
  render();
});

function guardRoute() {
  const needsProfile = ["dashboard", "explore", "saved", "tracker", "profile"];
  const base = state.route.split("/")[0];
  if (needsProfile.includes(base) && !state.profile) {
    state.route = "landing";
    window.location.hash = "/landing";
  }
}

/* ---------------- Data loading ---------------- */
async function bootstrap() {
  try {
    const [oppRes, metaRes] = await Promise.all([
      fetch("/api/opportunities").then((r) => r.json()),
      fetch("/api/meta").then((r) => r.json()),
    ]);
    state.opportunities = oppRes.opportunities || [];
    state.meta = metaRes;
  } catch (err) {
    state.error = "Couldn't load opportunities. Check your connection and refresh.";
  }
  if (state.profile) {
    await refreshMatches();
  }
  state.loading = false;
  guardRoute();
  render();
}

async function refreshMatches() {
  if (!state.profile) return;
  try {
    const res = await fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.profile),
    });
    const data = await res.json();
    if (data.error) {
      state.error = data.details ? data.details.join(" ") : data.error;
      return;
    }
    state.matched = data.results || [];
    state.error = null;
  } catch (err) {
    state.error = "Couldn't recompute matches — showing last known results.";
  }
}

/* ---------------- Helpers ---------------- */
function byId(id) {
  return state.opportunities.find((o) => o.id === id);
}
function matchedById(id) {
  return state.matched.find((o) => o.id === id) || byId(id);
}
function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function scoreColor(score) {
  if (score >= 85) return "text-emerald-600 bg-emerald-50";
  if (score >= 65) return "text-brand-600 bg-brand-50";
  if (score >= 40) return "text-amber-600 bg-amber-50";
  return "text-slate-500 bg-slate-100";
}
function scoreRingColor(score) {
  if (score >= 85) return "#059669";
  if (score >= 65) return "#2b48d9";
  if (score >= 40) return "#d97706";
  return "#64748b";
}
function icon(name, cls = "w-4 h-4") {
  return `<i data-lucide="${name}" class="${cls}"></i>`;
}
function initials(name) {
  return (name || "?").trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
}

/* ---------------- Render dispatcher ---------------- */
function render() {
  if (state.loading) {
    APP.innerHTML = renderLoadingScreen();
    return;
  }
  const base = state.route.split("/")[0];
  let html;
  switch (base) {
    case "landing":
      html = renderLanding();
      break;
    case "onboarding":
      html = renderOnboarding();
      break;
    case "dashboard":
      html = renderShell(renderDashboard(), "dashboard");
      break;
    case "explore":
      html = renderShell(renderExplore(), "explore");
      break;
    case "saved":
      html = renderShell(renderSaved(), "saved");
      break;
    case "tracker":
      html = renderShell(renderTracker(), "tracker");
      break;
    case "profile":
      html = renderShell(renderProfileEdit(), "profile");
      break;
    default:
      html = renderLanding();
  }
  APP.innerHTML = html + renderModal() + renderAssistant();
  afterRender();
}

function renderLoadingScreen() {
  return `
  <div class="min-h-screen flex items-center justify-center bg-slate-50">
    <div class="text-center">
      <div class="w-14 h-14 mx-auto rounded-2xl bg-brand-600 flex items-center justify-center shadow-soft mb-4 animate-pulse">
        ${icon("target", "w-7 h-7 text-white")}
      </div>
      <p class="text-slate-500 font-medium">Loading OpporTune…</p>
    </div>
  </div>`;
}

function afterRender() {
  if (window.lucide) lucide.createIcons();
  attachGlobalHandlers();
  attachRouteHandlers();
}

/* ============================================================
   LANDING PAGE
   ============================================================ */
function renderLanding() {
  const sample = state.opportunities.slice(0, 3);
  return `
  <div class="fade-in">
    <header class="max-w-6xl mx-auto flex items-center justify-between px-6 py-6">
      <div class="flex items-center gap-2 font-extrabold text-xl text-slate-900">
        <span class="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white">${icon("target", "w-5 h-5")}</span>
        OpporTune
      </div>
      <button data-nav="onboarding" class="hidden sm:inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition">
        Build My Profile ${icon("arrow-right", "w-4 h-4")}
      </button>
    </header>

    <section class="max-w-6xl mx-auto px-6 pt-10 pb-16 grid lg:grid-cols-2 gap-12 items-center">
      <div>
        <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 bg-brand-50 px-3 py-1.5 rounded-full mb-5">
          ${icon("sparkles", "w-3.5 h-3.5")} FIT FEST Hackathon 2026 Project
        </span>
        <h1 class="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
          Discover opportunities <span class="text-brand-600">made for you.</span>
        </h1>
        <p class="mt-5 text-lg text-slate-600 leading-relaxed max-w-lg">
          Stop searching everywhere. Find internships, hackathons, courses and competitions matched to your skills and interests.
        </p>
        <div class="mt-8 flex flex-wrap items-center gap-3">
          <button data-nav="onboarding" class="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-6 py-3.5 rounded-xl shadow-soft transition">
            Build My Profile ${icon("arrow-right", "w-4 h-4")}
          </button>
          <button data-action="demo-login" class="inline-flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-6 py-3.5 rounded-xl transition">
            ${icon("play-circle", "w-4 h-4")} Try Demo Profile
          </button>
        </div>
        <div class="mt-8 flex items-center gap-6 text-sm text-slate-500">
          <div><span class="font-bold text-slate-900">${state.opportunities.length || 33}+</span> live opportunities</div>
          <div><span class="font-bold text-slate-900">7</span> categories</div>
          <div><span class="font-bold text-slate-900">0%</span> guesswork</div>
        </div>
      </div>

      <div class="space-y-4">
        ${sample.length ? sample.map((o, i) => landingSampleCard(o, i)).join("") : landingSkeletons()}
      </div>
    </section>

    <section class="bg-white border-y border-slate-100">
      <div class="max-w-6xl mx-auto px-6 py-14 grid sm:grid-cols-3 gap-8">
        ${featureBlock("target", "Match Score, explained", "Every opportunity shows a transparent 0–100% score based on your skills, interests, education and deadline urgency.")}
        ${featureBlock("layers", "Everything in one place", "Internships, hackathons, scholarships, courses, competitions, certifications and workshops — no more scattered links.")}
        ${featureBlock("bookmark", "Save & track deadlines", "Bookmark what matters and get clear urgency indicators so nothing slips past its deadline.")}
      </div>
    </section>

    <footer class="max-w-6xl mx-auto px-6 py-10 text-center text-sm text-slate-400">
      Built for FIT FEST Hackathon 2026 · OpporTune
    </footer>
  </div>`;
}

function featureBlock(iconName, title, body) {
  return `
  <div>
    <div class="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">${icon(iconName, "w-5 h-5")}</div>
    <h3 class="font-bold text-slate-900 mb-1.5">${title}</h3>
    <p class="text-sm text-slate-500 leading-relaxed">${body}</p>
  </div>`;
}

function landingSampleCard(o, i) {
  const rotate = i === 1 ? "" : i === 0 ? "sm:-rotate-1" : "sm:rotate-1";
  return `
  <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-5 ${rotate} card-hover">
    <div class="flex items-start justify-between mb-3">
      <div>
        <p class="text-xs font-semibold text-brand-600 uppercase tracking-wide">${o.category}</p>
        <h3 class="font-bold text-slate-900 mt-0.5">${o.title}</h3>
        <p class="text-sm text-slate-500">${o.organization}</p>
      </div>
      <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 whitespace-nowrap">🔥 Match</span>
    </div>
    <div class="flex flex-wrap gap-1.5">
      ${o.skills.slice(0, 3).map((s) => `<span class="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md">${s}</span>`).join("")}
    </div>
  </div>`;
}
function landingSkeletons() {
  return [0, 1, 2].map(() => `<div class="h-28 rounded-2xl skeleton"></div>`).join("");
}

/* ============================================================
   ONBOARDING / PROFILE FORM (shared)
   ============================================================ */
function ensureDraft() {
  if (!state.formDraft) {
    state.formDraft = state.profile
      ? JSON.parse(JSON.stringify(state.profile))
      : { name: "", education: "", college: "", year: "", skills: [], interests: [], categories: [] };
  }
  return state.formDraft;
}

function renderOnboarding() {
  const d = ensureDraft();
  return `
  <div class="min-h-screen fade-in">
    <header class="max-w-3xl mx-auto flex items-center justify-between px-6 py-6">
      <div class="flex items-center gap-2 font-extrabold text-xl text-slate-900">
        <span class="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white">${icon("target", "w-5 h-5")}</span>
        OpporTune
      </div>
      <button data-nav="landing" class="text-sm text-slate-500 hover:text-slate-700 font-medium">Back</button>
    </header>
    <div class="max-w-3xl mx-auto px-6 pb-20">
      <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">Let's build your profile</h1>
      <p class="text-slate-500 mb-8">Takes under a minute — this powers your personalized match scores.</p>
      <button data-action="demo-login" class="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 bg-brand-50 px-4 py-2 rounded-lg hover:bg-brand-100 transition">
        ${icon("wand-2", "w-4 h-4")} Fill with demo profile (Mihir)
      </button>
      ${profileFormCard(d, "onboarding")}
    </div>
  </div>`;
}

function renderProfileEdit() {
  const d = ensureDraft();
  return `
  <div class="fade-in max-w-3xl">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-extrabold text-slate-900">Your Profile</h1>
        <p class="text-slate-500 text-sm mt-1">Update your details — recommendations refresh automatically.</p>
      </div>
    </div>
    ${profileFormCard(d, "profile")}
  </div>`;
}

function profileFormCard(d, mode) {
  const submitLabel = mode === "onboarding" ? "See My Recommendations" : "Save Changes";
  return `
  <form id="profile-form" class="bg-white rounded-2xl border border-slate-100 shadow-card p-6 sm:p-8 space-y-8">
    <div class="grid sm:grid-cols-2 gap-5">
      <label class="block">
        <span class="text-sm font-semibold text-slate-700">Name</span>
        <input name="name" required value="${escapeAttr(d.name)}" placeholder="e.g. Priya Sharma"
          class="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400" />
      </label>
      <label class="block">
        <span class="text-sm font-semibold text-slate-700">Education</span>
        <input name="education" required value="${escapeAttr(d.education)}" placeholder="e.g. Diploma in AI &amp; ML"
          class="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400" />
      </label>
      <label class="block">
        <span class="text-sm font-semibold text-slate-700">College</span>
        <input name="college" value="${escapeAttr(d.college)}" placeholder="e.g. Government Polytechnic, Pune"
          class="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400" />
      </label>
      <label class="block">
        <span class="text-sm font-semibold text-slate-700">Year</span>
        <input name="year" value="${escapeAttr(d.year)}" placeholder="e.g. Final Year"
          class="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400" />
      </label>
    </div>

    <div class="rounded-2xl border border-brand-100 bg-brand-50/60 p-4 sm:p-5">
      <div class="flex items-start gap-3 mb-3">
        <div class="w-9 h-9 rounded-xl bg-white text-brand-600 flex items-center justify-center shrink-0">${icon("scan-text", "w-4 h-4")}</div>
        <div><h3 class="font-bold text-slate-900">Build profile from your resume</h3><p class="text-xs text-slate-500 mt-0.5">Paste resume text and OpporTune will detect skills and interests from its known catalog — no external AI API.</p></div>
      </div>
      <textarea id="resume-text" rows="5" placeholder="Paste your resume text here…" class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"></textarea>
      <div class="flex items-center justify-between gap-3 mt-3"><span id="resume-result" class="text-xs text-slate-500">Keyword matching stays on this device.</span><button type="button" data-action="scan-resume" class="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl">${icon("sparkles", "w-4 h-4")} Scan Resume</button></div>
    </div>

    <div>
      <span class="text-sm font-semibold text-slate-700 block mb-2.5">Skills</span>
      ${chipSelector("skills", SKILL_OPTIONS, d.skills)}
    </div>
    <div>
      <span class="text-sm font-semibold text-slate-700 block mb-2.5">Interests</span>
      ${chipSelector("interests", INTEREST_OPTIONS, d.interests)}
    </div>
    <div>
      <span class="text-sm font-semibold text-slate-700 block mb-2.5">Preferred Categories</span>
      ${chipSelector("categories", CATEGORY_OPTIONS, d.categories)}
    </div>

    <div id="form-error" class="hidden text-sm font-medium text-red-600 bg-red-50 rounded-lg px-4 py-2.5"></div>

    <button type="submit" class="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-6 py-3 rounded-xl shadow-soft transition">
      ${submitLabel} ${icon("arrow-right", "w-4 h-4")}
    </button>
  </form>`;
}

function chipSelector(field, options, selected) {
  return `
  <div class="flex flex-wrap gap-2" data-chip-group="${field}">
    ${options.map((opt) => `
      <button type="button" data-chip="${field}" data-value="${escapeAttr(opt)}" class="chip ${selected.includes(opt) ? "selected" : ""}">
        ${opt}
      </button>`).join("")}
  </div>`;
}

function escapeAttr(s) {
  return String(s || "").replace(/"/g, "&quot;");
}
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ============================================================
   APP SHELL (sidebar + topbar + mobile nav)
   ============================================================ */
function renderShell(content, active) {
  const navItems = [
    { key: "dashboard", label: "Dashboard", icon: "home" },
    { key: "explore", label: "Explore", icon: "search" },
    { key: "saved", label: "Saved", icon: "bookmark" },
    { key: "tracker", label: "Tracker", icon: "kanban" },
    { key: "profile", label: "Profile", icon: "user" },
  ];
  return `
  <div class="min-h-screen flex">
    <aside class="hidden lg:flex flex-col w-64 border-r border-slate-100 bg-white px-4 py-6 shrink-0">
      <div class="flex items-center gap-2 font-extrabold text-lg text-slate-900 px-2 mb-8">
        <span class="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white">${icon("target", "w-5 h-5")}</span>
        OpporTune
      </div>
      <nav class="space-y-1 flex-1">
        ${navItems.map((n) => `
          <a href="#/${n.key}" class="nav-link ${active === n.key ? "active" : ""}">
            ${icon(n.icon, "w-[18px] h-[18px]")} ${n.label}
          </a>`).join("")}
      </nav>
      <div class="flex items-center gap-3 px-2 pt-4 border-t border-slate-100">
        <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-sm">${initials(state.profile?.name)}</div>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-slate-800 truncate">${escapeHtml(state.profile?.name || "Student")}</p>
          <p class="text-xs text-slate-400 truncate">${escapeHtml(state.profile?.education || "")}</p>
        </div>
      </div>
    </aside>

    <main class="flex-1 min-w-0">
      <div class="lg:hidden sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-100 px-5 py-4 flex items-center justify-between">
        <div class="flex items-center gap-2 font-extrabold text-slate-900">
          <span class="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white">${icon("target", "w-4 h-4")}</span>
          OpporTune
        </div>
      </div>
      <div class="px-5 sm:px-8 py-6 sm:py-8 max-w-6xl mx-auto pb-28 lg:pb-8">
        ${state.error ? `<div class="mb-5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">${escapeHtml(state.error)}</div>` : ""}
        ${content}
      </div>
    </main>

    <nav class="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-100 flex items-center justify-around py-2">
      ${navItems.map((n) => `
        <a href="#/${n.key}" class="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg ${active === n.key ? "text-brand-600" : "text-slate-400"}">
          ${icon(n.icon, "w-5 h-5")}
          <span class="text-[10px] font-semibold">${n.label}</span>
        </a>`).join("")}
    </nav>
  </div>`;
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function renderDashboard() {
  const results = state.matched;
  if (!results.length) {
    return emptyState("compass", "No recommendations yet", "We couldn't compute matches — try refreshing or updating your profile.");
  }
  const top = results[0];
  const rest = results.slice(1, 7);
  const highMatch = results.filter((r) => r.matchScore >= 85).length;
  const closingSoon = results.filter((r) => r.daysRemaining <= 5 && r.daysRemaining >= 0).length;
  const closingList = [...results].sort((a, b) => a.daysRemaining - b.daysRemaining).slice(0, 4);

  return `
    <div class="mb-7 rounded-3xl bg-white/80 border border-white shadow-card p-5 sm:p-6 relative overflow-hidden">
      <div class="absolute -right-16 -top-20 w-56 h-56 rounded-full bg-brand-100/60 blur-2xl"></div>
      <div class="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div>
          <div class="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-brand-600 mb-2">
            <span class="status-live">Live recommendations</span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900">Good ${greetingWord()}, ${escapeHtml(state.profile.name.split(" ")[0])} 👋</h1>
          <p class="text-slate-500 mt-1">Your next opportunity is closer than you think.</p>
        </div>
        <a href="#/explore" class="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl transition shadow-sm">
          Explore all ${icon("arrow-up-right", "w-4 h-4")}
        </a>
      </div>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
      ${statCard("sparkles", results.length, "Recommended", "text-brand-600 bg-brand-50")}
      ${statCard("flame", highMatch, "High Match", "text-emerald-600 bg-emerald-50")}
      ${statCard("clock", closingSoon, "Closing Soon", "text-amber-600 bg-amber-50")}
      ${statCard("bookmark", state.saved.size, "Saved", "text-rose-600 bg-rose-50")}
    </div>

    <section class="mb-9">
      <h2 class="text-sm font-bold uppercase tracking-wide text-slate-400 mb-3">Top Match</h2>
      ${featuredCard(top)}
    </section>

    ${renderSkillGapPanel(top)}

    <section class="mb-9">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-bold uppercase tracking-wide text-slate-400">Recommended For You</h2>
        <a href="#/explore" class="text-sm font-semibold text-brand-600 hover:text-brand-700">See all →</a>
      </div>
      <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        ${rest.map(opportunityCard).join("")}
      </div>
    </section>

    <section>
      <h2 class="text-sm font-bold uppercase tracking-wide text-slate-400 mb-3">⏳ Closing Soon</h2>
      <div class="bg-white rounded-2xl border border-slate-100 shadow-card divide-y divide-slate-100">
        ${closingList.map(closingRow).join("")}
      </div>
    </section>
  `;
}

function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function statCard(iconName, value, label, colorCls) {
  return `
  <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-4 sm:p-5">
    <div class="w-9 h-9 rounded-lg ${colorCls} flex items-center justify-center mb-3">${icon(iconName, "w-5 h-5")}</div>
    <p class="text-2xl font-extrabold text-slate-900">${value}</p>
    <p class="text-xs font-medium text-slate-500 mt-0.5">${label}</p>
  </div>`;
}

function featuredCard(o) {
  return `
  <div class="relative bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl shadow-soft p-6 sm:p-8 text-white overflow-hidden card-hover cursor-pointer" data-open-modal="${o.id}">
    <div class="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-white/10"></div>
    <div class="relative flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-10">
      <div class="shrink-0">
        ${scoreRing(o.matchScore, 96, true)}
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-white/15">${icon(CATEGORY_ICON[o.category] || "layers", "w-3.5 h-3.5 inline -mt-0.5 mr-1")}${o.category}</span>
          <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-white/15">🔥 ${o.matchScore}% Match</span>
        </div>
        <h3 class="text-xl sm:text-2xl font-extrabold">${o.title}</h3>
        <p class="text-white/80 text-sm mt-0.5">${o.organization} · ${o.remote ? "Remote" : o.location}</p>
        <div class="flex flex-wrap gap-1.5 mt-3">
          ${o.matchedSkills.slice(0, 4).map((s) => `<span class="text-xs bg-white/15 px-2.5 py-1 rounded-md">${escapeHtml(s)}</span>`).join("")}
        </div>
        <p class="text-sm text-white/85 mt-4">${o.urgency.emoji} ${o.urgency.label} · Deadline ${fmtDate(o.deadline)}</p>
      </div>
      <button data-nav-stop data-action="apply" data-id="${o.id}" class="shrink-0 inline-flex items-center gap-2 bg-white text-brand-700 font-bold px-5 py-3 rounded-xl hover:bg-brand-50 transition">
        Apply Now ${icon("external-link", "w-4 h-4")}
      </button>
    </div>
  </div>`;
}

function scoreRing(score, size = 72, light = false) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const stroke = light ? "#ffffff" : scoreRingColor(score);
  const bg = light ? "rgba(255,255,255,0.25)" : "#e2e8f0";
  const textCls = light ? "fill-white" : "fill-slate-900";
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="-rotate-90">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${bg}" stroke-width="8"></circle>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${stroke}" stroke-width="8"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}"></circle>
    <text x="${size / 2}" y="${size / 2}" transform="rotate(90 ${size / 2} ${size / 2})" text-anchor="middle" dominant-baseline="middle"
      class="${textCls}" style="font-size:${size * 0.24}px; font-weight:800;">${score}%</text>
  </svg>`;
}

function closingRow(o) {
  return `
  <div class="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 cursor-pointer transition" data-open-modal="${o.id}">
    <div class="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">${icon(CATEGORY_ICON[o.category] || "layers", "w-4 h-4 text-slate-500")}</div>
    <div class="min-w-0 flex-1">
      <p class="font-semibold text-slate-800 truncate">${escapeHtml(o.title)}</p>
      <p class="text-xs text-slate-400">${escapeHtml(o.organization)} · ${o.category}</p>
    </div>
    <span class="text-xs font-bold whitespace-nowrap">${o.urgency.emoji} ${o.urgency.label}</span>
  </div>`;
}

function emptyState(iconName, title, body, action) {
  return `
  <div class="text-center py-20">
    <div class="w-14 h-14 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-4">${icon(iconName, "w-6 h-6 text-slate-400")}</div>
    <h3 class="font-bold text-slate-800">${title}</h3>
    <p class="text-sm text-slate-500 mt-1 max-w-xs mx-auto">${body}</p>
    ${action || ""}
  </div>`;
}

/* ============================================================
   OPPORTUNITY CARD (grid)
   ============================================================ */
function opportunityCard(o) {
  const saved = state.saved.has(o.id);
  return `
  <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-5 card-hover cursor-pointer flex flex-col" data-open-modal="${o.id}">
    <div class="flex items-start justify-between gap-3 mb-3">
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">${icon(CATEGORY_ICON[o.category] || "layers", "w-4 h-4 text-slate-500")}</div>
        <div class="min-w-0">
          <p class="text-xs font-semibold text-brand-600">${o.category}</p>
          <h3 class="font-bold text-slate-900 truncate">${escapeHtml(o.title)}</h3>
        </div>
      </div>
      <span class="shrink-0 text-xs font-extrabold px-2.5 py-1 rounded-full ${scoreColor(o.matchScore)}">${o.matchScore}%</span>
    </div>
    <p class="text-sm text-slate-500 mb-1">${escapeHtml(o.organization)} · ${o.remote ? "Remote" : escapeHtml(o.location)}</p>
    <p class="text-sm text-slate-500 line-clamp-2 mb-3">${escapeHtml(o.description)}</p>
    <div class="flex flex-wrap gap-1.5 mb-4">
      ${o.skills.slice(0, 3).map((s) => `<span class="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md">${escapeHtml(s)}</span>`).join("")}
    </div>
    <div class="mt-auto flex items-center justify-between pt-3 border-t border-slate-100">
      <span class="text-xs font-semibold text-slate-500">${o.urgency.emoji} ${o.urgency.label}</span>
      <div class="flex items-center gap-1.5" data-nav-stop>
        <button data-action="toggle-save" data-id="${o.id}" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 ${saved ? "text-rose-500" : "text-slate-400"}" title="Save">
          ${icon("bookmark", "w-4 h-4" + (saved ? " fill-current" : ""))}
        </button>
        <button data-action="apply" data-id="${o.id}" class="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-900 text-white px-3 py-2 rounded-lg hover:bg-slate-800">
          Apply ${icon("external-link", "w-3.5 h-3.5")}
        </button>
      </div>
    </div>
  </div>`;
}

/* ============================================================
   EXPLORE
   ============================================================ */
function renderExplore() {
  const f = state.explore;
  let list = state.matched.length ? state.matched : state.opportunities.map((o) => ({ ...o, matchScore: 0, urgency: { emoji: "🟢", label: "" }, matchedSkills: [] }));

  list = list.filter((o) => {
    if (f.query) {
      const q = f.query.toLowerCase();
      if (!(o.title.toLowerCase().includes(q) || o.organization.toLowerCase().includes(q) || o.description.toLowerCase().includes(q))) return false;
    }
    if (f.category && o.category !== f.category) return false;
    if (f.skill && !o.skills.includes(f.skill)) return false;
    if (f.location && o.location !== f.location) return false;
    if (f.remote === "remote" && !o.remote) return false;
    if (f.remote === "onsite" && o.remote) return false;
    if (f.minScore && o.matchScore < Number(f.minScore)) return false;
    if (f.deadlineWithin && !(o.daysRemaining <= Number(f.deadlineWithin))) return false;
    return true;
  });

  return `
    <div class="mb-6">
      <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900">Explore Opportunities</h1>
      <p class="text-slate-500 mt-1">Search and filter across every listing on OpporTune.</p>
    </div>

    <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-4 sm:p-5 mb-6">
      <div class="relative mb-4">
        ${icon("search", "w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2")}
        <input id="explore-search" value="${escapeAttr(f.query)}" placeholder="Search internships, hackathons, courses..."
          class="w-full rounded-xl border border-slate-200 pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-400" />
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        ${selectFilter("category", "All Categories", state.meta.categories, f.category)}
        ${selectFilter("skill", "All Skills", state.meta.skills, f.skill)}
        ${selectFilter("location", "All Locations", state.meta.locations, f.location)}
        ${selectFilter("remote", "Remote or On-site", [{ v: "remote", l: "Remote" }, { v: "onsite", l: "On-site" }], f.remote)}
        ${selectFilter("deadlineWithin", "Any Deadline", [{ v: "2", l: "Within 2 days" }, { v: "5", l: "Within 5 days" }, { v: "14", l: "Within 2 weeks" }], f.deadlineWithin)}
        ${selectFilter("minScore", "Any Match %", [{ v: "85", l: "85%+" }, { v: "65", l: "65%+" }, { v: "40", l: "40%+" }], f.minScore)}
      </div>
    </div>

    <p class="text-sm text-slate-500 mb-4">${list.length} opportunit${list.length === 1 ? "y" : "ies"} found</p>
    ${list.length
      ? `<div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">${list.map(opportunityCard).join("")}</div>`
      : emptyState("search-x", "No matches found", "Try adjusting your filters or search term.")}
  `;
}

function selectFilter(field, allLabel, options, value) {
  const opts = options.map((o) => (typeof o === "string" ? { v: o, l: o } : o));
  return `
  <select data-filter="${field}" class="text-sm rounded-xl border border-slate-200 px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400">
    <option value="">${allLabel}</option>
    ${opts.map((o) => `<option value="${escapeAttr(o.v)}" ${String(value) === String(o.v) ? "selected" : ""}>${escapeHtml(o.l)}</option>`).join("")}
  </select>`;
}

function renderBreakdown(o) {
  if (!o?.breakdown) return "";
  const b = o.breakdown;
  const parts = [["Skills", b.skills, 40], ["Interests", b.interests, 25], ["Education", b.education, 15], ["Category", b.category, 10], ["Deadline", b.deadline, 10]];
  let cursor = 0;
  const total = Math.max(1, parts.reduce((sum, p) => sum + p[1], 0));
  const gradient = parts.map(([, value, max]) => {
    const start = cursor; cursor += value / total * 100;
    return `${scoreRingColor(Math.round(value / Math.max(1, max) * 100))} ${start.toFixed(1)}% ${cursor.toFixed(1)}%`;
  }).join(", ");
  return `<div class="bg-white border border-slate-100 shadow-card rounded-2xl p-5">
    <div class="flex items-center justify-between mb-4">
      <div><h3 class="font-bold text-slate-900">Visual match breakdown</h3><p class="text-xs text-slate-500 mt-0.5">The 5 weighted components behind your score</p></div>
      <div class="relative w-16 h-16 rounded-full" style="background:conic-gradient(${gradient})"><div class="absolute inset-2 rounded-full bg-white flex items-center justify-center text-sm font-extrabold text-slate-900">${o.matchScore}%</div></div>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">${parts.map(([label, value, max]) => `<div class="rounded-xl bg-slate-50 px-3 py-2.5"><p class="text-[11px] text-slate-400 font-semibold uppercase">${label}</p><p class="text-sm font-extrabold text-slate-800 mt-0.5">${value}/${max}</p><div class="h-1.5 rounded-full bg-slate-200 mt-2 overflow-hidden"><div class="h-full bg-brand-500 rounded-full" style="width:${Math.round(value / max * 100)}%"></div></div></div>`).join("")}</div>
  </div>`;
}

function renderSkillGapPanel(o) {
  const recs = o?.skillGapRecommendations || [];
  if (!recs.length) return `<section class="mb-9 rounded-2xl border border-emerald-100 bg-emerald-50 p-5"><div class="flex items-start gap-3"><div class="w-10 h-10 rounded-xl bg-white text-emerald-600 flex items-center justify-center">${icon("check-circle-2", "w-5 h-5")}</div><div><h2 class="font-bold text-emerald-900">No course gap detected for your top match</h2><p class="text-sm text-emerald-700 mt-1">Your current skills already cover the available course paths that could improve it.</p></div></div></section>`;
  return `<section class="mb-9 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-5 sm:p-6">
    <div class="flex items-start gap-3 mb-4"><div class="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-soft">${icon("trending-up", "w-5 h-5")}</div><div><p class="text-xs font-bold uppercase tracking-wide text-brand-600">Skill-Gap → Course Loop</p><h2 class="text-lg font-extrabold text-slate-900 mt-0.5">${escapeHtml(recs[0].courseTitle)} could raise your match ${recs[0].fromScore}% → ${recs[0].toScore}%</h2><p class="text-sm text-slate-500 mt-1">Adds ${recs[0].addedSkills.map(escapeHtml).join(", ")} for <b>${escapeHtml(o.title)}</b>.</p></div></div>
    <div class="flex flex-wrap gap-2">${recs.map(r => `<button data-action="open-modal" data-open-modal="${escapeAttr(r.courseId)}" class="text-left bg-white border border-slate-200 hover:border-brand-300 rounded-xl px-3 py-2.5 flex-1 min-w-[190px]"><p class="text-sm font-bold text-slate-800">${escapeHtml(r.courseTitle)}</p><p class="text-xs text-emerald-600 font-semibold mt-1">+${r.gain} points · ${r.addedSkills.map(escapeHtml).join(", ")}</p></button>`).join("")}</div>
  </section>`;
}

function trackerStatus(id) { return state.tracker[id] || "interested"; }

function renderTracker() {
  const trackedIds = [...new Set([...Object.keys(state.tracker), ...state.saved])];
  const groups = TRACKER_STATUSES.map(status => ({ ...status, items: trackedIds.map(id => matchedById(id)).filter(Boolean).filter(o => trackerStatus(o.id) === status.key) }));
  return `<div class="mb-6"><h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900">Application Tracker</h1><p class="text-slate-500 mt-1">Move opportunities from discovery to outcome.</p></div>
    <div class="grid md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">${groups.map(g => `<section class="rounded-2xl bg-slate-100/70 border border-slate-200/70 p-3 min-h-[260px]" data-tracker-drop="${g.key}"><div class="flex items-center justify-between px-2 py-2 mb-2"><div class="flex items-center gap-2"><span class="w-7 h-7 rounded-lg ${g.cls} flex items-center justify-center">${icon(g.icon, "w-3.5 h-3.5")}</span><h2 class="font-bold text-slate-800 text-sm">${g.label}</h2></div><span class="text-xs font-bold text-slate-400">${g.items.length}</span></div><div class="space-y-2">${g.items.length ? g.items.map(trackerCard).join("") : `<div class="border border-dashed border-slate-300 rounded-xl p-5 text-center text-xs text-slate-400">Drop an opportunity here</div>`}</div></section>`).join("")}</div>`;
}

function trackerCard(o) {
  const current = trackerStatus(o.id);
  return `<article class="bg-white rounded-xl border border-slate-100 shadow-card p-3 cursor-grab" draggable="true" data-tracker-id="${o.id}"><div class="flex items-start justify-between gap-2"><div><p class="text-sm font-bold text-slate-800 line-clamp-2">${escapeHtml(o.title)}</p><p class="text-xs text-slate-400 mt-1">${escapeHtml(o.organization)}</p></div><span class="text-xs font-extrabold ${scoreColor(o.matchScore || 0)} px-2 py-1 rounded-lg">${o.matchScore || 0}%</span></div><div class="mt-3 flex items-center gap-2"><select data-tracker-status data-id="${o.id}" class="flex-1 text-xs rounded-lg border border-slate-200 px-2 py-2 bg-white">${TRACKER_STATUSES.map(s => `<option value="${s.key}" ${s.key === current ? "selected" : ""}>${s.label}</option>`).join("")}</select><button data-action="open-modal" data-open-modal="${o.id}" class="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">${icon("eye", "w-4 h-4 text-slate-500")}</button></div></article>`;
}

/* ============================================================
   SAVED
   ============================================================ */
function renderSaved() {
  const ids = [...state.saved];
  const list = ids.map((id) => matchedById(id)).filter(Boolean).sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
  return `
    <div class="mb-6">
      <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900">Saved Opportunities</h1>
      <p class="text-slate-500 mt-1">Everything you've bookmarked, in one place.</p>
    </div>
    ${list.length
      ? `<div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">${list.map(opportunityCard).join("")}</div>`
      : emptyState("bookmark", "Nothing saved yet", "Tap the bookmark icon on any opportunity to save it here.",
          `<a href="#/explore" class="inline-flex mt-4 items-center gap-1.5 text-sm font-semibold text-brand-600">Explore opportunities →</a>`)}
  `;
}

/* ============================================================
   OPPORTUNITY DETAIL MODAL
   ============================================================ */
function renderApplicationModal(o) {
  const existing = state.applications[o.id];
  if (existing) {
    return `
      <section class="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 mb-6">
        <div class="flex items-start gap-3">
          <div class="w-11 h-11 rounded-xl bg-white text-emerald-600 flex items-center justify-center shrink-0">${icon("check-circle-2", "w-6 h-6")}</div>
          <div>
            <h3 class="font-extrabold text-emerald-900">Application submitted</h3>
            <p class="text-sm text-emerald-700 mt-1">Your application for <b>${escapeHtml(o.title)}</b> is saved in OpporTune and moved to Applied.</p>
            <p class="text-xs text-emerald-600 mt-2">Submitted ${escapeHtml(new Date(existing.submittedAt).toLocaleString())}</p>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button data-action="nav-tracker" class="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl">${icon("kanban-square", "w-4 h-4")} View Application Tracker</button>
          <button data-action="close-modal" class="inline-flex items-center gap-2 bg-white border border-emerald-200 text-emerald-700 font-bold px-4 py-2.5 rounded-xl">Done</button>
        </div>
      </section>`;
  }

  const profile = state.profile || {};
  return `
    <section class="rounded-2xl border border-brand-100 bg-brand-50 p-5 mb-6">
      <div class="flex items-start gap-3 mb-4">
        <div class="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center">${icon("send", "w-5 h-5")}</div>
        <div>
          <p class="text-xs font-bold uppercase tracking-wide text-brand-600">In-app application</p>
          <h3 class="font-extrabold text-slate-900 mt-0.5">Apply to ${escapeHtml(o.title)}</h3>
          <p class="text-sm text-slate-600 mt-1">Submit your application here. OpporTune will automatically move it to <b>Applied</b> in your tracker.</p>
        </div>
      </div>
      <form id="application-form" data-application-id="${escapeAttr(o.id)}" class="space-y-3">
        <div class="grid sm:grid-cols-2 gap-3">
          <label class="block"><span class="text-xs font-bold text-slate-600">Full name</span><input name="name" required value="${escapeAttr(profile.name || "")}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"></label>
          <label class="block"><span class="text-xs font-bold text-slate-600">Email</span><input name="email" type="email" required placeholder="mihir@example.com" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"></label>
        </div>
        <div class="grid sm:grid-cols-2 gap-3">
          <label class="block"><span class="text-xs font-bold text-slate-600">Phone</span><input name="phone" placeholder="+91 XXXXX XXXXX" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"></label>
          <label class="block"><span class="text-xs font-bold text-slate-600">Resume / Portfolio</span><input name="resume" placeholder="Resume.pdf or portfolio URL" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"></label>
        </div>
        <label class="block"><span class="text-xs font-bold text-slate-600">Why are you interested?</span><textarea name="coverNote" rows="3" placeholder="Briefly describe your interest and relevant skills..." class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"></textarea></label>
        <div class="flex items-center justify-between gap-3 pt-2">
          <p class="text-[11px] text-slate-500">Demo submission is stored locally in this browser.</p>
          <button type="submit" class="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold px-5 py-3 rounded-xl shadow-soft">${icon("send", "w-4 h-4")} Submit Application</button>
        </div>
      </form>
    </section>`;
}

function renderModal() {
  if (!state.modalId) return "";
  const o = matchedById(state.modalId);
  if (!o) return "";
  const saved = state.saved.has(o.id);
  const hasScore = typeof o.matchScore === "number" && state.profile;

  return `
  <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center modal-backdrop" data-action="close-modal">
    <div class="bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto fade-in" data-stop-close>
      <div class="sticky top-0 bg-white/95 backdrop-blur flex items-center justify-between px-6 py-4 border-b border-slate-100 rounded-t-3xl">
        <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">${icon(CATEGORY_ICON[o.category] || "layers", "w-3.5 h-3.5 inline -mt-0.5 mr-1")}${o.category}</span>
        <button data-action="close-modal" class="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center">${icon("x", "w-5 h-5 text-slate-500")}</button>
      </div>
      <div class="px-6 py-6">
        <div class="flex items-start justify-between gap-4 mb-1">
          <h2 class="text-2xl font-extrabold text-slate-900">${escapeHtml(o.title)}</h2>
          ${hasScore ? scoreRing(o.matchScore, 64) : ""}
        </div>
        <p class="text-slate-500 mb-5">${escapeHtml(o.organization)} · ${o.remote ? "Remote" : escapeHtml(o.location)}</p>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 text-sm">
          ${detailChip("clock", o.duration)}
          ${detailChip("calendar", fmtDate(o.deadline))}
          ${detailChip("map-pin", o.remote ? "Remote" : o.location)}
          ${detailChip("shield-check", o.urgency ? `${o.urgency.emoji} ${o.urgency.label}` : "")}
        </div>

        <section class="mb-6">
          <h3 class="font-bold text-slate-800 mb-1.5">Description</h3>
          <p class="text-sm text-slate-600 leading-relaxed">${escapeHtml(o.description)}</p>
        </section>

        <section class="mb-6">
          <h3 class="font-bold text-slate-800 mb-1.5">Eligibility</h3>
          <p class="text-sm text-slate-600 leading-relaxed">${escapeHtml(o.eligibility)}</p>
        </section>

        <section class="mb-6">
          <h3 class="font-bold text-slate-800 mb-2">Required Skills</h3>
          <div class="flex flex-wrap gap-1.5">
            ${o.skills.map((s) => `<span class="text-xs font-medium px-2.5 py-1 rounded-md ${o.matchedSkills && o.matchedSkills.includes(s) ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}">${escapeHtml(s)}</span>`).join("") || `<span class="text-sm text-slate-400">None specified</span>`}
          </div>
        </section>

        ${hasScore ? `
        <section class="mb-6 bg-brand-50 rounded-2xl p-5">
          <h3 class="font-bold text-brand-800 mb-2.5">Why this matches you</h3>
          <ul class="space-y-1.5">
            ${o.reasons.map((r) => `<li class="flex items-start gap-2 text-sm text-brand-800"><span class="mt-0.5">✓</span>${escapeHtml(r)}</li>`).join("")}
          </ul>
        </section>
        ${renderBreakdown(o)}
        ${o.skillGapRecommendations?.length ? `<section class="mt-6 rounded-2xl border border-brand-100 bg-brand-50 p-5"><h3 class="font-bold text-brand-900">Close your skill gap</h3><p class="text-sm text-brand-700 mt-1">Courses from our catalog that can improve this exact match:</p><div class="space-y-2 mt-3">${o.skillGapRecommendations.map((r) => `<button data-action="open-modal" data-open-modal="${escapeAttr(r.courseId)}" class="w-full text-left bg-white rounded-xl border border-brand-100 p-3 hover:border-brand-300"><div class="flex items-center justify-between gap-3"><span class="text-sm font-bold text-slate-800">${escapeHtml(r.courseTitle)}</span><span class="text-sm font-extrabold text-emerald-600">${r.fromScore}% → ${r.toScore}%</span></div><p class="text-xs text-slate-500 mt-1">Learn: ${r.addedSkills.map(escapeHtml).join(", ")}</p></button>`).join("")}</div></section>` : ""}` : ""}

        ${renderApplicationModal(o)}

        <div class="flex items-center gap-3 flex-wrap">
          <button data-action="toggle-save" data-id="${o.id}" class="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 border-2 ${saved ? "border-rose-200 bg-rose-50 text-rose-600" : "border-slate-200 text-slate-700"} font-bold px-5 py-3 rounded-xl hover:bg-slate-50 transition">❤️ ${saved ? "Saved" : "Save"}</button>
          <button data-action="set-status" data-id="${o.id}" data-status="interested" class="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 border-2 ${trackerStatus(o.id) === "interested" ? "border-brand-200 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-700"} font-bold px-5 py-3 rounded-xl">${trackerStatus(o.id) === "interested" ? "✓ Interested" : "Add to Tracker"}</button>
          <button data-action="apply" data-id="${o.id}" class="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 ${state.applications[o.id] ? "bg-emerald-600 hover:bg-emerald-700" : "bg-brand-600 hover:bg-brand-700"} text-white font-bold px-5 py-3 rounded-xl shadow-soft transition">${state.applications[o.id] ? "✓ Application Submitted" : "🚀 Apply Now"}</button>
        </div>
      </div>
    </div>
  </div>`;
}

function detailChip(iconName, text) {
  if (!text) return "";
  return `
  <div class="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5">
    ${icon(iconName, "w-4 h-4 text-slate-400 shrink-0")}
    <span class="font-medium text-slate-700 truncate">${escapeHtml(text)}</span>
  </div>`;
}

/* ============================================================
   AI OPPORTUNITY ASSISTANT (rule-based, no external API key)
   ============================================================ */
function renderAssistant() {
  if (!state.profile) return "";
  return `
  <button data-action="toggle-ai" class="fixed bottom-20 lg:bottom-6 right-5 z-40 w-14 h-14 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-soft flex items-center justify-center transition">
    ${icon(state.aiOpen ? "x" : "sparkles", "w-6 h-6")}
  </button>
  ${state.aiOpen ? `
  <div class="fixed bottom-36 lg:bottom-24 right-5 z-40 w-[92vw] max-w-sm bg-white rounded-2xl shadow-soft border border-slate-100 flex flex-col overflow-hidden fade-in" style="height: min(60vh, 460px);">
    <div class="px-4 py-3 border-b border-slate-100 bg-slate-900 text-white flex items-center gap-2">
      ${icon("sparkles", "w-4 h-4")}
      <div>
        <p class="font-bold text-sm leading-tight">AI Opportunity Assistant</p>
        <p class="text-[11px] text-slate-300 leading-tight">Built-in · no API key needed</p>
      </div>
    </div>
    <div id="ai-messages" class="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50">
      ${state.aiMessages.map(aiMessageBubble).join("")}
    </div>
    <form id="ai-form" class="flex items-center gap-2 border-t border-slate-100 p-2.5">
      <input id="ai-input" placeholder="Ask about your matches…" class="flex-1 text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400" />
      <button type="submit" class="w-10 h-10 rounded-xl bg-brand-600 hover:bg-brand-700 text-white flex items-center justify-center shrink-0">${icon("send", "w-4 h-4")}</button>
    </form>
  </div>` : ""}
  `;
}

function aiMessageBubble(m) {
  const isUser = m.role === "user";
  return `
  <div class="flex ${isUser ? "justify-end" : "justify-start"}">
    <div class="max-w-[85%] text-sm rounded-2xl px-3.5 py-2.5 leading-relaxed ${isUser ? "bg-brand-600 text-white rounded-br-sm" : "bg-white border border-slate-100 text-slate-700 rounded-bl-sm"}">
      ${escapeHtml(m.text).replace(/\n/g, "<br/>")}
    </div>
  </div>`;
}

function aiRespond(question) {
  const q = question.toLowerCase();
  const results = state.matched;
  if (!results.length) return "Build your profile first so I can compute matches!";

  // "why should I apply" / "why this" → explain top match or last opened opportunity
  if (q.includes("why") && (q.includes("apply") || q.includes("match") || q.includes("this"))) {
    const target = state.modalId ? matchedById(state.modalId) : results[0];
    if (target && target.reasons) {
      return `For "${target.title}" (${target.matchScore}% match):\n` + target.reasons.map((r) => "✓ " + r).join("\n");
    }
  }

  // "missing skills" → skills required by top 3 matches not in profile
  if (q.includes("missing") && q.includes("skill")) {
    const mySkills = new Set(state.profile.skills.map((s) => s.toLowerCase()));
    const missing = new Set();
    results.slice(0, 5).forEach((o) => o.skills.forEach((s) => { if (!mySkills.has(s.toLowerCase())) missing.add(s); }));
    return missing.size
      ? `Skills that show up in your top matches but aren't on your profile yet: ${[...missing].join(", ")}.`
      : "You already cover the key skills across your top matches — nice work!";
  }

  // skill-specific query, e.g. "python", "react"
  const allSkills = [...new Set(state.opportunities.flatMap((o) => o.skills))];
  const foundSkill = allSkills.find((s) => q.includes(s.toLowerCase()));
  if (foundSkill) {
    const matches = results.filter((o) => o.skills.some((s) => s.toLowerCase() === foundSkill.toLowerCase())).slice(0, 3);
    if (matches.length) {
      return `Best matches for ${foundSkill}:\n` + matches.map((o) => `• ${o.title} (${o.organization}) — ${o.matchScore}% match`).join("\n");
    }
    return `I couldn't find open opportunities requiring ${foundSkill} right now.`;
  }

  // category query
  const foundCategory = CATEGORY_OPTIONS.find((c) => q.includes(c.toLowerCase()));
  if (foundCategory) {
    const matches = results.filter((o) => o.category === foundCategory).slice(0, 3);
    return matches.length
      ? `Top ${foundCategory} picks for you:\n` + matches.map((o) => `• ${o.title} — ${o.matchScore}% match, ${o.urgency.label}`).join("\n")
      : `No ${foundCategory} listings match your profile right now — try Explore for the full catalog.`;
  }

  // deadline query
  if (q.includes("deadline") || q.includes("closing") || q.includes("urgent")) {
    const soon = [...results].sort((a, b) => a.daysRemaining - b.daysRemaining).slice(0, 3);
    return "Closing soonest:\n" + soon.map((o) => `• ${o.title} — ${o.urgency.emoji} ${o.urgency.label}`).join("\n");
  }

  // default: top match summary
  const top = results[0];
  return `Your top match right now is "${top.title}" at ${top.organization} (${top.matchScore}% match). Try asking "why should I apply?" or naming a skill like "Python" or a category like "hackathon".`;
}

/* ============================================================
   EVENT HANDLING
   ============================================================ */
let handlersAttached = false;

function attachGlobalHandlers() {
  if (handlersAttached) return;
  handlersAttached = true;

  document.body.addEventListener("click", (e) => {
    const navBtn = e.target.closest("[data-nav]");
    if (navBtn) {
      navigate(navBtn.getAttribute("data-nav"));
      return;
    }

    const demoBtn = e.target.closest("[data-action='demo-login']");
    if (demoBtn) {
      applyDemoProfile();
      return;
    }

    const chip = e.target.closest("[data-chip]");
    if (chip) {
      toggleChip(chip.getAttribute("data-chip"), chip.getAttribute("data-value"));
      return;
    }

    const saveBtn = e.target.closest("[data-action='toggle-save']");
    if (saveBtn) {
      e.stopPropagation();
      toggleSave(saveBtn.getAttribute("data-id"));
      return;
    }

    const applyBtn = e.target.closest("[data-action='apply']");
    if (applyBtn) {
      e.stopPropagation();
      const id = applyBtn.getAttribute("data-id");
      if (byId(id)) {
        state.modalId = id;
        state.applicationId = id;
        render();
        setTimeout(() => document.getElementById("application-form")?.querySelector("input[name='email']")?.focus(), 0);
      }
      return;
    }

    const navTrackerBtn = e.target.closest("[data-action='nav-tracker']");
    if (navTrackerBtn) {
      state.modalId = null;
      state.applicationId = null;
      navigate("tracker");
      return;
    }

    const statusBtn = e.target.closest("[data-action='set-status']");
    if (statusBtn) {
      setApplicationStatus(statusBtn.getAttribute("data-id"), statusBtn.getAttribute("data-status"));
      return;
    }

    const scanBtn = e.target.closest("[data-action='scan-resume']");
    if (scanBtn) {
      scanResume();
      return;
    }

    const openModalEl = e.target.closest("[data-open-modal]");
    if (openModalEl && !e.target.closest("[data-nav-stop]")) {
      state.modalId = openModalEl.getAttribute("data-open-modal");
      render();
      return;
    }

    const closeModal = e.target.closest("[data-action='close-modal']");
    if (closeModal && !e.target.closest("[data-stop-close]")) {
      state.modalId = null;
      state.applicationId = null;
      render();
      return;
    }

    const aiToggle = e.target.closest("[data-action='toggle-ai']");
    if (aiToggle) {
      state.aiOpen = !state.aiOpen;
      render();
      return;
    }
  });
}

function attachRouteHandlers() {
  const form = document.getElementById("profile-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submitProfileForm(form);
    });
  }

  const applicationForm = document.getElementById("application-form");
  if (applicationForm) {
    applicationForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const id = applicationForm.getAttribute("data-application-id");
      const o = byId(id);
      if (!o) return;
      const fd = new FormData(applicationForm);
      state.applications[id] = {
        name: String(fd.get("name") || "").trim(),
        email: String(fd.get("email") || "").trim(),
        phone: String(fd.get("phone") || "").trim(),
        resume: String(fd.get("resume") || "").trim(),
        coverNote: String(fd.get("coverNote") || "").trim(),
        submittedAt: new Date().toISOString(),
      };
      saveJSON("opportune_applications", state.applications);
      state.tracker[id] = "applied";
      saveJSON("opportune_tracker", state.tracker);
      state.applicationId = id;
      render();
    });
  }

  const search = document.getElementById("explore-search");
  if (search) {
    search.addEventListener("input", () => {
      const val = search.value;
      state.explore.query = val;
      render();
      const el = document.getElementById("explore-search");
      if (el) {
        el.focus();
        el.setSelectionRange(val.length, val.length);
      }
    });
  }
  document.querySelectorAll("[data-filter]").forEach((el) => {
    el.addEventListener("change", () => {
      state.explore[el.getAttribute("data-filter")] = el.value;
      render();
    });
  });

  document.querySelectorAll("[data-tracker-status]").forEach((el) => {
    el.addEventListener("change", () => setApplicationStatus(el.getAttribute("data-id"), el.value));
  });
  document.querySelectorAll("[data-tracker-id]").forEach((card) => {
    card.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", card.getAttribute("data-tracker-id")); });
  });
  document.querySelectorAll("[data-tracker-drop]").forEach((drop) => {
    drop.addEventListener("dragover", (e) => e.preventDefault());
    drop.addEventListener("drop", (e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) setApplicationStatus(id, drop.getAttribute("data-tracker-drop")); });
  });

  const aiForm = document.getElementById("ai-form");
  if (aiForm) {
    aiForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("ai-input");
      const text = input.value.trim();
      if (!text) return;
      state.aiMessages.push({ role: "user", text });
      const reply = aiRespond(text);
      state.aiMessages.push({ role: "assistant", text: reply });
      render();
      setTimeout(() => {
        document.getElementById("ai-input")?.focus();
        const msgs = document.getElementById("ai-messages");
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
      }, 0);
    });
  }
}

function toggleChip(field, value) {
  const d = ensureDraft();
  const idx = d[field].indexOf(value);
  if (idx >= 0) d[field].splice(idx, 1);
  else d[field].push(value);
  render();
}

function applyDemoProfile() {
  state.formDraft = JSON.parse(JSON.stringify(DEMO_PROFILE));
  render();
}

async function submitProfileForm(form) {
  const d = state.formDraft;
  const fd = new FormData(form);
  d.name = fd.get("name")?.trim() || "";
  d.education = fd.get("education")?.trim() || "";
  d.college = fd.get("college")?.trim() || "";
  d.year = fd.get("year")?.trim() || "";

  const errEl = document.getElementById("form-error");
  if (!d.name || !d.education) {
    errEl.textContent = "Please fill in your name and education.";
    errEl.classList.remove("hidden");
    return;
  }
  if (d.skills.length === 0 && d.interests.length === 0) {
    errEl.textContent = "Select at least one skill or interest so we can personalize your matches.";
    errEl.classList.remove("hidden");
    return;
  }
  errEl.classList.add("hidden");

  state.profile = JSON.parse(JSON.stringify(d));
  saveJSON("opportune_profile", state.profile);
  state.formDraft = null;

  state.loading = true;
  render();
  await refreshMatches();
  state.loading = false;
  state.route = "dashboard";
  window.location.hash = "/dashboard";
  render();
}

function setApplicationStatus(id, status) {
  if (!TRACKER_STATUSES.some(s => s.key === status)) return;
  state.tracker[id] = status;
  saveJSON("opportune_tracker", state.tracker);
  render();
}

function scanResume() {
  const box = document.getElementById("resume-text");
  const result = document.getElementById("resume-result");
  if (!box) return;
  const text = box.value.toLowerCase();
  if (!text.trim()) { result.textContent = "Paste some resume text first."; return; }
  const aliases = {
    "Machine Learning": ["machine learning", "ml", "machine-learning"],
    "Data Science": ["data science", "data scientist", "data analysis"],
    "JavaScript": ["javascript", "js"],
    "Node.js": ["node.js", "nodejs", "node js"],
    "React": ["react", "react.js", "reactjs"],
    "SQL": ["sql", "mysql", "postgresql", "postgres"],
    "Pandas": ["pandas"],
    "Python": ["python", "py"],
    "HTML": ["html", "html5"],
    "CSS": ["css", "css3"],
    "Linux": ["linux", "ubuntu"],
    "Networking": ["networking", "network administration", "tcp/ip"],
    "Excel": ["excel", "microsoft excel", "spreadsheet"],
    "Communication": ["communication", "presentation", "public speaking"],
    "Java": ["java"],
  };
  const foundSkills = SKILL_OPTIONS.filter(skill => (aliases[skill] || [skill.toLowerCase()]).some(term => new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i").test(text)));
  const interestAliases = { "AI/ML": ["ai", "artificial intelligence", "machine learning"], "Web Development": ["web development", "frontend", "backend", "full stack", "full-stack"], "Data Science": ["data science", "data analytics"], "Cybersecurity": ["cybersecurity", "ethical hacking", "information security"], "Entrepreneurship": ["startup", "entrepreneurship", "business"] };
  const foundInterests = INTEREST_OPTIONS.filter(i => (interestAliases[i] || [i.toLowerCase()]).some(term => text.includes(term)));
  const d = ensureDraft();
  d.skills = [...new Set([...d.skills, ...foundSkills])];
  d.interests = [...new Set([...d.interests, ...foundInterests])];
  result.textContent = foundSkills.length || foundInterests.length ? `Detected ${foundSkills.length} skills and ${foundInterests.length} interests.` : "No catalog keywords detected — try a fuller resume paste.";
  render();
}

function toggleSave(id) {
  if (state.saved.has(id)) state.saved.delete(id);
  else state.saved.add(id);
  saveJSON("opportune_saved", [...state.saved]);
  render();
}

/* ---------------- Boot ---------------- */
bootstrap();
