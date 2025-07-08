// Import required dependencies
const fs = require('fs');
const path = require('path');

// Capture the Page config when Page() is called
let pageConfig = null;
global.Page = jest.fn(config => {
  pageConfig = config;
  return config;
});

// Mock getApp to avoid errors
global.getApp = jest.fn().mockReturnValue({
  globalData: {}
});

// Import the actual page file - this will trigger the Page() call
// We need to require with a full path to make sure it works
const playersPagePath = path.join(__dirname, '../../pages/players/players.js');
require(playersPagePath);

// Sample test data
const mockPlayers = [
  {
    Name: 'Player1',
    Gender: 'male',
    Games: 20,
    Wins: 15,
    Losses: 5,
    ELO: 1250.75,
    WinRate: 0.75,
    MixedWinRate: 0.7,
    SameGenderWinRate: 0.8
  },
  {
    Name: 'Player2',
    Gender: 'female',
    Games: 18,
    Wins: 10,
    Losses: 8,
    ELO: 1180.5,
    WinRate: 0.556,
    MixedWinRate: 0.6,
    SameGenderWinRate: 0.5
  },
  {
    Name: 'Player3',
    Gender: 'male',
    Games: 15,
    Wins: 7,
    Losses: 8,
    ELO: 1100.25,
    WinRate: 0.467,
    MixedWinRate: 0.4,
    SameGenderWinRate: 0.5
  }
];

