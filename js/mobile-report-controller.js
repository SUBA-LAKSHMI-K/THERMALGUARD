class MobileReportController {
    constructor() {
        this.data = {};
        this.charts = {};
        this.init();
    }

    async init() {
        this.showLoading();
        try {
            await this.loadAllData();
            this.renderExecutiveSummary();
            this.renderKeyMetrics();
            this.renderZoneAnalysis();
            this.renderScenarioAnalysis();
            this.renderForecast();
            this.renderRecommendations();
            this.hideLoading();
        } catch (error) {
            console.error('Mobile report initialization failed:', error);
            this.hideLoading();
            this.showError('Failed to load report data');
        }
    }

    async loadAllData() {
        const files = [
            'analysis-output/executive-summary.json',
            'analysis-output/dashboardData.json',
            'analysis-output/spatialAnalysis.json',
            'analysis-output/scenarioSimulation.json',
            'analysis-output/predictiveAnalysis.json',
            'analysis-output/aiDecisionSupport.json'
        ];

        for (const file of files) {
            try {
                const response = await fetch(file);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const fileName = file.split('/').pop().split('.')[0];
                this.data[fileName] = await response.json();
            } catch (error) {
                console.warn(`Failed to load ${file}:`, error);
                this.data[file.split('/').pop().split('.')[0]] = {};
            }
        }
    }

    renderExecutiveSummary() {
        const summary = this.data['executive-summary'];
        if (!summary) return;

        const container = document.getElementById('executive-summary');
        container.innerHTML = `
            <div class="summary-title">Executive Summary</div>
            <div class="summary-content">
                ${summary.summary || 'Analysis summary not available.'}
            </div>
        `;
    }

    renderKeyMetrics() {
        const dashboard = this.data.dashboardData;
        if (!dashboard) return;

        const metrics = [
            {
                label: 'Current Risk',
                value: dashboard.currentRiskScore || 71,
                unit: '/100',
                trend: dashboard.riskReduction ? 'negative' : 'neutral'
            },
            {
                label: '2030 Projection',
                value: dashboard.projectedRiskScore || 56,
                unit: '/100',
                trend: 'positive'
            },
            {
                label: 'Risk Reduction',
                value: dashboard.riskReduction || 21,
                unit: '%',
                trend: 'positive'
            },
            {
                label: 'Investment Needed',
                value: '₹160',
                unit: ' Cr',
                trend: 'neutral'
            },
            {
                label: 'Critical Zones',
                value: dashboard.criticalZones || 5,
                unit: '',
                trend: 'negative'
            },
            {
                label: 'Population Protected',
                value: dashboard.populationProtected || '2.1M',
                unit: '',
                trend: 'positive'
            }
        ];

        const container = document.getElementById('key-metrics');
        container.innerHTML = metrics.map(metric => `
            <div class="metric-card">
                <div class="metric-value">${metric.value}${metric.unit}</div>
                <div class="metric-label">${metric.label}</div>
                ${metric.trend !== 'neutral' ? `<div class="metric-trend trend-${metric.trend}">↗</div>` : ''}
            </div>
        `).join('');
    }

    renderZoneAnalysis() {
        const spatial = this.data.spatialAnalysis;
        if (!spatial || !spatial.hotspots) return;

        const container = document.getElementById('zone-analysis');
        container.innerHTML = spatial.hotspots.slice(0, 10).map(zone => {
            const riskClass = this.getRiskClass(zone.riskLevel);
            return `
                <div class="zone-card ${riskClass}">
                    <div class="zone-name">${zone.zoneName}</div>
                    <div class="zone-risk risk-${riskClass}">${zone.riskLevel}</div>
                    <div class="zone-details">
                        <div class="zone-detail"><strong>Heat Index:</strong> ${zone.heatIndex}/100</div>
                        <div class="zone-detail"><strong>Vulnerable:</strong> ${zone.vulnerablePopulation?.toLocaleString() || 'N/A'}</div>
                        <div class="zone-detail"><strong>Temp:</strong> ${zone.temperature || 'N/A'}°C</div>
                        <div class="zone-detail"><strong>Priority:</strong> ${zone.priority || 'N/A'}</div>
                    </div>
                    ${zone.recommendations ? `
                        <div class="zone-recommendations">
                            <div class="recommendations-title">Key Actions</div>
                            ${zone.recommendations.slice(0, 2).map(rec => `
                                <div class="recommendation-item">
                                    <div class="recommendation-icon rec-immediate">•</div>
                                    <div class="recommendation-text">${rec}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    renderScenarioAnalysis() {
        const scenarios = this.data.scenarioSimulation;
        if (!scenarios || !scenarios.scenarios) return;

        const container = document.getElementById('scenario-analysis');
        container.innerHTML = scenarios.scenarios.map(scenario => `
            <div class="scenario-card ${scenario.recommended ? 'recommended' : ''}">
                <div class="scenario-name">${scenario.name}</div>
                <div class="scenario-description">${scenario.description}</div>
                <div class="scenario-metrics">
                    <div class="scenario-metric">
                        <span class="scenario-metric-value">${scenario.riskReduction}%</span>
                        <span class="scenario-metric-label">Risk Reduction</span>
                    </div>
                    <div class="scenario-metric">
                        <span class="scenario-metric-value">₹${scenario.cost}Cr</span>
                        <span class="scenario-metric-label">Investment</span>
                    </div>
                    <div class="scenario-metric">
                        <span class="scenario-metric-value">${scenario.timeline}</span>
                        <span class="scenario-metric-label">Timeline</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderForecast() {
        const predictive = this.data.predictiveAnalysis;
        if (!predictive || !predictive.forecastData) return;

        // Render chart
        this.renderForecastChart();

        // Render details
        const container = document.getElementById('forecast-details');
        const forecastData = predictive.forecastData;
        const currentYear = forecastData[0];
        const finalYear = forecastData[forecastData.length - 1];

        container.innerHTML = `
            <div style="margin-top: 16px;">
                <div class="zone-card">
                    <div class="zone-name">Forecast Summary</div>
                    <div class="zone-details">
                        <div class="zone-detail"><strong>2026 Risk Score:</strong> ${currentYear.averageRiskScore}/100</div>
                        <div class="zone-detail"><strong>2030 Risk Score:</strong> ${finalYear.averageRiskScore}/100</div>
                        <div class="zone-detail"><strong>Total Reduction:</strong> ${currentYear.averageRiskScore - finalYear.averageRiskScore} points</div>
                        <div class="zone-detail"><strong>Temperature Increase:</strong> ${predictive.keyInsights?.temperatureIncrease || 'N/A'}°C</div>
                    </div>
                </div>

                ${predictive.criticalZones ? `
                    <div class="zone-card">
                        <div class="zone-name">Critical Zones by 2030</div>
                        ${predictive.criticalZones.slice(0, 3).map(zone => `
                            <div class="zone-details" style="margin-top: 8px;">
                                <div class="zone-detail"><strong>${zone.zoneName}:</strong> ${zone.projectedRiskScore}/100</div>
                                <div class="zone-detail"><strong>Population:</strong> ${zone.populationAffected?.toLocaleString() || 'N/A'}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
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
                    label: 'Risk Score',
                    data: riskScores,
                    borderColor: '#ffb86c',
                    backgroundColor: 'rgba(255, 184, 108, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#ffb86c',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#cbd5e1', font: { size: 12 } }
                    },
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#cbd5e1', font: { size: 12 } }
                    }
                },
                elements: {
                    point: {
                        radius: 6,
                        hoverRadius: 8
                    }
                }
            }
        });
    }

    renderRecommendations() {
        const ai = this.data.aiDecisionSupport;
        if (!ai) return;

        const container = document.getElementById('ai-recommendations');

        let html = '';

        // Priority Framework
        if (ai.priorityFramework) {
            html += `
                <div class="zone-card">
                    <div class="zone-name">Priority Action Framework</div>
                    ${ai.priorityFramework.map(priority => `
                        <div style="margin-bottom: 12px; padding: 8px; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <strong style="color: #ffb86c;">${priority.category}</strong>
                                <span class="zone-risk risk-critical">${priority.level}</span>
                            </div>
                            <div style="font-size: 12px; color: #cbd5e1; margin-bottom: 4px;">${priority.description}</div>
                            <div style="font-size: 11px; color: #94a3b8;">
                                Timeline: ${priority.timeline} | Budget: ₹${priority.budget} Cr
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // Immediate Actions
        if (ai.immediateActions) {
            html += `
                <div class="zone-card">
                    <div class="zone-name">Immediate Actions Required</div>
                    ${ai.immediateActions.map(action => `
                        <div class="recommendation-item">
                            <div class="recommendation-icon rec-${action.priority}">${action.priority[0].toUpperCase()}</div>
                            <div class="recommendation-text">
                                <strong>${action.action}</strong><br>
                                ${action.description}<br>
                                <small style="color: #94a3b8;">Impact: ${action.expectedImpact}</small>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // Budget Optimization
        if (ai.budgetOptimization) {
            html += `
                <div class="zone-card">
                    <div class="zone-name">Budget Optimization</div>
                    <div class="zone-details">
                        <div class="zone-detail"><strong>Total Budget:</strong> ₹${ai.budgetOptimization.totalBudget} Cr</div>
                        <div class="zone-detail"><strong>Expected ROI:</strong> ${ai.budgetOptimization.roi}%</div>
                        <div class="zone-detail"><strong>Payback Period:</strong> ${ai.budgetOptimization.paybackPeriod}</div>
                    </div>
                    <div style="margin-top: 12px; padding: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
                        <strong style="color: #ffb86c;">Funding Strategy:</strong><br>
                        <span style="font-size: 12px; color: #cbd5e1;">${ai.budgetOptimization.strategy}</span>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    getRiskClass(riskLevel) {
        const classes = {
            'Critical': 'critical',
            'High': 'high',
            'Moderate': 'moderate',
            'Low': 'low'
        };
        return classes[riskLevel] || 'low';
    }

    showLoading() {
        document.getElementById('loading-overlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loading-overlay').style.display = 'none';
    }

    showError(message) {
        const container = document.querySelector('.mobile-report');
        if (container) {
            container.innerHTML += `
                <div class="executive-summary">
                    <div class="summary-title">Error Loading Report</div>
                    <div class="summary-content">${message}</div>
                </div>
            `;
        }
    }
}

// Section toggle functionality
function toggleSection(sectionId) {
    const content = document.getElementById(sectionId + '-content');
    const toggle = content.previousElementSibling.querySelector('.section-toggle');

    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        toggle.style.transform = 'rotate(0deg)';
    } else {
        content.classList.add('expanded');
        toggle.style.transform = 'rotate(180deg)';
    }
}

// Initialize mobile report when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MobileReportController();
});