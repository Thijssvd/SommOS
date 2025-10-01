/**
 * SommOS Inventory Manager with Optimistic UI Updates
 * Provides immediate UI feedback while API calls are in progress
 */

import { SommOSAPI } from './api.js';

export class OptimisticUIError extends Error {
  constructor(message, { operation, originalError, rollbackData } = {}) {
    super(message);
    this.name = 'OptimisticUIError';
    this.operation = operation;
    this.originalError = originalError;
    this.rollbackData = rollbackData;
  }
}

export class UIManager {
  constructor() {
    this.pendingOperations = new Map();
    this.originalStates = new Map();
    this.eventListeners = new Map();
  }

  /**
   * Show optimistic update in the UI
   */
  showOptimisticUpdate(vintageId, operation, data) {
    const operationId = this.generateOperationId();
    const timestamp = Date.now();
    
    // Store original state for potential rollback
    const originalState = this.captureCurrentState(vintageId);
    this.originalStates.set(operationId, originalState);
    
    // Store operation details
    this.pendingOperations.set(operationId, {
      vintageId,
      operation,
      data,
      timestamp,
      status: 'pending'
    });

    // Apply optimistic update to UI
    this.applyOptimisticUpdate(vintageId, operation, data);
    
    // Dispatch event for UI components to listen to
    this.dispatchEvent('optimistic-update', {
      operationId,
      vintageId,
      operation,
      data,
      timestamp
    });

    return operationId;
  }

  /**
   * Rollback optimistic update on error
   */
  rollbackUpdate(operationId, error) {
    const operation = this.pendingOperations.get(operationId);
    if (!operation) {
      console.warn(`No operation found for rollback: ${operationId}`);
      return;
    }

    const originalState = this.originalStates.get(operationId);
    if (!originalState) {
      console.warn(`No original state found for rollback: ${operationId}`);
      return;
    }

    // Restore original state
    this.restoreState(operation.vintageId, originalState);
    
    // Update operation status
    operation.status = 'failed';
    operation.error = error;

    // Dispatch rollback event
    this.dispatchEvent('rollback', {
      operationId,
      vintageId: operation.vintageId,
      operation: operation.operation,
      error,
      originalState
    });

    // Clean up
    this.pendingOperations.delete(operationId);
    this.originalStates.delete(operationId);
  }

  /**
   * Confirm optimistic update on success
   */
  confirmUpdate(operationId, response) {
    const operation = this.pendingOperations.get(operationId);
    if (!operation) {
      console.warn(`No operation found for confirmation: ${operationId}`);
      return;
    }

    // Update operation status
    operation.status = 'confirmed';
    operation.response = response;

    // Dispatch confirmation event
    this.dispatchEvent('confirmed', {
      operationId,
      vintageId: operation.vintageId,
      operation: operation.operation,
      response
    });

    // Clean up
    this.pendingOperations.delete(operationId);
    this.originalStates.delete(operationId);
  }

  /**
   * Capture current state of a vintage for rollback
   */
  captureCurrentState(vintageId) {
    // This would typically capture the current DOM state or data state
    // For now, we'll return a placeholder that can be extended
    return {
      vintageId,
      timestamp: Date.now(),
      // Add specific state capture logic here
      stockLevels: this.getCurrentStockLevels(vintageId),
      uiElements: this.captureUIElements(vintageId)
    };
  }

  /**
   * Apply optimistic update to UI
   */
  applyOptimisticUpdate(vintageId, operation, data) {
    switch (operation) {
      case 'updateStock':
        this.updateStockDisplay(vintageId, data.quantity);
        break;
      case 'consumeWine':
        this.updateStockDisplay(vintageId, -data.quantity);
        break;
      case 'receiveWine':
        this.updateStockDisplay(vintageId, data.quantity);
        break;
      case 'moveWine':
        this.updateStockDisplay(vintageId, -data.quantity, data.fromLocation);
        this.updateStockDisplay(vintageId, data.quantity, data.toLocation);
        break;
      case 'reserveWine':
        this.updateReservedDisplay(vintageId, data.quantity);
        break;
      default:
        console.warn(`Unknown operation for optimistic update: ${operation}`);
    }

    // Show loading indicator
    this.showLoadingIndicator(vintageId, operation);
  }

