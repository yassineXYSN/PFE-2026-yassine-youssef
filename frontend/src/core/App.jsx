import './App.css'
import { Routes, Route, Navigate } from 'react-router-dom'
import HrLogin from '../apps/hr/login/Login.jsx'
import CandidateLogin from '../apps/candidat/Login/LoginPage.jsx'

function App() {
  return (
    <div className="app">
      <Routes>
        {/* Route candidat login (route principale) */}
        <Route path="/candidat/login" element={<CandidateLogin />} />

        {/* Route HR login (séparée, pas route principale) */}
        <Route path="/hr/login" element={<HrLogin />} />

        {/* Route racine -> redirection vers candidat/login */}
        <Route path="/" element={<Navigate to="/candidat/login" replace />} />

        {/* Fallback pour toutes les autres URLs */}
        <Route path="*" element={<Navigate to="/candidat/login" replace />} />
      </Routes>
    </div>
  )
}

export default App
