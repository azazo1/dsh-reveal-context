# dsh-reveal-context

把 DSH 在对话里隐藏掉的**上下文注入行**重新显示出来.

## 背景

DSH 的对话视图会排除注入行. `0.1.7-rc.2` 起只放过含工具增删块的 `context` 节点. 判定在 `isVisibleChatNode` 里:

```ts
return node.visibility === 'visible'
  && node.kind !== 'system-prompt'
  && (node.kind !== 'context'
    || node.data.content.some(block => block.type === 'tool-addition' || block.type === 'tool-removal'))
  && !(node.kind === 'command' && node.data.name === 'permission')
```

也就是 `context` 这一类节点基本不在对话里渲染. 想看一眼当时到底注入了什么, 只能切到轨迹视图.

本插件不修改 DSH 源码, 而是注册**另一个** conversation 定义: 它匹配同一批 `user/message` 事件, 但产出的节点 kind 是自己的 `reveal-context`, 于是能通过上面那条判定, 再由本插件自己的渲染器画成一行. 引擎对每个事件会依次询问所有定义, 上下文 key 是 `(definition.kind, id)`, 所以 DSH 自带的那份定义照旧工作, 两者互不干扰.

`ChatNodeDataMap` 是 DSH 公开的 merge-extensible 载荷注册表, 新增一种节点 kind 是它设计内的用法.

## 安装

Web 端装进 `web` profile:

```shell
dsh plugin --profile web add azazo1/dsh-reveal-context
```

装完重启 `dsh web`, 浏览器里刷新一次页面.

桌面端装进 `desktop` profile. 它由 Electron 应用独占管理, `dsh plugin` 会拒绝 `--profile desktop`, 所以要用应用内的插件管理器: 在插件页的安装入口填上面命令里对应的包名或本地目录. 装上后重启应用, 窗口刷新一次.

引擎版本线要求 `@deepseek-ai/dsh-*` 不低于 `0.1.7-rc.2`, 且仍在 `0.1.x` 上 (peerDependencies 与 devDependencies 都写作 `>=0.1.7-rc.2 <0.2.0`). 更早的引擎线装不上这个版本.

web 与 desktop 两个 profile 跑的是同一套 Web 应用, 桌面端只是多起一个 Host 子进程并给 `<html>` 打上平台标记, 所以同一份包在两边通用, 不需要分别构建.

## 使用

打开 设置 → 插件 → dsh-reveal-context:

| 字段 | 说明 |
| --- | --- |
| 显示被隐藏的注入行 | 总开关, 默认打开. 关掉后对话恢复成 DSH 默认的样子 |
| 仍然隐藏的来源 | 每行一个 `source.kind`, 逗号分隔也可以. 留空表示一个都不排除 |

偏好存在 profile 的 patch 层, 改完立即生效, 不需要刷新页面.

默认会显示全部来源, 包括每步刷新的 `runtime-context` 之类的环境快照. 环境快照是 `form: 'snapshot'`, 后一条替换前一条, 所以各自只占一行; 觉得吵就把它填进"仍然隐藏的来源".

## 边界

- 只覆盖 `user/message` 上的非 user 来源, 也就是 `context` 这一类. `system-prompt` 行和 `permission` 命令行是别的 kind 和事件, 不在本插件范围内.
- `developer/message` 也不在范围内. 从 `0.1.7-rc.2` 起 agent loop 会自己追加这类事件, 内容是 `tool-registry` 的工具增删 (`tool-addition` / `tool-removal`), 而 `isVisibleChatNode` 同时放宽成"含工具增删块的 `context` 节点照旧显示", 所以这些行由 DSH 自己画出来. 本插件再去匹配只会多出一行.
- 行渲染器读的是源事件的 `content` 与 `source`, 这些都是持久化事件的字段; 节点形状 (`key` / `kind` / `id` / `target` / `anchorSeq` / `location` / `visibility` / `data`) 沿用 DSH 当前版本内部使用的形状, 没有对外承诺, DSH 升级后可能需要跟进.

## License

MIT
