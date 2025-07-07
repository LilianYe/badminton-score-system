const app = getApp();

// Cache constants
const CACHE_KEY = 'PLAYERS_RANKING_CACHE';
const CACHE_EXPIRY_KEY = 'PLAYERS_RANKING_CACHE_EXPIRY';
const CACHE_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

Page({
  data: {
    players: [],
    isLoading: false,
    isEmpty: true,
    lastUpdated: null,
  },
  
  onLoad: function() {
    this.loadPlayersData();
  },
  
  onShow: function() {
    // Only check for cached data without forcing a reload
    this.loadPlayersData(false);
  },
  
  // Load data from cache or fetch from database
  async loadPlayersData(forceRefresh = false) {
    try {
      if (!forceRefresh) {
        // Try to get cached data first
        const cachedData = this.getCachedData();
        if (cachedData) {
          console.log('Using cached player rankings');
          this.setData({
            players: cachedData.players,
            isEmpty: cachedData.players.length === 0,
            lastUpdated: cachedData.timestamp,
            isLoading: false
          });
          return;
        }
      }
      
      // No valid cache or force refresh, load from database
      await this.loadUserPerformance();
    } catch (error) {
      console.error('Error loading players data:', error);
      this.setData({ isLoading: false });
    }
  },
  
  // Get cached data if it exists and is not expired
  getCachedData() {
    try {
      const cachedDataString = wx.getStorageSync(CACHE_KEY);
      const cachedExpiryTime = wx.getStorageSync(CACHE_EXPIRY_KEY);
      
      if (cachedDataString && cachedExpiryTime) {
        const now = new Date().getTime();
        
        // Check if cache is still valid
        if (now < cachedExpiryTime) {
          const cachedData = JSON.parse(cachedDataString);
          console.log('Found valid cache from:', new Date(cachedData.timestamp));
          return cachedData;
        } else {
          console.log('Cache expired, will fetch new data');
          // Clear expired cache
          this.clearCache();
        }
      }
    } catch (error) {
      console.error('Error reading from cache:', error);
      this.clearCache();
    }
    
    return null;
  },
  
  // Save data to cache
  saveToCache(players) {
    try {
      const cacheData = {
        players: players,
        timestamp: new Date().getTime()
      };
      
      // Calculate expiry time
      const expiryTime = new Date().getTime() + CACHE_DURATION_MS;
      
      // Save data and expiry time to storage
      wx.setStorageSync(CACHE_KEY, JSON.stringify(cacheData));
      wx.setStorageSync(CACHE_EXPIRY_KEY, expiryTime);
      
      console.log('Player rankings cached successfully. Expires:', new Date(expiryTime));
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  },
  
  // Clear the cache
  clearCache() {
    try {
      wx.removeStorageSync(CACHE_KEY);
      wx.removeStorageSync(CACHE_EXPIRY_KEY);
      console.log('Player rankings cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  },
  
  // Format timestamp to human-readable date/time
  formatLastUpdated(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${month}月${day}日 ${hours}:${minutes}`;
  },
  
  // Fetch player data from database
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

      // Load top 50 players with greater than or equal 10 games using pagination
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
            Games: db.command.gte(10)
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

      // Save to local cache
      this.saveToCache(processedPlayers);
      
      const now = new Date().getTime();
      this.setData({
        players: processedPlayers,
        isEmpty: processedPlayers.length === 0,
        lastUpdated: now,
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
    // Force refresh when pulling down
    this.loadPlayersData(true).then(() => {
      wx.stopPullDownRefresh();
      wx.showToast({
        title: '排行榜已更新',
        icon: 'success'
      });
    });
  }
});