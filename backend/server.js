const express = require('express');
const cors = require('cors');
const path = require('path');
const {
  initFoundry,
  listCatalogModels,
  listCachedModels,
  isServiceRunning,
} = require('./foundry');
const {
  createClient,
  setModelId,
  setFastModel,
  setQualityModel,
  getModelConfig,
  summariseAssetEvents,
  classifyMaintenanceNote,
  chatWithContext,
} = require('./aiClient');
const {
  eventsStore,
  getEventsForAsset,
  getMaintenanceLogs,
  getChatHistory,
  listChatConversations,
  listChatConversationSummaries,
  appendChatMessage,
  deleteChatConversation,
  clearChatHistory,
} = require('./dataStore');

const app = express();
app.use(cors());
app.use(express.json());

// Serve the web frontend
const webDir = path.join(__dirname, '..', 'web');
app.use(express.static(webDir));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/assets', (_req, res) => {
  res.json({ assets: Object.keys(eventsStore) });
});

app.get('/api/assets/:id/summary', async (req, res) => {
  const assetId = req.params.id;
  const events = getEventsForAsset(assetId);
  try {
    const summary = await summariseAssetEvents(assetId, events);
    res.json({ assetId, summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI summarisation failed' });
  }
});

app.get('/api/logs', (_req, res) => {
  res.json({ logs: getMaintenanceLogs() });
});

app.post('/api/logs/classify', async (req, res) => {
  const { note } = req.body || {};
  if (!note) return res.status(400).json({ error: 'note is required' });
  try {
    const result = await classifyMaintenanceNote(note);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI classification failed' });
  }
});

app.post('/api/chat', async (req, res) => {
  const { question, assetId, conversationId } = req.body || {};
  if (!question) return res.status(400).json({ error: 'question is required' });
  const convoId = conversationId || `conv-${Date.now()}`;
  const context = {
    assetId: assetId || null,
    recentEvents: assetId ? getEventsForAsset(assetId) : [],
    recentMaintenance: getMaintenanceLogs(assetId),
    chatHistory: getChatHistory(convoId).slice(-12),
  };
  try {
    appendChatMessage(convoId, {
      role: 'user',
      content: question,
      timestamp: new Date().toISOString(),
    });
    const result = await chatWithContext(question, context);
    appendChatMessage(convoId, {
      role: 'assistant',
      content: result.answer,
      timestamp: new Date().toISOString(),
    });
    res.json({ ...result, conversationId: convoId, history: getChatHistory(convoId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI chat failed' });
  }
});

app.get('/api/chat/conversations', (_req, res) => {
  res.json({ conversations: listChatConversationSummaries() });
});

app.get('/api/chat/history', (req, res) => {
  const { conversationId } = req.query;
  if (!conversationId) return res.status(400).json({ error: 'conversationId is required' });
  res.json({ conversationId, history: getChatHistory(conversationId) });
});

app.delete('/api/chat/history/:conversationId', (req, res) => {
  const { conversationId } = req.params;
  const deleted = deleteChatConversation(conversationId);
  res.json({ conversationId, deleted });
});

app.delete('/api/chat/history', (_req, res) => {
  clearChatHistory();
  res.json({ cleared: true });
});

app.get('/api/models/catalog', async (_req, res) => {
  try {
    const models = await listCatalogModels();
    res.json({ models });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Model catalog listing failed' });
  }
});

app.get('/api/models/cached', async (_req, res) => {
  try {
    const models = await listCachedModels();
    res.json({ models });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Cached model listing failed' });
  }
});

app.get('/api/models/status', async (_req, res) => {
  try {
    const running = await isServiceRunning();
    const config = getModelConfig();
    res.json({ serviceRunning: running, ...config });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Service status check failed' });
  }
});

// Model configuration endpoints
app.get('/api/models/config', (_req, res) => {
  res.json(getModelConfig());
});

app.post('/api/models/config', (req, res) => {
  const { preferredModel } = req.body || {};
  if (preferredModel) {
    setFastModel(preferredModel);  // Just saves preference
    setQualityModel(preferredModel);
  }
  res.json({ updated: true, ...getModelConfig() });
});

async function startServer({ port = process.env.PORT || 3000, skipFoundryInit = false } = {}) {
  if (!skipFoundryInit) {
    const modelInfo = await initFoundry();
    try {
      createClient();
      if (modelInfo && modelInfo.id) {
        setModelId(modelInfo.id);
      }
    } catch (clientErr) {
      console.error('Failed to create AI client:', clientErr.message);
      // Continue anyway - client will be created on first request
    }
  }
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`Backend listening on http://localhost:${port}`);
      resolve(server);
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use.`);
        console.error(`Try: npx kill-port ${port}  OR  set PORT=3001 && npm start`);
      }
      reject(err);
    });
  });
}

if (require.main === module) {
  startServer({ skipFoundryInit: false }).catch((err) => {
    console.error('Server failed to start:', err.message);
    process.exit(1);
  });
  
  // Keep process alive and handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\nShutting down server...');
    process.exit(0);
  });
}

module.exports = { app, startServer };
