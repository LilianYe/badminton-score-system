const app = getApp();

Page({
  data: {
    player: null,
    games: [],
    winRate: 0,
    totalGames: 0,
    isLoading: true,
    processedGames: [] // This will hold the games with pre-calculated display values
  },
  
  onLoad: function(options) {
    const playerId = options.id;
    this.loadPlayerData(playerId);
  },
  
  loadPlayerData: function(playerId) {
    // Get player data
    const players = wx.getStorageSync('players') || [];
    const player = players.find(p => p.id === playerId);
    
    if (!player) {
      wx.showToast({
        title: 'Player not found',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }
    
    // Calculate win rate
    const totalGames = (player.wins || 0) + (player.losses || 0);
    const winRate = totalGames > 0 ? ((player.wins || 0) / totalGames * 100).toFixed(1) : 0;
    
    // Get games involving this player
    const allGames = wx.getStorageSync('games') || [];
    const playerGames = allGames.filter(game => {
      if (game.gameType === 'doubles') {
        return this.isPlayerInDoublesGame(game, playerId);
      } else {
        // For singles games
        return game.winnerId === playerId || game.loserId === playerId;
      }
    });
    
    // Sort games by date (newest first)
    playerGames.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Process games to add display properties
    const processedGames = playerGames.map(game => {
      const processedGame = { ...game };
      
      // Add display properties
      processedGame.isWin = this.didPlayerWin(game, playerId);
      processedGame.displayDate = this.formatDate(game.date);
      processedGame.resultText = processedGame.isWin ? 'W' : 'L';
      
      if (game.gameType === 'doubles') {
        processedGame.teamDisplay = this.getTeamDisplay(game, playerId);
        processedGame.scoreDisplay = this.getScoreDisplay(game, playerId);
      } else {
        processedGame.opponentName = this.getSinglesOpponent(game, playerId);
        processedGame.scoreDisplay = this.getSinglesScore(game, playerId);
      }
      
      return processedGame;
    });
    
    this.setData({
      player,
      games: playerGames,
      processedGames: processedGames,
      winRate,
      totalGames,
      isLoading: false
    });
  },
  
  // Reused function from before
  isPlayerInDoublesGame: function(game, playerId) {
    // Check if player is in team A
    if (game.teamA.player1.id === playerId || game.teamA.player2.id === playerId) {
      return true;
    }
    
    // Check if player is in team B
    if (game.teamB.player1.id === playerId || game.teamB.player2.id === playerId) {
      return true;
    }
    
    return false;
  },
  
  // Functions moved from WXS
  didPlayerWin: function(game, playerId) {
    if (game.gameType === 'doubles') {
      const playerInTeamA = game.teamA.player1.id === playerId || game.teamA.player2.id === playerId;
      
      if (playerInTeamA && game.winningTeam === 'teamA') {
        return true;
      } else if (!playerInTeamA && game.winningTeam === 'teamB') {
        return true;
      } else {
        return false;
      }
    } else {
      return game.winnerId === playerId;
    }
  },
  
  formatDate: function(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.getFullYear() + "-" + this.padZero(date.getMonth() + 1) + "-" + this.padZero(date.getDate());
  },
  
  padZero: function(num) {
    if (num < 10) {
      return "0" + num;
    } else {
      return "" + num;
    }
  },
  
  getTeamDisplay: function(game, playerId) {
    let playerTeam = "";
    let opponentTeam = "";
    
    if (game.teamA.player1.id === playerId || game.teamA.player2.id === playerId) {
      // Player is in team A
      if (game.teamA.player1.id === playerId) {
        playerTeam = "with " + app.getDisplayNickname(game.teamA.player2);
      } else {
        playerTeam = "with " + app.getDisplayNickname(game.teamA.player1);
      }

      opponentTeam = [app.getDisplayNickname(game.teamB.player1), app.getDisplayNickname(game.teamB.player2)].join(" & ");

    } else {
      // Player is in team B
      if (game.teamB.player1.id === playerId) {
        playerTeam = "with " + app.getDisplayNickname(game.teamB.player2);
      } else {
        playerTeam = "with " + app.getDisplayNickname(game.teamB.player1);
      }
      
      opponentTeam =  [app.getDisplayNickname(game.teamA.player1), app.getDisplayNickname(game.teamA.player2)].join(" & ");
    }
    
    return playerTeam + " vs " + opponentTeam;
  },
  
  getScoreDisplay: function(game, playerId) {
    const playerInTeamA = game.teamA.player1.id === playerId || game.teamA.player2.id === playerId;
    
    if (playerInTeamA) {
      return game.teamA.score + "-" + game.teamB.score;
    } else {
      return game.teamB.score + "-" + game.teamA.score;
    }
  },
  
  getSinglesOpponent: function(game, playerId) {
    if (game.winnerId === playerId) {
      if (game.loser) {
        return app.getDisplayNickname(game.loser);
      } else {
        return "Unknown";
      }
    } else {
      if (game.winner) {
        return app.getDisplayNickname(game.winner);
      } else {
        return "Unknown";
      }
    }
  },
  
  getSinglesScore: function(game, playerId) {
    if (game.winnerId === playerId) {
      let winnerScore;
      let loserScore;
      
      if (game.winner) {
        winnerScore = game.winner.score;
      } else {
        winnerScore = 0;
      }
      
      if (game.loser) {
        loserScore = game.loser.score;
      } else {
        loserScore = 0;
      }
      
      return winnerScore + "-" + loserScore;
    } else {
      let winnerScore;
      let loserScore;
      
      if (game.loser) {
        loserScore = game.loser.score;
      } else {
        loserScore = 0;
      }
      
      if (game.winner) {
        winnerScore = game.winner.score;
      } else {
        winnerScore = 0;
      }
      
      return loserScore + "-" + winnerScore;
    }
  },
  
  /**
   * Delete the current player
   */
  deletePlayer: function() {
    const { player } = this.data;
    
    // Show confirmation dialog
    wx.showModal({
      title: 'Delete Player',
      content: `Are you sure you want to delete ${app.getDisplayNickname(player)}? This action cannot be undone.`,
      confirmText: 'Delete',
      confirmColor: '#dc3545',
      cancelText: 'Cancel',
      success: (res) => {
        if (res.confirm) {
          // User confirmed, proceed with deletion
          this.performPlayerDeletion(player.id);
        }
      }
    });
  },
  
  /**
   * Perform the actual player deletion
   */
  performPlayerDeletion: function(playerId) {
    // Get current players
    const players = wx.getStorageSync('players') || [];
    
    // Filter out the player to delete
    const updatedPlayers = players.filter(p => p.id !== playerId);
    
    // Update storage
    try {
      wx.setStorageSync('players', updatedPlayers);
      
      // Show success message
      wx.showToast({
        title: 'Player deleted',
        icon: 'success'
      });
      
      // Navigate back to players list
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      
    } catch (error) {
      console.error('Failed to delete player:', error);
      wx.showToast({
        title: 'Failed to delete player',
        icon: 'none'
      });
    }
  }
});