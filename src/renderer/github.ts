import type {
  RepoSummary,
  FileContent,
  IssueSummary,
  IssueDetail,
  PullSummary,
  PullDetail,
  CommitSummary,
  CommitDetail
} from '../shared/types'
import DOMPurify from 'dompurify'
import { renderMarkdown } from './markdown'
import { parentPath, fileNameOf, joinRepoPath, validateNewFileName, breadcrumbSegments, formatFileSize, isMarkdownFile } from './github-utils'
import { GITHUB_TOKEN_URL, TOKEN_HELP_STEPS } from './github-help'

type ListMode = 'mine' | 'starred' | 'search'
type Tab = 'files' | 'issues' | 'pulls' | 'commits' | 'readme'

let panel: HTMLElement | null = null
let loggedIn = false
let username = ''
let listMode: ListMode = 'mine'
let searchQuery = ''
let currentRepo: { owner: string; repo: string } | null = null
let currentTab: Tab = 'files'
let filePath = ''
let issueState: 'open' | 'closed' = 'open'
let pullState: 'open' | 'closed' = 'open'
let currentFileSha = ''
let currentFileContent = ''

function h(tag: string, className?: string, text?: string): HTMLElement {
  const e = document.createElement(tag)
  if (className) e.className = className
  if (text !== undefined) e.textContent = text
  return e
}

function btn(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button')
  b.className = 'btn'
  b.textContent = label
  b.addEventListener('click', onClick)
  return b
}

function clear(node: HTMLElement): void {
  node.replaceChildren()
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function initGithub(): void {
  panel = document.getElementById('panel-github')
  void boot()
}

async function boot(): Promise<void> {
  if (!panel) return
  clear(panel)
  panel.appendChild(h('div', 'gh-loading', '加载中…'))
  try {
    const st = await window.api.githubGetStatus()
    loggedIn = st.loggedIn
    username = st.username ?? ''
  } catch {
    loggedIn = false
  }
  const sb = document.getElementById('status-github')
  if (sb) sb.textContent = loggedIn ? 'GitHub: ' + username : 'GitHub: 未登录'
  if (!loggedIn) renderEmpty()
  else renderList()
}

function renderEmpty(): void {
  if (!panel) return
  clear(panel)
  const box = h('div', 'gh-empty')
  box.appendChild(h('div', 'gh-empty-icon', '🐙'))
  box.appendChild(h('div', '', '连接 GitHub（只读）'))
  box.appendChild(h('div', 'gh-empty-sub', '需要一个只读 Personal Access Token，按下面步骤获取：'))

  const help = h('div', 'gh-token-help')
  for (const step of TOKEN_HELP_STEPS) {
    help.appendChild(h('div', 'set-note', step))
  }
  help.appendChild(btn('打开 GitHub Token 页面', () => {
    void window.api.openExternal(GITHUB_TOKEN_URL)
  }))
  box.appendChild(help)

  box.appendChild(btn('去设置里配置 token', () => {
    document.dispatchEvent(new CustomEvent('dsh:navigate', { detail: 'settings' }))
  }))
  panel.appendChild(box)
}

// ---------------- 列表 ----------------
function renderList(): void {
  if (!panel) return
  clear(panel)
  const bar = h('div', 'gh-bar')
  const search = document.createElement('input')
  search.className = 'gh-search'
  search.placeholder = '搜索仓库…'
  search.value = searchQuery
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      searchQuery = search.value.trim()
      listMode = 'search'
      void loadList()
    }
  })
  bar.appendChild(search)
  const tabs: { id: ListMode; label: string }[] = [
    { id: 'mine', label: '我的仓库' },
    { id: 'starred', label: '星标' },
    { id: 'search', label: '搜索' }
  ]
  for (const t of tabs) {
    const b = btn(t.label, () => {
      listMode = t.id
      if (t.id !== 'search') searchQuery = ''
      void loadList()
    })
    b.classList.toggle('active', listMode === t.id)
    bar.appendChild(b)
  }
  const spacer = h('span', 'spacer')
  bar.appendChild(spacer)
  bar.appendChild(h('span', 'gh-user', username))
  bar.appendChild(btn('登出', () => {
    void window.api.githubClearToken().then(() => boot())
  }))
  panel.appendChild(bar)

  const listEl = h('div', 'gh-list')
  listEl.id = 'gh-list'
  panel.appendChild(listEl)
  void loadList()
}

