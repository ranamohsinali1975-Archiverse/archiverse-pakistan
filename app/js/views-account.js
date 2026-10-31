// Account (sign in / sign up / profile / preferences), notifications, admin.

import { el, esc, toast, go, footer, ROLES, timeAgo, fmtDate, errorBox, textToHtml, roleChip } from "./ui.js";
import { db, isConfigured } from "./data.js";
import { CONFIG } from "../config.js";
import { refreshBell } from "./app.js";

export async function account() {
  if (!db.user) return signedOut();
  const p = await db.getMyProfile();
  if (!p) return signOutOnly();
  const recovery = sessionStorage.getItem("archiverse-recovery") === "1";
  const node = el(`<section class="page"><div class="article">
    <div class="page-head row between">
      <div><div class="eyebrow">Account</div><h1>${esc(p.display_name)}</h1><p class="muted">${esc(db.user.email || "")} ${roleChip(p)}${p.is_admin ? ' <span class="chip dark">Admin</span>' : ""}</p></div>
      <button class="btn btn-outline btn-sm" id="signout">Sign out</button>
    </div>
    ${p.is_admin ? '<p><a class="btn btn-accent" href="#/admin">Open the admin screen</a></p>' : ""}
    ${p.role === "institution" ? (p.is_verified_institution ? '<div class="note teal"><strong>Verified institution account.</strong> You can respond on record to any article or debate from the <a href="#/institutions">Institutions</a> screen.</div>' : `<div class="note"><strong>Institution account awaiting verification.</strong> Archiverse checks that the account belongs to the institution it names, then switches on the right to respond on record.${CONFIG.contactEmail ? ` Write to <a href="mailto:${esc(CONFIG.contactEmail)}">${esc(CONFIG.contactEmail)}</a> from an official address to speed this up.` : ""}</div>`) : ""}
    ${recovery ? `<div class="card" style="margin-bottom:18px"><h3>Set a new password</h3><form id="pw"><div class="field"><label>New password</label><input name="password" type="password" minlength="8" required></div><button class="btn btn-sm" type="submit">Save password</button></form></div>` : ""}

    <h2>Profile</h2>
    <form id="prof">
      <div id="err"></div>
      <div class="field"><label>Display name (shown on your posts)</label><input name="display_name" type="text" required minlength="2" maxlength="80" value="${esc(p.display_name)}"></div>
      <div class="grid grid-2">
        <div class="field"><label>I am a…</label><select name="role">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${p.role === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></div>
        <div class="field"><label>Institution, firm or body (optional)</label><input name="institution" type="text" maxlength="120" value="${esc(p.institution || "")}"></div>
      </div>
      <div class="field"><label>City (optional)</label><input name="city" type="text" maxlength="60" value="${esc(p.city || "")}"></div>
      <div class="field"><label>Short bio (optional)</label><textarea name="bio" maxlength="600" style="min-height:70px">${esc(p.bio || "")}</textarea></div>
      <h2>Notifications</h2>
      <label class="check"><input type="checkbox" name="notify_in_app" ${p.notify_in_app ? "checked" : ""}> Tell me in the app when a new debate opens or someone replies to me.</label>
      <label class="check" style="margin-top:8px"><input type="checkbox" name="notify_email" ${p.notify_email ? "checked" : ""}> Also email me about new debates. <span class="muted small">(Email alerts start once the email step in the setup guide is switched on.)</span></label>
      <p style="margin-top:14px"><button class="btn btn-accent" type="submit">Save</button></p>
    </form>

    <h2>Blocked members</h2>
    <div id="blocks" class="stack"></div>

    <h2>Install</h2>
    <p class="small muted">Install Archiverse on your phone or computer for quick access and offline reading. On Android, Windows and macOS use the <strong>Install</strong> button at the top (Chrome or Edge). On iPhone or iPad: Safari → Share → <strong>Add to Home Screen</strong>.</p>
    ${!isConfigured ? '<h2>Preview data</h2><p class="small muted">This app is in preview mode. Everything you change is stored only in this browser.</p><p><button class="btn btn-outline btn-sm" id="reset">Reset the sample data</button></p>' : ""}
    ${footer()}
  </div></section>`);

  node.querySelector("#signout").onclick = async () => { await db.signOut(); sessionStorage.removeItem("archiverse-recovery"); go("#/"); };
  node.querySelector("#reset")?.addEventListener("click", () => { if (confirm("Reset all preview data on this device?")) { db.resetDemo(); toast("Preview data reset.", "ok"); go("#/"); } });
  node.querySelector("#pw")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try { await db.updatePassword(e.target.password.value); sessionStorage.removeItem("archiverse-recovery"); toast("Password saved.", "ok"); e.target.closest(".card").remove(); } catch (err) { toast(err.message, "error"); }
  });
  node.querySelector("#prof").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await db.updateProfile({ display_name: f.display_name.value.trim(), role: f.role.value, institution: f.institution.value.trim(), city: f.city.value.trim(), bio: f.bio.value.trim(), notify_in_app: f.notify_in_app.checked, notify_email: f.notify_email.checked });
      toast("Saved.", "ok");
      account().then((n) => node.replaceWith(n));
    } catch (err) { node.querySelector("#err").innerHTML = errorBox(err.message); }
  };
  const blocks = await db.myBlocks();
  const bbox = node.querySelector("#blocks");
  if (!blocks.length) bbox.innerHTML = '<p class="small muted">You have not blocked anyone. Blocking hides a member\'s posts from your view only.</p>';
  for (const b of blocks) {
    const row = el(`<div class="row between card" style="padding:10px 14px"><span>${esc(b.profile?.display_name || "Member")}</span><button class="linkbtn">Unblock</button></div>`);
    row.querySelector("button").onclick = async () => { await db.unblockUser(b.blocked_id); row.remove(); toast("Unblocked.", "ok"); };
    bbox.appendChild(row);
  }
  return node;
}

