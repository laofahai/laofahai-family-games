-- 0007 · 个人码合一：让「个人码」也能用来解锁登录。
-- 一个码搞定：输个人码 → 解锁这台设备 + 认出是谁 + 进度/错题本跟着走。
-- 向后兼容：管理/家庭访问码（access_codes）照旧能解锁；个人码 = profiles.sync_code。

create or replace function public.redeem_login(p_code text)
returns table(valid boolean, is_admin boolean, is_person boolean, name text, emoji text)
language plpgsql security definer set search_path = public as $$
begin
  -- ① 访问码 / 管理码（access_codes）
  return query
    select true, ac.is_admin, false, null::text, null::text
    from access_codes ac where ac.code = p_code and not ac.revoked;
  if found then return; end if;

  -- ② 个人码（profiles.sync_code）—— 认出是谁，带回名字/头像
  return query
    select true, false, true, p.name, p.emoji
    from profiles p where p.sync_code = p_code;
  if found then return; end if;

  -- ③ 都不是
  return query select false, false, false, null::text, null::text;
end; $$;

grant execute on function public.redeem_login(text) to anon, authenticated;

-- 应用后：  notify pgrst, 'reload schema';
