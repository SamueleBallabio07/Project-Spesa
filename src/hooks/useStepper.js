import { useCallback, useEffect, useRef, useState } from 'react';
import { roundQuantity, MIN_QUANTITY } from '../lib/quantity';
import { stepForUnit } from '../lib/units';

/**
 * Hook per gestire lo stepper quantità nei prodotti.
 * Restituisce funzioni per incrementare/decrementare e il valore corrente.
 */
export function useStepper(initialQuantities = {}) {
  const [picked, setPicked] = useState(initialQuantities);
  const [unitSelections, setUnitSelections] = useState({});

  // Le unità scelte non possono stare fra le dipendenze delle callback, o ne
  // ricreerebbero una per ogni selezione. Il ref espone l'ultimo valore senza
  // congelare lo snapshot del primo render, che rendeva il passo dello
  // stepper sempre quello dell'unità predefinita.
  const unitSelectionsRef = useRef(unitSelections);
  useEffect(() => {
    unitSelectionsRef.current = unitSelections;
  }, [unitSelections]);

  // Il passo lo decide units.js: e' la stessa tabella usata dal selettore
  // unita', quindi non possono dare risultati diversi.
  const stepFor = useCallback((food) => stepForUnit(food.unitDefault), []);

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

    // Appena scelta un'unità nuova, lo step va letto da quella scelta appena
    // fatta: il ref non è ancora aggiornato.
    const currentUnit = unit || unitSelectionsRef.current[food.fdcId] || food.unitDefault;
    const step = stepForUnit(currentUnit);
    const value = Math.max(MIN_QUANTITY, Number(next) || step);
    setPicked((prev) => ({ ...prev, [food.fdcId]: roundQuantity(value) }));
  }, []);

  const getCurrentUnit = useCallback((food) => {
    return unitSelectionsRef.current[food.fdcId] || food.unitDefault;
  }, []);

  const getStepForCurrentUnit = useCallback((food) => {
    const unit = unitSelectionsRef.current[food.fdcId] || food.unitDefault;
    return stepForUnit(unit);
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
    getStepForCurrentUnit,
    resetQty,
    clearAll,
  };
}