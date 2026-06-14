-- 0010 · 人物入库：把家人/老师/同学落到 profiles（用户表），带 角色/性别/班级/元数据。
-- 理念：人和性别是「数据」，不再硬编码在代码里；游戏经 get_roster() 从库读。
--   · role     家人 family（可登录）/ 老师 teacher / 同学 classmate（无码=登录不进）
--   · gender   male/female（按名字判定一次后存库；游戏据此选男/女形象、配名字）
--   · class_id 班级（=「关系」分组键）：yiyi-class / shuner-class / family。升年级/分班只需改此字段+维护该班人员。
--   · meta     老师专用：科目/血量/机制 等
-- 「同学以后可能变玩家」：给某行加一个 sync_code 即可登录，无需迁移结构。

alter table public.profiles add column if not exists role     text not null default 'family';
alter table public.profiles add column if not exists gender   text;
alter table public.profiles add column if not exists class_id text;
alter table public.profiles add column if not exists meta     jsonb not null default '{}'::jsonb;

-- —— 家人（可登录；仅补 role/gender/class_id，不动已有 name/emoji/sync_code）——
insert into public.profiles (id, name, emoji, kind, role, gender, class_id) values
  ('dad',   '爸爸',   '👨‍💻', 'family', 'family', 'male',   'family'),
  ('mom',   '妈妈',   '🛍️', 'family', 'family', 'female', 'family'),
  ('yiyi',  '闫一依', '🎤', 'family', 'family', 'female', 'yiyi-class'),
  ('shuner','闫顺儿', '🎀', 'family', 'family', 'female', 'shuner-class')
on conflict (id) do update set role = excluded.role, gender = excluded.gender, class_id = excluded.class_id;

-- —— 老师（无码 = 登录不进；科目/血量在 meta）——
insert into public.profiles (id, name, emoji, kind, role, gender, class_id, meta) values
  ('zhang','张超越', '🧑‍🏫','guest','teacher','male',  'yiyi-class',  '{"subject":"english","hp":4}'),
  ('zheng','郑老师', '📐','guest','teacher','female','yiyi-class',  '{"subject":"math","hp":4}'),
  ('tai',  '台老师', '📖','guest','teacher','female','yiyi-class',  '{"subject":"chinese","hp":4}'),
  ('sci',  '科学老师','🔬','guest','teacher','male',  'yiyi-class',  '{"subject":"science","hp":4}'),
  ('zhu',  '朱老师', '🧮','guest','teacher','female','shuner-class','{"subject":"math","hp":3}'),
  ('chen', '陈老师', '📚','guest','teacher','female','shuner-class','{"subject":"chinese","hp":3}')
on conflict (id) do update set role = excluded.role, gender = excluded.gender, class_id = excluded.class_id, meta = excluded.meta;

