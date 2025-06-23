const app = getApp();

Page({
  data: {
    games: [],
    isEmpty: true,
    isLoading: false,
    currentPlayer: null,
    selectedDate: null,
    allMatches: [] // Store all matches for filtering
  },

  onLoad: function() {
    // Get current player from storage
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.username) {
      this.setData({
        currentPlayer: userInfo.username
      });
      
      // Load game history for logged in user
      this.loadGameHistory(userInfo.username);
    } else {
      // Handle case when user is not logged in
      wx.showToast({
        title: 'Please log in first',
        icon: 'none'
      });
      
      // Redirect to login page after delay
      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/user-login/user-login'
        });
      }, 1500);
    }
  },

  onShow: function() {
    // Always refresh data when page becomes visible
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.username) {
      this.loadGameHistory(userInfo.username);
    }
  },

  onDateSelect: function(e) {
    const pickerDate = e.detail.value; // Format: 'YYYY-MM-DD'
    
    // Store the original format for display
    this.setData({
      selectedDate: pickerDate
    });
    
    // Apply date filter to existing matches
    this.filterMatchesByDate(pickerDate);
  },
  
  clearDateFilter: function() {
    this.setData({
      selectedDate: null
    });
    
    // Show all matches
    this.setData({
      games: this.data.allMatches,
      isEmpty: this.data.allMatches.length === 0
    });
  },
  
  filterMatchesByDate: function(date) {
    if (!date) {
      // If no date is provided, show all matches
      this.setData({
        games: this.data.allMatches,
        isEmpty: this.data.allMatches.length === 0
      });
      return;
    }
    
    console.log('Filtering by selected date:', date);
    
    // Filter matches by the date (YYYY-MM-DD format)
    const filteredMatches = this.data.allMatches.filter(match => {
      let matchDate = '';
      
      if (match.displayDate) {
        // Extract date part or use as is
        matchDate = match.displayDate;
      } else if (match.date) {
        matchDate = match.date;
      } else if (match.apiMatchData && match.apiMatchData.session) {
        // Convert API date format
        matchDate = this.formatAPIDateString(match.apiMatchData.session);
      }
      
      // For debugging
      console.log(`Comparing: Match date=${matchDate}, Selected date=${date}`);
      
      // Compare dates
      return matchDate === date;
    });
    
    console.log(`Found ${filteredMatches.length} matches for date ${date}`);
    
    this.setData({
      games: filteredMatches,
      isEmpty: filteredMatches.length === 0
    });
  },
  
  formatDateToYYYYMMDD: function(date) {
    const padZero = (num) => {
      return num < 10 ? "0" + num : "" + num;
    };
    
    return date.getFullYear() + "-" + 
           padZero(date.getMonth() + 1) + "-" + 
           padZero(date.getDate());
  },

  loadGameHistory: function(playerName) {
    // If no player name is provided, don't attempt to fetch
    if (!playerName) {
      this.setData({
        games: [],
        allMatches: [],
        isEmpty: true
      });
      return;
    }
    
    this.setData({ isLoading: true });
    
    // Define the API URL - adjust the base URL to match your API
    const apiUrl = `http://20.2.72.151:8000/matches/${encodeURIComponent(playerName)}`;
    
    // Make API request
    wx.request({
      url: apiUrl,
      method: 'GET',
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.length > 0) {
          // Process the API response data
          const processedGames = this.processApiMatchData(res.data);
          
          this.setData({
            games: processedGames,
            allMatches: processedGames, // Store all matches for filtering
            isEmpty: processedGames.length === 0,
            isLoading: false
          });
          
          // Apply date filter if one is set
          if (this.data.selectedDate) {
            this.filterMatchesByDate(this.data.selectedDate);
          }
        } else {
          // Handle empty or error response
          this.setData({
            games: [],
            allMatches: [],
            isEmpty: true,
            isLoading: false
          });
          
          if (res.statusCode !== 404) { // 404 just means no games for this player
            wx.showToast({
              title: 'Failed to load matches',
              icon: 'none'
            });
          }
        }
      },
      fail: (err) => {
        console.error('API request failed:', err);
        this.setData({
          isLoading: false,
          isEmpty: true,
          games: [],
          allMatches: []
        });
        
        wx.showToast({
          title: 'Network error',
          icon: 'none'
        });
      }
    });
  },
  
  // Process API match data into our app's format
  processApiMatchData: function(matches) {
    return matches.map((match, index) => {
      // Check if this is a doubles game by looking at team composition
      const isDoubles = match.team_a.includes(',') || match.team_b.includes(',');
      
      // Convert API date format '20250101' to '2025-01-01'
      const formattedDate = this.formatAPIDateString(match.session);
      
      // Process the match data into our app's game format
      const processedGame = {
        id: `api-match-${index}`, // Generate a unique ID for this match
        date: formattedDate, // Store the formatted date
        displayDate: formattedDate, // Use the formatted date for display
        gameType: isDoubles ? 'doubles' : 'singles',
        apiMatchData: match // Store original API data
      };
      
      if (isDoubles) {
        // Handle doubles match format
        const teamAPlayers = match.team_a.split(',').map(name => name.trim());
        const teamBPlayers = match.team_b.split(',').map(name => name.trim());
        const scoreComponents = match.score.split('-').map(s => parseInt(s.trim()));
        
        processedGame.teamA = {
          player1: { name: teamAPlayers[0] },
          player2: { name: teamAPlayers[1] },
          score: scoreComponents[0]
        };
        
        processedGame.teamB = {
          player1: { name: teamBPlayers[0] },
          player2: { name: teamBPlayers[1] },
          score: scoreComponents[1]
        };
        
        // Determine winning team based on the Winner field or score
        if (match.winner === 'Team A') {
          processedGame.winningTeam = 'teamA';
        } else if (match.winner === 'Team B') {
          processedGame.winningTeam = 'teamB';
        } else {
          // Fallback: determine winner by comparing scores
          processedGame.winningTeam = scoreComponents[0] > scoreComponents[1] ? 'teamA' : 'teamB';
        }
        
        // Add ELO changes
        if (match.elo_change_a !== undefined) {
          processedGame.teamA.player1.ratingChange = match.elo_change_a;
          processedGame.teamA.player2.ratingChange = match.elo_change_a;
        }
        
        if (match.elo_change_b !== undefined) {
          processedGame.teamB.player1.ratingChange = match.elo_change_b;
          processedGame.teamB.player2.ratingChange = match.elo_change_b;
        }
      } else {
        // Handle singles match format
        const scoreComponents = match.score.split('-').map(s => parseInt(s.trim()));
        
        processedGame.winner = {
          name: match.winner === 'Team A' ? match.team_a : match.team_b,
          score: match.winner === 'Team A' ? scoreComponents[0] : scoreComponents[1]
        };
        
        processedGame.loser = {
          name: match.winner === 'Team A' ? match.team_b : match.team_a,
          score: match.winner === 'Team A' ? scoreComponents[1] : scoreComponents[0]
        };
        
        processedGame.winnerId = 'api-' + processedGame.winner.name;
        processedGame.loserId = 'api-' + processedGame.loser.name;
        
        // Add ELO changes
        if (match.winner === 'Team A') {
          processedGame.winnerRatingChange = match.elo_change_a;
          processedGame.loserRatingChange = match.elo_change_b;
        } else {
          processedGame.winnerRatingChange = match.elo_change_b;
          processedGame.loserRatingChange = match.elo_change_a;
        }
      }
      
      return processedGame;
    });
  },
  
  // Format date for display
  formatDate: function(dateString) {
    if (!dateString) return "";
    
    // Check if the dateString is already in a user-friendly format
    if (!/^\d{4}-\d{2}-\d{2}T/.test(dateString)) {
      // If it's already a user-friendly format, return it as is
      return dateString;
    }
    
    const date = new Date(dateString);
    
    const padZero = (num) => {
      return num < 10 ? "0" + num : "" + num;
    };
    
    return date.getFullYear() + "-" + 
           padZero(date.getMonth() + 1) + "-" + 
           padZero(date.getDate()) + " " +
           padZero(date.getHours()) + ":" +
           padZero(date.getMinutes());
  },
  
  // Format API date string from 'YYYYMMDD' to 'YYYY-MM-DD'
  formatAPIDateString: function(dateString) {
    // Convert from '20250101' to '2025-01-01'
    if (dateString && dateString.length === 8) {
      return dateString.substring(0, 4) + '-' + 
             dateString.substring(4, 6) + '-' + 
             dateString.substring(6, 8);
    }
    return dateString;
  },

  // View game details
  viewGameDetails: function(e) {
    const gameId = e.currentTarget.dataset.id;
    const game = this.data.games.find(g => g.id === gameId);
    
    if (game) {
      // Display game details in a modal
      wx.showModal({
        title: 'Game Details',
        content: this.getGameDetailsText(game),
        showCancel: game.id.startsWith('api-') ? false : true, // Only allow deletion for non-API games
        cancelText: 'Delete',
        cancelColor: '#ff0000',
        confirmText: 'Close',
        success: (res) => {
          if (res.cancel && !game.id.startsWith('api-')) {
            // User clicked Delete (only for local games)
            this.confirmGameDeletion(game);
          }
        }
      });
    }
  },
  
  getGameDetailsText: function(game) {
    try {
      // For API-sourced games, format could be slightly different
      if (game.apiMatchData) {
        const match = game.apiMatchData;
        return `Session: ${match.session}\n` +
               `Teams: ${match.team_a} vs ${match.team_b}\n` +
               `Score: ${match.score}\n` +
               `Winner: ${match.winner}\n` +
               `ELO Change A: ${match.elo_change_a || 'N/A'}\n` +
               `ELO Change B: ${match.elo_change_b || 'N/A'}`;
      }
      
      // For doubles game
      if (game.gameType === 'doubles') {
        const winningTeam = game.winningTeam === 'teamA' ? game.teamA : game.teamB;
        const losingTeam = game.winningTeam === 'teamA' ? game.teamB : game.teamA;
        
        if (!winningTeam || !losingTeam) {
          return 'Error: Game data is incomplete';
        }
        
        return `Date: ${this.formatDate(game.date)}\n` +
               `Winners: ${winningTeam.player1?.name || 'Unknown'}, ${winningTeam.player2?.name || 'Unknown'}\n` +
               `Score: ${winningTeam.score || 0}\n\n` +
               `Losers: ${losingTeam.player1?.name || 'Unknown'}, ${losingTeam.player2?.name || 'Unknown'}\n` +
               `Score: ${losingTeam.score || 0}`;
      } 
      // For singles game
      else {
        let winner, loser;
        
        if (game.players && Array.isArray(game.players)) {
          winner = game.players.find(p => p.id === game.winnerId);
          loser = game.players.find(p => p.id === game.loserId);
        } else {
          // Alternative approach if players array isn't available
          winner = game.winner;
          loser = game.loser;
        }
        
        if (!winner || !loser) {
          return 'Error: Game data is incomplete';
        }
        
        return `Date: ${this.formatDate(game.date)}\n` +
               `Winner: ${winner.name || 'Unknown'}\n` +
               `Score: ${winner.score || 0}\n\n` +
               `Loser: ${loser.name || 'Unknown'}\n` +
               `Score: ${loser.score || 0}`;
      }
    } catch (error) {
      console.error('Error generating game details:', error);
      return 'Error generating game details. Check console for more information.';
    }
  },

  // The delete functionality remains unchanged for local games
  // but will not be accessible for API-sourced games
  confirmGameDeletion: function(game) {
    // Skip for API games
    if (game.id.startsWith('api-')) {
      wx.showToast({
        title: 'Cannot delete API matches',
        icon: 'none'
      });
      return;
    }
    
    wx.showModal({
      title: 'Delete Game',
      content: 'Are you sure you want to delete this game record? This will also update player ratings.',
      confirmText: 'Delete',
      confirmColor: '#ff0000',
      cancelText: 'Cancel',
      success: (res) => {
        if (res.confirm) {
          this.deleteGame(game);
        }
      }
    });
  },

  deleteGame: function(game) {
    // Skip for API games
    if (game.id.startsWith('api-')) return;
    
    // 1. Get current games
    const games = wx.getStorageSync('games') || [];
    
    // 2. Filter out the game to delete
    const updatedGames = games.filter(g => g.id !== game.id);
    
    // 3. Save the updated games list
    wx.setStorageSync('games', updatedGames);
    
    // 4. Update player ratings
    this.updatePlayerRatingsAfterDeletion(game);
    
    // 5. Refresh the game history display
    this.loadGameHistory();
    
    // 6. Show success message
    wx.showToast({
      title: 'Game deleted',
      icon: 'success'
    });
  },

  updatePlayerRatingsAfterDeletion: function(game) {
    // Skip for API games
    if (game.id.startsWith('api-')) return;
    
    // The rest of this function remains unchanged
    // Get all players
    const players = wx.getStorageSync('players') || [];
    
    if (game.gameType === 'doubles') {
      // For doubles games - adjust ratings and stats for all 4 players
      const winningTeam = game.winningTeam === 'teamA' ? game.teamA : game.teamB;
      const losingTeam = game.winningTeam === 'teamA' ? game.teamB : game.teamA;
      
      // Collect all player IDs and their rating changes (if stored)
      const winningPlayerIds = [winningTeam.player1.id, winningTeam.player2.id];
      const losingPlayerIds = [losingTeam.player1.id, losingTeam.player2.id];
      
      // Get rating changes if they were stored in the game record
      const winningRatingChanges = {
        [winningTeam.player1.id]: winningTeam.player1.ratingChange || 10,
        [winningTeam.player2.id]: winningTeam.player2.ratingChange || 10
      };
      const losingRatingChanges = {
        [losingTeam.player1.id]: losingTeam.player1.ratingChange || 10,
        [losingTeam.player2.id]: losingTeam.player2.ratingChange || 10
      };
      
      // Adjust player ratings and stats
      const updatedPlayers = players.map(player => {
        if (winningPlayerIds.includes(player.id)) {
          // This player was on the winning team - decrease wins and reverse rating gain
          const ratingChange = winningRatingChanges[player.id] || 10;
          return {
            ...player,
            wins: Math.max(0, (player.wins || 0) - 1),
            matches: Math.max(0, (player.matches || 0) - 1),
            // Reverse the rating gain that happened when the game was recorded
            rating: player.rating - ratingChange
          };
        } else if (losingPlayerIds.includes(player.id)) {
          // This player was on the losing team - decrease losses and reverse rating loss
          const ratingChange = losingRatingChanges[player.id] || 10;
          return {
            ...player,
            losses: Math.max(0, (player.losses || 0) - 1),
            matches: Math.max(0, (player.matches || 0) - 1),
            // Reverse the rating loss that happened when the game was recorded
            rating: player.rating + ratingChange
          };
        }
        return player;
      });
      
      wx.setStorageSync('players', updatedPlayers);
    } else {
      // For singles games - adjust ratings for 2 players
      const winnerId = game.winnerId;
      const loserId = game.loserId;
      
      // Get rating changes if they were stored
      const winnerRatingChange = game.winnerRatingChange || 10;
      const loserRatingChange = game.loserRatingChange || 10;
      
      const updatedPlayers = players.map(player => {
        if (player.id === winnerId) {
          // This player was the winner - decrease wins and reverse rating gain
          return {
            ...player,
            wins: Math.max(0, (player.wins || 0) - 1),
            matches: Math.max(0, (player.matches || 0) - 1),
            rating: player.rating - winnerRatingChange
          };
        } else if (player.id === loserId) {
          // This player was the loser - decrease losses and reverse rating loss
          return {
            ...player,
            losses: Math.max(0, (player.losses || 0) - 1),
            matches: Math.max(0, (player.matches || 0) - 1),
            rating: player.rating + loserRatingChange
          };
        }
        return player;
      });
      
      wx.setStorageSync('players', updatedPlayers);
    }
  }
});