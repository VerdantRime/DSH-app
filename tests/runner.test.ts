import { describe, it, expect } from 'vitest'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { toolPath, projectSources, javaMainClass, run, type RunResult } from '../src/main/runner'
import { isInteractiveSource, defaultRunFileName } from '../src/renderer/ide-utils'

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
    const res: RunResult = run({ language: 'python', targetPath: f, multiFile: false, interactive: false })
    expect(res.ok).toBe(true)
    expect(res.output).toContain('hello-py')
    await fs.rm(dir, { recursive: true, force: true })
  }, 30000)

  it('C 编译并运行输出', async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), 'run-c-'))
    const f = join(dir, 'main.c')
    await fs.writeFile(f, '#include <stdio.h>\nint main(){ printf("hello-c\\n"); return 0; }\n')
    const res: RunResult = run({ language: 'cpp', targetPath: f, multiFile: false, interactive: false })
    expect(res.ok).toBe(true)
    expect(res.output).toContain('hello-c')
    await fs.rm(dir, { recursive: true, force: true })
  }, 30000)
})
