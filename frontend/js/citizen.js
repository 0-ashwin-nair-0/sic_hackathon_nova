/**
 * SMART CITY - Citizen Portal JavaScript
 * Frontend logic for citizen interface
 */

const API_BASE = 'http://127.0.0.1:5000/api';

function validatePortalAccess(requiredRole) {
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

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    if (!validatePortalAccess('citizen')) {
        return;
    }

    loadStatistics();
    loadDustbins();
    loadZoneScores();
    setupFormHandler();
});

// ============================================
// NAVIGATION
// ============================================

function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
        
        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === '#' + sectionId) {
                link.classList.add('active');
            }
        });
    }
}

// Scroll spy for nav links
window.addEventListener('scroll', function() {
    const sections = ['home', 'report', 'dustbins', 'score'];
    const scrollPosition = window.scrollY + 100;
    
    sections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            
            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === '#' + sectionId) {
                        link.classList.add('active');
                    }
                });
            }
        }
    });
});

// ============================================
// STATISTICS
// ============================================

async function loadStatistics() {
    try {
        // Load waste data for statistics
        const wasteResponse = await fetch(`${API_BASE}/waste/status`);
        const wasteData = await wasteResponse.json();
        
        if (wasteData.success) {
            // Calculate total waste collected (approximation)
            const totalBins = wasteData.data.length;
            const avgFillLevel = wasteData.data.reduce((sum, bin) => sum + bin.fill_level_percent, 0) / totalBins;
            const totalWaste = (totalBins * avgFillLevel * 0.5 / 100).toFixed(1); // Approximation
            
            document.getElementById('totalWasteCollected').textContent = totalWaste;
        }
        
        // Mock data for other stats (in real app, would come from backend)
        document.getElementById('issuesResolved').textContent = '324';
        document.getElementById('activeCitizens').textContent = '1,245';
        document.getElementById('cleanlinessRating').textContent = '4.5/5';
        
    } catch (error) {
        console.error('Error loading statistics:', error);
        document.getElementById('totalWasteCollected').textContent = '--';
        document.getElementById('issuesResolved').textContent = '--';
        document.getElementById('activeCitizens').textContent = '--';
        document.getElementById('cleanlinessRating').textContent = '--';
    }
}

// ============================================
// REPORT FORM
// ============================================

function setupFormHandler() {
    const form = document.getElementById('reportForm');
    const imageInput = document.getElementById('issueImage');
    
    // Image upload drag and drop
    const uploadArea = document.querySelector('.image-upload-area');
    
    // Click to open file picker
    uploadArea.addEventListener('click', (e) => {
        if (e.target.id !== 'issueImage') {
            imageInput.click();
        }
    });
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.add('dragover');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.remove('dragover');
        }, false);
    });
    
    uploadArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        imageInput.files = files;
        handleImageSelect({target: {files: files}});
    }, false);
    
    imageInput.addEventListener('change', handleImageSelect);
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formDataObj = new FormData();
        formDataObj.append('issue_type', document.getElementById('issueType').value);
        formDataObj.append('location', document.getElementById('location').value);
        formDataObj.append('description', document.getElementById('description').value);
        formDataObj.append('contact_name', document.getElementById('contactName').value);
        formDataObj.append('contact_phone', document.getElementById('contactPhone').value);
        
        // Add image if present
        const imageFile = imageInput.files[0];
        if (imageFile) {
            formDataObj.append('image', imageFile);
        }
        
        try {
            // Send to backend
            const response = await fetch(`${API_BASE}/citizen/report`, {
                method: 'POST',
                body: formDataObj
            });
            
            const result = await response.json();
            
            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to submit report');
            }
            
            // Hide form and show success message
            form.style.display = 'none';
            const successMessage = document.getElementById('reportSuccess');
            document.getElementById('reportId').textContent = result.report_id;
            successMessage.style.display = 'block';
            
            // Reset form after 5 seconds
            setTimeout(() => {
                form.reset();
                imageInput.value = '';
                removeImage();
                form.style.display = 'block';
                successMessage.style.display = 'none';
            }, 5000);
            
        } catch (error) {
            console.error('Error submitting report:', error);
            alert('Failed to submit report: ' + error.message);
        }
    });
}

// ============================================
// DUSTBIN FINDER
// ============================================

async function loadDustbins() {
    try {
        const response = await fetch(`${API_BASE}/waste/status`);
        const data = await response.json();
        
        if (data.success) {
            displayDustbins(data.data);
        }
    } catch (error) {
        console.error('Error loading dustbins:', error);
        document.getElementById('dustbinResults').innerHTML = `
            <p style="text-align: center; color: var(--text-secondary); grid-column: 1/-1;">
                Unable to load dustbin locations. Please try again later.
            </p>
        `;
    }
}

function displayDustbins(bins) {
    const resultsContainer = document.getElementById('dustbinResults');
    
    const html = bins.map(bin => {
        const status = getStatusInfo(bin.fill_level_percent);
        const distance = (Math.random() * 2 + 0.1).toFixed(1); // Mock distance
        
        return `
            <div class="dustbin-card fade-in">
                <h3><i class="fas fa-trash-alt"></i> ${bin.bin_id}</h3>
                <p><i class="fas fa-map-marker-alt"></i> ${bin.location || 'Unknown location'}</p>
                <p><i class="fas fa-route"></i> ${distance} km away</p>
                <p><i class="fas fa-percentage"></i> Fill Level: ${bin.fill_level_percent}%</p>
                <span class="status ${status.class}">${status.text}</span>
            </div>
        `;
    }).join('');
    
    resultsContainer.innerHTML = html;
}

