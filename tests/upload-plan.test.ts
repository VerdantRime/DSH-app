import { describe, it, expect } from 'vitest'
import { buildUploadPlan, MAX_UPLOAD_BYTES, toPosix } from '../src/main/upload-plan'

describe('上传计划构建', () => {
  it('files 模式映射为仓库当前目录下的文件名', () => {
    const plan = buildUploadPlan([{ path: 'C:/x/a.cpp', size: 10 }], '', 'src', 'files')
    expect(plan.files).toEqual([{ localPath: 'C:/x/a.cpp', repoPath: 'src/a.cpp', size: 10 }])
    expect(plan.skipped).toEqual([])
  })

  it('folder 模式保留子目录结构', () => {
    const plan = buildUploadPlan([
      { path: 'C:/proj/src/a.cpp', size: 10 },
      { path: 'C:/proj/README.md', size: 5 }
    ], 'C:/proj', 'lib', 'folder')
    expect(plan.files).toEqual([
      { localPath: 'C:/proj/src/a.cpp', repoPath: 'lib/src/a.cpp', size: 10 },
      { localPath: 'C:/proj/README.md', repoPath: 'lib/README.md', size: 5 }
    ])
  })

  it('跳过 .git 目录', () => {
    const plan = buildUploadPlan([{ path: 'C:/proj/.git/config', size: 100 }], 'C:/proj', '', 'folder')
    expect(plan.files).toEqual([])
    expect(plan.skipped[0].reason).toBe('跳过 .git')
  })

  it('跳过超过 100MB 的文件', () => {
    const plan = buildUploadPlan([{ path: 'C:/proj/big.bin', size: MAX_UPLOAD_BYTES + 1 }], 'C:/proj', '', 'folder')
    expect(plan.files).toEqual([])
    expect(plan.skipped[0].reason).toBe('超过 100MB')
  })

  it('toPosix 转成正斜杠', () => {
    expect(toPosix('C:\\a\\b')).toBe('C:/a/b')
  })
})
