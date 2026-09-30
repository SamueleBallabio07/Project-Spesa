import { useAuth } from './hooks/useAuth';
import { useShoppingList } from './hooks/useShoppingList';
import { useSavedProducts } from './hooks/useSavedProducts';
import { useOfflineSync } from './hooks/useOfflineSync';
import Auth from './components/Auth';
import ShoppingList from './components/ShoppingList';

export default function App() {
  const { session, loading, hasSupabaseConfig, signIn, signUp, signOut, ensureProfile } = useAuth();
  const list = useShoppingList(session, ensureProfile);
  const saved = useSavedProducts(session);
  const { isOnline, pendingChanges, syncing } = useOfflineSync();

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

  return (
    <>
      {!isOnline && (
        <div className="offline-banner">
          Sei offline
          {pendingChanges > 0 ? ` · ${pendingChanges} modifiche da sincronizzare` : ''}
        </div>
      )}
      {isOnline && syncing && <div className="sync-banner">Sincronizzazione…</div>}

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
      />
    </>
  );
}
