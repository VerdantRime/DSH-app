import monaco from './monaco-setup'
import { languageForFile, tabTitleFromPath, isInteractiveSource, usesConsoleApis, defaultRunFileName, extractCodeBlock, githubTabKey, buildChatPrompt, canApplyAi, clamp, diffHunks, applyHunks, parseCompileErrors, type ChatTurn, type IdeLanguage } from './ide-utils'
import { diffLines } from 'diff'
import { githubErrorHint } from './github-utils'
import { showContextMenu, copyText, type CtxMenuItem } from './context-menu'
import DOMPurify from 'dompurify'
import { renderMarkdown } from './markdown'
import type { IdeRunResult } from '../shared/types'

const MONACO_LANG: Record<IdeLanguage, string> = {
  python: 'python', cpp: 'cpp', java: 'java', javascript: 'javascript', typescript: 'typescript',
  json: 'json', markdown: 'markdown', html: 'html', css: 'css', plaintext: 'plaintext'
}
const MONACO_TO_IDE: Record<string, IdeLanguage> = {}
for (const [k, v] of Object.entries(MONACO_LANG)) MONACO_TO_IDE[v] = k as IdeLanguage

const LANG_LABELS: { id: IdeLanguage; label: string }[] = [
  { id: 'plaintext', label: '纯文本' },
  { id: 'python', label: 'Python' },
  { id: 'cpp', label: 'C / C++' },
  { id: 'java', label: 'Java' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'json', label: 'JSON' },
  { id: 'markdown', label: 'Markdown' }
]

interface Tab { id: number; title: string; path: string | null; model: monaco.editor.ITextModel; encoding?: 'utf-8' | 'gbk'; github?: { owner: string; repo: string; path: string; sha?: string; canPush: boolean } }

let panel: HTMLElement | null = null
let editor: monaco.editor.IStandaloneCodeEditor | null = null
let tabs: Tab[] = []
let activeId = 0
let nextTabId = 1
let treeRoot: string | null = null
let treeDir = ''
let treeWidth = 200
let aiWidth = 320
let outputHeight = 160
let bottomRef: HTMLElement | null = null
let highlightPath: string | null = null
let lastAiCode: string | null = null
let lastAiRange: monaco.Range | null = null
let inlineDecoIds: string[] = []
let inlineDecoModel: monaco.editor.ITextModel | null = null
let aiHistory: ChatTurn[] = []
let lastAiAction: 'explain' | 'debug' | 'optimize' | 'chat' = 'chat'
let aiModel = ''

function h(tag: string, className?: string, text?: string): HTMLElement {
  const e = document.createElement(tag)
  if (className) e.className = className
  if (text !== undefined) e.textContent = text
  return e
}

function editorTheme(): string {
  return document.documentElement.dataset.theme === 'dark' ? 'vs-dark' : 'vs'
}

function activeTab(): Tab | undefined { return tabs.find((t) => t.id === activeId) }

function newTab(title: string, path: string | null, content: string, lang: IdeLanguage): Tab {
  const id = nextTabId++
  const model = monaco.editor.createModel(content, MONACO_LANG[lang], monaco.Uri.parse('inmemory://ide/' + id))
  const tab: Tab = { id, title, path, model }
  tabs.push(tab)
  return tab
}

function switchTab(id: number): void {
  const tab = tabs.find((t) => t.id === id)
  if (!tab || !editor) return
  activeId = id
  editor.setModel(tab.model)
  syncLangSelect(tab.model.getLanguageId())
  renderTabs()
  updateGithubButtons()
}

function syncLangSelect(monacoLang: string): void {
  const sel = document.getElementById('ide-lang') as HTMLSelectElement | null
  if (sel) sel.value = MONACO_TO_IDE[monacoLang] ?? 'plaintext'
}

export function ideSetLanguage(lang: IdeLanguage): void {
  const tab = activeTab()
  if (!tab) return
  monaco.editor.setModelLanguage(tab.model, MONACO_LANG[lang])
  const sel = document.getElementById('ide-lang') as HTMLSelectElement | null
  if (sel) sel.value = lang
}

export function ideDetectLanguage(name: string): void { ideSetLanguage(languageForFile(name)) }

/** 以给定内容打开一个标签页（本地文件与 GitHub 文件共用）。 */
export function ideOpenContent(title: string, path: string | null, content: string): void {
  if (path) {
    const existing = tabs.find((t) => t.path === path)
    if (existing) { switchTab(existing.id); return }
  }
  const tab = newTab(title, path, content, languageForFile(title))
  switchTab(tab.id)
}

function goIdePanel(): void {
  document.dispatchEvent(new CustomEvent('dsh:navigate', { detail: 'ide' }))
}

/** GitHub 文件在 IDE 里打开为内存标签（保存即提交）。 */
export function ideOpenGithubFile(owner: string, repo: string, path: string, content: string, sha: string, canPush: boolean): void {
  const key = githubTabKey(owner, repo, path)
  const existing = tabs.find((t) => t.github && githubTabKey(t.github.owner, t.github.repo, t.github.path) === key)
  if (existing) { switchTab(existing.id); goIdePanel(); return }
  const tab = newTab(tabTitleFromPath(path), null, content, languageForFile(path))
  tab.github = { owner, repo, path, sha, canPush }
  switchTab(tab.id)
  goIdePanel()
}

async function saveGithubTab(tab: Tab): Promise<void> {
  if (!tab.github) return
  const message = window.prompt('提交说明（commit message）', 'Update ' + tab.github.path)
  if (message === null) return
  try {
    await window.api.githubSaveFile(tab.github.owner, tab.github.repo, tab.github.path, tab.model.getValue(), message, tab.github.sha)
    const { file } = await window.api.githubGetContents(tab.github.owner, tab.github.repo, tab.github.path)
    if (file) tab.github.sha = file.sha
    flashStatus('已提交到 GitHub')
  } catch (e) {
    window.alert('提交失败：' + githubErrorHint(e))
  }
}

