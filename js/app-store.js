import { Store, itemName } from './store.js';
import { detectLang, getLang } from './i18n.js';
import { loadImageRepo } from './images.js';

function safeStorage() {
  try {
    localStorage.setItem('kararoku:probe', '1');
    localStorage.removeItem('kararoku:probe');
    return localStorage;
  } catch {
    return null;
  }
}

export const store = new Store({ storage: safeStorage(), lang: detectLang(), images: await loadImageRepo() });

export function nameOf(kind, item) {
  return item ? itemName(kind, item, getLang()) : '';
}

export function nameById(kind, id) {
  return nameOf(kind, store.get(kind, id));
}
