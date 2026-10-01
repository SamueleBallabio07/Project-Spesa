const TABS = [
  { id: 'lists', label: 'Liste', icon: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /> },
  { id: 'products', label: 'Prodotti', icon: <path d="M3.5 4h17l-1.6 10.2a2 2 0 01-2 1.8H8.1a2 2 0 01-2-1.8L4.5 6M9 20a1 1 0 100-2 1 1 0 000 2zM18 20a1 1 0 100-2 1 1 0 000 2zM8.5 8l1 6M13 8.5l-.6 5.5M17 9l-.5 5" /> },
];

export default function TabBar({ active, onChange }) {
  return (
    <nav className="tabbar" role="tablist" aria-label="Navigazione principale">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          aria-label={tab.label}
          className={`tab ${active === tab.id ? 'is-active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          <svg
            className="tab-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {tab.icon}
          </svg>
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}