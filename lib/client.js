(function() {
	//#region src/settings.ts
	/**
	* 本插件的共享契约: 两个半区必须一致的标识, 持久化偏好形状, 以及未知数据的兜底.
	*
	* 本文件不依赖任何 DSH 运行时包, 因此 Host 与浏览器 bundle 都能引用它.
	*/
	/**
	* 包名. 它同时是 Loader row id, 浏览器注册 id, 以及 client 半边通过
	* `ctx.configForms` 读配置用的 profile 条目 id.
	*/
	const PLUGIN_ID = "dsh-reveal-context";
	/** Host 半边导出、浏览器 factory 也返回的插件模块名. */
	const PLUGIN_NAME = "reveal-context";
	/**
	* 本插件注册的 Chat 节点 kind.
	*
	* 它必须与 DSH 自带的 kind 都不同: 自带的 `context` 被对话视图的可见性
	* 判定整体排除, 只有另起一个 kind 才能让同一批事件重新长出一行.
	*/
	const NODE_KIND = "reveal-context";
	/** 总开关字段名. */
	const ENABLED_FIELD = "enabled";
	/** 额外隐藏的 kind 清单字段名. */
	const HIDDEN_KINDS_FIELD = "hiddenKinds";
	/** 默认全开: 打开开关, 不额外隐藏任何 kind. */
	const DEFAULT_SETTINGS = {
		enabled: true,
		hiddenKinds: []
	};
	/**
	* 把一个未知形状的配置读成完整偏好.
	* @param section - 配置表单快照里的值, 可能缺失或类型不对.
	* @returns 每个字段都有合法值的偏好.
	*/
	function normalizeSettings(section) {
		const source = typeof section === "object" && section !== null ? section : {};
		const raw = source[HIDDEN_KINDS_FIELD];
		const hiddenKinds = Array.isArray(raw) ? [...new Set(raw.filter((entry) => typeof entry === "string" && entry.trim() !== "").map((entry) => entry.trim()))] : [...DEFAULT_SETTINGS.hiddenKinds];
		return {
			enabled: source[ENABLED_FIELD] !== false,
			hiddenKinds
		};
	}
	/**
	* 一条注入消息是否应当被重新显示.
	*
	* 只处理非 user 来源的 user 消息: user 自己发的话本来就由对话视图自己渲染,
	* 交给本插件会重复一行.
	* @param sourceKind - 消息 `source.kind`.
	* @param settings - 当前偏好.
	* @returns 是否显示这一行.
	*/
	function shouldReveal(sourceKind, settings) {
		if (!settings.enabled) return false;
		if (typeof sourceKind !== "string") return false;
		const kind = sourceKind.trim();
		if (kind === "" || kind === "user") return false;
		return !settings.hiddenKinds.includes(kind);
	}
	/**
	* 把配置页里的多行文本读成 kind 清单.
	* @param text - 用户输入, 每行一个 kind, 也接受逗号分隔.
	* @returns 去重后的 kind 清单.
	*/
	function parseKindList(text) {
		const kinds = text.split(/[\n,]/).map((entry) => entry.trim()).filter((entry) => entry !== "");
		return [...new Set(kinds)];
	}
	/**
	* 把 kind 清单写回配置页的多行文本.
	* @param kinds - 当前清单.
	* @returns 每行一个 kind 的文本.
	*/
	function formatKindList(kinds) {
		return kinds.join("\n");
	}
	//#endregion
	//#region src/client/definition.ts
	/** 从内容块里取模型可见的文本; 非文本块按原样忽略, 不伪造换行. */
	function textOf(content) {
		if (!Array.isArray(content)) return "";
		return content.filter((block) => {
			if (typeof block !== "object" || block === null) return false;
			const candidate = block;
			return candidate.type === "text" && typeof candidate.text === "string";
		}).map((block) => block.text).join("");
	}
	/**
	* 行的来源标签.
	*
	* 指令类注入自带 `changes` 清单, 列出路径比列出 kind 有用; 其余来源退回 kind.
	* @param source - 消息的 source.
	* @returns 折叠状态下显示的标签.
	*/
	function labelOf(source) {
		const kind = typeof source?.kind === "string" ? source.kind : "";
		if (Array.isArray(source?.changes)) {
			const paths = source.changes.filter((entry) => {
				if (typeof entry !== "object" || entry === null) return false;
				return typeof entry.path === "string";
			}).map((entry) => entry.path);
			if (paths.length > 0) return [...new Set(paths)].join(", ");
		}
		return kind;
	}
	/** 把一条已接受的事件读成状态. */
	function stateOf(match) {
		const message = match.event.data;
		const source = message.source;
		return {
			seq: match.event.seq,
			time: match.event.time,
			text: textOf(message.content),
			producerKind: typeof source?.kind === "string" ? source.kind : "",
			label: labelOf(source),
			source
		};
	}
	/**
	* 造出本插件的 conversation 定义.
	*
	* 偏好由 `readSettings` 每次读取: 设置改动后调用方会重新注册本定义, 注册表的
	* 失效通知会让引擎重跑一遍投影, 因此开关不需要刷新页面就能生效.
	* @param readSettings - 读取当前偏好的函数.
	* @returns 注册到 `ctx.uiConversation.events` 的定义.
	*/
	function createRevealContextDefinition(readSettings) {
		return {
			kind: NODE_KIND,
			target: "chat",
			match(event) {
				if (event.type !== "user/message") return null;
				const message = event.data;
				if (!shouldReveal(message.source?.kind, readSettings())) return null;
				return {
					id: String(event.data.id),
					role: "start"
				};
			},
			start(_context, match) {
				return stateOf(match);
			},
			update(context) {
				return context.state;
			},
			buildViewNode(context) {
				const state = context.state;
				if (state === void 0) return null;
				const location = context.start?.location ?? context.matches[0]?.location ?? { kind: "unresolved" };
				return {
					key: context.key,
					kind: NODE_KIND,
					id: context.id,
					target: "chat",
					anchorSeq: state.seq,
					location,
					visibility: "visible",
					data: state
				};
			}
		};
	}
	//#endregion
	//#region src/client/fields.ts
	/**
	* 造出字段行的公共外壳与徽标.
	* @param ui - React 与官方控件.
	* @returns 生成一行外壳的函数.
	*/
	function createRowShell(ui) {
		const { React, Tag } = ui;
		/** createElement 短写: 本 bundle 不编译 JSX. */
		const el = (type, props, ...children) => React.createElement.apply(null, [type, props].concat(children));
		return function row(props, control, body) {
			const badges = props.overridden ? el("span", { className: "dsh-reveal-context-badges" }, el(Tag, { tone: "neutral" }, props.overriddenLabel), el("button", {
				type: "button",
				className: "dsh-reveal-context-reset",
				disabled: props.disabled,
				onClick: props.onReset
			}, props.resetLabel)) : null;
			return el("div", { className: "dsh-reveal-context-field" }, el("div", { className: "dsh-reveal-context-head" }, el("span", {
				className: "dsh-reveal-context-label",
				id: `${props.id}-label`
			}, props.label), badges, control), el("p", { className: "dsh-reveal-context-hint" }, props.hint), body ?? null);
		};
	}
	/**
	* 造出开关字段行组件.
	* @param ui - React 与官方控件.
	* @returns 开关字段行组件.
	*/
	function createSwitchField(ui) {
		const { React, Switch } = ui;
		const el = (type, props, ...children) => React.createElement.apply(null, [type, props].concat(children));
		const row = createRowShell(ui);
		return function SwitchField(props) {
			return row(props, el(Switch, {
				checked: props.checked,
				label: props.label,
				disabled: props.disabled,
				onChange: props.onToggle
			}));
		};
	}
	/**
	* 造出文本域字段行组件.
	* @param ui - React 与官方控件.
	* @returns 文本域字段行组件.
	*/
	function createTextAreaField(ui) {
		const { React } = ui;
		const el = (type, props, ...children) => React.createElement.apply(null, [type, props].concat(children));
		const row = createRowShell(ui);
		return function TextAreaField(props) {
			const body = [el("textarea", {
				id: props.id,
				className: "dsh-reveal-context-textarea",
				value: props.value,
				disabled: props.disabled,
				spellCheck: false,
				"aria-labelledby": `${props.id}-label`,
				onChange: (event) => {
					props.onEdit(event.target.value);
				}
			})];
			if (props.footnote !== void 0) body.push(el("p", { className: "dsh-reveal-context-hint" }, props.footnote));
			return row(props, null, body);
		};
	}
	//#endregion
	//#region src/client/locales.ts
	/** 本插件字典的命名空间, 与包名一致. */
	const LOCALE_NS = "dsh-reveal-context";
	const zh = {
		description: "把 DSH 在对话里隐藏掉的上下文注入行重新显示出来, 例如 AGENTS.md 变化通知, 技能目录, 被引用的会话与环境快照.",
		rowTitle: "注入上下文",
		emptyBody: "这条注入没有可见文本.",
		truncated: "正文已截断, 全文共 {{total}} 个字符.",
		enabled: "显示被隐藏的注入行",
		enabledHint: "关掉后对话恢复成 DSH 默认的样子, 下面那份清单原样保留.",
		hiddenKinds: "仍然隐藏的来源",
		hiddenKindsHint: "每行一个 source.kind, 也可以用逗号分隔. 留空表示一个都不排除.",
		knownKinds: "当前 DSH 版本常见的来源: agent-instructions, skill-catalog, skill-invocation, session-reference, runtime-context, time-context, tmux-context, plan-mode, model-selection, user-approval, repeat-tool-reminder, hooks-codex, hooks-claude-code 等. 未列出的新来源默认也会显示.",
		overridden: "已覆盖",
		reset: "恢复默认",
		readOnly: "本部署的设置为只读.",
		unavailable: "该插件当前未加载, 暂时无法配置.",
		save: "保存",
		saving: "保存中...",
		saveFailed: "本部署没有接受这些值, 已保留供你修改."
	};
	const en = {
		description: "Bring back the context-injection rows DSH hides from the transcript: AGENTS.md notices, skill catalogs, recalled sessions, runtime snapshots.",
		rowTitle: "Context injection",
		emptyBody: "This injection carries no visible text.",
		truncated: "Body truncated; the full text is {{total}} characters.",
		enabled: "Show hidden injection rows",
		enabledHint: "Turning this off restores the stock transcript; the list below keeps its own value.",
		hiddenKinds: "Sources still hidden",
		hiddenKindsHint: "One source.kind per line, commas also accepted. Leave empty to exclude nothing.",
		knownKinds: "Sources common in this DSH version: agent-instructions, skill-catalog, skill-invocation, session-reference, runtime-context, time-context, tmux-context, plan-mode, model-selection, user-approval, repeat-tool-reminder, hooks-codex, hooks-claude-code, and more. Unlisted new sources show up by default.",
		overridden: "Overridden",
		reset: "Reset to default",
		readOnly: "This deployment stores settings read-only.",
		unavailable: "This plugin is not loaded, so it cannot be configured right now.",
		save: "Save",
		saving: "Saving...",
		saveFailed: "The deployment did not accept these values; they were left for you to correct."
	};
	/**
	* 表单框架要的文案, 从本插件字典取.
	* @param t - 本插件字典的读取函数.
	* @returns 共享设置表单渲染的标签.
	*/
	function formLabels(t) {
		return {
			unavailable: t("unavailable"),
			readOnly: t("readOnly"),
			saveFailed: t("saveFailed"),
			save: t("save"),
			saving: t("saving")
		};
	}
	//#endregion
	//#region src/client/row.ts
	/** 正文写入 DOM 前的保护上限; 显示高度由 CSS 的 max-height 负责, 不靠截断. */
	const MAX_CHARS = 2e4;
	/**
	* 造出注入行组件.
	* @param ui - React 与官方控件.
	* @returns 注入行组件.
	*/
	function createRevealContextRow(ui) {
		const { React, DisclosureRow, Icon } = ui;
		/** createElement 短写: 本 bundle 不编译 JSX. */
		const el = (type, props, ...children) => React.createElement.apply(null, [type, props].concat(children));
		return function RevealContextRow(props) {
			const { node, t } = props;
			const data = node.data;
			const [open, setOpen] = React.useState(false);
			const truncated = data.text.length > MAX_CHARS;
			const text = truncated ? data.text.slice(0, MAX_CHARS) : data.text;
			const label = data.label === "" ? data.producerKind : data.label;
			const collapsedContent = label === "" ? void 0 : [el("span", {
				key: "sep",
				className: "dsh-reveal-context-sep",
				"aria-hidden": true
			}), el("span", {
				key: "source",
				className: "dsh-reveal-context-source"
			}, label)];
			const body = [text === "" ? el("p", {
				key: "empty",
				className: "dsh-reveal-context-empty"
			}, t("emptyBody")) : el("div", {
				key: "text",
				className: "dsh-reveal-context-text"
			}, text)];
			if (truncated) body.push(el("p", {
				key: "truncated",
				className: "dsh-reveal-context-truncated"
			}, t("truncated", { total: data.text.length })));
			return el(DisclosureRow, {
				className: "dsh-reveal-context-root",
				chevronClassName: "dsh-reveal-context-chevron",
				icon: el(Icon, { size: 14 }),
				title: t("rowTitle"),
				collapsedContent,
				keepContentWhenOpen: true,
				open,
				expandable: true,
				expandOnRowClick: true,
				onToggle: () => {
					setOpen((value) => !value);
				}
			}, el("div", { className: "dsh-reveal-context-body" }, body));
		};
	}
	//#endregion
	//#region src/client/settings-card.ts
	/**
	* 造出插件页卡片组件.
	* @param ui - React 与官方控件.
	* @returns 卡片组件.
	*/
	function createRevealContextCard(ui) {
		const { React, SettingsForm, SwitchField, TextAreaField } = ui;
		/** createElement 短写: 本 bundle 不编译 JSX. */
		const el = (type, props, ...children) => React.createElement.apply(null, [type, props].concat(children));
		return function RevealContextCard(props) {
			const { t } = props;
			const state = props.useRevealContextCard((snapshot) => snapshot);
			if (props.view === "summary") return t("description");
			const disabled = !state.writable;
			return el(SettingsForm, {
				labels: formLabels(t),
				state,
				onSave: props.save,
				onDiscard: props.discard
			}, el(SwitchField, {
				key: ENABLED_FIELD,
				id: `plugin-config-reveal-context-${ENABLED_FIELD}`,
				label: t("enabled"),
				hint: t("enabledHint"),
				checked: state.enabled.text === "true",
				overridden: state.enabled.overridden,
				overriddenLabel: t("overridden"),
				resetLabel: t("reset"),
				disabled,
				onToggle: (next) => {
					props.edit(ENABLED_FIELD, next ? "true" : "false");
				},
				onReset: () => {
					props.resetField(ENABLED_FIELD);
				}
			}), el(TextAreaField, {
				key: HIDDEN_KINDS_FIELD,
				id: `plugin-config-reveal-context-${HIDDEN_KINDS_FIELD}`,
				label: t("hiddenKinds"),
				hint: t("hiddenKindsHint"),
				footnote: t("knownKinds"),
				value: state.hiddenKinds.text,
				overridden: state.hiddenKinds.overridden,
				overriddenLabel: t("overridden"),
				resetLabel: t("reset"),
				disabled,
				onEdit: (next) => {
					props.edit(HIDDEN_KINDS_FIELD, next);
				},
				onReset: () => {
					props.resetField(HIDDEN_KINDS_FIELD);
				}
			}));
		};
	}
	//#endregion
	//#region src/client/settings-form.ts
	/**
	* 布尔字段的草稿编码: 官方模型只解析文本字段, 布尔值以 `true` / `false` 暂存.
	* @param field - 字段名.
	* @returns 该字段的转换描述.
	*/
	function settingsBooleanField(field) {
		return {
			field,
			format: (value) => typeof value === "boolean" ? String(value) : "",
			parse: (text) => text === "true" ? {
				kind: "set",
				value: true
			} : text === "false" ? {
				kind: "set",
				value: false
			} : void 0
		};
	}
	/**
	* 清单字段的草稿编码: 数组与多行文本互转, 空文本表示空清单.
	* @param field - 字段名.
	* @returns 该字段的转换描述.
	*/
	function settingsKindListField(field) {
		return {
			field,
			format: (value) => Array.isArray(value) ? formatKindList(value.filter((entry) => typeof entry === "string")) : "",
			parse: (text) => ({
				kind: "set",
				value: parseKindList(text)
			})
		};
	}
	/** 把本插件条目的配置表单桥接成配置卡片的暂存表单. */
	var RevealContextSettingsForm = class {
		form;
		store;
		/**
		* @param scope - 本插件 profile 条目的共享配置表单 (ctx.configForms.get).
		* @param SettingsFormModel - 官方表单模型构造器.
		*/
		constructor(scope, SettingsFormModel) {
			this.form = new SettingsFormModel(scope, [settingsBooleanField(ENABLED_FIELD), settingsKindListField(HIDDEN_KINDS_FIELD)]);
			this.store = this.form.bind(() => ({
				...this.form.shell(),
				enabled: this.form.field(ENABLED_FIELD),
				hiddenKinds: this.form.field(HIDDEN_KINDS_FIELD)
			}));
		}
		/**
		* 构造 slot 注册要注入的面.
		* @returns 快照 hook 与表单动作.
		*/
		inject() {
			return {
				hooks: { revealContextCard: this.store },
				...this.form.actions()
			};
		}
		/** 释放对配置表单的订阅. */
		dispose() {
			this.form.dispose();
		}
	};
	//#endregion
	//#region src/client/styles.ts
	/**
	* 注入行与配置卡片的样式.
	*
	* 注入行的几何全部照抄官方"上下文注入"行 (`ui-chat/src/client/chat/ContextInjectionRow
	* .module.css`, Figma 10:2482): 折叠时是一个 24px 行加一个 2px 分隔圆点, 展开时是一个
	* 141px 限高、内滚动、带 code-block 背景的正文面板. 这样本插件补回来的行和 DSH 其他
	* 流程行保持同一节奏, 也不会因为正文长就把整轮撑开.
	*
	* 颜色只用 `--dsw-alias-*` 语义 token, 注入方式沿用客户端构建预设认可的 `data-plugin-css` 标记.
	*/
	/** 样式标签的 data-plugin-css 标记. */
	const STYLE_MARK = `${PLUGIN_ID}/styles`;
	const css = `
/* 展开时给折叠行留出与官方 root[data-open] 相同的下边距. */
.dsh-reveal-context-root[data-open] {
  padding-bottom: 4px;
}
.dsh-reveal-context-chevron {
  color: var(--dsw-alias-label-secondary);
}
/* 标题与来源之间的分隔圆点, 与官方注入行同一形状. */
.dsh-reveal-context-sep {
  flex: none;
  width: 2px;
  height: 2px;
  margin: 0 8px;
  border-radius: 1px;
  background: var(--dsw-alias-label-caption);
}
/* 来源标签, 与官方注入行同一几何. */
.dsh-reveal-context-source {
  flex: none;
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--dsh-content-font-size-secondary, 13px);
  line-height: calc(24px + var(--dsh-content-font-delta, 0px));
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 展开正文: 官方注入行的 .body 配方, 限高加内滚动. */
.dsh-reveal-context-body {
  box-sizing: border-box;
  width: calc(100% - 22px - var(--dsh-content-font-delta, 0px));
  max-height: 141px;
  margin: 4px 0 0 calc(22px + var(--dsh-content-font-delta, 0px));
  overflow: auto;
  padding: 10px 16px 12px 12px;
  border: none;
  border-radius: 8px;
  background: var(--dsw-alias-markdown-code-block);
  color: var(--dsw-alias-label-tertiary);
  font: 400 11px/16px var(--ds-font-family-code);
}
.dsh-reveal-context-text {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.dsh-reveal-context-empty {
  margin: 0;
  color: var(--dsw-alias-label-caption);
  font-style: italic;
}
.dsh-reveal-context-truncated {
  margin: 6px 0 0;
  color: var(--dsw-alias-label-caption);
}
.dsh-reveal-context-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 0;
}
.dsh-reveal-context-field + .dsh-reveal-context-field {
  border-top: 0.5px solid var(--dsw-alias-border-l2);
}
.dsh-reveal-context-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dsh-reveal-context-label {
  flex: 1;
  min-width: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.5;
}
.dsh-reveal-context-badges {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.dsh-reveal-context-reset {
  padding: 0;
  border: none;
  background: none;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  line-height: 1.5;
  cursor: pointer;
}
.dsh-reveal-context-reset:hover:not(:disabled) {
  color: var(--dsw-alias-label-primary);
}
.dsh-reveal-context-reset:disabled {
  cursor: default;
}
.dsh-reveal-context-hint {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 1.5;
}
.dsh-reveal-context-textarea {
  width: 100%;
  min-height: 88px;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-family: var(--ds-font-family-code);
  font-size: 12px;
  line-height: 1.6;
  resize: vertical;
}
.dsh-reveal-context-textarea:disabled {
  opacity: 0.6;
  cursor: default;
}
`;
	/** 注入样式一次; 重复调用为空操作. */
	function injectStyles() {
		if (typeof document === "undefined") return;
		if (document.querySelector(`style[data-plugin-css="${STYLE_MARK}"]`) !== null) return;
		const style = document.createElement("style");
		style.dataset.pluginCss = STYLE_MARK;
		style.textContent = css;
		document.head.appendChild(style);
	}
	//#endregion
	//#region src/client/index.ts
	const loader = window.__ModuleLoader__;
	if (loader === void 0) throw new Error(`${PLUGIN_ID}: window.__ModuleLoader__ is missing; the browser half must load as a DSH client bundle`);
	loader.load({
		id: PLUGIN_ID,
		factory: (require) => {
			const React = require("react");
			const primitives = require("@deepseek-ai/dsh-client-ui-primitives");
			const SwitchField = createSwitchField({
				React,
				Switch: primitives.Switch,
				Tag: primitives.Tag
			});
			const TextAreaField = createTextAreaField({
				React,
				Switch: primitives.Switch,
				Tag: primitives.Tag
			});
			const Row = createRevealContextRow({
				React,
				DisclosureRow: primitives.DisclosureRow,
				Icon: primitives.IconContextInjectionOutlineRegular
			});
			const Card = createRevealContextCard({
				React,
				SettingsForm: primitives.SettingsForm,
				SwitchField,
				TextAreaField
			});
			return {
				name: PLUGIN_NAME,
				inject: [
					"slots",
					"locale",
					"configForms",
					"uiConversation"
				],
				apply(ctx) {
					const form = ctx.configForms.get(PLUGIN_ID);
					let settings = normalizeSettings(form.getSnapshot().value);
					/** 定义每次判定时读当前偏好, 因此这里必须返回最新的那一份. */
					const readSettings = () => settings;
					injectStyles();
					ctx.effect(() => ctx.locale.register(LOCALE_NS, {
						zh,
						en
					}), `${PLUGIN_ID}: dictionaries`);
					let disposeDefinition;
					ctx.effect(() => {
						const syncDefinition = () => {
							disposeDefinition?.();
							disposeDefinition = ctx.uiConversation.events.register(createRevealContextDefinition(readSettings));
						};
						syncDefinition();
						const stop = form.subscribe(() => {
							settings = normalizeSettings(form.getSnapshot().value);
							syncDefinition();
						});
						return () => {
							stop();
							disposeDefinition?.();
							disposeDefinition = void 0;
						};
					}, `${PLUGIN_ID}: reveal definition`);
					ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
						name: "conversation.chat.node",
						key: NODE_KIND,
						locale: LOCALE_NS
					}, Row));
					const card = new RevealContextSettingsForm(form, primitives.SettingsFormModel);
					ctx.effect(() => () => {
						card.dispose();
					}, `${PLUGIN_ID}: settings form`);
					ctx.effect(() => ctx.configForms.whileServed([PLUGIN_ID], () => ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
						name: "plugins.bundle.config",
						key: PLUGIN_ID,
						locale: LOCALE_NS,
						inject: () => card.inject()
					}, Card))), `${PLUGIN_ID}: plugins page card`);
					ctx.logger.info("%s: client applying, enabled=%s", PLUGIN_ID, String(settings.enabled));
				}
			};
		}
	});
	//#endregion
})();

//# sourceMappingURL=client.js.map