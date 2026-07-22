import { Suspense, useEffect } from 'react'
import './App.css'
import { Routes, Route } from 'react-router-dom'
import { routes } from './routes.jsx'
import RouteLoader from './components/RouteLoader.jsx'
import { ManualCandidatesProvider } from '../apps/HR/context/ManualCandidatesContext.jsx'
import ManualCandidatesModal from '../apps/HR/jobs/detail/ManualCandidatesModal.jsx'
import ManualCandidatesTray from '../apps/HR/jobs/detail/ManualCandidatesTray.jsx'

function App() {
  // Global Theme Logic
  useEffect(() => {
    const THEME_KEY = 'app-theme';
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (theme) => {
      const resolved = theme === 'system'
        ? (mediaQuery.matches ? 'dark' : 'light')
        : theme;
      document.documentElement.setAttribute('data-theme', resolved);
    };

    const initialTheme = localStorage.getItem(THEME_KEY) || 'system';
    applyTheme(initialTheme);

    const handleChange = () => {
      if ((localStorage.getItem(THEME_KEY) || 'system') === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const renderRoutes = (routes) => {
    return routes.map((route) => (
      <Route
        key={route.path || 'index'}
        path={route.path}
        index={route.index}
        element={route.element}
      >
        {route.children && renderRoutes(route.children)}
      </Route>
    ))
  }

  return (
    <div className="app">
      <ManualCandidatesProvider>
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            {renderRoutes(routes)}
          </Routes>
        </Suspense>
        <ManualCandidatesModal />
        <ManualCandidatesTray />
      </ManualCandidatesProvider>
    </div>
  )
}

export default App
