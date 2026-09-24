/**
 * 本插件的共享契约: 两个半区必须一致的标识, 持久化偏好形状, 以及未知数据的兜底.
 *
 * 本文件不依赖任何 DSH 运行时包, 因此 Host 与浏览器 bundle 都能引用它.
 */

/**
 * 包名. 它同时是 Loader row id, 浏览器注册 id, 以及 client 半边通过
 * `ctx.configForms` 读配置用的 profile 条目 id.
 */
export const PLUGIN_ID = 'dsh-reveal-context'

/** Host 半边导出、浏览器 factory 也返回的插件模块名. */
export const PLUGIN_NAME = 'reveal-context'

/**
 * 本插件注册的 Chat 节点 kind.
 *
 * 它必须与 DSH 自带的 kind 都不同: 自带的 `context` 被对话视图的可见性
 * 判定整体排除, 只有另起一个 kind 才能让同一批事件重新长出一行.
 */
export const NODE_KIND = 'reveal-context'

/** 总开关字段名. */
export const ENABLED_FIELD = 'enabled'

/** 额外隐藏的 kind 清单字段名. */
export const HIDDEN_KINDS_FIELD = 'hiddenKinds'

/** 用户可调的偏好. */
export interface RevealContextSettings {
  /** 是否把被隐藏的注入行放回对话视图. */
  enabled: boolean
  /** 在这些 source kind 上仍然保持隐藏; 空数组表示不额外排除任何 kind. */
  hiddenKinds: string[]
}

/** 默认全开: 打开开关, 不额外隐藏任何 kind. */
export const DEFAULT_SETTINGS: RevealContextSettings = {
  enabled: true,
  hiddenKinds: [],
}

/**
 * DSH 0.1.7 已知的注入来源, 只用于配置页做参考提示, 不参与判定.
 *
 * 判定始终按消息自带的 `source.kind` 走, 所以新版本新增的来源不需要改这里
 * 也会被显示出来.
 */
export const KNOWN_KINDS = [
  'agent-instructions',
  'skill-catalog',
  'skill-invocation',
  'session-reference',
  'agent-message',
  'team-message',
  'subagent-settled',
  'runtime-context',
  'time-context',
  'tmux-context',
  'plan-mode',
  'model-selection',
  'ptc-mode',
  'user-approval',
  'repeat-tool-reminder',
  'tool-goal',
  'tool-jobs',
  'tool-registry',
  'schedule',
  'webhook',
  'hooks-codex',
  'hooks-claude-code',
  'cordis-host-runner',
] as const

/**
 * 把一个未知形状的配置读成完整偏好.
 * @param section - 配置表单快照里的值, 可能缺失或类型不对.
 * @returns 每个字段都有合法值的偏好.
 */
export function normalizeSettings(section: unknown): RevealContextSettings {
  const source = typeof section === 'object' && section !== null
    ? section as Record<string, unknown>
    : {}
  const raw = source[HIDDEN_KINDS_FIELD]
  const hiddenKinds = Array.isArray(raw)
    ? [...new Set(raw.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
      .map(entry => entry.trim()))]
    : [...DEFAULT_SETTINGS.hiddenKinds]
  return {
    enabled: source[ENABLED_FIELD] !== false,
    hiddenKinds,
  }
}

/**
 * 一条注入消息是否应当被重新显示.
 *
 * 只处理非 user 来源的 user 消息: user 自己发的话本来就由对话视图自己渲染,
 * 交给本插件会重复一行.
 * @param sourceKind - 消息 `source.kind`.
 * @param settings - 当前偏好.
 * @returns 是否显示这一行.
 */
export function shouldReveal(sourceKind: unknown, settings: RevealContextSettings): boolean {
  if (!settings.enabled) return false
  if (typeof sourceKind !== 'string') return false
  const kind = sourceKind.trim()
  if (kind === '' || kind === 'user') return false
  return !settings.hiddenKinds.includes(kind)
}

/**
 * 把配置页里的多行文本读成 kind 清单.
 * @param text - 用户输入, 每行一个 kind, 也接受逗号分隔.
 * @returns 去重后的 kind 清单.
 */
export function parseKindList(text: string): string[] {
  const kinds = text
    .split(/[\n,]/)
    .map(entry => entry.trim())
    .filter(entry => entry !== '')
  return [...new Set(kinds)]
}

/**
 * 把 kind 清单写回配置页的多行文本.
 * @param kinds - 当前清单.
 * @returns 每行一个 kind 的文本.
 */
export function formatKindList(kinds: readonly string[]): string {
  return kinds.join('\n')
}
