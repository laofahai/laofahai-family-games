-- 0005 · 游戏内容库搬上云：题库 / 词库 / 卡片从代码里搬进数据库。
-- 目标：不改代码就能加题改题——管理员（或 AI）改数据库，App 下次启动即可见。
-- 机制：
--  · game_content 一行存一个内容库（game 为键，data 为整个数组的 jsonb）。
--  · 读：匿名公钥可调 get_all_content 一次拉全部（启动时缓存到 localStorage，离线回退代码里的打包副本）。
--  · 写：仅管理员凭码可 upsert / delete（与 access_codes 的 is_admin 一致）。
--  · 表本身锁死 RLS，公钥只能走下面的 SECURITY DEFINER 函数。

create table if not exists public.game_content (
  game        text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);
alter table public.game_content enable row level security;

-- 读：任何人（匿名公钥）一次拉全部内容
create or replace function public.get_all_content()
returns table(game text, data jsonb, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select g.game, g.data, g.updated_at from game_content g;
$$;

-- 写：管理员凭码 upsert 一整个内容库（整数组替换）
create or replace function public.upsert_content(p_admin_code text, p_game text, p_data jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from access_codes where code = p_admin_code and is_admin and not revoked) then
    raise exception 'not an admin';
  end if;
  insert into game_content (game, data, updated_at) values (p_game, p_data, now())
  on conflict (game) do update set data = excluded.data, updated_at = now();
  return true;
end; $$;

-- 删：管理员凭码删一个内容库
create or replace function public.delete_content(p_admin_code text, p_game text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from access_codes where code = p_admin_code and is_admin and not revoked) then
    raise exception 'not an admin';
  end if;
  delete from game_content where game = p_game;
  return true;
end; $$;

-- ── 授权：匿名公钥只能调这些函数，不能直读表 ──────────────────────────
grant execute on function public.get_all_content() to anon, authenticated;
grant execute on function public.upsert_content(text, text, jsonb) to anon, authenticated;
grant execute on function public.delete_content(text, text) to anon, authenticated;

-- 应用后记得让 PostgREST 重载：  notify pgrst, 'reload schema';
