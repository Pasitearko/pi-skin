import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { createJiti } from 'jiti';

const root = process.env.PI_MCP_ADAPTER_DIR;
if (!root) throw new Error('Set PI_MCP_ADAPTER_DIR to an isolated, patched pi-mcp-adapter 5.3.2 installation');
const jiti = createJiti(import.meta.url, { fsCache: false });
const { buildHostHtmlTemplate } = await jiti.import(`${root}/host-html-template.ts`);
const { startUiServer } = await jiti.import(`${root}/ui-server.ts`);
const prefix = 'immersiveTranslate-messager-frame-bridge#';
const verbs = ['registerSubscriber', 'unregisterSubscriber', 'sendMessage', 'deliverMessage'];
const resource = { uri: 'ui://local-regression-test', html: '<p>Local test</p>', meta: {} };

function browserHandler() {
  const html = buildHostHtmlTemplate({
    sessionToken: 'local-test', serverName: 'test', toolName: 'test', toolArgs: {}, resource,
    allowAttribute: '', requireToolConsent: false, cacheToolConsent: false,
    sandboxProxyUrl: 'http://localhost:9999/sandbox',
  });
  const start = html.indexOf('window.addEventListener("message", async (event) => {');
  const end = html.indexOf('bridge.ondownloadfile', start);
  assert.ok(start >= 0 && end > start, 'locate the actual rendered browser ingress handler');
  const posts = [];
  const frameWindow = {};
  let handler;
  vm.runInNewContext(html.slice(start, end), {
    iframe: { contentWindow: frameWindow },
    sandboxProxyOrigin: 'http://localhost:9999',
    window: { addEventListener: (name, callback) => { assert.equal(name, 'message'); handler = callback; } },
    post: async (url, params) => { posts.push(JSON.parse(JSON.stringify({ url, params }))); },
  });
  return {
    posts,
    dispatch: (data, extra = {}) => handler({ source: frameWindow, origin: 'http://localhost:9999', data, ...extra }),
  };
}

for (const verb of verbs) {
  test(`browser drops extension bridge ${verb}`, async () => {
    const h = browserHandler();
    await h.dispatch({ type: `${prefix}ask#${verb}`, payload: {} });
    await h.dispatch({ type: `${prefix}response#${verb}`, payload: { text: 'not a user prompt' } });
    assert.equal(h.posts.length, 0);
  });
}

for (const data of [
  { type: 'prompt', prompt: 'Please review this issue' },
  { type: 'intent', intent: 'issue_submitted', params: { number: 123 } },
  { type: 'notify', message: 'Saved draft' },
  { type: 'message', message: 'Hello' },
  { type: 'issue_submitted', payload: { number: 123 } },
]) {
  test(`browser preserves legitimate ${data.type} messages`, async () => {
    const h = browserHandler();
    await h.dispatch(data);
    assert.equal(h.posts.length, 1);
    assert.equal(h.posts[0].url, '/proxy/ui/message');
    assert.equal(h.posts[0].params.type, data.type === 'issue_submitted' ? 'intent' : data.type);
    if (data.type === 'issue_submitted') assert.equal(h.posts[0].params.intent, 'issue_submitted');
  });
}

test('browser retains existing source, origin, protocol, and lifecycle guards', async () => {
  const h = browserHandler();
  await h.dispatch({ type: 'prompt', prompt: 'wrong source' }, { source: {} });
  await h.dispatch({ type: 'prompt', prompt: 'wrong origin' }, { origin: 'https://untrusted.invalid' });
  await h.dispatch({ jsonrpc: '2.0', method: 'ui/message', type: 'prompt' });
  await h.dispatch({ type: 'ui-lifecycle-ready' });
  await h.dispatch({ type: 'ui-message-ack' });
  await h.dispatch(null);
  assert.equal(h.posts.length, 0);
});

test('HTTP ingress drops raw and already-forwarded extension traffic without storing or triggering turns', async () => {
  const callbacks = [];
  const server = await startUiServer({
    serverName: 'test', toolName: 'test', toolArgs: {}, resource, port: 0,
    manager: { getConnection: () => undefined },
    consentManager: { requiresPrompt: () => false, shouldCacheConsent: () => false },
    onMessage: (params) => callbacks.push(params),
  });
  const send = async (params, token = server.sessionToken) => {
    const res = await fetch(new URL('/proxy/ui/message', server.url), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, params }),
    });
    return { status: res.status, body: await res.json() };
  };
  try {
    for (const verb of verbs) {
      for (const params of [
        { type: 'intent', intent: `${prefix}ask#${verb}`, params: {} },
        { type: `${prefix}ask#${verb}`, payload: {} },
        { type: 'prompt', intent: `${prefix}ask#${verb}`, prompt: 'extension text' },
      ]) {
        const res = await send(params);
        assert.equal(res.status, 200);
      }
    }
    assert.equal(callbacks.length, 0, 'no agent callback for extension events');
    assert.equal(server.getSessionMessages().intents.length, 0, 'no extension intents retained');
    assert.equal(server.getSessionMessages().prompts.length, 0);

    const prompt = { type: 'prompt', prompt: 'Review my issue' };
    const intent = { type: 'intent', intent: 'issue_submitted', params: { number: 123 } };
    const notify = { type: 'notify', message: 'Draft saved' };
    for (const params of [prompt, intent, notify]) assert.equal((await send(params)).status, 200);
    assert.deepEqual(callbacks, [prompt, intent, notify]);
    assert.deepEqual(server.getSessionMessages().prompts, ['Review my issue']);
    assert.deepEqual(server.getSessionMessages().intents, [{ intent: 'issue_submitted', params: { number: 123 } }]);
    assert.deepEqual(server.getSessionMessages().notifications, ['Draft saved']);
    assert.notEqual((await send(prompt, 'invalid-token')).status, 200, 'existing capability validation remains intact');
  } finally {
    server.close('local-regression-test-complete');
  }
});
