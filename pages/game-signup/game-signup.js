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
      time: '',
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
    
    // Only load sample games if no games exist yet
    if (!app.globalData.games || app.globalData.games.length === 0) {
      this.loadSampleGames();
    } else {
      // Use existing games from globalData
      console.log('Using existing games from globalData:', app.globalData.games.length);
      this.setData({
        games: app.globalData.games,
        selectedGameIndex: 0,
        selectedGame: app.globalData.games[0]
      });
    }
  },
  
  // This method will be called every time this page is shown
  // Including when navigating back from the game-detail page after deleting a game
  onShow: function() {
    console.log('Game Signup page shown/returned to');
    
    // Get the latest games from globalData
    const app = getApp();
    if (app.globalData && app.globalData.games) {
      console.log('Found games in globalData:', app.globalData.games.length);
      
      // Update the local games list with the latest from global data
      this.setData({
        games: app.globalData.games,
        // If we have no games or the previously selected game was deleted,
        // reset the selected game
        selectedGameIndex: app.globalData.games.length > 0 ? 0 : null,
        selectedGame: app.globalData.games.length > 0 ? app.globalData.games[0] : null
      });
      
      console.log('Updated game list in game-signup page:', this.data.games.length);
    } else {
      console.warn('No games found in globalData');
    }
  },
  
  loadSampleGames: function() {
    // Sample games for demonstration
    const sampleGames = [
      {
        id: 'game1',
        title: '8人转 A场地',
        date: '2025/06/24 (星期一)',
        time: '20:00',
        location: '聚星羽毛球馆',
        rules: '一局定胜负，21分制',
        matchupMethod: '系统优化轮转',
        maxPlayers: 8,
        courtCount: 2,
        players: [
          { name: '敏敏子', displayName: '敏敏子(F)', gender: 'female', avatar: '/assets/icons/user.png', elo: 1500 },
          { name: 'Acaprice', displayName: 'Acaprice', gender: 'male', avatar: '/assets/icons/user.png', elo: 1550 },
          { name: 'liyu', displayName: 'liyu', gender: 'male', avatar: '/assets/icons/user.png', elo: 1600 },
          { name: 'Max', displayName: 'Max(F)', gender: 'female', avatar: '/assets/icons/user.png', elo: 1500 }
        ],
        status: '招募中',
        owner: {
          openid: 'system_admin',
          nickname: 'System Admin',
          avatarUrl: '/assets/icons/user.png'
        }
      },
      {
        id: 'game2',
        title: '6人转 B场地',
        date: '2025/06/25 (星期二)',
        time: '19:00',
        location: '万福羽毛球馆',
        rules: '三局两胜，21分制',
        matchupMethod: '系统优化轮转',
        maxPlayers: 6,
        courtCount: 1,
        players: [
          { name: '张晴川', displayName: '张晴川', gender: 'male', avatar: '/assets/icons/user.png', elo: 1600 },
          { name: '方文', displayName: '方文', gender: 'male', avatar: '/assets/icons/user.png', elo: 1520 }
        ],
        status: '招募中',
        owner: {
          openid: 'system_admin',
          nickname: 'System Admin',
          avatarUrl: '/assets/icons/user.png'
        }
      },
      {
        id: 'game3',
        title: '12人混双',
        date: '2025/06/26 (星期三)',
        time: '20:30',
        location: '星火体育中心',
        rules: '一局定胜负，21分制',
        matchupMethod: '随机配对',
        maxPlayers: 12,
        courtCount: 3,
        players: [],
        status: '招募中',
        owner: {
          openid: 'system_admin',
          nickname: 'System Admin',
          avatarUrl: '/assets/icons/user.png'
        }
      }
    ];
    
    // Store in local state
    this.setData({ 
      games: sampleGames,
      // Select the first game by default
      selectedGameIndex: 0,
      selectedGame: sampleGames[0]
    });
    
    // Store in global data for access across pages
    const app = getApp();
    app.globalData = app.globalData || {};
    app.globalData.games = sampleGames;
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
    // Player management functions moved to game-detail page
    // New game creation
  showAddGameModal: function() {
    // Reset the new game form
    this.setData({ 
      showAddGameModal: true,
      newGame: {
        title: '',
        date: '',
        time: '',
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
  },  onMaxPlayersChange: function(e) {
    const newGame = this.data.newGame;
    newGame.maxPlayers = e.detail.value;
    
    this.setData({ newGame });
  },
  
  onCourtCountChange: function(e) {
    const newGame = this.data.newGame;
    newGame.courtCount = e.detail.value;
    this.setData({ newGame });
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
    
    if (!newGame.time) {
      wx.showToast({ title: '请选择时间', icon: 'none' });
      return;
    }
    
    if (!newGame.location.trim()) {
      wx.showToast({ title: '请输入地点', icon: 'none' });
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
    
    // Create new game object with owner info
    const gameId = 'game' + (games.length + 1);
    const createdGame = {
      ...newGame,
      id: gameId,
      status: '招募中',
      players: [],
      owner: {
        openid: currentUser.openid,
        nickname: currentUser.nickname,
        avatarUrl: currentUser.avatarUrl
      }
    };
    
    // Add to games array and select it
    const updatedGames = [...games, createdGame];
    
    this.setData({
      games: updatedGames,
      selectedGameIndex: updatedGames.length - 1,
      selectedGame: createdGame,
      showAddGameModal: false
    });
    
    // Store updated games array in global data
    app.globalData.games = updatedGames;
    
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
  }
  
  // Share game and navigateToGenerate functions moved to game-detail page
});
