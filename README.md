# 大学模拟器（暂定名）

一个大学四年模拟器网页游戏（桌面端），双重目的：
1. **大学规划**：让准大一新生把大学四年先"过一遍"，学会分配时间、做取舍；
2. **AI 教学**：交互式教学关，教零基础新生在真实校园场景里用 AI 提效。

当前范围：**完整大学四年**——登录注册 → 序章建档 → 七个学期（14 个主线教学关 + 各学期选修速结 + 结算）→ 毕业结局（身份卡）。十条 AI 能力线全部落地。

- 前端：React 18 + Vite + TS + React Router + Zustand + Tailwind（1280px 桌面基准）
- 后端：Supabase（邮箱+密码登录、Postgres 云存档、RLS）；未配置时自动降级本地试玩模式
- 关卡内所有"AI 生成"均为预设内容演出，零真实 AI 调用

## 快速开始

```bash
npm install
npm run dev          # 未配置 .env → 本地试玩模式（无登录，进度存浏览器）

# 接云端（正式形态）：
cp .env.example .env # 填入 Supabase 项目的 URL 和 anon key（见 docs/07）
npm run dev
```

```bash
npm run build        # 类型检查 + 构建，产物 dist/ 可静态部署
npm run preview      # 预览构建产物
```

## 文档

| 文档 | 内容 |
|---|---|
| [CLAUDE.md](./CLAUDE.md) | 开发铁律、目录结构、核心结构、术语表 |
| [docs/01_产品定义.md](./docs/01_产品定义.md) | 双目标、四年蓝图、机制、验收标准 |
| [docs/02_数据契约.md](./docs/02_数据契约.md) | 类型契约【冻结】，对应 `src/contracts` |
| [docs/03_demo关卡规格.md](./docs/03_demo关卡规格.md) | Home 主界面与四个关卡逐屏规格 |
| [docs/04_视觉与交互规范.md](./docs/04_视觉与交互规范.md) | 色彩令牌、Home 布局网格、组件规范 |
| [docs/05_工程架构.md](./docs/05_工程架构.md) | 路由/守卫、认证与存档数据流、如何新增关卡 |
| [docs/06_内容运营手册.md](./docs/06_内容运营手册.md) | 不改代码改文案/换图/加专业的操作手册 |
| [docs/07_后端与部署.md](./docs/07_后端与部署.md) | Supabase 建项目步骤、部署（Vercel/静态托管）、安全清单 |
| [docs/08_UI风格调研.md](./docs/08_UI风格调研.md) | 年轻人产品 UI 趋势调研 + 「温暖纸感 × 轻游戏化」设计决策 |

## 目录速览

```
src/contracts   类型契约（冻结）        content/levels        每关一个 JSON
src/services    Supabase/认证/存档适配   content/majors        专业卡片库（30+1）
src/engine      引擎（路由/store/播放器） content/quick-actions 速结行动
src/pages       登录/序章/Home/关卡/结算  content/board         学期主线+选修配置
src/levels      关卡插件 ×4             content/ui            全局 UI 文案
src/components  通用 UI                 public/assets         占位 SVG（同名替换真图）
supabase/       schema.sql（建表+RLS）
```
