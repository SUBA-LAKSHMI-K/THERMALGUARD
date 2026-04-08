const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyB0gPB2mTDnkE4DQSCPCgvs-B5BZcTy2_E';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

let knowledgeCache = null;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (_req, res) => {
  res.redirect('/chatbot.html');
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    mode: 'chatbot-only',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/chat/examples', (_req, res) => {
  res.json({
    examples: [
      'What is the heat risk in Zone 15 Sholinganallur?',
      'Why is Zone 8 Anna Nagar classified as high risk?',
      'Which zones require immediate intervention and why?',
      'Compare heat risk between Zone 13 Adyar and Zone 7 Ambattur.',
      'What happens if tree cover increases by 10% in Zone 15 Sholinganallur?',
      'How will heat risk change if cool roofs increase in Zone 9 Teynampet?',
      'An NGO planted 200 trees in Zone 7 Ambattur. What is the impact?',
      'Which zones should receive priority funding?'
    ]
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const knowledge = await getKnowledgeBase();
    const analysis = analyzeQuery(message, knowledge);
    const reply = await generateChatReply(message, analysis, knowledge);

    res.json({
      reply,
      debug: {
        intent: analysis.intent,
        zonesMatched: analysis.zones.map((z) => z.name)
      }
    });
  } catch (error) {
    console.error('Chat processing error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

app.use((error, _req, res, _next) => {
  console.error('API Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const server = app.listen(PORT, () => {
  console.log(`ThermalGuard chatbot server running on port ${PORT}`);
  console.log(`Open chatbot at: http://localhost:${PORT}/chatbot.html`);
});

server.on('error', (error) => {
  if (error && error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Set a different port with the PORT environment variable and restart.`);
    process.exit(1);
  }
  console.error('Server error:', error);
  process.exit(1);
});

async function loadJsonFile(filePath) {
  const fullPath = path.join(__dirname, filePath);
  const content = await fs.readFile(fullPath, 'utf8');
  return JSON.parse(content);
}

async function getKnowledgeBase() {
  if (knowledgeCache) return knowledgeCache;

  const [geojson, ngoSummary, ngoDetailed] = await Promise.all([
    loadJsonFile('wards.geojson'),
    loadJsonFile('ngo.json').catch(() => ({ ngos: [] })),
    loadJsonFile('nog.json').catch(() => ({ zones: [] }))
  ]);

  const zoneByName = new Map();
  const zoneByNumber = new Map();
  const detailedZones = Array.isArray(ngoDetailed.zones) ? ngoDetailed.zones : [];

  detailedZones.forEach((zone) => {
    const key = normalize(zone.name);
    if (key) zoneByName.set(key, zone);
    if (zone.short_name) zoneByName.set(normalize(zone.short_name), zone);
    if (zone.zone_number != null) zoneByNumber.set(Number(zone.zone_number), zone);
  });

  const features = Array.isArray(geojson.features) ? geojson.features : [];
  const fallbackZones = features.map((feature, i) => {
    const name = feature?.properties?.name || `Ward ${i + 1}`;
    const zoneNum = extractZoneNumber(name);
    const score = syntheticRiskScore(name);
    const temp = 34 + (score % 8);
    const ndvi = Number((0.1 + ((score % 30) / 100)).toFixed(2));
    const builtUpDensity = Number((0.55 + ((score % 25) / 100)).toFixed(2));
    return {
      id: feature?.properties?.['@id'] || `feature-${i}`,
      zone_number: zoneNum,
      name,
      short_name: name.replace(/^zone\s*\d+\s*/i, '').trim(),
      heat_risk: {
        risk_score: score,
        risk_level: classifyRisk(score),
        avg_surface_temp_c: Number(temp.toFixed(1)),
        impervious_surface_pct: Math.round(builtUpDensity * 100),
        urban_heat_island_intensity: Number((1.5 + (score / 50)).toFixed(1)),
        heat_alert_days_per_year: 18 + Math.round(score / 3)
      },
      vegetation: {
        ndvi_score: ndvi,
        green_cover_pct: Math.max(5, Math.round(ndvi * 100)),
        tree_canopy_pct: Math.max(3, Math.round(ndvi * 55))
      },
      interventions: { total_programs: 0, active: 0, programs: [] },
      ngo_activity: { active_ngos: [], total_ngos_ever: 0, impact_score: 0 },
      government_priority: { priority_rank: 99, allocated_govt_budget_inr: 0, notes: 'No detailed record available.' }
    };
  });

  fallbackZones.forEach((zone) => {
    const key = normalize(zone.name);
    if (!zoneByName.has(key)) zoneByName.set(key, zone);
    if (zone.short_name && !zoneByName.has(normalize(zone.short_name))) zoneByName.set(normalize(zone.short_name), zone);
    if (zone.zone_number != null && !zoneByNumber.has(zone.zone_number)) zoneByNumber.set(zone.zone_number, zone);
  });

  knowledgeCache = {
    geojson,
    ngoSummary,
    zones: Array.from(new Set([...detailedZones, ...fallbackZones])),
    zoneByName,
    zoneByNumber
  };
  return knowledgeCache;
}

function analyzeQuery(message, knowledge) {
  const lower = message.toLowerCase();
  const zones = matchZonesInQuery(message, knowledge);
  const intent = detectIntent(lower);

  let simulation = null;
  if (/tree cover|trees? increase|planted/i.test(message)) {
    const percent = extractPercent(message) ?? (/planted\s+\d+/i.test(message) ? null : 10);
    const plantedTrees = extractPlantedTrees(message);
    simulation = { type: 'tree', percent, plantedTrees };
  } else if (/cool roof/i.test(lower)) {
    const percent = extractPercent(message) ?? 15;
    simulation = { type: 'coolRoof', percent };
  }

  const priorityRanking = rankByUrgency(knowledge.zones);
  const topUrgent = priorityRanking.slice(0, 5);

  return {
    intent,
    zones,
    simulation,
    topUrgent
  };
}

function detectIntent(lower) {
  if (/rank|priority funding|receive priority funding|immediate intervention/.test(lower)) return 'priority';
  if (/compare/.test(lower)) return 'compare';
  if (/what happens|how will|increase|simulation|planted/.test(lower)) return 'simulation';
  if (/why/.test(lower)) return 'explain';
  if (/suggest|low-cost strategies|reduce/.test(lower)) return 'mitigation';
  return 'risk';
}

function matchZonesInQuery(message, knowledge) {
  const zones = [];
  const seen = new Set();
  const lower = message.toLowerCase();

  const zoneNumMatches = [...message.matchAll(/zone\s*(\d+)/gi)];
  zoneNumMatches.forEach((m) => {
    const zone = knowledge.zoneByNumber.get(Number(m[1]));
    if (zone && !seen.has(zone.name)) {
      zones.push(zone);
      seen.add(zone.name);
    }
  });

  for (const zone of knowledge.zones) {
    const full = zone.name?.toLowerCase();
    const short = zone.short_name?.toLowerCase();
    if (full && lower.includes(full) && !seen.has(zone.name)) {
      zones.push(zone);
      seen.add(zone.name);
    } else if (short && short.length > 3 && lower.includes(short) && !seen.has(zone.name)) {
      zones.push(zone);
      seen.add(zone.name);
    }
  }

  return zones.slice(0, 3);
}

function extractPercent(message) {
  const match = message.match(/(\d+)\s*%/);
  return match ? Number(match[1]) : null;
}

function extractPlantedTrees(message) {
  const match = message.match(/planted\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function rankByUrgency(zones) {
  return [...zones]
    .map((z) => {
      const risk = Number(z?.heat_risk?.risk_score || 0);
      const population = Number(z?.population || 0);
      const ndvi = Number(z?.vegetation?.ndvi_score || 0.2);
      const programs = Number(z?.interventions?.active || 0);
      const gapPenalty = Math.max(0, 4 - programs) * 2;
      const urgency = risk + (population / 100000) * 2 + (1 - ndvi) * 10 + gapPenalty;
      return { zone: z, urgency: Number(urgency.toFixed(2)) };
    })
    .sort((a, b) => b.urgency - a.urgency);
}

function simulateZone(zone, simulation) {
  const temp = Number(zone?.heat_risk?.avg_surface_temp_c || 37);
  const ndvi = Number(zone?.vegetation?.ndvi_score || 0.2);
  const builtUpDensity = Number(zone?.heat_risk?.impervious_surface_pct || 60) / 100;

  let nextNdvi = ndvi;
  let nextBuiltUp = builtUpDensity;

  if (simulation.type === 'tree') {
    if (simulation.percent != null) {
      nextNdvi = Math.min(0.9, ndvi + simulation.percent / 100);
    }
    if (simulation.plantedTrees != null) {
      nextNdvi = Math.min(0.9, nextNdvi + (simulation.plantedTrees / 10000) * 0.08);
    }
  }

  if (simulation.type === 'coolRoof') {
    const pct = simulation.percent ?? 15;
    nextBuiltUp = Math.max(0.2, builtUpDensity - (pct / 100) * 0.5);
  }

  const oldScore = calculateHeatRiskScore(temp, ndvi, builtUpDensity);
  const newScore = calculateHeatRiskScore(temp, nextNdvi, nextBuiltUp);
  const delta = Number((oldScore - newScore).toFixed(2));

  return {
    oldScore,
    newScore,
    delta,
    oldLevel: classifyRisk(oldScore),
    newLevel: classifyRisk(newScore),
    nextNdvi: Number(nextNdvi.toFixed(3)),
    nextBuiltUp: Number((nextBuiltUp * 100).toFixed(1))
  };
}

function calculateHeatRiskScore(temperature, ndvi, builtUpDensity) {
  const score = (temperature * 0.5) + ((1 - ndvi) * 30) + (builtUpDensity * 20);
  return Number(score.toFixed(2));
}

function classifyRisk(score) {
  if (score > 70) return 'High';
  if (score > 50) return 'Medium';
  return 'Low';
}

async function generateChatReply(userMessage, analysis, knowledge) {
  const zoneSummaries = analysis.zones.map((z) => {
    const risk = z.heat_risk || {};
    const veg = z.vegetation || {};
    return {
      name: z.name,
      risk_score: risk.risk_score ?? null,
      risk_level: risk.risk_level ?? null,
      temperature_c: risk.avg_surface_temp_c ?? null,
      ndvi: veg.ndvi_score ?? null,
      impervious_surface_pct: risk.impervious_surface_pct ?? null,
      active_programs: z.interventions?.active ?? 0,
      active_ngos: z.ngo_activity?.active_ngos ?? [],
      priority_rank: z.government_priority?.priority_rank ?? null
    };
  });

  const simulations = analysis.simulation && analysis.zones.length
    ? analysis.zones.map((z) => ({ zone: z.name, result: simulateZone(z, analysis.simulation) }))
    : [];

  const topUrgent = analysis.topUrgent.map((item, i) => ({
    rank: i + 1,
    zone: item.zone.name,
    urgency: item.urgency,
    risk_score: item.zone.heat_risk?.risk_score ?? null,
    ndvi: item.zone.vegetation?.ndvi_score ?? null
  }));

  const prompt = `
You are ThermalGuard Assistant for Chennai heat-risk governance.
Answer like a practical chatbot, short and clear.

Rules:
1) Use ONLY the provided zone context and calculations.
2) If zone missing, ask user to provide zone number/name.
3) For risk explanation mention temperature, NDVI, built-up/impervious factor.
4) For strategy questions, give low-cost actions first.
5) For funding/ranking questions, return ranked list with brief reasons.
6) For simulation, show before->after risk score and level.

User question:
${userMessage}

Detected intent: ${analysis.intent}

Matched zone data:
${JSON.stringify(zoneSummaries, null, 2)}

Simulation results:
${JSON.stringify(simulations, null, 2)}

Top urgent wards:
${JSON.stringify(topUrgent, null, 2)}
`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 500 }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini error ${response.status}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) return text;
  } catch (error) {
    console.warn('Gemini fallback triggered:', error.message);
  }

  return fallbackReply(userMessage, analysis);
}

function fallbackReply(userMessage, analysis) {
  if (!analysis.zones.length && analysis.intent !== 'priority') {
    return 'Please mention a Chennai zone name or zone number (for example: Zone 15 Sholinganallur) so I can give an exact data-based answer.';
  }

  if (analysis.intent === 'priority') {
    const ranked = analysis.topUrgent.slice(0, 5).map((item, idx) => `${idx + 1}. ${item.zone.name} (urgency ${item.urgency})`);
    return `Top wards for immediate funding priority:\n${ranked.join('\n')}\n\nThese ranks combine heat risk, NDVI stress, population load, and intervention gap.`;
  }

  if (analysis.intent === 'simulation' && analysis.simulation && analysis.zones[0]) {
    const zone = analysis.zones[0];
    const sim = simulateZone(zone, analysis.simulation);
    return `${zone.name}: risk score ${sim.oldScore} (${sim.oldLevel}) -> ${sim.newScore} (${sim.newLevel}). Estimated improvement: ${sim.delta} points.`;
  }

  const zone = analysis.zones[0];
  return `${zone.name} heat profile: score ${zone.heat_risk?.risk_score ?? 'N/A'}, level ${zone.heat_risk?.risk_level ?? 'N/A'}, temperature ${zone.heat_risk?.avg_surface_temp_c ?? 'N/A'}C, NDVI ${zone.vegetation?.ndvi_score ?? 'N/A'}, impervious surface ${zone.heat_risk?.impervious_surface_pct ?? 'N/A'}%.`;
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function extractZoneNumber(name) {
  const match = String(name || '').match(/zone\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

function syntheticRiskScore(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.min(95, Math.max(42, Math.abs(hash) % 96));
}

module.exports = app;