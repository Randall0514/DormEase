import { useState, useEffect } from 'react';
import './App.css';
import Login from './Login';
import Signup from './Signup';
import Dashboard from './Dashboard';

const AUTH_TOKEN_KEY = 'dormease_token';
const API_BASE = 'http://localhost:3000';

type View = 'login' | 'signup' | 'dashboard';

function App() {
  const [view, setView] = useState<View>('login');
  const [isNewAccount, setIsNewAccount] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      setSessionChecked(true);
      return;
    }
    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.ok) {
          setView('dashboard');
        } else {
          localStorage.removeItem(AUTH_TOKEN_KEY);
        }
      })
      .catch(() => localStorage.removeItem(AUTH_TOKEN_KEY))
      .finally(() => setSessionChecked(true));
  }, []);

  const handleLogout = async () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // ignore
      }
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
    setView('login');
  };

  if (!sessionChecked) {
    return null; // or a loading spinner
  }

  if (view === 'dashboard') {
    return (
      <Dashboard
        onLogout={handleLogout}
        account={{ isNew: isNewAccount }}
        onSetupComplete={() => setIsNewAccount(false)}
      />
    );
  }

  if (view === 'signup') {
    return (
      <Signup
        onNavigateToLogin={() => setView('login')}
        onSignupSuccess={() => {
          setIsNewAccount(true);
          setView('dashboard');
        }}
      />
    );
  }

  return (
    <Login
      onNavigateToSignup={() => setView('signup')}
      onLoginSuccess={() => {
        setIsNewAccount(false);
        setView('dashboard');
      }}
    />
  );
}

export default App;
