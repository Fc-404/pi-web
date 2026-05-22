import { useState, useEffect } from 'react'
import { LoginPage } from './components/LoginPage'
import { isLoggedIn } from './lib/auth'
import { setOnUnauthorized } from './lib/api'
import { ToastProvider } from './components/Toast'
import { MainLayout } from './components/MainLayout'

function App() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn())

  useEffect(() => {
    setOnUnauthorized(() => setLoggedIn(false))
  }, [])

  return (
    <ToastProvider>
      {loggedIn ? <MainLayout /> : <LoginPage onLogin={() => setLoggedIn(true)} />}
    </ToastProvider>
  )
}

export default App
