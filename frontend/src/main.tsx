import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ChildProvider } from './contexts/ChildContext';
import { SchoolProvider } from './contexts/SchoolContext';
import { ThemeProvider } from './contexts/ThemeContext';

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
