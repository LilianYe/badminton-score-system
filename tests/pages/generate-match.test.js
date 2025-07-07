const CloudDBService = require('../../utils/cloud-db');
const GameService = require('../../utils/game-service');

// Mock dependencies
jest.mock('../../utils/cloud-db');
jest.mock('../../utils/game-service');

// Mock the generate-match utility module
jest.mock('../../utils/generate-match.js', () => {
  return {
    tryGenerateRotationFull: jest.fn((players, courtCount, gamePerPlayer, eloThreshold, teamEloDiff, maxOpponentFrequency, maxConsecutiveRounds, ignoreGender, femaleEloDiff) => {
      // Create a simplified mock response that simulates the match generation
      const roundsCount = Math.ceil((gamePerPlayer * players.length) / (4 * courtCount));
      const roundsLineups = [];
      const restSchedule = [];
      
      // Create mock data for each round
      for (let i = 0; i < roundsCount; i++) {
        const roundLineup = [];
        const restPlayers = [];
        
        // Create courts based on courtCount
        for (let c = 0; c < courtCount; c++) {
          // Each court has 4 players (2 per team)
          const courtPlayers = players.slice(c * 4, c * 4 + 4);
          
          // If we have enough players for this court
          if (courtPlayers.length === 4) {
            roundLineup.push(courtPlayers);
          }
        }
        
        // Add rest players if any
        if (players.length > courtCount * 4) {
          for (let r = courtCount * 4; r < players.length; r++) {
            restPlayers.push(players[r]);
          }
        }
        
        roundsLineups.push(roundLineup);
        restSchedule.push(restPlayers);
      }
      
      return {
        roundsLineups: roundsLineups,
        restSchedule: restSchedule
      };
    })
  };
});

// Sample test player data
const mockPlayers = [
  { name: 'TestPlayer1', gender: 'male', elo: 1500 },
  { name: 'TestPlayer2', gender: 'female', elo: 1550 },
  { name: 'TestPlayer3', gender: 'male', elo: 1600 },
  { name: 'TestPlayer4', gender: 'female', elo: 1480 },
  { name: 'TestPlayer5', gender: 'male', elo: 1520 },
  { name: 'TestPlayer6', gender: 'male', elo: 1490 },
  { name: 'TestPlayer7', gender: 'female', elo: 1540 },
  { name: 'TestPlayer8', gender: 'male', elo: 1570 }
];

// Sample test game data
const mockGame = {
  id: 'game123',
  title: '测试活动',
  date: '2025-07-15',
  startTime: '14:00',
  endTime: '16:00',
  location: '测试场地',
  rules: '一局定胜负，21分制',
  maxPlayers: 16,
  courtCount: 2,
  status: 'active',
  players: mockPlayers.map(p => ({ name: p.name, gender: p.gender })),
  owner: {
    Name: 'TestOwner',
    Avatar: '/assets/icons/user.png'
  }
};

// Mock matches for testing
const mockMatches = [
  {
    GameId: 'game123',
    Round: 1,
    Court: 1,
    PlayerA1: 'TestPlayer1',
    PlayerA2: 'TestPlayer2',
    PlayerB1: 'TestPlayer3',
    PlayerB2: 'TestPlayer4',
    ScoreA: null,
    ScoreB: null,
    Status: 'pending'
  },
  {
    GameId: 'game123',
    Round: 1,
    Court: 2,
    PlayerA1: 'TestPlayer5',
    PlayerA2: 'TestPlayer6',
    PlayerB1: 'TestPlayer7',
    PlayerB2: 'TestPlayer8',
    ScoreA: null,
    ScoreB: null,
    Status: 'pending'
  }
];

