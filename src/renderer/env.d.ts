import type { WorkdeskApi } from '../shared/types'

declare global {
  interface Window {
    api: WorkdeskApi
  }

  interface HTMLElementTagNameMap {
    webview: WebviewTag
  }

  interface WebviewTag extends HTMLElement {
    loadURL(url: string): void
    reload(): void
    getURL(): string
    src: string
  }
}

export {}
