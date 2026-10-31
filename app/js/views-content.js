// Read-only screens: home, articles, videos, survey, roadmap, rules, about.

import { el, esc, fmtDate, footer, PILLARS, FRONTS, RULES_HTML, timeAgo, roleChip } from "./ui.js";
import { getArticles, getArticle, getVideos, getRoadmap, getSurveyResults } from "./content.js";
import { db, isConfigured } from "./data.js";
import { CONFIG } from "../config.js";
import { responsesBlock } from "./views-institutions.js";

function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream; }
function isStandalone() { return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; }

export async function home() {
  const [articles, debates] = await Promise.all([getArticles(), db.listDebates().catch(() => [])]);
  const latest = articles[0];
  const topDebates = debates.slice(0, 3);
  const node = el(`<section class="page">
    <div class="hero">
      <div class="eyebrow">1947 → 2047</div>
      <h1>Learn. Question. Build.<br>Pakistan's architecture, redrawn.</h1>
      <p class="lead">An independent forum for architecture students, educators, practitioners and institutions to look honestly at where our education and practice fall short, and to build solutions that work for Pakistan and hold up globally.</p>
      <div class="actions">
        <a class="btn btn-accent" href="${esc(CONFIG.surveyUrl)}" target="_blank" rel="noopener">Take the 5-minute survey</a>
        <a class="btn btn-ghost" href="#/debates">Join a debate</a>
        <button class="btn btn-ghost" id="home-install" hidden>Install the app</button>
      </div>
    </div>

    <div class="grid grid-3" style="margin-bottom:22px">
      <a class="tile" href="#/read"><span class="ico">¶</span><strong>Read</strong><span>Articles with labelled claims and a right of reply.</span></a>
      <a class="tile" href="#/watch"><span class="ico">▶</span><strong>Watch</strong><span>Interviews, explainers and discussions.</span></a>
      <a class="tile" href="#/debates"><span class="ico">❝</span><strong>Debates</strong><span>Post, reply, and support proposals.</span></a>
      <a class="tile" href="#/survey"><span class="ico">▤</span><strong>Survey</strong><span>What did your degree miss? Results published openly.</span></a>
      <a class="tile" href="#/roadmap"><span class="ico">⟶</span><strong>2047 roadmap</strong><span>Five fronts, four phases, the numbers we track.</span></a>
      <a class="tile" href="#/institutions"><span class="ico">▦</span><strong>Institution responses</strong><span>On the record, unedited, with corrections visible.</span></a>
    </div>

    ${latest ? `<div class="eyebrow">Latest article</div>
    <div class="card" style="margin-bottom:22px">
      <span class="date">${esc(fmtDate(latest.published_on))} · ${esc(PILLARS[latest.pillar]?.name || "")}</span>
      <h3><a href="#/read/${esc(latest.slug)}">${esc(latest.title)}</a></h3>
      <p>${esc(latest.summary || "")}</p>
      <a href="#/read/${esc(latest.slug)}">Read →</a>
    </div>` : ""}

    <div class="row between"><div class="eyebrow" style="margin:0">Debates</div><a href="#/debates" class="small">All debates →</a></div>
    <div class="stack" style="margin-top:10px" id="home-debates"></div>

    <div class="note teal" style="margin-top:26px"><strong>Three ground rules.</strong> Respect people. Back claims with evidence. Bring a solution. <a href="#/rules">Read the rules</a>.</div>
    ${footer()}
  </section>`);

  const list = node.querySelector("#home-debates");
  if (!topDebates.length) list.innerHTML = '<div class="empty">No debates yet. Be the first to open one.</div>';
  for (const d of topDebates) {
    list.appendChild(el(`<a class="debate-item" href="#/debates/${esc(d.id)}">
      <div class="row">${d.pinned ? '<span class="chip accent">Pinned</span>' : ""}${d.pillar ? `<span class="chip">${esc(PILLARS[d.pillar]?.name || d.pillar)}</span>` : ""}${d.closed ? '<span class="chip gray">Closed</span>' : ""}</div>
      <h3>${esc(d.title)}</h3>
      <div class="meta">${d.post_count} ${d.post_count === 1 ? "post" : "posts"} · ${d.last_post_at ? "last " + timeAgo(d.last_post_at) : "opened " + timeAgo(d.created_at)}</div>
    </a>`));
  }

  const installBtn = node.querySelector("#home-install");
  const showInstall = () => {
    if (isStandalone()) return;
    if (window.deferredInstall && window.deferredInstall()) {
      installBtn.hidden = false;
      installBtn.onclick = async () => { const p = window.deferredInstall(); p.prompt(); await p.userChoice; installBtn.hidden = true; };
    } else if (isIOS()) {
      installBtn.hidden = false;
      installBtn.textContent = "Add to Home Screen";
      installBtn.onclick = () => alert("On iPhone or iPad: tap the Share button in Safari, then “Add to Home Screen”.");
    }
  };
  showInstall();
  document.addEventListener("installable", showInstall, { once: true });
  return node;
}

