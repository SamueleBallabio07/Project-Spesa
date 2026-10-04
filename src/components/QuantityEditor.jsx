import { useEffect, useRef, useState } from 'react';
import { parseQuantityInput } from '../lib/quantity';

/**
 * Campo per riscrivere la quantità di un prodotto già in lista.
 *
 * Nasce al posto del numero nello stepper, con l'unità accanto e già
 * compilato sul valore corrente. Si conferma con Invio o toccando fuori, si
 * annulla con Esc.
 *
 * Il testo digitato resta libero finché non si conferma: `parseQuantityInput`
 * decide alla fine se è un valore utilizzabile. Se non lo è non viene scritto
 * niente e la quantità resta quella di prima.
 */
export function QuantityEditor({ value, unitLabel, itemName, onCommit, onCancel }) {
  // String(value) e non toLocaleString: i separatori delle migliaia
  // ("1.000") si confonderebbero con quello decimale e finirebbero nel DB.
  const [draft, setDraft] = useState(() => String(value));
  const inputRef = useRef(null);
  const settled = useRef(false);

  // Il campo prende il fuoco con tutto il testo selezionato: il primo tocco
  // su una tastiera sostituisce il valore invece di accodarci un digit.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, []);

  // Esc chiude il campo, e la perdita di focus che segue non deve salvare
  // quello che si stava annullando.
  const settle = (action) => {
    if (settled.current) return;
    settled.current = true;
    action();
  };

  const commit = () =>
    settle(() => {
      const parsed = parseQuantityInput(draft);
      if (parsed === null) onCancel();
      else onCommit(parsed);
    });

  return (
    <span className="qty-editor">
      <input
        ref={inputRef}
        className="qty-editor-input"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            settle(onCancel);
          }
        }}
        onBlur={commit}
        aria-label={`Quantità di ${itemName}`}
      />
      <span className="qty-editor-unit" aria-hidden="true">
        {unitLabel}
      </span>
    </span>
  );
}