async function downloadGithubActive(): Promise<void> {
  const tab = activeTab()
  if (!tab?.github) return
  try {
    const dest = await window.api.githubPickSavePath(tab.github.path.split('/').pop() ?? tab.github.path)
    if (!dest) return
    await window.api.githubDownloadFile(tab.github.owner, tab.github.repo, tab.github.path, dest)
    window.alert('已保存到：' + dest)
  } catch (e) { window.alert('下载失败：' + githubErrorHint(e)) }
}

async function deleteGithubActive(): Promise<void> {
  const tab = activeTab()
  if (!tab?.github) return
  if (!window.confirm('确定删除文件 ' + tab.github.path + ' 吗？')) return
  const message = window.prompt('提交说明（commit message）', 'Delete ' + tab.github.path)
  if (message === null) return
  try {
    await window.api.githubDeleteFile(tab.github.owner, tab.github.repo, tab.github.path, message, tab.github.sha ?? '')
    closeTab(tab.id)
  } catch (e) { window.alert('删除失败：' + githubErrorHint(e)) }
}

function updateGithubButtons(): void {
  const tab = activeTab()
  const dl = document.getElementById('ide-gh-download') as HTMLButtonElement | null
  const del = document.getElementById('ide-gh-delete') as HTMLButtonElement | null
  const commit = document.getElementById('ide-gh-commit') as HTMLButtonElement | null
  const isGh = !!tab?.github
  if (dl) dl.disabled = !isGh
  if (del) del.disabled = !isGh || !(tab?.github?.canPush ?? false)
  if (commit) commit.disabled = tabs.filter((t) => t.github).length === 0
}

async function openCommitPanel(): Promise<void> {
  const gts = tabs.filter((t) => t.github)
  if (gts.length === 0) { window.alert('当前没有已打开的 GitHub 文件'); return }
  const p = bottomPanel()
  p.bottom.classList.remove('hidden')
  p.head.textContent = '批量提交（一次 commit）'
  p.out.classList.add('hidden')
  p.ai.classList.remove('hidden')
  p.ai.replaceChildren()
  const list = h('div', 'ide-commit-list')
  for (const t of gts) {
    const row = document.createElement('label')
    row.className = 'ide-commit-row'
    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.checked = true
    cb.dataset.tabId = String(t.id)
    row.appendChild(cb)
    row.appendChild(h('span', '', t.github!.path))
    list.appendChild(row)
  }
  p.ai.appendChild(list)
  const msg = document.createElement('input')
  msg.className = 'gh-search'
  msg.id = 'ide-commit-msg'
  msg.placeholder = '提交说明（commit message）'
  p.ai.appendChild(msg)
  const btnRow = h('div', 'ide-apply-row')
  const ok = h('button', 'btn primary', '确认提交')
  ok.addEventListener('click', () => void confirmCommit())
  const cancel = h('button', 'btn', '取消')
  cancel.addEventListener('click', () => { p.bottom.classList.add('hidden') })
  btnRow.appendChild(ok)
  btnRow.appendChild(cancel)
  p.ai.appendChild(btnRow)
}

async function confirmCommit(): Promise<void> {
  const msgInput = document.getElementById('ide-commit-msg') as HTMLInputElement | null
  const message = msgInput?.value.trim() || '批量更新文件'
  const checkedIds = new Set<number>()
  document.querySelectorAll<HTMLInputElement>('.ide-commit-row input[type=checkbox]').forEach((cb) => {
    if (cb.checked) checkedIds.add(Number(cb.dataset.tabId))
  })
  const targets = tabs.filter((t) => t.github && checkedIds.has(t.id))
  if (targets.length === 0) { window.alert('请至少勾选一个文件'); return }
  const groups = new Map<string, { owner: string; repo: string; files: { path: string; content: string }[] }>()
  for (const t of targets) {
    const g = t.github!
    const key = g.owner + '/' + g.repo
    if (!groups.has(key)) groups.set(key, { owner: g.owner, repo: g.repo, files: [] })
    groups.get(key)!.files.push({ path: g.path, content: t.model.getValue() })
  }
  try {
    for (const grp of groups.values()) {
      await window.api.githubCommitFiles(grp.owner, grp.repo, message, grp.files)
    }
    bottomPanel().bottom.classList.add('hidden')
    flashStatus('已提交 ' + targets.length + ' 个文件')
    for (const t of targets) {
      const { file } = await window.api.githubGetContents(t.github!.owner, t.github!.repo, t.github!.path)
      if (file) t.github!.sha = file.sha
    }
  } catch (e) {
    window.alert('提交失败：' + githubErrorHint(e))
  }
}

function renderTabs(): void {
  const bar = document.getElementById('ide-tabs')
  if (!bar) return
  bar.replaceChildren()
  for (const t of tabs) {
    const b = h('button', 'ide-tab' + (t.id === activeId ? ' active' : ''), t.title)
    b.addEventListener('click', () => switchTab(t.id))
    const x = document.createElement('span')
    x.className = 'ide-tab-close'
    x.textContent = '×'
    x.title = '关闭'
    x.addEventListener('click', (e) => { e.stopPropagation(); closeTab(t.id) })
    b.appendChild(x)
    bar.appendChild(b)
  }
}

