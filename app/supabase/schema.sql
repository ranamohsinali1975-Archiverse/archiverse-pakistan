-- =====================================================================
--  Archiverse-Pakistan member app — database schema and security rules
--  Paste this whole file into Supabase → SQL Editor → New query → Run.
--  It is written to run once on a fresh project; running it again is
--  harmless for tables (IF NOT EXISTS) and re-creates functions/policies.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Profiles (one row per member; created automatically on sign-up)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  role text not null default 'student'
    check (role in ('student','graduate','educator','practitioner','institution')),
  institution text,          -- university, firm, department or body (optional)
  city text,
  bio text check (char_length(bio) <= 600),
  is_admin boolean not null default false,               -- the founder
  is_verified_institution boolean not null default false, -- set by the admin
  notify_in_app boolean not null default true,
  notify_email boolean not null default false,            -- used by the optional email step (README)
  created_at timestamptz not null default now()
);

-- Helper: is the signed-in user the admin?  (security definer = no RLS recursion)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Helper: is the signed-in user a verified institution account?
create or replace function public.is_verified_institution() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_verified_institution from public.profiles where id = auth.uid()), false);
$$;

-- Create the profile row when a user signs up (email or Google).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  r text := coalesce(meta->>'role', 'student');
begin
  if r not in ('student','graduate','educator','practitioner','institution') then r := 'student'; end if;
  insert into public.profiles (id, display_name, role, institution)
  values (
    new.id,
    left(coalesce(nullif(meta->>'display_name',''), nullif(meta->>'full_name',''), nullif(meta->>'name',''), split_part(coalesce(new.email,'member'), '@', 1)), 80),
    r,
    nullif(meta->>'institution','')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Members cannot make themselves admin or verified.
create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
begin
  if not public.is_admin() then
    new.is_admin := old.is_admin;
    new.is_verified_institution := old.is_verified_institution;
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

alter table public.profiles enable row level security;
drop policy if exists "profiles: public read" on public.profiles;
create policy "profiles: public read" on public.profiles for select using (true);
drop policy if exists "profiles: own insert" on public.profiles;
create policy "profiles: own insert" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles: own or admin update" on public.profiles;
create policy "profiles: own or admin update" on public.profiles for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- ---------------------------------------------------------------------
-- 2. Debates
-- ---------------------------------------------------------------------
create table if not exists public.debates (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 8 and 160),
  question text not null check (char_length(question) between 10 and 2000),
  pillar text check (pillar in ('learn','accountable','builds','global')),
  front text check (front in ('system','syllabus','organisations','institutes','professionals')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  pinned boolean not null default false,
  closed boolean not null default false,
  hidden boolean not null default false,
  outcome text,              -- the published outcome, written by the admin when a debate closes
  created_at timestamptz not null default now()
);
create index if not exists debates_created_at on public.debates (created_at desc);

-- Members may only close their own debate; everything else is the admin's.
create or replace function public.debates_guard() returns trigger
language plpgsql as $$
begin
  if not public.is_admin() then
    new.title := old.title; new.question := old.question; new.pillar := old.pillar; new.front := old.front;
    new.created_by := old.created_by; new.pinned := old.pinned; new.hidden := old.hidden; new.outcome := old.outcome;
  end if;
  return new;
end $$;
drop trigger if exists debates_guard on public.debates;
create trigger debates_guard before update on public.debates
  for each row execute function public.debates_guard();

alter table public.debates enable row level security;
drop policy if exists "debates: read" on public.debates;
create policy "debates: read" on public.debates for select
  using (not hidden or public.is_admin() or created_by = auth.uid());
drop policy if exists "debates: members create" on public.debates;
create policy "debates: members create" on public.debates for insert
  with check (auth.uid() = created_by);
drop policy if exists "debates: owner or admin update" on public.debates;
create policy "debates: owner or admin update" on public.debates for update
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());
drop policy if exists "debates: admin delete" on public.debates;
create policy "debates: admin delete" on public.debates for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- 3. Posts (comments and proposals, with one level of replies)
-- ---------------------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid not null references public.debates(id) on delete cascade,
  parent_id uuid references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'comment' check (kind in ('comment','proposal')),
  body text not null check (char_length(body) between 2 and 5000),
  claim_label text check (claim_label in ('verified_fact','community_experience','opinion')),
  source_url text check (source_url is null or source_url ~* '^https?://'),
  hidden boolean not null default false,
  hidden_reason text,
  created_at timestamptz not null default now()
);
create index if not exists posts_debate on public.posts (debate_id, created_at);

