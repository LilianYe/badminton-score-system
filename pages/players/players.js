const app = getApp();

Page({
  data: {
    players: []
  },
  
  onLoad: function() {
    this.loadPlayers();
  },
  
  onShow: function() {
    this.loadPlayers();
  },
  
  loadPlayers: function() {
    // Get players from storage and sort by rating (descending)
    const players = wx.getStorageSync('players') || [];
    
    // Process players to add displayName with gender indicator
    const processedPlayers = players.map(player => {
      // 处理胜负统计数据
      const wins = player.wins || 0;
      const losses = player.losses || 0;
      const statsDisplay = `${wins}/${losses}`;
      // Create a new object with all existing properties
      return {
        ...player,
        // Add displayName property with gender indicator
        displayName: player.name + (player.gender === 'female' ? ' F' : ' M'),
        className: player.gender === 'female' ? 'player-item female-player' : 'player-item',
        statsDisplay: statsDisplay  // 新添加的预处理胜负统计
      };
    });
    
    // Sort by rating (descending)
    processedPlayers.sort((a, b) => b.rating - a.rating);
    
    this.setData({
      players: processedPlayers
    });
  },
  
  addPlayer: function() {
    wx.navigateTo({
      url: '/pages/add-player/add-player'
    });
  },
  
  onPlayerTap: function(e) {
    const playerId = e.currentTarget.dataset.id;
    
    // Navigate to player details page
    wx.navigateTo({
      url: `/pages/player-detail/player-detail?id=${playerId}`
    });
  },
  
  navigateToHome: function() {
    wx.switchTab({
      url: '/pages/newGame/newGame'
    });
  }
})