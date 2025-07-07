const CloudDBService = require('../../utils/cloud-db');
const UserService = require('../../utils/user-service');
const MatchService = require('../../utils/match-service');

// Mock dependencies
jest.mock('../../utils/cloud-db');
jest.mock('../../utils/user-service');
jest.mock('../../utils/match-service');

// Sample test match data
const mockMatches = [
  {
    _id: 'match1',
    MatchId: 'match-id-1',
    GameId: 'game123',
    Round: 1,
    Court: 1,
    PlayerA1: 'TestPlayer1',
    PlayerA2: 'TestPlayer2',
    PlayerB1: 'TestPlayer3',
    PlayerB2: 'TestPlayer4',
    ScoreA: 21,
    ScoreB: 15,
    CompleteTime: '2025-07-05T10:30:00Z',
    Status: 'completed'
  },
  {
    _id: 'match2',
    MatchId: 'match-id-2',
    GameId: 'game123',
    Round: 1,
    Court: 2,
    PlayerA1: 'TestPlayer5',
    PlayerA2: 'TestPlayer6',
    PlayerB1: 'TestPlayer7',
    PlayerB2: 'TestPlayer8',
    ScoreA: null,
    ScoreB: null,
    CompleteTime: null,
    Status: 'pending'
  },
  {
    _id: 'match3',
    MatchId: 'match-id-3',
    GameId: 'game123',
    Round: 2,
    Court: 1,
    PlayerA1: 'TestPlayer1',
    PlayerA2: 'TestPlayer3',
    PlayerB1: 'TestPlayer5',
    PlayerB2: 'TestPlayer7',
    ScoreA: 21,
    ScoreB: 18,
    CompleteTime: '2025-07-05T11:00:00Z',
    Status: 'completed'
  },
  {
    _id: 'match4',
    MatchId: 'match-id-4',
    GameId: 'game123',
    Round: 2,
    Court: 2,
    PlayerA1: 'TestPlayer2',
    PlayerA2: 'TestPlayer4',
    PlayerB1: 'TestPlayer6',
    PlayerB2: 'TestPlayer8',
    ScoreA: null,
    ScoreB: null,
    CompleteTime: null,
    Status: 'pending'
  }
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
  status: 'matched', // Game with matches generated
  players: [
    { name: 'TestPlayer1', gender: 'male' },
    { name: 'TestPlayer2', gender: 'female' },
    { name: 'TestPlayer3', gender: 'male' },
    { name: 'TestPlayer4', gender: 'female' },
    { name: 'TestPlayer5', gender: 'male' },
    { name: 'TestPlayer6', gender: 'male' },
    { name: 'TestPlayer7', gender: 'female' },
    { name: 'TestPlayer8', gender: 'male' }
  ],
  owner: {
    Name: 'TestOwner',
    Avatar: '/assets/icons/user.png'
  }
};

// Sample game in playing status
const mockPlayingGame = {
  ...mockGame,
  status: 'playing'
};

