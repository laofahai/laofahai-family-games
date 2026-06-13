-- 家庭小游戏平台 · 访问码(邀请/管理员) + 个人同步码 模型
-- 用法：Supabase Dashboard → SQL Editor → 整段运行。运行后请改掉下方种子管理员码。
--
-- 模型：
--  · access_codes 识别码：一次性「设备解锁」用。可标记 is_admin。管理员可签发/吊销码。
--  · profiles 玩家档案 + sync_code：可选的跨设备同步凭证（个人）。
--  · 两张数据表对匿名公钥完全锁死，只能通过下面的 SECURITY DEFINER 函数、凭码读写。

-- ── 访问码（设备解锁 / 邀请 / 管理员）────────────────────────────────
create table if not exists public.access_codes (
  code        text primary key,
  is_admin    boolean not null default false,
  label       text,
  revoked     boolean not null default false,
  created_by  text,
  created_at  timestamptz not null default now()
);
alter table public.access_codes enable row level security;

-- 校验识别码（解锁设备时调用）：返回是否有效、是否管理员
create or replace function public.redeem_code(p_code text)
returns table(valid boolean, is_admin boolean) language plpgsql security definer set search_path = public as $$
begin
  return query select true, ac.is_admin from access_codes ac where ac.code = p_code and not ac.revoked;
  if not found then return query select false, false; end if;
end; $$;

-- 管理员签发新识别码（需有效 admin 码）
create or replace function public.mint_code(p_admin_code text, p_new_code text, p_label text, p_is_admin boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from access_codes where code = p_admin_code and is_admin and not revoked) then
    raise exception 'not an admin';
  end if;
  insert into access_codes (code, is_admin, label, created_by)
  values (p_new_code, coalesce(p_is_admin, false), p_label, p_admin_code)
  on conflict (code) do nothing;
  return true;
end; $$;

-- 管理员列出全部码
create or replace function public.list_codes(p_admin_code text)
returns table(code text, is_admin boolean, label text, revoked boolean, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from access_codes where code = p_admin_code and is_admin and not revoked) then
    raise exception 'not an admin';
  end if;
  return query select ac.code, ac.is_admin, ac.label, ac.revoked, ac.created_at from access_codes ac order by ac.created_at desc;
end; $$;

-- 管理员吊销/恢复一个码
create or replace function public.set_code_revoked(p_admin_code text, p_code text, p_revoked boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from access_codes where code = p_admin_code and is_admin and not revoked) then
    raise exception 'not an admin';
  end if;
  update access_codes set revoked = p_revoked where code = p_code;
  return true;
end; $$;

-- ── 玩家档案 + 个人同步 ─────────────────────────────────────────────
create table if not exists public.profiles (
  id          text primary key,
  name        text not null,
  emoji       text default '🙂',
  kind        text not null default 'guest',
  sync_code   text unique,
  created_at  timestamptz not null default now()
);
create table if not exists public.seen (
  profile_id  text not null references public.profiles(id) on delete cascade,
  scope       text not null,
  item_ids    jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (profile_id, scope)
);
alter table public.profiles enable row level security;
alter table public.seen enable row level security;

create or replace function public.claim_profile(p_code text, p_name text, p_emoji text, p_kind text)
returns text language plpgsql security definer set search_path = public as $$
declare existing text;
begin
  select id into existing from profiles where sync_code = p_code;
  if existing is not null then
    update profiles set name = coalesce(p_name, name), emoji = coalesce(p_emoji, emoji) where id = existing;
    return existing;
  end if;
  insert into profiles (id, name, emoji, kind, sync_code)
  values (gen_random_uuid()::text, coalesce(p_name, '玩家'), coalesce(p_emoji, '🙂'), coalesce(p_kind, 'guest'), p_code)
  returning id into existing;
  return existing;
end; $$;

create or replace function public.pull_seen(p_code text)
returns table(scope text, item_ids jsonb) language plpgsql security definer set search_path = public as $$
begin
  return query select s.scope, s.item_ids from seen s join profiles p on p.id = s.profile_id where p.sync_code = p_code;
end; $$;

create or replace function public.push_seen(p_code text, p_scope text, p_item_ids jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare pid text;
begin
  select id into pid from profiles where sync_code = p_code;
  if pid is null then raise exception 'unknown sync code'; end if;
  insert into seen (profile_id, scope, item_ids, updated_at)
  values (pid, p_scope, p_item_ids, now())
  on conflict (profile_id, scope) do update set item_ids = excluded.item_ids, updated_at = now();
end; $$;

-- ── 授权：匿名公钥只能调这些函数，不能直读表 ──────────────────────────
grant execute on function public.redeem_code(text) to anon, authenticated;
grant execute on function public.mint_code(text, text, text, boolean) to anon, authenticated;
grant execute on function public.list_codes(text) to anon, authenticated;
grant execute on function public.set_code_revoked(text, text, boolean) to anon, authenticated;
grant execute on function public.claim_profile(text, text, text, text) to anon, authenticated;
grant execute on function public.pull_seen(text) to anon, authenticated;
grant execute on function public.push_seen(text, text, jsonb) to anon, authenticated;

-- ── 种子：第一个管理员码（务必改成你自己的）────────────────────────
insert into public.access_codes (code, is_admin, label) values ('CHANGE-ME-ADMIN', true, '主管理员')
on conflict (code) do nothing;
