// Import utilities with error handling
let util;
try {
  util = require('../../utils/generate-match.js');
  console.log('Successfully loaded generate-match.js');
} catch (error) {
  console.error('Failed to load generate-match.js:', error);
  // Provide a fallback or default implementation if module fails to load
  util = {
    tryGenerateRotationFull: function() {
      console.error('Using fallback generate match function');
      return null;
    }
  };
}

const GameService = require('../../utils/game-service.js');

Page({
  data: {
    playersInput: '',
    eloThreshold: '100',
    teamEloDiff: '300',
    gamePerPlayer: '4',
    courtCount: '2',
    courtDetails: '', // Add this line for court details input (e.g., "2,5")
    maxOpponentFrequency: '4', // Add this line for the new parameter
    maxConsecutiveRounds: '4', // Add this line for the new parameter
    result: '',    
    loading: false,    
    fromSignup: false,
    fromExisting: false, // Flag to track if matches were loaded from existing data
    showAdvanced: false, // Toggle for advanced settings
    showPlayerEdit: false, // Toggle for player list editing
    matchRounds: [], // Structured match data for display
    processedPlayers: [], // Processed player array for rendering
    playerCount: 0, // Count of players,
    matchesSaved: false, // Flag to track if matches have been saved to database
  },    
  
  onLoad(options) {
    console.log('Generate Match page loaded', options);
      // Initialize Cloud DB Service at page load
    try {
      this.CloudDBService = require('../../utils/cloud-db.js');
      if (this.CloudDBService) {
        try {
          this.CloudDBService.ensureInit();
          console.log('Database initialized successfully at page load');
        } catch (error) {
          console.error('Failed to initialize database at page load:', error);
        }
      } else {
        console.error('Failed to load cloud-db.js module');
      }
    } catch (error) {
      console.error('Error requiring cloud-db.js:', error);
    }
      // Check if we're coming from signup page
    if (options && options.fromSignup) {
      const gameId = options.gameId || null;
      
      this.setData({ 
        fromSignup: true,
        gameId: gameId // Store the game ID for session tracking
      });
        // If we have a gameId, check if matches have already been generated
      if (gameId) {
        console.log('Setting gameId in data:', gameId);
        this.checkExistingMatches(gameId);
      }
      
      // Get players from global data
      const app = getApp();
      if (app.globalData && app.globalData.signupPlayers && app.globalData.signupPlayers.length > 0) {        
        const playerList = app.globalData.signupPlayers.join('\n');
        
        if (app.globalData.signupPlayerData && app.globalData.signupPlayerData.length > 0) {
          const femalePlayers = app.globalData.signupPlayerData
            .filter(player => player.gender === 'female')
            .map(player => player.name);
          console.log('Loaded female players:', femalePlayers);
        }
            this.setData({
          playersInput: playerList,
          // Auto-adjust settings based on player count
          gamePerPlayer: Math.min(Math.floor(14 / app.globalData.signupPlayers.length) * 2, 7).toString(), 
          // Use court count from the selected game, if available
          courtCount: app.globalData.courtCount ? app.globalData.courtCount.toString() : 
                     Math.min(Math.ceil(app.globalData.signupPlayers.length / 4), 3).toString()
        }, () => {
          this.processPlayersInput();
        });
          console.log('Loaded players from signup:', playerList);
        
        // No longer auto-generate - let the user review parameters first
        wx.showToast({
          title: '请设置参数后点击生成',
          icon: 'none',
          duration: 2000
        });
      } 
    } 
  },

  
  toggleAdvanced() {
    this.setData({ showAdvanced: !this.data.showAdvanced });
  },
    togglePlayerEdit() {
    this.setData({ showPlayerEdit: !this.data.showPlayerEdit });
  },

  removePlayer(e) {    
        const index = e.currentTarget.dataset.index;
    const players = this.data.playersInput.split('\n');
    const removedPlayer = players[index];
    
    // Remove player from list
    players.splice(index, 1);
    this.setData({ playersInput: players.join('\n') }, () => {
      this.processPlayersInput();
    });
  },
    
  onShow() {
    console.log('Generate Match page shown');
    
    // Check if matches exist for the current game every time the page is shown
    const gameId = this.data.gameId || getApp().globalData.currentGameId;
    if (gameId) {
      console.log('Checking existing matches for game ID:', gameId);
      this.checkExistingMatches(gameId);
    } else {
      console.log('No game ID available to check for existing matches');
    }
  },
  
  onPlayersInput(e) {
    this.setData({ playersInput: e.detail.value }, () => {
      this.processPlayersInput();
    });
  },
  
  onEloThresholdInput(e) {
    this.setData({ eloThreshold: e.detail.value });
  },
  
  onTeamEloDiffInput(e) {
    this.setData({ teamEloDiff: e.detail.value });
  },
  
  onGamePerPlayerInput(e) {
    this.setData({ gamePerPlayer: e.detail.value });
  },
    onCourtCountInput(e) {
    this.setData({ courtCount: e.detail.value });
  },  
  onCourtDetailsInput(e) {
    this.setData({ courtDetails: e.detail.value });
  },
  
  // Add handler for maxOpponentFrequency input
  onMaxOpponentFrequencyInput(e) {
    this.setData({ maxOpponentFrequency: e.detail.value });
  },
  
  // Add handler for maxConsecutiveRounds input
  onMaxConsecutiveRoundsInput(e) {
    this.setData({ maxConsecutiveRounds: e.detail.value });
  },
  
  regenerateMatches() {
    // Ask for confirmation before regenerating
    if (this.data.matchRounds && this.data.matchRounds.length > 0) {
      wx.showModal({
        title: '确认重新生成？',
        content: '重新生成将丢失当前对阵表，确定要继续吗？',
        success: (res) => {
          if (res.confirm) {
            this.onGenerate();
          }
        }
      });
    } else {
      this.onGenerate();
    }
  },
   
  // Process players from input string to array for rendering
  processPlayersInput() {
    // Split by newlines and filter empty lines
    const playerLines = this.data.playersInput.split('\n');
    const app = getApp();
    const playerMap = {};
    
    // Build player map with gender info
    if (app.globalData && app.globalData.signupPlayerData) {
      app.globalData.signupPlayerData.forEach(player => {
        playerMap[player.name] = player;
      });
    }

    const processedPlayers = playerLines
      .map(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return null; // Skip empty lines
        
        // Use player map to determine gender
        const gender = playerMap[trimmedLine]?.gender || 'male';
        return {
          name: trimmedLine,
          gender: gender,
          isFemale: gender === 'female'
        };
      })
      .filter(player => player !== null); // Remove null entries

    this.setData({
      processedPlayers: processedPlayers,
      playerCount: processedPlayers.length
    });
  },    
  
  onGenerate() {
    // Reset saved state whenever generating new matches
    this.setData({ 
      loading: true, 
      result: '',
      matchRounds: [],
      matchesSaved: false
    });
    const players = this.data.playersInput.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const eloThreshold = parseInt(this.data.eloThreshold) || 100;
    const teamEloDiff = parseInt(this.data.teamEloDiff) || 300;
    const gamePerPlayer = parseInt(this.data.gamePerPlayer) || 4;
    const courtCount = parseInt(this.data.courtCount) || 2;
    const maxOpponentFrequency = parseInt(this.data.maxOpponentFrequency) || 4;
    const maxConsecutiveRounds = parseInt(this.data.maxConsecutiveRounds) || 4;
    
    // Process court details (e.g. "2,5" -> [2,5])
    let courtDetails = [];
    if (this.data.courtDetails.trim()) {
      courtDetails = this.data.courtDetails.split(',')
        .map(c => c.trim())
        .filter(c => c)
        .map(c => parseInt(c) || c); // Convert to number if possible, keep string if not
    
      // If courtDetails length doesn't match courtCount, log a warning but continue
      if (courtDetails.length !== courtCount) {
        console.warn(`Court details count (${courtDetails.length}) does not match court count (${courtCount})`);
        // Pad with default values if needed
        while (courtDetails.length < courtCount) {
          courtDetails.push(courtDetails.length + 1);
        }
        // Truncate if too many values provided
        if (courtDetails.length > courtCount) {
          courtDetails = courtDetails.slice(0, courtCount);
        }
      }
    } else {
      // Default court numbers if not specified
      courtDetails = Array.from({length: courtCount}, (_, i) => i + 1);
    }
    
    console.log('Using court details:', courtDetails);
    
    if (!players.length) {
      this.setData({ result: '请填写球员列表', loading: false });
      return;
    }
    
    if (players.length < 4) {
      this.setData({ result: '至少需要4名球员才能生成对阵表', loading: false });
      return;
    }
      
    // Check if database is ready
    try {
      this.CloudDBService.ensureInit();
    } catch (error) {
      console.error('Database not initialized:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: '数据库连接失败',
        icon: 'none',
        duration: 2000
      });
      return;
    }
      
    // Get player data from app.globalData
    const app = getApp();
    const playerMap = {};
    
    // Build player map with gender from signupPlayerData
    if (app.globalData && app.globalData.signupPlayerData) {
      app.globalData.signupPlayerData.forEach(player => {
        playerMap[player.name] = {
          gender: player.gender || 'male',
        };
      });
    }

    // First create player objects with gender
    const playerObjects = players.map(name => ({
      name: name,
      gender: playerMap[name]?.gender || 'male',
      // Use default ELO temporarily
      elo: getApp().globalData.defaultElo || 1500
    }));

    // Store courtDetails in app.globalData for later use
    app.globalData.courtDetails = courtDetails;
    
    // Use CloudDBService to fetch ELO ratings
    this.CloudDBService.fetchPlayerELOs(playerObjects)
      .then(updatedPlayerObjects => {
        console.log('All ELO ratings fetched, generating matches with updated data');
        this.generateMatchesWithUpdatedElo(updatedPlayerObjects, courtCount, gamePerPlayer, eloThreshold, teamEloDiff, maxOpponentFrequency, maxConsecutiveRounds);
      })
      .catch(error => {
        console.error('Error fetching ELO ratings:', error);
        // Fall back to using the data we have
        this.generateMatchesWithUpdatedElo(playerObjects, courtCount, gamePerPlayer, eloThreshold, teamEloDiff, maxOpponentFrequency, maxConsecutiveRounds);
      });
  },
  
  // New method to generate matches after ELO data is updated
  generateMatchesWithUpdatedElo(playerObjects, courtCount, gamePerPlayer, eloThreshold, teamEloDiff, maxOpponentFrequency, maxConsecutiveRounds) {
    // Log the player ELO data for debugging
    console.log('Generating matches with updated ELO data:');
    playerObjects.forEach(player => {
      console.log(`${player.name}: ELO=${player.elo}, Gender=${player.gender}`);
    });
    
    // Use setTimeout to allow the UI to update before starting calculation
    setTimeout(() => {
      try {
        const matchResult = util.tryGenerateRotationFull(playerObjects, courtCount, gamePerPlayer, eloThreshold, teamEloDiff, maxOpponentFrequency, maxConsecutiveRounds);
        if (!matchResult) {
          this.setData({ 
            loading: false 
          });
          
          wx.showToast({
            title: '生成失败，请调整参数或球员列表',
            icon: 'none',
            duration: 2000
          });
          return;
        }
        
        // Format the structured match data for display
        const matchRounds = [];
        const app = getApp();
        // Use provided courtDetails parameter instead of accessing from app.globalData
        const courtDetails = app.globalData.courtDetails || Array.from({length: courtCount}, (_, i) => i + 1);

        matchResult.roundsLineups.forEach((round, i) => {
          const courts = [];
          round.forEach((court, courtIndex) => {
            // Each court has two teams
            // Extract just the player names for display
            const team1 = court.slice(0, 2).map(player => typeof player === 'object' ? player.name : player);
            const team2 = court.slice(2, 4).map(player => typeof player === 'object' ? player.name : player);
            
            // Use court number from courtDetails
            const courtId = courtDetails[courtIndex];
            
            courts.push({
              teams: [team1, team2],
              courtId: courtId
            });
          });
          
          // Also ensure rest players are displayed by name only
          const restPlayers = (matchResult.restSchedule[i] || []).map(player => 
            typeof player === 'object' ? player.name : player
          );
          
          matchRounds.push({
            courts: courts,
            rest: restPlayers
          });
        });
        
        // Save result to global data for potential sharing or history
        app.globalData.lastGeneratedMatches = {
          rounds: matchRounds,
          timestamp: new Date().toISOString()
        };
        
        // Store player objects with updated ELO in global data for later use
        app.globalData.currentPlayerObjects = playerObjects;
        
        this.setData({ 
          matchRounds: matchRounds,
          loading: false 
        });
        
      } catch (e) {
        console.error('生成失败:', e);
        this.setData({ 
          loading: false 
        });
        wx.showToast({
          title: '生成失败: ' + e.message,
          icon: 'none',
          duration: 2000
        });
      }
    }, 100);
  },

  async confirmAndSaveMatches() {
    if (this.data.loading || this.data.matchesSaved || !this.data.matchRounds.length) {
      return;
    }      
    this.setData({ loading: true });
    
    const app = getApp();
    
    // Ensure the database is initialized
    try {
      this.CloudDBService.ensureInit();
    } catch (error) {
      console.error('Database not initialized:', error);
      
      wx.showModal({
        title: '数据库连接失败',
        content: '无法连接到数据库，是否重试？',
        success: (res) => {
          if (res.confirm) {
            // Try to reinitialize
            try {
              // Reinitialize
              this.CloudDBService.init();
              // Continue with saving if successful
              setTimeout(() => this.confirmAndSaveMatches(), 500);
            } catch (retryError) {
              wx.showToast({
                title: '连接失败，请稍后再试',
                icon: 'none',
                duration: 2000
              });
              this.setData({ loading: false });
            }
          } else {
            this.setData({ loading: false });
          }
        }
      });
      return;
    }
    
    // Use the game ID as the session ID for this batch of matches
    // Reuse the app instance we already have
    const gameId = this.data.gameId || app.globalData.currentGameId;
    
    if (!gameId) {
      wx.showModal({
        title: '错误',
        content: '找不到游戏ID，无法保存比赛',
        showCancel: false,
        success: () => {
          this.setData({ loading: false });
        }
      });
      return;
    }
    
    console.log('Using game ID as session ID:', gameId);
    
    try {
      // Get the game first to check its status
      const game = await this.CloudDBService.getGameById(gameId);
      
      // Check if the game already has matches generated
      if (game && game.matchGenerated) {
        console.log('Deleting generated matches before saving new ones');
        await this.CloudDBService.deleteMatchesForGame(gameId);
        
        // Update game in database to reset status
        console.log('Resetting game status');
        await this.CloudDBService.updateGame(gameId, {
          status: 'active',
          matchGenerated: false
        });
    }

    // Use CloudDBService to create match data
    this.CloudDBService.createMatchData(
      this.data.matchRounds, 
      gameId, 
      app.globalData.currentPlayerObjects,
      app.globalData.courtDetails // Add court details
    )
      .then(result => {
        const matchDataArray = result.matchDataArray;
        
        // Save matches to database
        return GameService.saveMatches(gameId, matchDataArray);
      })
      .then(updatedGame => {
        console.log('Matches saved successfully to game:', updatedGame);
        
        this.setData({ 
          matchesSaved: true,
          loading: false 
        });
        
        wx.showToast({
          title: '比赛已保存',
          icon: 'success',
          duration: 2000
        });
      })
      .catch(error => {
        console.error('Failed to create or save match data:', error);
        this.setData({ loading: false });
        
        wx.showToast({
          title: '创建比赛数据失败',
          icon: 'none',
          duration: 2000
        });
      });
    } catch (error) {
      console.error('Error in confirmAndSaveMatches:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: '保存比赛时发生错误',
        icon: 'none',
        duration: 2000
      });
    }
  },
    
  // Check if the game already has generated matches
  checkExistingMatches(gameId) {
    if (!gameId) return;
    
    // If matches are already loaded or saved, don't check again
    if (this.data.matchRounds && this.data.matchRounds.length > 0) {
      console.log('Matches already loaded, skipping check');
      return;
    }
    
    this.setData({ loading: true });
    
    // First, get the game to check if matches are generated
    this.CloudDBService.getGameById(gameId)
      .then(game => {
        if (game && game.matchGenerated) {
          console.log('This game already has generated matches: ', gameId);
          // Directly load existing matches without showing a modal
          this.loadExistingMatches(gameId);
        } else {
          // No matches generated yet, continue as normal
          this.setData({ loading: false });
        }
      })
      .catch(error => {
        console.error('Failed to check if game has matches:', error);
        this.setData({ loading: false });
      });
  },
  
  // Load existing matches for a game
  loadExistingMatches(gameId) {
    this.CloudDBService.getMatchesForGame(gameId)
      .then(matches => {
        if (matches && matches.length > 0) {
          console.log('Loaded existing matches:', matches);
            // Process matches into same format as match generation
          // Group matches by round
          const roundsMap = {};
          const courtDetailsSet = new Set();
          matches.forEach(match => {
            const round = match.Round;
            if (!roundsMap[round]) {
              roundsMap[round] = {
                courts: []
              };
            }
            
            // Add this match to the appropriate round
            // Check if we have full player objects
            let team1, team2;
            if (match.PlayerA1 && typeof match.PlayerA1 === 'object') {
              // We have full player objects
              team1 = [match.PlayerA1, match.PlayerA2];
              team2 = [match.PlayerB1, match.PlayerB2];
            } 
            
            const courtId = match.Court;
            courtDetailsSet.add(courtId);
            roundsMap[round].courts.push({
              teams: [team1, team2],
              courtId: courtId
            });
          });
          
          // Convert map to array similar to our matchRounds structure
          const matchRounds = Object.keys(roundsMap).map(roundNum => {
            return {
              courts: roundsMap[roundNum].courts,
              rest: [] // We don't have rest info from saved matches
            };
          });
          
          // Save court details to app.globalData
          const courtDetails = Array.from(courtDetailsSet).sort((a, b) => a - b);
          const app = getApp();
          app.globalData.courtDetails = courtDetails;

          // Update our data with the loaded matches
          this.setData({
            matchRounds: matchRounds,
            matchesSaved: true, // Mark as saved since they are already in DB
            loading: false,
            fromExisting: true, // Flag to indicate these are existing matches
            courtDetails: courtDetails.join(',')
          });
          
          // Also retrieve players' ELO from the matches
          const playerMap = {};
          matches.forEach(match => {
            // Check if we have full player objects or just names and ELOs
            if (match.PlayerA1 && typeof match.PlayerA1 === 'object') {
              // We have full player objects
              playerMap[match.PlayerA1.name] = match.PlayerA1;
              playerMap[match.PlayerA2.name] = match.PlayerA2;
              playerMap[match.PlayerB1.name] = match.PlayerB1;
              playerMap[match.PlayerB2.name] = match.PlayerB2;
            }
          });
          
          // Convert map to array for global data
          const playerObjects = Object.values(playerMap);
          getApp().globalData.currentPlayerObjects = playerObjects;
          
          // Show a toast to confirm matches were loaded
          wx.showToast({
            title: '已加载保存的比赛',
            icon: 'success',
            duration: 2000
          });
        } else {
          console.log('No existing matches found');
          this.setData({ loading: false });
          
          wx.showToast({
            title: '没有找到比赛数据',
            icon: 'none',
            duration: 2000
          });
        }
      })
      .catch(error => {
        console.error('Failed to load existing matches:', error);
        this.setData({ loading: false });
        
        wx.showToast({
          title: '加载比赛数据失败',
          icon: 'none',
          duration: 2000
        });
      });
  },
    
  // Navigate back to signup page
  navigateBack: function() {
    wx.navigateBack({
      delta: 1
    });
  }
});

// Note: In WeChat Mini Program, no need to explicitly export the Page
