// GitHub 文件浏览器纯工具函数（无 DOM 依赖，便于单测）

export function parentPath(p: string): string {
  const i = p.lastIndexOf('/')
  return i <= 0 ? '' : p.slice(0, i)
}

export function fileNameOf(p: string): string {
  const i = p.lastIndexOf('/')
  return i < 0 ? p : p.slice(i + 1)
}

export function joinRepoPath(dir: string, name: string): string {
  const d = dir.trim()
  return d ? d + '/' + name : name
}

/** 校验新建文件名；合法返回 null，否则返回中文错误提示。 */
export function validateNewFileName(name: string): string | null {
  const n = name.trim()
  if (!n) return '文件名不能为空'
  if (n === '.' || n === '..') return '文件名无效'
  if (/[\/\\]/.test(n)) return '文件名不能包含 / 或 \\'
  if (n.length > 200) return '文件名过长（最多 200 字符）'
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(n)) return '文件名不能包含控制字符'
  return null
}

/** 将仓库内路径拆成面包屑段落（如 docs/a/b → [docs, docs/a, docs/a/b]）。 */
export function breadcrumbSegments(path: string): { label: string; path: string }[] {
  if (!path) return []
  const parts = path.split('/').filter(Boolean)
  const out: { label: string; path: string }[] = []
  let acc = ''
  for (const p of parts) {
    acc = acc ? acc + '/' + p : p
    out.push({ label: p, path: acc })
  }
  return out
}

/** 文件大小人性化显示：B / KB / MB / GB。 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB'
}
