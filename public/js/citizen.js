// Citizen Portal JavaScript
class CivicReporter {
    constructor() {
        this.form = document.getElementById('issueForm');
        this.submitBtn = document.getElementById('submitBtn');
        this.locationBtn = document.getElementById('getLocationBtn');
        this.locationStatus = document.getElementById('locationStatus');
        this.trackBtn = document.getElementById('trackBtn');
        this.messageContainer = document.getElementById('messageContainer');
        this.messageContent = document.getElementById('messageContent');
        
        this.initializeEventListeners();
        this.loadFromLocalStorage();
    }

    initializeEventListeners() {
        // Form submission
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Location button
        this.locationBtn.addEventListener('click', () => this.getCurrentLocation());
        
        // Track issue button
        this.trackBtn.addEventListener('click', () => this.trackIssue());
        
        // Auto-save form data
        this.form.addEventListener('input', () => this.saveToLocalStorage());
        
        // Reset button
        this.form.addEventListener('reset', () => this.clearLocalStorage());
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            return;
        }

        this.setSubmitLoading(true);
        
        try {
            const formData = new FormData(this.form);
            
            const response = await fetch('/api/issues', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                this.showMessage('success', 
                    `Issue reported successfully! Your issue ID is: ${result.id}. ` +
                    'You can use this ID to track the status of your report.'
                );
                this.form.reset();
                this.clearLocalStorage();
                
                // Scroll to message
                this.messageContainer.scrollIntoView({ behavior: 'smooth' });
            } else {
                throw new Error(result.error || 'Failed to submit issue');
            }
        } catch (error) {
            console.error('Error submitting issue:', error);
            this.showMessage('error', 
                'Failed to submit your report. Please check your connection and try again.'
            );
        } finally {
            this.setSubmitLoading(false);
        }
    }

    validateForm() {
        const title = document.getElementById('title').value.trim();
        const description = document.getElementById('description').value.trim();
        const category = document.getElementById('category').value;

        if (!title) {
            this.showMessage('error', 'Please enter a title for the issue.');
            return false;
        }

        if (!description) {
            this.showMessage('error', 'Please provide a description of the issue.');
            return false;
        }

        if (!category) {
            this.showMessage('error', 'Please select a category for the issue.');
            return false;
        }

        if (title.length < 10) {
            this.showMessage('error', 'Issue title must be at least 10 characters long.');
            return false;
        }

        if (description.length < 20) {
            this.showMessage('error', 'Issue description must be at least 20 characters long.');
            return false;
        }

        // Validate image if provided
        const imageFile = document.getElementById('image').files[0];
        if (imageFile) {
            const maxSize = 5 * 1024 * 1024; // 5MB
            if (imageFile.size > maxSize) {
                this.showMessage('error', 'Image file size must be less than 5MB.');
                return false;
            }

            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(imageFile.type)) {
                this.showMessage('error', 'Only JPEG, PNG, GIF, and WebP images are allowed.');
                return false;
            }
        }

        return true;
    }

    async getCurrentLocation() {
        if (!navigator.geolocation) {
            this.showMessage('error', 'Geolocation is not supported by this browser.');
            return;
        }

        this.locationBtn.disabled = true;
        this.locationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting Location...';
        this.locationStatus.textContent = 'Getting your current location...';

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000 // 5 minutes
                });
            });

            const { latitude, longitude } = position.coords;
            
            document.getElementById('latitude').value = latitude;
            document.getElementById('longitude').value = longitude;

            // Try to get address using reverse geocoding
            try {
                const address = await this.reverseGeocode(latitude, longitude);
                if (address) {
                    document.getElementById('address').value = address;
                }
            } catch (error) {
                console.warn('Could not get address:', error);
            }

            this.locationStatus.innerHTML = 
                `<span style="color: #27ae60;"><i class="fas fa-check"></i> Location captured successfully</span>`;
            
        } catch (error) {
            console.error('Location error:', error);
            let errorMessage = 'Could not get your location. ';
            
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += 'Location access denied by user.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += 'Location information is unavailable.';
                    break;
                case error.TIMEOUT:
                    errorMessage += 'Location request timed out.';
                    break;
                default:
                    errorMessage += 'An unknown error occurred.';
                    break;
            }
            
            this.locationStatus.innerHTML = 
                `<span style="color: #e74c3c;"><i class="fas fa-exclamation-triangle"></i> ${errorMessage}</span>`;
        } finally {
            this.locationBtn.disabled = false;
            this.locationBtn.innerHTML = '<i class="fas fa-location-arrow"></i> Use Current Location';
        }
    }

    async reverseGeocode(lat, lng) {
        // This is a simple reverse geocoding using a free service
        // In production, you might want to use Google Maps API or similar
        try {
            const response = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
            );
            
            if (response.ok) {
                const data = await response.json();
                return data.display_name || data.locality || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            }
        } catch (error) {
            console.warn('Reverse geocoding failed:', error);
        }
        
        return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }

    async trackIssue() {
        const trackId = document.getElementById('trackId').value.trim();
        const trackResult = document.getElementById('trackResult');
        
        if (!trackId) {
            this.showMessage('error', 'Please enter an issue ID to track.');
            return;
        }

        this.trackBtn.disabled = true;
        this.trackBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Tracking...';
        
        try {
            const response = await fetch(`/api/issues/${trackId}`);
            const issue = await response.json();

            if (response.ok) {
                trackResult.innerHTML = this.renderIssueTracking(issue);
                trackResult.style.display = 'block';
                trackResult.scrollIntoView({ behavior: 'smooth' });
            } else {
                throw new Error(issue.error || 'Issue not found');
            }
        } catch (error) {
            this.showMessage('error', `Could not find issue with ID ${trackId}. Please check the ID and try again.`);
            trackResult.style.display = 'none';
        } finally {
            this.trackBtn.disabled = false;
            this.trackBtn.innerHTML = 'Track Status';
        }
    }

    renderIssueTracking(issue) {
        const statusColors = {
            reported: '#e74c3c',
            in_progress: '#f39c12',
            resolved: '#27ae60'
        };

        const statusLabels = {
            reported: 'Reported',
            in_progress: 'In Progress',
            resolved: 'Resolved'
        };

        const createdDate = new Date(issue.created_at).toLocaleString();
        const updatedDate = new Date(issue.updated_at).toLocaleString();
        
        return `
            <h4><i class="fas fa-info-circle"></i> Issue #${issue.id}: ${issue.title}</h4>
            <div style="margin: 1rem 0;">
                <strong>Status:</strong> 
                <span style="background-color: ${statusColors[issue.status]}20; color: ${statusColors[issue.status]}; padding: 0.3rem 0.8rem; border-radius: 15px; font-weight: 600;">
                    ${statusLabels[issue.status]}
                </span>
            </div>
            <div style="margin: 0.5rem 0;"><strong>Category:</strong> ${issue.category.charAt(0).toUpperCase() + issue.category.slice(1)}</div>
            <div style="margin: 0.5rem 0;"><strong>Description:</strong> ${issue.description}</div>
            ${issue.address ? `<div style="margin: 0.5rem 0;"><strong>Location:</strong> ${issue.address}</div>` : ''}
            <div style="margin: 0.5rem 0;"><strong>Reported:</strong> ${createdDate}</div>
            <div style="margin: 0.5rem 0;"><strong>Last Updated:</strong> ${updatedDate}</div>
            ${issue.admin_notes ? `<div style="margin: 0.5rem 0; padding: 0.5rem; background: #f8f9fa; border-left: 3px solid #3498db;"><strong>Admin Notes:</strong> ${issue.admin_notes}</div>` : ''}
            ${issue.image_path ? `<div style="margin: 1rem 0;"><img src="/uploads/${issue.image_path}" alt="Issue image" style="max-width: 100%; height: auto; border-radius: 8px;"></div>` : ''}
        `;
    }

    showMessage(type, text) {
        this.messageContent.className = `message ${type}`;
        this.messageContent.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            ${text}
        `;
        this.messageContainer.style.display = 'block';
        
        // Auto-hide success messages after 10 seconds
        if (type === 'success') {
            setTimeout(() => {
                this.messageContainer.style.display = 'none';
            }, 10000);
        }
    }

    setSubmitLoading(loading) {
        this.submitBtn.disabled = loading;
        if (loading) {
            this.submitBtn.innerHTML = '<span class="loading-spinner"></span> Submitting...';
        } else {
            this.submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Report';
        }
    }

    saveToLocalStorage() {
        const formData = new FormData(this.form);
        const data = {};
        
        // Save text inputs
        for (let [key, value] of formData.entries()) {
            if (key !== 'image') { // Don't save file inputs
                data[key] = value;
            }
        }
        
        localStorage.setItem('civicReporterDraft', JSON.stringify(data));
    }

    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('civicReporterDraft');
            if (saved) {
                const data = JSON.parse(saved);
                
                // Restore form values
                Object.keys(data).forEach(key => {
                    const element = document.getElementById(key);
                    if (element && element.type !== 'file') {
                        element.value = data[key];
                    }
                });
                
                // Update location status if coordinates are saved
                if (data.latitude && data.longitude) {
                    this.locationStatus.innerHTML = 
                        `<span style="color: #27ae60;"><i class="fas fa-check"></i> Location saved from previous session</span>`;
                }
            }
        } catch (error) {
            console.warn('Could not load saved form data:', error);
        }
    }

    clearLocalStorage() {
        localStorage.removeItem('civicReporterDraft');
        this.locationStatus.textContent = 'Click to automatically get your location';
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CivicReporter();
});

// Add some utility functions for better user experience
document.addEventListener('DOMContentLoaded', () => {
    // Add input validation feedback
    const inputs = document.querySelectorAll('input[required], select[required], textarea[required]');
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            if (this.value.trim()) {
                this.style.borderColor = '#27ae60';
            } else {
                this.style.borderColor = '#e74c3c';
            }
        });
        
        input.addEventListener('focus', function() {
            this.style.borderColor = '#3498db';
        });
    });

    // Add character count for description
    const description = document.getElementById('description');
    const charCount = document.createElement('small');
    charCount.style.float = 'right';
    charCount.style.color = '#666';
    description.parentNode.appendChild(charCount);
    
    description.addEventListener('input', function() {
        const length = this.value.length;
        charCount.textContent = `${length} characters`;
        
        if (length < 20) {
            charCount.style.color = '#e74c3c';
        } else {
            charCount.style.color = '#27ae60';
        }
    });

    // Add image preview
    const imageInput = document.getElementById('image');
    imageInput.addEventListener('change', function() {
        const file = this.files[0];
        const existingPreview = document.querySelector('.image-preview');
        
        // Remove existing preview
        if (existingPreview) {
            existingPreview.remove();
        }
        
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const preview = document.createElement('div');
                preview.className = 'image-preview';
                preview.style.marginTop = '10px';
                preview.innerHTML = `
                    <img src="${e.target.result}" alt="Preview" style="max-width: 200px; height: auto; border-radius: 8px; border: 2px solid #e1e8ed;">
                    <p style="margin-top: 5px; font-size: 0.9rem; color: #666;">Preview of selected image</p>
                `;
                imageInput.parentNode.appendChild(preview);
            };
            reader.readAsDataURL(file);
        }
    });
});