function closeTab(id: number): void {
  const i = tabs.findIndex((t) => t.id === id)
  if (i < 0) return
  const tab = tabs[i]
  tabs.splice(i, 1)
  tab.model.dispose()
  if (tabs.length === 0) {
    activeId = 0
    editor?.setModel(null)
    renderTabs()
    return
  }
  if (activeId === id) switchTab(tabs[Math.min(i, tabs.length - 1)].id)
  else renderTabs()
}

async function openFiles(paths: string[]): Promise<void> {
  for (const p of paths) await openFileInTab(p)
}

async function openFileInTab(path: string): Promise<void> {
  const existing = tabs.find((t) => t.path === path)
  if (existing) { switchTab(existing.id); return }
  try {
    const { content, encoding } = await window.api.ideReadFile(path)
    const tab = newTab(tabTitleFromPath(path), path, content, languageForFile(path))
    tab.encoding = encoding
    switchTab(tab.id)
  } catch (e) { window.alert('无法打开文件：' + (e instanceof Error ? e.message : String(e))) }
}

async function saveActive(): Promise<void> {
  const tab = activeTab()
  if (!tab) return
  if (tab.github) { await saveGithubTab(tab); return }
  const content = tab.model.getValue()
  let path = tab.path
  if (!path) {
    path = await window.api.ideSaveFileDialog(tab.title)
    if (!path) return
    tab.path = path
    tab.title = tabTitleFromPath(path)
    monaco.editor.setModelLanguage(tab.model, MONACO_LANG[languageForFile(path)])
    renderTabs()
  }
  try {
    await window.api.ideWriteFile(path, content, tab.encoding ?? 'utf-8')
    flashStatus('已保存：' + path)
  } catch (e) { window.alert('保存失败：' + (e instanceof Error ? e.message : String(e))) }
}

function flashStatus(text: string): void {
  const el = document.getElementById('ide-status')
  if (el) el.textContent = text
}

function parentDir(p: string): string {
  const i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'))
  return i <= 0 ? p : p.slice(0, i)
}

async function openFolder(): Promise<void> {
  const dir = await window.api.ideOpenFolder()
  if (!dir) return
  ideOpenFolderAt(dir)
}

/** 直接在 IDE 打开某个目录（克隆仓库后使用）。 */
export function ideOpenFolderAt(dir: string): void {
  treeRoot = dir
  treeDir = dir
  const tree = document.getElementById('ide-tree')
  tree?.classList.remove('hidden')
  const rootEl = document.getElementById('ide-tree-root')
  if (rootEl) rootEl.textContent = dir
  void renderTree()
  window.api.configSet({ ide: { lastFolder: dir } }).catch(() => {})
  document.dispatchEvent(new CustomEvent('dsh:navigate', { detail: 'ide' }))
}

function restoreLastFolder(dir: string): void {
  treeRoot = dir
  treeDir = dir
  const tree = document.getElementById('ide-tree')
  tree?.classList.remove('hidden')
  const rootEl = document.getElementById('ide-tree-root')
  if (rootEl) rootEl.textContent = dir
  void renderTree()
}

function startInlineRename(row: HTMLElement, name: string, path: string): void {
  const nameSpan = row.querySelector('.ide-tree-name') as HTMLElement | null
  if (!nameSpan) return
  const input = document.createElement('input')
  input.className = 'ide-tree-input'
  input.value = name
  nameSpan.replaceWith(input)
  input.focus()
  input.select()
  let done = false
  const finish = (newName: string): void => {
    if (done) return
    done = true
    if (newName.trim() && newName.trim() !== name) {
      void window.api.ideRenameFile(path, newName.trim()).then(({ newPath }) => {
        const t = tabs.find((x) => x.path === path)
        if (t) { t.path = newPath; t.title = tabTitleFromPath(newPath); monaco.editor.setModelLanguage(t.model, MONACO_LANG[languageForFile(newPath)]); renderTabs() }
        highlightPath = newPath
        void renderTree()
        flashStatus('已重命名为：' + newPath)
      }).catch((err) => { void renderTree(); window.alert('重命名失败：' + (err instanceof Error ? err.message : String(err))) })
    } else {
      void renderTree()
    }
  }
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(input.value)
    else if (e.key === 'Escape') finish('')
  })
  input.addEventListener('blur', () => finish(input.value))
}

function renameLocalPath(path: string): void {
  treeDir = parentDir(path)
  document.getElementById('ide-tree')?.classList.remove('hidden')
  void (async () => {
    await renderTree()
    const rows = Array.from(document.querySelectorAll('.ide-tree-row')) as HTMLElement[]
    const row = rows.find((r) => r.title === path)
    if (row) startInlineRename(row, tabTitleFromPath(path), path)
  })()
}

async function deleteLocalPath(path: string): Promise<void> {
  if (!window.confirm('确定删除 ' + path + ' 吗？')) return
  try {
    await window.api.ideDeleteFile(path)
    const t = tabs.find((x) => x.path === path)
    if (t) closeTab(t.id)
    void renderTree()
    flashStatus('已删除：' + path)
  } catch (err) { window.alert('删除失败：' + (err instanceof Error ? err.message : String(err))) }
}

function treeContextItems(e: { name: string; path: string; type: 'file' | 'dir' }): CtxMenuItem[] {
  if (e.type === 'dir') {
    return [
      { label: '打开', onClick: () => { treeDir = e.path; void renderTree() } },
      { label: '复制路径', onClick: () => copyText(e.path) },
      { label: '重命名', onClick: () => void renameLocalPath(e.path) }
    ]
  }
  return [
    { label: '打开', onClick: () => void openFileInTab(e.path) },
    { label: '复制名称', onClick: () => copyText(e.name) },
    { label: '复制路径', onClick: () => copyText(e.path) },
    { label: '重命名', onClick: () => void renameLocalPath(e.path) },
    { label: '删除', onClick: () => void deleteLocalPath(e.path) }
  ]
}

