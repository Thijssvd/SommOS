// SommOS Main Application JavaScript
// Handles app initialization, navigation, and core functionality

import { SommOSAPI, SommOSAPIError } from './api.js';
import { SommOSUI, VirtualScroll } from './ui.js';
import { SommOSSyncService } from './sync.js';
import { RealTimeSync } from './realtime-sync.js';
import Chart from 'chart.js/auto';
import { DashboardModule } from './modules/dashboard.js';
import { InventoryModule } from './modules/inventory.js';
import { PairingModule } from './modules/pairing.js';
import { ProcurementModule } from './modules/procurement.js';
import { glossaryData, searchGlossary, getCategories } from './glossary-data.js';

export class SommOS {
    constructor() {
        this.currentView = 'dashboard';
        this.api = new SommOSAPI();
        this.syncService = new SommOSSyncService({ api: this.api });
        this.api.setSyncService(this.syncService);
        this.realtimeSync = new RealTimeSync({
            onInventoryUpdate: (update) => this.handleRealtimeInventoryUpdate(update),
            onInventoryAction: (action) => this.handleRealtimeInventoryAction(action),
            onSystemNotification: (notification) => this.handleRealtimeSystemNotification(notification),
            onConnect: () => this.handleRealtimeConnect(),
            onDisconnect: () => this.handleRealtimeDisconnect(),
            onError: (error) => this.handleRealtimeError(error)
        });
        this.ui = new SommOSUI();
        this.isOnline = navigator.onLine;
        this.currentUser = null;
        this.authDisabled = false;
        this.hasBootstrapped = false;
        this.authElements = {};
        this.sessionWarningShown = false;
        this.explanationsCache = new Map();
        this.memoriesCache = new Map();
        
        // Glossary state
        this.currentGlossaryCategory = 'all';
        this.glossarySearchQuery = '';
        
        // Virtual scroll instances for performance optimization
        this.inventoryVirtualScroll = null;
        this.catalogVirtualScroll = null;
        
        // Performance monitoring
        this.performanceMetrics = {
            inventory: { renderTime: 0, itemCount: 0, virtualScrollEnabled: false },
            catalog: { renderTime: 0, itemCount: 0, virtualScrollEnabled: false }
        };

        // Initialize modules
        this.modules = {
            dashboard: new DashboardModule(this),
            inventory: new InventoryModule(this),
            pairing: new PairingModule(this),
            procurement: new ProcurementModule(this)
        };
        
        this.init();
    }

    async init() {
        console.log('🍷 Initializing SommOS...');

        this.cacheRootElements();
        this.setupAuthHandlers();

        // Show loading screen
        this.showLoadingScreen();

        const authenticated = await this.initializeAuth();

        if (authenticated) {
            await this.bootstrapApplication();
        } else {
            this.hideLoadingScreen({ keepAppHidden: true });
        }

        console.log('✅ SommOS initialized successfully');
    }

    // Performance monitoring methods
    startPerformanceTimer() {
        return performance.now();
    }

    endPerformanceTimer(startTime, component, itemCount, virtualScrollEnabled = false) {
        const endTime = performance.now();
        const renderTime = endTime - startTime;
        
        this.performanceMetrics[component] = {
            renderTime: renderTime,
            itemCount: itemCount,
            virtualScrollEnabled: virtualScrollEnabled
        };
        
        console.log(`Performance: ${component} rendered ${itemCount} items in ${renderTime.toFixed(2)}ms (Virtual Scroll: ${virtualScrollEnabled ? 'ON' : 'OFF'})`);
        
        // Show performance toast for large lists
        if (itemCount > 100 && renderTime > 100) {
            const savings = virtualScrollEnabled ? ' (Virtual scrolling active)' : ' (Consider enabling virtual scrolling)';
            this.ui.showToast(`Rendered ${itemCount} items in ${renderTime.toFixed(0)}ms${savings}`, 'info', 3000);
        }
        
        return renderTime;
    }

    getPerformanceMetrics() {
        return this.performanceMetrics;
    }

    logPerformanceSummary() {
        console.group('SommOS Performance Summary');
        Object.entries(this.performanceMetrics).forEach(([component, metrics]) => {
            console.log(`${component}: ${metrics.itemCount} items, ${metrics.renderTime.toFixed(2)}ms, Virtual Scroll: ${metrics.virtualScrollEnabled ? 'ON' : 'OFF'}`);
        });
        console.groupEnd();
    }

    cacheRootElements() {
        this.loadingScreen = document.getElementById('loading-screen');
        this.appContainer = document.getElementById('app');
        this.authScreen = document.getElementById('auth-screen');
        this.guestBanner = document.getElementById('guest-session-banner');
        this.guestBannerClose = document.getElementById('close-guest-banner');
        this.guestSessionExpiry = document.getElementById('guest-session-expiry');
    }

