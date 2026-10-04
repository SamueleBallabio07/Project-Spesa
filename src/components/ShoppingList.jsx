import { useState, useEffect } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { SearchBar } from './SearchBar';
import { FoodCard } from './FoodCard';
import { EmptyState } from './EmptyState';
import { useStepper } from '../hooks/useStepper';

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
  items,
  lists,
  selectedListId,
  loadingItems,
  error,
  summary,
  onToggleItem,
  onRemoveItem,
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

  const { picked, stepFor, initialQty, pickQty, clearAll, getCurrentUnit, getStepForCurrentUnit } = useStepper();

  // Ricerca catalogo inline
  useEffect(() => {
    if (catalogQuery.trim().length >= 2 && catalogSearch) {
      const results = catalogSearch(catalogQuery.trim());
      setCatalogResults(results.slice(0, 10));
    } else {
      setCatalogResults([]);
      clearAll();
    }
  }, [catalogQuery, catalogSearch, catalogSearch, clearAll]);

  const handleCatalogAdd = async (food) => {
    if (!selectedListId || !onAddFood) return;
    const quantity = picked[food.fdcId] ?? initialQty(food);
    const ok = await onAddFood({
      name: food.displayName,
      quantity,
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
      clearAll();
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
          <div className="content-inner">
            {/* Ricerca catalogo - modo principale per aggiungere */}
            <section className="section">
              <div className="section-head-row">
                <h2 className="section-head">Aggiungi dal catalogo</h2>
              </div>
              <SearchBar
                value={catalogQuery}
                onChange={setCatalogQuery}
                onClear={() => { setCatalogQuery(''); clearAll(); }}
                placeholder="Cerca nel catalogo (es. pane, latte, pomodoro…)…"
                ariaLabel="Cerca nel catalogo alimentare"
              />
              {catalogQuery.trim().length >= 2 && catalogResults.length > 0 && (
                <ul className="food-list">
                  {catalogResults.map((food) => (
                    <FoodCard
                      key={food.fdcId}
                      food={food}
                      quantity={picked[food.fdcId] ?? initialQty(food)}
                      unitDefault={food.unitDefault}
                      currentUnit={getCurrentUnit(food)}
                      step={getStepForCurrentUnit(food)}
                      onQuantityChange={pickQty}
                      onUnitChange={(food, unit) => pickQty(food, picked[food.fdcId] ?? initialQty(food), unit)}
                      onAdd={handleCatalogAdd}
                      disabled={!selectedListId}
                      variant="search"
                    />
                  ))}
                </ul>
              )}
              {catalogQuery.trim().length >= 2 && catalogResults.length === 0 && (
                <EmptyState
                  title="Nessun risultato"
                  body={<>Non c'è “{catalogQuery}” nel catalogo.</>}
                />
              )}
            </section>

            {/* Prodotti nella lista */}
            <section className="section">
              <h2 className="section-head">Prodotti</h2>
              {items.length === 0 ? (
                <EmptyState
                  title="Lista vuota"
                  body="Non c'è ancora niente in questa lista."
                />
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
                            {item.category ? ` · ${item.category}` : ''}
                            {item.notes ? ` · ${item.notes}` : ''}
                          </span>
                        </div>

                        <div className="item-quantity">
                          <div className="stepper">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onUpdateItem(item.id, { quantity: Math.max(1, item.quantity - 1) }); }}
                              onTouchStart={(e) => { e.stopPropagation(); onUpdateItem(item.id, { quantity: Math.max(1, item.quantity - 1) }); }}
                              aria-label={`Diminuisci quantità di ${item.name}`}
                              disabled={item.bought}
                            >
                              −
                            </button>
                            <span className="stepper-value">
                              {formatQuantity(item.quantity, item.unit)}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onUpdateItem(item.id, { quantity: item.quantity + 1 }); }}
                              onTouchStart={(e) => { e.stopPropagation(); onUpdateItem(item.id, { quantity: item.quantity + 1 }); }}
                              aria-label={`Aumenta quantità di ${item.name}`}
                              disabled={item.bought}
                            >
                              +
                            </button>
                          </div>
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
          </div>
        )}

        <footer className="foot">
          <p>I tuoi dati restano nel tuo account Supabase.</p>
        </footer>
      </main>
    </div>
  );
}