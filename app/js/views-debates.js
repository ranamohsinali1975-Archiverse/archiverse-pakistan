// Debates: list, create, detail (posts, replies, proposals, votes, reports, blocks, admin tools).

import { el, esc, textToHtml, timeAgo, fmtDate, toast, go, footer, PILLARS, FRONTS, LABELS, RULES_HTML, roleChip, labelChip, errorBox } from "./ui.js";
import { db } from "./data.js";

function signInPrompt(what) {
  return `<div class="note teal">To ${what}, <a href="#/account">sign in or create a free account</a>. Students, graduates, educators, practitioners and institution representatives are all welcome.</div>`;
}

export async function list() {
  const debates = await db.listDebates();
  const node = el(`<section class="page">
    <div class="page-head row between">
      <div><div class="eyebrow">Debates</div><h1>Question, then build</h1></div>
      <a class="btn btn-accent" href="#/debates/new">Open a debate</a>
    </div>
    <p class="lead muted" style="max-width:62ch">Post what you have seen, label your claim, support the proposals you would back. The three rules apply: respect people, back claims with evidence, bring a solution.</p>
    <div class="stack" id="list"></div>
    ${footer()}
  </section>`);
  const box = node.querySelector("#list");
  if (!debates.length) box.innerHTML = '<div class="empty">No debates yet. Open the first one.</div>';
  for (const d of debates) {
    box.appendChild(el(`<a class="debate-item" href="#/debates/${esc(d.id)}">
      <div class="row">${d.pinned ? '<span class="chip accent">Pinned</span>' : ""}${d.pillar ? `<span class="chip">${esc(PILLARS[d.pillar]?.name || d.pillar)}</span>` : ""}${d.front ? `<span class="chip gray">${esc(FRONTS[d.front] || d.front)}</span>` : ""}${d.closed ? '<span class="chip dark">Closed</span>' : ""}${d.hidden ? '<span class="chip warn">Hidden</span>' : ""}</div>
      <h3>${esc(d.title)}</h3>
      <div class="q">${esc(d.question)}</div>
      <div class="meta">Opened by ${esc(d.author?.display_name || "a member")} · ${d.post_count} ${d.post_count === 1 ? "post" : "posts"} · ${d.last_post_at ? "last " + timeAgo(d.last_post_at) : "opened " + timeAgo(d.created_at)}</div>
    </a>`));
  }
  return node;
}

export async function create() {
  if (!db.user) return el(`<section class="page"><div class="page-head"><div class="eyebrow">Debates</div><h1>Open a debate</h1></div>${signInPrompt("open a debate")}</section>`);
  const node = el(`<section class="page"><div class="article">
    <div class="page-head"><div class="eyebrow">Debates</div><h1>Open a debate</h1>
    <p class="lead">A good debate names one question, says why it matters, and invites proposals. Every member who opted in is notified when it opens.</p></div>
    <div class="composer">
      ${RULES_HTML}
      <form id="f">
        <div id="err"></div>
        <div class="field"><label for="title">Title (the question in one line)</label><input id="title" name="title" type="text" required minlength="8" maxlength="160" placeholder="e.g. Should every B.Arch include a supervised site placement?"></div>
        <div class="field"><label for="question">Why it matters, and what you are asking for</label><textarea id="question" name="question" required minlength="10" maxlength="2000" placeholder="Set out the question, the evidence you already have, and the kind of answer or proposal you want."></textarea></div>
        <div class="grid grid-2">
          <div class="field"><label for="pillar">Pillar</label><select id="pillar" name="pillar"><option value="">Choose…</option>${Object.entries(PILLARS).map(([k, v]) => `<option value="${k}">${esc(v.name)}</option>`).join("")}</select></div>
          <div class="field"><label for="front">1947 → 2047 front</label><select id="front" name="front"><option value="">Choose…</option>${Object.entries(FRONTS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select></div>
        </div>
        <label class="check"><input type="checkbox" required> I have read the three rules and this debate follows them.</label>
        <div class="row" style="margin-top:14px"><button class="btn btn-accent" type="submit">Open the debate</button><a class="btn btn-outline" href="#/debates">Cancel</a></div>
      </form>
    </div>
  </div></section>`);
  node.querySelector("#f").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
    try {
      const d = await db.createDebate({ title: f.title.value.trim(), question: f.question.value.trim(), pillar: f.pillar.value, front: f.front.value });
      toast("Debate opened. Members have been notified.", "ok");
      go("#/debates/" + d.id);
    } catch (err) { node.querySelector("#err").innerHTML = errorBox(err.message); btn.disabled = false; }
  };
  return node;
}

