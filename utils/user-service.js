/**
 * User Service - Business Logic Layer
 * Handles user-related business logic, validation, and orchestration
 * Uses CloudDBService for raw database operations
 */

const CloudDBService = require('./cloud-db.js');

class UserService {
  /**
   * Initialize user service
   */
  static init() {
    return CloudDBService.init();
  }
  /**
   * Get current user from global app data
   * @returns {Object|null} Current user object or null
   */
  static getCurrentUser() {
    const app = getApp();
    if (!app || !app.globalData) {
      // App not ready yet, try to get from storage
      try {
        const storedUserInfo = wx.getStorageSync('userInfo');
        return storedUserInfo || null;
      } catch (e) {
        console.error('Failed to get user from storage:', e);
        return null;
      }
    }
    return app.globalData.currentUser || null;
  }
  /**
   * Set current user in global app data
   * @param {Object} user - User object to set as current
   */
  static setCurrentUser(user) {
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.currentUser = user;
    }
    
    // Also store in persistent storage
    try {
      wx.setStorageSync('userInfo', user);
      console.log('User info stored in local storage');
    } catch (e) {
      console.error('Failed to store user info in storage:', e);
    }
  }

  /**
   * Clear current user from global app data
   */  static clearCurrentUser() {
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.currentUser = null;
    }
    
    // Also remove from storage
    try {
      wx.removeStorageSync('userInfo');
      console.log('User info removed from local storage');
    } catch (e) {
      console.error('Failed to remove user info from storage:', e);
    }
  }

  /**
   * Get WeChat openid using cloud function
   * @returns {Promise<string>} WeChat openid
   */
  static async getWeChatOpenid() {
    try {
      console.log('Getting WeChat openid...');
      
      const result = await wx.cloud.callFunction({
        name: 'getOpenId'
      });
      
      if (result.result && result.result.openid) {
        console.log('WeChat openid obtained:', result.result.openid);
        return result.result.openid;
      } else {
        console.error('Failed to get openid from cloud function:', result);
        throw new Error('获取微信用户ID失败');
      }
    } catch (error) {
      console.error('Error getting WeChat openid:', error);
      throw error;
    }
  }

  /**
   * Login user with WeChat openid
   * @returns {Promise<Object>} User object if login successful
   */
  static async loginWithWeChat() {
    try {
      console.log('Starting WeChat login process...');
      
      // Get WeChat openid
      const openid = await this.getWeChatOpenid();
      
      // Check if user exists in database
      const user = await CloudDBService.getUserByOpenid(openid);
      
      if (user) {
        console.log('User found, login successful:', user);
        
        // Update last login time
        await CloudDBService.updateUser(openid, {
          lastLoginAt: new Date().toISOString()
        });
        
        // Set current user
        this.setCurrentUser(user);
        
        return {
          success: true,
          user: user,
          isNewUser: false
        };
      } else {
        console.log('User not found, needs registration');
        return {
          success: false,
          openid: openid,
          isNewUser: true
        };
      }
    } catch (error) {
      console.error('Error in WeChat login:', error);
      throw error;
    }
  }

  /**
   * Register new user
   * @param {string} openid - WeChat openid
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} Created user object
   */
  static async registerUser(openid, userData) {
    try {
      console.log('Registering new user with openid:', openid);
      console.log('User data:', userData);
      
      // Validate required fields
      if (!userData.Name || !userData.Avatar || !userData.Gender) {
        throw new Error('请填写完整的用户信息');
      }
      
      // Check if nickname is unique
      const isUnique = await this.isNicknameUnique(userData.Name);
      if (!isUnique) {
        throw new Error('昵称已被使用，请选择其他昵称');
      }
      
      // Prepare user data for database - only save required fields
      // Note: _openid is automatically added by WeChat Cloud Database
      const userToCreate = {
        Name: userData.Name,
        Avatar: userData.Avatar,
        Gender: userData.Gender
      };
      
      // Create user in database
      const result = await CloudDBService.createUser(userToCreate);
      
      // Get the created user
      const createdUser = await CloudDBService.getUserByOpenid(openid);
      
      if (!createdUser) {
        throw new Error('用户创建失败');
      }
      
      console.log('User registered successfully:', createdUser);
      
      // Set current user
      this.setCurrentUser(createdUser);
      
      return createdUser;
    } catch (error) {
      console.error('Error registering user:', error);
      throw error;
    }
  }

  /**
   * Check if nickname is unique
   * @param {string} nickname - Nickname to check
   * @param {string} excludeOpenid - Openid to exclude from check (for updates)
   * @returns {Promise<boolean>} True if nickname is unique
   */
  static async isNicknameUnique(nickname, excludeOpenid = null) {
    try {
      const exists = await CloudDBService.nicknameExists(nickname, excludeOpenid);
      return !exists;
    } catch (error) {
      console.error('Error checking nickname uniqueness:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {string} openid - User's openid
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated user object
   */
  static async updateUserProfile(openid, updateData) {
    try {
      console.log('Updating user profile for openid:', openid);
      console.log('Update data:', updateData);
      
      // If nickname is being updated, check uniqueness
      if (updateData.Name) {
        const isUnique = await this.isNicknameUnique(updateData.Name, openid);
        if (!isUnique) {
          throw new Error('昵称已被使用，请选择其他昵称');
        }
      }
      
      // Only allow updating Name, Avatar, and Gender
      const allowedUpdates = {};
      if (updateData.Name) allowedUpdates.Name = updateData.Name;
      if (updateData.Avatar) allowedUpdates.Avatar = updateData.Avatar;
      if (updateData.Gender) allowedUpdates.Gender = updateData.Gender;
      
      // Update user in database
      await CloudDBService.updateUser(openid, allowedUpdates);
      
      // Get updated user
      const updatedUser = await CloudDBService.getUserByOpenid(openid);
      
      if (!updatedUser) {
        throw new Error('用户更新失败');
      }
      
      // Update current user if it's the same user
      const currentUser = this.getCurrentUser();
      if (currentUser && currentUser._openid === openid) {
        this.setCurrentUser(updatedUser);
      }
      
      console.log('User profile updated successfully:', updatedUser);
      return updatedUser;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  /**
   * Get all users with basic information
   * @returns {Promise<Array>} Array of users
   */
  static async getAllUsers() {
    try {
      console.log('Getting all users...');
      
      const users = await CloudDBService.getAllUsers();
      
      console.log(`Retrieved ${users.length} users`);
      return users;
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   * @param {string} userId - User ID (openid)
   * @returns {Promise<Object|null>} User object or null
   */
  static async getUserById(userId) {
    try {
      return await CloudDBService.getUserByOpenid(userId);
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    }
  }

  /**
   * Logout current user
   */
  static logout() {
    console.log('Logging out current user');
    this.clearCurrentUser();
  }

  /**
   * Check if user is logged in
   * @returns {boolean} True if user is logged in
   */
  static isLoggedIn() {
    const currentUser = this.getCurrentUser();
    return currentUser !== null;
  }
}

module.exports = UserService; 