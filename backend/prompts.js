function summarisePrompt(assetId, events) {
  return [
    'You are a manufacturing asset intelligence assistant.',
    'Summarise the last 24 hours of events for the given asset.',
    'Return strict JSON only with fields:',
    '{"summary": string, "riskLevel": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", "keyIncidents": string[]}',
    'If data is insufficient, set riskLevel to "LOW" and explain in summary.',
    '',
    `Asset ID: ${assetId}`,
    'Events:',
    JSON.stringify(events, null, 2),
  ].join('\n');
}

function classifyPrompt(note) {
  return [
    'You are a maintenance triage assistant.',
    'Classify the maintenance note into priority.',
    'Return strict JSON only with fields:',
    '{"priority": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", "recommendedAction": string, "rationale": string}',
    'If unclear, choose "MEDIUM" with cautious action.',
    '',
    'Maintenance note:',
    note,
  ].join('\n');
}

function chatPrompt(question, context) {
  return [
    'You are a plant engineering assistant. Answer with concise, actionable guidance.',
    'Use only the provided context. If you do not know, say you do not have enough data.',
    '',
    'Context:',
    JSON.stringify(context, null, 2),
    '',
    'Question:',
    question,
  ].join('\n');
}

module.exports = { summarisePrompt, classifyPrompt, chatPrompt };
