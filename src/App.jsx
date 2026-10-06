import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useShoppingList } from './hooks/useShoppingList';
import { useSavedProducts } from './hooks/useSavedProducts';
import { useFoodCatalog } from './hooks/useFoodCatalog';
import { useTheme } from './hooks/useTheme';
import Auth from './components/Auth';
import ShoppingList from './components/ShoppingList';
import CatalogScreen from './components/CatalogScreen';
import TabBar from './components/TabBar';

export default function App() {
  useTheme();
  const { session, loading, hasSupabaseConfig, signIn, signUp, signOut, ensureProfile } = useAuth();
  const list = useShoppingList(session, ensureProfile);
  const saved = useSavedProducts(session);
  const catalog = useFoodCatalog();

  // Solo lo stato della rete, per l'avviso in alto. Le scritture passano da
  // Supabase: se la rete manca falliscono e basta, non c'e' una coda che le
  // riprende piu' tardi.
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const [tab, setTab] = useState('lists');

  // Carica il catalogo in background appena l'utente è autenticato
  useEffect(() => {
    if (session) {
      catalog.ensureLoaded();
    }
  }, [session, catalog]);

  if (loading) {
    return (
      <div className="auth">
        <p className="loading">Caricamento…</p>
      </div>
    );
  }

  if (!session) {
    return <Auth hasSupabaseConfig={hasSupabaseConfig} onSignIn={signIn} onSignUp={signUp} />;
  }

  const selectedList = list.lists.find((l) => l.id === list.selectedListId);

  const handleAddFood = ({ name, quantity, unit, category, kcal100g, protein100g, carbs100g, fat100g, fiber100g }) =>
    list.addItem({
      listId: list.selectedListId,
      name,
      quantity,
      unit,
      category,
      notes: null,
      userId: session.user.id,
      kcal100g,
      protein100g,
      carbs100g,
      fat100g,
      fiber100g,
    });

  return (
    <div className="app">
      {!isOnline && <div className="offline-banner">Sei offline</div>}

      <div className="screen-wrap">
        {tab === 'lists' ? (
          <ShoppingList
            session={session}
            items={list.items}
            lists={list.lists}
            selectedListId={list.selectedListId}
            loadingItems={list.loadingItems}
            error={list.error}
            summary={list.summary}
            onAddItem={list.addItem}
            onToggleItem={list.toggleItem}
            onRemoveItem={list.removeItem}
            onUpdateItem={list.updateItem}
            onCreateList={list.createList}
            onSwitchList={list.switchList}
            onDeleteList={list.deleteList}
            onSignOut={signOut}
            savedProducts={saved.savedProducts}
            onDeleteSavedProduct={saved.deleteSavedProduct}
            onGoToCatalog={() => setTab('products')}
            catalogSearch={catalog.search}
            onAddFood={handleAddFood}
          />
        ) : (
          <CatalogScreen
            selectedListId={list.selectedListId}
            selectedListName={selectedList?.name}
            loading={catalog.loading}
            error={catalog.error}
            domains={catalog.domains}
            categories={catalog.categories}
            categoriesByDomain={catalog.categoriesByDomain}
            search={catalog.search}
            ensureLoaded={catalog.ensureLoaded}
            onAddFood={handleAddFood}
          />
        )}
      </div>

      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}