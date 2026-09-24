/** 本插件配置卡片与注入行的文案, 中英双语. */

import type { SettingsFormLabels } from '@deepseek-ai/dsh-client-ui-primitives'
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'

/** 本插件字典的命名空间, 与包名一致. */
export const LOCALE_NS = 'dsh-reveal-context'

/** 本插件用到的文案键. */
export type RevealContextKey =
  | 'description'
  | 'rowTitle' | 'emptyBody' | 'truncated'
  | 'enabled' | 'enabledHint'
  | 'hiddenKinds' | 'hiddenKindsHint'
  | 'knownKinds'
  | 'overridden' | 'reset'
  | 'readOnly' | 'unavailable' | 'save' | 'saving' | 'saveFailed'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** 本插件配置卡片与注入行的文案. */
    'dsh-reveal-context': RevealContextKey
  }
}

export const zh: LocaleDictOf<typeof LOCALE_NS> = {
  description: '把 DSH 在对话里隐藏掉的上下文注入行重新显示出来, 例如 AGENTS.md 变化通知, 技能目录, 被引用的会话与环境快照.',
  rowTitle: '注入上下文',
  emptyBody: '这条注入没有可见文本.',
  truncated: '正文已截断, 全文共 {{total}} 个字符.',
  enabled: '显示被隐藏的注入行',
  enabledHint: '关掉后对话恢复成 DSH 默认的样子, 下面那份清单原样保留.',
  hiddenKinds: '仍然隐藏的来源',
  hiddenKindsHint: '每行一个 source.kind, 也可以用逗号分隔. 留空表示一个都不排除.',
  knownKinds: '当前 DSH 版本常见的来源: agent-instructions, skill-catalog, skill-invocation, session-reference, runtime-context, time-context, tmux-context, plan-mode, model-selection, user-approval, repeat-tool-reminder, hooks-codex, hooks-claude-code 等. 未列出的新来源默认也会显示.',
  overridden: '已覆盖',
  reset: '恢复默认',
  readOnly: '本部署的设置为只读.',
  unavailable: '该插件当前未加载, 暂时无法配置.',
  save: '保存',
  saving: '保存中...',
  saveFailed: '本部署没有接受这些值, 已保留供你修改.',
}

export const en: LocaleDictOf<typeof LOCALE_NS> = {
  description: 'Bring back the context-injection rows DSH hides from the transcript: AGENTS.md notices, skill catalogs, recalled sessions, runtime snapshots.',
  rowTitle: 'Context injection',
  emptyBody: 'This injection carries no visible text.',
  truncated: 'Body truncated; the full text is {{total}} characters.',
  enabled: 'Show hidden injection rows',
  enabledHint: 'Turning this off restores the stock transcript; the list below keeps its own value.',
  hiddenKinds: 'Sources still hidden',
  hiddenKindsHint: 'One source.kind per line, commas also accepted. Leave empty to exclude nothing.',
  knownKinds: 'Sources common in this DSH version: agent-instructions, skill-catalog, skill-invocation, session-reference, runtime-context, time-context, tmux-context, plan-mode, model-selection, user-approval, repeat-tool-reminder, hooks-codex, hooks-claude-code, and more. Unlisted new sources show up by default.',
  overridden: 'Overridden',
  reset: 'Reset to default',
  readOnly: 'This deployment stores settings read-only.',
  unavailable: 'This plugin is not loaded, so it cannot be configured right now.',
  save: 'Save',
  saving: 'Saving...',
  saveFailed: 'The deployment did not accept these values; they were left for you to correct.',
}

/**
 * 表单框架要的文案, 从本插件字典取.
 * @param t - 本插件字典的读取函数.
 * @returns 共享设置表单渲染的标签.
 */
export function formLabels(t: (key: RevealContextKey) => string): SettingsFormLabels {
  return {
    unavailable: t('unavailable'),
    readOnly: t('readOnly'),
    saveFailed: t('saveFailed'),
    save: t('save'),
    saving: t('saving'),
  }
}
