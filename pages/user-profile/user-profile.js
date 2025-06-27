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
    checkingAvailability: false,
    isEditingAvatar: false,
    tempAvatarUrl: ''
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
          tempNickname: userInfo.Name || '',
          tempGender: userInfo.Gender || 'male',
          genderIndex: userInfo.Gender === 'female' ? 1 : 0,
          tempAvatarUrl: userInfo.Avatar || '',
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
      if (nickname.trim() && nickname.trim() !== this.data.userInfo.Name) {
        this.setData({ checkingAvailability: true });
        
        try {
          const isAvailable = await app.isNicknameUnique(nickname.trim(), this.data.userInfo._openid);
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
    const { tempNickname, tempGender, tempAvatarUrl, userInfo } = this.data;
    
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
    if (tempNickname.trim() !== userInfo.Name) {
      const isUnique = await app.isNicknameUnique(tempNickname.trim(), userInfo._openid);
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
        Name: tempNickname.trim(),
        Gender: tempGender,
        Avatar: tempAvatarUrl,
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
      tempNickname: this.data.userInfo.Name,
      tempGender: this.data.userInfo.Gender,
      genderIndex: this.data.userInfo.Gender === 'female' ? 1 : 0,
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
    }  },

  // Toggle avatar editing
  toggleAvatarEdit() {
    this.setData({
      isEditingAvatar: !this.data.isEditingAvatar
    });
  },

  // Handle avatar selection
  async chooseAvatar() {
    try {
      const res = await wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });
      
      if (res.tempFilePaths && res.tempFilePaths.length > 0) {
        const tempFilePath = res.tempFilePaths[0];
        
        // Upload to cloud storage
        wx.showLoading({ title: '上传中...' });
        
        const cloudPath = `avatars/${this.data.userInfo._openid}_${Date.now()}.jpg`;
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: tempFilePath
        });
        
        wx.hideLoading();
        
        if (uploadRes.fileID) {
          this.setData({
            tempAvatarUrl: uploadRes.fileID,
            isEditingAvatar: false
          });
          
          wx.showToast({
            title: '头像上传成功',
            icon: 'success'
          });
        } else {
          throw new Error('Upload failed');
        }
      }
    } catch (error) {
      wx.hideLoading();
      console.error('Avatar selection failed:', error);
      wx.showToast({
        title: '头像选择失败',
        icon: 'none'
      });
    }
  },

  // Use original avatar
  useOriginalAvatar() {
    this.setData({
      tempAvatarUrl: this.data.userInfo.Avatar || '',
      isEditingAvatar: false
    });
    
    wx.showToast({
      title: '使用原头像',
      icon: 'success'
    });
  }
}); 