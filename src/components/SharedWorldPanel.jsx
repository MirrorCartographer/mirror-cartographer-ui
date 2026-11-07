import React, { useEffect, useRef, useState } from 'react';
import { deletePrivateContinuity, deletePrivateMemoryEntry, enterSharedPresence, getSharedWorldClient, getSharedWorldSession, listWorldConnections, loadPrivateContinuity, loadPrivateMemoryLedger, requestSharedWorldLink, requestWorldConnection, savePrivateContinuity, sharedWorldConfigured, transitionWorldConnection, updatePrivateMemoryNote, isPrivateMemorySyncEnabled, isResidentMemoryUseEnabled, isAmbientContextUseEnabled, setPrivateMemorySyncEnabled, setResidentMemoryUseEnabled, setAmbientContextUseEnabled } from '../services/sharedWorld.js';
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
  const [connections, setConnections] = useState([]);
  const [targetId, setTargetId] = useState('');
  const [connectionBusy, setConnectionBusy] = useState(false);
  const [memorySync, setMemorySync] = useState(isPrivateMemorySyncEnabled);
  const [residentMemoryUse, setResidentMemoryUse] = useState(isResidentMemoryUseEnabled);
  const [ambientContextUse, setAmbientContextUse] = useState(isAmbientContextUseEnabled);
  const [privateMemory, setPrivateMemory] = useState(null);
  const [memoryEntries, setMemoryEntries] = useState([]);
  const [memoryNotes, setMemoryNotes] = useState({});
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

  useEffect(() => {
    if (!open || !session) return undefined;
    let active = true;
    listWorldConnections().then((rows) => { if (active) setConnections(rows); })
      .catch((error) => { if (active) setMessage(error.message || 'Could not load connection requests.'); });
    return () => { active = false; };
  }, [open, session?.user?.id]);
  useEffect(() => {
    if (!open || !session || !memorySync) { setPrivateMemory(null); setMemoryEntries([]); return undefined; }
    let active = true;
    const refreshLedger = () => loadPrivateMemoryLedger().then((entries) => {
      if (active) setMemoryEntries(entries);
    }).catch((error) => { if (active) setMessage(error.message || 'Could not read the memory ledger.'); });
    loadPrivateContinuity().then((value) => { if (active) setPrivateMemory(value || { visits: 0, choices: [] }); })
      .catch((error) => { if (active) setMessage(error.message || 'Could not read private memory.'); });
    refreshLedger();
    window.addEventListener('mc-memory-ledger-updated', refreshLedger);
    return () => { active = false; window.removeEventListener('mc-memory-ledger-updated', refreshLedger); };
  }, [open, session?.user?.id, memorySync]);

  const refreshConnections = async () => {
    const rows = await listWorldConnections();
    setConnections(rows);
    return rows;
  };

  const sendConnectionRequest = async () => {
    setConnectionBusy(true); setMessage('');
    try {
      await requestWorldConnection(targetId);
      setTargetId('');
      await refreshConnections();
      setMessage('Request sent. The other person decides whether to open the door.');
    } catch (error) { setMessage(error.message || 'Could not send that connection request.'); }
    finally { setConnectionBusy(false); }
  };

  const changeConnection = async (id, nextStatus) => {
    setConnectionBusy(true); setMessage('');
    try {
      await transitionWorldConnection(id, nextStatus);
      await refreshConnections();
      setMessage(nextStatus === 'accepted' ? 'Connection accepted.' : nextStatus === 'declined' ? 'Request declined.' : 'Connection closed.');
    } catch (error) { setMessage(error.message || 'Could not update that connection.'); }
    finally { setConnectionBusy(false); }
  };

  const updateMemorySync = (enabled) => {
    try {
      setPrivateMemorySyncEnabled(enabled);
      setMemorySync(enabled);
      if (!enabled) { setResidentMemoryUseEnabled(false); setResidentMemoryUse(false); }
      setMessage(enabled
        ? 'Private memory sync is on for this account. Your visit history and choices remain private.'
        : 'Private memory sync is off. This browser keeps its own separate visit history.');
    } catch (error) { setMessage(error.message || 'Could not update the memory preference.'); }
  };

  const forgetMemoryEntry = async (entry) => {
    if (!privateMemory || !entry?.id) return;
    const choice = entry.content?.choice_id;
    const next = { ...privateMemory, choices: (privateMemory.choices || []).filter((item) => item !== choice) };
    try {
      await savePrivateContinuity(next);
      await deletePrivateMemoryEntry(entry.id);
      setPrivateMemory(next);
      setMemoryEntries((items) => items.filter((item) => item.id !== entry.id));
      setMessage('That memory entry has been removed.');
    } catch (error) { setMessage(error.message || 'Could not update private memory.'); }
  };

  const saveMemoryNote = async (entry) => {
    try {
      const content = await updatePrivateMemoryNote(entry.id, memoryNotes[entry.id] ?? entry.content?.user_note ?? '');
      setMemoryEntries((items) => items.map((item) => item.id === entry.id ? { ...item, content, last_user_reviewed_at: new Date().toISOString() } : item));
      setMessage('Your correction has been saved to the private ledger.');
    } catch (error) { setMessage(error.message || 'Could not save that correction.'); }
  };

  const copyConnectionCode = async () => {
    try {
      await navigator.clipboard.writeText(session.user.id);
      setMessage('Your connection code was copied.');
    } catch { setMessage('Select the connection code above and copy it manually.'); }
  };

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
    updateMemorySync(false);
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
        <label className="shared-memory-sync"><input type="checkbox" checked={memorySync} onChange={(event) => updateMemorySync(event.target.checked)} /> <span>Carry my private memory across devices</span></label>
        <p className="shared-sync-note">Visit count, explicit choices, a small interaction counter, and last station event. Never visible to other visitors. Off by default.</p>
        {memorySync && <label className="shared-memory-sync"><input type="checkbox" checked={residentMemoryUse} onChange={(event) => {
          try { setResidentMemoryUseEnabled(event.target.checked); setResidentMemoryUse(event.target.checked); setMessage(event.target.checked ? 'Tazar and Jello may use your private continuity when replying. It is sent to the configured model provider.' : 'Resident access to private continuity is off.');
          } catch (error) { setMessage(error.message || 'Could not update resident memory access.'); }
        }} /> <span>Let Tazar and Jello consult my private memory when replying</span></label>}
        {memorySync && <p className="shared-sync-note">This is separate from saving memory. Off by default. When enabled, only your private visit and choice summary may be included with a message sent to the model provider.</p>}
        <label className="shared-memory-sync"><input type="checkbox" checked={ambientContextUse} onChange={(event) => {
          try { setAmbientContextUseEnabled(event.target.checked); setAmbientContextUse(event.target.checked); setMessage(event.target.checked ? 'A bounded room-sound cue may accompany your next resident message.' : 'Room-sound perception remains local to the scene.');
          } catch (error) { setMessage(error.message || 'Could not update the ambient-context preference.'); }
        }} /> <span>Let residents use the room-sound cue when replying</span></label>
        <p className="shared-sync-note">The microphone analyser stays local by default. Only a short sound-level cue—not audio or speech—is sent to the model provider when you enable this.</p>
        {memorySync && <section className="shared-memory-ledger">
          <b>PRIVATE MEMORY LEDGER · PRIVATE DURABLE / VISITOR-ENABLED</b>
          <p>{privateMemory ? `${privateMemory.visits || 0} visits · ${privateMemory.trust || 0} interaction marks · last event: ${privateMemory.lastEvent || 'none'}` : 'Loading private memory…'}</p>
          <small>Only explicit in-world choices are saved. No typed messages, microphone samples, or inferred feelings.</small>
          {memoryEntries.map((entry) => {
            const choice = entry.content?.choice_id || 'in-world choice';
            const label = ({
              'asked-jello': 'Asked Jello if she is always here',
              'asked-about-world': 'Asked what this place is',
              'asked-why': 'Asked why the station exists',
              'asked-event': 'Asked what happened',
              'asked-tazar': 'Asked who Tazar is',
              'left-silence': 'Chose to listen quietly',
              'opened-the-door': 'Opened the station door'
            })[choice] || choice;
            return <div className="memory-entry" key={entry.id}>
              <span>{label}</span>
              <small>{entry.memory_class} · {entry.claim_status} · {entry.sensitivity_class} · {entry.confidence}</small>
              <input value={memoryNotes[entry.id] ?? entry.content?.user_note ?? ''} onChange={(event) => setMemoryNotes((notes) => ({ ...notes, [entry.id]: event.target.value }))} placeholder="Your correction or note…" maxLength={500} aria-label="Edit your private memory note"/>
              <div><button onClick={() => saveMemoryNote(entry)}>SAVE NOTE</button><button onClick={() => forgetMemoryEntry(entry)}>FORGET</button></div>
            </div>;
          })}
          {privateMemory && !memoryEntries.length && <p className="shared-empty">No saved choices yet.</p>}
        </section>}
        {memorySync && <button className="shared-signout" onClick={async () => {
          try {
            await deletePrivateContinuity();
            setPrivateMemorySyncEnabled(false);
            setMemorySync(false);
            setPrivateMemory(null);
            setMemoryEntries([]);
            setMessage('Saved account memory deleted. This browser can still remember locally.');
          } catch (error) { setMessage(error.message || 'Could not delete saved account memory.'); }
        }}>DELETE SAVED ACCOUNT MEMORY</button>}
        <div className="shared-identity"><small>YOUR CONNECTION CODE</small><code>{session.user.id}</code><button type="button" onClick={copyConnectionCode}>COPY CODE</button></div>
        <div className="shared-connections">
          <b>FIND YOUR PEOPLE</b>
          <label>Paste another visitor's connection code<input value={targetId} onChange={(event) => setTargetId(event.target.value)} placeholder="Account UUID" autoCapitalize="off" autoCorrect="off" /></label>
          <button className="shared-action" onClick={sendConnectionRequest} disabled={connectionBusy || !targetId.trim()}>SEND CONNECTION REQUEST</button>
          {connections.filter((item) => item.recipient_id === session.user.id && item.status === 'pending').length > 0 && <section><b>WAITING AT YOUR DOOR</b>
            {connections.filter((item) => item.recipient_id === session.user.id && item.status === 'pending').map((item) => <p key={item.id}><code>{item.requester_id.slice(0, 8)}…</code><span><button onClick={() => changeConnection(item.id, 'accepted')} disabled={connectionBusy}>ACCEPT</button><button onClick={() => changeConnection(item.id, 'declined')} disabled={connectionBusy}>DECLINE</button></span></p>)}
          </section>}
          {connections.filter((item) => item.requester_id === session.user.id && item.status === 'pending').length > 0 && <section><b>OUTGOING REQUESTS</b>
            {connections.filter((item) => item.requester_id === session.user.id && item.status === 'pending').map((item) => <p key={item.id}><code>{item.recipient_id.slice(0, 8)}…</code><button onClick={() => changeConnection(item.id, 'revoked')} disabled={connectionBusy}>CANCEL</button></p>)}
          </section>}
          {connections.filter((item) => item.status === 'accepted').length > 0 && <section><b>ACCEPTED CONNECTIONS</b>
            {connections.filter((item) => item.status === 'accepted').map((item) => { const otherId = item.requester_id === session.user.id ? item.recipient_id : item.requester_id; return <p key={item.id}><code>{otherId.slice(0, 8)}…</code><button onClick={() => changeConnection(item.id, 'revoked')} disabled={connectionBusy}>DISCONNECT</button></p>; })}
          </section>}
        </div>
        <label>Your name in this room<input value={displayName} maxLength={40} disabled={status === 'connected'} onChange={(event) => setDisplayName(event.target.value)} /></label>
        <label>Who can see you<select value={visibility} disabled={status === 'connected'} onChange={(event) => setVisibility(event.target.value)}>
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
