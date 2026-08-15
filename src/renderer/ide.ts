import monaco from './monaco-setup'
import { languageForFile, tabTitleFromPath, isInteractiveSource, defaultRunFileName, extractCodeBlock, githubTabKey, type IdeLanguage } from './ide-utils'
import { githubErrorHint } from './github-utils'
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

interface Tab { id: number; title: string; path: string | null; model: monaco.editor.ITextModel; github?: { owner: string; repo: string; path: string; sha?: string; canPush: boolean } }

let panel: HTMLElement | null = null
let editor: monaco.editor.IStandaloneCodeEditor | null = null
let tabs: Tab[] = []
let activeId = 0
let nextTabId = 1
let treeRoot: string | null = null
let treeDir = ''
let lastAiCode: string | null = null
let lastAiRange: monaco.Range | null = null

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
    const { content } = await window.api.ideReadFile(path)
    const tab = newTab(tabTitleFromPath(path), path, content, languageForFile(path))
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
    await window.api.ideWriteFile(path, content)
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
  document.dispatchEvent(new CustomEvent('dsh:navigate', { detail: 'ide' }))
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
      list.appendChild(row)
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

function showAiResult(text: string, action: 'explain' | 'debug' | 'optimize'): void {
  const p = bottomPanel()
  p.bottom.classList.remove('hidden')
  p.head.textContent = 'AI 结果'
  p.out.classList.add('hidden')
  p.ai.classList.remove('hidden')
  p.ai.innerHTML = DOMPurify.sanitize(renderMarkdown(text))
  p.apply.classList.add('hidden')
  if (action === 'optimize') {
    const code = extractCodeBlock(text)
    if (code) {
      lastAiCode = code
      p.apply.classList.remove('hidden')
    }
  }
}

function showAiLoading(): void {
  const p = bottomPanel()
  p.bottom.classList.remove('hidden')
  p.head.textContent = 'AI 结果'
  p.out.classList.add('hidden')
  p.ai.classList.remove('hidden')
  p.ai.textContent = 'AI 思考中…（首次启动较慢，请稍候）'
  p.apply.classList.add('hidden')
}

async function aiAsk(action: 'explain' | 'debug' | 'optimize'): Promise<void> {
  const tab = activeTab()
  if (!tab || !editor) return
  const sel = editor.getSelection()
  let code = tab.model.getValue()
  if (sel && !sel.isEmpty()) {
    code = tab.model.getValueInRange(sel)
    lastAiRange = sel
  } else {
    lastAiRange = null
  }
  try {
    const tempPath = await window.api.ideRunTemp('ai_snippet.txt')
    await window.api.ideWriteFile(tempPath, code)
    showAiLoading()
    const res = await window.api.aiAsk({ action, codePath: tempPath, language: runLanguage(tab) ?? 'plaintext' })
    showAiResult(res.text, action)
  } catch (e) {
    showAiResult('AI 失败：' + (e instanceof Error ? e.message : String(e)), action)
  }
}

function applyAiCode(): void {
  const tab = activeTab()
  if (!tab || lastAiCode == null || !editor) return
  if (lastAiRange) {
    editor.executeEdits('ai', [{ range: lastAiRange, text: lastAiCode }])
  } else {
    tab.model.setValue(lastAiCode)
  }
  lastAiCode = null
  lastAiRange = null
  const p = bottomPanel()
  p.apply.classList.add('hidden')
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
  const interactive = isInteractiveSource(content, lang)
  try {
    let targetPath = tab.path
    if (!targetPath) {
      targetPath = await window.api.ideRunTemp(defaultRunFileName(lang))
    }
    await window.api.ideWriteFile(targetPath, content)
    const multiFile = treeRoot !== null && targetPath.startsWith(treeRoot)
    showOutput('运行中…')
    const res: IdeRunResult = await window.api.ideRun({ language: lang, targetPath, multiFile, interactive })
    if (res.interactive) showOutput('已在新控制台窗口中运行（交互式程序）')
    else showOutput((res.output || '(无输出)') + (res.exitCode !== null ? '\n[退出码 ' + res.exitCode + ']' : ''))
  } catch (e) {
    showOutput('运行失败：' + (e instanceof Error ? e.message : String(e)))
  }
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
  const aiBtn = (label: string, action: 'explain' | 'debug' | 'optimize'): HTMLElement => {
    const b = h('button', 'btn', label)
    b.addEventListener('click', () => void aiAsk(action))
    return b
  }
  toolbar.appendChild(aiBtn('AI 解释', 'explain'))
  toolbar.appendChild(aiBtn('AI 找错', 'debug'))
  toolbar.appendChild(aiBtn('AI 优化', 'optimize'))
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
  tree.appendChild(h('div', 'ide-tree-head', '文件'))
  const rootLabel = h('div', 'ide-tree-root', '')
  rootLabel.id = 'ide-tree-root'
  tree.appendChild(rootLabel)
  const list = h('div', 'ide-tree-list')
  list.id = 'ide-tree-list'
  tree.appendChild(list)
  main.appendChild(tree)
  const wrap = h('div', 'ide-editor-wrap')
  const tabsBar = h('div', 'ide-tabs')
  tabsBar.id = 'ide-tabs'
  wrap.appendChild(tabsBar)
  const host = h('div', 'ide-editor-host')
  host.id = 'ide-editor'
  wrap.appendChild(host)
  main.appendChild(wrap)
  panel.appendChild(main)

  const bottom = h('div', 'ide-bottom hidden')
  bottom.id = 'ide-bottom'
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

export function initIde(): void {
  panel = document.getElementById('panel-ide')
  if (!panel) return
  buildDom()
  editor = monaco.editor.create(document.getElementById('ide-editor') as HTMLElement, {
    value: '', language: 'plaintext', theme: editorTheme(), automaticLayout: true,
    fontSize: 14, tabSize: 4, minimap: { enabled: true }
  })
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => void saveActive())
  const first = newTab('未命名', null, '', 'plaintext')
  switchTab(first.id)
  updateGithubButtons()
}