async function renderTree(): Promise<void> {
  const list = document.getElementById('ide-tree-list')
  if (!list) return
  list.replaceChildren()
  list.appendChild(h('div', 'gh-loading', '加载中…'))
  try {
    const entries = await window.api.ideListDir(treeDir)
    list.replaceChildren()
    if (treeDir !== treeRoot) {
      const back = h('button', 'ide-tree-up', '↑ 上级目录')
      back.addEventListener('click', () => { treeDir = parentDir(treeDir); void renderTree() })
      list.appendChild(back)
    }
    for (const e of entries) {
      const row = h('div', 'ide-tree-row')
      row.appendChild(h('span', 'ide-tree-icon', e.type === 'dir' ? '▸' : '·'))
      row.appendChild(h('span', 'ide-tree-name', e.name))
      row.title = e.path
      row.addEventListener('click', () => {
        if (e.type === 'dir') { treeDir = e.path; void renderTree() }
        else void openFileInTab(e.path)
      })
      row.addEventListener('contextmenu', (ev) => {
        ev.preventDefault()
        showContextMenu(ev.clientX, ev.clientY, treeContextItems(e))
      })
      if (highlightPath === e.path) row.classList.add('ide-tree-row-active')
      list.appendChild(row)
    }
    const active = list.querySelector('.ide-tree-row-active') as HTMLElement | null
    if (active) {
      active.scrollIntoView({ block: 'center' })
      if (highlightPath) {
        const p = highlightPath
        highlightPath = null
        setTimeout(() => active.classList.remove('ide-tree-row-active'), 2400)
        void p
      }
    }
  } catch (e) { list.replaceChildren(h('div', 'gh-error', '读取目录失败')) }
}

function runLanguage(tab: Tab): 'python' | 'cpp' | 'java' | null {
  const ml = tab.model.getLanguageId()
  if (ml === 'python' || ml === 'cpp' || ml === 'java') return ml as 'python' | 'cpp' | 'java'
  const l = languageForFile(tab.title)
  return l === 'python' || l === 'cpp' || l === 'java' ? l : null
}

function bottomPanel(): { bottom: HTMLElement; head: HTMLElement; out: HTMLElement; ai: HTMLElement; apply: HTMLElement } {
  return {
    bottom: document.getElementById('ide-bottom') as HTMLElement,
    head: document.getElementById('ide-bottom-head') as HTMLElement,
    out: document.getElementById('ide-run-output') as HTMLElement,
    ai: document.getElementById('ide-ai-body') as HTMLElement,
    apply: document.getElementById('ide-apply-row') as HTMLElement
  }
}

function showOutput(text: string): void {
  const p = bottomPanel()
  p.bottom.classList.remove('hidden')
  p.head.textContent = '输出'
  p.out.classList.remove('hidden')
  p.out.textContent = text
  p.ai.classList.add('hidden')
  p.apply.classList.add('hidden')
}

function aiHistoryEl(): HTMLElement { return document.getElementById('ide-ai-history') as HTMLElement }
function aiInputEl(): HTMLInputElement { return document.getElementById('ide-ai-input') as HTMLInputElement }
function aiApplyEl(): HTMLElement { return document.getElementById('ide-ai-apply') as HTMLElement }

function renderAiHistory(): void {
  const el = aiHistoryEl()
  el.replaceChildren()
  if (aiHistory.length === 0) {
    el.appendChild(h('div', 'ide-ai-empty', '选中代码后点「解释 / 找错 / 优化」，或在下方输入问题对话'))
    return
  }
  for (const m of aiHistory) {
    const b = h('div', 'ide-ai-msg ide-ai-' + m.role)
    if (m.role === 'assistant') b.innerHTML = DOMPurify.sanitize(renderMarkdown(m.content))
    else b.textContent = m.content
    el.appendChild(b)
  }
  el.scrollTop = el.scrollHeight
}

function currentCodeContext(): string {
  const tab = activeTab()
  if (!tab || !editor) return ''
  const sel = editor.getSelection()
  if (sel && !sel.isEmpty()) {
    lastAiRange = sel
    return tab.model.getValueInRange(sel)
  }
  lastAiRange = null
  return tab.model.getValue()
}

async function sendAiChat(question: string, action: 'explain' | 'debug' | 'optimize' | 'chat' = 'chat'): Promise<void> {
  const q = question.trim()
  if (!q) return
  aiHistory.push({ role: 'user', content: q })
  renderAiHistory()
  lastAiAction = action
  const tab = activeTab()
  const lang = tab ? (runLanguage(tab) ?? 'plaintext') : 'plaintext'
  const prompt = buildChatPrompt(aiHistory, q, currentCodeContext(), lang)
  const waiting = h('div', 'ide-ai-msg ide-ai-assistant', '思考中…')
  aiHistoryEl().appendChild(waiting)
  aiHistoryEl().scrollTop = aiHistoryEl().scrollHeight
  try {
    const promptPath = await window.api.ideRunTemp('ai_prompt.txt')
    await window.api.ideWriteFile(promptPath, prompt)
    const res = await window.api.aiAsk({ promptPath, model: aiModel || undefined })
    waiting.remove()
    aiHistory.push({ role: 'assistant', content: res.text })
    renderAiHistory()
    const code = extractCodeBlock(res.text)
    if (canApplyAi(lastAiAction, !!code)) { lastAiCode = code; aiApplyEl().classList.remove('hidden') }
    else { lastAiCode = null; aiApplyEl().classList.add('hidden') }
  } catch (e) {
    waiting.remove()
    aiHistory.push({ role: 'assistant', content: 'AI 失败：' + (e instanceof Error ? e.message : String(e)) })
    renderAiHistory()
  }
}

