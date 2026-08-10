# Realm Persona Studio — Nimi App Access 对接审计(第一阶段,只读)

- 审计日期:2026-08-07
- 审计范围:本仓全量只读盘点;平台参考仓 `/Users/snwozy/nimi-realm/nimi`(分支 `spec-4`)只读引用。
- 引用约定:裸路径指本仓文件;`nimi/` 前缀指平台参考仓 `/Users/snwozy/nimi/nimi` 下路径(即 `/Users/snwozy/nimi-realm/nimi/`)。
- 本阶段未修改任何源文件;本报告是唯一新增产物。

## 1. 现状盘点

### 1.1 依赖:外部仓如何消费 workspace 包

| 依赖 | 声明 | 实际解析 | 状态 |
|---|---|---|---|
| `@nimiplatform/kit` | `link:../../nimi/kit`(package.json:67;pnpm-workspace.yaml:5 override 同指) | `node_modules/@nimiplatform/kit` → symlink 到 `nimi/kit`(spec-4 工作区源码,0.3.0) | 活链接,跟随平台分支 |
| `@nimiplatform/sdk` | `link:../../nimi/sdks/typescript`(package.json:68;pnpm-workspace.yaml:6) | symlink 到 `nimi/sdks/typescript`(0.6.0,types 指向 `dist/`,nimi/sdks/typescript/package.json:18) | 活链接;dist 已构建且已是新契约 |
| `@nimiplatform/app-tools` | `link:../../nimi/app-tools`(package.json:41) | **未安装**:`node_modules/.bin/nimi-app` 缺失,`node_modules/@nimiplatform/` 下只有 kit/sdk/nimi-coding | `pnpm dev`(`nimi-app dev --shell electron`,package.json:12)当前无法运行;`pnpm install` 未在改完 package.json 后重跑 |
| `@nimiplatform/kit-protected-local-win32-x64` | `link:../../nimi/kit/shell/protected-local-node/npm/win32-x64`(package.json:42) | 未安装 | 多余且架构错误:本机 macOS arm64;原生绑定由 kit 自行按平台解析(nimi/kit/shell/electron/src/main/protected-local-binding-loader.ts:5-6),tester/zhiyu 均不声明该依赖(nimi/apps/tester/package.json、nimi/apps/zhiyu/package.json) |
| `@nimiplatform/nimi-coding` | `0.4.0`(package.json:44) | 安装的是 0.2.5(node_modules/.pnpm 目录名) | 再次印证 install 陈旧 |

**关键结论**:消费方式是 **file link 到活跃开发中的平台 workspace**,不是 published 版本。平台侧任何 hard-cut 会立刻打破本仓——本次审计的 70 个 typecheck 错误就是实例(见 1.5)。长期策略(link vs published)需要用户决策,本报告不自造答案。

vite 不走包 `exports`,而是把 `@nimiplatform/sdk|kit/*` alias 到平台仓 TS **源码**(vite.config.ts:63-88);typecheck 走 dist 类型。两处 alias 指向已不存在的文件:vite.config.ts:74(`kit/core/src/model-config/index.ts`)、vite.config.ts:80(`kit/features/model-picker/src/runtime.ts`,kit 的 exports 只剩 `./features/model-picker{/headless,/ui}`)。

### 1.2 Manifest 与启动方式

- `nimi.app.yaml:10` 仍是 `permissions: []`——retired 词汇;**没有 `app_access`**。`nimi-app doctor` 强制要求 `app_access` 存在(nimi/app-tools/lib/app-doctor-update.mjs:405 → nimi/app-tools/lib/app-access-declaration.mjs:41-44),且 tester 的 validate 会把 `permissions` 键当 retired 词汇拒绝(nimi/apps/tester/scripts/validate.mjs:12-16)。
- `local_development.electron.renderer_origin: http://127.0.0.1:1450`(nimi.app.yaml:11-13)符合 canonical loopback 规范(nimi/app-tools/lib/app-doctor-update.mjs:419-441)。1450 与 tester(1468)/zhiyu(1472)不冲突,可保留。
- 启动链:`pnpm dev` → `nimi-app dev --shell electron`(package.json:12)→ dev-shell 读 `nimi.app.yaml` 的 `app_id`(nimi/app-tools/scripts/dev-shell.mjs:142-160)并经 Desktop supervisor 拉起(nimi/app-tools/scripts/dev-shell.mjs:163-190,presence descriptor + heartbeat)。strictPort 竞态(vite.config.ts:126-129)无缓解脚本;tester 有 `scripts/ensure-dev-renderer-port.mjs` 可参考。

