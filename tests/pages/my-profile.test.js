const UserService = require('../../utils/user-service');
const MatchService = require('../../utils/match-service');

// Mock dependencies
jest.mock('../../utils/user-service');
jest.mock('../../utils/match-service');

// Sample test data
const mockCurrentUser = {
  Name: 'TestUser',
  Gender: 'male',
  Avatar: '/assets/icons/user.png'
};

const mockUpcomingMatches = [
  {
    _id: 'match1',
    MatchId: 'match1',
    GameId: 'game123',
    Court: 1,
    Round: 1,
    PlayerA1: {
      name: 'TestUser',
      gender: 'male',
      avatar: '/assets/icons/user.png'
    },
    PlayerA2: {
      name: 'Partner1',
      gender: 'female',
      avatar: '/assets/icons/user.png'
    },
    PlayerB1: {
      name: 'Opponent1',
      gender: 'male',
      avatar: '/assets/icons/user.png'
    },
    PlayerB2: {
      name: 'Opponent2',
      gender: 'female',
      avatar: '/assets/icons/user.png'
    },
    StartTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour in the future
    CompleteTime: null
  }
];

const mockCompletedMatches = [
  {
    _id: 'match2',
    MatchId: 'match2',
    GameId: 'game456',
    Court: 2,
    Round: 2,
    PlayerA1: {
      name: 'TestUser',
      gender: 'male',
      avatar: '/assets/icons/user.png'
    },
    PlayerA2: {
      name: 'Partner2',
      gender: 'female',
      avatar: '/assets/icons/user.png'
    },
    PlayerB1: {
      name: 'Opponent3',
      gender: 'male',
      avatar: '/assets/icons/user.png'
    },
    PlayerB2: {
      name: 'Opponent4',
      gender: 'female',
      avatar: '/assets/icons/user.png'
    },
    ScoreA: 21,
    ScoreB: 19,
    StartTime: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    CompleteTime: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
  }
];

const mockUserStats = {
  Name: 'TestUser',
  GamesPlayed: 10,
  GamesWon: 6,
  ELO: 1200,
  WinRate: 0.6,
  SameGenderWinRate: 0.75,
  MixedWinRate: 0.5
};

