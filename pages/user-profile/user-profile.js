const app = getApp();

Page({
  data: {
    userInfo: null,
    nickname: '',
    isEditing: false,
    isEditingGender: false,
    isLoading: false,
    originalNickname: '',
    nicknameAvailable: null,
    checkingAvailability: false,
    gender: 'male',
    genderOptions: ['male', 'female'],
    genderIndex: 0
  },
  
  onLoad: function() {
    this.loadUserInfo();
  },
  
  onShow: function() {
    this.loadUserInfo();
  },
  
  loadUserInfo: function() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      const genderIndex = userInfo.gender === 'female' ? 1 : 0;
      this.setData({
        userInfo: userInfo,
        nickname: userInfo.nickname || userInfo.nickName || 'Player',
        originalNickname: userInfo.nickname || userInfo.nickName || 'Player',
        gender: userInfo.gender || 'male',
        genderIndex: genderIndex
      });
    } else {
      // If no user info, redirect to login
      wx.redirectTo({
        url: '/pages/user-login/user-login'
      });
    }
  },
  
  startEdit: function() {
    this.setData({
      isEditing: true
    });
  },
  
  startEditGender: function() {
    this.setData({
      isEditingGender: true
    });
  },
  
  cancelEdit: function() {
    this.setData({
      isEditing: false,
      nickname: this.data.originalNickname
    });
  },
  
  cancelEditGender: function() {
    this.setData({
      isEditingGender: false
    });
  },
  
  onNicknameInput: function(e) {
    const nickname = e.detail.value;
    this.setData({
      nickname: nickname
    });
    
    // Check availability in real-time (debounced)
    this.checkNicknameAvailability(nickname);
  },
  
  // Check nickname availability with debouncing
  checkNicknameAvailability: function(nickname) {
    // Clear previous timeout
    if (this.availabilityTimeout) {
      clearTimeout(this.availabilityTimeout);
    }
    
    // Set new timeout for debouncing
    this.availabilityTimeout = setTimeout(() => {
      if (nickname.trim()) {
        const isAvailable = this.isNicknameUnique(nickname.trim(), this.data.userInfo.openid);
        this.setData({
          nicknameAvailable: isAvailable,
          checkingAvailability: false
        });
      } else {
        this.setData({
          nicknameAvailable: null,
          checkingAvailability: false
        });
      }
    }, 500); // 500ms delay
  },
  
  saveNickname: function() {
    const { nickname, userInfo } = this.data;
    
    // Validate nickname
    if (!nickname.trim()) {
      wx.showToast({
        title: 'Please enter a nickname',
        icon: 'none'
      });
      return;
    }
    
    if (nickname.trim().length > 20) {
      wx.showToast({
        title: 'Nickname too long (max 20 chars)',
        icon: 'none'
      });
      return;
    }
    
    // Check if nickname is unique (excluding current user)
    if (!this.isNicknameUnique(nickname.trim(), userInfo.openid)) {
      wx.showToast({
        title: 'Nickname already taken',
        icon: 'none'
      });
      return;
    }
    
    this.setData({ isLoading: true });
    
    try {
      // Update user info with new nickname
      const updatedUserInfo = {
        ...userInfo,
        nickname: nickname.trim(),
        updatedAt: new Date().toISOString()
      };
      
      // Save to storage
      wx.setStorageSync('userInfo', updatedUserInfo);
      
      // Update global user list
      this.updateUserInGlobalList(updatedUserInfo);
      
      // Update global data
      app.globalData.userInfo = updatedUserInfo;
      
      // Update data
      this.setData({
        userInfo: updatedUserInfo,
        originalNickname: nickname.trim(),
        isEditing: false,
        isLoading: false
      });
      
      wx.showToast({
        title: 'Nickname updated!',
        icon: 'success'
      });
      
    } catch (error) {
      console.error('Failed to update nickname:', error);
      wx.showToast({
        title: 'Failed to update nickname',
        icon: 'none'
      });
      this.setData({ isLoading: false });
    }
  },
  
  // Check if nickname is unique (excluding current user)
  isNicknameUnique: function(nickname, currentOpenid) {
    return app.isNicknameUnique(nickname, currentOpenid);
  },
  
  // Update user in global list
  updateUserInGlobalList: function(updatedUserInfo) {
    return app.saveUserToGlobalList(updatedUserInfo);
  },
  
  logout: function() {
    wx.showModal({
      title: 'Logout',
      content: 'Are you sure you want to logout?',
      success: (res) => {
        if (res.confirm) {
          // Clear user info
          wx.removeStorageSync('userInfo');
          app.globalData.userInfo = null;
          
          // Redirect to login page
          wx.redirectTo({
            url: '/pages/user-login/user-login'
          });
        }
      }
    });
  },
  
  goBack: function() {
    wx.navigateBack();
  },
  
  onGenderChange: function(e) {
    const selectedIndex = e.detail.value;
    const selectedGender = this.data.genderOptions[selectedIndex];
    
    this.setData({
      gender: selectedGender,
      genderIndex: selectedIndex
    });
  },
  
  saveGender: function() {
    const { gender, userInfo } = this.data;
    
    this.setData({ isLoading: true });
    
    try {
      // Update user info with new gender
      const updatedUserInfo = {
        ...userInfo,
        gender: gender,
        updatedAt: new Date().toISOString()
      };
      
      // Save to storage
      wx.setStorageSync('userInfo', updatedUserInfo);
      
      // Update global user list
      this.updateUserInGlobalList(updatedUserInfo);
      
      // Update global data
      app.globalData.userInfo = updatedUserInfo;
      
      // Update data
      this.setData({
        userInfo: updatedUserInfo,
        isEditingGender: false,
        isLoading: false
      });
      
      wx.showToast({
        title: 'Gender updated!',
        icon: 'success'
      });
      
    } catch (error) {
      console.error('Failed to update gender:', error);
      wx.showToast({
        title: 'Failed to update gender',
        icon: 'none'
      });
      this.setData({ isLoading: false });
    }
  }
}); 