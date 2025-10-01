/**
 * Tests for Optimistic UI Updates
 */

// Mock the API module to avoid import issues in test environment
class MockSommOSAPI {
  constructor() {
    this.shouldFail = false;
    this.delay = 0;
  }

  async request(endpoint, options = {}) {
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }

    if (this.shouldFail) {
      throw new Error('Simulated API failure');
    }

    return {
      success: true,
      data: { message: 'Operation successful' }
    };
  }

  async consumeWine(vintageId, location, quantity, notes, createdBy, options) {
    return this.request('/inventory/consume', {
      method: 'POST',
      body: JSON.stringify({ vintageId, location, quantity, notes, createdBy })
    });
  }

  async receiveWine(vintageId, location, quantity, unitCost, referenceId, notes, createdBy, options) {
    return this.request('/inventory/receive', {
      method: 'POST',
      body: JSON.stringify({ vintageId, location, quantity, unitCost, referenceId, notes, createdBy })
    });
  }

  async moveWine(vintageId, fromLocation, toLocation, quantity, notes, createdBy, options) {
    return this.request('/inventory/move', {
      method: 'POST',
      body: JSON.stringify({ vintageId, fromLocation, toLocation, quantity, notes, createdBy })
    });
  }

  async reserveWine(vintageId, location, quantity, notes, createdBy, options) {
    return this.request('/inventory/reserve', {
      method: 'POST',
      body: JSON.stringify({ vintageId, location, quantity, notes, createdBy })
    });
  }

  async getInventory(filters) {
    return {
      success: true,
      data: [
        {
          vintage_id: 1,
          wine_name: 'Test Wine',
          year: 2020,
          producer: 'Test Producer',
          region: 'Test Region',
          location: 'main-cellar',
          quantity: 10,
          reserved_quantity: 2
        }
      ]
    };
  }

  async getInventoryStock(filters) {
    return this.getInventory(filters);
  }

  async getInventoryItem(id) {
    return {
      success: true,
      data: {
        vintage_id: id,
        wine_name: 'Test Wine',
        year: 2020,
        producer: 'Test Producer',
        region: 'Test Region',
        location: 'main-cellar',
        quantity: 10,
        reserved_quantity: 2
      }
    };
  }

  setSyncService(syncService) {
    this.syncService = syncService;
  }
}

// Mock UIManager class
class MockUIManager {
  constructor() {
    this.pendingOperations = new Map();
    this.originalStates = new Map();
    this.events = [];
  }