    setupAuthHandlers() {
        this.authElements = {
            loginForm: document.getElementById('login-form'),
            loginEmail: document.getElementById('login-email'),
            loginPassword: document.getElementById('login-password'),
            loginError: document.getElementById('login-error'),
            loginSubmit: document.getElementById('login-submit'),
            logoutBtn: document.getElementById('logout-btn'),
            userRoleBadge: document.getElementById('user-role-badge'),
            userEmail: document.getElementById('user-email'),
            guestNotice: document.getElementById('guest-notice'),
            guestEventCode: document.getElementById('guest-event-code'),
            guestPin: document.getElementById('guest-pin'),
            guestPinGroup: document.getElementById('guest-pin-group'),
            guestPinToggle: document.getElementById('guest-pin-toggle'),
            guestLoginBtn: document.getElementById('guest-login-btn'),
            guestError: document.getElementById('guest-error'),
        };

        if (this.authElements.loginForm) {
            this.authElements.loginForm.addEventListener('submit', (event) => this.handleLoginSubmit(event));
        }

        if (this.authElements.logoutBtn) {
            this.authElements.logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        if (this.authElements.guestLoginBtn) {
            this.authElements.guestLoginBtn.addEventListener('click', (event) => this.handleGuestLogin(event));
        }

        // Toggle PIN field visibility
        if (this.authElements.guestPinToggle && this.authElements.guestPinGroup) {
            this.authElements.guestPinToggle.addEventListener('change', (event) => {
                if (event.target.checked) {
                    this.authElements.guestPinGroup.style.display = 'block';
                    if (this.authElements.guestPin) {
                        this.authElements.guestPin.focus();
                    }
                } else {
                    this.authElements.guestPinGroup.style.display = 'none';
                    if (this.authElements.guestPin) {
                        this.authElements.guestPin.value = '';
                    }
                }
            });
        }

        // Clear error messages when user starts typing
        if (this.authElements.guestEventCode && this.authElements.guestError) {
            this.authElements.guestEventCode.addEventListener('input', () => {
                if (this.authElements.guestError) {
                    this.authElements.guestError.textContent = '';
                }
            });
        }

        if (this.authElements.guestPin && this.authElements.guestError) {
            this.authElements.guestPin.addEventListener('input', () => {
                if (this.authElements.guestError) {
                    this.authElements.guestError.textContent = '';
                }
            });
        }

        if (this.guestBannerClose) {
            this.guestBannerClose.addEventListener('click', () => this.hideGuestBanner());
        }

        // Setup auth tab switching
        this.setupAuthTabs();

        window.addEventListener('sommos:auth-expired', () => this.handleSessionExpired());
    }

    showAuthDisabledBanner() {
        try {
            const existing = document.getElementById('auth-disabled-banner');
            if (existing) return;

            const banner = document.createElement('div');
            banner.id = 'auth-disabled-banner';
            banner.style.position = 'fixed';
            banner.style.top = '0';
            banner.style.left = '0';
            banner.style.right = '0';
            banner.style.zIndex = '1000';
            banner.style.padding = '8px 12px';
            banner.style.background = '#933';
            banner.style.color = '#fff';
            banner.style.fontSize = '14px';
            banner.style.textAlign = 'center';
            banner.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
            banner.textContent = 'Auth disabled (dev mode) — all actions allowed';

            document.body.appendChild(banner);

            // Push content down if there's a top header margin clash
            const root = document.getElementById('app') || document.body;
            if (root && !root.dataset.authBannerOffsetApplied) {
                const currentMargin = parseInt(window.getComputedStyle(root).marginTop || '0', 10) || 0;
                root.style.marginTop = `${currentMargin + 36}px`;
                root.dataset.authBannerOffsetApplied = 'true';
            }

            // Hide login UI if present
            if (this.authScreen) {
                this.authScreen.classList.add('hidden');
            }
            if (this.authElements.loginForm) {
                this.authElements.loginForm.classList.add('hidden');
            }
        } catch (e) {
            console.warn('Failed to render auth-disabled banner', e);
        }
    }

    getStoredUser() {
        if (typeof window === 'undefined' || !window.localStorage) {
            return null;
        }

        try {
            const serialized = window.localStorage.getItem('sommos:user');
            return serialized ? JSON.parse(serialized) : null;
        } catch (error) {
            console.warn('Failed to parse stored session', error);
            return null;
        }
    }

    setCurrentUser(user) {
        this.currentUser = user || null;

        if (typeof window !== 'undefined' && window.localStorage) {
            if (this.currentUser) {
                window.localStorage.setItem('sommos:user', JSON.stringify(this.currentUser));
            } else {
                window.localStorage.removeItem('sommos:user');
            }
        }

        this.sessionWarningShown = false;
        this.explanationsCache.clear();
        this.memoriesCache.clear();
        this.updateUserBadge();
        this.applyRoleVisibility(this.currentUser);
    }

    updateUserBadge() {
        const roleBadge = this.authElements.userRoleBadge;
        const userEmail = this.authElements.userEmail;
        const guestNotice = this.authElements.guestNotice;

        if (roleBadge) {
            roleBadge.textContent = this.currentUser?.role ? this.currentUser.role.toUpperCase() : 'SIGNED OUT';
            roleBadge.dataset.role = this.currentUser?.role || '';
        }

        if (userEmail) {
            userEmail.textContent = this.currentUser?.email || '';
        }

        if (guestNotice) {
            if (this.currentUser?.role === 'guest') {
                guestNotice.classList.remove('hidden-by-role');
            } else {
                guestNotice.classList.add('hidden-by-role');
            }
        }

        // Show/hide guest banner
        if (this.currentUser?.role === 'guest') {
            this.showGuestBanner();
        } else {
            this.hideGuestBanner();
        }
    }

    showGuestBanner() {
        if (!this.guestBanner) return;

        // Check if user dismissed the banner in this session
        const dismissed = sessionStorage.getItem('sommos:guest-banner-dismissed');
        if (dismissed === 'true') return;

        this.guestBanner.classList.remove('hidden');

        // Calculate and display session expiry if available
        // Guest sessions have 4-hour refresh tokens
        if (this.guestSessionExpiry) {
            const expiryTime = new Date(Date.now() + 4 * 60 * 60 * 1000);
            this.guestSessionExpiry.textContent = `Session expires at ${expiryTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
    }

    hideGuestBanner() {
        if (!this.guestBanner) return;
        
        this.guestBanner.classList.add('hidden');
        
        // Remember dismissal for this session only
        sessionStorage.setItem('sommos:guest-banner-dismissed', 'true');
    }

    setupAuthTabs() {
        const memberTab = document.getElementById('member-login-tab');
        const guestTab = document.getElementById('guest-login-tab');
        const memberPanel = document.getElementById('member-login-panel');
        const guestPanel = document.getElementById('guest-login-panel');
        const authTitle = document.getElementById('auth-title');
        const authSubtitle = document.getElementById('auth-subtitle');

        if (!memberTab || !guestTab || !memberPanel || !guestPanel) {
            return;
        }

        // Load saved preference
        const savedMode = localStorage.getItem('sommos:auth-mode') || 'member';
        if (savedMode === 'guest') {
            this.switchAuthTab('guest', { memberTab, guestTab, memberPanel, guestPanel, authTitle, authSubtitle });
        }

        memberTab.addEventListener('click', () => {
            this.switchAuthTab('member', { memberTab, guestTab, memberPanel, guestPanel, authTitle, authSubtitle });
        });

        guestTab.addEventListener('click', () => {
            this.switchAuthTab('guest', { memberTab, guestTab, memberPanel, guestPanel, authTitle, authSubtitle });
        });
    }

    switchAuthTab(mode, elements) {
        const { memberTab, guestTab, memberPanel, guestPanel, authTitle, authSubtitle } = elements;

        if (mode === 'member') {
            memberTab.classList.add('active');
            memberTab.setAttribute('aria-selected', 'true');
            guestTab.classList.remove('active');
            guestTab.setAttribute('aria-selected', 'false');
            memberPanel.classList.add('active');
            guestPanel.classList.remove('active');

            if (authTitle) {
                authTitle.textContent = 'Sign in to SommOS';
            }
            if (authSubtitle) {
                authSubtitle.textContent = 'Access cellar intelligence, procurement workflows, and guest experiences.';
            }
        } else {
            guestTab.classList.add('active');
            guestTab.setAttribute('aria-selected', 'true');
            memberTab.classList.remove('active');
            memberTab.setAttribute('aria-selected', 'false');
            guestPanel.classList.add('active');
            memberPanel.classList.remove('active');

            if (authTitle) {
                authTitle.textContent = 'Guest Access';
            }
            if (authSubtitle) {
                authSubtitle.textContent = 'Browse the wine collection with read-only access using your event code.';
            }
        }

        // Save preference
        localStorage.setItem('sommos:auth-mode', mode);
    }

    toggleRoleVisibility(element, shouldShow) {
        if (!element) {
            return;
        }

        if (shouldShow) {
            element.classList.remove('hidden-by-role');
            element.removeAttribute('aria-hidden');
            if (Object.prototype.hasOwnProperty.call(element, 'disabled') && element.dataset.roleDisable !== 'true') {
                element.disabled = false;
            }
        } else {
            element.classList.add('hidden-by-role');
            element.setAttribute('aria-hidden', 'true');
            if (Object.prototype.hasOwnProperty.call(element, 'disabled') && element.dataset.roleDisable !== 'true') {
                element.disabled = true;
            }
        }
    }

    applyRoleVisibility(user) {
        const role = user?.role || null;

        const allowElements = document.querySelectorAll('[data-role-allow]');
        allowElements.forEach((element) => {
            const allowedRoles = (element.dataset.roleAllow || '')
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean);

            const shouldShow = role ? allowedRoles.includes(role) : false;
            this.toggleRoleVisibility(element, shouldShow);
        });

        const denyElements = document.querySelectorAll('[data-role-deny]');
        denyElements.forEach((element) => {
            const deniedRoles = (element.dataset.roleDeny || '')
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean);

            const shouldShow = role ? !deniedRoles.includes(role) : true;
            this.toggleRoleVisibility(element, shouldShow);
        });
    }

    isGuestUser() {
        return this.currentUser?.role === 'guest';
    }

    canManageInventory() {
        return this.currentUser && (this.currentUser.role === 'crew' || this.currentUser.role === 'admin');
    }

    canManageProcurement() {
        return this.canManageInventory();
    }

    ensureCrewAccess(message = 'Crew or admin access required for this action.') {
        if (!this.currentUser) {
            this.ui.showToast('Please sign in to continue.', 'warning');
            this.showAuthScreen();
            return false;
        }

        if (!this.canManageInventory()) {
            this.ui.showToast(message, 'warning');
            return false;
        }

        return true;
    }

    showAuthScreen() {
        if (this.authScreen) {
            this.authScreen.classList.remove('hidden');
        }

        if (this.appContainer) {
            this.appContainer.classList.add('hidden');
        }

        if (this.authElements.loginEmail) {
            this.authElements.loginEmail.focus();
        }
    }

    hideAuthScreen() {
        if (this.authScreen) {
            this.authScreen.classList.add('hidden');
        }

        if (this.appContainer) {
            this.appContainer.classList.remove('hidden');
        }
    }

    async initializeAuth() {
        try {
            const session = await this.api.refreshSession();

            if (session?.success && session.data) {
                this.setCurrentUser(session.data);
                this.hideAuthScreen();
                return true;
            }
        } catch (error) {
            console.info('No active session detected', error?.message || error);

            if (!navigator.onLine) {
                const storedUser = this.getStoredUser();
                if (storedUser) {
                    this.setCurrentUser(storedUser);
                    this.hideAuthScreen();
                    return true;
                }
            }
        }

        // Detect auth-disabled mode by probing a protected endpoint without credentials
        try {
            const health = await this.api.getSystemHealth();
            if (health?.success) {
                this.authDisabled = true;
                this.setCurrentUser({ email: 'anonymous@sommos.local', role: 'admin' });
                this.hideAuthScreen();
                this.showAuthDisabledBanner();
                return true;
            }
        } catch (probeError) {
            // ignore and fall through to auth screen
        }

        this.setCurrentUser(null);
        this.showAuthScreen();
        return false;
    }

    async bootstrapApplication() {
        if (!this.hasBootstrapped) {
            await this.initializeApp();
            this.setupEventListeners();
            this.hasBootstrapped = true;
        }

        await this.loadInitialData();
        this.hideLoadingScreen();
    }

    async handleLoginSubmit(event) {
        event.preventDefault();

        if (!this.authElements.loginEmail || !this.authElements.loginPassword) {
            return;
        }

        const email = this.authElements.loginEmail.value.trim();
        const password = this.authElements.loginPassword.value;

        if (this.authElements.loginError) {
            this.authElements.loginError.textContent = '';
        }

        if (!email || !password) {
            if (this.authElements.loginError) {
                this.authElements.loginError.textContent = 'Email and password are required.';
            }
            return;
        }

        this.ui.showLoading('login-submit', 'Signing in...');

        try {
            const result = await this.api.login(email, password);

            if (result?.success && result.data) {
                this.setCurrentUser(result.data);
                this.hideAuthScreen();
                this.ui.showToast('Welcome aboard!', 'success');
                this.showLoadingScreen();
                await this.bootstrapApplication();
            } else {
                throw new Error('Unable to sign in. Please verify your credentials.');
            }
        } catch (error) {
            console.error('Login failed', error);
            if (this.authElements.loginError) {
                const message = error?.message || 'Failed to sign in. Please try again.';
                this.authElements.loginError.textContent = message;
            }
            this.ui.showToast('Sign-in failed. Please check your credentials.', 'error');
        } finally {
            this.ui.hideLoading('login-submit');
        }
    }

    async handleGuestLogin(event) {
        event.preventDefault();

        if (!this.authElements.guestEventCode) {
            return;
        }

        const eventCode = this.authElements.guestEventCode.value.trim();
        const pin = this.authElements.guestPin?.value.trim() || null;

        // Clear previous errors
        if (this.authElements.guestError) {
            this.authElements.guestError.textContent = '';
        }

        // Validate event code
        if (!eventCode) {
            if (this.authElements.guestError) {
                this.authElements.guestError.textContent = 'Event code is required.';
            }
            if (this.authElements.guestEventCode) {
                this.authElements.guestEventCode.focus();
            }
            return;
        }

        this.ui.showLoading('guest-login-btn', 'Joining...');

        try {
            const result = await this.api.guestLogin(eventCode, pin);

            if (result?.success && result.data) {
                this.setCurrentUser(result.data);
                this.hideAuthScreen();
                this.ui.showToast('Welcome! You have guest access to browse the collection.', 'success');
                this.showLoadingScreen();
                await this.bootstrapApplication();
            } else {
                throw new Error('Unable to join as guest. Please verify your event code.');
            }
        } catch (error) {
            console.error('Guest login failed', error);
            
            let errorMessage = error?.message || 'Failed to join as guest. Please try again.';
            
            // Handle PIN_REQUIRED error by showing the PIN field
            if (error?.code === 'PIN_REQUIRED') {
                errorMessage = 'This event code requires a PIN. Please check the box below and enter your PIN.';
                
                // Auto-show PIN field
                if (this.authElements.guestPinToggle && this.authElements.guestPinGroup) {
                    this.authElements.guestPinToggle.checked = true;
                    this.authElements.guestPinGroup.style.display = 'block';
                    
                    // Focus PIN input after a brief delay
                    setTimeout(() => {
                        if (this.authElements.guestPin) {
                            this.authElements.guestPin.focus();
                        }
                    }, 100);
                }
            }
            
            if (this.authElements.guestError) {
                this.authElements.guestError.textContent = errorMessage;
            }
            this.ui.showToast(errorMessage, 'error');
        } finally {
            this.ui.hideLoading('guest-login-btn');
        }
    }

    async handleLogout() {
        this.showLoadingScreen();

        try {
            await this.api.logout();
        } catch (error) {
            console.warn('Logout request failed', error);
        }

        this.clearSessionState();
        this.showAuthScreen();
        this.hideLoadingScreen({ keepAppHidden: true });
        this.ui.showToast('You have been signed out.', 'info');
    }

    handleSessionExpired() {
        if (this.sessionWarningShown) {
            return;
        }

        this.sessionWarningShown = true;
        this.ui.showToast('Your session has expired. Please sign in again.', 'warning');
        this.clearSessionState();
        this.showAuthScreen();
        this.hideLoadingScreen({ keepAppHidden: true });
    }

    clearSessionState() {
        this.setCurrentUser(null);
        this.fullInventory = [];
        if (this.authElements.loginForm) {
            this.authElements.loginForm.reset();
        }

        if (this.authElements.loginError) {
            this.authElements.loginError.textContent = '';
        }
    }

    /**
     * Centralized API error handler
     * Provides consistent error handling and user feedback for all API errors
     */
    handleAPIError(error, context = '', userMessage = null) {
        console.error(`API Error [${context}]:`, error);
        
        // Check if this is a SommOSAPIError with details
        if (error instanceof SommOSAPIError || error.name === 'SommOSAPIError') {
            const { status, code, message, details } = error;
            
            // Determine user-friendly message based on error type
            let displayMessage = userMessage || message;
            let toastType = 'error';
            
            if (!navigator.onLine) {
                displayMessage = 'You are offline. Changes will sync when connection is restored.';
                toastType = 'warning';
            } else if (error.message && error.message.includes('timeout')) {
                displayMessage = 'Request timed out. The server may be slow or unavailable.';
            } else if (error.message && /Failed to fetch|NetworkError|load failed/i.test(error.message)) {
                displayMessage = 'Connection lost. Please check your internet connection.';
            } else if (status >= 500) {
                displayMessage = 'Server error occurred. Our team has been notified.';
            } else if (status === 429) {
                displayMessage = 'Too many requests. Please wait a moment and try again.';
            } else if (status === 408) {
                displayMessage = 'Request timeout. Please try again.';
            } else if (status >= 400 && status < 500) {
                // Use specific API error message for 4xx errors
                displayMessage = message || `Request failed with status ${status}`;
            }
            
            // Add retry information if error indicates retry exhaustion
            if (error.message && error.message.includes('multiple attempts')) {
                displayMessage += ' (After multiple retry attempts)';
            }
            
            // Show toast notification
            this.ui.showToast(displayMessage, toastType);
            
            // Log detailed error for debugging
            console.group(`%c🚨 API Error Details [${context}]`, 'color: #ff6b6b; font-weight: bold');
            console.log('Status:', status);
            console.log('Code:', code);
            console.log('Message:', message);
            console.log('Details:', details);
            console.log('Full Error:', error);
            console.groupEnd();
            
            return {
                handled: true,
                status,
                code,
                message: displayMessage
            };
        }
        
        // Handle generic errors
        const genericMessage = userMessage || error.message || 'An unexpected error occurred';
        this.ui.showToast(genericMessage, 'error');
        
        return {
            handled: true,
            message: genericMessage
        };
    }

    // Real-time WebSocket event handlers
    handleRealtimeConnect() {
        console.log('🔌 Real-time sync connected');
        this.ui.showToast('Real-time updates connected', 'success');
    }

    handleRealtimeDisconnect() {
        console.log('🔌 Real-time sync disconnected');
        this.ui.showToast('Real-time updates disconnected', 'warning');
    }

    handleRealtimeError(error) {
        console.error('🔌 Real-time sync error:', error);
        this.ui.showToast('Real-time connection error', 'error');
    }

    handleRealtimeInventoryUpdate(update) {
        console.log('📦 Real-time inventory update received:', update);
        
        // Update local inventory if we have the item
        if (this.fullInventory && update.item) {
            const index = this.fullInventory.findIndex(item => item.id === update.item.id);
            if (index !== -1) {
                this.fullInventory[index] = { ...this.fullInventory[index], ...update.item };
                
                // Refresh current view if it's inventory-related
                if (this.currentView === 'inventory' || this.currentView === 'dashboard') {
                    this.refreshCurrentView();
                }
                
                this.ui.showToast(`Inventory updated: ${update.item.name || 'Item'}`, 'info');
            }
        }
    }

    handleRealtimeInventoryAction(action) {
        console.log('📦 Real-time inventory action received:', action);
        
        // Handle different action types
        switch (action.type) {
            case 'add':
                if (this.fullInventory && action.item) {
                    this.fullInventory.push(action.item);
                    this.ui.showToast(`New item added: ${action.item.name}`, 'success');
                }
                break;
                
            case 'remove':
                if (this.fullInventory && action.itemId) {
                    const index = this.fullInventory.findIndex(item => item.id === action.itemId);
                    if (index !== -1) {
                        const removedItem = this.fullInventory.splice(index, 1)[0];
                        this.ui.showToast(`Item removed: ${removedItem.name}`, 'warning');
                    }
                }
                break;
                
            case 'move':
                if (action.itemId && action.newLocation) {
                    this.ui.showToast(`Item moved to ${action.newLocation}`, 'info');
                }
                break;
        }
        
        // Refresh current view if it's inventory-related
        if (this.currentView === 'inventory' || this.currentView === 'dashboard') {
            this.refreshCurrentView();
        }
    }

    handleRealtimeSystemNotification(notification) {
        console.log('🔔 Real-time system notification received:', notification);
        
        // Show notification to user
        this.ui.showToast(notification.message, notification.type || 'info');
        
        // Handle specific notification types
        switch (notification.type) {
            case 'maintenance':
                // Could show a maintenance banner
                break;
            case 'security':
                // Could trigger security-related actions
                break;
            case 'update':
                // Could prompt for app update
                break;
        }
    }

    showLoadingScreen() {
        if (this.loadingScreen) {
            this.loadingScreen.style.display = 'flex';
        }

        if (this.appContainer) {
            this.appContainer.classList.add('hidden');
        }
    }

    hideLoadingScreen({ keepAppHidden = false } = {}) {
        if (!this.loadingScreen || !this.appContainer) {
            return;
        }

        if (keepAppHidden) {
            this.loadingScreen.style.display = 'none';
            return;
        }

        setTimeout(() => {
            this.loadingScreen.style.display = 'none';
            this.appContainer.classList.remove('hidden');
        }, 1500); // Allow loading animation to complete
    }

    async initializeApp() {
        // Initialize offline storage
        if ('indexedDB' in window) {
            await this.initializeOfflineStorage();
            if (navigator.onLine) {
                await this.syncService?.processQueue();
            }
        }
        
        // Check API connectivity
        try {
            await this.api.healthCheck();
            console.log('✅ API connection established');
        } catch (error) {
            console.warn('⚠️ API unavailable, running in offline mode');
            this.ui.showToast('Running in offline mode', 'warning');
        }
    }

    async initializeOfflineStorage() {
        // Initialize IndexedDB (via idb) for offline storage and sync queue persistence
        try {
            await this.syncService.initialize({
                dbName: 'SommOSDB',
                storeName: 'sync_queue',
                version: 2,
                extraStores: [
                    { name: 'wines', options: { keyPath: 'id' } },
                    { name: 'inventory', options: { keyPath: 'id' } },
                    { name: 'pairings', options: { keyPath: 'id' } }
                ]
            });

            this.db = this.syncService.getDB();
        } catch (error) {
            console.warn('Failed to initialize offline storage', error);
        }
    }

    setupDishBuilder() {
        const builderContainer = document.querySelector('.dish-builder');
        if (!builderContainer) {
            return;
        }

        this.dishBuilderState = {
            ingredient: '',
            technique: '',
            cuisine: '',
            accompaniments: '',
            intensity: '',
            flavors: new Set()
        };

        this.dishBuilderElements = {
            ingredientInput: document.getElementById('dish-main-ingredient'),
            techniqueSelect: document.getElementById('dish-cooking-technique'),
            cuisineSelect: document.getElementById('dish-cuisine-style'),
            accompanimentsInput: document.getElementById('dish-accompaniments'),
            intensitySelect: document.getElementById('dish-intensity'),
            flavorButtons: Array.from(document.querySelectorAll('.flavor-tag')),
            preview: document.getElementById('dish-builder-preview'),
            applyBtn: document.getElementById('apply-dish-builder'),
            clearBtn: document.getElementById('clear-dish-builder')
        };

        const updateState = () => this.updateDishBuilderPreview();

        if (this.dishBuilderElements.ingredientInput) {
            this.dishBuilderElements.ingredientInput.addEventListener('input', (event) => {
                this.dishBuilderState.ingredient = event.target.value.trim();
                updateState();
            });
        }

        if (this.dishBuilderElements.techniqueSelect) {
            this.dishBuilderElements.techniqueSelect.addEventListener('change', (event) => {
                this.dishBuilderState.technique = event.target.value;
                updateState();
            });
        }

        if (this.dishBuilderElements.cuisineSelect) {
            this.dishBuilderElements.cuisineSelect.addEventListener('change', (event) => {
                this.dishBuilderState.cuisine = event.target.value;
                updateState();
            });
        }

        if (this.dishBuilderElements.accompanimentsInput) {
            this.dishBuilderElements.accompanimentsInput.addEventListener('input', (event) => {
                this.dishBuilderState.accompaniments = event.target.value.trim();
                updateState();
            });
        }

        if (this.dishBuilderElements.intensitySelect) {
            this.dishBuilderElements.intensitySelect.addEventListener('change', (event) => {
                this.dishBuilderState.intensity = event.target.value;
                updateState();
            });
        }

        if (this.dishBuilderElements.flavorButtons.length > 0) {
            this.dishBuilderElements.flavorButtons.forEach((button) => {
                button.setAttribute('aria-pressed', 'false');
                button.addEventListener('click', () => {
                    const flavor = button.dataset.flavor;
                    if (!flavor) {
                        return;
                    }

                    if (this.dishBuilderState.flavors.has(flavor)) {
                        this.dishBuilderState.flavors.delete(flavor);
                        button.classList.remove('selected');
                        button.setAttribute('aria-pressed', 'false');
                    } else {
                        this.dishBuilderState.flavors.add(flavor);
                        button.classList.add('selected');
                        button.setAttribute('aria-pressed', 'true');
                    }

                    updateState();
                });
            });
        }

        if (this.dishBuilderElements.applyBtn) {
            this.dishBuilderElements.applyBtn.addEventListener('click', () => this.applyDishBuilderDescription());
        }

        if (this.dishBuilderElements.clearBtn) {
            this.dishBuilderElements.clearBtn.addEventListener('click', () => this.resetDishBuilder());
        }

        this.updateDishBuilderPreview();
    }

    buildDishDescription() {
        if (!this.dishBuilderState) {
            return '';
        }

        const { ingredient, technique, cuisine, accompaniments, intensity, flavors } = this.dishBuilderState;
        const descriptionParts = [];

        const mainDish = [technique, ingredient].filter(Boolean).join(' ').trim();
        if (mainDish) {
            descriptionParts.push(mainDish);
        }

        if (cuisine) {
            descriptionParts.push(`${cuisine} cuisine`);
        }

        if (accompaniments) {
            descriptionParts.push(`served with ${accompaniments}`);
        }

        if (intensity) {
            descriptionParts.push(`${intensity} intensity`);
        }

        if (flavors && flavors.size > 0) {
            const flavorList = Array.from(flavors);
            if (flavorList.length === 1) {
                descriptionParts.push(`highlighting ${flavorList[0]} notes`);
            } else {
                const lastFlavor = flavorList.pop();
                descriptionParts.push(`highlighting ${flavorList.join(', ')} and ${lastFlavor} notes`);
            }
        }

        if (descriptionParts.length === 0) {
            return '';
        }

        let description = descriptionParts.join(', ');
        description = description.charAt(0).toUpperCase() + description.slice(1);

        if (!description.endsWith('.')) {
            description += '.';
        }

        return description;
    }

    updateDishBuilderPreview() {
        if (!this.dishBuilderElements || !this.dishBuilderElements.preview) {
            return;
        }

        const description = this.buildDishDescription();
        this.dishBuilderElements.preview.textContent = description || 'Select details to see a suggested description.';
    }

    applyDishBuilderDescription() {
        const dishInput = document.getElementById('dish-input');
        const description = this.buildDishDescription();

        if (!dishInput) {
            return;
        }

        if (!description) {
            this.ui.showToast('Add a few dish details before using the builder.', 'warning');
            return;
        }

        const existingText = dishInput.value.trim();
        if (existingText && !existingText.includes(description)) {
            dishInput.value = `${description}\n${existingText}`;
        } else {
            dishInput.value = description;
        }

        dishInput.focus();
        dishInput.setSelectionRange(dishInput.value.length, dishInput.value.length);
        this.ui.showToast('Dish description updated with your selections.', 'success');
    }

    resetDishBuilder() {
        if (!this.dishBuilderElements || !this.dishBuilderState) {
            return;
        }

        this.dishBuilderState = {
            ingredient: '',
            technique: '',
            cuisine: '',
            accompaniments: '',
            intensity: '',
            flavors: new Set()
        };

        const {
            ingredientInput,
            techniqueSelect,
            cuisineSelect,
            accompanimentsInput,
            intensitySelect,
            flavorButtons
        } = this.dishBuilderElements;

        if (ingredientInput) ingredientInput.value = '';
        if (techniqueSelect) techniqueSelect.value = '';
        if (cuisineSelect) cuisineSelect.value = '';
        if (accompanimentsInput) accompanimentsInput.value = '';
        if (intensitySelect) intensitySelect.value = '';

        if (flavorButtons && flavorButtons.length) {
            flavorButtons.forEach((button) => {
                button.classList.remove('selected');
                button.setAttribute('aria-pressed', 'false');
            });
        }

        this.updateDishBuilderPreview();
        this.ui.showToast('Dish builder cleared.', 'info');
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.navigateToView(view);
            });
        });

        // Quick actions
        document.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleQuickAction(action);
            });
        });

        // Pairing form
        const getPairingsBtn = document.getElementById('get-pairings-btn');
        if (getPairingsBtn) {
            getPairingsBtn.addEventListener('click', () => this.handlePairingRequest());
        }

        // Inventory controls
        const refreshInventoryBtn = document.getElementById('refresh-inventory');
        if (refreshInventoryBtn) {
            refreshInventoryBtn.addEventListener('click', () => this.loadInventory());
        }
        
        // Search functionality
        const inventorySearch = document.getElementById('inventory-search');
        if (inventorySearch) {
            inventorySearch.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }
        
        // Filter functionality
        const locationFilter = document.getElementById('location-filter');
        const typeFilter = document.getElementById('type-filter');
        
        if (locationFilter) {
            locationFilter.addEventListener('change', () => this.applyFilters());
        }
        
        if (typeFilter) {
            typeFilter.addEventListener('change', () => this.applyFilters());
        }

        // Sync button
        const syncBtn = document.getElementById('sync-btn');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => this.syncData());
        }

        // Help button (glossary modal)
        const helpBtn = document.getElementById('help-btn');
        if (helpBtn) {
            helpBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showGlossaryModal();
            });
        }

        // Procurement action buttons
        const analyzeProcBtn = document.getElementById('analyze-procurement-btn');
        if (analyzeProcBtn) {
            analyzeProcBtn.addEventListener('click', () => {
                if (this.modules.procurement && typeof this.modules.procurement.analyzeProcurementOpportunities === 'function') {
                    this.modules.procurement.analyzeProcurementOpportunities();
                } else if (typeof this.analyzeProcurementOpportunities === 'function') {
                    this.analyzeProcurementOpportunities();
                }
            });
        }

        const purchaseDecisionBtn = document.getElementById('purchase-decision-btn');
        if (purchaseDecisionBtn) {
            purchaseDecisionBtn.addEventListener('click', () => {
                if (this.modules.procurement && typeof this.modules.procurement.showPurchaseDecisionTool === 'function') {
                    this.modules.procurement.showPurchaseDecisionTool();
                } else if (typeof this.showPurchaseDecisionTool === 'function') {
                    this.showPurchaseDecisionTool();
                }
            });
        }

        const generatePOBtn = document.getElementById('generate-po-btn');
        if (generatePOBtn) {
            generatePOBtn.addEventListener('click', () => {
                if (this.modules.procurement && typeof this.modules.procurement.generatePurchaseOrder === 'function') {
                    this.modules.procurement.generatePurchaseOrder();
                } else if (typeof this.generatePurchaseOrder === 'function') {
                    this.generatePurchaseOrder();
                }
            });
        }

        const filterProcBtn = document.getElementById('filter-procurement-btn');
        if (filterProcBtn) {
            filterProcBtn.addEventListener('click', () => {
                if (this.modules.procurement && typeof this.modules.procurement.filterProcurementOpportunities === 'function') {
                    this.modules.procurement.filterProcurementOpportunities();
                } else if (typeof this.filterProcurementOpportunities === 'function') {
                    this.filterProcurementOpportunities();
                }
            });
        }

        // Online/offline detection
        window.addEventListener('online', async () => {
            this.isOnline = true;
            this.ui.showToast('Connection restored', 'success');
            await this.syncService?.processQueue();
            this.syncData();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.ui.showToast('Working offline', 'warning');
        });

        window.addEventListener('sommos:sync-queued', (event) => {
            const detail = event?.detail;
            const label = detail?.endpoint ? ` for ${detail.endpoint}` : '';
            this.ui.showToast(`Action queued${label}`, 'info');
        });

        window.addEventListener('sommos:sync-processed', (event) => {
            const detail = event?.detail;
            const label = detail?.endpoint ? ` from ${detail.endpoint}` : '';
            this.ui.showToast(`Queued action synced${label}`, 'success');
        });

        window.addEventListener('sommos:sync-error', (event) => {
            const detail = event?.detail;
            const message = detail?.error ? `Sync retry scheduled: ${detail.error}` : 'Sync attempt failed, will retry soon';
            this.ui.showToast(message, 'warning');
        });

        this.setupDishBuilder();
    }

    navigateToView(viewName) {
        if (viewName === 'procurement' && !this.canManageProcurement()) {
            this.ui.showToast('Crew or admin access required for procurement.', 'warning');
            return;
        }

        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

        // Update views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(`${viewName}-view`).classList.add('active');

        this.currentView = viewName;

        // Load view-specific data
        this.loadViewData(viewName);
    }

    async loadViewData(viewName) {
        switch (viewName) {
            case 'dashboard':
                await this.modules.dashboard.refresh();
                break;
            case 'inventory':
                await this.modules.inventory.refresh();
                break;
            case 'pairing':
                await this.modules.pairing.init();
                break;
            case 'procurement':
                await this.modules.procurement.refresh();
                break;
            case 'catalog':
                await this.loadWineCatalog();
                break;
            case 'glossary':
                this.renderGlossaryPage();
                break;
        }
    }

    async loadInitialData() {
        await this.loadDashboardData();
    }
    
    async loadDashboardData() {
        await this.modules.dashboard.refresh();
    }
    
    async showStatDetailModal(statType) {
        const inventory = this.fullInventory || [];
        
        let title = '';
        let content = '';
        
        switch (statType) {
            case 'total-bottles':
                title = '🍷 Total Bottles Breakdown';
                const byType = {};
                const byLocation = {};
                inventory.forEach(wine => {
                    const type = wine.wine_type || 'Other';
                    const location = wine.location || 'Unknown';
                    const qty = wine.quantity || 0;
                    byType[type] = (byType[type] || 0) + qty;
                    byLocation[location] = (byLocation[location] || 0) + qty;
                });
                
                content = `
                    <div class="stat-detail-modal">
                        <div class="stat-detail-section">
                            <h4>By Wine Type</h4>
                            <ul class="stat-detail-list">
                                ${Object.entries(byType).map(([type, count]) => 
                                    `<li><strong>${type}:</strong> ${count} bottles</li>`
                                ).join('')}
                            </ul>
                        </div>
                        <div class="stat-detail-section">
                            <h4>By Location</h4>
                            <ul class="stat-detail-list">
                                ${Object.entries(byLocation).map(([loc, count]) => 
                                    `<li><strong>${loc}:</strong> ${count} bottles</li>`
                                ).join('')}
                            </ul>
                        </div>
                    </div>
                `;
                break;
                
            case 'total-wines':
                title = '🏷️ Wine Labels';
                const uniqueWines = {};
                inventory.forEach(wine => {
                    const key = `${wine.name}_${wine.producer}`;
                    if (!uniqueWines[key]) {
                        uniqueWines[key] = {
                            name: wine.name || 'Unknown',
                            producer: wine.producer || 'Unknown',
                            count: 0
                        };
                    }
                    uniqueWines[key].count += (wine.quantity || 0);
                });
                
                const winesList = Object.values(uniqueWines).sort((a, b) => b.count - a.count);
                content = `
                    <div class="stat-detail-modal">
                        <p class="stat-summary">You have ${winesList.length} unique wine labels in your collection.</p>
                        <div class="stat-detail-section">
                            <h4>Top Wines by Quantity</h4>
                            <ul class="stat-detail-list">
                                ${winesList.slice(0, 15).map(wine => 
                                    `<li><strong>${wine.name}</strong> (${wine.producer}) — ${wine.count} bottles</li>`
                                ).join('')}
                                ${winesList.length > 15 ? `<li><em>...and ${winesList.length - 15} more</em></li>` : ''}
                            </ul>
                        </div>
                    </div>
                `;
                break;
                
            case 'total-vintages':
                title = '📅 Vintage Distribution';
                const vintageYears = {};
                inventory.forEach(wine => {
                    if (wine.year && wine.year > 1900) {
                        vintageYears[wine.year] = (vintageYears[wine.year] || 0) + (wine.quantity || 0);
                    }
                });
                
                const sortedVintages = Object.entries(vintageYears).sort((a, b) => b[0] - a[0]);
                const currentYear = new Date().getFullYear();
                const avgAge = sortedVintages.length > 0 
                    ? (sortedVintages.reduce((sum, [year, count]) => sum + (currentYear - parseInt(year)) * count, 0) / 
                       sortedVintages.reduce((sum, [, count]) => sum + count, 0)).toFixed(1)
                    : 0;
                
                content = `
                    <div class="stat-detail-modal">
                        <p class="stat-summary">Your collection spans ${sortedVintages.length} different vintage years with an average age of ${avgAge} years.</p>
                        <div class="stat-detail-section">
                            <h4>Vintages (Most Recent)</h4>
                            <ul class="stat-detail-list">
                                ${sortedVintages.slice(0, 20).map(([year, count]) => 
                                    `<li><strong>${year}:</strong> ${count} bottles</li>`
                                ).join('')}
                                ${sortedVintages.length > 20 ? `<li><em>...and ${sortedVintages.length - 20} more vintages</em></li>` : ''}
                            </ul>
                        </div>
                    </div>
                `;
                break;
                
            case 'active-suppliers':
                title = '🏪 Active Suppliers';
                content = `
                    <div class="stat-detail-modal">
                        <p class="stat-summary">Supplier details require procurement data from the API.</p>
                        <p>Navigate to the Procurement view to see detailed supplier information and order history.</p>
                        <div class="modal-actions">
                            <button class="btn primary" onclick="app.navigateToView('procurement'); app.ui.hideModal();">Go to Procurement</button>
                        </div>
                    </div>
                `;
                break;
        }
        
        this.ui.showModal(title, content);
    }
    
    displayDefaultActivity() {
        const activityContainer = document.getElementById('recent-activity');
        const currentDate = new Date();
        const activities = [
            {
                icon: '🍷',
                title: 'SommOS System Initialized',
                details: 'Wine management system ready for use',
                time: 'Just now'
            },
            {
                icon: '📊',
                title: 'Dashboard Loaded',
                details: 'System statistics and inventory overview',
                time: 'Just now'
            },
            {
                icon: '🔄',
                title: 'Inventory Synchronized',
                details: 'Wine collection data updated',
                time: 'Just now'
            }
        ];
        
        activityContainer.innerHTML = activities.map((activity, index) => `
            <div class="activity-item fade-in" style="animation-delay: ${index * 0.1}s">
                <div class="activity-icon">${activity.icon}</div>
                <div class="activity-content">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-details">${activity.details}</div>
                    <div class="activity-time">${activity.time}</div>
                </div>
            </div>
        `).join('');
    }
    
    getActivityIcon(activityType) {
        const icons = {
            'consumption': '🥂',
            'pairing': '🍽️',
            'inventory_update': '📦',
            'reservation': '🍷',
            'procurement': '🛒',
            'system': '⚙️',
            'sync': '🔄',
            'default': '📋'
        };
        return icons[activityType] || icons.default;
    }
    
    getTimeAgo(timestamp) {
        if (!timestamp) return 'Unknown time';
        
        const now = new Date();
        const time = new Date(timestamp);
        const diffMs = now - time;
        
        const minutes = Math.floor(diffMs / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days} day${days > 1 ? 's' : ''} ago`;
        } else if (hours > 0) {
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else if (minutes > 0) {
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else {
            return 'Just now';
        }
    }

    async loadInventory() {
        try {
            console.log('Loading inventory...');
            const grid = document.getElementById('inventory-grid');
            grid.innerHTML = '<div class="inventory-placeholder"><p>Loading wine collection...</p></div>';
            
            const inventory = await this.api.getInventory({ available_only: false });
            console.log('Inventory loaded:', inventory);
            console.log('Number of wines:', inventory?.data?.length || 0);
            
            if (inventory && inventory.success) {
                this.displayInventory(inventory.data || []);
            } else {
                throw new Error('Invalid inventory response');
            }
        } catch (error) {
            console.error('Failed to load inventory:', error);
            this.ui.showToast('Failed to load inventory', 'error');
            const grid = document.getElementById('inventory-grid');
            grid.innerHTML = '<div class="inventory-placeholder"><p>Failed to load inventory. Please refresh and try again.</p></div>';
        }
    }

    displayInventory(inventory) {
        const startTime = this.startPerformanceTimer();
        console.log('Displaying inventory:', inventory);
        const grid = document.getElementById('inventory-grid');
        const isGuest = this.isGuestUser();
        
        if (!grid) {
            console.error('Inventory grid element not found!');
            return;
        }
        
        // Store full inventory for search
        this.fullInventory = inventory || [];
        
        // Update wine count in header
        this.updateInventoryCount(inventory ? inventory.length : 0);
        
        if (!inventory || inventory.length === 0) {
            console.log('No inventory to display');
            grid.innerHTML = '<div class="inventory-placeholder"><p>No inventory items found</p></div>';
            return;
        }
        
        console.log(`Rendering ${inventory.length} wine cards with virtual scrolling...`);
        
        try {
            const useVirtualScroll = inventory.length > 50;
            
            // Initialize or update virtual scroll for inventory
            if (!this.inventoryVirtualScroll) {
                this.inventoryVirtualScroll = new VirtualScroll(
                    grid, 
                    inventory, 
                    220, // Wine card height
                    { 
                        threshold: 50, // Use virtual scrolling for lists > 50 items
                        bufferSize: 3 
                    }
                );
                
                // Set render callback for inventory items with image optimization
                this.inventoryVirtualScroll.setRenderCallback((item, index) => {
                    const cardHtml = this.createInventoryWineCard(item, index, isGuest);
                    
                    // Convert HTML string to DOM element
                    const template = document.createElement('template');
                    template.innerHTML = cardHtml.trim();
                    const card = template.content.firstChild;
                    
                    // Optimize images in this card
                    if (card && window.imageOptimizer) {
                        const img = card.querySelector('img.wine-bottle-image');
                        if (img) {
                            window.imageOptimizer.optimizeImage(img, {
                                width: 300,
                                height: 450,
                                lazyLoad: true,
                                compressionQuality: 0.8
                            });
                        }
                    }
                    
                    return card;
                });
            } else {
                // Update existing virtual scroll with new data
                this.inventoryVirtualScroll.setItems(inventory);
            }
            
            console.log('Inventory virtual scroll initialized successfully');
            
            // End performance timer
            this.endPerformanceTimer(startTime, 'inventory', inventory.length, useVirtualScroll);
            
        } catch (error) {
            console.error('Error setting up inventory virtual scroll:', error);
            // Fallback to regular rendering
            this.displayInventoryFallback(inventory, grid, isGuest);
            this.endPerformanceTimer(startTime, 'inventory', inventory.length, false);
        }
    }

    createInventoryWineCard(item, index, isGuest) {
        // Improve region display
        const displayRegion = this.getDisplayRegion(item);
        const displayCountry = item.country && item.country !== 'Unknown' ? item.country : '';
        
        // Image setup
        const imageUrl = item.image_url || '/images/wine-placeholder.svg';
        const imageName = `${item.name || 'Unknown'} - ${item.producer || 'Unknown'}`;
        
        const actionSection = isGuest
            ? `
                <div class="card-actions-simple guest-readonly" aria-live="polite">
                    <span class="guest-readonly-message">🔒 Guest access is read-only</span>
                </div>
            `
            : `
                <div class="card-actions-simple">
                    <button class="btn-small secondary" onclick="app.showWineDetailModal('${item.vintage_id || item.id}')">
                        📝 Details
                    </button>
                    <button class="btn-small primary" onclick="app.reserveWineModal('${item.vintage_id || item.id}', '${(item.name || "Unknown").replace(/'/g, "\\'") }')">
                        🍷 Reserve
                    </button>
                    ${(item.quantity || 0) > 0 ? `
                        <button class="btn-small" onclick="app.consumeWineModal('${item.vintage_id || item.id}', '${(item.name || "Unknown").replace(/'/g, "\\'") }')">
                            🥂 Serve
                        </button>
                    ` : ''}
                </div>
            `;

        return `
            <div class="wine-card simple-card fade-in" style="animation-delay: ${Math.min(index * 0.02, 2)}s">
                <div class="wine-image-container aspect-3-2">
                    <img 
                        class="wine-bottle-image" 
                        src="${imageUrl}"
                        alt="${imageName} bottle"
                        loading="lazy"
                        data-optimized="false"
                        onerror="this.onerror=null; this.src='/images/wine-placeholder.svg';"
                    />
                    <div class="image-skeleton"></div>
                </div>
                <div class="wine-header">
                    <div class="wine-type-badge ${item.wine_type?.toLowerCase() || 'unknown'}">
                        ${this.getWineTypeIcon(item.wine_type)} ${item.wine_type || 'Wine'}
                    </div>
                    <div class="price">${item.cost_per_bottle && !isGuest ? '$' + parseFloat(item.cost_per_bottle).toFixed(2) : ''}</div>
                </div>
                <h3>${item.name || 'Unknown Wine'}</h3>
                <p><strong>Producer:</strong> ${item.producer || 'Unknown'}</p>
                <p><strong>Year:</strong> ${item.year || 'N/A'} ${displayCountry ? '| ' + displayCountry : ''}</p>
                <p><strong>Region:</strong> ${displayRegion}</p>
                <div class="stock-display">
                    <span class="quantity">${item.quantity || 0} bottles</span>
                    <span class="location">${!isGuest ? `📍 ${item.location || 'Unknown'}` : '🔒 Location hidden'}</span>
                </div>
                ${actionSection}
            </div>
        `;
    }

    displayInventoryFallback(inventory, grid, isGuest) {
        // Fallback method for when virtual scrolling fails
        console.log('Using fallback inventory rendering');
        grid.innerHTML = inventory.map((item, index) => {
            return this.createInventoryWineCard(item, index, isGuest);
        }).join('');
    }
    
    getDisplayRegion(item) {
        const placeholderRegions = ['various', 'unknown', 'multiple', 'n/a', ''];
        const region = (item.region || '').trim();
        const normalizedRegion = region.toLowerCase();

        if (region && !placeholderRegions.includes(normalizedRegion)) {
            return region;
        }

        // Try to extract better region info from wine name or producer
        const name = (item.name || '').toLowerCase();
        const producer = (item.producer || '').toLowerCase();

        if (name.includes('bordeaux') || producer.includes('château')) return 'Bordeaux';
        if (name.includes('burgundy') || name.includes('bourgogne')) return 'Burgundy';
        if (name.includes('champagne')) return 'Champagne';
        if (name.includes('chianti')) return 'Chianti';
        if (name.includes('rioja')) return 'Rioja';
        if (name.includes('barolo') || name.includes('barbaresco')) return 'Piedmont';
        if (name.includes('amarone') || name.includes('valpolicella')) return 'Veneto';
        if (name.includes('napa')) return 'Napa Valley';
        if (name.includes('sonoma')) return 'Sonoma';
        if (name.includes('rhône') || name.includes('rhone')) return 'Rhône Valley';
        if (name.includes('loire')) return 'Loire Valley';
        if (name.includes('alsace')) return 'Alsace';
        if (name.includes('mosel') || name.includes('riesling')) return 'Mosel';

        // Fall back to original region or country
        return region || item.country || 'Unknown Region';
    }
    
    
    parseGrapeVarieties(grapeVarieties) {
        try {
            if (typeof grapeVarieties === 'string' && grapeVarieties.trim()) {
                const parsed = JSON.parse(grapeVarieties);
                return Array.isArray(parsed) ? parsed : [];
            }
        } catch (e) {
            // If it's not JSON, try to split by common delimiters
            if (typeof grapeVarieties === 'string') {
                return grapeVarieties.split(/[,;|&]/).map(g => g.trim()).filter(g => g);
            }
        }
        return [];
    }
    
    parseFoodPairings(foodPairings) {
        try {
            if (typeof foodPairings === 'string' && foodPairings.trim()) {
                const parsed = JSON.parse(foodPairings);
                return Array.isArray(parsed) ? parsed : [];
            }
        } catch (e) {
            if (typeof foodPairings === 'string') {
                return foodPairings.split(/[,;|&]/).map(p => p.trim()).filter(p => p);
            }
        }
        return [];
    }
    
    generateWineSummary(wine) {
        const type = wine.wine_type || 'wine';
        const region = wine.region || 'unknown region';
        const year = wine.year || 'unknown vintage';
        const producer = wine.producer || 'Unknown producer';
        
        const summaries = [
            `A distinguished ${type.toLowerCase()} from ${region}, this ${year} vintage showcases ${producer}'s craftsmanship.`,
            `This elegant ${type.toLowerCase()} from ${region} represents the ${year} vintage with exceptional character.`,
            `${producer} has created a remarkable ${type.toLowerCase()} from ${region} in this ${year} vintage.`,
            `Experience the terroir of ${region} in this ${year} ${type.toLowerCase()} from ${producer}.`,
            `A premium ${type.toLowerCase()} selection from ${region}, vintage ${year}, crafted by ${producer}.`
        ];
        
        return summaries[Math.floor(Math.abs(wine.name?.length || 0) % summaries.length)];
    }
    
    getWineTypeIcon(wineType) {
        const icons = {
            'Red': '🍷',
            'White': '🥂',
            'Rosé': '🌹',
            'Sparkling': '🍾',
            'Dessert': '🍯',
            'Fortified': '🥃'
        };
        return icons[wineType] || '🍷';
    }

    parseNumeric(value) {
        if (value === null || value === undefined) {
            return null;
        }

        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : null;
    }

    formatNumber(value) {
        const numeric = this.parseNumeric(value);
        if (numeric === null) {
            return '—';
        }

        return new Intl.NumberFormat().format(numeric);
    }

    formatCurrency(value, { minimumFractionDigits = 0, maximumFractionDigits = 0 } = {}) {
        const numeric = this.parseNumeric(value);
        if (numeric === null) {
            return '—';
        }

        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits,
            maximumFractionDigits
        }).format(numeric);
    }

