/**
 * Centralized selectors for SommOS E2E tests
 * Priority: data-testid > aria-label > role > id > class
 */

export const Selectors = {
  // Authentication
  auth: {
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
    quickPairing: '[data-action="quick-pairing"]',
    checkStock: '[data-action="check-stock"]',
    recordConsumption: '[data-action="record-consumption"]',
    statsCards: '.stats-card',
    recentActivity: '#recent-activity',
  },
  
  // Inventory
  inventory: {
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
  },
  
  // Pairing
  pairing: {
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
  },
  
  // Modals and dialogs
  modals: {
    container: '.modal',
    overlay: '.modal-overlay',
    header: '.modal-header',
    body: '.modal-body',
    footer: '.modal-footer',
    closeButton: '.modal-close',
    confirmButton: '[data-action="confirm"]',
    cancelButton: '[data-action="cancel"]',
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
 */
export function testId(id: string): string {
  return `[data-testid="${id}"]`;
}

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
