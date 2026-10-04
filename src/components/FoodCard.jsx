import { nutritionFor, formatNutrition, formatMacros } from '../lib/nutrition';
import { UnitPicker } from './UnitPicker';
import { ALL_UNITS, sizeLabelInItalian, stepForUnit } from '../lib/units';

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
  // La nutrizione segue l'unita' scelta: su 1 kg di parmigiano non ha senso
  // calcolarla come se fosse 1 g.
  const effectiveUnit = currentUnit || unitDefault;
  const nutrition = nutritionFor(food, quantity, effectiveUnit);
  const stepValue = step ?? stepForUnit(effectiveUnit);

  const showUnitSelector = variant === 'search';
  const showStepper = variant === 'catalog' || variant === 'list-item';

  // Le descrizioni USDA sono per lo piu' in inglese e spesso lunghissime:
  // solo le brevi tradotte meritano di finire nella lista.
  const sizeLabel = sizeLabelInItalian(food.sizeLabel);

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
              aria-label={`Diminuisci quantità di ${food.displayName}`}
              disabled={disabled}
            >
              −
            </button>
            <span className="stepper-value">
              {quantity}
              <small>{effectiveUnit}</small>
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onQuantityChange?.(food, quantity + stepValue); }}
              aria-label={`Aumenta quantità di ${food.displayName}`}
              disabled={disabled}
            >
              +
            </button>
          </div>
        )}

        {showUnitSelector && onUnitChange && (
          <UnitPicker
            units={ALL_UNITS}
            value={effectiveUnit}
            quantity={quantity}
            gramsPerUnit={food.gramsPerUnit}
            onChange={(nextQuantity, unit) => onUnitChange(food, nextQuantity, unit)}
            itemName={food.displayName}
            disabled={disabled}
          />
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
              ? formatNutrition(nutrition, effectiveUnit)
              : `${food.kcal100g} kcal / 100g`}
            {sizeLabel && (
              <small className="food-size">1 {sizeLabel}</small>
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