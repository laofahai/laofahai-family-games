-- 0012 · 按需读取内容库，避免首页一次拉全量题库。
-- get_all_content 保留给管理/兼容；前端游戏入口改用 get_content(text[])。

create or replace function public.get_content(p_games text[])
returns table(game text, data jsonb, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select g.game, g.data, g.updated_at
  from game_content g
  where g.game = any(p_games)
  order by g.game;
$$;

grant execute on function public.get_content(text[]) to anon, authenticated;

notify pgrst, 'reload schema';
