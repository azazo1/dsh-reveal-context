import z from "@deepseek-ai/schemastery";
import { Context, Volatile } from "@deepseek-ai/cordis";
//#region src/index.d.ts
declare const name = "reveal-context";
/** Loader 与浏览器半区共用的配置形状; 每个字段都是 volatile, 改动不重挂插件. */
interface Config {
  enabled: Volatile<boolean>;
  hiddenKinds: Volatile<string[]>;
}
interface ConfigInput {
  enabled?: boolean;
  hiddenKinds?: string[];
}
/** 偏好 schema; 默认值与约束只写在这里, 代码里不再维护第二份. */
declare const Config: z<ConfigInput, Config>;
/**
 * 报告一次装配结果.
 * @param ctx - Host 插件上下文.
 * @param config - Loader 校验后的行配置, 缺省字段已由 schema 填好.
 */
declare function apply(ctx: Context, config: Config): void;
//#endregion
export { Config, apply, name };
//# sourceMappingURL=index.d.ts.map