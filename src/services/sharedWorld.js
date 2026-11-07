import { createClient } from '@supabase/supabase-js';

let client = null;
const PRIVATE_MEMORY_CONSENT_KEY = 'mc-private-memory-sync-consent-v1';

export function hasPrivateMemoryConsent() {
  try { return localStorage.getItem(PRIVATE_MEMORY_CONSENT_KEY) === 'yes'; } catch { return false; }
}

export function setPrivateMemoryConsent(enabled) {
  try {
    if (enabled) localStorage.setItem(PRIVATE_MEMORY_CONSENT_KEY, 'yes');
    else localStorage.removeItem(PRIVATE_MEMORY_CONSENT_KEY);
  } catch {}
  window.dispatchEvent(new CustomEvent('mc-private-memory-consent-change', { detail: { enabled: Boolean(enabled) } }));
}

const PRIVATE_MEMORY_SYNC_KEY = 'mc-private-memory-sync-enabled';

export function isPrivateMemorySyncEnabled() {
  try { return window.localStorage.getItem(PRIVATE_MEMORY_SYNC_KEY) === 'true'; }
  catch { return false; }
}

export function setPrivateMemorySyncEnabled(enabled) {
  try {
    if (enabled) window.localStorage.setItem(PRIVATE_MEMORY_SYNC_KEY, 'true');
    else window.localStorage.removeItem(PRIVATE_MEMORY_SYNC_KEY);
    window.dispatchEvent(new Event('mc-private-memory-sync-change'));
  } catch {
    throw new Error('This browser could not save the private-memory preference.');
  }
}

export function sharedWorldConfigured(env = import.meta.env) {
  return Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY);
}

export function getSharedWorldClient() {
  if (!sharedWorldConfigured()) return null;
  if (!client) {
    client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 5 } }
    });
  }
  return client;
}

export async function requestSharedWorldLink(email) {
  const supabase = getSharedWorldClient();
  if (!supabase) throw new Error('The shared-world connection is not configured yet.');
  const address = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error('Enter a valid email address.');
  const { error } = await supabase.auth.signInWithOtp({
    email: address,
    options: { emailRedirectTo: window.location.href }
  });
  if (error) throw error;
  return true;
}

export async function getSharedWorldSession() {
  const supabase = getSharedWorldClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

async function requireSharedWorldUser() {
  const supabase = getSharedWorldClient();
  if (!supabase) throw new Error('Shared world is not configured.');
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.user) throw new Error('Sign in before managing connections.');
  return { supabase, user: data.session.user };
}

export async function listWorldConnections() {
  const { supabase, user } = await requireSharedWorldUser();
  const { data, error } = await supabase.from('world_connections')
    .select('id,requester_id,recipient_id,status,created_at,updated_at')
    .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function requestWorldConnection(recipientId) {
  const { supabase, user } = await requireSharedWorldUser();
  const target = String(recipientId || '').trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(target)) {
    throw new Error('Connection codes must be valid account IDs.');
  }
  if (target === user.id.toLowerCase()) throw new Error('You cannot connect to yourself.');
  const { data, error } = await supabase.from('world_connections')
    .insert({ requester_id: user.id, recipient_id: target, status: 'pending' })
    .select('id,requester_id,recipient_id,status,created_at,updated_at')
    .single();
  if (error) throw error;
  return data;
}

export async function transitionWorldConnection(connectionId, status) {
  const { supabase } = await requireSharedWorldUser();
  if (!['accepted', 'declined', 'revoked'].includes(status)) throw new Error('Unsupported connection action.');
  const { data, error } = await supabase.from('world_connections')
    .update({ status })
    .eq('id', connectionId)
    .select('id,requester_id,recipient_id,status,created_at,updated_at')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('That connection is no longer available for this action.');
  return data;
}