  /**
   * Restore state after rollback
   */
  restoreState(vintageId, originalState) {
    // Restore stock levels
    if (originalState.stockLevels) {
      this.restoreStockLevels(vintageId, originalState.stockLevels);
    }

    // Restore UI elements
    if (originalState.uiElements) {
      this.restoreUIElements(vintageId, originalState.uiElements);
    }

    // Hide loading indicator
    this.hideLoadingIndicator(vintageId);
  }

  /**
   * Get current stock levels for a vintage
   */
  getCurrentStockLevels(vintageId) {
    // This would typically read from the current UI state
    // For now, return a placeholder
    return {
      quantity: 0,
      reserved: 0,
      available: 0
    };
  }

  /**
   * Capture UI elements for rollback
   */
  captureUIElements(vintageId) {
    // This would capture the current state of UI elements
    // For now, return a placeholder
    return {
      stockDisplay: null,
      buttons: null,
      indicators: null
    };
  }

  /**
   * Update stock display in UI
   */
  updateStockDisplay(vintageId, quantityChange, location = null) {
    // This would update the actual UI elements
    // For now, dispatch an event for components to handle
    this.dispatchEvent('stock-update', {
      vintageId,
      quantityChange,
      location,
      timestamp: Date.now()
    });
  }

  /**
   * Update reserved display in UI
   */
  updateReservedDisplay(vintageId, quantityChange) {
    this.dispatchEvent('reserved-update', {
      vintageId,
      quantityChange,
      timestamp: Date.now()
    });
  }

  /**
   * Show loading indicator
   */
  showLoadingIndicator(vintageId, operation) {
    this.dispatchEvent('loading-start', {
      vintageId,
      operation,
      timestamp: Date.now()
    });
  }

  /**
   * Hide loading indicator
   */
  hideLoadingIndicator(vintageId) {
    this.dispatchEvent('loading-end', {
      vintageId,
      timestamp: Date.now()
    });
  }

  /**
   * Restore stock levels
   */
  restoreStockLevels(vintageId, stockLevels) {
    this.dispatchEvent('stock-restore', {
      vintageId,
      stockLevels,
      timestamp: Date.now()
    });
  }

  /**
   * Restore UI elements
   */
  restoreUIElements(vintageId, uiElements) {
    this.dispatchEvent('ui-restore', {
      vintageId,
      uiElements,
      timestamp: Date.now()
    });
  }

  /**
   * Dispatch custom event
   */
  dispatchEvent(eventType, detail) {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      const event = new CustomEvent(`inventory:${eventType}`, { detail });
      window.dispatchEvent(event);
    }
  }

  /**
   * Generate unique operation ID
   */
  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  /**
   * Get pending operations
   */
  getPendingOperations() {
    return Array.from(this.pendingOperations.values());
  }

  /**
   * Clear all pending operations (for cleanup)
   */
  clearPendingOperations() {
    this.pendingOperations.clear();
    this.originalStates.clear();
  }
}

export class InventoryManager {
  constructor(api = null, uiManager = null) {
    this.api = api || new SommOSAPI();
    this.ui = uiManager || new UIManager();
  }

  /**
   * Update stock with optimistic UI
   */
  async updateStock(vintageId, quantity, options = {}) {
    const operationId = this.ui.showOptimisticUpdate(vintageId, 'updateStock', { quantity });
    
    try {
      const response = await this.api.request('/inventory/update-stock', {
        method: 'POST',
        body: JSON.stringify({
          vintage_id: vintageId,
          quantity,
          ...options
        })
      });
      
      this.ui.confirmUpdate(operationId, response);
      return response;
    } catch (error) {
      this.ui.rollbackUpdate(operationId, error);
      throw new OptimisticUIError('Failed to update stock', {
        operation: 'updateStock',
        originalError: error,
        rollbackData: { vintageId, quantity }
      });
    }
  }

