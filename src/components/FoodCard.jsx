import { nutritionFor, formatNutrition, formatMacros } from '../lib/nutrition';

/**
 * Card prodotto riutilizzabile per visualizzare alimenti del catalogo.
 * Supporta due modalità:
 * - "search": risultati ricerca catalogo (ShoppingList) - con stepper quantità
 * - "catalog": catalogo completo (CatalogScreen) - con stepper completo, macro, tag "aggiunto"
 */
export function FoodCard({
  food,
  quantity,
  unitDefault,
  step,
  onQuantityChange,
  onAdd,
  disabled = false,
  justAdded = false,
  showMacros = true,
  showNutrition = true,
  variant = 'catalog', // 'search' | 'catalog'
}) {
  const nutrition = nutritionFor(food, quantity, unitDefault);
  const stepValue = step ?? (unitDefault === 'pezzi' ? 1 : unitDefault === 'kg' ? 0.1 : 10);

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
        {variant !== 'search' && (
          <div className="stepper">
            <button
              type="button"
              onClick={() => onQuantityChange?.(food, quantity - stepValue)}
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
              onClick={() => onQuantityChange?.(food, quantity + stepValue)}
              aria-label={`Aumenta quantità di ${food.displayName}`}
              disabled={disabled}
            >
              +
            </button>
          </div>
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