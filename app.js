// This file initializes the WeChat Mini Program and sets up global configurations.

// Import service layers
const UserService = require('./utils/user-service.js');
const GameService = require('./utils/game-service.js');

App({
  onLaunch: function () {
    console.log('Badminton Score System App Launched');
    
    // Initialize cloud development environment first
    try {
      console.log('Initializing cloud environment in app.js...');
      wx.cloud.init({
        env: "elo-system-8g6jq2r4a931945e", // Current cloud development environment ID
        traceUser: true
      });
      console.log('Cloud environment initialized successfully in app.js');
    } catch (error) {
      console.error('Failed to initialize cloud environment in app.js:', error);
    }
    
    // Initialize service layers
    try {
      console.log('Initializing service layers...');
      UserService.init();
      GameService.init();
      console.log('Service layers initialized successfully');
    } catch (error) {
      console.error('Failed to initialize service layers:', error);
      // Show an error message to the user
      wx.showToast({
        title: '服务初始化失败',
        icon: 'none',
        duration: 3000
      });
    }
    
    // Initialize global data
    this.globalData = {
      currentUser: null,
      defaultElo: 1500,
      kFactor: 32
    };
    
    // Check if user has logged in before
    this.checkAndRestoreUser();
  },
  
  // Check if user has logged in and restore session
  async checkAndRestoreUser() {
    try {
      const currentUser = UserService.getCurrentUser();
      if (currentUser) {
        console.log('User session restored:', currentUser);
        this.globalData.currentUser = currentUser;
      } else {
        console.log('No user session found');
      }
    } catch (error) {
      console.error('Error checking user session:', error);
    }
  },
  
  // Global data
  globalData: {
    currentUser: null,  // Current logged in user
    defaultElo: 1500,   // Default starting ELO for new players
    kFactor: 32         // K-factor determines how much ratings change after a match
  },
  
  // App-level utility functions (delegates to services)
  
  /**
   * Check if nickname is unique (delegates to UserService)
   */
  async isNicknameUnique(nickname, excludeOpenid = null) {
    try {
      return await UserService.isNicknameUnique(nickname, excludeOpenid);
    } catch (error) {
      console.error('Error checking nickname uniqueness:', error);
      return false;
    }
  },
  
  /**
   * Get all users (delegates to UserService)
   */
  async getAllUsers() {
    try {
      return await UserService.getAllUsers();
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  },
  
  /**
   * Get current user (delegates to UserService)
   */
  async getCurrentUser() {
    try {
      const user = UserService.getCurrentUser();
      this.globalData.currentUser = user;
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  },
  
  /**
   * Save user (delegates to UserService)
   */
  async saveUserToGlobalList(userInfo) {
    try {
      console.log('Saving user to global list:', userInfo);
      
      if (userInfo.isNewUser) {
        // Register new user
        const registeredUser = await UserService.registerUser(userInfo.openid, userInfo);
        this.globalData.currentUser = registeredUser;
        return true;
      } else {
        // User already exists, just set as current
        UserService.setCurrentUser(userInfo.user);
        this.globalData.currentUser = userInfo.user;
        return true;
      }
    } catch (error) {
      console.error('Failed to save user:', error);
      return false;
    }
  },
  
  /**
   * Sync data to cloud (delegates to services)
   */
  async syncToCloud() {
    try {
      // This is now handled automatically by the service layers
      console.log('Data sync is now handled automatically by service layers');
      wx.showToast({
        title: '数据已自动同步',
        icon: 'success'
      });
      return true;
    } catch (error) {
      console.error('Error syncing to cloud:', error);
      wx.showToast({
        title: '数据同步失败',
        icon: 'none'
      });
      return false;
    }
  },
  
  /**
   * Read all cloud profiles (delegates to UserService)
   */
  async readAllCloudProfiles() {
    try {
      console.log('Reading all cloud profiles...');
      const users = await UserService.getAllUsers();
      console.log(`Retrieved ${users.length} users from cloud`);
      return users;
    } catch (error) {
      console.error('Error reading cloud profiles:', error);
      return [];
    }
  },
  
  /**
   * Read cloud profile by WeChat ID (delegates to UserService)
   */
  async readCloudProfile(wechatId) {
    try {
      console.log('Reading cloud profile for WeChat ID:', wechatId);
      const user = await UserService.getUserById(wechatId);
      console.log('Cloud profile result:', user);
      return user;
    } catch (error) {
      console.error('Error reading cloud profile:', error);
      return null;
    }
  }
});