### 1.3 Electron 主进程 bridge

- `src-electron/main.ts:28-33` 已用 `registerNimiElectronAppBridge`(方向正确),**但携带 `onProtectedSessionFailure: () => app.quit()`(main.ts:32)**。spec-4 kit 只接受 `appId/allowedRendererUrls/ipcMain/appCommandHandlers`,多余字段抛 `electron-local-app-bridge-input-forbidden`(nimi/kit/shell/electron/src/main/app-bridge.ts:133-153)。按代码推演,`bootstrapElectron` 必抛错 → `handleElectronStartupFailure` → `app.quit()`(main.ts:25,44-47):**当前 Electron 壳对 spec-4 kit 启动即崩**(代码推演,未实跑)。
- 该回调同时是"自杀式 session-loss 处理":新契约明确要求 session 丢失不退出 App、bridge 保持注册、同 Host 恢复(app-bridge.ts:33-41 注释)。
- `src-electron/preload.cts:1-7` 的 `installNimiElectronRuntimeBridge` 用法与 tester 一致,无需改。

### 1.4 Renderer 调用点枚举(rg 全量)

**唯一活着的新契约消费点**:`getStudioLocalAppClient().auth.status()`(src/shell/renderer/infra/studio-bootstrap.ts:51;client 构造于 src/shell/renderer/app-shell/studio-platform.ts:12-19,经 `createNimiLocalAppStandardShellSurface`,src/shell/renderer/bridge/index.ts:4)。`currentUser/storage/aiConfig/realm.worldCore/ai.text/agents/conversation` 七个命名空间**零消费**(全仓 grep 无命中)。

其余全部 nimi 相关能力都汇聚到两个 fail-closed stub:
- `createStudioRealmClient()` 无条件抛错(src/shell/renderer/data/realm-client.ts:30-32),其声明的旧面是 7 个 `worldCoreController*` 方法(realm-client.ts:4-12)。
- `createStudioRuntimeClient()` 恒返 null(src/shell/renderer/data/runtime-client.ts:4-6)。

按文件的能力清单(导出函数 → 底层表面,①旧 realm.generated ②Runtime scenario ③新 local-app client ④纯本地):

| 文件 | 能力 | 表面分类 |
|---|---|---|
| features/portfolio/portfolio-client.ts:175-282 | persona list/get、world list/get、handle 检查、persona create | ①(realm-client.ts 的 7 方法) |
| features/portfolio/portfolio-settings-client.ts:518-743 | settings/visibility 读与写 | ①get/replacePersonaCharacter |
| features/portfolio/portfolio-settings-client.ts:596-679 | settings/post 文案 AI 提案 | ②`runStudioTextGenerate`(studio-ai-runtime.ts:508) |
| features/portfolio/portfolio-media-client.ts:322-508 | avatar 选择写回;voice demo、image、avatar package 候选生成 | ①get/replace;②speechSynthesize/imageGenerate scenario |
| features/portfolio/portfolio-post-client.ts:38,446-603 | 发布面已硬编码 `not-admitted`;post copy AI 提案 | ④fail-closed;②text generate |
| features/portfolio/studio-ai-runtime.ts(1390 行) | scenario 执行核心:route options、text/image/speech、local model center | ②全部经已删除的 SDK runtime 面 |
| features/portfolio/runtime-artifact-projection.ts:77 | artifact 字节读取 | ②`runtime.artifacts.readArtifactBytes` |
| features/portfolio/persona-seed-generator.ts:189-214 | 描述→persona seed 文本生成 | ②text generate |
| features/portfolio/persona-reference-image.ts:101-131 | 参考图生成 | ②imageGenerate |
| features/portfolio/portfolio-data.ts:170 | friendCount 恒 `source-unavailable` | ④已是 fail-closed |
| features/ai-config/studio-ai-config-store.ts(291 行) | 自实现内存 AIConfig store + `SharedAIConfigService` 接口 | ④内存;hydrate/persist/commit 必 throw(:58-76,140-145) |
| features/ai-config/studio-ai-config-page.tsx | AI 配置页 | ②③混合,依赖已删除的 sdk/ai 与 kit model-config 导出 |
| features/ai-config/studio-runtime-model-provider.ts:6 | 模型目录 provider | ②经 retired specifier `@nimiplatform/kit/features/model-picker/runtime` |

