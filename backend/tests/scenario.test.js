const test = require('node:test');
const assert = require('node:assert/strict');

const { startServer } = require('../server');
const { appendChatMessage, getChatHistory } = require('../dataStore');

let server;
let baseUrl;

test.before(async () => {
  server = await startServer({ port: 0, skipFoundryInit: true });
  const { port } = server.address();
  baseUrl = `http://localhost:${port}/api`;
});

test.after(() => {
  server.close();
});

test('scenario assets are present', async () => {
  const res = await fetch(`${baseUrl}/assets`);
  const data = await res.json();
  // Verify industrial equipment IDs
  assert.ok(data.assets.includes('PUMP-L1-H01'), 'Expected hydraulic pump asset');
  assert.ok(data.assets.includes('CNC-L2-M03'), 'Expected CNC machine asset');
});

test('scenario logs include industrial maintenance notes', async () => {
  const res = await fetch(`${baseUrl}/logs`);
  const data = await res.json();
  const notes = data.logs.map((l) => l.note).join(' | ');
  // Verify realistic industrial maintenance terms
  assert.match(notes, /hydraulic|pump|vibration/i, 'Expected hydraulic/pump/vibration maintenance note');
  assert.match(notes, /temperature|thermal|hot/i, 'Expected thermal-related maintenance note');
});

test('conversation delete removes history', async () => {
  const conversationId = 'conv-test-001';
  appendChatMessage(conversationId, {
    role: 'user',
    content: 'Test message',
    timestamp: new Date().toISOString(),
  });
  const res = await fetch(`${baseUrl}/chat/history/${conversationId}`, { method: 'DELETE' });
  const data = await res.json();
  assert.equal(data.deleted, true);
  assert.deepEqual(getChatHistory(conversationId), []);
});
