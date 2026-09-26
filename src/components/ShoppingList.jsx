import { useState } from 'react';
import { UNIT_OPTIONS, CATEGORY_OPTIONS } from '../lib/schema';

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
  onCreateList,
  onSwitchList,
  onSignOut,
}) {
  const [product, setProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('pezzi');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [newListName, setNewListName] = useState('');
  const [isCreatingList, setIsCreatingList] = useState(false);

  const handleAddItem = async (event) => {
    event.preventDefault();
    const success = await onAddItem({
      listId: selectedListId,
      name: product,
      quantity,
      unit,
      category,
      notes,
      userId: session.user.id,
    });
    if (success) {
      setProduct('');
      setQuantity(1);
      setUnit('pezzi');
      setCategory('');
      setNotes('');
    }
  };

  const handleCreateList = async (event) => {
    event.preventDefault();
    setIsCreatingList(true);
    const created = await onCreateList(newListName);
    if (created) setNewListName('');
    setIsCreatingList(false);
  };

  const selectedList = lists.find((l) => l.id === selectedListId);

  return (
    <main className="app-shell">
      <section className="list-card">
        {/* Sidebar con le liste */}
        <aside className="list-sidebar">
          <div className="sidebar-header">
            <p className="eyebrow">Le tue liste</p>
            <h2>{lists.length} {lists.length === 1 ? 'lista' : 'liste'}</h2>
          </div>

          <div className="sidebar-lists">
            <span className="sidebar-label">Seleziona lista</span>
            {lists.map((list) => (
              <button
                key={list.id}
                type="button"
                className={`sidebar-list-item ${selectedListId === list.id ? 'active' : ''}`}
                onClick={() => onSwitchList(list.id)}
              >
                <span className="sidebar-list-name">{list.name}</span>
                <span className="sidebar-list-count">{list.itemCount || 0}</span>
              </button>
            ))}
          </div>

          <form className="sidebar-new" onSubmit={handleCreateList}>
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="Nome nuova lista"
              aria-label="Nome nuova lista"
            />
            <button type="submit" className="sidebar-new-button" disabled={isCreatingList}>
              {isCreatingList ? 'Creazione...' : '+ Nuova lista'}
            </button>
          </form>
        </aside>

        {/* Contenuto principale */}
        <div className="list-content">
          <header className="topbar">
            <div>
              <p className="eyebrow">{selectedList?.name || 'Lista della spesa'}</p>
              <h1>{selectedList?.name || 'Seleziona una lista'}</h1>
            </div>
            <button type="button" className="logout-button" onClick={onSignOut}>
              Esci
            </button>
          </header>

          <div className="summary-grid">
            <div>
              <strong>{summary.total}</strong>
              <span>Totale</span>
            </div>
            <div>
              <strong>{summary.bought}</strong>
              <span>Comprati</span>
            </div>
            <div>
              <strong>{summary.remaining}</strong>
              <span>In attesa</span>
            </div>
          </div>

          {error && <p className="auth-error">{error}</p>}

          {loadingItems ? (
            <p>Caricamento lista...</p>
          ) : (
            <>
              <form className="add-form" onSubmit={handleAddItem}>
                <label className="field">
                  <span>Prodotto</span>
                  <input
                    type="text"
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    placeholder="Es. Uova"
                  />
                </label>

                <label className="field">
                  <span>Quantità</span>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                  />
                </label>

                <label className="field">
                  <span>Unità</span>
                  <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                    {UNIT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Categoria</span>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">Nessuna</option>
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Note</span>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Opzionale"
                  />
                </label>

                <button type="submit" className="add-button">
                  Aggiungi
                </button>
              </form>

              <ul className="shopping-list">
                {items.length === 0 ? (
                  <li className="empty-state">Nessun prodotto aggiunto ancora.</li>
                ) : (
                  items.map((item) => (
                    <li key={item.id} className={`item-row ${item.bought ? 'bought' : ''}`}>
                      <button
                        type="button"
                        className="check-button"
                        onClick={() => onToggleItem(item.id)}
                      >
                        {item.bought ? '✓' : ''}
                      </button>

                      <div className="item-content">
                        <span className="item-name">{item.name}</span>
                        <span className="item-meta">
                          {formatQuantity(item.quantity, item.unit)}
                          {item.category && ` · ${item.category}`}
                          {item.notes && ` · ${item.notes}`}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="remove-button"
                        onClick={() => onRemoveItem(item.id)}
                      >
                        Elimina
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