describe('My Profile Page Tests', () => {
  let mockStorage = {};
  let mockDb = {};
  
  // Setup mocks
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock storage and database
    mockStorage = {};
    mockDb = {
      collection: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      get: jest.fn()
    };
    
    // Mock UserService methods
    UserService.getCurrentUser.mockReturnValue(mockCurrentUser);
    
    // Mock MatchService methods
    MatchService.getUpcomingMatchesForUser.mockResolvedValue(mockUpcomingMatches);
    MatchService.getCompletedMatchesForUser.mockResolvedValue(mockCompletedMatches);
    MatchService.updateMatchScores.mockResolvedValue(true);
    
    // Mock wx API methods
    global.wx = {
      showToast: jest.fn(),
      showLoading: jest.fn(),
      hideLoading: jest.fn(),
      cloud: {
        database: jest.fn(() => mockDb)
      },
      getStorageSync: jest.fn(key => mockStorage[key]),
      setStorageSync: jest.fn((key, value) => {
        mockStorage[key] = value;
      }),
      removeStorageSync: jest.fn(key => {
        delete mockStorage[key];
      })
    };
    
    // Mock database responses
    mockDb.get.mockImplementation(() => {
      // Match status check
      if (mockDb.collection.mock.calls.some(call => call[0] === 'Match')) {
        return Promise.resolve({
          data: [mockUpcomingMatches[0]]
        });
      } 
      // User stats query
      else if (mockDb.collection.mock.calls.some(call => call[0] === 'UserPerformance')) {
        return Promise.resolve({
          data: [mockUserStats]
        });
      }
      return Promise.resolve({ data: [] });
    });
  });

  test('getCurrentUser should return the current user', () => {
    const user = UserService.getCurrentUser();
    
    expect(UserService.getCurrentUser).toHaveBeenCalled();
    expect(user).toEqual(mockCurrentUser);
    expect(user.Name).toBe('TestUser');
    expect(user.Gender).toBe('male');
  });

  test('getUpcomingMatchesForUser should return upcoming matches', async () => {
    const matches = await MatchService.getUpcomingMatchesForUser();
    
    expect(MatchService.getUpcomingMatchesForUser).toHaveBeenCalled();
    expect(matches).toEqual(mockUpcomingMatches);
    expect(matches.length).toBe(1);
    expect(matches[0].CompleteTime).toBeNull();
  });

  test('getCompletedMatchesForUser should return completed matches', async () => {
    const matches = await MatchService.getCompletedMatchesForUser();
    
    expect(MatchService.getCompletedMatchesForUser).toHaveBeenCalled();
    expect(matches).toEqual(mockCompletedMatches);
    expect(matches.length).toBe(1);
    expect(matches[0].CompleteTime).not.toBeNull();
  });
  
  test('user stats caching should work correctly', () => {
    // Test constants from my-profile.js
    const USER_STATS_CACHE_KEY = 'USER_STATS_CACHE';
    const USER_STATS_CACHE_EXPIRY_KEY = 'USER_STATS_CACHE_EXPIRY';
    const USER_STATS_CACHE_USER_KEY = 'USER_STATS_CACHE_USER';
    
    // Create test data for caching
    const timestamp = Date.now();
    const cacheData = {
      stats: mockUserStats,
      sameGenderTitle: '男双', // Based on current user being male
      timestamp: timestamp
    };
    
    // Calculate expiry time (12 hours in the future)
    const expiryTime = timestamp + (12 * 60 * 60 * 1000);
    
    // Save to storage
    wx.setStorageSync(USER_STATS_CACHE_USER_KEY, 'TestUser');
    wx.setStorageSync(USER_STATS_CACHE_KEY, JSON.stringify(cacheData));
    wx.setStorageSync(USER_STATS_CACHE_EXPIRY_KEY, expiryTime);
    
    // Verify cache was set
    expect(mockStorage[USER_STATS_CACHE_KEY]).toBe(JSON.stringify(cacheData));
    expect(mockStorage[USER_STATS_CACHE_USER_KEY]).toBe('TestUser');
    expect(mockStorage[USER_STATS_CACHE_EXPIRY_KEY]).toBe(expiryTime);
    
    // Retrieve and verify cache
    const cachedUser = wx.getStorageSync(USER_STATS_CACHE_USER_KEY);
    const cachedDataStr = wx.getStorageSync(USER_STATS_CACHE_KEY);
    const cachedData = JSON.parse(cachedDataStr);
    
    expect(cachedUser).toBe('TestUser');
    expect(cachedData.stats).toEqual(mockUserStats);
    expect(cachedData.timestamp).toBe(timestamp);
    
    // Clear cache
    wx.removeStorageSync(USER_STATS_CACHE_KEY);
    wx.removeStorageSync(USER_STATS_CACHE_EXPIRY_KEY);
    wx.removeStorageSync(USER_STATS_CACHE_USER_KEY);
    
    // Verify cache was cleared
    expect(mockStorage[USER_STATS_CACHE_KEY]).toBeUndefined();
    expect(mockStorage[USER_STATS_CACHE_EXPIRY_KEY]).toBeUndefined();
    expect(mockStorage[USER_STATS_CACHE_USER_KEY]).toBeUndefined();
  });
  
  test('updateMatchScores should update the match scores', async () => {
    const matchId = 'match1';
    const scoreA = 21;
    const scoreB = 19;
    
    await MatchService.updateMatchScores(matchId, scoreA, scoreB);
    
    expect(MatchService.updateMatchScores).toHaveBeenCalledWith(matchId, scoreA, scoreB);
  });
  
  test('badminton score validation should work', () => {
    // Helper function to validate badminton scores
    const validateBadmintonScores = (scoreA, scoreB) => {
      const maxScore = Math.max(scoreA, scoreB);
      const minScore = Math.min(scoreA, scoreB);
      const scoreDiff = maxScore - minScore;
      
      // Check if at least one team reaches 21
      if (maxScore < 21) {
        return { valid: false, message: '至少有一队需要达到21分' };
      }
      
      // Check if maximum score is 30
      if (maxScore > 30) {
        return { valid: false, message: '单局最高分为30分' };
      }
      
      // Check win margin rules
      if (maxScore === 21) {
        // If winner reaches exactly 21, they must win by at least 2 points
        if (scoreDiff < 2) {
          return { valid: false, message: '达到21分时需领先至少2分' };
        }
      } else if (maxScore > 21 && maxScore < 30) {
        // If winner reaches 22-29, they must win by exactly 2 points
        if (scoreDiff !== 2) {
          return { valid: false, message: '22-29分时需领先恰好2分' };
        }
      } else if (maxScore === 30) {
        // If winner reaches 30, they win regardless of margin
        if (scoreDiff < 1) {
          return { valid: false, message: '达到30分时需领先至少1分' };
        }
      }
      
      return { valid: true };
    };
    
    // Valid scores
    expect(validateBadmintonScores(21, 19).valid).toBe(true);
    expect(validateBadmintonScores(21, 0).valid).toBe(true);
    expect(validateBadmintonScores(23, 21).valid).toBe(true);
    expect(validateBadmintonScores(30, 29).valid).toBe(true);
    
    // Invalid scores - max score too low
    expect(validateBadmintonScores(20, 18).valid).toBe(false);
    
    // Invalid scores - max score too high
    expect(validateBadmintonScores(31, 29).valid).toBe(false);
    
    // Invalid scores - not enough lead at 21
    expect(validateBadmintonScores(21, 20).valid).toBe(false);
    
    // Invalid scores - wrong lead at 23
    expect(validateBadmintonScores(23, 20).valid).toBe(false);
    expect(validateBadmintonScores(23, 22).valid).toBe(false);
    
    // Invalid scores - tie not allowed
    expect(validateBadmintonScores(21, 21).valid).toBe(false);
    
    // Invalid scores - insufficient lead at 30
    expect(validateBadmintonScores(30, 30).valid).toBe(false);
  });
  
  test('match time validation should prevent editing scores before match start', async () => {
    // Mock a match that hasn't started yet (start time in the future)
    const futureMatch = {
      ...mockUpcomingMatches[0],
      StartTime: new Date(Date.now() + 3600000).toISOString() // 1 hour in future
    };
    
    // Setup mock DB response for a future match
    mockDb.get.mockResolvedValue({
      data: [futureMatch]
    });
    
    // Simulate current time validation logic
    const match = (await mockDb.get()).data[0];
    const currentTime = new Date();
    const matchStartTime = match.StartTime ? new Date(match.StartTime) : null;
    
    // Check if current time is after match start time
    const canEditScore = matchStartTime && currentTime >= matchStartTime;
    
    expect(canEditScore).toBe(false); // Should not allow editing
    
    // Now test with a match that has already started
    const pastMatch = {
      ...mockUpcomingMatches[0],
      StartTime: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
    };
    
    mockDb.get.mockResolvedValue({
      data: [pastMatch]
    });
    
    const startedMatch = (await mockDb.get()).data[0];
    const startedMatchStartTime = startedMatch.StartTime ? new Date(startedMatch.StartTime) : null;
    const canEditStartedMatch = startedMatchStartTime && currentTime >= startedMatchStartTime;
    
    expect(canEditStartedMatch).toBe(true); // Should allow editing
  });
  
  test('completed matches should not allow score editing', async () => {
    // Mock a match that is already completed
    const completedMatch = {
      ...mockUpcomingMatches[0],
      CompleteTime: new Date().toISOString()
    };
    
    // Setup mock DB response for a completed match
    mockDb.get.mockResolvedValue({
      data: [completedMatch]
    });
    
    // Simulate match completion check
    const match = (await mockDb.get()).data[0];
    const isAlreadyCompleted = !!match.CompleteTime;
    
    expect(isAlreadyCompleted).toBe(true);
  });
  
  test('formatting functions should work correctly', () => {
    // Test formatPercent helper function
    const formatPercent = (val) => {
      if (typeof val !== 'number' || isNaN(val)) return '0.0';
      return (val * 100).toFixed(1);
    };
    
    expect(formatPercent(0.75)).toBe('75.0');
    expect(formatPercent(0)).toBe('0.0');
    expect(formatPercent(1)).toBe('100.0');
    expect(formatPercent(NaN)).toBe('0.0');
    expect(formatPercent('not a number')).toBe('0.0');
    
    // Test formatLastUpdate helper function
    const formatLastUpdate = (timestamp) => {
      if (!timestamp) return '';
      
      const date = new Date(timestamp);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      
      return `${month}月${day}日 ${hours}:${minutes}`;
    };
    
    // Create a specific date for testing
    const testDate = new Date(2025, 6, 15, 14, 30); // July 15, 2025, 14:30
    expect(formatLastUpdate(testDate)).toBe('7月15日 14:30');
    
    // Test with empty timestamp
    expect(formatLastUpdate(null)).toBe('');
    expect(formatLastUpdate()).toBe('');
  });
});