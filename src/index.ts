/**
 * Host 半区.
 *
 * 它只做两件事: 声明本插件 profile 条目的 Config schema, 让 Settings 能把偏好
 * 存进 profile 的 patch 层; 以及在装配时报告一次结果. 真正的"把隐藏的注入行
 * 放回对话"完全发生在浏览器半区, 这里不碰任何界面.
 */

import type { Context, Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import {
  DEFAULT_SETTINGS, ENABLED_FIELD, HIDDEN_KINDS_FIELD, PLUGIN_NAME,
  normalizeSettings, type RevealContextSettings,
} from './settings.ts'

export const name = PLUGIN_NAME

/** Loader 与浏览器半区共用的配置形状; 每个字段都是 volatile, 改动不重挂插件. */
export interface Config {
  enabled: Volatile<boolean>
  hiddenKinds: Volatile<string[]>
}

interface ConfigInput {
  enabled?: boolean
  hiddenKinds?: string[]
}

/** 偏好 schema; 默认值与约束只写在这里, 代码里不再维护第二份. */
export const Config: z<ConfigInput, Config> = z.object({
  [ENABLED_FIELD]: z.boolean().default(DEFAULT_SETTINGS.enabled).volatile(),
  [HIDDEN_KINDS_FIELD]: z.array(z.string()).default([...DEFAULT_SETTINGS.hiddenKinds]).volatile(),
})

/**
 * 报告一次装配结果.
 * @param ctx - Host 插件上下文.
 * @param config - Loader 校验后的行配置, 缺省字段已由 schema 填好.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved: RevealContextSettings = normalizeSettings({
    [ENABLED_FIELD]: config.enabled.get(),
    [HIDDEN_KINDS_FIELD]: config.hiddenKinds.get(),
  })
  ctx.logger.info(
    '%s: host loaded, enabled=%s hiddenKinds=%d',
    PLUGIN_NAME,
    String(resolved.enabled),
    resolved.hiddenKinds.length,
  )
}