function quickAsk(action: 'explain' | 'debug' | 'optimize'): void {
  const q =
    action === 'explain'
      ? '请解释这段代码的功能与关键逻辑（简明清晰）'
      : action === 'debug'
        ? '请找出这段代码中的 bug 或潜在问题，并说明原因与修复建议'
        : '请优化这段代码，使其更简洁、高效、可读；先简要列出优化点，再在一个 fenced code block 里给出完整优化后的代码'
  void sendAiChat(q, action)
}

function applyAiCode(): void {
  const tab = activeTab()
  if (!tab || lastAiCode == null || !editor) return
  const oldText = lastAiRange ? tab.model.getValueInRange(lastAiRange) : tab.model.getValue()
  startInlineReview(oldText, lastAiCode, lastAiRange)
}

function applyRange(text: string, targetRange: monaco.Range | null): void {
  const model = activeTab()?.model
  const ed = editor
  if (!model || !ed) return
  const range = targetRange ?? model.getFullModelRange()
  ed.executeEdits('ai-inline', [{ range, text }])
}

function closeInlineReview(): void {
  inlineDecoModel?.deltaDecorations(inlineDecoIds, [])
  inlineDecoIds = []
  inlineDecoModel = null
  document.getElementById('ide-inline-review')?.remove()
}

function startInlineReview(oldText: string, newText: string, targetRange: monaco.Range | null): void {
  closeInlineReview()
  const model = activeTab()?.model
  const ed = editor
  if (!model || !ed) return
  const hunks = diffHunks(oldText, newText)
  if (hunks.length === 0) { flashStatus('AI 返回的代码与当前一致，无需修改'); return }
  const accepted = hunks.map(() => false)
  const decided = hunks.map(() => false)
  let contentChanged = false
  inlineDecoModel = model
  inlineDecoIds = []
  const base = targetRange ? targetRange.startLineNumber - 1 : 0
  const drawDecos = (): void => {
    if (contentChanged) return
    const ds: monaco.editor.IModelDeltaDecoration[] = []
    hunks.forEach((h, i) => {
      if (decided[i] || h.oldCount === 0) return
      ds.push({ range: new monaco.Range(base + h.oldStart + 1, 1, base + h.oldStart + h.oldCount, 1), options: { isWholeLine: true, className: 'ide-inline-removed' } })
    })
    inlineDecoIds = model.deltaDecorations(inlineDecoIds, ds)
  }
  drawDecos()

  const panel = h('div', 'ide-inline-review')
  panel.id = 'ide-inline-review'
  const head = h('div', 'ide-inline-head')
  head.appendChild(h('span', '', '审查 AI 修改'))
  const acceptAll = h('button', 'btn primary', '全部接受')
  acceptAll.addEventListener('click', () => {
    closeInlineReview()
    applyRange(applyHunks(oldText, hunks, hunks.map(() => true)), targetRange)
    lastAiCode = null
    lastAiRange = null
    aiApplyEl().classList.add('hidden')
    flashStatus('已全部应用，可 Ctrl+Z 撤回')
  })
  head.appendChild(acceptAll)
  const closeBtn = h('button', 'ide-inline-close', '×')
  closeBtn.addEventListener('click', () => closeInlineReview())
  head.appendChild(closeBtn)
  panel.appendChild(head)

  const list = h('div', 'ide-inline-list')
  hunks.forEach((hk, i) => {
    const row = h('div', 'ide-inline-hunk')
    const preview = document.createElement('pre')
    preview.className = 'ide-inline-preview'
    const oldSeg = oldText.split('\n').slice(hk.oldStart, hk.oldStart + hk.oldCount)
    for (const l of oldSeg) { const d = document.createElement('div'); d.className = 'ide-diff-del'; d.textContent = '- ' + l; preview.appendChild(d) }
    for (const l of hk.newLines) { const d = document.createElement('div'); d.className = 'ide-diff-add'; d.textContent = '+ ' + l; preview.appendChild(d) }
    row.appendChild(preview)
    const btns = h('div', 'ide-inline-btns')
    const apply = h('button', 'btn', '应用')
    apply.addEventListener('click', () => {
      accepted[i] = true
      decided[i] = true
      contentChanged = true
      inlineDecoModel?.deltaDecorations(inlineDecoIds, [])
      inlineDecoIds = []
      applyRange(applyHunks(oldText, hunks, accepted), targetRange)
      row.classList.add('ide-inline-done')
    })
    const ignore = h('button', 'btn', '忽略')
    ignore.addEventListener('click', () => {
      decided[i] = true
      row.classList.add('ide-inline-done')
      drawDecos()
    })
    btns.appendChild(apply)
    btns.appendChild(ignore)
    row.appendChild(btns)
    list.appendChild(row)
  })
  panel.appendChild(list)
  document.getElementById('ide-editor-wrap')?.appendChild(panel)
}

function undoAiEdit(): void {
  editor?.trigger('ai', 'undo', null)
  flashStatus('已撤销')
}

function closeApplyDiff(): void {
  document.getElementById('ide-diff-overlay')?.remove()
}

function buildDiffLines(oldText: string, newText: string): HTMLElement {
  const pre = document.createElement('pre')
  pre.className = 'ide-diff-pre'
  const parts = diffLines(oldText, newText)
  for (const p of parts) {
    const lns = p.value.replace(/\n$/, '').split('\n')
    for (const ln of lns) {
      const el = document.createElement('div')
      el.className = p.added ? 'ide-diff-add' : p.removed ? 'ide-diff-del' : 'ide-diff-same'
      el.textContent = (p.added ? '+ ' : p.removed ? '- ' : '  ') + ln
      pre.appendChild(el)
    }
  }
  return pre
}

