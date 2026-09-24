/**
 * 插件页里本插件的配置页.
 *
 * 页面只在 Host 真的组合了本条目的期间注册 (configForms.whileServed).
 * 本 bundle 不 external 平台模块, React 与官方控件都由 client factory 的 require 注入.
 */

import type { ReactNode } from 'react'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import { ENABLED_FIELD, HIDDEN_KINDS_FIELD } from '../settings.ts'
import type { SwitchFieldProps, TextAreaFieldProps } from './fields.ts'
import { formLabels, type RevealContextKey } from './locales.ts'
import type { RevealContextCardFace } from './settings-form.ts'

/** 组件用到的平台模块与官方控件. */
export interface RevealContextCardUi {
  /** module loader 提供的 react. */
  React: { createElement: (...args: unknown[]) => ReactNode }
  /** 官方整页表单框架. */
  SettingsForm: (props: Record<string, unknown>) => ReactNode
  /** 本插件的开关字段行组件. */
  SwitchField: (props: SwitchFieldProps) => ReactNode
  /** 本插件的文本域字段行组件. */
  TextAreaField: (props: TextAreaFieldProps) => ReactNode
}

/** 组件 props 里本插件读取的字段. */
export type RevealContextCardProps = InjectFace<RevealContextCardFace> & {
  /** 页面问的视图: summary 给一行简介, page 给完整表单. */
  readonly view: 'summary' | 'page'
  /** 本插件字典的读取函数. */
  readonly t: (key: RevealContextKey, params?: Record<string, unknown>) => string
}

/**
 * 造出插件页卡片组件.
 * @param ui - React 与官方控件.
 * @returns 卡片组件.
 */
export function createRevealContextCard(ui: RevealContextCardUi): (props: RevealContextCardProps) => ReactNode {
  const { React, SettingsForm, SwitchField, TextAreaField } = ui
  /** createElement 短写: 本 bundle 不编译 JSX. */
  const el = (type: unknown, props: unknown, ...children: unknown[]): ReactNode =>
    React.createElement.apply(null, [type, props].concat(children) as unknown[])

  return function RevealContextCard(props: RevealContextCardProps): ReactNode {
    const { t } = props
    const state = props.useRevealContextCard(snapshot => snapshot)
    if (props.view === 'summary') return t('description')
    const disabled = !state.writable

    return el(
      SettingsForm,
      { labels: formLabels(t), state, onSave: props.save, onDiscard: props.discard },
      el(SwitchField, {
        key: ENABLED_FIELD,
        id: `plugin-config-reveal-context-${ENABLED_FIELD}`,
        label: t('enabled'),
        hint: t('enabledHint'),
        checked: state.enabled.text === 'true',
        overridden: state.enabled.overridden,
        overriddenLabel: t('overridden'),
        resetLabel: t('reset'),
        disabled,
        onToggle: (next: boolean) => { props.edit(ENABLED_FIELD, next ? 'true' : 'false') },
        onReset: () => { props.resetField(ENABLED_FIELD) },
      }),
      el(TextAreaField, {
        key: HIDDEN_KINDS_FIELD,
        id: `plugin-config-reveal-context-${HIDDEN_KINDS_FIELD}`,
        label: t('hiddenKinds'),
        hint: t('hiddenKindsHint'),
        footnote: t('knownKinds'),
        value: state.hiddenKinds.text,
        overridden: state.hiddenKinds.overridden,
        overriddenLabel: t('overridden'),
        resetLabel: t('reset'),
        disabled,
        onEdit: (next: string) => { props.edit(HIDDEN_KINDS_FIELD, next) },
        onReset: () => { props.resetField(HIDDEN_KINDS_FIELD) },
      }),
    )
  }
}
