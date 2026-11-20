// Each watched TikTok username has one registry, even when several Studio accounts use it.
export function watchRegistry(env, username) {
  return env.LIVE_ALERTS.get(env.LIVE_ALERTS.idFromName(username));
}

export async function changeWatch(env, username, userId, enabled) {
  if (!env.LIVE_ALERTS || !username) return false;
  const response = await watchRegistry(env, username).fetch('https://registry/watch', {
    method: 'POST', body: JSON.stringify({username, userId, enabled})
  });
  if (!response.ok) throw Error('Could not save live alert preference');
  return (await response.json()).armed;
}

export class LiveAlerts {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.queue = Promise.resolve();
  }

  // Serialize changes across provider calls, including cleanup and delivery retries.
  run(task) {
    const result = this.queue.then(task);
    this.queue = result.catch(() => {});
    return result;
  }

  async provider(path, method = 'GET', body) {
    const response = await (this.env.ALERT_FETCH || fetch)(
      'https://api.eulerstream.com/accounts/' + this.env.EULER_ACCOUNT_ID + '/alerts/' + path,
      {method, redirect: 'manual', signal: AbortSignal.timeout(8000),
       headers: {'x-api-key': this.env.EULER_API_KEY, 'Content-Type': 'application/json'},
       body: body && JSON.stringify(body)}
    );
    const result = await response.json();
    if (method === 'DELETE' && response.status === 404) return {};
    if (!response.ok || result.code !== 200) throw Error('Euler alert operation failed');
    return result;
  }

  async reconcile(record) {
    const save = () => this.state.storage.put('watch', record);
    if (record.users.length) {
      if (record.armed || record.retryAfter > Date.now()) return;
      if (!record.alertId) {
        const {alerts} = await this.provider('list');
        let alert = alerts.find(a => a.alert_creator_username?.toLowerCase() === record.username);
        if (!alert) {
          alert = (await this.provider('create', 'PUT', {unique_id: record.username})).alert;
          record.owned = true;
        }
        record.alertId = alert.id;
        await save();
      }
      const url = this.env.LIVE_ALERT_ORIGIN + '/api/v1/live-start/' + record.username + '/' + record.secret;
      const base = record.alertId + '/targets/';
      const {targets} = await this.provider(base + 'list');
      const target = targets.find(t => t.url === url) ||
        (await this.provider(base + 'create', 'PUT', {url})).target;
      record.targetId = target.id;
      record.armed = true;
      record.retryAfter = 0;
      await save();
    } else {
      if (record.alertId) {
        const base = record.alertId + '/targets/';
        const {targets} = await this.provider(base + 'list');
        const url = this.env.LIVE_ALERT_ORIGIN + '/api/v1/live-start/' + record.username + '/' + record.secret;
        const ours = targets.find(t => t.url === url);
        if (ours) await this.provider(base + ours.id + '/delete', 'DELETE');
        if (record.owned && targets.every(t => t.id === ours?.id))
          await this.provider(record.alertId + '/delete', 'DELETE');
      }
      await this.state.storage.delete('watch');
      await this.state.storage.deleteAlarm();
    }
  }

  async sync(record) {
    try { await this.reconcile(record); }
    catch {
      // A full plan must never turn into a polling loop. Retry provisioning on later demand.
      record.retryAfter = Date.now() + 3600000;
      await this.state.storage.put('watch', record);
      if (!record.users.length) await this.state.storage.setAlarm(record.retryAfter);
      console.warn('LIVE alert registration or cleanup unavailable');
    }
  }

  async alarm() {
    return this.run(async () => {
      const record = await this.state.storage.get('watch');
      if (record && !record.users.length) await this.sync(record);
    });
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/watch') return this.run(async () => {
      const {username,userId,enabled} = await request.json();
      const record = await this.state.storage.get('watch') ||
        {username, users: [], secret: crypto.randomUUID(), armed: false};
      const members = new Set(record.users);
      if (enabled) members.add(userId);
      else members.delete(userId);
      record.users = [...members];
      await this.state.storage.put('watch', record);
      await this.sync(record);
      return Response.json({armed: enabled && record.armed});
    });
    const record = await this.state.storage.get('watch');
    if (!record?.armed || path !== '/signal/' + record.secret) return new Response(null, {status:404});
    // The private target is unique to this username. Payload fields cannot select an account.
    await Promise.all(record.users.map(async userId => {
      const hub = this.env.CREATOR_LIVE.get(this.env.CREATOR_LIVE.idFromName(userId));
      const response = await hub.fetch('https://creator-live/live-start', {
        method:'POST',body:JSON.stringify({username:record.username})
      });
      if (!response.ok) throw Error('Could not deliver live start');
    }));
    return new Response(null, {status:204});
  }
}