function openApplyDiff(oldText: string, newText: string, onConfirm: () => void): void {
  closeApplyDiff()
  const overlay = h('div', 'ide-diff-overlay')
  overlay.id = 'ide-diff-overlay'
  const modal = h('div', 'ide-diff-modal')
  const head = h('div', 'ide-diff-head')
  head.appendChild(h('span', '', '确认应用修改'))
  const close = h('button', 'ide-diff-close', '×')
  close.addEventListener('click', closeApplyDiff)
  head.appendChild(close)
  modal.appendChild(head)
  const body = h('div', 'ide-diff-body')
  body.appendChild(buildDiffLines(oldText, newText))
  modal.appendChild(body)
  const actions = h('div', 'ide-diff-actions')
  const ok = h('button', 'btn primary', '确认替换')
  ok.addEventListener('click', () => { closeApplyDiff(); onConfirm() })
  const cancel = h('button', 'btn', '取消')
  cancel.addEventListener('click', closeApplyDiff)
  actions.appendChild(ok)
  actions.appendChild(cancel)
  modal.appendChild(actions)
  overlay.appendChild(modal)
  document.body.appendChild(overlay)
}

async function compileActive(): Promise<void> {
  const tab = activeTab()
  if (!tab) return
  const lang = runLanguage(tab)
  if (!lang) {
    window.alert('当前文件语言不支持编译（支持 Python / C / C++ / Java）。请手动把语言切换为其中之一。')
    return
  }
  const content = tab.model.getValue()
  try {
    let targetPath = tab.path
    if (!targetPath) targetPath = await window.api.ideRunTemp(defaultRunFileName(lang))
    await window.api.ideWriteFile(targetPath, content, tab.encoding ?? 'utf-8')
    showOutput('编译中…')
    const res = await window.api.ideCompile({ language: lang, targetPath })
    monaco.editor.setModelMarkers(tab.model, 'compile', [])
    if (res.ok) {
      showOutput('编译成功，无错误')
    } else {
      showOutput(res.output + (res.exitCode !== null ? ('\n[退出码 ' + res.exitCode + ']') : ''))
      const errs = parseCompileErrors(res.output)
      if (errs.length) {
        const markers: monaco.editor.IMarkerData[] = errs.map((e) => ({
          severity: monaco.MarkerSeverity.Error,
          message: e.message,
          startLineNumber: Math.max(1, e.line),
          startColumn: e.column,
          endLineNumber: Math.max(1, e.line),
          endColumn: 1000
        }))
        monaco.editor.setModelMarkers(tab.model, 'compile', markers)
        editor?.revealLineInCenter(Math.max(1, errs[0].line))
        editor?.setPosition({ lineNumber: Math.max(1, errs[0].line), column: errs[0].column })
      }
    }
  } catch (e) {
    showOutput('编译失败：' + (e instanceof Error ? e.message : String(e)))
  }
}
async function runActive(): Promise<void> {
  const tab = activeTab()
  if (!tab) return
  const lang = runLanguage(tab)
  if (!lang) {
    window.alert('当前文件语言不支持一键运行（支持 Python / C / C++ / Java）。请手动把语言切换为其中之一。')
    return
  }
  const content = tab.model.getValue()
  const interactive = isInteractiveSource(content, lang) || usesConsoleApis(content)
  try {
    let targetPath = tab.path
    if (!targetPath) {
      targetPath = await window.api.ideRunTemp(defaultRunFileName(lang))
    }
    await window.api.ideWriteFile(targetPath, content, tab.encoding ?? 'utf-8')
    showOutput('运行中…')
    const res: IdeRunResult = await window.api.ideRun({ language: lang, targetPath, interactive })
    if (res.interactive) showOutput('已在新控制台窗口运行（交互式程序，请在控制台输入数据后回车；若程序没有提示语，直接输入即可）')
    else showOutput((res.output || '(无输出)') + (res.exitCode !== null ? '\n[退出码 ' + res.exitCode + ']' : ''))
  } catch (e) {
    showOutput('运行失败：' + (e instanceof Error ? e.message : String(e)))
  }
}

async function loadAiModels(): Promise<void> {
  try {
    const { current, models } = await window.api.aiListModels()
    const sel = document.getElementById('ide-ai-model') as HTMLSelectElement | null
    if (!sel) return
    sel.replaceChildren()
    const def = document.createElement('option')
    def.value = ''
    def.textContent = '默认（' + current + '）'
    sel.appendChild(def)
    for (const m of models) {
      const o = document.createElement('option')
      o.value = m
      o.textContent = m
      sel.appendChild(o)
    }
  } catch { /* 保持空下拉 */ }
}

function copyAll(): void {
  const tab = activeTab()
  if (!tab) return
  navigator.clipboard.writeText(tab.model.getValue()).then(() => flashStatus('已复制全文')).catch(() => window.alert('复制失败'))
}

async function deleteActiveFile(): Promise<void> {
  const tab = activeTab()
  if (!tab) return
  if (tab.github) { await deleteGithubActive(); return }
  const path = tab.path
  if (!path) { window.alert('当前标签未保存到磁盘，无需删除'); return }
  if (!window.confirm('确定删除文件 ' + path + ' 吗？')) return
  try {
    await window.api.ideDeleteFile(path)
    closeTab(tab.id)
    flashStatus('已删除：' + path)
  } catch (e) { window.alert('删除失败：' + (e instanceof Error ? e.message : String(e))) }
}