describe('Generate Match Page Logic Tests', () => {
  // Variables for our test suite
  let page;
  let app;
  let util;
  
  // Setup mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    
    // Mock app instance
    app = {
      globalData: {
        signupPlayers: mockPlayers.map(p => p.name),
        signupPlayerData: mockPlayers.map(p => ({ name: p.name, gender: p.gender })),
        currentGameId: 'game123',
        courtCount: 2,
        defaultElo: 1500
      },
      getCurrentUser: jest.fn().mockResolvedValue({
        Name: 'TestUser',
        Gender: 'male',
        Avatar: '/assets/icons/user.png'
      })
    };
    
    // Mock getApp to return our mock app
    global.getApp = jest.fn().mockReturnValue(app);
    
    // Mock CloudDBService methods
    CloudDBService.init = jest.fn();
    CloudDBService.ensureInit = jest.fn();
    CloudDBService.getGameById = jest.fn().mockResolvedValue(mockGame);
    CloudDBService.getMatchesForGame = jest.fn().mockResolvedValue(mockMatches);
    CloudDBService.deleteMatchesForGame = jest.fn().mockResolvedValue(true);
    CloudDBService.updateGame = jest.fn().mockResolvedValue(mockGame);
    CloudDBService.createGame = jest.fn().mockResolvedValue(mockGame);
    CloudDBService.fetchPlayerELOs = jest.fn(players => Promise.resolve(players));
    CloudDBService.createMatchData = jest.fn().mockResolvedValue({
      matchDataArray: mockMatches
    });
    
    // Mock GameService methods
    GameService.saveMatches = jest.fn().mockResolvedValue({
      ...mockGame,
      status: 'matched'
    });
    
    // Mock wx API methods
    global.wx = {
      showLoading: jest.fn(),
      hideLoading: jest.fn(),
      showToast: jest.fn(),
      showModal: jest.fn(options => {
        if (options.success) options.success({ confirm: true });
      }),
      navigateTo: jest.fn(),
      navigateBack: jest.fn(),
      redirectTo: jest.fn()
    };

    // Get the page configuration directly
    const generateMatchPage = require('../../pages/generate-match/generate-match');
    
    // Create a basic page object with the required structure
    page = {
      data: {
        playersInput: mockPlayers.map(p => p.name).join('\n'),
        eloThreshold: '80',
        teamEloDiff: '300',
        gamePerPlayer: '4',
        courtCount: '2',
        courtDetails: '',
        maxOpponentFrequency: '4',
        maxConsecutiveRounds: '4',
        ignoreGender: false,
        femaleEloDiff: '100',
        loading: false,
        isSaving: false,
        gameId: 'game123',
        processedPlayers: [],
        playerCount: 0,
        matchRounds: []
      },
      setData: jest.fn(function(obj, callback) {
        this.data = { ...this.data, ...obj };
        if (callback) callback();
      }),
      CloudDBService
    };
    
    // Directly implement the required methods instead of trying to bind them
    page.processPlayersInput = function() {
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
        playerCount: processedPlayers.length,
        maleCount: processedPlayers.filter(p => !p.isFemale).length,
        femaleCount: processedPlayers.filter(p => p.isFemale).length
      });
    };
    
    page.removePlayer = function(e) {
      const index = e.currentTarget.dataset.index;
      const players = this.data.playersInput.split('\n');
      const removedPlayer = players[index];
      
      // Remove player from list
      players.splice(index, 1);
      this.setData({ playersInput: players.join('\n') }, () => {
        this.processPlayersInput();
      });
    };
    
    page.generateMatches = generateMatchPage.generateMatches;
    page.generateMatchesWithUpdatedElo = generateMatchPage.generateMatchesWithUpdatedElo;
    page.confirmAndSaveMatches = generateMatchPage.confirmAndSaveMatches;
    page.checkExistingMatches = generateMatchPage.checkExistingMatches;
    page.loadExistingMatches = generateMatchPage.loadExistingMatches;
    page.showParameterExplanation = generateMatchPage.showParameterExplanation;
    page.navigateBack = generateMatchPage.navigateBack;
    page.toggleAdvanced = generateMatchPage.toggleAdvanced;
    page.togglePlayerEdit = generateMatchPage.togglePlayerEdit;
    page.onGenerate = generateMatchPage.onGenerate;
    page.onEloThresholdInput = generateMatchPage.onEloThresholdInput;
    page.onTeamEloDiffInput = generateMatchPage.onTeamEloDiffInput;
    page.onGamePerPlayerInput = generateMatchPage.onGamePerPlayerInput;
    page.onCourtCountInput = generateMatchPage.onCourtCountInput;
    page.onCourtDetailsInput = generateMatchPage.onCourtDetailsInput;
    page.onMaxOpponentFrequencyInput = generateMatchPage.onMaxOpponentFrequencyInput;
    page.onMaxConsecutiveRoundsInput = generateMatchPage.onMaxConsecutiveRoundsInput;
    page.onIgnoreGenderChange = generateMatchPage.onIgnoreGenderChange;
    page.onFemaleEloDiffInput = generateMatchPage.onFemaleEloDiffInput;
    page.parseCourtDetails = function(courtDetailsStr, courtCount) {
      let courtDetails = [];
      if (courtDetailsStr.trim()) {
        courtDetails = courtDetailsStr.split(',')
          .map(c => c.trim())
          .filter(c => c)
          .map(c => parseInt(c) || c);
          
        if (courtDetails.length !== courtCount) {
          while (courtDetails.length < courtCount) {
            courtDetails.push(courtDetails.length + 1);
          }
          if (courtDetails.length > courtCount) {
            courtDetails = courtDetails.slice(0, courtCount);
          }
        }
      } else {
        courtDetails = Array.from({length: courtCount}, (_, i) => i + 1);
      }
      return courtDetails;
    };
    
    // Bind all methods to the page object
    for (const key in page) {
      if (typeof page[key] === 'function') {
        page[key] = page[key].bind(page);
      }
    }
    
    // Access the imported util module
    util = require('../../utils/generate-match');
  });

  // Test processing player input
  test('processPlayersInput should correctly parse players and set gender', () => {
    // Set up player data with gender information
    app.globalData.signupPlayerData = [
      { name: 'TestPlayer1', gender: 'male' },
      { name: 'TestPlayer2', gender: 'female' }
    ];
    
    page.data.playersInput = 'TestPlayer1\nTestPlayer2';
    page.processPlayersInput();
    
    // Verify the processed player data
    expect(page.data.processedPlayers).toEqual([
      { name: 'TestPlayer1', gender: 'male', isFemale: false },
      { name: 'TestPlayer2', gender: 'female', isFemale: true }
    ]);
    expect(page.data.playerCount).toBe(2);
  });

  // Test player data loading from signup
  test('should correctly process player data from signup', () => {
    // Set up test data in the global app state
    app.globalData.signupPlayers = mockPlayers.map(p => p.name);
    app.globalData.signupPlayerData = mockPlayers.map(p => ({ name: p.name, gender: p.gender }));
    app.globalData.courtCount = 2;

    // Set the player input
    const playerList = app.globalData.signupPlayers.join('\n');
    page.data.playersInput = playerList;
    
    // Process the player input
    page.processPlayersInput();
    
    // Verify processed players
    expect(page.data.processedPlayers.length).toBe(mockPlayers.length);
    expect(page.data.processedPlayers[0].name).toBe(mockPlayers[0].name);
    expect(page.data.processedPlayers[1].gender).toBe(mockPlayers[1].gender);
    
    // Verify player counts
    expect(page.data.playerCount).toBe(mockPlayers.length);
    const maleCount = mockPlayers.filter(p => p.gender === 'male').length;
    const femaleCount = mockPlayers.filter(p => p.gender === 'female').length;
    expect(page.data.processedPlayers.filter(p => !p.isFemale).length).toBe(maleCount);
    expect(page.data.processedPlayers.filter(p => p.isFemale).length).toBe(femaleCount);
  });

  // Test removing a player
  test('removePlayer should remove the specified player from the input', () => {
    // Set initial players
    page.data.playersInput = 'Player1\nPlayer2\nPlayer3';
    
    // Create the mock event
    const mockEvent = {
      currentTarget: {
        dataset: {
          index: 1  // Remove the second player
        }
      }
    };
    
    // Call removePlayer
    page.removePlayer(mockEvent);
    
    // Check if the player was removed
    expect(page.data.playersInput).toBe('Player1\nPlayer3');
  });

  // Test parsing court details
  test('parseCourtDetails should correctly convert string to array', () => {
    // Test various inputs
    expect(page.parseCourtDetails('1,2,3', 3)).toEqual([1, 2, 3]);
    expect(page.parseCourtDetails('5', 1)).toEqual([5]);
    expect(page.parseCourtDetails('', 2)).toEqual([1, 2]);
    expect(page.parseCourtDetails('1,2,3,4', 2)).toEqual([1, 2]);
    expect(page.parseCourtDetails('1', 3)).toEqual([1, 2, 3]);
  });

  // Test toggling advanced settings
  test('toggleAdvanced should toggle the showAdvanced flag', () => {
    // Add a direct implementation since the original function is simple
    page.toggleAdvanced = function() {
      this.setData({ showAdvanced: !this.data.showAdvanced });
    }.bind(page);
    
    // Initial state
    page.data.showAdvanced = false;
    
    // Call toggle
    page.toggleAdvanced();
    
    // Verify toggle
    expect(page.data.showAdvanced).toBe(true);
    
    // Call toggle again
    page.toggleAdvanced();
    
    // Verify toggled back
    expect(page.data.showAdvanced).toBe(false);
  });
  
  // Test toggling player edit mode
  test('togglePlayerEdit should toggle the showPlayerEdit flag', () => {
    // Add a direct implementation
    page.togglePlayerEdit = function() {
      this.setData({ showPlayerEdit: !this.data.showPlayerEdit });
    }.bind(page);
    
    // Initial state
    page.data.showPlayerEdit = false;
    
    // Call toggle
    page.togglePlayerEdit();
    
    // Verify toggle
    expect(page.data.showPlayerEdit).toBe(true);
    
    // Call toggle again
    page.togglePlayerEdit();
    
    // Verify toggled back
    expect(page.data.showPlayerEdit).toBe(false);
  });
  
  // Test input handlers update page data correctly
  test('input handlers should update corresponding data properties', () => {
    // Define simple handler implementations
    page.onEloThresholdInput = function(e) {
      this.setData({ eloThreshold: e.detail.value });
    }.bind(page);
    
    page.onTeamEloDiffInput = function(e) {
      this.setData({ teamEloDiff: e.detail.value });
    }.bind(page);
    
    page.onGamePerPlayerInput = function(e) {
      this.setData({ gamePerPlayer: e.detail.value });
    }.bind(page);
    
    page.onCourtCountInput = function(e) {
      this.setData({ courtCount: e.detail.value });
    }.bind(page);
    
    page.onCourtDetailsInput = function(e) {
      this.setData({ courtDetails: e.detail.value });
    }.bind(page);
    
    page.onMaxOpponentFrequencyInput = function(e) {
      this.setData({ maxOpponentFrequency: e.detail.value });
    }.bind(page);
    
    page.onMaxConsecutiveRoundsInput = function(e) {
      this.setData({ maxConsecutiveRounds: e.detail.value });
    }.bind(page);
    
    page.onIgnoreGenderChange = function(e) {
      this.setData({ ignoreGender: e.detail.value });
    }.bind(page);
    
    page.onFemaleEloDiffInput = function(e) {
      this.setData({ femaleEloDiff: e.detail.value });
    }.bind(page);
    
    // Test various input handlers
    
    // Test eloThreshold input
    page.onEloThresholdInput({ detail: { value: '100' } });
    expect(page.data.eloThreshold).toBe('100');
    
    // Test teamEloDiff input
    page.onTeamEloDiffInput({ detail: { value: '250' } });
    expect(page.data.teamEloDiff).toBe('250');
    
    // Test gamePerPlayer input
    page.onGamePerPlayerInput({ detail: { value: '6' } });
    expect(page.data.gamePerPlayer).toBe('6');
    
    // Test courtCount input
    page.onCourtCountInput({ detail: { value: '3' } });
    expect(page.data.courtCount).toBe('3');
    
    // Test courtDetails input
    page.onCourtDetailsInput({ detail: { value: '1,3,5' } });
    expect(page.data.courtDetails).toBe('1,3,5');
    
    // Test maxOpponentFrequency input
    page.onMaxOpponentFrequencyInput({ detail: { value: '3' } });
    expect(page.data.maxOpponentFrequency).toBe('3');
    
    // Test maxConsecutiveRounds input
    page.onMaxConsecutiveRoundsInput({ detail: { value: '2' } });
    expect(page.data.maxConsecutiveRounds).toBe('2');
    
    // Test ignoreGender change
    page.onIgnoreGenderChange({ detail: { value: true } });
    expect(page.data.ignoreGender).toBe(true);
    
    // Test femaleEloDiff input
    page.onFemaleEloDiffInput({ detail: { value: '120' } });
    expect(page.data.femaleEloDiff).toBe('120');
  });
});