import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './views/Home'
import Join from './views/Join'
import Host from './views/Host'
import Screen from './views/Screen'
import EditQuiz from './views/EditQuiz'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Login from './views/Login'
import { Toaster } from 'sonner'
import './index.css'

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return null // Or a loading spinner
  if (!user) return <Login />
  return children
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster position="top-center" richColors />
        <div className="min-h-screen">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/join" element={<Join />} />
            <Route path="/host/:gameId" element={<Host />} />
            <Route path="/screen/:gameId" element={<Screen />} />
            <Route path="/edit/:quizId" element={
              <ProtectedRoute>
                <EditQuiz />
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  )
}

export default App
