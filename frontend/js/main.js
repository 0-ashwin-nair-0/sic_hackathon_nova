/**
 * SMART CITY ICCC - Main JavaScript
 * Core functionality for dashboard operations
 */

// API Base URL
const API_BASE = 'http://127.0.0.1:5000/api';

// Global state
let currentMode = 'water';
let currentTab = 'citizen-reports';
let dashboardData = null;
let refreshInterval = null;
let wasteComparisonChart = null;
let wasteDistributionChart = null;
let wastePuneMap = null;
let wasteMapMarkersLayer = null;
let currentWasteCsvReport = null;  // Store CSV report data for main waste section sync

function validateDashboardAccess(requiredRole) {
    const sessionRaw = localStorage.getItem('smartcityAuth');
    if (!sessionRaw) {
        window.location.href = 'index.html';
        return false;
    }

    try {
        const session = JSON.parse(sessionRaw);
        if (!session?.user?.role || session.user.role !== requiredRole) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    } catch (error) {
        localStorage.removeItem('smartcityAuth');
        window.location.href = 'index.html';
        return false;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    if (!validateDashboardAccess('admin')) {
        return;
    }

    console.log('🏙️ Smart City ICCC Dashboard Initialized');
    
    // Initialize components
    initializeClock();
    initializeTabs();
    initializeModeSwitcher();
    initializeSimulation();
    initializeWasteExplorer();
    
    // Load initial data
    loadDashboardData();
    
    // Load citizen reports by default
    loadModuleData('citizen-reports');
    
    // Set up auto-refresh (every 10 seconds)
    refreshInterval = setInterval(loadDashboardData, 10000);
    
    // Also refresh citizen reports every 30 seconds
    setInterval(() => {
        if (currentTab === 'citizen-reports') {
            loadCitizenReports();
        }
    }, 30000);
});

function initializeWasteExplorer() {
    const statusNode = document.getElementById('wasteExploreStatus');
    if (statusNode) {
        statusNode.textContent = 'Upload waste CSV and click Generate Report to view detailed Pune analysis.';
    }
}

function toggleWasteExplorer() {
    const container = document.getElementById('wasteExplorerContainer');
    if (!container) return;

    const shouldShow = container.style.display === 'none' || container.style.display === '';
    container.style.display = shouldShow ? 'block' : 'none';

    const button = document.getElementById('wasteExploreBtn');
    if (button) {
        button.innerHTML = shouldShow
            ? '<i class="fas fa-times"></i> Close Explorer'
            : '<i class="fas fa-search"></i> Explore More';
    }

    if (shouldShow && wastePuneMap) {
        setTimeout(() => wastePuneMap.invalidateSize(), 150);
    }
}

