import { useAuth } from './hooks/useAuth';
import { useShoppingList } from './hooks/useShoppingList';
import Auth from './components/Auth';
import ShoppingList from './components/ShoppingList';

function App() {
  const { session, loading, hasSupabaseConfig, signIn, signUp, signOut, ensureProfile } = useAuth();
  const list = useShoppingList(session, ensureProfile);

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
      onCreateList={list.createList}
      onSwitchList={list.switchList}
      onSignOut={signOut}
    />
  );
}

export default App;
