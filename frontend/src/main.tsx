import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedLayout } from './components/ProtectedLayout';
import { AuthProvider } from './hooks/useAuth';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Missing React root element');
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <Toaster position="bottom-right" toastOptions={{ style: { fontSize: '14px' } }} />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
