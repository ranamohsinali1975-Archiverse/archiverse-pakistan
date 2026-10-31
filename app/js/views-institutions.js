// Institution responses: the public page, the per-piece block, and the submit form.

import { el, esc, fmtDate, toast, go, footer, errorBox, textToHtml } from "./ui.js";
import { db } from "./data.js";
import { getArticles } from "./content.js";
import { CONFIG } from "../config.js";

function responseNode(r, { isAdmin, mine, onChange }) {
  const n = el(`<div class="response">
    <div class="row between"><span class="inst">${esc(r.institution_name)}</span><span class="chip ok">On record</span></div>
    <div class="piece">On: <a href="${r.piece_type === "article" ? "#/read/" : "#/debates/"}${esc(r.piece_id)}">${esc(r.piece_title)}</a> · ${esc(fmtDate(r.created_at))}</div>
    <div class="body">${textToHtml(r.body)}</div>
    ${r.correction_note ? `<div class="correction"><strong>Correction note (${esc(fmtDate(r.corrected_at))}):</strong> ${textToHtml(r.correction_note)}</div>` : ""}
    <div class="unedited">Published unedited · submitted by a verified institution account</div>
    <div class="row" style="margin-top:8px"></div>
  </div>`);
  const tools = n.querySelector(".row:last-child");
  if (mine) {
    const b = el(`<button class="linkbtn small">${r.correction_note ? "Update the correction note" : "Add a correction note"}</button>`);
    b.onclick = async () => {
      const note = prompt("Correction note (dated and shown next to the original text, which stays as published):", r.correction_note || "");
      if (note === null) return;
      try { await db.addCorrection(r.id, note.trim()); toast("Correction note published.", "ok"); onChange(); } catch (err) { toast(err.message, "error"); }
    };
    tools.appendChild(b);
  }
  if (isAdmin) {
    const d = el('<button class="linkbtn small danger">Delete (abuse only)</button>');
    d.onclick = async () => {
      if (!confirm("Delete this response? Only for impersonation or abuse. Record the reason in logs/corrections.md.")) return;
      try { await db.deleteResponse(r.id); toast("Response deleted.", "ok"); onChange(); } catch (err) { toast(err.message, "error"); }
    };
    tools.appendChild(d);
  }
  return n;
}

// Used on article and debate pages.
export async function responsesBlock(piece_type, piece_id, piece_title) {
  const [responses, profile] = await Promise.all([db.listResponses({ piece_type, piece_id }).catch(() => []), db.user ? db.getMyProfile() : null]);
  const node = el(`<div>
    <div class="eyebrow">Institution responses · ${responses.length}</div>
    <div class="stack" id="list"></div>
    <p class="small muted" style="margin-top:10px">Institutions named in a piece are invited to respond on record. Responses are published here unedited.
      ${profile?.is_verified_institution ? ` <a href="#/institutions/respond?type=${esc(piece_type)}&id=${esc(piece_id)}&title=${encodeURIComponent(piece_title)}">Respond on record →</a>` : ` <a href="#/institutions">How institutions respond →</a>`}</p>
  </div>`);
  const list = node.querySelector("#list");
  if (!responses.length) list.innerHTML = '<p class="small muted">No institution has responded to this piece yet.</p>';
  const rerender = async () => node.replaceWith(await responsesBlock(piece_type, piece_id, piece_title));
  for (const r of responses) list.appendChild(responseNode(r, { isAdmin: !!profile?.is_admin, mine: db.user && r.institution_id === db.user.id, onChange: rerender }));
  return node;
}

