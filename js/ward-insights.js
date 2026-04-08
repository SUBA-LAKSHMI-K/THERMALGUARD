const summaryCards = document.getElementById('summary-cards');
const fileInputContainer = document.getElementById('file-input-container');
const wardTableBody = document.getElementById('ward-table-body');
const distributionList = document.getElementById('distribution-list');
const selectedWardCard = document.getElementById('selected-ward-card');

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

function createCard(title, value, note) {
  return `
    <div class="insight-card metric-card">
      <div class="metric-label">${title}</div>
      <div class="metric-value">${value}</div>
      <div class="metric-note">${note}</div>
    </div>
  `;
}

function renderSummary(insights) {
  let summaryHTML = `
    ${createCard('Total Wards', insights.total, 'Boundary zones loaded from GeoJSON')}
    ${createCard('Average Heat Score', insights.average.toFixed(1), 'Mean ward heat risk score')}
    ${createCard('Critical Wards', insights.critical, 'Highest risk zones')}
  `;

  // Add real data insights if available
  if (insights.cityStats) {
    const stats = insights.cityStats;
    summaryHTML += `
      ${createCard('Real Data Coverage', `${insights.realDataCount}/${insights.total}`, `${stats.dataCoverage.toFixed(1)}% wards with NGO data`)}
      ${createCard('City Population', `${(stats.totalPopulation/1000000).toFixed(1)}M`, 'Total population across zones')}
      ${createCard('Active Interventions', stats.totalInterventions, 'NGO programs across wards')}
      ${createCard('Trees Planted', stats.totalTrees.toLocaleString(), 'Total trees from interventions')}
      ${createCard('Cool Roofs', stats.totalCoolRoofs.toLocaleString(), 'Houses with cool roof installations')}
      ${createCard('Avg NDVI', stats.avgNDVI.toFixed(2), 'Average vegetation index')}
    `;
  } else {
    summaryHTML += `
      ${createCard('Data Source', 'Synthetic', 'Using generated heat scores')}
    `;
  }

  summaryCards.innerHTML = summaryHTML;
}

function renderDistribution(distribution) {
  // Convert distribution object to array format expected by the function
  const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
  const distributionArray = Object.entries(distribution).map(([category, count]) => ({
    category,
    count,
    percentage: total > 0 ? (count / total * 100).toFixed(1) : 0
  }));

  distributionList.innerHTML = distributionArray.map(item => `
    <div class="distribution-row">
      <div class="distribution-label">${item.category}</div>
      <div class="distribution-bar" style="width:${item.percentage}%"></div>
      <div class="distribution-count">${item.count}</div>
    </div>
  `).join('');
}

function renderWardTable(wards) {
  // Check if we have real NGO data
  const hasRealData = wards.some(ward => ward.hasRealData);

  let tableHTML = '';

  if (hasRealData) {
    // Enhanced table with NGO data
    tableHTML = wards.map((ward, index) => {
      const interventions = ward.interventions;
      const ngoActivity = ward.ngoActivity;
      const govPriority = ward.governmentPriority;

      const activePrograms = interventions ? interventions.active : 0;
      const totalPrograms = interventions ? interventions.total_programs : 0;
      const ngoCount = ngoActivity ? ngoActivity.active_ngos?.length || 0 : 0;
      const priorityRank = govPriority ? govPriority.priority_rank : 'N/A';

      return `
        <tr class="table-row" data-index="${index}">
          <td>${index + 1}</td>
          <td>${ward.name}</td>
          <td>${ward.score.toFixed(1)}</td>
          <td>${getHelper('formatRiskBadge')(ward.category)}</td>
          <td>${ward.ndvi ? ward.ndvi.toFixed(2) : 'N/A'}</td>
          <td>${ward.population ? (ward.population/1000).toFixed(0) + 'K' : 'N/A'}</td>
          <td>${activePrograms}/${totalPrograms}</td>
          <td>${ngoCount}</td>
          <td>${priorityRank}</td>
        </tr>
      `;
    }).join('');
  } else {
    // Basic table for synthetic data
    tableHTML = wards.map((ward, index) => `
      <tr class="table-row" data-index="${index}">
        <td>${index + 1}</td>
        <td>${ward.name}</td>
        <td>${ward.score.toFixed(1)}</td>
        <td>${getHelper('formatRiskBadge')(ward.category)}</td>
        <td colspan="5">Synthetic data - no NGO information available</td>
      </tr>
    `).join('');
  }

  wardTableBody.innerHTML = tableHTML;

  wardTableBody.querySelectorAll('.table-row').forEach(row => {
    row.addEventListener('click', () => {
      const index = Number(row.getAttribute('data-index'));
      renderSelectedWard(wards[index]);
      document.querySelectorAll('.table-row').forEach(r => r.classList.remove('selected-row'));
      row.classList.add('selected-row');
    });
  });
}

