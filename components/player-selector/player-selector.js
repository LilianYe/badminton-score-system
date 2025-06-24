Component({
  properties: {
    players: {
      type: Array,
      value: []
    },
    selectedPlayerId: {
      type: String,
      value: ''
    },
    placeholder: {
      type: String,
      value: 'Select player'
    }
  },

  data: {
    isOpen: false,
    searchValue: '',
    filteredPlayers: [],
    selectedPlayerName: '',
    selectedPlayerGender: '',
    processedPlayers: [] // 存储处理后的玩家数据
  },

  observers: {
    'players, selectedPlayerId, searchValue': function(players, selectedPlayerId, searchValue) {
      // 先过滤玩家列表
      let filteredList = players;
      if (searchValue) {
        filteredList = this.filterPlayersBySearch(players, searchValue);
      }
      
      // 处理每个玩家对象，添加预计算的类名和性别标签
      const processedList = filteredList.map(player => {
        const isSelected = player.id === selectedPlayerId;
        const isFemale = player.gender === 'female';
        
        // 构建类名字符串
        let className = 'player-item';
        if (isSelected) className += ' selected';
        if (isFemale) className += ' female-player';
        
        // 确定性别标签
        const genderLabel = isFemale ? 'F' : 'M';
          // 返回带有附加属性的玩家对象
        return {
          ...player,
          className: className,
          genderLabel: genderLabel
        };
      });
        // 更新数据
      this.setData({
        filteredPlayers: filteredList,
        processedPlayers: processedList
      });
      
      // 查找选中的玩家并更新显示数据
      if (selectedPlayerId && players) {
        const selectedPlayer = players.find(p => p.id === selectedPlayerId);
        if (selectedPlayer) {
          this.setData({
            selectedPlayerName: selectedPlayer.name,
            selectedPlayerGender: selectedPlayer.gender || 'male'
          });
        }
      }
    }
  },

  lifetimes: {
    attached() {
      // 初始化处理后的玩家列表
      const processedList = this.properties.players.map(player => {
        const isSelected = player.id === this.properties.selectedPlayerId;
        const isFemale = player.gender === 'female';
        
        let className = 'player-item';
        if (isSelected) className += ' selected';
        if (isFemale) className += ' female-player';
          const genderLabel = isFemale ? 'F' : 'M';
        
        return {
          ...player,
          className: className,
          genderLabel: genderLabel
        };
      });
      
      this.setData({
        filteredPlayers: this.properties.players,
        processedPlayers: processedList
      });
      
      // 初始化选中的玩家信息
      if (this.properties.selectedPlayerId && this.properties.players) {
        const selectedPlayer = this.properties.players.find(
          p => p.id === this.properties.selectedPlayerId
        );
        if (selectedPlayer) {          this.setData({
            selectedPlayerName: selectedPlayer.name,
            selectedPlayerGender: selectedPlayer.gender || 'male'
          });
        }
      }
    }
  },

  methods: {
    toggleDropdown() {
      this.setData({
        isOpen: !this.data.isOpen
      });
    },    filterPlayersBySearch(players, searchText) {
      const value = searchText.toLowerCase();
      return players.filter(player => {
        return player.name.toLowerCase().includes(value);
      });
    },

    search(e) {
      const value = e.detail.value.toLowerCase();
      
      // 仅更新搜索值，观察器会处理过滤和预处理
      this.setData({
        searchValue: value
      });
    },

    selectPlayer(e) {
      const selectedId = e.currentTarget.dataset.id;
      
      // 查找选中的玩家
      const selected = this.properties.players.find(p => p.id === selectedId);
      if (!selected) return;
        this.setData({
        isOpen: false,
        searchValue: '',
        selectedPlayerName: selected.name,
        selectedPlayerGender: selected.gender || 'male'
      });
      
      // 通知父组件关于选择
      this.triggerEvent('select', {
        playerId: selectedId,
        playerName: selected.name,
        playerIndex: this.properties.players.findIndex(p => p.id === selectedId)
      });
    },

    clearSelection() {
      this.setData({
        selectedPlayerName: '',
        selectedPlayerGender: ''
      });
      
      this.triggerEvent('select', {
        playerId: '',
        playerName: '',
        playerIndex: -1
      });
    },    // Method removed since we no longer need displayName
  }
})