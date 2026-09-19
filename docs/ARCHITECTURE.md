# 代码结构与修改边界

这份说明用于避免功能继续堆回 `app/page.tsx`。新增功能时应先找到所属模块；没有合适位置时，新建单一职责文件，不要把完整功能直接写进页面入口。

## 页面层

- `app/page.tsx`：游戏流程编排与各模块连接，不负责实现完整侧栏、联机或存档系统。
- `components/game/landing-screen.tsx`：创建与加入世界。
- `components/game/world-header.tsx`：世界历、阳寿、房间码和 PVP 状态。
- `components/game/sidebar-navigation.tsx`：命格、行囊、同伴三个侧栏入口。
- `components/game/character-panel.tsx`：灵根、五维、气血与灵力。
- `components/game/inventory-panel.tsx`：背包、功法、技法与道具操作。
- `components/game/judgement-panel.tsx`：事件与木傀儡试炼的骰子判定。
- `components/game/companions-panel.tsx`：玩家列表、自由行动、残魂复活和多人规则。

## 浏览器状态与流程

- `hooks/use-game-content.ts`：读取并校验可编辑 JSON 内容。
- `hooks/use-multiplayer-room.ts`：创建/加入房间、房间轮询、邀请链接和房间 API 操作。
- `hooks/use-local-life.ts`：本地人物存档、前世归档和现实时间推进。
- `hooks/use-free-actions.ts`：人物/道具自由行动的目标、概率、结算与效果。
- `lib/client/game-session.ts`：浏览器会话和房间类型。
- `lib/client/action-selection.ts`：自由行动选择常量与目标描述。
- `lib/client/ui-content.ts`：界面文字默认值与合并规则。

## Windows 启动器

- `scripts/start-online.ps1`：只负责按顺序调用各启动阶段。
- `scripts/launcher/core.ps1`：错误处理、互斥锁和启动提示。
- `scripts/launcher/runtime.ps1`：Node.js、pnpm 与依赖准备。
- `scripts/launcher/project.ps1`：项目检查、构建、存档迁移和内容同步。
- `scripts/launcher/online.ps1`：本地服务、Cloudflare 临时网址与浏览器打开。
- `scripts/tests/test-launcher-modules.ps1`：启动器模块的最小回归测试。

## 修改原则

1. 文案、事件、道具、数值优先修改 `public/游戏内容/` 的 JSON。
2. 纯显示放入 `components/game/`，浏览器状态与流程放入 `hooks/`，规则计算放入 `lib/`。
3. `app/page.tsx` 只连接模块；若新增代码超过一个完整功能块，应先拆文件。
4. 启动器新增步骤放入对应的 `scripts/launcher/` 模块，不再扩充总入口。
5. 提交前至少运行：`pnpm lint`、`pnpm build`、`pnpm content:check`、`pnpm actions:simulate` 与启动器模块测试。
