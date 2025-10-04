/**
 * Centralized selectors for SommOS E2E tests
 * Priority: data-testid > aria-label > role > id > class
 */

export const Selectors = {
  // Authentication
  auth: {
    // ID-based selectors (legacy)
    screen: '#auth-screen',
    memberLoginTab: '#member-login-tab',
    guestLoginTab: '#guest-login-tab',
    memberPanel: '#member-login-panel',
    guestPanel: '#guest-login-panel',
    emailInput: '#login-email',
    passwordInput: '#login-password',
    loginButton: '#login-submit',
    guestCodeInput: '#guest-event-code',
    guestPinToggle: '#guest-pin-toggle',
    guestPinGroup: '#guest-pin-group',
    guestPinInput: '#guest-pin',
    guestLoginButton: '#guest-login-btn',
    loginError: '#login-error',
    guestError: '#guest-error',
    logoutButton: '#logout-btn',
    // data-testid selectors (stable)
    memberLoginTabTestId: testId('auth-tab-member'),
    guestLoginTabTestId: testId('auth-tab-guest'),
    memberForm: testId('auth-form-member'),
    emailInputTestId: testId('auth-input-email'),
    passwordInputTestId: testId('auth-input-password'),
    loginButtonTestId: testId('auth-button-login'),
    guestCodeInputTestId: testId('auth-input-guest-code'),
    guestPinInputTestId: testId('auth-input-guest-pin'),
    guestPinToggleTestId: testId('auth-checkbox-guest-pin-toggle'),
    guestLoginButtonTestId: testId('auth-button-guest-login'),
  },
  
  // Loading and app container
  app: {
    loadingScreen: '#loading-screen',
    container: '#app',
    guestBanner: '#guest-session-banner',
    guestBannerClose: '#close-guest-banner',
  },
  
  // Navigation
  nav: {
    // Legacy selectors
    container: '.main-nav',
    brand: '.nav-brand',
    dashboard: '[data-view="dashboard"]',
    pairing: '[data-view="pairing"]',
    inventory: '[data-view="inventory"]',
    procurement: '[data-view="procurement"]',
    catalog: '[data-view="catalog"]',
    glossary: '[data-view="glossary"]',
    userRoleBadge: '#user-role-badge',
    userEmail: '#user-email',
    guestNotice: '#guest-notice',
    helpButton: '#help-btn',
    settingsButton: '#settings-btn',
    syncButton: '#sync-btn',
    // data-testid selectors (stable)
    dashboardTestId: testId('nav-dashboard'),
    pairingTestId: testId('nav-pairing'),
    inventoryTestId: testId('nav-inventory'),
    procurementTestId: testId('nav-procurement'),
    catalogTestId: testId('nav-catalog'),
    glossaryTestId: testId('nav-glossary'),
    helpButtonTestId: testId('nav-action-help'),
    syncButtonTestId: testId('nav-action-sync'),
    settingsButtonTestId: testId('nav-action-settings'),
    logoutButtonTestId: testId('nav-action-logout'),
  },
  
  // Views
  views: {
    dashboard: '#dashboard-view',
    pairing: '#pairing-view',
    inventory: '#inventory-view',
    procurement: '#procurement-view',
    catalog: '#catalog-view',
    glossary: '#glossary-view',
  },
  
  // Dashboard
  dashboard: {
    // Legacy selectors
    quickPairing: '[data-action="quick-pairing"]',
    checkStock: '[data-action="check-stock"]',
    recordConsumption: '[data-action="record-consumption"]',
    statsCards: '.stats-card',
    recentActivity: '#recent-activity',
    // data-testid selectors (stable)
    quickPairingTestId: testId('dashboard-action-pairing'),
    recordServiceTestId: testId('dashboard-action-record'),
  },
  
  // Inventory
  inventory: {
    // Legacy selectors
    searchInput: '#inventory-search',
    filterType: '#filter-type',
    filterLocation: '#filter-location',
    sortBy: '#sort-by',
    addBottleButton: '#add-bottle-btn',
    inventoryTable: '#inventory-table',
    inventoryRows: '[data-wine-id]',
    editButton: '[data-action="edit"]',
    deleteButton: '[data-action="delete"]',
    moveButton: '[data-action="move"]',
    emptyState: '.empty-state',
    // data-testid selectors (stable)
    searchInputTestId: testId('inventory-search-input'),
    searchButtonTestId: testId('inventory-button-search'),
    locationFilterTestId: testId('inventory-filter-location'),
    typeFilterTestId: testId('inventory-filter-type'),
    refreshButtonTestId: testId('inventory-button-refresh'),
    gridTestId: testId('inventory-grid'),
    wineCard: (id?: string) => id ? testId(`inventory-card-${id}`) : '.wine-card',
    detailsButton: (id: string) => testId(`inventory-button-details-${id}`),
    reserveButton: (id: string) => testId(`inventory-button-reserve-${id}`),
    serveButton: (id: string) => testId(`inventory-button-serve-${id}`),
  },
  
  // Pairing
  pairing: {
    // Legacy selectors
    dishInput: '#dish-description',
    occasionSelect: '#occasion',
    guestCountInput: '#guest-count',
    getPairingButton: '#get-pairing-btn',
    resultsContainer: '#pairing-results',
    recommendationCard: '.recommendation-card',
    confidenceScore: '.confidence-score',
    thumbsUp: '[data-action="thumbs-up"]',
    thumbsDown: '[data-action="thumbs-down"]',
    saveButton: '[data-action="save-pairing"]',
    // data-testid selectors (stable)
    dishInputTestId: testId('pairing-input-dish'),
    occasionSelectTestId: testId('pairing-select-occasion'),
    guestCountInputTestId: testId('pairing-input-guests'),
    preferencesInputTestId: testId('pairing-input-preferences'),
    submitButtonTestId: testId('pairing-button-submit'),
    resultsContainerTestId: testId('pairing-results-container'),
    resultsListTestId: testId('pairing-results-list'),
    thumbsUpButtonTestId: testId('pairing-button-thumbs-up'),
    thumbsDownButtonTestId: testId('pairing-button-thumbs-down'),
  },
  
  // Modals and dialogs
  modals: {
    // Legacy selectors
    container: '.modal',
    overlay: '.modal-overlay',
    header: '.modal-header',
    body: '.modal-body',
    footer: '.modal-footer',
    closeButton: '.modal-close',
    confirmButton: '[data-action="confirm"]',
    cancelButton: '[data-action="cancel"]',
    // data-testid selectors (stable)
    overlayTestId: testId('modal-overlay'),
    containerTestId: testId('modal-container'),
    titleTestId: testId('modal-title'),
    bodyTestId: testId('modal-body'),
    closeButtonTestId: testId('modal-button-close'),
    confirmButtonTestId: testId('modal-button-confirm'),
    cancelButtonTestId: testId('modal-button-cancel'),
  },
  
  // Forms
  forms: {
    field: '.form-group',
    label: 'label',
    input: 'input',
    select: 'select',
    textarea: 'textarea',
    error: '.form-error',
    help: '.form-help',
    submitButton: '[type="submit"]',
  },
  
  // Toasts and notifications
  notifications: {
    toast: '.toast',
    toastSuccess: '.toast.success',
    toastError: '.toast.error',
    toastWarning: '.toast.warning',
    toastInfo: '.toast.info',
  },
  
  // Tables
  tables: {
    table: 'table',
    thead: 'thead',
    tbody: 'tbody',
    row: 'tr',
    cell: 'td',
    headerCell: 'th',
    sortableHeader: '[data-sortable]',
  },
} as const;

/**
 * Generate data-testid selector
 * Helper function used in selector definitions
 */
function testId(id: string): string {
  return `[data-testid="${id}"]`;
}

/**
 * Export testId for use in tests
 */
export { testId };

/**
 * Generate aria-label selector
 */
export function ariaLabel(label: string): string {
  return `[aria-label="${label}"]`;
}

/**
 * Generate role selector
 */
export function role(roleName: string, name?: string): string {
  if (name) {
    return `[role="${roleName}"][name="${name}"]`;
  }
  return `[role="${roleName}"]`;
}
