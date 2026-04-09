/* ============================================
   THERMALGUARD SIMULATION ENGINE
   ============================================ */

// State Management
const state = {
    wards: [],
    currentWard: null,
    currentWardIndex: -1,
    baselineMetrics: null,
    simulationState: {
        treeIncrease: 0,
        roofIncrease: 0
    },
    chart: null,
    animationIds: {}
};

// Constants
const TREE_IMPACT = {
    ndvi: 0.3,          // NDVI increase per 10% tree cover
    tempReduction: 0.15, // Temp reduction per 10% tree cover
    riskReduction: 0.4   // Risk reduction per 10% tree cover
};

const ROOF_IMPACT = {
    tempReduction: 0.2,  // Temp reduction per 10% cool roof
    riskReduction: 0.25  // Risk reduction per 10% cool roof
};

// ============================================
// INITIALIZATION
// ============================================

async function initDashboard() {
    try {
        console.log('🚀 Initializing ThermalGuard Simulation Dashboard...');
        
        // Load wards data
        state.wards = await loadWards();
        console.log(`✅ Loaded ${state.wards.length} wards`);

        // Populate ward dropdown
        populateWardDropdown();

        // Setup event listeners
        setupEventListeners();

        // Initialize chart
        initializeChart();

        // Auto-select first ward
        if (state.wards.length > 0) {
            selectWard(0);
            document.getElementById('wardSelect').value = 0;
        }

        // Fade out loading overlay
        setTimeout(() => {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                overlay.style.opacity = '0';
                overlay.style.pointerEvents = 'none';
            }
        }, 200);

        console.log('✨ Dashboard initialized successfully!');
    } catch (error) {
        console.error('❌ Dashboard initialization failed:', error);
        showError('Failed to load simulation dashboard. Please refresh the page.');
    }
}

// ============================================
// WARD MANAGEMENT
// ============================================

function populateWardDropdown() {
    const select = document.getElementById('wardSelect');
    select.innerHTML = '';

    state.wards.forEach((ward, index) => {
        const option = document.createElement('option');
        const wardName = getWardNameFromFeature(ward);
        option.value = index;
        option.textContent = wardName;
        select.appendChild(option);
    });
}

function getWardNameFromFeature(feature) {
    const props = feature.properties || {};
    return props.name || props.NAME || props.ward || props.WARD || 'Unknown Ward';
}

function selectWard(index) {
    if (index < 0 || index >= state.wards.length) return;

    state.currentWardIndex = index;
    state.currentWard = state.wards[index];

    // Reset sliders
    resetSimulation();

    // Extract baseline metrics
    extractBaselineMetrics();

    // Animate ward metrics display
    updateWardMetricsDisplay();

    // Generate AI insights
    generateAIInsights();

    // Update all visualizations
    updateAllVisualizations();
}

function extractBaselineMetrics() {
    const props = state.currentWard.properties || {};

    state.baselineMetrics = {
        temperature: props.avg_surface_temp_c || 32 + Math.random() * 8,
        ndvi: props.ndvi_score || 0.3 + Math.random() * 0.3,
        treeCover: props.tree_canopy_pct || 10 + Math.random() * 20,
        greenCover: props.green_cover_pct || 15 + Math.random() * 25,
        builtUp: props.impervious_surface_pct || 50 + Math.random() * 30,
        riskScore: props.heat_risk_score || 50 + Math.random() * 30,
        wardName: getWardNameFromFeature(state.currentWard),
        population: props.population || Math.floor(100000 + Math.random() * 200000)
    };

    console.log('📊 Baseline Metrics:', state.baselineMetrics);
}

function updateWardMetricsDisplay() {
    if (!state.baselineMetrics) return;

    const metrics = state.baselineMetrics;
    const metricsDiv = document.getElementById('wardMetrics');
    
    // Animate metric values
    animateValue('temperature', `${metrics.temperature.toFixed(1)}°C`, 600);
    animateValue('ndvi', metrics.ndvi.toFixed(2), 600);
    animateValue('builtup', `${metrics.builtUp.toFixed(0)}%`, 600);
    animateValue('risk', getRiskCategory(metrics.riskScore), 600);

    // Remove loading class
    metricsDiv.querySelectorAll('.metric-loading').forEach(m => {
        m.classList.remove('metric-loading');
        m.classList.add('fade-in-1');
    });
}

// ============================================
// ANIMATION UTILITIES
// ============================================

