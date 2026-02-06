import './App.css'
import { Routes, Route } from 'react-router-dom'
import { routes } from './routes.jsx'

const renderRoutes = (routeList) =>
  routeList.map((route, index) => {
    if (route.index) {
      return <Route key={`index-${index}`} index element={route.element} />
    }

    return (
      <Route key={route.path || index} path={route.path} element={route.element}>
        {route.children ? renderRoutes(route.children) : null}
      </Route>
    )
  })

function App() {
  return (
    <div className="app">
      <Routes>
        {renderRoutes(routes)}
      </Routes>
    </div>
  )
}

export default App
