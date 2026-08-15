import { describe, it, expect } from 'vitest'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { toolPath, projectSources, javaMainClass, decodeOutput, buildBatchScript, isLinkError, run, type RunResult } from '../src/main/runner'
import { isInteractiveSource, usesConsoleApis, defaultRunFileName } from '../src/renderer/ide-utils'
import * as iconv from 'iconv-lite'

describe('runner 纯函数', () => {
  it('toolPath 解析目录/可执行/默认', () => {
    expect(toolPath(undefined, 'g++.exe')).toBe('g++.exe')
    expect(toolPath('C:\\mingw64\\bin', 'g++.exe')).toBe('C:\\mingw64\\bin\\g++.exe')
    expect(toolPath('C:\\x\\g++.exe', 'g++.exe')).toBe('C:\\x\\g++.exe')
  })

  it('projectSources 列出目录下 C/C++ 源文件', async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), 'proj-'))
    await fs.writeFile(join(dir, 'a.cpp'), 'int a;')
    await fs.writeFile(join(dir, 'b.c'), 'int b;')
    await fs.writeFile(join(dir, 'note.txt'), 'x')
    const files = projectSources(join(dir, 'a.cpp'))
    expect(files.length).toBe(2)
    expect(files.some((f) => f.endsWith('a.cpp'))).toBe(true)
    expect(files.some((f) => f.endsWith('b.c'))).toBe(true)
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('javaMainClass 去掉扩展名', () => {
    expect(javaMainClass('C:\\x\\Main.java')).toBe('Main')
  })

  it('buildBatchScript 包含 cd、命令、暂停与 exit（跑完自动关窗）', () => {
    const bat = buildBatchScript('C:\\test\\后续法建链表.exe', [], 'C:\\test')
    expect(bat).toContain('@echo off')
    expect(bat).toContain('cd /d')
    expect(bat).toContain('后续法建链表.exe')
    expect(bat).toContain('pause')
    expect(bat).toContain('exit')
  })

  it('isLinkError 识别未定义引用链接错误', () => {
    expect(isLinkError('undefined reference to `add(int, int)\'')).toBe(true)
    expect(isLinkError('collect2: ld returned 1 exit status')).toBe(true)
    expect(isLinkError("error: expected ')' before '*' token")).toBe(false)
  })

  it('decodeOutput 正确解码 UTF-8 与 GBK（中文不乱码）', () => {
    expect(decodeOutput(Buffer.from('hello', 'utf-8'))).toBe('hello')
    expect(decodeOutput(Buffer.from('中文输出', 'utf-8'))).toBe('中文输出')
    // '你' 的 GBK 编码为 0xC4 0xE3，不是合法 UTF-8，应回退 GBK 解码
    expect(decodeOutput(Buffer.from([0xc4, 0xe3]))).toBe('你')
    expect(decodeOutput(null)).toBe('')
  })
})

describe('交互输入检测', () => {
  it('识别 scanf/cin/input/Scanner', () => {
    expect(isInteractiveSource('int x; scanf("%d", &x);', 'cpp')).toBe(true)
    expect(isInteractiveSource('int x; std::cin >> x;', 'cpp')).toBe(true)
    expect(isInteractiveSource('x = input()', 'python')).toBe(true)
    expect(isInteractiveSource('Scanner sc = new Scanner(System.in);', 'java')).toBe(true)
    expect(isInteractiveSource('print("hi")', 'python')).toBe(false)
    expect(isInteractiveSource('printf("hi");', 'cpp')).toBe(false)
  })

  it('usesConsoleApis 识别 system/conio/getch 等控制台专属 API', () => {
    expect(usesConsoleApis('system("color 0c");')).toBe(true)
    expect(usesConsoleApis('#include <conio.h>\nint x = getch();')).toBe(true)
    expect(usesConsoleApis('printf("hello");')).toBe(false)
    expect(usesConsoleApis('scanf("%d", &x);')).toBe(false)
  })

  it('默认运行文件名', () => {
    expect(defaultRunFileName('python')).toBe('main.py')
    expect(defaultRunFileName('cpp')).toBe('main.cpp')
    expect(defaultRunFileName('java')).toBe('Main.java')
  })
})

describe('runner 真实编译运行（依赖本机工具链）', () => {
  it('Python 脚本运行输出', async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), 'run-py-'))
    const f = join(dir, 'main.py')
    await fs.writeFile(f, 'print("hello-py")\n')
    const res: RunResult = run({ language: 'python', targetPath: f, interactive: false })
    expect(res.ok).toBe(true)
    expect(res.output).toContain('hello-py')
    await fs.rm(dir, { recursive: true, force: true })
  }, 30000)

  it('多文件项目：单文件链接失败后自动整目录编译并运行', async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), 'run-multi-'))
    await fs.writeFile(join(dir, 'util.cpp'), 'int add(int a, int b) { return a + b; }\n')
    await fs.writeFile(join(dir, 'main.cpp'), '#include <cstdio>\nint add(int, int);\nint main() { printf("%d\\n", add(2, 3)); return 0; }\n')
    const res: RunResult = run({ language: 'cpp', targetPath: join(dir, 'main.cpp'), interactive: false })
    expect(res.ok).toBe(true)
    expect(res.output).toContain('5')
    await fs.rm(dir, { recursive: true, force: true })
  }, 30000)

  it('GBK 源文件中文正常输出（不产生乱码）', async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), 'run-gbk-'))
    const f = join(dir, 'main.c')
    await fs.writeFile(f, iconv.encode('#include <stdio.h>\nint main(){ printf("天天开心呀\\n"); return 0; }\n', 'gbk'))
    const res: RunResult = run({ language: 'cpp', targetPath: f, interactive: false })
    expect(res.ok).toBe(true)
    expect(res.output).toContain('天天开心呀')
    await fs.rm(dir, { recursive: true, force: true })
  }, 30000)

  it('C 编译并运行输出', async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), 'run-c-'))
    const f = join(dir, 'main.c')
    await fs.writeFile(f, '#include <stdio.h>\nint main(){ printf("hello-c\\n"); return 0; }\n')
    const res: RunResult = run({ language: 'cpp', targetPath: f, interactive: false })
    expect(res.ok).toBe(true)
    expect(res.output).toContain('hello-c')
    await fs.rm(dir, { recursive: true, force: true })
  }, 30000)
})
