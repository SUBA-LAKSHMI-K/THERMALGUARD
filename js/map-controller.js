const selectedWardEl = document.getElementById('selected-ward');

let analysisData = {};
let dashboardData = {};
let spatialData = {};
let predictiveData = {};
let scenarioData = {};
let aiData = {};

function getWardHelpers() {
  if (!window.WardData) {
    return null;
  }
  return window.WardData;
}

function getHelper(name) {
  const helpers = getWardHelpers();
  if (!helpers || typeof helpers[name] !== 'function') {
    throw new Error(`WardData helper missing: ${name}`);
  }
  return helpers[name];
}

const topWardsEl = document.getElementById('top-wards');
const summaryEl = document.getElementById('map-summary');
const mapLegendEl = document.getElementById('map-legend');

let map = null;
let selectedLayer = null;
let analysisLayers = {};

// Load analysis data
async function loadAnalysisData() {
  const files = [
    'analysis-output/dashboardData.json',
    'analysis-output/spatialAnalysis.json',
    'analysis-output/predictiveAnalysis.json',
    'analysis-output/scenarioSimulation.json',
    'analysis-output/aiDecisionSupport.json'
  ];

  for (const file of files) {
    try {
      const response = await fetch(file);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const fileName = file.split('/').pop().split('.')[0];
      analysisData[fileName] = await response.json();
    } catch (error) {
      console.warn(`Failed to load ${file}:`, error);
      analysisData[file.split('/').pop().split('.')[0]] = {};
    }
  }

  dashboardData = analysisData.dashboardData || {};
  spatialData = analysisData.spatialAnalysis || {};
  predictiveData = analysisData.predictiveAnalysis || {};
  scenarioData = analysisData.scenarioSimulation || {};
  aiData = analysisData.aiDecisionSupport || {};
}

function createMap() {
  if (map) return map;
  if (!window.L) {
    throw new Error('Leaflet library failed to load. Check network access or use a local copy of Leaflet.');
  }

  map = L.map('map', { zoomControl: true }).setView([13.0827, 80.2707], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18,
  }).addTo(map);
  return map;
}

function styleFeature(feature) {
  const zoneName = getHelper('getWardName')(feature);
  const zoneData = spatialData.hotspots?.find(h =>
    h.zoneName.toLowerCase() === zoneName.toLowerCase()
  );

  if (zoneData) {
    return {
      fillColor: getRiskColorFromLevel(zoneData.riskLevel),
      color: '#1f2937',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8,
      dashArray: '2',
    };
  }

  // Fallback to basic styling
  const metric = getHelper('getWardMetric')(feature);
  return {
    fillColor: getHelper('getRiskColor')(metric),
    color: '#1f2937',
    weight: 1.5,
    opacity: 1,
    fillOpacity: 0.72,
    dashArray: '2',
  };
}

function getRiskColorFromLevel(riskLevel) {
  const colors = {
    'Critical': '#dc2626',
    'High': '#ea580c',
    'Moderate': '#ca8a04',
    'Low': '#16a34a'
  };
  return colors[riskLevel] || '#16a34a';
}

function highlightFeature(e) {
  const layer = e.target;
  layer.setStyle({
    weight: 3,
    color: '#ffffff',
    fillOpacity: 0.9,
  });
}

function resetHighlight(e) {
  const layer = e.target;
  if (selectedLayer !== layer) {
    layer.setStyle(styleFeature(layer.feature));
  }
}

function selectWard(layer, feature) {
  if (selectedLayer) {
    selectedLayer.setStyle(styleFeature(selectedLayer.feature));
  }
  selectedLayer = layer;
  layer.setStyle({
    weight: 3,
    color: '#ffffff',
    fillOpacity: 0.95,
  });

  const zoneName = getHelper('getWardName')(feature);
  const zoneData = spatialData.hotspots?.find(h =>
    h.zoneName.toLowerCase() === zoneName.toLowerCase()
  );

  renderSelectedWardDetails(zoneName, zoneData, feature);
  layer.openPopup();
}