-- Members may only remove their own post (soft delete). The admin may hide/unhide.
create or replace function public.posts_guard() returns trigger
language plpgsql as $$
begin
  if not public.is_admin() then
    new.debate_id := old.debate_id; new.parent_id := old.parent_id; new.author_id := old.author_id;
    new.kind := old.kind; new.body := old.body; new.claim_label := old.claim_label; new.source_url := old.source_url;
    if new.hidden and not old.hidden then
      new.hidden_reason := 'Removed by the author';
    else
      new.hidden := old.hidden; new.hidden_reason := old.hidden_reason;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists posts_guard on public.posts;
create trigger posts_guard before update on public.posts
  for each row execute function public.posts_guard();

alter table public.posts enable row level security;
drop policy if exists "posts: read" on public.posts;
create policy "posts: read" on public.posts for select
  using (not hidden or public.is_admin() or author_id = auth.uid());
drop policy if exists "posts: members create" on public.posts;
create policy "posts: members create" on public.posts for insert
  with check (
    auth.uid() = author_id
    and exists (select 1 from public.debates d where d.id = debate_id and not d.closed and not d.hidden)
  );
drop policy if exists "posts: author or admin update" on public.posts;
create policy "posts: author or admin update" on public.posts for update
  using (public.is_admin() or author_id = auth.uid())
  with check (public.is_admin() or author_id = auth.uid());

-- ---------------------------------------------------------------------
-- 4. Votes (one "support" per member per proposal)
-- ---------------------------------------------------------------------
create table if not exists public.votes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.votes enable row level security;
drop policy if exists "votes: public read" on public.votes;
create policy "votes: public read" on public.votes for select using (true);
drop policy if exists "votes: own insert" on public.votes;
create policy "votes: own insert" on public.votes for insert with check (auth.uid() = user_id);
drop policy if exists "votes: own delete" on public.votes;
create policy "votes: own delete" on public.votes for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 5. Reports (members flag a post; the admin resolves it)
-- ---------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 1000),
  status text not null default 'open' check (status in ('open','resolved')),
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.reports enable row level security;
drop policy if exists "reports: reporter or admin read" on public.reports;
create policy "reports: reporter or admin read" on public.reports for select
  using (public.is_admin() or reporter_id = auth.uid());
drop policy if exists "reports: members create" on public.reports;
create policy "reports: members create" on public.reports for insert with check (auth.uid() = reporter_id);
drop policy if exists "reports: admin update" on public.reports;
create policy "reports: admin update" on public.reports for update using (public.is_admin());

