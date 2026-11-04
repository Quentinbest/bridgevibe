import { afterEach } from 'vitest';
import { catalogue, setLocale } from '../src/explanation';

// E-06: both test projects share the same English starting point for every test.
afterEach(() => { setLocale('en', catalogue); });
