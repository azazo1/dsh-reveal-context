/**
 * 浏览器半区.
 *
 * bundle 先用页面全局的 module loader 注册自己, 然后把"被隐藏的注入行"接回对话:
 * 注册一个自定义 conversation 定义 (kind 为 `reveal-context`) 与它的行渲染器, 并在
 * 插件页提供一张配置卡片. 不改 DSH 源码, 也不改 DSH 自带定义.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ReactNode } from 'react'
// 类型侧合并: ctx.slots / ctx.configForms / ctx.locale / ctx.uiConversation, 以及
// `conversation.chat.node` 这个 keyed slot 的声明.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  NODE_KIND, PLUGIN_ID, PLUGIN_NAME, normalizeSettings, type RevealContextSettings,
} from '../settings.ts'
import { createRevealContextDefinition } from './definition.ts'
import { createSwitchField, createTextAreaField } from './fields.ts'
import { LOCALE_NS, en, zh } from './locales.ts'
import { createRevealContextRow } from './row.ts'
import { createRevealContextCard } from './settings-card.ts'
import { RevealContextSettingsForm, type SettingsFormModelLike } from './settings-form.ts'
import { injectStyles } from './styles.ts'

/** 一个交给页面全局 loader 门面的 bundle 注册. */
interface ClientBundleRegistration {
  /** 包名; 必须与 {@link PLUGIN_ID} 相等. */
  id: string
  /** 持有 bundle 主体的闭包, 依赖由 loader 的模块表解析. */
  factory: (require: (specifier: string) => unknown) => Record<string, unknown>
}

declare global {
  interface Window {
    /** Web shell 安装的页面全局注册门面. */
    __ModuleLoader__?: { load(registration: ClientBundleRegistration): void }
  }
}

/** 平台模块表里可用的 react 面. */
interface ReactLike {
  createElement: (...args: unknown[]) => ReactNode
  /** React 的 setter 同时接受新值与更新函数. */
  useState: <State>(initial: State) => [State, (next: State | ((previous: State) => State)) => void]
}

/** 平台模块表里可用的官方控件面. */
interface PrimitivesLike {
  DisclosureRow: (props: Record<string, unknown>) => ReactNode
  IconContextInjectionOutlineRegular: (props: Record<string, unknown>) => ReactNode
  SettingsForm: (props: Record<string, unknown>) => ReactNode
  SettingsFormModel: SettingsFormModelLike
  Switch: (props: Record<string, unknown>) => ReactNode
  Tag: (props: Record<string, unknown>) => ReactNode
}

const loader = window.__ModuleLoader__
if (loader === undefined) {
  throw new Error(`${PLUGIN_ID}: window.__ModuleLoader__ is missing; the browser half must load as a DSH client bundle`)
}

loader.load({
  id: PLUGIN_ID,
  factory: (require) => {
    const React = require('react') as ReactLike
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives') as PrimitivesLike
    const SwitchField = createSwitchField({ React, Switch: primitives.Switch, Tag: primitives.Tag })
    const TextAreaField = createTextAreaField({ React, Switch: primitives.Switch, Tag: primitives.Tag })
    const Row = createRevealContextRow({
      React,
      DisclosureRow: primitives.DisclosureRow,
      Icon: primitives.IconContextInjectionOutlineRegular,
    })
    const Card = createRevealContextCard({
      React,
      SettingsForm: primitives.SettingsForm,
      SwitchField,
      TextAreaField,
    })

    return {
      name: PLUGIN_NAME,
      inject: ['slots', 'locale', 'configForms', 'uiConversation'],

      apply(ctx: ClientContext): void {
        const form = ctx.configForms.get<RevealContextSettings>(PLUGIN_ID)
        let settings = normalizeSettings(form.getSnapshot().value)
        /** 定义每次判定时读当前偏好, 因此这里必须返回最新的那一份. */
        const readSettings = (): RevealContextSettings => settings

        injectStyles()
        ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), `${PLUGIN_ID}: dictionaries`)

        // 定义本身随偏好重新注册: 注册表的失效通知会让引擎重跑一遍投影, 所以
        // 改开关或清单后不需要刷新页面.
        let disposeDefinition: (() => void) | undefined
        ctx.effect(() => {
          const syncDefinition = (): void => {
            disposeDefinition?.()
            disposeDefinition = ctx.uiConversation.events.register(createRevealContextDefinition(readSettings))
          }
          syncDefinition()
          const stop = form.subscribe(() => {
            settings = normalizeSettings(form.getSnapshot().value)
            syncDefinition()
          })
          return () => {
            stop()
            disposeDefinition?.()
            disposeDefinition = undefined
          }
        }, `${PLUGIN_ID}: reveal definition`)

        // 节点 kind 是本插件自己的, 渲染器就注册在这个 key 上; DSH 自带的 `context`
        // 渲染器不受影响.
        ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
          name: 'conversation.chat.node',
          key: NODE_KIND,
          locale: LOCALE_NS,
        }, Row))

        const card = new RevealContextSettingsForm(form, primitives.SettingsFormModel)
        ctx.effect(() => () => { card.dispose() }, `${PLUGIN_ID}: settings form`)
        // Served entries gate the card: an entry the Host does not expose has no
        // settings behind it, so the card stays off the Plugins page.
        ctx.effect(() => ctx.configForms.whileServed([PLUGIN_ID], () => ctx.slots.inject(
          'plugins.bundle.config',
          () => ctx.slots.register({
            name: 'plugins.bundle.config',
            key: PLUGIN_ID,
            locale: LOCALE_NS,
            inject: () => card.inject(),
          }, Card),
        )), `${PLUGIN_ID}: plugins page card`)

        ctx.logger.info('%s: client applying, enabled=%s', PLUGIN_ID, String(settings.enabled))
      },
    }
  },
})
