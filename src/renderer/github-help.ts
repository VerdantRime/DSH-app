export const GITHUB_TOKEN_URL = 'https://github.com/settings/tokens?type=beta'

export const TOKEN_HELP_STEPS: string[] = [
  '1. 打开 GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens',
  '2. 点「Generate new token」，选择仓库，Permissions 设为 Read-only（只读）',
  '3. 生成后复制 token，粘贴到下方输入框并「保存并验证」'
]
