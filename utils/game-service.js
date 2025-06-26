/**
 * Game Service - Business Logic Layer
 * Handles game-related business logic, validation, and orchestration
 * Uses CloudDBService for raw database operations
 */

const CloudDBService = require('./cloud-db.js');
const UserService = require('./user-service.js');

class GameService {
  /**
   * Initialize game service
   */
  static init() {
    return CloudDBService.init();
  }

  /**
   * Create a new game session
   * @param {Object} gameData - Game data
   * @returns {Promise<Object>} Created game object
   */
  static async createGame(gameData) {
    try {
      console.log('Creating new game session...');
      console.log('Game data:', gameData);
      
      // Validate required fields
      if (!gameData.title || !gameData.owner) {
        throw new Error('游戏信息不完整，请提供游戏标题和创建者信息');
      }
      
      // Get current user
      const currentUser = UserService.getCurrentUser();
      if (!currentUser) {
        throw new Error('用户未登录');
      }
      
      // Prepare game data
      const gameToCreate = {
        id: this.generateGameId(),
        title: gameData.title,
        owner: {
          openid: currentUser._openid,
          Name: currentUser.Name,
          Avatar: currentUser.Avatar
        },
        date: new Date().toISOString(),
        status: 'active',
        players: [],
        matches: [],
        maxPlayers: gameData.maxPlayers || 8,
        description: gameData.description || ''
      };
      
      // Create game in database
      const result = await CloudDBService.createGame(gameToCreate);
      
      console.log('Game created successfully:', result);
      return gameToCreate;
    } catch (error) {
      console.error('Error creating game:', error);
      throw error;
    }
  }

  /**
   * Get all games
   * @returns {Promise<Array>} Array of game objects
   */
  static async getAllGames() {
    try {
      console.log('Getting all games...');
      
      const games = await CloudDBService.getAllGames();
      
      // Add additional computed fields
      const gamesWithDetails = games.map(game => ({
        ...game,
        playerCount: game.players ? game.players.length : 0,
        matchCount: game.matches ? game.matches.length : 0,
        isOwner: this.isGameOwner(game)
      }));
      
      console.log(`Retrieved ${gamesWithDetails.length} games`);
      return gamesWithDetails;
    } catch (error) {
      console.error('Error getting all games:', error);
      throw error;
    }
  }

  /**
   * Get game by ID
   * @param {string} gameId - Game ID
   * @returns {Promise<Object|null>} Game object or null
   */
  static async getGameById(gameId) {
    try {
      console.log('Getting game by ID:', gameId);
      
      const game = await CloudDBService.getGameById(gameId);
      
      if (game) {
        // Add computed fields
        const gameWithDetails = {
          ...game,
          playerCount: game.players ? game.players.length : 0,
          matchCount: game.matches ? game.matches.length : 0,
          isOwner: this.isGameOwner(game)
        };
        
        console.log('Game found:', gameWithDetails);
        return gameWithDetails;
      }
      
      console.log('Game not found for ID:', gameId);
      return null;
    } catch (error) {
      console.error('Error getting game by ID:', error);
      throw error;
    }
  }

  /**
   * Update game
   * @param {string} gameId - Game ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated game object
   */
  static async updateGame(gameId, updateData) {
    try {
      console.log('Updating game with ID:', gameId);
      console.log('Update data:', updateData);
      
      // Check if user is game owner
      const game = await this.getGameById(gameId);
      if (!game) {
        throw new Error('游戏不存在');
      }
      
      if (!this.isGameOwner(game)) {
        throw new Error('只有游戏创建者可以修改游戏信息');
      }
      
      // Update game in database
      await CloudDBService.updateGame(gameId, updateData);
      
      // Get updated game
      const updatedGame = await this.getGameById(gameId);
      
      console.log('Game updated successfully:', updatedGame);
      return updatedGame;
    } catch (error) {
      console.error('Error updating game:', error);
      throw error;
    }
  }

  /**
   * Delete game
   * @param {string} gameId - Game ID
   * @returns {Promise<Object>} Delete result
   */
  static async deleteGame(gameId) {
    try {
      console.log('Deleting game with ID:', gameId);
      
      // Check if user is game owner
      const game = await this.getGameById(gameId);
      if (!game) {
        throw new Error('游戏不存在');
      }
      
      if (!this.isGameOwner(game)) {
        throw new Error('只有游戏创建者可以删除游戏');
      }
      
      // Delete game from database
      const result = await CloudDBService.deleteGame(gameId);
      
      console.log('Game deleted successfully:', result);
      return result;
    } catch (error) {
      console.error('Error deleting game:', error);
      throw error;
    }
  }

