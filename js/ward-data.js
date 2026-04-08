const RISK_CATEGORIES = [
  { name: 'Safe', max: 20 },
  { name: 'Moderate', max: 40 },
  { name: 'High', max: 60 },
  { name: 'Severe', max: 80 },
  { name: 'Critical', max: 100 },
];

// Global NGO data cache
let ngoData = null;
let ngoSummaryData = null;

async function loadNGODataset() {
  if (ngoData) return ngoData;

  try {
    const response = await fetch('./nog.json');
    if (!response.ok) {
      throw new Error(`Failed to load NGO data: ${response.status}`);
    }
    ngoData = await response.json();
    return ngoData;
  } catch (error) {
    console.error('Error loading NGO dataset:', error);
    return null;
  }
}

async function loadNGOSummary(filePath = './ngo.json') {
  if (ngoSummaryData) return ngoSummaryData;

  try {
    let response = await fetch(filePath);
    if (!response.ok && filePath === './ngo.json') {
      response = await fetch('./nog.json');
    }

    if (!response.ok) {
      throw new Error(`Failed to load NGO summary: ${response.status}`);
    }

    ngoSummaryData = await response.json();
    return ngoSummaryData;
  } catch (error) {
    console.warn('No ngo.json or nog.json available or failed to load summary data:', error);
    return null;
  }
}

function loadNGOSummaryFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided'));
      return;
    }

    if (!file.name.toLowerCase().endsWith('.json')) {
      reject(new Error('File must be a .json file'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result;
        if (!text || text.trim().length === 0) {
          reject(new Error('File is empty'));
          return;
        }

        const parsed = JSON.parse(text);
        ngoSummaryData = parsed;

        // Basic validation - check if it has the expected structure
        if (!parsed || typeof parsed !== 'object') {
          reject(new Error('File does not contain valid JSON object'));
          return;
        }

        // Check if it's ngo.json format (has ngos array) or nog.json format (has zones array)
        const hasNGOs = parsed.ngos && Array.isArray(parsed.ngos);
        const hasZones = parsed.zones && Array.isArray(parsed.zones);

        if (!hasNGOs && !hasZones) {
          reject(new Error('File must contain either an "ngos" array (ngo.json format) or "zones" array (nog.json format)'));
          return;
        }

        resolve(parsed);
      } catch (error) {
        if (error instanceof SyntaxError) {
          reject(new Error(`Invalid JSON syntax: ${error.message}`));
        } else {
          reject(error);
        }
      }
    };
    reader.onerror = () => reject(new Error(`Failed to read file: ${reader.error?.message || 'Unknown error'}`));
    reader.readAsText(file);
  });
}

async function loadWards(filePath = './wards.geojson') {
  try {
    const [geojson, ngoDataset] = await Promise.all([
      fetch(filePath).then(r => r.ok ? r.json() : Promise.reject(r.status)),
      loadNGODataset()
    ]);

    const features = geojson.features || [];

    // Enhance features with NGO data
    if (ngoDataset && ngoDataset.zones) {
      return features.map(feature => enhanceFeatureWithNGOData(feature, ngoDataset));
    }

    return features;
  } catch (error) {
    console.error('Error loading wards:', error);
    // Fallback to basic GeoJSON loading
    try {
      const response = await fetch(filePath);
      if (!response.ok) throw new Error(`Failed to load ${filePath}: ${response.status}`);
      const geojson = await response.json();
      return geojson.features || [];
    } catch (fallbackError) {
      console.error('Fallback loading failed:', fallbackError);
      return [];
    }
  }
}

function loadWardsFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const geojson = JSON.parse(reader.result);
        const features = geojson.features || [];

        // Try to load NGO data and enhance features
        loadNGODataset().then(ngoDataset => {
          if (ngoDataset && ngoDataset.zones) {
            const enhancedFeatures = features.map(feature =>
              enhanceFeatureWithNGOData(feature, ngoDataset)
            );
            resolve(enhancedFeatures);
          } else {
            resolve(features);
          }
        }).catch(() => resolve(features)); // Fallback without NGO data

      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function enhanceFeatureWithNGOData(feature, ngoDataset) {
  const wardName = getWardName(feature);
  const zoneData = findMatchingZone(wardName, ngoDataset.zones);

  if (zoneData) {
    // Merge NGO data into feature properties
    feature.properties = {
      ...feature.properties,
      ...zoneData,
      // Override with real data
      heat_risk_score: zoneData.heat_risk.risk_score,
      ndvi_score: zoneData.vegetation.ndvi_score,
      risk_level: zoneData.heat_risk.risk_level,
      avg_surface_temp_c: zoneData.heat_risk.avg_surface_temp_c,
      green_cover_pct: zoneData.vegetation.green_cover_pct,
      tree_canopy_pct: zoneData.vegetation.tree_canopy_pct,
      impervious_surface_pct: zoneData.heat_risk.impervious_surface_pct,
      urban_heat_island_intensity: zoneData.heat_risk.urban_heat_island_intensity,
      heat_alert_days_per_year: zoneData.heat_risk.heat_alert_days_per_year,
      // Intervention data
      interventions: zoneData.interventions,
      ngo_activity: zoneData.ngo_activity,
      government_priority: zoneData.government_priority,
      // Population and area data
      population: zoneData.population,
      population_density_per_km2: zoneData.population_density_per_km2,
      area_km2: zoneData.area_km2,
      // Enhanced metadata
      has_real_data: true
    };
  } else {
    // No matching NGO data - use synthetic fallback
    feature.properties = {
      ...feature.properties,
      heat_risk_score: getSyntheticHeatScore(wardName),
      has_real_data: false
    };
  }

  return feature;
}

