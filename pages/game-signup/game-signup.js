// Cache constants for games list
const GAMES_CACHE_KEY = 'GAMES_LIST_CACHE';
const GAMES_CACHE_EXPIRY_KEY = 'GAMES_LIST_CACHE_EXPIRY';
const CACHE_DURATION_MS = 60 * 60 * 1000; // 60 minutes in milliseconds (shorter than other caches since game data changes more frequently)

Page({  
  data: {
    games: [],
    selectedGameIndex: null,
    selectedGame: null,
    lastUpdated: null, // Add timestamp for displaying when games were last loaded
    
    // New game modal data
    showAddGameModal: false,
    newGame: {
      title: '',
      date: '',
      startTime: '',
      endTime: '',
      location: '',
      rules: '一局定胜负，21分制',
      maxPlayers: 8,
      courtCount: 2,
      players: [],
      owner: null // Owner field to track who created the game
    }
  },
  
  onLoad: function(options) {
    console.log('Game Signup page loaded');
    
    // Get app global data
    const app = getApp();
    app.globalData = app.globalData || {};
    
    // Load games with cache support
    this.loadGamesWithCache();
  },
  
  // This method will be called every time this page is shown
  // Including when navigating back from the game-detail page after deleting a game
  onShow: function() {
    console.log('Game Signup page shown/returned to');
    
    // Check if we should force refresh based on game modification
    const app = getApp();
    const forceRefresh = app.globalData.gameModified === true;
    
    if (forceRefresh) {
      console.log('Game was modified, forcing refresh');
      // Reset the flag
      app.globalData.gameModified = false;
      this.loadGamesWithCache(true);
    } else {
      // Normal load with cache if available
      this.loadGamesWithCache(false);
    }
  },
  
  // New function to manage cache and loading
  loadGamesWithCache: function(forceRefresh = false) {
    return new Promise((resolve, reject) => {
      try {
        if (!forceRefresh) {
          // Try to get cached games first
          const cachedGames = this.getCachedGames();
          if (cachedGames) {
            console.log('Using cached games list');
            resolve();
            return;
          }
        }
        
        // No valid cache or force refresh, load from database
        this.loadGamesFromCloud()
          .then(resolve)
          .catch(reject);
      } catch (error) {
        console.error('Error in loadGamesWithCache:', error);
        // If there's an error with cache, fall back to cloud loading
        this.loadGamesFromCloud()
          .then(resolve)
          .catch(reject);
      }
    });
  },
  
  // Get cached games if available and valid
  getCachedGames: function() {
    try {
      const cachedGamesString = wx.getStorageSync(GAMES_CACHE_KEY);
      const cachedExpiryTime = wx.getStorageSync(GAMES_CACHE_EXPIRY_KEY);
      
      if (cachedGamesString && cachedExpiryTime) {
        const now = new Date().getTime();
        
        // Check if cache is still valid
        if (now < cachedExpiryTime) {
          const cachedData = JSON.parse(cachedGamesString);
          console.log('Found valid games cache from:', new Date(cachedData.timestamp));
          
          // Update state with cached data
          const games = cachedData.games;
          
          this.setData({
            games: games,
            selectedGameIndex: games.length > 0 ? 0 : null,
            selectedGame: games.length > 0 ? games[0] : null,
            lastUpdated: cachedData.timestamp
          });
          
          // Update global data as well
          const app = getApp();
          app.globalData.games = games;
          
          return true;
        } else {
          console.log('Games cache expired, will fetch new data');
          // Clear expired cache
          this.clearGamesCache();
        }
      }
    } catch (error) {
      console.error('Error reading games from cache:', error);
      this.clearGamesCache();
    }
    
    return false;
  },
  
  // Save games to cache
  saveGamesToCache: function(games) {
    try {
      const timestamp = new Date().getTime();
      const cacheData = {
        games: games,
        timestamp: timestamp
      };
      
      // Calculate expiry time
      const expiryTime = timestamp + CACHE_DURATION_MS;
      
      // Save to storage
      wx.setStorageSync(GAMES_CACHE_KEY, JSON.stringify(cacheData));
      wx.setStorageSync(GAMES_CACHE_EXPIRY_KEY, expiryTime);
      
      console.log('Games list cached successfully. Expires:', new Date(expiryTime));
      
      // Update timestamp in UI
      this.setData({
        lastUpdated: timestamp
      });
    } catch (error) {
      console.error('Error saving games to cache:', error);
    }
  },
  
  // Clear games cache
  clearGamesCache: function() {
    try {
      wx.removeStorageSync(GAMES_CACHE_KEY);
      wx.removeStorageSync(GAMES_CACHE_EXPIRY_KEY);
      console.log('Games cache cleared');
    } catch (error) {
      console.error('Error clearing games cache:', error);
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
  
  // Load games from cloud database - updated to save to cache and return a Promise
  loadGamesFromCloud: async function() {
    try {
      wx.showLoading({
        title: '加载活动...',
        mask: true
      });
      
      // Get app global data
      const app = getApp();
      app.globalData = app.globalData || {};
      
      // Import the CloudDBService
      const CloudDBService = require('../../utils/cloud-db.js');
      
      // Make sure cloud database is initialized
      CloudDBService.init();
      
      // Get all games from cloud
      const cloudGames = await CloudDBService.getAllGames();
      console.log('Loaded games from cloud:', cloudGames);
      
      // If no games found, load sample games
      if (!cloudGames || cloudGames.length === 0) {
        console.log('No games found in cloud.');
        this.setData({
          games: [],
          selectedGameIndex: null,
          selectedGame: null
        });
        return;
      }
      
      // Update global data and local state
      app.globalData.games = cloudGames;
      
      this.setData({
        games: cloudGames,
        selectedGameIndex: cloudGames.length > 0 ? 0 : null,
        selectedGame: cloudGames.length > 0 ? cloudGames[0] : null
      });
      
      // Save to cache
      this.saveGamesToCache(cloudGames);
      
      console.log('Updated game list from cloud in game-signup page:', this.data.games.length);
    } catch (error) {
      console.error('Failed to load games from cloud:', error);
      wx.showToast({
        title: '加载活动失败',
        icon: 'none'
      });
      throw error; // Re-throw the error for promise handling
    } finally {
      wx.hideLoading();
    }
  },
  
  // Game selection
  selectGame: function(e) {
    const index = e.currentTarget.dataset.index;
    const gameId = this.data.games[index].id;
    
    // Store selected game in global data
    this.setData({
      selectedGameIndex: index,
      selectedGame: this.data.games[index]
    });
    
    // Store all games in global data for access in detail page
    const app = getApp();
    app.globalData = app.globalData || {};
    app.globalData.games = this.data.games;
    
    // Navigate to the game detail page
    wx.navigateTo({
      url: `/pages/game-detail/game-detail?id=${gameId}`
    });
  },

  // Pull-down refresh function - improved with proper Promise handling
  onPullDownRefresh: function() {
    // Force refresh from cloud
    this.loadGamesWithCache(true)
      .then(() => {
        console.log('Pull-down refresh completed');
        wx.stopPullDownRefresh();
        wx.showToast({
          title: '活动已更新',
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
  
  // New game creation
  showAddGameModal: function() {
    // Reset the new game form
    this.setData({ 
      showAddGameModal: true,
      newGame: {
        title: '',
        date: '',
        startTime: '',
        endTime: '',
        location: '',
        rules: '一局定胜负，21分制',
        maxPlayers: 8,
        courtCount: 2,
        players: [],
        owner: null
      }
    });
  },
  
  hideAddGameModal: function() {
    this.setData({ showAddGameModal: false });
  },
  
  onNewGameInput: function(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    const newGame = this.data.newGame;
    newGame[field] = value;
    this.setData({ newGame });
  },
  
  onDateChange: function(e) {
    const newGame = this.data.newGame;
    newGame.date = e.detail.value;
    this.setData({ newGame });
  },
  
  onTimeChange: function(e) {
    const newGame = this.data.newGame;
    newGame.time = e.detail.value;
    this.setData({ newGame });
  },
  
  onMaxPlayersChange: function(e) {
    const newGame = this.data.newGame;
    newGame.maxPlayers = e.detail.value;
    this.setData({ newGame });
  },
  
  onCourtCountChange: function(e) {
    const newGame = this.data.newGame;
    newGame.courtCount = e.detail.value;
    this.setData({ newGame });
  },
  
  onStartTimeChange: function(e) {
    const newGame = this.data.newGame;
    newGame.startTime = e.detail.value;
    this.setData({ newGame });
  },
  
  onEndTimeChange: function(e) {
    const newGame = this.data.newGame;
    newGame.endTime = e.detail.value;
    this.setData({ newGame });
  },
  
  // Helper function to convert time string (HH:MM) to minutes for comparison
  convertTimeToMinutes: function(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  },
  
  addNewGame: async function() {
    const { newGame, games } = this.data;
    
    // Validate required fields
    if (!newGame.title.trim()) {
      wx.showToast({ title: '请输入活动名称', icon: 'none' });
      return;
    }
    
    if (!newGame.date) {
      wx.showToast({ title: '请选择日期', icon: 'none' });
      return;
    }
    
    if (!newGame.startTime) {
      wx.showToast({ title: '请选择开始时间', icon: 'none' });
      return;
    }
    
    if (!newGame.endTime) {
      wx.showToast({ title: '请选择结束时间', icon: 'none' });
      return;
    }
    
    if (!newGame.location.trim()) {
      wx.showToast({ title: '请输入地点', icon: 'none' });
      return;
    }
    
    // Validate time logic: end time should be after start time
    const startMinutes = this.convertTimeToMinutes(newGame.startTime);
    const endMinutes = this.convertTimeToMinutes(newGame.endTime);
    
    if (endMinutes <= startMinutes) {
      wx.showToast({ title: '结束时间必须晚于开始时间', icon: 'none' });
      return;
    }

    // Get the current user to set as owner
    const app = getApp();
    const currentUser = await app.getCurrentUser();
    
    if (!currentUser) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }
    
    try {
      wx.showLoading({
        title: '创建活动中...',
        mask: true
      });
      
      // Generate a unique ID for the new game
      const gameId = 'game' + Date.now();
      
      // Create new game object with owner info
      const createdGame = {
        ...newGame,
        id: gameId,
        status: 'active',
        players: [],
        owner: {
          Name: currentUser.Name,
          Avatar: currentUser.Avatar
        }
      };
      
      // Import the CloudDBService
      const CloudDBService = require('../../utils/cloud-db.js');
      
      // Ensure cloud database is initialized
      CloudDBService.ensureInit();
      
      // Save the game to cloud database
      const savedGame = await CloudDBService.createGame(createdGame);
      console.log('Game saved to cloud database:', savedGame);
      
      // Add to games array and select it
      const updatedGames = [...games, savedGame];
      
      this.setData({
        games: updatedGames,
        selectedGameIndex: updatedGames.length - 1,
        selectedGame: savedGame,
        showAddGameModal: false
      });
      
      // Store updated games array in global data
      app.globalData.games = updatedGames;
      
      // Update the cache with the new game list
      this.saveGamesToCache(updatedGames);
      
      // Set the game modified flag to true to ensure other pages refresh
      app.globalData.gameModified = true;
      
      wx.hideLoading();
      
      wx.showToast({
        title: '活动创建成功',
        icon: 'success',
        duration: 2000,
        complete: () => {
          // Navigate to the game detail page
          wx.navigateTo({
            url: `/pages/game-detail/game-detail?id=${gameId}`
          });
        }
      });
    } catch (error) {
      wx.hideLoading();
      console.error('Failed to create game:', error);
      wx.showToast({
        title: error.message || '创建活动失败',
        icon: 'none'
      });
    }
  }
});
