/**
 * SommOS Inventory UI Components
 * Demonstrates how to use optimistic UI updates with the inventory manager
 */

export class InventoryUI {
  constructor(inventoryManager) {
    this.inventoryManager = inventoryManager;
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for optimistic updates
   */
  setupEventListeners() {
    if (typeof window === 'undefined') return;

    // Listen for optimistic update events
    window.addEventListener('inventory:optimistic-update', (event) => {
      this.handleOptimisticUpdate(event.detail);
    });

    window.addEventListener('inventory:rollback', (event) => {
      this.handleRollback(event.detail);
    });

    window.addEventListener('inventory:confirmed', (event) => {
      this.handleConfirmed(event.detail);
    });

    window.addEventListener('inventory:loading-start', (event) => {
      this.handleLoadingStart(event.detail);
    });

    window.addEventListener('inventory:loading-end', (event) => {
      this.handleLoadingEnd(event.detail);
    });

    window.addEventListener('inventory:stock-update', (event) => {
      this.handleStockUpdate(event.detail);
    });

    window.addEventListener('inventory:reserved-update', (event) => {
      this.handleReservedUpdate(event.detail);
    });
  }

  /**
   * Handle optimistic update event
   */
  handleOptimisticUpdate(detail) {
    console.log('Optimistic update:', detail);
    
    // Update UI to show pending state
    this.updatePendingState(detail.vintageId, detail.operation, true);
    
    // Show toast notification
    this.showToast(`Updating ${detail.operation}...`, 'info');
  }

  /**
   * Handle rollback event
   */
  handleRollback(detail) {
    console.log('Rollback:', detail);
    
    // Update UI to show error state
    this.updatePendingState(detail.vintageId, detail.operation, false);
    
    // Show error toast
    this.showToast(`Failed to ${detail.operation}: ${detail.error.message}`, 'error');
    
    // Restore original state
    this.restoreOriginalState(detail.vintageId, detail.originalState);
  }

  /**
   * Handle confirmed event
   */
  handleConfirmed(detail) {
    console.log('Confirmed:', detail);
    
    // Update UI to show success state
    this.updatePendingState(detail.vintageId, detail.operation, false);
    
    // Show success toast
    this.showToast(`${detail.operation} completed successfully`, 'success');
  }

  /**
   * Handle loading start
   */
  handleLoadingStart(detail) {
    this.showLoadingIndicator(detail.vintageId, detail.operation);
  }

  /**
   * Handle loading end
   */
  handleLoadingEnd(detail) {
    this.hideLoadingIndicator(detail.vintageId);
  }

  /**
   * Handle stock update
   */
  handleStockUpdate(detail) {
    this.updateStockDisplay(detail.vintageId, detail.quantityChange, detail.location);
  }

  /**
   * Handle reserved update
   */
  handleReservedUpdate(detail) {
    this.updateReservedDisplay(detail.vintageId, detail.quantityChange);
  }

  /**
   * Update pending state in UI
   */
  updatePendingState(vintageId, operation, isPending) {
    const element = document.querySelector(`[data-vintage-id="${vintageId}"]`);
    if (!element) return;

    const pendingIndicator = element.querySelector('.pending-indicator');
    if (pendingIndicator) {
      pendingIndicator.style.display = isPending ? 'block' : 'none';
    }

    const buttons = element.querySelectorAll('button');
    buttons.forEach(button => {
      button.disabled = isPending;
    });

    if (isPending) {
      element.classList.add('pending-operation');
    } else {
      element.classList.remove('pending-operation');
    }
  }

  /**
   * Show loading indicator
   */
  showLoadingIndicator(vintageId, operation) {
    const element = document.querySelector(`[data-vintage-id="${vintageId}"]`);
    if (!element) return;

    let indicator = element.querySelector('.loading-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'loading-indicator';
      indicator.innerHTML = `
        <div class="spinner"></div>
        <span>${operation}...</span>
      `;
      element.appendChild(indicator);
    }

    indicator.style.display = 'block';
  }

  /**
   * Hide loading indicator
   */
  hideLoadingIndicator(vintageId) {
    const element = document.querySelector(`[data-vintage-id="${vintageId}"]`);
    if (!element) return;

    const indicator = element.querySelector('.loading-indicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  /**
   * Update stock display
   */
  updateStockDisplay(vintageId, quantityChange, location = null) {
    const element = document.querySelector(`[data-vintage-id="${vintageId}"]`);
    if (!element) return;

    const stockDisplay = element.querySelector('.stock-quantity');
    if (stockDisplay) {
      const currentQuantity = parseInt(stockDisplay.textContent) || 0;
      const newQuantity = currentQuantity + quantityChange;
      stockDisplay.textContent = newQuantity;
      
      // Add visual feedback
      stockDisplay.classList.add('updated');
      setTimeout(() => {
        stockDisplay.classList.remove('updated');
      }, 1000);
    }
  }

  /**
   * Update reserved display
   */
  updateReservedDisplay(vintageId, quantityChange) {
    const element = document.querySelector(`[data-vintage-id="${vintageId}"]`);
    if (!element) return;

    const reservedDisplay = element.querySelector('.reserved-quantity');
    if (reservedDisplay) {
      const currentReserved = parseInt(reservedDisplay.textContent) || 0;
      const newReserved = currentReserved + quantityChange;
      reservedDisplay.textContent = newReserved;
      
      // Add visual feedback
      reservedDisplay.classList.add('updated');
      setTimeout(() => {
        reservedDisplay.classList.remove('updated');
      }, 1000);
    }
  }

  /**
   * Restore original state
   */
  restoreOriginalState(vintageId, originalState) {
    const element = document.querySelector(`[data-vintage-id="${vintageId}"]`);
    if (!element) return;

    // Restore stock levels
    if (originalState.stockLevels) {
      const stockDisplay = element.querySelector('.stock-quantity');
      if (stockDisplay) {
        stockDisplay.textContent = originalState.stockLevels.quantity;
      }

      const reservedDisplay = element.querySelector('.reserved-quantity');
      if (reservedDisplay) {
        reservedDisplay.textContent = originalState.stockLevels.reserved;
      }
    }

    // Add rollback visual feedback
    element.classList.add('rollback');
    setTimeout(() => {
      element.classList.remove('rollback');
    }, 2000);
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);
    
    // Remove after delay
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }

  /**
   * Create inventory item HTML
   */
  createInventoryItemHTML(item) {
    return `
      <div class="inventory-item" data-vintage-id="${item.vintage_id}">
        <div class="item-header">
          <h3 class="wine-name">${item.wine_name}</h3>
          <span class="vintage-year">${item.year}</span>
        </div>
        
        <div class="item-details">
          <div class="producer">${item.producer}</div>
          <div class="region">${item.region}</div>
          <div class="location">${item.location}</div>
        </div>
        
        <div class="stock-info">
          <div class="stock-quantity">${item.quantity}</div>
          <div class="reserved-quantity">${item.reserved_quantity || 0}</div>
          <div class="available-quantity">${item.quantity - (item.reserved_quantity || 0)}</div>
        </div>
        
        <div class="item-actions">
          <button class="consume-btn" data-action="consume" data-vintage-id="${item.vintage_id}">
            Consume
          </button>
          <button class="receive-btn" data-action="receive" data-vintage-id="${item.vintage_id}">
            Receive
          </button>
          <button class="move-btn" data-action="move" data-vintage-id="${item.vintage_id}">
            Move
          </button>
          <button class="reserve-btn" data-action="reserve" data-vintage-id="${item.vintage_id}">
            Reserve
          </button>
        </div>
        
        <div class="pending-indicator" style="display: none;">
          <span>Pending...</span>
        </div>
      </div>
    `;
  }

  /**
   * Setup action handlers
   */
  setupActionHandlers() {
    if (typeof document === 'undefined') return;

    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;

      const action = button.dataset.action;
      const vintageId = button.dataset.vintageId;

      switch (action) {
        case 'consume':
          this.handleConsumeAction(vintageId);
          break;
        case 'receive':
          this.handleReceiveAction(vintageId);
          break;
        case 'move':
          this.handleMoveAction(vintageId);
          break;
        case 'reserve':
          this.handleReserveAction(vintageId);
          break;
      }
    });
  }

