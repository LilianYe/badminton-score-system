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
   * Add player to game
   * @param {string} gameId - Game ID
   * @param {Object} playerData - Player data object
   * @returns {Promise<Object>} Updated game object
   */
  static async addPlayerToGame(gameId, playerData) {
    try {
      console.log('Adding player to game with ID:', gameId);
      console.log('Player data:', playerData);
      
      // Get game
      const game = await this.getGameById(gameId);
      if (!game) {
        throw new Error('游戏不存在');
      }
      
      // Check if game is active
      if (game.status == 'playing') {
        throw new Error('游戏正在进行，无法加入');
      }
      
      // Initialize players array if it doesn't exist
      if (!game.players) {
        game.players = [];
      } else if (!Array.isArray(game.players)) {
        throw new Error('游戏玩家数据格式错误');
      }
      
      // Check if player with same name already exists
      const existingPlayerIndex = game.players.findIndex(p => p.name === playerData.name);
      if (existingPlayerIndex >= 0) {
        throw new Error('该玩家已经报名参加了这个活动');
      }
      
      // Check if game is full
      const maxPlayers = game.maxPlayers;
      if (game.players.length >= maxPlayers) {
        throw new Error('报名人数已满');
      }
      
      // Add the player to the game
      const updatedPlayers = [...game.players, playerData];

      // Delete any generated matches if they exist
      if (game.status === 'matched') {
        console.log('Deleting generated matches as a new player has been added');
        await CloudDBService.deleteMatchesForGame(gameId);
        
        // Update game in database with added player, reset status, and reset match data
        await CloudDBService.updateGame(gameId, {
          players: updatedPlayers,
          status: 'active',
          matchGenerated: false
        });
      } else {
        // If no matches were generated, just update player list
        await CloudDBService.updateGame(gameId, {
          players: updatedPlayers
        });
      }
      
      // Get updated game
      const updatedGame = await this.getGameById(gameId);
      console.log('Player added successfully:', updatedGame);
      return updatedGame;
    } catch (error) {
      console.error('Error adding player to game:', error);
      throw error;
    }
  }

  
  /**
   * Remove player from game by index
   * @param {string} gameId - Game ID
   * @param {number} playerIndex - Index of the player in the players array
   * @returns {Promise<Object>} Updated game object
   */
  static async removePlayerFromGame(gameId, playerIndex) {
    try {
      console.log(`Removing player at index ${playerIndex} from game ${gameId}`);
      
      // Get game
      const game = await this.getGameById(gameId);
      if (!game) {
        throw new Error('游戏不存在');
      }
      
      if (game.status == 'playing') {
        throw new Error('游戏正在进行中，无法移除玩家');
      }

      // Check if players array exists
      if (!game.players || !Array.isArray(game.players)) {
        throw new Error('游戏玩家数据格式错误');
      }
      
      // Check if playerIndex is valid
      if (playerIndex < 0 || playerIndex >= game.players.length) {
        throw new Error('玩家索引无效');
      }
      
      // Check if current user is game owner
      if (!this.isGameOwner(game) && game.players[playerIndex].name !== UserService.getCurrentUser().Name) {
        throw new Error('普通玩家只能移除自己');
      }
      
      // Create new players array without the player at the specified index
      const updatedPlayers = [...game.players];
      updatedPlayers.splice(playerIndex, 1);
      
      // Delete any generated matches if they exist
      if (game.status === 'matched') {
        console.log('Deleting generated matches as player roster has changed');
        await CloudDBService.deleteMatchesForGame(gameId);
        
        // Update game in database with removed player, reset status, and reset match data
        await CloudDBService.updateGame(gameId, {
          players: updatedPlayers,
          status: 'active',
          matchGenerated: false
        });
      } else {
        // If no matches were generated, just update player list
        await CloudDBService.updateGame(gameId, {
          players: updatedPlayers
        });
      }
      
      const updatedGame = await this.getGameById(gameId);
      console.log('Player removed successfully:', updatedGame);
      return updatedGame;
    } catch (error) {
      console.error('Error removing player from game:', error);
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
      await CloudDBService.updateGame(gameId, {
        status: 'matched',
        matchGenerated: true
      });
      const updatedGame = await this.getGameById(gameId);
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
    return currentUser && game.owner && game.owner.Name === currentUser.Name;
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