  /**
   * Consume wine with optimistic UI
   */
  async consumeWine(vintageId, location, quantity, notes = '', createdBy = 'SommOS', options = {}) {
    const operationId = this.ui.showOptimisticUpdate(vintageId, 'consumeWine', { 
      location, 
      quantity, 
      notes, 
      createdBy 
    });
    
    try {
      const response = await this.api.consumeWine(vintageId, location, quantity, notes, createdBy, options);
      this.ui.confirmUpdate(operationId, response);
      return response;
    } catch (error) {
      this.ui.rollbackUpdate(operationId, error);
      throw new OptimisticUIError('Failed to consume wine', {
        operation: 'consumeWine',
        originalError: error,
        rollbackData: { vintageId, location, quantity }
      });
    }
  }

  /**
   * Receive wine with optimistic UI
   */
  async receiveWine(vintageId, location, quantity, unitCost, referenceId = '', notes = '', createdBy = 'SommOS', options = {}) {
    const operationId = this.ui.showOptimisticUpdate(vintageId, 'receiveWine', { 
      location, 
      quantity, 
      unitCost, 
      referenceId, 
      notes, 
      createdBy 
    });
    
    try {
      const response = await this.api.receiveWine(vintageId, location, quantity, unitCost, referenceId, notes, createdBy, options);
      this.ui.confirmUpdate(operationId, response);
      return response;
    } catch (error) {
      this.ui.rollbackUpdate(operationId, error);
      throw new OptimisticUIError('Failed to receive wine', {
        operation: 'receiveWine',
        originalError: error,
        rollbackData: { vintageId, location, quantity }
      });
    }
  }

  /**
   * Move wine with optimistic UI
   */
  async moveWine(vintageId, fromLocation, toLocation, quantity, notes = '', createdBy = 'SommOS', options = {}) {
    const operationId = this.ui.showOptimisticUpdate(vintageId, 'moveWine', { 
      fromLocation, 
      toLocation, 
      quantity, 
      notes, 
      createdBy 
    });
    
    try {
      const response = await this.api.moveWine(vintageId, fromLocation, toLocation, quantity, notes, createdBy, options);
      this.ui.confirmUpdate(operationId, response);
      return response;
    } catch (error) {
      this.ui.rollbackUpdate(operationId, error);
      throw new OptimisticUIError('Failed to move wine', {
        operation: 'moveWine',
        originalError: error,
        rollbackData: { vintageId, fromLocation, toLocation, quantity }
      });
    }
  }

  /**
   * Reserve wine with optimistic UI
   */
  async reserveWine(vintageId, location, quantity, notes = '', createdBy = 'SommOS', options = {}) {
    const operationId = this.ui.showOptimisticUpdate(vintageId, 'reserveWine', { 
      location, 
      quantity, 
      notes, 
      createdBy 
    });
    
    try {
      const response = await this.api.reserveWine(vintageId, location, quantity, notes, createdBy, options);
      this.ui.confirmUpdate(operationId, response);
      return response;
    } catch (error) {
      this.ui.rollbackUpdate(operationId, error);
      throw new OptimisticUIError('Failed to reserve wine', {
        operation: 'reserveWine',
        originalError: error,
        rollbackData: { vintageId, location, quantity }
      });
    }
  }

  /**
   * Get inventory data (no optimistic updates needed for read operations)
   */
  async getInventory(filters = {}) {
    return await this.api.getInventory(filters);
  }

  /**
   * Get inventory stock (no optimistic updates needed for read operations)
   */
  async getInventoryStock(filters = {}) {
    return await this.api.getInventoryStock(filters);
  }

  /**
   * Get inventory item (no optimistic updates needed for read operations)
   */
  async getInventoryItem(id) {
    return await this.api.getInventoryItem(id);
  }

  /**
   * Get pending operations for debugging/monitoring
   */
  getPendingOperations() {
    return this.ui.getPendingOperations();
  }

  /**
   * Clear all pending operations
   */
  clearPendingOperations() {
    this.ui.clearPendingOperations();
  }

  /**
   * Set sync service for offline support
   */
  setSyncService(syncService) {
    this.api.setSyncService(syncService);
  }
}

// Create singleton instances
export const uiManager = new UIManager();
export const inventoryManager = new InventoryManager();

// Export for global access
if (typeof window !== 'undefined') {
  window.InventoryManager = InventoryManager;
  window.UIManager = UIManager;
  window.OptimisticUIError = OptimisticUIError;
  window.inventoryManager = inventoryManager;
  window.uiManager = uiManager;
}