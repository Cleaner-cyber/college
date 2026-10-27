# 宣传片 · 《大学模拟器》

一支 74 秒的宣传片，横版 1920×1080（B 站 / 视频号 / 官网）+ 竖版 1080×1920（抖音 / 小红书）两个版本。
画面全部来自**实机截图**和游戏自带美术，配乐与音效由脚本合成，不含任何外部素材。

## 分镜（时间轴见 `trailer.json`）

| 时间 | 场景 | 画面 |
|---|---|---|
| 0–4.5s | 冷开场 | 书桌底图 + 打字机：「2026 年 8 月。你的录取通知书到了。」 |
| 4.5–9s | 撕开通知书 | 实机「滑动启封」逐帧，推近信纸化进片名 |
| 9–15s | 片名 | 大学模拟器 · 把大学四年，先过一遍。 |
| 15–21s | 学长系统 | 「叮——」学长绑定；全程有人带，几乎不用打字 |
| 21–30s | 建档 | 专业卡片 / 四年目标 / 毕业去向 / 入学人设，四张卡落进档案堆 |
| 30–36s | Home | 宿舍主界面推近 HUD，3 个行动点逐个亮起 → 校园地图 |
| 36–54s | AI 教学关 | 7 关蒙太奇：读长文档、生图（初稿→改风格→终稿）、PPT 横评、vibe coding 修白屏、口语陪练、识别假引用、毕业论文红线 |
| 54–61.5s | 文件夹 | 真实产出物「掉落」成堆 → 提示词库 |
| 61.5–67.5s | 四年 | 时间轴九格逐个点亮 → 毕业档案滚到身份卡 |
| 67.5–74s | 收尾 | 学长最后一句 → 片名定版 + college.zeabur.app |

## 文件

| 文件 | 作用 |
|---|---|
| `trailer.json` | **全部文案 + 时间轴**（改字幕只改这里，音效时间点也从这里读） |
| `trailer.html` / `trailer.js` | 合成层：整片是时间 t 的纯函数，`?layout=portrait` 切竖版，`?t=秒` 定格预览 |
| `soundtrack.py` | 配乐 + 音效合成（纯 numpy）：80 BPM 软钢琴/八音盒/弦垫，打字声、撕信封、「叮」等 |
| `render.cjs` | 逐帧截图 → ffmpeg 编码，混入配乐并做响度归一（-16 LUFS） |
| `shots/` | 宣传片用的实机截图（WebP，已入库，直接可渲） |
| `capture.cjs` / `export_shots.py` | 重新采集实机截图（游戏界面改版后用） |

## 渲染

```bash
npm install                                   # 字体来自 lxgw-wenkai-lite-webfont
python3 promo/soundtrack.py                   # → promo/out/soundtrack.wav
node promo/render.cjs                         # → promo/out/trailer-16x9.mp4（约 3 分钟）
node promo/render.cjs --layout portrait       # → promo/out/trailer-9x16.mp4
node promo/render.cjs --stills 12,40,70       # 只出几张静帧预览 → promo/out/stills/
```

依赖：Playwright（chromium）、ffmpeg、Python 3 + numpy。

## 重新采集截图（游戏改版后）

```bash
npm run build && npx vite preview --port 4173 --strictPort   # 本地试玩模式（不要配 .env）
node promo/capture.cjs                                        # 真玩一遍：序章 → 13 个主线关 → Home → 毕业档案（约 15 分钟）
python3 promo/export_shots.py                                 # 裁切压缩 → promo/shots/*.webp（需 Pillow）
```

只改了某一关时不必全量重采：`node promo/capture.cjs --only levels,home,ending --levels poster`
（其余关沿用上次的通关存档；Home 的文件夹与毕业档案依赖全部关卡产出，所以一起重采）。
采完先对照着看一眼 `promo/.raw/named/`，确认没有截到动画半途的画面再导出。

注意必须用生产构建：开发模式的 React StrictMode 下，开局信封的滑块拖满也不会启封（`EnvelopeIntro` 卸载清理把 `doneRef` 置成了 true，二次挂载没复位）。

关卡由一个通用「自动驾驶」推进（投喂文件 → 点提示词 chip → 点推进按钮 → 点画面推进对白），
关键画面按「出现某句文案」触发截图（`capture.cjs` 里的 `LEVELS[].shots`）；文案改了要同步改触发词。
