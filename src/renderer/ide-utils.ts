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

/** 从完整路径取标签标题。 */
export function tabTitleFromPath(path: string): string {
  const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return i < 0 ? path : path.slice(i + 1)
}
