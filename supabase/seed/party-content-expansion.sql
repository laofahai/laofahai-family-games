begin;

insert into public.game_content (game, data, updated_at)
values
  ('charades', '[]'::jsonb, now()),
  ('draw', '[]'::jsonb, now())
on conflict (game) do nothing;

with additions(data) as (
  values (
    $party_charades$[
      {"text": "刷牙刷到满嘴泡泡", "difficulty": "easy"},
      {"text": "穿袜子找不到脚后跟", "difficulty": "easy"},
      {"text": "吃到烫嘴的汤圆", "difficulty": "easy"},
      {"text": "打喷嚏停不下来", "difficulty": "easy"},
      {"text": "被蚊子咬了挠痒痒", "difficulty": "easy"},
      {"text": "吹生日蜡烛", "difficulty": "easy"},
      {"text": "抱着枕头睡觉", "difficulty": "easy"},
      {"text": "用望远镜看远处", "difficulty": "easy"},
      {"text": "背着书包赶校车", "difficulty": "easy"},
      {"text": "下雨天踩水坑", "difficulty": "easy"},
      {"text": "吃西瓜吐籽", "difficulty": "easy"},
      {"text": "给气球打气", "difficulty": "easy"},
      {"text": "骑滑板车", "difficulty": "easy"},
      {"text": "戴帽子照镜子", "difficulty": "easy"},
      {"text": "开门发现惊喜", "difficulty": "easy"},
      {"text": "捡到一枚硬币", "difficulty": "easy"},
      {"text": "排队买冰淇淋", "difficulty": "easy"},
      {"text": "洗手甩水", "difficulty": "easy"},
      {"text": "晾衣服夹夹子", "difficulty": "easy"},
      {"text": "举手回答问题", "difficulty": "easy"},
      {"text": "跳房子", "difficulty": "easy"},
      {"text": "用吸管喝饮料", "difficulty": "easy"},
      {"text": "拆礼物包装", "difficulty": "easy"},
      {"text": "拍照摆姿势", "difficulty": "easy"},
      {"text": "被太阳晒得眯眼", "difficulty": "easy"},
      {"text": "端着一碗热面", "difficulty": "easy"},
      {"text": "摸黑找开关", "difficulty": "easy"},
      {"text": "给小树浇水", "difficulty": "easy"},
      {"text": "戴口罩打哈欠", "difficulty": "easy"},
      {"text": "踩到玩具积木", "difficulty": "easy"},
      {"text": "偷偷打开零食袋", "difficulty": "medium"},
      {"text": "坐过山车冲下坡", "difficulty": "medium"},
      {"text": "被风吹乱发型", "difficulty": "medium"},
      {"text": "在电梯里按错楼层", "difficulty": "medium"},
      {"text": "端盘子穿过人群", "difficulty": "medium"},
      {"text": "给不会动的遥控器换电池", "difficulty": "medium"},
      {"text": "装作雕像被逗笑", "difficulty": "medium"},
      {"text": "一边跳绳一边数数", "difficulty": "medium"},
      {"text": "用筷子夹滑溜溜的丸子", "difficulty": "medium"},
      {"text": "在镜子前练习演讲", "difficulty": "medium"},
      {"text": "发现鞋底粘了口香糖", "difficulty": "medium"},
      {"text": "抱着一摞书走路", "difficulty": "medium"},
      {"text": "在沙滩上堆城堡", "difficulty": "medium"},
      {"text": "照顾一盆快枯的花", "difficulty": "medium"},
      {"text": "给自行车轮胎打气", "difficulty": "medium"},
      {"text": "听到门铃却找不到拖鞋", "difficulty": "medium"},
      {"text": "模仿机器人没电", "difficulty": "medium"},
      {"text": "被静电电到手指", "difficulty": "medium"},
      {"text": "在公交车上站不稳", "difficulty": "medium"},
      {"text": "戴耳机听错歌词", "difficulty": "medium"},
      {"text": "偷偷量自己的身高", "difficulty": "medium"},
      {"text": "看牙医前很紧张", "difficulty": "medium"},
      {"text": "给蛋糕挤奶油花", "difficulty": "medium"},
      {"text": "用放大镜观察小虫", "difficulty": "medium"},
      {"text": "把衣服穿反了还没发现", "difficulty": "medium"},
      {"text": "假装在太空慢慢走", "difficulty": "medium"},
      {"text": "在厨房翻找锅盖", "difficulty": "medium"},
      {"text": "给别人偷偷准备惊喜", "difficulty": "medium"},
      {"text": "用扇子给全家扇风", "difficulty": "medium"},
      {"text": "坐旋转木马挥手", "difficulty": "medium"},
      {"text": "变成漏气的气球", "difficulty": "hard"},
      {"text": "指挥一支看不见的乐队", "difficulty": "hard"},
      {"text": "在冰面上小心滑行", "difficulty": "hard"},
      {"text": "扮演慢动作武打片", "difficulty": "hard"},
      {"text": "假装自己是自动售货机", "difficulty": "hard"},
      {"text": "在大风里撑坏雨伞", "difficulty": "hard"},
      {"text": "当一台卡纸的打印机", "difficulty": "hard"},
      {"text": "变成正在融化的雪人", "difficulty": "hard"},
      {"text": "假装被隐形绳子拉走", "difficulty": "hard"},
      {"text": "在迷宫里找出口", "difficulty": "hard"},
      {"text": "模仿一只骄傲的孔雀开屏", "difficulty": "hard"},
      {"text": "当一颗爆开的爆米花", "difficulty": "hard"},
      {"text": "被魔法变成小木偶", "difficulty": "hard"},
      {"text": "在舞台上忘记台词", "difficulty": "hard"},
      {"text": "用身体表演天气预报", "difficulty": "hard"},
      {"text": "假装自己是会走路的冰箱", "difficulty": "hard"},
      {"text": "在海底和鱼群打招呼", "difficulty": "hard"},
      {"text": "当一个迷路的快递员", "difficulty": "hard"},
      {"text": "变成正在加载的电脑", "difficulty": "hard"},
      {"text": "在博物馆里偷偷模仿雕像", "difficulty": "hard"},
      {"text": "假装开一辆看不见的消防车", "difficulty": "hard"},
      {"text": "当一只学走路的小企鹅", "difficulty": "hard"},
      {"text": "被巨大的磁铁吸过去", "difficulty": "hard"},
      {"text": "用身体拼出一座桥", "difficulty": "hard"},
      {"text": "假装坐在失控的旋转椅上", "difficulty": "hard"},
      {"text": "当一台忙不过来的洗衣机", "difficulty": "hard"},
      {"text": "在太空舱里抓漂浮的饼干", "difficulty": "hard"},
      {"text": "假装被泡泡包围", "difficulty": "hard"},
      {"text": "表演一场无声的拔河比赛", "difficulty": "hard"},
      {"text": "当一根被煮软的面条", "difficulty": "hard"}
    ]$party_charades$::jsonb
  )
),
expanded as (
  select item, 0 as source_order, ordinality as item_order
  from public.game_content gc
  cross join lateral jsonb_array_elements(gc.data) with ordinality as existing(item, ordinality)
  where gc.game = 'charades'
  union all
  select item, 1 as source_order, ordinality as item_order
  from additions
  cross join lateral jsonb_array_elements(additions.data) with ordinality as added(item, ordinality)
),
deduped as (
  select distinct on (item->>'text') item, source_order, item_order
  from expanded
  order by item->>'text', source_order, item_order
),
merged as (
  select coalesce(jsonb_agg(item order by source_order, item_order), '[]'::jsonb) as data
  from deduped
)
update public.game_content gc
set data = merged.data,
    updated_at = now()
