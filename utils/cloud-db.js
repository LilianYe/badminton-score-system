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
      if (!gameData.id || !gameData.title || !gameData.owner) {
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
   * Get upcoming matches (CompleteTime is null) from Match collection
   * @returns {Promise<Array>} Array of raw match data
   */
  static async getUpcomingMatches() {
    this.ensureInit();
    
    try {
      console.log('Getting upcoming matches from Match collection...');
      
      const result = await matchCollection.where({
        CompleteTime: null
      }).orderBy('StartTime', 'asc').get();
      
      console.log(`Found ${result.data.length} upcoming matches`);
      return result.data;
    } catch (error) {
      console.error('Error getting upcoming matches:', error);
      throw error;
    }
  }

  /**
   * Get completed matches (CompleteTime is not null) from Match collection
   * @returns {Promise<Array>} Array of raw match data
   */
  static async getCompletedMatches() {
    this.ensureInit();
    
    try {
      console.log('Getting completed matches from Match collection...');
      
      const result = await matchCollection.where({
        CompleteTime: db.command.neq(null)
      }).orderBy('CompleteTime', 'desc').get();
      
      console.log(`Found ${result.data.length} completed matches`);
      return result.data;
    } catch (error) {
      console.error('Error getting completed matches:', error);
      throw error;
    }
  }

  /**
   * Update match scores and completion time
   * @param {string} matchId - Match document ID
   * @param {number} scoreA - Team A score
   * @param {number} scoreB - Team B score
   * @returns {Promise<Object>} Update result
   */
  static async updateMatchScores(matchId, scoreA, scoreB) {
    this.ensureInit();
    
    try {
      console.log('Updating match scores:', { matchId, scoreA, scoreB });
      
      const now = new Date().toISOString();
      const updateData = {
        ScoreA: Number(scoreA),
        ScoreB: Number(scoreB),
        CompleteTime: now,
        updatedAt: now
      };

      const result = await matchCollection.doc(matchId).update({
        data: updateData
      });

      console.log('Match scores updated successfully:', result);
      return result;
    } catch (error) {
      console.error('Error updating match scores:', error);
      throw error;
    }
  }

  /**
   * Get match by document ID
   * @param {string} matchId - Match document ID
   * @returns {Promise<Object|null>} Match data or null if not found
   */
  static async getMatchById(matchId) {
    this.ensureInit();
    
    try {
      console.log('Getting match by ID:', matchId);
      
      const result = await matchCollection.doc(matchId).get();
      
      if (result.data) {
        console.log('Match found:', result.data);
        return result.data;
      }
      
      console.log('Match not found for ID:', matchId);
      return null;
    } catch (error) {
      console.error('Error getting match by ID:', error);
      throw error;
    }
  }

  /**
   * Save generated matches to the Match collection
   * @param {Array} matchData - Array of match data objects
   * @param {string} gameId - ID of the game these matches belong to
   * @returns {Promise<Array>} - Array of match insertion results
   */
  static async saveGeneratedMatches(matchData, gameId) {
    this.ensureInit();
    
    try {
      console.log('Saving matches to database for session:', gameId);
      console.log('Saving generated matches to cloud database...');
      console.log('Number of matches:', matchData.length);
      
      // Use the gameId as sessionId
      const sessionId = gameId;
      
      const matchesToInsert = matchData.map(match => ({
        ...match,
        SessionId: sessionId, // Make sure to use the standard property name
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

  /**
   * Fetch ELO ratings for multiple players from UserPerformance collection
   * @param {Array} playerObjects - Array of player objects with name property
   * @returns {Promise<Array>} - Same array with elo properties added
   */
  static async fetchPlayerELOs(playerObjects) {
    this.ensureInit();
    
    try {
      console.log('Fetching ELO ratings for', playerObjects.length, 'players');
      const db = wx.cloud.database();
      
      // Create a promise for each player's ELO fetch
      const fetchPlayerEloPromises = playerObjects.map(player => {
        return new Promise((resolve) => {
          // Query UserPerformance collection by name
          db.collection('UserPerformance')
            .where({
              Name: player.name
            })
            .get()
            .then(res => {
              if (res.data && res.data.length > 0) {
                // Update player object with latest ELO
                player.elo = res.data[0].ELO || 1500;
                console.log(`Fetched ELO for ${player.name}: ${player.elo}`);
              } else {
                // Use default ELO if not found
                player.elo = player.elo || 1500;
                console.log(`No ELO found for ${player.name}, using default: ${player.elo}`);
              }
              resolve(player);
            })
            .catch(error => {
              console.error(`Error fetching ELO for ${player.name}:`, error);
              // Use default ELO in case of error
              player.elo = player.elo || 1500;
              resolve(player);
            });
        });
      });
      
      // Wait for all ELO fetches to complete
      await Promise.all(fetchPlayerEloPromises);
      
      return playerObjects;
    } catch (error) {
      console.error('Error fetching player ELOs:', error);
      // Return the original player objects with default ELOs in case of error
      return playerObjects.map(player => {
        if (!player.elo) player.elo = 1500;
        return player;
      });
    }
  }
  /**
   * Create match data objects from round data
   * @param {Array} matchRounds - Array of match round data
   * @param {string} gameId - ID of the game
   * @param {Array} playerObjects - Array of player objects with ELO
   * @returns {Object} - Object with matchDataArray and sessionId
   */
  static createMatchData(matchRounds, gameId, playerObjects) {
    try {
      console.log('Creating match data using game ID:', gameId);
      
      // Use the game ID as the session ID
      const sessionId = gameId;
      
      // Expected start time for the first match
      let startTime = new Date();
      const matchDataArray = [];
      
      // Helper function to get player object from name
      const getPlayerObject = (playerName) => {
        // First check if playerName is already an object
        if (typeof playerName === 'object' && playerName.name) {
          // Already an object, ensure it has all properties
          return {
            name: playerName.name,
            gender: playerName.gender || 'male',
            elo: playerName.elo || 1500,
            openid: playerName.openid || null
          };
        }
        
        // Find the player object by name
        const playerObject = playerObjects?.find(p => p.name === playerName);
        
        // If found, return a clean object with required properties
        if (playerObject) {
          return {
            name: playerObject.name,
            gender: playerObject.gender || 'male',
            elo: playerObject.elo || 1500,
            openid: playerObject.openid || null
          };
        }
        
        // If not found, create a default object
        return {
          name: playerName,
          gender: 'male',
          elo: 1500,
          openid: null
        };
      };
      
      // Helper function to get player name
      const getPlayerName = (player) => {
        return typeof player === 'object' ? player.name : player;
      };
      
      // Process each round and court
      matchRounds.forEach((round, roundIndex) => {
        round.courts.forEach((court, courtIndex) => {
          // Each court has two teams (team1, team2), each team has two players
          const team1 = court[0];
          const team2 = court[1];
          
          // Get player objects for all players in the match
          const playerA1Obj = getPlayerObject(team1[0]);
          const playerA2Obj = getPlayerObject(team1[1]);
          const playerB1Obj = getPlayerObject(team2[0]);
          const playerB2Obj = getPlayerObject(team2[1]);
          
          // Create match object using gameId as the session ID and store complete player objects
          const matchData = {
            MatchId: `${sessionId}-${roundIndex + 1}-${courtIndex + 1}`, // Format: gameId-round-court
            Round: (roundIndex + 1), // Add round number
            Court: (courtIndex + 1).toString(),
            // Store full player objects 
            PlayerA1: playerA1Obj,
            PlayerA2: playerA2Obj,
            PlayerB1: playerB1Obj,
            PlayerB2: playerB2Obj,
            StartTime: new Date(startTime.getTime() + (roundIndex * 12 * 60000)), // 12 minutes per round
          };
          
          matchDataArray.push(matchData);
        });
      });
      
      return { matchDataArray, sessionId };
    } catch (error) {
      console.error('Error creating match data:', error);
      throw error;
    }
  }
  
  /**
   * Mark a game as having generated matches
   * @param {string} gameId - The ID of the game
   * @returns {Promise<Object>} - Updated game object
   */
  static async markGameMatchesGenerated(gameId) {
    this.ensureInit();
    
    try {
      console.log(`Marking game ${gameId} as having generated matches`);
        // Update the game with matchGenerated flag
      const updateData = {
        matchGenerated: true,
        matchGeneratedTime: new Date(),
        matchSessionId: gameId // Ensure matchSessionId is set to track the generated matches
      };
      
      // Use updateGame method to update the game
      const updatedGame = await this.updateGame(gameId, updateData);
      return updatedGame;
    } catch (error) {
      console.error('Failed to mark game as having generated matches:', error);
      throw error;
    }
  }
  
  /**
   * Get matches for a specific game using the gameId
   * @param {string} gameId - The ID of the game
   * @returns {Promise<Array>} - Array of match objects
   */
  static async getMatchesForGame(gameId) {
    this.ensureInit();
    
    try {
      console.log(`Getting matches for game ${gameId}`);
      const game = await this.getGameById(gameId);
      if (!game) {
        throw new Error('Game not found');
      }
        
      if (!game.matchGenerated) {
        console.log('Game does not have any generated matches');
        return [];
      }
      
      // Query matches by gameId
      const db = wx.cloud.database();
      const matchesResult = await db.collection('Match')
        .where({
          SessionId: gameId
        })
        .orderBy('Round', 'asc')
        .orderBy('Court', 'asc')
        .get();
      
      if (matchesResult.data.length === 0) {
        console.log('No matches found for this game');
        return [];
      }
      
      console.log(`Found ${matchesResult.data.length} matches for game ${gameId}`);
      return matchesResult.data;
    } catch (error) {
      console.error('Failed to get matches for game:', error);
      throw error;
    }
  }

  /**
   * Delete matches for a specific game using the gameId
   * @param {string} gameId - The ID of the game
   * @returns {Promise<Object>} - Result of the delete operation
   */
  static async deleteMatchesForGame(gameId) {
    this.ensureInit();
    
    try {
      console.log(`Deleting matches for game ${gameId}`);
      const game = await this.getGameById(gameId);
      if (!game) {
        throw new Error('Game not found');
      }
        
      if (!game.matchGenerated) {
        console.log('Game does not have any generated matches');
        return { deleted: 0 };
      }
      const db = wx.cloud.database();
      const deleteResult = await db.collection('Match')
        .where({
          SessionId: gameId
        })
        .remove();
      
      console.log(`Deleted ${deleteResult.stats.removed} matches for game ${gameId}`);
      
      // Also update the game to show matches are no longer generated
      if (deleteResult.stats.removed > 0) {        await this.updateGame(gameId, {
          matchGenerated: false,
          matchGeneratedTime: null,
          matchSessionId: null // Also remove the matchSessionId
        });
        console.log(`Updated game ${gameId} to show matches are no longer generated`);
      }
      
      return deleteResult;
    } catch (error) {
      console.error('Failed to delete matches for game:', error);
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