import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './views/Home'
import Join from './views/Join'
import Host from './views/Host'
import Screen from './views/Screen'
import EditQuiz from './views/EditQuiz'
import { Toaster } from 'sonner'
import './index.css'

function App() {
  return (
    <Router>
      <Toaster position="top-center" richColors />
      <div className="min-h-screen">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/join" element={<Join />} />
          <Route path="/host/:quizId" element={<Host />} />
          <Route path="/screen/:gameId" element={<Screen />} />
          <Route path="/edit/:quizId" element={<EditQuiz />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
