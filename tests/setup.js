// Mock WeChat APIs
global.wx = {
  // Storage APIs
  getStorageSync: jest.fn(),
  setStorageSync: jest.fn(),
  removeStorageSync: jest.fn(),
  
  // UI APIs
  showToast: jest.fn(),
  showLoading: jest.fn(),
  hideLoading: jest.fn(),
  showModal: jest.fn(),
  setNavigationBarTitle: jest.fn(),
  
  // Navigation APIs
  navigateTo: jest.fn(),
  navigateBack: jest.fn(),
  redirectTo: jest.fn(),
  switchTab: jest.fn(),
  reLaunch: jest.fn(),
  
  // Cloud APIs
  cloud: {
    init: jest.fn(),
    database: jest.fn().mockReturnValue({
      collection: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      get: jest.fn(),
      count: jest.fn(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      add: jest.fn(),
      doc: jest.fn().mockReturnThis(),
      update: jest.fn(),
      remove: jest.fn(),
      command: {
        gt: jest.fn(),
        gte: jest.fn(),
        lt: jest.fn(),
        lte: jest.fn(),
        eq: jest.fn(),
      }
    }),
    callFunction: jest.fn()
  },
  
  // Device APIs
  getSystemInfoSync: jest.fn().mockReturnValue({
    windowWidth: 375,
    windowHeight: 812,
    pixelRatio: 2
  }),
  
  // Event APIs
  stopPullDownRefresh: jest.fn()
};

// Mock getApp
global.getApp = jest.fn().mockReturnValue({
  globalData: {}
});

// Mock Page function
global.Page = (config) => config;

// Mock Component function
global.Component = (config) => config;

// Proper timer mocks with unref support
class MockTimer {
  unref() { return this; }
  ref() { return this; }
}

// Mock setTimeout with proper return value
global.setTimeout = jest.fn(() => new MockTimer());

// Mock clearTimeout
global.clearTimeout = jest.fn();

// Mock setInterval with proper return value
global.setInterval = jest.fn(() => new MockTimer());

// Mock clearInterval
global.clearInterval = jest.fn();

// Add regenerator runtime for async/await
require('regenerator-runtime/runtime');