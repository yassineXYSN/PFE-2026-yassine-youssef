import './App.css'
import { Routes, Route } from 'react-router-dom'
import { routes } from './routes.jsx'

function App() {
  return (
    <div className="app">
      <Routes>
        {routes.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}
      </Routes>
    </div>
  )
}

export default App
