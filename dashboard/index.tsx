import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { installTenantFetchWrapper } from './services/tenantContext';

// dashboard起動時にtenantヘッダ自動付与の仕組みを有効化（薬局SaaS版・暫定）
installTenantFetchWrapper();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
