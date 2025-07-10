Page({  data: {
    game: null,
    isNavigating: false,
    isOwner: false, // New property to track if current user is the owner
    isEditing: false, // Track if we're in edit mode
    isLoading: false, // Track loading state for cloud operations
    hasGeneratedMatches: false, // Track if game already has generated matches
    // Edit game data
    editGame: {
      title: '',
      date: '',
      startTime: '',
      endTime: '',
      location: '',
      rules: '',
      maxPlayers: 0,
      courtCount: 0
    }
  },

  onLoad: function(options) {
    console.log('Game Detail page loaded', options);
    
    // Import the CloudDBService
    const CloudDBService = require('../../utils/cloud-db.js');
    
    // Make sure cloud database is initialized
    CloudDBService.init();
    
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

  // Refresh game data when returning to this page
  onShow: function() {
    console.log('Game Detail page shown/returned to');
    
    // Refresh game data from cloud if we have a game id
    const { game } = this.data;
    if (game && game.id) {
      this.loadGameById(game.id);
    }
  },
  
  loadGameById: async function(gameId) {
    // Set loading state
    this.setData({ isLoading: true });
    
    try {
      wx.showLoading({
        title: '加载活动...',
        mask: true
      });
      
      // Import the CloudDBService
      const CloudDBService = require('../../utils/cloud-db.js');
      
      // Ensure cloud database is initialized
      CloudDBService.ensureInit();
      
      // Fetch the game from cloud database
      const game = await CloudDBService.getGameById(gameId);
      
      if (game) {
        // Get current user to check ownership
        const app = getApp();
        const currentUser = await app.getCurrentUser();
        let isOwner = false;
        
        if (currentUser && game.owner) {
          // Check if current user is the owner
          isOwner = currentUser.Name === game.owner.Name;
          console.log('Owner check:', isOwner, currentUser.Name, game.owner.Name);
        }
          // Set game data and owner status
        this.setData({ 
          game, 
          isOwner,
          // Check if this game already has generated matches
          hasGeneratedMatches: game.status === 'matched' || game.status === 'playing',
          // Initialize edit game data
          editGame: {
            title: game.title,
            date: game.date,
            startTime: game.startTime,
            endTime: game.endTime,
            location: game.location,
            rules: game.rules,
            maxPlayers: game.maxPlayers,
            courtCount: game.courtCount
          }
        });
        
        // Update title in navigation bar
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
    } catch (error) {
      console.error('Error loading game from cloud:', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'error'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } finally {
      wx.hideLoading();
      this.setData({ isLoading: false });
    }
  },
  
  // Player management
  
  addPlayer: async function() {
    // Set loading state
    this.setData({ isLoading: true });
    
    try {
      wx.showLoading({
        title: '正在报名...',
        mask: true
      });
      
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
        player.name === currentUser.Name
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
        name: currentUser.Name,
        gender: currentUser.Gender || 'male',
        avatar: currentUser.Avatar || '/assets/icons/user.png'
      };
      
      // Import the GameService
      const GameService = require('../../utils/game-service.js');
      
      // Add player to game using GameService directly
      const updatedGame = await GameService.addPlayerToGame(game.id, newPlayer);
      
      if (updatedGame) {
        // Update local state with the updated game
        this.setData({
          game: updatedGame
        });
        
        // Also update in globalData for consistency
        const allGames = app.globalData.games || [];
        const gameIndex = allGames.findIndex(g => g.id === game.id);
        if (gameIndex !== -1) {
          app.globalData.games[gameIndex] = updatedGame;
        }
        
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
    } catch (error) {
      console.error('Error adding player to game:', error);
      wx.showToast({
        title: error.message || '报名失败',
        icon: 'error'
      });
    } finally {
      wx.hideLoading();
      this.setData({ isLoading: false });
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
    if (!(isOwner || (playerToRemove.name === currentUser.Name))) {
      wx.showToast({
          title: "您没有权限移除其他球员",
          icon: 'none'
      });
      return;
    }
    
    // Determine the confirmation message based on whether user is removing themselves or another player
    const isSelf = playerToRemove.name === currentUser.Name;
    const confirmTitle = isSelf ? '确认退出' : '确认移除球员';
    const confirmContent = isSelf 
      ? '确定要退出该活动吗？'
      : `确定要移除球员 ${playerToRemove.name} 吗？`;
    
    // Show confirmation dialog
    wx.showModal({
      title: confirmTitle,
      content: confirmContent,
      confirmText: isSelf ? '退出' : '移除',
      confirmColor: '#E64340',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          // If confirmed, proceed with player removal
          await this.performPlayerRemoval(index);
        }
      }
    });
  },
  
  // New function to perform the actual player removal after confirmation
  performPlayerRemoval: async function(index) {
    // Set loading state
    this.setData({ isLoading: true });
    
    try {
      wx.showLoading({
        title: '正在处理...',
        mask: true
      });
      
      const { game } = this.data;
      const playerToRemove = game.players[index];
      
      // Import the GameService
      const GameService = require('../../utils/game-service.js');
      const updatedGame = await GameService.removePlayerFromGame(game.id, index);
        
      if (updatedGame) {
        // Update local state with the updated game
        this.setData({
          game: updatedGame
        });
        
        // Also update in globalData for consistency
        const app = getApp();
        const allGames = app.globalData.games || [];
        const gameIndex = allGames.findIndex(g => g.id === game.id);
        if (gameIndex !== -1) {
          app.globalData.games[gameIndex] = updatedGame;
        }
        
        // Check if game status has changed from "matched" to "active"
        // This may happen when removing players affects match generation status
        if (game.status === 'matched' && updatedGame.status === 'active') {
          // Also update the hasGeneratedMatches state to reflect the new status
          this.setData({
            hasGeneratedMatches: false
          });
        } 
        
        // Show standard success message
        wx.showToast({
          title: `已${playerToRemove.name === app.getCurrentUser().Name ? '退出' : '移除'}球员`,
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: '操作失败',
          icon: 'error'
        });
      }       
    } catch (error) {
      console.error('Error removing player from game:', error);
      wx.showToast({
        title: error.message || '操作失败',
        icon: 'error'
      });
    } finally {
      wx.hideLoading();
      this.setData({ isLoading: false });
    }
  },
  
  // Navigate to match generation or view existing matches
  navigateToGenerate: function() {
    console.log('navigateToGenerate function called, hasGeneratedMatches:', this.data.hasGeneratedMatches);
    const { game, isOwner, hasGeneratedMatches } = this.data;
    
    console.log('Current game:', game);
    console.log('Is owner:', isOwner);
    
    if (!game || game.players.length < 2) {
      console.log('Not enough players:', game?.players?.length);
      wx.showToast({
        title: '至少需要2名球员',
        icon: 'none'
      });
      return;
    }

    // If matches aren't generated and user is not owner, show reminder but don't navigate
    if (!hasGeneratedMatches && !isOwner) {
      console.log('Permission denied: Not owner and trying to generate matches');
      wx.showToast({
        title: '只有活动创建者可以生成对阵表',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // Set loading state
    this.setData({ isNavigating: true });
    console.log('Setting isNavigating to true, hasGeneratedMatches:', this.data.hasGeneratedMatches);
    
    try {
      // Store the complete player data for match generation
      const app = getApp();
      app.globalData = app.globalData || {};
      console.log('App global data before:', JSON.stringify(app.globalData));
      
      // Extract player names and complete player data
      const playerNames = game.players.map(p => p.name);
      console.log('Player names:', playerNames);
      
      // Store player names for match generation input
      app.globalData.signupPlayers = playerNames;
      
      // Store full player data for more advanced usage
      app.globalData.signupPlayerData = game.players;
      
      // Store female player set for gender balancing
      const femalePlayers = [];
      game.players.forEach(player => {
        if (player.gender === 'female') {
          femalePlayers.push(player.name);
        }
      });
      app.globalData.femalePlayerSet = femalePlayers;
      console.log('Female players:', femalePlayers);
      
      // Store court count for match generation
      app.globalData.courtCount = game.courtCount || 2;
      console.log('Court count:', app.globalData.courtCount);
      
      // Store game ID for match generation and session tracking
      app.globalData.currentGameId = game.id;
      console.log('Game ID for matches:', app.globalData.currentGameId);
      
      console.log('App global data after setup:', JSON.stringify(app.globalData));
      
      // Determine which page to navigate to based on whether matches exist
      const targetUrl = hasGeneratedMatches
        ? '/pages/my-match/my-match?gameId=' + game.id  // Navigate to my-match page for viewing existing matches
        : '/pages/generate-match/generate-match?fromSignup=true&gameId=' + game.id;  // Navigate to generate-match page for creating new matches
    
      console.log('Navigating to: ' + targetUrl);
      
      wx.navigateTo({
        url: targetUrl,
        success: function(res) {
          console.log('Navigation successful:', res);
        },
        fail: function(err) {
          console.error('Navigation failed:', err);
          wx.showToast({
            title: '导航失败: ' + err.errMsg,
            icon: 'none',
            duration: 2000
          });
        }
      });
    } catch (e) {
      console.error('Error navigating to generate page:', e);
      wx.showToast({
        title: '发生错误，请重试',
        icon: 'none',
        duration: 2000
      });
    } finally {
      // Reset navigating state
      setTimeout(() => {
        this.setData({ isNavigating: false });
      }, 500);
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
        startTime: game.startTime,
        endTime: game.endTime,
        location: game.location,
        rules: game.rules,
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
  
  onSaveGameDetails: async function() {
    // Set loading state
    this.setData({ isLoading: true });
    
    try {
      wx.showLoading({
        title: '保存中...',
        mask: true
      });
      
      const { editGame, game } = this.data;
      
      // Validate required fields
      if (!editGame.title || !editGame.date || !editGame.startTime || !editGame.endTime) {
        wx.showToast({
          title: '请填写所有必填项',
          icon: 'none'
        });
        return;
      }
      
      // Validate time logic: end time should be after start time
      const convertTimeToMinutes = (timeString) => {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
      };
      
      const startMinutes = convertTimeToMinutes(editGame.startTime);
      const endMinutes = convertTimeToMinutes(editGame.endTime);
      
      if (endMinutes <= startMinutes) {
        wx.showToast({
          title: '结束时间必须晚于开始时间',
          icon: 'none'
        });
        return;
      }
      
      // Import the CloudDBService
      const CloudDBService = require('../../utils/cloud-db.js');
      
      // Ensure cloud database is initialized
      CloudDBService.ensureInit();
      
      // Update game in cloud database
      await CloudDBService.updateGame(game.id, editGame);
      const updatedGame = await CloudDBService.getGameById(game.id);
      
      if (updatedGame) {
        // Update local state
        this.setData({
          game: updatedGame,
          isEditing: false // Exit edit mode
        });
        
        // Also update in globalData for consistency
        const app = getApp();
        const allGames = app.globalData.games || [];
        const gameIndex = allGames.findIndex(g => g.id === game.id);
        if (gameIndex !== -1) {
          app.globalData.games[gameIndex] = updatedGame;
        }
        
        // Update navigation title
        wx.setNavigationBarTitle({
          title: updatedGame.title || '活动详情'
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
    } catch (error) {
      console.error('Error updating game:', error);
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'error'
      });
    } finally {
      wx.hideLoading();
      this.setData({ isLoading: false });
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
        startTime: game.startTime,
        endTime: game.endTime,
        location: game.location,
        rules: game.rules,
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
      success: async (res) => {
        if (res.confirm) {
          // Set loading state
          this.setData({ isLoading: true });
          
          try {
            wx.showLoading({
              title: '删除中...',
              mask: true
            });
            
            // Import the CloudDBService
            const CloudDBService = require('../../utils/cloud-db.js');
            
            // Ensure cloud database is initialized
            CloudDBService.ensureInit();
            
            // Delete game from cloud database
            const success = await CloudDBService.deleteGame(game.id);
            
            if (success) {
              // Also update in globalData for consistency
              const app = getApp();
              const allGames = app.globalData.games || [];
              const gameIndex = allGames.findIndex(g => g.id === game.id);
              if (gameIndex !== -1) {
                allGames.splice(gameIndex, 1);
                app.globalData.games = allGames;
              }
              
              console.log('Game deleted. Remaining games in globalData:', app.globalData.games.length);
              
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
          } catch (error) {
            console.error('Error deleting game:', error);
            wx.showToast({
              title: error.message || '删除失败',
              icon: 'error'
            });
          } finally {
            wx.hideLoading();
            this.setData({ isLoading: false });
          }
        }
      }
    });
  },
  
  // Navigate back to game-signup page
  navigateToGameSignup: function() {
    console.log('Navigating to game signup page');
    
    // Show loading toast
    wx.showLoading({
      title: '正在返回...',
      mask: true
    });
    
    try {
      // Use switchTab for tabbar pages
      wx.switchTab({
        url: '/pages/game-signup/game-signup',
        success: function() {
          console.log('Navigation to game-signup successful');
          wx.hideLoading();
        },
        fail: function(error) {
          console.error('Failed to navigate to game-signup with switchTab:', error);
          wx.hideLoading();
          
          // Show error message
          wx.showToast({
            title: '返回失败，请手动点击底部标签栏',
            icon: 'none',
            duration: 2000
          });
        }
      });
    } catch (e) {
      console.error('Exception during navigation:', e);
      wx.hideLoading();
      wx.showToast({
        title: '发生错误，请手动返回',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // Enable sharing for this page
  onShareAppMessage: function(res) {
    const { game } = this.data;
    
    if (res.from === 'button') {
      // Shared from a button
      console.log('Shared from button:', res.target);
    }
    
    if (game) {
      return {
        title: `邀请你参加羽毛球活动：${game.title}`,
        path: `/pages/game-detail/game-detail?id=${game.id}`,
        imageUrl: '' // You can add a custom share image here
      };
    }
    
    return {
      title: '一起来打羽毛球吧！',
      path: '/pages/game-signup/game-signup',
      imageUrl: ''
    };
  },

  // Enable sharing to moments
  onShareTimeline: function() {
    const { game } = this.data;
    
    return {
      title: game ? `羽毛球活动：${game.title}` : '羽毛球天梯助手',
      imageUrl: ''
    };
  }
});