describe('Players Page Tests', () => {
  let mockStorage = {};
  let mockDb = {};
  let mockCommand = {};
  let page;
  
  // Setup mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock storage
    mockStorage = {};
    
    // Setup mock command operators for cloud database queries
    mockCommand = {
      gt: jest.fn().mockReturnValue({ $gt: 5 }),
      gte: jest.fn().mockReturnValue({ $gte: 10 })
    };
    
    // Setup mock database
    mockDb = {
      collection: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      count: jest.fn().mockResolvedValue({ total: mockPlayers.length }),
      get: jest.fn().mockResolvedValue({ data: mockPlayers })
    };
    
    // Mock wx API methods
    global.wx = {
      cloud: {
        database: jest.fn(() => ({ ...mockDb, command: mockCommand }))
      },
      showToast: jest.fn(),
      stopPullDownRefresh: jest.fn(),
      getStorageSync: jest.fn(key => mockStorage[key]),
      setStorageSync: jest.fn((key, value) => {
        mockStorage[key] = value;
      }),
      removeStorageSync: jest.fn(key => {
        delete mockStorage[key];
      })
    };
    
    // Create a page instance from the captured configuration
    page = { 
      ...pageConfig,
      data: { ...pageConfig.data },
      setDataArgs: null, // Add this to track setData calls
      setData: jest.fn(function(data) {
        this.setDataArgs = data; // Store the most recent call arguments
        this.data = { ...this.data, ...data };
      })
    };
  });

  test('onLoad should initialize and load players data', () => {
    // Spy on loadPlayersData
    const loadDataSpy = jest.spyOn(page, 'loadPlayersData').mockResolvedValue();
    
    // Call onLoad
    page.onLoad();
    
    // Verify loadPlayersData was called
    expect(loadDataSpy).toHaveBeenCalledTimes(1);
    expect(loadDataSpy).toHaveBeenCalledWith();
  });

  test('onShow should check for cached data without forcing reload', () => {
    // Spy on loadPlayersData
    const loadDataSpy = jest.spyOn(page, 'loadPlayersData').mockResolvedValue();
    
    // Call onShow
    page.onShow();
    
    // Verify loadPlayersData was called with false parameter
    expect(loadDataSpy).toHaveBeenCalledTimes(1);
    expect(loadDataSpy).toHaveBeenCalledWith(false);
  });

  test('loadPlayersData should use cached data when available and valid', async () => {
    // Create cache data
    const CACHE_KEY = 'PLAYERS_RANKING_CACHE';
    const CACHE_EXPIRY_KEY = 'PLAYERS_RANKING_CACHE_EXPIRY';
    const timestamp = Date.now();
    const expiryTime = timestamp + (12 * 60 * 60 * 1000);
    const processedPlayers = mockPlayers.map((player, index) => ({
      ...player,
      rank: index + 1,
      ELO: Math.round(player.ELO),
      winRateDisplay: `${(player.WinRate * 100).toFixed(1)}%`,
      mixedWinRateDisplay: `${(player.MixedWinRate * 100).toFixed(1)}%`,
      sameGenderWinRateDisplay: `${(player.SameGenderWinRate * 100).toFixed(1)}%`,
      totalGames: player.Games,
      totalWins: player.Wins,
      totalLosses: player.Losses
    }));
    
    const cacheData = {
      players: processedPlayers,
      timestamp
    };
    
    mockStorage[CACHE_KEY] = JSON.stringify(cacheData);
    mockStorage[CACHE_EXPIRY_KEY] = expiryTime;
    
    // Spy on loadUserPerformance to make sure it's not called
    const loadUserPerformanceSpy = jest.spyOn(page, 'loadUserPerformance');
    
    // Call loadPlayersData
    await page.loadPlayersData();
    
    // Verify cache was used
    expect(loadUserPerformanceSpy).not.toHaveBeenCalled();
    expect(page.setData).toHaveBeenCalledWith({
      players: processedPlayers,
      isEmpty: false,
      lastUpdated: timestamp,
      isLoading: false
    });
  });

  test('loadPlayersData should fetch from database when cache is expired', async () => {
    // Create expired cache data
    const CACHE_KEY = 'PLAYERS_RANKING_CACHE';
    const CACHE_EXPIRY_KEY = 'PLAYERS_RANKING_CACHE_EXPIRY';
    const timestamp = Date.now() - (24 * 60 * 60 * 1000); // Far in the past
    const expiryTime = timestamp + (12 * 60 * 60 * 1000); // Already expired
    
    mockStorage[CACHE_KEY] = JSON.stringify({
      players: [],
      timestamp
    });
    mockStorage[CACHE_EXPIRY_KEY] = expiryTime;
    
    // Spy on loadUserPerformance and clearCache
    const loadUserPerformanceSpy = jest.spyOn(page, 'loadUserPerformance').mockResolvedValue();
    const clearCacheSpy = jest.spyOn(page, 'clearCache');
    
    // Call loadPlayersData
    await page.loadPlayersData();
    
    // Verify expired cache was cleared and loadUserPerformance was called
    expect(clearCacheSpy).toHaveBeenCalled();
    expect(loadUserPerformanceSpy).toHaveBeenCalled();
  });

  test('loadPlayersData should force refresh when requested', async () => {
    // Create valid cache data
    const CACHE_KEY = 'PLAYERS_RANKING_CACHE';
    const CACHE_EXPIRY_KEY = 'PLAYERS_RANKING_CACHE_EXPIRY';
    const timestamp = Date.now();
    const expiryTime = timestamp + (12 * 60 * 60 * 1000);
    
    mockStorage[CACHE_KEY] = JSON.stringify({
      players: [],
      timestamp
    });
    mockStorage[CACHE_EXPIRY_KEY] = expiryTime;
    
    // Spy on loadUserPerformance
    const loadUserPerformanceSpy = jest.spyOn(page, 'loadUserPerformance').mockResolvedValue();
    
    // Call loadPlayersData with forceRefresh = true
    await page.loadPlayersData(true);
    
    // Verify loadUserPerformance was called despite valid cache
    expect(loadUserPerformanceSpy).toHaveBeenCalled();
  });

  test('getCachedData should return null when no cache exists', () => {
    const result = page.getCachedData();
    expect(result).toBeNull();
  });

  test('getCachedData should handle parsing errors and clear cache', () => {
    // Set invalid JSON in the cache
    const CACHE_KEY = 'PLAYERS_RANKING_CACHE';
    const CACHE_EXPIRY_KEY = 'PLAYERS_RANKING_CACHE_EXPIRY';
    mockStorage[CACHE_KEY] = 'invalid json';
    mockStorage[CACHE_EXPIRY_KEY] = Date.now() + 10000;
    
    const clearCacheSpy = jest.spyOn(page, 'clearCache');
    
    const result = page.getCachedData();
    
    expect(result).toBeNull();
    expect(clearCacheSpy).toHaveBeenCalled();
  });

  test('saveToCache should properly store players data', () => {
    const players = [{ name: 'Test Player', ELO: 1000 }];
    
    page.saveToCache(players);
    
    // Verify storage calls
    expect(wx.setStorageSync).toHaveBeenCalledTimes(2);
    
    // Verify CACHE_KEY data
    const CACHE_KEY = 'PLAYERS_RANKING_CACHE';
    const CACHE_EXPIRY_KEY = 'PLAYERS_RANKING_CACHE_EXPIRY';
    const cacheCallArgs = wx.setStorageSync.mock.calls[0];
    expect(cacheCallArgs[0]).toBe(CACHE_KEY);
    const savedData = JSON.parse(cacheCallArgs[1]);
    expect(savedData.players).toEqual(players);
    expect(typeof savedData.timestamp).toBe('number');
    
    // Verify expiry time
    const expiryCallArgs = wx.setStorageSync.mock.calls[1];
    expect(expiryCallArgs[0]).toBe(CACHE_EXPIRY_KEY);
    expect(expiryCallArgs[1]).toBeGreaterThan(Date.now()); // Should be in the future
  });

  test('clearCache should remove all cache keys from storage', () => {
    const CACHE_KEY = 'PLAYERS_RANKING_CACHE';
    const CACHE_EXPIRY_KEY = 'PLAYERS_RANKING_CACHE_EXPIRY';
    page.clearCache();
    
    expect(wx.removeStorageSync).toHaveBeenCalledTimes(2);
    expect(wx.removeStorageSync).toHaveBeenCalledWith(CACHE_KEY);
    expect(wx.removeStorageSync).toHaveBeenCalledWith(CACHE_EXPIRY_KEY);
  });

  test('formatLastUpdated should properly format timestamps', () => {
    // Test with specific date
    const testDate = new Date(2025, 6, 7, 14, 30); // July 7, 2025, 14:30
    const formatted = page.formatLastUpdated(testDate);
    expect(formatted).toBe('7月7日 14:30');
    
    // Test with empty values
    expect(page.formatLastUpdated(null)).toBe('');
    expect(page.formatLastUpdated()).toBe('');
  });

  test('loadUserPerformance should fetch and process players data correctly', async () => {
    // Mock the page.setData implementation to store the call arguments
    let setDataArgs = null;
    page.setData = jest.fn((data) => {
      setDataArgs = data;
      Object.assign(page.data, data);
    });

    // Call loadUserPerformance and await its completion
    await page.loadUserPerformance();
    
    // Verify database queries
    expect(wx.cloud.database().collection).toHaveBeenCalledWith('UserPerformance');
    expect(wx.cloud.database().where).toHaveBeenCalledTimes(2);
    expect(wx.cloud.database().orderBy).toHaveBeenCalledWith('ELO', 'desc');
    expect(mockCommand.gt).toHaveBeenCalledWith(5);
    expect(mockCommand.gte).toHaveBeenCalledWith(10);
    
    // Check that setData was called
    expect(page.setData).toHaveBeenCalled();
    
    // Use the captured setDataArgs instead of looking for mock.calls
    expect(setDataArgs).toBeDefined();
    expect(setDataArgs.players).toBeDefined();
    expect(setDataArgs.players.length).toBe(mockPlayers.length);
    
    // Verify the first player was processed correctly
    const firstPlayer = setDataArgs.players[0];
    expect(firstPlayer.rank).toBe(1);
    expect(firstPlayer.ELO).toBe(Math.round(mockPlayers[0].ELO));
    expect(firstPlayer.winRateDisplay).toBe('75.0%');
    expect(firstPlayer.mixedWinRateDisplay).toBe('70.0%');
    expect(firstPlayer.sameGenderWinRateDisplay).toBe('80.0%');
  });

  test('loadUserPerformance should handle database errors', async () => {
    // Mock the page.setData implementation to store the call arguments
    let setDataArgs = null;
    page.setData = jest.fn((data) => {
      setDataArgs = data;
      Object.assign(page.data, data);
    });

    // Mock database error
    mockDb.count.mockRejectedValue(new Error('Database error'));
    
    // Call loadUserPerformance
    await page.loadUserPerformance();
    
    // Verify error handling
    expect(wx.showToast).toHaveBeenCalledWith({
      title: 'Failed to load rankings',
      icon: 'none'
    });
    
    // Verify UI state updates on error
    expect(page.setData).toHaveBeenCalled();
    expect(setDataArgs).toEqual({ 
      isLoading: false,
      isEmpty: true,
      players: []
    });
  });

  test('loadUserPerformance should handle missing or undefined player data fields', async () => {
    // Mock the page.setData implementation to store the call arguments
    let setDataArgs = null;
    page.setData = jest.fn((data) => {
      setDataArgs = data;
      Object.assign(page.data, data);
    });

    // Mock players with missing fields
    const incompletePlayer = {
      Name: 'IncompletePlayer',
      // Missing Gender
      Games: 15,
      // Missing Wins and Losses
      ELO: null,
      // Missing WinRate, MixedWinRate, SameGenderWinRate
    };
    
    mockDb.get.mockResolvedValue({ data: [incompletePlayer] });
    
    // Call loadUserPerformance
    await page.loadUserPerformance();
    
    // Verify page.setData was called
    expect(page.setData).toHaveBeenCalled();
    
    // Verify player processing handles missing fields
    expect(setDataArgs).toBeDefined();
    expect(setDataArgs.players).toBeDefined();
    
    const processedPlayer = setDataArgs.players[0];
    
    expect(processedPlayer.Gender).toBe('male'); // Default gender
    expect(processedPlayer.ELO).toBe(null); // Null ELO stays null
    expect(processedPlayer.winRateDisplay).toBe('0.0%');
    expect(processedPlayer.mixedWinRateDisplay).toBe('0.0%');
    expect(processedPlayer.sameGenderWinRateDisplay).toBe('0.0%');
    expect(processedPlayer.totalGames).toBe(15);
    expect(processedPlayer.totalWins).toBe(0); // Default to 0
    expect(processedPlayer.totalLosses).toBe(0); // Default to 0
  });

  test('loadUserPerformance should paginate correctly for large result sets', async () => {
    // Mock the page.setData implementation to store the call arguments
    let setDataArgs = null;
    page.setData = jest.fn((data) => {
      setDataArgs = data;
      Object.assign(page.data, data);
    });

    // Create a large mock result
    const largeMockPlayers = Array(55).fill(null).map((_, i) => ({
      Name: `Player${i + 1}`,
      Gender: i % 2 === 0 ? 'male' : 'female',
      Games: 20,
      Wins: 15,
      Losses: 5,
      ELO: 1300 - (i * 10),
      WinRate: 0.75,
      MixedWinRate: 0.7,
      SameGenderWinRate: 0.8
    }));
    
    // Mock large result count
    mockDb.count.mockResolvedValue({ total: 55 });
    
    // Mock pagination results
    mockDb.get
      .mockResolvedValueOnce({ data: largeMockPlayers.slice(0, 20) })
      .mockResolvedValueOnce({ data: largeMockPlayers.slice(20, 40) })
      .mockResolvedValueOnce({ data: largeMockPlayers.slice(40, 50) });
    
    // Call loadUserPerformance
    await page.loadUserPerformance();
    
    // Verify pagination was used correctly
    expect(mockDb.skip).toHaveBeenCalledTimes(3);
    expect(mockDb.limit).toHaveBeenCalledTimes(3);
    
    // Check pagination parameters
    expect(mockDb.skip).toHaveBeenNthCalledWith(1, 0);
    expect(mockDb.limit).toHaveBeenNthCalledWith(1, 20);
    
    expect(mockDb.skip).toHaveBeenNthCalledWith(2, 20);
    expect(mockDb.limit).toHaveBeenNthCalledWith(2, 20);
    
    expect(mockDb.skip).toHaveBeenNthCalledWith(3, 40);
    expect(mockDb.limit).toHaveBeenNthCalledWith(3, 10);
    
    // Should have loaded exactly 50 players (maximum)
    expect(page.setData).toHaveBeenCalled();
    expect(setDataArgs.players).toBeDefined();
    expect(setDataArgs.players.length).toBe(50);
  });

  test('onPullDownRefresh should force refresh and update UI', async () => {
    // Spy on loadPlayersData
    const loadDataSpy = jest.spyOn(page, 'loadPlayersData').mockResolvedValue();
    
    // Call onPullDownRefresh
    await page.onPullDownRefresh();
    
    // Verify loadPlayersData was called with true (force refresh)
    expect(loadDataSpy).toHaveBeenCalledWith(true);
    
    // Verify UI was updated
    expect(wx.stopPullDownRefresh).toHaveBeenCalled();
    expect(wx.showToast).toHaveBeenCalledWith({
      title: '排行榜已更新',
      icon: 'success'
    });
  });
});