# 大学模拟器（暂定名）· Demo

一个大学四年模拟器网页游戏：教 AI 小白在真实校园场景里学会用 AI。
Demo 范围：**序章 → 大一上行动板 → 选课关 → 海报关 → 速结行动 → 学期结算**。

- 纯静态 SPA（React 18 + Vite + TS + Zustand + Tailwind），零后端、零运行时 AI 调用
- 移动端优先（375px / 微信内浏览器），存档在 localStorage，可中断续玩

## 快速开始

```bash
npm install
npm run dev      # 开发
npm run build    # 类型检查 + 构建（产物 dist/ 可静态部署）
npm run preview  # 预览构建产物
```

## 文档

| 文档 | 内容 |
|---|---|
| [CLAUDE.md](./CLAUDE.md) | 开发铁律、目录结构、术语表 |
| [docs/01_产品定义.md](./docs/01_产品定义.md) | 做什么、为什么、四年蓝图、Demo 验收标准 |
| [docs/02_数据契约.md](./docs/02_数据契约.md) | 类型契约【冻结】，对应 `src/contracts` |
| [docs/03_demo关卡规格.md](./docs/03_demo关卡规格.md) | 四个关卡逐屏规格与台词初稿 |
| [docs/04_视觉与交互规范.md](./docs/04_视觉与交互规范.md) | 色彩令牌、组件规范、动效白名单 |
| [docs/05_工程架构.md](./docs/05_工程架构.md) | 引擎结构、数据流、如何新增关卡 |
| [docs/06_内容运营手册.md](./docs/06_内容运营手册.md) | 不改代码改文案/换图/加专业的操作手册 |

## 目录速览

```
src/contracts   类型契约（冻结）      content/levels        每关一个 JSON
src/engine      引擎（路由/store/播放器/行动板）   content/majors  专业卡片库（30+1）
src/levels      关卡插件 ×4          content/quick-actions 速结行动
src/components  通用 UI              public/assets         占位 SVG（同名替换真图）
```