function signOutOnly() {
  const n = el(`<section class="page"><h1>Setting up your profile…</h1><p class="muted">If this message stays, reload the page, or sign out and in again.</p><p><button class="btn btn-outline" id="so">Sign out</button></p></section>`);
  n.querySelector("#so").onclick = async () => { await db.signOut(); go("#/"); };
  return n;
}

function signedOut() {
  const node = el(`<section class="page"><div class="article">
    <div class="page-head"><div class="eyebrow">Account</div><h1>Join the forum</h1>
    <p class="lead">Free. Students, graduates, educators, practitioners and institution representatives. Your email is never shown to other members.</p></div>
    <div class="tabs"><button class="active" data-tab="in">Sign in</button><button data-tab="up">Create account</button></div>
    <div id="err"></div>
    <form id="in" class="card">
      <div class="field"><label>Email</label><input name="email" type="email" required autocomplete="email"></div>
      ${isConfigured ? '<div class="field"><label>Password</label><input name="password" type="password" required autocomplete="current-password"></div>' : ""}
      <div class="row"><button class="btn btn-accent" type="submit">Sign in</button>${isConfigured ? '<button class="linkbtn" type="button" id="forgot">Forgot password?</button>' : ""}</div>
      ${isConfigured && CONFIG.googleSignIn ? '<hr class="sep"><button class="btn btn-outline btn-block" type="button" id="google">Continue with Google</button>' : ""}
    </form>
    <form id="up" class="card" hidden>
      <div class="field"><label>Display name (shown on your posts)</label><input name="display_name" type="text" required minlength="2" maxlength="80" autocomplete="name"></div>
      <div class="field"><label>Email</label><input name="email" type="email" required autocomplete="email"></div>
      <div class="field"><label>Password (8+ characters)</label><input name="password" type="password" required minlength="8" autocomplete="new-password"></div>
      <div class="field"><label>I am a…</label><select name="role">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select>
        <div class="help">Institution representatives (departments, PCATP, IAP, building authorities, firms) are verified by Archiverse before they can respond on record.</div></div>
      <div class="field"><label>Institution, firm or body (optional)</label><input name="institution" type="text" maxlength="120"></div>
      <label class="check"><input type="checkbox" required> I agree to the three rules: respect people, back claims with evidence, bring a solution. <a href="#/rules">Read them</a>.</label>
      <p style="margin-top:14px"><button class="btn btn-accent" type="submit">Create account</button></p>
    </form>
    ${!isConfigured ? `<div class="note" style="margin-top:20px"><strong>Preview mode.</strong> No real accounts yet. Try the app as:
      <div class="row" style="margin-top:8px">
        <button class="btn btn-outline btn-sm" data-as="u-founder">The founder (admin)</button>
        <button class="btn btn-outline btn-sm" data-as="u-student">A student</button>
        <button class="btn btn-outline btn-sm" data-as="u-practitioner">A practitioner</button>
        <button class="btn btn-outline btn-sm" data-as="u-institution">A verified institution</button>
        <button class="btn btn-outline btn-sm" data-as="u-institution2">An unverified institution</button>
      </div></div>` : ""}
    ${footer()}
  </div></section>`);
  const err = node.querySelector("#err");
  node.querySelectorAll(".tabs button").forEach((b) => b.onclick = () => {
    node.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("active", x === b));
    node.querySelector("#in").hidden = b.dataset.tab !== "in";
    node.querySelector("#up").hidden = b.dataset.tab !== "up";
    err.innerHTML = "";
  });
  node.querySelector("#in").onsubmit = async (e) => {
    e.preventDefault();
    try { await db.signIn(e.target.email.value.trim(), e.target.password?.value); toast("Signed in.", "ok"); go("#/"); } catch (ex) { err.innerHTML = errorBox(ex.message); }
  };
  node.querySelector("#up").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      const r = await db.signUp({ email: f.email.value.trim(), password: f.password.value, display_name: f.display_name.value.trim(), role: f.role.value, institution: f.institution.value.trim() });
      if (r.needsConfirmation) err.innerHTML = '<div class="note teal"><strong>Check your email.</strong> We sent a confirmation link. Open it, then come back and sign in.</div>';
      else { toast("Welcome to Archiverse.", "ok"); go("#/"); }
    } catch (ex) { err.innerHTML = errorBox(ex.message); }
  };
  node.querySelector("#forgot")?.addEventListener("click", async () => {
    const email = node.querySelector("#in").email.value.trim();
    if (!email) return err.innerHTML = errorBox("Type your email first, then press “Forgot password?”.");
    try { await db.resetPassword(email); err.innerHTML = '<div class="note teal">If that email has an account, a reset link is on its way.</div>'; } catch (ex) { err.innerHTML = errorBox(ex.message); }
  });
  node.querySelector("#google")?.addEventListener("click", async () => { try { await db.signInWithGoogle(); } catch (ex) { err.innerHTML = errorBox(ex.message); } });
  node.querySelectorAll("[data-as]").forEach((b) => b.onclick = async () => { await db.signInAs(b.dataset.as); toast("Signed in (preview).", "ok"); go("#/"); });
  return node;
}