export async function enterSharedPresence({ roomId = 'the-between', displayName = 'Wanderer', visibility = 'private', onChange = () => {} } = {}) {
  const supabase = getSharedWorldClient();
  if (!supabase) throw new Error('Shared world is not configured.');
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user;
  if (!user) throw new Error('Sign in before entering the shared world.');

  const safeName = String(displayName || 'Wanderer').trim().slice(0, 40) || 'Wanderer';
  const safeRoom = String(roomId).replace(/[^a-z0-9-]/gi, '-').slice(0, 80);
  const writePresence = async (activityState = 'present') => {
    const now = Date.now();
    const { error } = await supabase.from('world_presence').upsert({
      user_id: user.id,
      display_name: safeName,
      room_id: safeRoom,
      activity_state: activityState,
      visibility,
      last_seen_at: new Date(now).toISOString(),
      expires_at: new Date(now + 90000).toISOString()
    }, { onConflict: 'user_id' });
    if (error) throw error;
  };
  const refresh = async () => {
    const { data, error } = await supabase.from('world_presence')
      .select('user_id,display_name,room_id,activity_state,visibility,last_seen_at,expires_at')
      .eq('room_id', safeRoom)
      .gt('expires_at', new Date().toISOString())
      .order('last_seen_at', { ascending: false })
      .limit(40);
    if (error) throw error;
    onChange({ status: 'connected', people: (data || []).filter((person) => person.user_id !== user.id) });
  };

  await writePresence();
  await refresh();
  const channel = supabase.channel(`world-presence:${safeRoom}`);
  channel.on('postgres_changes', {
    event: '*', schema: 'public', table: 'world_presence', filter: `room_id=eq.${safeRoom}`
  }, () => { refresh().catch((error) => onChange({ status: 'error', error: error.message })); });
  channel.subscribe((status, error) => {
    if (status === 'SUBSCRIBED') refresh().catch((failure) => onChange({ status: 'error', error: failure.message }));
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onChange({ status: 'error', error: error?.message || status });
  });

  const heartbeat = window.setInterval(() => {
    const hidden = document.visibilityState === 'hidden';
    writePresence(hidden ? 'away' : 'present').then(refresh).catch((error) => onChange({ status: 'error', error: error.message }));
  }, 30000);
  const onVisibility = () => {
    writePresence(document.visibilityState === 'hidden' ? 'away' : 'present')
      .then(refresh).catch((error) => onChange({ status: 'error', error: error.message }));
  };
  document.addEventListener('visibilitychange', onVisibility);

  let stopped = false;
  return async () => {
    if (stopped) return;
    stopped = true;
    window.clearInterval(heartbeat);
    document.removeEventListener('visibilitychange', onVisibility);
    await supabase.removeChannel(channel);
    await supabase.from('world_presence').delete().eq('user_id', user.id);
    onChange({ status: 'left', people: [] });
  };
}

export async function loadPrivateContinuity() {
  if (!hasPrivateMemoryConsent()) return null;
  const supabase = getSharedWorldClient();
  if (!supabase) return null;
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user;
  if (!user) return null;
  const { data, error } = await supabase.from('continuity_records')
    .select('content')
    .eq('id', user.id)
    .eq('owner_id', user.id)
    .eq('collection', 'settings')
    .maybeSingle();
  if (error) throw error;
  return data?.content || null;
}

export async function savePrivateContinuity(memory = {}) {
  if (!hasPrivateMemoryConsent()) return false;
  const supabase = getSharedWorldClient();
  if (!supabase) return false;
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user;
  if (!user) return false;
  const content = {
    visits: Number.isFinite(memory.visits) ? Math.max(0, Math.min(100000, memory.visits)) : 0,
    trust: Number.isFinite(memory.trust) ? Math.max(0, Math.min(8, memory.trust)) : 0,
    choices: Array.isArray(memory.choices) ? memory.choices.slice(-12).map((item) => String(item).slice(0, 80)) : [],
    lastEvent: typeof memory.lastEvent === 'string' ? memory.lastEvent.slice(0, 80) : ''
  };
  const { error } = await supabase.from('continuity_records').upsert({
    id: user.id,
    owner_id: user.id,
    collection: 'settings',
    title: 'The Between — private memory',
    content,
    privacy: 'private',
    source: 'living-world',
    tags: ['living-world', 'mirror-memory']
  }, { onConflict: 'id,owner_id' });
  if (error) throw error;
  return true;
}


export async function askResident(resident, message) {
  const { supabase, user } = await requireSharedWorldUser();
  const character = String(resident || '').toLowerCase();
  if (!['tazar', 'jello'].includes(character)) throw new Error('Unknown resident.');
  const text = String(message || '').trim();
  if (!text || text.length > 1200) throw new Error('Keep your message between 1 and 1,200 characters.');
  const { data, error } = await supabase.functions.invoke('resident-dialogue', {
    body: { resident: character, message: text, includeMemory: hasPrivateMemoryConsent() }
  });
  if (error) throw error;
  if (!data?.reply || typeof data.reply !== 'string') throw new Error('The resident could not find a reply.');
  return data.reply.slice(0, 1400);
}

export async function deletePrivateContinuity() {
  const { supabase, user } = await requireSharedWorldUser();
  const { error } = await supabase.from('continuity_records')
    .delete().eq('id', user.id).eq('owner_id', user.id).eq('collection', 'settings');
  if (error) throw error;
  return true;
}
