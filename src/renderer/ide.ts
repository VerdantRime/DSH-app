import monaco from './monaco-setup'
import { languageForFile, type IdeLanguage } from './ide-utils'

const MONACO_LANG: Record<IdeLanguage, string> = {
  python: 'python',
  cpp: 'cpp',
  java: 'java',
  javascript: 'javascript',
  typescript: 'typescript',
  json: 'json',
  markdown: 'markdown',
  html: 'html',
  css: 'css',
  plaintext: 'plaintext'
}

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

let panel: HTMLElement | null = null
let editor: monaco.editor.IStandaloneCodeEditor | null = null
let currentLang: IdeLanguage = 'plaintext'

function h(tag: string, className?: string, text?: string): HTMLElement {
  const e = document.createElement(tag)
  if (className) e.className = className
  if (text !== undefined) e.textContent = text
  return e
}

function editorTheme(): string {
  return document.documentElement.dataset.theme === 'dark' ? 'vs-dark' : 'vs'
}

export function ideSetLanguage(lang: IdeLanguage): void {
  currentLang = lang
  const model = editor?.getModel()
  if (model) monaco.editor.setModelLanguage(model, MONACO_LANG[lang])
  const sel = document.getElementById('ide-lang') as HTMLSelectElement | null
  if (sel) sel.value = lang
}

/** 打开文件时自动识别语言。 */
export function ideDetectLanguage(name: string): void {
  ideSetLanguage(languageForFile(name))
}

export function initIde(): void {
  panel = document.getElementById('panel-ide')
  if (!panel) return
  buildDom()
  editor = monaco.editor.create(document.getElementById('ide-editor') as HTMLElement, {
    value: '',
    language: 'plaintext',
    theme: editorTheme(),
    automaticLayout: true,
    fontSize: 14,
    tabSize: 4,
    minimap: { enabled: true }
  })
  ideSetLanguage('plaintext')
}

function buildDom(): void {
  if (!panel) return
  panel.replaceChildren()

  const toolbar = h('div', 'ide-toolbar')
  toolbar.appendChild(h('span', 'set-label', '语言'))
  const langSel = document.createElement('select')
  langSel.id = 'ide-lang'
  langSel.className = 'gh-search'
  langSel.style.cssText = 'flex:0 0 auto; min-width:120px;'
  for (const l of LANG_LABELS) {
    const o = document.createElement('option')
    o.value = l.id
    o.textContent = l.label
    langSel.appendChild(o)
  }
  langSel.addEventListener('change', () => ideSetLanguage(langSel.value as IdeLanguage))
  toolbar.appendChild(langSel)
  toolbar.appendChild(h('span', 'gh-note-readonly', '打开文件后自动识别语言'))
  panel.appendChild(toolbar)

  const tabs = h('div', 'ide-tabs')
  tabs.id = 'ide-tabs'
  tabs.appendChild(h('button', 'ide-tab active', '未命名'))
  panel.appendChild(tabs)

  const host = h('div', 'ide-editor-host')
  host.id = 'ide-editor'
  panel.appendChild(host)

  const bottom = h('div', 'ide-bottom hidden')
  bottom.id = 'ide-bottom'
  bottom.appendChild(h('div', 'ide-panel-head', '输出'))
  const out = h('pre', 'ide-run-output', '')
  out.id = 'ide-run-output'
  bottom.appendChild(out)
  panel.appendChild(bottom)
}
