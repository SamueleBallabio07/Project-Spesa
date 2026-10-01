import { useMemo, useState } from 'react';
import { nutritionFor, formatNutrition, formatMacros } from '../lib/nutrition';

const ALL = '__all__';

export default function CatalogScreen({
  selectedListId,
  selectedListName,
  loading,
  error,
  categories,
  search,
  onAddFood,
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ALL);
  // id -> quantità scelta, con default 1 (o 100g per i pesi)
  const [picked, setPicked] = useState({});
  const [added, setAdded] = useState({});

  const results = useMemo(() => search(query, category === ALL ? null : category), [search, query, category]);

  const pickQty = (food, next) => {
    const step = food.unitDefault === 'pezzi' ? 1 : food.unitDefault === 'kg' ? 0.1 : 10;
    const value = Math.max(step, Math.round((Number(next) || step) / step) * step);
    const rounded = Math.round(value * 100) / 100;
    setPicked((prev) => ({ ...prev, [food.id]: rounded }));
  };

  const initialQty = (food) => {
    if (picked[food.id] !== undefined) return picked[food.id];
    if (food.unitDefault === 'kg') return 0.5;
    if (food.unitDefault === 'pezzi') return 2;
    return 100;
  };

  const handleAdd = async (food) => {
    if (!selectedListId) return;
    const quantity = initialQty(food);

    const ok = await onAddFood({
      name: food.name,
      quantity,
      unit: food.unitDefault,
      category: food.category,
    });

    if (ok) {
      setAdded((prev) => ({ ...prev, [food.id]: Date.now() }));
      window.setTimeout(() => {
        setAdded((prev) => {
          const next = { ...prev };
          delete next[food.id];
          return next;
        });
      }, 1400);
    }
  };

  return (
    <div className="catalog">
      <header className="topbar">
        <div className="topbar-text">
          <p className="topbar-sub">Catalogo alimentare</p>
          <h1>Prodotti</h1>
        </div>
      </header>

      <div className="target-list">
        <span className="target-list-label">Aggiungi a</span>
        <span className="target-list-name">{selectedListName || 'Nessuna lista'}</span>
      </div>

      <div className="searchbar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca un alimento…"
          aria-label="Cerca nel catalogo"
          autoComplete="off"
          enterKeyHint="search"
        />
        {query && (
          <button type="button" className="searchbar-clear" onClick={() => setQuery('')} aria-label="Cancella ricerca">
            ×
          </button>
        )}
      </div>

      <div className="chips-scroll">
        <button
          type="button"
          className={`chip ${category === ALL ? 'is-active' : ''}`}
          onClick={() => setCategory(ALL)}
        >
          Tutti
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`chip ${category === cat ? 'is-active' : ''}`}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading && <p className="loading">Carico il catalogo…</p>}
      {error && <p className="alert">{error}</p>}

      {!loading && !error && (
        <>
          <p className="results-count">
            {results.length} {results.length === 1 ? 'alimento' : 'alimenti'}
          </p>

          {results.length === 0 ? (
            <div className="empty">
              <p className="empty-title">Nessun risultato</p>
              <p className="empty-body">
                {query ? <>Non c’è “{query}” nel catalogo.</> : 'Catalogo vuoto per questa categoria.'}
              </p>
              <p className="empty-hint">
                Puoi comunque aggiungerlo a mano dalla scheda Liste.
              </p>
            </div>
          ) : (
            <ul className="food-list">
              {results.map((food) => {
                const quantity = initialQty(food);
                const nutrition = nutritionFor(food, quantity, food.unitDefault);
                const justAdded = Boolean(added[food.id]);
                const step = food.unitDefault === 'pezzi' ? 1 : food.unitDefault === 'kg' ? 0.1 : 10;

                return (
                  <li key={food.id} className="food">
                    <div className="food-head">
                      <div className="food-title">
                        <span className="food-name">{food.name}</span>
                        <span className="food-cat">{food.category}</span>
                      </div>
                      <span className="food-kcal">
                        {food.kcal100g}
                        <small>kcal/100g</small>
                      </span>
                    </div>

                    <div className="food-macros">
                      <span>P {food.protein100g}g</span>
                      <span>C {food.carbs100g}g</span>
                      <span>F {food.fat100g}g</span>
                    </div>

                    <div className="food-add">
                      <div className="stepper">
                        <button
                          type="button"
                          onClick={() => pickQty(food, quantity - step)}
                          aria-label={`Diminua quantità di ${food.name}`}
                        >
                          −
                        </button>
                        <span className="stepper-value">
                          {quantity}
                          <small>{food.unitDefault}</small>
                        </span>
                        <button
                          type="button"
                          onClick={() => pickQty(food, quantity + step)}
                          aria-label={`Aumenta quantità di ${food.name}`}
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        className={`btn btn-primary food-add-btn ${justAdded ? 'is-added' : ''}`}
                        onClick={() => handleAdd(food)}
                        disabled={!selectedListId}
                      >
                        {justAdded ? 'Aggiunto ✓' : 'Aggiungi'}
                      </button>
                    </div>

                    <div className="food-nutrition">
                      <span className="food-nutrition-main">{formatNutrition(nutrition, food.unitDefault)}</span>
                      <span className="food-nutrition-macros">{formatMacros(nutrition)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}