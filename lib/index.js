import z from "@deepseek-ai/schemastery";
//#region src/settings.ts
/** Host 半边导出、浏览器 factory 也返回的插件模块名. */
const PLUGIN_NAME = "reveal-context";
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
//#endregion
//#region src/index.ts
const name = PLUGIN_NAME;
/** 偏好 schema; 默认值与约束只写在这里, 代码里不再维护第二份. */
const Config = z.object({
	[ENABLED_FIELD]: z.boolean().default(DEFAULT_SETTINGS.enabled).volatile(),
	[HIDDEN_KINDS_FIELD]: z.array(z.string()).default([...DEFAULT_SETTINGS.hiddenKinds]).volatile()
});
/**
* 报告一次装配结果.
* @param ctx - Host 插件上下文.
* @param config - Loader 校验后的行配置, 缺省字段已由 schema 填好.
*/
function apply(ctx, config) {
	const resolved = normalizeSettings({
		[ENABLED_FIELD]: config.enabled.get(),
		[HIDDEN_KINDS_FIELD]: config.hiddenKinds.get()
	});
	ctx.logger.info("%s: host loaded, enabled=%s hiddenKinds=%d", PLUGIN_NAME, String(resolved.enabled), resolved.hiddenKinds.length);
}
//#endregion
export { Config, apply, name };

//# sourceMappingURL=index.js.map