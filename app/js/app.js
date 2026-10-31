// App shell: routing, navigation state, install prompt, service worker, banners.

import { db, isConfigured } from "./data.js";
import { CONFIG } from "../config.js";
import { el, toast, esc } from "./ui.js";
import * as content from "./views-content.js";
import * as debates from "./views-debates.js";
import * as account from "./views-account.js";
import * as institutions from "./views-institutions.js";

const routes = [
  [/^\/?$/, content.home, "home"],
  [/^\/read\/?$/, content.read, "read"],
  [/^\/read\/([\w-]+)\/?$/, content.article, "read"],
  [/^\/watch\/?$/, content.watch, "read"],
  [/^\/survey\/?$/, content.survey, "read"],
  [/^\/roadmap\/?$/, content.roadmap, "read"],
  [/^\/rules\/?$/, content.rules, "home"],
  [/^\/about\/?$/, content.about, "home"],
  [/^\/debates\/?$/, debates.list, "debates"],
  [/^\/debates\/new\/?$/, debates.create, "debates"],
  [/^\/debates\/([\w-]+)\/?$/, debates.detail, "debates"],
  [/^\/institutions\/?$/, institutions.list, "institutions"],
  [/^\/institutions\/respond\/?$/, institutions.respond, "institutions"],
  [/^\/account\/?$/, account.account, "account"],
  [/^\/notifications\/?$/, account.notifications, "account"],
  [/^\/admin\/?$/, account.admin, "account"],
];

const main = document.getElementById("main");
let renderId = 0;

async function render() {
  const raw = location.hash.replace(/^#/, "");
  // Supabase auth callbacks arrive as #access_token=… or ?code=…; let the library handle them.
  if (raw.startsWith("access_token=") || raw.includes("error_description=") || raw.startsWith("error=")) {
    if (raw.includes("type=recovery")) sessionStorage.setItem("archiverse-recovery", "1");
    setTimeout(() => { history.replaceState(null, "", location.pathname + "#/account"); render(); }, 300);
    return;
  }
  const path = raw.startsWith("/") ? raw : "/" + raw;
  const [p, qs] = path.split("?");
  const params = new URLSearchParams(qs || "");
  const id = ++renderId;
  let view = null, args = [], navKey = "home";
  for (const [re, fn, key] of routes) {
    const m = p.match(re);
    if (m) { view = fn; args = m.slice(1); navKey = key; break; }
  }
  setActiveNav(navKey);
  main.innerHTML = '<div class="loading">Loading…</div>';
  try {
    const node = view ? await view(...args, params) : el(`<section class="page"><h1>Page not found</h1><p><a href="#/">Back to home</a></p></section>`);
    if (id !== renderId) return; // a newer navigation won
    main.innerHTML = "";
    main.appendChild(node);
    window.scrollTo({ top: 0 });
  } catch (err) {
    console.error(err);
    if (id !== renderId) return;
    main.innerHTML = `<section class="page"><h1>Something went wrong</h1><div class="error">${esc(err.message || err)}</div><p><a href="#/">Back to home</a></p></section>`;
  }
  refreshBell();
}

function setActiveNav(key) {
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === key));
}

export async function refreshBell() {
  const badge = document.getElementById("bell-count");
  const bell = document.getElementById("bell");
  if (!db.user) { badge.hidden = true; bell.style.display = "none"; return; }
  bell.style.display = "";
  try {
    const n = await db.unreadCount();
    badge.textContent = n > 99 ? "99+" : String(n);
    badge.hidden = n === 0;
  } catch { badge.hidden = true; }
}

// ---- banners (preview mode / offline / update available)
const banner = document.getElementById("banner");
function showBanner(html) { banner.innerHTML = html; banner.hidden = false; }
function updateBanner() {
  if (!navigator.onLine) return showBanner("You are offline. Cached articles still open; posting needs a connection.");
  if (!isConfigured) return showBanner('Preview mode: sample data, stored only on this device. <a href="#/about">What this means</a>');
  banner.hidden = true;
}
window.addEventListener("online", updateBanner);
window.addEventListener("offline", updateBanner);

// ---- install prompt (Chrome/Edge/Android). iOS uses Share → Add to Home Screen.
let deferredPrompt = null;
window.deferredInstall = () => deferredPrompt;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById("install-btn");
  btn.hidden = false;
  btn.onclick = async () => { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; btn.hidden = true; };
  document.dispatchEvent(new CustomEvent("installable"));
});
window.addEventListener("appinstalled", () => { toast("Archiverse is installed.", "ok"); document.getElementById("install-btn").hidden = true; });

// ---- service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("./sw.js");
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        nw?.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            showBanner('A new version is ready. <button id="reload-btn">Reload</button>');
            document.getElementById("reload-btn").onclick = () => { nw.postMessage("skipWaiting"); location.reload(); };
          }
        });
      });
    } catch (e) { console.warn("Service worker not registered:", e); }
  });
}

// ---- start
(async () => {
  try {
    await db.init();
  } catch (err) {
    main.innerHTML = `<section class="page"><h1>Could not start</h1><div class="error">${esc(err.message || err)}</div></section>`;
    return;
  }
  db.onAuth(() => { refreshBell(); render(); });
  updateBanner();
  window.addEventListener("hashchange", render);
  if (!location.hash) history.replaceState(null, "", location.pathname + "#/");
  render();
  document.title = "Archiverse-Pakistan" + (isConfigured ? "" : " (preview)");
  console.info("Archiverse app v" + CONFIG.version + " — mode: " + db.mode);
})();