from merged
where gc.game = 'charades';

with additions(data) as (
  values (
    $party_draw$[
      {"text": "儿童雨披", "hint": "雨天用品", "difficulty": "easy"},
      {"text": "小板凳", "hint": "家具", "difficulty": "easy"},
      {"text": "彩虹棉花糖串", "hint": "甜食", "difficulty": "easy"},
      {"text": "风筝线轴", "hint": "放风筝用", "difficulty": "easy"},
      {"text": "铅笔盒", "hint": "学习用品", "difficulty": "easy"},
      {"text": "游泳圈", "hint": "水上用品", "difficulty": "easy"},
      {"text": "纸船", "hint": "折纸", "difficulty": "easy"},
      {"text": "运动水瓶", "hint": "日用品", "difficulty": "easy"},
      {"text": "小熊拖鞋", "hint": "鞋子", "difficulty": "easy"},
      {"text": "围裙", "hint": "厨房用品", "difficulty": "easy"},
      {"text": "奶瓶", "hint": "婴儿用品", "difficulty": "easy"},
      {"text": "烤鸡腿盘", "hint": "食物", "difficulty": "easy"},
      {"text": "爱心煎蛋", "hint": "食物", "difficulty": "easy"},
      {"text": "玉米棒", "hint": "食物", "difficulty": "easy"},
      {"text": "草帽", "hint": "帽子", "difficulty": "easy"},
      {"text": "铃铛", "hint": "会响的东西", "difficulty": "easy"},
      {"text": "小药箱", "hint": "家用物品", "difficulty": "easy"},
      {"text": "购物篮", "hint": "购物用品", "difficulty": "easy"},
      {"text": "小扫把簸箕", "hint": "清洁工具", "difficulty": "easy"},
      {"text": "晾衣架", "hint": "家务用品", "difficulty": "easy"},
      {"text": "门牌号", "hint": "房子外面", "difficulty": "easy"},
      {"text": "相框", "hint": "装照片", "difficulty": "easy"},
      {"text": "牙杯", "hint": "洗漱用品", "difficulty": "easy"},
      {"text": "条纹围巾", "hint": "保暖用品", "difficulty": "easy"},
      {"text": "爱心信封", "hint": "寄信", "difficulty": "easy"},
      {"text": "行人信号灯", "hint": "交通", "difficulty": "easy"},
      {"text": "公交站牌", "hint": "交通", "difficulty": "easy"},
      {"text": "秋千", "hint": "游乐设施", "difficulty": "easy"},
      {"text": "滑梯", "hint": "游乐设施", "difficulty": "easy"},
      {"text": "沙桶", "hint": "沙滩玩具", "difficulty": "easy"},
      {"text": "小铲子", "hint": "工具", "difficulty": "easy"},
      {"text": "猫窝", "hint": "宠物用品", "difficulty": "easy"},
      {"text": "狗骨头", "hint": "宠物食物", "difficulty": "easy"},
      {"text": "鱼缸", "hint": "养鱼", "difficulty": "easy"},
      {"text": "鸟笼", "hint": "养鸟", "difficulty": "easy"},
      {"text": "树桩", "hint": "自然", "difficulty": "easy"},
      {"text": "蘑菇屋", "hint": "童话房子", "difficulty": "easy"},
      {"text": "星星贴纸", "hint": "装饰", "difficulty": "easy"},
      {"text": "彩色袜子", "hint": "衣物", "difficulty": "easy"},
      {"text": "冰棒", "hint": "夏天零食", "difficulty": "easy"},
      {"text": "旋转木马", "hint": "游乐园", "difficulty": "medium"},
      {"text": "爆米花桶", "hint": "电影院", "difficulty": "medium"},
      {"text": "帐篷营地", "hint": "户外活动", "difficulty": "medium"},
      {"text": "登山背包", "hint": "户外装备", "difficulty": "medium"},
      {"text": "海盗帽", "hint": "角色装扮", "difficulty": "medium"},
      {"text": "魔术礼帽", "hint": "表演道具", "difficulty": "medium"},
      {"text": "木马摇椅", "hint": "玩具家具", "difficulty": "medium"},
      {"text": "木头雪橇", "hint": "雪地交通", "difficulty": "medium"},
      {"text": "救生圈", "hint": "安全用品", "difficulty": "medium"},
      {"text": "消防水管", "hint": "消防工具", "difficulty": "medium"},
      {"text": "邮筒", "hint": "寄信地点", "difficulty": "medium"},
      {"text": "路障锥", "hint": "交通工具", "difficulty": "medium"},
      {"text": "冰淇淋车", "hint": "移动小店", "difficulty": "medium"},
      {"text": "热气球篮子", "hint": "空中旅行", "difficulty": "medium"},
      {"text": "潜水面罩", "hint": "水下装备", "difficulty": "medium"},
      {"text": "贝壳项链", "hint": "海边饰品", "difficulty": "medium"},
      {"text": "纸灯笼", "hint": "节日装饰", "difficulty": "medium"},
      {"text": "月饼盒", "hint": "节日食品包装", "difficulty": "medium"},
      {"text": "饺子盘", "hint": "家庭餐桌", "difficulty": "medium"},
      {"text": "汤勺", "hint": "餐具", "difficulty": "medium"},
      {"text": "烤串架", "hint": "烧烤用品", "difficulty": "medium"},
      {"text": "奶茶杯", "hint": "饮料", "difficulty": "medium"},
      {"text": "外卖袋", "hint": "送餐", "difficulty": "medium"},
      {"text": "快递箱", "hint": "包裹", "difficulty": "medium"},
      {"text": "密码锁", "hint": "安全用品", "difficulty": "medium"},
      {"text": "手电筒光束", "hint": "夜晚照明", "difficulty": "medium"},
      {"text": "闹钟铃声", "hint": "早起提醒", "difficulty": "medium"},
      {"text": "云朵雨滴", "hint": "天气", "difficulty": "medium"},
      {"text": "彩虹桥", "hint": "天空景象", "difficulty": "medium"},
      {"text": "雪人围巾", "hint": "冬天", "difficulty": "medium"},
      {"text": "树屋梯子", "hint": "户外小屋", "difficulty": "medium"},
      {"text": "花园喷壶", "hint": "园艺", "difficulty": "medium"},
      {"text": "蜂蜜罐", "hint": "甜味食物", "difficulty": "medium"},
      {"text": "蚂蚁队伍", "hint": "小昆虫", "difficulty": "medium"},
      {"text": "蜗牛赛道", "hint": "慢慢爬", "difficulty": "medium"},
      {"text": "松果篮", "hint": "森林物品", "difficulty": "medium"},
      {"text": "恐龙脚印", "hint": "史前痕迹", "difficulty": "medium"},
      {"text": "火山烟柱", "hint": "自然景象", "difficulty": "medium"},
      {"text": "宇航员头盔", "hint": "太空装备", "difficulty": "medium"},
      {"text": "小火箭窗户", "hint": "太空交通", "difficulty": "medium"},
      {"text": "迷宫出口", "hint": "路线游戏", "difficulty": "hard"},
      {"text": "钟表齿轮", "hint": "机械结构", "difficulty": "hard"},
      {"text": "显微镜下的细胞", "hint": "科学观察", "difficulty": "hard"},
      {"text": "化学实验烧瓶", "hint": "实验室", "difficulty": "hard"},
      {"text": "海底潜水艇", "hint": "水下交通", "difficulty": "hard"},
      {"text": "灯塔照海面", "hint": "海边建筑", "difficulty": "hard"},
      {"text": "吊桥木板", "hint": "桥的一种", "difficulty": "hard"},
      {"text": "风车磨坊", "hint": "乡村建筑", "difficulty": "hard"},
      {"text": "望远镜观星台", "hint": "天文观察", "difficulty": "hard"},
      {"text": "月球车轮印", "hint": "太空探索", "difficulty": "hard"},
      {"text": "机器人充电站", "hint": "未来设备", "difficulty": "hard"},
      {"text": "飞行背包", "hint": "想象装备", "difficulty": "hard"},
      {"text": "魔法药水瓶", "hint": "童话道具", "difficulty": "hard"},
      {"text": "藏宝图路线", "hint": "冒险道具", "difficulty": "hard"},
      {"text": "城堡吊门", "hint": "古老建筑", "difficulty": "hard"},
      {"text": "骑士盾牌", "hint": "防护装备", "difficulty": "hard"},
      {"text": "龙的翅膀", "hint": "幻想动物", "difficulty": "hard"},
      {"text": "凤凰羽毛", "hint": "神话动物", "difficulty": "hard"},
      {"text": "水晶洞穴", "hint": "地下景观", "difficulty": "hard"},
      {"text": "沙漠绿洲", "hint": "自然景观", "difficulty": "hard"},
      {"text": "极光天空", "hint": "天空景象", "difficulty": "hard"},
      {"text": "雪山缆车", "hint": "山地交通", "difficulty": "hard"},
      {"text": "古代战车轮", "hint": "历史交通", "difficulty": "hard"},
      {"text": "指南针指北", "hint": "辨方向", "difficulty": "hard"},
      {"text": "地图折痕", "hint": "旅行用品", "difficulty": "hard"},
      {"text": "照相机三脚架", "hint": "拍摄设备", "difficulty": "hard"},
      {"text": "电影场记板", "hint": "拍电影", "difficulty": "hard"},
      {"text": "舞台聚光灯", "hint": "演出设备", "difficulty": "hard"},
      {"text": "木偶控制线", "hint": "表演道具", "difficulty": "hard"},
      {"text": "皮影戏幕布", "hint": "传统表演", "difficulty": "hard"},
      {"text": "算盘珠子", "hint": "计算工具", "difficulty": "hard"},
      {"text": "竹简卷轴", "hint": "古代书写", "difficulty": "hard"},
      {"text": "蒸汽火车烟囱", "hint": "老式交通", "difficulty": "hard"},
      {"text": "热气球火焰", "hint": "空中旅行", "difficulty": "hard"},
      {"text": "潜水员气泡", "hint": "水下活动", "difficulty": "hard"},
      {"text": "龙舟鼓手", "hint": "节日比赛", "difficulty": "hard"},
      {"text": "舞狮大头", "hint": "节日表演", "difficulty": "hard"},
      {"text": "风铃影子", "hint": "窗边装饰", "difficulty": "hard"},
      {"text": "折纸千纸鹤", "hint": "手工艺", "difficulty": "hard"},
      {"text": "糖画勺子", "hint": "传统小吃", "difficulty": "hard"}
    ]$party_draw$::jsonb
  )
),
expanded as (
  select item, 0 as source_order, ordinality as item_order
  from public.game_content gc
  cross join lateral jsonb_array_elements(gc.data) with ordinality as existing(item, ordinality)
  where gc.game = 'draw'
  union all
  select item, 1 as source_order, ordinality as item_order
  from additions
  cross join lateral jsonb_array_elements(additions.data) with ordinality as added(item, ordinality)
),
deduped as (
  select distinct on (item->>'text') item, source_order, item_order
  from expanded
  order by item->>'text', source_order, item_order
),
merged as (
  select coalesce(jsonb_agg(item order by source_order, item_order), '[]'::jsonb) as data
  from deduped
)
update public.game_content gc
set data = merged.data,
    updated_at = now()
from merged
where gc.game = 'draw';

notify pgrst, 'reload schema';

commit;
