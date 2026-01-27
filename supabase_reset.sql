-- DANGER: Destructive reset for exam-mimic schema
-- Run before supabase.sql if you want a clean slate.

-- Drop policies (if they exist)
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_all_admin" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_all_admin" on public.profiles;

drop policy if exists "courses_select_all" on public.courses;
drop policy if exists "courses_insert_admin" on public.courses;
drop policy if exists "courses_update_admin" on public.courses;
drop policy if exists "courses_delete_admin" on public.courses;

drop policy if exists "questions_select_own_or_global" on public.questions;
drop policy if exists "questions_insert_own" on public.questions;
drop policy if exists "questions_update_own" on public.questions;
drop policy if exists "questions_delete_own" on public.questions;
drop policy if exists "questions_insert_global_admin" on public.questions;
drop policy if exists "questions_update_global_admin" on public.questions;
drop policy if exists "questions_delete_global_admin" on public.questions;

drop policy if exists "exam_sessions_select_own" on public.exam_sessions;
drop policy if exists "exam_sessions_insert_own" on public.exam_sessions;

drop policy if exists "exam_answers_select_own" on public.exam_answers;
drop policy if exists "exam_answers_insert_own" on public.exam_answers;

-- Drop triggers and functions
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.is_admin();

-- Drop tables in dependency order
drop table if exists public.exam_answers;
drop table if exists public.exam_sessions;
drop table if exists public.questions;
drop table if exists public.courses;
drop table if exists public.profiles;