export async function read() {
  const articles = await getArticles();
  const node = el(`<section class="page">
    <div class="page-head"><div class="eyebrow">Read</div><h1>Evidence, argument, and the next question</h1>
    <p class="lead">Each piece labels its claims and ends with a solution or a question. Institutions named in a piece are invited to respond; corrections are published on the piece itself.</p></div>
    <div class="row" style="margin-bottom:16px"><a class="btn btn-outline btn-sm" href="#/watch">Watch</a><a class="btn btn-outline btn-sm" href="#/survey">Survey & results</a><a class="btn btn-outline btn-sm" href="#/roadmap">2047 roadmap</a></div>
    <div class="grid grid-2" id="list"></div>
    ${footer()}
  </section>`);
  const list = node.querySelector("#list");
  for (const a of articles) {
    list.appendChild(el(`<div class="card">
      <span class="date">${esc(fmtDate(a.published_on))} · ${esc(PILLARS[a.pillar]?.name || "")}</span>
      <h3><a href="#/read/${esc(a.slug)}">${esc(a.title)}</a></h3>
      <p>${esc(a.summary || "")}</p>
      <a href="#/read/${esc(a.slug)}">Read →</a>
    </div>`));
  }
  if (!articles.length) list.innerHTML = '<div class="empty">No articles yet.</div>';
  return node;
}

export async function article(slug) {
  const a = await getArticle(slug);
  if (!a) return el(`<section class="page"><h1>Article not found</h1><p><a href="#/read">Back to articles</a></p></section>`);
  const bodyHtml = a.body_html ? a.body_html : (a.body || []).map((p) => `<p>${p}</p>`).join("");
  const node = el(`<section class="page"><article class="article">
    <header>
      <div class="eyebrow">${esc(PILLARS[a.pillar]?.name || "Article")}</div>
      <h1>${esc(a.title)}</h1>
      <p class="byline">${esc(a.author || "")} · ${esc(fmtDate(a.published_on))}${a.source_url ? ` · <a href="${esc(a.source_url)}" target="_blank" rel="noopener">${esc(a.source_label || "Source")}</a>` : ""}</p>
    </header>
    <div class="body">${bodyHtml}</div>
    ${a.closing ? `<p class="closing">${esc(a.closing)}</p>` : ""}
    ${a.note ? `<div class="note">${a.note}</div>` : ""}
    ${(a.tags || []).length ? `<p class="small muted">${a.tags.map(esc).join(" ")}</p>` : ""}
    <hr class="sep">
    <div id="responses"></div>
    <p style="margin-top:20px"><a class="btn btn-outline" href="#/debates">Discuss this in the debates</a></p>
    ${footer()}
  </article></section>`);
  node.querySelector("#responses").appendChild(await responsesBlock("article", a.slug, a.title));
  return node;
}

export async function watch() {
  const { channel_url, videos } = await getVideos();
  const node = el(`<section class="page">
    <div class="page-head"><div class="eyebrow">Watch</div><h1>Interviews, explainers and discussions</h1>
    <p class="lead">Episodes with students, educators and practitioners. ${channel_url ? `<a href="${esc(channel_url)}" target="_blank" rel="noopener">Open the YouTube channel</a>.` : ""}</p></div>
    <div class="stack" id="list"></div>
    ${footer()}
  </section>`);
  const list = node.querySelector("#list");
  if (!videos.length) list.innerHTML = '<div class="empty">The first episodes are being recorded. They will appear here.</div>';
  for (const v of videos) {
    const id = esc(v.youtube_id);
    const card = el(`<div class="card">
      <div class="video"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy"><button class="play" aria-label="Play ${esc(v.title)}">▶</button></div>
      <h3 style="margin-top:12px">${esc(v.title)}</h3>
      <span class="date">${esc(fmtDate(v.published_on))}</span>
      ${v.description ? `<p style="margin-top:6px">${esc(v.description)}</p>` : ""}
      <a class="small" href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener">Open on YouTube</a>
    </div>`);
    card.querySelector(".play").onclick = () => {
      card.querySelector(".video").innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1" title="${esc(v.title)}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    };
    list.appendChild(card);
  }
  return node;
}

