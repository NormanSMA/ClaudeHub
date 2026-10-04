// La extension de Safari lee la API desde su propio origen. Solo se permite ese origen.
const EXT_ORIGIN = /^safari-web-extension:\/\/[0-9A-Fa-f-]+$/

export function extensionOrigin(origin: string | undefined): string | null {
  return origin && EXT_ORIGIN.test(origin) ? origin : null
}