export async function detail(id) {
  const d = await db.getDebate(id);
  if (!d) return el(`<section class="page"><h1>Debate not found</h1><p><a href="#/debates">Back to debates</a></p></section>`);
  const me = db.user;
  const profile = me ? await db.getMyProfile() : null;
  const isAdmin = !!profile?.is_admin;
  const posts = await db.listPosts(id);

  const node = el(`<section class="page">
    <p class="small"><a href="#/debates">← All debates</a></p>
    <div class="row" style="margin-bottom:8px">${d.pinned ? '<span class="chip accent">Pinned</span>' : ""}${d.pillar ? `<span class="chip">${esc(PILLARS[d.pillar]?.name || d.pillar)}</span>` : ""}${d.front ? `<span class="chip gray">${esc(FRONTS[d.front] || d.front)}</span>` : ""}${d.closed ? '<span class="chip dark">Closed</span>' : ""}${d.hidden ? '<span class="chip warn">Hidden from members</span>' : ""}</div>
    <h1>${esc(d.title)}</h1>
    <div class="body">${textToHtml(d.question)}</div>
    <p class="small muted">Opened by ${esc(d.author?.display_name || "a member")} ${roleChip(d.author)} · ${esc(fmtDate(d.created_at))}</p>
    ${d.outcome ? `<div class="note"><strong>Outcome.</strong> ${textToHtml(d.outcome)}</div>` : ""}
    <div id="admin-tools" class="row" style="margin:10px 0"></div>
    <hr class="sep">
    <div id="proposals"></div>
    <div id="discussion"></div>
    <div id="composer"></div>
    ${footer()}
  </section>`);

  // ---- admin / owner tools
  const tools = node.querySelector("#admin-tools");
  if (isAdmin) {
    tools.appendChild(btn(d.pinned ? "Unpin" : "Pin", async () => { await db.updateDebate(id, { pinned: !d.pinned }); rerender(); }));
    tools.appendChild(btn(d.hidden ? "Unhide debate" : "Hide debate", async () => { await db.updateDebate(id, { hidden: !d.hidden }); rerender(); }));
    tools.appendChild(btn(d.closed ? "Reopen" : "Close with outcome", async () => {
      if (d.closed) { await db.updateDebate(id, { closed: false }); return rerender(); }
      const outcome = prompt("Write the published outcome of this debate (what was agreed, what goes to which institution):", d.outcome || "");
      if (outcome === null) return;
      await db.updateDebate(id, { closed: true, outcome });
      rerender();
    }));
  } else if (me && d.created_by === me.id && !d.closed) {
    tools.appendChild(btn("Close my debate", async () => { if (confirm("Close this debate? No new posts will be accepted.")) { await db.updateDebate(id, { closed: true }); rerender(); } }));
  }

  // ---- proposals (sorted by support) and discussion (chronological, threaded)
  const visible = posts.filter((p) => !p.blocked);
  const top = visible.filter((p) => !p.parent_id);
  const replies = (pid) => visible.filter((p) => p.parent_id === pid);
  const proposals = top.filter((p) => p.kind === "proposal").sort((a, b) => b.votes - a.votes || a.created_at.localeCompare(b.created_at));
  const comments = top.filter((p) => p.kind !== "proposal");

  const propBox = node.querySelector("#proposals");
  propBox.innerHTML = `<div class="eyebrow">Proposals · ${proposals.length}</div>`;
  if (!proposals.length) propBox.appendChild(el('<p class="muted small">No proposals yet. Post one below and choose “Proposal” so members can support it.</p>'));
  for (const p of proposals) propBox.appendChild(postNode(p, replies(p.id)));

  const disc = node.querySelector("#discussion");
  disc.innerHTML = `<div class="eyebrow" style="margin-top:26px">Discussion · ${comments.length}</div>`;
  if (!comments.length) disc.appendChild(el('<p class="muted small">No posts yet.</p>'));
  for (const p of comments) disc.appendChild(postNode(p, replies(p.id)));
  const blockedCount = posts.filter((p) => p.blocked).length;
  if (blockedCount) disc.appendChild(el(`<p class="small muted">${blockedCount} post(s) from members you blocked are hidden. Manage blocks in <a href="#/account">Account</a>.</p>`));

  // ---- composer
  const comp = node.querySelector("#composer");
  if (d.closed) comp.innerHTML = '<div class="note">This debate is closed. Its outcome is published above.</div>';
  else if (!me) comp.innerHTML = signInPrompt("post in this debate");
  else comp.appendChild(composer({ debate_id: id, parent_id: null, onDone: rerender }));

  return node;

  function rerender() { detail(id).then((n) => node.replaceWith(n)); }

  function btn(label, fn) {
    const b = el(`<button class="btn btn-outline btn-sm">${esc(label)}</button>`);
    b.onclick = async () => { b.disabled = true; try { await fn(); } catch (err) { toast(err.message, "error"); b.disabled = false; } };
    return b;
  }

  function postNode(p, kids) {
    const mine = me && p.author_id === me.id;
    const n = el(`<div class="post ${p.kind === "proposal" ? "proposal" : ""} ${p.hidden ? "hidden-post" : ""}" id="post-${esc(p.id)}">
      <div class="who"><strong>${esc(p.author?.display_name || "Member")}</strong>${roleChip(p.author)}${p.author?.institution ? `<span class="muted small">· ${esc(p.author.institution)}</span>` : ""}${p.kind === "proposal" ? '<span class="chip accent">Proposal</span>' : ""}${labelChip(p.claim_label)}<span class="muted small">· ${timeAgo(p.created_at)}</span></div>
      ${p.hidden ? `<div class="body"><em>${esc(p.hidden_reason || "Hidden")}.</em>${isAdmin || mine ? ` <span class="small">Original text (visible to you only): </span><div style="font-style:normal;color:var(--ink)">${textToHtml(p.body)}</div>` : ""}</div>` : `<div class="body">${textToHtml(p.body)}</div>`}
      ${p.source_url && !p.hidden ? `<p class="small" style="margin:6px 0 0"><a href="${esc(p.source_url)}" target="_blank" rel="noopener">Source ↗</a></p>` : ""}
      <div class="tools"></div>
      <div class="reply-slot"></div>
    </div>`);
    const tools = n.querySelector(".tools");
    if (p.kind === "proposal" && !p.hidden) {
      const v = el(`<button class="vote ${p.voted ? "on" : ""}" title="Support this proposal">▲ Support · <span>${p.votes}</span></button>`);
      v.onclick = async () => {
        if (!me) return toast("Sign in to support a proposal.", "error");
        try { const on = await db.toggleVote(p.id); p.voted = on; p.votes += on ? 1 : -1; v.classList.toggle("on", on); v.querySelector("span").textContent = p.votes; } catch (err) { toast(err.message, "error"); }
      };
      tools.appendChild(v);
    }
    if (!p.hidden && !d.closed && me && !p.parent_id) {
      const r = el('<button>Reply</button>');
      r.onclick = () => { const slot = n.querySelector(".reply-slot"); slot.innerHTML = ""; slot.appendChild(composer({ debate_id: id, parent_id: p.id, onDone: rerender, compact: true })); };
      tools.appendChild(r);
    }
    if (me && !mine && !p.hidden) {
      const rep = el('<button>Report</button>');
      rep.onclick = async () => {
        const reason = prompt("Why should the moderator look at this post? (e.g. rule 1: personal attack; rule 2: claim without evidence)");
        if (!reason) return;
        try { await db.reportPost(p.id, reason); toast("Reported. The moderator will review it.", "ok"); } catch (err) { toast(err.message, "error"); }
      };
      tools.appendChild(rep);
      const bl = el('<button>Block member</button>');
      bl.onclick = async () => { if (confirm(`Hide all posts by ${p.author?.display_name || "this member"} from your view?`)) { try { await db.blockUser(p.author_id); toast("Member blocked.", "ok"); rerender(); } catch (err) { toast(err.message, "error"); } } };
      tools.appendChild(bl);
    }
    if (mine && !p.hidden) {
      const rm = el('<button class="danger">Remove my post</button>');
      rm.onclick = async () => { if (confirm("Remove your post? It will show as removed.")) { try { await db.setPostHidden(p.id, true); rerender(); } catch (err) { toast(err.message, "error"); } } };
      tools.appendChild(rm);
    }
    if (isAdmin) {
      const h = el(`<button class="danger">${p.hidden ? "Unhide" : "Hide (moderator)"}</button>`);
      h.onclick = async () => {
        let reason = null;
        if (!p.hidden) { reason = prompt("Reason shown in place of the post:", "Hidden by moderator: rule 1 (respect people)"); if (reason === null) return; }
        try { await db.setPostHidden(p.id, !p.hidden, reason); rerender(); } catch (err) { toast(err.message, "error"); }
      };
      tools.appendChild(h);
    }
    if (kids.length) {
      const rl = el('<div class="replies"></div>');
      for (const k of kids) rl.appendChild(postNode(k, []));
      n.appendChild(rl);
    }
    return n;
  }
}