function renameActiveFile(): void {
  const tab = activeTab()
  if (!tab) return
  if (tab.github) { window.alert('这是 GitHub 文件，暂不支持在此重命名'); return }
  if (!tab.path) { window.alert('当前标签尚未保存到磁盘，无法重命名（请先 Ctrl+S 保存）'); return }
  if (!treeRoot) { window.alert('请先点工具栏「打开文件夹」打开项目文件夹，再重命名'); return }
  renameLocalPath(tab.path)
}

function revealInTree(): void {
  const tab = activeTab()
  if (!tab) return
  if (!tab.path) { window.alert('当前标签没有本地路径（未保存或 GitHub 文件），无法定位'); return }
  if (!treeRoot) { window.alert('请先点工具栏「打开文件夹」打开一个项目文件夹，再使用「在文件树中定位」'); return }
  if (!tab.path.startsWith(treeRoot)) { window.alert('当前文件不在已打开的项目文件夹内'); return }
  treeDir = parentDir(tab.path)
  highlightPath = tab.path
  document.getElementById('ide-tree')?.classList.remove('hidden')
  void renderTree()
  flashStatus('已定位到：' + tab.path)
}

function registerContextActions(): void {
  if (!editor) return
  editor.addAction({ id: 'dsh-copy-all', label: '复制全文', contextMenuGroupId: 'dsh', contextMenuOrder: 1, run: () => copyAll() })
  editor.addAction({ id: 'dsh-delete-file', label: '删除文件', contextMenuGroupId: 'dsh', contextMenuOrder: 2, run: () => void deleteActiveFile() })
  editor.addAction({ id: 'dsh-rename-file', label: '重命名文件', contextMenuGroupId: 'dsh', contextMenuOrder: 3, run: () => void renameActiveFile() })
  editor.addAction({ id: 'dsh-reveal-file', label: '在文件树中定位', contextMenuGroupId: 'dsh', contextMenuOrder: 4, run: () => revealInTree() })
}

function saveLayout(): void {
  window.api.configSet({ ide: { layout: { treeWidth, aiWidth, outputHeight } } }).catch(() => {})
}

function makeSplitter(vertical: boolean, onDrag: (delta: number) => void, onEnd: () => void): HTMLElement {
  const el = h('div', 'ide-splitter ' + (vertical ? 'v' : 'h'))
  let start = 0
  el.addEventListener('mousedown', (e) => {
    e.preventDefault()
    start = vertical ? e.clientX : e.clientY
    document.body.classList.add('ide-resizing')
    const move = (ev: MouseEvent): void => {
      const delta = (vertical ? ev.clientX : ev.clientY) - start
      start = vertical ? ev.clientX : ev.clientY
      onDrag(delta)
    }
    const up = (): void => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      document.body.classList.remove('ide-resizing')
      onEnd()
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  })
  return el
}

