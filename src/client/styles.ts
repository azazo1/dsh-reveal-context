/**
 * 注入行与配置卡片的样式.
 *
 * 注入行的几何全部照抄官方"上下文注入"行 (`ui-chat/src/client/chat/ContextInjectionRow
 * .module.css`, Figma 10:2482): 折叠时是一个 24px 行加一个 2px 分隔圆点, 展开时是一个
 * 141px 限高、内滚动、带 code-block 背景的正文面板. 这样本插件补回来的行和 DSH 其他
 * 流程行保持同一节奏, 也不会因为正文长就把整轮撑开.
 *
 * 颜色与圆角只用 `--dsw-*` 语义 token, 注入方式沿用客户端构建预设认可的 `data-plugin-css` 标记.
 * 0.1.7-rc.2 起官方正文面板的圆角改走 `--dsw-radius-md`, 这里跟着走 token.
 */

import { PLUGIN_ID } from '../settings.ts'

/** 样式标签的 data-plugin-css 标记. */
export const STYLE_MARK = `${PLUGIN_ID}/styles`

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
  border-radius: var(--dsw-radius-md);
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
`

/** 注入样式一次; 重复调用为空操作. */
export function injectStyles(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[data-plugin-css="${STYLE_MARK}"]`) !== null) return
  const style = document.createElement('style')
  style.dataset.pluginCss = STYLE_MARK
  style.textContent = css
  document.head.appendChild(style)
}