export async function list() {
  const [responses, profile] = await Promise.all([db.listResponses(), db.user ? db.getMyProfile() : null]);
  const node = el(`<section class="page">
    <div class="page-head"><div class="eyebrow">Institutions</div><h1>Responses on record</h1>
    <p class="lead">When a piece concerns a department, PCATP, IAP, a building-control authority or a firm, that institution is invited to respond. Responses are submitted by a verified institution account and published here, next to the piece, unedited. Corrections are added as dated notes; the original text never changes.</p></div>
    ${profile?.is_verified_institution ? '<p><a class="btn btn-accent" href="#/institutions/respond">Respond to a piece</a></p>' : profile?.role === "institution" ? '<div class="note"><strong>Your institution account is awaiting verification.</strong> Once verified you can respond here.</div>' : `<div class="note teal"><strong>Represent an institution?</strong> <a href="#/account">Create an account</a> choosing “Institution representative”, name the institution, and Archiverse will verify it${CONFIG.contactEmail ? ` (write to <a href="mailto:${esc(CONFIG.contactEmail)}">${esc(CONFIG.contactEmail)}</a> from an official address)` : ""}. Verified accounts respond on record to any article or debate.</div>`}
    <div class="stack" id="list"></div>
    ${footer()}
  </section>`);
  const box = node.querySelector("#list");
  if (!responses.length) box.innerHTML = '<div class="empty">No responses yet. The first institutions to respond on record will appear here.</div>';
  const rerender = async () => node.replaceWith(await list());
  for (const r of responses) box.appendChild(responseNode(r, { isAdmin: !!profile?.is_admin, mine: db.user && r.institution_id === db.user.id, onChange: rerender }));
  return node;
}

export async function respond(params) {
  const profile = db.user ? await db.getMyProfile() : null;
  if (!profile?.is_verified_institution) return el(`<section class="page"><h1>Respond on record</h1><div class="note">Only a verified institution account can respond on record. <a href="#/institutions">How verification works</a>.</div></section>`);
  const [articles, debates] = await Promise.all([getArticles(), db.listDebates().catch(() => [])]);
  const preType = params?.get("type") || "article", preId = params?.get("id") || "";
  const node = el(`<section class="page"><div class="article">
    <div class="page-head"><div class="eyebrow">Institutions</div><h1>Respond on record</h1>
    <p class="lead">Responding as <strong>${esc(profile.institution || profile.display_name)}</strong>. The response is published immediately, in full and unedited, next to the piece you choose. You can add a dated correction note later; the text itself cannot be changed.</p></div>
    <form id="f">
      <div id="err"></div>
      <div class="field"><label>The piece you are responding to</label><select name="piece" required>
        <optgroup label="Articles">${articles.map((a) => `<option value="article|${esc(a.slug)}|${esc(a.title)}" ${preType === "article" && preId === a.slug ? "selected" : ""}>${esc(a.title)}</option>`).join("")}</optgroup>
        <optgroup label="Debates">${debates.map((d) => `<option value="debate|${esc(d.id)}|${esc(d.title)}" ${preType === "debate" && preId === d.id ? "selected" : ""}>${esc(d.title)}</option>`).join("")}</optgroup>
      </select></div>
      <div class="field"><label>Your response (published as written)</label><textarea name="body" required minlength="20" maxlength="10000" style="min-height:220px" placeholder="State the institution's position, cite the documents it relies on, and say what it intends to do. Use plain language; members of all levels read this."></textarea></div>
      <label class="check"><input type="checkbox" required> I am authorised to speak for this institution, and I understand the response is published immediately and unedited.</label>
      <div class="row" style="margin-top:14px"><button class="btn btn-accent" type="submit">Publish response</button><a class="btn btn-outline" href="#/institutions">Cancel</a></div>
    </form>
  </div></section>`);
  node.querySelector("#f").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target; const b = f.querySelector("button[type=submit]"); b.disabled = true;
    const [piece_type, piece_id, piece_title] = f.piece.value.split("|");
    try { await db.submitResponse({ piece_type, piece_id, piece_title, body: f.body.value.trim() }); toast("Response published.", "ok"); go("#/institutions"); }
    catch (err) { node.querySelector("#err").innerHTML = errorBox(err.message); b.disabled = false; }
  };
  return node;
}