function findMatchingZone(wardName, zones) {
  if (!wardName || !zones) return null;

  const normalizedWardName = wardName.toLowerCase().trim();

  // Try exact name match first
  let match = zones.find(zone =>
    zone.name?.toLowerCase().trim() === normalizedWardName ||
    zone.short_name?.toLowerCase().trim() === normalizedWardName
  );

  if (match) return match;

  // Try partial matching for zone numbers
  const zoneMatch = normalizedWardName.match(/zone\s*(\d+)/i);
  if (zoneMatch) {
    const zoneNum = parseInt(zoneMatch[1]);
    match = zones.find(zone => zone.zone_number === zoneNum);
    if (match) return match;
  }

  // Try fuzzy matching on key words
  const keywords = ['sholinganallur', 'perungudi', 'teynampet', 'adyr', 'alandur', 'kodambakkam',
                   'tiruvottiyur', 'madhavaram', 'ambattur', 'anna nagar', 'tondiarpet', 'royapuram',
                   'tvk', 'valasaravakkam'];

  for (const keyword of keywords) {
    if (normalizedWardName.includes(keyword)) {
      match = zones.find(zone =>
        zone.name?.toLowerCase().includes(keyword) ||
        zone.short_name?.toLowerCase().includes(keyword)
      );
      if (match) return match;
    }
  }

  return null;
}

function getSyntheticHeatScore(wardName) {
  // Fallback synthetic scoring based on ward name hash
  let hash = 0;
  for (let i = 0; i < wardName.length; i++) {
    hash = ((hash << 5) - hash) + wardName.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % 100;
}

function getWardName(feature) {
  const props = feature.properties || {};
  return props.name || props.NAME || props.ward || props.WARD || 'Unknown Ward';
}

function getWardMetric(feature) {
  const props = feature.properties || {};

  // Use real heat risk score if available
  if (props.has_real_data && props.heat_risk_score != null) {
    return props.heat_risk_score;
  }

  // Fallback to synthetic scoring
  const metricKeys = ['tri', 'heat_index', 'thermal_risk', 'heat_risk', 'risk', 'value', 'temperature', 'temp', 'score'];
  for (const key of metricKeys) {
    if (props[key] != null && !isNaN(Number(props[key]))) {
      return Number(props[key]);
    }
  }

  // Final fallback to synthetic score
  return generateSyntheticHeatIndex(getWardName(feature));
}

function generateSyntheticHeatIndex(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 1000;
  }
  const digits = Array.from(name.matchAll(/\d+/g)).reduce((sum, match) => sum + Number(match[0]), 0);
  const base = 35 + (hash % 50);
  return Math.min(100, Math.max(5, base + (digits % 15)));
}

function getRiskCategory(metric) {
  if (metric <= 20) return 'Safe';
  if (metric <= 40) return 'Moderate';
  if (metric <= 60) return 'High';
  if (metric <= 80) return 'Severe';
  return 'Critical';
}

function getRiskColor(metric) {
  if (metric <= 20) return '#22c55e';
  if (metric <= 40) return '#3b82f6';
  if (metric <= 60) return '#fb923c';
  if (metric <= 80) return '#ef4444';
  return '#991b1b';
}

function formatRiskBadge(category) {
  const classes = category.toLowerCase();
  return `<span class="status ${classes}">${category}</span>`;
}

