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
   */
  static ensureInit() {
    if (!db || !userCollection || !gameCollection || !matchCollection) {
      console.log('Database not initialized, initializing now...');
      const initSuccess = this.init();
      
      if (!initSuccess) {
        console.error('Failed to initialize database in ensureInit call.');
        throw new Error('数据库初始化失败，请检查网络连接');
      }
    }
  }

  /**************************************************************************
   * RAW DATABASE OPERATIONS - USER PROFILE COLLECTION
   **************************************************************************/

  /**
   * Get user by _openid from UserProfile collection
   * @param {string} openid - WeChat _openid
   * @returns {Promise<Object|null>} Raw user data or null if not found
   */
  static async getUserByOpenid(openid) {
    this.ensureInit();
    
    if (!openid) {
      console.error('Invalid openid provided (null/undefined)');
      return null;
    }
    
    try {
      console.log('Getting user by _openid:', openid);
      
      const result = await userCollection.where({
        _openid: openid
      }).get();
      
      if (result.data && result.data.length > 0) {
        const user = result.data[0];
        console.log('User found in UserProfile:', user);
        return user;
      }
      
      console.log('User not found in UserProfile for openid:', openid);
      return null;
    } catch (error) {
      console.error('Error getting user by openid:', error);
      throw error;
    }
  }

  /**
   * Create new user in UserProfile collection
   * @param {Object} userData - Raw user data to insert
   * @returns {Promise<Object>} Created user data with _id
   */
  static async createUser(userData) {
    this.ensureInit();
    
    try {
      console.log('Creating new user in UserProfile:', userData);
      
      // Add timestamps
      const userToCreate = {
        ...userData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };

      console.log('User data for cloud insert:', userToCreate);

      const result = await userCollection.add({
        data: userToCreate
      });

      console.log('User created in UserProfile:', result);
      return result;
    } catch (error) {
      console.error('Error creating user in UserProfile:', error);
      throw error;
    }
  }

  /**
   * Update existing user in UserProfile collection
   * @param {string} openid - WeChat _openid
   * @param {Object} updateData - Raw data to update
   * @returns {Promise<Object>} Update result
   */
  static async updateUser(openid, updateData) {
    this.ensureInit();
    
    try {
      console.log('Updating user in UserProfile with openid:', openid);
      console.log('Update data:', updateData);
      
      const userToUpdate = {
        ...updateData,
        updatedAt: new Date().toISOString()
      };

      const result = await userCollection.where({
        _openid: openid
      }).update({
        data: userToUpdate
      });

      console.log('User updated in UserProfile:', result);
      return result;
    } catch (error) {
      console.error('Error updating user in UserProfile:', error);
      throw error;
    }
  }

  /**
   * Check if user exists by _openid in UserProfile collection
   * @param {string} openid - WeChat _openid
   * @returns {Promise<boolean>} True if user exists
   */
  static async userExists(openid) {
    this.ensureInit();
    
    if (!openid) {
      console.error('Invalid openid provided (null/undefined)');
      return false;
    }
    
    try {
      console.log('Checking if user exists with openid:', openid);
      
      const result = await userCollection.where({
        _openid: openid
      }).get();
      
      const exists = result.data && result.data.length > 0;
      console.log(`User with openid ${openid} ${exists ? 'exists' : 'does not exist'}`);
      return exists;
    } catch (error) {
      console.error('Error checking if user exists:', error);
      throw error;
    }
  }

  /**
   * Get all users from UserProfile collection
   * @returns {Promise<Array>} Array of raw user data
   */
  static async getAllUsers() {
    this.ensureInit();
    
    try {
      console.log('Getting all users from UserProfile collection');
      const result = await userCollection.get();
      console.log('Retrieved all users from UserProfile:', result.data.length);
      return result.data;
    } catch (error) {
      console.error('Error getting all users from UserProfile:', error);
      throw error;
    }
  }

  /**
   * Check if nickname exists in UserProfile collection
   * @param {string} nickname - Nickname to check
   * @param {string} excludeOpenid - _openid to exclude from check (for updates)
   * @returns {Promise<boolean>} True if nickname exists
   */
  static async nicknameExists(nickname, excludeOpenid = null) {
    this.ensureInit();
    
    try {
      console.log('Checking if nickname exists:', nickname);
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
      const exists = result.data.length > 0;
      
      console.log(`Nickname "${nickname}" ${exists ? 'exists' : 'does not exist'}`);
      return exists;
    } catch (error) {
      console.error('Error checking if nickname exists:', error);
      throw error;
    }
  }

  /**************************************************************************
   * RAW DATABASE OPERATIONS - GAME COLLECTION
   **************************************************************************/

  /**
   * Get all games from cloud database
   * @returns {Promise<Array>} Array of raw game data
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
        return result.data;
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
   * @returns {Promise<Object|null>} Raw game data or null if not found
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
            return result.data;
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
        return result.data[0];
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
   * @param {Object} gameData - Raw game data
   * @returns {Promise<Object>} Created game data
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
      
      // Add timestamps
      const gameToCreate = {
        ...gameData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      console.log('Game data for cloud insert:', gameToCreate);

      const result = await gameCollection.add({
        data: gameToCreate
      });

      console.log('Game created in cloud database:', result);
      return result;
    } catch (error) {
      console.error('Error creating game in cloud database:', error);
      throw error;
    }
  }
  
  /**
   * Update an existing game in cloud database
   * @param {string} gameId - The ID of the game
   * @param {Object} updateData - Raw data to update
   * @returns {Promise<Object>} Update result
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
      
      const updateToApply = {
        ...updateData,
        updatedAt: new Date().toISOString()
      };
      
      console.log('Update to apply:', updateToApply);
      
      const result = await gameCollection.doc(docId).update({
        data: updateToApply
      });
      
      console.log('Game updated in cloud database:', result);
      return result;
    } catch (error) {
      console.error('Error updating game in cloud database:', error);
      throw error;
    }
  }
  
  /**
   * Delete a game from cloud database
   * @param {string} gameId - The ID of the game
   * @returns {Promise<Object>} Delete result
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
      
      // Use cloud _id for delete if available
      const docId = game._id;
      
      if (!docId) {
        console.error('Game has no document ID');
        throw new Error('游戏文档ID不存在');
      }
      
      const result = await gameCollection.doc(docId).remove();
      
      console.log('Game deleted from cloud database:', result);
      return result;
    } catch (error) {
      console.error('Error deleting game from cloud database:', error);
      throw error;
    }
  }

  /**************************************************************************
   * RAW DATABASE OPERATIONS - MATCH COLLECTION
   **************************************************************************/

  /**
   * Save generated matches to cloud database
   * @param {Array} matchData - Array of raw match data
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object>} Insert result
   */
  static async saveGeneratedMatches(matchData, sessionId) {
    this.ensureInit();
    
    try {
      console.log('Saving generated matches to cloud database...');
      console.log('Session ID:', sessionId);
      console.log('Number of matches:', matchData.length);
      
      const matchesToInsert = matchData.map(match => ({
        ...match,
        sessionId: sessionId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      
      console.log('Matches to insert:', matchesToInsert);
      
      const insertPromises = matchesToInsert.map(match => 
        matchCollection.add({ data: match })
      );
      
      const results = await Promise.all(insertPromises);
      
      console.log('Successfully saved matches to cloud database:', results.length);
      return results;
    } catch (error) {
      console.error('Error saving matches to cloud database:', error);
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