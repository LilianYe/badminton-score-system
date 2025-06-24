// This file initializes the WeChat Mini Program and sets up global configurations.

// Import cloud database service
const CloudDBService = require('./utils/cloud-db.js');

App({
  onLaunch: function () {
    console.log('Badminton Score System App Launched');
    
    // Initialize cloud development environment first
    wx.cloud.init({
      env: "elo-system-8g6jq2r4a931945e", // Current cloud development environment ID
      traceUser: true
    });
    
    // Initialize cloud database service
    CloudDBService.init();
    
    // Initialize player data if it doesn't exist
    const players = wx.getStorageSync('players');
    if (!players) {
      wx.setStorageSync('players', []);
    }
    
    this.globalData = {
      defaultElo: 1500,
      userInfo: null
    };
    
    // Check if user has logged in before and update last login time
    this.checkAndUpdateLastLogin();
  },
  
  // Check if user has logged in and update last login time
  async checkAndUpdateLastLogin() {
    try {
      const storedOpenid = wx.getStorageSync('currentOpenid');
      if (storedOpenid) {
        // Update last login time in cloud database
        CloudDBService.updateLastLogin(storedOpenid).then(() => {
          console.log('Successfully updated last login time in cloud');
        }).catch(error => {
          console.error('Failed to update last login time in cloud:', error);
        });
      }
    } catch (error) {
      console.error('Error checking last login:', error);
    }
  },
  
  // Global utility functions
  globalData: {
    // Global data can be defined here
    userInfo: null,
    gameScores: [],
    defaultElo: 1500,  // Default starting ELO for new players
    kFactor: 32        // K-factor determines how much ratings change after a match
  },
  
  // Check if nickname is unique globally (now uses cloud database only)
  async isNicknameUnique(nickname, excludeOpenid = null) {
    try {
      // Check cloud database only
      const isUniqueInCloud = await CloudDBService.isNicknameUnique(nickname, excludeOpenid);
      return isUniqueInCloud;
    } catch (error) {
      console.error('Error checking nickname uniqueness in cloud database:', error);
      return false;
    }  },
  
  // Get all users (now from cloud database only)
  async getAllUsers() {
    try {
      // Get from cloud database only
      const cloudUsers = await CloudDBService.getAllUsers();
      console.log('Retrieved users from cloud database:', cloudUsers.length);
      return cloudUsers;
    } catch (error) {
      console.error('Error getting all users from cloud database:', error);
      return [];
    }
  },
  
  // Add or update user in global list (now uses cloud database only)
  async saveUserToGlobalList(userInfo) {
    try {
      console.log('Starting saveUserToGlobalList with userInfo:', userInfo);
      
      // Save to cloud database only
      console.log('Calling CloudDBService.loginOrRegisterUser...');
      const savedUser = await CloudDBService.loginOrRegisterUser(userInfo.openid, userInfo);
      console.log('Cloud database save successful, saved user:', savedUser);
      
      // Update global user info
      this.globalData.userInfo = savedUser;
      
      // Store minimal session info
      wx.setStorageSync('currentOpenid', savedUser.openid);
      
      console.log('User saved to cloud database successfully');
      return true;
    } catch (error) {
      console.error('Failed to save user to cloud database:', error);
      console.error('Error details:', {
        message: error.message,
        errCode: error.errCode,
        errMsg: error.errMsg,
        stack: error.stack
      });
      return false;
    }
  },
  
  // Get current user from cloud database
  async getCurrentUser() {
    try {
      console.log('getCurrentUser called');
      const storedOpenid = wx.getStorageSync('currentOpenid');
      console.log('Stored openid:', storedOpenid);
      
      if (storedOpenid) {
        // Try to get from cloud database
        console.log('Attempting to get user from cloud database...');
        const cloudUser = await CloudDBService.getUserByOpenid(storedOpenid);
        console.log('Cloud user result:', cloudUser);
        
        if (cloudUser) {
          // Update global user info
          this.globalData.userInfo = cloudUser;
          console.log('User found and set in global data');
          return cloudUser;
        } else {
          // User not found in cloud, clear stored openid
          console.log('User not found in cloud, clearing stored openid');
          wx.removeStorageSync('currentOpenid');
          this.globalData.userInfo = null;
        }
      } else {
        console.log('No stored openid found');
      }
      
      console.log('Returning null - no user found');
      return null;
    } catch (error) {
      console.error('Error getting current user from cloud database:', error);
      return null;
    }
  },
  
  // Sync local data to cloud database
  async syncToCloud() {
    try {
      const success = await CloudDBService.syncLocalToCloud();
      if (success) {
        console.log('Successfully synced local data to cloud database');
        wx.showToast({
          title: '数据同步成功',
          icon: 'success'
        });
      } else {
        console.error('Failed to sync local data to cloud database');
        wx.showToast({
          title: '数据同步失败',
          icon: 'none'
        });
      }
      return success;
    } catch (error) {
      console.error('Error syncing to cloud:', error);
      wx.showToast({
        title: '数据同步失败',
        icon: 'none'
      });
      return false;
    }
  },
  
  // Read all user profiles from cloud database
  async readAllCloudProfiles() {
    try {
      console.log('Reading all cloud profiles...');
      const result = await CloudDBService.readAllUserProfiles();
      
      if (result.success) {
        console.log(`Successfully read ${result.count} profiles from cloud database`);
        return result;
      } else {
        console.error('Failed to read cloud profiles:', result.error);
        return result;
      }
    } catch (error) {
      console.error('Error reading cloud profiles:', error);
      return {
        success: false,
        error: error,
        count: 0,
        rawData: [],
        mappedData: []
      };
    }
  },
  
  // Read specific user profile from cloud database
  async readCloudProfile(wechatId) {
    try {
      console.log('Reading cloud profile for:', wechatId);
      const result = await CloudDBService.readUserProfile(wechatId);
      
      if (result.success) {
        if (result.found) {
          console.log('Found user profile in cloud database');
        } else {
          console.log('User profile not found in cloud database');
        }
        return result;
      } else {
        console.error('Failed to read cloud profile:', result.error);
        return result;
      }
    } catch (error) {
      console.error('Error reading cloud profile:', error);
      return {
        success: false,
        error: error,
        found: false,
        rawData: null,
        mappedData: null
      };
    }
  }
});