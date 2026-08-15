import monaco from './monaco-setup'
import { languageForFile, tabTitleFromPath, type IdeLanguage } from './ide-utils'

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

interface Tab { id: number; title: string; path: string | null; model: monaco.editor.ITextModel }

let panel: HTMLElement | null = null
let editor: monaco.editor.IStandaloneCodeEditor | null = null
let tabs: Tab[] = []
let activeId = 0
let nextTabId = 1
let treeRoot: string | null = null
let treeDir = ''

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
  treeRoot = dir
  treeDir = dir
  const tree = document.getElementById('ide-tree')
  tree?.classList.remove('hidden')
  const rootEl = document.getElementById('ide-tree-root')
  if (rootEl) rootEl.textContent = dir
  await renderTree()
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
  bottom.appendChild(h('div', 'ide-panel-head', '输出'))
  const out = h('pre', 'ide-run-output', '')
  out.id = 'ide-run-output'
  bottom.appendChild(out)
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
}
