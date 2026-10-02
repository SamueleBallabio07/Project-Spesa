/**
 * Stato vuoto riutilizzabile con titolo, descrizione e hint opzionale.
 */
export function EmptyState({
  title = 'Nessun risultato',
  body,
  hint,
  icon,
  className = '',
}) {
  return (
    <div className={`empty ${className}`}>
      {icon && <div className="empty-icon">{icon}</div>}
      <p className="empty-title">{title}</p>
      {body && <p className="empty-body">{body}</p>}
      {hint && <p className="empty-hint">{hint}</p>}
    </div>
  );
}

/**
 * Variante per risultati di ricerca vuoti.
 */
export function SearchEmptyState({
  query,
  onAddManual,
  manualLabel = 'Aggiungi a mano',
}) {
  return (
    <EmptyState
      title="Nessun risultato"
      body={query ? <>Non c'è “{query}” nel catalogo.</> : 'Nessun alimento corrispondente.'}
      hint={onAddManual && (
        <>
          Puoi <a href="#" onClick={(e) => { e.preventDefault(); onAddManual(); }}>{manualLabel}</a>.
        </>
      )}
    />
  );
}

/**
 * Variante per lista vuota.
 */
export function ListEmptyState({
  title = 'Lista vuota',
  body = 'Non c\'è ancora niente in questa lista.',
  hint,
}) {
  return (
    <EmptyState title={title} body={body} hint={hint} />
  );
}