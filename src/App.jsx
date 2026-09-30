import { useAuth } from './hooks/useAuth';
import { useShoppingList } from './hooks/useShoppingList';
import { useSavedProducts } from './hooks/useSavedProducts';
import { useOfflineSync } from './hooks/useOfflineSync';
import Auth from './components/Auth';
import ShoppingList from './components/ShoppingList';

function App() {
  const { session, loading, hasSupabaseConfig, signIn, signUp, signOut, ensureProfile } = useAuth();
  const list = useShoppingList(session, ensureProfile);
  const savedProducts = useSavedProducts(session);
  const { isOnline, pendingChanges, syncing } = useOfflineSync();

  if (loading) {
    return (
      <main className="app-shell">
        <section className="list-card">
          <p>Caricamento...</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <Auth
        hasSupabaseConfig={hasSupabaseConfig}
        onSignIn={signIn}
        onSignUp={signUp}
      />
    );
  }

  return (
    <div className="app-wrapper">
      {/* Indicatore offline */}
      {!isOnline && (
        <div className="offline-banner">
          <span>Sei offline. Le modifiche verranno sincronizzate quando torni online.</span>
          {pendingChanges > 0 && <span className="pending-badge">{pendingChanges} in attesa</span>}
        </div>
      )}
      {isOnline && syncing && (
        <div className="sync-banner">
          <span>Sincronizzazione in corso...</span>
        </div>
      )}

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
        savedProducts={savedProducts.savedProducts}
        onSaveProduct={savedProducts.saveProduct}
        onDeleteSavedProduct={savedProducts.deleteSavedProduct}
      />
    </div>
  );
}

export default App;