async function loadList(): Promise<void> {
  const listEl = document.getElementById('gh-list')
  if (!listEl) return
  clear(listEl)
  listEl.appendChild(h('div', 'gh-loading', '加载中…'))
  try {
    let repos: RepoSummary[]
    if (listMode === 'search') {
      repos = searchQuery ? await window.api.githubSearchRepos(searchQuery) : []
    } else {
      repos = await window.api.githubListRepos(listMode)
    }
    clear(listEl)
    if (repos.length === 0) {
      listEl.appendChild(h('div', 'gh-empty', '没有结果'))
      return
    }
    for (const r of repos) listEl.appendChild(repoCard(r))
  } catch (e) {
    clear(listEl)
    listEl.appendChild(h('div', 'gh-error', '加载失败：' + errMsg(e)))
  }
}

function repoCard(r: RepoSummary): HTMLElement {
  const card = h('div', 'gh-card')
  card.addEventListener('click', () => openRepo(r.owner, r.name))
  card.appendChild(h('div', 'gh-card-title', r.fullName))
  if (r.description) card.appendChild(h('div', 'gh-card-desc', r.description))
  card.appendChild(h('div', 'gh-card-meta', '⭐ ' + r.stars + '  🍴 ' + r.forks + '  ' + (r.language ?? '') + '  更新于 ' + (r.updatedAt ? r.updatedAt.slice(0, 10) : '')))
  return card
}

// ---------------- 仓库详情 ----------------
function openRepo(owner: string, repo: string): void {
  currentRepo = { owner, repo }
  currentTab = 'files'
  filePath = ''
  void renderRepo()
}

async function renderRepo(): Promise<void> {
  if (!panel || !currentRepo) return
  clear(panel)
  const breadcrumb = h('div', 'gh-breadcrumb')
  breadcrumb.appendChild(btn('← 返回', () => {
    currentRepo = null
    renderList()
  }))
  breadcrumb.appendChild(h('span', 'gh-crumb', currentRepo.owner + ' / ' + currentRepo.repo))
  panel.appendChild(breadcrumb)

  const meta = h('div', 'gh-meta', '加载中…')
  meta.id = 'gh-repo-meta'
  panel.appendChild(meta)

  const tabBar = h('div', 'gh-tabs')
  const tabs: { id: Tab; label: string }[] = [
    { id: 'files', label: '文件' },
    { id: 'issues', label: 'Issues' },
    { id: 'pulls', label: 'PR' },
    { id: 'commits', label: 'Commits' },
    { id: 'readme', label: 'README' }
  ]
  for (const t of tabs) {
    const b = btn(t.label, () => {
      currentTab = t.id
      void renderTab()
    })
    b.classList.toggle('active', currentTab === t.id)
    tabBar.appendChild(b)
  }
  panel.appendChild(tabBar)

  const content = h('div', 'gh-content')
  content.id = 'gh-content'
  panel.appendChild(content)

  try {
    const d = await window.api.githubGetRepo(currentRepo.owner, currentRepo.repo)
    const metaEl = document.getElementById('gh-repo-meta')
    if (metaEl) {
      metaEl.textContent = '⭐ ' + d.stars + '  🍴 ' + d.forks + '  👁 ' + d.watchers + '  ' + (d.language ?? '')
      metaEl.appendChild(btn('在 GitHub 打开', () => void window.api.openExternal(d.htmlUrl)))
    }
  } catch {
    const metaEl = document.getElementById('gh-repo-meta')
    if (metaEl) metaEl.textContent = '无法加载仓库信息'
  }
  void renderTab()
}

