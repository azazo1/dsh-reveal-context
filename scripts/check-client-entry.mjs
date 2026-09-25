/**
 * 浏览器产物的入口检查.
 *
 * 在 Node VM 里用桩 loader 执行 `lib/client.js`, 断言: 注册 id 等于包名, factory 只
 * 向平台模块表要依赖, 插件面导出了预期的服务注入, 以及 apply 真的注册了
 * conversation 定义, 行渲染器和配置卡片.
 */
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const packageName = require('../package.json').name
const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

/** 用一行可操作的信息让检查失败. */
function check(condition, message) {
  if (!condition) throw new Error(`client entry check: ${message}`)
}

check(!/^\s*import\s/m.test(source), 'the bundle keeps a top-level ESM import')
check(!/^\s*export\s/m.test(source), 'the bundle keeps a top-level ESM export')

const registrations = []
const document = {
  head: { appendChild() {} },
  querySelector: () => null,
  createElement: () => ({ dataset: {}, textContent: '', remove() {} }),
}
const window = { __ModuleLoader__: { load: registration => { registrations.push(registration) } } }

vm.runInNewContext(source, { window, document, console }, { filename: 'lib/client.js' })

check(registrations.length === 1, `expected one loader registration, saw ${registrations.length}`)
const [registration] = registrations
check(registration.id === packageName, `registration id "${registration.id}" is not the package name "${packageName}"`)

const requested = []
const componentStub = () => null
const fakeRequire = (specifier) => {
  requested.push(specifier)
  if (specifier === 'react') {
    return { createElement: () => null, useState: value => [value, () => {}] }
  }
  if (specifier === '@deepseek-ai/dsh-client-ui-primitives') {
    // 表单模型的桩只要够 apply 构造卡片即可: 真实的挂载在运行中的 web 实例里验证.
    class SettingsFormModelStub {
      bind(project) {
        return { getSnapshot: project, subscribe: () => () => {} }
      }
      shell() {
        return { writable: true, saving: false, failed: false }
      }
      field() {
        return { text: '', overridden: false }
      }
      actions() {
        return { edit() {}, resetField() {}, save() {}, discard() {} }
      }
      dispose() {}
    }
    return {
      DisclosureRow: componentStub,
      IconContextInjectionOutlineRegular: componentStub,
      SettingsForm: componentStub,
      SettingsFormModel: SettingsFormModelStub,
      Switch: componentStub,
      Tag: componentStub,
    }
  }
  throw new Error(`unexpected module-table request: ${specifier}`)
}

const face = registration.factory(fakeRequire)
check(face.name === 'reveal-context', `plugin module name "${face.name}" is unexpected`)
const inject = [...face.inject].sort()
check(
  JSON.stringify(inject) === JSON.stringify(['configForms', 'locale', 'slots', 'uiConversation']),
  `inject list is ${JSON.stringify(inject)}`,
)
check(typeof face.apply === 'function', 'the plugin face exports no apply function')
check(
  requested.includes('react') && requested.includes('@deepseek-ai/dsh-client-ui-primitives'),
  `the factory resolved ${JSON.stringify(requested)}`,
)

// 真的跑一遍 apply, 断言三处注册: conversation 定义, 行渲染器, 配置卡片.
const definitions = []
const slotInjections = []
const slotRegistrations = []
const effects = []
const localeNamespaces = []
const ctx = {
  logger: { info() {}, warn() {}, debug() {} },
  configForms: {
    get(namespace) {
      check(namespace === packageName, `configForms.get("${namespace}") is not the package name`)
      return {
        getSnapshot: () => ({ value: { enabled: true, hiddenKinds: [] } }),
        subscribe: () => () => {},
      }
    },
    whileServed(_ids, register) {
      register()
      return () => {}
    },
  },
  locale: {
    register(namespace) {
      localeNamespaces.push(namespace)
      return () => {}
    },
  },
  slots: {
    inject(name, factory) {
      slotInjections.push(name)
      factory()
    },
    register(options, component) {
      slotRegistrations.push({ options, component })
      return () => {}
    },
  },
  uiConversation: {
    events: {
      register(definition) {
        definitions.push(definition)
        return () => {}
      },
    },
  },
  effect(callback) {
    effects.push(callback)
  },
}

