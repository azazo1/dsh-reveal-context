/**
 * 让被隐藏的注入行重新长成一种自己的 Chat 节点.
 *
 * 背景: 对话视图的可见性判定 (`isVisibleChatNode`) 会排除 `kind === 'context'`
 * 的节点, 所以 DSH 注入的上下文基本不在对话里显示. 那个判定只看节点的 kind,
 * 因此这里注册**另一个** conversation 定义: 它匹配同一批 `user/message` 事件,
 * 但产出的节点 kind 是自己的 `reveal-context`, 于是能通过判定, 再由本插件的
 * 渲染器画成一行.
 *
 * 引擎对每个事件会依次询问所有定义, 上下文 key 是 `(definition.kind, id)`, 所以
 * DSH 自带的那份定义照旧生成它自己的节点 (被判定排除掉), 两者互不干扰.
 *
 * `ChatNodeDataMap` 是 DSH 公开的 merge-extensible 载荷注册表, 新增一种 kind 是
 * 它设计内的用法; `ChatNodeKind` 随之带上本插件的 kind.
 *
 * 边界 (`0.1.7-rc.2`): 只匹配 `user/message`. 从 0.1.7-rc.2 起 agent loop 会自己
 * 追加 `developer/message` (`source.kind` 为 `tool-registry`, 内容是 `tool-addition`
 * / `tool-removal`), 同时 `isVisibleChatNode` 放宽成"含工具增删块的 context 节点
 * 照旧显示". 这类行已经由 DSH 自己画出来, 本插件再匹配一次只会重复一行, 所以
 * `match` 只认 `user/message`.
 */

import type { ChatNode } from '@deepseek-ai/dsh-client-ui-chat/client'
import type {
  ConversationNodeContext, ConversationNodeDefinition, ConversationStartMatch,
} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { NODE_KIND, shouldReveal, type RevealContextSettings } from '../settings.ts'

/** 一行注入渲染器读到的载荷. */
export interface RevealContextNodeData {
  /** 源事件的 seq, 同时用作排序锚点. */
  readonly seq: number
  /** 源事件的时间戳. */
  readonly time: number
  /** 当时发给模型的可见文本. */
  readonly text: string
  /** 产生这条注入的 `source.kind`. */
  readonly producerKind: string
  /** 行的来源标签: 变化的指令文件路径, 否则退回 kind. */
  readonly label: string
  /** 原始 source, 供展开时查看细节. */
  readonly source: unknown
}

declare module '@deepseek-ai/dsh-client-ui-chat/client' {
  interface ChatNodeDataMap {
    /** 本插件重新显示出来的注入行. */
    'reveal-context': RevealContextNodeData
  }
}

/** 一条注入消息在投影里的状态, 同时也是渲染器读到的载荷. */
type RevealContextState = RevealContextNodeData

/** 注入消息的最小形状. */
interface InjectionMessage {
  readonly content?: unknown
  readonly source?: { readonly kind?: unknown; readonly changes?: unknown }
}

/** 从内容块里取模型可见的文本; 非文本块按原样忽略, 不伪造换行. */
function textOf(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .filter((block): block is { readonly type: 'text'; readonly text: string } => {
      if (typeof block !== 'object' || block === null) return false
      const candidate = block as { readonly type?: unknown; readonly text?: unknown }
      return candidate.type === 'text' && typeof candidate.text === 'string'
    })
    .map(block => block.text)
    .join('')
}

/**
 * 行的来源标签.
 *
 * 指令类注入自带 `changes` 清单, 列出路径比列出 kind 有用; 其余来源退回 kind.
 * @param source - 消息的 source.
 * @returns 折叠状态下显示的标签.
 */
function labelOf(source: InjectionMessage['source']): string {
  const kind = typeof source?.kind === 'string' ? source.kind : ''
  if (Array.isArray(source?.changes)) {
    const paths = source.changes
      .filter((entry): entry is { readonly path: string } => {
        if (typeof entry !== 'object' || entry === null) return false
        return typeof (entry as { readonly path?: unknown }).path === 'string'
      })
      .map(entry => entry.path)
    if (paths.length > 0) return [...new Set(paths)].join(', ')
  }
  return kind
}

/** 把一条已接受的事件读成状态. */
function stateOf(match: ConversationStartMatch): RevealContextState {
  const message = match.event.data as InjectionMessage
  const source = message.source
  return {
    seq: match.event.seq,
    time: match.event.time,
    text: textOf(message.content),
    producerKind: typeof source?.kind === 'string' ? source.kind : '',
    label: labelOf(source),
    source,
  }
}

/**
 * 造出本插件的 conversation 定义.
 *
 * 偏好由 `readSettings` 每次读取: 设置改动后调用方会重新注册本定义, 注册表的
 * 失效通知会让引擎重跑一遍投影, 因此开关不需要刷新页面就能生效.
 * @param readSettings - 读取当前偏好的函数.
 * @returns 注册到 `ctx.uiConversation.events` 的定义.
 */
export function createRevealContextDefinition(
  readSettings: () => RevealContextSettings,
): ConversationNodeDefinition<RevealContextState> {
  return {
    kind: NODE_KIND,
    target: 'chat',

    match(event) {
      // 只认 user/message. `developer/message` 的工具增删行从 0.1.7-rc.2 起由 DSH
      // 自己显示, 这里再匹配一次就是重复行.
      if (event.type !== 'user/message') return null
      // 只显示追加进历史的行: 压缩标记这类 `surfaceOp: 'replace'` 的事件已经由
      // 官方自己呈现, 再匹配一次同样是重复行. 没有 surfaceOp 的旧日志按追加处理.
      if ('surfaceOp' in event && event.surfaceOp !== 'append') return null
      const message = event.data as InjectionMessage
      if (!shouldReveal(message.source?.kind, readSettings())) return null
      return { id: String(event.data.id), role: 'start' }
    },

    start(_context: ConversationNodeContext<RevealContextState>, match) {
      return stateOf(match)
    },

    update(context) {
      return context.state
    },

    buildViewNode(context) {
      const state = context.state
      if (state === undefined) return null
      const location = context.start?.location ?? context.matches[0]?.location ?? { kind: 'unresolved' as const }
      const node: ChatNode<'reveal-context'> = {
        key: context.key,
        kind: NODE_KIND,
        id: context.id,
        target: 'chat',
        anchorSeq: state.seq,
        location,
        visibility: 'visible',
        data: state,
      }
      return node
    },
  }
}
