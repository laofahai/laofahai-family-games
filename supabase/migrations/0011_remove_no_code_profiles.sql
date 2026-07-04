-- 0011 · 清理无码用户。
-- 现在产品入口只保留能开房号的家庭游戏，不再需要老师/同学这类无码 profiles。
-- 这条迁移可重复执行：删除所有没有个人码的档案；seen 按 FK 级联，learn 只有有码时才有关联数据。

delete from public.profiles
where sync_code is null;

notify pgrst, 'reload schema';
