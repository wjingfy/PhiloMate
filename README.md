# PhiloMate

PhiloMate 是一个与哲学家进行沉浸式对话的 Web 应用。工程已接入孔夫子、苏格拉底、王阳明和福柯四位角色，以及选择页、教室与窗台动态背景、人物立绘、态度动作、头像、零食、植物、废纸团、哲思角和生涯图鉴等界面素材。

目录职责与维护边界见 [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md)。历史说明、更新包和需求文档已统一归档在 `docs/deliveries/` 与 `docs/requirements/`。

## 当前状态

- 线上地址：<http://121.40.225.165>
- 当前生产镜像：`philomate:20260906-confucius-caution-5-27`
- 默认生成模型：`qwen3.8-max`
- 短 JSON 判断模型：`qwen-turbo`
- Docker 状态：`running / healthy`，自动重启策略为 `unless-stopped`
- 福柯对话：已接入 3.0 专属管线，DP/EOP 使用 3.0 语料并保留现有 HS 全集
- 孔子对话：网页首次发言加载完整 512 条语料，再由原生管线按 lens 建立候选池；后续复用内存与浏览器缓存
- 界面图标：透明背景、竖向排列，白色主体配单层绿色阴影
- 静态资源：内容哈希资源一年强缓存，并支持 `ETag` / `304 Not Modified`
- 最近一次上线验收：2026-09-06

## 换设备迁移

当前工程可以直接打包到另一台设备继续开发，不需要迁移或重建线上服务器。建议将“项目文件”和“SSH 私钥”分开传输。

### 项目文件

完整迁移时保留本目录中的源码、测试、文档、原始角色资料和美工素材。以下内容可在打包时排除，以减少体积：

- `node_modules/`：可通过 `npm.cmd ci` 重新安装
- `.npm-cache/`、`.deployment/` 和日志：本地缓存或临时文件
- `dist/`：可通过 `npm.cmd run build` 重新生成
- `交付输出/`：历史发布包；如需保留完整发布记录也可以一起打包

不要删除 `src/`、`scripts/`、`tests/`、`docs/`、`package.json`、`package-lock.json`、`server.mjs`、`Dockerfile`、`.env.example`、四位哲学家的原始目录、`通用(1)`、`教程` 和 `美工素材`。

工程包含较大的美术和视频文件，推荐使用 7-Zip 打包为 `.7z`。打包完成后，先在新设备解压并完成下面的本地验证，再删除旧设备上的副本。

### SSH 私钥

继续管理现有生产服务器时，需要将以下文件单独通过加密 U 盘或带密码的压缩包迁移到新设备，不要把它们放入项目压缩包、代码仓库或普通网盘：

```text
%USERPROFILE%\.ssh\philomate_deploy_20260824-235659
%USERPROFILE%\.ssh\philomate_deploy_20260824-235659.pub
```

在新设备上把它们放入当前用户的 `.ssh` 目录，然后测试连接：

```powershell
ssh -i "$env:USERPROFILE\.ssh\philomate_deploy_20260824-235659" admin@121.40.225.165
```

百炼模型密钥保存在生产服务器的 `/home/admin/apps/philomate/shared/model.env`，不需要从服务器下载，也不要写入项目压缩包。新设备能够通过 SSH 登录原服务器后，即可继续构建和部署。

### 新设备恢复

安装 Node.js 20 或更高版本，然后在解压后的项目根目录运行：

```powershell
npm.cmd ci
npm.cmd run dev
```

浏览器访问 <http://127.0.0.1:5199>。开发环境无模型密钥时会使用离线兜底，这不影响界面开发；需要在本地测试真实模型时，再根据 `.env.example` 配置自己的服务端环境变量。

迁移后的完整检查：

```powershell
npm.cmd run align
npm.cmd run check:art
npm.cmd run selftest:attitude
npm.cmd test
npm.cmd run build
```

生产静态资源会返回 `Cache-Control`、`ETag` 和 `Last-Modified`。`/assets/` 下带内容哈希的图片、视频、字体、CSS 和 JavaScript 使用一年强缓存；页面或其他需要重新验证的文件会在未变更时返回 `304` 且不传输响应体。启动生产服务后可运行 `npm.cmd run check:cache` 验证。

浏览器中的会话、好感度、零食和窗台等数据保存在旧设备的 IndexedDB，不会随项目压缩包自动迁移。可先在读书记录中导出备份；若服务器配置了 `PHILOMATE_SYNC_DIR`，也可使用恢复密钥做端到端加密迁移。

## 已接入功能

- 四位角色：`confucius` / `socrates` / `wangyangming` / `foucault`
- 标准角色数据路径：`src/data/{id}/`
- 用户输入 → 安全分流 → 角色专属检索与话语策略 → 统一态度定档 → 长期 stack → 输出模式 → 角色成句
- G1/R1 好感、每日上限、零食、废纸团时段规则
- 美术主导的沉浸式界面：选择页直接复用定稿视觉，对话页以全幅教室、人物、气泡和底部输入栏构成主界面，不再套用通用后台框架
- 每位哲学家支持多会话的新建、切换和删除，历史会话从对话页右下角进入
- 主动提问、摘抄本、生涯、窗台、书包和哲思角均使用全屏或场景内交互
- 窗台支持读书记录、阅读进度、五阶段植物成长、拖放摆放和层级调整
- 读书记录支持 ISBN/书名检索，经服务端聚合 Google Books 与 Open Library 候选版本；支持 ISBN 去重、来源标识和保存后更换植物
- 对话回复可展开“思想依据”，并区分相关语料与模型生成表达
- 零食支持每日领取、单份赠送、图鉴解锁及按关系档位触发的延迟回赠
- 废纸团、回赠和主动对话按照固定顺序展示，可跳过、自动消退或在人物名片中关闭自动展示
- 人物态度 `0 / 2–3 / 4` 对应动作，态度 1 使用静态立绘
- 高亲近档脸红头像、17 种零食、10 种植物及五阶段成长展示
- 无密钥时仍可运行；配置模型后由服务端代理调用，密钥不会进入浏览器代码

## 角色运行架构

安全分流、态度档、长期 stack、好感度与 UI 输出模式由四位角色共用；检索和最终成句可以按角色使用独立实现。

孔夫子在模型可用时使用 `runConfuciusPipeline` 原生链路，包含选择、情绪、跨轮、转题与成句模块；模型不可用或链路异常时回退到本地成句。网页组装层不会再按用户原句把孔子语料预先截成 Top-K，而是在首次孔子发言时加载完整 512 条语料，保证 lens 抽取与本地管线一致；版本化 JSON 支持浏览器缓存与 `ETag` / `304` 复用。其他角色继续使用轻量 Top-K 或各自专属检索。

苏格拉底不复用孔夫子的选典和成句约束。运行时使用 `src/services/socrates/harness.ts` 的专属轻量 harness：

- 使用苏格拉底语料的 `modern_user_hooks` 和 `modern_pairs` 标注进行检索，不随机硬套典籍
- 将最近八轮对话提供给模型，并维护跨轮提问预算
- 一轮最多一个问题；寒暄、日常、玩笑和元对话不提问
- 用户表示“别追问”或“像审讯”后进入三轮停问冷却
- 只用第一人称，显示前过滤第三人称自称、OOC 和后台术语
- qwen3.8-max 使用按场景配置的温度、篇幅和采样参数，减少过短、偏干的回答
- 闲聊可以使用审核故事，或进行明确标注为想象的轻松发挥
- “我年轻时／我曾／有回我在”等亲历必须与审核故事库对应，否则修订；修订仍失败时回退到安全成句

苏格拉底旧 Python 程序和旧前端仅作为原始资料参考，不进入当前浏览器运行时。

