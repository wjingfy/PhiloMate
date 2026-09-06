# 项目结构

## 运行核心

```text
src/
  constants/          模型名称等应用常量
  data/               四位角色的运行时数据副本
  services/
    dialogue/         统一安全、检索、态度、长期状态与成句编排
    confucius/        孔子完整管线
    socrates/         苏格拉底角色策略
    wangyangming/     王阳明角色策略
    foucault/         福柯角色策略
    shared/           跨角色公共规则
    ui/               产品状态持久化
  ui/assets/          浏览器实际加载的优化素材
  main.ts             前端入口与界面编排
server.mjs            静态服务、Vite 开发中间件与模型代理
tests/                自动化测试
scripts/              数据对齐、美术检查与素材处理脚本
```

`src/data/` 和 `src/services/` 是线上行为的直接来源。修改角色逻辑时，应优先更新对应角色策略与测试，不要直接从原始交付目录整包覆盖。

## 文档与交付

```text
docs/
  PROJECT_STRUCTURE.md    本文
  ASSEMBLY_DECISIONS.md   组装时的权威顺序与架构取舍
  ART_ASSETS.md           美术资源映射
  deliveries/             历史交付说明、角色更新说明和原始补包
  requirements/           产品与 UI 需求原件
交付输出/                  历史构建包和发布记录
```

`docs/deliveries/` 仅用于追溯。已经整合进运行时的改动仍以 `src/` 为准。

## 原始资料

```text
confucius/            孔子原始角色交付
socrates/             苏格拉底原始角色交付
wangyangming/         王阳明原始角色交付
foucault/             福柯原始角色交付
通用(1)/              统一规范与 schema
教程/                 标注和输出逻辑教程
美工素材/             大体积原始美术文件
```

这些目录作为来源和审计依据保留。产品运行不会直接读取其中的代码或数据。

## 生成与本地文件

```text
dist/                 `npm run build` 生成，可重建
node_modules/          `npm ci` 安装，可重建
.npm-cache/            npm 本地缓存，可删除
.env                   本机密钥配置，不提交
```

## 常用验证

```powershell
npm.cmd run align
npm.cmd run check:art
npm.cmd test
npm.cmd run build
```

