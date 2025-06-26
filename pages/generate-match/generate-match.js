// Import utilities with error handling
const util = require('../../utils/generate-match.js');
console.log('Successfully loaded generate-match.js');

Page({
  data: {
    playersInput: '',
    eloThreshold: '100',
    teamEloDiff: '300',
    gamePerPlayer: '4',
    courtCount: '2',
    result: '',    
    loading: false,
    fromSignup: false,    
    showAdvanced: false, // Toggle for advanced settings
    showPlayerEdit: false, // Toggle for player list editing
    matchRounds: [], // Structured match data for display
    processedPlayers: [], // Processed player array for rendering
    playerCount: 0, // Count of players,
    matchesSaved: false, // Flag to track if matches have been saved to database
  },    onLoad(options) {
    console.log('Generate Match page loaded', options);
    
    // Initialize Cloud DB Service at page load
    this.CloudDBService = require('../../utils/cloud-db.js');
    try {
      this.CloudDBService.ensureInit();
      console.log('Database initialized successfully at page load');
    } catch (error) {
      console.error('Failed to initialize database at page load:', error);
    }
    
    // Check if we're coming from signup page
    if (options && options.fromSignup) {
      this.setData({ 
        fromSignup: true,
        gameId: options.gameId || null // Store the game ID for session tracking
      });
      
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
  },  onPlayersInput(e) {
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
  regenerateMatches() {
    // Don't allow regeneration if matches have been saved
    if (this.data.matchesSaved) {
      wx.showToast({
        title: '对阵已保存，不能重新生成',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
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
  },    onGenerate() {
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
          openid: player.openid || null,
          // Will fetch ELO from UserPerformance DB
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
      // Use CloudDBService to fetch ELO ratings
    this.CloudDBService.fetchPlayerELOs(playerObjects)
      .then(updatedPlayerObjects => {
        console.log('All ELO ratings fetched, generating matches with updated data');
        this.generateMatchesWithUpdatedElo(updatedPlayerObjects, courtCount, gamePerPlayer, eloThreshold, teamEloDiff);
      })
      .catch(error => {
        console.error('Error fetching ELO ratings:', error);
        // Fall back to using the data we have
        this.generateMatchesWithUpdatedElo(playerObjects, courtCount, gamePerPlayer, eloThreshold, teamEloDiff);
      });
  },
  
  // New method to generate matches after ELO data is updated
  generateMatchesWithUpdatedElo(playerObjects, courtCount, gamePerPlayer, eloThreshold, teamEloDiff) {
    // Log the player ELO data for debugging
    console.log('Generating matches with updated ELO data:');
    playerObjects.forEach(player => {
      console.log(`${player.name}: ELO=${player.elo}, Gender=${player.gender}`);
    });
    
    // Use setTimeout to allow the UI to update before starting calculation
    setTimeout(() => {
      try {
        const matchResult = util.tryGenerateRotationFull(playerObjects, courtCount, gamePerPlayer, eloThreshold, teamEloDiff, 1);
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
        matchResult.roundsLineups.forEach((round, i) => {
          const courts = [];
          round.forEach(court => {
            // Each court has two teams
            // Extract just the player names for display
            const team1 = court.slice(0, 2).map(player => typeof player === 'object' ? player.name : player);
            const team2 = court.slice(2, 4).map(player => typeof player === 'object' ? player.name : player);
            courts.push([team1, team2]);
          });
          
          // Also ensure rest players are displayed by name only
          const restPlayers = (matchResult.restSchedule[i] || []).map(player => 
            typeof player === 'object' ? player.name : player
          );
          
          matchRounds.push({
            courts: courts,
            rest: restPlayers
          });
        });        // Save result to global data for potential sharing or history
        const app = getApp();
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
    confirmAndSaveMatches() {
    if (this.data.loading || this.data.matchesSaved || !this.data.matchRounds.length) {
      return;
    }      this.setData({ loading: true });
    
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
    }// Use the game ID as the session ID for this batch of matches
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
      // Use CloudDBService to create match data
    let matchDataArray, sessionId;
    try {
      const result = this.CloudDBService.createMatchData(
        this.data.matchRounds, 
        gameId, 
        app.globalData.currentPlayerObjects
      );
      
      matchDataArray = result.matchDataArray;
      sessionId = result.sessionId;
    } catch (error) {
      console.error('Failed to create match data:', error);
      wx.showToast({
        title: '创建比赛数据失败',
        icon: 'none',
        duration: 2000
      });
      this.setData({ loading: false });
      return;
    }
    
    // Save matches to database
    try {
      this.CloudDBService.saveGeneratedMatches(matchDataArray, sessionId)
        .then(results => {
          console.log('Matches saved successfully:', results);
          
          // Check if all were successful
          const allSuccess = results.every(result => result.success);
          
          if (allSuccess) {
            this.setData({ 
              matchesSaved: true,
              loading: false 
            });
            
            wx.showToast({
              title: '比赛已保存',
              icon: 'success',
              duration: 2000
            });
            
            // Save session ID to global data for future reference
            app.globalData.currentSessionId = sessionId;
          } else {
            throw new Error('Some matches failed to save');
          }
        })
        .catch(error => {
          console.error('Failed to save matches:', error);
          this.setData({ loading: false });
          
          wx.showModal({
            title: '保存失败',
            content: '是否重试保存？',
            success: (res) => {
              if (res.confirm) {
                // Try again
                setTimeout(() => this.confirmAndSaveMatches(), 500);
              }
            }
          });
        });
    } catch (error) {
      console.error('Exception when trying to save matches:', error);
      this.setData({ loading: false });
      
      wx.showToast({
        title: '保存失败，请检查网络连接',
        icon: 'none',
        duration: 2000
      });
    }
  },
  
  // Navigate back to signup page
  navigateBack: function() {
    wx.navigateBack({
      delta: 1
    });
  }
});
