-- Schema and RLS policies for exam-mimic
-- Run in Supabase SQL Editor (or via psql) in your project.

-- Enable required extension
create extension if not exists "pgcrypto";

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  first_name text,
  last_name text,
  role text not null default 'user',
  theme text,
  migration_completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Courses
create table if not exists public.courses (
  id text primary key,
  title text not null,
  description text,
  duration_minutes integer not null default 60,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists courses_created_by_idx on public.courses (created_by);

-- Questions
create table if not exists public.questions (
  id text primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  number integer not null,
  question text not null,
  options jsonb not null default '{}'::jsonb,
  correct_answer jsonb not null default '[]'::jsonb,
  explanation text,
  is_multiple_choice boolean,
  question_type text,
  sub_questions jsonb not null default '[]'::jsonb,
  course_id text references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by text,
  is_global boolean not null default false
);

alter table public.questions
  add column if not exists question_type text;

alter table public.questions
  add column if not exists sub_questions jsonb not null default '[]'::jsonb;

alter table public.questions
  add column if not exists course_id text references public.courses(id) on delete cascade;

alter table public.profiles
  add column if not exists first_name text;

alter table public.profiles
  add column if not exists last_name text;

alter table public.profiles
  add column if not exists role text not null default 'user';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'is_admin'
  ) then
    update public.profiles
      set role = 'admin'
      where is_admin = true;
  end if;
end $$;

alter table public.profiles
  drop column if exists is_admin;

create index if not exists questions_owner_id_idx on public.questions (owner_id);
create index if not exists questions_is_global_idx on public.questions (is_global);
create index if not exists questions_number_idx on public.questions (number);
create index if not exists questions_course_id_idx on public.questions (course_id);

-- Exam sessions
create table if not exists public.exam_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer,
  started_at timestamptz,
  ended_at timestamptz,
  course_id text references public.courses(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists exam_sessions_user_id_idx on public.exam_sessions (user_id);
create index if not exists exam_sessions_created_at_idx on public.exam_sessions (created_at);
create index if not exists exam_sessions_course_id_idx on public.exam_sessions (course_id);

-- Exam answers
create table if not exists public.exam_answers (
  id text primary key,
  session_id text not null references public.exam_sessions(id) on delete cascade,
  question_id text references public.questions(id) on delete set null,
  question_order integer not null,
  user_answer jsonb not null default '[]'::jsonb,
  is_correct boolean
);

create index if not exists exam_answers_session_id_idx on public.exam_answers (session_id);

-- Keep profile in sync with new auth users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, first_name, last_name, role, created_at)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    'user',
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper: avoid RLS recursion when checking admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Fetch a random subset of questions for a course
create or replace function public.get_random_questions(
  course_id_input text,
  limit_count int
)
returns setof public.questions
language sql
stable
as $$
  select *
  from public.questions
  where course_id = course_id_input
  order by random()
  limit greatest(limit_count, 0);
$$;

grant execute on function public.get_random_questions(text, int) to anon, authenticated;

-- RLS
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.questions enable row level security;
alter table public.exam_sessions enable row level security;
alter table public.exam_answers enable row level security;

-- Profiles policies
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_select_all_admin"
  on public.profiles for select
  using (public.is_admin());

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

create policy "profiles_update_all_admin"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- Courses policies
create policy "courses_select_all"
  on public.courses for select
  using (true);

create policy "courses_insert_admin"
  on public.courses for insert
  with check (public.is_admin());

create policy "courses_update_admin"
  on public.courses for update
  using (public.is_admin());

create policy "courses_delete_admin"
  on public.courses for delete
  using (public.is_admin());

-- Questions policies
create policy "questions_select_own_or_global"
  on public.questions for select
  using (owner_id = auth.uid() or is_global = true);

create policy "questions_insert_own"
  on public.questions for insert
  with check (owner_id = auth.uid());

create policy "questions_update_own"
  on public.questions for update
  using (owner_id = auth.uid());

create policy "questions_delete_own"
  on public.questions for delete
  using (owner_id = auth.uid());

create policy "questions_insert_global_admin"
  on public.questions for insert
  with check (
    is_global = true and public.is_admin()
  );

create policy "questions_update_global_admin"
  on public.questions for update
  using (
    is_global = true and public.is_admin()
  );

create policy "questions_delete_global_admin"
  on public.questions for delete
  using (
    is_global = true and public.is_admin()
  );

-- Exam sessions policies
create policy "exam_sessions_select_own"
  on public.exam_sessions for select
  using (user_id = auth.uid());

create policy "exam_sessions_insert_own"
  on public.exam_sessions for insert
  with check (user_id = auth.uid());

-- Exam answers policies
create policy "exam_answers_select_own"
  on public.exam_answers for select
  using (
    exists (
      select 1 from public.exam_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "exam_answers_insert_own"
  on public.exam_answers for insert
  with check (
    exists (
      select 1 from public.exam_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );
