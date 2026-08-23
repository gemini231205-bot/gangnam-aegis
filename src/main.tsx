import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import PoliceDashboard from '@/components/police/PoliceDashboard';
import './index.css';

function getRoute(): string {
  const hash = window.location.hash.replace(/^#/, '');
  if (hash === '/police') return '/police';
  return '/';
}

function Router() {
  const [route, setRoute] = useState(getRoute());

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (route === '/police') return <PoliceDashboard />;
  return <App />;
}

createRoot(document.getElementById('root')!).render(<Router />);
