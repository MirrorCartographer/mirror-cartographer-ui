import { createClient } from '@supabase/supabase-js';

let client = null;

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