-- ---------------------------------------------------------------------
-- 6. Blocks (a member hides another member's posts from their own view)
-- ---------------------------------------------------------------------
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
drop policy if exists "blocks: own" on public.blocks;
create policy "blocks: own" on public.blocks for all
  using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

-- ---------------------------------------------------------------------
-- 7. Notifications (in-app; filled by triggers)
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user on public.notifications (user_id, read, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "notifications: own read" on public.notifications;
create policy "notifications: own read" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "notifications: own update" on public.notifications;
create policy "notifications: own update" on public.notifications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "notifications: own delete" on public.notifications;
create policy "notifications: own delete" on public.notifications for delete using (auth.uid() = user_id);

-- New debate → notify every member who opted in (except its author).
create or replace function public.notify_new_debate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, title, body, link)
  select p.id, 'new_debate', 'New debate: ' || new.title, left(new.question, 240), '#/debates/' || new.id::text
  from public.profiles p
  where p.notify_in_app and p.id <> new.created_by;
  return new;
end $$;
drop trigger if exists on_debate_created on public.debates;
create trigger on_debate_created after insert on public.debates
  for each row execute function public.notify_new_debate();

-- Reply → notify the parent post's author.
create or replace function public.notify_reply() returns trigger
language plpgsql security definer set search_path = public as $$
declare parent_author uuid; d_title text;
begin
  if new.parent_id is null then return new; end if;
  select author_id into parent_author from public.posts where id = new.parent_id;
  select title into d_title from public.debates where id = new.debate_id;
  if parent_author is not null and parent_author <> new.author_id then
    insert into public.notifications (user_id, type, title, body, link)
    select parent_author, 'reply', 'New reply in: ' || coalesce(d_title, 'a debate'), left(new.body, 240), '#/debates/' || new.debate_id::text
    from public.profiles p where p.id = parent_author and p.notify_in_app;
  end if;
  return new;
end $$;
drop trigger if exists on_post_reply on public.posts;
create trigger on_post_reply after insert on public.posts
  for each row execute function public.notify_reply();

-- ---------------------------------------------------------------------
-- 8. Institution responses (on record, published unedited)
-- ---------------------------------------------------------------------
create table if not exists public.institution_responses (
  id uuid primary key default gen_random_uuid(),
  piece_type text not null check (piece_type in ('article','debate','video')),
  piece_id text not null,            -- article slug, debate id or video id
  piece_title text not null,
  institution_id uuid not null references public.profiles(id) on delete cascade,
  institution_name text not null,
  body text not null check (char_length(body) between 20 and 10000),
  correction_note text check (char_length(correction_note) <= 2000),
  corrected_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists responses_piece on public.institution_responses (piece_type, piece_id);

-- The text of a response can never be edited — not by the institution, not by the admin.
-- A correction note can be added by the institution; it is dated and shown next to the original.
create or replace function public.responses_guard() returns trigger
language plpgsql as $$
begin
  if new.body is distinct from old.body
     or new.institution_id is distinct from old.institution_id
     or new.institution_name is distinct from old.institution_name
     or new.piece_type is distinct from old.piece_type
     or new.piece_id is distinct from old.piece_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Responses are published unedited. Add a correction note instead.';
  end if;
  if new.correction_note is distinct from old.correction_note then
    new.corrected_at := now();
  end if;
  return new;
end $$;
drop trigger if exists responses_guard on public.institution_responses;
create trigger responses_guard before update on public.institution_responses
  for each row execute function public.responses_guard();

alter table public.institution_responses enable row level security;
drop policy if exists "responses: public read" on public.institution_responses;
create policy "responses: public read" on public.institution_responses for select using (true);
drop policy if exists "responses: verified institutions create" on public.institution_responses;
create policy "responses: verified institutions create" on public.institution_responses for insert
  with check (auth.uid() = institution_id and public.is_verified_institution());
drop policy if exists "responses: own correction note" on public.institution_responses;
create policy "responses: own correction note" on public.institution_responses for update
  using (auth.uid() = institution_id) with check (auth.uid() = institution_id);
-- Only for abuse (e.g. an impersonating account). Every deletion should be noted in logs/corrections.md.
drop policy if exists "responses: admin delete" on public.institution_responses;
create policy "responses: admin delete" on public.institution_responses for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- 9. Articles and videos (optional: the app also reads app/content/*.json)
-- ---------------------------------------------------------------------
create table if not exists public.articles (
  slug text primary key,
  title text not null,
  pillar text check (pillar in ('learn','accountable','builds','global')),
  summary text,
  author text not null default 'Rana Mohsin Ali',
  published_on date,
  body_html text not null,
  note_html text,
  source_url text,
  created_at timestamptz not null default now()
);
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  youtube_id text not null,
  title text not null,
  description text,
  published_on date,
  created_at timestamptz not null default now()
);
alter table public.articles enable row level security;
alter table public.videos enable row level security;
drop policy if exists "articles: public read" on public.articles;
create policy "articles: public read" on public.articles for select using (true);
drop policy if exists "articles: admin write" on public.articles;
create policy "articles: admin write" on public.articles for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "videos: public read" on public.videos;
create policy "videos: public read" on public.videos for select using (true);
drop policy if exists "videos: admin write" on public.videos;
create policy "videos: admin write" on public.videos for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 10. A view the app uses for the debate list (post counts)
-- ---------------------------------------------------------------------
create or replace view public.debate_stats with (security_invoker = true) as
  select d.id as debate_id,
         count(p.id) filter (where not p.hidden) as post_count,
         max(p.created_at) filter (where not p.hidden) as last_post_at
  from public.debates d
  left join public.posts p on p.debate_id = d.id
  group by d.id;

-- =====================================================================
--  AFTER you have signed up in the app with the founder's email, run
--  the line below (replace the email) to make that account the admin:
--
--  update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'founder@example.com');
--
--  Institution accounts are verified from the app's Admin screen
--  (Admin → Institution accounts → Verify). No SQL needed for that.
-- =====================================================================
