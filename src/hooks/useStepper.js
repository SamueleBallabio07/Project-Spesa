import { useCallback, useState } from 'react';

/**
 * Hook per gestire lo stepper quantità nei prodotti.
 * Restituisce funzioni per incrementare/decrementare e il valore corrente.
 */
export function useStepper(initialQuantities = {}) {
  const [picked, setPicked] = useState(initialQuantities);
  const [unitSelections, setUnitSelections] = useState({});

  const stepFor = useCallback((food) => {
    if (food.unitDefault === 'pezzi') return 1;
    if (food.unitDefault === 'kg') return 0.1;
    return 10;
  }, []);

  const initialQty = useCallback((food) => {
    if (picked[food.fdcId] !== undefined) return picked[food.fdcId];
    if (food.unitDefault === 'kg') return 0.5;
    if (food.unitDefault === 'pezzi') return 1;
    return 100;
  }, [picked]);

  const pickQty = useCallback((food, next, unit) => {
    // Se viene passato un nuovo unit, aggiorna la selezione unità
    if (unit && unit !== food.unitDefault) {
      setUnitSelections((prev) => ({ ...prev, [food.fdcId]: unit }));
    }
    
    const currentUnit = unitSelections[food.fdcId] || food.unitDefault;
    const step = stepFor({ ...food, unitDefault: currentUnit });
    const value = Math.max(step, Number(next) || step);
    const rounded = Math.round(value * 100) / 100;
    setPicked((prev) => ({ ...prev, [food.fdcId]: rounded }));
  }, [stepFor]);

  const getCurrentUnit = useCallback((food) => {
    return unitSelections[food.fdcId] || food.unitDefault;
  }, []);

  const resetQty = useCallback((fdcId) => {
    setPicked((prev) => {
      const next = { ...prev };
      delete next[fdcId];
      return next;
    });
    setUnitSelections((prev) => {
      const next = { ...prev };
      delete next[fdcId];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setPicked({});
    setUnitSelections({});
  }, []);

  return {
    picked,
    unitSelections,
    stepFor,
    initialQty,
    pickQty,
    getCurrentUnit,
    resetQty,
    clearAll,
  };
}