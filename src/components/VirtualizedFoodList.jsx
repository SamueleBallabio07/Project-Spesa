import { useMemo } from 'react';
import { List } from 'react-window';
import { FoodCard } from './FoodCard';

/**
 * Lista virtualizzata per il catalogo alimentare.
 * Usa react-window per rendere solo gli elementi visibili.
 */
export function VirtualizedFoodList({
  foods,
  onAdd,
  onQuantityChange,
  selectedListId,
  added = {},
  picked = {},
  initialQty,
  stepFor,
  variant = 'catalog',
}) {
  // Altezza fissa per ogni elemento (in px)
  const ITEM_HEIGHT = 140;

  const items = useMemo(() => foods, [foods]);

  const Row = useMemo(
    () => ({ index, style }) => {
      const food = items[index];
      const quantity = picked[food.fdcId] ?? initialQty(food);
      const step = stepFor(food);
      const justAdded = Boolean(added[food.fdcId]);

      return (
        <div style={style}>
          <FoodCard
            food={food}
            quantity={quantity}
            unitDefault={food.unitDefault}
            step={step}
            onQuantityChange={onQuantityChange}
            onAdd={onAdd}
            disabled={!selectedListId}
            justAdded={justAdded}
            variant={variant}
          />
        </div>
      );
    },
    [items, picked, initialQty, stepFor, added, onQuantityChange, onAdd, selectedListId, variant]
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <List
      height={400}
      itemCount={items.length}
      itemSize={ITEM_HEIGHT}
      width="100%"
      overscanCount={5}
    >
      {Row}
    </List>
  );
}