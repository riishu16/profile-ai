/* ==========================================================
   ProFile AI - Frontend logic

   Sections:
   1. Settings, state and element lookup
   2. Small helpers
   3. Navigation (views, top bar, theme)
   4. New analysis form (job description, mode, files)
   5. Analyze (talks to the backend)
   6. Candidate report
   7. Recruiter dashboard (stats, filters, table, charts)
   8. Candidate drawer
   9. History
   10. Actions (copy, print, export, reset)
   11. Start
   ========================================================== */


/* ==========================================================
   1. SETTINGS, STATE AND ELEMENT LOOKUP
   ========================================================== */

const APP_NAME = "ProFile AI";

// Relative URL: works because Express serves this frontend on the same server.
const API_BASE = "/api";

const MAX_FILES_RECRUITER = 20;
const MAX_FILE_SIZE_MB = 5;
const RING_LENGTH = 2 * Math.PI * 52; // must match the circle in the CSS (r = 52)

// Everything the app needs to remember
const state = {
  view: "analyze",   // "analyze", "results" or "history"
  mode: "candidate", // "candidate" or "hr"
  files: [],         // files the user selected
  candidate: null,   // result of a candidate analysis
  hr: null,          // result of a recruiter analysis (items, shortlist, filters)
  role: "",          // job role found in the job description
  history: { items: [], error: "", loading: false },
  query: "",         // text in the top search box
  drawer: null,      // which candidate is open in the drawer
};

const $ = (id) => document.getElementById(id);

const el = {
  jd: $("jd"),
  jdCount: $("jdCount"),
  jdClear: $("jdClear"),
  jdSample: $("jdSample"),
  fileInput: $("files"),
  dropzone: $("dropzone"),
  fileList: $("fileList"),
  fileTitle: $("fileTitle"),
  fileHint: $("fileHint"),
  modeHint: $("modeHint"),
  analyzeBtn: $("analyzeBtn"),
  analyzeLabel: $("analyzeLabel"),
  formMessage: $("formMessage"),
  loading: $("loading"),
  loadingTitle: $("loadingTitle"),
  loadingStep: $("loadingStep"),
  pageTitle: $("pageTitle"),
  pageSub: $("pageSub"),
  pageActions: $("pageActions"),
  searchBox: $("searchBox"),
  globalSearch: $("globalSearch"),
  content: $("content"),
  viewResults: $("view-results"),
  viewHistory: $("view-history"),
  resultsBadge: $("resultsBadge"),
  drawer: $("drawer"),
  backdrop: $("backdrop"),
  toast: $("toast"),
  themeToggle: $("themeToggle"),
  modeButtons: document.querySelectorAll(".mode-btn"),
  navItems: document.querySelectorAll(".nav-item[data-view]"),
};

// Icon shapes (all drawn inside a 24x24 box)
const ICON_PATHS = {
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2.2.7 3.5 2.6 3.5 5.7"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  thumb: '<path d="M7 11v9H4v-9zM7 11l4-7c1.5 0 2.5 1 2.2 2.6L12.7 9H19a2 2 0 0 1 2 2.4l-1.3 6.4A2.5 2.5 0 0 1 17.3 20H7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  cross: '<path d="M6 6l12 12M18 6L6 18"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  download: '<path d="M12 4v12M12 16l-4-4M12 16l4-4"/><path d="M4 20h16"/>',
  print: '<path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4-2v-4z"/>',
  bulb: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2V17h6v-.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
};

function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ""}</svg>`;
}

const SAMPLE_JD = `Full Stack Developer (0-1 years)

About the role
We are looking for a Full Stack Developer to build and maintain web applications used by thousands of users.

Responsibilities
- Build responsive user interfaces using HTML, CSS and JavaScript
- Develop RESTful APIs using Node.js and Express.js
- Design and manage MongoDB databases
- Integrate third-party and AI-powered services
- Use Git and GitHub for collaboration
- Debug and fix issues in production

Required skills
- HTML, CSS, JavaScript
- Node.js and Express.js
- MongoDB or another NoSQL database
- REST APIs
- Git and GitHub

Preferred skills
- React.js
- Python
- Basic knowledge of AWS or another cloud platform
- Authentication with JWT