function renderSelectedWardDetails(zoneName, zoneData, feature) {
  if (!zoneData) {
    // Fallback to basic ward info
    const metric = getHelper('getWardMetric')(feature);
    const category = getHelper('getRiskCategory')(metric);
    selectedWardEl.innerHTML = `
      <div class="selected-ward-name">${zoneName}</div>
      <div class="selected-ward-metric">Heat Score: ${metric}</div>
      <div class="selected-ward-status">${getHelper('formatRiskBadge')(category)}</div>
      <p>${zoneName} is in the <strong>${category}</strong> risk category.</p>
    `;
    return;
  }

  // Enhanced analysis view
  const recommendations = zoneData.recommendations || [];
  const interventions = getHelper('getWardInterventions')(feature);
  const population = getHelper('getWardPopulation')(feature);
  const area = getHelper('getWardArea')(feature);

  selectedWardEl.innerHTML = `
    <div class="selected-ward-name">${zoneData.zoneName}</div>
    <div class="selected-ward-metric">Risk Score: ${zoneData.heatIndex}/100</div>
    <div class="selected-ward-status">${getRiskBadge(zoneData.riskLevel)}</div>

    <div class="ward-details-grid">
      <div class="ward-detail">
        <strong>Population:</strong> ${zoneData.vulnerablePopulation?.toLocaleString() || population?.toLocaleString() || 'N/A'}
      </div>
      <div class="ward-detail">
        <strong>Temperature:</strong> ${zoneData.temperature || 'N/A'}°C
      </div>
      <div class="ward-detail">
        <strong>Humidity:</strong> ${zoneData.humidity || 'N/A'}%
      </div>
      <div class="ward-detail">
        <strong>Priority:</strong> ${zoneData.priority || 'N/A'}
      </div>
    </div>

    ${recommendations.length > 0 ? `
      <div class="ward-recommendations">
        <h4>Key Recommendations</h4>
        <ul>
          ${recommendations.slice(0, 3).map(rec => `<li>${rec}</li>`).join('')}
        </ul>
      </div>
    ` : ''}

    ${interventions ? `
      <div class="ward-interventions">
        <h4>Current Interventions</h4>
        <p><strong>Programs:</strong> ${interventions.total_programs || 0}</p>
        <p><strong>Budget:</strong> ₹${interventions.total_budget_inr?.toLocaleString() || 'N/A'}</p>
      </div>
    ` : ''}
  `;
}

function getRiskBadge(riskLevel) {
  const classes = riskLevel.toLowerCase();
  return `<span class="status ${classes}">${riskLevel}</span>`;
}

function onEachFeature(feature, layer) {
  const zoneName = getHelper('getWardName')(feature);
  const zoneData = spatialData.hotspots?.find(h =>
    h.zoneName.toLowerCase() === zoneName.toLowerCase()
  );

  let popupContent = `<strong>${zoneName}</strong><br>`;

  if (zoneData) {
    popupContent += `
      Risk Level: ${zoneData.riskLevel}<br>
      Heat Index: ${zoneData.heatIndex}/100<br>
      Vulnerable Population: ${zoneData.vulnerablePopulation?.toLocaleString() || 'N/A'}<br>
      Temperature: ${zoneData.temperature || 'N/A'}°C<br>
      ${zoneData.recommendations ? `<br><strong>Priority Actions:</strong><br>${zoneData.recommendations.slice(0, 2).join('<br>')}` : ''}
    `;
  } else {
    const metric = getHelper('getWardMetric')(feature);
    const category = getHelper('getRiskCategory')(metric);
    popupContent += `Heat Score: ${metric}<br>Status: ${category}`;
  }

  layer.bindPopup(popupContent);
  layer.on({
    mouseover: highlightFeature,
    mouseout: resetHighlight,
    click: () => selectWard(layer, feature),
  });
}

function renderTopWards() {
  if (!spatialData.hotspots) {
    // Fallback to basic insights
    const features = geojsonLayer?.getLayers().map(l => l.feature) || [];
    const insights = getHelper('computeInsights')(features);
    renderBasicTopWards(insights.top);
    return;
  }

  const topWards = spatialData.hotspots
    .sort((a, b) => b.heatIndex - a.heatIndex)
    .slice(0, 5);

  topWardsEl.innerHTML = topWards.map((zone, index) => `
    <li>
      <span>${index + 1}. ${zone.zoneName}</span>
      <strong>${zone.heatIndex}/100</strong>
      <span class="status ${zone.riskLevel.toLowerCase()}">${zone.riskLevel}</span>
    </li>
  `).join('');
}

function renderBasicTopWards(topWards) {
  topWardsEl.innerHTML = topWards.map((item, index) => `
    <li>
      <span>${index + 1}. ${item.name}</span>
      <strong>${item.score}</strong>
      <span class="status ${item.category.toLowerCase()}">${item.category}</span>
    </li>
  `).join('');
}

function renderSummary() {
  if (!dashboardData.currentRiskScore) {
    // Fallback to basic insights
    const features = geojsonLayer?.getLayers().map(l => l.feature) || [];
    const insights = getHelper('computeInsights')(features);
    renderBasicSummary(insights);
    return;
  }

  summaryEl.innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Current Risk Score</div>
      <div class="metric-value">${dashboardData.currentRiskScore}/100</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">2030 Projection</div>
      <div class="metric-value">${dashboardData.projectedRiskScore || 'N/A'}/100</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Risk Reduction</div>
      <div class="metric-value">${dashboardData.riskReduction || 0}%</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Critical Zones</div>
      <div class="metric-value">${dashboardData.criticalZones || 0}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Investment Needed</div>
      <div class="metric-value">₹${dashboardData.totalInvestment || '160'}Cr</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Data Coverage</div>
      <div class="metric-value">${spatialData.hotspots?.length || 0} zones</div>
    </div>
  `;

  renderLegend();
}

function renderBasicSummary(insights) {
  summaryEl.innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Total Wards</div>
      <div class="metric-value">${insights.total}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Average Heat Score</div>
      <div class="metric-value">${insights.average?.toFixed(1) || 'N/A'}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Critical Zones</div>
      <div class="metric-value">${insights.criticalCount || 0}</div>
    </div>
  `;

  renderBasicLegend();
}

