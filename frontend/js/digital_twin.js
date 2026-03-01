/**
 * SMART CITY ICCC - Digital Twin JavaScript
 * Interactive city map and zone visualization
 */

// ============================================
// DIGITAL TWIN MANAGEMENT
// ============================================

async function updateDigitalTwin(mode) {
    try {
        let statusData = [];
        
        switch(mode) {
            case 'water':
                const waterResponse = await fetch(`${API_BASE}/water/status`);
                const waterData = await waterResponse.json();
                if (waterData.success) {
                    statusData = waterData.data;
                    updateWaterTwinView(statusData);
                }
                break;
            
            case 'electricity':
                const elecResponse = await fetch(`${API_BASE}/electricity/status`);
                const elecData = await elecResponse.json();
                if (elecData.success) {
                    statusData = elecData.data;
                    updateElectricityTwinView(statusData);
                }
                break;
            
            case 'combined':
                await updateCombinedTwinView();
                break;
        }
    } catch (error) {
        console.error('Error updating digital twin:', error);
    }
}

// ============================================
// WATER TWIN VIEW
// ============================================

function updateWaterTwinView(zones) {
    const zoneElements = {
        'Zone A': document.getElementById('zone-a'),
        'Zone B': document.getElementById('zone-b'),
        'Zone C': document.getElementById('zone-c'),
        'Zone D': document.getElementById('zone-d')
    };
    
    zones.forEach(zone => {
        const element = zoneElements[zone.zone];
        if (!element) return;
        
        // Reset classes
        element.className = 'city-zone water-mode';
        
        // Add status class
        if (zone.tank_level_percent >= 70) {
            element.classList.add('status-healthy', 'high-level');
        } else if (zone.tank_level_percent >= 50) {
            element.classList.add('status-moderate');
        } else {
            element.classList.add('status-critical', 'low-level');
        }
        
        // Update stats
        const statsElement = element.querySelector('.zone-stat-item');
        statsElement.innerHTML = `
            <div style="font-size: 1.2rem; font-weight: 700; color: var(--accent-cyan);">
                ${zone.tank_level_percent.toFixed(1)}%
            </div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.3rem;">
                Tank Level
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.5rem;">
                Usage: ${(zone.daily_usage / 1000).toFixed(1)}k L/day
            </div>
        `;
        
        // Add click handler
        element.onclick = () => showZoneDetails(zone, 'water');
    });
    
    // Check if optimization is needed and show transfers
    checkWaterOptimization(zones);
}

async function checkWaterOptimization(zones) {
    const deficitZones = zones.filter(z => z.tank_level_percent < 60);
    const surplusZones = zones.filter(z => z.tank_level_percent > 80);
    
    if (deficitZones.length > 0 && surplusZones.length > 0) {
        // Show transfer animations
        drawTransferArrows(surplusZones[0].zone, deficitZones[0].zone);
    }
}

// ============================================
// ELECTRICITY TWIN VIEW
// ============================================

function updateElectricityTwinView(zones) {
    const zoneElements = {
        'Zone A': document.getElementById('zone-a'),
        'Zone B': document.getElementById('zone-b'),
        'Zone C': document.getElementById('zone-c'),
        'Zone D': document.getElementById('zone-d')
    };
    
    zones.forEach(zone => {
        const element = zoneElements[zone.zone];
        if (!element) return;
        
        // Reset classes
        element.className = 'city-zone electricity-mode';
        
        // Add status class
        if (zone.usage_percent >= 85) {
            element.classList.add('status-critical', 'high-load');
        } else if (zone.usage_percent >= 70) {
            element.classList.add('status-moderate');
        } else {
            element.classList.add('status-healthy', 'low-load');
        }
        
        // Update stats
        const statsElement = element.querySelector('.zone-stat-item');
        statsElement.innerHTML = `
            <div style="font-size: 1.2rem; font-weight: 700; color: #FFD700;">
                ${zone.usage_percent.toFixed(1)}%
            </div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.3rem;">
                Power Load
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.5rem;">
                ${(zone.usage_kwh / 1000).toFixed(1)}k kWh
            </div>
        `;
        
        // Add click handler
        element.onclick = () => showZoneDetails(zone, 'electricity');
    });
}