function animateValue(type, targetValue, duration = 600) {
    let element;
    
    switch(type) {
        case 'temperature':
            element = document.querySelector('.metric:nth-child(1) .metric-value');
            break;
        case 'ndvi':
            element = document.querySelector('.metric:nth-child(2) .metric-value');
            break;
        case 'builtup':
            element = document.querySelector('.metric:nth-child(3) .metric-value');
            break;
        case 'risk':
            element = document.querySelector('.risk-badge .metric-value');
            break;
    }

    if (!element) return;

    element.style.animation = 'none';
    setTimeout(() => {
        element.textContent = targetValue;
        element.style.animation = 'fadeInScale 0.6s ease-out';
        element.classList.add('number-animate');
    }, 10);
}

function getRiskCategory(score) {
    score = Math.min(100, Math.max(0, score));
    if (score <= 20) return 'Safe';
    if (score <= 40) return 'Moderate';
    if (score <= 60) return 'High';
    if (score <= 80) return 'Severe';
    return 'Critical';
}

function getRiskColor(score) {
    score = Math.min(100, Math.max(0, score));
    if (score <= 20) return '#00ff88';      // Green
    if (score <= 40) return '#00d4ff';      // Cyan
    if (score <= 60) return '#ffaa33';      // Orange
    if (score <= 80) return '#ff6b35';      // Orange-Red
    return '#ff3366';                       // Red
}

// ============================================
// SIMULATION CALCULATIONS
// ============================================

function calculateSimulatedMetrics() {
    if (!state.baselineMetrics) return null;

    const { treeIncrease, roofIncrease } = state.simulationState;
    const base = state.baselineMetrics;

    // Calculate impacts
    const treeNormalized = treeIncrease / 50; // Normalize 0-50 to 0-1
    const roofNormalized = roofIncrease / 50;

    // New metrics
    const newNdvi = Math.min(1, base.ndvi + (treeNormalized * TREE_IMPACT.ndvi));
    const newGreenCover = Math.min(100, base.greenCover + (treeNormalized * 30));
    const newBuiltUp = Math.max(0, base.builtUp - (roofNormalized * 15));

    // Temperature reduction
    const treeTemp = treeNormalized * TREE_IMPACT.tempReduction * 5;
    const roofTemp = roofNormalized * ROOF_IMPACT.tempReduction * 5;
    const newTemperature = Math.max(base.temperature - treeTemp - roofTemp, base.temperature - 8);

    // Risk reduction
    const treeRisk = treeNormalized * TREE_IMPACT.riskReduction * 40;
    const roofRisk = roofNormalized * ROOF_IMPACT.riskReduction * 40;
    const newRiskScore = Math.max(0, base.riskScore - treeRisk - roofRisk);

    return {
        temperature: newTemperature,
        ndvi: newNdvi,
        greenCover: newGreenCover,
        builtUp: newBuiltUp,
        riskScore: newRiskScore,
        treeCover: Math.min(100, base.treeCover + treeIncrease),
        wardName: base.wardName
    };
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Ward selector
    document.getElementById('wardSelect').addEventListener('change', (e) => {
        selectWard(parseInt(e.target.value));
    });

    // Tree slider
    const treeSlider = document.getElementById('treeSlider');
    treeSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        state.simulationState.treeIncrease = value;
        
        // Update label
        document.getElementById('treeValueLabel').textContent = `${value}%`;
        document.getElementById('treeValue').textContent = `${value}%`;
        
        // Update visualizations
        updateAllVisualizations();
        generateAIInsights();
    });

    // Roof slider
    const roofSlider = document.getElementById('roofSlider');
    roofSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        state.simulationState.roofIncrease = value;
        
        // Update label
        document.getElementById('roofValueLabel').textContent = `${value}%`;
        document.getElementById('roofValue').textContent = `${value}%`;
        
        // Update visualizations
        updateAllVisualizations();
        generateAIInsights();
    });

    // Reset button
    document.getElementById('resetButton').addEventListener('click', resetSimulation);
}

function resetSimulation() {
    state.simulationState = {
        treeIncrease: 0,
        roofIncrease: 0
    };

    document.getElementById('treeSlider').value = 0;
    document.getElementById('roofSlider').value = 0;
    document.getElementById('treeValueLabel').textContent = '0%';
    document.getElementById('treeValue').textContent = '0%';
    document.getElementById('roofValueLabel').textContent = '0%';
    document.getElementById('roofValue').textContent = '0%';

    updateAllVisualizations();
    generateAIInsights();
}

// ============================================
// VISUALIZATION UPDATES
// ============================================

function updateAllVisualizations() {
    const simulated = calculateSimulatedMetrics();
    if (!simulated) return;

    updateComparisonCards(simulated);
    updateImpactMetrics(simulated);
    updateGauge(simulated);
    updateChart(simulated);
}