function renderTab(): void {
  if (currentTab === 'files') void loadFiles()
  else if (currentTab === 'issues') void loadIssues()
  else if (currentTab === 'pulls') void loadPulls()
  else if (currentTab === 'commits') void loadCommits()
  else void loadReadme()
}

// 文件
async function loadFiles(): Promise<void> {
  const content = document.getElementById('gh-content')
  if (!content || !currentRepo) return
  clear(content)
  content.appendChild(h('div', 'gh-loading', '加载中…'))
  try {
    const { tree, file } = await window.api.githubGetContents(currentRepo.owner, currentRepo.repo, filePath)
    clear(content)
    if (file) {
      content.appendChild(btn('← 返回文件列表', () => {
        filePath = parentPath(filePath)
        void loadFiles()
      }))
      content.appendChild(h('pre', 'gh-code', file.content))
      return
    }
    const bc = h('div', 'gh-breadcrumb')
    const rootBtn = btn('根目录', () => {
      filePath = ''
      void loadFiles()
    })
    rootBtn.classList.toggle('active', filePath === '')
    bc.appendChild(rootBtn)
    for (const seg of breadcrumbSegments(filePath)) {
      bc.appendChild(h('span', 'gh-crumb-sep', '›'))
      const b = btn(seg.label, () => {
        filePath = seg.path
        void loadFiles()
      })
      bc.appendChild(b)
    }
    content.appendChild(bc)
    const tools = h('div', 'gh-bar')
    tools.appendChild(btn('⬆ 上传文件', () => pickAndUpload()))
    tools.appendChild(btn('＋ 新建文件', () => createFile()))
    content.appendChild(tools)
    if (tree.length === 0) {
      content.appendChild(h('div', 'gh-empty', '空目录'))
      return
    }
    for (const n of tree) {
      const row = h('div', 'gh-file-row')
      row.appendChild(h('span', 'gh-file-label', (n.type === 'dir' ? '📁 ' : '📄 ') + n.name))
      if (n.type === 'file' && n.size > 0) {
        row.appendChild(h('span', 'gh-file-size', formatFileSize(n.size)))
      }
      row.addEventListener('click', () => {
        if (n.type === 'dir') {
          filePath = n.path
          void loadFiles()
        } else {
          filePath = n.path
          void loadFileContent(n.path)
        }
      })
      content.appendChild(row)
    }
  } catch (e) {
    clear(content)
    content.appendChild(h('div', 'gh-error', '加载失败：' + errMsg(e)))
  }
}

function pickAndUpload(): void {
  if (!currentRepo) return
  const input = document.createElement('input')
  input.type = 'file'
  input.addEventListener('change', () => {
    const f = input.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '')
      const comma = dataUrl.indexOf(',')
      const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : ''
      if (!b64) {
        window.alert('读取文件失败，请重试')
        return
      }
      const target = (filePath ? filePath + '/' : '') + f.name
      const message = window.prompt('提交说明（commit message）', 'Upload ' + target)
      if (message === null) return
      void (async () => {
        try {
          let sha: string | undefined
          const { file } = await window.api.githubGetContents(currentRepo!.owner, currentRepo!.repo, target)
          if (file) sha = file.sha
          await window.api.githubUploadFile(currentRepo!.owner, currentRepo!.repo, target, b64, message, sha)
          void loadFiles()
        } catch (e) {
          window.alert('上传失败：' + errMsg(e))
        }
      })()
    }
    reader.readAsDataURL(f)
  })
  input.click()
}

async function downloadFile(path: string): Promise<void> {
  if (!currentRepo) return
  const name = fileNameOf(path)
  try {
    const dest = await window.api.githubPickSavePath(name)
    if (!dest) return
    await window.api.githubDownloadFile(currentRepo.owner, currentRepo.repo, path, dest)
    window.alert('已保存到：' + dest)
  } catch (e) {
    window.alert('下载失败：' + errMsg(e))
  }
}