// ============================================
// COMBINED TWIN VIEW
// ============================================

async function updateCombinedTwinView() {
    try {
        const waterResponse = await fetch(`${API_BASE}/water/status`);
        const elecResponse = await fetch(`${API_BASE}/electricity/status`);
        
        const waterData = await waterResponse.json();
        const elecData = await elecResponse.json();
        
        if (waterData.success && elecData.success) {
            const zoneElements = {
                'Zone A': document.getElementById('zone-a'),
                'Zone B': document.getElementById('zone-b'),
                'Zone C': document.getElementById('zone-c'),
                'Zone D': document.getElementById('zone-d')
            };
            
            waterData.data.forEach((waterZone, index) => {
                const elecZone = elecData.data[index];
                const element = zoneElements[waterZone.zone];
                if (!element) return;
                
                // Determine overall status
                const waterCritical = waterZone.tank_level_percent < 50;
                const elecCritical = elecZone.usage_percent >= 85;
                
                element.className = 'city-zone';
                
                if (waterCritical || elecCritical) {
                    element.classList.add('status-critical');
                } else if (waterZone.tank_level_percent < 70 || elecZone.usage_percent >= 70) {
                    element.classList.add('status-moderate');
                } else {
                    element.classList.add('status-healthy');
                }
                
                // Update stats
                const statsElement = element.querySelector('.zone-stat-item');
                statsElement.innerHTML = `
                    <div style="display: flex; justify-content: space-around; width: 100%;">
                        <div style="text-align: center;">
                            <div style="font-size: 1rem; font-weight: 700; color: var(--accent-cyan);">
                                ${waterZone.tank_level_percent.toFixed(0)}%
                            </div>
                            <div style="font-size: 0.7rem; color: var(--text-secondary);">
                                <i class="fas fa-tint"></i> Water
                            </div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 1rem; font-weight: 700; color: #FFD700;">
                                ${elecZone.usage_percent.toFixed(0)}%
                            </div>
                            <div style="font-size: 0.7rem; color: var(--text-secondary);">
                                <i class="fas fa-bolt"></i> Power
                            </div>
                        </div>
                    </div>
                `;
                
                element.onclick = () => showCombinedZoneDetails(waterZone, elecZone);
            });
        }
    } catch (error) {
        console.error('Error updating combined view:', error);
    }
}

// ============================================
// TRANSFER ARROWS (SVG Animation)
// ============================================

function drawTransferArrows(fromZone, toZone) {
    const svg = document.getElementById('transferOverlay');
    svg.innerHTML = ''; // Clear existing arrows
    
    const fromElement = document.querySelector(`[data-zone="${fromZone}"]`);
    const toElement = document.querySelector(`[data-zone="${toZone}"]`);
    
    if (!fromElement || !toElement) return;
    
    const fromRect = fromElement.getBoundingClientRect();
    const toRect = toElement.getBoundingClientRect();
    const containerRect = svg.getBoundingClientRect();
    
    const fromX = fromRect.left + fromRect.width / 2 - containerRect.left;
    const fromY = fromRect.top + fromRect.height / 2 - containerRect.top;
    const toX = toRect.left + toRect.width / 2 - containerRect.left;
    const toY = toRect.top + toRect.height / 2 - containerRect.top;
    
    // Create animated arrow
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    arrow.setAttribute('x1', fromX);
    arrow.setAttribute('y1', fromY);
    arrow.setAttribute('x2', toX);
    arrow.setAttribute('y2', toY);
    arrow.setAttribute('class', 'transfer-arrow');
    arrow.setAttribute('marker-end', 'url(#arrowhead)');
    
    // Create arrowhead marker
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0, 10 3, 0 6');
    polygon.setAttribute('class', 'transfer-arrow-marker');
    
    marker.appendChild(polygon);
    defs.appendChild(marker);
    svg.appendChild(defs);
    svg.appendChild(arrow);
}

// ============================================
// ZONE DETAILS MODAL
// ============================================

