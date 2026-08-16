import type { StatsBucket, StatsCtx } from '../shared/types'

let panel = 'chat'
let ideFile: string | null = null
let ideLang = 'plaintext'

export function statsSetPanel(p: string): void {
  panel = p
  push()
}

export function statsSetIde(file: string | null, lang: string): void {
  ideFile = file
  ideLang = lang
  push()
}

function push(): void {
  let bucket: StatsBucket = null
  let ctx: StatsCtx = {}
  if (panel === 'chat') bucket = 'chat'
  else if (panel === 'ide' && ideFile) { bucket = 'code'; ctx = { file: ideFile, lang: ideLang } }
  window.api.statsSetBucket(bucket, ctx).catch(() => {})
}
