// src/App.jsx
import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SignIn, SignUp, ForgotPassword } from './pages/Auth'
import Aethon from './Aethon'

function AppRouter() {
  const { user } = useAuth()
  const [authPage, setAuthPage] = useState('signin')

  // If logged in → show main app
  if (user) return <Aethon />

  // Otherwise show auth pages
  if (authPage === 'signin') return <SignIn onSwitch={setAuthPage} />
  if (authPage === 'signup') return <SignUp onSwitch={setAuthPage} />
  if (authPage === 'forgot') return <ForgotPassword onSwitch={setAuthPage} />
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  )
}