function getStatusInfo(fillLevel) {
    if (fillLevel < 50) {
        return { class: 'available', text: 'Available' };
    } else if (fillLevel < 80) {
        return { class: 'almost-full', text: 'Almost Full' };
    } else {
        return { class: 'full', text: 'Full' };
    }
}

function searchDustbins() {
    const searchTerm = document.getElementById('searchLocation').value.toLowerCase();
    
    if (!searchTerm) {
        loadDustbins();
        return;
    }
    
    fetch(`${API_BASE}/waste/status`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const filteredBins = data.data.filter(bin => {
                    const location = bin.location || bin.bin_id;
                    return location.toLowerCase().includes(searchTerm);
                });
                
                if (filteredBins.length > 0) {
                    displayDustbins(filteredBins);
                } else {
                    document.getElementById('dustbinResults').innerHTML = `
                        <p style="text-align: center; color: var(--text-secondary); grid-column: 1/-1;">
                            No dustbins found near "${searchTerm}". Try a different location.
                        </p>
                    `;
                }
            }
        })
        .catch(error => {
            console.error('Error searching dustbins:', error);
        });
}

// ============================================
// CLEANLINESS SCORES
// ============================================

async function loadZoneScores() {
    try {
        // Get data from multiple modules
        const [wasteRes, aqiRes] = await Promise.all([
            fetch(`${API_BASE}/waste/status`),
            fetch(`${API_BASE}/aqi/status`)
        ]);
        
        const wasteData = await wasteRes.json();
        const aqiData = await aqiRes.json();
        
        if (wasteData.success && aqiData.success) {
            calculateAndDisplayScores(wasteData.data, aqiData.data);
        }
    } catch (error) {
        console.error('Error loading zone scores:', error);
        document.getElementById('zoneScores').innerHTML = `
            <p style="text-align: center; color: var(--text-secondary); grid-column: 1/-1;">
                Unable to load cleanliness scores. Please try again later.
            </p>
        `;
    }
}

function calculateAndDisplayScores(wasteBins, aqiZones) {
    // Calculate scores for zones A, B, C, D
    const zones = ['Zone A', 'Zone B', 'Zone C', 'Zone D'];
    const scoresContainer = document.getElementById('zoneScores');
    
    const html = zones.map(zoneName => {
        // Calculate waste score (lower fill level = better score)
        const zoneBins = wasteBins.filter(bin => bin.bin_id.includes(zoneName.replace('Zone ', '')));
        const avgFillLevel = zoneBins.length > 0 
            ? zoneBins.reduce((sum, bin) => sum + bin.fill_level_percent, 0) / zoneBins.length
            : 50;
        const wasteScore = 100 - avgFillLevel;
        
        // Get AQI score (lower AQI = better score)
        const zoneAQI = aqiZones.find(z => z.zone === zoneName);
        const aqiScore = zoneAQI ? Math.max(0, 100 - (zoneAQI.aqi / 2)) : 50;
        
        // Combined cleanliness score
        const cleanlinessScore = ((wasteScore * 0.6) + (aqiScore * 0.4)).toFixed(1);
        const rating = getScoreRating(cleanlinessScore);
        
        return `
            <div class="zone-card fade-in">
                <div class="zone-name">${zoneName}</div>
                <div class="zone-rating">
                    ${generateStars(rating.stars)}
                </div>
                <div class="zone-score ${rating.class}">${cleanlinessScore}</div>
                <div class="zone-details">
                    <p><strong>Waste Management:</strong> ${wasteScore.toFixed(0)}/100</p>
                    <p><strong>Air Quality:</strong> ${aqiScore.toFixed(0)}/100</p>
                    <p><strong>Status:</strong> ${rating.status}</p>
                </div>
            </div>
        `;
    }).join('');
    
    scoresContainer.innerHTML = html;
}

function getScoreRating(score) {
    if (score >= 80) {
        return { stars: 5, class: 'excellent', status: 'Excellent' };
    } else if (score >= 60) {
        return { stars: 4, class: 'good', status: 'Good' };
    } else if (score >= 40) {
        return { stars: 3, class: 'average', status: 'Average' };
    } else {
        return { stars: 2, class: 'poor', status: 'Needs Improvement' };
    }
}

function generateStars(count) {
    let stars = '';
    for (let i = 0; i < 5; i++) {
        stars += i < count ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>';
    }
    return stars;
}

// ============================================
// IMAGE UPLOAD HANDLERS
// ============================================

function handleImageSelect(event) {
    const file = event.target.files[0];
    
    if (!file) return;
    
    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        alert('File size must be less than 5MB');
        event.target.value = '';
        return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file');
        event.target.value = '';
        return;
    }
    
    // Show preview
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('imagePreview');
        const previewImg = document.getElementById('previewImg');
        previewImg.src = e.target.result;
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    document.getElementById('issueImage').value = '';
    document.getElementById('imagePreview').style.display = 'none';
}

// ============================================
// AUTO REFRESH
// ============================================

// Refresh data every 30 seconds
setInterval(() => {
    loadStatistics();
    loadDustbins();
    loadZoneScores();
}, 30000);
