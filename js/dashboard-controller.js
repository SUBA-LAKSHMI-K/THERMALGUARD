class DashboardController {
    constructor() {
        this.data = {};
        this.charts = {};
        this.map = null;
        this.init();
    }

    async init() {
        try {
            await this.loadAllData();
            this.renderOverview();
            this.renderPredictive();
            this.renderScenarios();
            this.renderSpatial();
            this.renderRecommendations();
        } catch (error) {
            console.error('Dashboard initialization failed:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    async loadAllData() {
        const canUseApi = window.location.protocol.startsWith('http');

        if (canUseApi) {
            try {
                const response = await fetch('/api/all');
                if (response.ok) {
                    const payload = await response.json();
                    this.data.dashboardData = payload.dashboard;
                    this.data.predictiveAnalysis = payload.predictive;
                    this.data.scenarioSimulation = payload.scenarios;
                    this.data.spatialAnalysis = payload.spatial;
                    this.data.aiDecisionSupport = payload.recommendations;
                    this.data.advancedReports = payload.reports;
                    this.data.wards = payload.zones;
                    this.data.ngo = payload.ngo;
                    return;
                }
            } catch (error) {
                console.warn('API load failed, falling back to local files:', error);
            }
        }

        const files = [
            'analysis-output/dashboardData.json',
            'analysis-output/predictiveAnalysis.json',
            'analysis-output/scenarioSimulation.json',
            'analysis-output/spatialAnalysis.json',
            'analysis-output/aiDecisionSupport.json',
            'analysis-output/advancedReports.json',
            'wards.geojson',
            'ngo.json'
        ];

        for (const file of files) {
            try {
                const response = await fetch(file);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                this.data[file.split('/').pop().split('.')[0]] = await response.json();
            } catch (error) {
                console.warn(`Failed to load ${file}:`, error);
                this.data[file.split('/').pop().split('.')[0]] = {};
            }
        }
    }

    renderOverview() {
        this.renderCityMetrics();
        this.renderZoneRanking();
        this.renderInterventionMetrics();
        this.renderCharts();
    }

    renderCityMetrics() {
        const dashboard = this.data.dashboardData;
        if (!dashboard) return;

        const metrics = [
            { label: 'Current Risk Score', value: dashboard.currentRiskScore || 71, unit: '/100' },
            { label: 'Projected 2030 Score', value: dashboard.projectedRiskScore || 56, unit: '/100' },
            { label: 'Risk Reduction', value: dashboard.riskReduction || 21, unit: '%' },
            { label: 'Critical Zones', value: dashboard.criticalZones || 5, unit: '' },
            { label: 'Total Investment', value: '₹160', unit: ' Cr' },
            { label: 'Zones Covered', value: dashboard.totalZones || 15, unit: '' }
        ];

        const container = document.getElementById('city-metrics');
        container.innerHTML = metrics.map(metric => `
            <div class="metric-card">
                <div class="metric-value">${metric.value}${metric.unit}</div>
                <div class="metric-label">${metric.label}</div>
            </div>
        `).join('');
    }

    renderZoneRanking() {
        const dashboard = this.data.dashboardData;
        if (!dashboard || !dashboard.zoneRiskRanking) return;

        const container = document.getElementById('zone-ranking');
        container.innerHTML = dashboard.zoneRiskRanking.map(zone => {
            const riskClass = this.getRiskClass(zone.riskLevel);
            return `
                <li>
                    <span class="zone-name">${zone.zoneName}</span>
                    <span class="zone-risk ${riskClass}">${zone.riskLevel}</span>
                </li>
            `;
        }).join('');
    }

    renderInterventionMetrics() {
        const dashboard = this.data.dashboardData;
        if (!dashboard) return;

        const metrics = [
            { label: 'Tree Planting Sites', value: dashboard.treePlantingSites || 0, unit: '' },
            { label: 'Cool Roof Projects', value: dashboard.coolRoofProjects || 0, unit: '' },
            { label: 'Wetland Restoration', value: dashboard.wetlandRestoration || 0, unit: '' },
            { label: 'Total Interventions', value: dashboard.totalInterventions || 0, unit: '' }
        ];

        const container = document.getElementById('intervention-metrics');
        container.innerHTML = metrics.map(metric => `
            <div class="metric-card">
                <div class="metric-value">${metric.value}${metric.unit}</div>
                <div class="metric-label">${metric.label}</div>
            </div>
        `).join('');
    }

    renderCharts() {
        this.renderRiskDistributionChart();
        this.renderInterventionTypesChart();
        this.renderTimeSeriesChart();
    }

    renderRiskDistributionChart() {
        const dashboard = this.data.dashboardData;
        if (!dashboard || !dashboard.riskDistribution) return;

        const ctx = document.getElementById('risk-distribution-chart').getContext('2d');
        this.charts.riskDistribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: dashboard.riskDistribution.map(item => item.level),
                datasets: [{
                    data: dashboard.riskDistribution.map(item => item.count),
                    backgroundColor: ['#dc2626', '#ea580c', '#ca8a04', '#16a34a'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#cbd5e1' }
                    }
                }
            }
        });
    }

    renderInterventionTypesChart() {
        const dashboard = this.data.dashboardData;
        if (!dashboard || !dashboard.interventionTypes) return;

        const ctx = document.getElementById('intervention-types-chart').getContext('2d');
        this.charts.interventionTypes = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dashboard.interventionTypes.map(item => item.type),
                datasets: [{
                    label: 'Count',
                    data: dashboard.interventionTypes.map(item => item.count),
                    backgroundColor: '#ffb86c',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#cbd5e1' }
                    },
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#cbd5e1' }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    renderTimeSeriesChart() {
        const predictive = this.data.predictiveAnalysis;
        if (!predictive || !predictive.forecastData) return;

        const ctx = document.getElementById('timeseries-chart').getContext('2d');
        const years = predictive.forecastData.map(item => item.year);
        const riskScores = predictive.forecastData.map(item => item.averageRiskScore);

        this.charts.timeSeries = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: [{
                    label: 'Average Risk Score',
                    data: riskScores,
                    borderColor: '#ffb86c',
                    backgroundColor: 'rgba(255, 184, 108, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#cbd5e1' }
                    },
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#cbd5e1' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#cbd5e1' }
                    }
                }
            }
        });
    }

    renderPredictive() {
        this.renderForecastChart();
        this.renderForecastDetails();
        this.renderCriticalZonesProjection();
    }

    renderForecastChart() {
        const predictive = this.data.predictiveAnalysis;
        if (!predictive || !predictive.forecastData) return;

        const ctx = document.getElementById('forecast-chart').getContext('2d');
        const years = predictive.forecastData.map(item => item.year);
        const riskScores = predictive.forecastData.map(item => item.averageRiskScore);

        this.charts.forecast = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: [{
                    label: 'Projected Risk Score',
                    data: riskScores,
                    borderColor: '#dc2626',
                    backgroundColor: 'rgba(220, 38, 38, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#cbd5e1' }
                    },
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#cbd5e1' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#cbd5e1' }
                    }
                }
            }
        });
    }

    renderForecastDetails() {
        const predictive = this.data.predictiveAnalysis;
        if (!predictive) return;

        const container = document.getElementById('forecast-details');
        container.innerHTML = `
            <div class="metric-grid">
                <div class="metric-card">
                    <div class="metric-value">${predictive.keyInsights?.temperatureIncrease || 'N/A'}°C</div>
                    <div class="metric-label">Temperature Increase by 2030</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${predictive.keyInsights?.zonesAtRisk || 'N/A'}</div>
                    <div class="metric-label">Zones at High Risk</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${predictive.keyInsights?.populationAffected || 'N/A'}M</div>
                    <div class="metric-label">Population Affected</div>
                </div>
            </div>
        `;
    }

    renderCriticalZonesProjection() {
        const predictive = this.data.predictiveAnalysis;
        if (!predictive || !predictive.criticalZones) return;

        const container = document.getElementById('critical-zones-projection');
        container.innerHTML = predictive.criticalZones.map(zone => `
            <div class="scenario-card">
                <h4>${zone.zoneName}</h4>
                <p>Risk Score: ${zone.projectedRiskScore}/100</p>
                <p>Temperature Impact: +${zone.temperatureIncrease}°C</p>
                <p>Population: ${zone.populationAffected.toLocaleString()}</p>
            </div>
        `).join('');
    }

    renderScenarios() {
        this.renderScenarioCards();
        this.renderScenarioComparisonChart();
    }

    renderScenarioCards() {
        const scenarios = this.data.scenarioSimulation;
        if (!scenarios || !scenarios.scenarios) return;

        const container = document.getElementById('scenario-cards');
        container.innerHTML = scenarios.scenarios.map(scenario => `
            <div class="scenario-card ${scenario.recommended ? 'recommended' : ''}">
                <h4>${scenario.name}</h4>
                <p>${scenario.description}</p>
                <div class="metric-grid">
                    <div class="metric-card">
                        <div class="metric-value">${scenario.riskReduction}%</div>
                        <div class="metric-label">Risk Reduction</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">₹${scenario.cost}Cr</div>
                        <div class="metric-label">Investment</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${scenario.timeline}</div>
                        <div class="metric-label">Timeline</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderScenarioComparisonChart() {
        const scenarios = this.data.scenarioSimulation;
        if (!scenarios || !scenarios.scenarios) return;

        const ctx = document.getElementById('scenario-comparison-chart').getContext('2d');
        this.charts.scenarioComparison = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: scenarios.scenarios.map(s => s.name),
                datasets: [{
                    label: 'Risk Reduction (%)',
                    data: scenarios.scenarios.map(s => s.riskReduction),
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    pointBackgroundColor: '#22c55e'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#cbd5e1' },
                        pointLabels: { color: '#cbd5e1' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#cbd5e1' }
                    }
                }
            }
        });
    }

    renderSpatial() {
        this.initSpatialMap();
        this.renderSpatialDetails();
    }

    initSpatialMap() {
        const container = document.getElementById('map-container');
        if (!container) return;

        this.map = L.map('map-container').setView([13.0827, 80.2707], 10);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        this.addSpatialLayers();
    }

    addSpatialLayers() {
        const spatial = this.data.spatialAnalysis;
        const geojson = this.data.wards;

        if (!spatial || !geojson) return;

        L.geoJSON(geojson, {
            style: (feature) => {
                const zoneName = feature.properties?.name || feature.properties?.ward_name;
                const zoneData = spatial.hotspots?.find(h => h.zoneName === zoneName);

                let color = '#16a34a'; // default green
                if (zoneData) {
                    if (zoneData.riskLevel === 'Critical') color = '#dc2626';
                    else if (zoneData.riskLevel === 'High') color = '#ea580c';
                    else if (zoneData.riskLevel === 'Moderate') color = '#ca8a04';
                }

                return {
                    fillColor: color,
                    weight: 2,
                    opacity: 1,
                    color: 'white',
                    fillOpacity: 0.7
                };
            },
            onEachFeature: (feature, layer) => {
                const zoneName = feature.properties?.name || feature.properties?.ward_name;
                const zoneData = spatial.hotspots?.find(h => h.zoneName === zoneName);

                let popupContent = `<b>${zoneName}</b><br>`;
                if (zoneData) {
                    popupContent += `Risk Level: ${zoneData.riskLevel}<br>`;
                    popupContent += `Heat Index: ${zoneData.heatIndex}<br>`;
                    popupContent += `Vulnerable Population: ${zoneData.vulnerablePopulation?.toLocaleString() || 'N/A'}<br>`;
                    if (zoneData.recommendations) {
                        popupContent += `<br><b>Recommendations:</b><br>${zoneData.recommendations.join('<br>')}`;
                    }
                }

                layer.bindPopup(popupContent);
            }
        }).addTo(this.map);
    }

    renderSpatialDetails() {
        const spatial = this.data.spatialAnalysis;
        if (!spatial) return;

        const container = document.getElementById('spatial-details');
        container.innerHTML = `
            <div class="metric-grid">
                <div class="metric-card">
                    <div class="metric-value">${spatial.hotspots?.length || 0}</div>
                    <div class="metric-label">Identified Hotspots</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${spatial.mitigationZones?.length || 0}</div>
                    <div class="metric-label">Mitigation Zones</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${spatial.totalArea || 'N/A'}</div>
                    <div class="metric-label">Total Area (km²)</div>
                </div>
            </div>
        `;
    }

    renderRecommendations() {
        this.renderPriorityFramework();
        this.renderImmediateActions();
        this.renderBudgetOptimization();
    }

    renderPriorityFramework() {
        const ai = this.data.aiDecisionSupport;
        if (!ai || !ai.priorityFramework) return;

        const container = document.getElementById('priority-framework');
        container.innerHTML = ai.priorityFramework.map(priority => `
            <div class="scenario-card">
                <h4 class="priority-badge priority-${priority.level}">${priority.level}</h4>
                <h4>${priority.category}</h4>
                <p>${priority.description}</p>
                <p><strong>Timeline:</strong> ${priority.timeline}</p>
                <p><strong>Budget:</strong> ₹${priority.budget} Cr</p>
            </div>
        `).join('');
    }

    renderImmediateActions() {
        const ai = this.data.aiDecisionSupport;
        if (!ai || !ai.immediateActions) return;

        const container = document.getElementById('immediate-actions');
        container.innerHTML = ai.immediateActions.map(action => `
            <div class="recommendation-item">
                <div class="recommendation-icon rec-${action.priority}">${action.priority[0].toUpperCase()}</div>
                <div>
                    <strong>${action.action}</strong>
                    <p>${action.description}</p>
                    <small>Impact: ${action.expectedImpact}</small>
                </div>
            </div>
        `).join('');
    }

    renderBudgetOptimization() {
        const ai = this.data.aiDecisionSupport;
        if (!ai || !ai.budgetOptimization) return;

        const container = document.getElementById('budget-optimization');
        container.innerHTML = `
            <div class="metric-grid">
                <div class="metric-card">
                    <div class="metric-value">₹${ai.budgetOptimization.totalBudget} Cr</div>
                    <div class="metric-label">Total Recommended Budget</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${ai.budgetOptimization.roi}%</div>
                    <div class="metric-label">Expected ROI</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${ai.budgetOptimization.paybackPeriod}</div>
                    <div class="metric-label">Payback Period</div>
                </div>
            </div>
            <div class="recommendation-list">
                <h4>Funding Strategy</h4>
                <p>${ai.budgetOptimization.strategy}</p>
            </div>
        `;
    }

    getRiskClass(riskLevel) {
        const classes = {
            'Critical': 'risk-critical',
            'High': 'risk-high',
            'Moderate': 'risk-moderate',
            'Low': 'risk-low'
        };
        return classes[riskLevel] || 'risk-low';
    }

    showError(message) {
        const container = document.querySelector('.dashboard-grid');
        if (container) {
            container.innerHTML = `
                <div class="dashboard-card">
                    <h3>Error Loading Dashboard</h3>
                    <p>${message}</p>
                    <p>Please check that all analysis files are present in the analysis-output folder.</p>
                </div>
            `;
        }
    }
}

// Tab switching functionality
function showTab(tabName, event) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Remove active class from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tabName).classList.add('active');

    // Add active class to clicked button
    if (event?.target) {
        event.target.classList.add('active');
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DashboardController();
});