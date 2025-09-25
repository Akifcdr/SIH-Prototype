// Admin Dashboard JavaScript
class AdminDashboard {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.currentFilters = {};
        this.issues = [];
        this.stats = {};
        
        this.initializeEventListeners();
        this.loadInitialData();
        this.startAutoRefresh();
    }

    initializeEventListeners() {
        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => this.loadData());
        
        // Export button
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        
        // Filter controls
        document.getElementById('applyFilters').addEventListener('click', () => this.applyFilters());
        
        // Enter key for search filter
        document.getElementById('searchFilter').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.applyFilters();
            }
        });
        
        // Modal controls
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal('issueModal'));
        document.getElementById('closeStatusModal').addEventListener('click', () => this.closeModal('statusModal'));
        document.getElementById('cancelStatusUpdate').addEventListener('click', () => this.closeModal('statusModal'));
        
        // Status update form
        document.getElementById('statusUpdateForm').addEventListener('submit', (e) => this.handleStatusUpdate(e));
        
        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }

    async loadInitialData() {
        await Promise.all([
            this.loadStats(),
            this.loadIssues()
        ]);
    }

    async loadData() {
        const refreshBtn = document.getElementById('refreshBtn');
        const originalContent = refreshBtn.innerHTML;
        
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
        refreshBtn.disabled = true;
        
        try {
            await this.loadInitialData();
        } finally {
            refreshBtn.innerHTML = originalContent;
            refreshBtn.disabled = false;
        }
    }

    async loadStats() {
        try {
            const response = await fetch('/api/stats');
            if (response.ok) {
                this.stats = await response.json();
                this.renderStats();
            } else {
                throw new Error('Failed to load statistics');
            }
        } catch (error) {
            console.error('Error loading stats:', error);
            this.showMessage('error', 'Failed to load statistics');
        }
    }

    async loadIssues() {
        try {
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.itemsPerPage,
                ...this.currentFilters
            });
            
            const response = await fetch(`/api/issues?${params}`);
            if (response.ok) {
                const data = await response.json();
                this.issues = data.issues;
                this.totalItems = data.total;
                this.renderIssues();
                this.renderPagination();
            } else {
                throw new Error('Failed to load issues');
            }
        } catch (error) {
            console.error('Error loading issues:', error);
            this.showMessage('error', 'Failed to load issues');
            document.getElementById('issuesTableBody').innerHTML = 
                '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: #e74c3c;">Failed to load issues</td></tr>';
        }
    }

    renderStats() {
        document.getElementById('totalCount').textContent = this.stats.total || 0;
        document.getElementById('reportedCount').textContent = this.stats.reported || 0;
        document.getElementById('progressCount').textContent = this.stats.inProgress || 0;
        document.getElementById('resolvedCount').textContent = this.stats.resolved || 0;
    }

    renderIssues() {
        const tbody = document.getElementById('issuesTableBody');
        
        if (this.issues.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem;">No issues found</td></tr>';
            return;
        }
        
        tbody.innerHTML = this.issues.map(issue => this.renderIssueRow(issue)).join('');
    }

    renderIssueRow(issue) {
        const createdDate = new Date(issue.created_at).toLocaleDateString();
        const truncatedTitle = issue.title.length > 30 ? 
            issue.title.substring(0, 30) + '...' : issue.title;
        
        const statusClass = `status-${issue.status}`;
        const priorityClass = `priority-${issue.priority}`;
        
        return `
            <tr>
                <td><strong>#${issue.id}</strong></td>
                <td title="${issue.title}">${truncatedTitle}</td>
                <td><span class="category-badge">${this.formatCategory(issue.category)}</span></td>
                <td><span class="status-badge ${statusClass}">${this.formatStatus(issue.status)}</span></td>
                <td><span class="priority-badge ${priorityClass}">${issue.priority}</span></td>
                <td>${this.formatLocation(issue)}</td>
                <td>${this.formatReporter(issue)}</td>
                <td>${createdDate}</td>
                <td>
                    <div class="issue-actions">
                        <button class="action-btn view" onclick="adminDashboard.viewIssue(${issue.id})" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn edit" onclick="adminDashboard.updateStatus(${issue.id})" title="Update Status">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    formatCategory(category) {
        const categoryMap = {
            roads: 'Roads & Transportation',
            sanitation: 'Sanitation & Waste',
            lighting: 'Street Lighting',
            water: 'Water Supply',
            drainage: 'Drainage',
            parks: 'Parks & Recreation',
            safety: 'Public Safety',
            other: 'Other'
        };
        return categoryMap[category] || category;
    }

    formatStatus(status) {
        const statusMap = {
            reported: 'Reported',
            in_progress: 'In Progress',
            resolved: 'Resolved'
        };
        return statusMap[status] || status;
    }

    formatLocation(issue) {
        if (issue.address) {
            return issue.address.length > 20 ? 
                issue.address.substring(0, 20) + '...' : issue.address;
        }
        if (issue.latitude && issue.longitude) {
            return `${issue.latitude.toFixed(4)}, ${issue.longitude.toFixed(4)}`;
        }
        return 'Not specified';
    }

    formatReporter(issue) {
        if (issue.reporter_name) {
            return issue.reporter_name.length > 15 ? 
                issue.reporter_name.substring(0, 15) + '...' : issue.reporter_name;
        }
        return 'Anonymous';
    }

    renderPagination() {
        const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        const pagination = document.getElementById('pagination');
        
        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }
        
        let paginationHTML = '';
        
        // Previous button
        paginationHTML += `
            <button ${this.currentPage === 1 ? 'disabled' : ''} onclick="adminDashboard.goToPage(${this.currentPage - 1})">
                <i class="fas fa-chevron-left"></i> Previous
            </button>
        `;
        
        // Page numbers
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);
        
        if (startPage > 1) {
            paginationHTML += `<button onclick="adminDashboard.goToPage(1)">1</button>`;
            if (startPage > 2) {
                paginationHTML += `<span>...</span>`;
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button ${i === this.currentPage ? 'class="active"' : ''} onclick="adminDashboard.goToPage(${i})">
                    ${i}
                </button>
            `;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += `<span>...</span>`;
            }
            paginationHTML += `<button onclick="adminDashboard.goToPage(${totalPages})">${totalPages}</button>`;
        }
        
        // Next button
        paginationHTML += `
            <button ${this.currentPage === totalPages ? 'disabled' : ''} onclick="adminDashboard.goToPage(${this.currentPage + 1})">
                Next <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        // Page info
        paginationHTML += `
            <div class="page-info">
                Showing ${((this.currentPage - 1) * this.itemsPerPage) + 1}-${Math.min(this.currentPage * this.itemsPerPage, this.totalItems)} of ${this.totalItems} issues
            </div>
        `;
        
        pagination.innerHTML = paginationHTML;
    }

    async goToPage(page) {
        this.currentPage = page;
        await this.loadIssues();
    }

    applyFilters() {
        this.currentFilters = {
            status: document.getElementById('statusFilter').value,
            category: document.getElementById('categoryFilter').value,
            priority: document.getElementById('priorityFilter').value,
            search: document.getElementById('searchFilter').value
        };
        
        // Remove empty filters
        Object.keys(this.currentFilters).forEach(key => {
            if (!this.currentFilters[key]) {
                delete this.currentFilters[key];
            }
        });
        
        this.currentPage = 1; // Reset to first page
        this.loadIssues();
    }

    async viewIssue(issueId) {
        try {
            const response = await fetch(`/api/issues/${issueId}`);
            if (response.ok) {
                const issue = await response.json();
                this.showIssueDetails(issue);
            } else {
                throw new Error('Failed to load issue details');
            }
        } catch (error) {
            console.error('Error loading issue details:', error);
            this.showMessage('error', 'Failed to load issue details');
        }
    }

    showIssueDetails(issue) {
        const createdDate = new Date(issue.created_at).toLocaleString();
        const updatedDate = new Date(issue.updated_at).toLocaleString();
        
        const detailsHTML = `
            <div style="margin-bottom: 1rem;">
                <h3>Issue #${issue.id}: ${issue.title}</h3>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div>
                    <strong>Status:</strong>
                    <span class="status-badge status-${issue.status}" style="margin-left: 0.5rem;">
                        ${this.formatStatus(issue.status)}
                    </span>
                </div>
                <div>
                    <strong>Category:</strong>
                    <span class="category-badge" style="margin-left: 0.5rem;">
                        ${this.formatCategory(issue.category)}
                    </span>
                </div>
                <div>
                    <strong>Priority:</strong>
                    <span class="priority-badge priority-${issue.priority}" style="margin-left: 0.5rem;">
                        ${issue.priority}
                    </span>
                </div>
            </div>
            
            <div style="margin-bottom: 1rem;">
                <strong>Description:</strong>
                <p style="margin-top: 0.5rem; background: #f8f9fa; padding: 1rem; border-radius: 6px;">${issue.description}</p>
            </div>
            
            ${issue.address ? `
                <div style="margin-bottom: 1rem;">
                    <strong>Location:</strong>
                    <p style="margin-top: 0.5rem;">${issue.address}</p>
                    ${issue.latitude && issue.longitude ? `<small>Coordinates: ${issue.latitude.toFixed(6)}, ${issue.longitude.toFixed(6)}</small>` : ''}
                </div>
            ` : ''}
            
            ${issue.image_path ? `
                <div style="margin-bottom: 1rem;">
                    <strong>Photo:</strong>
                    <div style="margin-top: 0.5rem;">
                        <img src="/uploads/${issue.image_path}" alt="Issue photo" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #ddd;">
                    </div>
                </div>
            ` : ''}
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <strong>Reporter:</strong>
                    <p style="margin-top: 0.25rem;">${issue.reporter_name || 'Anonymous'}</p>
                    ${issue.reporter_email ? `<p style="margin-top: 0.25rem; font-size: 0.9rem; color: #666;">${issue.reporter_email}</p>` : ''}
                    ${issue.reporter_phone ? `<p style="margin-top: 0.25rem; font-size: 0.9rem; color: #666;">${issue.reporter_phone}</p>` : ''}
                </div>
                <div>
                    <strong>Timeline:</strong>
                    <p style="margin-top: 0.25rem; font-size: 0.9rem;">Reported: ${createdDate}</p>
                    <p style="margin-top: 0.25rem; font-size: 0.9rem;">Updated: ${updatedDate}</p>
                </div>
            </div>
            
            ${issue.admin_notes ? `
                <div style="margin-bottom: 1rem;">
                    <strong>Admin Notes:</strong>
                    <p style="margin-top: 0.5rem; background: #e8f4fd; padding: 1rem; border-radius: 6px; border-left: 4px solid #3498db;">${issue.admin_notes}</p>
                </div>
            ` : ''}
            
            <div style="text-align: center; margin-top: 2rem;">
                <button class="admin-btn primary" onclick="adminDashboard.updateStatus(${issue.id}); adminDashboard.closeModal('issueModal');">
                    <i class="fas fa-edit"></i> Update Status
                </button>
            </div>
        `;
        
        document.getElementById('issueDetails').innerHTML = detailsHTML;
        document.getElementById('issueModal').style.display = 'block';
    }

    updateStatus(issueId) {
        // Find the issue to pre-populate the form
        const issue = this.issues.find(i => i.id === issueId);
        if (issue) {
            document.getElementById('updateIssueId').value = issueId;
            document.getElementById('newStatus').value = issue.status;
            document.getElementById('adminNotes').value = issue.admin_notes || '';
        }
        
        document.getElementById('statusModal').style.display = 'block';
    }

    async handleStatusUpdate(e) {
        e.preventDefault();
        
        const issueId = document.getElementById('updateIssueId').value;
        const status = document.getElementById('newStatus').value;
        const adminNotes = document.getElementById('adminNotes').value;
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalContent = submitBtn.innerHTML;
        
        submitBtn.innerHTML = '<span class="loading-spinner"></span> Updating...';
        submitBtn.disabled = true;
        
        try {
            const response = await fetch(`/api/issues/${issueId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status, admin_notes: adminNotes })
            });
            
            if (response.ok) {
                this.showMessage('success', 'Issue status updated successfully');
                this.closeModal('statusModal');
                await this.loadData(); // Refresh data
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update status');
            }
        } catch (error) {
            console.error('Error updating status:', error);
            this.showMessage('error', error.message || 'Failed to update issue status');
        } finally {
            submitBtn.innerHTML = originalContent;
            submitBtn.disabled = false;
        }
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    exportData() {
        const filters = { ...this.currentFilters };
        const params = new URLSearchParams({
            ...filters,
            limit: 1000 // Export more data
        });
        
        // Create a downloadable CSV
        const csvContent = this.generateCSV(this.issues);
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `civic-issues-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        this.showMessage('success', 'Data exported successfully');
    }

    generateCSV(issues) {
        const headers = ['ID', 'Title', 'Description', 'Category', 'Status', 'Priority', 'Address', 'Reporter Name', 'Reporter Email', 'Reporter Phone', 'Created', 'Updated', 'Admin Notes'];
        
        const csvRows = [
            headers.join(','),
            ...issues.map(issue => [
                issue.id,
                `"${(issue.title || '').replace(/"/g, '""')}"`,
                `"${(issue.description || '').replace(/"/g, '""')}"`,
                issue.category,
                issue.status,
                issue.priority,
                `"${(issue.address || '').replace(/"/g, '""')}"`,
                `"${(issue.reporter_name || '').replace(/"/g, '""')}"`,
                issue.reporter_email || '',
                issue.reporter_phone || '',
                issue.created_at,
                issue.updated_at,
                `"${(issue.admin_notes || '').replace(/"/g, '""')}"`
            ].join(','))
        ];
        
        return csvRows.join('\n');
    }

    showMessage(type, text) {
        const messageContainer = document.getElementById('messageContainer');
        const messageContent = document.getElementById('messageContent');
        
        messageContent.className = `message ${type}`;
        messageContent.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            ${text}
        `;
        messageContainer.style.display = 'block';
        
        // Auto-hide messages after 5 seconds
        setTimeout(() => {
            messageContainer.style.display = 'none';
        }, 5000);
        
        // Scroll to message
        messageContainer.scrollIntoView({ behavior: 'smooth' });
    }

    startAutoRefresh() {
        // Refresh data every 30 seconds
        setInterval(() => {
            this.loadStats();
            // Only refresh issues if no modal is open
            if (!document.getElementById('issueModal').style.display || 
                document.getElementById('issueModal').style.display === 'none') {
                this.loadIssues();
            }
        }, 30000);
    }
}

// Initialize the admin dashboard when DOM is loaded
let adminDashboard;
document.addEventListener('DOMContentLoaded', () => {
    adminDashboard = new AdminDashboard();
});
