
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const S = {
  page: { minHeight: '100vh', background: '#070710', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', fontFamily: "'DM Sans', sans-serif", position: 'relative', overflow: 'hidden' },
  glow: { position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 25% 20%, #00d68f12 0%, transparent 55%), radial-gradient(ellipse at 75% 80%, #7c3aed12 0%, transparent 55%)', pointerEvents: 'none' },
  card: { maxWidth: 400, width: '100%', position: 'relative', zIndex: 1 },
  logoText: { textAlign: 'center', marginBottom: 32 },
  logo: { fontSize: 28, fontFamily: "'Syne', sans-serif", fontWeight: 800, letterSpacing: -1, background: 'linear-gradient(135deg, #00d68f, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 4 },
  logoSub: { color: '#2a2a4a', fontSize: 11, letterSpacing: 4, textTransform: 'uppercase' },
  box: { background: '#0d0d1c', border: '1px solid #1c1c2e', borderRadius: 16, padding: '28px 24px' },
  title: { color: '#fff', fontSize: 20, fontWeight: 600, fontFamily: "'Syne', sans-serif", marginBottom: 4 },
  subtitle: { color: '#2a2a4a', fontSize: 13, marginBottom: 24 },
  label: { color: '#444', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, display: 'block' },
  input: { width: '100%', padding: '12px 14px', background: '#0a0a14', border: '1px solid #1c1c2e', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none', marginBottom: 14, fontFamily: "'DM Sans', sans-serif" },
  btnPrimary: { width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #00d68f, #00a86b)', color: '#070710', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", marginBottom: 12 },
  btnGoogle: { width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #1c1c2e', background: '#0a0a14', color: '#ccc', fontWeight: 500, fontSize: 14, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 },
  divider: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
  dividerLine: { flex: 1, height: 1, background: '#1c1c2e' },
  dividerText: { color: '#2a2a4a', fontSize: 12 },
  link: { color: '#00d68f', cursor: 'pointer', fontSize: 13 },
  error: { background: '#ff4d6d18', border: '1px solid #ff4d6d33', borderRadius: 8, padding: '10px 12px', color: '#ff4d6d', fontSize: 13, marginBottom: 14 },
  success: { background: '#00d68f18', border: '1px solid #00d68f33', borderRadius: 8, padding: '10px 12px', color: '#00d68f', fontSize: 13, marginBottom: 14 }
}

function GoogleIcon() {
  return <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04c-.72.48-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.29H1.88v2.07A8 8 0 0 0 8.98 17z"/><path fill="#FBBC05" d="M4.51 10.49A4.8 4.8 0 0 1 4.26 9c0-.52.09-1.02.25-1.49V5.44H1.88A8 8 0 0 0 .98 9c0 1.29.31 2.51.9 3.56l2.63-2.07z"/><path fill="#EA4335" d="M8.98 3.72c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.88 5.44L4.51 7.5C5.14 5.61 6.9 3.72 8.98 3.72z"/></svg>
}

function friendlyError(code) {
  const map = { 'auth/user-not-found': 'No account found with this email.', 'auth/wrong-password': 'Incorrect password.', 'auth/email-already-in-use': 'Email already in use.', 'auth/invalid-email': 'Invalid email address.', 'auth/weak-password': 'Password must be 6+ characters.', 'auth/too-many-requests': 'Too many attempts. Try later.', 'auth/popup-closed-by-user': 'Google sign-in cancelled.', 'auth/network-request-failed': 'Network error. Check connection.' }
  return map[code] || 'Something went wrong. Try again.'
}

export function SignIn({ onSwitch }) {
  const { signIn, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  const submit = async (e) => { e.preventDefault(); if (!email || !password) return setError('Fill in all fields.'); setError(''); setLoading(true); try { await signIn(email, password) } catch (err) { setError(friendlyError(err.code)) } setLoading(false) }
  const google = async () => { setError(''); setLoading(true); try { await signInWithGoogle() } catch (err) { setError(friendlyError(err.code)) } setLoading(false) }
  return <div style={S.page}><link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"/><div style={S.glow}/><div style={S.card}><div style={S.logoText}><div style={S.logo}>AETHON</div><div style={S.logoSub}>Fitness Intelligence</div></div><div style={S.box}><div style={S.title}>Welcome back</div><div style={S.subtitle}>Sign in to continue your journey</div>{error && <div style={S.error}>{error}</div>}<form onSubmit={submit}><label style={S.label}>Email</label><input style={S.input} type="email" placeholder="you@email.com" value={email} onChange={e=>setEmail(e.target.value)}/><label style={S.label}>Password</label><input style={S.input} type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)}/><div style={{textAlign:'right',marginBottom:16,marginTop:-8}}><span style={S.link} onClick={()=>onSwitch('forgot')}>Forgot password?</span></div><button style={{...S.btnPrimary,opacity:loading?.7:1}} disabled={loading}>{loading?'Signing in...':'Sign In →'}</button></form><div style={S.divider}><div style={S.dividerLine}/><span style={S.dividerText}>or</span><div style={S.dividerLine}/></div><button style={S.btnGoogle} onClick={google} disabled={loading}><GoogleIcon/> Continue with Google</button><div style={{textAlign:'center',fontSize:13,color:'#2a2a4a'}}>No account? <span style={S.link} onClick={()=>onSwitch('signup')}>Sign up</span></div></div></div></div>
}

export function SignUp({ onSwitch }) {
  const { signUp, signInWithGoogle } = useAuth()
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  const submit = async (e) => { e.preventDefault(); if (!name||!email||!password) return setError('Fill in all fields.'); if (password!==confirm) return setError('Passwords do not match.'); if (password.length<6) return setError('Password must be 6+ characters.'); setError(''); setLoading(true); try { await signUp(email, password, name) } catch (err) { setError(friendlyError(err.code)) } setLoading(false) }
  const google = async () => { setError(''); setLoading(true); try { await signInWithGoogle() } catch (err) { setError(friendlyError(err.code)) } setLoading(false) }
  return <div style={S.page}><link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"/><div style={S.glow}/><div style={S.card}><div style={S.logoText}><div style={S.logo}>AETHON</div><div style={S.logoSub}>Fitness Intelligence</div></div><div style={S.box}><div style={S.title}>Create account</div><div style={S.subtitle}>Start your fitness intelligence journey</div>{error && <div style={S.error}>{error}</div>}<form onSubmit={submit}><label style={S.label}>Full Name</label><input style={S.input} type="text" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)}/><label style={S.label}>Email</label><input style={S.input} type="email" placeholder="you@email.com" value={email} onChange={e=>setEmail(e.target.value)}/><label style={S.label}>Password</label><input style={S.input} type="password" placeholder="Min. 6 characters" value={password} onChange={e=>setPassword(e.target.value)}/><label style={S.label}>Confirm Password</label><input style={S.input} type="password" placeholder="••••••••" value={confirm} onChange={e=>setConfirm(e.target.value)}/><button style={{...S.btnPrimary,opacity:loading?.7:1}} disabled={loading}>{loading?'Creating...':'Create Account →'}</button></form><div style={S.divider}><div style={S.dividerLine}/><span style={S.dividerText}>or</span><div style={S.dividerLine}/></div><button style={S.btnGoogle} onClick={google} disabled={loading}><GoogleIcon/> Continue with Google</button><div style={{textAlign:'center',fontSize:13,color:'#2a2a4a'}}>Have account? <span style={S.link} onClick={()=>onSwitch('signin')}>Sign in</span></div></div></div></div>
}

export function ForgotPassword({ onSwitch }) {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState(''); const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const [loading, setLoading] = useState(false)
  const submit = async (e) => { e.preventDefault(); if (!email) return setError('Enter your email.'); setError(''); setLoading(true); try { await resetPassword(email); setSuccess('Reset email sent! Check your inbox.') } catch (err) { setError(friendlyError(err.code)) } setLoading(false) }
  return <div style={S.page}><link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"/><div style={S.glow}/><div style={S.card}><div style={S.logoText}><div style={S.logo}>AETHON</div><div style={S.logoSub}>Fitness Intelligence</div></div><div style={S.box}><div style={S.title}>Reset password</div><div style={S.subtitle}>We will send you a reset link</div>{error && <div style={S.error}>{error}</div>}{success && <div style={S.success}>{success}</div>}<form onSubmit={submit}><label style={S.label}>Email</label><input style={S.input} type="email" placeholder="you@email.com" value={email} onChange={e=>setEmail(e.target.value)}/><button style={{...S.btnPrimary,opacity:loading?.7:1}} disabled={loading}>{loading?'Sending...':'Send Reset Link'}</button></form><div style={{textAlign:'center',fontSize:13,color:'#2a2a4a'}}>Remember it? <span style={S.link} onClick={()=>onSwitch('signin')}>Sign in</span></div></div></div></div>
}
