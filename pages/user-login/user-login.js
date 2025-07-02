const app = getApp();
const UserService = require('../../utils/user-service.js');

Page({
  data: {
    isLoading: false,
    showRegistration: false,
    nickname: '',
    gender: 'male',
    genderOptions: ['male', 'female'],
    genderIndex: 0,
    nicknameAvailable: null,
    checkingAvailability: false,
    wechatUserInfo: null,
    openid: null,
    avatarUrl: '',
    isEditingAvatar: false
  },
  
  onLoad: function() {
    // Check if user is already logged in
    this.checkExistingLogin();
  },
  
  // Check if user is already logged in
  async checkExistingLogin() {
    try {
      const currentUser = UserService.getCurrentUser();
      if (currentUser) {
        console.log('User already logged in:', currentUser);
          this.redirectToMainPage();
          return;
      }
    } catch (error) {
      console.error('Error checking existing login:', error);
    }
  },
  
  // Handle WeChat login button click
  async handleWeChatLogin() {
    this.setData({ isLoading: true });
    
    try {
      console.log('Starting WeChat login process...');
      
      // Step 1: Get WeChat openid for user identification
      const openid = await this.getWeChatOpenid();
      console.log('WeChat openid obtained:', openid);
      
      // Step 2: Try to login with WeChat
      const loginResult = await UserService.loginWithWeChat();
      
      if (loginResult.success) {
        // Existing user - login successful
        console.log('Existing user logged in:', loginResult.user);
          
        wx.showToast({
          title: '欢迎回来，' + loginResult.user.Name + '！',
          icon: 'success'
        });
          
        // Redirect to main page
        setTimeout(() => {
          this.redirectToMainPage();
        }, 1500);
      } else {
        // New user - show registration page
        console.log('New user, showing registration page');
        
        this.setData({
          showRegistration: true,
          openid: openid,
          nickname: '',
          avatarUrl: '',
          isLoading: false
        });
        
        console.log('Registration page ready for new user');
        
        wx.showToast({
          title: '欢迎新用户！',
          icon: 'success'
        });
      }
    } catch (error) {
      console.error('WeChat login failed:', error);
      this.setData({ isLoading: false });
      
      let errorMessage = '登录失败';
      if (error.message.includes('denied authorization')) {
        errorMessage = '需要授权才能继续使用';
      } else if (error.message.includes('network')) {
        errorMessage = '网络连接失败，请重试';
      }
      
      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 3000
      });
    }
  },
  
  // Get WeChat openid
  async getWeChatOpenid() {
    return new Promise((resolve, reject) => {
      wx.login({
      success: (res) => {
          console.log('wx.login success:', res);
          if (res.code) {
            // Call cloud function to get openid
            wx.cloud.callFunction({
              name: 'getOpenId',
              success: (result) => {
                console.log('Cloud function getOpenId success:', result);
                if (result.result && result.result.openid) {
                  const openid = result.result.openid;
                  console.log('WeChat openid obtained:', openid);
                  resolve(openid);
    } else {
                  console.error('Cloud function returned error:', result.result);
                  reject(new Error('Failed to get openid from cloud function'));
                }
              },
              fail: (err) => {
                console.error('Cloud function getOpenId failed:', err);
                reject(err);
              }
            });
          } else {
            reject(new Error('Login failed: ' + res.errMsg));
          }
        },
        fail: (err) => {
          console.error('wx.login failed:', err);
          reject(err);
        }
      });
    });
  },
  
  // Handle gender selection
  onGenderChange: function(e) {
    const selectedIndex = e.detail.value;
    const selectedGender = this.data.genderOptions[selectedIndex];
    
    this.setData({
      gender: selectedGender,
      genderIndex: selectedIndex
    });
  },
  
  // Handle nickname input
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
    this.availabilityTimeout = setTimeout(async () => {
      if (nickname.trim()) {
        this.setData({ checkingAvailability: true });
        
        try {
          const isAvailable = await UserService.isNicknameUnique(nickname.trim());
          this.setData({
            nicknameAvailable: isAvailable,
            checkingAvailability: false
          });
        } catch (error) {
          console.error('检查昵称可用性时出错:', error);
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
  
  // Handle registration button click
  async handleRegister() {
    const { nickname, gender, openid, avatarUrl } = this.data;
    
    // Validate input
    if (!nickname.trim()) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }
    if (!avatarUrl) {
      wx.showToast({
        title: '请上传头像',
        icon: 'none'
      });
      return;
    }
    
    this.setData({ isLoading: true });
    
    try {
      // Check if nickname is unique
      const isUnique = await UserService.isNicknameUnique(nickname.trim());
      
      if (!isUnique) {
        wx.showToast({
          title: '昵称已被使用，请选择其他昵称',
          icon: 'none'
        });
        this.setData({ isLoading: false });
        return;
      }
      
      // Prepare user data
      const userData = {
        Name: nickname.trim(),
        Avatar: avatarUrl,
        Gender: gender
      };
      
      console.log('Registering new user with data:', userData);
      
      // Register user
      const registeredUser = await UserService.registerUser(openid, userData);
      
      console.log('User registered successfully:', registeredUser);
      
      wx.showToast({
        title: '注册成功',
        icon: 'success'
      });
      
      // Redirect to main page
      setTimeout(() => {
        this.redirectToMainPage();
      }, 1000);
      
    } catch (error) {
      console.error('Registration failed:', error);
      this.setData({ isLoading: false });
      
      wx.showToast({
        title: error.message || '注册失败',
        icon: 'none'
      });
    }
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
        
        const cloudPath = `avatars/${this.data.openid}_${Date.now()}.jpg`;
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: tempFilePath
        });
        
        wx.hideLoading();
        
        if (uploadRes.fileID) {
          this.setData({
            avatarUrl: uploadRes.fileID,
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

  // Toggle avatar editing
  toggleAvatarEdit() {
    this.setData({
      isEditingAvatar: !this.data.isEditingAvatar
    });
  },

  // Handle avatar load success
  onAvatarLoad(e) {
    console.log('Avatar loaded successfully:', e.detail);
  },

  // Handle avatar load error
  onAvatarError(e) {
    console.error('Avatar failed to load:', e.detail);
    console.log('Current avatar URL:', this.data.avatarUrl);
    console.log('WeChat avatar URL:', this.data.wechatUserInfo?.avatarUrl);
    
    // Set a fallback avatar if the WeChat avatar fails to load
    if (!this.data.avatarUrl && this.data.wechatUserInfo?.avatarUrl) {
      console.log('Setting fallback avatar due to load error');
      this.setData({
        avatarUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjBGMEYwIi8+CjxjaXJjbGUgY3g9IjUwIiBjeT0iMzUiIHI9IjE1IiBmaWxsPSIjQ0NDIi8+CjxwYXRoIGQ9Ik0yMCA3NUMyMCA2NS4wNTc2IDI4LjA1NzYgNTcgMzggNTdINjJDNzEuOTQyNCA1NyA4MCA2NS4wNTc2IDgwIDc1VjgwSDIwVjc1WiIgZmlsbD0iI0NDQyIvPgo8L3N2Zz4K'
      });
    }
  },
  
  // Redirect to main page
  redirectToMainPage: function() {
    wx.switchTab({
      url: '/pages/game-signup/game-signup'
    });
  }
});