export async function survey() {
  const r = await getSurveyResults();
  const node = el(`<section class="page">
    <div class="page-head"><div class="eyebrow">Survey</div><h1>What did your degree miss?</h1>
    <p class="lead">Thirteen questions, about five minutes, anonymous unless you choose to be contacted. The answers are the first evidence base of the 1947 → 2047 evaluation and will be published openly, without names.</p></div>
    <p><a class="btn btn-accent" href="${esc(CONFIG.surveyUrl)}" target="_blank" rel="noopener">Take the 5-minute survey</a></p>
    <hr class="sep">
    <div class="eyebrow">Results</div>
    <div id="results"></div>
    ${footer()}
  </section>`);
  const box = node.querySelector("#results");
  if (!r.published) {
    box.innerHTML = `<h2>Part 1 is not published yet</h2><p class="muted">Results are published here once enough responses are in and the summary has been checked. Every number will come from the survey export, never from estimates.</p>`;
    return node;
  }
  box.innerHTML = `<h2>${esc(r.title)}</h2><p class="muted small">Based on <span class="stat" style="font-size:1.4rem">${esc(String(r.responses))}</span> responses as of ${esc(fmtDate(r.as_of))}.</p>${r.summary ? `<p>${esc(r.summary)}</p>` : ""}`;
  for (const q of r.questions || []) {
    const total = q.data.reduce((s, d) => s + (Number(d.value) || 0), 0) || 1;
    const max = Math.max(...q.data.map((d) => Number(d.value) || 0), 1);
    const chart = el(`<div class="chart"><h3>${esc(q.title)}</h3></div>`);
    for (const d of q.data) {
      const v = Number(d.value) || 0;
      chart.appendChild(el(`<div class="bar-row"><span>${esc(d.label)}</span><div class="bar${q.type === "scale" && d.label === "5" ? " accent" : ""}" style="width:${(v / max) * 100}%"></div><span class="val">${v} · ${Math.round((v / total) * 100)}%</span></div>`));
    }
    box.appendChild(chart);
  }
  return node;
}

export async function roadmap() {
  const r = await getRoadmap();
  const node = el(`<section class="page">
    <div class="page-head"><div class="eyebrow">1947 → 2047</div><h1>Measurable progress, not just posts</h1>
    <p class="lead">Pakistan's architecture journey began with the country in 1947. By the centenary in 2047 we want to know, with evidence, where it has reached on five fronts, compared with other countries, and what to change.</p></div>

    <h2>Four phases</h2>
    <div class="horizon">${r.phases.map((p) => `<div><span class="years">${esc(p.years)}</span><strong>${esc(p.name)}</strong>${esc(p.text)}</div>`).join("")}</div>

    <h2 style="margin-top:30px">Five fronts</h2>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Front</th><th>What we assess</th><th>Compared with</th></tr></thead>
    <tbody>${r.fronts.map((f) => `<tr><td><strong>${esc(f.name)}</strong></td><td>${esc(f.assess)}</td><td class="muted">${esc(f.benchmarks)}</td></tr>`).join("")}</tbody></table></div>
    <p class="small muted" style="margin-top:8px">Every assessment is a comparison with a named country on a named measure. “Behind” or “ahead” without a measure is an opinion. Achievements count too.</p>

    <h2 style="margin-top:30px">Milestones so far</h2>
    <div class="tbl-wrap"><table class="tbl"><tbody>${r.milestones.map((m) => `<tr><td style="white-space:nowrap"><strong>${esc(m.year)}</strong></td><td>${esc(m.text)}</td></tr>`).join("")}</tbody></table></div>

    <h2 style="margin-top:30px">Targets to ${esc(fmtDate(r.targets_by))}</h2>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Metric</th><th>Target</th><th>Actual</th></tr></thead>
    <tbody>${r.targets.map((t) => `<tr><td>${esc(t.metric)}</td><td>${esc(t.target)}</td><td><strong>${esc(t.actual)}</strong> <span class="muted small">(${esc(fmtDate(t.updated))})</span></td></tr>`).join("")}</tbody></table></div>
    <p class="small muted" style="margin-top:8px">Numbers are set and updated by the founder from logs and exports, never estimated.</p>
    ${footer()}
  </section>`);
  return node;
}

