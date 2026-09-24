/**
 * 配置卡片里的字段行.
 *
 * 官方字段控件只覆盖文本与数字, 本插件的布尔开关与清单文本各由这里用官方 Switch
 * 和自绘文本域拼出, 排版沿用官方 fields 的尺寸与间距. 本 bundle 不 external 平台
 * 模块, React 与官方控件都由 client factory 的 require 注入, 所以这里写成工厂 +
 * createElement.
 */

import type { ReactNode } from 'react'

/** 组件用到的平台模块. */
export interface FieldUi {
  /** module loader 提供的 react. */
  React: { createElement: (...args: unknown[]) => ReactNode }
  /** 官方开关控件. */
  Switch: (props: Record<string, unknown>) => ReactNode
  /** 官方标签控件, 用作 "已覆盖" 标记. */
  Tag: (props: Record<string, unknown>) => ReactNode
}

/** 字段行共用的 props. */
export interface FieldRowProps {
  /** 标签与控件的关联 id. */
  id: string
  /** 已本地化的字段标签. */
  label: string
  /** 字段说明. */
  hint: string
  /** 保存后该字段是否留下 user 层条目. */
  overridden: boolean
  /** 覆盖标记的文案. */
  overriddenLabel: string
  /** 重置控件的文案. */
  resetLabel: string
  /** 只读或保存中时锁定控件. */
  disabled: boolean
  /** 暂存清空该字段, 保存后回落到组合层. */
  onReset: () => void
}

/** 开关字段行的 props. */
export interface SwitchFieldProps extends FieldRowProps {
  /** 当前草稿值. */
  checked: boolean
  /** 切换开关. */
  onToggle: (next: boolean) => void
}

/** 文本域字段行的 props. */
export interface TextAreaFieldProps extends FieldRowProps {
  /** 当前草稿文本. */
  value: string
  /** 追加说明, 例如当前 DSH 版本常见的来源. */
  footnote?: string | undefined
  /** 编辑草稿文本. */
  onEdit: (next: string) => void
}

/**
 * 造出字段行的公共外壳与徽标.
 * @param ui - React 与官方控件.
 * @returns 生成一行外壳的函数.
 */
function createRowShell(ui: FieldUi) {
  const { React, Tag } = ui
  /** createElement 短写: 本 bundle 不编译 JSX. */
  const el = (type: unknown, props: unknown, ...children: unknown[]): ReactNode =>
    React.createElement.apply(null, [type, props].concat(children) as unknown[])

  return function row(props: FieldRowProps, control: ReactNode, body?: ReactNode): ReactNode {
    const badges = props.overridden
      ? el('span', { className: 'dsh-reveal-context-badges' },
        el(Tag, { tone: 'neutral' }, props.overriddenLabel),
        el('button', {
          type: 'button',
          className: 'dsh-reveal-context-reset',
          disabled: props.disabled,
          onClick: props.onReset,
        }, props.resetLabel))
      : null

    return el('div', { className: 'dsh-reveal-context-field' },
      el('div', { className: 'dsh-reveal-context-head' },
        el('span', { className: 'dsh-reveal-context-label', id: `${props.id}-label` }, props.label),
        badges,
        control),
      el('p', { className: 'dsh-reveal-context-hint' }, props.hint),
      body ?? null)
  }
}

/**
 * 造出开关字段行组件.
 * @param ui - React 与官方控件.
 * @returns 开关字段行组件.
 */
export function createSwitchField(ui: FieldUi): (props: SwitchFieldProps) => ReactNode {
  const { React, Switch } = ui
  const el = (type: unknown, props: unknown, ...children: unknown[]): ReactNode =>
    React.createElement.apply(null, [type, props].concat(children) as unknown[])
  const row = createRowShell(ui)

  return function SwitchField(props: SwitchFieldProps): ReactNode {
    return row(props, el(Switch, {
      checked: props.checked,
      label: props.label,
      disabled: props.disabled,
      onChange: props.onToggle,
    }))
  }
}

/**
 * 造出文本域字段行组件.
 * @param ui - React 与官方控件.
 * @returns 文本域字段行组件.
 */
export function createTextAreaField(ui: FieldUi): (props: TextAreaFieldProps) => ReactNode {
  const { React } = ui
  const el = (type: unknown, props: unknown, ...children: unknown[]): ReactNode =>
    React.createElement.apply(null, [type, props].concat(children) as unknown[])
  const row = createRowShell(ui)

  return function TextAreaField(props: TextAreaFieldProps): ReactNode {
    const body: ReactNode[] = [
      el('textarea', {
        id: props.id,
        className: 'dsh-reveal-context-textarea',
        value: props.value,
        disabled: props.disabled,
        spellCheck: false,
        'aria-labelledby': `${props.id}-label`,
        onChange: (event: { target: { value: string } }) => { props.onEdit(event.target.value) },
      }),
    ]
    if (props.footnote !== undefined) {
      body.push(el('p', { className: 'dsh-reveal-context-hint' }, props.footnote))
    }
    return row(props, null, body)
  }
}