describe('My Match Page Tests', () => {
  // Variables for our test suite
  let page;
  let app;
  
  // Setup mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock app instance
    app = {
      globalData: {},
      getCurrentUser: jest.fn().mockResolvedValue({
        Name: 'TestUser',
        Gender: 'male',
        Avatar: '/assets/icons/user.png'
      })
    };
    
    // Mock getApp to return our mock app
    global.getApp = jest.fn().mockReturnValue(app);
    
    // Mock CloudDBService methods
    CloudDBService.ensureInit = jest.fn();
    CloudDBService.getGameById = jest.fn().mockResolvedValue(mockGame);
    CloudDBService.getMatchesForGame = jest.fn().mockResolvedValue(mockMatches);
    
    // Mock wx API methods
    global.wx = {
      showLoading: jest.fn(),
      hideLoading: jest.fn(),
      showToast: jest.fn(),
      navigateBack: jest.fn(),
      navigateTo: jest.fn()
    };

    // Create page instance with a minimal implementation
    page = {
      data: {
        gameMatches: [],
        isLoading: false,
        gameId: null,
        isFromGame: false,
        gameName: '',
        matchRounds: [],
        isOwner: false,
        gameStatus: '',
        completedCount: 0,
        totalCount: 0
      },
      setData: jest.fn(function(obj) {
        this.data = { ...this.data, ...obj };
      })
    };

    // Implement page methods directly
    page.loadGameMatches = async function(gameId) {
      this.setData({ isLoading: true });
      
      try {
        // Initialize the cloud DB service
        CloudDBService.ensureInit();
        
        // Get the game details
        const game = await CloudDBService.getGameById(gameId);
        
        if (game) {
          // Get current user to check ownership
          const app = getApp();
          const currentUser = await app.getCurrentUser();
          let isOwner = false;
          
          if (currentUser && game.owner) {
            // Check if current user is the owner
            isOwner = currentUser.Name === game.owner.Name;
          }
          
          this.setData({ 
            gameName: game.title || '对阵表',
            isOwner: isOwner,
            gameStatus: game.status || ''
          });
        }
        
        // Get matches for this game
        const matches = await CloudDBService.getMatchesForGame(gameId);
        
        if (matches && matches.length > 0) {
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
            let team1, team2;
            
            if (match.PlayerA1 && typeof match.PlayerA1 === 'object') {
              // We have full player objects
              team1 = [match.PlayerA1, match.PlayerA2];
              team2 = [match.PlayerB1, match.PlayerB2];
            } else {
              // We have the old format with just names
              team1 = [match.PlayerA1, match.PlayerA2];
              team2 = [match.PlayerB1, match.PlayerB2];
            }
            
            roundsMap[round].courts.push({
              teams: [team1, team2],
              court: match.Court,
              id: match._id,
              isCompleted: !!match.CompleteTime,
              scoreA: match.ScoreA,
              scoreB: match.ScoreB,
              matchId: match.MatchId || ''
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
        } else {
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
        this.setData({ isLoading: false });
        
        wx.showToast({
          title: '加载对阵表失败',
          icon: 'none',
          duration: 2000
        });
      }
    };

    page.navigateBack = function() {
      wx.navigateBack({
        delta: 1
      });
    };

    page.navigateToGenerate = function() {
      const { gameId, gameStatus } = this.data;
      
      // Check if game status is "playing" - don't allow generating matches
      if (gameStatus === 'playing') {
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
        url: `/pages/generate-match/generate-match?fromSignup=true&gameId=${gameId}&fromMyMatch=true`
      });
    };

    // Bind all methods to the page object
    for (const key in page) {
      if (typeof page[key] === 'function') {
        page[key] = page[key].bind(page);
      }
    }
  });

  // Test loading matches for a game
  test('loadGameMatches should load and format matches correctly', async () => {
    // Set gameId
    page.data.gameId = 'game123';
    
    // Call the function
    await page.loadGameMatches('game123');
    
    // Verify cloud DB was initialized
    expect(CloudDBService.ensureInit).toHaveBeenCalled();
    
    // Verify game data was fetched
    expect(CloudDBService.getGameById).toHaveBeenCalledWith('game123');
    
    // Verify matches were fetched
    expect(CloudDBService.getMatchesForGame).toHaveBeenCalledWith('game123');
    
    // Check if page data was updated correctly
    expect(page.data.gameName).toBe('测试活动');
    expect(page.data.gameStatus).toBe('matched');
    expect(page.data.matchRounds).toHaveLength(2); // 2 rounds in our mock data
    expect(page.data.matchRounds[0].courts).toHaveLength(2); // 2 courts in first round
    expect(page.data.matchRounds[1].courts).toHaveLength(2); // 2 courts in second round
    
    // Check completion count
    expect(page.data.completedCount).toBe(2); // 2 matches have CompleteTime
    expect(page.data.totalCount).toBe(4); // 4 matches total
    
    // Check specific court data
    const firstCourt = page.data.matchRounds[0].courts[0];
    expect(firstCourt.teams[0]).toContain('TestPlayer1');
    expect(firstCourt.teams[0]).toContain('TestPlayer2');
    expect(firstCourt.teams[1]).toContain('TestPlayer3');
    expect(firstCourt.teams[1]).toContain('TestPlayer4');
    expect(firstCourt.isCompleted).toBe(true);
    expect(firstCourt.scoreA).toBe(21);
    expect(firstCourt.scoreB).toBe(15);
    
    // Check loading state
    expect(page.data.isLoading).toBe(false);
  });

  // Test loading game with no matches
  test('loadGameMatches should handle case with no matches gracefully', async () => {
    // Mock empty matches return
    CloudDBService.getMatchesForGame.mockResolvedValueOnce([]);
    
    // Call the function
    await page.loadGameMatches('game123');
    
    // Check if page data was updated correctly
    expect(page.data.gameMatches).toEqual([]);
    expect(page.data.matchRounds).toEqual([]);
    expect(page.data.completedCount).toBe(0);
    expect(page.data.totalCount).toBe(0);
    
    // Verify error toast was shown
    expect(wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '没有找到比赛记录',
        icon: 'none'
      })
    );
    
    // Check loading state
    expect(page.data.isLoading).toBe(false);
  });

  // Test error handling when loading matches
  test('loadGameMatches should handle errors gracefully', async () => {
    // Mock error when fetching matches
    CloudDBService.getMatchesForGame.mockRejectedValueOnce(new Error('Network error'));
    
    // Call the function
    await page.loadGameMatches('game123');
    
    // Verify error toast was shown
    expect(wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '加载对阵表失败',
        icon: 'none'
      })
    );
    
    // Check loading state
    expect(page.data.isLoading).toBe(false);
  });
  
  // Test user ownership detection
  test('loadGameMatches should correctly detect if current user is game owner', async () => {
    // Mock game with the current user as owner
    CloudDBService.getGameById.mockResolvedValueOnce({
      ...mockGame,
      owner: {
        Name: 'TestUser', // Same as our mock getCurrentUser
        Avatar: '/assets/icons/user.png'
      }
    });
    
    // Call the function
    await page.loadGameMatches('game123');
    
    // Verify owner flag is set
    expect(page.data.isOwner).toBe(true);
  });

  // Test user is not owner
  test('loadGameMatches should correctly detect if current user is not game owner', async () => {
    // Mock game with a different user as owner (default behavior)
    
    // Call the function
    await page.loadGameMatches('game123');
    
    // Verify owner flag is not set
    expect(page.data.isOwner).toBe(false);
  });

  // Test navigating back
  test('navigateBack should call wx.navigateBack with delta 1', () => {
    // Call the function
    page.navigateBack();
    
    // Verify navigateBack was called with delta 1
    expect(wx.navigateBack).toHaveBeenCalledWith({
      delta: 1
    });
  });

  // Test navigating to generate matches page
  test('navigateToGenerate should navigate to generate-match page with correct parameters', () => {
    // Set gameId
    page.setData({
      gameId: 'game123',
      gameStatus: 'matched'
    });
    
    // Call the function
    page.navigateToGenerate();
    
    // Verify navigate was called with correct URL
    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/generate-match/generate-match?fromSignup=true&gameId=game123&fromMyMatch=true'
    });
  });

  // Test blocking regeneration for playing games
  test('navigateToGenerate should block regeneration for games in playing status', () => {
    // Set gameId and playing status
    page.setData({
      gameId: 'game123',
      gameStatus: 'playing'
    });
    
    // Call the function
    page.navigateToGenerate();
    
    // Verify toast was shown
    expect(wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '比赛正在进行中，无法重新生成对阵表',
        icon: 'none'
      })
    );
    
    // Verify navigate was NOT called
    expect(wx.navigateTo).not.toHaveBeenCalled();
  });

  // Test validation when gameId is missing
  test('navigateToGenerate should show error when gameId is missing', () => {
    // Set no gameId
    page.setData({
      gameId: null,
      gameStatus: 'matched'
    });
    
    // Call the function
    page.navigateToGenerate();
    
    // Verify toast was shown
    expect(wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '无法确定游戏ID',
        icon: 'none'
      })
    );
    
    // Verify navigate was NOT called
    expect(wx.navigateTo).not.toHaveBeenCalled();
  });
  
  // Test loading matches with non-completed matches
  test('loadGameMatches should correctly count completed and total matches', async () => {
    // Set up mock matches with varying completion statuses
    const mixedMatches = [
      {...mockMatches[0], CompleteTime: '2025-07-05T10:30:00Z'}, // Completed
      {...mockMatches[1], CompleteTime: null}, // Not completed
      {...mockMatches[2], CompleteTime: '2025-07-05T11:00:00Z'}, // Completed
      {...mockMatches[3], CompleteTime: null}, // Not completed
      {
        _id: 'match5',
        MatchId: 'match-id-5',
        GameId: 'game123',
        Round: 3,
        Court: 1,
        PlayerA1: 'TestPlayer1',
        PlayerA2: 'TestPlayer6',
        PlayerB1: 'TestPlayer3',
        PlayerB2: 'TestPlayer8',
        ScoreA: 21,
        ScoreB: 19,
        CompleteTime: '2025-07-05T12:00:00Z', // Completed
        Status: 'completed'
      }
    ];
    
    CloudDBService.getMatchesForGame.mockResolvedValueOnce(mixedMatches);
    
    // Call the function
    await page.loadGameMatches('game123');
    
    // Check completion counts
    expect(page.data.completedCount).toBe(3); // 3 matches have CompleteTime
    expect(page.data.totalCount).toBe(5); // 5 matches total
    
    // Check round counting
    expect(page.data.matchRounds).toHaveLength(3); // Should have 3 rounds
  });

  // Test handling matches with object-style player references
  test('loadGameMatches should handle matches with object-style player references', async () => {
    // Create matches with object-style player references
    const objectStyleMatches = [
      {
        _id: 'match1',
        MatchId: 'match-id-1',
        GameId: 'game123',
        Round: 1,
        Court: 1,
        PlayerA1: { name: 'TestPlayer1', gender: 'male' },
        PlayerA2: { name: 'TestPlayer2', gender: 'female' },
        PlayerB1: { name: 'TestPlayer3', gender: 'male' },
        PlayerB2: { name: 'TestPlayer4', gender: 'female' },
        ScoreA: 21,
        ScoreB: 15,
        CompleteTime: '2025-07-05T10:30:00Z',
        Status: 'completed'
      }
    ];
    
    CloudDBService.getMatchesForGame.mockResolvedValueOnce(objectStyleMatches);
    
    // Call the function
    await page.loadGameMatches('game123');
    
    // Check that player objects are processed correctly
    const firstCourt = page.data.matchRounds[0].courts[0];
    expect(firstCourt.teams[0][0]).toEqual({ name: 'TestPlayer1', gender: 'male' });
    expect(firstCourt.teams[0][1]).toEqual({ name: 'TestPlayer2', gender: 'female' });
    expect(firstCourt.teams[1][0]).toEqual({ name: 'TestPlayer3', gender: 'male' });
    expect(firstCourt.teams[1][1]).toEqual({ name: 'TestPlayer4', gender: 'female' });
  });

  // Test logic for sorting rounds numerically
  test('loadGameMatches should sort rounds numerically', async () => {
    // Create matches with non-sequential round numbers
    const nonSequentialMatches = [
      {...mockMatches[0], Round: 3},
      {...mockMatches[1], Round: 1},
      {...mockMatches[2], Round: 4},
      {...mockMatches[3], Round: 2}
    ];
    
    CloudDBService.getMatchesForGame.mockResolvedValueOnce(nonSequentialMatches);
    
    // Call the function
    await page.loadGameMatches('game123');
    
    // Verify rounds are in numeric order
    expect(page.data.matchRounds[0].round).toBe(1);
    expect(page.data.matchRounds[1].round).toBe(2);
    expect(page.data.matchRounds[2].round).toBe(3);
    expect(page.data.matchRounds[3].round).toBe(4);
  });
});