function createFile(): void {
  if (!currentRepo) return
  const name = window.prompt('新文件名（创建在当前目录）', '')
  if (name === null) return
  const err = validateNewFileName(name)
  if (err) {
    window.alert(err)
    return
  }
  const target = joinRepoPath(filePath, name.trim())
  renderEditor(target, '', undefined, () => {
    filePath = parentPath(target)
    void loadFiles()
  })
}

async function loadFileContent(path: string): Promise<void> {
  if (!currentRepo) return
  const content = document.getElementById('gh-content')
  if (!content) return
  clear(content)
  content.appendChild(h('div', 'gh-loading', '加载中…'))
  try {
    const { file } = await window.api.githubGetContents(currentRepo.owner, currentRepo.repo, path)
    clear(content)
    if (file) {
      currentFileSha = file.sha
      currentFileContent = file.content
      const bar = h('div', 'gh-bar')
      bar.appendChild(btn('← 返回文件列表', () => {
        filePath = parentPath(path)
        void loadFiles()
      }))
      bar.appendChild(btn('编辑', () => renderEditor(path, currentFileContent, currentFileSha)))
      bar.appendChild(btn('⬇ 下载', () => void downloadFile(path)))
      bar.appendChild(btn('删除', () => {
        if (!window.confirm('确定删除文件 ' + path + ' 吗？此操作会产生一次删除提交。')) return
        const message = window.prompt('提交说明（commit message）', 'Delete ' + path)
        if (message === null) return
        void window.api
          .githubDeleteFile(currentRepo!.owner, currentRepo!.repo, path, message, currentFileSha)
          .then(() => {
            filePath = parentPath(path)
            void loadFiles()
          })
          .catch((e) => window.alert('删除失败：' + errMsg(e)))
      }))
      content.appendChild(bar)
      if (isMarkdownFile(path)) {
        const body = h('div', 'gh-readme')
        const html = DOMPurify.sanitize(renderMarkdown(file.content))
        let raw = false
        const srcBtn = btn('源码', () => {
          raw = !raw
          refresh()
        })
        const refresh = (): void => {
          srcBtn.classList.toggle('active', raw)
          if (raw) {
            body.className = 'gh-code'
            body.textContent = file.content
          } else {
            body.className = 'gh-readme'
            body.innerHTML = html
          }
        }
        bar.appendChild(srcBtn)
        content.appendChild(body)
        refresh()
      } else {
        content.appendChild(h('pre', 'gh-code', file.content))
      }
    } else {
      content.appendChild(h('div', 'gh-empty', '无法读取该文件'))
    }
  } catch (e) {
    clear(content)
    content.appendChild(h('div', 'gh-error', '加载失败：' + errMsg(e)))
  }
}

function renderEditor(path: string, initialContent?: string, sha?: string, afterSave?: () => void): void {
  if (!currentRepo) return
  const content = document.getElementById('gh-content')
  if (!content) return
  clear(content)
  content.appendChild(h('h3', '', '编辑 ' + path))
  const ta = document.createElement('textarea')
  ta.className = 'gh-editor'
  ta.value = initialContent ?? currentFileContent
  content.appendChild(ta)
  const msg = document.createElement('input')
  msg.className = 'gh-search'
  msg.placeholder = '提交说明（commit message）'
  content.appendChild(msg)
  const done = afterSave ?? (() => void loadFileContent(path))
  const row = h('div', 'set-row')
  row.appendChild(btn('提交', () => {
    const message = msg.value.trim() || 'Update ' + path
    void window.api
      .githubSaveFile(currentRepo!.owner, currentRepo!.repo, path, ta.value, message, sha)
      .then(done)
      .catch((e) => window.alert('提交失败：' + errMsg(e)))
  }))
  row.appendChild(btn('取消', done))
  content.appendChild(row)
}

