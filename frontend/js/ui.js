// SommOS UI Helper Class
// Handles UI interactions, modals, toasts, and visual feedback

export class SommOSUI {
    constructor() {
        this.refreshDomReferences();
        this.setupModalHandlers();
    }

    refreshDomReferences() {
        const existingToastContainer = document.getElementById('toast-container');
        if (existingToastContainer) {
            this.toastContainer = existingToastContainer;
        } else {
            this.toastContainer = this.createToastContainer();
        }

        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById('modal');
        this.modalOverlay = overlay || modal || null;
        this.modalElement = modal || overlay || null;
    }

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.setAttribute('role', 'status');
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
        return container;
    }

    setupModalHandlers() {
        this.refreshDomReferences();

        // Close modal when clicking overlay or close button
        if (this.modalOverlay && typeof this.modalOverlay.addEventListener === 'function') {
            this.modalOverlay.addEventListener('click', (e) => {
                if (e.target === this.modalOverlay || e.target.classList.contains('modal-close')) {
                    this.hideModal();
                }
            });
        }

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modalOverlay && !this.modalOverlay.classList.contains('hidden')) {
                this.hideModal();
            }
        });
    }

    // Toast notifications
    showToast(message, type = 'info', duration = 4000) {
        this.refreshDomReferences();
        if (!document.body.contains(this.toastContainer)) {
            this.toastContainer = this.createToastContainer();
        }

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
        this.refreshDomReferences();
        const container = this.modalElement || this.modalOverlay;
        if (!container) return;

        const modalTitle = container.querySelector('#modal-title') || document.getElementById('modal-title');
        const modalBody = container.querySelector('#modal-body') || document.getElementById('modal-body');

        if (!modalTitle || !modalBody) {
            return;
        }

        modalTitle.textContent = title;
        modalBody.innerHTML = content;

        // Add actions if provided
        if (actions) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'modal-actions';
            actionsDiv.innerHTML = actions;
            modalBody.appendChild(actionsDiv);
        }

        if (this.modalOverlay) {
            this.modalOverlay.classList.remove('hidden');
        }
        document.body.style.overflow = 'hidden';
    }

    hideModal() {
        this.refreshDomReferences();
        if (this.modalOverlay) {
            this.modalOverlay.classList.add('hidden');
        }
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

// Virtual Scroll Implementation for Large Lists
export class VirtualScroll {
    constructor(container, items, itemHeight, options = {}) {
        this.container = container;
        this.items = items || [];
        this.itemHeight = itemHeight || 200; // Default card height
        this.options = {
            bufferSize: 5, // Extra items to render outside viewport
            threshold: 1000, // Only use virtual scrolling for lists > 1000 items
            ...options
        };
        
        this.visibleItems = [];
        this.startIndex = 0;
        this.endIndex = 0;
        this.containerHeight = 0;
        this.scrollTop = 0;
        this.isVirtualScrolling = false;
        this.renderCallback = null;
        this.itemCache = new Map();
        
        this.init();
    }

    init() {
        if (!this.container) {
            console.error('VirtualScroll: Container element not found');
            return;
        }

        // Only enable virtual scrolling for large lists
        if (this.items.length <= this.options.threshold) {
            this.isVirtualScrolling = false;
            this.renderAllItems();
            return;
        }

        this.isVirtualScrolling = true;
        this.setupVirtualScrolling();
    }

    setupVirtualScrolling() {
        // Add CSS class to enable virtual scrolling styles
        this.container.classList.add('virtual-scroll-enabled');
        
        // Set up container styles for virtual scrolling
        this.container.style.position = 'relative';
        this.container.style.overflow = 'auto';
        this.container.style.height = '100%';
        
        // Create virtual content container
        this.virtualContent = document.createElement('div');
        this.virtualContent.className = 'virtual-content';
        this.virtualContent.style.position = 'relative';
        this.virtualContent.style.width = '100%';
        this.virtualContent.style.minHeight = `${this.items.length * this.itemHeight}px`;
        
        // Create visible items container
        this.visibleContainer = document.createElement('div');
        this.visibleContainer.className = 'visible-container';
        this.visibleContainer.style.position = 'absolute';
        this.visibleContainer.style.top = '0';
        this.visibleContainer.style.left = '0';
        this.visibleContainer.style.width = '100%';
        this.visibleContainer.style.pointerEvents = 'none';
        
        this.virtualContent.appendChild(this.visibleContainer);
        this.container.appendChild(this.virtualContent);
        
        // Set up scroll listener
        this.scrollHandler = this.debounce(() => this.handleScroll(), 16); // ~60fps
        this.container.addEventListener('scroll', this.scrollHandler);
        
        // Initial render
        this.updateContainerHeight();
        this.renderVisibleItems();
    }

    updateContainerHeight() {
        const rect = this.container.getBoundingClientRect();
        this.containerHeight = rect.height;
    }

    handleScroll() {
        if (!this.isVirtualScrolling) return;
        
        this.scrollTop = this.container.scrollTop;
        this.renderVisibleItems();
    }

    renderVisibleItems() {
        if (!this.isVirtualScrolling) return;

        const visibleStart = Math.floor(this.scrollTop / this.itemHeight);
        const visibleEnd = Math.min(
            visibleStart + Math.ceil(this.containerHeight / this.itemHeight) + 1,
            this.items.length
        );

        const startIndex = Math.max(0, visibleStart - this.options.bufferSize);
        const endIndex = Math.min(this.items.length, visibleEnd + this.options.bufferSize);

        // Only re-render if the visible range has changed significantly
        if (Math.abs(startIndex - this.startIndex) > this.options.bufferSize || 
            Math.abs(endIndex - this.endIndex) > this.options.bufferSize) {
            
            this.startIndex = startIndex;
            this.endIndex = endIndex;
            this.renderChunk(startIndex, endIndex);
        }
    }

    renderChunk(startIndex, endIndex) {
        if (!this.isVirtualScrolling || !this.renderCallback) return;

        // Clear existing visible items
        this.visibleContainer.innerHTML = '';
        
        // Render visible items
        for (let i = startIndex; i < endIndex; i++) {
            const item = this.items[i];
            if (!item) continue;

            const itemElement = this.createItemElement(item, i);
            if (itemElement) {
                itemElement.style.position = 'absolute';
                itemElement.style.top = `${i * this.itemHeight}px`;
                itemElement.style.left = '0';
                itemElement.style.width = '100%';
                itemElement.style.height = `${this.itemHeight}px`;
                itemElement.style.pointerEvents = 'auto';
                
                this.visibleContainer.appendChild(itemElement);
            }
        }

        // Update visible items array
        this.visibleItems = this.items.slice(startIndex, endIndex);
        
        // Performance monitoring
        this.logPerformanceMetrics(startIndex, endIndex);
    }

    createItemElement(item, index) {
        // Use cached element if available
        const cacheKey = `${item.id || index}_${this.itemHeight}`;
        if (this.itemCache.has(cacheKey)) {
            return this.itemCache.get(cacheKey).cloneNode(true);
        }

        // Create new element using render callback
        if (this.renderCallback) {
            const element = this.renderCallback(item, index);
            if (element) {
                // Cache the element template
                this.itemCache.set(cacheKey, element.cloneNode(true));
                return element;
            }
        }

        return null;
    }

    renderAllItems() {
        if (this.isVirtualScrolling) return;

        if (this.renderCallback) {
            this.container.innerHTML = this.items.map((item, index) => 
                this.renderCallback(item, index)
            ).join('');
        }
    }

    setItems(newItems) {
        this.items = newItems || [];
        this.itemCache.clear(); // Clear cache when items change
        
        if (this.isVirtualScrolling) {
            // Update virtual content height
            if (this.virtualContent) {
                this.virtualContent.style.minHeight = `${this.items.length * this.itemHeight}px`;
            }
            this.renderVisibleItems();
        } else {
            this.renderAllItems();
        }
    }

    setRenderCallback(callback) {
        this.renderCallback = callback;
        if (this.isVirtualScrolling) {
            this.renderVisibleItems();
        } else {
            this.renderAllItems();
        }
    }

    updateItemHeight(newHeight) {
        this.itemHeight = newHeight;
        if (this.isVirtualScrolling && this.virtualContent) {
            this.virtualContent.style.minHeight = `${this.items.length * this.itemHeight}px`;
            this.renderVisibleItems();
        }
    }

    scrollToItem(index) {
        if (index < 0 || index >= this.items.length) return;
        
        const scrollTop = index * this.itemHeight;
        this.container.scrollTop = scrollTop;
    }

    scrollToTop() {
        this.container.scrollTop = 0;
    }

    scrollToBottom() {
        this.container.scrollTop = this.container.scrollHeight;
    }

    getVisibleRange() {
        if (!this.isVirtualScrolling) {
            return { start: 0, end: this.items.length };
        }
        return { start: this.startIndex, end: this.endIndex };
    }

    getVisibleItems() {
        return this.visibleItems;
    }

    isItemVisible(index) {
        if (!this.isVirtualScrolling) return true;
        return index >= this.startIndex && index < this.endIndex;
    }

    logPerformanceMetrics(startIndex, endIndex) {
        const visibleCount = endIndex - startIndex;
        const totalCount = this.items.length;
        const memorySavings = ((totalCount - visibleCount) / totalCount * 100).toFixed(1);
        
        console.log(`VirtualScroll: Rendering ${visibleCount}/${totalCount} items (${memorySavings}% memory savings)`);
    }

    destroy() {
        if (this.scrollHandler) {
            this.container.removeEventListener('scroll', this.scrollHandler);
        }
        
        if (this.virtualContent && this.virtualContent.parentNode) {
            this.virtualContent.parentNode.removeChild(this.virtualContent);
        }
        
        // Remove virtual scrolling CSS class
        this.container.classList.remove('virtual-scroll-enabled');
        
        this.itemCache.clear();
        this.visibleItems = [];
    }

    // Debounce utility
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
}