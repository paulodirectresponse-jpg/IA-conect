import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock } = vi.hoisted(() => ({
  authMock: {
    currentUser: null as any,
    authStateReady: vi.fn<() => Promise<void>>(),
  },
}));

vi.mock('../config/firebase.js', () => ({ auth: authMock }));

import { apiRequest, clearApiCache } from './apiClient.js';

describe('apiClient authentication readiness', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearApiCache();
    authMock.currentUser = null;
    authMock.authStateReady.mockReset().mockResolvedValue(undefined);
    fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('waits for persisted auth before sending the protected request', async () => {
    let resolveAuth!: () => void;
    authMock.authStateReady.mockImplementation(() => new Promise<void>((resolve) => {
      resolveAuth = resolve;
    }));
    const user = { getIdToken: vi.fn().mockResolvedValue('test-id-token') };

    const request = apiRequest('/api/catalog/models', { signal: new AbortController().signal });
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();

    authMock.currentUser = user;
    resolveAuth();
    await expect(request).resolves.toEqual([]);

    expect(user.getIdToken).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-id-token');
  });

  it('reports token acquisition failures without sending an unauthenticated request', async () => {
    authMock.currentUser = { getIdToken: vi.fn().mockRejectedValue(new Error('token unavailable')) };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(apiRequest('/api/catalog/models', { signal: new AbortController().signal }))
      .rejects.toMatchObject({ code: 'AUTH_TOKEN_UNAVAILABLE', status: 401 });

    expect(fetchMock).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
