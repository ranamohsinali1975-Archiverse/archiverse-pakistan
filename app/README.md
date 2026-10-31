# Archiverse-Pakistan member app

An installable web app (PWA) for the forum: articles and videos, the survey and its results, the 2047 roadmap, member debates with proposals and votes, and institution responses on record. Plain HTML, CSS and JavaScript, no build step. Accounts and debates live in a free Supabase database once it is connected; until then the app runs in **preview mode** with sample data.

The app never posts to any social platform. Social posts are approved one by one by the founder in the main Jarvis session.

## 1. Preview it on this computer

```bash
python D:\Archiverse\app\serve.py
```

Then open **http://localhost:8790/app/** in Chrome or Edge. (The website preview is at http://localhost:8790/website/; its "Open the app" link only works once the app has been copied in, see section 3.) Stop with Ctrl+C.

In preview mode the Account screen offers one-click sample accounts: the founder (admin), a student, a practitioner, a verified institution and an unverified one. Anything you post is stored only in that browser; "Reset the sample data" on the Account screen clears it.

## 2. Connect the real database (Supabase, free)

1. Go to https://supabase.com, sign in (GitHub or email), and click **New project**. Name it `archiverse`, choose a strong database password (save it somewhere safe; the app never needs it), pick the Singapore or Mumbai region, Free plan.
2. When the project is ready, open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, and press **Run**. It creates the tables and the security rules (who may read or change what).
3. Open **Settings → API**. Copy **Project URL** and the **anon public** key into `config.js`:
   ```js
   supabaseUrl: "https://xxxx.supabase.co",
   supabaseAnonKey: "eyJ...",
   ```
   The anon key is meant to be public; the database rules do the protecting.
4. Open **Authentication → URL Configuration**. Set **Site URL** to the app's public address (see section 3, for example `https://<your-username>.github.io/archiverse-pakistan/app/`) and add the same address, plus `http://localhost:8790/app/`, under **Redirect URLs**. This is where sign-up confirmation links send people back.
5. Open the app, go to **Account → Create account**, and sign up with the founder's email. Confirm the email.
6. Back in Supabase **SQL Editor**, run this once (with the real email) to make that account the admin:
   ```sql
   update public.profiles set is_admin = true
    where id = (select id from auth.users where email = 'founder@example.com');
   ```
7. Sign out and in again in the app. The Account screen now shows **Open the admin screen**.

Optional:

- **Google sign-in.** In Supabase: Authentication → Providers → Google, follow its instructions to create a Google OAuth client (needs a Google Cloud project; about 15 minutes), paste the client ID and secret, save. Then set `googleSignIn: true` in `config.js`.
- **Email alerts for new debates.** The in-app bell works at once. Email needs an email service; the simplest route is Supabase → Database → Webhooks on the `debates` table, pointing at a free sender such as Resend, using the `notify_email` preference in `profiles`. Ask Jarvis to set it up when wanted; the app already stores each member's choice.
- **Contact address.** Put the forum's email in `contactEmail` in `config.js`; it appears on the About and Institutions screens.

## 3. Publish to GitHub Pages (as `/app/` of the website)

The website in `D:\Archiverse\website` is published to GitHub Pages (see `website/README.md`). The app is the `app` folder inside that site.

1. Copy this folder into the website as `website/app` (overwrite when updating):
   ```powershell
   Remove-Item -Recurse -Force D:\Archiverse\website\app -ErrorAction SilentlyContinue
   Copy-Item -Recurse D:\Archiverse\app D:\Archiverse\website\app
   ```
   (Skip `serve.py` and this README if you like; they do no harm.)
2. Commit and push the website repository as usual. Within a minute or two the app is live at `https://<your-username>.github.io/archiverse-pakistan/app/` (or `https://archiversepakistan.com/app/` once the domain is set).
3. The website's menu already has an **Open the app** link pointing to `app/`.

Each time you publish a new build, change `version` in `config.js` **and** `CACHE_VERSION` in `sw.js` (for example `1.0.1`). Installed apps then show "A new version is ready — Reload".

The app also works at the root of a site (for example its own repository) with no changes; every path is relative.

## 4. Installing it

- **Android, Windows, macOS (Chrome or Edge):** open the app's address, press **Install** at the top of the app (or the browser's install icon in the address bar).
- **iPhone / iPad:** open the address in Safari, tap **Share → Add to Home Screen**.

Installed, it opens full-screen with the Archiverse icon, and cached articles open without a connection. Posting needs a connection.

## 5. Day-to-day administration (the founder, or Jarvis on the founder's say-so)

| Task | Where |
|---|---|
| Add an article | Add an entry to `content/articles.json` (copy an existing one; `body` is a list of paragraphs, HTML allowed). Republish. |
| Add a video | Add `{ "youtube_id": "...", "title": "...", "published_on": "2026-11-15", "description": "..." }` to `content/videos.json`. Republish. |
| Publish survey results | Fill `content/survey-results.json` from the Google Forms export, set `"published": true`. Republish. Numbers must come from the export, never estimates. |
| Update roadmap numbers | Edit `content/roadmap.json` (`actual` and `updated`). Republish. |
| Pin, close (with outcome) or hide a debate | Open the debate while signed in as admin; buttons under the question. |
| Hide a post, handle reports | **Admin → Reports**, or the "Hide (moderator)" link on any post. A hidden post shows the reason, not silence. |
| Verify an institution account | **Admin → Institution accounts → Verify**, only after checking the person speaks for the institution (official email, letter or call). |
| Remove an institution response | Only for impersonation or abuse: "Delete" under the response on the Institutions screen. Note it in `logs/corrections.md`. Responses are otherwise never edited; institutions add dated correction notes. |
| Block a member (as a member) | "Block member" on any post hides that member's posts from your own view only. |

Members can remove their own posts (shown as "Removed by the author"), report posts, and block members. Only the admin can hide, unhide, pin and verify.

## 6. Files

```
app/
  index.html            the app shell
  config.js             the only file to edit for setup
  manifest.webmanifest  name, icon, colours for installation
  sw.js                 offline cache (bump CACHE_VERSION on each release)
  serve.py              local preview server
  assets/               stylesheet, icons, logos (logo only in black or white, per brand rules)
  content/              articles.json, videos.json, roadmap.json, survey-results.json
  js/                   app.js (routing), data.js (preview + Supabase), the screens
  supabase/schema.sql   database tables, triggers and security rules
```

## 7. What the security rules guarantee

- Emails are never shown to members; profiles show display name, role and institution only.
- Members can only edit their own profile and remove their own posts; they cannot make themselves admin or "verified".
- Only verified institution accounts can publish a response; a response's text can never be changed by anyone, including the admin. Correction notes are dated.
- Posting is blocked on closed or hidden debates.
- Notifications are created by the database itself when a debate opens or someone replies.
