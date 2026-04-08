// NGO Portal - Impact Tracking & Data-Driven Intervention
const ngoFileInputContainer = document.getElementById('ngo-file-input-container');
let loadedWards = null;
let loadedNGOSummary = null;

window.addEventListener('load', async () => {
    await initNGOPortal();
});

async function initNGOPortal() {
    try {
        const [wards, ngoSummary] = await Promise.all([
            getHelper('loadWards')(),
            getHelper('loadNGOSummary')().catch(() => null)
        ]);
        loadedWards = wards;
        loadedNGOSummary = ngoSummary;
        await initNGOPortalWithWards(wards, ngoSummary);
    } catch (error) {
        console.error('Error initializing NGO portal:', error);
        showNGOError('⚠️ Error loading ward data. Please use the local file upload below.');
        showFileUpload('If you opened this page directly from disk, local file loading may be blocked by your browser.');
    }
}

async function initNGOPortalWithWards(wards, ngoSummary) {
    if (!wards || wards.length === 0) {
        showNGOError('No ward data available. Please upload wards.geojson to continue.');
        showFileUpload('Please select wards.geojson and NGO intervention data from your project folder.');
        return;
    }

    loadedWards = wards;
    loadedNGOSummary = ngoSummary;
    clearFileInput();
    if (!ngoSummary) {
        showFileUpload('Upload ngo.json or nog.json to enable NGO insights and government reporting.');
    }
    populateWardSelector(wards);
    displayHighRiskWards(wards);
    initProgramsTable(wards);
    updateImpactDashboard();
    displayStrategyRecommendations(wards);
    displayActiveNGOInterventions(wards, ngoSummary);
    displayNGOInsights(ngoSummary);
}

function getHelper(name) {
    const helpers = window.WardData;
    if (!helpers || typeof helpers[name] !== 'function') {
        throw new Error(`WardData helper missing: ${name}`);
    }
    return helpers[name];
}

function showNGOError(message) {
    document.getElementById('risk-wards-list').innerHTML = `<div class="error-card">${message}</div>`;
    document.getElementById('ngo-impact-stats').innerHTML = '';
    document.getElementById('active-programs-list').innerHTML = '';
    document.getElementById('ngo-active-ngos').innerHTML = '';
    document.getElementById('strategy-recommendations').innerHTML = '';
    document.getElementById('programs-table-body').innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;">Waiting for ward data...</td></tr>';
}

function clearFileInput() {
    if (ngoFileInputContainer) {
        ngoFileInputContainer.innerHTML = '';
    }
}

function showFileUpload(message) {
    if (!ngoFileInputContainer) return;
    ngoFileInputContainer.innerHTML = `
        <h3>Load Local Ward & NGO Data</h3>
        <p>${message}</p>
        <label class="file-upload-label">
            Select wards.geojson
            <input type="file" id="ngo-ward-file-input" accept=".json,.geojson" />
        </label>
        <label class="file-upload-label">
            Select ngo.json or nog.json
            <input type="file" id="ngo-data-file-input" accept=".json" />
        </label>
    `;

    const wardInput = document.getElementById('ngo-ward-file-input');
    const ngoInput = document.getElementById('ngo-data-file-input');

    wardInput?.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Show loading state
        const label = wardInput.closest('label');
        const originalText = label.textContent;
        label.textContent = `Loading ${file.name}...`;

        try {
            const wards = await getHelper('loadWardsFromFile')(file);
            loadedWards = wards;
            await initNGOPortalWithWards(wards, loadedNGOSummary);
            // Clear any previous error messages
            if (document.querySelector('.error-card')) {
                document.querySelector('.error-card').remove();
            }
            label.textContent = `✓ Loaded ${file.name}`;
            setTimeout(() => label.textContent = originalText, 2000);
        } catch (error) {
            console.error('Ward file upload error:', error);
            showNGOError(`Failed to load ward data: ${error.message}. Please ensure you're uploading a valid wards.geojson file.`);
            label.textContent = originalText;
        }
    });

    ngoInput?.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Show loading state
        const label = ngoInput.closest('label');
        const originalText = label.textContent;
        label.textContent = `Loading ${file.name}...`;

        try {
            const ngoSummary = await getHelper('loadNGOSummaryFromFile')(file);
            loadedNGOSummary = ngoSummary;
            displayActiveNGOInterventions(loadedWards || [], ngoSummary);
            displayNGOInsights(ngoSummary);
            // Clear any previous error messages
            if (document.querySelector('.error-card')) {
                document.querySelector('.error-card').remove();
            }
            label.textContent = `✓ Loaded ${file.name}`;
            setTimeout(() => label.textContent = originalText, 2000);
        } catch (error) {
            console.error('NGO file upload error:', error);
            showNGOError(`Failed to load NGO data: ${error.message}. Please ensure you're uploading a valid ngo.json or nog.json file.`);
            label.textContent = originalText;
        }
    });
}

