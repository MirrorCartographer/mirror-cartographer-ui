import React, { useEffect, useRef, useState } from 'react';
import { enterSharedPresence, getSharedWorldClient, getSharedWorldSession, requestSharedWorldLink, sharedWorldConfigured } from '../services/sharedWorld.js';
import './SharedWorldPanel.css';

export default function SharedWorldPanel() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('Wanderer');
  const [visibility, setVisibility] = useState('private');
  const [session, setSession] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [people, setPeople] = useState([]);
  const [status, setStatus] = useState('idle');
  const stopRef = useRef(null);
  const configured = sharedWorldConfigured();

  useEffect(() => {
    if (!open || !configured) return undefined;
    let active = true;
    getSharedWorldSession().then((value) => { if (active) setSession(value); })
      .catch((error) => { if (active) setMessage(error.message); });
    const supabase = getSharedWorldClient();
    const { data } = supabase.auth.onAuthStateChange((_event, value) => {
      setSession(value);
      if (!value) setStatus('idle');
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [open, configured]);

  useEffect(() => () => { stopRef.current?.(); }, []);

  const signIn = async () => {
    setBusy(true); setMessage('');
    try {
      await requestSharedWorldLink(email);
      setMessage('A sign-in link is on its way. The station will keep the light on.');
    } catch (error) { setMessage(error.message || 'Could not send the sign-in link.'); }
    finally { setBusy(false); }
  };

  const enter = async () => {
    setBusy(true); setMessage('');
    try {
      if (stopRef.current) await stopRef.current();
      stopRef.current = await enterSharedPresence({
        roomId: 'the-between', displayName, visibility,
        onChange: (result) => {
          setStatus(result.status);
          if (result.people) setPeople(result.people);
          if (result.error) setMessage(result.error);
        }
      });
      setMessage(visibility === 'private'
        ? 'You are here privately. Nobody else can see your presence.'
        : 'You have entered the shared room. Your presence will expire if the connection is lost.');
    } catch (error) { setStatus('error'); setMessage(error.message || 'The shared room could not be reached.'); }
    finally { setBusy(false); }
  };

  const leave = async () => {
    setBusy(true);
    try { await stopRef.current?.(); stopRef.current = null; }
    catch (error) { setMessage(error.message || 'Could not leave cleanly. Your presence expires automatically.'); }
    finally { setBusy(false); }
  };

  const signOut = async () => {
    await leave();
    const supabase = getSharedWorldClient();
    await supabase?.auth.signOut();
    setSession(null); setStatus('idle'); setPeople([]);
    setMessage('You have left the shared side.');
  };

  return <div className="shared-world">
    <button className="shared-world-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
      {open ? 'CLOSE THE OTHER SIDE' : 'THE OTHER SIDE'}
      <span className={status === 'connected' ? 'network-dot online' : 'network-dot'} />
    </button>
    {open && <section className="shared-world-panel" aria-label="Shared world connection">
      <button className="shared-world-close" onClick={() => setOpen(false)} aria-label="Close shared world panel">×</button>
      <p className="shared-kicker">MIRROR WEAVER / CO-PRESENCE</p>
      <h2>The room has<br/><em>another side.</em></h2>
      {!configured ? <p className="shared-note">The personal world is active. The shared-world address has not been supplied to this Pages build yet.</p>
      : !session ? <>
        <p className="shared-note">Sign in to meet other visitors. Your private world stays private.</p>
        <label>Email for a sign-in link<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email"/></label>
        <button className="shared-action" onClick={signIn} disabled={busy || !email.trim()}>{busy ? 'SENDING…' : 'SEND ME A KEY'}</button>
      </> : <>
        <p className="shared-note">You are signed in. Choose what the room is allowed to reveal.</p>
        <label>Your name in this room<input value={displayName} maxLength={40} onChange={(event) => setDisplayName(event.target.value)} /></label>
        <label>Who can see you<select value={visibility} onChange={(event) => setVisibility(event.target.value)}>
          <option value="private">Only me</option><option value="connections">Accepted connections</option><option value="public">Everyone in the room</option>
        </select></label>
        {status !== 'connected'
          ? <button className="shared-action" onClick={enter} disabled={busy}>{busy ? 'OPENING…' : 'ENTER THE ROOM'}</button>
          : <button className="shared-action" onClick={leave} disabled={busy}>{busy ? 'LEAVING…' : 'LEAVE THE ROOM'}</button>}
        {status === 'connected' && <div className="shared-visitors"><b>{visibility === 'private' ? 'YOUR PRIVATE ARRIVAL' : `${people.length} OTHER VISITOR${people.length === 1 ? '' : 'S'}`}</b>
          {visibility !== 'private' && people.map((person) => <p key={person.user_id}><span>{person.display_name}</span><i>{person.activity_state}</i></p>)}
          {visibility !== 'private' && people.length === 0 && <p className="shared-empty">No one else is here. Yet.</p>}
        </div>}
        <button className="shared-signout" onClick={signOut} disabled={busy}>SIGN OUT</button>
      </>}
      {message && <p className="shared-message" role="status">{message}</p>}
      <p className="shared-footnote">Presence is temporary. Private is the default. You can leave at any time.</p>
    </section>}
  </div>;
}
