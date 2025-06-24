/**
 * Cloud Database Service for User Profile Management
 * Handles all user-related database operations using WeChat Cloud Database
 */

let db = null;
let userCollection = null;

class CloudDBService {
  
  /**
   * Initialize cloud database connection
   */
  static init() {
    try {
      // Initialize cloud environment first
      wx.cloud.init({
        env: "elo-system-8g6jq2r4a931945e",
        traceUser: true
      });
      
      // Initialize database connection
      db = wx.cloud.database();
      userCollection = db.collection('UserProfile');
      
      console.log('Cloud database initialized successfully');
      console.log('Database instance:', db);
      console.log('User collection:', userCollection);
      return true;
    } catch (error) {
      console.error('Failed to initialize cloud database:', error);
      return false;
    }
  }

  /**
   * Ensure database is initialized
   */
  static ensureInit() {
    if (!db || !userCollection) {
      console.log('Database not initialized, initializing now...');
      this.init();
    }
  }

  /**
   * Get user profile by _openid from cloud database
   * @param {string} openid - WeChat _openid (automatically provided by WeChat Cloud Database)
   * @returns {Promise<Object|null>} User profile or null if not found
   */
  static async getUserByOpenid(openid) {
    this.ensureInit();
    
    try {
      console.log('Looking for user with _openid:', openid);
      const result = await userCollection.where({
        _openid: openid
      }).get();
      
      console.log('Database query result:', result);
      
      if (result.data && result.data.length > 0) {
        console.log('User found in cloud database:', result.data[0]);
        return this.mapToUserSchema(result.data[0]);
      }
      
      console.log('User not found in cloud database for _openid:', openid);
      return null;
    } catch (error) {
      console.error('Error getting user from cloud database:', error);
      throw error;
    }
  }

  /**
   * Create new user profile in cloud database
   * @param {Object} userData - User profile data
   * @returns {Promise<Object>} Created user profile
   */
  static async createUser(userData) {
    this.ensureInit();
    
    try {
      console.log('Creating user with data:', userData);
      
      const userToCreate = this.mapToCloudSchema(userData);
      userToCreate.createdAt = new Date().toISOString();
      userToCreate.lastLoginAt = new Date().toISOString();
      userToCreate.updatedAt = new Date().toISOString();

      console.log('Mapped user data for cloud:', userToCreate);

      const result = await userCollection.add({
        data: userToCreate
      });

      console.log('User created in cloud database:', result);
      
      // Get the created user with _openid
      const createdUser = await this.getUserByOpenid(userData.openid);
      return createdUser;
    } catch (error) {
      console.error('Error creating user in cloud database:', error);
      console.error('Error details:', {
        message: error.message,
        errCode: error.errCode,
        errMsg: error.errMsg
      });
      throw error;
    }
  }

  /**
   * Update existing user profile in cloud database
   * @param {string} openid - WeChat _openid (automatically provided by WeChat Cloud Database)
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated user profile
   */
  static async updateUser(openid, updateData) {
    this.ensureInit();
    
    try {
      console.log('Updating user with _openid:', openid);
      console.log('Update data:', updateData);
      
      const updateToApply = this.mapToCloudSchema(updateData);
      updateToApply.lastLoginAt = new Date().toISOString();
      updateToApply.updatedAt = new Date().toISOString();

      console.log('Mapped update data for cloud:', updateToApply);

      const result = await userCollection.where({
        _openid: openid
      }).update({
        data: updateToApply
      });

      console.log('User updated in cloud database:', result);
      
      // Get the updated user data
      const updatedUser = await this.getUserByOpenid(openid);
      return updatedUser;
    } catch (error) {
      console.error('Error updating user in cloud database:', error);
      console.error('Error details:', {
        message: error.message,
        errCode: error.errCode,
        errMsg: error.errMsg
      });
      throw error;
    }
  }

  /**
   * Check if nickname is unique in cloud database
   * @param {string} nickname - Nickname to check
   * @param {string} excludeOpenid - _openid to exclude from check (for updates)
   * @returns {Promise<boolean>} True if nickname is unique
   */
  static async isNicknameUnique(nickname, excludeOpenid = null) {
    this.ensureInit();
    
    try {
      console.log('Checking nickname uniqueness:', nickname);
      console.log('Exclude _openid:', excludeOpenid);
      
      let query = userCollection.where({
        Name: nickname
      });

      if (excludeOpenid) {
        query = query.where({
          _openid: db.command.neq(excludeOpenid)
        });
      }

      const result = await query.get();
      const isUnique = result.data.length === 0;
      
      console.log(`Nickname "${nickname}" is ${isUnique ? 'unique' : 'not unique'}`);
      console.log('Query result:', result);
      return isUnique;
    } catch (error) {
      console.error('Error checking nickname uniqueness:', error);
      console.error('Error details:', {
        message: error.message,
        errCode: error.errCode,
        errMsg: error.errMsg
      });
      throw error;
    }
  }