详细审查记录见 `docs/socrates-harness-review-20260826.md`。

福柯在模型可用时使用 `src/services/foucault/v3/` 的 3.0 专属管线；该模块仅在福柯对话时按需加载，不覆盖其他角色的检索或成句逻辑。当前整合包括：

- 问旨、路径、严格/放宽透镜、义项裁决和态度比照的两档模型分流
- 丧亲、离世、分手、离婚及长期关系断裂的专门识别，避免降格为日常自我照料问题
- C 类共情轮、危机接话、句尾提问及防连续追问状态
- 正常回复上限放宽至 300 字，优先把事情谈清楚
- 外文术语须括注中文且最多两个；保留多词术语空格
- 对评价标签开场、裸外文、术语超限/黏连、定义式开场和提示词例句复读进行出口复检
- 主动哲学问题使用福柯 3.0 的回答判定与评价成句；`question_back` 最多保留一次再答
- 会话状态写入当前统一 `ConversationState.roleRuntime`，刷新和会话保存仍沿用现有网页机制

福柯运行时语料位于 `src/data/foucault/corpus_annotated.json`，目前共 312 条：DP 145 条、EOP 19 条、HS 148 条。DP/EOP 来自“福柯3.0”累计包，HS 沿用整合工程已有全集。

## 本地运行

需要 Node.js 20 或更高版本。

在 Windows PowerShell 中使用 `npm.cmd`，可避免系统执行策略阻止 `npm.ps1`：

```powershell
npm.cmd ci
npm.cmd run dev
```

浏览器访问 <http://127.0.0.1:5199>。默认端口是 `5199`，可通过 `PORT` 环境变量修改。

生产模式：

```powershell
npm.cmd run build
npm.cmd start
```

## 模型配置

参考 `.env.example` 设置服务端环境变量：

```dotenv
QWEN_API_KEY=你的百炼_API_Key
QWEN_MODEL=qwen3.8-max
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
PORT=5199
# PHILOMATE_SYNC_DIR=/home/admin/apps/philomate/shared/encrypted-sync
```

也可使用 `DASHSCOPE_API_KEY`。同一枚百炼 Key 按请求分流：`qwen-turbo` 负责 mood、path、态度比照等短 JSON，`qwen3.8-max` 负责问旨、透镜、义项裁决、bridge 和最终成句。

生产服务器的环境文件位于 `/home/admin/apps/philomate/shared/model.env`，不进入 Docker 镜像、浏览器资源或工程交付包。不要把真实 Key 写入 `.env.example` 或提交到版本库。

## 用户数据保存方式

当前版本没有用户账号系统。结构化状态统一保存在使用者浏览器的 IndexedDB 中；首次升级会以事务方式迁移原有 `philomate_*` localStorage 记录。本地上传的书籍封面以 Blob 存在独立 IndexedDB 媒体库，不写入常规状态 JSON：

- 每位哲学家的多组会话及各会话最近 100 条对话消息
- 各会话的对话状态、最近语料和长期 stack
- 好感度及每日累计值
- 每日零食、库存、图鉴、赠送和待领取回赠
- 读书记录、植物成长、窗台位置和层级
- 废纸团、主动提问、生涯解锁、新内容标记及哲思角归档

读书记录页会显示“正在保存／已保存／保存失败／仅在本机”，并可导出或恢复包含封面的 JSON 备份。默认不上传任何持久化数据；配置 `PHILOMATE_SYNC_DIR` 后，页面才会显示“加密同步”。恢复密钥不保存、不上传，备份在浏览器中通过 PBKDF2-SHA-256 派生密钥并使用 AES-GCM 加密，服务器只保存密文。密钥丢失后无法恢复。模型功能启用时，当次请求内容仍会转发给配置的模型服务提供方。

## Docker 部署

先构建前端：

```powershell
npm.cmd run build
```

构建并启动容器：

