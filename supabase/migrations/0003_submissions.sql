-- 0003 · 玩家私密提交：让每个玩家在自己设备上写「自己的」答案（猜的价格、投票等）。
-- 卧底里只有房主写 secret；这类游戏每个人都要写自己的提交，故加成员自写 + 房主汇总的 RPC。
--
-- 可见性：提交默认私密（room_snapshot 只回传调用者自己的 submission）；
-- 到了公布环节，由房主 collect_submissions 汇总、算结果、再用 host_set 写进公共 payload。

alter table public.room_members add column if not exists submission jsonb;

-- 成员写自己的提交（覆盖式）。只能写自己那行。
create or replace function public.member_submit(p_code text, p_token text, p_data jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update room_members set submission = p_data where code = p_code and token = p_token;
  if not found then return false; end if;
  update rooms set updated_at = now() where code = p_code;  -- 触发各端轮询感知“有人提交了”
  return true;
end; $$;

-- 房主汇总所有人的提交（用于算赢家/公布）。仅房主可调。
create or replace function public.collect_submissions(p_code text, p_host_token text)
returns table(seat int, name text, emoji text, submission jsonb)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from rooms where code = p_code and host_token = p_host_token) then
    raise exception 'not host';
  end if;
  return query select m.seat, m.name, m.emoji, m.submission from room_members m
    where m.code = p_code order by m.seat;
end; $$;

-- 房主清空所有人提交（开新一轮前）。仅房主可调。
create or replace function public.clear_submissions(p_code text, p_host_token text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from rooms where code = p_code and host_token = p_host_token) then
    raise exception 'not host';
  end if;
  update room_members set submission = null where code = p_code;
  update rooms set updated_at = now() where code = p_code;
  return true;
end; $$;

-- 快照加上「已提交人数」，让各端能显示进度（不泄露内容）。me 自带自己的 submission。
create or replace function public.room_snapshot(p_code text, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r rooms; me jsonb; members jsonb; submitted int;
begin
  select * into r from rooms where code = p_code;
  if r.code is null then return null; end if;
  select to_jsonb(m) - 'token' - 'code' from room_members m
    where m.code = p_code and m.token = p_token into me;
  select coalesce(jsonb_agg(
           jsonb_build_object('name', name, 'emoji', emoji, 'seat', seat, 'is_host', is_host)
           order by seat), '[]'::jsonb)
    into members from room_members where code = p_code;
  select count(*) into submitted from room_members where code = p_code and submission is not null;
  return jsonb_build_object(
    'state', r.state, 'game', r.game, 'payload', r.payload,
    'you', me, 'members', members, 'submittedCount', submitted, 'updated_at', r.updated_at);
end; $$;

grant execute on function public.member_submit(text, text, jsonb) to anon, authenticated;
grant execute on function public.collect_submissions(text, text) to anon, authenticated;
grant execute on function public.clear_submissions(text, text) to anon, authenticated;