export async function notifications() {
  if (!db.user) return el(`<section class="page"><div class="page-head"><div class="eyebrow">Notifications</div><h1>Notifications</h1></div><div class="note teal"><a href="#/account">Sign in</a> to get notified when a new debate opens or someone replies to you.</div></section>`);
  const items = await db.listNotifications();
  const node = el(`<section class="page"><div class="article">
    <div class="page-head"><div class="eyebrow">Notifications</div><h1>What's new</h1></div>
    <div class="stack" id="list"></div>
    ${footer()}
  </div></section>`);
  const list = node.querySelector("#list");
  if (!items.length) list.innerHTML = '<div class="empty">Nothing yet. You will be told here when a new debate opens or someone replies to you.</div>';
  for (const n of items) list.appendChild(el(`<a class="notif ${n.read ? "" : "unread"}" href="${esc(n.link || "#/debates")}"><strong>${esc(n.title)}</strong><div class="small">${esc(n.body || "")}</div><div class="when">${timeAgo(n.created_at)}</div></a>`));
  await db.markAllRead();
  refreshBell();
  return node;
}

export async function admin() {
  const p = db.user ? await db.getMyProfile() : null;
  if (!p?.is_admin) return el(`<section class="page"><h1>Admin</h1><div class="note">This screen is for the Archiverse admin. <a href="#/account">Sign in</a> with the admin account.</div></section>`);
  const [reports, insts, members] = await Promise.all([db.listReports(), db.listInstitutionAccounts(), db.memberCount()]);
  const open = reports.filter((r) => r.status === "open");
  const node = el(`<section class="page">
    <div class="page-head"><div class="eyebrow">Admin</div><h1>Moderation and verification</h1>
    <p class="lead">${members} member${members === 1 ? "" : "s"} · ${open.length} open report${open.length === 1 ? "" : "s"} · ${insts.filter((i) => !i.is_verified_institution).length} institution account${insts.filter((i) => !i.is_verified_institution).length === 1 ? "" : "s"} awaiting verification</p></div>
    <div class="tabs"><button class="active" data-tab="reports">Reports</button><button data-tab="insts">Institution accounts</button><button data-tab="how">How moderation works</button></div>
    <div id="reports" class="stack"></div>
    <div id="insts" class="stack" hidden></div>
    <div id="how" hidden>
      <div class="article">
      <p><strong>Reports.</strong> Members report a post with a reason. Open the debate, read the post in context, then either hide it (a placeholder with your reason replaces it; the author still sees their text) or dismiss the report. Hiding is reversible.</p>
      <p><strong>Pin and close.</strong> On any debate page you can pin it to the top, hide it entirely, or close it with a published outcome. Closed debates accept no new posts.</p>
      <p><strong>Institution accounts.</strong> Anyone can sign up as an institution representative, but only accounts you verify can respond on record. Verify only after checking the person speaks for the institution (an official email address, a letter, or a call). Unverify to withdraw the right; existing responses stay published.</p>
      <p><strong>Responses are never edited.</strong> Not by the institution, not by you. The institution can add a dated correction note. If a response must be removed (impersonation, abuse), delete it from the Institutions screen and record why in <code>logs/corrections.md</code>.</p>
      <p><strong>Criticise systems, not people.</strong> Rule 1 is the most common reason to hide a post. When in doubt, hide and explain.</p>
      </div>
    </div>
    ${footer()}
  </section>`);
  node.querySelectorAll(".tabs button").forEach((b) => b.onclick = () => {
    node.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("active", x === b));
    for (const id of ["reports", "insts", "how"]) node.querySelector("#" + id).hidden = b.dataset.tab !== id;
  });

  const rbox = node.querySelector("#reports");
  if (!reports.length) rbox.innerHTML = '<div class="empty">No reports.</div>';
  for (const r of reports) {
    const row = el(`<div class="card">
      <div class="row between"><span class="chip ${r.status === "open" ? "warn" : "ok"}">${esc(r.status)}</span><span class="small muted">${timeAgo(r.created_at)}</span></div>
      <p style="margin:8px 0 4px"><strong>Reason:</strong> ${esc(r.reason)} <span class="muted small">— reported by ${esc(r.reporter?.display_name || "a member")}</span></p>
      ${r.post ? `<div class="post ${r.post.hidden ? "hidden-post" : ""}" style="margin:8px 0"><div class="who"><strong>${esc(r.post.author?.display_name || "Member")}</strong>${r.post.hidden ? '<span class="chip gray">Hidden</span>' : ""}</div><div class="body">${textToHtml(r.post.body)}</div></div>` : '<p class="muted small">The post no longer exists.</p>'}
      ${r.resolution ? `<p class="small muted">Resolution: ${esc(r.resolution)}</p>` : ""}
      <div class="row">${r.post ? `<a class="btn btn-outline btn-sm" href="#/debates/${esc(r.post.debate_id)}">Open debate</a>` : ""}${r.status === "open" && r.post && !r.post.hidden ? '<button class="btn btn-sm" data-hide>Hide post</button>' : ""}${r.status === "open" && r.post?.hidden ? '<button class="btn btn-outline btn-sm" data-unhide>Unhide post</button>' : ""}${r.status === "open" ? '<button class="btn btn-outline btn-sm" data-dismiss>Dismiss</button>' : ""}</div>
    </div>`);
    row.querySelector("[data-hide]")?.addEventListener("click", async () => {
      const reason = prompt("Reason shown in place of the post:", "Hidden by moderator: rule 1 (respect people)"); if (reason === null) return;
      try { await db.setPostHidden(r.post.id, true, reason); await db.resolveReport(r.id, "Post hidden: " + reason); toast("Post hidden.", "ok"); admin().then((n) => node.replaceWith(n)); } catch (err) { toast(err.message, "error"); }
    });
    row.querySelector("[data-unhide]")?.addEventListener("click", async () => {
      try { await db.setPostHidden(r.post.id, false); await db.resolveReport(r.id, "Post restored"); admin().then((n) => node.replaceWith(n)); } catch (err) { toast(err.message, "error"); }
    });
    row.querySelector("[data-dismiss]")?.addEventListener("click", async () => {
      try { await db.resolveReport(r.id, "Dismissed: no rule broken"); admin().then((n) => node.replaceWith(n)); } catch (err) { toast(err.message, "error"); }
    });
    rbox.appendChild(row);
  }

  const ibox = node.querySelector("#insts");
  if (!insts.length) ibox.innerHTML = '<div class="empty">No institution accounts yet.</div>';
  for (const i of insts) {
    const row = el(`<div class="card row between">
      <div><strong>${esc(i.display_name)}</strong> <span class="chip ${i.is_verified_institution ? "ok" : "warn"}">${i.is_verified_institution ? "Verified" : "Awaiting verification"}</span><div class="small muted">${esc(i.institution || "(no institution named)")}${i.city ? " · " + esc(i.city) : ""} · joined ${esc(fmtDate(i.created_at))}</div></div>
      <button class="btn ${i.is_verified_institution ? "btn-outline" : "btn-accent"} btn-sm">${i.is_verified_institution ? "Remove verification" : "Verify"}</button>
    </div>`);
    row.querySelector("button").onclick = async () => {
      if (!i.is_verified_institution && !confirm(`Verify “${i.display_name}” as speaking for ${i.institution || "the institution it names"}? Only do this after checking.`)) return;
      try { await db.setVerified(i.id, !i.is_verified_institution); toast("Updated.", "ok"); admin().then((n) => node.replaceWith(n)); } catch (err) { toast(err.message, "error"); }
    };
    ibox.appendChild(row);
  }
  return node;
}
