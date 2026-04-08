class InteractiveMapController {
    constructor() {
        this.map = null;
        this.layers = {};
        this.data = {};
        this.selectedZone = null;
        this.markers = {};
        this.init();
    }

    async init() {
        this.showLoading();
        try {
            await this.loadData();
            this.initializeMap();
            this.setupControls();
            this.renderInitialLayers();
            this.hideLoading();
        } catch (error) {
            console.error('Failed to initialize interactive map:', error);
            this.hideLoading();
            this.showError('Failed to load map data');
        }
    }

    async loadData() {
        const endpoints = [
            'analysis-output/spatialAnalysis.json',
            'analysis-output/dashboardData.json',
            'analysis-output/aiDecisionSupport.json',
            'wards.geojson',
            'ngo.json'
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const fileName = endpoint.split('/').pop().split('.')[0];
                this.data[fileName] = await response.json();
            } catch (error) {
                console.warn(`Failed to load ${endpoint}:`, error);
                this.data[endpoint.split('/').pop().split('.')[0]] = {};
            }
        }
    }

    initializeMap() {
        this.map = L.map('interactive-map', {
            center: [13.0827, 80.2707], // Chennai coordinates
            zoom: 10,
            zoomControl: true
        });

        // Add base tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(this.map);

        // Add scale control
        L.control.scale().addTo(this.map);
    }

    setupControls() {
        // Layer selector
        document.getElementById('layer-select').addEventListener('change', (e) => {
            this.switchLayer(e.target.value);
        });

        // Layer toggles
        ['hotspots-toggle', 'interventions-toggle', 'recommendations-toggle'].forEach(id => {
            document.getElementById(id).addEventListener('change', (e) => {
                this.toggleLayer(id.replace('-toggle', ''), e.target.checked);
            });
        });

        // Zone filter
        document.getElementById('zone-filter').addEventListener('change', (e) => {
            this.filterZones(e.target.value);
        });
    }

    renderInitialLayers() {
        this.createZoneLayers();
        this.createHotspotMarkers();
        this.createInterventionMarkers();
        this.createRecommendationMarkers();

        // Show default layers
        this.switchLayer('risk');
        this.toggleLayer('hotspots', true);
        this.toggleLayer('interventions', true);
        this.toggleLayer('recommendations', false);
    }

    createZoneLayers() {
        const geojson = this.data.wards;
        const spatial = this.data.spatialAnalysis;

        if (!geojson || !spatial) return;

        // Risk layer
        this.layers.risk = L.geoJSON(geojson, {
            style: (feature) => this.getZoneStyle(feature, 'risk'),
            onEachFeature: (feature, layer) => {
                layer.on('click', () => this.selectZone(feature));
                layer.bindTooltip(this.getZoneTooltip(feature, 'risk'));
            }
        });

        // Vulnerability layer
        this.layers.vulnerability = L.geoJSON(geojson, {
            style: (feature) => this.getZoneStyle(feature, 'vulnerability'),
            onEachFeature: (feature, layer) => {
                layer.on('click', () => this.selectZone(feature));
                layer.bindTooltip(this.getZoneTooltip(feature, 'vulnerability'));
            }
        });

        // Interventions layer
        this.layers.interventions = L.geoJSON(geojson, {
            style: (feature) => this.getZoneStyle(feature, 'interventions'),
            onEachFeature: (feature, layer) => {
                layer.on('click', () => this.selectZone(feature));
                layer.bindTooltip(this.getZoneTooltip(feature, 'interventions'));
            }
        });
    }

    getZoneStyle(feature, layerType) {
        const zoneName = feature.properties?.name || feature.properties?.ward_name;
        const zoneData = this.data.spatialAnalysis?.hotspots?.find(h =>
            h.zoneName.toLowerCase() === zoneName.toLowerCase()
        );

        let fillColor = '#16a34a'; // default green
        let fillOpacity = 0.3;

        if (zoneData) {
            switch (layerType) {
                case 'risk':
                    fillColor = this.getRiskColor(zoneData.riskLevel);
                    fillOpacity = 0.7;
                    break;
                case 'vulnerability':
                    fillColor = this.getVulnerabilityColor(zoneData.vulnerablePopulation || 0);
                    fillOpacity = 0.6;
                    break;
                case 'interventions':
                    fillColor = zoneData.interventions ? '#22c55e' : '#94a3b8';
                    fillOpacity = 0.5;
                    break;
            }
        }

        return {
            fillColor,
            weight: 2,
            opacity: 1,
            color: 'white',
            fillOpacity,
            dashArray: layerType === 'interventions' && !zoneData?.interventions ? '5, 5' : null
        };
    }

    getZoneTooltip(feature, layerType) {
        const zoneName = feature.properties?.name || feature.properties?.ward_name;
        const zoneData = this.data.spatialAnalysis?.hotspots?.find(h =>
            h.zoneName.toLowerCase() === zoneName.toLowerCase()
        );

        let content = `<b>${zoneName}</b><br>`;

        if (zoneData) {
            switch (layerType) {
                case 'risk':
                    content += `Risk Level: ${zoneData.riskLevel}<br>`;
                    content += `Heat Index: ${zoneData.heatIndex}/100`;
                    break;
                case 'vulnerability':
                    content += `Vulnerable Population: ${zoneData.vulnerablePopulation?.toLocaleString() || 'N/A'}<br>`;
                    content += `Risk Score: ${zoneData.heatIndex}/100`;
                    break;
                case 'interventions':
                    content += `Interventions: ${zoneData.interventions ? 'Planned' : 'None'}<br>`;
                    content += `Priority: ${zoneData.priority || 'N/A'}`;
                    break;
            }
        } else {
            content += 'No data available';
        }

        return content;
    }

    createHotspotMarkers() {
        const hotspots = this.data.spatialAnalysis?.hotspots || [];
        this.markers.hotspots = L.markerClusterGroup({
            chunkedLoading: true,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true
        });

        hotspots.forEach(hotspot => {
            if (hotspot.coordinates) {
                const marker = L.marker([hotspot.coordinates.lat, hotspot.coordinates.lng], {
                    icon: this.createHotspotIcon(hotspot.riskLevel)
                });

                marker.bindPopup(this.createHotspotPopup(hotspot));
                this.markers.hotspots.addLayer(marker);
            }
        });
    }

    createHotspotIcon(riskLevel) {
        const colors = {
            'Critical': '#dc2626',
            'High': '#ea580c',
            'Moderate': '#ca8a04',
            'Low': '#16a34a'
        };

        return L.divIcon({
            className: 'hotspot-marker',
            html: `<div style="background-color: ${colors[riskLevel] || '#16a34a'}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
    }

    createHotspotPopup(hotspot) {
        return `
            <div style="min-width: 200px;">
                <h4 style="margin: 0 0 8px 0; color: #1e293b;">${hotspot.zoneName}</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                    <div><strong>Risk:</strong> ${hotspot.riskLevel}</div>
                    <div><strong>Heat Index:</strong> ${hotspot.heatIndex}</div>
                </div>
                <div style="margin-bottom: 8px;">
                    <strong>Vulnerable Population:</strong> ${hotspot.vulnerablePopulation?.toLocaleString() || 'N/A'}
                </div>
                ${hotspot.recommendations ? `
                    <div>
                        <strong>Key Actions:</strong>
                        <ul style="margin: 4px 0; padding-left: 16px;">
                            ${hotspot.recommendations.slice(0, 2).map(rec => `<li style="font-size: 12px;">${rec}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
    }

    createInterventionMarkers() {
        const interventions = this.data.ngo || [];
        this.markers.interventions = L.markerClusterGroup({
            chunkedLoading: true,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true
        });

        interventions.forEach(intervention => {
            if (intervention.coordinates) {
                const marker = L.marker([intervention.coordinates.lat, intervention.coordinates.lng], {
                    icon: this.createInterventionIcon(intervention.type)
                });

                marker.bindPopup(this.createInterventionPopup(intervention));
                this.markers.interventions.addLayer(marker);
            }
        });
    }

    createInterventionIcon(type) {
        const icons = {
            'tree_planting': '🌳',
            'cool_roof': '🏠',
            'wetland': '💧',
            'shading': '🌴'
        };

        return L.divIcon({
            className: 'intervention-marker',
            html: `<div style="font-size: 20px;">${icons[type] || '🏗️'}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
    }

    createInterventionPopup(intervention) {
        return `
            <div style="min-width: 200px;">
                <h4 style="margin: 0 0 8px 0; color: #1e293b;">${intervention.name}</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                    <div><strong>Type:</strong> ${intervention.type.replace('_', ' ')}</div>
                    <div><strong>Status:</strong> ${intervention.status}</div>
                </div>
                <div style="margin-bottom: 8px;">
                    <strong>Impact:</strong> ${intervention.expected_impact || 'N/A'}
                </div>
                <div style="margin-bottom: 8px;">
                    <strong>Budget:</strong> ₹${intervention.budget?.toLocaleString() || 'N/A'}
                </div>
                ${intervention.description ? `<p style="font-size: 12px; margin: 0;">${intervention.description}</p>` : ''}
            </div>
        `;
    }

    createRecommendationMarkers() {
        const recommendations = this.data.aiDecisionSupport?.immediateActions || [];
        this.markers.recommendations = L.layerGroup();

        recommendations.forEach(rec => {
            if (rec.coordinates) {
                const marker = L.marker([rec.coordinates.lat, rec.coordinates.lng], {
                    icon: this.createRecommendationIcon(rec.priority)
                });

                marker.bindPopup(this.createRecommendationPopup(rec));
                this.markers.recommendations.addLayer(marker);
            }
        });
    }

    createRecommendationIcon(priority) {
        const colors = {
            'immediate': '#dc2626',
            'short': '#ea580c',
            'long': '#ca8a04'
        };

        return L.divIcon({
            className: 'recommendation-marker',
            html: `<div style="background-color: ${colors[priority] || '#94a3b8'}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 10px; color: white; font-weight: bold;">!</div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });
    }

    createRecommendationPopup(rec) {
        return `
            <div style="min-width: 200px;">
                <h4 style="margin: 0 0 8px 0; color: #1e293b;">${rec.action}</h4>
                <div style="margin-bottom: 8px;">
                    <strong>Priority:</strong>
                    <span style="background: ${this.getPriorityColor(rec.priority)}; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; margin-left: 4px;">
                        ${rec.priority.toUpperCase()}
                    </span>
                </div>
                <p style="font-size: 12px; margin: 8px 0;">${rec.description}</p>
                <div style="margin-bottom: 8px;">
                    <strong>Expected Impact:</strong> ${rec.expectedImpact}
                </div>
            </div>
        `;
    }

    switchLayer(layerType) {
        // Remove current layer
        Object.values(this.layers).forEach(layer => {
            if (this.map.hasLayer(layer)) {
                this.map.removeLayer(layer);
            }
        });

        // Add selected layer
        if (this.layers[layerType]) {
            this.layers[layerType].addTo(this.map);
        }
    }

    toggleLayer(layerName, visible) {
        const layer = this.markers[layerName];
        if (!layer) return;

        if (visible) {
            if (!this.map.hasLayer(layer)) {
                this.map.addLayer(layer);
            }
        } else {
            if (this.map.hasLayer(layer)) {
                this.map.removeLayer(layer);
            }
        }
    }

    filterZones(filterType) {
        const riskLevels = {
            'all': ['Critical', 'High', 'Moderate', 'Low'],
            'critical': ['Critical'],
            'high': ['Critical', 'High'],
            'moderate': ['Critical', 'High', 'Moderate']
        };

        const allowedLevels = riskLevels[filterType] || riskLevels.all;

        this.layers.risk.eachLayer(layer => {
            const feature = layer.feature;
            const zoneName = feature.properties?.name || feature.properties?.ward_name;
            const zoneData = this.data.spatialAnalysis?.hotspots?.find(h =>
                h.zoneName.toLowerCase() === zoneName.toLowerCase()
            );

            if (zoneData && allowedLevels.includes(zoneData.riskLevel)) {
                if (!this.map.hasLayer(layer)) {
                    layer.addTo(this.map);
                }
            } else {
                if (this.map.hasLayer(layer)) {
                    this.map.removeLayer(layer);
                }
            }
        });
    }

    selectZone(feature) {
        this.selectedZone = feature;
        this.renderZoneDetails(feature);
        this.zoomToZone(feature);
    }

    renderZoneDetails(feature) {
        const zoneName = feature.properties?.name || feature.properties?.ward_name;
        const zoneData = this.data.spatialAnalysis?.hotspots?.find(h =>
            h.zoneName.toLowerCase() === zoneName.toLowerCase()
        );

        const container = document.getElementById('zone-details');

        if (!zoneData) {
            container.innerHTML = `
                <div class="zone-card">
                    <div class="zone-header">
                        <div class="zone-name">${zoneName}</div>
                    </div>
                    <p>No detailed analysis available for this zone.</p>
                </div>
            `;
            return;
        }

        const riskClass = this.getRiskClass(zoneData.riskLevel);
        const recommendations = this.data.aiDecisionSupport?.immediateActions?.filter(
            rec => rec.zoneName?.toLowerCase() === zoneName.toLowerCase()
        ) || [];

        container.innerHTML = `
            <div class="zone-card ${riskClass.toLowerCase()}">
                <div class="zone-header">
                    <div class="zone-name">${zoneData.zoneName}</div>
                    <div class="zone-risk-badge risk-${riskClass.toLowerCase()}">${zoneData.riskLevel}</div>
                </div>

                <div class="zone-metrics">
                    <div class="zone-metric">
                        <span class="metric-value">${zoneData.heatIndex}</span>
                        <span class="metric-label">Heat Index</span>
                    </div>
                    <div class="zone-metric">
                        <span class="metric-value">${zoneData.vulnerablePopulation?.toLocaleString() || 'N/A'}</span>
                        <span class="metric-label">Vulnerable Pop.</span>
                    </div>
                    <div class="zone-metric">
                        <span class="metric-value">${zoneData.temperature || 'N/A'}°C</span>
                        <span class="metric-label">Temperature</span>
                    </div>
                    <div class="zone-metric">
                        <span class="metric-value">${zoneData.humidity || 'N/A'}%</span>
                        <span class="metric-label">Humidity</span>
                    </div>
                </div>

                ${zoneData.recommendations ? `
                    <div class="zone-recommendations">
                        <h4>Key Recommendations</h4>
                        ${zoneData.recommendations.map(rec => `
                            <div class="recommendation-item">
                                <div class="recommendation-icon rec-immediate">•</div>
                                <div class="recommendation-text">${rec}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                ${recommendations.length > 0 ? `
                    <div class="zone-recommendations">
                        <h4>AI Priority Actions</h4>
                        ${recommendations.map(rec => `
                            <div class="recommendation-item">
                                <div class="recommendation-icon rec-${rec.priority}">${rec.priority[0].toUpperCase()}</div>
                                <div class="recommendation-text">
                                    <strong>${rec.action}</strong><br>
                                    ${rec.description}<br>
                                    <small>Impact: ${rec.expectedImpact}</small>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    zoomToZone(feature) {
        if (feature.geometry && feature.geometry.coordinates) {
            const bounds = L.geoJSON(feature).getBounds();
            this.map.fitBounds(bounds, { padding: [20, 20] });
        }
    }

    getRiskColor(riskLevel) {
        const colors = {
            'Critical': '#dc2626',
            'High': '#ea580c',
            'Moderate': '#ca8a04',
            'Low': '#16a34a'
        };
        return colors[riskLevel] || '#16a34a';
    }

    getVulnerabilityColor(population) {
        if (population > 100000) return '#dc2626';
        if (population > 50000) return '#ea580c';
        if (population > 25000) return '#ca8a04';
        return '#16a34a';
    }

    getRiskClass(riskLevel) {
        return riskLevel.toLowerCase();
    }

    getPriorityColor(priority) {
        const colors = {
            'immediate': '#dc2626',
            'short': '#ea580c',
            'long': '#ca8a04'
        };
        return colors[priority] || '#94a3b8';
    }

    showLoading() {
        document.getElementById('loading-overlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loading-overlay').style.display = 'none';
    }

    showError(message) {
        const container = document.querySelector('.map-sidebar');
        if (container) {
            container.innerHTML = `
                <h3>Error Loading Map</h3>
                <p>${message}</p>
                <p>Please check that all data files are present in the analysis-output folder.</p>
            `;
        }
    }
}

// Initialize the interactive map when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new InteractiveMapController();
});