function showZoneDetails(zone, type) {
    const modal = document.getElementById('zoneModal');
    const title = document.getElementById('zoneModalTitle');
    const content = document.getElementById('zoneModalContent');
    
    title.textContent = `${zone.zone} - ${type === 'water' ? 'Water' : 'Electricity'} Details`;
    
    if (type === 'water') {
        content.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                <div class="detail-card">
                    <h4>Tank Level</h4>
                    <div class="detail-value">${zone.tank_level_percent.toFixed(1)}%</div>
                    <div class="detail-bar">
                        <div class="detail-bar-fill" style="width: ${zone.tank_level_percent}%; background: var(--accent-cyan);"></div>
                    </div>
                </div>
                <div class="detail-card">
                    <h4>Daily Usage</h4>
                    <div class="detail-value">${(zone.daily_usage / 1000).toFixed(1)}k L</div>
                    <div class="detail-label">per day</div>
                </div>
                <div class="detail-card">
                    <h4>Capacity</h4>
                    <div class="detail-value">${(zone.capacity / 1000).toFixed(1)}k L</div>
                    <div class="detail-label">total capacity</div>
                </div>
                <div class="detail-card">
                    <h4>Pipeline Pressure</h4>
                    <div class="detail-value">${zone.pressure} bar</div>
                    <div class="detail-label">current pressure</div>
                </div>
                <div class="detail-card">
                    <h4>Risk Level</h4>
                    <div class="detail-value" style="color: ${zone.risk_level === 'high' ? 'var(--critical-red)' : zone.risk_level === 'medium' ? 'var(--warning-yellow)' : 'var(--accent-green)'}">
                        ${zone.risk_level.toUpperCase()}
                    </div>
                </div>
                <div class="detail-card">
                    <h4>Status</h4>
                    <div class="detail-value">${zone.status}</div>
                </div>
            </div>
            <div style="margin-top: 1.5rem;">
                <button class="action-btn" onclick="predictZoneWater('${zone.zone}')">
                    <i class="fas fa-chart-line"></i> Predict Demand
                </button>
                <button class="action-btn" onclick="checkZoneLeaks('${zone.zone}')">
                    <i class="fas fa-exclamation-triangle"></i> Check for Leaks
                </button>
            </div>
        `;
    } else if (type === 'electricity') {
        content.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                <div class="detail-card">
                    <h4>Current Usage</h4>
                    <div class="detail-value">${zone.usage_percent.toFixed(1)}%</div>
                    <div class="detail-bar">
                        <div class="detail-bar-fill" style="width: ${zone.usage_percent}%; background: #FFD700;"></div>
                    </div>
                </div>
                <div class="detail-card">
                    <h4>Power Consumption</h4>
                    <div class="detail-value">${(zone.usage_kwh / 1000).toFixed(1)}k kWh</div>
                    <div class="detail-label">current load</div>
                </div>
                <div class="detail-card">
                    <h4>Capacity</h4>
                    <div class="detail-value">${(zone.capacity_kwh / 1000).toFixed(1)}k kWh</div>
                    <div class="detail-label">total capacity</div>
                </div>
                <div class="detail-card">
                    <h4>Solar Generation</h4>
                    <div class="detail-value">${zone.solar_generation.toFixed(0)} kWh</div>
                    <div class="detail-label">renewable energy</div>
                </div>
                <div class="detail-card">
                    <h4>Essential Load</h4>
                    <div class="detail-value">${zone.essential_load_percent}%</div>
                    <div class="detail-label">critical services</div>
                </div>
                <div class="detail-card">
                    <h4>Risk Level</h4>
                    <div class="detail-value" style="color: ${zone.risk_level === 'critical' || zone.risk_level === 'high' ? 'var(--critical-red)' : zone.risk_level === 'medium' ? 'var(--warning-yellow)' : 'var(--accent-green)'}">
                        ${zone.risk_level.toUpperCase()}
                    </div>
                </div>
            </div>
            <div style="margin-top: 1.5rem;">
                <button class="action-btn" onclick="predictZoneLoad('${zone.zone}')">
                    <i class="fas fa-chart-line"></i> Predict Load
                </button>
            </div>
        `;
    }
    
    modal.classList.add('active');
}

