// Cache constants for game stats
const GAME_STATS_CACHE_KEY = 'GAME_STATS_CACHE';
const GAME_STATS_CACHE_EXPIRY_KEY = 'GAME_STATS_CACHE_EXPIRY';
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes in milliseconds (longer cache since game stats rarely change)

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
    // Game data
    gameId: null,
    gameInfo: null,
    // Statistics data
    totalMatches: 0,
    completedMatches: 0,
    completionRate: 0,
    totalPlayers: 0,
    playerStats: [],
    lastUpdated: null // Add timestamp for displaying when stats were last loaded
  },

  onLoad: function(options) {
    console.log('Completed game stats page loaded with options:', options);
    
    if (options.gameId) {
      this.setData({ gameId: options.gameId });
      this.checkUserAndLoadData();
    } else {
      wx.showToast({
        title: '缺少比赛ID',
        icon: 'none'
      });
      wx.navigateBack();
    }
  },

  onShow: function() {
    // Only reload if we have a user and gameId
    if (this.data.currentUser && this.data.gameId) {
      // Check if we should force refresh based on game modification
      const app = getApp();
      const forceRefresh = app.globalData.gameModified === true;
      
      if (forceRefresh) {
        console.log('Game was modified, forcing refresh');
        // Reset the flag
        app.globalData.gameModified = false;
        this.loadGameStatsWithCache(true);
      } else {
        // Normal load with cache if available
        this.loadGameStatsWithCache(false);
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
        await this.loadGameStatsWithCache(false);
      } else {
        console.log('No current user found, showing login prompt');
        this.setData({ 
          isLoading: false, 
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

  // Load game stats with cache support
  async loadGameStatsWithCache(forceRefresh = false) {
    if (!forceRefresh) {
      const cachedData = this.getCachedGameStats();
      if (cachedData) {
        console.log('Loading game stats from cache');
        this.setData({
          ...cachedData,
          isLoading: false,
          isEmpty: false
        });
        return;
      }
    }

    console.log('Loading game stats from server');
    await this.loadGameStats();
  },

  // Get cached game stats if available and not expired
  getCachedGameStats() {
    try {
      const cacheKey = `${GAME_STATS_CACHE_KEY}_${this.data.gameId}`;
      const expiryKey = `${GAME_STATS_CACHE_EXPIRY_KEY}_${this.data.gameId}`;
      
      const cachedData = wx.getStorageSync(cacheKey);
      const cacheExpiry = wx.getStorageSync(expiryKey);
      
      if (cachedData && cacheExpiry && Date.now() < cacheExpiry) {
        console.log('Game stats cache hit');
        return cachedData;
      }
    } catch (error) {
      console.error('Error reading game stats cache:', error);
    }
    return null;
  },

  // Cache game stats data
  cacheGameStats(data) {
    try {
      const cacheKey = `${GAME_STATS_CACHE_KEY}_${this.data.gameId}`;
      const expiryKey = `${GAME_STATS_CACHE_EXPIRY_KEY}_${this.data.gameId}`;
      const expiryTime = Date.now() + CACHE_DURATION_MS;
      
      wx.setStorageSync(cacheKey, data);
      wx.setStorageSync(expiryKey, expiryTime);
      console.log('Game stats cached successfully');
    } catch (error) {
      console.error('Error caching game stats:', error);
    }
  },

  // Clear cache for this specific game
  clearGameStatsCache() {
    try {
      const cacheKey = `${GAME_STATS_CACHE_KEY}_${this.data.gameId}`;
      const expiryKey = `${GAME_STATS_CACHE_EXPIRY_KEY}_${this.data.gameId}`;
      
      wx.removeStorageSync(cacheKey);
      wx.removeStorageSync(expiryKey);
      console.log('Game stats cache cleared');
    } catch (error) {
      console.error('Error clearing game stats cache:', error);
    }
  },

  async loadGameStats() {
    this.setData({ isLoading: true });

    try {
      // Get game info
      const db = wx.cloud.database();
      const gameResult = await db.collection('Session')
        .where({
          id: this.data.gameId
        })
        .get();

      if (!gameResult.data || gameResult.data.length === 0) {
        throw new Error('比赛不存在');
      }

      const gameInfo = gameResult.data[0];
      
      // Calculate game statistics
      const gameStats = await this.calculateGameStats(this.data.gameId, gameInfo);
      
      const dataToCache = {
        gameInfo: {
          ...gameInfo,
          formattedDate: this.formatGameDate(gameInfo.updatedAt),
          isCurrentUserParticipated: await this.checkUserParticipation(this.data.gameId)
        },
        ...gameStats,
        lastUpdated: new Date().toLocaleString('zh-CN')
      };

      // Cache the data
      this.cacheGameStats(dataToCache);
      
      this.setData({
        ...dataToCache,
        isEmpty: false,
        isLoading: false
      });

      console.log(`Loaded stats for game ${this.data.gameId}`);
    } catch (error) {
      console.error('Failed to load game stats:', error);
      this.setData({ isLoading: false });
      wx.showToast({
        title: error.message || '加载活动统计失败',
        icon: 'none'
      });
    }
  },

  // Calculate statistics for the specific game
  async calculateGameStats(gameId, gameInfo) {
    try {
      // Get all matches for this game
      const matches = await CloudDBService.getMatchesForGame(gameId);
      
      if (!matches || matches.length === 0) {
        return {
          totalMatches: 0,
          completedMatches: 0,
          completionRate: 0,
          totalPlayers: 0,
          playerStats: []
        };
      }

      const completedMatches = matches.filter(match => match.CompleteTime);
      const completionRate = Math.round((completedMatches.length / matches.length) * 100);

      // Create a map of player name to player info from the session
      const sessionPlayerMap = {};
      if (gameInfo && gameInfo.players && Array.isArray(gameInfo.players)) {
        gameInfo.players.forEach(player => {
          sessionPlayerMap[player.name] = {
            avatar: player.avatar || '/assets/icons/user.png',
            gender: player.gender || 'male'
          };
        });
      }

      // Get unique players and calculate their stats
      const playerStatsMap = {};
      
      completedMatches.forEach(match => {
        const players = [
          { player: match.PlayerA1, isTeamA: true },
          { player: match.PlayerA2, isTeamA: true },
          { player: match.PlayerB1, isTeamA: false },
          { player: match.PlayerB2, isTeamA: false }
        ].filter(p => p.player && p.player.name);

        players.forEach(({ player, isTeamA }) => {
          const playerName = player.name;
          if (!playerStatsMap[playerName]) {
            // Get player info from session data
            const sessionPlayerInfo = sessionPlayerMap[playerName] || {};
            
            playerStatsMap[playerName] = {
              name: playerName,
              matches: 0,
              wins: 0,
              losses: 0,
              eloChange: 0,
              // Use real avatar and gender from session data
              avatar: sessionPlayerInfo.avatar || '/assets/icons/user.png',
              gender: sessionPlayerInfo.gender || 'male'
            };
          }

          playerStatsMap[playerName].matches++;
          const isWin = isTeamA ? match.ScoreA > match.ScoreB : match.ScoreB > match.ScoreA;
          
          if (isWin) {
            playerStatsMap[playerName].wins++;
          } else {
            playerStatsMap[playerName].losses++;
          }

          // Add ELO change - check for both possible property names
          const eloChanged = player.eloChanged || player.eloChange || 0;
          playerStatsMap[playerName].eloChange += eloChanged;
          
          // Debug log to see what we're getting
          console.log(`Player ${playerName} ELO change:`, eloChanged, 'from player object:', player);
        });
      });

      // Convert to array and sort by ELO change (as per the subtitle)
      const playerStats = Object.values(playerStatsMap)
        .map(player => ({
          ...player,
          winRate: player.matches > 0 ? Math.round((player.wins / player.matches) * 100) : 0,
          eloChange: Math.round(player.eloChange)
        }))
        .sort((a, b) => {
          // Sort by ELO change first (as per subtitle "按ELO分变化排序")
          if (a.eloChange !== b.eloChange) return b.eloChange - a.eloChange;
          // Then by win rate
          if (a.winRate !== b.winRate) return b.winRate - a.winRate;
          // Finally by matches played
          return b.matches - a.matches;
        });

      return {
        totalMatches: matches.length,
        completedMatches: completedMatches.length,
        completionRate: completionRate,
        totalPlayers: playerStats.length,
        playerStats: playerStats
      };
    } catch (error) {
      console.error('Error calculating game stats:', error);
      return {
        totalMatches: 0,
        completedMatches: 0,
        completionRate: 0,
        totalPlayers: 0,
        playerStats: []
      };
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

  // Handle avatar image load error
  onAvatarError: function(e) {
    console.log('Avatar load error:', e);
    const { playerName } = e.target.dataset;
    
    // Find the player in playerStats and update with fallback
    const playerStats = this.data.playerStats;
    const playerIndex = playerStats.findIndex(p => p.name === playerName);
    
    if (playerIndex >= 0) {
      // Set fallback to default user icon
      playerStats[playerIndex].avatar = '/assets/icons/user.png';
      this.setData({ playerStats });
    }
  },

  // Navigate to login page
  navigateToLogin: function() {
    wx.navigateTo({
      url: '/pages/user-login/user-login'
    });
  },

  // Helper function to get player avatar (placeholder) - now deprecated
  getPlayerAvatar: function(playerName) {
    // This function is now deprecated since we use real avatars from session data
    if (!playerName) return '';
    return playerName.charAt(0).toUpperCase();
  },

  // Get rank style based on position
  getRankStyle: function(rank) {
    if (rank === 1) return 'rank-first';
    if (rank === 2) return 'rank-second';
    if (rank === 3) return 'rank-third';
    return 'rank-normal';
  },

  // Get ELO change display
  getEloChangeDisplay: function(change) {
    if (change > 0) {
      return `+${change}`;
    } else if (change < 0) {
      return `${change}`;
    }
    return '0';
  },

  // Navigate to user profile
  onUserProfileTap: function(event) {
    const playerName = event.currentTarget.dataset.playerName;
    if (playerName) {
      wx.navigateTo({
        url: `/pages/user-profile/user-profile?username=${encodeURIComponent(playerName)}`,
      });
    }
  },

  // Refresh data
  onPullDownRefresh: function() {
    console.log('User requested refresh');
    this.clearGameStatsCache();
    this.checkUserAndLoadData().finally(() => {
      wx.stopPullDownRefresh();
    });
  }
});