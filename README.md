# Archiverse-Pakistan website

Static site: plain HTML + one stylesheet, no build step. Open `index.html` in a browser to preview. Brand rules come from `../brand/identity-pack.md` §6 (logo only in black or white; deep teal / charcoal with a terracotta accent; geometric sans headings).

## Pages

- `index.html` — home
- `about.html`, `join.html`
- `articles/index.html` — article list (cards between `ARTICLES:START` / `ARTICLES:END` markers)
- `articles/<slug>.html` — one page per article
- `assets/` — `style.css`, logo variants, favicon

## Publishing an article from the pipeline

`/publish <id> website` writes `articles/<slug>.html` from the item's `### website` draft (copy `fading-academia.html` as the page template), inserts a card at the top of the `ARTICLES:START` block, updates the two cards on `index.html` if it is newer, then commits. Pushing to the host is the live action and needs the founder's yes.

## Free hosting — GitHub Pages (recommended)

Free, supports the custom domain `archiversepakistan.com` later, and every change is versioned.

1. Create a GitHub account if needed, then a new empty repository named `archiverse-pakistan` (public).
2. In this folder:

```bash
git init
git add .
git commit -m "Archiverse-Pakistan website"
git branch -M main
git remote add origin https://github.com/<your-username>/archiverse-pakistan.git
git push -u origin main
```

3. On GitHub: Settings → Pages → Source: *Deploy from a branch* → Branch `main`, folder `/ (root)` → Save. The site appears at `https://<your-username>.github.io/archiverse-pakistan/` within a minute or two.
4. Custom domain later: add a file named `CNAME` containing `archiversepakistan.com`, and point the domain's DNS at GitHub Pages (A records `185.199.108.153`, `.109.153`, `.110.153`, `.111.153`, and a `www` CNAME to `<your-username>.github.io`).

The `.nojekyll` file tells GitHub Pages to serve the folder as-is.

## Alternatives

- **Cloudflare Pages** — free, fast, custom domains; connect the same GitHub repository or drag-and-drop this folder.
- **Netlify Drop** — drag this folder onto app.netlify.com/drop for an instant free URL (needs a Netlify account to keep it).
