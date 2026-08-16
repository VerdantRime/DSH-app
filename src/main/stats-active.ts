export const IDLE_LIMIT_MS = 3 * 60 * 1000
export const TICK_MS = 5000

/** 是否计为活跃：窗口有焦点、未最小化、可见、且系统未挂机（空闲 < 3 分钟）。 */
export function isActiveByFlags(opts: { focused: boolean; minimized: boolean; visible: boolean; idleMs: number }): boolean {
  return opts.focused && !opts.minimized && opts.visible && opts.idleMs < IDLE_LIMIT_MS
}
