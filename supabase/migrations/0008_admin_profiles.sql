-- 0008 · 管理员查看/找回家人的「个人码」。
-- 痛点：家人忘了自己的个人码（profiles.sync_code），此前 UI 查不到只能翻库。
-- 这里加两个管理员凭码（access_codes.is_admin）才能调的 RPC：列出 + 重置。
-- 注意：个人码 = 登录凭证，函数严格 admin-gated，匿名公钥不能直读 profiles 表。

-- 列出全部个人档案（含个人码）——仅管理员
create or replace function public.admin_list_profiles(p_admin_code text)
returns table(id text, name text, emoji text, kind text, sync_code text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from access_codes a where a.code = p_admin_code and a.is_admin and not a.revoked) then
    raise exception 'not an admin';
  end if;
  return query
    select p.id, p.name, p.emoji, p.kind, p.sync_code, p.created_at
    from profiles p order by p.created_at;
end; $$;

-- 把某人的个人码重置成新码（忘码/想换好记的）——仅管理员。
-- 新码不能与他人冲突；顺手把该码名下的学习/勋章数据(learn 表按 code 存)迁到新码，避免断档。
create or replace function public.admin_reset_profile_code(p_admin_code text, p_id text, p_new_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare old_code text;
begin
  if not exists (select 1 from access_codes a where a.code = p_admin_code and a.is_admin and not a.revoked) then
    raise exception 'not an admin';
  end if;
  if exists (select 1 from profiles where sync_code = p_new_code and id <> p_id) then
    raise exception 'code taken';
  end if;

  select sync_code into old_code from profiles where id = p_id;
  update profiles set sync_code = p_new_code where id = p_id;
  if not found then raise exception 'no such profile'; end if;

  -- 迁移 learn 表里这个码名下的行（跳过会撞主键的，极少见）
  if old_code is not null and old_code <> p_new_code then
    update learn l set code = p_new_code
    where l.code = old_code
      and not exists (select 1 from learn x where x.code = p_new_code and x.game = l.game);
  end if;
  return true;
end; $$;

-- 删除某个档案（连同 TA 的进度/错题本/勋章）——仅管理员。
create or replace function public.admin_delete_profile(p_admin_code text, p_id text)
returns boolean language plpgsql security definer set search_path = public as $$
declare old_code text;
begin
  if not exists (select 1 from access_codes a where a.code = p_admin_code and a.is_admin and not a.revoked) then
    raise exception 'not an admin';
  end if;
  select sync_code into old_code from profiles where id = p_id;
  delete from profiles where id = p_id; -- seen 表按 FK 级联删除
  if old_code is not null then
    delete from learn where code = old_code; -- 错题本/统计/勋章
  end if;
  return true;
end; $$;

grant execute on function public.admin_list_profiles(text) to anon, authenticated;
grant execute on function public.admin_reset_profile_code(text, text, text) to anon, authenticated;
grant execute on function public.admin_delete_profile(text, text) to anon, authenticated;

-- 应用后：  notify pgrst, 'reload schema';
