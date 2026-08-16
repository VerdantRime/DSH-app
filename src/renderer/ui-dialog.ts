// 自制应用内输入弹窗（替代 Electron 不支持的 window.prompt）
export interface PromptOptions {
  title: string
  label?: string
  defaultValue?: string
  placeholder?: string
  okText?: string
  cancelText?: string
  required?: boolean
}

export function promptDialog(opts: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'ui-dialog-overlay'
    const box = document.createElement('div')
    box.className = 'ui-dialog-box'
    const titleEl = document.createElement('div')
    titleEl.className = 'ui-dialog-title'
    titleEl.textContent = opts.title
    box.appendChild(titleEl)
    if (opts.label) {
      const labelEl = document.createElement('div')
      labelEl.className = 'ui-dialog-label'
      labelEl.textContent = opts.label
      box.appendChild(labelEl)
    }
    const input = document.createElement('input')
    input.className = 'ui-dialog-input'
    input.type = 'text'
    input.value = opts.defaultValue ?? ''
    input.placeholder = opts.placeholder ?? ''
    box.appendChild(input)
    const actions = document.createElement('div')
    actions.className = 'ui-dialog-actions'
    const ok = document.createElement('button')
    ok.className = 'btn primary'
    ok.textContent = opts.okText ?? '确定'
    const cancel = document.createElement('button')
    cancel.className = 'btn'
    cancel.textContent = opts.cancelText ?? '取消'
    actions.appendChild(ok)
    actions.appendChild(cancel)
    box.appendChild(actions)
    overlay.appendChild(box)
    document.body.appendChild(overlay)

    let done = false
    const finish = (value: string | null): void => {
      if (done) return
      done = true
      overlay.remove()
      resolve(value)
    }
    const submit = (): void => {
      const v = input.value
      if (opts.required && !v.trim()) {
        input.classList.add('ui-dialog-input-error')
        input.focus()
        return
      }
      finish(v)
    }
    ok.addEventListener('click', submit)
    cancel.addEventListener('click', () => finish(null))
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit()
      else if (e.key === 'Escape') finish(null)
    })
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) finish(null)
    })
    input.focus()
    input.select()
  })
}