  /**
   * Get all users from cloud database
   * @returns {Promise<Array>} Array of all users
   */
  static async getAllUsers() {
    this.ensureInit();
    
    try {
      console.log('Getting all users from cloud database');
      const result = await userCollection.get();
      console.log('Retrieved all users from cloud database:', result.data.length);
      console.log('Users:', result.data);
      return result.data.map(user => this.mapToUserSchema(user));
    } catch (error) {
      console.error('Error getting all users from cloud database:', error);
      console.error('Error details:', {
        message: error.message,
        errCode: error.errCode,
        errMsg: error.errMsg
      });
      throw error;
    }
  }

  /**
   * Check if user exists by _openid
   * @param {string} openid - WeChat _openid (automatically provided by WeChat Cloud Database)
   * @returns {Promise<boolean>} True if user exists
   */
  static async userExists(openid) {
    this.ensureInit();
    
    try {
      console.log('Checking if user exists with _openid:', openid);
      const result = await userCollection.where({
        _openid: openid
      }).get();
      
      const exists = result.data && result.data.length > 0;
      console.log(`User with _openid ${openid} ${exists ? 'exists' : 'does not exist'}`);
      return exists;
    } catch (error) {
      console.error('Error checking if user exists:', error);
      return false;
    }
  }

  /**
   * Login or register user (creates if doesn't exist, updates if exists)
   * @param {string} openid - WeChat _openid (automatically provided by WeChat Cloud Database)
   * @param {Object} userData - User profile data
   * @returns {Promise<Object>} User profile
   */
  static async loginOrRegisterUser(openid, userData) {
    this.ensureInit();
    
    try {
      console.log('Login/Register user with _openid:', openid);
      console.log('User data:', userData);
      
      if (openid) {
        // Try to get existing user by _openid
        let user = await this.getUserByOpenid(openid);
        
        if (user) {
          // User exists, update last login time and any new data
          console.log('Existing user found, updating login time');
          user = await this.updateUser(openid, {
            lastLoginAt: new Date().toISOString(),
            ...userData
          });
          return user;
        }
      }
      
      // User doesn't exist or no _openid provided, create new user
      console.log('New user, creating profile');
      const user = await this.createUser({
        ...userData
      });
      
      console.log('Final user object:', user);
      return user;
    } catch (error) {
      console.error('Error in loginOrRegisterUser:', error);
      console.error('Error details:', {
        message: error.message,
        errCode: error.errCode,
        errMsg: error.errMsg
      });
      throw error;
    }
  }

  /**
   * Update user's last login time
   * @param {string} openid - WeChat _openid (automatically provided by WeChat Cloud Database)
   * @returns {Promise<boolean>} Success status
   */
  static async updateLastLogin(openid) {
    this.ensureInit();
    
    try {
      console.log('Updating last login time for user:', openid);
      await userCollection.where({
        _openid: openid
      }).update({
        data: {
          lastLoginAt: new Date().toISOString()
        }
      });
      
      console.log('Updated last login time for user:', openid);
      return true;
    } catch (error) {
      console.error('Error updating last login time:', error);
      return false;
    }
  }

  /**
   * Delete user from cloud database (for testing/cleanup)
   * @param {string} openid - WeChat _openid (automatically provided by WeChat Cloud Database)
   * @returns {Promise<boolean>} Success status
   */
  static async deleteUser(openid) {
    this.ensureInit();
    
    try {
      const result = await userCollection.where({
        _openid: openid
      }).remove();
      
      console.log('User deleted from cloud database:', result);
      return true;
    } catch (error) {
      console.error('Error deleting user from cloud database:', error);
      return false;
    }
  }

  /**
   * Sync local storage with cloud database (for migration)
   * @returns {Promise<boolean>} Success status
   */
  static async syncLocalToCloud() {
    this.ensureInit();
    
    try {
      const localUsers = wx.getStorageSync('allUsers') || [];
      const localUserInfo = wx.getStorageSync('userInfo');
      
      console.log('Syncing local data to cloud database...');
      console.log('Local users:', localUsers);
      console.log('Local user info:', localUserInfo);
      
      // Sync all users
      for (const user of localUsers) {
        if (user.openid) {
          await this.loginOrRegisterUser(user.openid, user);
        }
      }
      
      // Sync current user info
      if (localUserInfo && localUserInfo.openid) {
        await this.loginOrRegisterUser(localUserInfo.openid, localUserInfo);
      }
      
      console.log('Local to cloud sync completed');
      return true;
    } catch (error) {
      console.error('Error syncing local to cloud:', error);
      return false;
    }
  }

