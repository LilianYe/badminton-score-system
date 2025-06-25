/**
 * Cloud Database Service for User Profile Management
 * Handles all user-related database operations using WeChat Cloud Database
 */

let db = null;
let userCollection = null;
let gameCollection = null;
let matchCollection = null;

class CloudDBService {
  /**
   * Initialize cloud database connection
   */
  static init() {
    try {
      // Check if cloud SDK is available
      if (!wx.cloud) {
        console.error('wx.cloud is not available. Please ensure the WeChat cloud development environment is enabled.');
        return false;
      }

      // If cloud is not initialized yet, initialize it
      try {
        console.log('Initializing cloud environment...');
        wx.cloud.init({
          env: "elo-system-8g6jq2r4a931945e",
          traceUser: true
        });
      } catch (cloudError) {
        // Initialization might fail if already initialized, which is fine
        console.log('Cloud init result:', cloudError);
      }
      
      // Now try to connect to the database
      console.log('Connecting to database...');
      db = wx.cloud.database();
      
      if (!db) {
        console.error('Failed to get database instance. wx.cloud.database() returned null.');
        return false;
      }
      
      console.log('Database connection successful. Setting up collections...');
      userCollection = db.collection('UserProfile');
      gameCollection = db.collection('Session');
      matchCollection = db.collection('Match');
      
      console.log('Cloud database initialized successfully');
      console.log('User collection:', userCollection ? 'Created' : 'Failed');
      console.log('Game collection:', gameCollection ? 'Created' : 'Failed');
      console.log('Match collection:', matchCollection ? 'Created' : 'Failed');
      return true;
    } catch (error) {
      console.error('Failed to initialize cloud database:', error);
      return false;
    }
  }