    getStorageGuidance(wine) {
        if (!wine) {
            return {
                minC: null,
                maxC: null,
                minF: null,
                maxF: null,
                recommendation: null
            };
        }

        return {
            minC: this.parseNumeric(wine.storage_temp_min),
            maxC: this.parseNumeric(wine.storage_temp_max),
            minF: this.parseNumeric(wine.storage_temp_min_f),
            maxF: this.parseNumeric(wine.storage_temp_max_f),
            recommendation: wine.storage_recommendation || null
        };
    }

    getDecantingGuidance(wine) {
        if (!wine) {
            return {
                shouldDecant: false,
                minMinutes: null,
                maxMinutes: null,
                recommendation: null
            };
        }

        const shouldDecant = typeof wine.should_decant === 'boolean'
            ? wine.should_decant
            : (wine.wine_type?.toLowerCase().includes('red') || false);

        return {
            shouldDecant,
            minMinutes: this.parseNumeric(wine.decanting_time_minutes_min),
            maxMinutes: this.parseNumeric(wine.decanting_time_minutes_max),
            recommendation: wine.decanting_recommendation || null
        };
    }

    formatRange(min, max, unit = '') {
        const minVal = this.parseNumeric(min);
        const maxVal = this.parseNumeric(max);

        if (minVal === null && maxVal === null) {
            return null;
        }

        const suffix = unit ? unit : '';

        if (minVal !== null && maxVal !== null) {
            if (minVal === maxVal) {
                return `${minVal}${suffix}`;
            }
            return `${minVal}–${maxVal}${suffix}`;
        }

        const value = minVal ?? maxVal;
        return `${value}${suffix}`;
    }

    formatStorageRange(wine) {
        const storage = this.getStorageGuidance(wine);
        const celsiusRange = this.formatRange(storage.minC, storage.maxC, '°C');
        const fahrenheitRange = this.formatRange(storage.minF, storage.maxF, '°F');

        if (celsiusRange && fahrenheitRange) {
            return `${celsiusRange} (${fahrenheitRange})`;
        }

        return celsiusRange || fahrenheitRange || '—';
    }

    formatDecantingSummary(wine) {
        const decanting = this.getDecantingGuidance(wine);

        if (!decanting.shouldDecant) {
            return decanting.recommendation || 'No decanting needed';
        }

        const minutesRange = this.formatRange(decanting.minMinutes, decanting.maxMinutes, ' min');

        if (minutesRange) {
            return `Decant ${minutesRange}`;
        }

        return decanting.recommendation || 'Decant before service';
    }

    getStorageRecommendation(wine) {
        const storage = this.getStorageGuidance(wine);
        return storage.recommendation || null;
    }

    getDecantingRecommendation(wine) {
        const decanting = this.getDecantingGuidance(wine);
        return decanting.recommendation || (decanting.shouldDecant ? 'Decant before serving to allow the wine to open up.' : 'No decanting required; serve directly from the bottle.');
    }

    getPeakDrinkingWindow(wine) {
        const startOffset = this.parseNumeric(wine.peak_drinking_start);
        const endOffset = this.parseNumeric(wine.peak_drinking_end);
        const vintageYear = this.parseNumeric(wine.year);

        if (startOffset === null && endOffset === null) {
            return null;
        }

        if (vintageYear !== null) {
            const startYear = startOffset !== null ? vintageYear + startOffset : null;
            const endYear = endOffset !== null ? vintageYear + endOffset : null;

            if (startYear && endYear) {
                return `${startYear} – ${endYear}`;
            }
            if (startYear) {
                return `${startYear}+`;
            }
            if (endYear) {
                return `Drink by ${endYear}`;
            }
        }

        if (startOffset !== null && endOffset !== null) {
            return `${startOffset}-${endOffset} yrs`;
        }

        if (startOffset !== null) {
            return `${startOffset}+ yrs`;
        }

        if (endOffset !== null) {
            return `Drink within ${endOffset} yrs`;
        }

        return null;
    }

    parseScore(score) {
        const numeric = this.parseNumeric(score);
        if (numeric === null) {
            return null;
        }

        return Math.max(0, Math.min(100, numeric));
    }

    calculateWineScore(wine) {
        const quality = this.parseScore(wine.quality_score);
        const critic = this.parseScore(wine.critic_score);
        const weather = this.parseScore(wine.weather_score);

        const weightedScores = [
            { value: quality, weight: 0.5 },
            { value: critic, weight: 0.3 },
            { value: weather, weight: 0.2 }
        ];

        let weightedSum = 0;
        let totalWeight = 0;

        weightedScores.forEach(({ value, weight }) => {
            if (value !== null) {
                weightedSum += value * weight;
                totalWeight += weight;
            }
        });

        if (totalWeight === 0) {
            return null;
        }

        return weightedSum / totalWeight;
    }

    getWineScoreData(wine) {
        const qualityScore = this.parseScore(wine.quality_score);
        const criticScore = this.parseScore(wine.critic_score);
        const weatherScore = this.parseScore(wine.weather_score);
        const availableScores = [qualityScore, criticScore, weatherScore].filter(score => score !== null);

        return {
            overallScore: this.calculateWineScore(wine),
            qualityScore,
            criticScore,
            weatherScore,
            hasScores: availableScores.length > 0
        };
    }

    renderScoreValue(score, fallback = '—') {
        const numeric = this.parseNumeric(score);
        if (numeric === null) {
            return fallback;
        }

        const rounded = Math.round(numeric);
        return `${rounded}<span class="score-unit">pts</span>`;
    }

    renderScorePill(label, score) {
        const numeric = this.parseNumeric(score);
        if (numeric === null) {
            return '';
        }

        return `
            <div class="score-pill">
                <span class="pill-label">${label}</span>
                <span class="pill-value">${this.renderScoreValue(numeric)}</span>
            </div>
        `;
    }

    renderWineScoreSummary(wine, variant = 'card') {
        const { overallScore, qualityScore, criticScore, weatherScore, hasScores } = this.getWineScoreData(wine);

        if (!hasScores) {
            return '';
        }

        const variantClass = variant ? ` ${variant}` : '';
        const overallBase = overallScore ?? qualityScore ?? criticScore ?? weatherScore;
        const overallLabel = variant === 'list' ? 'Score' : 'Overall Score';

        const breakdownHtml = [
            this.renderScorePill('Quality', qualityScore),
            this.renderScorePill('Critic', criticScore),
            this.renderScorePill('Weather', weatherScore)
        ].filter(Boolean).join('');

        const showBreakdown = breakdownHtml.trim().length > 0 && variant !== 'list';

        return `
            <div class="wine-score-summary${variantClass}">
                <div class="score-chip overall">
                    <span class="score-label">${overallLabel}</span>
                    <span class="score-value">${this.renderScoreValue(overallBase)}</span>
                </div>
                ${showBreakdown ? `<div class="score-breakdown">${breakdownHtml}</div>` : ''}
            </div>
        `;
    }
    
