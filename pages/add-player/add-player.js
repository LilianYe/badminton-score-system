const app = getApp();

Page({
  data: {
    name: '',
    gender: 'male', // Default gender
    genderOptions: ['male', 'female'],
    genderIndex: 0, // Default to 'male' (index 0)
    genderPickerClass: 'gender-picker male', // Default class
    genderDisplayText: 'Male', // Display text
    defaultElo: 1500,
    isLoading: false,
    players: []
  },
  
  onLoad: function() {
    this.setData({
      defaultElo: app.globalData.defaultElo || 1500
    });
    this.loadPlayers();
  },
  
  onShow: function() {
    this.loadPlayers();
  },
  
  loadPlayers: function() {
    const players = wx.getStorageSync('players') || [];
    this.setData({
      players
    });
  },
  
  onNameInput: function(e) {
    this.setData({
      name: e.detail.value
    });
  },
  
  onGenderChange: function(e) {
    const selectedIndex = e.detail.value;
    const selectedGender = this.data.genderOptions[selectedIndex];
    const genderClass = selectedGender === 'female' ? 'gender-picker female' : 'gender-picker male';
    const displayText = selectedGender === 'male' ? 'Male' : 'Female';
    
    this.setData({
      gender: selectedGender,
      genderIndex: selectedIndex,
      genderPickerClass: genderClass,
      genderDisplayText: displayText
    });
  },
  
  savePlayer: function() {
    const { name, gender } = this.data;
    if (!name.trim()) {
      wx.showToast({
        title: 'Please enter a name',
        icon: 'none'
      });
      return;
    }
    
    this.setData({ isLoading: true });
    
    const players = wx.getStorageSync('players') || [];
    
    // Check if player already exists
    if (players.some(p => p.name.toLowerCase() === name.trim().toLowerCase())) {
      wx.showToast({
        title: 'Player already exists',
        icon: 'none'
      });
      this.setData({ isLoading: false });
      return;
    }
    
    const newPlayer = {
      id: Date.now().toString(),
      name: name.trim(),
      gender: gender, // Add gender to player data
      rating: this.data.defaultElo,
      matches: 0,
      wins: 0,
      losses: 0,
      createdAt: new Date().toISOString()
    };
    
    players.push(newPlayer);
    
    // Save to local storage
    try {
      wx.setStorageSync('players', players);
      
      // Provide feedback on current player count
      const playerCount = players.length;
      const needMorePlayers = playerCount < 4;
      
      wx.showToast({
        title: `Player added! (${playerCount}/4${needMorePlayers ? ' min' : ''})`,
        icon: 'success'
      });
      
      // Reset input field
      this.setData({
        name: '',
        gender: 'male', // Reset to default gender
        isLoading: false,
        players
      });
      
      // Only navigate back automatically if we have at least 4 players
      if (!needMorePlayers) {
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    } catch (e) {
      console.error('Failed to save player:', e);
      wx.showToast({
        title: 'Failed to save player',
        icon: 'none'
      });
      this.setData({ isLoading: false });
    }
  },
  
  cancel: function() {
    wx.navigateBack();
  },
  
  // Add a function to go directly to the game page when we have enough players
  goToNewGame: function() {
    if (this.data.players.length >= 4) {
      wx.switchTab({
        url: '/pages/newGame/newGame'
      });
    } else {
      wx.showToast({
        title: 'Need at least 4 players',
        icon: 'none'
      });
    }
  }
});