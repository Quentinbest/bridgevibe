import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/bricolage-grotesque/latin-600.css';
import '@fontsource/bricolage-grotesque/latin-800.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './tokens.css';
import './styles.css';
import { devicePreferences, matchLocale } from '../explanation/match';
import { App } from './App';
import { createLocaleController, ELIGIBLE_LOCALES } from './locale';

async function boot() {
  const controller = createLocaleController();
  // E-03: commit the catalogue and title before the first learner-facing render.
  await controller.boot(matchLocale(devicePreferences(navigator), ELIGIBLE_LOCALES));
  ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App controller={controller} /></React.StrictMode>);
}
void boot();
