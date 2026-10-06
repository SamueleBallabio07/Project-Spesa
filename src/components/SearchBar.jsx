import { useRef, useEffect } from 'react';

/**
 * Barra di ricerca riutilizzabile con icona, clear button e focus management.
 */
export function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = 'Cerca…',
  ariaLabel = 'Cerca',
  autoFocus = false,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div className="searchbar">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        enterKeyHint="search"
      />
      {value && (
        <button
          type="button"
          className="searchbar-clear"
          onClick={() => onClear?.()}
          aria-label="Cancella ricerca"
        >
          ×
        </button>
      )}
    </div>
  );
}