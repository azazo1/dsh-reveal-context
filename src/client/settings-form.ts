/**
 * 配置卡片的暂存表单.
 *
 * 表单是 profile 条目 volatile Config 的投影: 草稿只留在卡片页, 保存才写回
 * profile 的 patch 层.
 */

import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type {
  SettingsFieldSpec, SettingsFieldState, SettingsFormActions,
  SettingsFormScope, SettingsFormShell,
} from '@deepseek-ai/dsh-client-ui-primitives'
import {
  ENABLED_FIELD, HIDDEN_KINDS_FIELD, formatKindList, parseKindList, type RevealContextSettings,
} from '../settings.ts'

/**
 * 官方 SettingsFormModel 的构造器形状.
 * 本 bundle 不 external 平台模块, 真实实现由 client factory 从 module loader 注入.
 */
export interface SettingsFormModelLike {
  new (scope: SettingsFormScope<RevealContextSettings>, specs: readonly SettingsFieldSpec[]): {
    bind<S>(project: () => S): SnapshotStore<S>
    shell(): SettingsFormShell
    field(name: string): SettingsFieldState
    actions(): SettingsFormActions
    dispose(): void
  }
}

/**
 * 布尔字段的草稿编码: 官方模型只解析文本字段, 布尔值以 `true` / `false` 暂存.
 * @param field - 字段名.
 * @returns 该字段的转换描述.
 */
function settingsBooleanField(field: string): SettingsFieldSpec {
  return {
    field,
    format: value => typeof value === 'boolean' ? String(value) : '',
    parse: text => text === 'true'
      ? { kind: 'set', value: true }
      : text === 'false'
        ? { kind: 'set', value: false }
        : undefined,
  }
}

/**
 * 清单字段的草稿编码: 数组与多行文本互转, 空文本表示空清单.
 * @param field - 字段名.
 * @returns 该字段的转换描述.
 */
function settingsKindListField(field: string): SettingsFieldSpec {
  return {
    field,
    format: value => Array.isArray(value)
      ? formatKindList(value.filter((entry): entry is string => typeof entry === 'string'))
      : '',
    parse: text => ({ kind: 'set', value: parseKindList(text) }),
  }
}

/** 卡片读到的状态: 总开关加仍然隐藏的来源清单. */
export interface RevealContextCardState extends SettingsFormShell {
  /** 是否把隐藏的注入行放回对话. */
  enabled: SettingsFieldState
  /** 仍然隐藏的 source.kind 清单, 以多行文本编辑. */
  hiddenKinds: SettingsFieldState
}

/** 卡片注册时注入给组件的面. */
export interface RevealContextCardFace extends SettingsFormActions {
  hooks: {
    /** 组件通过它读快照 (useRevealContextCard). */
    revealContextCard: SnapshotStore<RevealContextCardState>
  }
}

/** 把本插件条目的配置表单桥接成配置卡片的暂存表单. */
export class RevealContextSettingsForm {
  private readonly form: InstanceType<SettingsFormModelLike>
  private readonly store: SnapshotStore<RevealContextCardState>

  /**
   * @param scope - 本插件 profile 条目的共享配置表单 (ctx.configForms.get).
   * @param SettingsFormModel - 官方表单模型构造器.
   */
  constructor(scope: SettingsFormScope<RevealContextSettings>, SettingsFormModel: SettingsFormModelLike) {
    this.form = new SettingsFormModel(scope, [
      settingsBooleanField(ENABLED_FIELD),
      settingsKindListField(HIDDEN_KINDS_FIELD),
    ])
    this.store = this.form.bind(() => ({
      ...this.form.shell(),
      enabled: this.form.field(ENABLED_FIELD),
      hiddenKinds: this.form.field(HIDDEN_KINDS_FIELD),
    }))
  }

  /**
   * 构造 slot 注册要注入的面.
   * @returns 快照 hook 与表单动作.
   */
  inject(): RevealContextCardFace {
    return { hooks: { revealContextCard: this.store }, ...this.form.actions() }
  }

  /** 释放对配置表单的订阅. */
  dispose(): void {
    this.form.dispose()
  }
}