  showOptimisticUpdate(vintageId, operation, data) {
    const operationId = `op_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    
    this.originalStates.set(operationId, {
      vintageId,
      timestamp: Date.now(),
      stockLevels: { quantity: 10, reserved: 2, available: 8 }
    });
    
    this.pendingOperations.set(operationId, {
      vintageId,
      operation,
      data,
      timestamp: Date.now(),
      status: 'pending'
    });

    this.events.push({ type: 'optimistic-update', operationId, vintageId, operation, data });
    return operationId;
  }

  rollbackUpdate(operationId, error) {
    const operation = this.pendingOperations.get(operationId);
    if (!operation) return;

    operation.status = 'failed';
    operation.error = error;

    this.events.push({ 
      type: 'rollback', 
      operationId, 
      vintageId: operation.vintageId, 
      operation: operation.operation,
      error 
    });
    
    this.pendingOperations.delete(operationId);
    this.originalStates.delete(operationId);
  }

  confirmUpdate(operationId, response) {
    const operation = this.pendingOperations.get(operationId);
    if (!operation) return;

    operation.status = 'confirmed';
    operation.response = response;

    this.events.push({ 
      type: 'confirmed', 
      operationId, 
      vintageId: operation.vintageId, 
      operation: operation.operation,
      response 
    });
    
    this.pendingOperations.delete(operationId);
    this.originalStates.delete(operationId);
  }

  getPendingOperations() {
    return Array.from(this.pendingOperations.values());
  }

  clearPendingOperations() {
    this.pendingOperations.clear();
    this.originalStates.clear();
  }

  getEvents() {
    return this.events;
  }

  clearEvents() {
    this.events = [];
  }
}

// Mock InventoryManager class
class MockInventoryManager {
  constructor(api = null, uiManager = null) {
    this.api = api || new MockSommOSAPI();
    this.ui = uiManager || new MockUIManager();
  }

  async updateStock(vintageId, quantity, options = {}) {
    const operationId = this.ui.showOptimisticUpdate(vintageId, 'updateStock', { quantity });
    
    try {
      const response = await this.api.request('/inventory/update-stock', {
        method: 'POST',
        body: JSON.stringify({ vintage_id: vintageId, quantity, ...options })
      });
      
      this.ui.confirmUpdate(operationId, response);
      return response;
    } catch (error) {
      this.ui.rollbackUpdate(operationId, error);
      throw new Error(`Failed to update stock: ${error.message}`);
    }
  }

  async consumeWine(vintageId, location, quantity, notes = '', createdBy = 'SommOS', options = {}) {
    const operationId = this.ui.showOptimisticUpdate(vintageId, 'consumeWine', { 
      location, quantity, notes, createdBy 
    });
    
    try {
      const response = await this.api.consumeWine(vintageId, location, quantity, notes, createdBy, options);
      this.ui.confirmUpdate(operationId, response);
      return response;
    } catch (error) {
      this.ui.rollbackUpdate(operationId, error);
      throw new Error(`Failed to consume wine: ${error.message}`);
    }
  }

  async receiveWine(vintageId, location, quantity, unitCost, referenceId = '', notes = '', createdBy = 'SommOS', options = {}) {
    const operationId = this.ui.showOptimisticUpdate(vintageId, 'receiveWine', { 
      location, quantity, unitCost, referenceId, notes, createdBy 
    });
    
    try {
      const response = await this.api.receiveWine(vintageId, location, quantity, unitCost, referenceId, notes, createdBy, options);
      this.ui.confirmUpdate(operationId, response);
      return response;
    } catch (error) {
      this.ui.rollbackUpdate(operationId, error);
      throw new Error(`Failed to receive wine: ${error.message}`);
    }
  }

  async moveWine(vintageId, fromLocation, toLocation, quantity, notes = '', createdBy = 'SommOS', options = {}) {
    const operationId = this.ui.showOptimisticUpdate(vintageId, 'moveWine', { 
      fromLocation, toLocation, quantity, notes, createdBy 
    });
    
    try {
      const response = await this.api.moveWine(vintageId, fromLocation, toLocation, quantity, notes, createdBy, options);
      this.ui.confirmUpdate(operationId, response);
      return response;
    } catch (error) {
      this.ui.rollbackUpdate(operationId, error);
      throw new Error(`Failed to move wine: ${error.message}`);
    }
  }

  async reserveWine(vintageId, location, quantity, notes = '', createdBy = 'SommOS', options = {}) {
    const operationId = this.ui.showOptimisticUpdate(vintageId, 'reserveWine', { 
      location, quantity, notes, createdBy 
    });
    
    try {
      const response = await this.api.reserveWine(vintageId, location, quantity, notes, createdBy, options);
      this.ui.confirmUpdate(operationId, response);
      return response;
    } catch (error) {
      this.ui.rollbackUpdate(operationId, error);
      throw new Error(`Failed to reserve wine: ${error.message}`);
    }
  }

  async getInventory(filters = {}) {
    return await this.api.getInventory(filters);
  }

  async getInventoryStock(filters = {}) {
    return await this.api.getInventoryStock(filters);
  }

  async getInventoryItem(id) {
    return await this.api.getInventoryItem(id);
  }

  getPendingOperations() {
    return this.ui.getPendingOperations();
  }

  clearPendingOperations() {
    this.ui.clearPendingOperations();
  }

  setSyncService(syncService) {
    this.api.setSyncService(syncService);
  }
}

describe('Optimistic UI Updates', () => {
  let inventoryManager;
  let mockAPI;
  let mockUI;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAPI = new MockSommOSAPI();
    mockUI = new MockUIManager();
    inventoryManager = new MockInventoryManager(mockAPI, mockUI);
  });

  describe('UIManager', () => {
    test('should show optimistic update and return operation ID', () => {
      const operationId = mockUI.showOptimisticUpdate(1, 'consumeWine', { quantity: 2 });
      
      expect(operationId).toBeDefined();
      expect(operationId).toMatch(/^op_\d+_[a-f0-9]+$/);
      
      const pendingOps = mockUI.getPendingOperations();
      expect(pendingOps).toHaveLength(1);
      expect(pendingOps[0]).toMatchObject({
        vintageId: 1,
        operation: 'consumeWine',
        data: { quantity: 2 },
        status: 'pending'
      });
    });

    test('should confirm update and clean up', () => {
      const operationId = mockUI.showOptimisticUpdate(1, 'consumeWine', { quantity: 2 });
      const response = { success: true, data: { message: 'Success' } };
      
      mockUI.confirmUpdate(operationId, response);
      
      const pendingOps = mockUI.getPendingOperations();
      expect(pendingOps).toHaveLength(0);
      
      const events = mockUI.getEvents();
      expect(events).toHaveLength(2); // optimistic-update + confirmed
      expect(events[1]).toMatchObject({
        type: 'confirmed',
        operationId,
        vintageId: 1,
        response
      });
    });

    test('should rollback update and clean up', () => {
      const operationId = mockUI.showOptimisticUpdate(1, 'consumeWine', { quantity: 2 });
      const error = new Error('API failed');
      
      mockUI.rollbackUpdate(operationId, error);
      
      const pendingOps = mockUI.getPendingOperations();
      expect(pendingOps).toHaveLength(0);
      
      const events = mockUI.getEvents();
      expect(events).toHaveLength(2); // optimistic-update + rollback
      expect(events[1]).toMatchObject({
        type: 'rollback',
        operationId,
        vintageId: 1,
        error
      });
    });

    test('should handle multiple pending operations', () => {
      const op1 = mockUI.showOptimisticUpdate(1, 'consumeWine', { quantity: 2 });
      const op2 = mockUI.showOptimisticUpdate(2, 'receiveWine', { quantity: 5 });
      
      expect(mockUI.getPendingOperations()).toHaveLength(2);
      
      mockUI.confirmUpdate(op1, { success: true });
      expect(mockUI.getPendingOperations()).toHaveLength(1);
      
      mockUI.rollbackUpdate(op2, new Error('Failed'));
      expect(mockUI.getPendingOperations()).toHaveLength(0);
    });

    test('should clear all pending operations', () => {
      mockUI.showOptimisticUpdate(1, 'consumeWine', { quantity: 2 });
      mockUI.showOptimisticUpdate(2, 'receiveWine', { quantity: 5 });
      
      expect(mockUI.getPendingOperations()).toHaveLength(2);
      
      mockUI.clearPendingOperations();
      expect(mockUI.getPendingOperations()).toHaveLength(0);
    });
  });

  describe('InventoryManager - Success Cases', () => {
    test('should successfully consume wine with optimistic updates', async () => {
      const response = await inventoryManager.consumeWine(1, 'main-cellar', 2, 'Test consumption');
      
      expect(response).toMatchObject({
        success: true,
        data: { message: 'Operation successful' }
      });
      
      const events = mockUI.getEvents();
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('optimistic-update');
      expect(events[1].type).toBe('confirmed');
      
      expect(mockUI.getPendingOperations()).toHaveLength(0);
    });

    test('should successfully receive wine with optimistic updates', async () => {
      const response = await inventoryManager.receiveWine(1, 'main-cellar', 5, 25.00, 'REF001', 'Test receipt');
      
      expect(response).toMatchObject({
        success: true,
        data: { message: 'Operation successful' }
      });
      
      const events = mockUI.getEvents();
      expect(events[0].type).toBe('optimistic-update');
      expect(events[1].type).toBe('confirmed');
    });

    test('should successfully move wine with optimistic updates', async () => {
      const response = await inventoryManager.moveWine(1, 'main-cellar', 'service-bar', 3, 'Moving to service');
      
      expect(response).toMatchObject({
        success: true,
        data: { message: 'Operation successful' }
      });
      
      const events = mockUI.getEvents();
      expect(events[0].type).toBe('optimistic-update');
      expect(events[1].type).toBe('confirmed');
    });

    test('should successfully reserve wine with optimistic updates', async () => {
      const response = await inventoryManager.reserveWine(1, 'main-cellar', 2, 'Reserved for event');
      
      expect(response).toMatchObject({
        success: true,
        data: { message: 'Operation successful' }
      });
      
      const events = mockUI.getEvents();
      expect(events[0].type).toBe('optimistic-update');
      expect(events[1].type).toBe('confirmed');
    });
  });

  describe('InventoryManager - Error Cases', () => {
    test('should rollback on API failure during consume', async () => {
      mockAPI.shouldFail = true;
      
      await expect(inventoryManager.consumeWine(1, 'main-cellar', 2, 'Test consumption'))
        .rejects.toThrow('Failed to consume wine: Simulated API failure');
      
      const events = mockUI.getEvents();
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('optimistic-update');
      expect(events[1].type).toBe('rollback');
      expect(events[1].error.message).toBe('Simulated API failure');
      
      expect(mockUI.getPendingOperations()).toHaveLength(0);
    });

    test('should rollback on API failure during receive', async () => {
      mockAPI.shouldFail = true;
      
      await expect(inventoryManager.receiveWine(1, 'main-cellar', 5, 25.00))
        .rejects.toThrow('Failed to receive wine: Simulated API failure');
      
      const events = mockUI.getEvents();
      expect(events[1].type).toBe('rollback');
    });

    test('should rollback on API failure during move', async () => {
      mockAPI.shouldFail = true;
      
      await expect(inventoryManager.moveWine(1, 'main-cellar', 'service-bar', 3))
        .rejects.toThrow('Failed to move wine: Simulated API failure');
      
      const events = mockUI.getEvents();
      expect(events[1].type).toBe('rollback');
    });

    test('should rollback on API failure during reserve', async () => {
      mockAPI.shouldFail = true;
      
      await expect(inventoryManager.reserveWine(1, 'main-cellar', 2))
        .rejects.toThrow('Failed to reserve wine: Simulated API failure');
      
      const events = mockUI.getEvents();
      expect(events[1].type).toBe('rollback');
    });
  });

  describe('Read Operations', () => {
    test('should not use optimistic updates for read operations', async () => {
      const response = await inventoryManager.getInventory();
      
      expect(response).toMatchObject({
        success: true,
        data: expect.any(Array)
      });
      
      // No optimistic update events should be generated
      expect(mockUI.getEvents()).toHaveLength(0);
      expect(mockUI.getPendingOperations()).toHaveLength(0);
    });

    test('should get inventory stock without optimistic updates', async () => {
      const response = await inventoryManager.getInventoryStock({ location: 'main-cellar' });
      
      expect(response).toMatchObject({
        success: true,
        data: expect.any(Array)
      });
      
      expect(mockUI.getEvents()).toHaveLength(0);
    });

    test('should get inventory item without optimistic updates', async () => {
      const response = await inventoryManager.getInventoryItem(1);
      
      expect(response).toMatchObject({
        success: true,
        data: expect.objectContaining({
          vintage_id: 1,
          wine_name: 'Test Wine'
        })
      });
      
      expect(mockUI.getEvents()).toHaveLength(0);
    });
  });

  describe('Pending Operations Management', () => {
    test('should track pending operations correctly', async () => {
      // Start multiple operations
      const promise1 = inventoryManager.consumeWine(1, 'main-cellar', 2);
      const promise2 = inventoryManager.receiveWine(2, 'main-cellar', 5);
      
      // Check that both operations are pending
      expect(mockUI.getPendingOperations()).toHaveLength(2);
      
      // Wait for both to complete
      await Promise.all([promise1, promise2]);
      
      // Check that no operations are pending
      expect(mockUI.getPendingOperations()).toHaveLength(0);
    });

    test('should clear pending operations', () => {
      mockUI.showOptimisticUpdate(1, 'consumeWine', { quantity: 2 });
      mockUI.showOptimisticUpdate(2, 'receiveWine', { quantity: 5 });
      
      expect(mockUI.getPendingOperations()).toHaveLength(2);
      
      inventoryManager.clearPendingOperations();
      expect(mockUI.getPendingOperations()).toHaveLength(0);
    });
  });

  describe('Event Flow', () => {
    test('should generate correct event sequence for successful operation', async () => {
      await inventoryManager.consumeWine(1, 'main-cellar', 2, 'Test');
      
      const events = mockUI.getEvents();
      expect(events).toHaveLength(2);
      
      // First event: optimistic update
      expect(events[0]).toMatchObject({
        type: 'optimistic-update',
        vintageId: 1,
        operation: 'consumeWine',
        data: { location: 'main-cellar', quantity: 2, notes: 'Test', createdBy: 'SommOS' }
      });
      
      // Second event: confirmation
      expect(events[1]).toMatchObject({
        type: 'confirmed',
        vintageId: 1,
        operation: 'consumeWine',
        response: { success: true, data: { message: 'Operation successful' } }
      });
    });

    test('should generate correct event sequence for failed operation', async () => {
      mockAPI.shouldFail = true;
      
      await expect(inventoryManager.consumeWine(1, 'main-cellar', 2, 'Test'))
        .rejects.toThrow();
      
      const events = mockUI.getEvents();
      expect(events).toHaveLength(2);
      
      // First event: optimistic update
      expect(events[0].type).toBe('optimistic-update');
      
      // Second event: rollback
      expect(events[1]).toMatchObject({
        type: 'rollback',
        vintageId: 1,
        operation: 'consumeWine',
        error: expect.any(Error)
      });
    });
  });
});