function buildDom(): void {
  if (!panel) return
  panel.replaceChildren()
  const toolbar = h('div', 'ide-toolbar')
  const newBtn = h('button', 'btn', '新建')
  newBtn.addEventListener('click', () => { const t = newTab('未命名', null, '', 'plaintext'); switchTab(t.id) })
  toolbar.appendChild(newBtn)
  const openBtn = h('button', 'btn', '打开文件')
  openBtn.addEventListener('click', () => { void window.api.ideOpenFiles().then(openFiles) })
  toolbar.appendChild(openBtn)
  const folderBtn = h('button', 'btn', '打开文件夹')
  folderBtn.addEventListener('click', () => void openFolder())
  toolbar.appendChild(folderBtn)
  const saveBtn = h('button', 'btn primary', '保存')
  saveBtn.addEventListener('click', () => void saveActive())
  toolbar.appendChild(saveBtn)
  const runBtn = h('button', 'btn', '运行')
  runBtn.addEventListener('click', () => void runActive())
  toolbar.appendChild(runBtn)
  const compileBtn = h('button', 'btn', '编译')
  compileBtn.addEventListener('click', () => void compileActive())
  toolbar.appendChild(compileBtn)
  const dlG = h('button', 'btn', '下载') as HTMLButtonElement
  dlG.id = 'ide-gh-download'
  dlG.addEventListener('click', () => void downloadGithubActive())
  toolbar.appendChild(dlG)
  const delG = h('button', 'btn', '删除') as HTMLButtonElement
  delG.id = 'ide-gh-delete'
  delG.addEventListener('click', () => void deleteGithubActive())
  toolbar.appendChild(delG)
  const commitG = h('button', 'btn', '提交') as HTMLButtonElement
  commitG.id = 'ide-gh-commit'
  commitG.addEventListener('click', () => void openCommitPanel())
  toolbar.appendChild(commitG)
  toolbar.appendChild(h('span', 'spacer'))
  toolbar.appendChild(h('span', 'set-label', '语言'))
  const langSel = document.createElement('select')
  langSel.id = 'ide-lang'
  langSel.className = 'gh-search'
  langSel.style.cssText = 'flex:0 0 auto; min-width:110px;'
  for (const l of LANG_LABELS) { const o = document.createElement('option'); o.value = l.id; o.textContent = l.label; langSel.appendChild(o) }
  langSel.addEventListener('change', () => ideSetLanguage(langSel.value as IdeLanguage))
  toolbar.appendChild(langSel)
  const status = h('span', 'ide-status', '')
  status.id = 'ide-status'
  toolbar.appendChild(status)
  panel.appendChild(toolbar)

  const main = h('div', 'ide-main')
  const tree = h('aside', 'ide-tree hidden')
  tree.id = 'ide-tree'
  tree.style.width = treeWidth + 'px'
  tree.appendChild(h('div', 'ide-tree-head', '文件'))
  const rootLabel = h('div', 'ide-tree-root', '')
  rootLabel.id = 'ide-tree-root'
  tree.appendChild(rootLabel)
  const list = h('div', 'ide-tree-list')
  list.id = 'ide-tree-list'
  tree.appendChild(list)
  main.appendChild(tree)
  main.appendChild(makeSplitter(true, (d) => { treeWidth = clamp(treeWidth + d, 120, 520); tree.style.width = treeWidth + 'px' }, saveLayout))
  const wrap = h('div', 'ide-editor-wrap')
  const tabsBar = h('div', 'ide-tabs')
  tabsBar.id = 'ide-tabs'
  wrap.appendChild(tabsBar)
  const host = h('div', 'ide-editor-host')
  host.id = 'ide-editor'
  wrap.appendChild(host)
  main.appendChild(wrap)
  // 右侧 AI 面板
  const aiPanel = h('aside', 'ide-ai-panel')
  aiPanel.id = 'ide-ai-panel'
  aiPanel.style.width = aiWidth + 'px'
  const aiHead = h('div', 'ide-ai-head')
  aiHead.appendChild(h('span', 'ide-ai-title', 'AI 助手'))
  const modelSel = document.createElement('select')
  modelSel.id = 'ide-ai-model'
  modelSel.className = 'gh-search'
  modelSel.style.cssText = 'flex:1 1 auto; min-width:0;'
  modelSel.addEventListener('change', () => { aiModel = modelSel.value })
  aiHead.appendChild(modelSel)
  aiPanel.appendChild(aiHead)
  const aiActions = h('div', 'ide-ai-actions')
  const mkAi = (label: string, action: 'explain' | 'debug' | 'optimize'): HTMLElement => {
    const b = h('button', 'btn', label)
    b.addEventListener('click', () => quickAsk(action))
    return b
  }
  aiActions.appendChild(mkAi('解释', 'explain'))
  aiActions.appendChild(mkAi('找错', 'debug'))
  aiActions.appendChild(mkAi('优化', 'optimize'))
  aiPanel.appendChild(aiActions)
  const aiHistoryBox = h('div', 'ide-ai-history')
  aiHistoryBox.id = 'ide-ai-history'
  aiPanel.appendChild(aiHistoryBox)
  const aiApply = h('div', 'ide-apply-row hidden')
  aiApply.id = 'ide-ai-apply'
  const applyBtn2 = h('button', 'btn primary', '应用到编辑器')
  applyBtn2.addEventListener('click', () => applyAiCode())
  aiApply.appendChild(applyBtn2)
  const undoBtn2 = h('button', 'btn', '撤销')
  undoBtn2.addEventListener('click', () => undoAiEdit())
  aiApply.appendChild(undoBtn2)
  aiPanel.appendChild(aiApply)
  const inputRow = h('div', 'ide-ai-input-row')
  const chatInput = document.createElement('input')
  chatInput.id = 'ide-ai-input'
  chatInput.className = 'gh-search'
  chatInput.placeholder = '向 AI 提问，回车发送…'
  const sendBtn = h('button', 'btn primary', '发送')
  const doSend = (): void => { const v = chatInput.value; chatInput.value = ''; void sendAiChat(v) }
  chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend() })
  sendBtn.addEventListener('click', doSend)
  inputRow.appendChild(chatInput)
  inputRow.appendChild(sendBtn)
  aiPanel.appendChild(inputRow)
  main.appendChild(makeSplitter(true, (d) => { aiWidth = clamp(aiWidth - d, 200, 640); aiPanel.style.width = aiWidth + 'px' }, saveLayout))
  main.appendChild(aiPanel)
  panel.appendChild(main)

  panel.appendChild(makeSplitter(false, (d) => { outputHeight = clamp(outputHeight - d, 80, 520); if (bottomRef) bottomRef.style.height = outputHeight + 'px' }, saveLayout))
  const bottom = h('div', 'ide-bottom hidden')
  bottom.id = 'ide-bottom'
  bottom.style.height = outputHeight + 'px'
  bottomRef = bottom
  const head = h('div', 'ide-panel-head', '输出')
  head.id = 'ide-bottom-head'
  bottom.appendChild(head)
  const out = h('pre', 'ide-run-output', '')
  out.id = 'ide-run-output'
  bottom.appendChild(out)
  const aiBody = h('div', 'gh-readme ide-ai-body')
  aiBody.id = 'ide-ai-body'
  bottom.appendChild(aiBody)
  const applyRow = h('div', 'ide-apply-row hidden')
  applyRow.id = 'ide-apply-row'
  const applyBtn = h('button', 'btn primary', '应用到编辑器')
  applyBtn.addEventListener('click', () => applyAiCode())
  applyRow.appendChild(applyBtn)
  bottom.appendChild(applyRow)
  panel.appendChild(bottom)
}

export async function initIde(): Promise<void> {
  panel = document.getElementById('panel-ide')
  if (!panel) return
  let lastFolder = ''
  try {
    const cfg = await window.api.configGet()
    treeWidth = cfg.ide?.layout?.treeWidth ?? 200
    aiWidth = cfg.ide?.layout?.aiWidth ?? 320
    outputHeight = cfg.ide?.layout?.outputHeight ?? 160
    lastFolder = cfg.ide?.lastFolder ?? ''
  } catch { /* 用默认值 */ }
  buildDom()
  if (lastFolder) restoreLastFolder(lastFolder)
  editor = monaco.editor.create(document.getElementById('ide-editor') as HTMLElement, {
    value: '', language: 'plaintext', theme: editorTheme(), automaticLayout: true,
    fontSize: 14, tabSize: 4, minimap: { enabled: true }
  })
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => void saveActive())
  registerContextActions()
  const first = newTab('未命名', null, '', 'plaintext')
  switchTab(first.id)
  updateGithubButtons()
  renderAiHistory()
  void loadAiModels()
}