function displayActiveNGOInterventions(wards, ngoSummary) {
    const container = document.getElementById('ngo-active-ngos');
    const activeNGOs = new Set();

    wards.forEach(ward => {
        const ngoActivity = getHelper('getWardNGOActivity')(ward);
        const interventions = getHelper('getWardInterventions')(ward);

        if (ngoActivity?.active_ngos) {
            ngoActivity.active_ngos.forEach(name => activeNGOs.add(name));
        }
        if (interventions?.programs) {
            interventions.programs.forEach(program => {
                if (program.ngo) activeNGOs.add(program.ngo);
            });
        }
    });

    const summaryNGOs = ngoSummary?.ngos?.map(item => item.name) || [];
    summaryNGOs.forEach(name => activeNGOs.add(name));

    if (activeNGOs.size === 0) {
        container.innerHTML = '<p style="color: #999;">No NGOs currently detected. Load ward and NGO data to identify intervening partners.</p>';
        return;
    }

    const items = Array.from(activeNGOs).sort().map(name => `<span class="ngo-tag">${name}</span>`).join(' ');
    container.innerHTML = `<div class="ngo-list">${items}</div>`;
}


function displayNGOInsights(ngoSummary) {
    const container = document.getElementById('strategy-recommendations');
    if (!ngoSummary || !ngoSummary.ngos) {
        container.innerHTML = '<div class="recommendation"><strong>📌 NGO summary data not loaded yet.</strong><br>Upload ngo.json or nog.json to view active NGO insights and program metrics.</div>';
        return;
    }

    const topNGOs = ngoSummary.ngos.slice(0, 5).map(ngo => {
        const programs = ngo.active_programs?.length || 0;
        return `
            <div class="recommendation">
                <strong>${ngo.name}</strong><br>
                ${ngo.specialty} · ${ngo.active_zones?.length || 0} zones · ${programs} active program${programs === 1 ? '' : 's'}
            </div>
        `;
    }).join('');

    const totalPartners = ngoSummary.ngos.length;
    const totalBudget = ngoSummary.ngos.reduce((sum, ngo) => sum + (ngo.total_budget_inr || 0), 0);

    container.innerHTML = `
        <div class="recommendation">
            <strong>📊 NGO Summary</strong><br>
            ${totalPartners} partner organizations identified, with ₹${totalBudget.toLocaleString()} total budget captured.
        </div>
        ${topNGOs}
    `;
}

function populateWardSelector(wards) {
    const selector = document.getElementById('program-ward');
    wards.forEach((ward, index) => {
        const option = document.createElement('option');
        const wardName = getHelper('getWardName')(ward);
        option.value = index;
        option.textContent = wardName;
        selector.appendChild(option);
    });
}

