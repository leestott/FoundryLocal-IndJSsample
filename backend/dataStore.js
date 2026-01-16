const fs = require('fs');
const path = require('path');

const sampleDataPath = path.join(__dirname, '..', 'data', 'sample-data.json');
const chatHistoryPath = path.join(__dirname, '..', 'data', 'chat-history.json');

function readJsonSafe(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJsonSafe(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

const sampleData = readJsonSafe(sampleDataPath, { events: {}, maintenanceLogs: [] });
const eventsStore = sampleData.events || {};
const maintenanceLogs = sampleData.maintenanceLogs || [];

function ensureChatHistoryFile() {
  const exists = fs.existsSync(chatHistoryPath);
  if (!exists) writeJsonSafe(chatHistoryPath, { conversations: {} });
}

function getChatHistoryData() {
  ensureChatHistoryFile();
  return readJsonSafe(chatHistoryPath, { conversations: {} });
}

function saveChatHistoryData(data) {
  writeJsonSafe(chatHistoryPath, data);
}

function getEventsForAsset(assetId) {
  return eventsStore[assetId] || [];
}

function getMaintenanceLogs(assetId) {
  if (!assetId) return maintenanceLogs;
  return maintenanceLogs.filter((log) => log.assetId === assetId);
}

function getChatHistory(conversationId) {
  const data = getChatHistoryData();
  return data.conversations[conversationId] || [];
}

function listChatConversations() {
  const data = getChatHistoryData();
  return Object.keys(data.conversations);
}

function listChatConversationSummaries() {
  const data = getChatHistoryData();
  return Object.entries(data.conversations).map(([id, messages]) => {
    const last = messages[messages.length - 1];
    return {
      id,
      messageCount: messages.length,
      lastMessageAt: last ? last.timestamp : null,
    };
  });
}

function appendChatMessage(conversationId, message) {
  const data = getChatHistoryData();
  if (!data.conversations[conversationId]) {
    data.conversations[conversationId] = [];
  }
  data.conversations[conversationId].push(message);
  saveChatHistoryData(data);
}

function deleteChatConversation(conversationId) {
  const data = getChatHistoryData();
  if (!data.conversations[conversationId]) return false;
  delete data.conversations[conversationId];
  saveChatHistoryData(data);
  return true;
}

function clearChatHistory() {
  saveChatHistoryData({ conversations: {} });
}

module.exports = {
  eventsStore,
  maintenanceLogs,
  getEventsForAsset,
  getMaintenanceLogs,
  getChatHistory,
  listChatConversations,
  listChatConversationSummaries,
  appendChatMessage,
  deleteChatConversation,
  clearChatHistory,
};
