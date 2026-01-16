const OpenAI = require('openai');
const { getServiceConfig } = require('./foundry');
const { summarisePrompt, classifyPrompt, chatPrompt } = require('./prompts');

let client;

function createClient() {
  const cfg = getServiceConfig();
  client = new OpenAI({ baseURL: cfg.baseURL, apiKey: cfg.apiKey });
}

function safeJsonParse(text) {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    const jsonText = text.slice(start, end + 1);
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

let modelId = null;

function setModelId(id) {
  modelId = id;
}

async function callModel(prompt, options = {}) {
  if (!client) createClient();
  const cfg = getServiceConfig();
  // Use the currently loaded model for all requests
  const model = modelId || cfg.modelId || 'phi-3.5-mini';
  
  const response = await client.chat.completions.create({
    model: model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: options.maxTokens || 512,
    temperature: options.temperature || 0.7,
  });
  return response.choices[0].message.content || '';
}

// Selected model preference (for display purposes)
// Note: Foundry Local can only load ONE model at a time per service instance
// To use a different model, you need to restart with a different model loaded
let SELECTED_MODEL = process.env.FOUNDRY_MODEL_ALIAS || null;

function setFastModel(model) {
  // Note: This only updates the preference, actual model change requires service restart
  SELECTED_MODEL = model;
  console.log(`Model preference set to: ${model} (requires service restart to take effect)`);
}

function setQualityModel(model) {
  // Note: This only updates the preference, actual model change requires service restart
  SELECTED_MODEL = model;
  console.log(`Model preference set to: ${model} (requires service restart to take effect)`);
}

function getModelConfig() {
  return {
    loadedModel: modelId,
    selectedModel: SELECTED_MODEL || modelId,
    note: 'Foundry Local loads ONE model at a time. To switch models, restart with: foundry model run <model-alias>',
  };
}

function validateSummary(obj) {
  const allowed = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  if (!obj || typeof obj.summary !== 'string') return null;
  if (!allowed.includes(obj.riskLevel)) return null;
  if (!Array.isArray(obj.keyIncidents)) return null;
  return obj;
}

function validateClassification(obj) {
  const allowed = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  if (!obj || !allowed.includes(obj.priority)) return null;
  if (typeof obj.recommendedAction !== 'string') return null;
  if (typeof obj.rationale !== 'string') return null;
  return obj;
}

async function summariseAssetEvents(assetId, events) {
  const raw = await callModel(summarisePrompt(assetId, events), { 
    maxTokens: 512,
    temperature: 0.5 
  });
  const parsed = safeJsonParse(raw);
  const validated = validateSummary(parsed);
  if (!validated) {
    return {
      summary: 'Unable to parse model output. Treat as LOW risk and review manually.',
      riskLevel: 'LOW',
      keyIncidents: [],
      _raw: raw,
    };
  }
  return validated;
}

async function classifyMaintenanceNote(note) {
  const raw = await callModel(classifyPrompt(note), { 
    maxTokens: 256,
    temperature: 0.3 
  });
  const parsed = safeJsonParse(raw);
  const validated = validateClassification(parsed);
  if (!validated) {
    return {
      priority: 'MEDIUM',
      recommendedAction: 'Review note manually and schedule inspection.',
      rationale: 'Model output did not match expected schema.',
      _raw: raw,
    };
  }
  return validated;
}

async function chatWithContext(question, context) {
  const raw = await callModel(chatPrompt(question, context), { 
    maxTokens: 768,
    temperature: 0.7 
  });
  return { answer: raw };
}

module.exports = {
  createClient,
  setModelId,
  setFastModel,
  setQualityModel,
  getModelConfig,
  summariseAssetEvents,
  classifyMaintenanceNote,
  chatWithContext,
};
