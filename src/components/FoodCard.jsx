import { nutritionFor, formatNutrition, formatMacros } from '../lib/nutrition';

const UNIT_OPTIONS = ['g', 'kg', 'ml', 'l', 'pezzi'];

/**
 * Card prodotto riutilizzabile per visualizzare alimenti del catalogo.
 * Supporta diverse modalità:
 * - "search": risultati ricerca catalogo (ShoppingList) - con selettore unità
 * - "catalog": catalogo completo (CatalogScreen) - con stepper completo, macro, tag "aggiunto"
 * - "list-item": prodotti già nella lista - con stepper quantità
 */
export function FoodCard({
  food,
  quantity,
  unitDefault,
  currentUnit,
  step,
  onQuantityChange,
  onUnitChange,
  onAdd,
  disabled = false,
  justAdded = false,
  showMacros = true,
  showNutrition = true,
  variant = 'catalog', // 'search' | 'catalog' | 'list-item'
}) {
  const nutrition = nutritionFor(food, quantity, unitDefault);
  const effectiveUnit = currentUnit || unitDefault;
  const stepValue = step ?? (currentUnit === 'pezzi' ? 1 : currentUnit === 'kg' ? 0.1 : 10);

  // Determina se mostrare stepper o selettore unità
  const showStepper = variant === 'catalog' || variant === 'list-item';
  const showUnitSelector = variant === 'search';

  return (
    <li key={food.fdcId} className="food">
      <div className="food-head">
        <div className="food-title">
          <span className="food-name">{food.displayName}</span>
          <span className="food-cat">{food.category}</span>
        </div>
        <span className="food-kcal">
          {food.kcal100g}
          <small>kcal/100g</small>
        </span>
      </div>

      {showMacros && (
        <div className="food-macros">
          <span>P {food.protein100g}g</span>
          <span>C {food.carbs100g}g</span>
          <span>F {food.fat100g}g</span>
          {food.fiber100g > 0 && <span>Fib {food.fiber100g}g</span>}
        </div>
      )}

      <div className="food-add">
        {showStepper && (
          <div className="stepper">
            <button
              type="button"
              onClick={() => onQuantityChange?.(food, quantity - stepValue)}
              onTouchStart={(e) => { e.stopPropagation(); onQuantityChange?.(food, quantity - stepValue); }}
              aria-label={`Diminuisci quantità di ${food.displayName}`}
              disabled={disabled}
            >
              −
            </button>
            <span className="stepper-value">
              {quantity}
              <small>{unitDefault}</small>
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onQuantityChange?.(food, quantity + stepValue); }}
              onTouchStart={(e) => { e.stopPropagation(); onQuantityChange?.(food, quantity + stepValue); }}
              aria-label={`Aumenta quantità di ${food.displayName}`}
              disabled={disabled}
            >
              +
            </button>
          </div>
        )}

        {showUnitSelector && onUnitChange && (
          <select
            className="unit-selector"
            value={unitDefault}
            onChange={(e) => onUnitChange(food, e.target.value)}
            disabled={disabled}
            aria-label={`Unità per ${food.displayName}`}
          >
            {UNIT_OPTIONS.map((unit) => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
        )}

        <button
          type="button"
          className={`btn btn-primary food-add-btn ${justAdded ? 'is-added' : ''}`}
          onClick={() => onAdd?.(food)}
          disabled={disabled}
        >
          {justAdded ? 'Aggiunto ✓' : 'Aggiungi'}
        </button>
      </div>

      {showNutrition && (
        <div className="food-nutrition">
          <span className="food-nutrition-main">
            {variant === 'catalog' && nutrition
              ? formatNutrition(nutrition, unitDefault)
              : `${food.kcal100g} kcal / 100g`}
            {food.sizeLabel && unitDefault === 'pezzi' && (
              <small className="food-size">1 {food.sizeLabel}</small>
            )}
          </span>
          {variant === 'catalog' && showMacros && nutrition && (
            <span className="food-nutrition-macros">{formatMacros(nutrition)}</span>
          )}
        </div>
      )}
    </li>
  );
}