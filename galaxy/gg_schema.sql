-- =============================================================
--  星河玩味 · Galaxy Guide  ——  建表脚本 v1
-- =============================================================
--  ✅ 本文件【幂等 · 可重复执行】。重复运行不会删除任何数据。
--     若已存在同名表/策略，会跳过或重建策略，数据保留。
--     （对比：答题平台的 __schema_v1.sql 开头是 drop table cascade，
--       ❌ 绝不可重跑 —— 那份和这份不是一回事，不要混着跑。）
-- =============================================================
--  执行位置：Supabase Dashboard → 左侧 SQL Editor → 粘贴全文 → Run
--  执行时间：约 2 秒。预期结果：Success. No rows returned
-- =============================================================

-- ---------- 1. 店铺（含待审核 / 已发布 / 已驳回 / 已下架） ----------
create table if not exists public.gg_places (
  id          text primary key,
  data        jsonb       not null,
  ver         bigint      not null default 0,
  updated_at  timestamptz not null default now()
);
create index if not exists gg_places_updated_idx on public.gg_places (updated_at desc);

-- ---------- 2. 投票与备注（一人一店一条，可改） ----------
create table if not exists public.gg_votes (
  place_id    text        not null,
  emp         text        not null,
  v           smallint    not null default 0,
  note        text,
  updated_at  timestamptz not null default now(),
  primary key (place_id, emp)
);
create index if not exists gg_votes_updated_idx on public.gg_votes (updated_at desc);

-- ---------- 3. 员工账户 ----------
create table if not exists public.gg_users (
  emp         text primary key,
  rec         jsonb       not null,
  updated_at  timestamptz not null default now()
);

-- ---------- 4. 系统配置（验证码 / 地图 Key / 分类 / 区域 / 阈值） ----------
create table if not exists public.gg_config (
  k           text primary key,
  v           jsonb       not null,
  updated_at  timestamptz not null default now()
);

-- ---------- 5. 行级安全策略（先删后建，保证可重跑） ----------
alter table public.gg_places enable row level security;
alter table public.gg_votes  enable row level security;
alter table public.gg_users  enable row level security;
alter table public.gg_config enable row level security;

drop policy if exists gg_places_read  on public.gg_places;
drop policy if exists gg_places_write on public.gg_places;
drop policy if exists gg_places_mod   on public.gg_places;
drop policy if exists gg_places_drop  on public.gg_places;

create policy gg_places_read  on public.gg_places for select to anon, authenticated using (true);
-- 形状校验：id 必须是 1~64 字符，data 必须是对象
create policy gg_places_write on public.gg_places for insert to anon, authenticated
  with check (char_length(id) between 1 and 64 and jsonb_typeof(data) = 'object');
create policy gg_places_mod   on public.gg_places for update to anon, authenticated
  using (true) with check (char_length(id) between 1 and 64 and jsonb_typeof(data) = 'object');
create policy gg_places_drop  on public.gg_places for delete to anon, authenticated
  using (char_length(id) between 1 and 64);

drop policy if exists gg_votes_read  on public.gg_votes;
drop policy if exists gg_votes_write on public.gg_votes;
drop policy if exists gg_votes_mod   on public.gg_votes;
create policy gg_votes_read  on public.gg_votes for select to anon, authenticated using (true);
create policy gg_votes_write on public.gg_votes for insert to anon, authenticated
  with check (v in (-1, 0, 1) and emp ~ '^[A-Za-z0-9]{1,20}$' and char_length(place_id) between 1 and 64);
create policy gg_votes_mod   on public.gg_votes for update to anon, authenticated
  using (true) with check (v in (-1, 0, 1) and emp ~ '^[A-Za-z0-9]{1,20}$');

drop policy if exists gg_users_read  on public.gg_users;
drop policy if exists gg_users_write on public.gg_users;
drop policy if exists gg_users_mod   on public.gg_users;
create policy gg_users_read  on public.gg_users for select to anon, authenticated using (true);
create policy gg_users_write on public.gg_users for insert to anon, authenticated
  with check (emp ~ '^[A-Za-z0-9]{1,20}$' and jsonb_typeof(rec) = 'object');
create policy gg_users_mod   on public.gg_users for update to anon, authenticated
  using (true) with check (emp ~ '^[A-Za-z0-9]{1,20}$' and jsonb_typeof(rec) = 'object');

drop policy if exists gg_config_read  on public.gg_config;
drop policy if exists gg_config_write on public.gg_config;
drop policy if exists gg_config_mod   on public.gg_config;
create policy gg_config_read  on public.gg_config for select to anon, authenticated using (true);
create policy gg_config_write on public.gg_config for insert to anon, authenticated
  with check (char_length(k) between 1 and 40);
create policy gg_config_mod   on public.gg_config for update to anon, authenticated
  using (true) with check (char_length(k) between 1 and 40);

-- ---------- 6. 授权（Supabase 默认已授予，重跑确保万无一失） ----------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.gg_places to anon, authenticated;
grant select, insert, update         on public.gg_votes  to anon, authenticated;
grant select, insert, update         on public.gg_users  to anon, authenticated;
grant select, insert, update         on public.gg_config to anon, authenticated;

-- =============================================================
--  验收（执行完再跑这一段，期望返回 4 行 true）
-- =============================================================
-- select
--   (select count(*) from public.gg_places) >= 0 as places_ok,
--   (select count(*) from public.gg_votes)  >= 0 as votes_ok,
--   (select count(*) from public.gg_users)  >= 0 as users_ok,
--   (select count(*) from public.gg_config) >= 0 as config_ok;
-- =============================================================
