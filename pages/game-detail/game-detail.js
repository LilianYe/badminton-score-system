Page({
  data: {
    game: null,
    isNavigating: false,
    isOwner: false, // New property to track if current user is the owner
    isEditing: false, // Track if we're in edit mode
    // Edit game data
    editGame: {
      title: '',
      date: '',
      time: '',
      location: '',
      rules: '',
      matchupMethod: '',
      maxPlayers: 0,
      courtCount: 0
    }
  },

  onLoad: function(options) {
    console.log('Game Detail page loaded', options);
    
    if (options.id) {
      this.loadGameById(options.id);
    } else {
      wx.showToast({
        title: '游戏ID未提供',
        icon: 'error'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },
  
  loadGameById: async function(gameId) {
    const app = getApp();
    let allGames = app.globalData.games || [];
    
    // If games aren't stored in globalData, we need to fetch them
    if (allGames.length === 0) {
      // For now, we'll assume this page is only accessed from game-signup
      // and we'll navigate back if we can't find the game
      wx.showToast({
        title: '未找到游戏数据',
        icon: 'error'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }
    
    const game = allGames.find(g => g.id === gameId);
    
    if (game) {
      // Get current user to check ownership
      const currentUser = await app.getCurrentUser();
      let isOwner = false;
      
      if (currentUser && game.owner) {
        // Check if current user is the owner
        isOwner = currentUser.openid === game.owner.openid;
        console.log('Owner check:', isOwner, currentUser.openid, game.owner.openid);
      }
      
      // Set game data and owner status
      this.setData({ 
        game, 
        isOwner,
        // Initialize edit game data
        editGame: {
          title: game.title,
          date: game.date,
          time: game.time,
          location: game.location,
          rules: game.rules,
          matchupMethod: game.matchupMethod,
          maxPlayers: game.maxPlayers,
          courtCount: game.courtCount
        }
      });
      
      wx.setNavigationBarTitle({
        title: game.title || '活动详情'
      });
    } else {
      wx.showToast({
        title: '未找到该活动',
        icon: 'error'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },
  
  // Player management
  
  addPlayer: async function() {
    const { game } = this.data;
    
    // Check if the game is full
    if (game.players.length >= game.maxPlayers) {
      wx.showToast({
        title: '报名人数已满',
        icon: 'none'
      });
      return;
    }
    
    // Get current user
    const app = getApp();
    const currentUser = await app.getCurrentUser();
    
    if (!currentUser) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      // Navigate to login page
      wx.navigateTo({
        url: '/pages/user-login/user-login'
      });
      return;
    }
    
    // Check if current user is already signed up for this game
    const isAlreadySignedUp = game.players.some(player => 
      player.openid === currentUser.openid
    );
    
    if (isAlreadySignedUp) {
      wx.showToast({
        title: '您已经报名参加了这个活动',
        icon: 'none'
      });
      return;
    }
    
    // Create player object from current user info
    const newPlayer = {
      name: currentUser.nickname,
      displayName: currentUser.gender === 'female' ? `${currentUser.nickname}(F)` : currentUser.nickname,
      gender: currentUser.gender || 'male',
      avatar: currentUser.avatarUrl || '/assets/icons/user.png',
      openid: currentUser.openid,
      elo: currentUser.elo || app.globalData.defaultElo || 1500
    };
    
    // Update the game's players array
    const allGames = app.globalData.games;
    const gameIndex = allGames.findIndex(g => g.id === game.id);
    
    if (gameIndex !== -1) {
      allGames[gameIndex].players.push(newPlayer);
      
      // Update local state
      this.setData({
        game: allGames[gameIndex]
      });
      
      wx.showToast({
        title: '报名成功',
        icon: 'success'
      });
    } else {
      wx.showToast({
        title: '报名失败',
        icon: 'error'
      });
    }
  },
  
  removePlayer: async function(e) {
    const index = e.currentTarget.dataset.index;
    const { game, isOwner } = this.data;
    
    // Get current user
    const app = getApp();
    const currentUser = await app.getCurrentUser();
    
    if (!currentUser) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }
    
    const playerToRemove = game.players[index];
    
    // Only allow removal if:
    // 1. User is the owner of the game, OR
    // 2. User is removing themselves
    if (isOwner || (playerToRemove.openid === currentUser.openid)) {
      // Update the game's players array
      const allGames = app.globalData.games;
      const gameIndex = allGames.findIndex(g => g.id === game.id);
      
      if (gameIndex !== -1) {
        allGames[gameIndex].players.splice(index, 1);
        
        // Update local state
        this.setData({
          game: allGames[gameIndex]
        });
        
        wx.showToast({
          title: '已退出活动',
          icon: 'success'
        });
      }
    } else {
      wx.showToast({
        title: '您没有权限移除其他球员',
        icon: 'none'
      });
    }
  },
  
  // Share game
  shareGame: function() {
    wx.showToast({
      title: '分享功能开发中',
      icon: 'none'
    });
  },
  
  // Navigate to match generation
  navigateToGenerate: function() {
    const { game } = this.data;
    
    if (!game || game.players.length < 2) {
      wx.showToast({
        title: '至少需要2名球员',
        icon: 'none'
      });
      return;
    }
    
    // Set loading state
    this.setData({ isNavigating: true });
    
    try {
      // Store the complete player data for match generation
      const app = getApp();
      app.globalData = app.globalData || {};
      
      // Extract both display names and complete player data
      const playerDisplayNames = game.players.map(p => p.displayName);
      
      // Store player names for match generation input
      app.globalData.signupPlayers = playerDisplayNames;
      
      // Store full player data for more advanced usage
      app.globalData.signupPlayerData = game.players;
      
      // Store female player set for gender balancing
      const femalePlayers = [];
      game.players.forEach(player => {
        if (player.gender === 'female') {
          femalePlayers.push(player.displayName);
        }
      });
      app.globalData.femalePlayerSet = femalePlayers;
      
      // Store court count for match generation
      app.globalData.courtCount = game.courtCount || 2;
      
      // Navigate to match generation page
      wx.navigateTo({
        url: '/pages/generate-match/generate-match?fromSignup=true'
      });
    } catch (e) {
      console.error('Error navigating to generate page:', e);
      wx.showToast({
        title: '导航错误',
        icon: 'error'
      });
    } finally {
      this.setData({ isNavigating: false });
    }
  },
  
  // Edit game details
  onEditGameDetails: function() {
    const { game } = this.data;
    
    // Populate the edit form with current game details
    this.setData({
      editGame: {
        title: game.title,
        date: game.date,
        time: game.time,
        location: game.location,
        rules: game.rules,
        matchupMethod: game.matchupMethod,
        maxPlayers: game.maxPlayers,
        courtCount: game.courtCount
      },
      isEditing: true
    });
  },
  
  onEditInputChange: function(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    const editGame = { ...this.data.editGame };
    
    // Handle different types of inputs
    if (field === 'maxPlayers' || field === 'courtCount') {
      // Convert to number for slider inputs
      editGame[field] = parseInt(value);
    } else {
      // For text inputs, date and time pickers
      editGame[field] = value;
    }
    
    // Update the state
    this.setData({ editGame });
    console.log(`Updated ${field} to:`, value);
  },
  
  onSaveGameDetails: function() {
    const { editGame, game } = this.data;
    
    // Validate required fields
    if (!editGame.title || !editGame.date || !editGame.time) {
      wx.showToast({
        title: '请填写所有必填项',
        icon: 'none'
      });
      return;
    }
    
    // Update game details in globalData
    const app = getApp();
    const allGames = app.globalData.games;
    const gameIndex = allGames.findIndex(g => g.id === game.id);
    
    if (gameIndex !== -1) {
      allGames[gameIndex] = {
        ...allGames[gameIndex],
        ...editGame
      };
      
      // Update local state
      this.setData({
        game: allGames[gameIndex],
        isEditing: false // Exit edit mode
      });
      
      // Update navigation title
      wx.setNavigationBarTitle({
        title: editGame.title || '活动详情'
      });
      
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });
    } else {
      wx.showToast({
        title: '保存失败',
        icon: 'error'
      });
    }
  },
  
  // Toggle edit mode
  toggleEditMode: function() {
    const { isEditing, game } = this.data;
    
    this.setData({
      isEditing: !isEditing,
      // Reset edit form data when entering edit mode
      editGame: {
        title: game.title,
        date: game.date,
        time: game.time,
        location: game.location,
        rules: game.rules,
        matchupMethod: game.matchupMethod,
        maxPlayers: game.maxPlayers,
        courtCount: game.courtCount
      }
    });
  },
  
  // Cancel editing and return to view mode
  onCancelEdit: function() {
    this.setData({ isEditing: false });
  },

  // Delete game (only for owner)
  deleteGame: function() {
    const { game } = this.data;
    
    // Show confirmation dialog
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该活动吗？此操作不可撤销。',
      confirmText: '删除',
      confirmColor: '#E64340',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // User confirmed, delete the game
          const app = getApp();
          const allGames = app.globalData.games || [];
          const gameIndex = allGames.findIndex(g => g.id === game.id);
          
          if (gameIndex !== -1) {
            // Remove game from global games array
            allGames.splice(gameIndex, 1);
            
            // Update global data
            app.globalData.games = allGames;
            console.log('Game deleted. Remaining games:', app.globalData.games.length);
            
            wx.showToast({
              title: '删除成功',
              icon: 'success',
              duration: 1500,
              complete: () => {
                // Make sure we navigate back to refresh the game list
                wx.navigateBack({
                  success: () => {
                    console.log('Successfully navigated back after game deletion');
                  },
                  fail: (err) => {
                    console.error('Failed to navigate back after game deletion', err);
                    // If navigateBack fails, try to redirect instead
                    wx.redirectTo({
                      url: '/pages/game-signup/game-signup'
                    });
                  }
                });
              }
            });
          } else {
            wx.showToast({
              title: '删除失败',
              icon: 'error'
            });
          }
        }
      }
    });
  },
});