function renderLegend() {
  if (mapLegendEl) {
    mapLegendEl.innerHTML = `
      <div class="legend-row"><span class="legend-badge critical"></span>Critical (85-100)</div>
      <div class="legend-row"><span class="legend-badge high"></span>High (70-84)</div>
      <div class="legend-row"><span class="legend-badge moderate"></span>Moderate (55-69)</div>
      <div class="legend-row"><span class="legend-badge low"></span>Low (0-54)</div>
    `;
  }
}

function renderBasicLegend() {
  if (mapLegendEl) {
    mapLegendEl.innerHTML = `
      <div class="legend-row"><span class="legend-badge safe"></span>Safe (≤20)</div>
      <div class="legend-row"><span class="legend-badge moderate"></span>Moderate (21-40)</div>
      <div class="legend-row"><span class="legend-badge high"></span>High (41-60)</div>
      <div class="legend-row"><span class="legend-badge severe"></span>Severe (61-80)</div>
      <div class="legend-row"><span class="legend-badge critical"></span>Critical (81-100)</div>
    `;
  }
}

function showError(message) {
  summaryEl.innerHTML = `<div class="error-card">${message}</div>`;
  topWardsEl.innerHTML = '';
}

let geojsonLayer = null;
const fileInputContainer = document.getElementById('file-input-container');

function clearFileInput() {
  if (fileInputContainer) {
    fileInputContainer.innerHTML = '';
  }
}

function showFileUpload(message) {
  if (!fileInputContainer) return;
  fileInputContainer.innerHTML = `
    <h3>Load Local GeoJSON</h3>
    <p>${message}</p>
    <label class="file-upload-label">
      Select wards.geojson
      <input type="file" id="ward-file-input" accept=".json,.geojson" />
    </label>
  `;
  const input = document.getElementById('ward-file-input');
  input?.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const features = await getHelper('loadWardsFromFile')(file);
      clearFileInput();
      await initMapPage(features);
    } catch (error) {
      showError('Failed to parse the selected GeoJSON file. Please choose a valid wards.geojson file.');
      console.error(error);
    }
  });
}

async function initMapPage(overrideFeatures = null) {
  // Load analysis data first
  await loadAnalysisData();

  const features = overrideFeatures || await getHelper('loadWards')();
  if (!features.length) {
    showError('Unable to load wards.geojson automatically. Please use the local file loader below if this page is opened via the file system or a blocked local request.');
    showFileUpload('Local file access can be blocked by some browsers when opening the page via file://.');
    return;
  }

  try {
    createMap();
  } catch (mapError) {
    showError('Map renderer could not initialize. The file loader is still available below.');
    console.error(mapError);
    showFileUpload('Leaflet may be blocked or unavailable. Please load a local wards.geojson file to continue.');
    return;
  }

  if (geojsonLayer) {
    geojsonLayer.remove();
  }

  geojsonLayer = L.geoJSON(features, {
    style: styleFeature,
    onEachFeature: onEachFeature,
  }).addTo(map);

  map.fitBounds(geojsonLayer.getBounds(), { padding: [30, 30] });

  // Render enhanced analysis
  renderSummary();
  renderTopWards();

  // Show initial selection
  if (spatialData.hotspots && spatialData.hotspots.length > 0) {
    const hottestZone = spatialData.hotspots.reduce((max, zone) =>
      zone.heatIndex > max.heatIndex ? zone : max
    );
    selectedWardEl.innerHTML = `
      <div class="selected-ward-name">${hottestZone.zoneName}</div>
      <div class="selected-ward-metric">Risk Score: ${hottestZone.heatIndex}/100</div>
      <div class="selected-ward-status">${getRiskBadge(hottestZone.riskLevel)}</div>
      <p>${hottestZone.zoneName} is currently the highest risk zone in Chennai based on comprehensive AI analysis.</p>
    `;
  } else {
    // Fallback to basic selection
    const insights = getHelper('computeInsights')(features);
    if (insights.top.length) {
      const first = insights.top[0];
      selectedWardEl.innerHTML = `
        <div class="selected-ward-name">${first.name}</div>
        <div class="selected-ward-metric">Heat Score: ${first.score}</div>
        <div class="selected-ward-status">${getHelper('formatRiskBadge')(first.category)}</div>
        <p>${first.name} is currently the hottest ward in this dataset.</p>
      `;
    }
  }
}

window.addEventListener('load', () => {
  try {
    initMapPage();
  } catch (err) {
    showError('Map initialization failed. Please open the page in a browser and check the console.');
    console.error(err);
  }
});