    // Action methods for wine cards
    reserveWineModal(vintageId, wineName) {
        if (!this.ensureCrewAccess('Crew or admin access required to reserve wines.')) {
            return;
        }

        this.ui.showModal(`Reserve Wine - ${wineName}`, `
            <form id="reserve-wine-form">
                <div class="form-group">
                    <label for="reserve-location">Location</label>
                    <select id="reserve-location" required>
                        <option value="">Select location...</option>
                        <option value="main-cellar">Main Cellar</option>
                        <option value="service-bar">Service Bar</option>
                        <option value="deck-storage">Deck Storage</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="reserve-quantity">Quantity</label>
                    <input type="number" id="reserve-quantity" min="1" value="1" required>
                </div>
                <div class="form-group">
                    <label for="reserve-notes">Notes (Optional)</label>
                    <textarea id="reserve-notes" rows="2" placeholder="Occasion, guest preferences, etc."></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn secondary" onclick="app.ui.hideModal()">Cancel</button>
                    <button type="submit" class="btn primary">Reserve Wine</button>
                </div>
            </form>
        `);
        
        document.getElementById('reserve-wine-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const location = document.getElementById('reserve-location').value;
            const quantity = parseInt(document.getElementById('reserve-quantity').value);
            const notes = document.getElementById('reserve-notes').value;
            
            try {
                // Confirm large quantity reservations
                if (quantity > 5) {
                    try {
                        await this.confirmAction(
                            'Confirm Large Quantity Reservation',
                            `You are about to reserve <strong>${quantity} bottles</strong> of ${wineName}. This is a significant reservation. Are you sure?`,
                            'Yes, Reserve Wine',
                            'Cancel',
                            false
                        );
                    } catch (err) {
                        // User cancelled, show the original modal again
                        this.reserveWineModal(vintageId, wineName);
                        return;
                    }
                }
                
                await this.api.reserveWine(vintageId, location, quantity, notes);
                this.ui.showToast(`Reserved ${quantity} bottle(s) of ${wineName}`, 'success');
                this.ui.hideModal();
                this.loadInventory(); // Refresh inventory
            } catch (error) {
                this.ui.showToast('Failed to reserve wine', 'error');
            }
        });
    }

    consumeWineModal(vintageId, wineName) {
        if (!this.ensureCrewAccess('Crew or admin access required to record service.')) {
            return;
        }

        this.ui.showModal(`Serve Wine - ${wineName}`, `
            <form id="consume-wine-form">
                <div class="form-group">
                    <label for="consume-location">Location</label>
                    <select id="consume-location" required>
                        <option value="">Select location...</option>
                        <option value="main-cellar">Main Cellar</option>
                        <option value="service-bar">Service Bar</option>
                        <option value="deck-storage">Deck Storage</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="consume-quantity">Quantity</label>
                    <input type="number" id="consume-quantity" min="1" value="1" required>
                </div>
                <div class="form-group">
                    <label for="consume-notes">Service Notes</label>
                    <textarea id="consume-notes" rows="2" placeholder="Guest names, occasion, feedback, etc."></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn secondary" onclick="app.ui.hideModal()">Cancel</button>
                    <button type="submit" class="btn primary">Record Service</button>
                </div>
            </form>
        `);
        
        document.getElementById('consume-wine-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const location = document.getElementById('consume-location').value;
            const quantity = parseInt(document.getElementById('consume-quantity').value);
            const notes = document.getElementById('consume-notes').value;
            
            try {
                // Confirm large quantity actions
                if (quantity > 3) {
                    try {
                        await this.confirmAction(
                            'Confirm Large Quantity Service',
                            `You are about to serve <strong>${quantity} bottles</strong> of ${wineName}. This is a large quantity. Are you sure you want to proceed?`,
                            'Yes, Serve Wine',
                            'Cancel',
                            true
                        );
                    } catch (err) {
                        // User cancelled, show the original modal again
                        this.consumeWineModal(vintageId, wineName);
                        return;
                    }
                }
                
                await this.api.consumeWine(vintageId, location, quantity, notes, 'Sommelier');
                this.ui.showToast(`Served ${quantity} bottle(s) of ${wineName}`, 'success');
                this.ui.hideModal();
                this.loadInventory(); // Refresh inventory
            } catch (error) {
                this.ui.showToast('Failed to record wine service', 'error');
            }
        });
    }
    
    viewWineDetails(vintageId) {
        // Show comprehensive wine details in a modal
        this.showWineDetailModal(vintageId);
    }
    
    confirmAction(title, message, confirmText = 'Confirm', cancelText = 'Cancel', isDestructive = false) {
        return new Promise((resolve, reject) => {
            const confirmBtnClass = isDestructive ? 'btn danger' : 'btn primary';
            const modalContent = `
                <div class="confirm-dialog">
                    <div class="confirm-message">
                        <p>${message}</p>
                    </div>
                    <div class="confirm-actions">
                        <button class="btn secondary" id="confirm-cancel">${cancelText}</button>
                        <button class="${confirmBtnClass}" id="confirm-proceed">${confirmText}</button>
                    </div>
                </div>
            `;
            
            this.ui.showModal(title, modalContent);
            
            // Add event listeners
            const cancelBtn = document.getElementById('confirm-cancel');
            const proceedBtn = document.getElementById('confirm-proceed');
            
            const handleCancel = () => {
                this.ui.hideModal();
                reject(new Error('User cancelled action'));
                cleanup();
            };
            
            const handleConfirm = () => {
                this.ui.hideModal();
                resolve(true);
                cleanup();
            };
            
            const cleanup = () => {
                if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
                if (proceedBtn) proceedBtn.removeEventListener('click', handleConfirm);
            };
            
            if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
            if (proceedBtn) proceedBtn.addEventListener('click', handleConfirm);
        });
    }
    
    updateInventoryCount(count) {
        const subtitle = document.querySelector('#inventory-view .view-subtitle');
        if (subtitle) {
            const total = this.fullInventory ? this.fullInventory.length : count;
            if (count === total) {
                subtitle.textContent = `Displaying all ${count} wine${count !== 1 ? 's' : ''} from your cellar collection`;
            } else {
                subtitle.textContent = `Displaying ${count} of ${total} wine${total !== 1 ? 's' : ''} (filtered)`;
            }
        }
    }
    
    handleSearch(query) {
        if (!this.fullInventory) return;
        
        const searchTerm = query.toLowerCase().trim();
        
        if (!searchTerm) {
            // Show all wines if search is empty
            this.displayInventory(this.fullInventory);
            return;
        }
        
        const filteredWines = this.fullInventory.filter(wine => {
            const searchableText = [
                wine.name || '',
                wine.producer || '',
                wine.wine_type || '',
                wine.region || '',
                wine.country || '',
                wine.year ? wine.year.toString() : '',
                wine.location || ''
            ].join(' ').toLowerCase();
            
            return searchableText.includes(searchTerm);
        });
        
        this.displayInventory(filteredWines);
    }
    
    applyFilters() {
        if (!this.fullInventory) return;
        
        const locationFilter = document.getElementById('location-filter')?.value || '';
        const typeFilter = document.getElementById('type-filter')?.value || '';
        const searchTerm = document.getElementById('inventory-search')?.value.toLowerCase().trim() || '';
        
        let filteredWines = this.fullInventory;
        
        // Apply location filter
        if (locationFilter) {
            filteredWines = filteredWines.filter(wine => wine.location === locationFilter);
        }
        
        // Apply type filter
        if (typeFilter) {
            filteredWines = filteredWines.filter(wine => wine.wine_type === typeFilter);
        }
        
        // Apply search filter
        if (searchTerm) {
            filteredWines = filteredWines.filter(wine => {
                const searchableText = [
                    wine.name || '',
                    wine.producer || '',
                    wine.wine_type || '',
                    wine.region || '',
                    wine.country || '',
                    wine.year ? wine.year.toString() : '',
                    wine.location || ''
                ].join(' ').toLowerCase();
                
                return searchableText.includes(searchTerm);
            });
        }
        
        this.displayInventory(filteredWines);
    }

    async handlePairingRequest() {
        const dishInput = document.getElementById('dish-input');
        const occasionSelect = document.getElementById('occasion-select');
        const guestCountInput = document.getElementById('guest-count');
        const preferencesInput = document.getElementById('preferences-input');

        const dish = dishInput.value.trim();
        if (!dish) {
            this.ui.showToast('Please describe the dish', 'error');
            return;
        }

        const context = {
            occasion: occasionSelect.value,
            guestCount: parseInt(guestCountInput.value) || 4
        };

        const guestPreferences = preferencesInput.value.trim();

        try {
            console.log('🍷 Starting pairing request...', { dish, context, guestPreferences });
            this.ui.showLoading('get-pairings-btn', 'Analyzing wine pairings...');
            this.ui.showToast('Analyzing wine pairings with AI...', 'info');
            
            const response = await this.api.getPairings(dish, context, guestPreferences);

            console.log('🍷 Pairing response received:', response);

            if (response && response.success && response.data) {
                const result = response.data;
                const recommendations = Array.isArray(result?.recommendations)
                    ? result.recommendations
                    : Array.isArray(result)
                        ? result
                        : [];

                if (recommendations.length > 0) {
                    this.ui.showToast(`Found ${recommendations.length} wine recommendations!`, 'success');
                } else {
                    this.ui.showToast('No wine pairings found. Try a different dish description.', 'warning');
                }

                this.displayPairings(result);
            } else {
                const errorMessage = response?.error?.message || response?.error || 'Invalid response from server';
                throw new Error(errorMessage);
            }
        } catch (error) {
            console.error('Pairing request failed:', error);
            this.ui.showToast(`Failed to get wine recommendations: ${error.message}`, 'error');
            
            // Still try to show empty results container
            const resultsDiv = document.getElementById('pairing-results');
            const listDiv = document.getElementById('pairing-list');
            if (resultsDiv && listDiv) {
                listDiv.innerHTML = `
                    <div class="no-pairings error">
                        <h4>❌ Error Getting Recommendations</h4>
                        <p>Error: ${error.message}</p>
                        <p>Please try again or contact support.</p>
                    </div>
                `;
                resultsDiv.classList.remove('hidden');
            }
        } finally {
            this.ui.hideLoading('get-pairings-btn');
        }
    }

    displayPairings(pairingsResult) {
        console.log('Displaying pairings:', pairingsResult);
        const resultsDiv = document.getElementById('pairing-results');
        const listDiv = document.getElementById('pairing-list');

        const recommendations = Array.isArray(pairingsResult)
            ? pairingsResult
            : Array.isArray(pairingsResult?.recommendations)
                ? pairingsResult.recommendations
                : [];

        const overviewExplanation = pairingsResult && !Array.isArray(pairingsResult)
            ? pairingsResult.explanation
            : null;

        if (!recommendations || recommendations.length === 0) {
            listDiv.innerHTML = `
                <div class="no-pairings">
                    <h4>🍷 No pairings found</h4>
                    <p>Try a different dish or check your wine inventory.</p>
                </div>
            `;
            resultsDiv.classList.remove('hidden');
            return;
        }

        const overviewHtml = overviewExplanation?.summary
            ? `
                <div class="pairing-explanation-overview fade-in">
                    <h4>🧠 Service rationale</h4>
                    <p>${overviewExplanation.summary}</p>
                    ${this.formatExplanationFactors(overviewExplanation.factors) || ''}
                </div>
            `
            : '';

        const encodedFactors = overviewExplanation?.factors
            ? encodeURIComponent(JSON.stringify(overviewExplanation.factors))
            : '';

        const cardsHtml = recommendations.map((pairing, index) => {
            const wine = pairing.wine || pairing;
            const score = pairing.score || {};
            const reasoning = pairing.reasoning || 'Great wine pairing recommendation!';
            const defaultSummary = pairing.reasoning || overviewExplanation?.summary || 'Service rationale pending.';
            const encodedSummary = encodeURIComponent(defaultSummary);
            const factorAttribute = encodedFactors ? ` data-default-factors="${encodedFactors}"` : '';

            return `
                <div class="pairing-card fade-in" style="animation-delay: ${index * 0.1}s">
                    <div class="wine-header-pairing">
                        <div class="wine-type-badge ${wine.wine_type?.toLowerCase() || 'unknown'}">
                            ${this.getWineTypeIcon(wine.wine_type)} ${wine.wine_type || 'Wine'}
                        </div>
                        <div class="confidence-score">
                            ${score.total ? Math.round(score.total * 100) : (score.confidence ? Math.round(score.confidence * 100) : '90')}%
                        </div>
                    </div>
                    
                    <div class="wine-details">
                        <h4>${wine.name || 'Wine Recommendation'}</h4>
                        <p class="vintage">${wine.producer || 'Producer'} • ${wine.year || 'Vintage'}</p>
                        <p class="region">${this.getDisplayRegion(wine)}</p>
                    </div>

                    <div class="pairing-reasoning">
                        <button type="button" class="reasoning-toggle" aria-expanded="false">
                            <span class="toggle-label">🎯 Why this pairing</span>
                            <span class="toggle-icon" aria-hidden="true">+</span>
                        </button>
                        <div class="reasoning-panel hidden" aria-hidden="true">
                            <p>${reasoning}</p>
                        </div>
                    </div>

                    <div class="explainability-section">
                        <button
                            type="button"
                            class="explainability-toggle"
                            data-entity-type="pairing_recommendation"
                            data-entity-id="${pairing.learning_recommendation_id || ''}"
                            data-default-summary="${encodedSummary}"
                            ${factorAttribute}
                            aria-expanded="false"
                        >
                            🧠 Somm explanation
                        </button>
                        <div class="explainability-panel hidden" aria-hidden="true">
                            <div class="explanation-content">
                                <p class="muted">Select to load saved rationale.</p>
                            </div>
                            ${this.canManageInventory() && pairing.learning_recommendation_id ? `
                                <form class="explanation-form" data-entity-type="pairing_recommendation" data-entity-id="${pairing.learning_recommendation_id}">
                                    <textarea name="summary" rows="2" placeholder="Add a short rationale for service" aria-label="Explanation summary" required></textarea>
                                    <textarea name="factors" rows="2" placeholder="Key factors (one per line)" aria-label="Key factors"></textarea>
                                    <div class="form-actions inline">
                                        <button type="submit" class="btn-small secondary">Save rationale</button>
                                    </div>
                                </form>
                            ` : (!pairing.learning_recommendation_id && this.canManageInventory() ? '<p class="muted crew-note">Rationale capture unavailable for this pairing session.</p>' : '')}
                        </div>
                    </div>

                    <div class="stock-status">
                        ${wine.quantity > 0 ?
                            `<span class="in-stock">✅ ${wine.quantity} bottles available at ${wine.location || 'cellar'}</span>` :
                            '<span class="out-of-stock">❌ Currently not in stock</span>'
                        }
                    </div>
                    
                    ${wine.quantity > 0 ? `
                        <div class="pairing-actions">
                            <button class="btn-small primary" onclick="app.reserveWineModal('${wine.vintage_id || wine.id}', '${(wine.name || "Wine").replace(/'/g, "\\'") }')">Reserve for Pairing</button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        listDiv.innerHTML = `${overviewHtml}${cardsHtml}`;

        resultsDiv.classList.remove('hidden');

        this.initializePairingExplainability(listDiv);

        // Scroll to results when supported
        if (typeof resultsDiv.scrollIntoView === 'function') {
            resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    initializePairingExplainability(container) {
        if (!container) {
            return;
        }

        this.setupPairingReasoning(container);

        const toggles = container.querySelectorAll('.explainability-toggle');
        toggles.forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                this.toggleExplanation(button);
            });
        });

        const forms = container.querySelectorAll('.explanation-form');
        forms.forEach((form) => {
            form.addEventListener('submit', (event) => {
                event.preventDefault();
                this.submitExplanationForm(form);
            });
        });
    }

    setupPairingReasoning(container) {
        const toggles = container.querySelectorAll('.reasoning-toggle');
        if (!toggles.length) {
            return;
        }

        toggles.forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                this.togglePairingReasoning(button);
            });
        });
    }

    togglePairingReasoning(button) {
        if (!button) {
            return;
        }

        const panel = button.nextElementSibling;
        if (!panel) {
            return;
        }

        const icon = button.querySelector('.toggle-icon');
        const isHidden = panel.classList.contains('hidden');

        if (isHidden) {
            panel.classList.remove('hidden');
            panel.setAttribute('aria-hidden', 'false');
            button.setAttribute('aria-expanded', 'true');
            if (icon) {
                icon.textContent = '−';
            }
        } else {
            panel.classList.add('hidden');
            panel.setAttribute('aria-hidden', 'true');
            button.setAttribute('aria-expanded', 'false');
            if (icon) {
                icon.textContent = '+';
            }
        }
    }

    parseDatasetJson(value) {
        if (!value) {
            return undefined;
        }

        try {
            const decoded = decodeURIComponent(value);
            return JSON.parse(decoded);
        } catch (error) {
            return undefined;
        }
    }

    formatTimestamp(value) {
        if (!value) {
            return '';
        }

        try {
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) {
                return '';
            }

            return date.toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short'
            });
        } catch (error) {
            return '';
        }
    }

    formatExplanationFactors(factors) {
        if (!factors) {
            return '';
        }

        if (Array.isArray(factors)) {
            if (factors.length === 0) {
                return '';
            }
            return `<ul class="factor-list">${factors.map((item) => `<li>${item}</li>`).join('')}</ul>`;
        }

        if (typeof factors === 'object') {
            const entries = Object.entries(factors).filter(([, value]) => value !== null && value !== undefined && value !== '');
            if (!entries.length) {
                return '';
            }
            return `<ul class="factor-list">${entries.map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`).join('')}</ul>`;
        }

        return `<p>${factors}</p>`;
    }

    renderExplanationContent(container, explanations, defaultSummary = '', defaultFactors = undefined) {
        if (!container) {
            return;
        }

        const entries = Array.isArray(explanations) ? explanations : [];
        const fragments = [];
        const defaultNote = defaultSummary ? defaultSummary.trim() : '';
        const defaultFactorsHtml = this.formatExplanationFactors(defaultFactors);
        const hasDefaultFactors = Boolean(defaultFactorsHtml && defaultFactorsHtml.trim && defaultFactorsHtml.trim().length);
        const showCrewMessage = this.canManageInventory();

        if (entries.length === 0) {
            if (defaultNote || hasDefaultFactors) {
                fragments.push(`
                    <div class="explanation-entry">
                        ${defaultNote ? `<p>${defaultNote}</p>` : ''}
                        ${defaultNote ? '<p class="explanation-meta">Generated for this session.</p>' : ''}
                        ${defaultFactorsHtml || ''}
                    </div>
                `);
            } else {
                fragments.push(`
                    <p class="muted">No saved rationale yet.${showCrewMessage ? ' Add one below to capture service context.' : ''}</p>
                `);
            }
        } else {
            entries.forEach((entry) => {
                const summary = entry.summary || defaultNote || 'Service rationale';
                const timestamp = this.formatTimestamp(entry.generated_at);
                const factorsHtml = this.formatExplanationFactors(entry.factors);
                fragments.push(`
                    <div class="explanation-entry">
                        <p>${summary}</p>
                        ${timestamp ? `<p class="explanation-meta">Recorded ${timestamp}</p>` : ''}
                        ${factorsHtml || ''}
                    </div>
                `);
            });
        }

        container.innerHTML = fragments.join('');
    }

    async toggleExplanation(button) {
        if (!button) {
            return;
        }

        const panel = button.nextElementSibling;
        if (!panel) {
            return;
        }

        const isHidden = panel.classList.contains('hidden');

        if (!isHidden) {
            panel.classList.add('hidden');
            panel.setAttribute('aria-hidden', 'true');
            button.setAttribute('aria-expanded', 'false');
            return;
        }

        const content = panel.querySelector('.explanation-content');
        if (!content) {
            return;
        }

        button.setAttribute('aria-expanded', 'true');
        panel.classList.remove('hidden');
        panel.setAttribute('aria-hidden', 'false');

        const entityType = button.dataset.entityType;
        const entityId = button.dataset.entityId;
        const defaultSummary = button.dataset.defaultSummary ? decodeURIComponent(button.dataset.defaultSummary) : '';
        const defaultFactors = this.parseDatasetJson(button.dataset.defaultFactors);

        if (!entityType || !entityId) {
            this.renderExplanationContent(content, [], defaultSummary, defaultFactors);
            return;
        }

        const cacheKey = `${entityType}:${entityId}`;

        if (!this.explanationsCache.has(cacheKey)) {
            content.innerHTML = '<div class="loading-inline"><span class="loading-spinner small"></span> Loading explanation...</div>';

            try {
                const response = await this.api.getExplanations(entityType, entityId);
                const explanations = response?.success ? response.data || [] : [];
                this.explanationsCache.set(cacheKey, explanations);
            } catch (error) {
                console.error('Failed to load explanations', error);
                content.innerHTML = `<p class="error-text">Unable to load rationale: ${error.message || 'Unexpected error'}</p>`;
                return;
            }
        }

        const explanations = this.explanationsCache.get(cacheKey) || [];
        this.renderExplanationContent(content, explanations, defaultSummary, defaultFactors);
    }

    async submitExplanationForm(form) {
        if (!form) {
            return;
        }

        const entityType = form.dataset.entityType;
        const entityId = form.dataset.entityId;

        if (!entityType || !entityId) {
            this.ui.showToast('Unable to determine recommendation reference.', 'error');
            return;
        }

        const summaryField = form.querySelector('textarea[name="summary"]');
        const factorsField = form.querySelector('textarea[name="factors"]');
        const submitButton = form.querySelector('button[type="submit"]');

        const summary = summaryField?.value.trim();
        if (!summary) {
            this.ui.showToast('Please add a short summary before saving.', 'warning');
            return;
        }

        const factors = (factorsField?.value || '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.classList.add('loading');
        }

        try {
            const response = await this.api.createExplanation({
                entityType,
                entityId,
                summary,
                factors: factors.length ? factors : undefined,
                generatedAt: new Date().toISOString()
            });

            if (!response?.success) {
                throw new Error('Failed to save explanation');
            }

            const cacheKey = `${entityType}:${entityId}`;
            const existing = this.explanationsCache.get(cacheKey) || [];
            this.explanationsCache.set(cacheKey, [response.data, ...existing]);

            const panel = form.closest('.explainability-panel');
            const content = panel?.querySelector('.explanation-content');
            const toggle = form.closest('.explainability-section')?.querySelector('.explainability-toggle');
            const defaultSummary = toggle?.dataset?.defaultSummary ? decodeURIComponent(toggle.dataset.defaultSummary) : '';
            const defaultFactors = toggle?.dataset?.defaultFactors ? this.parseDatasetJson(toggle.dataset.defaultFactors) : undefined;

            if (content) {
                this.renderExplanationContent(content, this.explanationsCache.get(cacheKey), defaultSummary, defaultFactors);
            }

            if (summaryField) {
                summaryField.value = '';
            }

            if (factorsField) {
                factorsField.value = '';
            }

            this.ui.showToast('Saved rationale for this recommendation.', 'success');
        } catch (error) {
            console.error('Failed to save explanation', error);
            this.ui.showToast(error.message || 'Unable to save rationale', 'error');
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.classList.remove('loading');
            }
        }
    }

    renderServiceNotesSection({
        subjectType,
        subjectId,
        subjectLabel = '',
        heading = '📝 Service notes',
        buttonLabel = 'View service notes',
        introText = 'Select to load service notes for this record.'
    } = {}) {
        const idValue = subjectId !== undefined && subjectId !== null ? String(subjectId) : '';

        if (!subjectType || !idValue) {
            return `
                <div class="wine-detail-section service-notes-section memories-section">
                    <h4>${heading}</h4>
                    <p class="muted">Service notes become available once this record is saved.</p>
                </div>
            `;
        }

        const encodedLabel = subjectLabel ? encodeURIComponent(subjectLabel) : '';
        const canCaptureNotes = this.canManageInventory();

        return `
            <div class="wine-detail-section service-notes-section memories-section">
                <h4>${heading}</h4>
                <div class="memories-accordion">
                    <button
                        type="button"
                        class="memories-toggle"
                        data-subject-type="${subjectType}"
                        data-subject-id="${idValue}"
                        data-subject-label="${encodedLabel}"
                        aria-expanded="false"
                    >
                        ${buttonLabel}
                    </button>
                    <div class="memories-panel hidden" aria-hidden="true">
                        <div class="memory-list" data-subject-label="${encodedLabel}" data-empty-copy="notes">
                            <p class="muted">${introText}</p>
                        </div>
                        ${canCaptureNotes ? `
                            <form class="memory-form" data-subject-type="${subjectType}" data-subject-id="${idValue}">
                                <textarea name="note" rows="2" placeholder="Add a service note or guest memory" aria-label="Service note" required></textarea>
                                <input type="text" name="tags" placeholder="Tags (comma separated)" aria-label="Service note tags">
                                <div class="form-actions inline">
                                    <button type="submit" class="btn-small secondary">Save note</button>
                                </div>
                            </form>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    initializeMemorySection({ subjectType, subjectId, subjectLabel }) {
        const modalBody = document.getElementById('modal-body');
        if (!modalBody) {
            return;
        }

        const encodedLabel = subjectLabel ? encodeURIComponent(subjectLabel) : '';
        const toggles = modalBody.querySelectorAll('.memories-toggle');
        toggles.forEach((toggle) => {
            if (subjectType && !toggle.dataset.subjectType) {
                toggle.dataset.subjectType = subjectType;
            }
            if (subjectId && !toggle.dataset.subjectId) {
                toggle.dataset.subjectId = subjectId;
            }
            if (encodedLabel && !toggle.dataset.subjectLabel) {
                toggle.dataset.subjectLabel = encodedLabel;
            }

            toggle.addEventListener('click', (event) => {
                event.preventDefault();
                this.toggleMemories(toggle);
            });
        });

        const forms = modalBody.querySelectorAll('.memory-form');
        forms.forEach((form) => {
            if (subjectType && !form.dataset.subjectType) {
                form.dataset.subjectType = subjectType;
            }
            if (subjectId && !form.dataset.subjectId) {
                form.dataset.subjectId = subjectId;
            }

            form.addEventListener('submit', (event) => {
                event.preventDefault();
                this.submitMemoryForm(form);
            });
        });
    }

    renderMemories(container, memories, subjectLabel = '') {
        if (!container) {
            return;
        }

        const entries = Array.isArray(memories) ? memories : [];
        const labelText = subjectLabel ? decodeURIComponent(subjectLabel) : '';
        const crewMessage = this.canManageInventory();
        const noun = container.dataset?.emptyCopy || 'notes';

        if (entries.length === 0) {
            container.innerHTML = `<p class="muted">No ${noun} recorded${labelText ? ` for ${labelText}` : ''}.${crewMessage ? ' Add one to capture service context.' : ''}</p>`;
            return;
        }

        const listMarkup = entries.map((entry) => {
            const timestamp = this.formatTimestamp(entry.created_at);
            const tags = Array.isArray(entry.tags)
                ? entry.tags
                : entry.tags
                ? [entry.tags]
                : [];
            const tagsMarkup = tags.length
                ? `<ul class="tag-list">${tags.map((tag) => `<li>${tag}</li>`).join('')}</ul>`
                : '';
            const author = entry.author_id ? ` • ${entry.author_id}` : '';

            return `
                <div class="memory-entry">
                    <p>${entry.note}</p>
                    ${tagsMarkup}
                    ${timestamp || author ? `<p class="memory-meta">${timestamp ? `Logged ${timestamp}` : 'Crew note'}${author}</p>` : ''}
                </div>
            `;
        }).join('');

        container.innerHTML = listMarkup;
    }

    async toggleMemories(button) {
        if (!button) {
            return;
        }

        const panel = button.nextElementSibling;
        if (!panel) {
            return;
        }

        const isHidden = panel.classList.contains('hidden');

        if (!isHidden) {
            panel.classList.add('hidden');
            panel.setAttribute('aria-hidden', 'true');
            button.setAttribute('aria-expanded', 'false');
            return;
        }

        const list = panel.querySelector('.memory-list');
        if (!list) {
            return;
        }

        button.setAttribute('aria-expanded', 'true');
        panel.classList.remove('hidden');
        panel.setAttribute('aria-hidden', 'false');

        const subjectType = button.dataset.subjectType;
        const subjectId = button.dataset.subjectId;
        const subjectLabel = button.dataset.subjectLabel || list.dataset.subjectLabel || '';

        if (!subjectType || !subjectId) {
            list.innerHTML = '<p class="muted">Service notes are unavailable for this selection.</p>';
            return;
        }

        const cacheKey = `${subjectType}:${subjectId}`;

        if (!this.memoriesCache.has(cacheKey)) {
            list.innerHTML = '<div class="loading-inline"><span class="loading-spinner small"></span> Loading notes...</div>';

            try {
                const response = await this.api.getMemories(subjectType, subjectId);
                const memories = response?.success ? response.data || [] : [];
                this.memoriesCache.set(cacheKey, memories);
            } catch (error) {
                console.error('Failed to load memories', error);
                list.innerHTML = `<p class="error-text">Unable to load notes: ${error.message || 'Unexpected error'}</p>`;
                return;
            }
        }

        this.renderMemories(list, this.memoriesCache.get(cacheKey), subjectLabel);
    }

    async submitMemoryForm(form) {
        if (!form) {
            return;
        }

        const subjectType = form.dataset.subjectType;
        const subjectId = form.dataset.subjectId;

        if (!subjectType || !subjectId) {
            this.ui.showToast('Unable to determine memory subject.', 'error');
            return;
        }

        const noteField = form.querySelector('textarea[name="note"]');
        const tagsField = form.querySelector('input[name="tags"]');
        const submitButton = form.querySelector('button[type="submit"]');

        const note = noteField?.value.trim();
        if (!note) {
            this.ui.showToast('Please add a note before saving.', 'warning');
            return;
        }

        const tags = (tagsField?.value || '')
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean);

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.classList.add('loading');
        }

        try {
            const response = await this.api.createMemory({
                subjectType,
                subjectId,
                note,
                tags: tags.length ? tags : undefined
            });

            if (!response?.success) {
                throw new Error('Failed to save memory');
            }

            const cacheKey = `${subjectType}:${subjectId}`;
            const existing = this.memoriesCache.get(cacheKey) || [];
            this.memoriesCache.set(cacheKey, [response.data, ...existing]);

            const panel = form.closest('.memories-panel');
            const list = panel?.querySelector('.memory-list');
            const subjectLabel = panel?.previousElementSibling?.dataset?.subjectLabel || list?.dataset?.subjectLabel || '';

            if (list) {
                this.renderMemories(list, this.memoriesCache.get(cacheKey), subjectLabel);
            }

            if (noteField) {
                noteField.value = '';
            }

            if (tagsField) {
                tagsField.value = '';
            }

            this.ui.showToast('Saved memory note.', 'success');
        } catch (error) {
            console.error('Failed to save memory', error);
            this.ui.showToast(error.message || 'Unable to save memory', 'error');
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.classList.remove('loading');
            }
        }
    }

    handleQuickAction(action) {
        switch (action) {
            case 'quick-pairing':
                this.navigateToView('pairing');
                break;
            case 'record-consumption':
                if (!this.ensureCrewAccess('Crew or admin access required to record consumption.')) {
                    return;
                }
                this.showConsumptionModal();
                break;
            case 'check-stock':
                this.navigateToView('inventory');
                break;
        }
    }

    async showConsumptionModal() {
        if (!this.ensureCrewAccess('Crew or admin access required to record consumption.')) {
            return;
        }

        try {
            // Get current inventory to populate wine selection
            const inventory = await this.api.getInventory({ available_only: true });
            const wines = inventory.success ? inventory.data || [] : [];
            
            const wineOptions = wines.length > 0 ? 
                wines.map(wine => `
                    <option value="${wine.vintage_id || wine.id}" data-max="${wine.quantity || 0}">
                        ${wine.name} (${wine.producer}) - ${wine.quantity || 0} bottles available
                    </option>
                `).join('') : '<option value="">No wines available</option>';
            
            this.ui.showModal('Record Wine Service', `
                <form id="consumption-form">
                    <div class="form-group">
                        <label for="wine-select">Select Wine</label>
                        <select id="wine-select" required>
                            <option value="">Choose wine to serve...</option>
                            ${wineOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="bottles-consumed">Bottles Consumed</label>
                        <input type="number" id="bottles-consumed" min="1" max="1" step="1" required>
                        <small class="form-help">Maximum bottles available will be shown based on selection</small>
                    </div>
                    <div class="form-group">
                        <label for="service-occasion">Occasion</label>
                        <select id="service-occasion">
                            <option value="">Select occasion...</option>
                            <option value="dinner">Dinner Service</option>
                            <option value="reception">Reception</option>
                            <option value="celebration">Celebration</option>
                            <option value="tasting">Wine Tasting</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="guest-count">Number of Guests</label>
                        <input type="number" id="guest-count" min="1" step="1" placeholder="Optional">
                    </div>
                    <div class="form-group">
                        <label for="service-notes">Service Notes</label>
                        <textarea id="service-notes" rows="3" placeholder="Food pairings, guest feedback, occasion details..."></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn secondary" onclick="app.ui.hideModal()">Cancel</button>
                        <button type="submit" class="btn primary">Record Service</button>
                    </div>
                </form>
            `);
            
            // Add dynamic max quantity update
            const wineSelect = document.getElementById('wine-select');
            const quantityInput = document.getElementById('bottles-consumed');
            
            wineSelect.addEventListener('change', (e) => {
                const selectedOption = e.target.selectedOptions[0];
                const maxQuantity = parseInt(selectedOption ? selectedOption.dataset.max : 1, 10);
                quantityInput.max = maxQuantity;
                quantityInput.value = Math.min(parseInt(quantityInput.value, 10) || 1, maxQuantity);
            });
            
            // Prevent negative and non-integer values
            quantityInput.addEventListener('input', (e) => {
                const value = parseInt(e.target.value, 10);
                if (isNaN(value) || value < 1) {
                    e.target.value = 1;
                } else if (value > parseInt(e.target.max, 10)) {
                    e.target.value = e.target.max;
                }
            });
            
            // Handle form submission
            document.getElementById('consumption-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleConsumptionSubmission(e);
            });
            
        } catch (error) {
            console.error('Error loading consumption modal:', error);
            this.ui.showModal('Record Wine Service', `
                <p>Error loading wine inventory. Please try again.</p>
                <button class="btn secondary" onclick="app.ui.hideModal()">Close</button>
            `);
        }
    }

    async handleConsumptionSubmission(e) {
        try {
            const formData = new FormData(e.target);
            const wineId = document.getElementById('wine-select').value;
            const quantity = parseInt(document.getElementById('bottles-consumed').value);
            const occasion = document.getElementById('service-occasion').value;
            const guestCount = document.getElementById('guest-count').value;
            const notes = document.getElementById('service-notes').value;
            
            // Validate inputs
            if (!wineId || !quantity) {
                this.ui.showToast('Please select a wine and quantity', 'error');
                return;
            }
            
            if (quantity < 1 || !Number.isInteger(quantity)) {
                this.ui.showToast('Quantity must be a positive whole number', 'error');
                return;
            }
            
            // Create consumption record
            const consumptionData = {
                vintage_id: wineId,
                quantity_consumed: quantity,
                occasion: occasion || 'service',
                guest_count: guestCount ? parseInt(guestCount) : null,
                notes: notes || '',
                service_date: new Date().toISOString()
            };
            
            // Submit consumption record to backend API
            await this.api.recordConsumption(consumptionData);
            
            this.ui.showToast(`Successfully recorded service of ${quantity} bottle(s)`, 'success');
            this.ui.hideModal();
            
            // Refresh dashboard data
            await this.loadDashboardData();
            
        } catch (error) {
            console.error('Error recording consumption:', error);
            this.ui.showToast('Failed to record wine service', 'error');
        }
    }

    async showWineDetailModal(wineId) {
        try {
            // Show loading modal first
            this.ui.showModal('Wine Details', `
                <div class="wine-detail-loading">
                    <div class="loading-spinner"></div>
                    <p>Loading wine information...</p>
                </div>
            `);
            
            // Get detailed wine information
            const wineDetails = await this.api.getWineDetails(wineId);
            
            if (!wineDetails.success) {
                throw new Error('Failed to load wine details');
            }
            
            const wine = wineDetails.data;
            this.displayWineDetailModal(wine);
            
        } catch (error) {
            console.error('Error loading wine details:', error);
            this.ui.showModal('Wine Details', `
                <div class="error-content">
                    <h4>❌ Error Loading Wine Details</h4>
                    <p>Could not load detailed information for this wine.</p>
                    <button class="btn secondary" onclick="app.ui.hideModal()">Close</button>
                </div>
            `);
        }
    }

    displayWineDetailModal(wine) {
        const grapeVarieties = this.parseGrapeVarieties(wine.grape_varieties);
        const foodPairings = this.parseFoodPairings(wine.food_pairings);
        const tastingNotes = wine.tasting_notes ? wine.tasting_notes.split(',').map(note => note.trim()) : [];

        // Calculate wine age and drinking window
        const currentYear = new Date().getFullYear();
        const wineAge = wine.year ? currentYear - wine.year : null;
        const isVintage = wine.year && wine.year > 1900;

        // Get wine scores
        const wineScores = this.getWineScoreData(wine);
        
        // Get storage and serving guidance
        const storageRange = this.formatStorageRange(wine);
        const decantingSummary = this.formatDecantingSummary(wine);
        const peakDrinkingWindow = this.getPeakDrinkingWindow(wine);
        const storageRecommendation = this.getStorageRecommendation(wine);
        const decantingRecommendation = this.getDecantingRecommendation(wine);

        // Generate vintage intelligence
        const vintageIntelligence = this.generateVintageIntelligence(wine, wineAge);
        const memorySubjectType = wine.vintage_id ? 'vintage' : 'wine';
        const memorySubjectId = wine.vintage_id || wine.id || wine.wine_id || '';
        const encodedSubjectLabel = encodeURIComponent(wine.name || 'Wine');
        const isGuest = this.isGuestUser();

        const modalContent = `
            <div class="wine-detail-modal">
                <div class="wine-detail-header">
                    <div class="wine-main-info">
                        <div class="wine-type-badge large ${wine.wine_type?.toLowerCase() || 'unknown'}">
                            ${this.getWineTypeIcon(wine.wine_type)} ${wine.wine_type || 'Wine'}
                        </div>
                        <h2>${wine.name || 'Unknown Wine'}</h2>
                        <p class="wine-producer">${wine.producer || 'Unknown Producer'}</p>
                        <div class="wine-vintage-info">
                            ${isVintage ? `<span class="vintage">${wine.year}</span>` : ''}
                            <span class="region">${this.getDisplayRegion(wine)}</span>
                            ${wine.country ? `<span class="country">${wine.country}</span>` : ''}
                        </div>
                    </div>
                    
                    <div class="wine-stats-summary">
                        <div class="stat-item">
                            <div class="stat-value">${wine.quantity || 0}</div>
                            <div class="stat-label">Bottles</div>
                        </div>
                        ${!isGuest && wine.cost_per_bottle ? `
                            <div class="stat-item">
                                <div class="stat-value">$${parseFloat(wine.cost_per_bottle).toFixed(2)}</div>
                                <div class="stat-label">Per Bottle</div>
                            </div>
                        ` : ''}
                        ${wineAge ? `
                            <div class="stat-item">
                                <div class="stat-value">${wineAge}</div>
                                <div class="stat-label">Years Old</div>
                            </div>
                        ` : ''}
                        ${wineScores.hasScores && wineScores.overallScore ? `
                            <div class="stat-item">
                                <div class="stat-value">${Math.round(wineScores.overallScore)}</div>
                                <div class="stat-label">Score</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="wine-detail-content">
                    ${!isGuest ? `
                        <div class="wine-detail-section">
                            <h4>📍 Location & Stock</h4>
                            <div class="location-info">
                                <p><strong>Storage Location:</strong> ${wine.location || 'Unknown'}</p>
                                <p><strong>Available Quantity:</strong> ${wine.quantity || 0} bottles</p>
                                ${wine.reserved_quantity ? `<p><strong>Reserved:</strong> ${wine.reserved_quantity} bottles</p>` : ''}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${wineScores.hasScores ? `
                        <div class="wine-detail-section">
                            <h4>⭐ Wine Scores</h4>
                            <div class="wine-scores-detail">
                                ${wineScores.overallScore ? `
                                    <div class="score-item-detail">
                                        <span class="score-label-detail">Overall Score:</span>
                                        <span class="score-value-detail">${Math.round(wineScores.overallScore)} / 100</span>
                                    </div>
                                ` : ''}
                                ${wineScores.qualityScore ? `
                                    <div class="score-item-detail">
                                        <span class="score-label-detail">Quality:</span>
                                        <span class="score-value-detail">${Math.round(wineScores.qualityScore)} pts</span>
                                    </div>
                                ` : ''}
                                ${wineScores.criticScore ? `
                                    <div class="score-item-detail">
                                        <span class="score-label-detail">Critic Score:</span>
                                        <span class="score-value-detail">${Math.round(wineScores.criticScore)} pts</span>
                                    </div>
                                ` : ''}
                                ${wineScores.weatherScore ? `
                                    <div class="score-item-detail">
                                        <span class="score-label-detail">Vintage Weather:</span>
                                        <span class="score-value-detail">${Math.round(wineScores.weatherScore)} pts</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${storageRange !== '—' || storageRecommendation ? `
                        <div class="wine-detail-section">
                            <h4>🌡️ Storage & Serving</h4>
                            <div class="storage-guidance">
                                ${storageRange !== '—' ? `<p><strong>Storage Temperature:</strong> ${storageRange}</p>` : ''}
                                ${storageRecommendation ? `<p class="guidance-text">${storageRecommendation}</p>` : ''}
                                ${decantingSummary ? `<p><strong>Decanting:</strong> ${decantingSummary}</p>` : ''}
                                ${decantingRecommendation && decantingSummary !== 'No decanting needed' ? `<p class="guidance-text">${decantingRecommendation}</p>` : ''}
                                ${peakDrinkingWindow ? `<p><strong>Peak Drinking Window:</strong> ${peakDrinkingWindow}</p>` : ''}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${grapeVarieties.length > 0 ? `
                        <div class="wine-detail-section">
                            <h4>🍇 Grape Varieties</h4>
                            <div class="grape-varieties">
                                ${grapeVarieties.map(grape => `<span class="grape-tag">${grape}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${tastingNotes.length > 0 ? `
                        <div class="wine-detail-section">
                            <h4>👃 Tasting Notes</h4>
                            <div class="tasting-notes">
                                ${tastingNotes.map(note => `<span class="tasting-note">${note}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${foodPairings.length > 0 ? `
                        <div class="wine-detail-section">
                            <h4>🍽️ Food Pairings</h4>
                            <div class="food-pairings">
                                ${foodPairings.map(pairing => `<span class="pairing-tag">${pairing}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="wine-detail-section">
                        <h4>🧠 Vintage Intelligence</h4>
                        <div class="vintage-intelligence">
                            ${vintageIntelligence}
                        </div>
                    </div>
                    
                    ${wine.description ? `
                        <div class="wine-detail-section">
                            <h4>📖 Description</h4>
                            <p class="wine-description">${wine.description}</p>
                        </div>
                    ` : ''}

                    ${this.renderServiceNotesSection({
                        subjectType: memorySubjectType,
                        subjectId: memorySubjectId,
                        subjectLabel: wine.name || 'Wine',
                        heading: '📝 Service notes',
                        buttonLabel: 'View service notes',
                        introText: 'Select to load service notes and guest insights for this wine.'
                    })}

                    <div class="wine-detail-section">
                        <h4>📈 Wine History</h4>
                        <div id="wine-history-${wine.vintage_id || wine.id}" class="wine-history">
                            <div class="loading-spinner"></div>
                            <p>Loading wine history...</p>
                        </div>
                    </div>
                </div>
                
                <div class="wine-detail-actions">
                    <button class="btn secondary" onclick="app.ui.hideModal()">Close</button>
                    ${!isGuest && wine.quantity > 0 ? `
                        <button class="btn primary" onclick="app.reserveWineModal('${wine.vintage_id || wine.id}', '${(wine.name || "Unknown").replace(/'/g, "\\'") }')">🍷 Reserve Wine</button>
                        <button class="btn success" onclick="app.consumeWineModal('${wine.vintage_id || wine.id}', '${(wine.name || "Unknown").replace(/'/g, "\\'") }')">🥂 Serve Wine</button>
                    ` : ''}
                    ${isGuest ? `
                        <div class="guest-notice-modal">
                            <span>🔒 Reserve and serve actions require crew access</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        this.ui.showModal('Wine Details', modalContent);

        // Load wine history asynchronously
        this.loadWineHistory(wine.vintage_id || wine.id);
        this.initializeMemorySection({
            subjectType: memorySubjectType,
            subjectId: memorySubjectId,
            subjectLabel: wine.name || 'Wine'
        });
    }

    showEventDetails(eventData = {}) {
        if (!eventData) {
            this.ui.showToast('Event details unavailable.', 'error');
            return;
        }

        const rawEventId = eventData.id || eventData.event_id || eventData.slug || '';
        const hasEventId = rawEventId !== undefined && rawEventId !== null && String(rawEventId).trim() !== '';
        const eventId = hasEventId ? String(rawEventId) : '';
        const name = eventData.name || eventData.title || 'Guest experience';
        const location = eventData.location || eventData.venue || eventData.place || '';
        const host = eventData.host || eventData.organizer || eventData.owner || '';
        const guestCount = eventData.guest_count || eventData.expected_guests || (Array.isArray(eventData.guests) ? eventData.guests.length : null);
        const startTime = eventData.start_time || eventData.start || eventData.scheduled_for || eventData.date || '';
        const endTime = eventData.end_time || eventData.end || eventData.ends_at || '';
        const overview = eventData.summary || eventData.description || eventData.notes || '';

        const startDisplay = startTime ? this.formatTimestamp(startTime) : '';
        const endDisplay = endTime ? this.formatTimestamp(endTime) : '';

        const scheduleParts = [];
        if (startDisplay) {
            scheduleParts.push(startDisplay);
        }
        if (endDisplay) {
            scheduleParts.push(endDisplay);
        }

        const scheduleMarkup = scheduleParts.length
            ? `<p><strong>When:</strong> ${scheduleParts.join(' – ')}</p>`
            : '';

        const locationMarkup = location
            ? `<p><strong>Where:</strong> ${location}</p>`
            : '';

        const guestMarkup = guestCount
            ? `<p><strong>Guests:</strong> ${guestCount}</p>`
            : '';

        const hostMarkup = host
            ? `<p><strong>Host:</strong> ${host}</p>`
            : '';

        const wines = Array.isArray(eventData.wines)
            ? eventData.wines
            : (Array.isArray(eventData.pairings) ? eventData.pairings : []);

        const wineListMarkup = wines.length
            ? `
                <div class="event-section">
                    <h4>Featured wines</h4>
                    <ul class="event-wine-list">
                        ${wines.map((wine) => {
                            if (!wine) {
                                return '';
                            }

                            if (typeof wine === 'string') {
                                return `<li>${wine}</li>`;
                            }

                            const wineName = wine.name || wine.label || 'Wine';
                            const wineYear = wine.year || wine.vintage || '';
                            const role = wine.role || wine.assignment || wine.course || '';
                            const descriptor = [wineName, wineYear].filter(Boolean).join(' • ') || wineName;
                            const roleMarkup = role ? `<span class="event-wine-role">${role}</span>` : '';

                            return `<li>${descriptor}${roleMarkup}</li>`;
                        }).join('')}
                    </ul>
                </div>
            `
            : '';

        const serviceNotesSection = this.renderServiceNotesSection({
            subjectType: hasEventId ? 'event' : null,
            subjectId: eventId,
            subjectLabel: name,
            heading: '📝 Service notes',
            buttonLabel: 'View service notes',
            introText: 'Select to load service notes captured for this event.'
        });

        const modalContent = `
            <div class="event-detail-modal">
                <div class="event-header">
                    <div class="event-title-block">
                        <h2>${name}</h2>
                        ${scheduleMarkup}
                        ${locationMarkup}
                        ${guestMarkup}
                        ${hostMarkup}
                    </div>
                </div>
                ${overview ? `
                    <div class="event-section">
                        <h4>Overview</h4>
                        <p>${overview}</p>
                    </div>
                ` : ''}
                ${wineListMarkup}
                ${serviceNotesSection}
                <div class="event-detail-actions">
                    <button class="btn secondary" onclick="app.ui.hideModal()">Close</button>
                </div>
            </div>
        `;

        this.ui.showModal('Event details', modalContent);

        if (hasEventId) {
            this.initializeMemorySection({
                subjectType: 'event',
                subjectId: eventId,
                subjectLabel: name
            });
        }
    }

    generateVintageIntelligence(wine, wineAge) {
        const intelligence = [];
        
        // Age assessment
        if (wineAge && wine.wine_type) {
            const type = wine.wine_type.toLowerCase();
            let ageAssessment = '';
            
            if (type.includes('red')) {
                if (wineAge < 3) {
                    ageAssessment = 'Young wine - may benefit from aging or decanting';
                } else if (wineAge < 10) {
                    ageAssessment = 'Mature wine - likely at optimal drinking condition';
                } else if (wineAge < 20) {
                    ageAssessment = 'Well-aged wine - complex flavors developed';
                } else {
                    ageAssessment = 'Vintage wine - rare and potentially exceptional';
                }
            } else if (type.includes('white')) {
                if (wineAge < 2) {
                    ageAssessment = 'Fresh wine - best consumed young';
                } else if (wineAge < 8) {
                    ageAssessment = 'Mature white - developed complexity';
                } else {
                    ageAssessment = 'Aged white wine - unique character';
                }
            }
            
            if (ageAssessment) {
                intelligence.push(`<p><strong>Age Assessment:</strong> ${ageAssessment}</p>`);
            }
        }
        
        // Region insights
        if (wine.region) {
            const regionInsights = this.getRegionInsights(wine.region, wine.wine_type);
            if (regionInsights) {
                intelligence.push(`<p><strong>Region Character:</strong> ${regionInsights}</p>`);
            }
        }
        
        // Value assessment
        if (wine.cost_per_bottle) {
            const cost = parseFloat(wine.cost_per_bottle);
            let valueAssessment = '';
            
            if (cost < 25) {
                valueAssessment = 'Great everyday drinking wine';
            } else if (cost < 75) {
                valueAssessment = 'Quality wine for special occasions';
            } else if (cost < 150) {
                valueAssessment = 'Premium wine - reserve for important events';
            } else {
                valueAssessment = 'Ultra-premium wine - rare and exceptional';
            }
            
            intelligence.push(`<p><strong>Value Category:</strong> ${valueAssessment}</p>`);
        }
        
        // Serving suggestions
        const servingSuggestions = this.getServingSuggestions(wine.wine_type);
        if (servingSuggestions) {
            intelligence.push(`<p><strong>Serving Suggestion:</strong> ${servingSuggestions}</p>`);
        }
        
        return intelligence.length > 0 ? intelligence.join('') : '<p>No vintage intelligence available for this wine.</p>';
    }

    getRegionInsights(region, wineType) {
        const insights = {
            'bordeaux': 'Classic French elegance with structured tannins and aging potential',
            'burgundy': 'Exceptional terroir expression with subtle complexity',
            'champagne': 'Traditional méthode champenoise with fine bubbles and prestige',
            'napa valley': 'Bold, fruit-forward wines with modern winemaking excellence',
            'tuscany': 'Italian heritage with rich character and food-friendly style',
            'rioja': 'Spanish tradition with oak aging and remarkable longevity',
            'piedmont': 'Noble wines with intense aromatics and structured elegance'
        };
        
        return insights[region.toLowerCase()] || null;
    }

    getServingSuggestions(wineType) {
        const suggestions = {
            'Red': 'Serve at 16-18°C (60-65°F). Consider decanting 30-60 minutes before serving',
            'White': 'Serve chilled at 8-12°C (45-55°F). Remove from refrigerator 10 minutes before serving',
            'Sparkling': 'Serve well-chilled at 6-8°C (43-46°F). Open carefully to preserve bubbles',
            'Rosé': 'Serve chilled at 8-10°C (46-50°F). Perfect for warm weather occasions',
            'Dessert': 'Serve slightly chilled at 10-12°C (50-55°F). Pair with desserts or enjoy alone'
        };
        
        return suggestions[wineType] || 'Serve at appropriate temperature for wine type';
    }

    async loadWineHistory(wineId) {
        try {
            const historyContainer = document.getElementById(`wine-history-${wineId}`);
            if (!historyContainer) return;
            
            const history = await this.api.getLedgerHistory(wineId, 10);
            
            if (history.success && history.data && history.data.length > 0) {
                historyContainer.innerHTML = `
                    <div class="history-timeline">
                        ${history.data.map(entry => `
                            <div class="history-entry">
                                <div class="history-icon">${this.getHistoryIcon(entry.transaction_type)}</div>
                                <div class="history-content">
                                    <div class="history-action">${this.formatHistoryAction(entry)}</div>
                                    <div class="history-details">${entry.notes || ''}</div>
                                    <div class="history-time">${this.getTimeAgo(entry.created_at)}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                historyContainer.innerHTML = '<p>No history available for this wine.</p>';
            }
        } catch (error) {
            console.error('Error loading wine history:', error);
            const historyContainer = document.getElementById(`wine-history-${wineId}`);
            if (historyContainer) {
                historyContainer.innerHTML = '<p>Could not load wine history.</p>';
            }
        }
    }

    getHistoryIcon(transactionType) {
        const icons = {
            'receive': '📦',
            'consume': '🥂',
            'reserve': '🍷',
            'move': '📍',
            'adjust': '⚙️'
        };
        return icons[transactionType] || '📋';
    }

    formatHistoryAction(entry) {
        const actions = {
            'receive': `Received ${entry.quantity} bottles`,
            'consume': `Consumed ${Math.abs(entry.quantity)} bottles`,
            'reserve': `Reserved ${entry.quantity} bottles`,
            'move': `Moved ${entry.quantity} bottles`,
            'adjust': `Inventory adjusted by ${entry.quantity} bottles`
        };
        return actions[entry.transaction_type] || `${entry.transaction_type} - ${entry.quantity} bottles`;
    }

    getConsumptionForm() {
        return `
            <form id="consumption-form">
                <div class="form-group">
                    <label for="wine-select">Wine</label>
                    <select id="wine-select" required>
                        <option value="">Select wine...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="bottles-consumed">Bottles Consumed</label>
                    <input type="number" id="bottles-consumed" min="1" step="1" required>
                </div>
                <div class="form-group">
                    <label for="service-notes">Notes</label>
                    <textarea id="service-notes" rows="3"></textarea>
                </div>
                <button type="submit" class="btn primary">Record Service</button>
            </form>
        `;
    }

    
    createWineTypesChart(wines) {
        const ctx = document.getElementById('wine-types-chart');
        if (!ctx) return;
        
        // Count wine types
        const typeCounts = {};
        wines.forEach(wine => {
            const type = wine.wine_type || 'Unknown';
            typeCounts[type] = (typeCounts[type] || 0) + (wine.quantity || 0);
        });
        
        const colors = {
            'Red': '#b91c1c',
            'White': '#f59e0b', 
            'Sparkling': '#6366f1',
            'Rosé': '#ec4899',
            'Dessert': '#d97706',
            'Unknown': '#6b7280'
        };
        
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(typeCounts),
                datasets: [{
                    data: Object.values(typeCounts),
                    backgroundColor: Object.keys(typeCounts).map(type => colors[type] || colors.Unknown),
                    borderWidth: 2,
                    borderColor: '#1a1a2e'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#ffffff',
                            padding: 20
                        }
                    }
                }
            }
        });
    }
    
    createStockLocationChart(wines) {
        const ctx = document.getElementById('stock-location-chart');
        if (!ctx) return;
        
        // Count stock by location
        const locationCounts = {};
        wines.forEach(wine => {
            const location = wine.location || 'Unknown';
            locationCounts[location] = (locationCounts[location] || 0) + (wine.quantity || 0);
        });
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(locationCounts),
                datasets: [{
                    label: 'Bottles',
                    data: Object.values(locationCounts),
                    backgroundColor: 'rgba(233, 69, 96, 0.8)',
                    borderColor: '#e94560',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#ffffff'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#ffffff'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                }
            }
        });
    }
    
    async syncData() {
        if (!this.isOnline) {
            this.ui.showToast('Cannot sync while offline', 'warning');
            return;
        }

        if (!this.syncService) {
            this.ui.showToast('Sync service unavailable', 'error');
            return;
        }

        const syncBtn = document.getElementById('sync-btn');

        try {
            if (syncBtn) {
                syncBtn.classList.add('syncing');
            }

            const result = await this.syncService.processQueue();

            if (result.processed > 0) {
                this.ui.showToast(`Synced ${result.processed} queued action(s)`, 'success');
            } else if (result.pending > 0) {
                this.ui.showToast('Sync in progress, pending actions remain', 'info');
            } else {
                this.ui.showToast('No queued actions to sync', 'success');
            }
        } catch (error) {
            console.error('Sync failed:', error);
            this.ui.showToast('Sync failed', 'error');
        } finally {
            if (syncBtn) {
                syncBtn.classList.remove('syncing');
            }
        }
    }

    // ============================================================================
    // PROCUREMENT FUNCTIONALITY
    // ============================================================================

    async loadProcurementData() {
        if (!this.canManageProcurement()) {
            return;
        }

        try {
            console.log('Loading procurement data...');

            // Load procurement stats
            await this.loadProcurementStats();
            
            // Set up procurement event listeners
            this.setupProcurementEventListeners();
            
            console.log('Procurement data loaded successfully');
        } catch (error) {
            console.error('Failed to load procurement data:', error);
            this.ui.showToast('Failed to load procurement data', 'error');
        }
    }

    async loadProcurementStats() {
        try {
            // For now, show placeholder stats
            document.getElementById('procurement-opportunity-count').textContent = '12';
            document.getElementById('potential-savings').textContent = '$15,240';
            document.getElementById('pending-orders').textContent = '3';
        } catch (error) {
            console.error('Failed to load procurement stats:', error);
        }
    }

    setupProcurementEventListeners() {
        // Filter procurement opportunities
        const filterBtn = document.querySelector('#procurement-view .btn[onclick*="filterProcurementOpportunities"]');
        if (filterBtn) {
            filterBtn.addEventListener('click', () => this.filterProcurementOpportunities());
        }
    }

    async analyzeProcurementOpportunities() {
        if (!this.ensureCrewAccess('Crew or admin access required to analyze procurement opportunities.')) {
            return;
        }

        try {
            this.ui.showToast('Analyzing procurement opportunities...', 'info');
            
            const regionFilter = document.getElementById('region-filter-procurement')?.value;
            const typeFilter = document.getElementById('wine-type-filter-procurement')?.value;
            const maxPrice = document.getElementById('max-price-filter')?.value;
            
            const filters = {
                region: regionFilter,
                wine_type: typeFilter,
                max_price: maxPrice ? parseFloat(maxPrice) : undefined
            };
            
            const opportunities = await this.api.getProcurementOpportunities(filters);

            if (opportunities.success && opportunities.data) {
                this.displayProcurementOverview(opportunities.data.summary);
                this.displayProcurementOpportunities(opportunities.data.opportunities);

                const opportunityCount = opportunities.data.summary?.total_opportunities ?? opportunities.data.opportunities?.length ?? 0;
                this.ui.showToast(`Found ${opportunityCount} procurement opportunities`, 'success');
            } else {
                throw new Error('Failed to get procurement opportunities');
            }
        } catch (error) {
            console.error('Failed to analyze procurement opportunities:', error);
            this.ui.showToast('Failed to analyze opportunities', 'error');
        }
    }

    displayProcurementOverview(summary) {
        if (!summary) {
            return;
        }

        const opportunitiesElement = document.getElementById('procurement-opportunity-count');
        const savingsElement = document.getElementById('potential-savings');
        const pendingOrdersElement = document.getElementById('pending-orders');

        if (opportunitiesElement) {
            opportunitiesElement.textContent = summary.total_opportunities ?? '-';
        }

        if (savingsElement) {
            const savings = (summary.projected_value || 0) - (summary.recommended_spend || 0);
            savingsElement.textContent = `$${Number.isFinite(savings) ? savings.toFixed(2) : '0.00'}`;
        }

        if (pendingOrdersElement) {
            pendingOrdersElement.textContent = summary.urgent_actions ?? '0';
        }
    }

    displayProcurementOpportunities(opportunities) {
        if (!this.canManageProcurement()) {
            return;
        }

        const grid = document.getElementById('procurement-opportunities');

        if (!opportunities || opportunities.length === 0) {
            grid.innerHTML = '<div class="opportunities-placeholder"><p>No procurement opportunities found with current filters</p></div>';
            return;
        }

        grid.innerHTML = opportunities.map(opportunity => `
            <div class="opportunity-card">
                <div class="opportunity-header">
                    <h4>${opportunity.wine_name || 'Wine Opportunity'}</h4>
                    <div class="opportunity-score">${Math.round(((opportunity.score?.total) || opportunity.score || 0.8) * 100)}%</div>
                </div>
                <div class="opportunity-details">
                    <p><strong>Producer:</strong> ${opportunity.producer || 'N/A'}</p>
                    <p><strong>Region:</strong> ${opportunity.region || 'N/A'}</p>
                    <p><strong>Estimated Value:</strong> $${opportunity.estimated_value ?? 'TBD'}</p>
                    <p><strong>Recommended Quantity:</strong> ${opportunity.recommended_quantity || 12} bottles</p>
                    <p><strong>Projected Investment:</strong> $${opportunity.estimated_investment ?? 'TBD'}</p>
                    <p><strong>Urgency:</strong> ${opportunity.urgency || 'Moderate'}</p>
                </div>
                <div class="opportunity-reasoning">
                    <h5>Why this opportunity:</h5>
                    <p>${opportunity.reasoning || 'Based on current inventory gaps and market analysis'}</p>
                    <p><strong>Confidence:</strong> ${(opportunity.confidence ? Math.round(opportunity.confidence * 100) : 70)}%</p>
                </div>
                <div class="opportunity-actions">
                    <button class="btn primary" onclick="app.analyzePurchaseDecision('${opportunity.wine_id}', '${opportunity.supplier_id}')">
                        Analyze Purchase
                    </button>
                    <button class="btn secondary" onclick="app.addToOrder('${opportunity.wine_id}')">
                        Add to Order
                    </button>
                </div>
            </div>
        `).join('');
    }

    async filterProcurementOpportunities() {
        await this.analyzeProcurementOpportunities();
    }

    async showPurchaseDecisionTool() {
        if (!this.ensureCrewAccess('Crew or admin access required for procurement tools.')) {
            return;
        }

        this.ui.showModal('Purchase Decision Analysis', `
            <div class="purchase-decision-form">
                <div class="form-group">
                    <label for="decision-wine-id">Wine/Vintage ID</label>
                    <input type="text" id="decision-wine-id" placeholder="Enter wine or vintage ID">
                </div>
                <div class="form-group">
                    <label for="decision-supplier">Supplier</label>
                    <select id="decision-supplier">
                        <option value="">Select supplier...</option>
                        <option value="supplier1">Premium Wine Imports</option>
                        <option value="supplier2">European Cellars Ltd</option>
                        <option value="supplier3">Luxury Vintages Inc</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="decision-quantity">Quantity</label>
                    <input type="number" id="decision-quantity" value="12" min="1" max="144">
                </div>
                <div class="form-group">
                    <label for="decision-context">Context/Notes</label>
                    <textarea id="decision-context" rows="3" placeholder="Special occasion, guest preferences, etc."></textarea>
                </div>
                <div class="form-actions">
                    <button class="btn secondary" onclick="app.ui.hideModal()">Cancel</button>
                    <button class="btn primary" onclick="app.runPurchaseAnalysis()">Analyze Decision</button>
                </div>
            </div>
        `);
    }

    async runPurchaseAnalysis() {
        if (!this.ensureCrewAccess('Crew or admin access required for procurement tools.')) {
            return;
        }

        try {
            const wineId = document.getElementById('decision-wine-id').value;
            const supplierId = document.getElementById('decision-supplier').value;
            const quantity = parseInt(document.getElementById('decision-quantity').value);
            const context = document.getElementById('decision-context').value;
            
            if (!wineId || !supplierId) {
                this.ui.showToast('Please fill in wine ID and supplier', 'error');
                return;
            }
            
            this.ui.showToast('Analyzing purchase decision...', 'info');
            
            const analysis = await this.api.analyzePurchaseDecision(wineId, supplierId, quantity, { notes: context });
            
            if (analysis.success) {
                this.ui.hideModal();
                this.showPurchaseAnalysisResults(analysis.data);
            } else {
                throw new Error('Failed to analyze purchase decision');
            }
        } catch (error) {
            console.error('Purchase analysis failed:', error);
            this.ui.showToast('Analysis failed: ' + error.message, 'error');
        }
    }

    showPurchaseAnalysisResults(analysis) {
        const recommendation = analysis.recommendation || 'proceed';
        const confidence = Math.round((analysis.confidence || 0.8) * 100);
        const reasoning = analysis.reasoning || 'Analysis based on inventory needs and market conditions';
        
        this.ui.showModal('Purchase Decision Analysis Results', `
            <div class="analysis-results">
                <div class="analysis-header">
                    <div class="recommendation ${recommendation}">
                        <h3>${recommendation.toUpperCase()}</h3>
                        <div class="confidence">${confidence}% confidence</div>
                    </div>
                </div>
                <div class="analysis-details">
                    <h4>Analysis Summary:</h4>
                    <p>${reasoning}</p>
                    
                    <div class="analysis-metrics">
                        <div class="metric">
                            <label>Estimated ROI:</label>
                            <span>${analysis.estimated_roi || '15-20'}%</span>
                        </div>
                        <div class="metric">
                            <label>Market Demand:</label>
                            <span>${analysis.market_demand || 'High'}</span>
                        </div>
                        <div class="metric">
                            <label>Inventory Fit:</label>
                            <span>${analysis.inventory_fit || 'Excellent'}</span>
                        </div>
                    </div>
                </div>
                <div class="form-actions">
                    <button class="btn secondary" onclick="app.ui.hideModal()">Close</button>
                    ${recommendation === 'proceed' ? '<button class="btn primary" onclick="app.generatePurchaseOrder()">Create Purchase Order</button>' : ''}
                </div>
            </div>
        `);
    }

    async generatePurchaseOrder() {
        if (!this.ensureCrewAccess('Crew or admin access required to generate purchase orders.')) {
            return;
        }

        this.ui.showModal('Create Purchase Order', `
            <div class="purchase-order-form">
                <div class="form-group">
                    <label for="po-supplier">Supplier</label>
                    <select id="po-supplier" required>
                        <option value="">Select supplier...</option>
                        <option value="supplier1">Premium Wine Imports</option>
                        <option value="supplier2">European Cellars Ltd</option>
                        <option value="supplier3">Luxury Vintages Inc</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="po-delivery-date">Delivery Date</label>
                    <input type="date" id="po-delivery-date" required>
                </div>
                <div class="form-group">
                    <label for="po-notes">Notes</label>
                    <textarea id="po-notes" rows="3" placeholder="Special instructions, terms, etc."></textarea>
                </div>
                <div class="order-items">
                    <h4>Order Items</h4>
                    <div id="order-items-list">
                        <div class="order-item">
                            <input type="text" placeholder="Wine/Vintage ID" class="item-wine-id">
                            <input type="number" placeholder="Qty" class="item-quantity" min="1" value="12">
                            <input type="number" placeholder="Unit Price" class="item-price" min="0" step="0.01">
                            <button class="btn-small danger" onclick="this.parentNode.remove()">×</button>
                        </div>
                    </div>
                    <button class="btn secondary" onclick="app.addOrderItem()">+ Add Item</button>
                </div>
                <div class="form-actions">
                    <button class="btn secondary" onclick="app.ui.hideModal()">Cancel</button>
                    <button class="btn primary" onclick="app.submitPurchaseOrder()">Generate Order</button>
                </div>
            </div>
        `);
        
        // Set default delivery date to 2 weeks from now
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + 14);
        document.getElementById('po-delivery-date').value = deliveryDate.toISOString().split('T')[0];
    }

    addOrderItem() {
        if (!this.ensureCrewAccess('Crew or admin access required to modify purchase orders.')) {
            return;
        }

        const itemsList = document.getElementById('order-items-list');
        const newItem = document.createElement('div');
        newItem.className = 'order-item';
        newItem.innerHTML = `
            <input type="text" placeholder="Wine/Vintage ID" class="item-wine-id">
            <input type="number" placeholder="Qty" class="item-quantity" min="1" value="12">
            <input type="number" placeholder="Unit Price" class="item-price" min="0" step="0.01">
            <button class="btn-small danger" onclick="this.parentNode.remove()">×</button>
        `;
        itemsList.appendChild(newItem);
    }

    async submitPurchaseOrder() {
        if (!this.ensureCrewAccess('Crew or admin access required to generate purchase orders.')) {
            return;
        }

        try {
            const supplier = document.getElementById('po-supplier').value;
            const deliveryDate = document.getElementById('po-delivery-date').value;
            const notes = document.getElementById('po-notes').value;
            
            const itemElements = document.querySelectorAll('.order-item');
            const items = Array.from(itemElements).map(item => ({
                wine_id: item.querySelector('.item-wine-id').value,
                quantity: parseInt(item.querySelector('.item-quantity').value),
                unit_price: parseFloat(item.querySelector('.item-price').value) || 0
            })).filter(item => item.wine_id && item.quantity);
            
            if (!supplier || items.length === 0) {
                this.ui.showToast('Please select supplier and add at least one item', 'error');
                return;
            }
            
            this.ui.showToast('Generating purchase order...', 'info');
            
            const order = await this.api.generatePurchaseOrder(items, supplier, deliveryDate, notes);
            
            if (order.success) {
                this.ui.hideModal();
                this.ui.showToast('Purchase order created successfully!', 'success');
                // Refresh procurement data
                this.loadProcurementData();
            } else {
                throw new Error('Failed to create purchase order');
            }
        } catch (error) {
            console.error('Purchase order creation failed:', error);
            this.ui.showToast('Failed to create order: ' + error.message, 'error');
        }
    }

    // ============================================================================
    // WINE CATALOG FUNCTIONALITY
    // ============================================================================

    async loadWineCatalog() {
        try {
            console.log('Loading wine catalog...');
            
            // Set up catalog event listeners
            this.setupCatalogEventListeners();
            
            // Load catalog data
            this.currentCatalogPage = 1;
            this.catalogFilters = {};
            this.catalogSort = 'name';
            this.catalogView = 'grid';
            
            await this.loadCatalogData();
            
            console.log('Wine catalog loaded successfully');
        } catch (error) {
            console.error('Failed to load wine catalog:', error);
            this.ui.showToast('Failed to load wine catalog', 'error');
        }
    }

    setupCatalogEventListeners() {
        // Search
        const searchInput = document.getElementById('catalog-search');
        if (searchInput) {
            searchInput.addEventListener('input', this.ui.debounce(() => {
                this.catalogFilters.search = searchInput.value;
                this.currentCatalogPage = 1;
                this.loadCatalogData();
            }, 300));
        }
        
        // Filters
        const filters = ['catalog-region-filter', 'catalog-type-filter', 'catalog-year-filter', 'catalog-sort'];
        filters.forEach(filterId => {
            const filter = document.getElementById(filterId);
            if (filter) {
                filter.addEventListener('change', () => {
                    this.updateCatalogFilters();
                    this.currentCatalogPage = 1;
                    this.loadCatalogData();
                });
            }
        });
        
        // View toggles
        const viewToggles = document.querySelectorAll('.view-toggle');
        viewToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                viewToggles.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.catalogView = e.target.dataset.view;
                this.updateCatalogView();
            });
        });
        
        // Pagination
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.currentCatalogPage > 1) {
                    this.currentCatalogPage--;
                    this.loadCatalogData();
                }
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.currentCatalogPage++;
                this.loadCatalogData();
            });
        }
    }

    updateCatalogFilters() {
        this.catalogFilters = {
            region: document.getElementById('catalog-region-filter')?.value,
            wine_type: document.getElementById('catalog-type-filter')?.value,
            year_range: document.getElementById('catalog-year-filter')?.value,
            search: document.getElementById('catalog-search')?.value
        };
        
        this.catalogSort = document.getElementById('catalog-sort')?.value || 'name';
    }

    async loadCatalogData() {
        try {
            const limit = 50;
            const offset = (this.currentCatalogPage - 1) * limit;
            
            const params = {
                ...this.catalogFilters,
                limit,
                offset
            };
            
            // Remove empty params
            Object.keys(params).forEach(key => {
                if (!params[key]) delete params[key];
            });
            
            const wines = await this.api.getWines(params);
            
            if (wines.success && wines.data) {
                this.displayCatalogWines(wines.data);
                this.updateCatalogStats(wines.data);
                this.updateCatalogPagination(wines.data.length, limit);
            } else {
                throw new Error('Failed to load wine catalog');
            }
        } catch (error) {
            console.error('Failed to load catalog data:', error);
            const grid = document.getElementById('catalog-grid');
            grid.innerHTML = '<div class="catalog-placeholder"><p>Failed to load wine catalog. Please try again.</p></div>';
        }
    }

    displayCatalogWines(wines) {
        const startTime = this.startPerformanceTimer();
        const grid = document.getElementById('catalog-grid');
        
        if (!wines || wines.length === 0) {
            grid.innerHTML = '<div class="catalog-placeholder"><p>No wines found matching your criteria</p></div>';
            return;
        }
        
        const viewClass = `view-${this.catalogView}`;
        grid.className = `catalog-grid ${viewClass}`;
        
        console.log(`Rendering ${wines.length} catalog wines with virtual scrolling...`);
        
        try {
            const useVirtualScroll = wines.length > 30;
            
            // Initialize or update virtual scroll for catalog
            if (!this.catalogVirtualScroll) {
                // Determine item height based on view type
                const itemHeight = this.getCatalogItemHeight(this.catalogView);
                
                this.catalogVirtualScroll = new VirtualScroll(
                    grid, 
                    wines, 
                    itemHeight,
                    { 
                        threshold: 30, // Use virtual scrolling for lists > 30 items
                        bufferSize: 2 
                    }
                );
                
                // Set render callback for catalog items with image optimization
                this.catalogVirtualScroll.setRenderCallback((wine, index) => {
                    const cardHtml = this.createCatalogWineCard(wine, this.catalogView);
                    
                    // Convert HTML string to DOM element
                    const template = document.createElement('template');
                    template.innerHTML = cardHtml.trim();
                    const card = template.content.firstChild;
                    
                    // Optimize images based on view type
                    if (card && window.imageOptimizer) {
                        const img = card.querySelector('img.wine-bottle-image');
                        if (img) {
                            const dimensions = this.getCatalogImageDimensions(this.catalogView);
                            window.imageOptimizer.optimizeImage(img, {
                                width: dimensions.width,
                                height: dimensions.height,
                                lazyLoad: true,
                                compressionQuality: 0.8
                            });
                        }
                    }
                    
                    return card;
                });
            } else {
                // Update existing virtual scroll with new data and view
                const itemHeight = this.getCatalogItemHeight(this.catalogView);
                this.catalogVirtualScroll.updateItemHeight(itemHeight);
                this.catalogVirtualScroll.setItems(wines);
                
                // Update render callback for new view type with image optimization
                this.catalogVirtualScroll.setRenderCallback((wine, index) => {
                    const cardHtml = this.createCatalogWineCard(wine, this.catalogView);
                    
                    // Convert HTML string to DOM element
                    const template = document.createElement('template');
                    template.innerHTML = cardHtml.trim();
                    const card = template.content.firstChild;
                    
                    // Optimize images based on view type
                    if (card && window.imageOptimizer) {
                        const img = card.querySelector('img.wine-bottle-image');
                        if (img) {
                            const dimensions = this.getCatalogImageDimensions(this.catalogView);
                            window.imageOptimizer.optimizeImage(img, {
                                width: dimensions.width,
                                height: dimensions.height,
                                lazyLoad: true,
                                compressionQuality: 0.8
                            });
                        }
                    }
                    
                    return card;
                });
            }
            
            console.log('Catalog virtual scroll initialized successfully');
            
            // End performance timer
            this.endPerformanceTimer(startTime, 'catalog', wines.length, useVirtualScroll);
            
        } catch (error) {
            console.error('Error setting up catalog virtual scroll:', error);
            // Fallback to regular rendering
            this.displayCatalogWinesFallback(wines, grid);
            this.endPerformanceTimer(startTime, 'catalog', wines.length, false);
        }
    }

    getCatalogItemHeight(viewType) {
        // Return appropriate height based on view type
        switch (viewType) {
            case 'list':
                return 80; // Compact list view
            case 'detail':
                return 300; // Detailed view with more information
            case 'grid':
            default:
                return 280; // Standard grid card height
        }
    }
    
    getCatalogImageDimensions(viewType) {
        const dimensions = {
            grid: { width: 300, height: 450 },
            list: { width: 80, height: 120 },
            detail: { width: 600, height: 400 }
        };
        return dimensions[viewType] || dimensions.grid;
    }

    displayCatalogWinesFallback(wines, grid) {
        // Fallback method for when virtual scrolling fails
        console.log('Using fallback catalog rendering');
        if (this.catalogView === 'grid') {
            grid.innerHTML = wines.map(wine => this.createCatalogWineCard(wine, 'grid')).join('');
        } else if (this.catalogView === 'list') {
            grid.innerHTML = wines.map(wine => this.createCatalogWineCard(wine, 'list')).join('');
        } else if (this.catalogView === 'detail') {
            grid.innerHTML = wines.map(wine => this.createCatalogWineCard(wine, 'detail')).join('');
        }
    }

    createCatalogWineCard(wine, viewType) {
        const displayRegion = this.getDisplayRegion(wine);
        const stock = this.parseNumeric(wine.total_stock) ?? 0;
        const totalValueNumeric = this.parseNumeric(wine.total_value);
        const avgCostNumeric = this.parseNumeric(wine.avg_cost_per_bottle ?? wine.cost_per_bottle);
        const avgCost = avgCostNumeric !== null
            ? avgCostNumeric
            : (stock > 0 && totalValueNumeric !== null ? totalValueNumeric / stock : null);
        const totalValue = totalValueNumeric !== null
            ? totalValueNumeric
            : (avgCost !== null ? avgCost * stock : 0);
        const peakWindow = this.getPeakDrinkingWindow(wine);
        const scoreVariant = viewType === 'list' ? 'list' : (viewType === 'detail' ? 'detail' : 'card');
        const scoreSummary = this.renderWineScoreSummary(wine, scoreVariant);
        const formattedStock = this.formatNumber(stock);
        const formattedValue = this.formatCurrency(totalValue);
        const formattedAvgCost = this.formatCurrency(avgCost, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const stockWithUnit = formattedStock === '—' ? '—' : `${formattedStock} bottles`;
        const avgCostWithUnit = formattedAvgCost !== '—' ? `${formattedAvgCost} per bottle` : '—';
        const storageSummary = this.formatStorageRange(wine);
        const decantingSummary = this.formatDecantingSummary(wine);
        
        // Image setup with different sizes for different views
        const imageUrl = wine.image_url || '/images/wine-placeholder.svg';
        const imageName = `${wine.name || 'Unknown'} - ${wine.producer || 'Unknown'}`;
        const imageSizes = {
            grid: { aspectRatio: 'aspect-3-2', width: 300, height: 450 },
            list: { aspectRatio: 'aspect-thumbnail', width: 80, height: 120 },
            detail: { aspectRatio: 'aspect-16-9', width: 600, height: 400 }
        };
        const imageConfig = imageSizes[viewType] || imageSizes.grid;
        
        const imageHtml = `
            <div class="wine-image-container ${imageConfig.aspectRatio}">
                <img 
                    class="wine-bottle-image" 
                    src="${imageUrl}"
                    alt="${imageName} bottle"
                    loading="lazy"
                    data-optimized="false"
                    data-dimensions="${imageConfig.width}x${imageConfig.height}"
                    onerror="this.onerror=null; this.src='/images/wine-placeholder.svg';"
                />
                <div class="image-skeleton"></div>
            </div>
        `;

        if (viewType === 'grid') {
            return `
                <div class="wine-card catalog-card" 
                     onclick="app.showWineDetails('${wine.id}')" 
                     role="button" 
                     tabindex="0"
                     aria-label="View details for ${wine.name || 'Unknown Wine'} from ${wine.producer || 'Unknown Producer'}, ${wine.year || 'N/A'}"
                     onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();app.showWineDetails('${wine.id}')}">
                    ${imageHtml}
                    <div class="wine-card-header">
                        <div class="wine-type-badge ${wine.wine_type?.toLowerCase() || 'unknown'}" aria-label="Wine type: ${wine.wine_type || 'Wine'}">
                            <span aria-hidden="true">${this.getWineTypeIcon(wine.wine_type)}</span> ${wine.wine_type || 'Wine'}
                        </div>
                        <div class="wine-year" aria-label="Vintage year: ${wine.year || 'N/A'}">${wine.year || 'N/A'}</div>
                    </div>
                    <div class="wine-card-body">
                        <h3>${wine.name || 'Unknown Wine'}</h3>
                        <p class="producer">${wine.producer || 'Unknown Producer'}</p>
                        <div class="wine-meta">
                            <span class="meta-item" aria-label="Region: ${displayRegion}">${displayRegion}</span>
                            ${peakWindow ? `<span class="meta-item" aria-label="Peak drinking window: ${peakWindow}">Peak: ${peakWindow}</span>` : ''}
                        </div>
                        ${scoreSummary || ''}
                        <div class="wine-guidance">
                            <div class="guidance-line">
                                <span class="guidance-label">Storage</span>
                                <span class="guidance-value">${storageSummary}</span>
                            </div>
                            <div class="guidance-line">
                                <span class="guidance-label">Decant</span>
                                <span class="guidance-value">${decantingSummary}</span>
                            </div>
                        </div>
                    </div>
                    <div class="wine-stats">
                        <div class="stat-block">
                            <span class="stat-label">Stock</span>
                            <span class="stat-value">${formattedStock}</span>
                            <span class="stat-unit">bottles</span>
                        </div>
                        <div class="stat-block">
                            <span class="stat-label">Avg Cost</span>
                            <span class="stat-value">${formattedAvgCost}</span>
                            ${formattedAvgCost !== '—' ? '<span class="stat-unit">per bottle</span>' : ''}
                        </div>
                        <div class="stat-block">
                            <span class="stat-label">Value</span>
                            <span class="stat-value">${formattedValue}</span>
                        </div>
                    </div>
                </div>
            `;
        } else if (viewType === 'list') {
            return `
                <div class="wine-list-item" onclick="app.showWineDetails('${wine.id}')">
                    ${imageHtml}
                    <div class="wine-basic-info">
                        <h4>${wine.name || 'Unknown Wine'}</h4>
                        <span class="producer">${wine.producer || 'Unknown Producer'}</span>
                    </div>
                    <div class="wine-details">
                        <span class="type">${wine.wine_type || 'Wine'}</span>
                        <span class="year">${wine.year || 'N/A'}</span>
                        <span class="region">${displayRegion}</span>
                        ${peakWindow ? `<span class="peak-window">Peak: ${peakWindow}</span>` : ''}
                    </div>
                    <div class="wine-metrics">
                        ${scoreSummary || ''}
                        <div class="metric-line">
                            <span class="metric-label">Stock</span>
                            <span class="metric-value">${stockWithUnit}</span>
                        </div>
                        <div class="metric-line">
                            <span class="metric-label">Value</span>
                            <span class="metric-value">${formattedValue}</span>
                        </div>
                        <div class="metric-line">
                            <span class="metric-label">Storage</span>
                            <span class="metric-value">${storageSummary}</span>
                        </div>
                        <div class="metric-line">
                            <span class="metric-label">Decant</span>
                            <span class="metric-value">${decantingSummary}</span>
                        </div>
                    </div>
                </div>
            `;
        } else { // detail view
            return `
                <div class="wine-detail-card" onclick="app.showWineDetails('${wine.id}')">
                    ${imageHtml}
                    <div class="wine-detail-header">
                        <div class="wine-title">
                            <h3>${wine.name || 'Unknown Wine'}</h3>
                            <p class="producer">${wine.producer || 'Unknown Producer'}</p>
                        </div>
                        <div class="wine-badges">
                            <div class="wine-type-badge ${wine.wine_type?.toLowerCase() || 'unknown'}">
                                ${this.getWineTypeIcon(wine.wine_type)} ${wine.wine_type || 'Wine'}
                            </div>
                            <div class="wine-year-badge">${wine.year || 'N/A'}</div>
                        </div>
                    </div>
                    ${scoreSummary || ''}
                    <div class="wine-detail-content">
                        <div class="wine-info">
                            <p><strong>Region:</strong> ${displayRegion}</p>
                            <p><strong>Alcohol:</strong> ${wine.alcohol_content || 'N/A'}%</p>
                            <p><strong>Style:</strong> ${wine.style || 'N/A'}</p>
                            ${peakWindow ? `<p><strong>Peak Window:</strong> ${peakWindow}</p>` : ''}
                            <p><strong>Storage:</strong> ${storageSummary}</p>
                            <p><strong>Decanting:</strong> ${decantingSummary}</p>
                        </div>
                        <div class="wine-inventory">
                            <p><strong>Total Stock:</strong> ${stockWithUnit}</p>
                            <p><strong>Inventory Value:</strong> ${formattedValue}</p>
                            <p><strong>Avg. Cost:</strong> ${avgCostWithUnit}</p>
                        </div>
                        <div class="wine-guidance-notes">
                            ${(() => {
                                const recommendation = this.getStorageRecommendation(wine);
                                return recommendation ? `<p><strong>Storage Guidance:</strong> ${recommendation}</p>` : '';
                            })()}
                            ${(() => {
                                const recommendation = this.getDecantingRecommendation(wine);
                                return recommendation ? `<p><strong>Decanting Notes:</strong> ${recommendation}</p>` : '';
                            })()}
                        </div>
                    </div>
                    ${wine.tasting_notes ? `
                        <div class="wine-notes">
                            <h5>Tasting Notes:</h5>
                            <p>${wine.tasting_notes}</p>
                        </div>
                    ` : ''}
                </div>
            `;
        }
    }

    updateCatalogStats(wines) {
        const totalCount = wines.length;
        const totalBottles = wines.reduce((sum, wine) => sum + (wine.total_stock || 0), 0);
        const totalValue = wines.reduce((sum, wine) => {
            const value = this.parseNumeric(wine.total_value);
            if (value !== null) {
                return sum + value;
            }

            const stock = wine.total_stock || 0;
            const avgCost = this.parseNumeric(wine.avg_cost_per_bottle ?? wine.cost_per_bottle);
            if (avgCost !== null) {
                return sum + (stock * avgCost);
            }

            return sum;
        }, 0);

        document.getElementById('catalog-count').textContent = this.formatNumber(totalCount);
        document.getElementById('catalog-bottles').textContent = this.formatNumber(totalBottles);
        document.getElementById('catalog-value').textContent = this.formatCurrency(totalValue);
    }

    updateCatalogPagination(currentCount, limit) {
        const pagination = document.getElementById('catalog-pagination');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        const pageInfo = document.getElementById('page-info');
        
        if (pagination && prevBtn && nextBtn && pageInfo) {
            // Show pagination if we have results
            if (currentCount > 0) {
                pagination.classList.remove('hidden');
                
                prevBtn.disabled = this.currentCatalogPage <= 1;
                nextBtn.disabled = currentCount < limit;
                
                pageInfo.textContent = `Page ${this.currentCatalogPage}`;
            } else {
                pagination.classList.add('hidden');
            }
        }
    }

    updateCatalogView() {
        const grid = document.getElementById('catalog-grid');
        const viewClass = `view-${this.catalogView}`;
        grid.className = `catalog-grid ${viewClass}`;
        
        // Update virtual scroll with new view type if it exists
        if (this.catalogVirtualScroll) {
            const itemHeight = this.getCatalogItemHeight(this.catalogView);
            this.catalogVirtualScroll.updateItemHeight(itemHeight);
            
            // Update render callback for new view type
            this.catalogVirtualScroll.setRenderCallback((wine, index) => {
                return this.createCatalogWineCard(wine, this.catalogView);
            });
        }
        
        // Re-render current wines with new view
        // This would typically re-call displayCatalogWines with current data
        this.loadCatalogData();
    }

    async showWineDetails(wineId) {
        try {
            console.log('Loading wine details for:', wineId);
            this.ui.showToast('Loading wine details...', 'info');
            
            const wineDetails = await this.api.getWineDetails(wineId);
            
            if (wineDetails.success && wineDetails.data) {
                this.displayWineDetailsModal(wineDetails.data);
            } else {
                throw new Error('Failed to load wine details');
            }
        } catch (error) {
            console.error('Failed to load wine details:', error);
            this.ui.showToast('Failed to load wine details', 'error');
        }
    }

    displayWineDetailsModal(wine) {
        const displayRegion = this.getDisplayRegion(wine);
        const vintages = wine.vintages || [];
        const aliases = wine.aliases || [];
        const primaryVintage = vintages[0] || {};
        const scoreContext = {
            ...wine,
            quality_score: wine.quality_score ?? primaryVintage.quality_score,
            critic_score: wine.critic_score ?? primaryVintage.critic_score,
            weather_score: wine.weather_score ?? primaryVintage.weather_score,
            peak_drinking_start: wine.peak_drinking_start ?? primaryVintage.peak_drinking_start,
            peak_drinking_end: wine.peak_drinking_end ?? primaryVintage.peak_drinking_end,
            year: wine.year ?? primaryVintage.year
        };

        const scoreSummary = this.renderWineScoreSummary(scoreContext, 'modal');
        const peakWindow = this.getPeakDrinkingWindow(scoreContext);
        const stockFromWine = this.parseNumeric(wine.total_stock);
        const totalStock = stockFromWine !== null ? stockFromWine : vintages.reduce((sum, vintage) => sum + (vintage.total_stock || 0), 0);
        const valueFromWine = this.parseNumeric(wine.total_value);
        const totalValue = valueFromWine !== null ? valueFromWine : vintages.reduce((sum, vintage) => sum + (this.parseNumeric(vintage.total_value) || 0), 0);
        const avgCostFromWine = this.parseNumeric(wine.avg_cost_per_bottle);
        const averageCost = avgCostFromWine !== null ? avgCostFromWine : (totalStock > 0 ? totalValue / totalStock : null);
        const formattedStock = this.formatNumber(totalStock);
        const stockWithUnit = formattedStock === '—' ? '—' : `${formattedStock} bottles`;
        const formattedValue = this.formatCurrency(totalValue);
        const formattedAvgCost = this.formatCurrency(averageCost, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const avgCostWithUnit = formattedAvgCost !== '—' ? `${formattedAvgCost} per bottle` : '—';

        this.ui.showModal(`Wine Details - ${wine.name}`, `
            <div class="wine-details-modal">
                <div class="wine-details-header">
                    <div class="wine-title-section">
                        <h2>${wine.name}</h2>
                        <p class="producer">${wine.producer}</p>
                        <div class="wine-badges">
                            <span class="wine-type-badge ${wine.wine_type?.toLowerCase() || 'unknown'}">
                                ${this.getWineTypeIcon(wine.wine_type)} ${wine.wine_type}
                            </span>
                            <span class="region-badge">${displayRegion}</span>
                        </div>
                    </div>
                </div>

                ${scoreSummary || ''}

                <div class="wine-details-content">
                    <div class="wine-info-section">
                        <h4>Wine Information</h4>
                        <div class="wine-info-grid">
                            <div><strong>Region:</strong> ${wine.region}</div>
                            <div><strong>Country:</strong> ${wine.country}</div>
                            <div><strong>Alcohol:</strong> ${wine.alcohol_content || 'N/A'}%</div>
                            <div><strong>Style:</strong> ${wine.style || 'N/A'}</div>
                            <div><strong>Storage:</strong> ${this.formatStorageRange(wine)}</div>
                            <div><strong>Decanting:</strong> ${this.formatDecantingSummary(wine)}</div>
                        </div>

                        ${peakWindow ? `
                            <div class="peak-window">
                                <strong>Peak Drinking Window:</strong>
                                <p>${peakWindow}</p>
                            </div>
                        ` : ''}

                        ${wine.grape_varieties ? `
                            <div class="grape-varieties">
                                <strong>Grape Varieties:</strong>
                                <p>${Array.isArray(wine.grape_varieties) ? wine.grape_varieties.join(', ') : wine.grape_varieties}</p>
                            </div>
                        ` : ''}

                        ${wine.tasting_notes ? `
                            <div class="tasting-notes">
                                <strong>Tasting Notes:</strong>
                                <p>${wine.tasting_notes}</p>
                            </div>
                        ` : ''}

                        ${wine.food_pairings ? `
                            <div class="food-pairings">
                                <strong>Food Pairings:</strong>
                                <p>${Array.isArray(wine.food_pairings) ? wine.food_pairings.join(', ') : wine.food_pairings}</p>
                            </div>
                        ` : ''}

                        <div class="service-guidance">
                            <h5>Storage & Service</h5>
                            <div class="service-guidance-grid">
                                <div class="service-card">
                                    <span class="service-label">Storage Temperature</span>
                                    <span class="service-value">${this.formatStorageRange(wine)}</span>
                                    ${(() => {
                                        const recommendation = this.getStorageRecommendation(wine);
                                        return recommendation ? `<p class="guidance-note">${recommendation}</p>` : '';
                                    })()}
                                </div>
                                <div class="service-card">
                                    <span class="service-label">Decanting</span>
                                    <span class="service-value">${this.formatDecantingSummary(wine)}</span>
                                    ${(() => {
                                        const recommendation = this.getDecantingRecommendation(wine);
                                        return recommendation ? `<p class="guidance-note">${recommendation}</p>` : '';
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="wine-inventory">
                        <h4>Cellar Snapshot</h4>
                        <div class="inventory-summary">
                            <div class="inventory-metric">
                                <span class="metric-label">Total Stock</span>
                                <span class="metric-value">${stockWithUnit}</span>
                            </div>
                            <div class="inventory-metric">
                                <span class="metric-label">Inventory Value</span>
                                <span class="metric-value">${formattedValue}</span>
                            </div>
                            <div class="inventory-metric">
                                <span class="metric-label">Average Cost</span>
                                <span class="metric-value">${avgCostWithUnit}</span>
                            </div>
                        </div>
                    </div>

                    ${vintages.length > 0 ? `
                        <div class="vintages-section">
                            <h4>Available Vintages</h4>
                            <div class="vintages-list">
                                ${vintages.map(vintage => `
                                    <div class="vintage-item">
                                        <div class="vintage-header">
                                            <div class="vintage-year">${vintage.year}</div>
                                            <div class="vintage-stock">${this.formatNumber(vintage.total_stock || 0)} bottles</div>
                                        </div>
                                        <div class="vintage-metrics">
                                            ${this.renderScorePill('Quality', vintage.quality_score) || '<div class="score-pill muted"><span class="pill-label">Quality</span><span class="pill-value">—</span></div>'}
                                            ${(() => {
                                                const avg = this.formatCurrency(vintage.avg_cost_per_bottle, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                                return avg !== '—' ? `<span class="metric">Avg Cost: ${avg}</span>` : '';
                                            })()}
                                            ${(() => {
                                                const value = this.formatCurrency(vintage.total_value);
                                                return value !== '—' ? `<span class="metric">Value: ${value}</span>` : '';
                                            })()}
                                        </div>
                                        <div class="vintage-actions">
                                            <button class="btn-small primary" onclick="app.reserveWineModal('${vintage.id}', '${wine.name} ${vintage.year}')">
                                                Reserve
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    ${aliases.length > 0 ? `
                        <div class="aliases-section">
                            <h4>Known As</h4>
                            <div class="aliases-list">
                                ${aliases.map(alias => `<span class="alias-tag">${alias.alias}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>

                <div class="wine-details-actions">
                    <button class="btn secondary" onclick="app.ui.hideModal()">Close</button>
                    <button class="btn primary" onclick="app.navigateToView('pairing'); app.ui.hideModal();">Find Pairings</button>
                </div>
            </div>
        `);
    }

    // Glossary Functions
    showGlossaryModal() {
        const searchHtml = `
            <div class="glossary-search-container">
                <input type="text" id="glossary-modal-search" 
                       class="glossary-search-input" 
                       placeholder="Search terms, definitions, and features..." 
                       aria-label="Search glossary">
            </div>
        `;
        
        const contentHtml = this.generateGlossaryContent();
        const modalContent = searchHtml + contentHtml;
        
        this.ui.showModal('Wine & System Glossary', modalContent);
        
        // Setup search functionality
        const searchInput = document.getElementById('glossary-modal-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterGlossaryModal(e.target.value);
            });
        }
    }

    generateGlossaryContent() {
        const categories = getCategories();
        let html = '<div class="glossary-modal-content">';
        
        categories.forEach(category => {
            html += this.renderGlossaryCategory(category, glossaryData[category]);
        });
        
        html += '</div>';
        return html;
    }

    renderGlossaryCategory(categoryName, terms) {
        let html = `
            <div class="glossary-category" data-category="${categoryName}">
                <h3 class="glossary-category-title">${categoryName}</h3>
                <dl class="glossary-terms">
        `;
        
        Object.entries(terms).forEach(([term, content]) => {
            html += this.renderGlossaryTerm(term, content);
        });
        
        html += '</dl></div>';
        return html;
    }

    renderGlossaryTerm(term, content) {
        const definition = typeof content === 'object' ? content.definition : content;
        
        let html = `
            <div class="glossary-term" data-term="${term.toLowerCase()}">
                <dt class="glossary-term-name">${term}</dt>
                <dd class="glossary-term-definition">${definition}</dd>
        `;
        
        // Add additional content sections if available
        if (typeof content === 'object') {
            if (content.examples && content.examples.length > 0) {
                html += `
                    <dd class="glossary-term-examples">
                        <strong>Examples:</strong>
                        <ul>
                            ${content.examples.map(ex => `<li>${ex}</li>`).join('')}
                        </ul>
                    </dd>
                `;
            }
            
            if (content.factors && content.factors.length > 0) {
                html += `
                    <dd class="glossary-term-factors">
                        <strong>Key Factors:</strong>
                        <ul>
                            ${content.factors.map(f => `<li>${f}</li>`).join('')}
                        </ul>
                    </dd>
                `;
            }
            
            if (content.usage) {
                html += `<dd class="glossary-term-usage"><strong>Usage:</strong> ${content.usage}</dd>`;
            }
            
            if (content.permissions && content.permissions.length > 0) {
                html += `
                    <dd class="glossary-term-permissions">
                        <strong>Permissions:</strong>
                        <ul>
                            ${content.permissions.map(p => `<li>${p}</li>`).join('')}
                        </ul>
                    </dd>
                `;
            }
            
            if (content.restrictions && content.restrictions.length > 0) {
                html += `
                    <dd class="glossary-term-restrictions">
                        <strong>Restrictions:</strong>
                        <ul>
                            ${content.restrictions.map(r => `<li>${r}</li>`).join('')}
                        </ul>
                    </dd>
                `;
            }
            
            if (content.best_practices && content.best_practices.length > 0) {
                html += `
                    <dd class="glossary-term-best-practices">
                        <strong>Best Practices:</strong>
                        <ul>
                            ${content.best_practices.map(bp => `<li>${bp}</li>`).join('')}
                        </ul>
                    </dd>
                `;
            }
            
            if (content.crew_only) {
                html += `<dd class="glossary-term-badge"><span class="badge crew-only">Crew Only</span></dd>`;
            }
        }
        
        html += '</div>';
        return html;
    }

    filterGlossaryModal(query) {
        const terms = document.querySelectorAll('.glossary-term');
        const categories = document.querySelectorAll('.glossary-category');
        const lowerQuery = query.toLowerCase().trim();
        
        if (!lowerQuery) {
            // Show all
            terms.forEach(term => term.style.display = '');
            categories.forEach(cat => cat.style.display = '');
            return;
        }
        
        categories.forEach(category => {
            let hasVisibleTerms = false;
            const categoryTerms = category.querySelectorAll('.glossary-term');
            
            categoryTerms.forEach(term => {
                const termName = term.dataset.term || '';
                const termText = term.textContent.toLowerCase();
                
                if (termName.includes(lowerQuery) || termText.includes(lowerQuery)) {
                    term.style.display = '';
                    hasVisibleTerms = true;
                } else {
                    term.style.display = 'none';
                }
            });
            
            category.style.display = hasVisibleTerms ? '' : 'none';
        });
    }

    renderGlossaryPage() {
        const categoriesContainer = document.getElementById('glossary-categories');
        const contentContainer = document.getElementById('glossary-content');
        const searchInput = document.getElementById('glossary-page-search');
        
        if (!categoriesContainer || !contentContainer) {
            console.error('Glossary containers not found');
            return;
        }
        
        // Render category tabs
        const categories = getCategories();
        let tabsHtml = `
            <button class="glossary-category-tab active" data-category="all" aria-label="Show all categories">
                All
            </button>
        `;
        
        categories.forEach(category => {
            tabsHtml += `
                <button class="glossary-category-tab" data-category="${category}" aria-label="Show ${category}">
                    ${category}
                </button>
            `;
        });
        
        categoriesContainer.innerHTML = tabsHtml;
        
        // Render content
        this.renderGlossaryContent('all');
        
        // Setup category tab listeners
        const tabs = categoriesContainer.querySelectorAll('.glossary-category-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const category = tab.dataset.category;
                this.currentGlossaryCategory = category;
                this.renderGlossaryContent(category);
            });
        });
        
        // Setup search listener
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.glossarySearchQuery = e.target.value;
                this.renderGlossaryContent(this.currentGlossaryCategory);
            });
        }
    }

    renderGlossaryContent(category) {
        const contentContainer = document.getElementById('glossary-content');
        if (!contentContainer) return;
        
        let html = '';
        
        if (this.glossarySearchQuery.trim()) {
            // Search mode
            const results = searchGlossary(this.glossarySearchQuery);
            
            if (results.length === 0) {
                html = `
                    <div class="glossary-no-results">
                        <p>No results found for "${this.glossarySearchQuery}"</p>
                        <p>Try different keywords or browse by category.</p>
                    </div>
                `;
            } else {
                html = '<div class="glossary-search-results">';
                results.forEach(result => {
                    html += `
                        <div class="glossary-search-result">
                            <span class="result-category">${result.category}</span>
                            ${this.renderGlossaryTerm(result.term, result.content)}
                        </div>
                    `;
                });
                html += '</div>';
            }
        } else if (category === 'all') {
            // Show all categories
            const categories = getCategories();
            categories.forEach(cat => {
                html += this.renderGlossaryCategory(cat, glossaryData[cat]);
            });
        } else {
            // Show specific category
            html = this.renderGlossaryCategory(category, glossaryData[category]);
        }
        
        contentContainer.innerHTML = html;
    }
}

export default SommOS;
