const { FoundryLocalManager } = require('foundry-local-sdk');

const MODEL_ALIAS = process.env.FOUNDRY_MODEL_ALIAS || 'phi-3.5-mini';
const DEFAULT_FOUNDRY_PORT = 5273;

const manager = new FoundryLocalManager();
let loadedModelInfo = null;
let serviceUrl = null;  // Base URL without /v1

async function findRunningService() {
  // Check common ports for Foundry Local service
  const portsToTry = [DEFAULT_FOUNDRY_PORT, 53018, 8080];
  for (const port of portsToTry) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/openai/status`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        if (data.endpoints && data.endpoints.length > 0) {
          return data.endpoints[0];
        }
        return `http://127.0.0.1:${port}`;
      }
    } catch {
      // port not responding, try next
    }
  }
  return null;
}

async function initFoundry() {
  console.log('Initializing Foundry Local...');
  
  // First check if service is already running
  serviceUrl = await findRunningService();
  
  if (serviceUrl) {
    console.log(`Found running Foundry Local service at ${serviceUrl}`);
    // Service already running - use direct API instead of SDK init (which may timeout)
    return await initViaDirectApi();
  }
  
  // Service not running - try SDK init (will start service)
  try {
    loadedModelInfo = await manager.init(MODEL_ALIAS);
    // manager.endpoint already includes /v1, extract base serviceUrl
    serviceUrl = manager.serviceUrl;
    console.log('Foundry Local model loaded via SDK:', loadedModelInfo.alias || loadedModelInfo.id);
    return loadedModelInfo;
  } catch (err) {
    console.error('SDK init failed:', err.message);
    // Check if service started despite error
    serviceUrl = await findRunningService();
    if (serviceUrl) {
      return await initViaDirectApi();
    }
    throw err;
  }
}

async function initViaDirectApi() {
  console.log('Initializing model via direct API...');
  
  // Try to load model via the load endpoint (per SDK source: /openai/load/{modelId})
  try {
    const loadRes = await fetch(`${serviceUrl}/openai/load/${encodeURIComponent(MODEL_ALIAS)}`, {
      method: 'GET',
    });
    if (loadRes.ok) {
      console.log('Model load initiated');
    }
  } catch (loadErr) {
    console.warn('Model load request note:', loadErr.message);
  }
  
  // Get model info from OpenAI-compatible models endpoint
  try {
    const modelsRes = await fetch(`${serviceUrl}/openai/models`);
    if (modelsRes.ok) {
      const modelsData = await modelsRes.json();
      // Response is an array of model name strings
      if (Array.isArray(modelsData) && modelsData.length > 0) {
        // Find a model matching the alias or use first available
        const aliasNormalized = MODEL_ALIAS.toLowerCase().replace(/-/g, '');
        const matchingModel = modelsData.find(m => 
          m.toLowerCase().replace(/-/g, '').includes(aliasNormalized) ||
          m.toLowerCase().includes('phi')
        );
        const modelId = matchingModel || modelsData[0];
        loadedModelInfo = { id: modelId, alias: MODEL_ALIAS };
        console.log('Using model:', modelId);
        return loadedModelInfo;
      }
    }
  } catch (infoErr) {
    console.warn('Could not get model info:', infoErr.message);
  }
  
  // Fallback model info
  loadedModelInfo = { id: MODEL_ALIAS, alias: MODEL_ALIAS };
  console.log('Using fallback model alias:', MODEL_ALIAS);
  return loadedModelInfo;
}

function getServiceConfig() {
  // Per SDK docs: manager.endpoint returns {serviceUrl}/v1
  // When using direct API, we construct endpoint as serviceUrl + /v1
  let endpoint;
  if (serviceUrl) {
    endpoint = `${serviceUrl}/v1`;
  } else {
    try {
      endpoint = manager.endpoint;  // Already includes /v1
    } catch {
      endpoint = null;
    }
  }
  
  return {
    baseURL: endpoint,
    apiKey: 'OPENAI_API_KEY',  // Per SDK docs, this is a placeholder
    modelId: loadedModelInfo ? loadedModelInfo.id : MODEL_ALIAS,
  };
}

async function listCatalogModels() {
  try {
    return await manager.listCatalogModels();
  } catch (err) {
    // Fallback: try direct API
    if (serviceUrl) {
      try {
        const res = await fetch(`${serviceUrl}/management/catalog`);
        if (res.ok) return await res.json();
      } catch { /* ignore */ }
    }
    console.error('listCatalogModels error:', err.message);
    return { error: err.message };
  }
}

async function listCachedModels() {
  try {
    return await manager.listCachedModels();
  } catch (err) {
    // Fallback: try direct API
    if (serviceUrl) {
      try {
        const res = await fetch(`${serviceUrl}/openai/models`);
        if (res.ok) {
          const data = await res.json();
          // Response is an array of model name strings
          if (Array.isArray(data)) {
            return data.map(id => ({ id, object: 'model' }));
          }
          return data.data || [];
        }
      } catch { /* ignore */ }
    }
    console.error('listCachedModels error:', err.message);
    return { error: err.message };
  }
}

async function isServiceRunning() {
  // First try SDK method
  try {
    const sdkResult = await manager.isServiceRunning();
    if (sdkResult) return true;
  } catch { /* ignore */ }
  
  // Fallback: check via HTTP
  const endpoint = await findRunningService();
  return endpoint !== null;
}

module.exports = {
  initFoundry,
  getServiceConfig,
  listCatalogModels,
  listCachedModels,
  isServiceRunning,
};
