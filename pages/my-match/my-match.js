const app = getApp();
const UserService = require('../../utils/user-service.js');
const MatchService = require('../../utils/match-service.js');
const CloudDBService = require('../../utils/cloud-db.js');

Page({
  data: {
    attentionMatches: [],
    gameMatches: [], // For matches from a specific game
    isLoading: false,
    editMatchId: null,
    editScoreA: '',
    editScoreB: '',
    isSaving: false,    gameId: null, // Store the game ID when viewing generated matches
    isFromGame: false, // Flag to indicate if viewing matches for a specific game
    gameName: '', // Store the game name to display in the UI
    matchRounds: [], // Structured match data organized by rounds
    isOwner: false // Flag to indicate if current user is the game owner
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
    // Only load attention matches if not viewing game-specific matches
    if (!this.data.isFromGame) {
      this.loadAttentionMatches();
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
          isOwner = currentUser.Name === game.owner.nickname;
          console.log('Owner check:', isOwner, currentUser.Name, game.owner.nickname);
        }
        
        this.setData({ 
          gameName: game.title || '对阵表',
          isOwner: isOwner
        });
      }
      
      // Get matches for this game
      const matches = await CloudDBService.getMatchesForGame(gameId);
      
      if (matches && matches.length > 0) {
        console.log('Loaded matches:', matches);
        
        // Group matches by round
        const roundsMap = {};
        matches.forEach(match => {
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
            id: match._id
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
          isLoading: false
        });
        
        console.log('Processed match rounds:', matchRounds);
      } else {
        console.log('No matches found for game');
        this.setData({
          gameMatches: [],
          matchRounds: [],
          isLoading: false
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
  
  // Original function to load matches that need attention
  async loadAttentionMatches() {
    this.setData({ isLoading: true });
    
    try {
      // Use MatchService to get upcoming matches for current user
      const matches = await MatchService.getUpcomingMatchesForUser();
      
      this.setData({ 
        attentionMatches: matches, 
        isLoading: false 
      });
      
      // Update tab bar red dot
      if (matches.length > 0) {
        wx.showTabBarRedDot({ index: 1 }); // Adjust index as needed
      } else {
        wx.hideTabBarRedDot({ index: 1 });
      }
    } catch (error) {
      console.error('Failed to load matches:', error);
      wx.showToast({ 
        title: error.message || 'Failed to load matches', 
        icon: 'none' 
      });
      this.setData({ isLoading: false });
    }
  },
  onEditTap(e) {
    const matchId = e.currentTarget.dataset.id;
    const match = this.data.attentionMatches.find(m => m._id === matchId);
    this.setData({
      editMatchId: matchId,
      editScoreA: match ? (match.ScoreA !== undefined ? match.ScoreA : '') : '',
      editScoreB: match ? (match.ScoreB !== undefined ? match.ScoreB : '') : '',
      isSaving: false
    });
  },
  onEditScoreAInput(e) {
    this.setData({ editScoreA: e.detail.value });
  },
  onEditScoreBInput(e) {
    this.setData({ editScoreB: e.detail.value });
  },
  async onSaveScore() {
    const { editMatchId, editScoreA, editScoreB } = this.data;
    
    if (!editMatchId) return;
    
    if (editScoreA === '' || editScoreB === '') {
      wx.showToast({ title: 'Please enter both scores', icon: 'none' });
      return;
    }
    
    this.setData({ isSaving: true });
    
    try {
      // Use MatchService to update match scores
      await MatchService.updateMatchScores(editMatchId, editScoreA, editScoreB);
      
      wx.showToast({ title: 'Scores saved', icon: 'success' });
      this.setData({ 
        editMatchId: null, 
        editScoreA: '', 
        editScoreB: '', 
        isSaving: false 
      });
      
      // Reload matches to reflect changes
      this.loadAttentionMatches();
    } catch (error) {
      console.error('Failed to save scores:', error);
      wx.showToast({ 
        title: error.message || 'Failed to save', 
        icon: 'none' 
      });
      this.setData({ isSaving: false });
    }
  },  onCancelEdit() {
    this.setData({ 
      editMatchId: null, 
      editScoreA: '', 
      editScoreB: '' 
    });
  },

  // Function to navigate back to the game details page
  navigateBack() {
    wx.navigateBack({
      delta: 1
    });
  },

  // Function to navigate to the generate-match page for regenerating matches
  navigateToGenerate() {
    const { gameId } = this.data;
    
    if (!gameId) {
      wx.showToast({
        title: '无法确定游戏ID',
        icon: 'none'
      });
      return;
    }
    
    wx.navigateTo({
      url: `/pages/generate-match/generate-match?fromSignup=true&gameId=${gameId}`,
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