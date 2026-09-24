/**
 * 注入行的渲染器.
 *
 * 形态完全对齐 DSH 原生的"上下文注入"行: 折叠时是一个 24px 行, 标题旁用官方那个 2px
 * 圆点分隔出来源标签; 展开后是一个 141px 限高、内滚动、带 code-block 背景的正文面板,
 * 所以正文再长也不会把整轮撑开.
 *
 * 本 bundle 不 external 平台模块, React 与官方控件都由 client factory 的 require
 * 注入, 所以这里写成工厂 + createElement.
 */

import type { ReactNode } from 'react'
import type { RevealContextNodeData } from './definition.ts'
import type { RevealContextKey } from './locales.ts'

/** 正文写入 DOM 前的保护上限; 显示高度由 CSS 的 max-height 负责, 不靠截断. */
const MAX_CHARS = 20_000

/** 组件用到的平台模块与官方控件. */
export interface RevealContextRowUi {
  /** module loader 提供的 react. */
  React: {
    createElement: (...args: unknown[]) => ReactNode
    /** React 的 setter 同时接受新值与更新函数. */
    useState: <State>(initial: State) => [State, (next: State | ((previous: State) => State)) => void]
  }
  /** 官方折叠行控件. */
  DisclosureRow: (props: Record<string, unknown>) => ReactNode
  /** 官方上下文图标. */
  Icon: (props: Record<string, unknown>) => ReactNode
}

/** 行组件读到的 props. */
export interface RevealContextRowProps {
  /** 本插件定义的节点, 载荷就是投影出来的状态. */
  readonly node: { readonly data: RevealContextNodeData }
  /** 本插件字典的读取函数. */
  readonly t: (key: RevealContextKey, params?: Record<string, unknown>) => string
}

/**
 * 造出注入行组件.
 * @param ui - React 与官方控件.
 * @returns 注入行组件.
 */
export function createRevealContextRow(ui: RevealContextRowUi): (props: RevealContextRowProps) => ReactNode {
  const { React, DisclosureRow, Icon } = ui
  /** createElement 短写: 本 bundle 不编译 JSX. */
  const el = (type: unknown, props: unknown, ...children: unknown[]): ReactNode =>
    React.createElement.apply(null, [type, props].concat(children) as unknown[])

  return function RevealContextRow(props: RevealContextRowProps): ReactNode {
    const { node, t } = props
    const data = node.data
    const [open, setOpen] = React.useState(false)
    const truncated = data.text.length > MAX_CHARS
    const text = truncated ? data.text.slice(0, MAX_CHARS) : data.text
    const label = data.label === '' ? data.producerKind : data.label

    // 折叠态: 官方注入行同款的圆点加来源标签; 没有来源时不画圆点.
    const collapsedContent = label === ''
      ? undefined
      : [
        el('span', { key: 'sep', className: 'dsh-reveal-context-sep', 'aria-hidden': true }),
        el('span', { key: 'source', className: 'dsh-reveal-context-source' }, label),
      ]

    const body: ReactNode[] = [
      text === ''
        ? el('p', { key: 'empty', className: 'dsh-reveal-context-empty' }, t('emptyBody'))
        : el('div', { key: 'text', className: 'dsh-reveal-context-text' }, text),
    ]
    if (truncated) {
      body.push(el('p', { key: 'truncated', className: 'dsh-reveal-context-truncated' },
        t('truncated', { total: data.text.length })))
    }

    return el(
      DisclosureRow,
      {
        className: 'dsh-reveal-context-root',
        chevronClassName: 'dsh-reveal-context-chevron',
        icon: el(Icon, { size: 14 }),
        title: t('rowTitle'),
        collapsedContent,
        keepContentWhenOpen: true,
        open,
        expandable: true,
        expandOnRowClick: true,
        onToggle: () => { setOpen(value => !value) },
      },
      el('div', { className: 'dsh-reveal-context-body' }, body),
    )
  }
}