  /**
   * Ensure database is initialized
   */  static ensureInit() {
    if (!db || !userCollection || !gameCollection || !matchCollection) {
      console.log('Database not initialized, initializing now...');
      const initSuccess = this.init();
      
      if (!initSuccess) {
        console.error('Failed to initialize database in ensureInit call.');
        throw new Error('数据库初始化失败，请检查网络连接');
      }
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
      console.log('Looking for user with openid:', openid);
      
      // Try to find by _openid (automatically set by WeChat cloud)
      let result = await userCollection.where({
        _openid: openid
      }).get();
      
      // If not found, try to find by WechatId field (manually set)
      if (!result.data || result.data.length === 0) {
        console.log('Not found by _openid, trying WechatId field');
        result = await userCollection.where({
          WechatId: openid
        }).get();
      }
      
      console.log('Database query result:', result);
      
      if (result.data && result.data.length > 0) {
        console.log('User found in cloud database:', result.data[0]);
        return this.mapToUserSchema(result.data[0]);
      }
      
      console.log('User not found in cloud database for openid:', openid);
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
   */  static async createUser(userData) {
    this.ensureInit();
    
    try {
      console.log('Creating user with data:', userData);
      
      // Ensure we have a valid openid/WechatId
      if (!userData.openid) {
        console.error('Cannot create user: missing openid');
        throw new Error('无效的用户ID，请重新登录');
      }
      
      const userToCreate = this.mapToCloudSchema(userData);
      
      // Make sure WechatId is set properly
      userToCreate.WechatId = userData.openid;
      
      // Add additional required fields
      userToCreate.createdAt = new Date().toISOString();
      userToCreate.lastLoginAt = new Date().toISOString();
      userToCreate.updatedAt = new Date().toISOString();
      userToCreate.elo = userData.elo || 1500;

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
   */  static async userExists(openid) {
    this.ensureInit();
    
    if (!openid) {
      console.error('Invalid openid provided (null/undefined)');
      return false;
    }
    
    try {
      console.log('Checking if user exists with openid:', openid);
      
      // Try to find by _openid (automatically set by WeChat cloud)
      let result = await userCollection.where({
        _openid: openid
      }).get();
      
      // If not found, try to find by WechatId field (manually set)
      if (!result.data || result.data.length === 0) {
        console.log('Not found by _openid, trying WechatId field');
        result = await userCollection.where({
          WechatId: openid
        }).get();
      }
      
      const exists = result.data && result.data.length > 0;
      console.log(`User with openid ${openid} ${exists ? 'exists' : 'does not exist'}`);
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
   */  static mapToCloudSchema(userData) {
    console.log('Mapping user data to cloud schema:', userData);
    
    const mapped = {
      // Critical field for user identification
      WechatId: userData.openid || userData.WechatId,
      
      // User profile fields
      Name: userData.nickname || userData.Name,
      nickname: userData.nickname || userData.Name, // For compatibility
      Avatar: userData.avatarUrl || userData.Avatar || '',
      avatarUrl: userData.avatarUrl || userData.Avatar || '', // For compatibility
      Gender: userData.gender || userData.Gender || 'male',
      gender: userData.gender || userData.Gender || 'male', // For compatibility
      
      // Timestamps
      createdAt: userData.createdAt || new Date().toISOString(),
      lastLoginAt: userData.lastLoginAt || new Date().toISOString(),
      updatedAt: userData.updatedAt || new Date().toISOString(),
      
      // Game-related fields
      elo: userData.elo || 1500
    };
    
    console.log('Mapped to cloud schema:', mapped);
    return mapped;
  }

  /**
   * Map cloud database data to app schema
   * @param {Object} cloudData - User data from cloud database
   * @returns {Object} User data in app format
   */  static mapToUserSchema(cloudData) {
    console.log('Mapping cloud data to user schema:', cloudData);
    
    const mapped = {
      // Use WechatId as openid if _openid doesn't exist (manual creation)
      openid: cloudData._openid || cloudData.WechatId,
      WechatId: cloudData.WechatId || cloudData._openid,
      
      // User profile fields
      nickname: cloudData.nickname || cloudData.Name,
      Name: cloudData.Name || cloudData.nickname,
      avatarUrl: cloudData.avatarUrl || cloudData.Avatar || '',
      Avatar: cloudData.Avatar || cloudData.avatarUrl || '',
      gender: cloudData.gender || cloudData.Gender || 'male',
      Gender: cloudData.Gender || cloudData.gender || 'male',
      
      // Timestamps
      createdAt: cloudData.createdAt,
      lastLoginAt: cloudData.lastLoginAt,
      updatedAt: cloudData.updatedAt,
      
      // Game-related fields
      elo: cloudData.elo || 1500,
      
      // Database identifier
      _id: cloudData._id
    };
    
    console.log('Mapped to user schema:', mapped);
    return mapped;
  }
  
  /**************************************************************************
   * GAME MANAGEMENT METHODS
   **************************************************************************/

  /**
   * Get all available games from cloud database
   * @returns {Promise<Array>} Array of game objects
   */
  static async getAllGames() {
    this.ensureInit();
    
    try {
      console.log('Getting all games from cloud database...');
      
      // Get all games, ordered by date (newest first)
      const result = await gameCollection
        .orderBy('date', 'desc')  // Most recent games first
        .get();
      
      if (result.data && result.data.length > 0) {
        console.log(`Found ${result.data.length} games in cloud database`);
        return result.data.map(game => this.mapToGameSchema(game));
      }
      
      console.log('No games found in cloud database');
      return [];
    } catch (error) {
      console.error('Error getting games from cloud database:', error);
      throw error;
    }
  }
  
  /**
   * Get a game by its ID from cloud database
   * @param {string} gameId - The ID of the game
   * @returns {Promise<Object|null>} Game object or null if not found
   */
  static async getGameById(gameId) {
    this.ensureInit();
    
    try {
      console.log('Getting game by ID:', gameId);
      
      // If gameId is a cloud ID (_id), we can use doc() directly
      if (gameId.length === 24 || gameId.length === 32) {
        try {
          const result = await gameCollection.doc(gameId).get();
          if (result.data) {
            return this.mapToGameSchema(result.data);
          }
        } catch (docError) {
          console.log('Not a valid document ID, will try where clause');
        }
      }
      
      // Otherwise, use 'id' field to find the game
      const result = await gameCollection.where({
        id: gameId
      }).get();
      
      if (result.data && result.data.length > 0) {
        console.log('Game found in cloud database:', result.data[0]);
        return this.mapToGameSchema(result.data[0]);
      }
      
      console.log('Game not found in cloud database for ID:', gameId);
      return null;
    } catch (error) {
      console.error('Error getting game from cloud database:', error);
      throw error;
    }
  }
  
  /**
   * Create a new game in cloud database
   * @param {Object} gameData - Game data
   * @returns {Promise<Object>} Created game
   */
  static async createGame(gameData) {
    this.ensureInit();
    
    try {
      console.log('Creating game with data:', gameData);
      
      // Ensure we have required fields
      if (!gameData.id || !gameData.title || !gameData.owner || !gameData.owner.openid) {
        console.error('Cannot create game: missing required fields');
        throw new Error('游戏信息不完整，请提供必要的信息');
      }
      
      const gameToCreate = this.mapToCloudGameSchema(gameData);
      
      // Add timestamps
      gameToCreate.createdAt = new Date().toISOString();
      gameToCreate.updatedAt = new Date().toISOString();

      console.log('Mapped game data for cloud:', gameToCreate);

      const result = await gameCollection.add({
        data: gameToCreate
      });

      console.log('Game created in cloud database:', result);
      
      // Get the created game with _id
      const createdGame = await this.getGameById(gameData.id);
      return createdGame;
    } catch (error) {
      console.error('Error creating game in cloud database:', error);
      throw error;
    }
  }
  
  /**
   * Update an existing game in cloud database
   * @param {string} gameId - The ID of the game
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated game
   */
  static async updateGame(gameId, updateData) {
    this.ensureInit();
    
    try {
      console.log('Updating game with ID:', gameId);
      console.log('Update data:', updateData);
      
      // Find the game by ID first
      const game = await this.getGameById(gameId);
      
      if (!game) {
        console.error('Game not found for ID:', gameId);
        throw new Error('游戏不存在');
      }
      
      // Use cloud _id for update if available
      const docId = game._id;
      
      if (!docId) {
        console.error('Game has no document ID');
        throw new Error('游戏文档ID不存在');
      }
      
      const updateToApply = this.mapToCloudGameSchema(updateData);
      updateToApply.updatedAt = new Date().toISOString();
      
      console.log('Updating game document with ID:', docId);
      console.log('Update to apply:', updateToApply);
      
      const result = await gameCollection.doc(docId).update({
        data: updateToApply
      });
      
      console.log('Game updated in cloud database:', result);
      
      // Get the updated game
      const updatedGame = await this.getGameById(gameId);
      return updatedGame;
    } catch (error) {
      console.error('Error updating game in cloud database:', error);
      throw error;
    }
  }
  
  /**
   * Delete a game from cloud database
   * @param {string} gameId - The ID of the game
   * @returns {Promise<boolean>} True if successful
   */
  static async deleteGame(gameId) {
    this.ensureInit();
    
    try {
      console.log('Deleting game with ID:', gameId);
      
      // Find the game by ID first
      const game = await this.getGameById(gameId);
      
      if (!game) {
        console.error('Game not found for ID:', gameId);
        throw new Error('游戏不存在');
      }
      
      // Use cloud _id for deletion if available
      const docId = game._id;
      
      if (!docId) {
        console.error('Game has no document ID');
        throw new Error('游戏文档ID不存在');
      }
      
      const result = await gameCollection.doc(docId).remove();
      
      console.log('Game deleted from cloud database:', result);
      return result.stats.removed === 1;
    } catch (error) {
      console.error('Error deleting game from cloud database:', error);
      throw error;
    }
  }
  
  /**
   * Add a player to a game
   * @param {string} gameId - The ID of the game
   * @param {Object} playerData - Player data to add
   * @returns {Promise<Object>} Updated game
   */
  static async addPlayerToGame(gameId, playerData) {
    this.ensureInit();
    
    try {
      console.log('Adding player to game with ID:', gameId);
      console.log('Player data:', playerData);
      
      // Find the game by ID first
      const game = await this.getGameById(gameId);
      
      if (!game) {
        console.error('Game not found for ID:', gameId);
        throw new Error('游戏不存在');
      }
      
      // Use cloud _id for update if available
      const docId = game._id;
      
      if (!docId) {
        console.error('Game has no document ID');
        throw new Error('游戏文档ID不存在');
      }
      
      // Check if player is already in the game
      const isAlreadySignedUp = game.players.some(player => 
        player.openid === playerData.openid
      );
      
      if (isAlreadySignedUp) {
        console.log('Player already in game:', playerData.openid);
        throw new Error('您已经报名参加了这个活动');
      }
      
      // Add player to the game
      const updatedPlayers = game.players.concat(playerData);
      
      const result = await gameCollection.doc(docId).update({
        data: {
          players: updatedPlayers,
          updatedAt: new Date().toISOString()
        }
      });
      
      console.log('Player added to game in cloud database:', result);
      
      // Get the updated game
      const updatedGame = await this.getGameById(gameId);
      return updatedGame;
    } catch (error) {
      console.error('Error adding player to game in cloud database:', error);
      throw error;
    }
  }
  
  /**
   * Remove a player from a game
   * @param {string} gameId - The ID of the game
   * @param {number} playerIndex - Index of the player in the players array
   * @returns {Promise<Object>} Updated game
   */
  static async removePlayerFromGame(gameId, playerIndex) {
    this.ensureInit();
    
    try {
      console.log('Removing player from game with ID:', gameId);
      console.log('Player index:', playerIndex);
      
      // Find the game by ID first
      const game = await this.getGameById(gameId);
      
      if (!game) {
        console.error('Game not found for ID:', gameId);
        throw new Error('游戏不存在');
      }
      
      // Use cloud _id for update if available
      const docId = game._id;
      
      if (!docId) {
        console.error('Game has no document ID');
        throw new Error('游戏文档ID不存在');
      }
      
      // Check if player index is valid
      if (playerIndex < 0 || playerIndex >= game.players.length) {
        console.error('Invalid player index:', playerIndex);
        throw new Error('无效的球员索引');
      }
      
      // Remove player from the game
      const updatedPlayers = game.players.slice();
      updatedPlayers.splice(playerIndex, 1);
      
      const result = await gameCollection.doc(docId).update({
        data: {
          players: updatedPlayers,
          updatedAt: new Date().toISOString()
        }
      });
      
      console.log('Player removed from game in cloud database:', result);
      
      // Get the updated game
      const updatedGame = await this.getGameById(gameId);
      return updatedGame;
    } catch (error) {
      console.error('Error removing player from game in cloud database:', error);
      throw error;
    }
  }
  
  /**
   * Map app game schema to cloud database schema
   * @param {Object} gameData - Game data in app format
   * @returns {Object} Game data in cloud format
   */
  static mapToCloudGameSchema(gameData) {
    console.log('Mapping game data to cloud schema:', gameData);
    
    const mapped = {
      // Game identification
      id: gameData.id,
      
      // Game details
      title: gameData.title,
      date: gameData.date,
      time: gameData.time,
      location: gameData.location,
      rules: gameData.rules,
      matchupMethod: gameData.matchupMethod,
      maxPlayers: gameData.maxPlayers || 10,
      courtCount: gameData.courtCount || 2,
      status: gameData.status || '招募中',
      
      // Owner info
      owner: gameData.owner,
      
      // Players list
      players: gameData.players || [],
      
      // Timestamps
      createdAt: gameData.createdAt || new Date().toISOString(),
      updatedAt: gameData.updatedAt || new Date().toISOString()
    };
    
    console.log('Mapped to cloud game schema:', mapped);
    return mapped;
  }
  
  /**
   * Map cloud database game data to app schema
   * @param {Object} cloudData - Game data from cloud database
   * @returns {Object} Game data in app format
   */
  static mapToGameSchema(cloudData) {
    console.log('Mapping cloud data to game schema:', cloudData);
    
    const mapped = {
      // Preserve cloud ID for future operations
      _id: cloudData._id,
      
      // Game identification
      id: cloudData.id,
      
      // Game details
      title: cloudData.title,
      date: cloudData.date,
      time: cloudData.time,
      location: cloudData.location,
      rules: cloudData.rules,
      matchupMethod: cloudData.matchupMethod,
      maxPlayers: cloudData.maxPlayers || 10,
      courtCount: cloudData.courtCount || 2,
      status: cloudData.status || '招募中',
      
      // Owner info
      owner: cloudData.owner,
      
      // Players list
      players: cloudData.players || [],
      
      // Timestamps
      createdAt: cloudData.createdAt,
      updatedAt: cloudData.updatedAt
    };
    
    console.log('Mapped to app game schema:', mapped);
    return mapped;
  }
  
  /**************************************************************************
   * MATCH MANAGEMENT METHODS
   **************************************************************************/

  /**
   * Save generated matches to the Match collection
   * @param {Array} matchData - Array of match data objects
   * @param {string} sessionId - ID of the session these matches belong to
   * @returns {Promise<Array>} - Array of match insertion results
   */
  static async saveGeneratedMatches(matchData, sessionId) {
    this.ensureInit();
    
    try {
      console.log('Saving matches to database for session:', sessionId);
      
      // Prepare promises for all match insertions
      const insertPromises = matchData.map(async (match) => {
        // Add creation timestamp and session ID
        const matchToInsert = {
          ...match,
          SessionId: sessionId,
          CreatedTime: new Date(),
          UpdatedTime: new Date(),
          // Default values for required fields
          ScoreA: 0,
          ScoreB: 0,
          PlayerA1ScoreChange: 0,
          PlayerA2ScoreChange: 0,
          PlayerB1ScoreChange: 0,
          PlayerB2ScoreChange: 0
        };
        
        try {
          const result = await matchCollection.add({
            data: matchToInsert
          });
          
          console.log('Match added with ID:', result._id);
          return { success: true, _id: result._id };
        } catch (error) {
          console.error('Failed to add match:', error);
          return { success: false, error };
        }
      });
      
      // Execute all promises
      const results = await Promise.all(insertPromises);
      console.log('All matches saved:', results);
      return results;
    } catch (error) {
      console.error('Error saving matches:', error);
      throw error;
    }
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