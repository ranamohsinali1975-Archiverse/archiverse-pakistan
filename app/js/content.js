// Loads the JSON content files (articles, videos, roadmap, survey results).
// If Supabase is configured, rows in the articles/videos tables are merged in.

import { db, isConfigured } from "./data.js";

const cache = {};

async function loadJson(path) {
  if (cache[path]) return cache[path];
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error("Could not load " + path);
  cache[path] = await res.json();
  return cache[path];
}

export async function getArticles() {
  const local = await loadJson("content/articles.json");
  let merged = [...local];
  if (isConfigured) {
    try {
      const rows = await db.listArticleRows();
      for (const r of rows) {
        const a = {
          slug: r.slug, title: r.title, pillar: r.pillar, author: r.author, published_on: r.published_on,
          summary: r.summary, source_url: r.source_url, body_html: r.body_html, note: r.note_html, tags: [],
        };
        const i = merged.findIndex((x) => x.slug === a.slug);
        if (i >= 0) merged[i] = a; else merged.push(a);
      }
    } catch (e) { /* table may be empty or missing; the JSON file is enough */ }
  }
  merged.sort((a, b) => String(b.published_on).localeCompare(String(a.published_on)));
  return merged;
}

export async function getArticle(slug) {
  const all = await getArticles();
  return all.find((a) => a.slug === slug) || null;
}

export async function getVideos() {
  const local = await loadJson("content/videos.json");
  let list = [...(local.videos || [])];
  if (isConfigured) {
    try {
      const rows = await db.listVideoRows();
      for (const r of rows) if (!list.some((v) => v.youtube_id === r.youtube_id)) list.push(r);
    } catch (e) { /* ignore */ }
  }
  list.sort((a, b) => String(b.published_on || "").localeCompare(String(a.published_on || "")));
  return { channel_url: local.channel_url || "", videos: list };
}

export const getRoadmap = () => loadJson("content/roadmap.json");
export const getSurveyResults = () => loadJson("content/survey-results.json");