face.apply(ctx)
for (const effect of effects) effect()

check(definitions.length === 1, `apply registered ${definitions.length} conversation definitions`)
const [definition] = definitions
check(definition.kind === 'reveal-context', `definition kind "${definition.kind}" is unexpected`)
check(definition.target === 'chat', `definition target "${definition.target}" is unexpected`)

// 定义的核心行为: 接受非 user 来源的 user 消息, 拒绝用户自己发的话.
const eventOf = source => ({
  type: 'user/message',
  seq: 7,
  time: 1_700_000_000_000,
  data: { id: 'm-1', content: [{ type: 'text', text: 'hello' }], source },
})
check(
  definition.match(eventOf({ kind: 'agent-instructions' }))?.role === 'start',
  'the definition does not match an injected context message',
)
check(
  definition.match(eventOf({ kind: 'user' })) === null,
  'the definition matches a plain user message and would duplicate the row',
)
check(
  definition.match({ type: 'assistant/message', seq: 8, time: 0, data: {} }) === null,
  'the definition matches an assistant message',
)
// 0.1.7-rc.2 起 agent loop 会追加 developer/message 记录工具增删, 而 isVisibleChatNode
// 已经让这类 context 行自己显示; 本插件再匹配一次就是重复行.
check(
  definition.match({
    type: 'developer/message',
    seq: 9,
    time: 0,
    data: {
      turn: 1,
      step: 1,
      message: {
        id: 'developer-1',
        role: 'developer',
        source: { kind: 'tool-registry' },
        content: [{ type: 'tool-addition', toolName: 'search' }],
      },
    },
  }) === null,
  'the definition matches a developer/message tool-registry row and would duplicate it',
)
// 压缩标记 (compact-checkpoint) 是 surfaceOp: 'replace' 的 user/message, 官方已经
// 自己画了压缩行; 本插件只认追加进历史的行, 否则会重复. append 表面的消息不受影响.
check(
  definition.match({
    ...eventOf({ kind: 'compact-checkpoint' }),
    surfaceOp: 'replace',
  }) === null,
  'the definition matches a replace-surface compaction row and would duplicate it',
)
check(
  definition.match({
    ...eventOf({ kind: 'compact-checkpoint' }),
    surfaceOp: 'append',
  })?.role === 'start',
  'the definition dropped an append-surface injected message',
)

const node = definition.buildViewNode({
  key: 'reveal-context\u0000m-1',
  kind: 'reveal-context',
  id: 'm-1',
  matches: [],
  start: { event: eventOf({ kind: 'agent-instructions' }), role: 'start', location: { kind: 'unresolved' } },
  state: definition.start(undefined, {
    event: eventOf({ kind: 'agent-instructions' }),
    role: 'start',
    location: { kind: 'unresolved' },
  }),
  current: new Map(),
})
check(node !== null && node !== undefined, 'buildViewNode returned nothing for an accepted message')
check(node.kind === 'reveal-context', `node kind "${node.kind}" is unexpected`)
check(node.visibility === 'visible', `node visibility "${node.visibility}" would keep the row hidden`)

check(slotInjections.includes('conversation.chat.node'), `apply did not inject the chat node slot: ${JSON.stringify(slotInjections)}`)
const row = slotRegistrations.find(entry => entry.options.name === 'conversation.chat.node')
check(row !== undefined, 'apply did not register a conversation.chat.node renderer')
check(row.options.key === 'reveal-context', `row key "${row.options.key}" is unexpected`)
const card = slotRegistrations.find(entry => entry.options.name === 'plugins.bundle.config')
check(card !== undefined, 'apply did not register a plugins.bundle.config card')
check(card.options.key === packageName, `card key "${card.options.key}" !== ${packageName}`)
check(localeNamespaces.includes(packageName), `apply did not register the ${packageName} dictionary`)

console.log(`${packageName}: client entry check passed (${requested.join(', ')})`)
