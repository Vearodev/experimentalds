import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/onest';
import '@basis/tokens/styles.css';
import '@basis/ui/styles.css';
import './playground.css';
import './design-workbench.css';
import './table-tools.css';
import './token-architecture.css';
import { App } from './App';
import { DesignProvider } from './DesignContext';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DesignProvider>
      <App />
    </DesignProvider>
  </StrictMode>,
);

import './extended-pages.css';