function displayHighRiskWards(wards) {
    const container = document.getElementById('risk-wards-list');
    
    // Get wards with their scores
    const wardsWithScores = wards.map((ward, idx) => ({
        index: idx,
        name: getHelper('getWardName')(ward),
        score: getHelper('getWardMetric')(ward),
        feature: ward
    }));
    
    // Sort by score descending
    wardsWithScores.sort((a, b) => b.score - a.score);
    
    // Display top 8 high-risk wards
    const topRisks = wardsWithScores.slice(0, 8);
    
    container.innerHTML = topRisks.map((ward, rank) => {
        const category = getHelper('getRiskCategory')(ward.score);
        const color = getHelper('getRiskColor')(ward.score);
        return `
            <div class="risk-ward-item" onclick="selectWardInForm(${ward.index})">
                <div class="risk-rank">#${rank + 1}</div>
                <div class="risk-info">
                    <div class="risk-name">${ward.name}</div>
                    <div class="risk-meter">
                        <div class="heat-bar" style="width: ${ward.score}%; background: ${color};"></div>
                    </div>
                    <div class="risk-score">${ward.score.toFixed(1)}° - <strong>${category}</strong></div>
                </div>
            </div>
        `;
    }).join('');
}

function selectWardInForm(wardIndex) {
    document.getElementById('program-ward').value = wardIndex;
    document.getElementById('program-ward').focus();
}

function submitIntervention(event) {
    event.preventDefault();
    
    const wardIndex = document.getElementById('program-ward').value;
    const programType = document.getElementById('program-type').value;
    const description = document.getElementById('program-description').value;
    const budget = document.getElementById('program-budget').value || 0;
    const status = document.getElementById('program-status').value;
    const startDate = document.getElementById('program-start').value;
    
    if (!wardIndex || !programType || !startDate) {
        alert('Please fill in all required fields.');
        return;
    }
    
    // Get programs from localStorage
    let programs = JSON.parse(localStorage.getItem('ngoPrograms') || '[]');
    
    const newProgram = {
        id: Date.now(),
        wardIndex: parseInt(wardIndex),
        wardSector: getWardSector(wardIndex),
        programType,
        description,
        budget: parseInt(budget),
        status,
        startDate,
        createdAt: new Date().toISOString(),
        impactMetrics: {
            estimatedTreeCount: programType === 'tree-planting' ? calculateTreeEstimate(budget) : 0,
            estimatedRoofArea: programType === 'cool-roof' ? calculateRoofEstimate(budget) : 0,
            estimatedHeatReduction: calculateHeatReduction(programType, budget)
        }
    };
    
    programs.push(newProgram);
    localStorage.setItem('ngoPrograms', JSON.stringify(programs));
    
    alert('✅ Program submitted successfully!');
    event.target.reset();
    updateImpactDashboard();
    initProgramsTable();
}

function getWardSector(wardIndex) {
    const sectors = ['Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5', 'Zone 6',
                     'Zone 7', 'Zone 8', 'Zone 9', 'Zone 10', 'Zone 11', 'Zone 12',
                     'Zone 13', 'Zone 14', 'Zone 15'];
    return sectors[wardIndex % sectors.length];
}

function calculateTreeEstimate(budget) {
    // Assuming ₹500-1000 per tree
    const averageCostPerTree = 750;
    return Math.floor(budget / averageCostPerTree);
}

function calculateRoofEstimate(budget) {
    // Assuming ₹300 per sq meter
    const costPerSqMeter = 300;
    return Math.floor(budget / costPerSqMeter);
}

function calculateHeatReduction(programType, budget) {
    // Estimate thermal reduction based on program type and budget
    const reductionMap = {
        'tree-planting': 0.15,      // 0.15°C per ₹1000
        'cool-roof': 0.25,          // 0.25°C per ₹1000
        'water-feature': 0.10,      // 0.10°C per ₹1000
        'ventilation': 0.08,        // 0.08°C per ₹1000
        'awareness': 0.02            // 0.02°C per ₹1000
    };
    
    const factor = reductionMap[programType] || 0.05;
    return (factor * budget / 1000).toFixed(2);
}