function updateComparisonCards(simulated) {
    const base = state.baselineMetrics;

    // Before values
    animateNumberUpdate('beforeTemp', base.temperature.toFixed(1), '°C', 400);
    animateNumberUpdate('beforeRisk', base.riskScore.toFixed(0), '%', 400);
    animateNumberUpdate('beforeVeg', (base.treeCover + base.greenCover).toFixed(0), '%', 400);

    // After values
    animateNumberUpdate('afterTemp', simulated.temperature.toFixed(1), '°C', 400);
    animateNumberUpdate('afterRisk', simulated.riskScore.toFixed(0), '%', 400);
    animateNumberUpdate('afterVeg', (simulated.treeCover + simulated.greenCover).toFixed(0), '%', 400);
}

function updateImpactMetrics(simulated) {
    const base = state.baselineMetrics;

    const tempReduction = base.temperature - simulated.temperature;
    const riskReduction = ((base.riskScore - simulated.riskScore) / base.riskScore * 100);
    const vegGain = (simulated.treeCover - base.treeCover) + (simulated.greenCover - base.greenCover);

    animateNumberUpdate('tempReduction', tempReduction.toFixed(1), '°C', 400);
    animateNumberUpdate('riskReduction', Math.max(0, riskReduction).toFixed(0), '%', 400);
    animateNumberUpdate('vegGain', vegGain.toFixed(0), '%', 400);
}

function animateNumberUpdate(elementId, value, suffix, duration) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.style.animation = 'none';
    setTimeout(() => {
        element.textContent = value + suffix;
        element.classList.remove('color-transition');
        element.offsetHeight; // Trigger reflow
        element.classList.add('color-transition');
        element.style.animation = 'fadeInScale 0.4s ease-out';
    }, 10);
}

function updateGauge(simulated) {
    const percentage = Math.min(100, Math.max(0, simulated.riskScore));
    
    // Needle rotation: 0% = -90deg (left/LOW), 100% = 90deg (right/HIGH)
    // This creates a 180-degree sweep across the semicircle
    const angle = (percentage / 100) * 180 - 90;
    
    const needle = document.getElementById('gaugeNeedle');
    if (needle) {
        needle.style.transition = 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
        needle.style.transform = `rotate(${angle}deg)`;
    }

    // Update gauge label with percentage
    const gaugeLabel = document.getElementById('gaugeLabel');
    if (gaugeLabel) {
        gaugeLabel.textContent = `${Math.round(percentage)}%`;
        gaugeLabel.style.animation = 'none';
        gaugeLabel.offsetHeight; // Trigger reflow
        gaugeLabel.style.animation = 'fadeInScale 0.4s ease-out';
    }

    // Update sublabel with risk category
    const gaugeSublabel = document.getElementById('gaugeSublabel');
    if (gaugeSublabel) {
        const category = getRiskCategory(percentage);
        gaugeSublabel.textContent = category;
        gaugeSublabel.style.animation = 'none';
        gaugeSublabel.offsetHeight; // Trigger reflow
        gaugeSublabel.style.animation = 'fadeInScale 0.4s ease-out 0.1s both';
    }
}

// ============================================
// CHART MANAGEMENT
// ============================================

