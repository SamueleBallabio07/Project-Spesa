import { useState, useMemo, useEffect } from 'react';
import { ThemeToggle } from './ThemeToggle';

const UNIT_LABELS = {
  pezzo: 'pezzo',
  pezzi: 'pezzi',
  kg: 'kg',
  g: 'g',
  l: 'l',
  ml: 'ml',
  buste: 'buste',
  scatole: 'scatole',
};

function formatQuantity(value, unit) {
  return `${value} ${UNIT_LABELS[unit] || unit}`;
}

export default function ShoppingList({
  session,
  items,
  lists,
  selectedListId,
  loadingItems,
  error,
  summary,
  onAddItem,
  onToggleItem,
  onRemoveItem,
  onUpdateItem,
  onCreateList,
  onSwitchList,
  onDeleteList,
  onSignOut,
  catalogSearch,
  onAddFood,
}) {
  const [newListName, setNewListName] = useState('');
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [confirmDeleteList, setConfirmDeleteList] = useState(null);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogResults, setCatalogResults] = useState([]);

  // Ricerca catalogo inline
  useEffect(() => {
    if (catalogQuery.trim().length >= 2 && catalogSearch) {
      const results = catalogSearch(catalogQuery.trim());
      setCatalogResults(results.slice(0, 10));
    } else {
      setCatalogResults([]);
    }
  }, [catalogQuery, catalogSearch]);

  const handleCatalogAdd = async (food) => {
    if (!selectedListId || !onAddFood) return;
    const ok = await onAddFood({
      name: food.displayName,
      quantity: food.unitDefault === 'kg' ? 0.5 : food.unitDefault === 'pezzi' ? 1 : 100,
      unit: food.unitDefault,
      category: food.category,
      kcal100g: food.kcal100g,
      protein100g: food.protein100g,
      carbs100g: food.carbs100g,
      fat100g: food.fat100g,
      fiber100g: food.fiber100g,
    });
    if (ok) {
      setCatalogQuery('');
      setCatalogResults([]);
    }
  };

  const handleCreateList = async (event) => {
    event.preventDefault();
    const trimmed = newListName.trim();
    if (!trimmed) return;
    setIsCreatingList(true);
    const created = await onCreateList(trimmed);
    if (created) setNewListName('');
    setIsCreatingList(false);
  };

  const handleDeleteList = async (listId) => {
    if (confirmDeleteList === listId) {
      setConfirmDeleteList(null);
      await onDeleteList(listId);
      return;
    }
    setConfirmDeleteList(listId);
    window.setTimeout(() => setConfirmDeleteList(null), 3000);
  };

  const selectedList = lists.find((l) => l.id === selectedListId);

  return (
    <div className="screen">
      {/* ============ SIDEBAR / SELEZIONE LISTE ============ */}
      <aside className="sidebar">
        <div className="sidebar-inner">
          <p className="sidebar-title">Le tue liste</p>

          <nav className="lists" aria-label="Le tue liste">
            {lists.map((list) => (
              <div key={list.id} className="list-row">
                <button
                  type="button"
                  className={`list-btn ${selectedListId === list.id ? 'is-active' : ''}`}
                  onClick={() => onSwitchList(list.id)}
                  aria-current={selectedListId === list.id}
                >
                  <span className="list-name">{list.name}</span>
                  <span className="list-badge">{list.itemCount || 0}</span>
                </button>
                <button
                  type="button"
                  className={`list-del ${confirmDeleteList === list.id ? 'is-confirm' : ''}`}
                  onClick={() => handleDeleteList(list.id)}
                  aria-label={`Elimina ${list.name}`}
                  title={confirmDeleteList === list.id ? 'Tocca di nuovo per confermare' : 'Elimina lista'}
                >
                  {confirmDeleteList === list.id ? '?' : '×'}
                </button>
              </div>
            ))}
          </nav>

          <form className="new-list" onSubmit={handleCreateList}>
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="Nuova lista"
              aria-label="Nome nuova lista"
            />
            <button type="submit" className="btn btn-secondary" disabled={isCreatingList}>
              Crea lista
            </button>
          </form>
        </div>
      </aside>

      {/* ============ CONTENUTO ============ */}
      <main className="content">
        <header className="topbar">
          <div className="topbar-text">
            <p className="topbar-sub">{selectedList ? `${lists.length} liste` : 'Lista della spesa'}</p>
            <h1>{selectedList?.name || 'Spesa'}</h1>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            <button type="button" className="btn btn-ghost" onClick={onSignOut}>
              Esci
            </button>
          </div>
        </header>

        <section className="summary" aria-label="Riepilogo">
          <div className="stat">
            <strong>{summary.total}</strong>
            <span>Totale</span>
          </div>
          <div className="stat">
            <strong>{summary.bought}</strong>
            <span>Comprati</span>
          </div>
          <div className="stat stat-accent">
            <strong>{summary.remaining}</strong>
            <span>Da prendere</span>
          </div>
        </section>

        {error && <p className="alert">{error}</p>}

        {loadingItems ? (
          <p className="loading">Caricamento…</p>
        ) : (
          <>
            {/* Ricerca catalogo - modo principale per aggiungere */}
            <section className="section">
              <div className="section-head-row">
                <h2 className="section-head">Aggiungi dal catalogo</h2>
              </div>
              <div className="searchbar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
                </svg>
                <input
                  type="search"
                  value={catalogQuery}
                  onChange={(e) => setCatalogQuery(e.target.value)}
                  placeholder="Cerca nel catalogo (es. pane, latte, pomodoro…)…"
                  aria-label="Cerca nel catalogo alimentare"
                  autoComplete="off"
                  enterKeyHint="search"
                />
                {catalogQuery && (
                  <button
                    type="button"
                    className="searchbar-clear"
                    onClick={() => setCatalogQuery('')}
                    aria-label="Cancella ricerca"
                  >
                    ×
                  </button>
                )}
              </div>
              {catalogQuery.trim().length >= 2 && catalogResults.length > 0 && (
                <ul className="food-list">
                  {catalogResults.map((food) => (
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
                        <button
                          type="button"
                          className="btn btn-primary food-add-btn"
                          onClick={() => handleCatalogAdd(food)}
                          disabled={!selectedListId}
                        >
                          Aggiungi
                        </button>
                      </div>
                      <div className="food-nutrition">
                        <span className="food-nutrition-main">
                          {food.kcal100g} kcal / 100g
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {catalogQuery.trim().length >= 2 && catalogResults.length === 0 && (
                <p className="empty-body" style={{marginTop: '8px', textAlign: 'center'}}>
                  Nessun risultato per “{catalogQuery}”.
                </p>
              )}
            </section>

            {/* Prodotti nella lista */}
            <section className="section">
              <h2 className="section-head">Prodotti</h2>
              {items.length === 0 ? (
                <p className="empty">Non c'è ancora niente in questa lista.</p>
              ) : (
                <ul className="group">
                  {items.map((item) => (
                    <li key={item.id} className={`item ${item.bought ? 'is-done' : ''}`}>
                      <div className="item-row">
                        <button
                          type="button"
                          className="check"
                          onClick={() => onToggleItem(item.id)}
                          role="checkbox"
                          aria-checked={item.bought}
                          aria-label={item.bought ? `Segna ${item.name} da prendere` : `Segna ${item.name} come comprato`}
                        >
                          {item.bought ? '✓' : ''}
                        </button>

                        <div className="item-text">
                          <span className="item-name">{item.name}</span>
                          <span className="item-meta">
                            {formatQuantity(item.quantity, item.unit)}
                            {item.category ? ` · ${item.category}` : ''}
                            {item.notes ? ` · ${item.notes}` : ''}
                          </span>
                        </div>

                        <div className="item-actions">
                          <button
                            type="button"
                            className="row-action is-danger"
                            onClick={() => onRemoveItem(item.id)}
                            aria-label={`Elimina ${item.name}`}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        <footer className="foot">
          <p>I tuoi dati restano nel tuo account Supabase.</p>
        </footer>
      </main>
    </div>
  );
}
