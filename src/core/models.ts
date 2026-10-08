const KNOWN: Record<string, string> = {
  haiku: 'Haiku',
  sonnet: 'Sonnet',
  opus: 'Opus',
  fable: 'Fable',
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

/** "gpt-6.1-sol" -> "GPT 6.1 Sol", "gemini-3-flash-preview" -> "Gemini 3 Flash" */
function otherModelName(id: string): string | null {
  const gpt = id.match(/^gpt-(\d+(?:\.\d+)?)(?:-([a-z]+))?(?=-|$)/)
  if (gpt) return gpt[2] ? `GPT ${gpt[1]} ${cap(gpt[2])}` : `GPT ${gpt[1]}`
  const gem = id.match(/^gemini-(\d+(?:\.\d+)?)-([a-z]+)(?=-|$)/)
  if (gem) return `Gemini ${gem[1]} ${cap(gem[2])}`
  return null
}

/**
 * "claude-opus-5-5" -> "Opus 5.5", "claude-haiku-4-5-20251001" -> "Haiku 4.5".
 * Tambien reconoce modelos gpt y gemini.
 */
export function modelName(id: string): string {
  const other = otherModelName(id.toLowerCase())
  if (other) return other
  const m = id.toLowerCase().match(/^claude-(?:(\d+)-(\d+)-)?([a-z]+)(?:-(\d+))?(?:-(\d{1,2}))?(?:-\d{8})?/)
  if (!m) return id
  const family = KNOWN[m[3]] ?? m[3][0].toUpperCase() + m[3].slice(1)
  const version = m[1] ? `${m[1]}.${m[2]}` : m[4] ? (m[5] ? `${m[4]}.${m[5]}` : m[4]) : ''
  return version ? `${family} ${version}` : family
}
