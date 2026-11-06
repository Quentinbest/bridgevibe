import { catalogue } from '../explanation';
import { pseudoLocalise, stubCatalogue } from '../explanation/pseudo';

// I18N-23: preview catalogues never ship in production.
export function previewCatalogue(tag: string) {
  if (tag === 'en-XA') return pseudoLocalise(catalogue);
  return stubCatalogue(catalogue, tag === 'es' ? 'long' : 'cjk');
}
