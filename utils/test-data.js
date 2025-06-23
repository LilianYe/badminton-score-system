/**
 * Test Data Management Utility
 * Provides functions to create, modify, and clear test data in storage
 */

const TestDataManager = {
  
  // Create sample users for testing
  createSampleUsers: function() {
    const sampleUsers = [
      {
        openid: 'mock_openid_1703123456789',
        nickname: 'BadmintonPro',
        avatarUrl: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
        createdAt: '2024-01-01T08:00:00.000Z',
        lastLoginAt: '2024-01-15T10:30:00.000Z',
        updatedAt: '2024-01-15T10:30:00.000Z'
      },
      {
        openid: 'mock_openid_1703123456790',
        nickname: 'SmashMaster',
        avatarUrl: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
        createdAt: '2024-01-02T09:15:00.000Z',
        lastLoginAt: '2024-01-15T11:45:00.000Z',
        updatedAt: '2024-01-15T11:45:00.000Z'
      },
      {
        openid: 'mock_openid_1703123456791',
        nickname: 'CourtKing',
        avatarUrl: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
        createdAt: '2024-01-03T14:20:00.000Z',
        lastLoginAt: '2024-01-15T12:00:00.000Z',
        updatedAt: '2024-01-15T12:00:00.000Z'
      },
      {
        openid: 'mock_openid_1703123456792',
        nickname: 'RacketQueen',
        avatarUrl: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
        createdAt: '2024-01-04T16:30:00.000Z',
        lastLoginAt: '2024-01-15T13:15:00.000Z',
        updatedAt: '2024-01-15T13:15:00.000Z'
      }
    ];
    
    wx.setStorageSync('allUsers', sampleUsers);
    console.log('Sample users created:', sampleUsers);
    return sampleUsers;
  },
  
  // Create sample players for testing
  createSamplePlayers: function() {
    const samplePlayers = [
      {
        id: 'player_1',
        name: 'John Smith',
        gender: 'male',
        rating: 1500,
        matches: 10,
        wins: 7,
        losses: 3,
        createdAt: '2024-01-01T08:00:00.000Z'
      },
      {
        id: 'player_2',
        name: 'Sarah Johnson',
        gender: 'female',
        rating: 1520,
        matches: 12,
        wins: 8,
        losses: 4,
        createdAt: '2024-01-01T09:00:00.000Z'
      },
      {
        id: 'player_3',
        name: 'Mike Chen',
        gender: 'male',
        rating: 1480,
        matches: 8,
        wins: 5,
        losses: 3,
        createdAt: '2024-01-01T10:00:00.000Z'
      },
      {
        id: 'player_4',
        name: 'Lisa Wang',
        gender: 'female',
        rating: 1550,
        matches: 15,
        wins: 11,
        losses: 4,
        createdAt: '2024-01-01T11:00:00.000Z'
      }
    ];
    
    wx.setStorageSync('players', samplePlayers);
    console.log('Sample players created:', samplePlayers);
    return samplePlayers;
  },
  
  // Create sample games for testing
  createSampleGames: function() {
    const sampleGames = [
      {
        id: 'game_1',
        gameType: 'doubles',
        date: '2024-01-10T14:00:00.000Z',
        teamA: {
          player1: { id: 'player_1', name: 'John Smith' },
          player2: { id: 'player_2', name: 'Sarah Johnson' },
          score: 21
        },
        teamB: {
          player1: { id: 'player_3', name: 'Mike Chen' },
          player2: { id: 'player_4', name: 'Lisa Wang' },
          score: 19
        },
        winningTeam: 'teamA'
      },
      {
        id: 'game_2',
        gameType: 'doubles',
        date: '2024-01-12T15:30:00.000Z',
        teamA: {
          player1: { id: 'player_1', name: 'John Smith' },
          player2: { id: 'player_3', name: 'Mike Chen' },
          score: 18
        },
        teamB: {
          player1: { id: 'player_2', name: 'Sarah Johnson' },
          player2: { id: 'player_4', name: 'Lisa Wang' },
          score: 21
        },
        winningTeam: 'teamB'
      }
    ];
    
    wx.setStorageSync('games', sampleGames);
    console.log('Sample games created:', sampleGames);
    return sampleGames;
  },
  
  // Set current user for testing
  setCurrentUser: function(nickname = 'TestUser') {
    const currentUser = {
      openid: 'mock_openid_' + Date.now(),
      nickname: nickname,
      avatarUrl: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    wx.setStorageSync('userInfo', currentUser);
    console.log('Current user set:', currentUser);
    return currentUser;
  },
  
  // Add a specific test user
  addTestUser: function(nickname, avatarUrl = '') {
    const testUser = {
      openid: 'mock_openid_' + Date.now(),
      nickname: nickname,
      avatarUrl: avatarUrl,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const allUsers = wx.getStorageSync('allUsers') || [];
    allUsers.push(testUser);
    wx.setStorageSync('allUsers', allUsers);
    
    console.log('Test user added:', testUser);
    return testUser;
  },
  
  // Remove a user by nickname
  removeUserByNickname: function(nickname) {
    const allUsers = wx.getStorageSync('allUsers') || [];
    const filteredUsers = allUsers.filter(user => user.nickname !== nickname);
    wx.setStorageSync('allUsers', filteredUsers);
    
    console.log(`User "${nickname}" removed`);
    return filteredUsers;
  },
  
  // Update user nickname
  updateUserNickname: function(oldNickname, newNickname) {
    const allUsers = wx.getStorageSync('allUsers') || [];
    const userIndex = allUsers.findIndex(user => user.nickname === oldNickname);
    
    if (userIndex >= 0) {
      allUsers[userIndex].nickname = newNickname;
      allUsers[userIndex].updatedAt = new Date().toISOString();
      wx.setStorageSync('allUsers', allUsers);
      console.log(`User "${oldNickname}" renamed to "${newNickname}"`);
    } else {
      console.log(`User "${oldNickname}" not found`);
    }
    
    return allUsers;
  },
  
  // View all storage data
  viewAllStorage: function() {
    const storageInfo = wx.getStorageInfoSync();
    console.log('Storage Info:', storageInfo);
    
    const allData = {
      userInfo: wx.getStorageSync('userInfo'),
      allUsers: wx.getStorageSync('allUsers'),
      players: wx.getStorageSync('players'),
      games: wx.getStorageSync('games'),
      settings: wx.getStorageSync('settings')
    };
    
    console.log('All Storage Data:', allData);
    return allData;
  },
  
  // Clear specific storage
  clearStorage: function(key) {
    if (key) {
      wx.removeStorageSync(key);
      console.log(`Storage "${key}" cleared`);
    } else {
      wx.clearStorageSync();
      console.log('All storage cleared');
    }
  },
  
  // Reset to initial state
  resetToInitialState: function() {
    wx.clearStorageSync();
    this.createSampleUsers();
    this.createSamplePlayers();
    this.createSampleGames();
    this.setCurrentUser('TestUser');
    console.log('Reset to initial state completed');
  },
  
  // Create a sample user
  createSampleUser: function(nickname = null) {
    const userNickname = nickname || 'TestUser' + Math.floor(Math.random() * 1000);
    const gender = Math.random() > 0.5 ? 'male' : 'female';
    
    return {
      openid: 'mock_openid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      nickname: userNickname,
      avatarUrl: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
      gender: gender,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
};

// Make it available globally for console access
if (typeof window !== 'undefined') {
  window.TestDataManager = TestDataManager;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TestDataManager;
} 