async function generateWasteDetailedReport() {
    const fileInput = document.getElementById('wasteCsvInput');
    const thresholdInput = document.getElementById('wasteUrgencyThreshold');
    const statusNode = document.getElementById('wasteExploreStatus');
    const reportNode = document.getElementById('wasteDetailedReport');

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showErrorNotification('Please upload a CSV file for detailed waste analysis');
        if (statusNode) {
            statusNode.style.color = 'var(--critical-red)';
            statusNode.textContent = 'CSV required: upload a valid waste dataset and try again.';
        }
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('priority_threshold', thresholdInput?.value || '60');

    if (statusNode) {
        statusNode.style.color = 'var(--text-secondary)';
        statusNode.textContent = 'Processing CSV and building detailed report...';
    }

    try {
        const response = await fetch(`${API_BASE}/waste/detailed-report`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (!response.ok || !result.success || !result.report) {
            throw new Error(result.error || `Request failed with ${response.status}`);
        }

        renderWasteDetailedReport(result.report);
        renderPdfDownloadAction('wastePdfActions', result.pdf_download_url, 'Waste Report', result.report.selected_date);

        if (reportNode) {
            reportNode.style.display = 'block';
        }

        if (statusNode) {
            statusNode.style.color = 'var(--accent-green)';
            statusNode.textContent = `Report generated for ${result.report.selected_date}`;
        }
    } catch (error) {
        console.error('Error generating waste detailed report:', error);
        if (statusNode) {
            statusNode.style.color = 'var(--critical-red)';
            statusNode.textContent = `Failed to generate report: ${error.message}`;
        }
        showErrorNotification('Waste report generation failed');
    }
}

function renderWasteDetailedReport(report) {
    // Store CSV report for syncing main waste section
    currentWasteCsvReport = report;
    
    // Render detailed report KPIs and visualizations
    renderWasteDetailKpis(report.metrics);
    renderWasteDetailCharts(report);
    renderWastePunePriorityMap(report.pune_map);
    renderWastePriorityTable(report.high_priority_table || []);
    
    // Update main waste section with CSV data
    updateMainWasteSection(report);
}

function renderWasteDetailKpis(metrics) {
    const container = document.getElementById('wasteDetailKpis');
    if (!container || !metrics) return;

    container.innerHTML = `
        <div class="waste-kpi-card">
            <div class="waste-kpi-label">Forecast Accuracy</div>
            <div class="waste-kpi-subtitle">Mean Absolute Error (kg/day)</div>
            <div class="waste-kpi-value">${metrics.model_mae.toFixed(2)}</div>
        </div>
        <div class="waste-kpi-card">
            <div class="waste-kpi-label">Urgent Collection Zones</div>
            <div class="waste-kpi-subtitle">Locations needing immediate attention</div>
            <div class="waste-kpi-value">${metrics.high_priority_zones}</div>
        </div>
        <div class="waste-kpi-card">
            <div class="waste-kpi-label">Route Optimization</div>
            <div class="waste-kpi-subtitle">Distance reduction vs. baseline</div>
            <div class="waste-kpi-value">${metrics.distance_reduction_pct.toFixed(2)}%</div>
        </div>
        <div class="waste-kpi-card">
            <div class="waste-kpi-label">Carbon Reduction</div>
            <div class="waste-kpi-subtitle">CO₂ emissions eliminated (kg)</div>
            <div class="waste-kpi-value">${metrics.carbon_saved_kg.toFixed(2)}</div>
        </div>
    `;
}

function renderWasteDetailCharts(report) {
    const comparisonCanvas = document.getElementById('wasteDetailComparisonChart');
    const distributionCanvas = document.getElementById('wasteDetailDistributionChart');
    if (!comparisonCanvas || !distributionCanvas) return;

    if (wasteComparisonChart) wasteComparisonChart.destroy();
    if (wasteDistributionChart) wasteDistributionChart.destroy();

    wasteComparisonChart = new Chart(comparisonCanvas, {
        type: 'bar',
        data: {
            labels: report.before_after.labels,
            datasets: [{
                label: 'Distance (km)',
                data: report.before_after.values,
                backgroundColor: ['rgba(255, 76, 76, 0.6)', 'rgba(0, 255, 157, 0.6)'],
                borderColor: ['rgba(255, 76, 76, 1)', 'rgba(0, 255, 157, 1)'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { labels: { color: '#E2E8F0' } }
            },
            scales: {
                x: { ticks: { color: '#94A3B8' }, grid: { color: 'rgba(148, 163, 184, 0.2)' } },
                y: { ticks: { color: '#94A3B8' }, grid: { color: 'rgba(148, 163, 184, 0.2)' } }
            }
        }
    });

    wasteDistributionChart = new Chart(distributionCanvas, {
        type: 'line',
        data: {
            labels: report.waste_distribution.labels,
            datasets: [{
                label: 'Bin Count',
                data: report.waste_distribution.counts,
                fill: true,
                borderColor: 'rgba(0, 229, 255, 1)',
                backgroundColor: 'rgba(0, 229, 255, 0.2)',
                tension: 0.25,
                pointRadius: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { labels: { color: '#E2E8F0' } }
            },
            scales: {
                x: { ticks: { color: '#94A3B8' }, grid: { color: 'rgba(148, 163, 184, 0.2)' } },
                y: { ticks: { color: '#94A3B8' }, grid: { color: 'rgba(148, 163, 184, 0.2)' } }
            }
        }
    });
}

function renderWastePunePriorityMap(mapData) {
    const mapContainer = document.getElementById('wastePuneMap');
    if (!mapContainer || !mapData) return;

    if (!window.L) {
        mapContainer.innerHTML = '<div style="padding:1rem;color:var(--critical-red);">Map library failed to load.</div>';
        return;
    }

    if (!wastePuneMap) {
        wastePuneMap = L.map('wastePuneMap', { zoomControl: true }).setView(
            [mapData.center.lat, mapData.center.lon],
            11
        );

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(wastePuneMap);
    } else {
        wastePuneMap.setView([mapData.center.lat, mapData.center.lon], 11);
    }

    if (wasteMapMarkersLayer) {
        wastePuneMap.removeLayer(wasteMapMarkersLayer);
    }

    wasteMapMarkersLayer = L.layerGroup();

    (mapData.points || []).forEach(point => {
        const markerColor = point.urgency_score >= 70 ? '#FF4C4C' : point.urgency_score >= 60 ? '#FFC107' : '#00E59D';

        const marker = L.circleMarker([point.lat, point.lon], {
            radius: 8,
            color: markerColor,
            fillColor: markerColor,
            fillOpacity: 0.8,
            weight: 2
        });

        marker.bindPopup(`
            <strong>Zone ${point.zone_id}</strong><br/>
            Type: ${point.zone_type}<br/>
            Urgency: ${point.urgency_score}<br/>
            Fill: ${point.fill_percent}%<br/>
            Distance: ${point.distance_km} km
        `);

        wasteMapMarkersLayer.addLayer(marker);
    });

    wasteMapMarkersLayer.addTo(wastePuneMap);
    setTimeout(() => wastePuneMap.invalidateSize(), 180);
}

function renderWastePriorityTable(rows) {
    const container = document.getElementById('wastePriorityTable');
    if (!container) return;

    if (!rows.length) {
        container.innerHTML = '<div style="color: var(--text-secondary);">No high-priority zones found for selected threshold.</div>';
        return;
    }

    container.innerHTML = `
        <table class="waste-priority-table">
            <thead>
                <tr>
                    <th>Zone ID</th>
                    <th>Zone Type</th>
                    <th>Urgency</th>
                    <th>Avg Waste (kg)</th>
                    <th>Fill (%)</th>
                    <th>Distance (km)</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map(row => `
                    <tr>
                        <td>${row.zone_id}</td>
                        <td>${row.zone_type}</td>
                        <td>${row.urgency_score}</td>
                        <td>${row.avg_daily_waste_kg}</td>
                        <td>${row.estimated_fill_percent}</td>
                        <td>${row.distance_to_depot_km}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

/**
 * Update main waste section (Bin Status Map & Waste-to-Energy Impact)
 * with data from uploaded CSV file
 */
function updateMainWasteSection(report) {
    if (!report) return;

    // Update Bin Status Map with CSV data
    updateWasteBinGrid(report);
    
    // Update Waste-to-Energy Impact with CSV-based calculations
    updateWasteConversionMetrics(report);
}

/**
 * Display bins from CSV with their fill percentages and statuses
 */
function updateWasteBinGrid(report) {
    const container = document.getElementById('wasteBinGrid');
    if (!container) return;

    const highPriorityTable = report.high_priority_table || [];
    
    // Create virtual bins from CSV data - show top 16 by urgency
    const binDisplayData = highPriorityTable.slice(0, 16).map(zone => {
        const fillPercent = zone.estimated_fill_percent || 0;
        let status = 'normal';
        
        if (fillPercent >= 90) status = 'critical';
        else if (fillPercent >= 70) status = 'warning';
        else if (fillPercent >= 50) status = 'caution';
        
        return {
            zone_id: zone.zone_id,
            fill_percent: fillPercent,
            bin_type: zone.zone_type || 'Mixed',
            status: status
        };
    });

    // If we don't have enough bins, show a message
    if (binDisplayData.length === 0) {
        container.innerHTML = '<div style="color: var(--text-secondary); padding: 1rem; text-align: center;">No bin data available from CSV</div>';
        return;
    }

    container.innerHTML = binDisplayData.map((bin, idx) => `
        <div class="bin-item ${bin.status}" title="Zone ${bin.zone_id} - ${bin.bin_type} (Fill: ${bin.fill_percent.toFixed(1)}%)">
            <div class="bin-icon">
                <i class="fas fa-trash-alt"></i>
            </div>
            <div class="bin-fill">${bin.fill_percent.toFixed(0)}%</div>
            <div class="bin-type">Zone ${bin.zone_id}</div>
        </div>
    `).join('');
}

/**
 * Calculate and display waste-to-energy metrics from CSV data
 */
function updateWasteConversionMetrics(report) {
    const container = document.getElementById('wasteConversion');
    if (!container) return;

    try {
        const metrics = report.metrics || {};
        const highPriorityTable = report.high_priority_table || [];
        
        // Calculate metrics based on CSV data
        const totalWasteKg = highPriorityTable.reduce((sum, zone) => sum + (zone.avg_daily_waste_kg || 0), 0);
        const averageFillPercent = highPriorityTable.length > 0 
            ? (highPriorityTable.reduce((sum, zone) => sum + (zone.estimated_fill_percent || 0), 0) / highPriorityTable.length)
            : 0;
        
        // Waste-to-energy conversion (1 kg waste ≈ 0.65 kWh electrical energy)
        const electricityGenerated = totalWasteKg * 0.65;
        
        // CO2 reduction (processing 1 kg waste saves ~1.5 kg CO2 vs landfill)
        const co2Reduced = totalWasteKg * 1.5;
        
        // Landfill reduction (waste diverted from landfill)
        const landfillReduction = totalWasteKg * 0.85;
        
        // Cleanliness score (based on average fill percent and optimization)
        const optimizationScore = Math.max(0, 100 - averageFillPercent);
        const cleanlinesScore = Math.min(100, optimizationScore + (metrics.distance_reduction_pct || 0) / 2);
        
        container.innerHTML = `
            <div style="padding: 1rem;">
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.85rem;">Electricity Generated</div>
                        <div style="color: var(--accent-green); font-weight: 700; font-size: 1.3rem;">${electricityGenerated.toFixed(0)} kWh</div>
                        <div style="color: var(--text-tertiary); font-size: 0.75rem; margin-top: 0.3rem;">From ${totalWasteKg.toFixed(0)}kg waste</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.85rem;">CO₂ Reduced</div>
                        <div style="color: var(--accent-green); font-weight: 700; font-size: 1.3rem;">${co2Reduced.toFixed(0)} kg</div>
                        <div style="color: var(--text-tertiary); font-size: 0.75rem; margin-top: 0.3rem;">Environmental impact</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.85rem;">Landfill Reduction</div>
                        <div style="color: var(--accent-cyan); font-weight: 700; font-size: 1.3rem;">${landfillReduction.toFixed(0)} kg</div>
                        <div style="color: var(--text-tertiary); font-size: 0.75rem; margin-top: 0.3rem;">Waste diverted</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.85rem;">Efficiency Score</div>
                        <div style="color: #FFD700; font-weight: 700; font-size: 1.3rem;">${cleanlinesScore.toFixed(1)}/100</div>
                        <div style="color: var(--text-tertiary); font-size: 0.75rem; margin-top: 0.3rem;">Collection optimization</div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error updating waste metrics:', error);
        container.innerHTML = '<div style="color: var(--critical-red);">Failed to calculate metrics</div>';
    }
}

// ============================================
// SAMPLE CSV DOWNLOAD FUNCTION
// ============================================

function downloadSampleCsv(module) {
    const endpoints = {
        water: '/download/sample-water-csv',
        waste: '/download/sample-waste-csv',
        electricity: '/download/sample-electricity-csv'
    };

    const endpoint = endpoints[module];
    if (!endpoint) {
        showErrorNotification('Invalid module for sample CSV');
        return;
    }

    try {
        const link = document.createElement('a');
        link.href = `${API_BASE}${endpoint}`;
        link.download = `sample_${module}_data.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showInfoNotification(`${module.toUpperCase()} sample CSV downloaded successfully!`);
    } catch (error) {
        console.error('Error downloading sample CSV:', error);
        showErrorNotification('Failed to download sample CSV');
    }
}
function getAbsoluteApiUrl(path) {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const baseOrigin = API_BASE.replace('/api', '');
    return `${baseOrigin}${path.startsWith('/') ? path : `/${path}`}`;
}
function renderPdfDownloadAction(containerId, pdfUrl, moduleLabel, selectedDate) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const absolutePdfUrl = getAbsoluteApiUrl(pdfUrl);
    if (!absolutePdfUrl) {
        container.innerHTML = '';
        return;
    }

    const safeLabel = moduleLabel || 'Report';
    const safeDate = selectedDate || 'latest data';

    container.innerHTML = `
        <a class="action-btn" href="${absolutePdfUrl}" target="_blank" rel="noopener noreferrer" download>
            <i class="fas fa-file-pdf"></i>
            Download ${safeLabel} PDF (${safeDate})
        </a>
    `;
}

// ============================================
// WATER EXPLORER FUNCTIONS
// ============================================

let waterTankChart = null;
let waterUsageChart = null;

function toggleWaterExplorer() {
    const container = document.getElementById('waterExplorerContainer');
    if (!container) return;

    const shouldShow = container.style.display === 'none' || container.style.display === '';
    container.style.display = shouldShow ? 'block' : 'none';

    const button = document.getElementById('waterExploreBtn');
    if (button) {
        button.innerHTML = shouldShow
            ? '<i class="fas fa-times"></i> Close Explorer'
            : '<i class="fas fa-search"></i> Explore More';
    }
}

async function generateWaterDetailedReport() {
    const fileInput = document.getElementById('waterCsvInput');
    const statusNode = document.getElementById('waterExploreStatus');
    const reportNode = document.getElementById('waterDetailedReport');

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showErrorNotification('Please upload a CSV file for water analysis');
        if (statusNode) {
            statusNode.style.color = 'var(--critical-red)';
            statusNode.textContent = 'CSV required: upload a valid water dataset with timestamp, zone_id, tank_level_pct, usage, pipeline_pressure, input_flow, output_flow, temperature columns.';
        }
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    if (statusNode) {
        statusNode.style.color = 'var(--text-secondary)';
        statusNode.textContent = 'Processing CSV: Running demand forecasting, leak detection, and reallocation analysis...';
    }

    try {
        const response = await fetch(`${API_BASE}/water/detailed-report`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (!response.ok || !result.success || !result.report) {
            throw new Error(result.error || `Request failed with ${response.status}`);
        }

        renderWaterDetailedReport(result.report);
        renderPdfDownloadAction('waterPdfActions', result.pdf_download_url, 'Water Report', result.report.selected_date);

        if (reportNode) {
            reportNode.style.display = 'block';
        }

        if (statusNode) {
            statusNode.style.color = 'var(--accent-green)';
            statusNode.textContent = `Water analytics report generated for ${result.report.selected_date}`;
        }
    } catch (error) {
        console.error('Error generating water detailed report:', error);
        if (statusNode) {
            statusNode.style.color = 'var(--critical-red)';
            statusNode.textContent = `Failed to generate report: ${error.message}`;
        }
        showErrorNotification('Water report generation failed');
    }
}

function renderWaterDetailedReport(report) {
    renderWaterDetailKpis(report.metrics);
    renderWaterDetailCharts(report.charts);
    renderWaterLeakAlerts(report.leak_alerts || []);
    renderWaterRiskReallocation(report.risk_zones || [], report.reallocation_plan || []);
}

function renderWaterDetailKpis(metrics) {
    const container = document.getElementById('waterDetailKpis');
    if (!container || !metrics) return;

    container.innerHTML = `
        <div class="water-kpi-card">
            <div class="water-kpi-label">Forecast Accuracy</div>
            <div class="water-kpi-subtitle">Random Forest MAE (m³/hour)</div>
            <div class="water-kpi-value">${metrics.forecast_mae.toFixed(2)}</div>
        </div>
        <div class="water-kpi-card">
            <div class="water-kpi-label">Leak Alerts</div>
            <div class="water-kpi-subtitle">Multi-factor detection anomalies</div>
            <div class="water-kpi-value">${metrics.leak_alerts_count}</div>
        </div>
        <div class="water-kpi-card">
            <div class="water-kpi-label">Critical Risk Zones</div>
            <div class="water-kpi-subtitle">Usage >100% capacity zones</div>
            <div class="water-kpi-value">${metrics.critical_zones}</div>
        </div>
        <div class="water-kpi-card">
            <div class="water-kpi-label">Warning Zones</div>
            <div class="water-kpi-subtitle">Usage >85% capacity zones</div>
            <div class="water-kpi-value">${metrics.warning_zones}</div>
        </div>
        <div class="water-kpi-card">
            <div class="water-kpi-label">Distribution Efficiency</div>
            <div class="water-kpi-subtitle">Output/Input flow ratio (%)</div>
            <div class="water-kpi-value">${metrics.distribution_efficiency.toFixed(1)}%</div>
        </div>
        <div class="water-kpi-card">
            <div class="water-kpi-label">Avg Tank Level</div>
            <div class="water-kpi-subtitle">City-wide tank percentage</div>
            <div class="water-kpi-value">${metrics.avg_tank_level.toFixed(1)}%</div>
        </div>
        <div class="water-kpi-card">
            <div class="water-kpi-label">Avg Pipeline Pressure</div>
            <div class="water-kpi-subtitle">Network pressure (bar)</div>
            <div class="water-kpi-value">${metrics.avg_pressure.toFixed(2)}</div>
        </div>
        <div class="water-kpi-card">
            <div class="water-kpi-label">Water Reallocated</div>
            <div class="water-kpi-subtitle">Surplus→Deficit transfer (m³)</div>
            <div class="water-kpi-value">${metrics.total_reallocated.toFixed(1)}</div>
        </div>
    `;
}

function renderWaterDetailCharts(charts) {
    const tankCanvas = document.getElementById('waterDetailTankChart');
    const usageCanvas = document.getElementById('waterDetailUsageChart');
    if (!tankCanvas || !usageCanvas || !charts) return;

    if (waterTankChart) waterTankChart.destroy();
    if (waterUsageChart) waterUsageChart.destroy();

    // Tank Levels Chart
    waterTankChart = new Chart(tankCanvas, {
        type: 'bar',
        data: {
            labels: charts.tank_levels.labels,
            datasets: [{
                label: 'Tank Level (%)',
                data: charts.tank_levels.values,
                backgroundColor: charts.tank_levels.values.map(v => 
                    v < 40 ? 'rgba(255, 76, 76, 0.7)' : 
                    v < 60 ? 'rgba(255, 193, 7, 0.7)' : 
                    'rgba(0, 255, 157, 0.7)'
                ),
                borderColor: charts.tank_levels.values.map(v => 
                    v < 40 ? 'rgba(255, 76, 76, 1)' : 
                    v < 60 ? 'rgba(255, 193, 7, 1)' : 
                    'rgba(0, 255, 157, 1)'
                ),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { labels: { color: '#E2E8F0' } }
            },
            scales: {
                x: { ticks: { color: '#94A3B8' }, grid: { color: 'rgba(148, 163, 184, 0.2)' } },
                y: { 
                    ticks: { color: '#94A3B8' }, 
                    grid: { color: 'rgba(148, 163, 184, 0.2)' },
                    min: 0,
                    max: 100
                }
            }
        }
    });

    // Usage Trend Chart
    waterUsageChart = new Chart(usageCanvas, {
        type: 'line',
        data: {
            labels: charts.usage_trend.labels,
            datasets: [{
                label: 'Total Usage (m³)',
                data: charts.usage_trend.values,
                fill: true,
                borderColor: 'rgba(0, 191, 255, 1)',
                backgroundColor: 'rgba(0, 191, 255, 0.2)',
                tension: 0.4,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { labels: { color: '#E2E8F0' } }
            },
            scales: {
                x: { ticks: { color: '#94A3B8' }, grid: { color: 'rgba(148, 163, 184, 0.2)' } },
                y: { ticks: { color: '#94A3B8' }, grid: { color: 'rgba(148, 163, 184, 0.2)' } }
            }
        }
    });
}

function renderWaterLeakAlerts(leaks) {
    const container = document.getElementById('waterLeakTable');
    if (!container) return;

    if (!leaks.length) {
        container.innerHTML = '<div style="color: var(--text-secondary); padding: 1rem;">No leak alerts detected. All zones operating normally.</div>';
        return;
    }

    container.innerHTML = `
        <table class="water-leak-table">
            <thead>
                <tr>
                    <th>Zone ID</th>
                    <th>Leak Score</th>
                    <th>Severity</th>
                    <th>Pressure Drop %</th>
                    <th>Flow Mismatch %</th>
                    <th>Pipeline Age</th>
                    <th>Current Pressure</th>
                    <th>Tank Level %</th>
                </tr>
            </thead>
            <tbody>
                ${leaks.map(leak => `
                    <tr>
                        <td>Zone ${leak.zone_id}</td>
                        <td><strong>${leak.leak_score}</strong></td>
                        <td><span class="severity-badge ${leak.severity}">${leak.severity.toUpperCase()}</span></td>
                        <td>${leak.pressure_drop_pct.toFixed(1)}%</td>
                        <td>${leak.flow_mismatch_pct.toFixed(1)}%</td>
                        <td>${leak.pipeline_age} years</td>
                        <td>${leak.current_pressure} bar</td>
                        <td>${leak.tank_level_pct.toFixed(1)}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderWaterRiskReallocation(riskZones, transfers) {
    const container = document.getElementById('waterRiskReallocation');
    if (!container) return;

    let html = '<div class="water-risk-reallocation-container">';

    // Risk Zones Section
    html += '<div class="water-risk-section">';
    html += '<h4>High Risk Zones</h4>';
    
    if (!riskZones.length) {
        html += '<p style="color: var(--text-secondary);">No high-risk zones detected.</p>';
    } else {
        html += '<div class="risk-zone-grid">';
        riskZones.slice(0, 5).forEach(zone => {
            const riskColor = zone.risk_level === 'CRITICAL' ? 'var(--critical-red)' : 
                              zone.risk_level === 'WARNING' ? 'rgba(255, 193, 7, 1)' : 
                              'var(--accent-green)';
            html += `
                <div class="risk-zone-item" style="border-left: 4px solid ${riskColor}">
                    <div style="font-weight: 700; color: var(--text-primary);">Zone ${zone.zone_id}</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">Tank: ${zone.tank_level_pct}% | Usage: ${zone.usage_pct.toFixed(1)}%</div>
                    <div style="font-size: 0.85rem; color: ${riskColor};">Risk: ${zone.risk_level}</div>
                </div>
            `;
        });
        html += '</div>';
    }
    html += '</div>';

    // Reallocation Plan Section
    html += '<div class="water-reallocation-section">';
    html += '<h4>Greedy Reallocation Plan</h4>';
    
    if (!transfers.length) {
        html += '<p style="color: var(--text-secondary);">No reallocation needed. System is balanced.</p>';
    } else {
        html += '<div class="transfer-list">';
        transfers.forEach((transfer, idx) => {
            html += `
                <div class="transfer-item">
                    <div class="transfer-header">
                        <span class="transfer-badge">Transfer ${idx + 1}</span>
                        <span style="color: var(--accent-green); font-weight: 700;">${transfer.amount} m³</span>
                    </div>
                    <div class="transfer-route">
                        <span>Zone ${transfer.from_zone}</span>
                        <i class="fas fa-arrow-right" style="color: var(--accent-cyan);"></i>
                        <span>Zone ${transfer.to_zone}</span>
                    </div>
                    <div class="transfer-action">${transfer.valve_action}</div>
                </div>
            `;
        });
        html += '</div>';
    }
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;
}

// ============================================
// ELECTRICITY EXPLORER FUNCTIONS
// ============================================

let electricityDetailUsageChart = null;
let electricityDetailRenewableChart = null;
let electricityMitigationState = null;

function toggleElectricityExplorer() {
    const container = document.getElementById('electricityExplorerContainer');
    if (!container) return;

    const shouldShow = container.style.display === 'none' || container.style.display === '';
    container.style.display = shouldShow ? 'block' : 'none';

    const button = document.getElementById('electricityExploreBtn');
    if (button) {
        button.innerHTML = shouldShow
            ? '<i class="fas fa-times"></i> Close Explorer'
            : '<i class="fas fa-search"></i> Explore More';
    }
}

async function generateElectricityDetailedReport() {
    const fileInput = document.getElementById('electricityCsvInput');
    const statusNode = document.getElementById('electricityExploreStatus');
    const reportNode = document.getElementById('electricityDetailedReport');

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showErrorNotification('Please upload a CSV file for electricity analysis');
        if (statusNode) {
            statusNode.style.color = 'var(--critical-red)';
            statusNode.textContent = 'CSV required: upload a valid electricity dataset with Zone, City, Type, Current_Usage, NonEssential_Load, Essential_Load columns.';
        }
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    if (statusNode) {
        statusNode.style.color = 'var(--text-secondary)';
        statusNode.textContent = 'Processing CSV and generating electricity analysis...';
    }

    try {
        const response = await fetch(`${API_BASE}/electricity/detailed-report`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (!response.ok || !result.success || !result.report) {
            throw new Error(result.error || `Request failed with ${response.status}`);
        }

        const report = result.report;

        if (statusNode) {
            statusNode.style.color = 'var(--accent-green)';
            statusNode.textContent = `✓ Analysis complete for ${report.selected_date || 'uploaded data'}`;
        }

        if (reportNode) {
            reportNode.style.display = 'block';
        }
        renderPdfDownloadAction('electricityPdfActions', result.pdf_download_url, 'Electricity Report', report.selected_date);

        renderElectricityDetailedReport(report);
    } catch (error) {
        console.error('Error generating electricity report:', error);
        showErrorNotification(`Analysis failed: ${error.message}`);
        if (statusNode) {
            statusNode.style.color = 'var(--critical-red)';
            statusNode.textContent = `Error: ${error.message}`;
        }
    }
}

function renderElectricityDetailedReport(report) {
    // New sequential workflow rendering
    if (report.workflow) {
        renderSequentialWorkflow(report);
    } else {
        // Fallback to legacy rendering
        renderElectricityKpis(report.metrics || {});
        renderElectricityCharts(report.charts || {});
        renderOverloadZones(report.zone_status || report.overload_zones || []);
        renderOptimizationStrategy(report.optimization_plan || {}, report);
    }
}

function renderSequentialWorkflow(report) {
    const workflow = report.workflow;
    const container = document.getElementById('electricityDetailKpis');
    if (!container) return;
    
    container.innerHTML = `
        <div class="electricity-workflow-container" style="padding: 2rem;">
            <!-- Workflow Progress Bar -->
            <div class="workflow-progress" style="margin-bottom: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <div class="step-indicator ${workflow.step1_monitoring ? 'completed' : ''}">
                        <div class="step-number">1</div>
                        <div class="step-label">Monitor</div>
                    </div>
                    <div class="progress-line"></div>
                    <div class="step-indicator ${workflow.step2_prediction ? 'completed' : ''}">
                        <div class="step-number">2</div>
                        <div class="step-label">Predict</div>
                    </div>
                    <div class="progress-line"></div>
                    <div class="step-indicator ${workflow.step3_reallocation ? 'completed' : ''}">
                        <div class="step-number">3</div>
                        <div class="step-label">Reallocate</div>
                    </div>
                    <div class="progress-line"></div>
                    <div class="step-indicator ${workflow.step4_non_essential.requires_consent ? 'active' : ''}">
                        <div class="step-number">4</div>
                        <div class="step-label">Reduce</div>
                    </div>
                    <div class="progress-line"></div>
                    <div class="step-indicator ${workflow.step5_backup.requires_activation ? 'active' : ''}">
                        <div class="step-number">5</div>
                        <div class="step-label">Backup</div>
                    </div>
                    <div class="progress-line"></div>
                    <div class="step-indicator completed">
                        <div class="step-number">6</div>
                        <div class="step-label">Protect</div>
                    </div>
                </div>
            </div>
            
            <!-- Current Step Display -->
            <div id="workflowStepsDisplay"></div>
            
            <!-- Action Buttons -->
            <div id="workflowActions" style="margin-top: 2rem; text-align: center;"></div>
        </div>
    `;
    
    // Start sequential workflow
    startSequentialWorkflow(workflow, report);
}

let currentStep = 0;
let workflowData = null;

function startSequentialWorkflow(workflow, report) {
    workflowData = { workflow, report };
    currentStep = 0;
    showStep(0);
}

function showStep(stepIndex) {
    const display = document.getElementById('workflowStepsDisplay');
    const actions = document.getElementById('workflowActions');
    if (!display || !workflowData) return;
    
    const { workflow, report } = workflowData;
    
    switch(stepIndex) {
        case 0: // Step 1: Monitoring
            display.innerHTML = renderMonitoringStep(workflow.step1_monitoring, report.zones);
            actions.innerHTML = `<button class="btn-primary" onclick="showStep(1)" style="padding: 0.8rem 2rem; font-size: 1.1rem;">View AI Predictions →</button>`;
            break;
            
        case 1: // Step 2: AI Prediction
            display.innerHTML = renderPredictionStep(workflow.step2_prediction, report.zones);
            actions.innerHTML = `<button class="btn-primary" onclick="showStep(2)" style="padding: 0.8rem 2rem; font-size: 1.1rem;">Start Reallocation →</button>`;
            break;
            
        case 2: // Step 3: Reallocation
            display.innerHTML = renderReallocationStep(workflow.step3_reallocation);
            if (workflow.step4_non_essential.requires_consent) {
                actions.innerHTML = `<button class="btn-primary" onclick="showStep(3)" style="padding: 0.8rem 2rem; font-size: 1.1rem;">Request Non-Essential Reduction →</button>`;
            } else {
                actions.innerHTML = `<button class="btn-primary" onclick="showStep(5)" style="padding: 0.8rem 2rem; font-size: 1.1rem;">View Final Report →</button>`;
            }
            break;
            
        case 3: // Step 4: Non-Essential Popup
            showNonEssentialPopup(workflow.step4_non_essential);
            break;
            
        case 4: // Step 5: Backup Activation
            display.innerHTML = renderBackupStep(workflow.step5_backup);
            actions.innerHTML = `<button class="btn-primary" onclick="showStep(5)" style="padding: 0.8rem 2rem; font-size: 1.1rem;">View Final Results →</button>`;
            break;
            
        case 5: // Step 6: Final Report
            display.innerHTML = renderFinalReport(workflow.final_result, workflow.step6_essential_priority);
            actions.innerHTML = `<button class="btn-success" onclick="window.location.reload()" style="padding: 0.8rem 2rem; font-size: 1.1rem;">✓ Complete</button>`;
            break;
    }
    
    currentStep = stepIndex;
}

function renderMonitoringStep(monitoring, zones) {
    const actualOverloadedCount = zones.filter(z => z.is_overloaded).length;
    const safeZonesCount = zones.filter(z => !z.is_overloaded).length;
    
    return `
        <div class="workflow-step" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 2rem; border-radius: 12px; color: white; margin-bottom: 2rem;">
            <h2 style="margin: 0 0 1rem 0; font-size: 1.8rem;">📊 Step 1: Real-Time Zone Monitoring</h2>
            <p style="font-size: 1.1rem; opacity: 0.95;">Collecting electricity usage data from all zones in the smart city...</p>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
            <div class="kpi-card" style="background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%); padding: 1.5rem; border-radius: 12px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                <div style="font-size: 2.5rem; font-weight: bold; color: #00FF9D;">${monitoring.total_usage_kwh}</div>
                <div style="color: #a0aec0; margin-top: 0.5rem; font-size: 0.9rem;">Total Usage (kWh)</div>
            </div>
            <div class="kpi-card" style="background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%); padding: 1.5rem; border-radius: 12px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                <div style="font-size: 2.5rem; font-weight: bold; color: #00BFFF;">${monitoring.total_capacity_kwh}</div>
                <div style="color: #a0aec0; margin-top: 0.5rem; font-size: 0.9rem;">Total Capacity (kWh)</div>
            </div>
            <div class="kpi-card" style="background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%); padding: 1.5rem; border-radius: 12px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                <div style="font-size: 2.5rem; font-weight: bold; color: ${monitoring.grid_stress_percent > 85 ? '#FF4C4C' : '#FFC107'};">${monitoring.grid_stress_percent}%</div>
                <div style="color: #a0aec0; margin-top: 0.5rem; font-size: 0.9rem;">Grid Stress</div>
            </div>
            <div class="kpi-card" style="background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%); padding: 1.5rem; border-radius: 12px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                <div style="font-size: 2.5rem; font-weight: bold; color: ${actualOverloadedCount > 0 ? '#FF4C4C' : '#00FF9D'};">${actualOverloadedCount}</div>
                <div style="color: #a0aec0; margin-top: 0.5rem; font-size: 0.9rem;">Overloaded Zones</div>
            </div>
            <div class="kpi-card" style="background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%); padding: 1.5rem; border-radius: 12px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                <div style="font-size: 2.5rem; font-weight: bold; color: #00FF9D;">${safeZonesCount}</div>
                <div style="color: #a0aec0; margin-top: 0.5rem; font-size: 0.9rem;">Safe Zones</div>
            </div>
        </div>
        
        <div style="background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%); padding: 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
                <h3 style="margin: 0; color: white; font-size: 1.4rem;">⚡ Zone Status Overview</h3>
                <div style="display: flex; gap: 1.5rem; font-size: 0.9rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="width: 12px; height: 12px; background: #FF4C4C; border-radius: 50%; box-shadow: 0 0 8px #FF4C4C;"></div>
                        <span style="color: #e2e8f0;">Overloaded</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="width: 12px; height: 12px; background: #00FF9D; border-radius: 50%; box-shadow: 0 0 8px #00FF9D;"></div>
                        <span style="color: #e2e8f0;">Safe</span>
                    </div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.2rem;">
                ${zones.map(z => {
                    const isActuallyOverloaded = z.is_overloaded;
                    const statusIcon = isActuallyOverloaded ? '🔴' : '🟢';
                    const statusText = isActuallyOverloaded ? 'OVERLOADED' : 'SAFE';
                    const bgGradient = isActuallyOverloaded 
                        ? 'linear-gradient(135deg, rgba(255, 76, 76, 0.25) 0%, rgba(139, 0, 0, 0.25) 100%)'
                        : 'linear-gradient(135deg, rgba(0, 255, 157, 0.15) 0%, rgba(0, 128, 128, 0.15) 100%)';
                    const borderColor = isActuallyOverloaded ? '#FF4C4C' : '#00FF9D';
                    const glowColor = isActuallyOverloaded ? 'rgba(255, 76, 76, 0.3)' : 'rgba(0, 255, 157, 0.3)';
                    
                    return `
                    <div style="
                        background: ${bgGradient}; 
                        padding: 1.5rem; 
                        border-radius: 12px; 
                        border: 2px solid ${borderColor}; 
                        box-shadow: 0 4px 12px ${glowColor};
                        transition: all 0.3s ease;
                        position: relative;
                        overflow: hidden;
                    " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 20px ${glowColor}'" 
                       onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px ${glowColor}'">
                        
                        <!-- Status Badge -->
                        <div style="
                            position: absolute;
                            top: 10px;
                            right: 10px;
                            background: ${isActuallyOverloaded ? '#FF4C4C' : '#00FF9D'};
                            color: ${isActuallyOverloaded ? 'white' : '#1a202c'};
                            padding: 0.3rem 0.8rem;
                            border-radius: 20px;
                            font-size: 0.7rem;
                            font-weight: bold;
                            letter-spacing: 0.5px;
                        ">${statusText}</div>
                        
                        <!-- Zone Header -->
                        <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 1rem;">
                            <div style="font-size: 2rem;">${statusIcon}</div>
                            <div>
                                <div style="font-weight: bold; font-size: 1.3rem; color: white;">Zone ${z.zone_id}</div>
                                <div style="font-size: 0.85rem; color: #cbd5e0;">${z.city} • ${z.zone_type}</div>
                            </div>
                        </div>
                        
                        <!-- Metrics Grid -->
                        <div style="background: rgba(0, 0, 0, 0.4); padding: 1rem; border-radius: 8px; backdrop-filter: blur(10px);">
                            <div style="display: grid; gap: 0.6rem;">
                                <!-- Current Usage -->
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="color: #a0aec0; font-size: 0.9rem;">⚡ Current Usage</span>
                                    <span style="color: white; font-weight: bold; font-size: 1rem;">${z.current_usage} kWh</span>
                                </div>
                                
                                <!-- Max Capacity -->
                                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.6rem; border-top: 1px solid rgba(255,255,255,0.1);">
                                    <span style="color: #a0aec0; font-size: 0.9rem;">🔋 Max Capacity</span>
                                    <span style="color: white; font-weight: bold; font-size: 1rem;">${z.max_capacity} kWh</span>
                                </div>
                                
                                <!-- Usage Percentage Bar -->
                                <div style="padding-top: 0.6rem; border-top: 1px solid rgba(255,255,255,0.1);">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                        <span style="color: #a0aec0; font-size: 0.9rem;">📊 Usage</span>
                                        <span style="
                                            color: ${z.usage_percent > 100 ? '#FF4C4C' : z.usage_percent > 85 ? '#FFC107' : '#00FF9D'}; 
                                            font-weight: bold; 
                                            font-size: 1.1rem;
                                        ">${z.usage_percent}%</span>
                                    </div>
                                    <div style="background: rgba(255,255,255,0.1); height: 8px; border-radius: 4px; overflow: hidden;">
                                        <div style="
                                            background: ${z.usage_percent > 100 ? 'linear-gradient(90deg, #FF4C4C, #8B0000)' : z.usage_percent > 85 ? 'linear-gradient(90deg, #FFC107, #FF6B35)' : 'linear-gradient(90deg, #00FF9D, #00D37F)'};
                                            width: ${Math.min(z.usage_percent, 100)}%;
                                            height: 100%;
                                            transition: width 0.5s ease;
                                        "></div>
                                    </div>
                                </div>
                                
                                <!-- Non-Essential Load -->
                                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.6rem; border-top: 1px solid rgba(255,255,255,0.1);">
                                    <span style="color: #a0aec0; font-size: 0.9rem;">💡 Non-Essential</span>
                                    <span style="color: #FFC107; font-weight: bold; font-size: 0.95rem;">${z.non_essential} kWh</span>
                                </div>
                                
                                ${isActuallyOverloaded ? `
                                    <!-- Deficit Warning -->
                                    <div style="
                                        margin-top: 0.6rem; 
                                        padding: 0.8rem; 
                                        background: rgba(255, 76, 76, 0.3); 
                                        border-left: 3px solid #FF4C4C;
                                        border-radius: 4px;
                                    ">
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <span style="color: #FF4C4C; font-weight: bold; font-size: 0.85rem;">⚠️ ENERGY DEFICIT</span>
                                            <span style="color: #FF4C4C; font-weight: bold; font-size: 1rem;">${z.deficit} kWh</span>
                                        </div>
                                    </div>
                                ` : `
                                    <!-- Available Capacity -->
                                    <div style="
                                        margin-top: 0.6rem; 
                                        padding: 0.8rem; 
                                        background: rgba(0, 255, 157, 0.2); 
                                        border-left: 3px solid #00FF9D;
                                        border-radius: 4px;
                                    ">
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <span style="color: #00FF9D; font-weight: bold; font-size: 0.85rem;">✓ AVAILABLE</span>
                                            <span style="color: #00FF9D; font-weight: bold; font-size: 1rem;">${(z.max_capacity - z.current_usage).toFixed(2)} kWh</span>
                                        </div>
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                `;
                }).join('')}
            </div>
        </div>
    `;
}

function renderPredictionStep(prediction, zones) {
    const overloadedZones = zones.filter(z => z.is_overloaded);
    const safeZones = zones.filter(z => !z.is_overloaded);
    
    return `
        <div class="workflow-step" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 2rem; border-radius: 12px; color: white; margin-bottom: 2rem;">
            <h2 style="margin: 0 0 1rem 0; font-size: 1.8rem;">🤖 Step 2: AI Overload Risk Prediction</h2>
            <p style="font-size: 1.1rem; opacity: 0.95;">Using ${prediction.model_used} machine learning model to identify zones requiring immediate attention...</p>
        </div>
        
        <div style="background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%); padding: 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); margin-bottom: 2rem;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                <div style="background: rgba(255, 76, 76, 0.15); padding: 1.5rem; border-radius: 10px; border-left: 4px solid #FF4C4C; text-align: center;">
                    <div style="font-size: 3rem; font-weight: bold; color: #FF4C4C;">${prediction.zones_at_risk}</div>
                    <div style="color: #e2e8f0; margin-top: 0.5rem; font-size: 1rem;">Zones Needing Action</div>
                </div>
                <div style="background: rgba(255, 193, 7, 0.15); padding: 1.5rem; border-radius: 10px; border-left: 4px solid #FFC107; text-align: center;">
                    <div style="font-size: 3rem; font-weight: bold; color: #FFC107;">${prediction.total_extra_needed_kwh}</div>
                    <div style="color: #e2e8f0; margin-top: 0.5rem; font-size: 1rem;">Extra Energy Needed (kWh)</div>
                </div>
                <div style="background: rgba(0, 255, 157, 0.15); padding: 1.5rem; border-radius: 10px; border-left: 4px solid #00FF9D; text-align: center;">
                    <div style="font-size: 3rem; font-weight: bold; color: #00FF9D;">${safeZones.length}</div>
                    <div style="color: #e2e8f0; margin-top: 0.5rem; font-size: 1rem;">Safe Zones (Donors)</div>
                </div>
            </div>
            
            <!-- Overloaded Zones Section -->
            ${overloadedZones.length > 0 ? `
                <div style="margin-bottom: 2rem;">
                    <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 1rem;">
                        <h3 style="margin: 0; color: white; font-size: 1.3rem;">🔴 Critical Zones (Overloaded)</h3>
                        <div style="background: #FF4C4C; color: white; padding: 0.3rem 0.8rem; border-radius: 12px; font-size: 0.75rem; font-weight: bold;">URGENT</div>
                    </div>
                    <div style="display: grid; gap: 1rem;">
                        ${overloadedZones.map(z => `
                            <div style="
                                background: linear-gradient(135deg, rgba(255, 76, 76, 0.2) 0%, rgba(139, 0, 0, 0.2) 100%); 
                                border: 2px solid #FF4C4C; 
                                border-radius: 10px; 
                                padding: 1.5rem;
                                box-shadow: 0 4px 12px rgba(255, 76, 76, 0.3);
                            ">
                                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                                    <div style="flex: 1; min-width: 200px;">
                                        <div style="font-weight: bold; font-size: 1.3rem; color: white; margin-bottom: 0.3rem;">
                                            🔴 Zone ${z.zone_id} - ${z.city}
                                        </div>
                                        <div style="color: #e2e8f0; font-size: 0.95rem;">${z.zone_type} area</div>
                                    </div>
                                    <div style="display: flex; gap: 2rem; align-items: center;">
                                        <div style="text-align: center;">
                                            <div style="color: #ff7b7b; font-size: 0.8rem; margin-bottom: 0.3rem;">Usage</div>
                                            <div style="font-size: 1.5rem; font-weight: bold; color: #FF4C4C;">${z.usage_percent}%</div>
                                        </div>
                                        <div style="text-align: center;">
                                            <div style="color: #ff7b7b; font-size: 0.8rem; margin-bottom: 0.3rem;">Deficit</div>
                                            <div style="font-size: 1.3rem; font-weight: bold; color: #FF4C4C;">${z.deficit || 0} kWh</div>
                                        </div>
                                        <div style="text-align: center;">
                                            <div style="color: #a0aec0; font-size: 0.8rem; margin-bottom: 0.3rem;">Load</div>
                                            <div style="font-size: 1.1rem; font-weight: bold; color: white;">${z.current_usage} / ${z.max_capacity}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <!-- Safe Zones Section -->
            ${safeZones.length > 0 ? `
                <div>
                    <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 1rem;">
                        <h3 style="margin: 0; color: white; font-size: 1.3rem;">🟢 Safe Zones (Available for Reallocation)</h3>
                        <div style="background: #00FF9D; color: #1a202c; padding: 0.3rem 0.8rem; border-radius: 12px; font-size: 0.75rem; font-weight: bold;">STABLE</div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">
                        ${safeZones.map(z => {
                            const available = (z.max_capacity - z.current_usage).toFixed(2);
                            return `
                            <div style="
                                background: linear-gradient(135deg, rgba(0, 255, 157, 0.15) 0%, rgba(0, 128, 128, 0.15) 100%); 
                                border: 2px solid #00FF9D; 
                                border-radius: 10px; 
                                padding: 1.2rem;
                                box-shadow: 0 4px 12px rgba(0, 255, 157, 0.2);
                            ">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem;">
                                    <div>
                                        <div style="font-weight: bold; font-size: 1.2rem; color: white;">🟢 Zone ${z.zone_id}</div>
                                        <div style="color: #cbd5e0; font-size: 0.85rem;">${z.city} • ${z.zone_type}</div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 1.3rem; font-weight: bold; color: #00FF9D;">${z.usage_percent}%</div>
                                        <div style="color: #4ade80; font-size: 0.75rem;">Usage</div>
                                    </div>
                                </div>
                                <div style="background: rgba(0, 0, 0, 0.3); padding: 0.8rem; border-radius: 6px;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                        <span style="color: #a0aec0; font-size: 0.85rem;">Current Load</span>
                                        <span style="color: white; font-weight: bold;">${z.current_usage} kWh</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1);">
                                        <span style="color: #00FF9D; font-size: 0.9rem; font-weight: bold;">✓ Can Donate</span>
                                        <span style="color: #00FF9D; font-weight: bold; font-size: 1.1rem;">${available} kWh</span>
                                    </div>
                                </div>
                            </div>
                        `;
                        }).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function renderReallocationStep(reallocation) {
    const success = reallocation.transferred_kwh > 0;
    const efficiencyPercent = reallocation.available_for_transfer_kwh > 0 
        ? ((reallocation.transferred_kwh / reallocation.available_for_transfer_kwh) * 100).toFixed(1)
        : 0;
    
    return `
        <div class="workflow-step" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 2rem; border-radius: 12px; color: white; margin-bottom: 2rem;">
            <h2 style="margin: 0 0 1rem 0; font-size: 1.8rem;">🔄 Step 3: Dynamic Power Reallocation</h2>
            <p style="font-size: 1.1rem; opacity: 0.95;">Intelligently redistributing electricity from low-usage zones to high-demand zones...</p>
        </div>
        
        <div style="background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%); padding: 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
            <!-- Reallocation Flow Visualization -->
            <div style="display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; gap: 1rem; align-items: center; margin-bottom: 2.5rem;">
                <!-- Available Power -->
                <div style="background: rgba(0, 191, 255, 0.2); padding: 1.5rem; border-radius: 12px; border: 2px solid #00BFFF; text-align: center;">
                    <div style="font-size: 0.85rem; color: #a0aec0; margin-bottom: 0.5rem;">💧 AVAILABLE</div>
                    <div style="font-size: 2.5rem; font-weight: bold; color: #00BFFF;">${reallocation.available_for_transfer_kwh}</div>
                    <div style="color: #7dd3fc; margin-top: 0.3rem; font-size: 0.9rem;">kWh from safe zones</div>
                </div>
                
                <!-- Arrow 1 -->
                <div style="color: #00BFFF; font-size: 2.5rem;">→</div>
                
                <!-- Transferred -->
                <div style="background: rgba(0, 255, 157, 0.2); padding: 1.5rem; border-radius: 12px; border: 2px solid #00FF9D; text-align: center;">
                    <div style="font-size: 0.85rem; color: #a0aec0; margin-bottom: 0.5rem;">✓ TRANSFERRED</div>
                    <div style="font-size: 2.5rem; font-weight: bold; color: #00FF9D;">${reallocation.transferred_kwh}</div>
                    <div style="color: #4ade80; margin-top: 0.3rem; font-size: 0.9rem;">kWh reallocated</div>
                    ${success ? `
                        <div style="margin-top: 0.5rem; background: rgba(0, 255, 157, 0.3); padding: 0.5rem; border-radius: 6px; font-size: 0.85rem; color: #00FF9D; font-weight: bold;">
                            ${efficiencyPercent}% Efficiency
                        </div>
                    ` : ''}
                </div>
                
                <!-- Arrow 2 -->
                <div style="color: ${reallocation.remaining_after_transfer_kwh > 0 ? '#FFC107' : '#00FF9D'}; font-size: 2.5rem;">→</div>
                
                <!-- Remaining Need -->
                <div style="background: rgba(${reallocation.remaining_after_transfer_kwh > 0 ? '255, 193, 7' : '0, 255, 157'}, 0.2); padding: 1.5rem; border-radius: 12px; border: 2px solid ${reallocation.remaining_after_transfer_kwh > 0 ? '#FFC107' : '#00FF9D'}; text-align: center;">
                    <div style="font-size: 0.85rem; color: #a0aec0; margin-bottom: 0.5rem;">${reallocation.remaining_after_transfer_kwh > 0 ? '⚠️ REMAINING' : '✅ COMPLETE'}</div>
                    <div style="font-size: 2.5rem; font-weight: bold; color: ${reallocation.remaining_after_transfer_kwh > 0 ? '#FFC107' : '#00FF9D'};">${reallocation.remaining_after_transfer_kwh}</div>
                    <div style="color: ${reallocation.remaining_after_transfer_kwh > 0 ? '#fbbf24' : '#4ade80'}; margin-top: 0.3rem; font-size: 0.9rem;">kWh still needed</div>
                </div>
            </div>
            
            <!-- Status Messages -->
            <div style="display: grid; gap: 1rem;">
                ${success ? `
                    <div style="background: linear-gradient(135deg, rgba(0, 255, 157, 0.15) 0%, rgba(0, 128, 128, 0.15) 100%); border-left: 4px solid #00FF9D; padding: 1.5rem; border-radius: 8px;">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div style="font-size: 2.5rem;">✓</div>
                            <div>
                                <div style="font-size: 1.2rem; font-weight: bold; color: #00FF9D; margin-bottom: 0.5rem;">Reallocation Successful</div>
                                <div style="color: #e2e8f0; font-size: 1rem;">Successfully transferred ${reallocation.transferred_kwh} kWh from safe zones to overloaded zones.</div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                ${reallocation.needs_further_action ? `
                    <div style="background: linear-gradient(135deg, rgba(255, 193, 7, 0.15) 0%, rgba(255, 140, 0, 0.15) 100%); border-left: 4px solid #FFC107; padding: 1.5rem; border-radius: 8px;">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div style="font-size: 2.5rem;">⚠️</div>
                            <div>
                                <div style="font-size: 1.2rem; font-weight: bold; color: #FFC107; margin-bottom: 0.5rem;">Additional Action Required</div>
                                <div style="color: #e2e8f0; font-size: 1rem;">Reallocation alone is not sufficient. We still need <strong style="color: #FFC107;">${reallocation.remaining_after_transfer_kwh} kWh</strong> more energy to meet demand.</div>
                                <div style="margin-top: 0.8rem; color: #fbbf24; font-size: 0.95rem;">
                                    ➡️ Proceeding to non-essential load reduction...
                                </div>
                            </div>
                        </div>
                    </div>
                ` : `
                    <div style="background: linear-gradient(135deg, rgba(0, 255, 157, 0.15) 0%, rgba(0, 128, 128, 0.15) 100%); border-left: 4px solid #00FF9D; padding: 1.5rem; border-radius: 8px;">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div style="font-size: 2.5rem;">🎉</div>
                            <div>
                                <div style="font-size: 1.2rem; font-weight: bold; color: #00FF9D; margin-bottom: 0.5rem;">All Needs Met!</div>
                                <div style="color: #e2e8f0; font-size: 1rem;">Power reallocation was sufficient to handle all energy demands. No further action needed.</div>
                            </div>
                        </div>
                    </div>
                `}
            </div>
            
            <!-- Reallocation Stats -->
            <div style="margin-top: 2rem; padding-top: 2rem; border-top: 2px solid rgba(255,255,255,0.1);">
                <h4 style="color: white; margin-bottom: 1rem; font-size: 1.1rem;">📊 Reallocation Statistics</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem;">
                    <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 8px; text-align: center;">
                        <div style="color: #a0aec0; font-size: 0.85rem; margin-bottom: 0.3rem;">Load Balancing</div>
                        <div style="color: #00BFFF; font-weight: bold; font-size: 1.2rem;">Active</div>
                    </div>
                    <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 8px; text-align: center;">
                        <div style="color: #a0aec0; font-size: 0.85rem; margin-bottom: 0.3rem;">Grid Stability</div>
                        <div style="color: ${reallocation.remaining_after_transfer_kwh > 0 ? '#FFC107' : '#00FF9D'}; font-weight: bold; font-size: 1.2rem;">${reallocation.remaining_after_transfer_kwh > 0 ? 'Moderate' : 'High'}</div>
                    </div>
                    <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 8px; text-align: center;">
                        <div style="color: #a0aec0; font-size: 0.85rem; margin-bottom: 0.3rem;">Response Time</div>
                        <div style="color: #00FF9D; font-weight: bold; font-size: 1.2rem;">Real-time</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function showNonEssentialPopup(nonEssential) {
    const modal = document.createElement('div');
    modal.id = 'nonEssentialModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 3rem; border-radius: 16px; max-width: 600px; color: white; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
            <h2 style="margin: 0 0 1rem 0; font-size: 2rem;">⚡ Energy Shortage Alert</h2>
            <p style="font-size: 1.2rem; line-height: 1.6; margin-bottom: 2rem;">
                We still need <strong style="color: #FFC107;">${nonEssential.can_be_reduced_kwh} kWh</strong> more energy to meet demand.
                <br><br>
                Can we temporarily reduce non-essential loads?
            </p>
            
            <div style="background: rgba(255, 255, 255, 0.15); padding: 1.5rem; border-radius: 10px; margin-bottom: 2rem;">
                <div style="font-weight: bold; margin-bottom: 1rem; font-size: 1.1rem;">Non-Essential Loads Available:</div>
                <div style="display: grid; gap: 0.8rem;">
                    <div style="display: flex; justify-content: space-between; padding: 0.5rem 0;">
                        <span>📢 Advertising Boards</span>
                        <span style="font-weight: bold;">${nonEssential.breakdown.advertising_boards} kWh</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-top: 1px solid rgba(255,255,255,0.2);">
                        <span>💡 Decorative Lighting</span>
                        <span style="font-weight: bold;">${nonEssential.breakdown.decorative_lighting} kWh</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-top: 1px solid rgba(255,255,255,0.2);">
                        <span>🌿 Garden Irrigation</span>
                        <span style="font-weight: bold;">${nonEssential.breakdown.garden_irrigation} kWh</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-top: 1px solid rgba(255,255,255,0.2);">
                        <span>🏢 Non-Critical Commercial</span>
                        <span style="font-weight: bold;">${nonEssential.breakdown.non_critical_commercial} kWh</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.8rem 0; border-top: 2px solid rgba(255,255,255,0.3); margin-top: 0.5rem; font-size: 1.1rem;">
                        <span style="font-weight: bold;">Total Available:</span>
                        <span style="font-weight: bold; color: #00FF9D;">${nonEssential.total_available_kwh} kWh</span>
                    </div>
                </div>
            </div>
            
            <div style="background: rgba(0, 255, 157, 0.2); padding: 1rem; border-radius: 8px; margin-bottom: 2rem; font-size: 0.95rem;">
                ✓ Essential services (hospitals, traffic, water, emergency) remain fully powered
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: center;">
                <button onclick="acceptNonEssentialReduction()" style="padding: 1rem 2.5rem; font-size: 1.2rem; background: #00FF9D; color: #1a202c; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 12px rgba(0,255,157,0.3);">
                    ✓ Accept & Continue
                </button>
                <button onclick="rejectNonEssentialReduction()" style="padding: 1rem 2.5rem; font-size: 1.2rem; background: #FF4C4C; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 12px rgba(255,76,76,0.3);">
                    ✗ Cancel
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function acceptNonEssentialReduction() {
    const modal = document.getElementById('nonEssentialModal');
    if (modal) modal.remove();
    
    // Show confirmation
    const display = document.getElementById('workflowStepsDisplay');
    const actions = document.getElementById('workflowActions');
    const { workflow } = workflowData;
    
    display.innerHTML = `
        <div class="workflow-step" style="background: linear-gradient(135deg, #FA8BFF 0%, #2BD2FF 90%); padding: 2rem; border-radius: 12px; color: white; margin-bottom: 2rem;">
            <h2 style="margin: 0 0 1rem 0; font-size: 1.8rem;">💡 Step 4: Non-Essential Load Reduction</h2>
            <p style="font-size: 1.1rem; opacity: 0.95;">Temporarily reducing non-essential loads to free up energy...</p>
        </div>
        
        <div style="background: #2d3748; padding: 2rem; border-radius: 10px; margin-bottom: 2rem;">
            <div style="background: rgba(0, 255, 157, 0.1); border-left: 4px solid #00FF9D; padding: 1.5rem; border-radius: 6px; margin-bottom: 2rem;">
                <div style="font-size: 1.3rem; font-weight: bold; color: #00FF9D; margin-bottom: 0.5rem;">✓ Consent Received</div>
                <div style="color: #e2e8f0; font-size: 1.05rem;">Non-essential loads are being reduced to conserve ${workflow.step4_non_essential.can_be_reduced_kwh} kWh</div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem;">
                <div style="text-align: center;">
                    <div style="font-size: 2.5rem; font-weight: bold; color: #FF4C4C;">${workflow.step4_non_essential.can_be_reduced_kwh}</div>
                    <div style="color: #a0aec0; margin-top: 0.5rem;">Reduced (kWh)</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 2.5rem; font-weight: bold; color: ${workflow.step4_non_essential.remaining_after_reduction_kwh > 0 ? '#FFC107' : '#00FF9D'};">${workflow.step4_non_essential.remaining_after_reduction_kwh}</div>
                    <div style="color: #a0aec0; margin-top: 0.5rem;">Still Needed (kWh)</div>
                </div>
            </div>
        </div>
    `;
    
    if (workflow.step5_backup.requires_activation) {
        actions.innerHTML = `<button class="btn-primary" onclick="showStep(4)" style="padding: 0.8rem 2rem; font-size: 1.1rem;">Activate Backup Sources →</button>`;
    } else {
        actions.innerHTML = `<button class="btn-primary" onclick="showStep(5)" style="padding: 0.8rem 2rem; font-size: 1.1rem;">View Final Report →</button>`;
    }
}

function rejectNonEssentialReduction() {
    const modal = document.getElementById('nonEssentialModal');
    if (modal) modal.remove();
    
    // Move directly to backup
    showStep(4);
}

function renderBackupStep(backup) {
    return `
        <div class="workflow-step" style="background: linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%); padding: 2rem; border-radius: 12px; color: #2d3436; margin-bottom: 2rem;">
            <h2 style="margin: 0 0 1rem 0; font-size: 1.8rem;">🔋 Step 5: Activate Backup Sources</h2>
            <p style="font-size: 1.1rem; opacity: 0.9;">Engaging renewable energy backup systems...</p>
        </div>
        
        <div style="background: #2d3748; padding: 2rem; border-radius: 10px;">
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem; margin-bottom: 2rem;">
                <div style="background: rgba(255, 193, 7, 0.1); padding: 1.5rem; border-radius: 10px; text-align: center;">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">☀️</div>
                    <div style="font-size: 2rem; font-weight: bold; color: #FFC107;">${backup.solar_used_kwh}</div>
                    <div style="color: #a0aec0; margin-top: 0.3rem;">Solar Used (kWh)</div>
                    <div style="color: #718096; font-size: 0.9rem; margin-top: 0.3rem;">of ${backup.solar_available_kwh} kWh available</div>
                </div>
                <div style="background: rgba(0, 255, 157, 0.1); padding: 1.5rem; border-radius: 10px; text-align: center;">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔋</div>
                    <div style="font-size: 2rem; font-weight: bold; color: #00FF9D;">${backup.battery_used_kwh}</div>
                    <div style="color: #a0aec0; margin-top: 0.3rem;">Battery Used (kWh)</div>
                    <div style="color: #718096; font-size: 0.9rem; margin-top: 0.3rem;">of ${backup.battery_available_kwh} kWh available</div>
                </div>
            </div>
            
            <div style="background: rgba(0, 191, 255, 0.1); padding: 1.5rem; border-radius: 8px; text-align: center;">
                <div style="font-size: 1.2rem; color: #a0aec0; margin-bottom: 0.5rem;">Total Backup Utilized</div>
                <div style="font-size: 3rem; font-weight: bold; color: #00BFFF;">${backup.total_backup_used_kwh} kWh</div>
            </div>
            
            ${backup.remaining_need_kwh <= 0.01 ? `
                <div style="background: rgba(0, 255, 157, 0.1); border-left: 4px solid #00FF9D; padding: 1.5rem; border-radius: 6px; margin-top: 1.5rem;">
                    <div style="font-size: 1.2rem; font-weight: bold; color: #00FF9D; margin-bottom: 0.5rem;">✓ Backup Successful</div>
                    <div style="color: #e2e8f0;">All energy needs have been met! The grid is stable.</div>
                </div>
            ` : `
                <div style="background: rgba(255, 76, 76, 0.1); border-left: 4px solid #FF4C4C; padding: 1.5rem; border-radius: 6px; margin-top: 1.5rem;">
                    <div style="font-size: 1.2rem; font-weight: bold; color: #FF4C4C; margin-bottom: 0.5rem;">⚠️ Additional Capacity Needed</div>
                    <div style="color: #e2e8f0;">Still short by ${backup.remaining_need_kwh} kWh. Additional measures required.</div>
                </div>
            `}
        </div>
    `;
}

function renderFinalReport(finalResult, essentialPriority) {
    const met = finalResult.electricity_met === 'YES';
    
    return `
        <div class="workflow-step" style="background: ${met ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' : 'linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)'}; padding: 2rem; border-radius: 12px; color: white; margin-bottom: 2rem;">
            <h2 style="margin: 0 0 1rem 0; font-size: 2rem;">${met ? '✅' : '⚠️'} Final Results: ${finalResult.electricity_met}</h2>
            <p style="font-size: 1.2rem; opacity: 0.95;">${met ? 'All electricity needs have been successfully met!' : 'Unable to fully meet electricity demand.'}</p>
        </div>
        
        <div style="background: #2d3748; padding: 2rem; border-radius: 10px; margin-bottom: 2rem;">
            <h3 style="color: white; margin-bottom: 1.5rem; font-size: 1.5rem;">📊 Resources Utilized:</h3>
            
            <div style="display: grid; gap: 1rem;">
                <div style="background: rgba(0, 191, 255, 0.1); padding: 1.2rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #e2e8f0; font-size: 1.1rem;">🔄 Power Reallocated</span>
                    <span style="color: #00BFFF; font-weight: bold; font-size: 1.3rem;">${finalResult.resources_utilized.reallocated_kwh} kWh</span>
                </div>
                
                <div style="background: rgba(255, 193, 7, 0.1); padding: 1.2rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #e2e8f0; font-size: 1.1rem;">💡 Non-Essential Reduced</span>
                    <span style="color: #FFC107; font-weight: bold; font-size: 1.3rem;">${finalResult.resources_utilized.non_essential_reduced_kwh} kWh</span>
                </div>
                
                <div style="background: rgba(255, 193, 7, 0.1); padding: 1.2rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #e2e8f0; font-size: 1.1rem;">☀️ Solar Backup</span>
                    <span style="color: #FFC107; font-weight: bold; font-size: 1.3rem;">${finalResult.resources_utilized.solar_backup_kwh} kWh</span>
                </div>
                
                <div style="background: rgba(0, 255, 157, 0.1); padding: 1.2rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #e2e8f0; font-size: 1.1rem;">🔋 Battery Backup</span>
                    <span style="color: #00FF9D; font-weight: bold; font-size: 1.3rem;">${finalResult.resources_utilized.battery_backup_kwh} kWh</span>
                </div>
                
                <div style="background: rgba(102, 126, 234, 0.2); padding: 1.5rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; border: 2px solid #667eea;">
                    <span style="color: white; font-weight: bold; font-size: 1.2rem;">📈 Total Utilized</span>
                    <span style="color: #667eea; font-weight: bold; font-size: 1.5rem;">${finalResult.resources_utilized.total_utilized_kwh} kWh</span>
                </div>
            </div>
        </div>
        
        <div style="background: #2d3748; padding: 2rem; border-radius: 10px;">
            <h3 style="color: white; margin-bottom: 1.5rem; font-size: 1.5rem;">🏥 Step 6: Essential Services Protected</h3>
            <div style="color: #a0aec0; margin-bottom: 1.5rem; font-size: 1.05rem;">
                All critical infrastructure maintains full power supply:
            </div>
            
            <div style="display: grid; gap: 1rem;">
                ${essentialPriority.services.map(service => `
                    <div style="background: rgba(0, 255, 157, 0.1); border-left: 4px solid #00FF9D; padding: 1.2rem; border-radius: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight: bold; color: white; font-size: 1.1rem; margin-bottom: 0.3rem;">
                                    ${service.service} (Priority ${service.priority})
                                </div>
                                <div style="color: #00FF9D; font-size: 0.95rem;">✓ ${service.guarantee}</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: bold; color: #00FF9D; font-size: 1.2rem;">${service.allocation_kwh} kWh</div>
                                <div style="color: #4ade80; font-size: 0.85rem;">${service.status}</div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderElectricityKpis(metrics) {
    const container = document.getElementById('electricityDetailKpis');
    if (!container) return;

    const criticalCount = metrics.critical_zones_count || 0;
    const highStressCount = metrics.high_stress_zones_count || 0;
    const avgUsagePercent = metrics.average_usage_percent || 0;
    const peakUsagePercent = metrics.peak_usage_percent || 0;
    const renewablePercent = metrics.renewable_percentage || 0;
    const batteryStatusPercent = metrics.battery_status_percent || 0;
    const optimizationScore = Math.min(100, Math.max(0, 100 - avgUsagePercent + renewablePercent * 0.3));

    container.innerHTML = `
        <div style="padding: 1rem;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem;">
                <div class="electricity-kpi-card">
                    <div class="electricity-kpi-label">Critical Zones</div>
                    <div class="electricity-kpi-value" style="color: ${criticalCount > 0 ? '#FF4C4C' : '#00FF9D'};">${criticalCount}</div>
                </div>
                <div class="electricity-kpi-card">
                    <div class="electricity-kpi-label">High Stress Zones</div>
                    <div class="electricity-kpi-value" style="color: ${highStressCount > 0 ? '#FFC107' : '#00FF9D'};">${highStressCount}</div>
                </div>
                <div class="electricity-kpi-card">
                    <div class="electricity-kpi-label">Avg Usage</div>
                    <div class="electricity-kpi-value" style="color: ${avgUsagePercent > 85 ? '#FF4C4C' : avgUsagePercent > 70 ? '#FFC107' : '#00FF9D'};">${avgUsagePercent.toFixed(1)}%</div>
                </div>
                <div class="electricity-kpi-card">
                    <div class="electricity-kpi-label">Peak Usage</div>
                    <div class="electricity-kpi-value" style="color: ${peakUsagePercent > 90 ? '#FF4C4C' : '#FFC107'};">${peakUsagePercent.toFixed(1)}%</div>
                </div>
                <div class="electricity-kpi-card">
                    <div class="electricity-kpi-label">Renewable Supply</div>
                    <div class="electricity-kpi-value" style="color: #00FF9D;">${renewablePercent.toFixed(1)}%</div>
                </div>
                <div class="electricity-kpi-card">
                    <div class="electricity-kpi-label">Battery Status</div>
                    <div class="electricity-kpi-value" style="color: ${batteryStatusPercent < 20 ? '#FF4C4C' : '#00FF9D'};">${batteryStatusPercent.toFixed(1)}%</div>
                </div>
                <div class="electricity-kpi-card">
                    <div class="electricity-kpi-label">Optimization Score</div>
                    <div class="electricity-kpi-value" style="color: #FFD700;">${optimizationScore.toFixed(1)}/100</div>
                </div>
            </div>
        </div>
    `;
}

function renderElectricityCharts(charts) {
    const usageCanvas = document.getElementById('electricityDetailUsageChart');
    const renewableCanvas = document.getElementById('electricityDetailRenewableChart');
    
    if (!usageCanvas || !renewableCanvas || !charts) return;

    if (electricityDetailUsageChart) electricityDetailUsageChart.destroy();
    if (electricityDetailRenewableChart) electricityDetailRenewableChart.destroy();

    // Zone Usage vs Capacity Chart
    electricityDetailUsageChart = new Chart(usageCanvas, {
        type: 'bar',
        data: {
            labels: charts.zone_usage?.labels || [],
            datasets: [{
                label: 'Current Usage',
                data: charts.zone_usage?.usage_values || [],
                backgroundColor: 'rgba(255, 193, 7, 0.7)',
                borderColor: 'rgba(255, 193, 7, 1)',
                borderWidth: 1
            }, {
                label: 'Total Capacity',
                data: charts.zone_usage?.capacity_values || [],
                backgroundColor: 'rgba(0, 191, 255, 0.7)',
                borderColor: 'rgba(0, 191, 255, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { labels: { color: '#E2E8F0' } }
            },
            scales: {
                x: { ticks: { color: '#94A3B8' }, grid: { color: 'rgba(148, 163, 184, 0.2)' } },
                y: { ticks: { color: '#94A3B8' }, grid: { color: 'rgba(148, 163, 184, 0.2)' } }
            }
        }
    });

    // Essential vs Non-Essential Load Mix Chart
    electricityDetailRenewableChart = new Chart(renewableCanvas, {
        type: 'doughnut',
        data: {
            labels: charts.renewable_mix?.labels || ['Essential Load', 'Non-Essential Load'],
            datasets: [{
                data: charts.renewable_mix?.values || [],
                backgroundColor: [
                    'rgba(0, 191, 255, 0.8)',      // Essential - Cyan
                    'rgba(255, 193, 7, 0.8)'       // Non-Essential - Gold
                ],
                borderColor: ['#00BFFF', '#FFC107'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#E2E8F0', padding: 15 }
                }
            }
        }
    });
}

function renderOverloadZones(zones) {
    const container = document.getElementById('electricityOverloadTable');
    if (!container) return;

    if (!zones || zones.length === 0) {
        container.innerHTML = '<div style="color: var(--text-secondary); padding: 1rem;">No zone data found in uploaded CSV.</div>';
        return;
    }

    let html = '<div style="overflow-x: auto;">';
    html += '<table class="electricity-overload-table" style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">';
    html += '<thead><tr>';
    html += '<th style="padding: 0.75rem; border-bottom: 1px solid #475569; text-align: left; color: var(--accent-cyan);">Zone</th>';
    html += '<th style="padding: 0.75rem; border-bottom: 1px solid #475569; text-align: left; color: var(--accent-cyan);">City</th>';
    html += '<th style="padding: 0.75rem; border-bottom: 1px solid #475569; text-align: left; color: var(--accent-cyan);">Type</th>';
    html += '<th style="padding: 0.75rem; border-bottom: 1px solid #475569; text-align: left; color: var(--accent-cyan);">Usage (kWh)</th>';
    html += '<th style="padding: 0.75rem; border-bottom: 1px solid #475569; text-align: left; color: var(--accent-cyan);">Capacity (kWh)</th>';
    html += '<th style="padding: 0.75rem; border-bottom: 1px solid #475569; text-align: left; color: var(--accent-cyan);">Usage %</th>';
    html += '<th style="padding: 0.75rem; border-bottom: 1px solid #475569; text-align: left; color: var(--accent-cyan);">AI Overload Risk</th>';
    html += '<th style="padding: 0.75rem; border-bottom: 1px solid #475569; text-align: left; color: var(--accent-cyan);">Need (kWh)</th>';
    html += '</tr></thead><tbody>';

    zones.forEach(zone => {
        const predicted = Boolean(zone.predicted_overload);
        const rowBg = predicted ? 'rgba(255, 76, 76, 0.12)' : 'transparent';
        const riskLabel = predicted
            ? `HIGH (${Number(zone.overload_probability || 0).toFixed(1)}%)`
            : `LOW (${Number(zone.overload_probability || 0).toFixed(1)}%)`;

        html += `<tr style="border-bottom: 1px solid #334155; background: ${rowBg};">`;
        html += `<td style="padding: 0.75rem; color: var(--accent-cyan); font-weight: 700;">${escapeHtml(String(zone.zone_id))}</td>`;
        html += `<td style="padding: 0.75rem; color: var(--text-secondary);">${escapeHtml(String(zone.city || '-'))}</td>`;
        html += `<td style="padding: 0.75rem; color: var(--text-secondary);">${zone.zone_type}</td>`;
        html += `<td style="padding: 0.75rem; color: var(--text-primary);">${Number(zone.usage || 0).toFixed(0)}</td>`;
        html += `<td style="padding: 0.75rem; color: var(--text-primary);">${Number(zone.capacity || 0).toFixed(0)}</td>`;
        html += `<td style="padding: 0.75rem; color: ${predicted ? '#FF4C4C' : 'var(--text-primary)'}; font-weight: ${predicted ? '700' : '500'};">${Number(zone.usage_percent || 0).toFixed(1)}%</td>`;
        html += `<td style="padding: 0.75rem; color: ${predicted ? '#FF4C4C' : '#00FF9D'}; font-weight: 700;">${riskLabel}</td>`;
        html += `<td style="padding: 0.75rem; color: ${Number(zone.deficit || 0) > 0 ? '#FF4C4C' : '#00FF9D'}; font-weight: 700;">${Number(zone.deficit || 0).toFixed(0)}</td>`;
        html += `</tr>`;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function renderOptimizationStrategy(plan, report) {
    const container = document.getElementById('electricityOptimization');
    if (!container) return;

    electricityMitigationState = {
        remainingNeed: Number(plan.remaining_after_reallocation || 0),
        used: {
            reallocation: Number(plan.total_reallocation || 0),
            advertising: 0,
            otherNonEssential: 0,
            solar: 0,
            battery: 0
        },
        components: {
            advertising: Number(plan.non_essential_components?.advertising_boards || 0),
            decorative: Number(plan.non_essential_components?.decorative_lighting || 0),
            garden: Number(plan.non_essential_components?.garden_irrigation_pumps || 0),
            nonCritical: Number(plan.non_essential_components?.non_critical_commercial_loads || 0),
            solar: Number(plan.backup_sources?.solar_backup_kwh || 0),
            battery: Number(plan.backup_sources?.battery_backup_kwh || 0)
        },
        essentialServices: report?.essential_services || []
    };

    const servicesHtml = electricityMitigationState.essentialServices.map(service => `
        <div style="padding: 0.5rem 0; border-bottom: 1px solid rgba(148,163,184,0.2);">
            <strong style="color: #00BFFF;">P${service.priority}: ${service.service}</strong>
            <span style="color: var(--text-secondary);"> — ${service.guarantee}</span>
        </div>
    `).join('');

    container.innerHTML = `
        <div style="padding: 1rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem;">
            <div style="border: 1px solid rgba(0,191,255,0.35); border-radius: 8px; padding: 1rem; background: rgba(0,191,255,0.06);">
                <div style="color: #00BFFF; font-weight: 700; margin-bottom: 0.35rem;">Step 1: Monitor + Predict</div>
                <div style="color: var(--text-secondary);">AI confidence: <strong style="color: var(--text-primary);">${Number(report?.metrics?.model_confidence || 0).toFixed(1)}%</strong></div>
                <div style="color: var(--text-secondary);">Peak demand zone: <strong style="color: #FFC107;">Zone ${escapeHtml(String(report?.metrics?.peak_demand_zone || '-'))}</strong></div>
            </div>

            <div style="border: 1px solid rgba(0,255,157,0.35); border-radius: 8px; padding: 1rem; background: rgba(0,255,157,0.06);">
                <div style="color: var(--accent-green); font-weight: 700; margin-bottom: 0.35rem;">Step 2: Reallocation</div>
                <div style="color: var(--text-secondary);">Transferred from low-demand zones:</div>
                <div style="color: #00FF9D; font-size: 1.2rem; font-weight: 700;">${Number(plan.total_reallocation || 0).toFixed(0)} kWh</div>
                <div style="color: var(--text-secondary); margin-top: 0.35rem;">Need still pending:</div>
                <div style="color: ${electricityMitigationState.remainingNeed > 0 ? '#FF4C4C' : '#00FF9D'}; font-size: 1.2rem; font-weight: 700;">${electricityMitigationState.remainingNeed.toFixed(0)} kWh</div>
            </div>

            <div style="border: 1px solid rgba(255,193,7,0.35); border-radius: 8px; padding: 1rem; background: rgba(255,193,7,0.06);">
                <div style="color: #FFD700; font-weight: 700; margin-bottom: 0.35rem;">Step 3: Consent-based Actions</div>
                <div style="color: var(--text-secondary);">Advertising boards cut available: <strong style="color: #FFB347;">${electricityMitigationState.components.advertising.toFixed(0)} kWh</strong></div>
                <div style="color: var(--text-secondary);">Solar + battery backup available: <strong style="color: #00FF9D;">${(electricityMitigationState.components.solar + electricityMitigationState.components.battery).toFixed(0)} kWh</strong></div>
            </div>
        </div>

        <div style="padding: 0 1rem 1rem 1rem; display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <button class="action-btn" onclick="runElectricityMitigationSequence()">
                <i class="fas fa-bolt"></i> Run Step-by-Step Sequence
            </button>
            <button class="action-btn secondary" onclick="renderElectricityMitigationSummary()">
                <i class="fas fa-clipboard-check"></i> Refresh Final Summary
            </button>
        </div>

        <div id="electricitySequenceLog" style="margin: 0 1rem; padding: 1rem; border-radius: 8px; background: rgba(2, 6, 23, 0.35); border: 1px solid rgba(148,163,184,0.25); color: var(--text-secondary);">
            Sequence ready. Click <strong style="color: var(--accent-cyan);">Run Step-by-Step Sequence</strong> to trigger popups and optimize in order.
        </div>

        <div style="margin: 1rem; padding: 1rem; border-left: 4px solid #00BFFF; background: rgba(0,191,255,0.08); border-radius: 6px;">
            <div style="color: #00BFFF; font-weight: 700; margin-bottom: 0.5rem;">Step 6: Essential Services Priority</div>
            ${servicesHtml || '<div style="color: var(--text-secondary);">Essential service priorities will be shown here.</div>'}
        </div>
    `;
}

function runElectricityMitigationSequence() {
    if (!electricityMitigationState) return;

    const state = electricityMitigationState;
    const log = [];
    let remaining = Number(state.remainingNeed || 0);

    log.push(`Initial pending need after reallocation: ${remaining.toFixed(2)} kWh`);

    if (remaining <= 0) {
        renderElectricityMitigationSummary(['Electricity need already met after reallocation.']);
        return;
    }

    const adAvailable = state.components.advertising;
    const adConsent = window.confirm(`⚠️ Additional power required: ${remaining.toFixed(2)} kWh.\nCan we switch OFF advertising boards now to free up to ${adAvailable.toFixed(2)} kWh?`);

    if (adConsent && adAvailable > 0) {
        const adUsed = Math.min(remaining, adAvailable);
        state.used.advertising = adUsed;
        remaining -= adUsed;
        log.push(`Advertising boards turned OFF: ${adUsed.toFixed(2)} kWh utilized.`);
    } else {
        log.push('Advertising board cut not approved.');
    }

    if (remaining > 0) {
        const otherAvailable = state.components.decorative + state.components.garden + state.components.nonCritical;
        const otherConsent = window.confirm(`Still need ${remaining.toFixed(2)} kWh.\nAllow reduction of decorative lighting, garden pumps, and non-critical commercial loads? (max ${otherAvailable.toFixed(2)} kWh)`);
        if (otherConsent && otherAvailable > 0) {
            const otherUsed = Math.min(remaining, otherAvailable);
            state.used.otherNonEssential = otherUsed;
            remaining -= otherUsed;
            log.push(`Other non-essential loads reduced: ${otherUsed.toFixed(2)} kWh utilized.`);
        } else {
            log.push('Other non-essential reductions not approved.');
        }
    }

    if (remaining > 0) {
        const backupConsent = window.confirm(`Need still not satisfied (${remaining.toFixed(2)} kWh).\nActivate backup sources (solar + battery)?`);
        if (backupConsent) {
            const solarUsed = Math.min(remaining, state.components.solar);
            state.used.solar = solarUsed;
            remaining -= solarUsed;

            const batteryUsed = Math.min(remaining, state.components.battery);
            state.used.battery = batteryUsed;
            remaining -= batteryUsed;

            log.push(`Backup activated: Solar ${solarUsed.toFixed(2)} kWh, Battery ${batteryUsed.toFixed(2)} kWh.`);
        } else {
            log.push('Backup activation not approved.');
        }
    }

    state.remainingNeed = Math.max(0, remaining);

    if (state.remainingNeed <= 0.01) {
        log.push('✅ Electricity need is met.');
    } else {
        log.push(`⚠️ Remaining unmet need: ${state.remainingNeed.toFixed(2)} kWh`);
    }

    renderElectricityMitigationSummary(log);
}

function renderElectricityMitigationSummary(extraLogs = []) {
    if (!electricityMitigationState) return;

    const state = electricityMitigationState;
    const totalUtilized = state.used.reallocation + state.used.advertising + state.used.otherNonEssential + state.used.solar + state.used.battery;
    const met = state.remainingNeed <= 0.01;
    const logContainer = document.getElementById('electricitySequenceLog');
    if (!logContainer) return;

    const logsHtml = (extraLogs || []).map(item => `<div style="margin-bottom: 0.35rem;">• ${escapeHtml(String(item))}</div>`).join('');

    logContainer.innerHTML = `
        <div style="color: ${met ? '#00FF9D' : '#FF4C4C'}; font-size: 1.05rem; font-weight: 700; margin-bottom: 0.6rem;">
            ${met ? 'Electricity need is met' : 'Electricity need is not fully met yet'}
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.6rem; margin-bottom: 0.75rem;">
            <div>Reallocation: <strong style="color: #00BFFF;">${state.used.reallocation.toFixed(2)} kWh</strong></div>
            <div>Advertising Boards: <strong style="color: #FFD700;">${state.used.advertising.toFixed(2)} kWh</strong></div>
            <div>Other Non-Essential: <strong style="color: #FFB347;">${state.used.otherNonEssential.toFixed(2)} kWh</strong></div>
            <div>Solar Backup: <strong style="color: #00FF9D;">${state.used.solar.toFixed(2)} kWh</strong></div>
            <div>Battery Backup: <strong style="color: #7DD3FC;">${state.used.battery.toFixed(2)} kWh</strong></div>
            <div>Total Utilized: <strong style="color: #E2E8F0;">${totalUtilized.toFixed(2)} kWh</strong></div>
        </div>
        <div style="margin-bottom: 0.5rem;">Remaining Need: <strong style="color: ${met ? '#00FF9D' : '#FF4C4C'};">${state.remainingNeed.toFixed(2)} kWh</strong></div>
        <div style="border-top: 1px solid rgba(148,163,184,0.25); padding-top: 0.5rem;">${logsHtml || 'Run the sequence to see detailed action logs.'}</div>
    `;
}

// ============================================
// CLOCK & TIME
// ============================================

function initializeClock() {
    updateClock();
    setInterval(updateClock, 1000);
}

function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
    const dateString = now.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    document.getElementById('cityTime').innerHTML = `
        <div style="font-size: 1.5rem; font-weight: 700;">${timeString}</div>
        <div style="font-size: 0.9rem; color: var(--text-secondary);">${dateString}</div>
    `;
}

// ============================================
// TAB SYSTEM
// ============================================

function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    document.getElementById(`${tabName}-panel`).classList.add('active');
    
    currentTab = tabName;
    
    // Load module-specific data
    loadModuleData(tabName);
}

// ============================================
// MODE SWITCHER (Water/Electricity/Combined)
// ============================================

function initializeModeSwitcher() {
    const modeButtons = document.querySelectorAll('.twin-mode-btn');
    
    modeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const mode = this.dataset.mode;
            switchMode(mode);
        });
    });
}

function switchMode(mode) {
    // Update buttons
    document.querySelectorAll('.twin-mode-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
    
    currentMode = mode;
    updateDigitalTwin(mode);
}

// ============================================
// DASHBOARD DATA LOADING
// ============================================

async function loadDashboardData() {
    try {
        const response = await fetch(`${API_BASE}/dashboard`);
        if (!response.ok) {
            throw new Error(`API responded with ${response.status}`);
        }

        const data = await response.json();
        if (!data.success || !data.dashboard) {
            throw new Error('Invalid dashboard payload');
        }
        
        dashboardData = data.dashboard;
        updateKPICards(dashboardData);
        updateDigitalTwin(currentMode);
        updateAIRecommendations();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showErrorNotification('Failed to load dashboard data. Ensure backend is running on http://127.0.0.1:5000');
    }
}

// ============================================
// KPI CARDS UPDATE
// ============================================

function updateKPICards(data) {
    // AQI Card
    if (data.aqi) {
        document.getElementById('aqiValue').textContent = data.aqi.average_aqi.toFixed(1);
        document.getElementById('aqiCategory').textContent = data.aqi.overall_category || 'Moderate';
        document.getElementById('aqiTrend').innerHTML = `
            <i class="fas fa-${data.aqi.overall_trend === 'improving' ? 'arrow-down' : 'arrow-up'}"></i>
            <span>${data.aqi.overall_trend || 'stable'}</span>
        `;
        
        const aqiCard = document.getElementById('aqiCard');
        aqiCard.className = 'kpi-card';
        if (data.aqi.overall_status === 'critical') {
            aqiCard.classList.add('critical');
        }
    }
    
    // Water Card
    if (data.water) {
        document.getElementById('waterValue').textContent = `${data.water.average_tank_level.toFixed(1)}%`;
        document.getElementById('waterStatus').textContent = data.water.overall_status || 'Healthy';
        document.getElementById('waterTrend').innerHTML = `
            <i class="fas fa-${data.water.critical_zones.length === 0 ? 'check-circle' : 'exclamation-triangle'}"></i>
            <span>${data.water.critical_zones.length} Critical Zones</span>
        `;
        
        const waterCard = document.getElementById('waterCard');
        waterCard.className = 'kpi-card';
        if (data.water.critical_zones.length > 0) {
            waterCard.classList.add('critical');
        }
    }
    
    // Electricity Card
    if (data.electricity) {
        document.getElementById('electricityValue').textContent = `${data.electricity.usage_percent.toFixed(1)}%`;
        document.getElementById('electricityStatus').textContent = data.electricity.overall_status || 'Normal';
        document.getElementById('electricityTrend').innerHTML = `
            <i class="fas fa-solar-panel"></i>
            <span>${data.electricity.renewable_percent.toFixed(1)}% Renewable</span>
        `;
        
        const electricityCard = document.getElementById('electricityCard');
        electricityCard.className = 'kpi-card';
        if (data.electricity.overall_status === 'critical') {
            electricityCard.classList.add('critical');
        }
    }
    
    // Waste Card
    if (data.waste) {
        document.getElementById('wasteValue').textContent = `${data.waste.cleanliness_score.toFixed(1)}`;
        document.getElementById('wasteStatus').textContent = data.waste.overall_status || 'Good';
        document.getElementById('wasteTrend').innerHTML = `
            <i class="fas fa-leaf"></i>
            <span>${data.waste.full_bins} Bins Full</span>
        `;
        
        const wasteCard = document.getElementById('wasteCard');
        wasteCard.className = 'kpi-card';
        if (data.waste.full_bins > data.waste.total_bins * 0.5) {
            wasteCard.classList.add('critical');
        }
    }
}

// ============================================
// AI RECOMMENDATIONS
// ============================================

async function updateAIRecommendations() {
    const recommendationsContainer = document.getElementById('aiRecommendations');
    recommendationsContainer.innerHTML = '';
    
    if (!dashboardData) return;
    
    const recommendations = [];
    
    // Water recommendations
    if (dashboardData.water && dashboardData.water.critical_zones.length > 0) {
        recommendations.push({
            type: 'critical',
            icon: 'tint',
            title: 'Water Shortage Detected',
            description: `${dashboardData.water.critical_zones.join(', ')} require immediate attention. Activate water reallocation.`
        });
    }
    
    // Electricity recommendations
    if (dashboardData.electricity && dashboardData.electricity.critical_zones.length > 0) {
        recommendations.push({
            type: 'critical',
            icon: 'bolt',
            title: 'Power Overload Risk',
            description: `${dashboardData.electricity.critical_zones.join(', ')} experiencing high load. Initiate load balancing.`
        });
    }
    
    // Waste recommendations
    if (dashboardData.waste && dashboardData.waste.full_bins > 0) {
        recommendations.push({
            type: 'warning',
            icon: 'recycle',
            title: 'Waste Collection Required',
            description: `${dashboardData.waste.full_bins} bins need immediate collection. Optimize collection route.`
        });
    }
    
    // AQI recommendations
    if (dashboardData.aqi && dashboardData.aqi.overall_status === 'critical') {
        recommendations.push({
            type: 'critical',
            icon: 'wind',
            title: 'Air Quality Alert',
            description: `AQI levels unhealthy. Implement mitigation measures immediately.`
        });
    }
    
    // If no critical recommendations, show positive status
    if (recommendations.length === 0) {
        recommendations.push({
            type: 'success',
            icon: 'check-circle',
            title: 'All Systems Optimal',
            description: 'No critical issues detected. All city resources operating within normal parameters.'
        });
    }
    
    // Render recommendations
    recommendations.forEach(rec => {
        const card = document.createElement('div');
        card.className = `ai-card ${rec.type}`;
        card.innerHTML = `
            <div class="ai-card-header">
                <i class="fas fa-${rec.icon}"></i>
                <span>${rec.title}</span>
            </div>
            <p>${rec.description}</p>
        `;
        recommendationsContainer.appendChild(card);
    });
}

// ============================================
// MODULE DATA LOADING
// ============================================

async function loadModuleData(module) {
    try {
        switch(module) {
            case 'citizen-reports':
                await loadCitizenReports();
                break;
            case 'water':
                await loadWaterData();
                break;
            case 'electricity':
                await loadElectricityData();
                break;
            case 'waste':
                await loadWasteData();
                break;
            case 'aqi':
                await loadAQIData();
                break;
            case 'solutions':
                await loadSolutionsData();
                break;
        }
    } catch (error) {
        console.error(`Error loading ${module} data:`, error);
    }
}

async function loadWaterData() {
    // Load zone status
    const statusResponse = await fetch(`${API_BASE}/water/status`);
    const statusData = await statusResponse.json();
    
    if (statusData.success) {
        displayWaterStatus(statusData.data);
        
        // Load predictions for each zone
        displayWaterPredictions(statusData.data);
        
        // Load leak detection for each zone
        displayWaterLeaks(statusData.data);
    }
}

async function loadCitizenReports() {
    try {
        const response = await fetch(`${API_BASE}/citizen/reports`);
        const data = await response.json();
        
        if (data.success) {
            displayCitizenReports(data);
        }
    } catch (error) {
        console.error('Error loading citizen reports:', error);
        showErrorNotification('Failed to load citizen reports');
    }
}

async function displayCitizenReports(data) {
    // Update stats
    document.getElementById('totalReports').textContent = data.total || 0;
    document.getElementById('unresolvedReports').textContent = data.unresolved || 0;
    
    const highPriority = (data.reports || []).filter(r => r.priority === 'high').length;
    document.getElementById('highPriorityReports').textContent = highPriority || 0;
    
    // Display reports list
    const listContainer = document.getElementById('citizenReportsList');
    
    if (!data.reports || data.reports.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);"><i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i><p>No citizen reports yet</p></div>';
        return;
    }
    
    const html = data.reports.map(report => `
        <div class="citizen-report-card ${report.priority}" style="
            border: 1px solid rgba(${report.priority === 'high' ? '255, 76, 76' : '255, 193, 7'}, 0.3);
            border-left: 4px solid ${report.priority === 'high' ? '#FF4C4C' : '#FFC107'};
            background: rgba(${report.priority === 'high' ? '255, 76, 76' : '255, 193, 7'}, 0.05);
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 1rem;
            transition: all 0.3s ease;
        ">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <div>
                    <h3 style="margin: 0 0 0.5rem 0; color: var(--text-primary);">${escapeHtml(report.issue_type.replace(/_/g, ' ').toUpperCase())}</h3>
                    <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">ID: ${escapeHtml(report.report_id)}</p>
                </div>
                <span class="status-badge ${report.status}" style="
                    padding: 0.4rem 0.8rem;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    background: ${report.status === 'resolved' ? 'rgba(0, 255, 157, 0.2)' : 'rgba(255, 193, 7, 0.2)'};
                    color: ${report.status === 'resolved' ? '#00FF9D' : '#FFC107'};
                ">${report.status.toUpperCase()}</span>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; font-size: 0.9rem;">
                <div>
                    <div style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.3rem;">Location</div>
                    <div style="color: var(--text-primary);">📍 ${escapeHtml(report.location)}</div>
                </div>
                <div>
                    <div style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.3rem;">Reported By</div>
                    <div style="color: var(--text-primary);">${escapeHtml(report.contact_name)} (${escapeHtml(report.contact_phone)})</div>
                </div>
            </div>
            
            <div style="margin-bottom: 1rem;">
                <div style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.3rem;">Description</div>
                <div style="color: var(--text-primary); background: rgba(0,0,0,0.1); padding: 0.8rem; border-radius: 4px; font-size: 0.9rem;">${escapeHtml(report.description)}</div>
            </div>
            
            ${report.image ? `
            <div style="margin-bottom: 1rem;">
                <div style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.5rem;">📸 Attached Image</div>
                <div style="position: relative; max-width: 300px; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                    <img src="${report.image}" alt="Report image" style="width: 100%; height: auto; display: block; cursor: pointer;" onclick="viewImageModal('${report.image}')">
                    <button class="action-btn" onclick="downloadImage('${report.image}', '${escapeHtml(report.report_id)}')" style="
                        position: absolute;
                        bottom: 10px;
                        right: 10px;
                        padding: 0.5rem 0.75rem;
                        background: rgba(0,0,0,0.6);
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 0.8rem;
                        transition: background 0.3s;
                    " onmouseover="this.style.background='rgba(0,0,0,0.8)'" onmouseout="this.style.background='rgba(0,0,0,0.6)'">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
            </div>
            ` : ''}
            
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
                <span style="color: var(--text-tertiary);">📅 ${new Date(report.timestamp).toLocaleString()}</span>
                ${report.status !== 'resolved' ? `<button class="action-btn" onclick="resolveCitizenReport('${report.id}')" style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                    <i class="fas fa-check"></i> Resolve
                </button>` : `<span style="color: var(--accent-green);">✓ Resolved</span>`}
            </div>
        </div>
    `).join('');
    
    listContainer.innerHTML = html;
}

async function loadElectricityData() {
    // Load zone status
    const statusResponse = await fetch(`${API_BASE}/electricity/status`);
    const statusData = await statusResponse.json();
    
    if (statusData.success) {
        displayElectricityStatus(statusData.data);
        
        // Load predictions
        displayElectricityPredictions(statusData.data);
        
        // Display renewable generation
        displayElectricityRenewable(statusData.data);
    }
}

async function loadAQIData() {
    const response = await fetch(`${API_BASE}/aqi/status`);
    const data = await response.json();
    
    if (data.success) {
        displayAQIStatus(data.data);
        displayAQISources(data.data);
        displayAQIMitigation(data.data);
        displayAQITrend(data.data);
    }
}

async function loadWasteData() {
    const response = await fetch(`${API_BASE}/waste/status`);
    const data = await response.json();
    
    if (data.success) {
        displayWasteStatus(data.data);
        displayWasteConversion();
    }
}

// =====HELPER FUNCTION: ESCAPE HTML=====
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function resolveCitizenReport(reportId) {
    try {
        const response = await fetch(`${API_BASE}/citizen/report/${reportId}/resolve`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                notes: 'Marked as resolved by admin'
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showInfoNotification('Report marked as resolved');
            // Reload the reports
            await loadCitizenReports();
        } else {
            showErrorNotification('Failed to resolve report');
        }
    } catch (error) {
        console.error('Error resolving report:', error);
        showErrorNotification('Failed to resolve report');
    }
}

function viewImageModal(imageSrc) {
    // Create modal for full image view
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        cursor: pointer;
    `;
    
    const img = document.createElement('img');
    img.src = imageSrc;
    img.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        object-fit: contain;
        border-radius: 8px;
    `;
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        font-size: 2rem;
        cursor: pointer;
        padding: 10px 15px;
        border-radius: 4px;
        transition: background 0.3s;
    `;
    closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.4)';
    closeBtn.onmouseout = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    
    modal.appendChild(img);
    modal.appendChild(closeBtn);
    
    modal.onclick = (e) => {
        if (e.target === modal || e.target === closeBtn) {
            modal.remove();
        }
    };
    closeBtn.onclick = () => modal.remove();
    
    document.body.appendChild(modal);
}

function downloadImage(imageSrc, reportId) {
    // Create a temporary link to download the image
    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = `report-${reportId}-image.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ============================================
// HELPER FUNCTION: ESCAPE HTML
// ============================================

function displayWaterStatus(zones) {
    const container = document.getElementById('waterZoneStatus');
    container.innerHTML = zones.map(zone => `
        <div class="zone-status-item">
            <strong>${zone.zone}</strong>: 
            ${zone.tank_level_percent.toFixed(1)}% 
            <span class="status-badge ${zone.status}">${zone.status}</span>
        </div>
    `).join('');
}

async function displayWaterPredictions(zones) {
    const container = document.getElementById('waterPrediction');
    container.innerHTML = '<div style="color: var(--text-secondary);">Loading predictions...</div>';
    
    try {
        const predictions = await Promise.all(
            zones.map(async zone => {
                const response = await fetch(`${API_BASE}/water/predict/${zone.zone}?days=1`);
                const data = await response.json();
                if (data.success) {
                    return { zone: zone.zone, ...data.prediction };
                }
                return null;
            })
        );
        
        container.innerHTML = predictions.filter(p => p).map(pred => `
            <div class="zone-status-item">
                <strong>${pred.zone}</strong>: 
                ${(pred.predicted_demand / 1000).toFixed(1)}k L
                <span style="color: var(--accent-cyan); font-size: 0.85rem;">(${pred.confidence}% confidence)</span>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div style="color: var(--critical-red);">Failed to load predictions</div>';
    }
}

async function displayWaterLeaks(zones) {
    const container = document.getElementById('waterLeaks');
    container.innerHTML = '<div style="color: var(--text-secondary);">Analyzing for leaks...</div>';
    
    try {
        const leakResults = await Promise.all(
            zones.map(async zone => {
                try {
                    const response = await fetch(`${API_BASE}/water/leak-detection/${zone.zone}`);
                    const data = await response.json();
                    if (data.success && data.leak_detection) {
                        return { zone: zone.zone, ...data.leak_detection };
                    }
                    return null;
                } catch (err) {
                    console.error(`Error fetching leak data for ${zone.zone}:`, err);
                    return null;
                }
            })
        );
        
        const validResults = leakResults.filter(l => l);
        
        if (validResults.length === 0) {
            container.innerHTML = '<div style="color: var(--text-secondary);">No leak analysis available</div>';
            return;
        }
        
        container.innerHTML = validResults.map(leak => `
            <div class="zone-status-item">
                <strong>${leak.zone}</strong>: 
                <span class="${leak.leak_detected ? 'status-badge critical' : 'status-badge healthy'}">
                    ${leak.leak_detected ? '⚠️ Leak Detected' : '✓ No Leaks'}
                </span>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.3rem;">
                    Pressure: ${leak.current_pressure ? leak.current_pressure.toFixed(1) : 'N/A'} bar
                    ${leak.severity !== 'none' ? `| Severity: ${leak.severity}` : ''}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error analyzing leaks:', error);
        container.innerHTML = '<div style="color: var(--critical-red);">Failed to analyze leaks</div>';
    }
}

function displayElectricityStatus(zones) {
    const container = document.getElementById('electricityZoneStatus');
    container.innerHTML = zones.map(zone => `
        <div class="zone-status-item">
            <strong>${zone.zone}</strong>: 
            ${zone.usage_percent.toFixed(1)}% 
            <span class="status-badge ${zone.status}">${zone.status}</span>
        </div>
    `).join('');
}

async function displayElectricityPredictions(zones) {
    const container = document.getElementById('electricityPrediction');
    container.innerHTML = '<div style="color: var(--text-secondary);">Loading predictions...</div>';
    
    try {
        const predictions = await Promise.all(
            zones.map(async zone => {
                const response = await fetch(`${API_BASE}/electricity/predict/${zone.zone}?hours=1`);
                const data = await response.json();
                if (data.success) {
                    return { zone: zone.zone, ...data.prediction };
                }
                return null;
            })
        );
        
        container.innerHTML = predictions.filter(p => p).map(pred => `
            <div class="zone-status-item">
                <strong>${pred.zone}</strong>: 
                ${(pred.predicted_load / 1000).toFixed(1)}k kWh
                <span style="color: #FFD700; font-size: 0.85rem;">(${pred.confidence}% confidence)</span>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div style="color: var(--critical-red);">Failed to load predictions</div>';
    }
}

function displayElectricityRenewable(zones) {
    const container = document.getElementById('electricityRenewable');
    
    const totalRenewable = zones.reduce((sum, zone) => sum + (zone.renewable_kwh || 0), 0);
    const totalUsage = zones.reduce((sum, zone) => sum + zone.usage_kwh, 0);
    const renewablePercent = totalUsage > 0 ? (totalRenewable / totalUsage * 100) : 0;
    
    container.innerHTML = `
        <div style="text-align: center; padding: 1rem;">
            <div style="font-size: 2.5rem; font-weight: 700; color: var(--accent-green); margin-bottom: 0.5rem;">
                ${renewablePercent.toFixed(1)}%
            </div>
            <div style="color: var(--text-secondary); margin-bottom: 1rem;">
                Renewable Energy Mix
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; text-align: left;">
                <div>
                    <div style="color: var(--text-secondary); font-size: 0.85rem;">Solar</div>
                    <div style="color: #FFD700; font-weight: 600;">${(totalRenewable * 0.6 / 1000).toFixed(1)}k kWh</div>
                </div>
                <div>
                    <div style="color: var(--text-secondary); font-size: 0.85rem;">Wind</div>
                    <div style="color: var(--accent-cyan); font-weight: 600;">${(totalRenewable * 0.4 / 1000).toFixed(1)}k kWh</div>
                </div>
            </div>
        </div>
    `;
}

function displayWasteStatus(bins) {
    const container = document.getElementById('wasteBinGrid');
    container.innerHTML = bins.slice(0, 16).map(bin => `
        <div class="bin-item ${bin.status}">
            <div class="bin-icon">
                <i class="fas fa-trash-alt"></i>
            </div>
            <div class="bin-fill">${bin.fill_percent.toFixed(0)}%</div>
            <div class="bin-type">${bin.bin_type}</div>
        </div>
    `).join('');
}

async function displayWasteConversion() {
    const container = document.getElementById('wasteConversion');
    container.innerHTML = '<div style="color: var(--text-secondary);">Loading impact data...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/waste/conversion`);
        const data = await response.json();
        
        if (data.success) {
            const conv = data.conversion;
            container.innerHTML = `
                <div style="padding: 1rem;">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                        <div>
                            <div style="color: var(--text-secondary); font-size: 0.85rem;">Electricity Generated</div>
                            <div style="color: var(--accent-green); font-weight: 700; font-size: 1.3rem;">${conv.total_electricity_generated_kwh.toFixed(0)} kWh</div>
                        </div>
                        <div>
                            <div style="color: var(--text-secondary); font-size: 0.85rem;">CO₂ Reduced</div>
                            <div style="color: var(--accent-green); font-weight: 700; font-size: 1.3rem;">${conv.total_co2_reduced_kg.toFixed(0)} kg</div>
                        </div>
                        <div>
                            <div style="color: var(--text-secondary); font-size: 0.85rem;">Landfill Reduction</div>
                            <div style="color: var(--accent-cyan); font-weight: 700; font-size: 1.3rem;">${conv.landfill_reduction_kg.toFixed(0)} kg</div>
                        </div>
                        <div>
                            <div style="color: var(--text-secondary); font-size: 0.85rem;">Cleanliness Score</div>
                            <div style="color: #FFD700; font-weight: 700; font-size: 1.3rem;">${conv.cleanliness_score.toFixed(1)}/100</div>
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        container.innerHTML = '<div style="color: var(--critical-red);">Failed to load conversion data</div>';
    }
}

function displayAQIStatus(data) {
    const container = document.getElementById('aqiZoneStatus');
    
    // Handle new real-time data format with zones array
    const zones = data.zones || data;
    
    if (!zones || zones.length === 0) {
        container.innerHTML = '<div class="data-empty">No zone data available</div>';
        return;
    }
    
    // Get AQI category color
    function getAQIColor(aqi) {
        if (aqi <= 50) return '#10b981';    // Green - Good
        if (aqi <= 100) return '#f59e0b';   // Yellow - Satisfactory
        if (aqi <= 200) return '#ef4444';   // Orange - Moderately Polluted
        if (aqi <= 300) return '#dc2626';   // Red - Poor
        if (aqi <= 400) return '#991b1b';   // Dark Red - Very Poor
        return '#4b0081';                    // Purple - Hazardous
    }
    
    function getAQICategory(aqi) {
        if (aqi <= 50) return 'Good';
        if (aqi <= 100) return 'Satisfactory';
        if (aqi <= 200) return 'Moderately Polluted';
        if (aqi <= 300) return 'Poor';
        if (aqi <= 400) return 'Very Poor';
        return 'Hazardous';
    }
    
    container.innerHTML = `
        <div style="display: grid; gap: 0.8rem;">
            ${zones.map(zone => `
                <div style="
                    padding: 0.8rem;
                    border-radius: 6px;
                    background: rgba(255, 255, 255, 0.05);
                    border-left: 4px solid ${getAQIColor(zone.aqi)};
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem;">
                        <strong style="color: var(--text-primary);">${zone.location}</strong>
                        <span style="
                            background: ${getAQIColor(zone.aqi)};
                            color: white;
                            padding: 0.2rem 0.6rem;
                            border-radius: 4px;
                            font-size: 0.8rem;
                            font-weight: 600;
                        ">${getAQICategory(zone.aqi)}</span>
                    </div>
                    <div style="font-size: 1.3rem; font-weight: 700; color: ${getAQIColor(zone.aqi)}; margin: 0.3rem 0;">
                        AQI ${zone.aqi.toFixed(1)}
                    </div>
                    <div style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.4rem;">
                        PM2.5: ${(zone.pm25 || 0).toFixed(1)} μg/m³ | PM10: ${(zone.pm10 || 0).toFixed(1)} μg/m³
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function displayAQISources(data) {
    const container = document.getElementById('aqiSources');
    
    const zones = data.zones || data;
    
    if (!zones || zones.length === 0) {
        container.innerHTML = '<div class="data-empty">No pollution data available</div>';
        return;
    }
    
    // Calculate average pollution sources from all zones
    const avgPollution = {
        pm25: zones.reduce((sum, z) => sum + (z.pm25 || 0), 0) / zones.length,
        pm10: zones.reduce((sum, z) => sum + (z.pm10 || 0), 0) / zones.length,
        o3: zones.reduce((sum, z) => sum + (z.o3 || 0), 0) / zones.length,
        no2: zones.reduce((sum, z) => sum + (z.no2 || 0), 0) / zones.length,
        so2: zones.reduce((sum, z) => sum + (z.so2 || 0), 0) / zones.length,
        co: zones.reduce((sum, z) => sum + (z.co || 0), 0) / zones.length
    };
    
    // Get worst zone
    const worstZone = zones.reduce((prev, curr) => (curr.aqi > prev.aqi) ? curr : prev);
    
    container.innerHTML = `
        <div style="padding: 1rem;">
            <div style="margin-bottom: 0.5rem; padding-bottom: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <strong style="color: var(--text-primary); display: block; margin-bottom: 0.3rem;">⚡ Worst Affected Zone</strong>
                <div style="color: var(--accent-red); font-weight: 600;">${worstZone.location}</div>
                <div style="color: var(--text-secondary); font-size: 0.85rem;">AQI: ${worstZone.aqi.toFixed(1)}</div>
            </div>
            
            <div style="margin-bottom: 0.8rem;">
                <div style="color: var(--text-secondary); font-size: 0.85rem;">PM2.5 (Fine Particles)</div>
                <div style="color: #ff6b6b; font-weight: 600; font-size: 1rem;">${avgPollution.pm25.toFixed(1)} μg/m³</div>
                <div style="height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 0.3rem; overflow: hidden;">
                    <div style="height: 100%; width: ${Math.min(avgPollution.pm25 / 2, 100)}%; background: linear-gradient(90deg, #ff6b6b, #ff1744);"></div>
                </div>
            </div>
            
            <div style="margin-bottom: 0.8rem;">
                <div style="color: var(--text-secondary); font-size: 0.85rem;">PM10 (Coarse Particles)</div>
                <div style="color: #ffa500; font-weight: 600; font-size: 1rem;">${avgPollution.pm10.toFixed(1)} μg/m³</div>
                <div style="height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 0.3rem; overflow: hidden;">
                    <div style="height: 100%; width: ${Math.min(avgPollution.pm10 / 2, 100)}%; background: linear-gradient(90deg, #ffa500, #ff6b00);"></div>
                </div>
            </div>
            
            <div style="margin-bottom: 0.8rem;">
                <div style="color: var(--text-secondary); font-size: 0.85rem;">NO₂ (Nitrogen Dioxide)</div>
                <div style="color: #1e90ff; font-weight: 600; font-size: 1rem;">${avgPollution.no2.toFixed(1)} μg/m³</div>
            </div>
            
            <div style="margin-bottom: 0.8rem;">
                <div style="color: var(--text-secondary); font-size: 0.85rem;">SO₂ (Sulfur Dioxide)</div>
                <div style="color: #9370db; font-weight: 600; font-size: 1rem;">${avgPollution.so2.toFixed(1)} μg/m³</div>
            </div>
            
            <div>
                <div style="color: var(--text-secondary); font-size: 0.85rem;">CO (Carbon Monoxide)</div>
                <div style="color: #ff69b4; font-weight: 600; font-size: 1rem;">${avgPollution.co.toFixed(1)} mg/m³</div>
            </div>
        </div>
    `;
}

function displayAQIMitigation(data) {
    const container = document.getElementById('aqiMitigation');
    
    const zones = data.zones || data;
    
    if (!zones || zones.length === 0) {
        container.innerHTML = '<div class="data-empty">No mitigation data available</div>';
        return;
    }
    
    // Categorize zones by severity
    const criticalZones = zones.filter(z => z.aqi > 300);
    const poorZones = zones.filter(z => z.aqi > 200 && z.aqi <= 300);
    const moderateZones = zones.filter(z => z.aqi > 100 && z.aqi <= 200);
    const goodZones = zones.filter(z => z.aqi <= 100);
    
    // Get health message from data if available
    const healthMessage = data.health_message || 'Monitoring air quality levels';
    
    container.innerHTML = `
        <div style="padding: 1rem;">
            <div style="margin-bottom: 1rem; padding: 0.8rem; border-radius: 6px; background: rgba(255, 107, 107, 0.1); border-left: 3px solid #ff6b6b;">
                <div style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.3rem;">💬 Health Advisory</div>
                <div style="color: var(--text-primary); font-weight: 500;">${healthMessage}</div>
            </div>
            
            ${criticalZones.length > 0 ? `
                <div style="margin-bottom: 0.8rem; padding: 0.8rem; border-radius: 6px; background: rgba(220, 38, 38, 0.1); border-left: 3px solid #dc2626;">
                    <strong style="color: #dc2626;">🚨 CRITICAL (${criticalZones.length} zones)</strong>
                    <ul style="margin: 0.5rem 0 0 1.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                        <li>Take shelter indoors with air purification</li>
                        <li>Use N95/N99 masks if outside</li>
                        <li>Avoid outdoor activities</li>
                        <li>Consult medical professionals</li>
                    </ul>
                    <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">
                        Affected: ${criticalZones.map(z => z.location).join(', ')}
                    </div>
                </div>
            ` : ''}
            
            ${poorZones.length > 0 ? `
                <div style="margin-bottom: 0.8rem; padding: 0.8rem; border-radius: 6px; background: rgba(239, 68, 68, 0.1); border-left: 3px solid #ef4444;">
                    <strong style="color: #ef4444;">⚠️ POOR (${poorZones.length} zones)</strong>
                    <ul style="margin: 0.5rem 0 0 1.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                        <li>Restrict outdoor activities, especially children</li>
                        <li>Increase green spaces and tree plantation</li>
                        <li>Monitor traffic during peak hours</li>
                    </ul>
                </div>
            ` : ''}
            
            ${moderateZones.length > 0 ? `
                <div style="margin-bottom: 0.8rem; padding: 0.8rem; border-radius: 6px; background: rgba(245, 158, 11, 0.1); border-left: 3px solid #f59e0b;">
                    <strong style="color: #f59e0b;">📊 MODERATE (${moderateZones.length} zones)</strong>
                    <ul style="margin: 0.5rem 0 0 1.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                        <li>Deploy mobile air purification units</li>
                        <li>Increase vegetation coverage</li>
                        <li>Monitor industrial emissions</li>
                    </ul>
                </div>
            ` : ''}
            
            ${goodZones.length > 0 && criticalZones.length === 0 && poorZones.length === 0 ? `
                <div style="padding: 0.8rem; border-radius: 6px; background: rgba(16, 185, 129, 0.1); border-left: 3px solid #10b981; text-align: center;">
                    <div style="font-size: 2rem; margin-bottom: 0.3rem;">✅</div>
                    <strong style="color: #10b981;">Air Quality Good</strong>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.5rem;">
                        Conditions are favorable for outdoor activities
                    </p>
                </div>
            ` : ''}
        </div>
    `;
}

function displayAQITrend(data) {
    // Display trend - show zones sorted by AQI
}

// ============================================
// QUICK ACTIONS
// ============================================

async function optimizeWater() {
    showNotification('Optimizing water allocation...', 'info');
    
    try {
        const response = await fetch(`${API_BASE}/water/optimize`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            showNotification(`Water optimization complete! ${data.optimization.water_saved_liters.toFixed(0)} liters saved.`, 'success');
            loadDashboardData();
        }
    } catch (error) {
        showErrorNotification('Water optimization failed');
    }
}

async function optimizeElectricity() {
    showNotification('Balancing electrical load...', 'info');
    
    try {
        const response = await fetch(`${API_BASE}/electricity/optimize`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            showNotification(`Load balancing complete! ${data.optimization.total_saved_kwh.toFixed(0)} kWh optimized.`, 'success');
            loadDashboardData();
        }
    } catch (error) {
        showErrorNotification('Load balancing failed');
    }
}

async function viewWasteConversion() {
    try {
        const response = await fetch(`${API_BASE}/waste/conversion`);
        const data = await response.json();
        
        if (data.success) {
            const conv = data.conversion;
            alert(`Waste-to-Energy Impact:\n\nElectricity Generated: ${conv.total_electricity_generated_kwh} kWh\nCO₂ Reduced: ${conv.total_co2_reduced_kg} kg\nLandfill Reduction: ${conv.landfill_reduction_kg} kg\nCleanliness Score: ${conv.cleanliness_score}`);
        }
    } catch (error) {
        showErrorNotification('Failed to load waste conversion data');
    }
}

// ============================================
// SOLUTIONS COMPARISON
// ============================================

async function loadSolutionsData() {
    initializeSolutionComparator();
}

function initializeSolutionComparator() {
    const categoryButtons = document.querySelectorAll('.solution-category-btn');
    
    categoryButtons.forEach(button => {
        button.addEventListener('click', function() {
            const category = this.dataset.category;
            loadSolutionComparison(category);
            
            // Update active button
            categoryButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Load water solutions by default
    loadSolutionComparison('water');
}

async function loadSolutionComparison(category) {
    try {
        const response = await fetch(`${API_BASE}/solutions/compare/${category}`);
        const data = await response.json();
        
        if (data.success) {
            displaySolutionComparison(data.comparison);
        }
    } catch (error) {
        console.error('Error loading solution comparison:', error);
    }
}

function displaySolutionComparison(comparison) {
    const container = document.getElementById('solutionComparison');
    
    container.innerHTML = `
        <h3 style="color: var(--accent-cyan); margin-bottom: 1rem;">
            ${comparison.category} Solutions Comparison
        </h3>
        <p style="color: var(--accent-green); margin-bottom: 2rem;">
            ✓ Recommended: ${comparison.best_solution.name}
        </p>
        ${comparison.solutions.map(sol => `
            <div class="solution-item" style="background: rgba(0, 229, 255, 0.05); border: 1px solid rgba(0, 229, 255, 0.3); border-radius: 10px; padding: 1.5rem; margin-bottom: 1rem; ${sol.recommended ? 'border-color: var(--accent-green); box-shadow: 0 0 20px rgba(0, 255, 157, 0.3);' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h4 style="color: var(--text-primary); font-size: 1.2rem;">
                        ${sol.rank}. ${sol.name}
                        ${sol.recommended ? '<span style="color: var(--accent-green); margin-left: 1rem;">⭐ RECOMMENDED</span>' : ''}
                    </h4>
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-cyan);">
                        ${sol.total_score.toFixed(1)}/100
                    </div>
                </div>
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">${sol.description}</p>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.85rem;">Production Cost</div>
                        <div style="color: var(--text-primary); font-weight: 600;">${sol.metrics.production_cost_score}/100</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.85rem;">Maintenance Cost</div>
                        <div style="color: var(--text-primary); font-weight: 600;">${sol.metrics.maintenance_cost_score}/100</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.85rem;">Implementation Time</div>
                        <div style="color: var(--text-primary); font-weight: 600;">${sol.metrics.implementation_time_months} months</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.85rem;">Environmental Impact</div>
                        <div style="color: var(--text-primary); font-weight: 600;">${sol.metrics.environmental_impact_score}/100</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.85rem;">Risk Reduction</div>
                        <div style="color: var(--text-primary); font-weight: 600;">${sol.metrics.risk_reduction_percent}%</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.85rem;">Scalability</div>
                        <div style="color: var(--text-primary); font-weight: 600;">${sol.metrics.scalability_score}/100</div>
                    </div>
                </div>
            </div>
        `).join('')}
    `;
}

// ============================================
// NOTIFICATIONS
// ============================================

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: ${type === 'success' ? 'var(--accent-green)' : type === 'warning' ? 'var(--warning-yellow)' : type === 'error' ? 'var(--critical-red)' : 'var(--accent-cyan)'};
        color: var(--bg-primary);
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        font-weight: 600;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function showErrorNotification(message) {
    showNotification(message, 'error');
}

function showInfoNotification(message) {
    showNotification(message, 'info');
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
    
    .zone-status-item {
        padding: 0.8rem;
        background: rgba(0, 229, 255, 0.05);
        border-radius: 6px;
        margin-bottom: 0.5rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .status-badge {
        padding: 0.2rem 0.6rem;
        border-radius: 4px;
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
    }
    
    .status-badge.healthy,
    .status-badge.normal {
        background: rgba(0, 255, 157, 0.2);
        color: var(--accent-green);
    }
    
    .status-badge.moderate,
    .status-badge.high_load {
        background: rgba(255, 193, 7, 0.2);
        color: var(--warning-yellow);
    }
    
    .status-badge.critical,
    .status-badge.overload {
        background: rgba(255, 76, 76, 0.2);
        color: var(--critical-red);
    }
`;
document.head.appendChild(style);