export function composer({ debate_id, parent_id, onDone, compact = false }) {
  const ack = localStorage.getItem("archiverse-rules-ack") === "1";
  const n = el(`<div class="composer">
    ${compact ? "" : `<h3>${parent_id ? "Reply" : "Add to the debate"}</h3>`}
    ${ack && compact ? "" : RULES_HTML}
    <form>
      <div class="err"></div>
      ${parent_id ? "" : `<div class="field"><label>Type</label><select name="kind"><option value="comment">Comment: what I have seen or think</option><option value="proposal">Proposal: a concrete step members can support</option></select></div>`}
      <div class="field"><label>Label your claim</label><select name="claim_label">
        <option value="">Choose a label…</option>
        ${Object.entries(LABELS).map(([k, v]) => `<option value="${k}">${esc(v)}${k === "verified_fact" ? " (give the source)" : k === "community_experience" ? " (what I saw or lived)" : ""}</option>`).join("")}
      </select></div>
      <div class="field source-row"><label>Source link</label><input name="source_url" type="url" placeholder="https://… (the document, page or dataset)"></div>
      <div class="field"><label>${parent_id ? "Your reply" : "Your post"}</label><textarea name="body" required minlength="2" maxlength="5000" placeholder="${parent_id ? "Add evidence, a counter-point, or a refinement." : "Say what you have seen, where, and when. End with a solution or the next question."}"></textarea></div>
      ${ack ? "" : '<label class="check"><input type="checkbox" name="ack" required> I have read the three rules.</label>'}
      <div class="row" style="margin-top:12px"><button class="btn btn-accent btn-sm" type="submit">${parent_id ? "Post reply" : "Post"}</button>${parent_id ? '<button class="btn btn-outline btn-sm" type="button" data-cancel>Cancel</button>' : ""}</div>
    </form>
  </div>`);
  const f = n.querySelector("form");
  const label = f.claim_label;
  const srcRow = n.querySelector(".source-row");
  label.onchange = () => { srcRow.classList.toggle("show", label.value === "verified_fact"); f.source_url.required = label.value === "verified_fact"; };
  n.querySelector("[data-cancel]")?.addEventListener("click", () => n.remove());
  f.onsubmit = async (e) => {
    e.preventDefault();
    const b = f.querySelector("button[type=submit]"); b.disabled = true;
    try {
      await db.createPost({ debate_id, parent_id, body: f.body.value.trim(), kind: f.kind ? f.kind.value : "comment", claim_label: label.value || null, source_url: label.value === "verified_fact" ? f.source_url.value.trim() : null });
      localStorage.setItem("archiverse-rules-ack", "1");
      toast("Posted.", "ok");
      onDone && onDone();
    } catch (err) { n.querySelector(".err").innerHTML = errorBox(err.message); b.disabled = false; }
  };
  return n;
}