function initializeChart() {
    const ctx = document.getElementById('impactChart');
    if (!ctx) return;

    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(255, 107, 53, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 107, 53, 0.1)');

    const gradientAfter = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
    gradientAfter.addColorStop(0, 'rgba(0, 255, 136, 0.8)');
    gradientAfter.addColorStop(1, 'rgba(0, 255, 136, 0.1)');

    state.chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Temperature', 'Risk Score', 'Green Cover', 'Built-up Area'],
            datasets: [
                {
                    label: 'Current State',
                    data: [0, 0, 0, 0],
                    backgroundColor: 'rgba(255, 170, 51, 0.7)',
                    borderColor: 'rgba(255, 170, 51, 1)',
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false,
                    animation: {
                        duration: 600,
                        easing: 'easeInOutQuart'
                    }
                },
                {
                    label: 'Simulated Outcome',
                    data: [0, 0, 0, 0],
                    backgroundColor: 'rgba(0, 255, 136, 0.7)',
                    borderColor: 'rgba(0, 255, 136, 1)',
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false,
                    animation: {
                        duration: 600,
                        easing: 'easeInOutQuart'
                    }
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: '#b0b9d9',
                        font: {
                            size: 12,
                            weight: '600'
                        },
                        padding: 16,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(10, 14, 39, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#b0b9d9',
                    borderColor: 'rgba(255, 107, 53, 0.3)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(1);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(255, 107, 53, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#b0b9d9',
                        font: {
                            size: 11
                        },
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                },
                x: {
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        color: '#b0b9d9',
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });

    updateChart(calculateSimulatedMetrics());
}

function updateChart(simulated) {
    if (!state.chart) return;

    const base = state.baselineMetrics;

    // Normalize values to 0-100 scale for visualization
    const beforeData = [
        (base.temperature / 40) * 100,
        base.riskScore,
        base.treeCover + base.greenCover,
        base.builtUp
    ];

    const afterData = [
        (simulated.temperature / 40) * 100,
        simulated.riskScore,
        simulated.treeCover + simulated.greenCover,
        simulated.builtUp
    ];

    state.chart.data.datasets[0].data = beforeData;
    state.chart.data.datasets[1].data = afterData;
    state.chart.update('active');
}

// ============================================
// AI INSIGHTS GENERATION
// ============================================

const insightTemplates = {
    high_risk: [
        "This ward faces significant urban heat island effects. Tree cover increase would be the most impactful intervention.",
        "High risk areas like this require immediate intervention. Focus on vegetation restoration and cool roofs.",
        "The built-up density in this ward is driving heat risk. Cool roof adoption would provide tangible relief.",
        "With current infrastructure, heat vulnerability is elevated. Simulate green infrastructure solutions for impact."
    ],
    moderate_risk: [
        "This ward shows moderate heat risk. Balanced interventions combining trees and cool roofs would optimize outcomes.",
        "Current conditions allow for strategic placement of green infrastructure. Both tree cover and roofs matter here.",
        "Moderate risk zones benefit from coordinated climate adaptation. This simulation shows realistic intervention paths."
    ],
    low_risk: [
        "This ward is relatively safe from excessive heat. Maintain green cover and continue best practices.",
        "Low heat risk here means existing vegetation and infrastructure are working well together.",
        "Preventive measures in low-risk areas help maintain resilience. Small improvements = big impact over time."
    ],
    tree_impact: [
        "Tree canopy expansion is highly effective here. Each 10% increase provides cooling and health benefits.",
        "Green infrastructure investment in this ward shows strong returns in heat mitigation.",
        "Vegetation increase directly combats the urban heat island effect in this location."
    ],
    roof_impact: [
        "Cool roof adoption is a game-changer for this dense, built-up area.",
        "Reflective surfaces would significantly reduce surface temperatures in this zone.",
        "Cool roofs paired with vegetation would optimize thermal management here."
    ],
    population_impact: [
        `With a population of ${(state.baselineMetrics?.population / 1000).toFixed(0)}K residents, heat relief interventions here benefit large communities.`,
        `The ${(state.baselineMetrics?.population / 1000).toFixed(0)}K people in this ward would benefit from climate adaptation strategies.`
    ]
};

function generateAIInsights() {
    if (!state.baselineMetrics) return;

    const base = state.baselineMetrics;
    const simulated = calculateSimulatedMetrics();

    let insight = '';

    // Determine base risk category
    if (base.riskScore > 60) {
        insight = randomElement(insightTemplates.high_risk);
    } else if (base.riskScore > 40) {
        insight = randomElement(insightTemplates.moderate_risk);
    } else {
        insight = randomElement(insightTemplates.low_risk);
    }

    // Add specific intervention insights if sliders are active
    if (state.simulationState.treeIncrease > 0) {
        const tempEffect = (base.temperature - simulated.temperature).toFixed(1);
        insight += ` Projecting ${tempEffect}°C reduction from tree cover expansion.`;
    }

    if (state.simulationState.roofIncrease > 0) {
        insight += ` Cool roofs would further minimize heat absorption in built-up areas.`;
    }

    // Add population context occasionally
    if (Math.random() > 0.5 && base.population) {
        insight += ` ${randomElement(insightTemplates.population_impact)}`;
    }

    displayInsightWithTyping(insight);
}

function displayInsightWithTyping(text) {
    const insightsDiv = document.getElementById('insightsText');
    if (!insightsDiv) return;

    insightsDiv.innerHTML = '';
    const p = document.createElement('p');
    insightsDiv.appendChild(p);

    let charIndex = 0;
    const typingSpeed = 20; // milliseconds per character

    function typeNextChar() {
        if (charIndex < text.length) {
            p.textContent += text.charAt(charIndex);
            charIndex++;
            setTimeout(typeNextChar, typingSpeed);
        }
    }

    typeNextChar();
}

function randomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// ============================================
// ERROR HANDLING
// ============================================

function showError(message) {
    const div = document.createElement('div');
    div.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(255, 51, 102, 0.9);
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        font-weight: 600;
        z-index: 999;
        animation: slideDown 0.3s ease-out;
    `;
    div.textContent = message;
    document.body.appendChild(div);

    setTimeout(() => {
        div.style.animation = 'slideUp 0.3s ease-out';
        setTimeout(() => div.remove(), 300);
    }, 5000);
}

// ============================================
// INITIALIZE ON LOAD
// ============================================

document.addEventListener('DOMContentLoaded', initDashboard);

// Prevent memory leaks
window.addEventListener('beforeunload', () => {
    if (state.chart) {
        state.chart.destroy();
    }
});
