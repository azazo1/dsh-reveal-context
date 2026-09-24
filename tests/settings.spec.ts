import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS, HIDDEN_KINDS_FIELD, ENABLED_FIELD,
  formatKindList, normalizeSettings, parseKindList, shouldReveal,
} from '../src/settings.ts'

describe('normalizeSettings', () => {
  it('缺失或类型不对的配置回落到默认值', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings('nonsense')).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings({ [HIDDEN_KINDS_FIELD]: 'not-an-array' })).toEqual(DEFAULT_SETTINGS)
  })

  it('只有显式 false 才关闭总开关', () => {
    expect(normalizeSettings({ [ENABLED_FIELD]: false }).enabled).toBe(false)
    expect(normalizeSettings({ [ENABLED_FIELD]: 'false' }).enabled).toBe(true)
  })

  it('清单会去掉空项与重复项', () => {
    const settings = normalizeSettings({ [HIDDEN_KINDS_FIELD]: ['runtime-context', ' runtime-context ', '', 7] })
    expect(settings.hiddenKinds).toEqual(['runtime-context'])
  })
})

describe('shouldReveal', () => {
  it('总开关关闭时一条都不显示', () => {
    expect(shouldReveal('agent-instructions', { enabled: false, hiddenKinds: [] })).toBe(false)
  })

  it('用户自己发的话不归本插件管', () => {
    expect(shouldReveal('user', DEFAULT_SETTINGS)).toBe(false)
    expect(shouldReveal('', DEFAULT_SETTINGS)).toBe(false)
    expect(shouldReveal(undefined, DEFAULT_SETTINGS)).toBe(false)
  })

  it('清单里的来源保持隐藏, 其余显示', () => {
    const settings = { enabled: true, hiddenKinds: ['runtime-context'] }
    expect(shouldReveal('runtime-context', settings)).toBe(false)
    expect(shouldReveal('agent-instructions', settings)).toBe(true)
    expect(shouldReveal('a-brand-new-source', settings)).toBe(true)
  })
})

describe('kind 清单文本', () => {
  it('每行一个, 也接受逗号, 并去重', () => {
    expect(parseKindList('runtime-context\n time-context ,runtime-context')).toEqual(['runtime-context', 'time-context'])
    expect(parseKindList('   ')).toEqual([])
  })

  it('写回后能原样读回', () => {
    const kinds = ['agent-instructions', 'runtime-context']
    expect(parseKindList(formatKindList(kinds))).toEqual(kinds)
  })
})
