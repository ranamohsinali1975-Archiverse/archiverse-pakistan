// Data layer. Two interchangeable stores with the same methods:
//   DemoStore     — preview mode, sample data in localStorage (no account needed)
//   SupabaseStore — the real thing, once config.js has the project URL and anon key
// Every screen talks to `db` and never to Supabase directly.

import { CONFIG } from "../config.js";
import { demoSeed, DEMO_ACCOUNTS } from "./demo-data.js";

export const isConfigured =
  !!CONFIG.supabaseUrl && !CONFIG.supabaseUrl.includes("YOUR_") &&
  !!CONFIG.supabaseAnonKey && !CONFIG.supabaseAnonKey.includes("YOUR_");

const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js";

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36));

// ---------------------------------------------------------------------------
// Preview-mode store
// ---------------------------------------------------------------------------
class DemoStore {
  constructor() {
    this.mode = "demo";
    this.KEY = "archiverse-demo-v1";
    this.listeners = new Set();
    this.user = null;
    this.profile = null;
  }
  async init() {
    try {
      const raw = localStorage.getItem(this.KEY);
      this.s = raw ? JSON.parse(raw) : demoSeed();
    } catch { this.s = demoSeed(); }
    this._setSession(this.s.sessionUserId);
  }
  _save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.s)); } catch {} }
  _emit() { this.listeners.forEach((cb) => cb(this.user)); }
  _setSession(id) {
    this.s.sessionUserId = id || null;
    const p = id ? this.s.profiles.find((x) => x.id === id) : null;
    this.user = p ? { id: p.id, email: p.email } : null;
    this.profile = p ? { ...p } : null;
    this._save();
    this._emit();
  }
  _p(id) { const p = this.s.profiles.find((x) => x.id === id); return p ? { id: p.id, display_name: p.display_name, role: p.role, institution: p.institution, is_verified_institution: p.is_verified_institution } : null; }
  _need() { if (!this.user) throw new Error("Please sign in first."); }
  _admin() { if (!this.profile?.is_admin) throw new Error("Only the admin can do that."); }
  resetDemo() { this.s = demoSeed(); this._setSession(null); }

  onAuth(cb) { this.listeners.add(cb); }

  // auth
  async signIn(email) {
    const id = DEMO_ACCOUNTS[email.toLowerCase()] || this.s.profiles.find((p) => p.email === email.toLowerCase())?.id;
    if (!id) throw new Error("No preview account with that email. Use one of the sample accounts below, or sign up.");
    this._setSession(id);
  }
  async signInAs(id) { this._setSession(id); }
  async signUp({ email, password, display_name, role, institution }) {
    email = email.toLowerCase();
    if (this.s.profiles.some((p) => p.email === email)) throw new Error("An account with that email already exists in this preview.");
    const p = { id: "u-" + uid().slice(0, 8), email, display_name, role, institution: institution || "", city: "", bio: "", is_admin: false, is_verified_institution: false, notify_in_app: true, notify_email: false, created_at: new Date().toISOString() };
    this.s.profiles.push(p);
    this._setSession(p.id);
    return { needsConfirmation: false };
  }
  async signInWithGoogle() { throw new Error("Google sign-in works once Supabase is connected."); }
  async resetPassword() { throw new Error("Password reset works once Supabase is connected."); }
  async signOut() { this._setSession(null); }

  // profile
  async getMyProfile() { return this.profile ? { ...this.profile } : null; }
  async updateProfile(fields) {
    this._need();
    const p = this.s.profiles.find((x) => x.id === this.user.id);
    const allowed = ["display_name", "role", "institution", "city", "bio", "notify_in_app", "notify_email"];
    for (const k of allowed) if (k in fields) p[k] = fields[k];
    this._setSession(p.id);
  }

  // debates
  async listDebates() {
    const isAdmin = !!this.profile?.is_admin;
    return this.s.debates
      .filter((d) => !d.hidden || isAdmin || d.created_by === this.user?.id)
      .map((d) => {
        const posts = this.s.posts.filter((p) => p.debate_id === d.id && !p.hidden);
        return { ...d, author: this._p(d.created_by), post_count: posts.length, last_post_at: posts.reduce((m, p) => (p.created_at > m ? p.created_at : m), null) };
      })
      .sort((a, b) => (b.pinned - a.pinned) || b.created_at.localeCompare(a.created_at));
  }
  async getDebate(id) {
    const d = this.s.debates.find((x) => x.id === id);
    if (!d || (d.hidden && !this.profile?.is_admin && d.created_by !== this.user?.id)) return null;
    return { ...d, author: this._p(d.created_by) };
  }
  async createDebate({ title, question, pillar, front }) {
    this._need();
    const d = { id: "d-" + uid().slice(0, 8), title, question, pillar: pillar || null, front: front || null, created_by: this.user.id, pinned: false, closed: false, hidden: false, outcome: null, created_at: new Date().toISOString() };
    this.s.debates.push(d);
    for (const p of this.s.profiles) if (p.notify_in_app && p.id !== this.user.id)
      this.s.notifications.push({ id: "n-" + uid().slice(0, 8), user_id: p.id, type: "new_debate", title: "New debate: " + title, body: question.slice(0, 240), link: "#/debates/" + d.id, read: false, created_at: d.created_at });
    this._save();
    return d;
  }
  async updateDebate(id, fields) {
    this._need();
    const d = this.s.debates.find((x) => x.id === id);
    if (!d) throw new Error("Debate not found.");
    if (this.profile.is_admin) Object.assign(d, fields);
    else if (d.created_by === this.user.id && "closed" in fields) d.closed = !!fields.closed;
    else throw new Error("Only the admin can change that.");
    this._save();
  }

  // posts
  async listPosts(debateId) {
    const isAdmin = !!this.profile?.is_admin;
    const me = this.user?.id;
    const blocked = new Set(this.s.blocks.filter((b) => b.blocker_id === me).map((b) => b.blocked_id));
    return this.s.posts
      .filter((p) => p.debate_id === debateId && (!p.hidden || isAdmin || p.author_id === me))
      .map((p) => ({
        ...p,
        author: this._p(p.author_id),
        votes: this.s.votes.filter((v) => v.post_id === p.id).length,
        voted: !!me && this.s.votes.some((v) => v.post_id === p.id && v.user_id === me),
        blocked: blocked.has(p.author_id),
      }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  async createPost({ debate_id, parent_id, body, kind, claim_label, source_url }) {
    this._need();
    const d = this.s.debates.find((x) => x.id === debate_id);
    if (!d || d.closed) throw new Error("This debate is closed.");
    const p = { id: "p-" + uid().slice(0, 8), debate_id, parent_id: parent_id || null, author_id: this.user.id, kind: kind || "comment", body, claim_label: claim_label || null, source_url: source_url || null, hidden: false, hidden_reason: null, created_at: new Date().toISOString() };
    this.s.posts.push(p);
    if (parent_id) {
      const parent = this.s.posts.find((x) => x.id === parent_id);
      const pa = parent && this.s.profiles.find((x) => x.id === parent.author_id);
      if (pa && pa.id !== this.user.id && pa.notify_in_app)
        this.s.notifications.push({ id: "n-" + uid().slice(0, 8), user_id: pa.id, type: "reply", title: "New reply in: " + d.title, body: body.slice(0, 240), link: "#/debates/" + debate_id, read: false, created_at: p.created_at });
    }
    this._save();
    return p;
  }
  async setPostHidden(postId, hidden, reason) {
    this._need();
    const p = this.s.posts.find((x) => x.id === postId);
    if (!p) throw new Error("Post not found.");
    if (this.profile.is_admin) { p.hidden = hidden; p.hidden_reason = hidden ? (reason || "Hidden by moderator") : null; }
    else if (p.author_id === this.user.id && hidden) { p.hidden = true; p.hidden_reason = "Removed by the author"; }
    else throw new Error("Only the admin can do that.");
    this._save();
  }

  // votes
  async toggleVote(postId) {
    this._need();
    const i = this.s.votes.findIndex((v) => v.post_id === postId && v.user_id === this.user.id);
    if (i >= 0) this.s.votes.splice(i, 1); else this.s.votes.push({ post_id: postId, user_id: this.user.id, created_at: new Date().toISOString() });
    this._save();
    return i < 0;
  }

  // reports / blocks
  async reportPost(postId, reason) {
    this._need();
    this.s.reports.push({ id: "r-" + uid().slice(0, 8), post_id: postId, reporter_id: this.user.id, reason, status: "open", resolution: null, created_at: new Date().toISOString(), resolved_at: null });
    this._save();
  }
  async listReports() {
    this._admin();
    return this.s.reports.map((r) => {
      const post = this.s.posts.find((p) => p.id === r.post_id);
      return { ...r, reporter: this._p(r.reporter_id), post: post ? { ...post, author: this._p(post.author_id) } : null };
    }).sort((a, b) => (a.status === "open" ? -1 : 1) - (b.status === "open" ? -1 : 1) || b.created_at.localeCompare(a.created_at));
  }
  async resolveReport(id, resolution) {
    this._admin();
    const r = this.s.reports.find((x) => x.id === id);
    if (r) { r.status = "resolved"; r.resolution = resolution; r.resolved_at = new Date().toISOString(); }
    this._save();
  }
  async blockUser(id) { this._need(); if (!this.s.blocks.some((b) => b.blocker_id === this.user.id && b.blocked_id === id)) this.s.blocks.push({ blocker_id: this.user.id, blocked_id: id, created_at: new Date().toISOString() }); this._save(); }
  async unblockUser(id) { this._need(); this.s.blocks = this.s.blocks.filter((b) => !(b.blocker_id === this.user.id && b.blocked_id === id)); this._save(); }
  async myBlocks() { if (!this.user) return []; return this.s.blocks.filter((b) => b.blocker_id === this.user.id).map((b) => ({ ...b, profile: this._p(b.blocked_id) })); }

  // notifications
  async listNotifications() { if (!this.user) return []; return this.s.notifications.filter((n) => n.user_id === this.user.id).sort((a, b) => b.created_at.localeCompare(a.created_at)); }
  async unreadCount() { if (!this.user) return 0; return this.s.notifications.filter((n) => n.user_id === this.user.id && !n.read).length; }
  async markAllRead() { if (!this.user) return; for (const n of this.s.notifications) if (n.user_id === this.user.id) n.read = true; this._save(); }

  // institution responses
  async listResponses(filter = {}) {
    return this.s.responses
      .filter((r) => (!filter.piece_type || r.piece_type === filter.piece_type) && (!filter.piece_id || r.piece_id === filter.piece_id))
      .map((r) => ({ ...r, institution: this._p(r.institution_id) }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async submitResponse({ piece_type, piece_id, piece_title, body }) {
    this._need();
    if (!this.profile.is_verified_institution) throw new Error("Only a verified institution account can respond on record.");
    const r = { id: "ir-" + uid().slice(0, 8), piece_type, piece_id, piece_title, institution_id: this.user.id, institution_name: this.profile.institution || this.profile.display_name, body, correction_note: null, corrected_at: null, created_at: new Date().toISOString() };
    this.s.responses.push(r);
    this._save();
    return r;
  }
  async addCorrection(id, note) {
    this._need();
    const r = this.s.responses.find((x) => x.id === id);
    if (!r || r.institution_id !== this.user.id) throw new Error("You can only add a correction note to your own response.");
    r.correction_note = note; r.corrected_at = new Date().toISOString();
    this._save();
  }
  async deleteResponse(id) { this._admin(); this.s.responses = this.s.responses.filter((r) => r.id !== id); this._save(); }

  // admin
  async listInstitutionAccounts() { this._admin(); return this.s.profiles.filter((p) => p.role === "institution").map((p) => ({ ...p })); }
  async setVerified(id, verified) { this._admin(); const p = this.s.profiles.find((x) => x.id === id); if (p) p.is_verified_institution = verified; this._save(); }
  async memberCount() { return this.s.profiles.length; }

  async listArticleRows() { return []; }
  async listVideoRows() { return []; }
}

// ---------------------------------------------------------------------------
// Supabase store
// ---------------------------------------------------------------------------
class SupabaseStore {
  constructor() { this.mode = "supabase"; this.listeners = new Set(); this.user = null; this.profile = null; }

  async init() {
    await new Promise((resolve, reject) => {
      if (window.supabase) return resolve();
      const s = document.createElement("script");
      s.src = SUPABASE_CDN; s.onload = resolve; s.onerror = () => reject(new Error("Could not load the Supabase library. Check your internet connection."));
      document.head.appendChild(s);
    });
    this.c = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const { data } = await this.c.auth.getSession();
    this.user = data.session?.user || null;
    if (this.user) await this._loadProfile();
    this.c.auth.onAuthStateChange(async (_event, session) => {
      const changed = (session?.user?.id || null) !== (this.user?.id || null);
      this.user = session?.user || null;
      if (changed) { this.profile = null; if (this.user) await this._loadProfile(); this._emit(); }
    });
  }
  _emit() { this.listeners.forEach((cb) => cb(this.user)); }
  onAuth(cb) { this.listeners.add(cb); }
  _need() { if (!this.user) throw new Error("Please sign in first."); }
  _admin() { if (!this.profile?.is_admin) throw new Error("Only the admin can do that."); }
  _redirect() { return location.origin + location.pathname; }
  async _loadProfile() {
    const { data } = await this.c.from("profiles").select("*").eq("id", this.user.id).maybeSingle();
    this.profile = data || null;
  }
  _throw(error) { if (error) throw new Error(error.message || String(error)); }

  // auth
  async signIn(email, password) { const { error } = await this.c.auth.signInWithPassword({ email, password }); this._throw(error); }
  async signUp({ email, password, display_name, role, institution }) {
    const { data, error } = await this.c.auth.signUp({ email, password, options: { data: { display_name, role, institution: institution || "" }, emailRedirectTo: this._redirect() } });
    this._throw(error);
    return { needsConfirmation: !data.session };
  }
  async signInWithGoogle() { const { error } = await this.c.auth.signInWithOAuth({ provider: "google", options: { redirectTo: this._redirect() } }); this._throw(error); }
  async resetPassword(email) { const { error } = await this.c.auth.resetPasswordForEmail(email, { redirectTo: this._redirect() + "#/account" }); this._throw(error); }
  async updatePassword(password) { const { error } = await this.c.auth.updateUser({ password }); this._throw(error); }
  async signOut() { await this.c.auth.signOut(); this.user = null; this.profile = null; this._emit(); }

  // profile
  async getMyProfile() { if (!this.user) return null; if (!this.profile) await this._loadProfile(); return this.profile; }
  async updateProfile(fields) {
    this._need();
    const allowed = {};
    for (const k of ["display_name", "role", "institution", "city", "bio", "notify_in_app", "notify_email"]) if (k in fields) allowed[k] = fields[k];
    const { error } = await this.c.from("profiles").update(allowed).eq("id", this.user.id); this._throw(error);
    await this._loadProfile();
  }

  // debates
  async listDebates() {
    const { data, error } = await this.c.from("debates").select("*, author:profiles!debates_created_by_fkey(id, display_name, role, institution, is_verified_institution)").order("pinned", { ascending: false }).order("created_at", { ascending: false });
    this._throw(error);
    const { data: stats } = await this.c.from("debate_stats").select("*");
    const m = new Map((stats || []).map((s) => [s.debate_id, s]));
    return data.map((d) => ({ ...d, post_count: Number(m.get(d.id)?.post_count || 0), last_post_at: m.get(d.id)?.last_post_at || null }));
  }
  async getDebate(id) {
    const { data, error } = await this.c.from("debates").select("*, author:profiles!debates_created_by_fkey(id, display_name, role, institution, is_verified_institution)").eq("id", id).maybeSingle();
    this._throw(error);
    return data;
  }
  async createDebate({ title, question, pillar, front }) {
    this._need();
    const { data, error } = await this.c.from("debates").insert({ title, question, pillar: pillar || null, front: front || null, created_by: this.user.id }).select().single();
    this._throw(error);
    return data;
  }
  async updateDebate(id, fields) { this._need(); const { error } = await this.c.from("debates").update(fields).eq("id", id); this._throw(error); }

  // posts
  async listPosts(debateId) {
    const { data, error } = await this.c.from("posts").select("*, author:profiles!posts_author_id_fkey(id, display_name, role, institution, is_verified_institution)").eq("debate_id", debateId).order("created_at");
    this._throw(error);
    const ids = data.map((p) => p.id);
    let votes = [];
    if (ids.length) { const r = await this.c.from("votes").select("post_id, user_id").in("post_id", ids); votes = r.data || []; }
    let blocked = new Set();
    if (this.user) { const b = await this.c.from("blocks").select("blocked_id").eq("blocker_id", this.user.id); blocked = new Set((b.data || []).map((x) => x.blocked_id)); }
    return data.map((p) => ({
      ...p,
      votes: votes.filter((v) => v.post_id === p.id).length,
      voted: !!this.user && votes.some((v) => v.post_id === p.id && v.user_id === this.user.id),
      blocked: blocked.has(p.author_id),
    }));
  }
  async createPost({ debate_id, parent_id, body, kind, claim_label, source_url }) {
    this._need();
    const { data, error } = await this.c.from("posts").insert({ debate_id, parent_id: parent_id || null, author_id: this.user.id, kind: kind || "comment", body, claim_label: claim_label || null, source_url: source_url || null }).select().single();
    this._throw(error);
    return data;
  }
  async setPostHidden(postId, hidden, reason) {
    this._need();
    const { error } = await this.c.from("posts").update({ hidden, hidden_reason: hidden ? (reason || "Hidden by moderator") : null }).eq("id", postId);
    this._throw(error);
  }

  // votes
  async toggleVote(postId) {
    this._need();
    const { data } = await this.c.from("votes").select("post_id").eq("post_id", postId).eq("user_id", this.user.id).maybeSingle();
    if (data) { const { error } = await this.c.from("votes").delete().eq("post_id", postId).eq("user_id", this.user.id); this._throw(error); return false; }
    const { error } = await this.c.from("votes").insert({ post_id: postId, user_id: this.user.id }); this._throw(error); return true;
  }

  // reports / blocks
  async reportPost(postId, reason) { this._need(); const { error } = await this.c.from("reports").insert({ post_id: postId, reporter_id: this.user.id, reason }); this._throw(error); }
  async listReports() {
    this._admin();
    const { data, error } = await this.c.from("reports").select("*, reporter:profiles!reports_reporter_id_fkey(id, display_name, role), post:posts(*, author:profiles!posts_author_id_fkey(id, display_name, role))").order("created_at", { ascending: false });
    this._throw(error);
    return data.sort((a, b) => (a.status === "open" ? -1 : 1) - (b.status === "open" ? -1 : 1));
  }
  async resolveReport(id, resolution) { this._admin(); const { error } = await this.c.from("reports").update({ status: "resolved", resolution, resolved_at: new Date().toISOString() }).eq("id", id); this._throw(error); }
  async blockUser(id) { this._need(); const { error } = await this.c.from("blocks").upsert({ blocker_id: this.user.id, blocked_id: id }); this._throw(error); }
  async unblockUser(id) { this._need(); const { error } = await this.c.from("blocks").delete().eq("blocker_id", this.user.id).eq("blocked_id", id); this._throw(error); }
  async myBlocks() { if (!this.user) return []; const { data } = await this.c.from("blocks").select("*, profile:profiles!blocks_blocked_id_fkey(id, display_name, role)").eq("blocker_id", this.user.id); return data || []; }

  // notifications
  async listNotifications() { if (!this.user) return []; const { data } = await this.c.from("notifications").select("*").eq("user_id", this.user.id).order("created_at", { ascending: false }).limit(100); return data || []; }
  async unreadCount() { if (!this.user) return 0; const { count } = await this.c.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", this.user.id).eq("read", false); return count || 0; }
  async markAllRead() { if (!this.user) return; await this.c.from("notifications").update({ read: true }).eq("user_id", this.user.id).eq("read", false); }

  // institution responses
  async listResponses(filter = {}) {
    let q = this.c.from("institution_responses").select("*, institution:profiles!institution_responses_institution_id_fkey(id, display_name, role, institution, is_verified_institution)").order("created_at", { ascending: false });
    if (filter.piece_type) q = q.eq("piece_type", filter.piece_type);
    if (filter.piece_id) q = q.eq("piece_id", filter.piece_id);
    const { data, error } = await q; this._throw(error); return data;
  }
  async submitResponse({ piece_type, piece_id, piece_title, body }) {
    this._need();
    const p = await this.getMyProfile();
    const { data, error } = await this.c.from("institution_responses").insert({ piece_type, piece_id, piece_title, institution_id: this.user.id, institution_name: p?.institution || p?.display_name || "Institution", body }).select().single();
    this._throw(error);
    return data;
  }
  async addCorrection(id, note) { this._need(); const { error } = await this.c.from("institution_responses").update({ correction_note: note }).eq("id", id); this._throw(error); }
  async deleteResponse(id) { this._admin(); const { error } = await this.c.from("institution_responses").delete().eq("id", id); this._throw(error); }

  // admin
  async listInstitutionAccounts() { this._admin(); const { data, error } = await this.c.from("profiles").select("*").eq("role", "institution").order("created_at", { ascending: false }); this._throw(error); return data; }
  async setVerified(id, verified) { this._admin(); const { error } = await this.c.from("profiles").update({ is_verified_institution: verified }).eq("id", id); this._throw(error); }
  async memberCount() { const { count } = await this.c.from("profiles").select("id", { count: "exact", head: true }); return count || 0; }

  async listArticleRows() { const { data } = await this.c.from("articles").select("*"); return data || []; }
  async listVideoRows() { const { data } = await this.c.from("videos").select("*"); return data || []; }
}

export const db = isConfigured ? new SupabaseStore() : new DemoStore();
