-- 0004 · 远程房间自动清理：没人正常退出的房间（关页面跑路）会留下垃圾行。
-- 不引入定时任务，改为「每次建房时顺手清掉很久没动静的旧房」。
-- updated_at 在 host_set / member_submit / clear_submissions 时都会刷新，
-- 所以活着的房不会被误删；闲置超过 6 小时的视为废弃，建新房时一并清掉（room_members 级联删除）。

create or replace function public.create_room(p_code text, p_host_token text, p_game text, p_name text, p_emoji text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  delete from rooms where updated_at < now() - interval '6 hours';  -- 顺手清废弃房
  insert into rooms (code, game, host_token) values (p_code, p_game, p_host_token);
  insert into room_members (code, token, name, emoji, seat, is_host)
    values (p_code, p_host_token, coalesce(p_name, '房主'), coalesce(p_emoji, '🙂'), 1, true);
  return true;
exception when unique_violation then
  return false;  -- 房号撞了，客户端换号重试
end; $$;