export async function rules() {
  return el(`<section class="page"><div class="article">
    <div class="page-head"><div class="eyebrow">Ground rules</div><h1>How debates work here</h1></div>
    <ol class="rules">
      <li><strong>Respect people.</strong> Criticise the system, the decision, the outcome. Not the person. Never a personal attack, never an allegation about a named person or institution without documented evidence.</li>
      <li><strong>Back claims with evidence.</strong> A document, a number, a dated example. Every post can carry a label: <em>verified fact</em> (with a source link), <em>community experience</em> (what you saw or lived), or <em>opinion</em>. Unlabelled claims are read as opinion.</li>
      <li><strong>Bring a solution.</strong> Or at least the next question. Proposals get their own type and members can support them; the most-supported proposals go to the institutions concerned.</li>
    </ol>
    <h2>Moderation</h2>
    <p>Any member can <strong>report</strong> a post or <strong>block</strong> another member (their posts disappear from your view only). The admin can <strong>hide</strong> a post that breaks a rule, and <strong>pin</strong> or <strong>close</strong> a debate. A hidden post shows a placeholder, not silence. Debates close with a published outcome.</p>
    <h2>Institutions</h2>
    <p>Departments, PCATP, IAP chapters, building-control authorities and firms respond on record through a <strong>verified institution account</strong>. A response is published unedited next to the piece it concerns. If a response needs correcting, the institution adds a dated <strong>correction note</strong>; the original text is never changed. When Archiverse is wrong, a visible correction note goes on the piece.</p>
    <h2>What we are not</h2>
    <p>Not an anti-institution campaign. Not a firm's marketing page. Not a place for personal attacks.</p>
    ${footer()}
  </div></section>`);
}

export async function about() {
  return el(`<section class="page"><div class="article">
    <div class="page-head"><div class="eyebrow">About</div><h1>An independent forum for the future of architecture in Pakistan</h1></div>
    <p>Archiverse-Pakistan brings students, educators, practitioners and institutions together to identify gaps in architecture education and practice, test them with evidence, and push for solutions that serve Pakistan and stand up globally.</p>
    <p>Pakistan has had its own architecture profession since 1947. By 2047 it will be 100 years old. This forum exists to ask, openly and with evidence, what we will hand over by then.</p>
    <h2>Three values</h2>
    <ol class="rules">
      <li><strong>Evidence before opinion.</strong> Every claim is labelled as a verified fact with its source, a community experience, or an opinion.</li>
      <li><strong>Criticism with a solution.</strong> We criticise systems, decisions and outcomes, not individuals. Every critical piece ends with a proposed solution or a question that moves the debate forward.</li>
      <li><strong>Every voice counts.</strong> From student to principal. Institutions are invited to respond and to correct us; when we are wrong, we publish a visible correction note on the piece.</li>
    </ol>
    <h2>Who runs it</h2>
    <p>Archiverse-Pakistan is founder-led by <strong>Rana Mohsin Ali</strong>, an architect writing on education, institutions and practice in Pakistan. The forum is community-first: its direction is set by what students, graduates, educators and practitioners say is missing.</p>
    <h2>This app</h2>
    <p>${isConfigured ? "The app stores accounts and debates in a secure database. Your email is never shown to other members; only your display name, role and institution are." : "<strong>Preview mode.</strong> The app is running on sample data stored only in this browser. Sign-ups, posts and votes you make here stay on this device and can be reset from the Account screen. When the database is connected, everything becomes real and shared."}</p>
    <p>Nothing in this app is posted to any social platform. Social posts by Archiverse-Pakistan are approved one by one by the founder.</p>
    <p><a href="../" target="_blank" rel="noopener">Archiverse-Pakistan website</a>${CONFIG.contactEmail ? ` · <a href="mailto:${esc(CONFIG.contactEmail)}">${esc(CONFIG.contactEmail)}</a>` : ""}</p>
    ${footer()}
  </div></section>`);
}
