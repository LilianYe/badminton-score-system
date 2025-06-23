// This file initializes the WeChat Mini Program and sets up global configurations.

App({
  onLaunch: function () {
    // Code to run when the app is launched
    console.log('Badminton Score System App Launched');
    
    // Initialize player data if it doesn't exist
    const players = wx.getStorageSync('players');
    if (!players) {
      wx.setStorageSync('players', []);
    }
    
    // Initialize user list if it doesn't exist
    const allUsers = wx.getStorageSync('allUsers');
    if (!allUsers) {
      wx.setStorageSync('allUsers', []);
    }
    
    // Check if user has logged in before
    const userInfo = wx.getStorageSync('userInfo');
    
    // Initialize cloud if available
    if (wx.cloud) {
      wx.cloud.init({
        traceUser: true,
      });
    }
    
    this.globalData = {
      defaultElo: 1500,
      userInfo: userInfo || null
    };
    
    // Update last login time if the user exists
    if (userInfo && userInfo.nickname) {
      try {
        userInfo.lastLoginAt = new Date().toISOString();
        wx.setStorageSync('userInfo', userInfo);
      } catch (e) {
        console.error('Failed to update last login time', e);
      }
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
  
  // Check if nickname is unique globally
  isNicknameUnique: function(nickname, excludeOpenid = null) {
    const allUsers = wx.getStorageSync('allUsers') || [];
    
    const existingUser = allUsers.find(user => 
      user.nickname && 
      user.nickname.toLowerCase() === nickname.toLowerCase() &&
      (!excludeOpenid || user.openid !== excludeOpenid)
    );
    
    return !existingUser;
  },
  
  // Get display nickname with gender indicator
  getDisplayNickname: function(user) {
    if (!user || !user.nickname) return 'Unknown';
    
    // Add "(F)" for female players
    if (user.gender === 'female') {
      return user.nickname + ' (F)';
    }
    
    return user.nickname;
  },
  
  // Get all users
  getAllUsers: function() {
    return wx.getStorageSync('allUsers') || [];
  },
  
  // Add or update user in global list
  saveUserToGlobalList: function(userInfo) {
    try {
      const allUsers = wx.getStorageSync('allUsers') || [];
      
      const existingUserIndex = allUsers.findIndex(user => user.openid === userInfo.openid);
      
      if (existingUserIndex >= 0) {
        allUsers[existingUserIndex] = {
          ...allUsers[existingUserIndex],
          ...userInfo,
          updatedAt: new Date().toISOString()
        };
      } else {
        allUsers.push({
          ...userInfo,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      wx.setStorageSync('allUsers', allUsers);
      return true;
    } catch (error) {
      console.error('Failed to save user to global list:', error);
      return false;
    }
  }
});