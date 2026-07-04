-- 0013 · 允许“个人码同时是管理员码”。
-- 目标：日常只输自己的个人码；如果同码在 access_codes 里标记 is_admin，
-- 就以这个人的身份进入，同时获得管理邀请码/人员码权限。

create or replace function public.redeem_login(p_code text)
returns table(valid boolean, is_admin boolean, is_person boolean, name text, emoji text)
language plpgsql security definer set search_path = public as $$
begin
  -- ① 个人码优先：认出是谁；若同码也是有效管理员码，则同时给管理权限。
  return query
    select
      true,
      exists (
        select 1
        from access_codes ac
        where ac.code = p_code and ac.is_admin and not ac.revoked
      ) as is_admin,
      true,
      p.name,
      p.emoji
    from profiles p
    where p.sync_code = p_code;
  if found then return; end if;

  -- ② 非个人的访问码 / 纯管理码：仍按旧逻辑。
  return query
    select true, ac.is_admin, false, null::text, null::text
    from access_codes ac
    where ac.code = p_code and not ac.revoked;
  if found then return; end if;

  -- ③ 都不是。
  return query select false, false, false, null::text, null::text;
end; $$;

grant execute on function public.redeem_login(text) to anon, authenticated;

notify pgrst, 'reload schema';
