import React, { useEffect, useState } from 'react';
import { authConfigured, supabase } from './supabaseClient';
import PlatformDashboard from './PlatformDashboard';

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(authConfigured);
  const [dashboardOpen, setDashboardOpen] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function signIn(event) {
    event.preventDefault();
    setMessage('');
    const redirectTo = window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    setMessage(error ? error.message : 'A secure sign-in link has been sent to your email.');
  }

  if (!authConfigured) {
    return (
      <div className="platform-setup">
        <div className="platform-card">
          <p className="platform-kicker">PRIVATE SYSTEM BOUNDARY</p>
          <h1>Mirror Cartographer access is ready to connect.</h1>
          <p>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to Vercel, then redeploy.</p>
          <p>No OpenAI secret belongs in this browser application.</p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="platform-loading">Locating your continuity…</div>;

  if (!session) {
    return (
      <div className="platform-login">
        <form className="platform-card" onSubmit={signIn}>
          <p className="platform-kicker">MIRROR CARTOGRAPHER / PRIVATE ENTRY</p>
          <h1>Return to the map.</h1>
          <p>No password to remember. We send a one-use doorway to the email you trust.</p>
          <label>
            Email
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="mirrorcartographer@gmail.com" />
          </label>
          <button type="submit">Send secure doorway</button>
          {message && <p className="platform-message">{message}</p>}
        </form>
      </div>
    );
  }

  return (
    <>
      <div className="platform-toolbar">
        <span>{session.user.email}</span>
        <button onClick={() => setDashboardOpen((value) => !value)}>{dashboardOpen ? 'Return to field' : 'Open operations'}</button>
        <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
      {dashboardOpen ? <PlatformDashboard session={session} /> : children}
    </>
  );
}
