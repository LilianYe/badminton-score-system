// Import utilities with error handling
const util = require('../../utils/generate-match.js');
console.log('Successfully loaded generate-match.js');

Page({
  data: {
    playersInput: '',
    eloThreshold: '100',
    teamEloDiff: '70',
    gamePerPlayer: '4',
    courtCount: '2',
    result: '',
    loading: false,
    fromSignup: false,
    showAdvanced: false, // Toggle for advanced settings
    showPlayerEdit: false, // Toggle for player list editing
    showRawOutput: false, // Toggle for raw debug output
    femaleSet: new Set(), // Track female players
    playerElos: {}, // Track player ELOs
    matchRounds: [], // Structured match data for display
    processedPlayers: [], // Processed player array for rendering
    playerCount: 0, // Count of players
  },
  
  onLoad(options) {
    console.log('Generate Match page loaded', options);
    
    // Check if we're coming from signup page
    if (options && options.fromSignup) {
      this.setData({ fromSignup: true });
      
      // Get players from global data
      const app = getApp();
      if (app.globalData && app.globalData.signupPlayers && app.globalData.signupPlayers.length > 0) {
        const playerList = app.globalData.signupPlayers.join('\n');
        
        // Set up the female player set from signup data
        let femaleSet = new Set();
        if (app.globalData.femalePlayerSet && app.globalData.femalePlayerSet.length > 0) {
          femaleSet = new Set(app.globalData.femalePlayerSet);
          console.log('Loaded female players:', Array.from(femaleSet));
        } else {
          // Fall back to detecting female players by name
          app.globalData.signupPlayers.forEach(name => {
            if (name.includes('(F)')) {
              femaleSet.add(name);
            }
          });
        }
        
        // Get ELO ratings if available
        const playerElos = {};
        if (app.globalData.signupPlayerData && app.globalData.signupPlayerData.length > 0) {
          app.globalData.signupPlayerData.forEach(player => {
            playerElos[player.displayName] = player.elo || app.globalData.defaultElo || 1500;
          });
        }        this.setData({ 
          playersInput: playerList,
          femaleSet: femaleSet,
          playerElos: playerElos,
          // Auto-adjust settings based on player count
          gamePerPlayer: Math.min(Math.floor(14 / app.globalData.signupPlayers.length) * 2, 7).toString(), 
          // Use court count from the selected game, if available
          courtCount: app.globalData.courtCount ? app.globalData.courtCount.toString() : 
                     Math.min(Math.ceil(app.globalData.signupPlayers.length / 4), 3).toString()
        }, () => {
          this.processPlayersInput();
        });
        
        console.log('Loaded players from signup:', playerList);
        
        // Auto-generate if we have at least 4 players
        if (app.globalData.signupPlayers.length >= 4) {
          setTimeout(() => this.onGenerate(), 500);
        }
      } else {
        // If no players found, load example players
        this.loadExamplePlayers();
      }
    } else {
      // Initialize with some example players for testing
      this.loadExamplePlayers();
    }
  },
    loadExamplePlayers() {
    const examplePlayers = "敏敏子(F)\nAcaprice\nliyu\nMax(F)\n张晴川\n方文\n米兰的小铁匠\ngdc\nx1(F)\nx2(F)";
    
    // Set up female players set
    const femaleSet = new Set();
    examplePlayers.split('\n').forEach(name => {
      if (name.includes('(F)')) {
        femaleSet.add(name);
      }
    });
    
    this.setData({ 
      playersInput: examplePlayers,
      femaleSet: femaleSet 
    }, () => {
      this.processPlayersInput();
    });
  },
  
  toggleAdvanced() {
    this.setData({ showAdvanced: !this.data.showAdvanced });
  },
  
  togglePlayerEdit() {
    this.setData({ showPlayerEdit: !this.data.showPlayerEdit });
  },
  
  toggleRawOutput() {
    this.setData({ showRawOutput: !this.data.showRawOutput });
  },
    removePlayer(e) {
    const index = e.currentTarget.dataset.index;
    const players = this.data.playersInput.split('\n');
    const removedPlayer = players[index];
    
    // Update femaleSet if needed
    if (removedPlayer && removedPlayer.includes('(F)')) {
      const femaleSet = this.data.femaleSet;
      femaleSet.delete(removedPlayer);
      this.setData({ femaleSet: femaleSet });
    }
    
    // Remove player from list
    players.splice(index, 1);
    this.setData({ playersInput: players.join('\n') }, () => {
      this.processPlayersInput();
    });
  },
  
  onShow() {
    console.log('Generate Match page shown');
  },
    onPlayersInput(e) {
    this.setData({ playersInput: e.detail.value }, () => {
      this.processPlayersInput();
      
      // Update female players set
      const femaleSet = new Set();
      e.detail.value.split('\n').forEach(name => {
        if (name.includes('(F)')) {
          femaleSet.add(name);
        }
      });
      
      this.setData({ femaleSet: femaleSet });
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
  
  shareMatchResults() {
    wx.showToast({
      title: '分享功能开发中',
      icon: 'none'
    });
  },
  
  regenerateMatches() {
    this.onGenerate();
  },
  
  // Process players from input string to array for rendering
  processPlayersInput() {
    // Split by newlines and filter empty lines
    const playerLines = this.data.playersInput.split('\n');
    const processedPlayers = playerLines
      .map(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return null; // Skip empty lines
        
        return {
          name: trimmedLine,
          isFemale: trimmedLine.includes('(F)')
        };
      })
      .filter(player => player !== null); // Remove null entries

    this.setData({
      processedPlayers: processedPlayers,
      playerCount: processedPlayers.length
    });
  },
  
  onGenerate() {
    this.setData({ 
      loading: true, 
      result: '',
      matchRounds: []
    });
    
    const players = this.data.playersInput.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const eloThreshold = parseInt(this.data.eloThreshold) || 100;
    const teamEloDiff = parseInt(this.data.teamEloDiff) || 70;
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
    
    // Set up player ELOs - use data from signup if available
    const playerElos = this.data.playerElos || {};
    players.forEach(p => {
      if (!playerElos[p]) {
        playerElos[p] = getApp().globalData.defaultElo || 1500;
      }
    });
    
    // Update female players set (in case it wasn't set already)
    const femaleSet = new Set();
    players.forEach(name => {
      if (name.includes('(F)')) {
        femaleSet.add(name);
      }
    });
    this.setData({ femaleSet: femaleSet });
    
    // Use setTimeout to allow the UI to update before starting calculation
    setTimeout(() => {
      try {
        const matchResult = util.tryGenerateRotationFull(players, courtCount, gamePerPlayer, eloThreshold, playerElos, teamEloDiff, 30);
        
        if (!matchResult) {
          this.setData({ 
            result: '生成失败，请调整参数或球员列表', 
            loading: false 
          });
          return;
        }
        
        // Format the raw output for debugging
        let output = '';
        matchResult.roundsLineups.forEach((round, i) => {
          output += `第${i+1}轮：\n`;
          round.forEach((court, j) => {
            output += `  场地${j+1}: ${court.join('，')}\n`;
          });
        });
        output += '\n休息安排：\n';
        matchResult.restSchedule.forEach((rest, i) => {
          output += `第${i+1}轮休息: ${rest.join('，') || '无'}\n`;
        });
        
        // Format the structured match data for display
        const matchRounds = [];
        matchResult.roundsLineups.forEach((round, i) => {
          const courts = [];
          round.forEach(court => {
            // Each court has two teams
            const team1 = court.slice(0, 2);
            const team2 = court.slice(2, 4);
            courts.push([team1, team2]);
          });
          
          matchRounds.push({
            courts: courts,
            rest: matchResult.restSchedule[i] || []
          });
        });
        
        // Save result to global data for potential sharing or history
        getApp().globalData.lastGeneratedMatches = {
          rounds: matchRounds,
          rawOutput: output,
          timestamp: new Date().toISOString()
        };
        
        this.setData({ 
          result: output, 
          matchRounds: matchRounds,
          loading: false 
        });
        
      } catch (e) {
        console.error('生成失败:', e);
        this.setData({ 
          result: '生成失败: ' + e.message, 
          loading: false 
        });
      }
    }, 100);
  },
  
  // Navigate back to signup page
  navigateBack: function() {
    wx.navigateBack({
      delta: 1
    });
  }
});
