import { useState, useMemo } from 'react';
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
  onUpdateItem,
  onCreateList,
  onSwitchList,
  onDeleteList,
  onSignOut,
  savedProducts,
  onDeleteSavedProduct,
}) {
  const [product, setProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('pezzi');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [newListName, setNewListName] = useState('');
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [confirmDeleteList, setConfirmDeleteList] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', quantity: 1, unit: 'pezzi', category: '', notes: '' });

  const suggestions = useMemo(() => {
    const search = product.trim().toLowerCase();
    if (search.length < 2) return [];
    return savedProducts.filter((sp) => sp.name.toLowerCase().includes(search)).slice(0, 5);
  }, [product, savedProducts]);

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
      setShowSuggestions(false);
    }
  };

  const handleQuickAdd = (savedProduct) => {
    setProduct(savedProduct.name);
    setQuantity(savedProduct.quantity);
    setUnit(savedProduct.unit);
    setCategory(savedProduct.category || '');
    setNotes(savedProduct.notes || '');
    setShowSuggestions(false);
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

  const startEdit = (item) => {
    setEditingItem(item.id);
    setEditForm({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category || '',
      notes: item.notes || '',
    });
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditForm({ name: '', quantity: 1, unit: 'pezzi', category: '', notes: '' });
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    const success = await onUpdateItem(editingItem, {
      name: editForm.name.trim(),
      quantity: Number(editForm.quantity) || 1,
      unit: editForm.unit,
      category: editForm.category || null,
      notes: editForm.notes || null,
    });
    if (success) cancelEdit();
  };

  const selectedList = lists.find((l) => l.id === selectedListId);

  return (
    <div className="app">
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
          <button type="button" className="btn btn-ghost" onClick={onSignOut}>
            Esci
          </button>
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
            {/* Prodotti già usati */}
            {savedProducts.length > 0 && (
              <section className="section">
                <button
                  type="button"
                  className="section-head section-head-btn"
                  onClick={() => setShowSaved((v) => !v)}
                  aria-expanded={showSaved}
                >
                  <span>Prodotti frequenti</span>
                  <span className="chevron">{showSaved ? '▾' : '▸'}</span>
                </button>
                {showSaved && (
                  <ul className="group">
                    {savedProducts.map((sp) => (
                      <li key={sp.id} className="saved-row">
                        <button type="button" className="saved-main" onClick={() => handleQuickAdd(sp)}>
                          <span className="saved-name">{sp.name}</span>
                          <span className="saved-meta">
                            {formatQuantity(sp.quantity, sp.unit)}
                            {sp.category ? ` · ${sp.category}` : ''}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="row-del"
                          onClick={() => onDeleteSavedProduct(sp.id)}
                          aria-label={`Rimuovi ${sp.name} dai frequenti`}
                        >
                          Rimuovi
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* Aggiunta prodotto */}
            <section className="section">
              <h2 className="section-head">Aggiungi un prodotto</h2>
              <form className="group form-rows" onSubmit={handleAddItem}>
                <div className="field-row field-row-stack">
                  <label className="field-label" htmlFor="f-name">
                    Prodotto
                  </label>
                  <div className="suggestions-wrap">
                    <input
                      id="f-name"
                      type="text"
                      value={product}
                      onChange={(e) => {
                        setProduct(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => window.setTimeout(() => setShowSuggestions(false), 150)}
                      placeholder="Uova, Latte, Pane…"
                      autoComplete="off"
                      required
                    />
                    {showSuggestions && suggestions.length > 0 && (
                      <ul className="suggestions">
                        {suggestions.map((sp) => (
                          <li key={sp.id}>
                            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleQuickAdd(sp)}>
                              <span>{sp.name}</span>
                              <span className="suggestions-meta">
                                {formatQuantity(sp.quantity, sp.unit)}
                                {sp.category ? ` · ${sp.category}` : ''}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="field-row">
                  <label className="field-label" htmlFor="f-qty">
                    Quantità
                  </label>
                  <input
                    id="f-qty"
                    className="field-input field-input-narrow"
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                  />
                </div>

                <div className="field-row">
                  <label className="field-label" htmlFor="f-unit">
                    Unità
                  </label>
                  <select
                    id="f-unit"
                    className="field-input"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  >
                    {UNIT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-row">
                  <label className="field-label" htmlFor="f-cat">
                    Categoria
                  </label>
                  <select
                    id="f-cat"
                    className="field-input"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">Nessuna</option>
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-row">
                  <label className="field-label" htmlFor="f-notes">
                    Note
                  </label>
                  <input
                    id="f-notes"
                    className="field-input"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Opzionale"
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">
                    Aggiungi alla lista
                  </button>
                </div>
              </form>
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
                      {editingItem === item.id ? (
                        <form className="edit" onSubmit={saveEdit}>
                          <input
                            className="field-input"
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            aria-label="Nome prodotto"
                            required
                          />
                          <div className="edit-grid">
                            <input
                              className="field-input"
                              type="number"
                              min="1"
                              value={editForm.quantity}
                              onChange={(e) =>
                                setEditForm({ ...editForm, quantity: Number(e.target.value) || 1 })
                              }
                              aria-label="Quantità"
                            />
                            <select
                              className="field-input"
                              value={editForm.unit}
                              onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                              aria-label="Unità"
                            >
                              {UNIT_OPTIONS.map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                            <select
                              className="field-input"
                              value={editForm.category}
                              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                              aria-label="Categoria"
                            >
                              <option value="">Nessuna</option>
                              {CATEGORY_OPTIONS.map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          </div>
                          <input
                            className="field-input"
                            type="text"
                            value={editForm.notes}
                            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                            placeholder="Note"
                            aria-label="Note"
                          />
                          <div className="edit-actions">
                            <button type="button" className="btn btn-ghost" onClick={cancelEdit}>
                              Annulla
                            </button>
                            <button type="submit" className="btn btn-primary">
                              Salva
                            </button>
                          </div>
                        </form>
                      ) : (
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
                            <button type="button" className="btn btn-quiet" onClick={() => startEdit(item)}>
                              Modifica
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => onRemoveItem(item.id)}
                            >
                              Elimina
                            </button>
                          </div>
                        </div>
                      )}
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