function computeInsights(features) {
  if (!features || features.length === 0) {
    return {
      total: 0,
      average: 0,
      critical: 0,
      distribution: {},
      top5: []
    };
  }

  let totalHeat = 0;
  let criticalCount = 0;
  let distribution = {};
  let realDataCount = 0;

  // Initialize distribution
  RISK_CATEGORIES.forEach(cat => {
    distribution[cat.name] = 0;
  });

  const wardsWithScores = features.map((feature, idx) => {
    const name = getWardName(feature);
    const score = getWardMetric(feature);
    const category = getRiskCategory(score);
    const props = feature.properties || {};

    totalHeat += score;
    distribution[category]++;

    if (category === 'Critical') criticalCount++;

    if (props.has_real_data) realDataCount++;

    return {
      index: idx,
      name,
      score,
      category,
      feature,
      hasRealData: props.has_real_data || false,
      // Additional real data fields
      ndvi: props.ndvi_score,
      population: props.population,
      area: props.area_km2,
      interventions: props.interventions,
      ngoActivity: props.ngo_activity,
      governmentPriority: props.government_priority
    };
  });

  // Sort by score descending for top 5
  wardsWithScores.sort((a, b) => b.score - a.score);
  const top5 = wardsWithScores.slice(0, 5);

  return {
    total: features.length,
    average: totalHeat / features.length,
    critical: criticalCount,
    distribution,
    wards: wardsWithScores,
    top5,
    realDataCount,
    syntheticDataCount: features.length - realDataCount,
    // Enhanced insights from real data
    cityStats: computeCityStats(wardsWithScores)
  };
}

function computeCityStats(wardsWithScores) {
  const realDataWards = wardsWithScores.filter(w => w.hasRealData);

  if (realDataWards.length === 0) {
    return null;
  }

  let totalPopulation = 0;
  let totalArea = 0;
  let totalInterventions = 0;
  let totalBudget = 0;
  let totalTrees = 0;
  let totalCoolRoofs = 0;
  let avgNDVI = 0;

  realDataWards.forEach(ward => {
    totalPopulation += ward.population || 0;
    totalArea += ward.area || 0;
    avgNDVI += ward.ndvi || 0;

    if (ward.interventions) {
      totalInterventions += ward.interventions.total_programs || 0;
      totalBudget += ward.interventions.total_budget_inr || 0;

      // Count trees and cool roofs from programs
      ward.interventions.programs?.forEach(program => {
        totalTrees += program.trees_planted || 0;
        totalCoolRoofs += program.houses_covered || 0;
      });
    }
  });

  return {
    totalPopulation,
    totalArea,
    avgNDVI: avgNDVI / realDataWards.length,
    totalInterventions,
    totalBudget,
    totalTrees,
    totalCoolRoofs,
    dataCoverage: (realDataWards.length / wardsWithScores.length) * 100
  };
}

// Enhanced functions for NGO data access
function getWardInterventions(feature) {
  return feature.properties?.interventions || null;
}

function getWardNGOActivity(feature) {
  return feature.properties?.ngo_activity || null;
}

function getWardGovernmentPriority(feature) {
  return feature.properties?.government_priority || null;
}

function getWardNDVI(feature) {
  return feature.properties?.ndvi_score || null;
}

function getWardPopulation(feature) {
  return feature.properties?.population || null;
}

function getWardArea(feature) {
  return feature.properties?.area_km2 || null;
}

function getWardRiskLevel(feature) {
  return feature.properties?.risk_level || getRiskCategory(getWardMetric(feature));
}

function getWardSurfaceTemp(feature) {
  return feature.properties?.avg_surface_temp_c || null;
}

function getWardGreenCover(feature) {
  return feature.properties?.green_cover_pct || null;
}

function getWardImperviousSurface(feature) {
  return feature.properties?.impervious_surface_pct || null;
}

function getWardUHIIntensity(feature) {
  return feature.properties?.urban_heat_island_intensity || null;
}

function getWardHeatAlertDays(feature) {
  return feature.properties?.heat_alert_days_per_year || null;
}

function getWardTreeCanopy(feature) {
  return feature.properties?.tree_canopy_pct || null;
}

function getWardParksCount(feature) {
  return feature.properties?.vegetation?.parks_count || null;
}

function getWardWaterBodiesCount(feature) {
  return feature.properties?.vegetation?.water_bodies_count || null;
}

// Export enhanced functions to window
window.WardData = {
  loadWards,
  loadWardsFromFile,
  getWardName,
  getWardMetric,
  getRiskCategory,
  getRiskColor,
  formatRiskBadge,
  computeInsights,
  // New NGO data functions
  getWardInterventions,
  getWardNGOActivity,
  getWardGovernmentPriority,
  getWardNDVI,
  getWardPopulation,
  getWardArea,
  getWardRiskLevel,
  getWardSurfaceTemp,
  getWardGreenCover,
  getWardImperviousSurface,
  getWardUHIIntensity,
  getWardHeatAlertDays,
  getWardTreeCanopy,
  getWardParksCount,
  getWardWaterBodiesCount,
  loadNGODataset,
  loadNGOSummary,
  loadNGOSummaryFromFile
};
