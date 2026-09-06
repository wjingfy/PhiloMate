# 美工素材接入表

| 用途 | 运行时路径 | 当前状态 |
| --- | --- | --- |
| 哲学家选择卡 | `src/ui/assets/selection/{id}.png` | 已接入四位角色 |
| 对话人物 | `src/ui/assets/dialogue/{id}.webp` | 已从静态立绘 PSD 合成画面无损提取 |
| 教室背景 | `src/ui/assets/backgrounds/classroom.webm` | 已接入、静音循环播放 |
| 人物动作 | `src/ui/assets/dialogue/actions/{id}-{0,2-3,4}.webp` | 原始 GIF 已转为动画 WebP；按当前态度切换，态度 1 用静态立绘 |
| 头像 | `src/ui/assets/avatars/` | 常态/脸红各四张；亲近分数 ≥80 使用脸红头像 |
| 零食图 | `src/ui/assets/snacks/{snackId}.webp` | 14 种通用 catalog 项及孔子 3 种已给回赠图已接入 |
| 废纸团 | `src/ui/assets/wastepaper/` | 打开动效和纸条底板已接入摘抄本 |
| 哲思角 | `src/ui/assets/features/thought-corner.webp` | 已接入主动提问页 |
| 生涯图鉴 | `src/ui/assets/features/{career,seagull}.webp` | 已接入生涯页 |
| 窗台 | `src/ui/assets/window/balcony.webm` | 已接入静音循环背景 |
| 植物 | `src/ui/assets/window/plants/` | 10 种植物；种子、嫩芽、幼株、生长期、盛放期按亲近分数推进 |

角色 id 固定为 `confucius`、`socrates`、`wangyangming`、`foucault`。所有运行时映射集中在 `src/ui/art.ts`。原始素材保留在 `美工素材/美术素材/美术素材/`；运行副本由 `scripts/prepare-art-assets.py` 增量生成，避免把约 1GB 原始 GIF/PSD 直接塞进浏览器构建。

当前美工只提供孔子回赠池 5 项中的 3 张图，`sauce_assortment` 与 `homemade_fu` 继续显示文字卡，未伪造图片。