function showCombinedZoneDetails(waterZone, elecZone) {
    const modal = document.getElementById('zoneModal');
    const title = document.getElementById('zoneModalTitle');
    const content = document.getElementById('zoneModalContent');
    
    title.textContent = `${waterZone.zone} - Combined Overview`;
    
    content.innerHTML = `
        <h3 style="color: var(--accent-cyan); margin-bottom: 1rem;">
            <i class="fas fa-tint"></i> Water Management
        </h3>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 2rem;">
            <div class="detail-card">
                <h4>Tank Level</h4>
                <div class="detail-value">${waterZone.tank_level_percent.toFixed(1)}%</div>
            </div>
            <div class="detail-card">
                <h4>Daily Usage</h4>
                <div class="detail-value">${(waterZone.daily_usage / 1000).toFixed(1)}k L</div>
            </div>
        </div>
        
        <h3 style="color: #FFD700; margin-bottom: 1rem;">
            <i class="fas fa-bolt"></i> Electricity Management
        </h3>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
            <div class="detail-card">
                <h4>Power Load</h4>
                <div class="detail-value">${elecZone.usage_percent.toFixed(1)}%</div>
            </div>
            <div class="detail-card">
                <h4>Consumption</h4>
                <div class="detail-value">${(elecZone.usage_kwh / 1000).toFixed(1)}k kWh</div>
            </div>
        </div>
    `;
    
    modal.classList.add('active');
}

function closeZoneModal() {
    document.getElementById('zoneModal').classList.remove('active');
}

// Zone-specific actions
async function predictZoneWater(zone) {
    try {
        const response = await fetch(`${API_BASE}/water/predict/${zone}`);
        const data = await response.json();
        
        if (data.success) {
            alert(`Water Demand Prediction for ${zone}:\n\nPredicted Demand: ${data.prediction.predicted_demand.toFixed(0)} liters\nConfidence: ${data.prediction.confidence}%\nTrend: ${data.prediction.trend}`);
        }
    } catch (error) {
        console.error('Error predicting water demand:', error);
    }
}

async function checkZoneLeaks(zone) {
    try {
        const response = await fetch(`${API_BASE}/water/leak-detection/${zone}`);
        const data = await response.json();
        
        if (data.success) {
            const leak = data.leak_detection;
            alert(`Leak Detection for ${zone}:\n\nLeak Detected: ${leak.leak_detected ? 'YES' : 'NO'}\nSeverity: ${leak.severity}\n\n${leak.anomalies ? leak.anomalies.join('\n') : 'No anomalies detected'}`);
        }
    } catch (error) {
        console.error('Error checking leaks:', error);
    }
}

async function predictZoneLoad(zone) {
    try {
        const response = await fetch(`${API_BASE}/electricity/predict/${zone}`);
        const data = await response.json();
        
        if (data.success) {
            alert(`Load Prediction for ${zone}:\n\nPredicted Load: ${data.prediction.predicted_load.toFixed(0)} kWh\nPeak Hour: ${data.prediction.peak_hour}:00\nConfidence: ${data.prediction.confidence}%`);
        }
    } catch (error) {
        console.error('Error predicting load:', error);
    }
}

// Add required CSS for modal details
const detailStyles = document.createElement('style');
detailStyles.textContent = `
    .detail-card {
        background: rgba(0, 229, 255, 0.05);
        border: 1px solid rgba(0, 229, 255, 0.2);
        border-radius: 8px;
        padding: 1rem;
    }
    
    .detail-card h4 {
        color: var(--text-secondary);
        font-size: 0.9rem;
        margin-bottom: 0.5rem;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    
    .detail-value {
        font-size: 1.8rem;
        font-weight: 700;
        color: var(--accent-cyan);
        margin-bottom: 0.3rem;
    }
    
    .detail-label {
        font-size: 0.8rem;
        color: var(--text-secondary);
    }
    
    .detail-bar {
        width: 100%;
        height: 8px;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 4px;
        overflow: hidden;
        margin-top: 0.5rem;
    }
    
    .detail-bar-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.3s ease;
    }
`;
document.head.appendChild(detailStyles);
