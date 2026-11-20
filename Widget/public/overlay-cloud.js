(function initializeOverlayCloud(global) {
  'use strict';

  const sessionStorageKey = 'reward-overlay-cloud-session:v1';
  const config = global.overlayCloudConfig || {};

  class OverlayCloudClient {
    constructor(options = {}) {
      this.apiBaseUrl = String(options.apiBaseUrl || '').replace(/\/+$/, '');
      this.appBaseUrl = String(options.appBaseUrl || '').replace(/\/+$/, '');
      this.outputBaseUrl = String(options.outputBaseUrl || '').replace(/\/+$/, '');
      this.session = this.readSession();
    }

    get enabled() {
      return /^https?:\/\//i.test(this.apiBaseUrl);
    }

    get signedIn() {
      return Boolean(this.session?.token);
    }

    readSession() {
      try {
        const current = global.sessionStorage?.getItem(sessionStorageKey);
        if (current) return JSON.parse(current);
        const legacy = global.localStorage?.getItem(sessionStorageKey);
        if (!legacy) return null;
        global.sessionStorage?.setItem(sessionStorageKey, legacy);
        global.localStorage?.removeItem(sessionStorageKey);
        return JSON.parse(legacy);
      } catch {
        return null;
      }
    }

    saveSession(session) {
      this.session = session || null;
      if (this.session) {
        global.sessionStorage?.setItem(sessionStorageKey, JSON.stringify(this.session));
        global.localStorage?.removeItem(sessionStorageKey);
      } else {
        global.sessionStorage?.removeItem(sessionStorageKey);
        global.localStorage?.removeItem(sessionStorageKey);
      }
      global.dispatchEvent(new CustomEvent('overlaycloud:session', { detail: this.session }));
    }

    async request(path, options = {}) {
      if (!this.enabled) {
        throw new Error('Cloud API is not configured');
      }

      const headers = new Headers(options.headers || {});
      if (options.body !== undefined && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
      }
      if (options.auth !== false && this.session?.token) {
        headers.set('Authorization', `Bearer ${this.session.token}`);
      }

      const response = await fetch(`${this.apiBaseUrl}${path}`, {
        method: options.method || 'GET',
        signal: options.signal,
        headers,
        body: options.body === undefined || options.body instanceof FormData
          ? options.body
          : JSON.stringify(options.body)
      });

      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await response.json()
        : { message: await response.text() };

      if (!response.ok) {
        if (response.status === 401 && options.auth !== false) {
          this.saveSession(null);
        }
        const error = new Error(payload.error || payload.message || `Request failed (${response.status})`);
        error.status = response.status;
        throw error;
      }

      return payload;
    }

    async register(email, password) {
      const result = await this.request('/v1/auth/register', {
        method: 'POST',
        auth: false,
        body: { email, password }
      });
      if (result.session) this.saveSession(result.session);
      return result;
    }

    async login(email, password) {
      const result = await this.request('/v1/auth/login', {
        method: 'POST',
        auth: false,
        body: { email, password }
      });
      this.saveSession(result.session);
      return result;
    }

    async logout() {
      try {
        if (this.signedIn) {
          await this.request('/v1/auth/logout', { method: 'POST' });
        }
      } finally {
        this.saveSession(null);
      }
    }

    me() {
      return this.request('/v1/me', { signal: global.AbortSignal?.timeout?.(12000) });
    }

    getServiceConfig() {
      return this.request('/v1/config', { auth: false });
    }

    exportAccount() {
      return this.request('/v1/account/export');
    }

    updateAccountEmail(email, password) {
      return this.request('/v1/account/email', { method: 'PUT', body: { email, password } });
    }

    async deleteAccount(password, confirmation) {
      const result = await this.request('/v1/account', { method: 'DELETE', body: { password, confirmation } });
      this.saveSession(null);
      return result;
    }

    clearLocalOverlayData() {
      const prefixes = ['reward-', 'tiktok-'];
      const removed = [];
      for (let index = global.localStorage.length - 1; index >= 0; index -= 1) {
        const key = global.localStorage.key(index);
        if (key && prefixes.some(prefix => key.startsWith(prefix))) {
          global.localStorage.removeItem(key);
          removed.push(key);
        }
      }
      return removed;
    }

    listVariants() {
      return this.request('/v1/variants');
    }

    createVariant(input) {
      return this.request('/v1/variants', { method: 'POST', body: input });
    }

    updateVariant(id, input) {
      return this.request(`/v1/variants/${encodeURIComponent(id)}`, { method: 'PUT', body: input });
    }

    deleteVariant(id) {
      return this.request(`/v1/variants/${encodeURIComponent(id)}`, { method: 'DELETE' });
    }

    listVariantRevisions(id) {
      return this.request(`/v1/variants/${encodeURIComponent(id)}/revisions`);
    }

    getVariantRevision(id, revision) { return this.request(`/v1/variants/${encodeURIComponent(id)}/revisions/${encodeURIComponent(revision)}`); }

    restoreVariantRevision(id, revision, expectedRevision) {
      return this.request(`/v1/variants/${encodeURIComponent(id)}/revisions/${encodeURIComponent(revision)}/restore`, {
        method: 'POST',body:expectedRevision===undefined?undefined:{expectedRevision}
      });
    }

    getDirectLink(id) {
      return this.request('/v1/variants/' + encodeURIComponent(id) + '/direct-link', { method: 'POST' });
    }

    restoreDockLayout(id,input) { return this.request(`/v1/docks/${encodeURIComponent(id)}/layout`,{method:'PUT',body:input}); }

    listDocks() {
      return this.request('/v1/docks');
    }

    createDock(input) {
      return this.request('/v1/docks', { method: 'POST', body: input });
    }

    updateDock(id, input) {
      return this.request(`/v1/docks/${encodeURIComponent(id)}`, { method: 'PUT', body: input });
    }

    deleteDock(id) {
      return this.request(`/v1/docks/${encodeURIComponent(id)}`, { method: 'DELETE' });
    }

    rotateDockToken(id) {
      return this.request(`/v1/docks/${encodeURIComponent(id)}/rotate-token`, { method: 'POST' });
    }

    createDockItem(dockId, input) {
      return this.request(`/v1/docks/${encodeURIComponent(dockId)}/items`, { method: 'POST', body: input });
    }

    updateDockItem(dockId, itemId, input) {
      return this.request(`/v1/docks/${encodeURIComponent(dockId)}/items/${encodeURIComponent(itemId)}`, { method: 'PUT', body: input });
    }

    deleteDockItem(dockId, itemId) {
      return this.request(`/v1/docks/${encodeURIComponent(dockId)}/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
    }

    getPublicDock(token) {
      return this.request(`/v1/public/docks/${encodeURIComponent(token)}`, { auth: false });
    }

    getWidgetUrl(token) {
      return new URL('/widget/' + encodeURIComponent(token), this.apiBaseUrl).href;
    }

    getDockUrl(token) {
      if (this.outputBaseUrl) return `${this.outputBaseUrl}/${encodeURIComponent(token)}`;
      const configuredBase = this.appBaseUrl || new URL('.', global.location.href).toString().replace(/\/$/, '');
      return `${configuredBase}/index-dock.html?dock=${encodeURIComponent(token)}`;
    }

    subscribeDock(token, callbacks = {}) {
      let socket;
      let reconnectTimer;
      let pollTimer;
      let stopped = false;
      let lastRevision = '';

      const notifyStatus = status => callbacks.onStatus?.(status);
      const poll = async () => {
        if (stopped) return;
        try {
          const payload = await this.getPublicDock(token);
          const itemRevisions = (payload.items || []).map(item => `${item.id}:${item.variant?.revision || 0}:${item.updatedAt || ''}`).join('|');
          const nextRevision = `${payload.dock?.updatedAt || ''}:${itemRevisions}`;
          if (lastRevision && nextRevision !== lastRevision) {
            callbacks.onChange?.({ type: 'dock.updated', ...payload });
          }
          lastRevision = nextRevision;
          notifyStatus('polling');
        } catch (error) {
          callbacks.onError?.(error);
        } finally {
          if (!stopped) pollTimer = global.setTimeout(poll, 5000);
        }
      };

      const connect = () => {
        if (stopped) return;
        const liveUrl = new URL(`${this.apiBaseUrl}/v1/public/docks/${encodeURIComponent(token)}/live`);
        liveUrl.protocol = liveUrl.protocol === 'https:' ? 'wss:' : 'ws:';

        try {
          socket = new WebSocket(liveUrl);
        } catch {
          poll();
          return;
        }

        socket.addEventListener('open', () => notifyStatus('connected'));
        socket.addEventListener('message', event => {
          try {
            callbacks.onChange?.(JSON.parse(event.data));
          } catch {
            // Ignore malformed notification frames and wait for the next revision.
          }
        });
        socket.addEventListener('error', error => callbacks.onError?.(error));
        socket.addEventListener('close', () => {
          notifyStatus('reconnecting');
          if (!stopped) reconnectTimer = global.setTimeout(connect, 1500);
        });
      };

      connect();

      return () => {
        stopped = true;
        global.clearTimeout(reconnectTimer);
        global.clearTimeout(pollTimer);
        socket?.close();
      };
    }
  }

  global.OverlayCloudClient = OverlayCloudClient;
  global.overlayCloud = new OverlayCloudClient(config);
})(window);
