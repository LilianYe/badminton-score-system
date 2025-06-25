const app = getApp();

Page({
  data: {
    // Player list and selection
    players: [],
    teamAPlayer1Index: -1,
    teamAPlayer2Index: -1,
    teamBPlayer1Index: -1,
    teamBPlayer2Index: -1,
    
    // Scores
    teamAScore: 0,
    teamBScore: 0,
    
    // Game configuration
    isLoading: false
  },

  onLoad: function() {
    this.loadCurrentUser();
    this.loadPlayers();
  },
  
  onShow: function() {
    // Refresh player list when returning to this page
    this.loadPlayers();
  },
  
  loadPlayers: function() {
    const players = wx.getStorageSync('players') || [];
    this.setData({
      players,
      // Reset selections if player list changes
      teamAPlayer1Index: players.length > 0 ? 0 : -1,
      teamAPlayer2Index: players.length > 1 ? 1 : -1,
      teamBPlayer1Index: players.length > 2 ? 2 : -1,
      teamBPlayer2Index: players.length > 3 ? 3 : -1
    });
  },
  
  // Load current user from cloud database
  async loadCurrentUser() {
    try {
      const currentUser = await app.getCurrentUser();
      if (currentUser && currentUser.nickname) {
        this.setData({
          username: currentUser.nickname
        });
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  },
  
  // Player selection handlers
  onTeamAPlayer1Select: function(e) {
    this.setData({ 
      teamAPlayer1Index: e.detail.playerIndex 
    });
    this.checkDuplicateSelections('teamAPlayer1Index');
  },
  
  onTeamAPlayer2Select: function(e) {
    this.setData({ 
      teamAPlayer2Index: e.detail.playerIndex 
    });
    this.checkDuplicateSelections('teamAPlayer2Index');
  },
  
  onTeamBPlayer1Select: function(e) {
    this.setData({ 
      teamBPlayer1Index: e.detail.playerIndex 
    });
    this.checkDuplicateSelections('teamBPlayer1Index');
  },
  
  onTeamBPlayer2Select: function(e) {
    this.setData({ 
      teamBPlayer2Index: e.detail.playerIndex 
    });
    this.checkDuplicateSelections('teamBPlayer2Index');
  },
  
  // Prevent duplicate player selections
  checkDuplicateSelections: function(changedIndex) {
    const { teamAPlayer1Index, teamAPlayer2Index, teamBPlayer1Index, teamBPlayer2Index } = this.data;
    const indices = [teamAPlayer1Index, teamAPlayer2Index, teamBPlayer1Index, teamBPlayer2Index];
    
    // Check for duplicates
    const uniqueIndices = [...new Set(indices.filter(i => i !== -1))];
    if (uniqueIndices.length < indices.filter(i => i !== -1).length) {
      wx.showToast({
        title: 'Each player can only be selected once',
        icon: 'none',
        duration: 2000
      });
      
      // Reset the changed selection if it causes a duplicate
      const resetData = {};
      resetData[changedIndex] = -1;
      this.setData(resetData);
    }
  },
  
  // Score input handlers
  updateTeamAScore: function(e) {
    this.setData({
      teamAScore: parseInt(e.detail.value) || 0
    });
  },
  
  updateTeamBScore: function(e) {
    this.setData({
      teamBScore: parseInt(e.detail.value) || 0
    });
  },
  
  // Submit game results
  submitGame: function() {
    const { 
      players, teamAPlayer1Index, teamAPlayer2Index, teamBPlayer1Index, teamBPlayer2Index, 
      teamAScore, teamBScore 
    } = this.data;
    
    // Validate player selections
    if (teamAPlayer1Index < 0 || teamAPlayer2Index < 0 || teamBPlayer1Index < 0 || teamBPlayer2Index < 0) {
      wx.showToast({
        title: 'Please select all four players',
        icon: 'none'
      });
      return;
    }
    
    // Validate no duplicates
    const playerIndices = [teamAPlayer1Index, teamAPlayer2Index, teamBPlayer1Index, teamBPlayer2Index];
    const uniqueIndices = [...new Set(playerIndices)];
    if (uniqueIndices.length !== 4) {
      wx.showToast({
        title: 'Each player can only be selected once',
        icon: 'none'
      });
      return;
    }
    
    // Validate scores
    if (teamAScore === teamBScore) {
      wx.showToast({
        title: 'Scores cannot be equal',
        icon: 'none'
      });
      return;
    }
    
    // Determine winner and loser teams
    const isTeamAWinner = teamAScore > teamBScore;
    
    // Create game record
    const gameRecord = {
      id: Date.now().toString(), // Ensure unique ID
      gameType: 'doubles',
      date: new Date().toISOString(),
      teamA: {
        player1: {
          id: players[teamAPlayer1Index].id,
          name: players[teamAPlayer1Index].name
        },
        player2: {
          id: players[teamAPlayer2Index].id,
          name: players[teamAPlayer2Index].name
        },
        score: teamAScore
      },
      teamB: {
        player1: {
          id: players[teamBPlayer1Index].id,
          name: players[teamBPlayer1Index].name
        },
        player2: {
          id: players[teamBPlayer2Index].id,
          name: players[teamBPlayer2Index].name
        },
        score: teamBScore
      },
      winningTeam: isTeamAWinner ? 'teamA' : 'teamB'
    };
    
    this.setData({ isLoading: true });
    
    // Save game record
    this.saveGameRecord(gameRecord);
    
    // Update player ELO ratings
    this.updatePlayerRatings(gameRecord);
  },
  
  saveGameRecord: function(gameRecord) {
    // Get existing game records
    const games = wx.getStorageSync('games') || [];
    games.push(gameRecord);
    wx.setStorageSync('games', games);
    
    // Show success and reset form
    wx.showToast({
      title: 'Game saved successfully!',
      icon: 'success',
      duration: 2000,
      complete: () => {
        this.setData({
          isLoading: false,
          teamAScore: 0,
          teamBScore: 0
        });
        
        // Navigate to history page
        setTimeout(() => {
          wx.switchTab({
            url: '/pages/history/history'
          });
        }, 1500);
      }
    });
  },
  
  updatePlayerRatings: function(gameRecord) {
    // Get current player ratings
    const players = wx.getStorageSync('players') || [];
    const kFactor = app.globalData.kFactor || 32;
    
    // Get winning and losing team players
    const winningTeam = gameRecord.winningTeam === 'teamA' ? gameRecord.teamA : gameRecord.teamB;
    const losingTeam = gameRecord.winningTeam === 'teamA' ? gameRecord.teamB : gameRecord.teamA;
    
    const winningPlayerIds = [winningTeam.player1.id, winningTeam.player2.id];
    const losingPlayerIds = [losingTeam.player1.id, losingTeam.player2.id];
    
    // Calculate team ratings
    const winningTeamPlayers = players.filter(p => winningPlayerIds.includes(p.id));
    const losingTeamPlayers = players.filter(p => losingPlayerIds.includes(p.id));
    
    const winningTeamRating = winningTeamPlayers.reduce((sum, p) => sum + p.rating, 0) / 2;
    const losingTeamRating = losingTeamPlayers.reduce((sum, p) => sum + p.rating, 0) / 2;
    
    // Calculate expected outcome
    const getExpectedOutcome = (ratingA, ratingB) => {
      return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    };
    
    const winningTeamExpected = getExpectedOutcome(winningTeamRating, losingTeamRating);
    const losingTeamExpected = getExpectedOutcome(losingTeamRating, winningTeamRating);
    
    // Capture rating changes for each player
    const ratingChanges = {};
    
    // Update player ratings
    const updatedPlayers = players.map(player => {
      if (winningPlayerIds.includes(player.id)) {
        const ratingChange = Math.round(kFactor * (1 - winningTeamExpected));
        ratingChanges[player.id] = ratingChange;
        
        return {
          ...player,
          rating: player.rating + ratingChange,
          wins: (player.wins || 0) + 1,
          matches: (player.matches || 0) + 1
        };
      } else if (losingPlayerIds.includes(player.id)) {
        const ratingChange = Math.round(kFactor * (0 - losingTeamExpected));
        // Store absolute value for easier reversal
        ratingChanges[player.id] = Math.abs(ratingChange);
        
        return {
          ...player,
          rating: player.rating + ratingChange,
          losses: (player.losses || 0) + 1,
          matches: (player.matches || 0) + 1
        };
      }
      return player;
    });
    
    // Store rating changes in the game record
    if (gameRecord.winningTeam === 'teamA') {
      gameRecord.teamA.player1.ratingChange = ratingChanges[gameRecord.teamA.player1.id];
      gameRecord.teamA.player2.ratingChange = ratingChanges[gameRecord.teamA.player2.id];
      gameRecord.teamB.player1.ratingChange = ratingChanges[gameRecord.teamB.player1.id];
      gameRecord.teamB.player2.ratingChange = ratingChanges[gameRecord.teamB.player2.id];
    } else {
      gameRecord.teamB.player1.ratingChange = ratingChanges[gameRecord.teamB.player1.id];
      gameRecord.teamB.player2.ratingChange = ratingChanges[gameRecord.teamB.player2.id];
      gameRecord.teamA.player1.ratingChange = ratingChanges[gameRecord.teamA.player1.id];
      gameRecord.teamA.player2.ratingChange = ratingChanges[gameRecord.teamA.player2.id];
    }
    
    // Update the games list with the rating changes included
    const games = wx.getStorageSync('games') || [];
    const gameIndex = games.findIndex(g => g.id === gameRecord.id);
    if (gameIndex >= 0) {
      games[gameIndex] = gameRecord;
    } else {
      games.push(gameRecord);
    }
    wx.setStorageSync('games', games);
    
    // Save updated players
    wx.setStorageSync('players', updatedPlayers);
  },
  
  navigateToAddPlayer: function() {
    wx.navigateTo({
      url: '/pages/add-player/add-player'
    });
  },
  
  navigateToProfile: function() {
    wx.navigateTo({
      url: '/pages/user-profile/user-profile'
    });
  },
  
  goToMyMatch: function() {
    wx.navigateTo({
      url: '/pages/MyMatch/MyMatch'
    });
  }
});