本地持久化(全部 `window.localStorage`,无 kit storage 桥消费):
- 排期 store:key `realm-persona-studio.local-post-schedule.{personaId}`(features/portfolio/local-post-schedule-store.ts:19-23,读 :125、写 :157、删 :164)。
- 创意历史:key `realm-persona-studio.creative-asset-history.{personaId}`(features/portfolio/creative-asset-history.ts:24-28,读 :88、写 :123),record 内含 `resourceId/artifactIds/traceId`。
- locale:`nimi.realm-persona-studio.locale`(i18n/studio-i18n.ts:12)。

### 1.5 基线验证(2026-08-07 实测)

- `pnpm typecheck`:**70 个 error TS**,全部集中在 `features/ai-config/`(约 42 个:`SharedAIConfigService`、`NimiAIConfig/NimiAIProfile`、`createNimiAppAIScopeRef` 等导出已从 `@nimiplatform/sdk/ai` 消失;kit model-config 面已改;`model-picker/runtime` specifier 已退休)与 `features/portfolio/`(约 28 个:`createNimiRuntimeRouteOptionsHostDeps`、`listNimiRuntimeRouteOptionsWithHost`、`createNimiRuntimeLocalModelCenterClient`、`FallbackPolicy`、`ScenarioRequestHead.modelId/routePolicy/connectorId`、`NimiGenerateTextRequest.model`、`COMPANION_SLOTS` 等已消失)。
- `pnpm test`(vitest):**10/35 测试文件红**(全部 import 期失败,根因 `createNimiAIConfigSubscriptionRegistry is not a function`,studio-ai-config-store.ts:48),25 文件 84 tests 通过。
- 即:当前 HEAD 对 spec-4 依赖**不可构建、不可启动、测试不全绿**。适配不是"优化",是修复性改造。

## 2. 残留清单(逐项 file:line)

| # | 残留 | 位置 |
|---|---|---|
| R1 | manifest `permissions: []`(retired 键) | nimi.app.yaml:10;被测试钉死 src/shell/renderer/bridge/electron-shell-boundary.test.ts:56 |
| R2 | `onProtectedSessionFailure: () => app.quit()`(已删除的 authority 字段 + 自杀式 session-loss) | src-electron/main.ts:32;被测试钉死 electron-shell-boundary.test.ts:40 |
| R3 | `permission` 词汇失败分类与文案 | portfolio-data.ts:92,:386-387;persona-shell.tsx:221,:228;persona-list-page.tsx:45,:53;i18n studio-copy.ts:442,:446,:447,:1580,:1584,:1585 |
| R4 | 终端文案内嵌机器码 `capability-unavailable` + "admitted" 叙述 | studio-copy.ts:175(en),:1313(zh),经 auth-provider.tsx:52 渲染 |
| R5 | shared LocalAgent AIConfig 层(`SharedAIConfigService`、scopeRef、profile 库) | features/ai-config/studio-ai-config-store.ts:2-26(import 区块),:48,:198-209;studio-ai-config-page.tsx:4-17;studio-runtime-model-provider.ts:1-13 |
| R6 | Runtime scenario/route/model-center/artifact 执行层 | studio-ai-runtime.ts:8-44(import 区块),:430-442,:508-524,:737-758,:1097-1103,:1163-1168,:1271-1276;runtime-artifact-projection.ts:77;persona-reference-image.ts:115-131;persona-seed-generator.ts:203-214 |
| R7 | 旧 realm.generated `worldCoreController*` 面(Local App 不可达) | data/realm-client.ts:4-12,20-27;调用点 portfolio-client.ts:176,184,191,199,230,265;portfolio-settings-client.ts:522,530,565,715;portfolio-media-client.ts:340-341 |
| R8 | admission 词汇的 actionHint/message | studio-platform.ts:21-30(`admit_persona_studio_protected_operation_through_desktop`) |
| R9 | 原始 error message / JSON dump 直渲 UI | auth-provider.tsx:30;studio-ai-config-page.tsx:263-266;OwnerPortfolio.assets.tsx:623-630,716-723,865-872;CreateRealmPersonaWorkspace.tsx:345-349,517-525,708;toast 原文回退 OwnerPortfolio.posts.tsx:101-104、OwnerPortfolio.assets.tsx:139-142、OwnerPortfolio.settings.tsx:58-65、persona-voice-config-page.tsx:44 |
| R10 | stale vite alias(指向不存在文件) | vite.config.ts:74,80 |
| R11 | 多余 win32 原生绑定依赖 | package.json:42 |

