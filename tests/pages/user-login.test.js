// Test file for pages/user-profile/user-profile.js

// Import required dependencies
const fs = require('fs');
const path = require('path');

// Mock the cloud-db service dependency
jest.mock('../../utils/cloud-db.js');
const CloudDBService = require('../../utils/cloud-db.js');

// Capture the Page config when Page() is called
let pageConfig = null;
global.Page = jest.fn(config => {
  pageConfig = config;
  return config;
});

// Mock getApp to avoid errors and provide necessary functions
global.getApp = jest.fn().mockReturnValue({
  getCurrentUser: jest.fn(),
  isNicknameUnique: jest.fn(),
  saveUserToGlobalList: jest.fn(),
  syncToCloud: jest.fn(),
  globalData: {
    userInfo: null
  }
});

// Import the actual page file - this will trigger the Page() call
const userProfilePagePath = path.join(__dirname, '../../pages/user-profile/user-profile.js');
require(userProfilePagePath);

// Reference to the mocked app
const app = getApp();

describe('User Profile Page Tests', () => {
  let page;
  
  // Mock user info for testing
  const mockUserInfo = {
    _id: 'user-123',
    _openid: 'openid-123',
    Name: 'TestUser',
    Gender: 'male',
    Avatar: 'test-avatar-url',
    updatedAt: '2025-07-01T12:00:00.000Z'
  };
  
  // Setup mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Don't use fake timers, we'll handle the timeouts differently
    // jest.useFakeTimers();  <-- This line caused the error
    
    // Mock app methods
    app.getCurrentUser.mockResolvedValue(mockUserInfo);
    app.isNicknameUnique.mockResolvedValue(true);
    app.saveUserToGlobalList.mockResolvedValue(true);
    app.syncToCloud.mockResolvedValue(true);
    
    // Mock wx API methods
    global.wx = {
      cloud: {
        uploadFile: jest.fn(),
        init: jest.fn()
      },
      showToast: jest.fn(),
      showLoading: jest.fn(),
      hideLoading: jest.fn(),
      showModal: jest.fn(),
      redirectTo: jest.fn(),
      removeStorageSync: jest.fn(),
      chooseImage: jest.fn()
    };
    
    // Create a page instance from the captured configuration
    page = { 
      ...pageConfig,
      data: { ...pageConfig.data },
      setDataArgs: null, // Track setData calls
      setData: jest.fn(function(data) {
        this.setDataArgs = data; // Store the most recent call
        this.data = { ...this.data, ...data };
      })
    };
  });

  // Remove afterEach hook since we're not using fake timers
  // afterEach(() => {
  //   jest.useRealTimers();
  // });

  // TESTS FOR PROFILE LOADING

  test('onLoad should load user profile', () => {
    // Spy on loadUserProfile
    const loadProfileSpy = jest.spyOn(page, 'loadUserProfile').mockResolvedValue();
    
    // Call onLoad
    page.onLoad();
    
    // Verify loadUserProfile was called
    expect(loadProfileSpy).toHaveBeenCalledTimes(1);
  });

  test('onShow should reload user profile', () => {
    // Spy on loadUserProfile
    const loadProfileSpy = jest.spyOn(page, 'loadUserProfile').mockResolvedValue();
    
    // Call onShow
    page.onShow();
    
    // Verify loadUserProfile was called
    expect(loadProfileSpy).toHaveBeenCalledTimes(1);
  });

  test('loadUserProfile should load and display user data', async () => {
    // Call loadUserProfile
    await page.loadUserProfile();
    
    // Verify app.getCurrentUser was called
    expect(app.getCurrentUser).toHaveBeenCalled();
    
    // Verify user data was set correctly
    expect(page.setDataArgs).toEqual({
      userInfo: mockUserInfo,
      tempNickname: mockUserInfo.Name,
      tempGender: mockUserInfo.Gender,
      genderIndex: 0, // male
      tempAvatarUrl: mockUserInfo.Avatar,
      isLoading: false
    });
  });

  test('loadUserProfile should handle female gender', async () => {
    // Override mock to return a female user
    const femaleUserInfo = {...mockUserInfo, Gender: 'female'};
    app.getCurrentUser.mockResolvedValue(femaleUserInfo);
    
    // Call loadUserProfile
    await page.loadUserProfile();
    
    // Verify gender index was set correctly for female
    expect(page.setDataArgs).toEqual(expect.objectContaining({
      genderIndex: 1 // female
    }));
  });

  test('loadUserProfile should redirect if no user is found', async () => {
    // Override mock to return null (no user logged in)
    app.getCurrentUser.mockResolvedValue(null);
    
    // Call loadUserProfile
    await page.loadUserProfile();
    
    // Verify redirect was called
    expect(wx.redirectTo).toHaveBeenCalledWith({
      url: '/pages/user-login/user-login'
    });
  });

  test('loadUserProfile should handle errors', async () => {
    // Override mock to throw an error
    app.getCurrentUser.mockRejectedValue(new Error('Test error'));
    
    // Call loadUserProfile
    await page.loadUserProfile();
    
    // Verify error handling
    expect(wx.showToast).toHaveBeenCalledWith({
      title: 'Failed to load profile',
      icon: 'none'
    });
    expect(page.setDataArgs).toEqual({ isLoading: false });
  });

  // TESTS FOR EDITING FUNCTIONS

  test('toggleEdit should toggle editing mode', () => {
    // Initial state
    page.data.isEditing = false;
    
    // Call toggleEdit
    page.toggleEdit();
    
    // Verify state was toggled
    expect(page.setDataArgs).toEqual({ isEditing: true });
    
    // Update state
    page.data.isEditing = true;
    
    // Call toggleEdit again
    page.toggleEdit();
    
    // Verify state was toggled back
    expect(page.setDataArgs).toEqual({ isEditing: false });
  });

  test('onNicknameInput should update nickname and check availability', () => {
    // Spy on checkNicknameAvailability
    const checkSpy = jest.spyOn(page, 'checkNicknameAvailability');
    
    // Call onNicknameInput
    const newNickname = 'NewNickname';
    page.onNicknameInput({ detail: { value: newNickname } });
    
    // Verify nickname was updated
    expect(page.setDataArgs).toEqual({ tempNickname: newNickname });
    
    // Verify availability check was triggered
    expect(checkSpy).toHaveBeenCalledWith(newNickname);
  });

  test('checkNicknameAvailability should handle new nicknames', async () => {
    // Setup necessary data
    page.data.userInfo = {...mockUserInfo};
    
    // Instead of using setTimeout, we'll mock it with our own implementation
    const origSetTimeout = global.setTimeout;
    let timeoutCallback;
    global.setTimeout = jest.fn((callback, delay) => {
      timeoutCallback = callback;
      return 123; // Mock timer ID
    });
    
    // Call checkNicknameAvailability with a new nickname
    page.checkNicknameAvailability('NewNickname');
    
    // Manually call the timeout callback
    await timeoutCallback();
    
    // Restore setTimeout
    global.setTimeout = origSetTimeout;
    
    // Verify app.isNicknameUnique was called
    expect(app.isNicknameUnique).toHaveBeenCalledWith('NewNickname', mockUserInfo._openid);
    
    // Verify UI updates
    expect(page.setData).toHaveBeenCalledWith({
      nicknameAvailable: true,
      checkingAvailability: false
    });
  });

  test('checkNicknameAvailability should skip check for unchanged nicknames', async () => {
    // Setup necessary data
    page.data.userInfo = {...mockUserInfo};
    
    // Instead of using setTimeout, we'll mock it with our own implementation
    const origSetTimeout = global.setTimeout;
    let timeoutCallback;
    global.setTimeout = jest.fn((callback, delay) => {
      timeoutCallback = callback;
      return 123; // Mock timer ID
    });
    
    // Call checkNicknameAvailability with the same nickname
    page.checkNicknameAvailability(mockUserInfo.Name);
    
    // Manually call the timeout callback
    await timeoutCallback();
    
    // Restore setTimeout
    global.setTimeout = origSetTimeout;
    
    // Verify app.isNicknameUnique was NOT called (nickname unchanged)
    expect(app.isNicknameUnique).not.toHaveBeenCalled();
    
    // Verify reset of availability
    expect(page.setDataArgs).toEqual({
      nicknameAvailable: null,
      checkingAvailability: false
    });
  });

  test('checkNicknameAvailability should handle empty nicknames', async () => {
    // Setup necessary data
    page.data.userInfo = {...mockUserInfo};
    
    // Instead of using setTimeout, we'll mock it with our own implementation
    const origSetTimeout = global.setTimeout;
    let timeoutCallback;
    global.setTimeout = jest.fn((callback, delay) => {
      timeoutCallback = callback;
      return 123; // Mock timer ID
    });
    
    // Call checkNicknameAvailability with empty nickname
    page.checkNicknameAvailability('  ');
    
    // Manually call the timeout callback
    await timeoutCallback();
    
    // Restore setTimeout
    global.setTimeout = origSetTimeout;
    
    // Verify app.isNicknameUnique was NOT called
    expect(app.isNicknameUnique).not.toHaveBeenCalled();
    
    // Verify reset of availability
    expect(page.setDataArgs).toEqual({
      nicknameAvailable: null,
      checkingAvailability: false
    });
  });

  test('checkNicknameAvailability should handle errors', async () => {
    // Setup necessary data
    page.data.userInfo = {...mockUserInfo};
    
    // Override mock to throw error
    app.isNicknameUnique.mockRejectedValue(new Error('Test error'));
    
    // Instead of using setTimeout, we'll mock it with our own implementation
    const origSetTimeout = global.setTimeout;
    let timeoutCallback;
    global.setTimeout = jest.fn((callback, delay) => {
      timeoutCallback = callback;
      return 123; // Mock timer ID
    });
    
    // Call checkNicknameAvailability
    page.checkNicknameAvailability('NewNickname');
    
    // Manually call the timeout callback
    await timeoutCallback();
    
    // Restore setTimeout
    global.setTimeout = origSetTimeout;
    
    // Verify error handling
    expect(page.setDataArgs).toEqual({
      nicknameAvailable: null,
      checkingAvailability: false
    });
  });

  test('checkNicknameAvailability should clear previous timeout', () => {
    // Create a mock timeout
    const mockTimeout = 123;
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    page.availabilityTimeout = mockTimeout;
    
    // Call checkNicknameAvailability
    page.checkNicknameAvailability('TestName');
    
    // Verify timeout was cleared
    expect(clearTimeoutSpy).toHaveBeenCalledWith(mockTimeout);
  });

  test('onGenderChange should update gender selection', () => {
    // Setup initial data
    page.data.genderOptions = ['male', 'female'];
    
    // Call onGenderChange with female selected
    page.onGenderChange({ detail: { value: 1 } });
    
    // Verify gender was updated
    expect(page.setDataArgs).toEqual({
      tempGender: 'female',
      genderIndex: 1
    });
  });

  // TESTS FOR PROFILE SAVING

  test('saveProfile should validate required fields', async () => {
    // Setup data with empty nickname
    page.data.tempNickname = '';
    
    // Call saveProfile
    await page.saveProfile();
    
    // Verify validation error
    expect(wx.showToast).toHaveBeenCalledWith({
      title: 'Please enter a nickname',
      icon: 'none'
    });
  });

  test('saveProfile should validate nickname length', async () => {
    // Setup data with too long nickname
    page.data.tempNickname = 'A'.repeat(21); // 21 characters
    
    // Call saveProfile
    await page.saveProfile();
    
    // Verify validation error
    expect(wx.showToast).toHaveBeenCalledWith({
      title: 'Nickname too long (max 20 chars)',
      icon: 'none'
    });
  });

  test('saveProfile should validate nickname uniqueness', async () => {
    // Setup data
    page.data.tempNickname = 'NewNickname';
    page.data.userInfo = {...mockUserInfo};
    
    // Mock nickname uniqueness check to return false (name taken)
    app.isNicknameUnique.mockResolvedValue(false);
    
    // Call saveProfile
    await page.saveProfile();
    
    // Verify validation error
    expect(wx.showToast).toHaveBeenCalledWith({
      title: 'Nickname already taken',
      icon: 'none'
    });
  });

  test('saveProfile should update profile successfully', async () => {
    // Setup data
    page.data.tempNickname = 'UpdatedName';
    page.data.tempGender = 'female';
    page.data.tempAvatarUrl = 'new-avatar-url';
    page.data.userInfo = {...mockUserInfo};
    
    // Mock successful nickname uniqueness check
    app.isNicknameUnique.mockResolvedValue(true);
    
    // Mock Date to get consistent timestamp
    const mockISOString = '2025-07-08T12:00:00.000Z';
    const origDateNow = Date.prototype.toISOString;
    Date.prototype.toISOString = jest.fn(() => mockISOString);
    
    // Call saveProfile
    await page.saveProfile();
    
    // Restore Date
    Date.prototype.toISOString = origDateNow;
    
    // Verify app.saveUserToGlobalList was called with correct data
    expect(app.saveUserToGlobalList).toHaveBeenCalledWith({
      ...mockUserInfo,
      Name: 'UpdatedName',
      Gender: 'female',
      Avatar: 'new-avatar-url',
      updatedAt: mockISOString
    });
    
    // Verify UI updates
    expect(page.setDataArgs).toEqual({
      userInfo: {
        ...mockUserInfo,
        Name: 'UpdatedName',
        Gender: 'female',
        Avatar: 'new-avatar-url',
        updatedAt: mockISOString
      },
      isEditing: false,
      isLoading: false
    });
    
    // Verify success message
    expect(wx.showToast).toHaveBeenCalledWith({
      title: 'Profile updated successfully',
      icon: 'success'
    });
  });

  test('saveProfile should handle update failure', async () => {
    // Setup data
    page.data.tempNickname = 'UpdatedName';
    page.data.tempGender = 'female';
    page.data.tempAvatarUrl = 'new-avatar-url';
    page.data.userInfo = {...mockUserInfo};
    
    // Mock failed profile save
    app.saveUserToGlobalList.mockResolvedValue(false);
    
    // Call saveProfile
    await page.saveProfile();
    
    // Verify error handling
    expect(wx.showToast).toHaveBeenCalledWith({
      title: 'Failed to update profile',
      icon: 'none'
    });
  });

  test('saveProfile should handle errors', async () => {
    // Setup data
    page.data.tempNickname = 'UpdatedName';
    page.data.tempGender = 'female';
    page.data.tempAvatarUrl = 'new-avatar-url';
    page.data.userInfo = {...mockUserInfo};
    
    // Mock error
    app.saveUserToGlobalList.mockRejectedValue(new Error('Test error'));
    
    // Call saveProfile
    await page.saveProfile();
    
    // Verify error handling
    expect(page.setDataArgs).toEqual({ isLoading: false });
    expect(wx.showToast).toHaveBeenCalledWith({
      title: 'Failed to update profile',
      icon: 'none'
    });
  });

  test('cancelEdit should reset temporary values', () => {
    // Setup data
    page.data.userInfo = {...mockUserInfo};
    
    // Call cancelEdit
    page.cancelEdit();
    
    // Verify reset values
    expect(page.setDataArgs).toEqual({
      isEditing: false,
      tempNickname: mockUserInfo.Name,
      tempGender: mockUserInfo.Gender,
      genderIndex: 0, // male
      nicknameAvailable: null
    });
  });

  // TESTS FOR LOGOUT FUNCTIONALITY

  test('logout should show confirmation and logout when confirmed', () => {
    // Mock showModal to simulate confirmation
    wx.showModal.mockImplementation(({ success }) => {
      success({ confirm: true });
    });
    
    // Call logout
    page.logout();
    
    // Verify confirmation was shown
    expect(wx.showModal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Confirm Logout',
        content: 'Are you sure you want to logout?'
      })
    );
    
    // Verify storage was cleared
    expect(wx.removeStorageSync).toHaveBeenCalledWith('userInfo');
    expect(app.globalData.userInfo).toBeNull();
    
    // Verify redirect
    expect(wx.redirectTo).toHaveBeenCalledWith({
      url: '/pages/user-login/user-login'
    });
  });

  test('logout should not proceed when cancelled', () => {
    // Mock showModal to simulate cancellation
    wx.showModal.mockImplementation(({ success }) => {
      success({ confirm: false });
    });
    
    // Call logout
    page.logout();
    
    // Verify storage was not cleared
    expect(wx.removeStorageSync).not.toHaveBeenCalled();
    
    // Verify no redirect
    expect(wx.redirectTo).not.toHaveBeenCalled();
  });

  // Add remaining tests...
  // (The rest of the tests remain mostly the same, just make sure not to use jest.useFakeTimers 
  // or any timer advancement functions like jest.advanceTimersByTime)
});