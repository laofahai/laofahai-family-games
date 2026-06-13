-- 家庭小游戏平台 · 基础表结构
-- 用法：Supabase Dashboard → SQL Editor → 新建查询 → 整段粘贴运行。
-- 全家共用一个登录账号；行级安全(RLS)保证：必须登录(authenticated)才能读写。

-- 玩家档案（家庭成员 + 朋友/其他人）
create table if not exists public.players (
  id          text primary key,
  name        text not null,
  emoji       text default '🙂',
  kind        text not null default 'guest',
  created_at  timestamptz not null default now()
);

-- 已见库：每个玩家、每个范围(scope) 记一组「玩过的内容 id」
create table if not exists public.seen (
  player_id   text not null,
  scope       text not null,
  item_ids    jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (player_id, scope)
);

-- 得分/进度历史（暂留，未来做进度页用）
create table if not exists public.scores (
  id          bigint generated always as identity primary key,
  player_id   text not null,
  game        text not null,
  score       integer,
  detail      jsonb,
  played_at   timestamptz not null default now()
);

-- 行级安全
alter table public.players enable row level security;
alter table public.seen    enable row level security;
alter table public.scores  enable row level security;

-- 已登录的家庭账号可读写全部数据（匿名公钥单独访问会被拒绝）
drop policy if exists "family all" on public.players;
drop policy if exists "family all" on public.seen;
drop policy if exists "family all" on public.scores;

create policy "family all" on public.players for all to authenticated using (true) with check (true);
create policy "family all" on public.seen    for all to authenticated using (true) with check (true);
create policy "family all" on public.scores  for all to authenticated using (true) with check (true);