function updateImpactDashboard() {
    const programs = JSON.parse(localStorage.getItem('ngoPrograms') || '[]');
    const container = document.getElementById('ngo-impact-stats');
    
    let totalBudget = 0;
    let totalPrograms = 0;
    let completedPrograms = 0;
    let estimatedHeatReduction = 0;
    let totalTreesPlanted = 0;
    let totalRoofArea = 0;
    
    programs.forEach(prog => {
        totalBudget += prog.budget;
        totalPrograms += 1;
        if (prog.status === 'completed') completedPrograms += 1;
        estimatedHeatReduction += parseFloat(prog.impactMetrics.estimatedHeatReduction);
        totalTreesPlanted += prog.impactMetrics.estimatedTreeCount;
        totalRoofArea += prog.impactMetrics.estimatedRoofArea;
    });
    
    container.innerHTML = `
        <div class="stat-grid">
            <div class="stat-box">
                <div class="stat-value">${totalPrograms}</div>
                <div class="stat-label">Active Programs</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">${completedPrograms}/${totalPrograms}</div>
                <div class="stat-label">Completed</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">₹${(totalBudget/100000).toFixed(1)}L</div>
                <div class="stat-label">Total Investment</div>
            </div>
            <div class="stat-box" style="background: linear-gradient(135deg, #22c55e, #16a34a);">
                <div class="stat-value" style="color: white;">${estimatedHeatReduction}°C</div>
                <div class="stat-label" style="color: white;">Est. Heat Reduction</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">${totalTreesPlanted}</div>
                <div class="stat-label">🌳 Trees Estimated</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">${totalRoofArea.toLocaleString()} m²</div>
                <div class="stat-label">🏠 Cool Roofs Area</div>
            </div>
        </div>
    `;
    
    // Update active programs list
    updateActiveProgramsList(programs);
}