**零残留确认项**(全仓 grep 无命中,含 src/src-electron/scripts):`SendAppMessage`、`agents.configure`、`localAgentId`、durable agent handle 持久化、`agents.listReferences`/`conversation.*` 消费、直连 Realm 的 `fetch(/axios/WebSocket`(src 内 fetch 仅 react-query `refetch` 命中)、runtime artifact put、voice 流。

**非残留(防止误报)**:`src-tauri/capabilities/default.json:5` 的 `permissions` 是 Tauri 自身能力系统;`LICENSE` 的 permission 是 MIT 条文;`.github/workflows/ci.yml:14` 是 GHA token 权限;`AGENTS.md:81,96-109`、`ADMISSION.md`、`SECURITY.md`、`scripts/local-audit.mjs` 的 admission/permission 叙述属发布审查轨道(去留见 §6 开放问题);`docs/_archive/**`、`design-audit/**` 为历史文档。

**登记但不修(红线只读)**:`.nimi/spec/realm-persona-studio/canonical/failure.authority.yaml:13-16`(`permission-missing` 失败定义)、`core.authority.yaml:32`("Desktop owns admission, ... permission posture")——spec 仍是 first-party 世界观,需用户决策演进方式。AGENTS.md 同口径(其 "Spec Authority & Sync" 节引用的 `listRealmPersonas/createRealmPersona` 在 spec-4 SDK 中不存在,SDK 只有 `*PersonaCharacter*` 变体,nimi/sdks/typescript/realm/index.ts:143-170)。

## 3. 映射表(现有能力 → 新契约)

新契约操作面恰好 14 行(nimi/runtime/internal/localappop/contract.go:79-94);SDK 命名空间形状以 nimi/sdks/typescript/core/app/local-app-runtime-platform.ts:165-206 为准。