```bash
docker build -t philomate:latest .
docker run -d \
  --name philomate \
  --restart unless-stopped \
  --env-file /home/admin/apps/philomate/shared/model.env \
  -p 80:5199 \
  philomate:latest
```

容器监听 `0.0.0.0:5199`，宿主机通过 80 端口对外提供访问。

当前线上交付包：

```text
.deployment/philomate-20260906-confucius-caution-5-27.tar.gz
大小    128,312,703 B
SHA256  e5ab544efce7c3619e43d8a22a7a69bbd4b93e4fc695fce52e0ba1f43a97692a
```

当前生产镜像为 `philomate:20260906-confucius-caution-5-27`。直接回滚点为 `philomate:20260906-confucius-full-corpus`；更早的 `philomate:20260906-foucault-v3-integrated` 保留了福柯 3.0 整合版本。

## 验证

本地完整验证：

```powershell
npm.cmd run align
npm.cmd run check:art
npm.cmd run selftest:attitude
npm.cmd test
npm.cmd run build
```

可复现首屏性能验收时，先启动生产服务和带 CDP 端口的无界面浏览器，再运行 `npm.cmd run audit:performance`。当前预算为首屏传输不超过 3 MB、FCP 不超过 3 s、请求数不超过 45。

单独检查一个角色：

```powershell
npm.cmd run align -- --id socrates
```

2026-09-06 本地与生产验收结果：

- 自动测试 `37/37` 通过，其中包含孔子完整语料接线、5.27「内自讼」义项边界，以及福柯 3.0 术语、丧失识别、字数档与语料组成回归
- TypeScript 检查与 Vite 生产构建通过；福柯专属代码和语料被拆为按需加载资源
- 本地生产服务首页返回 200，`/api/health` 正常，模型配置可用
- 福柯 Top-K 检索可命中新增共情语料 `EOP-04`
- 生产福柯语料核验为 DP 145、EOP 19、HS 148，共 312 条
- 生产孔子语料核验为 512 条；5.27 已追加【易错·义项】并标记 `manual`，网页主包使用新缓存版本，带 ETag 的二次条件请求返回 304
- 公网首页引用最新主包，首页与福柯资源均返回 200
- 静态资源返回一年强缓存；携带条件请求时返回 304 且不重复传输响应体
- 苏格拉底 320 条语料、21 个 themes、21 个 categories 对齐通过
- Docker 健康状态为 `healthy`，重启次数为 0
- 当前生产镜像为 `philomate:20260906-confucius-caution-5-27`，直接回滚镜像 `philomate:20260906-confucius-full-corpus` 健康保留

2026-09-05 的无缓存首屏性能基线为传输 `927,770 B`、`13` 个请求、本机 FCP `376 ms`，均在预算内。福柯 3.0 的专属模块采用动态加载，因此不会进入其他角色的首屏主包。

## 美工资源与后续替换

- 选择页定稿图：`src/ui/assets/branding/selection-screen.webp`
- 功能图标原始精灵：`src/ui/assets/branding/logo.webp`
- 自适应纯图标：`src/ui/assets/branding/icons/`
- 当前静态立绘：`src/ui/assets/dialogue/`
- 态度动作：`src/ui/assets/dialogue/actions/`
- 头像：`src/ui/assets/avatars/`
- 教室背景：`src/ui/assets/backgrounds/classroom.webm`
- 零食、窗台、植物及功能页素材：`src/ui/assets/{snacks,window,features,wastepaper}/`
- 运行时素材映射：`src/ui/art.ts`
- 主题和响应式布局：`src/styles.css`
- 核心对话管线：`src/services/dialogue/`
- 福柯 3.0 专属管线：`src/services/foucault/v3/`
- 福柯主动问题评价：`src/services/foucault/questionEvaluation.ts`

重新处理美工原件时运行：

```powershell
python scripts/prepare-art-assets.py
```

该脚本需要 Pillow。原始交付目录保留不动，`src/data/` 是组装后的运行时标准副本。
