const app = getApp();
const UserService = require('../../utils/user-service.js');
const MatchService = require('../../utils/match-service.js');
const CloudDBService = require('../../utils/cloud-db.js');

Page({
  data: {
    gameMatches: [], // For matches from a specific game
    isLoading: false,   
    gameId: null, // Store the game ID when viewing generated matches
    isFromGame: false, // Flag to indicate if viewing matches for a specific game
    gameName: '', // Store the game name to display in the UI
    matchRounds: [], // Structured match data organized by rounds
    isOwner: false, // Flag to indicate if current user is the game owner
    gameStatus: '' // Add this to store the game's status
  },
  
  onLoad(options) {
    if (options.gameId) {
      this.setData({ 
        gameId: options.gameId,
        isFromGame: true 
      });
      this.loadGameMatches(options.gameId);
    }
  },
  
  onShow() {
    // If we have a gameId but no matches loaded, load them now
    if (this.data.gameId && this.data.matchRounds.length === 0) {
      this.loadGameMatches(this.data.gameId);
    }
  },
  
  // Load matches for a specific game organized by rounds
  async loadGameMatches(gameId) {
    this.setData({ isLoading: true });
    
    try {
      console.log('Loading matches for game ID:', gameId);
      
      // Initialize the cloud DB service
      CloudDBService.ensureInit();
      // Get the game details first to display the game name
      const game = await CloudDBService.getGameById(gameId);
      if (game) {
        // Get current user to check ownership
        const app = getApp();
        const currentUser = await app.getCurrentUser();
        let isOwner = false;
        
        if (currentUser && game.owner) {
          // Check if current user is the owner
          isOwner = currentUser.Name === game.owner.Name;
          console.log('Owner check:', isOwner, currentUser.Name, game.owner?.nickname);
        }
        
        this.setData({ 
          gameName: game.title || '对阵表',
          isOwner: isOwner,
          gameStatus: game.status || '' // Store game status
        });
        
        console.log('Game status:', game.status);
      }
      
      // Get matches for this game
      const matches = await CloudDBService.getMatchesForGame(gameId);
      
      if (matches && matches.length > 0) {
        console.log('Loaded matches:', matches);
        
        // Group matches by round
        const roundsMap = {};
        let completedMatchesCount = 0; // Track completed matches
        let totalMatchesCount = 0;     // Track total matches
        
        matches.forEach(match => {
          totalMatchesCount++;
          if (match.CompleteTime) completedMatchesCount++;
          
          const round = match.Round;
          if (!roundsMap[round]) {
            roundsMap[round] = {
              courts: []
            };
          }
          
          // Add this match to the appropriate round
          // Check if we have full player objects or just names
          let team1, team2;
          
          if (match.PlayerA1 && typeof match.PlayerA1 === 'object') {
            // We have full player objects
            team1 = [match.PlayerA1, match.PlayerA2];
            team2 = [match.PlayerB1, match.PlayerB2];
          } else {
            // We have the old format with just names
            team1 = [match.PlayerNameA1, match.PlayerNameA2];
            team2 = [match.PlayerNameB1, match.PlayerNameB2];
          }
          
          roundsMap[round].courts.push({
            teams: [team1, team2],
            court: match.Court,
            id: match._id,
            isCompleted: !!match.CompleteTime, // Add isCompleted flag
            scoreA: match.ScoreA,              // Add scores if available
            scoreB: match.ScoreB,
            matchId: match.MatchId || ''       // Add MatchId for reference
          });
        });
        
        // Convert map to array sorted by round number
        const matchRounds = Object.keys(roundsMap)
          .sort((a, b) => parseInt(a) - parseInt(b))
          .map(roundNum => {
            return {
              round: parseInt(roundNum),
              courts: roundsMap[roundNum].courts
            };
          });
        
        this.setData({
          gameMatches: matches,
          matchRounds: matchRounds,
          isLoading: false,
          completedCount: completedMatchesCount,
          totalCount: totalMatchesCount
        });
        
        console.log('Processed match rounds:', matchRounds);
        console.log(`Completion: ${completedMatchesCount}/${totalMatchesCount}`);
      } else {
        console.log('No matches found for game');
        this.setData({
          gameMatches: [],
          matchRounds: [],
          isLoading: false,
          completedCount: 0,
          totalCount: 0
        });
        
        wx.showToast({
          title: '没有找到比赛记录',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('Failed to load game matches:', error);
      this.setData({ isLoading: false });
      
      wx.showToast({
        title: '加载对阵表失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // Function to navigate back to the game details page
  navigateBack() {
    wx.navigateBack({
      delta: 1
    });
  },

  // Updated function to check game status before navigating to generate matches
  navigateToGenerate() {
    const { gameId, gameStatus } = this.data;
    
    // Check if game status is "playing" - don't allow generating matches
    if (gameStatus === 'playing') {
      console.log('Game status is playing, cannot regenerate matches');
      wx.showToast({
        title: '比赛正在进行中，无法重新生成对阵表',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    if (!gameId) {
      wx.showToast({
        title: '无法确定游戏ID',
        icon: 'none'
      });
      return;
    }
    
    wx.navigateTo({
      url: `/pages/generate-match/generate-match?fromSignup=true&gameId=${gameId}&fromMyMatch=true`,
      success: (res) => {
        console.log('Navigation to generate-match successful', res);
      },
      fail: (err) => {
        console.error('Navigation to generate-match failed', err);
        wx.showToast({
          title: '导航失败',
          icon: 'none'
        });
      }
    });
  }
});