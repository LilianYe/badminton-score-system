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
    if (userInfo && userInfo.username) {
      try {
        userInfo.lastLoginAt = new Date().toISOString();
        wx.setStorageSync('userInfo', userInfo);
      } catch (e) {
        console.error('Failed to update last login time', e);
      }
    }
  },
  globalData: {
    // Global data can be defined here
    userInfo: null,
    gameScores: [],
    defaultElo: 1500,  // Default starting ELO for new players
    kFactor: 32        // K-factor determines how much ratings change after a match
  }
});