function updateActiveProgramsList(programs) {
    const container = document.getElementById('active-programs-list');
    const activeProps = programs.filter(p => p.status !== 'completed').slice(0, 5);
    
    if (activeProps.length === 0) {
        container.innerHTML = '<p style="color: #999;">No active programs yet.</p>';
        return;
    }
    
    container.innerHTML = activeProps.map((prog, idx) => {
        const typeIcons = {
            'tree-planting': '🌳',
            'cool-roof': '🏠',
            'water-feature': '💧',
            'ventilation': '💨',
            'awareness': '📢'
        };
        const icon = typeIcons[prog.programType] || '📍';
        const statusColor = prog.status === 'in-progress' ? '#ff6b35' : '#ffd700';
        
        return `
            <div class="program-badge" style="border-left: 4px solid ${statusColor};">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <div style="font-weight: bold;">${icon} ${prog.wardSector}</div>
                        <div style="font-size: 0.85em; color: #999;">${prog.status}</div>
                    </div>
                    <div style="text-align: right; font-size: 0.8em;">
                        <div>₹${(prog.budget/1000).toFixed(0)}K</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function displayStrategyRecommendations(wards) {
    const container = document.getElementById('strategy-recommendations');
    const programs = JSON.parse(localStorage.getItem('ngoPrograms') || '[]');
    
    // Get highest heat zones
    const wardsWithScores = wards.map((ward, idx) => ({
        name: getHelper('getWardName')(ward),
        score: getHelper('getWardMetric')(ward),
        index: idx
    }));
    
    wardsWithScores.sort((a, b) => b.score - a.score);
    const topHotZones = wardsWithScores.slice(0, 3);
    
    // Check coverage
    const interventionWards = new Set(programs.map(p => p.wardIndex));
    const uncovered = wardsWithScores.filter(w => !interventionWards.has(w.index)).slice(0, 2);
    
    const recommendations = [];
    
    if (uncovered.length > 0) {
        recommendations.push(`
            <div class="recommendation">
                <strong>🎯 Expansion Opportunity:</strong><br>
                ${uncovered[0].name} (${uncovered[0].score.toFixed(1)}°C) has no programs yet. Consider targeting this high-risk ward.
            </div>
        `);
    }
    
    if (topHotZones.some(z => interventionWards.has(z.index))) {
        recommendations.push(`
            <div class="recommendation">
                <strong>✅ Good Coverage:</strong><br>
                You're already focusing on high-risk zones. Continue this strategy.
            </div>
        `);
    }
    
    if (programs.filter(p => p.programType === 'tree-planting').length === 0 && programs.length > 0) {
        recommendations.push(`
            <div class="recommendation">
                <strong>💡 Recommendation:</strong><br>
                Tree planting is most cost-effective. Consider adding tree programs to maximize long-term impact.
            </div>
        `);
    }
    
    if (recommendations.length === 0) {
        recommendations.push(`
            <div class="recommendation">
                <strong>📊 Start Tracking:</strong><br>
                Begin by adding programs for the highest-risk wards listed above.
            </div>
        `);
    }
    
    container.innerHTML = recommendations.join('');
}

function displayActiveNGOInterventions(wards, ngoSummary) {
    const container = document.getElementById('ngo-active-ngos');
    const activeNGOs = new Set();

    wards.forEach(ward => {
        const ngoActivity = getHelper('getWardNGOActivity')(ward);
        const interventions = getHelper('getWardInterventions')(ward);

        if (ngoActivity?.active_ngos) {
            ngoActivity.active_ngos.forEach(name => activeNGOs.add(name));
        }
        if (interventions?.programs) {
            interventions.programs.forEach(program => {
                if (program.ngo) activeNGOs.add(program.ngo);
            });
        }
    });

    const summaryNGOs = ngoSummary?.ngos?.map(item => item.name) || [];
    summaryNGOs.forEach(name => activeNGOs.add(name));

    if (activeNGOs.size === 0) {
        container.innerHTML = '<p style="color: #999;">No NGOs currently detected. Load ward and NGO data to identify intervening partners.</p>';
        return;
    }

    const items = Array.from(activeNGOs).sort().map(name => `<span class="ngo-tag">${name}</span>`).join(' ');
    container.innerHTML = `<div class="ngo-list">${items}</div>`;
}

function initProgramsTable(wards) {
    const programs = JSON.parse(localStorage.getItem('ngoPrograms') || '[]');
    const tbody = document.getElementById('programs-table-body');
    
    if (programs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999;">No programs submitted yet.</td></tr>';
        return;
    }
    
    const wardsArray = wards || [];
    
    tbody.innerHTML = programs.map((prog, idx) => {
        const ward = wardsArray[prog.wardIndex];
        const wardName = ward ? getHelper('getWardName')(ward) : prog.wardSector;
        const typeIcons = {
            'tree-planting': '🌳',
            'cool-roof': '🏠',
            'water-feature': '💧',
            'ventilation': '💨',
            'awareness': '📢'
        };
        const icon = typeIcons[prog.programType] || '📍';
        const statusColor = {
            'planned': '#ffd700',
            'in-progress': '#ff6b35',
            'completed': '#22c55e'
        };
        
        return `
            <tr>
                <td>${wardName}</td>
                <td>${icon} ${prog.programType.replace('-', ' ')}</td>
                <td>
                    <span style="
                        background: ${statusColor[prog.status]};
                        color: ${prog.status === 'completed' ? 'white' : 'black'};
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 0.85em;
                        font-weight: bold;
                    ">${prog.status}</span>
                </td>
                <td>₹${prog.budget.toLocaleString()}</td>
                <td><strong>${prog.impactMetrics.estimatedHeatReduction}°C</strong></td>
                <td>
                    <button class="btn-small" onclick="editProgram(${idx})">✏️ Edit</button>
                    <button class="btn-small" onclick="deleteProgram(${idx})" style="background: #991b1b;">🗑️ Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

function editProgram(index) {
    const programs = JSON.parse(localStorage.getItem('ngoPrograms') || '[]');
    const prog = programs[index];
    
    if (!prog) return;
    
    document.getElementById('program-ward').value = prog.wardIndex;
    document.getElementById('program-type').value = prog.programType;
    document.getElementById('program-description').value = prog.description;
    document.getElementById('program-budget').value = prog.budget;
    document.getElementById('program-status').value = prog.status;
    document.getElementById('program-start').value = prog.startDate;
    
    deleteProgram(index);
    document.getElementById('program-ward').focus();
}

function deleteProgram(index) {
    if (!confirm('Are you sure you want to delete this program?')) return;
    
    let programs = JSON.parse(localStorage.getItem('ngoPrograms') || '[]');
    programs.splice(index, 1);
    localStorage.setItem('ngoPrograms', JSON.stringify(programs));
    
    updateImpactDashboard();
    initProgramsTable();
}

function exportImpactReport() {
    const programs = JSON.parse(localStorage.getItem('ngoPrograms') || '[]');
    
    if (programs.length === 0) {
        alert('No programs to export. Submit some interventions first!');
        return;
    }
    
    let report = '🌡️ THERMALGUARD NGO IMPACT REPORT\n';
    report += '=====================================\n\n';
    report += `Generated: ${new Date().toLocaleDateString()}\n\n`;
    
    let totalBudget = 0;
    let totalHeatReduction = 0;
    let totalTrees = 0;
    let totalRoof = 0;
    
    report += 'ACTIVE PROGRAMS:\n';
    report += '─────────────────\n';
    
    programs.forEach((prog, idx) => {
        report += `\n${idx + 1}. ${prog.wardSector} - ${prog.programType}\n`;
        report += `   Status: ${prog.status}\n`;
        report += `   Budget: ₹${prog.budget.toLocaleString()}\n`;
        report += `   Est. Heat Reduction: ${prog.impactMetrics.estimatedHeatReduction}°C\n`;
        
        totalBudget += prog.budget;
        totalHeatReduction += parseFloat(prog.impactMetrics.estimatedHeatReduction);
        totalTrees += prog.impactMetrics.estimatedTreeCount;
        totalRoof += prog.impactMetrics.estimatedRoofArea;
        
        if (prog.description) {
            report += `   Notes: ${prog.description}\n`;
        }
    });
    
    report += '\n\nCUMULATIVE IMPACT:\n';
    report += '──────────────────\n';
    report += `Total Investment: ₹${totalBudget.toLocaleString()}\n`;
    report += `Estimated Heat Reduction: ${totalHeatReduction}°C\n`;
    report += `Trees Planted (Est.): ${totalTrees}\n`;
    report += `Cool Roofs Area (Est.): ${totalRoof.toLocaleString()} m²\n`;
    
    report += '\n\nCREDIBILITY HIGHLIGHTS:\n';
    report += '──────────────────────\n';
    report += `✅ Data-driven interventions in ${new Set(programs.map(p => p.wardIndex)).size} wards\n`;
    report += `✅ Measurable impact with quantified outcomes\n`;
    report += `✅ Focused on high-thermal-risk areas\n`;
    report += `✅ Total ${programs.length} intervention program(s)\n`;
    
    // Trigger download
    const blob = new Blob([report], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ThermalGuard_Impact_Report_${new Date().getTime()}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
}

function shareWithGovernment() {
    const programs = JSON.parse(localStorage.getItem('ngoPrograms') || '[]');
    
    if (programs.length === 0) {
        alert('No programs to share. Build a track record first!');
        return;
    }
    
    let data = {
        ngoName: prompt('Enter your NGO name:'),
        contactEmail: prompt('Enter contact email:'),
        programs: programs,
        generatedAt: new Date().toISOString()
    };
    
    if (!data.ngoName || !data.contactEmail) {
        alert('Cancelled.');
        return;
    }
    
    // Store for government portal transmission
    const csv = 'Ward,Program Type,Status,Budget,Est. Heat Reduction (°C),Est. Trees,Est. Roof Area (m²)\n' +
        programs.map(p => 
            `${p.wardSector},${p.programType},${p.status},${p.budget},${p.impactMetrics.estimatedHeatReduction},${p.impactMetrics.estimatedTreeCount},${p.impactMetrics.estimatedRoofArea}`
        ).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.ngoName}_Programs_${new Date().getTime()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    alert(`✅ Data prepared for government submission!\n\nFile: ${data.ngoName}_Programs.csv\n\nYou can now submit this to relevant authorities as proof of your intervention work.`);
}
