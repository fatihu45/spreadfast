import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/design-system.css';

const element = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

const container = document.getElementById('root');
if (window.location.pathname === '/' && container.dataset.prerendered === 'true') {
  ReactDOM.hydrateRoot(container, element);
} else {
  ReactDOM.createRoot(container).render(element);
}
