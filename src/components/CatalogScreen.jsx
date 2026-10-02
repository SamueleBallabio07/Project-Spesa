import { useEffect, useMemo, useState } from 'react';
import { nutritionFor, formatNutrition, formatMacros } from '../lib/nutrition';
import { ThemeToggle } from './ThemeToggle';

const ALL = '__all__';
const VISIBLE = 40;

export default function CatalogScreen({
  selectedListId,
  selectedListName,
  loading,
  error,
  categories,
  search,
  ensureLoaded,
  onAddFood,
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ALL);
  const [picked, setPicked] = useState({});
  const [added, setAdded] = useState({});
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    name: '',
    quantity: 1,
    unit: 'g',
    category: '',
    kcal100g: '',
    protein100g: '',
    carbs100g: '',
    fat100g: '',
    fiber100g: '',
  });

  // Il catalogo si scarica solo quando apri questa scheda.
  useEffect(() => {
    ensureLoaded();
  }, [ensureLoaded]);

  const matches = useMemo(
    () => search(query, category === ALL ? null : category),
    [search, query, category]
  );
  const results = matches.slice(0, VISIBLE);

  const stepFor = (food) =>
    food.unitDefault === 'pezzi' ? 1 : food.unitDefault === 'kg' ? 0.1 : 10;

  const initialQty = (food) => {
    if (picked[food.fdcId] !== undefined) return picked[food.fdcId];
    if (food.unitDefault === 'kg') return 0.5;
    if (food.unitDefault === 'pezzi') return 1;
    return 100;
  };

  const pickQty = (food, next) => {
    const step = stepFor(food);
    const value = Math.max(step, Number(next) || step);
    const rounded = Math.round(value * 100) / 100;
    setPicked((prev) => ({ ...prev, [food.fdcId]: rounded }));
  };

  const handleAdd = async (food) => {
    if (!selectedListId) return;

    const ok = await onAddFood({
      name: food.displayName,
      quantity: initialQty(food),
      unit: food.unitDefault,
      category: food.category,
      kcal100g: food.kcal100g,
      protein100g: food.protein100g,
      carbs100g: food.carbs100g,
      fat100g: food.fat100g,
      fiber100g: food.fiber100g,
    });

    if (ok) {
      setAdded((prev) => ({ ...prev, [food.fdcId]: true }));
      window.setTimeout(() => {
        setAdded((prev) => {
          const next = { ...prev };
          delete next[food.fdcId];
          return next;
        });
      }, 1400);
    }
  };

  const handleManualAdd = async (event) => {
    event.preventDefault();
    if (!selectedListId || !onAddFood || !manualForm.name.trim()) return;

    const ok = await onAddFood({
      name: manualForm.name.trim(),
      quantity: Number(manualForm.quantity) || 1,
      unit: manualForm.unit,
      category: manualForm.category || null,
      // Valori nutrizionali per 100g
      kcal100g: manualForm.kcal100g ? Number(manualForm.kcal100g) : null,
      protein100g: manualForm.protein100g ? Number(manualForm.protein100g) : null,
      carbs100g: manualForm.carbs100g ? Number(manualForm.carbs100g) : null,
      fat100g: manualForm.fat100g ? Number(manualForm.fat100g) : null,
      fiber100g: manualForm.fiber100g ? Number(manualForm.fiber100g) : null,
    });

    if (ok) {
      setManualForm({
        name: '',
        quantity: 1,
        unit: 'g',
        category: '',
        kcal100g: '',
        protein100g: '',
        carbs100g: '',
        fat100g: '',
        fiber100g: '',
      });
      setShowManual(false);
    }
  };

  return (
    <div className="catalog">
      <header className="topbar">
        <div className="topbar-text">
          <p className="topbar-sub">Catalogo USDA</p>
          <h1>Prodotti</h1>
        </div>
        <div className="topbar-actions">
          <ThemeToggle />
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
          <button
            type="button"
            className="searchbar-clear"
            onClick={() => setQuery('')}
            aria-label="Cancella ricerca"
          >
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
            {matches.length === 0
              ? 'Nessun alimento'
              : `${matches.length} ${matches.length === 1 ? 'alimento' : 'alimenti'}`}
          </p>

          {matches.length === 0 ? (
            <div className="empty">
              <p className="empty-title">Nessun risultato</p>
              <p className="empty-body">
                {query ? <>Non c’è “{query}” nel catalogo.</> : 'Catalogo vuoto per questa categoria.'}
              </p>
              <p className="empty-hint">Puoi comunque aggiungerlo a mano dalla scheda Liste.</p>
            </div>
          ) : (
            <>
              <ul className="food-list">
                {results.map((food) => {
                  const quantity = initialQty(food);
                  const nutrition = nutritionFor(food, quantity, food.unitDefault);
                  const justAdded = Boolean(added[food.fdcId]);
                  const step = stepFor(food);

                  return (
                    <li key={food.fdcId} className="food">
                      <div className="food-head">
                        <div className="food-title">
                          <span className="food-name">{food.displayName}</span>
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
                        {food.fiber100g > 0 && <span>Fib {food.fiber100g}g</span>}
                      </div>

                      <div className="food-add">
                        <div className="stepper">
                          <button
                            type="button"
                            onClick={() => pickQty(food, quantity - step)}
                            aria-label={`Diminua quantità di ${food.displayName}`}
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
                            aria-label={`Aumenta quantità di ${food.displayName}`}
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
                        <span className="food-nutrition-main">
                          {formatNutrition(nutrition, food.unitDefault)}
                          {food.sizeLabel && food.unitDefault === 'pezzi' && (
                            <small className="food-size">1 {food.sizeLabel}</small>
                          )}
                        </span>
                        <span className="food-nutrition-macros">{formatMacros(nutrition)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {matches.length > results.length && (
                <p className="results-more">
                  {matches.length - results.length} altri risultati: restringi la ricerca.
                </p>
              )}
            </>
          )}
        </>
      )}

      {/* Aggiunta manuale con valori nutrizionali */}
      <section className="section" style={{marginTop: 'var(--gap)'}}>
        <button
          type="button"
          className="section-head section-head-btn"
          onClick={() => setShowManual((v) => !v)}
          aria-expanded={showManual}
        >
          <span>Aggiungi a mano</span>
          <span className="chevron">{showManual ? '▾' : '▸'}</span>
        </button>
        {showManual && (
          <form className="group form-rows" onSubmit={handleManualAdd} style={{marginTop: '12px'}}>
            <div className="field-row field-row-stack">
              <label className="field-label" htmlFor="m-name">
                Nome prodotto <span style={{color: 'var(--rust)'}}>*</span>
              </label>
              <input
                id="m-name"
                className="field-input"
                type="text"
                value={manualForm.name}
                onChange={(e) => setManualForm((p) => ({...p, name: e.target.value}))}
                placeholder="Es. Pane integrale fatto in casa"
                autoComplete="off"
                required
              />
            </div>

            <div className="field-row">
              <label className="field-label" htmlFor="m-qty">
                Quantità
              </label>
              <input
                id="m-qty"
                className="field-input field-input-narrow"
                type="number"
                min="0.1"
                step="0.1"
                value={manualForm.quantity}
                onChange={(e) => setManualForm((p) => ({...p, quantity: e.target.value}))}
              />
            </div>

            <div className="field-row">
              <label className="field-label" htmlFor="m-unit">
                Unità
              </label>
              <select
                id="m-unit"
                className="field-input"
                value={manualForm.unit}
                onChange={(e) => setManualForm((p) => ({...p, unit: e.target.value}))}
              >
                <option value="g">g</option>
                <option value="kg">kg</option>
                <option value="ml">ml</option>
                <option value="l">l</option>
                <option value="pezzi">pezzi</option>
              </select>
            </div>

            <div className="field-row">
              <label className="field-label" htmlFor="m-cat">
                Categoria
              </label>
              <select
                id="m-cat"
                className="field-input"
                value={manualForm.category}
                onChange={(e) => setManualForm((p) => ({...p, category: e.target.value}))}
              >
                <option value="">Nessuna</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <hr style={{margin: '16px 0', border: 'none', borderTop: '1px solid var(--separator)'}} />
            <p className="section-head" style={{margin: '0 0 12px', fontSize: '14px'}}>Valori nutrizionali per 100g (opzionali)</p>

            <div className="field-row">
              <label className="field-label" htmlFor="m-kcal">
                kcal
              </label>
              <input
                id="m-kcal"
                className="field-input field-input-narrow"
                type="number"
                min="0"
                step="1"
                value={manualForm.kcal100g}
                onChange={(e) => setManualForm((p) => ({...p, kcal100g: e.target.value}))}
                placeholder="Es. 252"
              />
            </div>

            <div className="field-row">
              <label className="field-label" htmlFor="m-protein">
                Proteine (g)
              </label>
              <input
                id="m-protein"
                className="field-input field-input-narrow"
                type="number"
                min="0"
                step="0.1"
                value={manualForm.protein100g}
                onChange={(e) => setManualForm((p) => ({...p, protein100g: e.target.value}))}
                placeholder="Es. 9.4"
              />
            </div>

            <div className="field-row">
              <label className="field-label" htmlFor="m-carbs">
                Carboidrati (g)
              </label>
              <input
                id="m-carbs"
                className="field-input field-input-narrow"
                type="number"
                min="0"
                step="0.1"
                value={manualForm.carbs100g}
                onChange={(e) => setManualForm((p) => ({...p, carbs100g: e.target.value}))}
                placeholder="Es. 48"
              />
            </div>

            <div className="field-row">
              <label className="field-label" htmlFor="m-fat">
                Grassi (g)
              </label>
              <input
                id="m-fat"
                className="field-input field-input-narrow"
                type="number"
                min="0"
                step="0.1"
                value={manualForm.fat100g}
                onChange={(e) => setManualForm((p) => ({...p, fat100g: e.target.value}))}
                placeholder="Es. 3.2"
              />
            </div>

            <div className="field-row">
              <label className="field-label" htmlFor="m-fiber">
                Fibre (g)
              </label>
              <input
                id="m-fiber"
                className="field-input field-input-narrow"
                type="number"
                min="0"
                step="0.1"
                value={manualForm.fiber100g}
                onChange={(e) => setManualForm((p) => ({...p, fiber100g: e.target.value}))}
                placeholder="Es. 6.5"
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Aggiungi alla lista
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}