function renderSelectedWard(ward) {
  let wardHTML = `
    <div class="selected-ward-name">${ward.name}</div>
    <div class="selected-ward-metric">Heat Score: ${ward.score.toFixed(1)}</div>
    <div class="selected-ward-status">${getHelper('formatRiskBadge')(ward.category)}</div>
  `;

  if (ward.hasRealData) {
    // Enhanced display with real NGO data
    const interventions = ward.interventions;
    const ngoActivity = ward.ngoActivity;
    const govPriority = ward.governmentPriority;

    wardHTML += `
      <div class="ward-details-grid">
        <div class="detail-section">
          <h4>🌡️ Heat Risk Profile</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">Risk Level:</span>
              <span class="detail-value">${ward.category}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Surface Temp:</span>
              <span class="detail-value">${ward.feature.properties.avg_surface_temp_c || 'N/A'}°C</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">UHI Intensity:</span>
              <span class="detail-value">${ward.feature.properties.urban_heat_island_intensity || 'N/A'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Heat Alert Days:</span>
              <span class="detail-value">${ward.feature.properties.heat_alert_days_per_year || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h4>🌱 Vegetation & Green Cover</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">NDVI Score:</span>
              <span class="detail-value">${ward.ndvi ? ward.ndvi.toFixed(3) : 'N/A'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Green Cover:</span>
              <span class="detail-value">${ward.feature.properties.green_cover_pct || 'N/A'}%</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Tree Canopy:</span>
              <span class="detail-value">${ward.feature.properties.tree_canopy_pct || 'N/A'}%</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Parks Count:</span>
              <span class="detail-value">${ward.feature.properties.vegetation?.parks_count || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h4>🏛️ Population & Area</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">Population:</span>
              <span class="detail-value">${ward.population ? ward.population.toLocaleString() : 'N/A'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Area:</span>
              <span class="detail-value">${ward.area ? ward.area.toFixed(1) + ' km²' : 'N/A'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Density:</span>
              <span class="detail-value">${ward.feature.properties.population_density_per_km2 ? (ward.feature.properties.population_density_per_km2/1000).toFixed(1) + 'K/km²' : 'N/A'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Impervious Surface:</span>
              <span class="detail-value">${ward.feature.properties.impervious_surface_pct || 'N/A'}%</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h4>🌟 NGO Interventions</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">Active Programs:</span>
              <span class="detail-value">${interventions ? interventions.active : 0}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Total Programs:</span>
              <span class="detail-value">${interventions ? interventions.total_programs : 0}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Budget Allocated:</span>
              <span class="detail-value">₹${interventions ? (interventions.total_budget_inr/100000).toFixed(1) + 'L' : 'N/A'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Budget Spent:</span>
              <span class="detail-value">₹${interventions ? (interventions.spent_budget_inr/100000).toFixed(1) + 'L' : 'N/A'}</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h4>🤝 NGO Activity</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">Active NGOs:</span>
              <span class="detail-value">${ngoActivity ? ngoActivity.active_ngos?.length || 0 : 0}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Total NGOs Ever:</span>
              <span class="detail-value">${ngoActivity ? ngoActivity.total_ngos_ever || 0 : 0}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Impact Score:</span>
              <span class="detail-value">${ngoActivity ? ngoActivity.impact_score || 0 : 0}/100</span>
            </div>
          </div>
          ${ngoActivity && ngoActivity.active_ngos?.length > 0 ? `
            <div class="ngo-list">
              <strong>Active Organizations:</strong>
              <div class="ngo-tags">
                ${ngoActivity.active_ngos.map(ngo => `<span class="ngo-tag">${ngo}</span>`).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <div class="detail-section">
          <h4>🏛️ Government Priority</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">Priority Rank:</span>
              <span class="detail-value">${govPriority ? '#' + govPriority.priority_rank : 'N/A'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Govt Budget:</span>
              <span class="detail-value">₹${govPriority ? (govPriority.allocated_govt_budget_inr/100000).toFixed(1) + 'L' : 'N/A'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Last Reviewed:</span>
              <span class="detail-value">${govPriority ? new Date(govPriority.last_reviewed).toLocaleDateString() : 'N/A'}</span>
            </div>
          </div>
          ${govPriority && govPriority.notes ? `
            <div class="gov-notes">
              <strong>Notes:</strong> ${govPriority.notes}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  } else {
    // Basic display for synthetic data
    wardHTML += `
      <p>Ward ${ward.name} is currently in the <strong>${ward.category}</strong> risk category with a synthetic heat score of ${ward.score.toFixed(1)}.</p>
      <p><em>Note: This ward uses generated data. Real NGO intervention data is not available.</em></p>
    `;
  }

  selectedWardCard.innerHTML = wardHTML;
}

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

    // Show loading state
    const label = input.closest('label');
    const originalText = label.textContent;
    label.textContent = `Loading ${file.name}...`;

    try {
      const features = await getHelper('loadWardsFromFile')(file);
      clearFileInput();
      await initWardInsights(features);

      // Clear any previous error messages
      if (document.querySelector('.error-card')) {
        document.querySelector('.error-card').remove();
      }
      label.textContent = `✓ Loaded ${file.name}`;
      setTimeout(() => label.textContent = originalText, 2000);
    } catch (error) {
      console.error('Ward file upload error:', error);
      showError(`Failed to load ward data: ${error.message}. Please ensure you're uploading a valid wards.geojson file.`);
      label.textContent = originalText;
    }
  });
}

function showError(message) {
  summaryCards.innerHTML = `<div class="error-card">${message}</div>`;
  wardTableBody.innerHTML = '';
  distributionList.innerHTML = '';
  selectedWardCard.innerHTML = '';
}

async function initWardInsights(overrideFeatures = null) {
  if (overrideFeatures) {
    // Features provided directly (from file upload)
    clearFileInput();
    const insights = getHelper('computeInsights')(overrideFeatures);
    renderSummary(insights);
    renderDistribution(insights.distribution);
    renderWardTable(insights.wards.slice(0, 50));
    if (insights.wards.length) {
      renderSelectedWard(insights.wards[0]);
    }
    return;
  }

  // Try to load automatically first
  try {
    const features = await getHelper('loadWards')();
    if (features && features.length > 0) {
      clearFileInput();
      const insights = getHelper('computeInsights')(features);
      renderSummary(insights);
      renderDistribution(insights.distribution);
      renderWardTable(insights.wards.slice(0, 50));
      if (insights.wards.length) {
        renderSelectedWard(insights.wards[0]);
      }
      return;
    }
  } catch (err) {
    console.warn('Auto-loading failed:', err);
  }

  // If auto-loading failed, show file upload option
  showError('Unable to load ward GeoJSON automatically. Please use the local file loader below.');
  showFileUpload('Local file access can be restricted by some browsers when opening the page directly from disk.');
}

window.addEventListener('load', () => {
  try {
    // Show file upload option immediately for better UX
    showFileUpload('Upload wards.geojson to view ward data insights and heat risk analysis.');
    initWardInsights();
  } catch (err) {
    showError('Ward insights initialization failed. Please open the page in a browser and check the console.');
    console.error(err);
  }
});