// Issues
async function loadIssues(): Promise<void> {
  const content = document.getElementById('gh-content')
  if (!content || !currentRepo) return
  clear(content)
  const toggle = h('div', 'gh-tabs')
  const o = btn('open', () => { issueState = 'open'; void loadIssues() })
  const c = btn('closed', () => { issueState = 'closed'; void loadIssues() })
  o.classList.toggle('active', issueState === 'open')
  c.classList.toggle('active', issueState === 'closed')
  toggle.appendChild(o)
  toggle.appendChild(c)
  content.appendChild(toggle)
  const list = h('div', 'gh-list')
  content.appendChild(list)
  list.appendChild(h('div', 'gh-loading', '加载中…'))
  try {
    const issues: IssueSummary[] = await window.api.githubListIssues(currentRepo.owner, currentRepo.repo, issueState)
    clear(list)
    if (issues.length === 0) {
      list.appendChild(h('div', 'gh-empty', '没有 issue'))
      return
    }
    for (const i of issues) {
      const row = h('div', 'gh-row', '#' + i.number + ' ' + i.title)
      row.appendChild(h('span', 'gh-row-meta', ' · ' + i.author))
      row.addEventListener('click', () => void openIssue(i.number))
      list.appendChild(row)
    }
  } catch (e) {
    clear(list)
    list.appendChild(h('div', 'gh-error', '加载失败：' + errMsg(e)))
  }
}

async function openIssue(number: number): Promise<void> {
  if (!currentRepo) return
  const content = document.getElementById('gh-content')
  if (!content) return
  clear(content)
  content.appendChild(h('div', 'gh-loading', '加载中…'))
  try {
    const i: IssueDetail = await window.api.githubGetIssue(currentRepo.owner, currentRepo.repo, number)
    clear(content)
    content.appendChild(btn('← 返回 Issues', () => void loadIssues()))
    content.appendChild(h('h3', '', '#' + i.number + ' ' + i.title))
    content.appendChild(h('pre', 'gh-body', i.body))
    for (const cm of i.comments) {
      const box = h('div', 'gh-comment')
      box.appendChild(h('div', 'gh-comment-head', cm.author + ' · ' + cm.createdAt))
      box.appendChild(h('pre', 'gh-body', cm.body))
      content.appendChild(box)
    }
  } catch (e) {
    clear(content)
    content.appendChild(h('div', 'gh-error', '加载失败：' + errMsg(e)))
  }
}

// Pulls
async function loadPulls(): Promise<void> {
  const content = document.getElementById('gh-content')
  if (!content || !currentRepo) return
  clear(content)
  const toggle = h('div', 'gh-tabs')
  const o = btn('open', () => { pullState = 'open'; void loadPulls() })
  const c = btn('closed', () => { pullState = 'closed'; void loadPulls() })
  o.classList.toggle('active', pullState === 'open')
  c.classList.toggle('active', pullState === 'closed')
  toggle.appendChild(o)
  toggle.appendChild(c)
  content.appendChild(toggle)
  const list = h('div', 'gh-list')
  content.appendChild(list)
  list.appendChild(h('div', 'gh-loading', '加载中…'))
  try {
    const pulls: PullSummary[] = await window.api.githubListPulls(currentRepo.owner, currentRepo.repo, pullState)
    clear(list)
    if (pulls.length === 0) {
      list.appendChild(h('div', 'gh-empty', '没有 PR'))
      return
    }
    for (const p of pulls) {
      const row = h('div', 'gh-row', '#' + p.number + ' ' + p.title)
      row.appendChild(h('span', 'gh-row-meta', ' · ' + p.headBranch + ' → ' + p.baseBranch))
      row.addEventListener('click', () => void openPull(p.number))
      list.appendChild(row)
    }
  } catch (e) {
    clear(list)
    list.appendChild(h('div', 'gh-error', '加载失败：' + errMsg(e)))
  }
}

async function openPull(number: number): Promise<void> {
  if (!currentRepo) return
  const content = document.getElementById('gh-content')
  if (!content) return
  clear(content)
  content.appendChild(h('div', 'gh-loading', '加载中…'))
  try {
    const p: PullDetail = await window.api.githubGetPull(currentRepo.owner, currentRepo.repo, number)
    clear(content)
    content.appendChild(btn('← 返回 PR', () => void loadPulls()))
    content.appendChild(h('h3', '', '#' + p.number + ' ' + p.title))
    content.appendChild(h('div', 'gh-meta', '+' + p.additions + ' -' + p.deletions + '  改动 ' + p.changedFiles + ' 个文件'))
    content.appendChild(h('pre', 'gh-body', p.body))
  } catch (e) {
    clear(content)
    content.appendChild(h('div', 'gh-error', '加载失败：' + errMsg(e)))
  }
}