  /**
   * Join game
   * @param {string} gameId - Game ID
   * @returns {Promise<Object>} Updated game object
   */
  static async joinGame(gameId) {
    try {
      console.log('Joining game with ID:', gameId);
      
      // Get current user
      const currentUser = UserService.getCurrentUser();
      if (!currentUser) {
        throw new Error('用户未登录');
      }
      
      // Get game
      const game = await this.getGameById(gameId);
      if (!game) {
        throw new Error('游戏不存在');
      }
      
      // Check if game is active
      if (game.status !== 'active') {
        throw new Error('游戏已结束，无法加入');
      }
      
      // Check if user is already in the game
      if (game.players && game.players.some(player => player.openid === currentUser._openid)) {
        throw new Error('您已经加入了此游戏');
      }
      
      // Check if game is full
      if (game.players && game.players.length >= game.maxPlayers) {
        throw new Error('游戏人数已满');
      }
      
      // Add user to game
      const playerData = {
        openid: currentUser._openid,
        Name: currentUser.Name,
        Avatar: currentUser.Avatar,
        Gender: currentUser.Gender,
        joinedAt: new Date().toISOString()
      };
      
      const updatedPlayers = game.players ? [...game.players, playerData] : [playerData];
      
      // Update game
      const updatedGame = await this.updateGame(gameId, {
        players: updatedPlayers
      });
      
      console.log('Successfully joined game:', updatedGame);
      return updatedGame;
    } catch (error) {
      console.error('Error joining game:', error);
      throw error;
    }
  }

  /**
   * Leave game
   * @param {string} gameId - Game ID
   * @returns {Promise<Object>} Updated game object
   */
  static async leaveGame(gameId) {
    try {
      console.log('Leaving game with ID:', gameId);
      
      // Get current user
      const currentUser = UserService.getCurrentUser();
      if (!currentUser) {
        throw new Error('用户未登录');
      }
      
      // Get game
      const game = await this.getGameById(gameId);
      if (!game) {
        throw new Error('游戏不存在');
      }
      
      // Check if user is in the game
      if (!game.players || !game.players.some(player => player.openid === currentUser._openid)) {
        throw new Error('您未加入此游戏');
      }
      
      // Remove user from game
      const updatedPlayers = game.players.filter(player => player.openid !== currentUser._openid);
      
      // Update game
      const updatedGame = await this.updateGame(gameId, {
        players: updatedPlayers
      });
      
      console.log('Successfully left game:', updatedGame);
      return updatedGame;
    } catch (error) {
      console.error('Error leaving game:', error);
      throw error;
    }
  }

  /**
   * Save generated matches to game
   * @param {string} gameId - Game ID
   * @param {Array} matches - Array of match data
   * @returns {Promise<Object>} Updated game object
   */
  static async saveMatches(gameId, matches) {
    try {
      console.log('Saving matches to game with ID:', gameId);
      console.log('Number of matches:', matches.length);
      
      // Get game
      const game = await this.getGameById(gameId);
      if (!game) {
        throw new Error('游戏不存在');
      }
      
      // Check if user is game owner
      if (!this.isGameOwner(game)) {
        throw new Error('只有游戏创建者可以生成比赛');
      }
      
      // Save matches to database
      await CloudDBService.saveGeneratedMatches(matches, gameId);
      
      // Update game with matches
      const updatedGame = await this.updateGame(gameId, {
        matches: matches,
        status: 'matches_generated'
      });
      
      console.log('Matches saved successfully:', updatedGame);
      return updatedGame;
    } catch (error) {
      console.error('Error saving matches:', error);
      throw error;
    }
  }

  /**
   * Check if current user is game owner
   * @param {Object} game - Game object
   * @returns {boolean} True if user is game owner
   */
  static isGameOwner(game) {
    const currentUser = UserService.getCurrentUser();
    return currentUser && game.owner && game.owner.openid === currentUser._openid;
  }

  /**
   * Generate unique game ID
   * @returns {string} Unique game ID
   */
  static generateGameId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substr(2, 5);
    return `game_${timestamp}_${randomStr}`;
  }

  /**
   * Get games created by current user
   * @returns {Promise<Array>} Array of games created by current user
   */
  static async getMyGames() {
    try {
      console.log('Getting games created by current user...');
      
      const allGames = await this.getAllGames();
      const myGames = allGames.filter(game => this.isGameOwner(game));
      
      console.log(`Found ${myGames.length} games created by current user`);
      return myGames;
    } catch (error) {
      console.error('Error getting my games:', error);
      throw error;
    }
  }

  /**
   * Get games joined by current user
   * @returns {Promise<Array>} Array of games joined by current user
   */
  static async getJoinedGames() {
    try {
      console.log('Getting games joined by current user...');
      
      const currentUser = UserService.getCurrentUser();
      if (!currentUser) {
        return [];
      }
      
      const allGames = await this.getAllGames();
      const joinedGames = allGames.filter(game => 
        game.players && game.players.some(player => player.openid === currentUser._openid)
      );
      
      console.log(`Found ${joinedGames.length} games joined by current user`);
      return joinedGames;
    } catch (error) {
      console.error('Error getting joined games:', error);
      throw error;
    }
  }
}

module.exports = GameService; 