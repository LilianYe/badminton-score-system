// Cache constants for completed games list
const COMPLETED_GAMES_CACHE_KEY = 'COMPLETED_GAMES_CACHE';
const COMPLETED_GAMES_CACHE_EXPIRY_KEY = 'COMPLETED_GAMES_CACHE_EXPIRY';
const CACHE_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours in milliseconds (longer than active games since completed games rarely change)

const app = getApp();
const UserService = require('../../utils/user-service.js');
const CloudDBService = require('../../utils/cloud-db.js');
const GameService = require('../../utils/game-service.js');

Page({
  data: {
    isLoading: false,
    isEmpty: true,
    needsLogin: false,
    currentUser: null,
    // Completed games data
    completedGames: [],
    totalGames: 0,
    lastUpdated: null // Add timestamp for displaying when games were last loaded
  },

  onLoad: function() {
    this.checkUserAndLoadData();
  },

  onShow: function() {
    // Only reload if we have a user
    if (this.data.currentUser) {
      // Check if we should force refresh based on game modification
      const app = getApp();
      const forceRefresh = app.globalData.gameModified === true;
      
      if (forceRefresh) {
        console.log('Game was modified, forcing refresh');
        // Reset the flag
        app.globalData.gameModified = false;
        this.loadCompletedGamesWithCache(true);
      } else {
        // Normal load with cache if available
        this.loadCompletedGamesWithCache(false);
      }
    }
  },

  async checkUserAndLoadData() {
    try {
      const currentUser = UserService.getCurrentUser();
      if (currentUser && currentUser.Name) {
        console.log('Current user found:', currentUser);
        this.setData({ 
          currentUser,
          needsLogin: false 
        });
        await this.loadCompletedGamesWithCache();
      } else {
        console.log('No current user found, showing login prompt');
        this.setData({ 
          isLoading: false, 
          completedGames: [], 
          isEmpty: true,
          currentUser: null,
          needsLogin: true
        });
      }
    } catch (error) {
      console.error('Error checking user:', error);
      wx.showToast({
        title: '登录检查失败',
        icon: 'none'
      });
    }
  },

  // New function to manage cache and loading
  loadCompletedGamesWithCache: function(forceRefresh = false) {
    return new Promise((resolve, reject) => {
      try {
        if (!forceRefresh) {
          // Try to get cached games first
          const cachedGames = this.getCachedCompletedGames();
          if (cachedGames) {
            console.log('Using cached completed games list');
            resolve();
            return;
          }
        }
        
        // No valid cache or force refresh, load from database
        this.loadCompletedGamesFromCloud()
          .then(resolve)
          .catch(reject);
      } catch (error) {
        console.error('Error in loadCompletedGamesWithCache:', error);
        // If there's an error with cache, fall back to cloud loading
        this.loadCompletedGamesFromCloud()
          .then(resolve)
          .catch(reject);
      }
    });
  },

  // Get cached completed games if available and valid
  getCachedCompletedGames: function() {
    try {
      const cachedGamesString = wx.getStorageSync(COMPLETED_GAMES_CACHE_KEY);
      const cachedExpiryTime = wx.getStorageSync(COMPLETED_GAMES_CACHE_EXPIRY_KEY);
      
      if (cachedGamesString && cachedExpiryTime) {
        const now = new Date().getTime();
        
        // Check if cache is still valid
        if (now < cachedExpiryTime) {
          const cachedData = JSON.parse(cachedGamesString);
          console.log('Found valid completed games cache from:', new Date(cachedData.timestamp));
          
          // Update state with cached data
          const completedGames = cachedData.completedGames;
          
          this.setData({
            completedGames: completedGames,
            totalGames: completedGames.length,
            isEmpty: completedGames.length === 0,
            lastUpdated: cachedData.timestamp,
            isLoading: false
          });
          
          return true;
        } else {
          console.log('Completed games cache expired, will fetch new data');
          // Clear expired cache
          this.clearCompletedGamesCache();
        }
      }
    } catch (error) {
      console.error('Error reading completed games from cache:', error);
      this.clearCompletedGamesCache();
    }
    
    return false;
  },

  // Save completed games to cache
  saveCompletedGamesToCache: function(completedGames) {
    try {
      const timestamp = new Date().getTime();
      const cacheData = {
        completedGames: completedGames,
        timestamp: timestamp
      };
      
      // Calculate expiry time
      const expiryTime = timestamp + CACHE_DURATION_MS;
      
      // Save to storage
      wx.setStorageSync(COMPLETED_GAMES_CACHE_KEY, JSON.stringify(cacheData));
      wx.setStorageSync(COMPLETED_GAMES_CACHE_EXPIRY_KEY, expiryTime);
      
      console.log('Completed games cached successfully. Expires:', new Date(expiryTime));
      
      // Update timestamp in UI
      this.setData({
        lastUpdated: timestamp
      });
    } catch (error) {
      console.error('Error saving completed games to cache:', error);
    }
  },

  // Clear completed games cache
  clearCompletedGamesCache: function() {
    try {
      wx.removeStorageSync(COMPLETED_GAMES_CACHE_KEY);
      wx.removeStorageSync(COMPLETED_GAMES_CACHE_EXPIRY_KEY);
      console.log('Completed games cache cleared');
    } catch (error) {
      console.error('Error clearing completed games cache:', error);
    }
  },

  // Format timestamp to readable format
  formatLastUpdate: function(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${month}月${day}日 ${hours}:${minutes}`;
  },

  // Load completed games from cloud database - updated to save to cache and return a Promise
  async loadCompletedGamesFromCloud() {
    try {
      this.setData({ isLoading: true });
      
      wx.showLoading({
        title: '加载已完成比赛...',
        mask: true
      });

      // Get all games and find completed ones
      const db = wx.cloud.database();
      
      // Get games that have been completed (status = 'completed')
      const result = await db.collection('Session')
        .where({
          status: 'completed'
        })
        .orderBy('updatedAt', 'desc')
        .get();

      if (result.data && result.data.length > 0) {
        const completedGamesWithBasicInfo = await Promise.all(
          result.data.map(async (game) => {
            return {
              ...game,
              formattedDate: this.formatGameDate(game.updatedAt),
              isCurrentUserParticipated: await this.checkUserParticipation(game.id)
            };
          })
        );

        // Sort by completion date (most recent first)
        completedGamesWithBasicInfo.sort((a, b) => 
          new Date(b.updatedAt) - new Date(a.updatedAt)
        );

        this.setData({
          completedGames: completedGamesWithBasicInfo,
          totalGames: completedGamesWithBasicInfo.length,
          isEmpty: false,
          isLoading: false
        });

        // Save to cache
        this.saveCompletedGamesToCache(completedGamesWithBasicInfo);
        
        console.log(`Loaded ${result.data.length} completed games from cloud`);
      } else {
        this.setData({
          completedGames: [],
          totalGames: 0,
          isEmpty: true,
          isLoading: false
        });
        
        // Save empty result to cache to avoid repeated queries
        this.saveCompletedGamesToCache([]);
      }
    } catch (error) {
      console.error('Failed to load completed games from cloud:', error);
      this.setData({ isLoading: false });
      wx.showToast({
        title: '加载已完成比赛失败',
        icon: 'none'
      });
      throw error; // Re-throw the error for promise handling
    } finally {
      wx.hideLoading();
    }
  },

  // Check if current user participated in this game
  async checkUserParticipation(gameId) {
    try {
      const currentUser = this.data.currentUser;
      if (!currentUser) return false;

      const matches = await CloudDBService.getMatchesForGame(gameId);
      return matches.some(match => {
        return [match.PlayerA1, match.PlayerA2, match.PlayerB1, match.PlayerB2]
          .some(player => player && player.name === currentUser.Name);
      });
    } catch (error) {
      console.error('Error checking user participation:', error);
      return false;
    }
  },

  // Format game completion date - use same format as game-signup page
  formatGameDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // Pull to refresh - improved with proper Promise handling
  onPullDownRefresh: function() {
    // Force refresh from cloud
    this.loadCompletedGamesWithCache(true)
      .then(() => {
        console.log('Pull-down refresh completed');
        wx.stopPullDownRefresh();
        wx.showToast({
          title: '已完成比赛已更新',
          icon: 'success'
        });
      })
      .catch(err => {
        console.error('Error during pull-down refresh:', err);
        wx.stopPullDownRefresh();
        wx.showToast({
          title: '刷新失败',
          icon: 'none'
        });
      });
  },

  // Navigate to game detail - similar to game signup
  onGameTap: function(e) {
    console.log('onGameTap called', e);
    const gameId = e.currentTarget.dataset.gameId;
    console.log('Game ID from dataset:', gameId);
    
    if (gameId) {
      console.log('Navigating to completed-game-stats with gameId:', gameId);
      // Navigate to a dedicated completed game stats page
      wx.navigateTo({
        url: `/pages/completed-game-stats/completed-game-stats?gameId=${gameId}`,
        success: function(res) {
          console.log('Navigation successful', res);
        },
        fail: function(error) {
          console.error('Navigation failed', error);
          wx.showToast({
            title: '页面跳转失败',
            icon: 'none'
          });
        }
      });
    } else {
      console.error('No gameId found in dataset');
      wx.showToast({
        title: '缺少比赛ID',
        icon: 'none'
      });
    }
  }
});