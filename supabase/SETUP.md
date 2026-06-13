# 云端启用步骤（Supabase）

应用默认**纯本地、零门槛**就能玩。下面这些只在你想开启「设备解锁 + 管理员发码 + 跨设备同步」时才需要。

## 1. 建表 + 函数
Supabase Dashboard → **SQL Editor** → 把 `migrations/0001_init.sql` 整段粘贴运行。

## 2. 改掉种子管理员码
运行后 `access_codes` 里有一条 `CHANGE-ME-ADMIN`。改成你自己的：
```sql
update access_codes set code = '你的私密管理员码' where code = 'CHANGE-ME-ADMIN';
```
这个码用来在你自己设备上解锁并进入「管理」面板发码。

## 3. 前端环境变量
本地开发：`.env.local`（已就绪，含公开的 URL + anon key）。
线上部署（GitHub Pages）：在仓库 **Settings → Secrets → Actions** 加
`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`，并在 deploy 工作流构建步骤注入，
否则线上构建拿不到密钥、云端功能自动降级为本地模式。

## 模型速览
- **识别码 access_codes**：一次性「解锁这台设备」。`is_admin` 的码能进管理面板。
- **管理员**：用 admin 码解锁后，可 `生成 / 列出 / 吊销` 邀请码发给亲友。
- **个人同步码 sync_code（可选）**：谁想让进度跨设备跟人走，再领/输一个。
- 两张数据表对公钥**锁死**，只能凭码走 RPC 读写——公钥泄露也读不到库。

## 安全说明
identifier/sync code 即凭证：拿到 admin 码的人能发码、拿到某人 sync code 的人能看那人进度。
对「家庭游戏进度」这种低敏感数据，这是为零门槛体验做的取舍；要更严可日后升级真鉴权。
