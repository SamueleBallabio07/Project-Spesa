/**
 * Guardia sul cablaggio fra componenti e hook.
 *
 * Due difetti che hanno reso lo stepper quantita' del tutto inattivo, e che
 * nessun test catching avrebbe intercettato:
 *
 * 1. Un componente chiamava `onUpdateItem(...)` senza averlo destrutturato
 *    fra le prop: a runtime `onUpdateItem` era `undefined` e il click
 *    lanciava TypeError. Il sintomo era "non succede nulla", che sembrava un
 *    problema di CSS/touch e ha fatto accumulare una decina di fix a caso.
 * 2. `useCallback` che legge `items` ma non lo mette fra le dipendenze: la
 *    closure conserva lo snapshot del primo render, quindi `.find()` non
 *    trova nulla e la funzione esce subito con `false`.
 *
 * Non serve una libreria di rendering: si verificano gli invarianti di
 * sorgente, come in test/security.test.js.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

/** Indice del carattere di chiusura che bilancia l'apertura da `start`. */
const matchBracket = (text, start, openChar, closeChar) => {
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (char === openChar) depth += 1;
    else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
};

/** Nomi dichiarati nella firma di un componente: `function X({ a, b })`. */
const propsOf = (source) => {
  const signature = source.match(/function\s+\w+\s*\(\s*\{([\s\S]*?)\}\s*\)/);
  if (!signature) return [];
  return signature[1]
    .split(',')
    .map((part) => part.replace(/\/\/.*$/, '').trim())
    .filter(Boolean);
};

/**
 * Callback chiamate nel corpo del componente, tipo `onToggleItem(...)`.
 *
 * Non sono i prop passati come `onClick={fn}`: quelli non hanno le parentesi
 * subito dopo e non possono quindi risultare indefiniti.
 */
const calledCallbacks = (source) => {
  const found = new Set();
  for (const match of source.matchAll(/(?<![.\w])(on[A-Z]\w*)\s*\(/g)) {
    found.add(match[1]);
  }
  return found;
};

/** Blocchi `useCallback`: nome, corpo e dipendenze. */
const callbacksOf = (source) => {
  const blocks = [];
  for (const match of source.matchAll(/const\s+(\w+)\s*=\s*useCallback\s*\(/g)) {
    const open = source.indexOf('(', match.index);
    const close = matchBracket(source, open, '(', ')');
    if (close === -1) continue;

    const args = source.slice(open + 1, close);
    const depsStart = args.lastIndexOf('[');
    if (depsStart === -1) continue;

    const depsEnd = matchBracket(args, depsStart, '[', ']');
    if (depsEnd === -1) continue;

    blocks.push({
      name: match[1],
      body: args.slice(0, depsStart),
      deps: args.slice(depsStart + 1, depsEnd),
    });
  }
  return blocks;
};

const COMPONENTS = [
  'src/components/ShoppingList.jsx',
  'src/components/CatalogScreen.jsx',
  'src/components/FoodCard.jsx',
];

describe('le callback usate nei componenti arrivano davvero come prop', () => {
  for (const file of COMPONENTS) {
    it(file, () => {
      const source = read(file);
      const declared = new Set(propsOf(source));
      const missing = [...calledCallbacks(source)].filter((name) => !declared.has(name));
      expect(missing).toEqual([]);
    });
  }
});

describe('le callback non leggono uno snapshot stale dello stato', () => {
  // Per ogni hook lo stato di cui le callback non possono dipendere.
  const STALE_PRONE = [
    { file: 'src/hooks/useShoppingList.js', state: 'items', expected: ['toggleItem', 'updateItem', 'removeItem'] },
    { file: 'src/hooks/useStepper.js', state: 'unitSelections', expected: ['pickQty', 'getCurrentUnit', 'getStepForCurrentUnit'] },
  ];

  for (const { file, state, expected } of STALE_PRONE) {
    describe(file, () => {
      const blocks = callbacksOf(read(file));

      it('il file espone le callback da controllare', () => {
        // Se il pattern di parsing regredisce, i test qui sotto passerebbero
        // vacui: va detto apertamente.
        expect(blocks.map((b) => b.name)).toEqual(expect.arrayContaining(expected));
      });

      it(`chi usa ${state} nella callback lo dichiara fra le dipendenze`, () => {
        // Lo stato conta come letto sia con accesso a proprieta' (`items.find`) sia
// con accesso a indice (`unitSelections[food.fdcId]`): basta uno dei due per
// congelare un valore stale nella closure.
const readsState = new RegExp(`(?:^|[^\\w.])${state}\\s*[.\\[]`);
        const readsRef = new RegExp(`(?:^|[^\\w.])${state}Ref\\.current`);
        const inDeps = new RegExp(`(?:^|[^\\w])${state}(?:,|$|\\s)`);

        const offenders = [];
        for (const { name, body, deps } of blocks) {
          if (!readsState.test(body)) continue;
          // Lo stato resta lecito solo se letto attraverso un ref sempre
          // aggiornato, che non congela il valore.
          if (!readsRef.test(body) && !inDeps.test(deps)) offenders.push(name);
        }
        expect(offenders).toEqual([]);
      });
    });
  }
});