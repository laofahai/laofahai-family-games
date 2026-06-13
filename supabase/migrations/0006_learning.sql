-- 0006 · 学习数据上云：错题本 + 成长统计跟着孩子换设备。
-- 按「6 位云端码」存：一个码 + 一个游戏（=一个孩子）对应一份整 blob（{stats, mistakes}）。
-- 与个人进度同步码同理：码即凭证，表锁 RLS 只走下面的 SECURITY DEFINER 函数。

create table if not exists public.learn (
  code        text not null,
  game        text not null,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (code, game)
);
alter table public.learn enable row level security;

-- 拉：凭码取这个码名下所有游戏的学习数据
create or replace function public.pull_learn(p_code text)
returns table(game text, data jsonb) language sql security definer set search_path = public as $$
  select l.game, l.data from learn l where l.code = p_code;
$$;

-- 推：凭码 upsert 某个游戏的整份学习 blob
create or replace function public.push_learn(p_code text, p_game text, p_data jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into learn (code, game, data, updated_at) values (p_code, p_game, p_data, now())
  on conflict (code, game) do update set data = excluded.data, updated_at = now();
  return true;
end; $$;

grant execute on function public.pull_learn(text) to anon, authenticated;
grant execute on function public.push_learn(text, text, jsonb) to anon, authenticated;

-- 应用后：  notify pgrst, 'reload schema';
