import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ChildProvider } from './contexts/ChildContext';
import { SchoolProvider } from './contexts/SchoolContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Makes the portal installable as an app. Production only: the dev server has no built files to keep.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SchoolProvider>
        <ThemeProvider>
          <AuthProvider>
            <ChildProvider>
              <App />
            </ChildProvider>
          </AuthProvider>
        </ThemeProvider>
      </SchoolProvider>
    </BrowserRouter>
  </React.StrictMode>
);
