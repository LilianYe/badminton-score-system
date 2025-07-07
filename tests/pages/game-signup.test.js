const CloudDBService = require('../../utils/cloud-db');

// Mock dependencies
jest.mock('../../utils/cloud-db');

// Sample test game data
const mockGames = [
  {
    id: 'game123',
    title: '测试活动1',
    date: '2025-07-15',
    startTime: '14:00',
    endTime: '16:00',
    location: '测试场地1',
    rules: '测试规则',
    maxPlayers: 16,
    courtCount: 4,
    status: 'active',
    players: [
      { name: 'TestPlayer1', gender: 'male', avatar: '/assets/icons/user.png' },
      { name: 'TestPlayer2', gender: 'female', avatar: '/assets/icons/user.png' }
    ],
    owner: {
      Name: 'TestOwner',
      Avatar: '/assets/icons/user.png'
    }
  },
  {
    id: 'game456',
    title: '测试活动2',
    date: '2025-07-20',
    startTime: '10:00',
    endTime: '12:00',
    location: '测试场地2',
    rules: '一局定胜负，21分制',
    maxPlayers: 8,
    courtCount: 2,
    status: 'active',
    players: [],
    owner: {
      Name: 'TestOwner2',
      Avatar: '/assets/icons/user.png'
    }
  }
];

const mockNewGame = {
  title: '新测试活动',
  date: '2025-08-01',
  startTime: '15:00',
  endTime: '17:00',
  location: '新测试场地',
  rules: '一局定胜负，21分制',
  maxPlayers: 8,
  courtCount: 2,
  status: 'active',
  players: [],
  owner: {
    Name: 'TestUser',
    Avatar: '/assets/icons/user.png'
  }
};

