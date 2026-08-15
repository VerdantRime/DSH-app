import { marked } from 'marked'

/** 将 Markdown 源码渲染为 HTML（GFM：表格/删除线/任务列表）。纯函数，可在 node 环境单测。 */
export function renderMarkdown(src: string): string {
  return marked.parse(src, { gfm: true }) as string
}
