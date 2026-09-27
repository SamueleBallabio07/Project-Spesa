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
  onSaveProduct,
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
  const [targetListId, setTargetListId] = useState(null);

  const suggestions = useMemo(() => {
    if (!product.trim() || product.trim().length < 2) return [];
    const search = product.toLowerCase();
    return savedProducts
      .filter((sp) => sp.name.toLowerCase().includes(search))
      .slice(0, 5);
  }, [product, savedProducts]);

  const handleAddItem = async (event) => {
    event.preventDefault();
    const success = await onAddItem({
      listId: targetListId || selectedListId,
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
    setIsCreatingList(true);
    const created = await onCreateList(newListName);
    if (created) setNewListName('');
    setIsCreatingList(false);
  };

  const handleDeleteList = async (listId) => {
    if (confirmDeleteList === listId) {
      await onDeleteList(listId);
      setConfirmDeleteList(null);
    } else {
      setConfirmDeleteList(listId);
      setTimeout(() => setConfirmDeleteList(null), 3000);
    }
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
    if (success) {
      cancelEdit();
    }
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
              <div key={list.id} className="sidebar-list-wrapper">
                <button
                  type="button"
                  className={`sidebar-list-item ${selectedListId === list.id ? 'active' : ''}`}
                  onClick={() => onSwitchList(list.id)}
                >
                  <span className="sidebar-list-name">{list.name}</span>
                  <span className="sidebar-list-count">{list.itemCount || 0}</span>
                </button>
                <button
                  type="button"
                  className={`sidebar-delete-btn ${confirmDeleteList === list.id ? 'confirm' : ''}`}
                  onClick={() => handleDeleteList(list.id)}
                  title={confirmDeleteList === list.id ? 'Clicca di nuovo per conferma' : 'Elimina lista'}
                >
                  {confirmDeleteList === list.id ? '?' : '×'}
                </button>
              </div>
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
              {/* Prodotti salvati */}
              {savedProducts.length > 0 && (
                <div className="saved-products-section">
                  <button
                    type="button"
                    className="saved-toggle"
                    onClick={() => setShowSaved(!showSaved)}
                  >
                    <span>Prodotti salvati ({savedProducts.length})</span>
                    <span className="saved-toggle-icon">{showSaved ? '▲' : '▼'}</span>
                  </button>
                  {showSaved && (
                    <div className="saved-products-list">
                      {savedProducts.map((sp) => (
                        <div key={sp.id} className="saved-product-item">
                          <button
                            type="button"
                            className="saved-product-add"
                            onClick={() => handleQuickAdd(sp)}
                          >
                            + {sp.name}
                          </button>
                          <span className="saved-product-meta">
                            {formatQuantity(sp.quantity, sp.unit)}
                            {sp.category && ` · ${sp.category}`}
                          </span>

                          <button
                            type="button"
                            className="saved-product-delete"
                            onClick={() => onDeleteSavedProduct(sp.id)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Form aggiunta */}
              <form className="add-form" onSubmit={handleAddItem}>
                <div className="field field-with-suggestions">
                  <span>Nome prodotto *</span>
                  <div className="suggestions-wrapper">
                    <input
                      type="text"
                      value={product}
                      onChange={(e) => {
                        setProduct(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      placeholder="Es. Uova, Latte, Pane..."
                      required
                    />
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="suggestions-dropdown">
                        {suggestions.map((sp) => (
                          <button
                            key={sp.id}
                            type="button"
                            className="suggestion-item"
                            onClick={() => handleQuickAdd(sp)}
                          >
                            <span className="suggestion-name">{sp.name}</span>
                            <span className="suggestion-meta">
                              {formatQuantity(sp.quantity, sp.unit)}
                              {sp.category && ` · ${sp.category}`}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

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

                <div className="add-form-buttons">
                  <button type="submit" className="add-button">
                    Aggiungi
                  </button>
                </div>
              </form>

              {/* Lista prodotti */}
              <ul className="shopping-list">
                {items.length === 0 ? (
                  <li className="empty-state">Nessun prodotto aggiunto ancora.</li>
                ) : (
                  items.map((item) => (
                    <li key={item.id} className={`item-row ${item.bought ? 'bought' : ''}`}>
                      {editingItem === item.id ? (
                        <div className="edit-form-compact">
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            placeholder="Nome"
                            required
                          />
                          <input
                            type="number"
                            min="1"
                            value={editForm.quantity}
                            onChange={(e) => setEditForm({ ...editForm, quantity: Number(e.target.value) || 1 })}
                            title="Quantità"
                          />
                          <select
                            value={editForm.unit}
                            onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                            title="Unità"
                          >
                            {UNIT_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                          <select
                            value={editForm.category}
                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                            title="Categoria"
                          >
                            <option value="">Nessuna</option>
                            {CATEGORY_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={editForm.notes}
                            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                            placeholder="Note"
                          />
                          <button type="submit" className="edit-save-btn" form="edit-form">Salva</button>
                          <button type="button" className="edit-cancel-btn" onClick={cancelEdit}>Annulla</button>
                        </div>
                      ) : (
                        <>
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

                          <div className="item-actions">
                            <button
                              type="button"
                              className="edit-button"
                              onClick={() => startEdit(item)}
                            >
                              Modifica
                            </button>
                            <button
                              type="button"
                              className="remove-button"
                              onClick={() => onRemoveItem(item.id)}
                            >
                              Elimina
                            </button>
                          </div>
                        </>
                      )}
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
