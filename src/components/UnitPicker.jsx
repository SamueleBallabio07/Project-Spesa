import { useEffect, useRef, useState } from 'react';
import { convertQuantity } from '../lib/units';

/**
 * Selettore dell'unita' per un prodotto del catalogo.
 *
 * Bottone chiuso con l'unita' corrente, menu con le alternative sensate per
 * quell'alimento: i prodotti che si misurano in unita' sola non hanno un
 * selettore, perche' non c'e' nulla da scegliere.
 *
 * Il menu si apre verso l'alto: le card stanno in fondo allo schermo e sotto
 * finirebbero fuori viewport.
 */
export function UnitPicker({ units, value, quantity, onChange, itemName, disabled = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!units || units.length < 2) return null;

  const choose = (unit) => {
    setOpen(false);
    if (unit === value) return;

    // Cambiare unita' senza convertire il numero darebbe 100 kg a chi aveva
    // scritto 100 g. La nutrizione resterebbe anche sbagliata.
    const converted = convertQuantity(quantity, value, unit);
    onChange(converted === null ? quantity : converted, unit);
  };

  return (
    <span className="unit-picker" ref={rootRef}>
      <button
        type="button"
        className={`unit-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Unità di ${itemName}`}
      >
        {value}
      </button>

      {open && (
        <ul className="unit-menu" role="listbox" aria-label={`Unità di ${itemName}`}>
          {units.map((unit) => (
            <li key={unit} role="none">
              <button
                type="button"
                role="option"
                aria-selected={unit === value}
                className={`unit-option ${unit === value ? 'is-active' : ''}`}
                onClick={() => choose(unit)}
              >
                {unit}
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}