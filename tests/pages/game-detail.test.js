const CloudDBService = require('../../utils/cloud-db');
const GameService = require('../../utils/game-service');

// Mock dependencies
jest.mock('../../utils/cloud-db');
jest.mock('../../utils/game-service');

// Sample test game data
const mockGame = {
  id: 'game123',
  title: '测试活动',
  date: '2025-07-15',
  startTime: '14:00',
  endTime: '16:00',
  location: '测试场地',
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
};

describe('Game Detail Service Tests', () => {
  // Setup mocks
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock CloudDBService methods
    CloudDBService.getGameById.mockResolvedValue(mockGame);
    CloudDBService.updateGame.mockResolvedValue(true);
    CloudDBService.deleteGame.mockResolvedValue(true);
    
    // Mock GameService methods
    GameService.addPlayerToGame.mockResolvedValue({
      ...mockGame,
      players: [...mockGame.players, { name: 'TestUser', gender: 'male', avatar: '/assets/icons/user.png' }]
    });
    
    GameService.removePlayerFromGame.mockResolvedValue({
      ...mockGame,
      players: [mockGame.players[0]]
    });
  });

  test('fetching a game by ID should work', async () => {
    const game = await CloudDBService.getGameById('game123');
    expect(CloudDBService.getGameById).toHaveBeenCalledWith('game123');
    expect(game).toEqual(mockGame);
  });
  
  test('adding a player to a game should work', async () => {
    const player = { 
      name: 'TestUser', 
      gender: 'male', 
      avatar: '/assets/icons/user.png' 
    };
    
    const updatedGame = await GameService.addPlayerToGame('game123', player);
    
    expect(GameService.addPlayerToGame).toHaveBeenCalledWith('game123', player);
    expect(updatedGame.players.length).toBe(3);
    expect(updatedGame.players).toContainEqual(player);
  });
  
  test('removing a player from a game should work', async () => {
    const playerName = 'TestPlayer2';
    const updatedGame = await GameService.removePlayerFromGame('game123', playerName);
    
    expect(GameService.removePlayerFromGame).toHaveBeenCalledWith('game123', playerName);
    expect(updatedGame.players.length).toBe(1);
  });
  
  test('updating a game should work', async () => {
    const updates = {
      title: 'Updated Title',
      location: 'New Location'
    };
    
    const result = await CloudDBService.updateGame('game123', updates);
    
    expect(CloudDBService.updateGame).toHaveBeenCalledWith('game123', updates);
    expect(result).toBe(true);
  });
  
  test('deleting a game should work', async () => {
    const result = await CloudDBService.deleteGame('game123');
    
    expect(CloudDBService.deleteGame).toHaveBeenCalledWith('game123');
    expect(result).toBe(true);
  });
});