  /**
   * Handle consume action
   */
  async handleConsumeAction(vintageId) {
    const quantity = prompt('Enter quantity to consume:');
    if (!quantity || isNaN(quantity)) return;

    const location = prompt('Enter location:') || 'main-cellar';
    const notes = prompt('Enter notes (optional):') || '';

    try {
      await this.inventoryManager.consumeWine(
        vintageId, 
        location, 
        parseInt(quantity), 
        notes
      );
    } catch (error) {
      console.error('Consume failed:', error);
    }
  }

  /**
   * Handle receive action
   */
  async handleReceiveAction(vintageId) {
    const quantity = prompt('Enter quantity to receive:');
    if (!quantity || isNaN(quantity)) return;

    const location = prompt('Enter location:') || 'main-cellar';
    const unitCost = prompt('Enter unit cost (optional):') || null;
    const notes = prompt('Enter notes (optional):') || '';

    try {
      await this.inventoryManager.receiveWine(
        vintageId, 
        location, 
        parseInt(quantity), 
        unitCost ? parseFloat(unitCost) : null,
        '', 
        notes
      );
    } catch (error) {
      console.error('Receive failed:', error);
    }
  }

  /**
   * Handle move action
   */
  async handleMoveAction(vintageId) {
    const quantity = prompt('Enter quantity to move:');
    if (!quantity || isNaN(quantity)) return;

    const fromLocation = prompt('Enter source location:') || 'main-cellar';
    const toLocation = prompt('Enter destination location:') || 'service-bar';
    const notes = prompt('Enter notes (optional):') || '';

    try {
      await this.inventoryManager.moveWine(
        vintageId, 
        fromLocation, 
        toLocation, 
        parseInt(quantity), 
        notes
      );
    } catch (error) {
      console.error('Move failed:', error);
    }
  }

  /**
   * Handle reserve action
   */
  async handleReserveAction(vintageId) {
    const quantity = prompt('Enter quantity to reserve:');
    if (!quantity || isNaN(quantity)) return;

    const location = prompt('Enter location:') || 'main-cellar';
    const notes = prompt('Enter notes (optional):') || '';

    try {
      await this.inventoryManager.reserveWine(
        vintageId, 
        location, 
        parseInt(quantity), 
        notes
      );
    } catch (error) {
      console.error('Reserve failed:', error);
    }
  }

  /**
   * Render inventory list
   */
  async renderInventoryList(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
      const response = await this.inventoryManager.getInventoryStock();
      const items = response.data || response;

      container.innerHTML = items.map(item => 
        this.createInventoryItemHTML(item)
      ).join('');
    } catch (error) {
      console.error('Failed to load inventory:', error);
      container.innerHTML = '<div class="error">Failed to load inventory</div>';
    }
  }

  /**
   * Initialize the UI
   */
  init() {
    this.setupActionHandlers();
    
    // Render initial inventory list if container exists
    const container = document.getElementById('inventory-list');
    if (container) {
      this.renderInventoryList('inventory-list');
    }
  }
}

// Create and export singleton instance
export const inventoryUI = new InventoryUI(window.inventoryManager || null);

// Auto-initialize if in browser environment
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    inventoryUI.init();
  });
}