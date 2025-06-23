const app = getApp();

Page({
  data: {
    username: '',
    isLoading: false
  },
  
  onLoad: function() {
    // Check if user is already logged in
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.username) {
      // Already logged in, redirect to main page
      this.redirectToMainPage();
    }
  },
  
  onUsernameInput: function(e) {
    this.setData({
      username: e.detail.value
    });
  },
  
  saveUsername: function() {
    const { username } = this.data;
    
    // Validate username
    if (!username.trim()) {
      wx.showToast({
        title: 'Please enter your name',
        icon: 'none'
      });
      return;
    }
    
    this.setData({ isLoading: true });
    
    // Store the user info in storage
    try {
      wx.setStorageSync('userInfo', {
        username: username.trim(),
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      });
      
      // Show success message
      wx.showToast({
        title: 'Welcome, ' + username + '!',
        icon: 'success'
      });
      
      // After short delay, redirect to main page
      setTimeout(() => {
        this.redirectToMainPage();
      }, 1500);
      
    } catch (error) {
      console.error('Failed to save user info:', error);
      wx.showToast({
        title: 'Failed to save user info',
        icon: 'none'
      });
      this.setData({ isLoading: false });
    }
  },
  
  redirectToMainPage: function() {
    wx.switchTab({
      url: '/pages/newGame/newGame'
    });
  }
});