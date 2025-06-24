const app = getApp();
const CloudDBService = require('../../utils/cloud-db.js');

Page({
  data: {
    userInfo: null,
    isLoading: true,
    isEditing: false,
    tempNickname: '',
    tempGender: 'male',
    genderOptions: ['male', 'female'],
    genderIndex: 0,
    nicknameAvailable: null,
    checkingAvailability: false
  },

  onLoad: function() {
    this.loadUserProfile();
  },

  onShow: function() {
    // Refresh user data when page is shown
    this.loadUserProfile();
  },

  // Load user profile from cloud database
  async loadUserProfile() {
    this.setData({ isLoading: true });
    
    try {
      const userInfo = await app.getCurrentUser();
      
      if (userInfo) {
        this.setData({
          userInfo: userInfo,
          tempNickname: userInfo.nickname || '',
          tempGender: userInfo.gender || 'male',
          genderIndex: userInfo.gender === 'female' ? 1 : 0,
          isLoading: false
        });
      } else {
        // No user logged in, redirect to login
        wx.redirectTo({
          url: '/pages/user-login/user-login'
        });
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      this.setData({ isLoading: false });
      
      wx.showToast({
        title: 'Failed to load profile',
        icon: 'none'
      });
    }
  },

  // Toggle edit mode
  toggleEdit: function() {
    this.setData({
      isEditing: !this.data.isEditing
    });
  },

  // Handle nickname input
  onNicknameInput: function(e) {
    const nickname = e.detail.value;
    this.setData({
      tempNickname: nickname
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
    this.availabilityTimeout = setTimeout(async () => {
      if (nickname.trim() && nickname.trim() !== this.data.userInfo.nickname) {
        this.setData({ checkingAvailability: true });
        
        try {
          const isAvailable = await app.isNicknameUnique(nickname.trim(), this.data.userInfo.openid);
          this.setData({
            nicknameAvailable: isAvailable,
            checkingAvailability: false
          });
        } catch (error) {
          console.error('Error checking nickname availability:', error);
          this.setData({
            nicknameAvailable: null,
            checkingAvailability: false
          });
        }
      } else {
        this.setData({
          nicknameAvailable: null,
          checkingAvailability: false
        });
      }
    }, 500); // 500ms delay
  },

  // Handle gender selection
  onGenderChange: function(e) {
    const selectedIndex = e.detail.value;
    const selectedGender = this.data.genderOptions[selectedIndex];
    
    this.setData({
      tempGender: selectedGender,
      genderIndex: selectedIndex
    });
  },

  // Save profile changes
  async saveProfile() {
    const { tempNickname, tempGender, userInfo } = this.data;
    
    // Validate nickname
    if (!tempNickname.trim()) {
      wx.showToast({
        title: 'Please enter a nickname',
        icon: 'none'
      });
      return;
    }
    
    if (tempNickname.trim().length > 20) {
      wx.showToast({
        title: 'Nickname too long (max 20 chars)',
        icon: 'none'
      });
      return;
    }
    
    // Check if nickname changed and is unique using WechatId
    if (tempNickname.trim() !== userInfo.nickname) {
      const isUnique = await app.isNicknameUnique(tempNickname.trim(), userInfo.openid);
      if (!isUnique) {
        wx.showToast({
          title: 'Nickname already taken',
          icon: 'none'
        });
        return;
      }
    }
    
    this.setData({ isLoading: true });
    
    try {
      // Update user profile
      const updatedUserInfo = {
        ...userInfo,
        nickname: tempNickname.trim(),
        gender: tempGender,
        updatedAt: new Date().toISOString()
      };
      
      // Save to cloud database using WechatId field
      const success = await app.saveUserToGlobalList(updatedUserInfo);
      
      if (success) {
        this.setData({
          userInfo: updatedUserInfo,
          isEditing: false,
          isLoading: false
        });
        
        wx.showToast({
          title: 'Profile updated successfully',
          icon: 'success'
        });
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      this.setData({ isLoading: false });
      
      wx.showToast({
        title: 'Failed to update profile',
        icon: 'none'
      });
    }
  },

  // Cancel edit mode
  cancelEdit: function() {
    this.setData({
      isEditing: false,
      tempNickname: this.data.userInfo.nickname,
      tempGender: this.data.userInfo.gender,
      genderIndex: this.data.userInfo.gender === 'female' ? 1 : 0,
      nicknameAvailable: null
    });
  },

  // Logout user
  logout: function() {
    wx.showModal({
      title: 'Confirm Logout',
      content: 'Are you sure you want to logout?',
      success: (res) => {
        if (res.confirm) {
          // Clear local storage
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

  // Sync data to cloud
  async syncToCloud() {
    wx.showLoading({
      title: 'Syncing...'
    });
    
    try {
      const success = await app.syncToCloud();
      if (success) {
        // Reload user profile after sync
        await this.loadUserProfile();
      }
    } catch (error) {
      console.error('Error syncing to cloud:', error);
    } finally {
      wx.hideLoading();
    }  }
}); 