Education
- B.Tech / B.E. in Computer Science, IT or a related field`;


/* ==========================================================
   2. SMALL HELPERS
   ========================================================== */

// Escape text before putting it into HTML (prevents HTML injection)
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

const esc = escapeHtml;

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExtension(name) {
  return name.split(".").pop().toLowerCase();
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function formatDate(value) {
  const date = new Date(value);
  if (isNaN(date)) return "";
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function showMessage(text) {
  el.formMessage.textContent = text || "";
}

let toastTimer = null;
function showToast(text) {
  el.toast.textContent = text;
  el.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("is-visible"), 2200);
}

// Initials and a stable color for the round avatar
function initials(name) {
  const parts = String(name || "?").trim().split(/\s+/);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
}

function avatarHtml(name, large = false) {
  let hue = 0;
  for (const char of String(name)) hue = (hue * 31 + char.charCodeAt(0)) % 360;
  return `<span class="avatar ${large ? "avatar--lg" : ""}" style="--h:${hue}">${esc(initials(name))}</span>`;
}

// Decide the color, label and advice for a score
function getTone(score) {
  if (score >= 75) {
    return {
      key: "good",
      color: "var(--good)",
      label: "Strong match",
      title: "Apply with confidence",
      tip: "Your profile lines up well with this role. Mention your matching skills near the top of your resume and apply.",
    };
  }
  if (score >= 50) {
    return {
      key: "warn",
      color: "var(--warn)",
      label: "Moderate match",
      title: "Close the gaps first",
      tip: "You have a good base. Learn or highlight the missing skills, tailor your resume to this role, then apply.",
    };
  }
  return {
    key: "bad",
    color: "var(--bad)",
    label: "Low match",
    title: "Build your profile first",
    tip: "This role is far from your current profile. Work on the missing skills or look for roles that fit you better.",
  };
}

// Turn data from the server or the database into one common shape
function normalize(raw, id) {
  return {
    id,
    name: raw.candidate_name ?? raw.candidateName ?? "Unknown candidate",
    file: raw.file || "",
    role: raw.job_role ?? raw.jobTitle ?? "",
    score: raw.error ? 0 : clampScore(raw.score),
    matching: raw.matching_skills ?? raw.matchingSkills ?? [],
    missing: raw.missing_skills ?? raw.missingSkills ?? [],
    expMet: Boolean(raw.experience_met ?? raw.experienceMet),
    verdict: raw.verdict || "",
    error: raw.error || "",
    date: raw.createdAt || "",
    rank: null,
  };
}

// Share of the job's key skills found in the resume
function coverage(item) {
  const total = item.matching.length + item.missing.length;
  return total ? Math.round((item.matching.length / total) * 100) : 0;
}

function chipsHtml(items, type) {
  if (!items || !items.length) return `<span class="muted">None</span>`;
  return items.map((item) => `<span class="chip chip--${type}">${esc(item)}</span>`).join("");
}

function expHtml(met) {
  return `<span class="exp ${met ? "exp--met" : "exp--not-met"}">Experience: ${met ? "requirement met" : "requirement not met"}</span>`;
}

// Circular score ring. When animate is true, JS fills it later (animateRings).
function ringHtml(score, size = "sm", animate = false) {
  const tone = getTone(score);
  const offset = animate ? RING_LENGTH : RING_LENGTH * (1 - score / 100);
  return `
    <div class="ring ring--${size}" style="--tone:${tone.color}" ${animate ? `data-animate="${score}"` : ""}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle class="ring__track" cx="60" cy="60" r="52"></circle>
        <circle class="ring__value" cx="60" cy="60" r="52" style="stroke-dashoffset:${offset}"></circle>
      </svg>
      <div class="ring__label"><span class="ring__number">${animate ? 0 : score}</span><small>%</small></div>
    </div>`;
}

// Fill big rings and count their number up from 0
function animateRings(root) {
  root.querySelectorAll("[data-animate]").forEach((ring) => {
    const score = Number(ring.dataset.animate);
    const valueCircle = ring.querySelector(".ring__value");
    const numberEl = ring.querySelector(".ring__number");

    // Wait one frame so the CSS transition can run
    requestAnimationFrame(() => {
      valueCircle.style.strokeDashoffset = RING_LENGTH * (1 - score / 100);
    });

    const duration = 1100;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out
      numberEl.textContent = Math.round(score * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

function statCard(iconName, label, value, sub, toneColor, delay = 0) {
  return `
    <div class="card stat-card" style="--tone:${toneColor}; animation-delay:${delay}ms">
      <div class="stat-card__icon">${icon(iconName)}</div>
      <div>
        <div class="stat-card__label">${label}</div>
        <div class="stat-card__value">${value}</div>
        <div class="stat-card__sub">${sub}</div>
      </div>
    </div>`;
}

function emptyStateHtml(iconName, title, text, withButton) {
  return `
    <div class="empty-state">
      <div class="empty-state__art">${icon(iconName)}</div>
      <h2>${title}</h2>
      <p class="muted">${text}</p>
      ${withButton ? `<button class="btn btn--primary" type="button" data-view="analyze">${icon("plus")}<span>Start a new analysis</span></button>` : ""}
    </div>`;
}

function actionButton(action, label, iconName, variant = "") {
  return `<button class="btn ${variant}" type="button" data-action="${action}">${icon(iconName)}<span>${label}</span></button>`;
}


/* ==========================================================
   3. NAVIGATION (views, top bar, theme)
   ========================================================== */

function showView(name) {
  state.view = name;

  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("hidden", view.id !== `view-${name}`);
  });

  el.navItems.forEach((item) => item.classList.toggle("is-active", item.dataset.view === name));

  closeDrawer();
  if (name === "history") loadHistory();
  updateHeader();
  el.content.scrollTop = 0;
}

// Update the page title, subtitle, search box and action buttons
function updateHeader() {
  let title = "New analysis";
  let sub = "Paste a job description, upload resumes and let AI score the match.";
  let actions = "";
  let showSearch = false;

  if (state.view === "results") {
    if (state.hr) {
      const scored = state.hr.items.filter((i) => !i.error).length;
      title = "CV analysis results";
      sub = `${state.role ? esc(state.role) + " • " : ""}${scored} candidate${scored === 1 ? "" : "s"} analyzed`;
      actions =
        actionButton("export", "Export CSV", "download") +
        actionButton("print", "Print", "print") +
        actionButton("new", "New analysis", "plus", "btn--primary");
      showSearch = true;
    } else if (state.candidate) {
      title = "Your match report";
      sub = state.candidate.role ? `Matched against ${esc(state.candidate.role)}` : "How your resume compares with the job description.";
      actions =
        actionButton("copy", "Copy summary", "copy") +
        actionButton("print", "Print", "print") +
        actionButton("new", "New analysis", "plus", "btn--primary");
    } else {
      title = "Results";
      sub = "Run an analysis to see results here.";
    }
  }

  if (state.view === "history") {
    title = "Analysis history";
    sub = "The latest analyses saved in your database.";
    actions = actionButton("refresh-history", "Refresh", "refresh");
    showSearch = true;
  }

  el.pageTitle.textContent = title;
  el.pageSub.innerHTML = sub;
  el.pageActions.innerHTML = actions;
  el.searchBox.classList.toggle("hidden", !showSearch);
}

function updateBadge() {
  const count = state.hr ? state.hr.items.length : state.candidate ? 1 : 0;
  el.resultsBadge.textContent = count;
  el.resultsBadge.classList.toggle("hidden", count === 0);
}

// Dark / light theme
el.themeToggle.addEventListener("click", () => {
  const root = document.documentElement;
  const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  try {
    localStorage.setItem("profile-ai-theme", next);
  } catch (e) {
    /* storage can be blocked, ignore */
  }
});

// Top search box filters the table (results) or the list (history)
el.globalSearch.addEventListener("input", () => {
  state.query = el.globalSearch.value;
  if (state.view === "results" && state.hr) updateRows();
  if (state.view === "history") renderHistory();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDrawer();
});


/* ==========================================================
   4. NEW ANALYSIS FORM (job description, mode, files)
   ========================================================== */

// Job description box
function updateCount() {
  el.jdCount.textContent = `${el.jd.value.length.toLocaleString()} characters`;
}

el.jd.addEventListener("input", updateCount);

el.jdClear.addEventListener("click", () => {
  el.jd.value = "";
  updateCount();
  el.jd.focus();
});

el.jdSample.addEventListener("click", () => {
  el.jd.value = SAMPLE_JD;
  updateCount();
  showMessage("");
});

// Candidate / Recruiter switch
el.modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

function setMode(mode) {
  state.mode = mode;
  const isHr = mode === "hr";

  el.modeButtons.forEach((b) => {
    const active = b.dataset.mode === mode;
    b.classList.toggle("is-active", active);
    b.setAttribute("aria-selected", String(active));
  });

  el.fileInput.multiple = isHr;
  el.fileTitle.textContent = isHr ? "Candidate resumes" : "Your resume";
  el.fileHint.textContent = isHr
    ? `PDF or DOCX, up to ${MAX_FILES_RECRUITER} files, ${MAX_FILE_SIZE_MB} MB each.`
    : `PDF or DOCX, up to ${MAX_FILE_SIZE_MB} MB.`;
  el.modeHint.textContent = isHr
    ? "Upload many resumes and rank them against one job."
    : "Check how well your resume matches a job.";
  el.analyzeLabel.textContent = isHr ? "Rank candidates" : "Analyze my resume";

  // Candidate mode accepts only one file
  if (!isHr && state.files.length > 1) state.files = [state.files[0]];

  renderFiles();
  showMessage("");
}

// File upload (click, drag and drop)
el.dropzone.addEventListener("click", () => el.fileInput.click());

el.dropzone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    el.fileInput.click();
  }
});

el.fileInput.addEventListener("change", () => {
  addFiles(el.fileInput.files);
  el.fileInput.value = ""; // allows picking the same file again
});

["dragenter", "dragover"].forEach((type) =>
  el.dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    el.dropzone.classList.add("is-dragging");
  })
);

["dragleave", "drop"].forEach((type) =>
  el.dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    el.dropzone.classList.remove("is-dragging");
  })
);

el.dropzone.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));

function addFiles(fileList) {
  showMessage("");
  const isHr = state.mode === "hr";

  for (const file of Array.from(fileList)) {
    const ext = getExtension(file.name);

    if (!["pdf", "docx"].includes(ext)) {
      showMessage(`"${file.name}" is not supported. Please use PDF or DOCX.`);
      continue;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      showMessage(`"${file.name}" is larger than ${MAX_FILE_SIZE_MB} MB.`);
      continue;
    }

    if (!isHr) {
      state.files = [file]; // candidate mode keeps only the latest file
      continue;
    }

    const duplicate = state.files.some((f) => f.name === file.name && f.size === file.size);
    if (duplicate) continue;

    if (state.files.length >= MAX_FILES_RECRUITER) {
      showMessage(`You can upload up to ${MAX_FILES_RECRUITER} resumes at once.`);
      break;
    }
    state.files.push(file);
  }

  renderFiles();
}

function renderFiles() {
  el.fileList.innerHTML = state.files
    .map((file, index) => {
      const ext = getExtension(file.name);
      return `
        <li class="file-item">
          <span class="file-item__tag file-item__tag--${ext}">${ext.toUpperCase()}</span>
          <div class="file-item__info">
            <div class="file-item__name">${esc(file.name)}</div>
            <div class="file-item__size">${formatSize(file.size)}</div>
          </div>
          <button class="file-item__remove" type="button" data-index="${index}" aria-label="Remove file">&times;</button>
        </li>`;
    })
    .join("");
}

// One listener handles every remove button
el.fileList.addEventListener("click", (event) => {
  const button = event.target.closest(".file-item__remove");
  if (!button) return;
  state.files.splice(Number(button.dataset.index), 1);
  renderFiles();
});


/* ==========================================================
   5. ANALYZE (talks to the backend)
   ========================================================== */
el.analyzeBtn.addEventListener("click", analyze);

let stepTimer = null;

function setLoading(isLoading, fileCount = 1) {
  el.analyzeBtn.disabled = isLoading;
  el.loading.classList.toggle("hidden", !isLoading);
  clearInterval(stepTimer);
  if (!isLoading) return;

  el.loadingTitle.textContent =
    fileCount > 1 ? `Analyzing ${fileCount} resumes...` : "Analyzing your resume...";

  const steps = [
    "Reading the resume",
    "Understanding the job description",
    "Extracting skills and experience",
    "Comparing and scoring the match",
  ];
  let index = 0;
  el.loadingStep.textContent = steps[0];

  stepTimer = setInterval(() => {
    index = (index + 1) % steps.length;
    el.loadingStep.textContent = steps[index];
  }, 2500);
}

async function analyze() {
  const jobDescription = el.jd.value.trim();
  const isHr = state.mode === "hr";

  if (!jobDescription) return showMessage("Please paste the job description first.");
  if (!state.files.length) {
    return showMessage(isHr ? "Please upload at least one resume." : "Please upload your resume.");
  }

  // Build the request
  const formData = new FormData();
  formData.append("jobDescription", jobDescription);
  if (isHr) state.files.forEach((file) => formData.append("resumes", file));
  else formData.append("resume", state.files[0]);

  const endpoint = isHr ? "/rank" : "/analyze";

  showMessage("");
  setLoading(true, state.files.length);

  try {
    const response = await fetch(API_BASE + endpoint, { method: "POST", body: formData });
    const data = await response.json();

    if (!response.ok || (data.error && !Array.isArray(data))) {
      throw new Error(data.error || "Something went wrong. Please try again.");
    }

    if (isHr) startRecruiter(data);
    else startCandidate(data);

    showView("results");
  } catch (error) {
    showMessage(error.message);
  } finally {
    setLoading(false);
  }
}


/* ==========================================================
   6. CANDIDATE REPORT
   ========================================================== */
function startCandidate(raw) {
  const item = normalize(raw, 0);
  state.candidate = item;
  state.hr = null;
  state.role = item.role;
  updateBadge();

  const tone = getTone(item.score);
  const cov = coverage(item);

  el.viewResults.innerHTML = `
    <section class="stats">
      ${statCard("trend", "Match score", `${item.score}%`, tone.label, tone.color, 0)}
      ${statCard("check", "Matching skills", item.matching.length, "Found in your resume", "var(--good)", 60)}
      ${statCard("cross", "Missing skills", item.missing.length, "Needed for this job", "var(--bad)", 120)}
      ${statCard("briefcase", "Experience", item.expMet ? "Met" : "Not met", "Job requirement", item.expMet ? "var(--good)" : "var(--warn)", 180)}
    </section>

    <section class="report">
      <div class="card report__left" style="--tone:${tone.color}">
        ${ringHtml(item.score, "lg", true)}
        <span class="pill" style="--tone:${tone.color}">${tone.label}</span>
        <div>
          <h3>${esc(item.name)}</h3>
          ${item.role ? `<p class="muted">${esc(item.role)}</p>` : ""}
        </div>
        <div class="coverage">
          <div class="coverage__row"><span>Skill coverage</span><span>${cov}%</span></div>
          <div class="meter" style="--meter:${tone.color}"><span style="width:${cov}%"></span></div>
        </div>
      </div>

      <div class="report__right">
        <div class="card">
          <h3 class="card__title">Matching skills (${item.matching.length})</h3>
          <div class="chips">${chipsHtml(item.matching, "ok")}</div>
        </div>

        <div class="card">
          <h3 class="card__title">Missing skills (${item.missing.length})</h3>
          <div class="chips">${chipsHtml(item.missing, "miss")}</div>
        </div>

        <div class="card" style="--tone:${tone.color}">
          <h3 class="card__title">Final verdict</h3>
          <p class="verdict">${esc(item.verdict || "No verdict available.")}</p>
        </div>

        <div class="card callout" style="--tone:${tone.color}">
          <div class="callout__icon">${icon("bulb")}</div>
          <div>
            <h4>${tone.title}</h4>
            <p>${tone.tip}</p>
          </div>
        </div>
      </div>
    </section>`;

  animateRings(el.viewResults);
}


/* ==========================================================
   7. RECRUITER DASHBOARD
   ========================================================== */
function startRecruiter(data) {
  const items = data.map((raw, index) => normalize(raw, index));

  // Rank only the resumes that were processed successfully
  items
    .filter((item) => !item.error)
    .sort((a, b) => b.score - a.score)
    .forEach((item, index) => (item.rank = index + 1));

  state.hr = {
    items,
    shortlist: new Set(), // ids of starred candidates
    filters: { level: "all", exp: "all", skill: "", sort: "rank", onlyStar: false },
  };
  state.candidate = null;
  state.role = (items.find((item) => !item.error && item.role) || {}).role || "";
  state.query = "";
  el.globalSearch.value = "";
  updateBadge();

  const scored = items.filter((item) => !item.error);
  const scores = scored.map((item) => item.score);
  const top = scores.length ? Math.max(...scores) : 0;
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const strong = scored.filter((item) => item.score >= 75).length;

  el.viewResults.innerHTML = `
    <section class="stats">
      ${statCard("users", "Total candidates", items.length, `${scored.length} analyzed`, "var(--brand)", 0)}
      ${statCard("trend", "Highest score", `${top}%`, "Best match", "var(--good)", 60)}
      ${statCard("star", "Average score", `${average}%`, "Across all candidates", "var(--warn)", 120)}
      ${statCard("thumb", "Recommended", strong, "Candidates scoring 75+", "var(--good)", 180)}
    </section>

    <section class="rec-grid">

      <!-- Filters -->
      <aside class="card filters">
        <h3 class="filters__title">${icon("filter")} Filters</h3>

        <label class="fld"><span>Match level</span>
          <select class="input" id="fLevel">
            <option value="all">All matches</option>
            <option value="strong">Strong (75+)</option>
            <option value="moderate">Moderate (50-74)</option>
            <option value="low">Low (below 50)</option>
          </select>
        </label>

        <label class="fld"><span>Experience requirement</span>
          <select class="input" id="fExp">
            <option value="all">All</option>
            <option value="met">Requirement met</option>
            <option value="not">Not met</option>
          </select>
        </label>

        <label class="fld"><span>Must-have skill</span>
          <input class="input" id="fSkill" type="text" placeholder="e.g. Node.js" autocomplete="off" />
        </label>

        <label class="fld"><span>Sort by</span>
          <select class="input" id="fSort">
            <option value="rank">Highest score</option>
            <option value="low">Lowest score</option>
            <option value="name">Name A-Z</option>
          </select>
        </label>

        <label class="check">
          <input type="checkbox" id="fOnlyStar" />
          <span>Shortlisted only (<b id="starCount">0</b>)</span>
        </label>

        <button class="btn btn--block" type="button" data-action="reset-filters">Reset filters</button>
      </aside>

      <!-- Ranking table -->
      <div class="card table-card">
        <div class="table-card__head">
          <h3>Candidate ranking</h3>
          <span class="muted" id="rowCount"></span>
        </div>
        <div class="thead">
          <span>Rank</span><span>Candidate</span><span>Match</span><span>Score breakdown</span><span></span>
        </div>
        <div id="hrRows"></div>
      </div>
    </section>

    <section class="charts">
      ${distributionChartHtml(scored)}
      ${missingChartHtml(scored)}
      ${statusChartHtml(scored)}
    </section>`;

  updateRows();
}

// ----- Charts -----
function distributionChartHtml(scored) {
  const buckets = [
    { label: "0-20%", min: 0, max: 20 },
    { label: "21-40%", min: 21, max: 40 },
    { label: "41-60%", min: 41, max: 60 },
    { label: "61-80%", min: 61, max: 80 },
    { label: "81-100%", min: 81, max: 100 },
  ].map((b) => ({ ...b, count: scored.filter((i) => i.score >= b.min && i.score <= b.max).length }));

  const maxCount = Math.max(1, ...buckets.map((b) => b.count));

  const cols = buckets
    .map(
      (b) => `
      <div class="vbars__col">
        <span class="vbars__value">${b.count}</span>
        <div class="vbars__bar" style="height:${(b.count / maxCount) * 100}%"></div>
        <span class="vbars__label">${b.label}</span>
      </div>`
    )
    .join("");

  return `
    <div class="card">
      <h3 class="card__title">Score distribution</h3>
      <div class="vbars">${cols}</div>
    </div>`;
}

function missingChartHtml(scored) {
  // Count how often each skill is missing across candidates
  const counts = new Map();
  scored.forEach((item) => {
    item.missing.forEach((skill) => {
      const key = String(skill).trim().toLowerCase();
      if (!key) return;
      const entry = counts.get(key) || { label: skill, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    });
  });

  const top = [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5);

  const rows = top.length
    ? top
        .map((entry) => {
          const pct = Math.round((entry.count / scored.length) * 100);
          return `
            <div class="hbar">
              <span class="hbar__label" title="${esc(entry.label)}">${esc(entry.label)}</span>
              <div class="meter"><span style="width:${pct}%"></span></div>
              <b>${pct}%</b>
            </div>`;
        })
        .join("")
    : `<p class="muted">No missing skills found.</p>`;

  return `
    <div class="card">
      <h3 class="card__title">Most common missing skills</h3>
      <div class="hbars">${rows}</div>
    </div>`;
}

function statusChartHtml(scored) {
  const total = scored.length;
  const strong = scored.filter((i) => i.score >= 75).length;
  const moderate = scored.filter((i) => i.score >= 50 && i.score < 75).length;
  const low = total - strong - moderate;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);

  const a = total ? (strong / total) * 100 : 0;
  const b = total ? a + (moderate / total) * 100 : 0;
  const gradient = total
    ? `conic-gradient(var(--good) 0 ${a}%, var(--warn) ${a}% ${b}%, var(--bad) ${b}% 100%)`
    : `conic-gradient(var(--border) 0 100%)`;

  return `
    <div class="card">
      <h3 class="card__title">Candidate status</h3>
      <div class="donut-wrap">
        <div class="donut" style="background:${gradient}">
          <div class="donut__hole"><b>${total}</b><span>Total</span></div>
        </div>
        <ul class="legend">
          <li><i style="background:var(--good)"></i><span>Strong match</span><b>${strong} (${pct(strong)}%)</b></li>
          <li><i style="background:var(--warn)"></i><span>Moderate</span><b>${moderate} (${pct(moderate)}%)</b></li>
          <li><i style="background:var(--bad)"></i><span>Low match</span><b>${low} (${pct(low)}%)</b></li>
        </ul>
      </div>
    </div>`;
}

// ----- Table rows -----
function filteredRows() {
  const hr = state.hr;
  const f = hr.filters;
  const query = state.query.trim().toLowerCase();
  let list = hr.items.filter((item) => !item.error);

  if (query) {
    list = list.filter((item) =>
      [item.name, item.file, item.role, ...item.matching, ...item.missing].join(" ").toLowerCase().includes(query)
    );
  }
  if (f.level === "strong") list = list.filter((item) => item.score >= 75);
  if (f.level === "moderate") list = list.filter((item) => item.score >= 50 && item.score < 75);
  if (f.level === "low") list = list.filter((item) => item.score < 50);
  if (f.exp === "met") list = list.filter((item) => item.expMet);
  if (f.exp === "not") list = list.filter((item) => !item.expMet);

  const skill = f.skill.trim().toLowerCase();
  if (skill) list = list.filter((item) => item.matching.some((s) => String(s).toLowerCase().includes(skill)));

  if (f.onlyStar) list = list.filter((item) => hr.shortlist.has(item.id));

  if (f.sort === "rank") list.sort((a, b) => a.rank - b.rank);
  if (f.sort === "low") list.sort((a, b) => b.rank - a.rank);
  if (f.sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));

  return list;
}

function rowHtml(item, index) {
  const hr = state.hr;
  const tone = getTone(item.score);
  const starred = hr.shortlist.has(item.id);
  const cov = coverage(item);
  const rankClass = item.rank <= 3 ? `rank--${item.rank}` : "";

  return `
    <article class="trow" style="--tone:${tone.color}; animation-delay:${Math.min(index, 10) * 40}ms">
      <div class="rank ${rankClass}">${item.rank}</div>

      <div class="cand" data-profile="hr:${item.id}" style="cursor:pointer">
        ${avatarHtml(item.name)}
        <div class="cand__text">
          <div class="cand__name">${esc(item.name)}</div>
          <div class="cand__sub">${esc([item.file, item.role].filter(Boolean).join(" • "))}</div>
        </div>
      </div>

      ${ringHtml(item.score, "sm")}

      <div class="breakdown">
        <div class="bd-row"><span>Overall match</span><div class="meter" style="--meter:${tone.color}"><span style="width:${item.score}%"></span></div><b>${item.score}%</b></div>
        <div class="bd-row"><span>Skill coverage</span><div class="meter"><span style="width:${cov}%"></span></div><b>${cov}%</b></div>
        <span class="exp ${item.expMet ? "exp--met" : "exp--not-met"}" style="align-self:flex-start">${item.expMet ? "Experience met" : "Experience not met"}</span>
      </div>

      <div class="row-actions">
        <button class="btn btn--sm" type="button" data-profile="hr:${item.id}">View profile</button>
        <button class="star-btn ${starred ? "is-on" : ""}" type="button" data-star="${item.id}"
                aria-label="${starred ? "Remove from shortlist" : "Add to shortlist"}"
                title="${starred ? "Remove from shortlist" : "Add to shortlist"}">${starred ? "★" : "☆"}</button>
      </div>
    </article>`;
}

function updateRows() {
  const hr = state.hr;
  if (!hr || !$("hrRows")) return;

  const list = filteredRows();
  const scoredCount = hr.items.filter((item) => !item.error).length;

  // Failed resumes are shown at the bottom, only when no filter is active
  const f = hr.filters;
  const noFilter = !state.query.trim() && f.level === "all" && f.exp === "all" && !f.skill.trim() && !f.onlyStar;
  const errors = noFilter ? hr.items.filter((item) => item.error) : [];

  const rowsHtml = list.map((item, index) => rowHtml(item, index)).join("");
  const errorsHtml = errors
    .map((item) => `<div class="error-row"><b>${esc(item.file || "Resume")}</b><span class="muted">Could not be processed: ${esc(item.error)}</span></div>`)
    .join("");
  const emptyHtml = !list.length ? `<div class="table-empty">No candidates match your search or filters.</div>` : "";

  $("hrRows").innerHTML = rowsHtml + emptyHtml + errorsHtml;
  $("rowCount").textContent = `Showing ${list.length} of ${scoredCount}`;
  $("starCount").textContent = hr.shortlist.size;
}

// Filter controls (one listener for the whole results view)
el.viewResults.addEventListener("input", (event) => {
  if (!state.hr) return;
  if (event.target.id === "fSkill") {
    state.hr.filters.skill = event.target.value;
    updateRows();
  }
});

el.viewResults.addEventListener("change", (event) => {
  if (!state.hr) return;
  const f = state.hr.filters;
  if (event.target.id === "fLevel") f.level = event.target.value;
  if (event.target.id === "fExp") f.exp = event.target.value;
  if (event.target.id === "fSort") f.sort = event.target.value;
  if (event.target.id === "fOnlyStar") f.onlyStar = event.target.checked;
  updateRows();
});

function resetFilters() {
  if (!state.hr) return;
  state.hr.filters = { level: "all", exp: "all", skill: "", sort: "rank", onlyStar: false };
  state.query = "";
  el.globalSearch.value = "";
  $("fLevel").value = "all";
  $("fExp").value = "all";
  $("fSkill").value = "";
  $("fSort").value = "rank";
  $("fOnlyStar").checked = false;
  updateRows();
}

function toggleStar(id) {
  const hr = state.hr;
  if (!hr) return;
  if (hr.shortlist.has(id)) hr.shortlist.delete(id);
  else hr.shortlist.add(id);
  updateRows();
  if (state.drawer && state.drawer.src === "hr" && state.drawer.id === id) renderDrawer();
}


/* ==========================================================
   8. CANDIDATE DRAWER
   ========================================================== */
function getDrawerItem() {
  if (!state.drawer) return null;
  const { src, id } = state.drawer;
  if (src === "hr" && state.hr) return state.hr.items.find((item) => item.id === id) || null;
  if (src === "hist") return state.history.items.find((item) => item.id === id) || null;
  return null;
}

function openDrawer(src, id) {
  state.drawer = { src, id };
  renderDrawer();
  el.backdrop.classList.remove("hidden");
  el.drawer.classList.add("is-open");
  el.drawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  state.drawer = null;
  el.drawer.classList.remove("is-open");
  el.drawer.setAttribute("aria-hidden", "true");
  el.backdrop.classList.add("hidden");
}

function renderDrawer() {
  const item = getDrawerItem();
  if (!item) return;

  const tone = getTone(item.score);
  const cov = coverage(item);
  const canStar = state.drawer.src === "hr";
  const starred = canStar && state.hr.shortlist.has(item.id);
  const subtitle = [item.file, item.role].filter(Boolean).join(" • ");

  el.drawer.innerHTML = `
    <div class="drawer__head">
      ${avatarHtml(item.name, true)}
      <div class="drawer__who">
        <h3>${esc(item.name)}</h3>
        <p class="muted">${esc(subtitle || (item.date ? formatDate(item.date) : "Candidate profile"))}</p>
      </div>
      <button class="icon-btn" type="button" data-action="close-drawer" aria-label="Close">${icon("cross")}</button>
    </div>

    <div class="drawer__body" style="--tone:${tone.color}">
      <div class="drawer__score">
        ${ringHtml(item.score, "lg", true)}
        <div>
          <span class="pill" style="--tone:${tone.color}">${tone.label}</span>
          <p class="muted">Shortlist chance</p>
        </div>
      </div>

      <div class="kpis">
        <div class="kpi" style="--kpi:var(--good)"><b>${item.matching.length}</b><span>Matching skills</span></div>
        <div class="kpi" style="--kpi:var(--bad)"><b>${item.missing.length}</b><span>Missing skills</span></div>
        <div class="kpi" style="--kpi:${item.expMet ? "var(--good)" : "var(--warn)"}"><b>${item.expMet ? "Met" : "Not met"}</b><span>Experience</span></div>
      </div>

      <div class="drawer__section">
        <h4>Skill coverage · ${cov}%</h4>
        <div class="meter" style="--meter:${tone.color}"><span style="width:${cov}%"></span></div>
      </div>

      <div class="drawer__section">
        <h4>Matching skills</h4>
        <div class="chips">${chipsHtml(item.matching, "ok")}</div>
      </div>

      <div class="drawer__section">
        <h4>Missing skills</h4>
        <div class="chips">${chipsHtml(item.missing, "miss")}</div>
      </div>

      <div class="drawer__section">
        <h4>Final verdict</h4>
        <p class="verdict">${esc(item.verdict || "No verdict available.")}</p>
      </div>
    </div>

    <div class="drawer__foot">
      ${canStar ? `<button class="btn" type="button" data-star="${item.id}">${starred ? "★ Shortlisted" : "☆ Add to shortlist"}</button>` : ""}
      <button class="btn btn--primary" type="button" data-action="close-drawer">Close</button>
    </div>`;

  animateRings(el.drawer);
}

el.backdrop.addEventListener("click", closeDrawer);


/* ==========================================================
   9. HISTORY
   ========================================================== */
async function loadHistory() {
  state.history.loading = true;
  state.history.error = "";
  renderHistory();

  try {
    const response = await fetch(API_BASE + "/history");
    if (!response.ok) throw new Error("bad response");
    const data = await response.json();
    state.history.items = data.map((raw, index) => normalize(raw, index));
  } catch (error) {
    state.history.error = "Could not load history. Check that the server and MongoDB are running.";
  } finally {
    state.history.loading = false;
    renderHistory();
  }
}

function renderHistory() {
  const h = state.history;

  if (h.loading) {
    el.viewHistory.innerHTML = emptyStateHtml("clock", "Loading history...", "Fetching your saved analyses.", false);
    return;
  }
  if (h.error) {
    el.viewHistory.innerHTML = emptyStateHtml("clock", "History is not available", h.error, false);
    return;
  }
  if (!h.items.length) {
    el.viewHistory.innerHTML = emptyStateHtml("clock", "No history yet", "Your analyses will be listed here after you run one.", true);
    return;
  }

  const query = state.query.trim().toLowerCase();
  const list = h.items.filter((item) =>
    !query || [item.name, item.role, ...item.matching, ...item.missing].join(" ").toLowerCase().includes(query)
  );

  const rows = list
    .map((item, index) => {
      const tone = getTone(item.score);
      return `
        <button class="hrow" type="button" data-profile="hist:${item.id}" style="animation-delay:${Math.min(index, 10) * 30}ms">
          <span class="cand">
            ${avatarHtml(item.name)}
            <span class="cand__text">
              <span class="cand__name" style="display:block">${esc(item.name)}</span>
              <span class="cand__sub" style="display:block">${esc(item.role || "Analysis")}</span>
            </span>
          </span>
          <span><span class="pill" style="--tone:${tone.color}">${item.score}%</span></span>
          <span>${item.matching.length} matching</span>
          <span>${item.missing.length} missing</span>
          <span><span class="exp ${item.expMet ? "exp--met" : "exp--not-met"}">${item.expMet ? "Met" : "Not met"}</span></span>
          <span class="muted">${esc(formatDate(item.date))}</span>
        </button>`;
    })
    .join("");

  el.viewHistory.innerHTML = `
    <div class="card table-card">
      <div class="table-card__head">
        <h3>Recent analyses</h3>
        <span class="muted">Showing ${list.length} of ${h.items.length}</span>
      </div>
      <div class="hhead">
        <span>Candidate</span><span>Score</span><span>Matching</span><span>Missing</span><span>Experience</span><span>Date</span>
      </div>
      ${rows || `<div class="table-empty">No analyses match your search.</div>`}
    </div>`;
}


/* ==========================================================
   10. ACTIONS (copy, print, export, reset)
   One click listener for the whole page.
   ========================================================== */
document.addEventListener("click", (event) => {
  // Buttons with data-action
  const actionBtn = event.target.closest("[data-action]");
  if (actionBtn) return handleAction(actionBtn.dataset.action);

  // Sidebar links and "start a new analysis" buttons
  const viewBtn = event.target.closest("[data-view]");
  if (viewBtn) return showView(viewBtn.dataset.view);

  // Star (shortlist)
  const star = event.target.closest("[data-star]");
  if (star) return toggleStar(Number(star.dataset.star));

  // Open a candidate profile (data-profile="hr:3" or "hist:5")
  const profile = event.target.closest("[data-profile]");
  if (profile) {
    const [src, id] = profile.dataset.profile.split(":");
    openDrawer(src, Number(id));
  }
});

function handleAction(action) {
  if (action === "new") showView("analyze");
  if (action === "copy") copySummary();
  if (action === "print") window.print();
  if (action === "export") exportCsv();
  if (action === "refresh-history") loadHistory();
  if (action === "reset-filters") resetFilters();
  if (action === "close-drawer") closeDrawer();
}

async function copySummary() {
  const r = state.candidate;
  if (!r) return;

  const text = [
    `${APP_NAME} match report`,
    `Candidate: ${r.name}`,
    r.role ? `Role: ${r.role}` : null,
    `Match score: ${r.score}%`,
    `Matching skills: ${r.matching.join(", ") || "None"}`,
    `Missing skills: ${r.missing.join(", ") || "None"}`,
    `Experience requirement: ${r.expMet ? "Met" : "Not met"}`,
    `Verdict: ${r.verdict}`,
  ].filter(Boolean).join("\n");

  try {
    await navigator.clipboard.writeText(text);
    showToast("Summary copied to clipboard");
  } catch (e) {
    showToast("Could not copy. Please copy it manually.");
  }
}

function exportCsv() {
  const hr = state.hr;
  if (!hr) return;

  // Wrap each value in quotes and escape quotes inside it
  const cell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

  const header = ["Rank", "Name", "File", "Score", "Experience met", "Matching skills", "Missing skills", "Verdict", "Shortlisted"];
  const rows = hr.items
    .filter((item) => !item.error)
    .sort((a, b) => a.rank - b.rank)
    .map((item) => [
      item.rank,
      item.name,
      item.file,
      item.score,
      item.expMet ? "Yes" : "No",
      item.matching.join("; "),
      item.missing.join("; "),
      item.verdict,
      hr.shortlist.has(item.id) ? "Yes" : "No",
    ]);

  const csv = [header, ...rows].map((row) => row.map(cell).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM helps Excel
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "profile-ai-ranking.csv";
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("CSV downloaded");
}


/* ==========================================================
   11. START
   ========================================================== */
el.viewResults.innerHTML = emptyStateHtml(
  "chart",
  "No results yet",
  "Run an analysis and your results will show up here.",
  true
);

setMode("candidate");
updateCount();
updateHeader();