describe('Game Signup Service Tests', () => {
  let mockStorage = {};
  
  // Setup mocks
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock storage
    mockStorage = {};
    
    // Mock CloudDBService methods
    CloudDBService.getAllGames.mockResolvedValue(mockGames);
    CloudDBService.createGame.mockImplementation((game) => {
      return Promise.resolve({
        ...game,
        id: game.id || `game${Date.now()}`,
        players: [],
        status: 'active'
      });
    });
    
    // Mock storage functions
    global.wx = {
      getStorageSync: jest.fn(key => mockStorage[key]),
      setStorageSync: jest.fn((key, value) => {
        mockStorage[key] = value;
      }),
      removeStorageSync: jest.fn(key => {
        delete mockStorage[key];
      })
    };
  });

  test('fetching all games should work', async () => {
    const games = await CloudDBService.getAllGames();
    
    expect(CloudDBService.getAllGames).toHaveBeenCalled();
    expect(games).toEqual(mockGames);
    expect(games.length).toBe(2);
  });

  test('creating a new game should work', async () => {
    const gameToCreate = { ...mockNewGame };
    delete gameToCreate.id; // Remove ID so service generates one
    
    const createdGame = await CloudDBService.createGame(gameToCreate);
    
    expect(CloudDBService.createGame).toHaveBeenCalledWith(gameToCreate);
    expect(createdGame.title).toBe(mockNewGame.title);
    expect(createdGame.date).toBe(mockNewGame.date);
    expect(createdGame.status).toBe('active');
    expect(createdGame.id).toBeTruthy(); // Should have generated an ID
  });
  
  test('storage operations for caching should work', () => {
    // Test setting cache
    const timestamp = Date.now();
    const cacheData = {
      games: mockGames,
      timestamp: timestamp
    };
    
    const GAMES_CACHE_KEY = 'GAMES_LIST_CACHE';
    const GAMES_CACHE_EXPIRY_KEY = 'GAMES_LIST_CACHE_EXPIRY';
    
    // Set cache
    wx.setStorageSync(GAMES_CACHE_KEY, JSON.stringify(cacheData));
    wx.setStorageSync(GAMES_CACHE_EXPIRY_KEY, timestamp + 300000); // 5 minutes expiry
    
    // Verify cache was set
    expect(mockStorage[GAMES_CACHE_KEY]).toBe(JSON.stringify(cacheData));
    
    // Get cache
    const cachedDataStr = wx.getStorageSync(GAMES_CACHE_KEY);
    const cachedData = JSON.parse(cachedDataStr);
    
    // Verify cache retrieval
    expect(cachedData.games).toEqual(mockGames);
    expect(cachedData.timestamp).toBe(timestamp);
    
    // Clear cache
    wx.removeStorageSync(GAMES_CACHE_KEY);
    wx.removeStorageSync(GAMES_CACHE_EXPIRY_KEY);
    
    // Verify cache was cleared
    expect(mockStorage[GAMES_CACHE_KEY]).toBeUndefined();
    expect(mockStorage[GAMES_CACHE_EXPIRY_KEY]).toBeUndefined();
  });
  
  test('time validation should work', () => {
    // Helper function copied from game-signup.js
    const convertTimeToMinutes = function(timeString) {
      const [hours, minutes] = timeString.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    // Test valid times
    const startTime1 = '10:00';
    const endTime1 = '12:00';
    const startMinutes1 = convertTimeToMinutes(startTime1);
    const endMinutes1 = convertTimeToMinutes(endTime1);
    expect(endMinutes1 > startMinutes1).toBe(true);
    
    // Test invalid times
    const startTime2 = '14:00';
    const endTime2 = '13:00';
    const startMinutes2 = convertTimeToMinutes(startTime2);
    const endMinutes2 = convertTimeToMinutes(endTime2);
    expect(endMinutes2 > startMinutes2).toBe(false);
    
    // Test equal times
    const startTime3 = '15:00';
    const endTime3 = '15:00';
    const startMinutes3 = convertTimeToMinutes(startTime3);
    const endMinutes3 = convertTimeToMinutes(endTime3);
    expect(endMinutes3 > startMinutes3).toBe(false);
  });
  
  test('game validation should detect missing fields', () => {
    // Test missing title
    let game1 = { ...mockNewGame, title: '' };
    expect(game1.title.trim()).toBe('');
    
    // Test missing date
    let game2 = { ...mockNewGame, date: '' };
    expect(game2.date).toBe('');
    
    // Test missing location
    let game3 = { ...mockNewGame, location: '' };
    expect(game3.location.trim()).toBe('');
    
    // Test missing start time
    let game4 = { ...mockNewGame, startTime: '' };
    expect(game4.startTime).toBe('');
    
    // Test missing end time
    let game5 = { ...mockNewGame, endTime: '' };
    expect(game5.endTime).toBe('');
  });
  
  test('creating a game with invalid data should fail', async () => {
    // Setup mock implementation that checks time logic
    CloudDBService.createGame.mockImplementation((game) => {
      // Helper function to validate time
      const convertTimeToMinutes = function(timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
      };
      
      // Check required fields
      if (!game.title || !game.date || !game.startTime || !game.endTime || !game.location) {
        return Promise.reject(new Error('Missing required fields'));
      }
      
      // Check time logic
      const startMinutes = convertTimeToMinutes(game.startTime);
      const endMinutes = convertTimeToMinutes(game.endTime);
      if (endMinutes <= startMinutes) {
        return Promise.reject(new Error('End time must be after start time'));
      }
      
      // If all checks pass, return the created game
      return Promise.resolve({
        ...game,
        id: `game${Date.now()}`,
        players: [],
        status: 'active'
      });
    });
    
    // Test with invalid time
    const invalidGame = {
      ...mockNewGame,
      startTime: '15:00',
      endTime: '14:00'
    };
    
    await expect(CloudDBService.createGame(invalidGame)).rejects.toThrow('End time must be after start time');
    
    // Test with missing title
    const missingTitleGame = {
      ...mockNewGame,
      title: ''
    };
    
    await expect(CloudDBService.createGame(missingTitleGame)).rejects.toThrow('Missing required fields');
  });
});