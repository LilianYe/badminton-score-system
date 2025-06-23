const app = getApp();

Page({
  data: {
    isLoading: false,
    userInfo: null,
    hasUserInfo: false,
    canIUseGetUserProfile: false,
    isDevTools: false,
    showNicknameConfig: false,
    nickname: '',
    useWeChatName: true,
    gender: 'male',
    genderOptions: ['male', 'female'],
    genderIndex: 0,
    nicknameAvailable: null,
    checkingAvailability: false
  },
  
  onLoad: function() {
    // Check if user is already logged in
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.openid) {
      // Already logged in, redirect to main page
      this.redirectToMainPage();
      return;
    }
    
    // Check if we're in developer tools
    this.checkDevTools();
    
    // Check if getUserProfile is available (for newer WeChat versions)
    if (wx.getUserProfile) {
      this.setData({
        canIUseGetUserProfile: true
      });
    }
  },
  
  // Check if running in developer tools
  checkDevTools: function() {
    const systemInfo = wx.getSystemInfoSync();
    console.log('System info:', systemInfo);
    
    // Check if we're in developer tools
    if (systemInfo.platform === 'devtools') {
      this.setData({
        isDevTools: true
      });
      console.log('Running in WeChat Developer Tools');
    }
  },
  
  // Handle WeChat login
  handleWeChatLogin: function() {
    this.setData({ isLoading: true });
    
    wx.login({
      success: (res) => {
        console.log('wx.login success:', res);
        if (res.code) {
          // Get the login code, send to backend to get openid
          this.getOpenId(res.code);
        } else {
          console.error('Login failed:', res.errMsg);
          wx.showToast({
            title: 'Login failed: ' + res.errMsg,
            icon: 'none',
            duration: 3000
          });
          this.setData({ isLoading: false });
        }
      },
      fail: (err) => {
        console.error('wx.login failed:', err);
        wx.showToast({
          title: 'Login failed: ' + (err.errMsg || 'Unknown error'),
          icon: 'none',
          duration: 3000
        });
        this.setData({ isLoading: false });
      }
    });
  },
  
  // Get user profile (for newer WeChat versions)
  getUserProfile: function() {
    console.log('Attempting getUserProfile...');
    
    wx.getUserProfile({
      desc: 'Used for personalization',
      success: (res) => {
        console.log('getUserProfile success:', res);
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        });
        this.handleWeChatLogin();
      },
      fail: (err) => {
        console.error('getUserProfile failed:', err);
        
        // In developer tools, provide more helpful error message
        let errorMsg = 'Failed to get user info';
        if (this.data.isDevTools) {
          errorMsg = 'In Dev Tools: Click "Simulate" → "User Info" to authorize';
        } else if (err.errMsg) {
          errorMsg = err.errMsg;
        }
        
        wx.showToast({
          title: errorMsg,
          icon: 'none',
          duration: 4000
        });
        this.setData({ isLoading: false });
      }
    });
  },
  
  // Get user info (for older WeChat versions)
  getUserInfo: function(e) {
    console.log('getUserInfo called:', e);
    
    if (e.detail.userInfo) {
      console.log('User info received:', e.detail.userInfo);
      this.setData({
        userInfo: e.detail.userInfo,
        hasUserInfo: true
      });
      this.handleWeChatLogin();
    } else {
      console.log('User denied authorization');
      let errorMsg = 'Please authorize to continue';
      if (this.data.isDevTools) {
        errorMsg = 'In Dev Tools: Click "Simulate" → "User Info" to authorize';
      }
      
      wx.showToast({
        title: errorMsg,
        icon: 'none',
        duration: 4000
      });
    }
  },
  
  // Test mode login (for developer tools)
  testModeLogin: function() {
    console.log('Using test mode login');
    
    // Create mock user info for testing
    const mockUserInfo = {
      nickName: 'Test User',
      avatarUrl: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
      gender: 1,
      country: 'China',
      province: 'Guangdong',
      city: 'Shenzhen',
      language: 'zh_CN'
    };
    
    this.setData({
      userInfo: mockUserInfo,
      hasUserInfo: true
    });
    
    this.handleWeChatLogin();
  },
  
  // Get openid from backend (you'll need to implement this)
  getOpenId: function(code) {
    console.log('Getting openid for code:', code);
    
    // For now, we'll simulate getting openid
    // In a real app, you would send the code to your backend
    // and get back the openid and session_key
    
    // Simulate API call delay
    setTimeout(() => {
      // Generate a mock openid (in real app, this comes from WeChat server)
      const mockOpenid = 'mock_openid_' + Date.now();
      
      // Store temporary user info
      const tempUserInfo = {
        openid: mockOpenid,
        nickname: this.data.userInfo ? this.data.userInfo.nickName : 'Player',
        avatarUrl: this.data.userInfo ? this.data.userInfo.avatarUrl : '',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };
      
      // Show nickname configuration
      this.setData({
        nickname: tempUserInfo.nickname,
        showNicknameConfig: true,
        isLoading: false
      });
      
    }, 1000);
  },
  
  // Handle nickname configuration
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
        const isAvailable = this.isNicknameUnique(nickname.trim());
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
  
  toggleNameOption: function() {
    const { useWeChatName, userInfo } = this.data;
    this.setData({
      useWeChatName: !useWeChatName,
      nickname: !useWeChatName ? (userInfo ? userInfo.nickName : 'Player') : this.data.nickname
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
  
  saveNicknameAndContinue: function() {
    const { nickname, gender, userInfo } = this.data;
    
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
    
    // Check if nickname is unique
    if (!this.isNicknameUnique(nickname.trim())) {
      wx.showToast({
        title: 'Nickname already taken',
        icon: 'none'
      });
      return;
    }
    
    this.setData({ isLoading: true });
    
    try {
      // Create final user info with chosen nickname and gender
      const finalUserInfo = {
        openid: 'mock_openid_' + Date.now(), // This would come from the backend
        nickname: nickname.trim(),
        gender: gender,
        avatarUrl: userInfo ? userInfo.avatarUrl : '',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };
      
      // Save to storage
      wx.setStorageSync('userInfo', finalUserInfo);
      
      // Save to global user list
      this.saveUserToGlobalList(finalUserInfo);
      
      console.log('Storing user info:', finalUserInfo);
      
      wx.showToast({
        title: 'Welcome, ' + finalUserInfo.nickname + '!',
        icon: 'success'
      });
      
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
  
  // Check if nickname is unique
  isNicknameUnique: function(nickname) {
    return app.isNicknameUnique(nickname);
  },
  
  // Save user to global user list
  saveUserToGlobalList: function(userInfo) {
    return app.saveUserToGlobalList(userInfo);
  },
  
  redirectToMainPage: function() {
    wx.switchTab({
      url: '/pages/newGame/newGame'
    });
  }
});