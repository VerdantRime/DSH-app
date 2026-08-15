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
