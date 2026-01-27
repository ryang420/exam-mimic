-- 重置 exam-mimic 的 public 结构（危险：会删除表与数据）
-- 使用场景：先执行本文件清空，再执行 supabase.sql 做一次「空库初始化」。

-- 1. 删除 RLS 策略（按表）
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_all_admin" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_all_admin" on public.profiles;

drop policy if exists "courses_select_all" on public.courses;
drop policy if exists "courses_insert_admin" on public.courses;
drop policy if exists "courses_update_admin" on public.courses;
drop policy if exists "courses_update_author" on public.courses;
drop policy if exists "courses_delete_admin" on public.courses;

drop policy if exists "questions_select_own_or_global" on public.questions;
drop policy if exists "questions_insert_own" on public.questions;
drop policy if exists "questions_update_own" on public.questions;
drop policy if exists "questions_delete_own" on public.questions;
drop policy if exists "questions_insert_global_admin" on public.questions;
drop policy if exists "questions_update_global_admin" on public.questions;
drop policy if exists "questions_delete_global_admin" on public.questions;

drop policy if exists "exam_sessions_select_own" on public.exam_sessions;
drop policy if exists "exam_sessions_select_all_admin" on public.exam_sessions;
drop policy if exists "exam_sessions_insert_own" on public.exam_sessions;

drop policy if exists "exam_answers_select_own" on public.exam_answers;
drop policy if exists "exam_answers_insert_own" on public.exam_answers;

-- 2. 删除触发器与函数
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.is_admin();
drop function if exists public.is_author();
drop function if exists public.get_random_questions(text, int);

-- 3. 按依赖顺序删表（子表 → 父表）
drop table if exists public.exam_answers;
drop table if exists public.exam_sessions;
drop table if exists public.questions;
drop table if exists public.courses;
drop table if exists public.profiles;