  /**
   * Read all data from UserProfile collection (for debugging and verification)
   * @returns {Promise<Array>} Array of all user profiles in cloud database
   */
  static async readAllUserProfiles() {
    this.ensureInit();
    
    try {
      console.log('Reading all user profiles from cloud database...');
      
      // Get all documents from UserProfile collection
      const result = await userCollection.get();
      
      console.log('Successfully read from UserProfile collection:');
      console.log('Total documents:', result.data.length);
      console.log('Raw data:', result.data);
      
      // Map the data to our app schema for consistency
      const mappedProfiles = result.data.map(profile => this.mapToUserSchema(profile));
      
      console.log('Mapped profiles:', mappedProfiles);
      
      return {
        success: true,
        count: result.data.length,
        rawData: result.data,
        mappedData: mappedProfiles
      };
    } catch (error) {
      console.error('Error reading from UserProfile collection:', error);
      console.error('Error details:', {
        message: error.message,
        errCode: error.errCode,
        errMsg: error.errMsg
      });
      
      return {
        success: false,
        error: error,
        count: 0,
        rawData: [],
        mappedData: []
      };
    }
  }

  /**
   * Read a specific user profile by _openid
   * @param {string} openid - WeChat _openid (automatically provided by WeChat Cloud Database)
   * @returns {Promise<Object>} User profile or null if not found
   */
  static async readUserProfile(openid) {
    this.ensureInit();
    
    try {
      console.log('Reading user profile for _openid:', openid);
      
      const result = await userCollection.where({
        _openid: openid
      }).get();
      
      console.log('Query result for _openid', openid, ':', result);
      
      if (result.data && result.data.length > 0) {
        const profile = result.data[0];
        console.log('Found user profile:', profile);
        
        const mappedProfile = this.mapToUserSchema(profile);
        console.log('Mapped profile:', mappedProfile);
        
        return {
          success: true,
          found: true,
          rawData: profile,
          mappedData: mappedProfile
        };
      } else {
        console.log('No user profile found for _openid:', openid);
        return {
          success: true,
          found: false,
          rawData: null,
          mappedData: null
        };
      }
    } catch (error) {
      console.error('Error reading user profile:', error);
      console.error('Error details:', {
        message: error.message,
        errCode: error.errCode,
        errMsg: error.errMsg
      });
      
      return {
        success: false,
        error: error,
        found: false,
        rawData: null,
        mappedData: null
      };
    }
  }

  /**
   * Test cloud database connection and permissions
   * @returns {Promise<boolean>} True if connection is successful
   */
  static async testConnection() {
    this.ensureInit();
    
    try {
      console.log('Testing cloud database connection...');
      
      // Try to get the collection info
      const result = await userCollection.get();
      console.log('Connection test successful:', result);
      
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      console.error('Error details:', {
        message: error.message,
        errCode: error.errCode,
        errMsg: error.errMsg
      });
      return false;
    }
  }

  /**
   * Map user data to cloud database schema
   * @param {Object} userData - User data in app format
   * @returns {Object} User data in cloud database format
   */
  static mapToCloudSchema(userData) {
    console.log('Mapping user data to cloud schema:', userData);
    
    const mapped = {
      Name: userData.nickname || userData.Name,
      Avatar: userData.avatarUrl || userData.Avatar || '',
      Gender: userData.gender || userData.Gender || 'male',
      createdAt: userData.createdAt,
      lastLoginAt: userData.lastLoginAt,
      updatedAt: userData.updatedAt
    };
    
    console.log('Mapped to cloud schema:', mapped);
    return mapped;
  }

  /**
   * Map cloud database data to app schema
   * @param {Object} cloudData - User data from cloud database
   * @returns {Object} User data in app format
   */
  static mapToUserSchema(cloudData) {
    console.log('Mapping cloud data to user schema:', cloudData);
    
    const mapped = {
      openid: cloudData._openid,
      nickname: cloudData.Name,
      Name: cloudData.Name,
      avatarUrl: cloudData.Avatar,
      Avatar: cloudData.Avatar,
      gender: cloudData.Gender,
      Gender: cloudData.Gender,
      createdAt: cloudData.createdAt,
      lastLoginAt: cloudData.lastLoginAt,
      updatedAt: cloudData.updatedAt,
      _id: cloudData._id
    };
    
    console.log('Mapped to user schema:', mapped);
    return mapped;
  }
}

// Export for use in other files
module.exports = CloudDBService;

// For WeChat Mini Program environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CloudDBService;
} else {
  // For browser/WeChat environment
  window.CloudDBService = CloudDBService;
} 