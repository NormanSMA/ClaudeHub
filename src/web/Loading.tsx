export function Loading({ error }: { error: string | null }) {
  return <div className="empty">{error ? `No se pudo cargar (${error}). Esta corriendo el servidor?` : 'Leyendo tus logs...'}</div>
}
