-- 0009 · 管理员「名字 + 码」双因子登录（防暴力破解）。
-- 管理员登录要：先输码 → 再输管理员名字，两者都对才放行。
-- 名字首次登录时设定，之后每次都要输对；系统不提示是码错还是名错。
-- 家人个人码登录不受影响（只输码）。

alter table public.access_codes add column if not exists admin_name text;

-- 管理员登录校验：码必须是有效管理码，且名字匹配（首次则设定）。
create or replace function public.admin_login(p_code text, p_name text)
returns boolean language plpgsql security definer set search_path = public as $$
declare rec record;
begin
  select * into rec from access_codes where code = p_code and is_admin and not revoked;
  if not found then return false; end if;          -- 不是有效管理码
  if rec.admin_name is null then
    update access_codes set admin_name = p_name where code = p_code; -- 首次：设定名字
    return true;
  end if;
  return rec.admin_name = p_name;                   -- 之后：必须输对
end; $$;

grant execute on function public.admin_login(text, text) to anon, authenticated;

-- 应用后：  notify pgrst, 'reload schema';
