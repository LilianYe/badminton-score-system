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
      // Get total count first for players with more than 5 games
      const countResult = await db.collection('UserPerformance')
        .where({
          Games: db.command.gt(5)
        })
        .count();
      const totalCount = countResult.total;
      console.log(`Total players with more than 5 games: ${totalCount}`);

      // Load top 50 players with more than 5 games using pagination
      const allPlayers = [];
      const maxPlayers = 50; // Limit to top 50 players
      const batchSize = 20; // WeChat cloud database limit
      const totalBatches = Math.ceil(Math.min(maxPlayers, totalCount) / batchSize);

      for (let batch = 0; batch < totalBatches; batch++) {
        const skip = batch * batchSize;
        const limit = Math.min(batchSize, maxPlayers - (batch * batchSize));
        console.log(`Loading batch ${batch + 1}/${totalBatches} (skip: ${skip}, limit: ${limit})`);
        
        const res = await db.collection('UserPerformance')
          .where({
            Games: db.command.gt(5)
          })
          .orderBy('ELO', 'desc')
          .skip(skip)
          .limit(limit)
          .get();

        allPlayers.push(...res.data);
      }

      console.log(`Loaded ${allPlayers.length} top players with more than 5 games (max: ${maxPlayers})`);

      const processedPlayers = allPlayers.map((player, index) => {
        // Calculate win rate percentage
        const winRate = player.WinRate ? (player.WinRate * 100).toFixed(1) : '0.0';
        const mixedWinRate = player.MixedWinRate ? (player.MixedWinRate * 100).toFixed(1) : '0.0';
        const sameGenderWinRate = player.SameGenderWinRate ? (player.SameGenderWinRate * 100).toFixed(1) : '0.0';
        
        // Round the ELO score to an integer
        const roundedElo = player.ELO ? Math.round(player.ELO) : player.ELO;
        
        const processedPlayer = {
          ...player,
          Gender: player.Gender || 'male', // Use Gender directly from UserPerformance
          ELO: roundedElo, // Use the rounded integer value
          rank: index + 1,
          winRateDisplay: `${winRate}%`,
          mixedWinRateDisplay: `${mixedWinRate}%`,
          sameGenderWinRateDisplay: `${sameGenderWinRate}%`,
          totalGames: player.Games || 0,
          totalWins: player.Wins || 0,
          totalLosses: player.Losses || 0
        };
        
        // Debug log for first few players
        if (index < 5) {
          console.log(`Player ${index + 1}: ${processedPlayer.Name} - Gender: ${processedPlayer.Gender}`);
        }
        
        return processedPlayer;
      });

      console.log('First 3 processed players:', processedPlayers.slice(0, 3));

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
    
  onPullDownRefresh() {
    this.loadUserPerformance().then(() => {
      wx.stopPullDownRefresh();
    });
  }
});