-- —— 闫一依班 46 名同学（性别按名字判定）——
insert into public.profiles (id, name, kind, role, gender, class_id) values
  ('cm_y_01','傅美晴','guest','classmate','female','yiyi-class'),
  ('cm_y_02','李怡晓','guest','classmate','female','yiyi-class'),
  ('cm_y_03','杨茗皓','guest','classmate','male','yiyi-class'),
  ('cm_y_04','王苏畅','guest','classmate','male','yiyi-class'),
  ('cm_y_05','于嘉宁','guest','classmate','female','yiyi-class'),
  ('cm_y_06','刘语欣','guest','classmate','female','yiyi-class'),
  ('cm_y_07','李宣潼','guest','classmate','female','yiyi-class'),
  ('cm_y_08','王凯旋','guest','classmate','male','yiyi-class'),
  ('cm_y_09','韩雨桐','guest','classmate','female','yiyi-class'),
  ('cm_y_10','魏越凡','guest','classmate','male','yiyi-class'),
  ('cm_y_11','丁月淇','guest','classmate','female','yiyi-class'),
  ('cm_y_12','安韵涵','guest','classmate','female','yiyi-class'),
  ('cm_y_13','李嘉蓉','guest','classmate','female','yiyi-class'),
  ('cm_y_14','王梓润','guest','classmate','male','yiyi-class'),
  ('cm_y_15','赵宇轩','guest','classmate','male','yiyi-class'),
  ('cm_y_16','隋昊雨','guest','classmate','male','yiyi-class'),
  ('cm_y_17','崔皓然','guest','classmate','male','yiyi-class'),
  ('cm_y_18','李星谕','guest','classmate','male','yiyi-class'),
  ('cm_y_19','耿若涵','guest','classmate','female','yiyi-class'),
  ('cm_y_20','谢宇聪','guest','classmate','male','yiyi-class'),
  ('cm_y_21','郑辰宇','guest','classmate','male','yiyi-class'),
  ('cm_y_22','马铭骏','guest','classmate','male','yiyi-class'),
  ('cm_y_23','孟子轩','guest','classmate','male','yiyi-class'),
  ('cm_y_24','王梓哲','guest','classmate','male','yiyi-class'),
  ('cm_y_25','管清然','guest','classmate','female','yiyi-class'),
  ('cm_y_26','臧可悦','guest','classmate','female','yiyi-class'),
  ('cm_y_27','刘效含','guest','classmate','male','yiyi-class'),
  ('cm_y_28','李清澄','guest','classmate','female','yiyi-class'),
  ('cm_y_29','王晨菲','guest','classmate','female','yiyi-class'),
  ('cm_y_30','王柏润','guest','classmate','male','yiyi-class'),
  ('cm_y_31','肖雲凡','guest','classmate','male','yiyi-class'),
  ('cm_y_32','陈钰涵','guest','classmate','female','yiyi-class'),
  ('cm_y_33','何静茹','guest','classmate','female','yiyi-class'),
  ('cm_y_34','刘依含','guest','classmate','female','yiyi-class'),
  ('cm_y_35','隋佳骏','guest','classmate','male','yiyi-class'),
  ('cm_y_36','王瑞','guest','classmate','male','yiyi-class'),
  ('cm_y_37','范雨彤','guest','classmate','female','yiyi-class'),
  ('cm_y_38','马浩坤','guest','classmate','male','yiyi-class'),
  ('cm_y_39','周睿洋','guest','classmate','male','yiyi-class'),
  ('cm_y_40','张嘉桐','guest','classmate','female','yiyi-class'),
  ('cm_y_41','徐一嘉','guest','classmate','female','yiyi-class'),
  ('cm_y_42','曹凤越','guest','classmate','female','yiyi-class'),
  ('cm_y_43','程一馨','guest','classmate','female','yiyi-class'),
  ('cm_y_44','刘欣菲','guest','classmate','female','yiyi-class'),
  ('cm_y_45','张博轩','guest','classmate','male','yiyi-class'),
  ('cm_y_46','管瑾萱','guest','classmate','female','yiyi-class'),
  -- —— 闫顺儿班同学 ——
  ('cm_s_01','邸飞宇','guest','classmate','male','shuner-class'),
  ('cm_s_02','丁怡铭','guest','classmate','female','shuner-class'),
  ('cm_s_03','范晨宇','guest','classmate','male','shuner-class')
on conflict (id) do update set name = excluded.name, role = excluded.role, gender = excluded.gender, class_id = excluded.class_id;

-- —— 游戏读名册的公开 RPC（不含 sync_code 等敏感字段；security definer 绕过 RLS）——
create or replace function public.get_roster()
returns table(id text, name text, emoji text, role text, gender text, class_id text, meta jsonb)
language sql security definer set search_path = public stable as $$
  select id, name, emoji, role, gender, class_id, meta
  from public.profiles
  where role in ('family','teacher','classmate');
$$;
grant execute on function public.get_roster() to anon, authenticated;

-- 应用后让 PostgREST 重载 schema：
notify pgrst, 'reload schema';
