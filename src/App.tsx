import { useState } from 'react';
import './App.css';
import Login from './Login';
import Signup from './Signup';
import Dashboard from './Dashboard';

type View = 'login' | 'signup' | 'dashboard';

function App() {
  const [view, setView] = useState<View>('login');

  if (view === 'dashboard') {
    return <Dashboard onLogout={() => setView('login')} />;
  }

  if (view === 'signup') {
    return (
      <Signup
        onNavigateToLogin={() => setView('login')}
        onSignupSuccess={() => setView('dashboard')}
      />
    );
  }

  return (
    <Login
      onNavigateToSignup={() => setView('signup')}
      onLoginSuccess={() => setView('dashboard')}
    />
  );
}

export default App;
