const app = getApp();
const CloudDBService = require('../../utils/cloud-db.js');

Page({
  data: {
    isLoading: false,
    userInfo: null,
    hasUserInfo: false,
    canIUseGetUserProfile: false,
    isDevTools: false,
    showNicknameConfig: false,
    nickname: '',
    gender: 'male',
    genderOptions: ['male', 'female'],
    genderIndex: 0,
    nicknameAvailable: null,
    checkingAvailability: false
  },
  
  onLoad: function() {
    // Check if user is already logged in from cloud database
    this.checkExistingLogin();
    
    // Check if we're in developer tools
    this.checkDevTools();
    
    // Check if getUserProfile is available (for newer WeChat versions)
    if (wx.getUserProfile) {
      this.setData({
        canIUseGetUserProfile: true
      });
    }
  },
  
  // Check if user is already logged in from cloud database
  async checkExistingLogin() {
    try {
      // Check if we have a stored openid (from previous session)
      const storedOpenid = wx.getStorageSync('currentOpenid');
      if (storedOpenid) {
        console.log('Found stored openid, checking cloud database...');
        
        // Try to get fresh data from cloud database
        const cloudUser = await CloudDBService.getUserByOpenid(storedOpenid);
        if (cloudUser) {
          console.log('User found in cloud database, auto-login');
          
          // Store minimal info for session management
          wx.setStorageSync('currentOpenid', cloudUser.openid);
          app.globalData.userInfo = cloudUser;
          
          // Already logged in, redirect to main page
          this.redirectToMainPage();
          return;
        } else {
          console.log('User not found in cloud database, clearing stored openid');
          wx.removeStorageSync('currentOpenid');
        }
      }
    } catch (error) {
      console.error('Error checking existing login:', error);
      // Continue with normal login flow
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
  
  // Get WeChat user info
  async getWeChatUserInfo() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: (res) => {
          console.log('getUserProfile success:', res);
          resolve(res.userInfo);
        },
        fail: (err) => {
          console.error('getUserProfile failed:', err);
          reject(err);
        }
      });
    });
  },
  
  // Get WeChat openid using proper authentication
  async getWeChatOpenid() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          console.log('wx.login success:', res);
          if (res.code) {
            // Call cloud function to get real openid
            wx.cloud.callFunction({
              name: 'getOpenId',
              success: (result) => {
                console.log('Cloud function getOpenId success:', result);
                if (result.result && result.result.success) {
                  const openid = result.result.openid;
                  console.log('Real WeChat openid obtained:', openid);
                  resolve(openid);
                } else {
                  console.error('Cloud function returned error:', result.result);
                  // Fallback to mock openid for development
                  const mockOpenid = 'dev_openid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                  console.log('Using fallback mock openid:', mockOpenid);
                  resolve(mockOpenid);
                }
              },
              fail: (err) => {
                console.error('Cloud function getOpenId failed:', err);
                // Fallback to mock openid for development
                const mockOpenid = 'dev_openid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                console.log('Using fallback mock openid:', mockOpenid);
                resolve(mockOpenid);
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
  
  // Handle WeChat login with proper authentication
  async handleWeChatLogin() {
    this.setData({ isLoading: true });
    
    try {
      console.log('Starting WeChat login process...');
      
      // Step 1: Get WeChat user info (requires user authorization)
      const userInfo = await this.getWeChatUserInfo();
      console.log('WeChat user info received:', userInfo);
      
      if (!userInfo) {
        throw new Error('Failed to get WeChat user info - user may have denied authorization');
      }
      
      // Step 2: Get WeChat openid (automatic with cloud database)
      const openid = await this.getWeChatOpenid();
      console.log('WeChat openid obtained:', openid);
      
      if (!openid) {
        throw new Error('Failed to get WeChat openid');
      }
      
      // Step 3: Check if user exists in cloud database
      const userExists = await CloudDBService.userExists(openid);
      console.log('User exists in cloud database:', userExists);
      
      if (userExists) {
        // Existing user - log them in directly
        console.log('Existing user found, logging in...');
        const existingUser = await CloudDBService.getUserByOpenid(openid);
        
        if (existingUser) {
          // Store session info
          wx.setStorageSync('currentOpenid', openid);
          app.globalData.userInfo = existingUser;
          
          console.log('User logged in successfully:', existingUser);
          
          wx.showToast({
            title: '欢迎回来，' + existingUser.nickname + '！',
            icon: 'success'
          });
          
          // Redirect to main page
          setTimeout(() => {
            this.redirectToMainPage();
          }, 1500);
        } else {
          throw new Error('Failed to retrieve existing user data');
        }
      } else {
        // New user - show nickname configuration
        console.log('New user, showing nickname configuration...');
        this.setData({
          showNicknameConfig: true,
          nickname: userInfo.nickName || 'Player', // Set default nickname to WeChat name
          tempUserInfo: {
            ...userInfo,
            openid: openid
          },
          isLoading: false
        });
        
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
  
  // Test login scenarios for development
  async testLoginScenarios() {
    wx.showActionSheet({
      itemList: ['New User', 'Existing User', 'Invalid WechatId'],
      success: async (res) => {
        switch (res.tapIndex) {
          case 0:
            await this.testNewUser();
            break;
          case 1:
            await this.testExistingUser();
            break;
          case 2:
            await this.testInvalidWechatId();
            break;
        }
      }
    });
  },

  // Test new user scenario
  async testNewUser() {
    try {
      console.log('Testing new user scenario');
      
      const newWechatId = 'new_user_' + Date.now();
      
      const userExists = await CloudDBService.userExists(newWechatId);
      console.log('New user exists:', userExists);
      
      if (!userExists) {
        wx.showToast({
          title: 'New user confirmed',
          icon: 'success'
        });
        
        // Show nickname configuration for new user
        this.setData({
          showNicknameConfig: true,
          tempUserInfo: {
            openid: newWechatId,
            avatarUrl: 'https://example.com/avatar.jpg'
          },
          isLoading: false
        });
      } else {
        wx.showToast({
          title: 'Unexpected: user exists',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('Error testing new user:', error);
    }
  },

  // Test existing user scenario
  async testExistingUser() {
    try {
      console.log('Testing existing user scenario');
      
      // First get all users to find a real WechatId
      const allUsers = await app.getAllUsers();
      
      if (allUsers.length > 0) {
        const existingWechatId = allUsers[0].openid;
        console.log('Using existing WechatId:', existingWechatId);
        
        const userExists = await CloudDBService.userExists(existingWechatId);
        console.log('Existing user exists:', userExists);
        
        if (userExists) {
          wx.showToast({
            title: 'Existing user confirmed',
            icon: 'success'
          });
          
          // Log in the existing user
          const existingUser = await CloudDBService.getUserByOpenid(existingWechatId);
          
          if (existingUser) {
            wx.setStorageSync('currentOpenid', existingWechatId);
            app.globalData.userInfo = existingUser;
            
            wx.showToast({
              title: 'Logged in existing user',
              icon: 'success'
            });
            
            setTimeout(() => {
              this.redirectToMainPage();
            }, 1000);
          }
        } else {
          wx.showToast({
            title: 'Unexpected: user not found',
            icon: 'none'
          });
        }
      } else {
        wx.showToast({
          title: 'No users found',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('Error testing existing user:', error);
    }
  },

  // Test invalid WechatId scenario
  async testInvalidWechatId() {
    try {
      console.log('Testing invalid WechatId scenario');
      
      const invalidWechatId = 'invalid_wechatid_' + Date.now();
      
      const userExists = await CloudDBService.userExists(invalidWechatId);
      console.log('Invalid WechatId exists:', userExists);
      
      if (!userExists) {
        wx.showToast({
          title: 'Invalid WechatId confirmed',
          icon: 'success'
        });
        
        // Show nickname configuration for new user
        this.setData({
          nickname: 'Invalid Test User',
          showNicknameConfig: true,
          isLoading: false
        });
      } else {
        wx.showToast({
          title: 'Unexpected: WechatId exists',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('Error testing invalid WechatId:', error);
    }
  },
  
  // Get openid from backend (you'll need to implement this)
  getOpenId: function(code) {
    console.log('Getting openid for code:', code);
    
    // For now, we'll simulate getting openid
    // In a real app, you would send the code to your backend
    // and get back the openid and session_key
    
    // Simulate API call delay
    setTimeout(async () => {
      try {
        // For testing, we'll use a mock openid that simulates WeChat's _openid
        // In production, this would come from WeChat's server
        const mockOpenid = 'mock_openid_' + Date.now();
        
        console.log('Checking if user exists with openid:', mockOpenid);
        
        // Check if user already exists in cloud database
        const userExists = await CloudDBService.userExists(mockOpenid);
        
        if (userExists) {
          console.log('Existing user found, getting user profile');
          
          // User exists, get their profile and log them in directly
          const existingUser = await CloudDBService.getUserByOpenid(mockOpenid);
          
          if (existingUser) {
            console.log('Retrieved existing user profile:', existingUser);
            
            // User exists, log them in directly
            wx.setStorageSync('currentOpenid', existingUser.openid);
            app.globalData.userInfo = existingUser;
            
            wx.showToast({
              title: 'Welcome back, ' + existingUser.nickname + '!',
              icon: 'success'
            });
            
            setTimeout(() => {
              this.redirectToMainPage();
            }, 1500);
          } else {
            throw new Error('Failed to retrieve existing user profile');
          }
          
        } else {
          console.log('No existing user found, showing nickname configuration');
          
          // User doesn't exist, show nickname configuration
          this.setData({
            nickname: this.data.userInfo ? this.data.userInfo.nickName : 'Player',
            showNicknameConfig: true,
            isLoading: false
          });
        }
        
      } catch (error) {
        console.error('Error checking existing user:', error);
        wx.showToast({
          title: 'Login failed: ' + (error.message || 'Unknown error'),
          icon: 'none',
          duration: 3000
        });
        this.setData({ isLoading: false });
      }
    }, 1000);
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
  
  // Handle continue button click
  async handleContinue() {
    const { nickname, gender, tempUserInfo } = this.data;
    
    // Use the user's input nickname, fallback to WeChat name if empty
    const finalNickname = nickname.trim() || tempUserInfo.nickName || 'Player';
    
    if (!finalNickname) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }
    
    this.setData({ isLoading: true });
    
    try {
      // Check if nickname is unique using WechatId field
      const isUnique = await app.isNicknameUnique(finalNickname, tempUserInfo.openid);
      
      if (!isUnique) {
        wx.showToast({
          title: '昵称已被使用',
          icon: 'none'
        });
        this.setData({ isLoading: false });
        return;
      }
      
    // Create user profile with WechatId field
      // Make sure we have a valid openid/WechatId to prevent duplicate key errors
      if (!tempUserInfo || !tempUserInfo.openid) {
        throw new Error('无效的用户ID，请重新登录');
      }
      
      const userProfile = {
        openid: tempUserInfo.openid, // This will be stored as WechatId in cloud
        nickname: finalNickname,
        Name: finalNickname,
        avatarUrl: tempUserInfo.avatarUrl,
        Avatar: tempUserInfo.avatarUrl,
        gender: gender,
        Gender: gender
      };
      
      console.log('Creating user profile with WechatId:', userProfile);
      
      // Save to cloud database using WechatId field
      const success = await app.saveUserToGlobalList(userProfile);
      
      if (success) {
        // Store session info
        wx.setStorageSync('currentOpenid', tempUserInfo.openid);
        
        wx.showToast({
          title: '注册成功',
          icon: 'success'
        });
        
        // Redirect to main page
        setTimeout(() => {
          this.redirectToMainPage();
        }, 1000);
      } else {
        throw new Error('Failed to save user profile');
      }
    } catch (error) {
      console.error('Failed to create user profile:', error);
      this.setData({ isLoading: false });
      
      wx.showToast({
        title: '注册失败',
        icon: 'none'
      });
    }
  },
    redirectToMainPage: function() {
    wx.switchTab({
      url: '/pages/game-signup/game-signup'
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
      if (nickname.trim() && nickname.trim() !== this.data.tempUserInfo?.nickName) {
        this.setData({ checkingAvailability: true });
        
        try {
          const isAvailable = await app.isNicknameUnique(nickname.trim(), this.data.tempUserInfo?.openid);
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
});