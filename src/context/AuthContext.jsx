import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut, sendPasswordResetEmail, updateProfile } from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider } from '../firebase/config'

const AuthContext = createContext(null)
export function useAuth() { return useContext(AuthContext) }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  async function createUserDoc(firebaseUser, extraData = {}) {
    const ref = doc(db, 'users', firebaseUser.uid)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || extraData.name || '',
        createdAt: serverTimestamp(),
        profile: null
      })
    }
  }

  async function signUp(email, password, name) {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(result.user, { displayName: name })
    await createUserDoc(result.user, { name })
    return result
  }

  async function signIn(email, password) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  async function signInWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider)
    await createUserDoc(result.user)
    return result
  }

  async function logOut() { return signOut(auth) }

  async function resetPassword(email) { return sendPasswordResetEmail(auth, email) }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false) })
    return unsub
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signInWithGoogle, logOut, resetPassword }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
