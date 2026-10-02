import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useShoppingList } from './hooks/useShoppingList';
import { useSavedProducts } from './hooks/useSavedProducts';
import { useFoodCatalog } from './hooks/useFoodCatalog';
import { useOfflineSync } from './hooks/useOfflineSync';
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
  const { isOnline, pendingChanges, syncing } = useOfflineSync();

  const [tab, setTab] = useState('lists');

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

  const handleAddFood = ({ name, quantity, unit, category }) =>
    list.addItem({
      listId: list.selectedListId,
      name,
      quantity,
      unit,
      category,
      notes: null,
      userId: session.user.id,
    });

  return (
    <div className="app">
      {!isOnline && (
        <div className="offline-banner">
          Sei offline
          {pendingChanges > 0 ? ` · ${pendingChanges} modifiche da sincronizzare` : ''}
        </div>
      )}
      {isOnline && syncing && <div className="sync-banner">Sincronizzazione…</div>}

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
          />
        ) : (
          <CatalogScreen
            selectedListId={list.selectedListId}
            selectedListName={selectedList?.name}
            loading={catalog.loading}
            error={catalog.error}
            categories={catalog.categories}
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