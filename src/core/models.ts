const KNOWN: Record<string, string> = {
  haiku: 'Haiku',
  sonnet: 'Sonnet',
  opus: 'Opus',
  fable: 'Fable',
}

/** "claude-opus-5-5" -> "Opus 5.5", "claude-haiku-4-5-20251001" -> "Haiku 4.5" */
export function modelName(id: string): string {
  const m = id.toLowerCase().match(/^claude-(?:(\d+)-(\d+)-)?([a-z]+)(?:-(\d+))?(?:-(\d{1,2}))?(?:-\d{8})?/)
  if (!m) return id
  const family = KNOWN[m[3]] ?? m[3][0].toUpperCase() + m[3].slice(1)
  const version = m[1] ? `${m[1]}.${m[2]}` : m[4] ? (m[5] ? `${m[4]}.${m[5]}` : m[4]) : ''
  return version ? `${family} ${version}` : family
}