| 现有能力 | 现状位置 | 处置 |
|---|---|---|
| 会话姿态 `auth.status()` | studio-bootstrap.ts:51 | **已有新表面**:保留;补全 state 处理(session-bound/action-required/revoked/unavailable → typed unavailable + 同 Host 重试,参照 nimi/apps/zhiyu/src/shell/runtime/runtime-status.ts:8-35) |
| 用户身份展示 | 未使用 | 可选接入 `currentUser.get()`(仅 `{handle, displayName, avatarUrl}`,local-app-runtime-platform.ts:107-111);app-store.ts:3-8 的 `AuthUser{id,email}` 是旧形状残留,随接入修正 |
| 本地排期 store | local-post-schedule-store.ts(localStorage) | **已有新表面可换**:`storage.{readJson,writeJson,removeJson}`(Base 类,无需 domain);或保留 localStorage——见 §6 决策点 D1 |
| 创意历史 store | creative-asset-history.ts(localStorage) | 同上;注意其 record 携带 `traceId/artifactIds`,artifactIds 随 scenario 层删除失去来源 |
| AI 配置 | studio-ai-config-store.ts(内存+fail-closed) | **已有新表面可换**:`aiConfig.{get,overwrite}`(Base 类;portable capability intent,`assertNoAuthorityMaterial` 拒绝 owner/account 字段,local-app-runtime-platform-ai-config.ts:58-105);整个 SharedAIConfigService 层删除重写 |
| 文本生成(seed/post copy/settings 提案) | studio-ai-runtime.ts:508-524 | **已有新表面可换**:`ai.text.generateCandidate`(runtime.consume;unary 界:≤8 messages、32KiB/条、64KiB 总、maxTokens≤4096,local-app-runtime-platform.ts:262-266) |
| 创建流世界选择器 world list | portfolio-client.ts:188-199 | **已有新表面可换**:`realm.worldCore.list`(realm.data;返回 `WorldCoreDto`) |
| persona portfolio list/get | portfolio-client.ts:175-186 等 | **产品缺口**:新面无对应(只有 world-core list/create;`WorldCoreDto` ≠ persona) |
| persona create/replace(创建、settings、visibility、avatar 写回) | portfolio-client.ts:260-282;portfolio-settings-client.ts:541-743;portfolio-media-client.ts:322-341 | **产品缺口**:无对应面 |
| friendCount | portfolio-data.ts:170(已 fail-closed) | **产品缺口**:无对应面,维持 `source-unavailable` |
| posts 发布/媒体上传/text resource | portfolio-post-client.ts:526-603(已 fail-closed) | **产品缺口**:无对应面,维持 not-admitted 产品态 |
| 图像/语音/参考图候选生成 | portfolio-media-client.ts:362-508;persona-reference-image.ts | **产品缺口**:imageGenerate/speechSynthesize scenario 无对应面 |
| artifact 字节读取 | runtime-artifact-projection.ts:77 | **产品缺口**(随上项一起失效) |
| 模型目录/route options/local model center | studio-runtime-model-provider.ts;studio-ai-runtime.ts:430-442,737-758 | **产品缺口**:无对应面;AIConfig 改为 portable intent 后模型枚举不属 App 面 |
| runtime context/chat readiness 投影 | portfolio-settings-client.ts:747-796(已 fail-closed) | **产品缺口**:维持 fail-closed |
| agent 引用/conversation | 无消费 | **不声明 `agent.local`** |
| Electron bridge 注册 | src-electron/main.ts:28-33 | **应删除/修正**:去掉 `onProtectedSessionFailure`(R2) |
| realm/runtime client stub 层 | data/realm-client.ts、data/runtime-client.ts | **应删除**:旧 generated 类型依赖随之解除 |
| scenario 执行层 | studio-ai-runtime.ts、runtime-artifact-projection.ts 等 | **应删除**(70 个 typecheck 错随删除清零) |

**最小 domain 声明集**:`app_access: [realm.data, runtime.consume]`。不声明 `agent.local`(零消费)。

## 4. 工具链差距与接入方案

对照 nimi/apps/tester/package.json:

1. **修复安装**:`pnpm install`(app-tools 链接未落盘,`nimi-app` bin 缺失;nimi-coding 版本落后)。
2. **接入 `prepare:workspace-surfaces`**:tester 把它前置进 typecheck/build/test(tester package.json:12-15),本仓 typecheck/build/test 均未前置;`with-workspace-surfaces.mjs` 包装器(tester package.json:17)同参考。
3. **删除 `kit-protected-local-win32-x64` 依赖**(R11)。
4. **端口**:1450 独占保留;strictPort 竞态已知,可选移植 tester `scripts/ensure-dev-renderer-port.mjs`(决策点 D2)。
5. **validate 加固**:scripts/validate.mjs 增加 `app_access` 精确断言 + retired 键(`permissions` 等)拒绝,参照 tester scripts/validate.mjs:4-17。
6. **doctor 约束**:`nimi-app doctor` 强制 `app_access` 存在且 `renderer_origin` 为 canonical 127.0.0.1 origin——CP1 后 `pnpm run doctor` 才能转绿。

## 5. 适配改造计划(第二阶段 checkpoint,待确认后执行)

