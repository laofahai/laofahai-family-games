-- 0002 · 远程协作房间：各自在自己的设备上，只看到「自己的」秘密（卧底词/身份等）
--
-- 模型：
--  · rooms 房间：短数字房号 + 房主令牌(host_token) + 公共状态/payload。
--  · room_members 成员：每人一个私密令牌(token, 设备本地生成不外传) + 私密 secret(只有本人能取)。
--  · 两张表对公钥锁死，只能走下面的 SECURITY DEFINER 函数；房号可分享，令牌不分享。
--  · 隐私要点：room_snapshot 只回传「调用者自己」的 secret，成员列表只含公开字段(名字/座位/是否房主)。

create table if not exists public.rooms (
  code        text primary key,
  game        text not null,
  host_token  text not null,
  state       text not null default 'lobby',     -- lobby | playing | reveal | done
  payload     jsonb not null default '{}'::jsonb, -- 公共状态（房主下发，人人可见）
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table if not exists public.room_members (
  code        text not null references public.rooms(code) on delete cascade,
  token       text not null,                       -- 私密：设备本地令牌，标识“我是谁”
  name        text not null,
  emoji       text default '🙂',
  seat        int not null,
  is_host     boolean not null default false,
  secret      jsonb,                               -- 私密：只有本人 token 能取回
  joined_at   timestamptz not null default now(),
  primary key (code, token)
);
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;

-- 建房：建房 + 房主作为 1 号成员。房号撞了返回 false 让客户端换号重试。
create or replace function public.create_room(p_code text, p_host_token text, p_game text, p_name text, p_emoji text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into rooms (code, game, host_token) values (p_code, p_game, p_host_token);
  insert into room_members (code, token, name, emoji, seat, is_host)
    values (p_code, p_host_token, coalesce(p_name, '房主'), coalesce(p_emoji, '🙂'), 1, true);
  return true;
exception when unique_violation then
  return false;
end; $$;

-- 加入：大厅期人人可加入；已开局只允许“老成员重连”，不放新人进来。返回座位号，错误返回负数。
create or replace function public.join_room(p_code text, p_token text, p_name text, p_emoji text)
returns int language plpgsql security definer set search_path = public as $$
declare s int; st text;
begin
  select state into st from rooms where code = p_code;
  if st is null then return -1; end if;                       -- 房不存在
  if st <> 'lobby' and not exists (select 1 from room_members where code = p_code and token = p_token) then
    return -2;                                                -- 已开局，谢绝新人
  end if;
  if exists (select 1 from room_members where code = p_code and token = p_token) then
    update room_members set name = coalesce(p_name, name), emoji = coalesce(p_emoji, emoji)
      where code = p_code and token = p_token returning seat into s;
    return s;                                                 -- 重连
  end if;
  select coalesce(max(seat), 0) + 1 into s from room_members where code = p_code;
  insert into room_members (code, token, name, emoji, seat)
    values (p_code, p_token, coalesce(p_name, '玩家'), coalesce(p_emoji, '🙂'), s);
  return s;
end; $$;

-- 房主更新：改状态 + 公共 payload + 可选地给每人下发私密 secret(jsonb: { token: secret })。
create or replace function public.host_set(p_code text, p_host_token text, p_state text, p_payload jsonb, p_secrets jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare k text; v jsonb;
begin
  if not exists (select 1 from rooms where code = p_code and host_token = p_host_token) then
    raise exception 'not host';
  end if;
  update rooms set state = coalesce(p_state, state), payload = coalesce(p_payload, payload), updated_at = now()
    where code = p_code;
  if p_secrets is not null then
    for k, v in select * from jsonb_each(p_secrets) loop
      update room_members set secret = v where code = p_code and token = k;
    end loop;
  end if;
  return true;
end; $$;

-- 快照：一次取回 状态 + 公共 payload + 我自己的 secret + 成员公开列表(不含他人 secret)。
create or replace function public.room_snapshot(p_code text, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r rooms; me jsonb; members jsonb;
begin
  select * into r from rooms where code = p_code;
  if r.code is null then return null; end if;
  select to_jsonb(m) - 'token' - 'code' from room_members m
    where m.code = p_code and m.token = p_token into me;       -- 含“我自己”的 secret，去掉令牌
  select coalesce(jsonb_agg(
           jsonb_build_object('name', name, 'emoji', emoji, 'seat', seat, 'is_host', is_host)
           order by seat), '[]'::jsonb)
    into members from room_members where code = p_code;         -- 公开字段，绝不含他人 secret
  return jsonb_build_object(
    'state', r.state, 'game', r.game, 'payload', r.payload,
    'you', me, 'members', members, 'updated_at', r.updated_at);
end; $$;

-- 退出：成员离开；房主离开则连房带人一起销毁。
create or replace function public.leave_room(p_code text, p_token text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  delete from room_members where code = p_code and token = p_token;
  delete from rooms where code = p_code and host_token = p_token;
  return true;
end; $$;

grant execute on function public.create_room(text, text, text, text, text) to anon, authenticated;
grant execute on function public.join_room(text, text, text, text) to anon, authenticated;
grant execute on function public.host_set(text, text, text, jsonb, jsonb) to anon, authenticated;
grant execute on function public.room_snapshot(text, text) to anon, authenticated;
grant execute on function public.leave_room(text, text) to anon, authenticated;
