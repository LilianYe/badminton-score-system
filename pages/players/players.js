const app = getApp();

Page({
  data: {
    players: [],
    isLoading: false,
    isEmpty: true
  },
  
  onLoad: function() {
    this.loadUserPerformance();
  },
  
  onShow: function() {
    this.loadUserPerformance();
  },
  
  async loadUserPerformance() {
    this.setData({ isLoading: true });
    const db = wx.cloud.database();

    try {
      const res = await db.collection('UserPerformance')
        .orderBy('ELO', 'desc')
        .get();

      const processedPlayers = res.data.map((player, index) => {
        // Calculate win rate percentage
        const winRate = player.WinRate ? (player.WinRate * 100).toFixed(1) : '0.0';
        const mixedWinRate = player.MixedWinRate ? (player.MixedWinRate * 100).toFixed(1) : '0.0';
        const sameGenderWinRate = player.SameGenderWinRate ? (player.SameGenderWinRate * 100).toFixed(1) : '0.0';
        
        return {
          ...player,
          rank: index + 1,
          winRateDisplay: `${winRate}%`,
          mixedWinRateDisplay: `${mixedWinRate}%`,
          sameGenderWinRateDisplay: `${sameGenderWinRate}%`,
          totalGames: player.Games || 0,
          totalWins: player.Wins || 0,
          totalLosses: player.Losses || 0
        };
      });

      this.setData({
        players: processedPlayers,
        isEmpty: processedPlayers.length === 0,
        isLoading: false
      });

    } catch (error) {
      console.error('Failed to load user performance:', error);
      wx.showToast({
        title: 'Failed to load rankings',
        icon: 'none'
      });
      this.setData({ 
        isLoading: false,
        isEmpty: true,
        players: []
      });
    }
  },
  
  addPlayer: function() {
    wx.navigateTo({
      url: '/pages/add-player/add-player'
    });
  },
  
  onPlayerTap: function(e) {
    const playerName = e.currentTarget.dataset.name;
    
    // Navigate to player details page
    wx.navigateTo({
      url: `/pages/player-detail/player-detail?name=${encodeURIComponent(playerName)}`
    });
  },
  
  onPullDownRefresh() {
    this.loadUserPerformance().then(() => {
      wx.stopPullDownRefresh();
    });
  }
});