- **CP0 工具链修复**:pnpm install、删 R11、接 prepare:workspace-surfaces。验收:`pnpm typecheck` 能跑到真实错误集(不再是环境性失败)。
- **CP1 manifest + Electron bridge**:`nimi.app.yaml` 删 `permissions: []`、加 `app_access: [realm.data, runtime.consume]`;main.ts 删 R2;改写 electron-shell-boundary.test.ts:40,56 两条钉死旧行为的断言;validate.mjs 加固。验收:`pnpm run doctor` 绿、Electron 壳可启动(代码级)。
- **CP2 会话姿态**:bootstrap/auth-provider 改为三项独立事实姿态(App running / Nimi access / official tooling),typed unavailable + 同 Host 重试,不退出 App;消除 R4(文案去机器码)、R8(admission 词汇)。参照 zhiyu runtime-status.ts 与 runtime-platform.ts:64-117。
- **CP3 AI 层**:删 scenario 层(R6)与 SharedAIConfigService 层(R5);`ai.text.generateCandidate` 接入 seed/post-copy/settings 三处文本提案(各自校验 unary 界);`aiConfig.get/overwrite` 替换配置存取。验收:typecheck 清零、受影响测试改写后转绿。
- **CP4 realm.data 接入**:world picker 换 `realm.worldCore.list`;删 data/realm-client.ts stub 与旧 generated 类型依赖(R7)。
- **CP5 缺口产品态收尾**:portfolio/posts/media/voice 各页面对"无对应面"能力渲染 typed unavailable(信息态文案,非告警);全量 UI 过"无机器码"(R9);R3 的 permission 失败分类改名。
- **CP6 本地持久化决策执行**(D1)。
- **CP7 真实 journey 验收**:backend(3002)+ `pnpm dev:desktop` 在跑、已登录 @halliday;`nimi-app dev --shell electron -- --cdp-port <空闲>` 启动;CDP 只挂本 App target;观察签入姿态、`realm.worldCore.list` 与 `ai.text.generateCandidate` 各一个 positive、一个未声明操作(agent.local)的 typed denial、杀 source Runtime 进程后 typed unavailable → 同 Host 恢复、显式退出清理。诚实记 `not_observed`。

## 6. 开放问题与风险(需用户决策)