// Commits
async function loadCommits(): Promise<void> {
  const content = document.getElementById('gh-content')
  if (!content || !currentRepo) return
  clear(content)
  content.appendChild(h('div', 'gh-loading', '加载中…'))
  try {
    const commits: CommitSummary[] = await window.api.githubListCommits(currentRepo.owner, currentRepo.repo)
    clear(content)
    if (commits.length === 0) {
      content.appendChild(h('div', 'gh-empty', '没有提交'))
      return
    }
    for (const cm of commits) {
      const row = h('div', 'gh-row', cm.message)
      row.appendChild(h('span', 'gh-row-meta', cm.author + ' · ' + cm.sha.slice(0, 7)))
      row.addEventListener('click', () => void openCommit(cm.sha))
      content.appendChild(row)
    }
  } catch (e) {
    clear(content)
    content.appendChild(h('div', 'gh-error', '加载失败：' + errMsg(e)))
  }
}

async function openCommit(sha: string): Promise<void> {
  if (!currentRepo) return
  const content = document.getElementById('gh-content')
  if (!content) return
  clear(content)
  content.appendChild(h('div', 'gh-loading', '加载中…'))
  try {
    const cm: CommitDetail = await window.api.githubGetCommit(currentRepo.owner, currentRepo.repo, sha)
    clear(content)
    content.appendChild(btn('← 返回 Commits', () => void loadCommits()))
    content.appendChild(h('h3', '', cm.message))
    for (const f of cm.files) {
      content.appendChild(h('div', 'gh-file-row', f.status + '  ' + f.filename + '  (+' + f.additions + ' -' + f.deletions + ')'))
    }
  } catch (e) {
    clear(content)
    content.appendChild(h('div', 'gh-error', '加载失败：' + errMsg(e)))
  }
}

// README（网页渲染）
async function loadReadme(): Promise<void> {
  const content = document.getElementById('gh-content')
  if (!content || !currentRepo) return
  clear(content)
  content.appendChild(h('div', 'gh-loading', '加载中…'))
  try {
    const readme = await window.api.githubGetReadme(currentRepo.owner, currentRepo.repo)
    clear(content)
    if (!readme) {
      content.appendChild(h('div', 'gh-empty', '该仓库没有 README'))
      return
    }
    content.appendChild(renderMarkdownView(readme.name, readme.content))
  } catch (e) {
    clear(content)
    content.appendChild(h('div', 'gh-error', '加载失败：' + errMsg(e)))
  }
}

/** 网页预览/源码 双视图的 Markdown 渲染器（README 与 .md 文件共用）。 */
function renderMarkdownView(name: string, markdown: string): HTMLElement {
  const box = h('div', 'gh-readme-wrap')
  const bar = h('div', 'gh-tabs')
  bar.appendChild(h('span', 'gh-crumb', '📖 ' + name))
  const previewBtn = btn('网页预览', () => set('preview'))
  const rawBtn = btn('源码', () => set('raw'))
  bar.appendChild(previewBtn)
  bar.appendChild(rawBtn)
  box.appendChild(bar)
  const body = h('div', 'gh-readme')
  box.appendChild(body)
  const html = DOMPurify.sanitize(renderMarkdown(markdown))
  function set(mode: 'preview' | 'raw'): void {
    previewBtn.classList.toggle('active', mode === 'preview')
    rawBtn.classList.toggle('active', mode === 'raw')
    if (mode === 'preview') {
      body.className = 'gh-readme'
      body.innerHTML = html
    } else {
      body.className = 'gh-code'
      body.textContent = markdown
    }
  }
  set('preview')
  return box
}
