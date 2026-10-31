// Small helpers shared by every screen.

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function frag(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content;
}

// Plain text → safe paragraphs with clickable links.
export function textToHtml(text) {
  const paras = String(text ?? "").trim().split(/\n{2,}/);
  return paras.map((p) => "<p>" + linkify(esc(p)).replace(/\n/g, "<br>") + "</p>").join("");
}
function linkify(escaped) {
  return escaped.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

export function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function timeAgo(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + " min ago";
  if (diff < 86400) return Math.floor(diff / 3600) + " h ago";
  if (diff < 86400 * 7) return Math.floor(diff / 86400) + " d ago";
  return fmtDate(iso);
}

export function toast(msg, kind = "") {
  const box = document.getElementById("toasts");
  const t = el(`<div class="toast ${kind}">${esc(msg)}</div>`);
  box.appendChild(t);
  setTimeout(() => t.remove(), kind === "error" ? 6000 : 3500);
}

export function go(hash) { location.hash = hash; }

export const ROLES = {
  student: "Student",
  graduate: "Graduate",
  educator: "Educator",
  practitioner: "Practitioner",
  institution: "Institution representative",
};

export const LABELS = {
  verified_fact: "Verified fact",
  community_experience: "Community experience",
  opinion: "Opinion",
};

export const PILLARS = {
  learn: { name: "Academia & Skills", tag: "#ArchiverseLearn" },
  accountable: { name: "Institutions & Accountability", tag: "#ArchiverseAccountable" },
  builds: { name: "Pakistan's Built Future", tag: "#ArchiverseBuilds" },
  global: { name: "Global Practice & Innovation", tag: "#ArchiverseGlobal" },
};

export const FRONTS = {
  system: "System",
  syllabus: "Syllabus",
  organisations: "Organisations",
  institutes: "Institutes",
  professionals: "Professionals",
};

export const RULES_HTML = `
<ol class="rules compact">
  <li><strong>Respect people.</strong> Criticise the system, the decision, the outcome. Not the person.</li>
  <li><strong>Back claims with evidence.</strong> A document, a number, a dated example. Label what is your experience or your opinion.</li>
  <li><strong>Bring a solution.</strong> Or at least the next question. A complaint without a direction is not yet a contribution.</li>
</ol>`;

export function roleChip(p) {
  if (!p) return "";
  const role = ROLES[p.role] || p.role || "";
  const verified = p.role === "institution" && p.is_verified_institution;
  return `<span class="chip ${verified ? "ok" : "gray"}">${esc(role)}${verified ? " · verified" : ""}</span>`;
}

export function labelChip(label) {
  if (!label) return "";
  const cls = label === "verified_fact" ? "ok" : label === "opinion" ? "gray" : "accent";
  return `<span class="chip ${cls}">${esc(LABELS[label] || label)}</span>`;
}

export function footer() {
  return `<footer class="app-foot">
    <div class="tagline">Learn. Question. Build. Pakistan's architecture, redrawn.</div>
    <div>© 2026 Archiverse-Pakistan · Founded by Rana Mohsin Ali · <a href="#/rules">Rules</a> · <a href="#/about">About</a> · <a href="../" target="_blank" rel="noopener">Website</a></div>
  </footer>`;
}

export function errorBox(msg) {
  return `<div class="error">${esc(msg)}</div>`;
}

export function confirmDialog(msg) {
  return window.confirm(msg);
}
