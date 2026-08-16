export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export interface CompileError { line: number; column: number; message: string }

/** 从编译器输出解析错误位置（gcc `file:line:col: error`、javac `file:line: error`、python `line N`）。 */
export function parseCompileErrors(output: string): CompileError[] {
  const errs: CompileError[] = []
  const lines = output.split(/\r?\n/)
  for (const l of lines) {
    let m = l.match(/:(\d+):(\d+):\s*(error|warning|fatal error):\s*(.*)/)
    if (m) { errs.push({ line: +m[1], column: +m[2], message: (m[3] + ': ' + m[4]).trim() }); continue }
    m = l.match(/:(\d+):\s*(error|warning):\s*(.*)/)
    if (m) { errs.push({ line: +m[1], column: 1, message: (m[2] + ': ' + m[3]).trim() }); continue }
    m = l.match(/line\s+(\d+)/)
    if (m) { errs.push({ line: +m[1], column: 1, message: l.trim() }); continue }
  }
  return errs
}

import { diffArrays } from 'diff'

export interface DiffHunk {
  oldStart: number
  oldCount: number
  newLines: string[]
}

/** 计算新旧文本之间的连续改动块（行级）。 */
export function diffHunks(oldText: string, newText: string): DiffHunk[] {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const parts = diffArrays(oldLines, newLines)
  const hunks: DiffHunk[] = []
  let oldIdx = 0
  let i = 0
  while (i < parts.length) {
    const p = parts[i]
    if (p.added || p.removed) {
      const hunk: DiffHunk = { oldStart: oldIdx, oldCount: 0, newLines: [] }
      while (i < parts.length && (parts[i].added || parts[i].removed)) {
        const q = parts[i]
        if (q.removed) { hunk.oldCount += q.value.length; oldIdx += q.value.length }
        if (q.added) hunk.newLines.push(...q.value)
        i++
      }
      hunks.push(hunk)
    } else {
      oldIdx += p.value.length
      i++
    }
  }
  return hunks
}

/** 把 accepted 为 true 的改动块应用到旧文本（自底向上，避免行号漂移）。 */
export function applyHunks(oldText: string, hunks: DiffHunk[], accepted: boolean[]): string {
  const lines = oldText.split('\n')
  const order = hunks
    .map((_, i) => i)
    .filter((i) => accepted[i])
    .sort((a, b) => hunks[b].oldStart - hunks[a].oldStart)
  for (const idx of order) {
    const h = hunks[idx]
    lines.splice(h.oldStart, h.oldCount, ...h.newLines)
  }
  return lines.join('\n')
}

export type IdeLanguage =
  | 'python' | 'cpp' | 'java' | 'javascript' | 'typescript' | 'json' | 'markdown' | 'html' | 'css' | 'plaintext'

/** 依据文件名/扩展名识别语言（Monaco language id）。C/C++ 统一归到 cpp。 */
export function languageForFile(name: string): IdeLanguage {
  const b = name.toLowerCase()
  if (/\.py$/i.test(b)) return 'python'
  if (/\.(c|h|cc|cpp|cxx|hpp|hh)$/i.test(b)) return 'cpp'
  if (/\.java$/i.test(b)) return 'java'
  if (/\.(js|jsx)$/i.test(b)) return 'javascript'
  if (/\.(ts|tsx)$/i.test(b)) return 'typescript'
  if (/\.json$/i.test(b)) return 'json'
  if (/\.(md|markdown)$/i.test(b)) return 'markdown'
  if (/\.(html|htm)$/i.test(b)) return 'html'
  if (/\.(css|scss|less)$/i.test(b)) return 'css'
  return 'plaintext'
}

/** 判断代码是否依赖真正的控制台（system 命令、conio、getch/kbhit 等）。 */
export function usesConsoleApis(content: string): boolean {
  return /system\s*\(|#\s*include\s*[<"']conio\.h|getch\s*\(|kbhit\s*\(|gotoxy\s*\(|SetConsoleTextAttribute/.test(content)
}

/** 判断源码是否含交互输入（用于决定弹独立控制台）。 */
export function isInteractiveSource(content: string, lang: IdeLanguage): boolean {
  if (lang === 'python') return /input\s*\(|sys\.stdin|raw_input/.test(content)
  if (lang === 'cpp') return /scanf\s*\(|getchar\s*\(|gets\s*\(|cin\s*>>|getline\s*\(/.test(content)
  if (lang === 'java') return /Scanner|nextLine|nextInt|next\s*\(/.test(content)
  return false
}

/** 各语言默认临时文件名。 */
export function defaultRunFileName(lang: IdeLanguage): string {
  if (lang === 'python') return 'main.py'
  if (lang === 'cpp') return 'main.cpp'
  if (lang === 'java') return 'Main.java'
  return 'main.txt'
}

/** 从 Markdown 回答里提取最后一个 fenced code block。 */
export function extractCodeBlock(md: string): string | null {
  const blocks = md.match(/```[^\n]*\n([\s\S]*?)```/g)
  if (!blocks || blocks.length === 0) return null
  const last = blocks[blocks.length - 1]
  return last.replace(/^```[^\n]*\n/, '').replace(/```\s*$/, '').trim()
}

/** 生成 GitHub 文件的稳定标签标识。 */
export function githubTabKey(owner: string, repo: string, path: string): string {
  return 'github:' + owner + '/' + repo + '/' + path
}

export interface ChatTurn { role: 'user' | 'assistant'; content: string }

/** 哪些 AI 动作允许「应用到编辑器」：找错/优化且含代码块；解释或自由对话不应用。 */
export function canApplyAi(action: 'explain' | 'debug' | 'optimize' | 'chat', hasCode: boolean): boolean {
  return hasCode && action === 'optimize'
}

/** 组装发送给 headless 智能体的完整提示（代码上下文 + 历史 + 最新问题）。 */
export function buildChatPrompt(history: ChatTurn[], question: string, code: string, language: string, fileName?: string): string {
  const lines: string[] = ['你是一名代码助手。']
  if (fileName && fileName.trim()) {
    lines.push('', '当前文件名：' + fileName)
  }
  if (code && code.trim()) {
    lines.push('', '当前代码（语言 ' + language + '）：', '```', code, '```')
  }
  if (history.length) {
    lines.push('', '对话历史：')
    for (const t of history) lines.push((t.role === 'user' ? '用户' : '助手') + '：' + t.content)
  }
  lines.push('', '请回答用户最新问题（中文 Markdown；若需要给出代码，用一个 fenced code block 包裹）：', question)
  return lines.join('\n')
}

/** 从完整路径取标签标题。 */
export function tabTitleFromPath(path: string): string {
  const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return i < 0 ? path : path.slice(i + 1)
}

/** 是否应自动保存：有本地路径且不是 GitHub 文件。 */
export function shouldAutoSave(tab: { path: string | null; github?: unknown } | null | undefined): boolean {
  return !!tab && !!tab.path && !tab.github
}
