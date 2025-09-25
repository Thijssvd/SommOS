// SommOS UI Helper Class
// Handles UI interactions, modals, toasts, and visual feedback

class SommOSUI {
    constructor() {
        this.toastContainer = document.getElementById('toast-container');
        this.modalOverlay = document.getElementById('modal-overlay');
        this.setupModalHandlers();
    }

    setupModalHandlers() {
        // Close modal when clicking overlay or close button
        if (this.modalOverlay) {
            this.modalOverlay.addEventListener('click', (e) => {
                if (e.target === this.modalOverlay || e.target.classList.contains('modal-close')) {
                    this.hideModal();
                }
            });
        }

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.modalOverlay.classList.contains('hidden')) {
                this.hideModal();
            }
        });
    }

    // Toast notifications
    showToast(message, type = 'info', duration = 4000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = this.getToastIcon(type);
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${icon}</span>
                <span class="toast-message">${message}</span>
            </div>
            <button class="toast-close">&times;</button>
        `;

        // Add close functionality
        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.removeToast(toast);
        });

        // Add to container
        this.toastContainer.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 100);

        // Auto remove
        if (duration > 0) {
            setTimeout(() => this.removeToast(toast), duration);
        }

        return toast;
    }

    removeToast(toast) {
        toast.classList.add('hide');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    getToastIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    // Modal functionality
    showModal(title, content, actions = null) {
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');

        modalTitle.textContent = title;
        modalBody.innerHTML = content;

        // Add actions if provided
        if (actions) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'modal-actions';
            actionsDiv.innerHTML = actions;
            modalBody.appendChild(actionsDiv);
        }

        this.modalOverlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    hideModal() {
        this.modalOverlay.classList.add('hidden');
        document.body.style.overflow = '';
    }

    // Loading states
    showLoading(elementId, text = 'Loading...') {
        const element = document.getElementById(elementId);
        if (!element) return;

        element.disabled = true;
        element.dataset.originalText = element.textContent;
        element.innerHTML = `
            <span class="loading-spinner"></span>
            ${text}
        `;
        element.classList.add('loading');
    }

    hideLoading(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;

        element.disabled = false;
        element.textContent = element.dataset.originalText || 'Submit';
        element.classList.remove('loading');
        delete element.dataset.originalText;
    }

    // Form validation
    validateForm(formElement) {
        const inputs = formElement.querySelectorAll('input[required], textarea[required], select[required]');
        let isValid = true;
        const errors = [];

        inputs.forEach(input => {
            const value = input.value.trim();
            const label = input.previousElementSibling?.textContent || input.name || 'Field';

            // Clear previous error styling
            input.classList.remove('error');

            if (!value) {
                input.classList.add('error');
                errors.push(`${label} is required`);
                isValid = false;
            } else {
                // Type-specific validation
                if (input.type === 'email' && !this.isValidEmail(value)) {
                    input.classList.add('error');
                    errors.push(`${label} must be a valid email`);
                    isValid = false;
                }
                
                if (input.type === 'number') {
                    const num = parseFloat(value);
                    const min = parseFloat(input.min);
                    const max = parseFloat(input.max);
                    
                    if (isNaN(num)) {
                        input.classList.add('error');
                        errors.push(`${label} must be a number`);
                        isValid = false;
                    } else if (!isNaN(min) && num < min) {
                        input.classList.add('error');
                        errors.push(`${label} must be at least ${min}`);
                        isValid = false;
                    } else if (!isNaN(max) && num > max) {
                        input.classList.add('error');
                        errors.push(`${label} must be at most ${max}`);
                        isValid = false;
                    }
                }
            }
        });

        if (!isValid) {
            this.showToast(errors[0], 'error');
        }

        return isValid;
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Utility functions
    formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(amount);
    }

    formatDate(date, options = {}) {
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };
        
        return new Intl.DateTimeFormat('en-US', {
            ...defaultOptions,
            ...options
        }).format(new Date(date));
    }

    formatNumber(number, decimals = 0) {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(number);
    }

    // Animation helpers
    fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.display = 'block';
        
        const start = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);
            
            element.style.opacity = progress;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    fadeOut(element, duration = 300) {
        const start = performance.now();
        const startOpacity = parseFloat(getComputedStyle(element).opacity);
        
        const animate = (currentTime) => {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);
            
            element.style.opacity = startOpacity * (1 - progress);
            
            if (progress >= 1) {
                element.style.display = 'none';
            } else {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    // Debounce utility for search inputs
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Copy to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('Copied to clipboard', 'success');
            return true;
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            this.showToast('Failed to copy to clipboard', 'error');
            return false;
        }
    }
}