Page({  
  data: {
    games: [],
    selectedGameIndex: null,
    selectedGame: null,
    
    // New game modal data
    showAddGameModal: false,
    newGame: {
      title: '',
      date: '',
      startTime: '',
      endTime: '',
      location: '',
      rules: '一局定胜负，21分制',
      matchupMethod: '系统优化轮转',
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
    
    // Load games from the cloud
    this.loadGamesFromCloud();
  },
  
  // This method will be called every time this page is shown
  // Including when navigating back from the game-detail page after deleting a game
  onShow: function() {
    console.log('Game Signup page shown/returned to');
    
    // Get the latest games from the cloud
    this.loadGamesFromCloud();
  },
  
  // Load games from cloud database
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
        return;
      }
      
      // Update global data and local state
      app.globalData.games = cloudGames;
      
      this.setData({
        games: cloudGames,
        selectedGameIndex: cloudGames.length > 0 ? 0 : null,
        selectedGame: cloudGames.length > 0 ? cloudGames[0] : null
      });
      
      console.log('Updated game list from cloud in game-signup page:', this.data.games.length);
    } catch (error) {
      console.error('Failed to load games from cloud:', error);
      wx.showToast({
        title: '加载活动失败',
        icon: 'none'
      });
      
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
        matchupMethod: '系统优化轮转',
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
        status: '招募中',
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
