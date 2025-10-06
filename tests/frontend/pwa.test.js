const path = require('path');
const fs = require('fs/promises');
const vm = require('vm');

const serviceWorkerPath = path.join(__dirname, '../../frontend/sw.js');
const swRegistrationCore = require('../../frontend/js/sw-registration-core.js');

async function evaluateServiceWorker(manifestEntries) {
  const code = await fs.readFile(serviceWorkerPath, 'utf8');

  const RequestMock = class {
    constructor(url, options = {}) {
      this.url = typeof url === 'string' ? url : url.toString();
      this.cache = options.cache;
    }
  };

  class ResponseMock {
    constructor(body, init = {}) {
      this.body = body;
      this.init = init;
    }

    static error() {
      return new ResponseMock(null, { error: true });
    }
  }

  const context = {
    console,
    URL,
    Request: RequestMock,
    Response: ResponseMock,
    fetch: jest.fn(),
    caches: {
      open: jest.fn(async () => ({
        addAll: jest.fn(),
        match: jest.fn(),
        put: jest.fn()
      })),
      keys: jest.fn(async () => []),
      delete: jest.fn(async () => true)
    },
    self: {
      location: { origin: 'https://example.com' },
      __WB_MANIFEST: manifestEntries,
      addEventListener: jest.fn(),
      skipWaiting: jest.fn(),
      clients: { claim: jest.fn() }
    }
  };

  vm.runInNewContext(code, context, { filename: 'sw.js' });

  return context.self.__SOMMOS_SW_TEST_HOOKS__;
}

describe('Service worker registration', () => {
  let navigatorMock;
  let windowMock;
  let consoleMock;

  beforeEach(() => {
    navigatorMock = {
      serviceWorker: {
        register: jest.fn(),
        addEventListener: jest.fn(),
        controller: {}
      }
    };
    windowMock = {
      addEventListener: jest.fn(),
      location: { reload: jest.fn() }
    };
    consoleMock = { log: jest.fn(), error: jest.fn() };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('skips registration in development mode', () => {
    swRegistrationCore.registerServiceWorker({
      env: { DEV: true },
      navigator: navigatorMock,
      window: windowMock,
      console: consoleMock
    });

    expect(windowMock.addEventListener).not.toHaveBeenCalled();
    expect(navigatorMock.serviceWorker.register).not.toHaveBeenCalled();
  });

  test('registers service worker on load event in production', async () => {
    const registrationMock = {
      waiting: null,
      addEventListener: jest.fn()
    };

    navigatorMock.serviceWorker.register.mockResolvedValue(registrationMock);

    swRegistrationCore.registerServiceWorker({
      env: { DEV: false },
      navigator: navigatorMock,
      window: windowMock,
      console: consoleMock
    });

    expect(windowMock.addEventListener).toHaveBeenCalledWith('load', expect.any(Function));

    const loadHandler = windowMock.addEventListener.mock.calls[0][1];
    await loadHandler();

    expect(navigatorMock.serviceWorker.register).toHaveBeenCalledWith('/sw.js');
    expect(navigatorMock.serviceWorker.addEventListener).toHaveBeenCalledWith('controllerchange', expect.any(Function));
  });
});

describe('Service worker asset cache keys', () => {
  test('includes hashed assets in precache requests', async () => {
    const hooks = await evaluateServiceWorker([
      { url: '/assets/app.abc123.js' }
    ]);

    const precacheUrls = hooks.precacheRequests.map((request) => request.url);

    expect(precacheUrls).toContain('https://example.com/assets/app.abc123.js');
    expect(hooks.precachePathSet.has('/assets/app.abc123.js')).toBe(true);
  });

  test('updates cache key set when hashed filename changes', async () => {
    const firstHooks = await evaluateServiceWorker([
      { url: '/assets/app.abc123.js' }
    ]);
    const secondHooks = await evaluateServiceWorker([
      { url: '/assets/app.def456.js' }
    ]);

    expect(firstHooks.precachePathSet.has('/assets/app.abc123.js')).toBe(true);
    expect(secondHooks.precachePathSet.has('/assets/app.def456.js')).toBe(true);
    expect(secondHooks.precachePathSet.has('/assets/app.abc123.js')).toBe(false);
  });
});