- **D1 本地持久化**:排期/创意历史留 localStorage 还是迁 `storage.*`(Base 面)?注意 dev origin(127.0.0.1:1450)与 packaged file:// 的 localStorage 不互通。
- **D2 strictPort 竞态**:是否移植 tester 的 ensure-dev-renderer-port.mjs(1450)。
- **D3 发布审查轨道**:ADMISSION.md、.nimi/admission/**、scripts/pack.mjs、local-audit.mjs 在"独立发布外部 app"定位下的去留。本报告不替决策。
- **D4 spec 演进**:.nimi/spec/** 仍是 first-party 世界观(红线只读);如何使权威与 App Access 对齐需要用户给出路径。
- **R-风险1 主流程缺口**:persona CRUD/portfolio/posts/媒体/语音在新契约下无面,CP5 只能给 typed unavailable;产品主流程实质降级,需平台侧登记缺口(不跨仓修)。
- **R-风险2 link 依赖漂移**:平台分支持续推进会反复打破本仓;长期应考虑 published 版本或锁定的 link 目标。
- **R-风险3**:`node_modules/@nimiplatform/sdk` symlink 指向平台仓,其内 `dist-root-owned-stale/` 是平台仓本地 artifacts,非本仓内容,无需动作。

## 7. 引用自检

2026-08-07 随机抽 6 条引用 re-grep(`sed -n` 逐行核对),全部命中:

| # | 引用 | 自检结果 |
|---|---|---|
| 1 | src-electron/main.ts:32 | ✅ 行为 `onProtectedSessionFailure: () => app.quit(),` |
| 2 | nimi/kit/shell/electron/src/main/app-bridge.ts:141-152 | ✅ 确为 `assertExactAppBridgeInput` 的 forbidden-authority-fields 抛错块 |
| 3 | portfolio-data.ts:386-387 | ✅ 确为 `kind: 'permission-missing'` / `title: 'Permission missing'` |
| 4 | nimi/app-tools/lib/app-access-declaration.mjs:41-44 | ✅ 确为 `app_access` 缺失即 throw 的断言块 |
| 5 | local-post-schedule-store.ts:157 | ✅ 确为 `targetStorage.setItem(scheduleKey(personaId), ...)` |
| 6 | studio-copy.ts:1313 | ✅ 确为内嵌 `capability-unavailable` 的中文文案 |

## 8. 续作实施记录（2026-08-08）

### 8.1 远端整合

- 经用户明确确认后，先创建 WIP commit，再把工作树 rebase 到 `origin/main` 的四个新提交之上；当前 WIP commit 为 `7fe2696`。未 push。
- 冲突合并保留了 App Access 最小声明、Electron session-loss 不退出、已删除的 scenario/SharedAIConfig 层，同时吸收远端新增的创建与资产库产品逻辑。
- 冲突后基线曾通过 install、typecheck、37 个测试文件 208 个测试、ESLint、doctor 与 validate。后续平台参考仓出现并发中的 SDK hard-cut，见 8.5。

### 8.2 CP4 — Realm 面切换

- 世界选择器现由 `data/studio-world-core.ts` 调用 `realm.worldCore.list`；列表固定使用 `take: 100`，按 id 的预览读取使用 list + find，找不到返回 `null`，不合成世界数据。
- `data/realm-client.ts` 与其测试已删除；persona、settings、visibility、avatar 等当前无 App Access 对应面的操作统一在函数入口 fail closed，不再接受旧 Realm 注入参数。
- post 客户端的无效 Realm 参数已删除；旧 happy-path 注入测试改为纯 normalizer/builder 或 typed unavailable 断言。
- 边界测试扫描 `src`，拒绝旧 controller 调用前缀与已删除 client import，并确认 world picker 源码消费 `client.realm.worldCore.list`。

### 8.3 CP5 — 缺口产品态与终端文案

- portfolio 读取新增 `capability-unavailable` 信息态；HTTP 401/403 分类改为 `access-denied`，英文与中文主文案均不再使用旧 access-control 词汇。
- posts、identity media、avatar selection、image/avatar-package candidates、voice candidates、Runtime materialization 与 local asset import 的缺口均显示信息态；本地输入校验仍显示错误态。
- toast 的未知原文回退已改为固定本地化文案。reason code 和完整结果对象只允许进入折叠技术区；主文案不显示机器码。
- `src`、`src-electron` 与 `nimi.app.yaml` 已通过禁用词扫描；旧 “not admitted” 产品叙述也已改为当前 Nimi App Access 可用性事实。

### 8.4 CP6 — 本地持久化决策

决策：单一排期 store 与创意历史继续使用 `window.localStorage`。

- 排期使用 `realm-persona-studio.local-post-schedule.{personaId}`，保持单候选、前台到期、app-local 语义。
- 创意历史使用 `realm-persona-studio.creative-asset-history.{personaId}`，保留远端新增的来源、审核状态、draft 关联与聚合读取模型，但默认后端恢复为 app-local `localStorage`。
- 理由：两类数据都是应用私有的离线工作材料，不是 Realm 真值，也不需要跨设备或 Runtime 所有权语义。`storage.*` 由 Runtime 中介，其 session/进程可用性会把纯本地工作流错误地绑定到平台可用性；对这两类数据而言语义更差。
- 不增加迁移、双写、兼容层或 fixture。项目未上线，按当前产品决定硬切。

### 8.5 当前验证状态

- CP4 完成时，应用自身 renderer/electron typecheck、37 个测试文件 185 个测试与 ESLint 均通过。
- CP5/CP6 后、平台下一次并发更新前，`pnpm exec vitest run` 为 37/37 文件、186/186 测试通过，`pnpm exec eslint . --max-warnings 0` 通过；doctor、validate、local-audit、spec consistency、i18n check/audit、`cargo check` 与 `cargo test` 通过。随后新增的“机器码不进入 terminal copy”断言单独运行 4/4 通过。
- 00:09 首次 `pnpm run check` 通过 doctor、validate、local-audit、spec consistency 与 i18n，随后因 SDK 已要求 `agentConfigure` 而当时 Kit surface 尚未提供它，在 renderer typecheck 失败。00:09:34 外部工作流继续更新只读平台 Kit 并补上该 namespace；再次运行 `pnpm typecheck` 又在 Kit 自身 `local-app.ts:391,480` 的两个类型错误处停止。该失败构建还清理了平台 dist，之后全量 Vitest 有 12 个 suite 在平台 SDK protobuf import 阶段失败；25 个文件 128 个测试仍通过。这是同一个只读平台半更新的派生环境故障，不替代前一稳定窗口内的 37/37 应用结果。应用侧没有伪造 namespace、cast 或兼容层；当前全链仍等待平台工作区自洽。

### 8.6 CP7 — 真实 journey 观察表

观察窗口：2026-08-08 00:05–00:07（Asia/Shanghai）。

| 项目 | 结果 | 证据与说明 |
|---|---|---|
| backend 3002 | `observed` | 既有 backend Node 进程监听 TCP 3002；未重启、未改数据。 |
| Desktop + source Runtime | `observed` | Desktop Electron PID 12978；其唯一 source Runtime 子进程 PID 12989，命令为 `.nimi/local/imp3/runtime-local-development/nimi-runtime serve`。未连接 Desktop CDP，未操作 owner UI。 |
| 本 App 启动 | `observed` | `pnpm dev -- --cdp-port 9447` 经 supervisor 启动 host PID 12618；Vite 1450 ready。 |
| 精确 CDP target | `observed` | 9447 `/json` 仅有一个 page target，title `Realm Persona Studio`，URL 精确为 `http://127.0.0.1:1450/`。 |
| 主界面机器码隔离 | `observed` | 页面主文本仅为“无法连接 Nimi / 技术详情 / 重试”；技术错误未出现在展开前的主文案。 |
| `auth.status()` session-bound | `not_observed` | 动态 import 本 App `getStudioLocalAppClient()` 后，client 构造先失败，无法诚实推断登录姿态。 |
| `realm.worldCore.list({take:5})` positive | `not_observed` | 同一 client 构造前置失败，未执行到 Realm 操作。 |
| `ai.text.generateCandidate(...)` positive/合法有界结果 | `not_observed` | 同一 client 构造前置失败，未执行到 AI 操作。 |
| 未声明 `agents.listReferences()` typed denial | `not_observed` | 同一 client 构造前置失败，未执行到 agents 操作。 |
| Runtime loss → unavailable → 同 Host 恢复 | `not_observed` | 未杀 PID 12989。客户端尚未建立时杀 Runtime 无法证明 rebind，只会增加无效扰动。 |
| App 在错误态不退出 | `observed` | client 构造失败后 App 仍保持运行并渲染 fail-closed 重试界面，直到显式 Ctrl-C。 |
| 显式退出与清理 | `observed` | supervisor 报 `Development run stopped`；host PID 12618 退出，1450 与 9447 均无 listener；Desktop PID 12978、Runtime PID 12989 与 backend 3002 均仍在。 |

观察时根因：本 App 在 `studio-platform.ts:12-17` 把 Kit standard shell 交给 SDK；当时 SDK 已要求 exact `agentConfigure` namespace，而 Kit 仍是旧集合，CDP 因此捕获 `SDK_LOCAL_APP_CARRIER_REQUIRED`。App 退出后，外部工作流为 Kit 加入了该 namespace（当前 `kit/shell/renderer/src/bridge/local-app.ts:174,215-225`），但平台 Kit 随即暴露两个自身类型错误（`:391` 与 `:480`），导致无法安全重启 journey。这是只读平台参考仓内部的时间序列，不是本仓缺口；本仓没有用 cast、假 namespace 或直连路径伪造 journey 成功。

### 8.7 续作引用自检

2026-08-08 对以下引用逐行 `nl -ba` 复核：

| # | 引用 | 自检结果 |
|---|---|---|
| 1 | `nimi.app.yaml:10-12` | ✅ 最小 `app_access` 仅含 `realm.data`、`runtime.consume`。 |
| 2 | `src/shell/renderer/data/studio-world-core.ts:14-30` | ✅ world list 走 `client.realm.worldCore.list`，按 id 使用 list + find 并返回 `null`。 |
| 3 | `src-electron/main.ts:27-34` | ✅ bridge input 只有 app id、renderer URL、ipcMain；session 丢失无退出回调。 |
| 4 | `src/shell/renderer/app-shell/auth-provider.tsx:21-35` | ✅ bootstrap 原始错误位于折叠 `details` 技术区。 |
| 5 | `src/shell/renderer/features/portfolio/creative-asset-history.ts:61-78,219-269,316-330` | ✅ 创意历史默认使用 `window.localStorage` 与 Persona 前缀 key。 |
| 6 | `src/shell/renderer/features/portfolio/local-post-schedule-store.ts:118-164` | ✅ 排期读写删均使用 app-local storage key。 |
| 7 | `nimi/sdks/typescript/core/app/local-app-runtime-platform.ts:162-185,241-247` | ✅ SDK 当前 exact namespace 集包含 `agentConfigure`，缺失时产生本次 CDP 捕获的错误。 |
| 8 | `nimi/kit/shell/renderer/src/bridge/local-app.ts:174,215-225,387-395,471-481` | ✅ Kit 后续已加入 `agentConfigure`；当前全链改为被该文件两处自身类型错误阻塞。 |
