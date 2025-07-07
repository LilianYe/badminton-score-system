const app = getApp();
const UserService = require('../../utils/user-service.js');
const MatchService = require('../../utils/match-service.js');

// Cache constants for user stats
const USER_STATS_CACHE_KEY = 'USER_STATS_CACHE';
const USER_STATS_CACHE_EXPIRY_KEY = 'USER_STATS_CACHE_EXPIRY';
const USER_STATS_CACHE_USER_KEY = 'USER_STATS_CACHE_USER';
const CACHE_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

Page({
    data: {
        currentUser: null,
        activeTab: 'upcoming', // 'upcoming' or 'history'
        upcomingMatches: [],
        completedMatches: [],
        isLoading: false,
        isEmpty: true,
        showScoreInput: false,
        editingMatchId: null,
        teamAScore: '',
        teamBScore: '',
        userStats: null,
        showStats: true,
        sameGenderTitle: '同性统计',
        showMatches: true,
        needsLogin: false,
        isProcessing: false,
        lastStatsUpdate: null // Add timestamp for displaying when stats were last updated
    },

    onShow: function() {
        this.checkUserAndLoadData();
    },

    async checkUserAndLoadData() {
        try {
            const currentUser = UserService.getCurrentUser();
            if (currentUser && currentUser.Name) {
                console.log('Current user found:', currentUser);
                this.setData({ 
                    currentUser,
                    needsLogin: false 
                });
                await this.loadMatches(currentUser.Name);
                
                // Try to load user stats from cache first
                await this.loadUserStatsWithCache(currentUser.Name, false);
            } else {
                console.log('No current user found, showing login prompt');
                this.setData({ 
                    isLoading: false, 
                    upcomingMatches: [], 
                    completedMatches: [], 
                    isEmpty: true,
                    currentUser: null,
                    needsLogin: true
                });
                
                // No automatic redirect - we'll show a login button instead
            }
        } catch (error) {
            console.error('Error checking user:', error);
            wx.showToast({
                title: '登录检查失败',
                icon: 'none'
            });
        }
    },
    
    // Add new function to handle login button click
    navigateToLogin() {
        wx.navigateTo({
            url: '/pages/user-login/user-login'
        });
    },

    async loadMatches(currentUserName) {
        this.setData({ isLoading: true });

        try {
            // Use MatchService to get matches for current user
            const [upcomingMatches, completedMatches] = await Promise.all([
                MatchService.getUpcomingMatchesForUser(),
                MatchService.getCompletedMatchesForUser()
            ]);

            const currentMatches = this.data.activeTab === 'upcoming' ? upcomingMatches : completedMatches;
            
            this.setData({
                upcomingMatches: upcomingMatches,
                completedMatches: completedMatches,
                isEmpty: currentMatches.length === 0,
                isLoading: false
            });

        } catch (error) {
            console.error('Failed to load matches:', error);
            wx.showToast({
                title: '加载比赛失败',
                icon: 'none'
            });
            this.setData({ isLoading: false });
        }
    },

    // New function that decides whether to use cache or fetch from DB
    async loadUserStatsWithCache(nickname, forceRefresh = false) {
        if (!nickname) return;
        
        try {
            // Try to get stats from cache first, unless forcing a refresh
            if (!forceRefresh) {
                const cachedStats = this.getCachedUserStats(nickname);
                if (cachedStats) {
                    console.log('Using cached user stats');
                    return;
                }
            }
            
            // No valid cache or forceRefresh is true, load from database
            await this.loadUserStats(nickname);
            
        } catch (error) {
            console.error('Error in loadUserStatsWithCache:', error);
        }
    },
    
    // Get cached user stats if available and valid
    getCachedUserStats(nickname) {
        try {
            const cachedUser = wx.getStorageSync(USER_STATS_CACHE_USER_KEY);
            const cachedStatsString = wx.getStorageSync(USER_STATS_CACHE_KEY);
            const cachedExpiryTime = wx.getStorageSync(USER_STATS_CACHE_EXPIRY_KEY);
            
            // Verify cache is for current user and is not expired
            if (cachedUser === nickname && cachedStatsString && cachedExpiryTime) {
                const now = new Date().getTime();
                
                // Check if cache is still valid
                if (now < cachedExpiryTime) {
                    const cachedData = JSON.parse(cachedStatsString);
                    console.log('Found valid user stats cache from:', new Date(cachedData.timestamp));
                    
                    // Update state with cached data
                    const stats = cachedData.stats;
                    let sameGenderTitle = cachedData.sameGenderTitle;
                    
                    this.setData({
                        userStats: stats,
                        sameGenderTitle,
                        lastStatsUpdate: cachedData.timestamp
                    });
                    
                    return true;
                } else {
                    console.log('User stats cache expired, will fetch new data');
                    // Clear expired cache
                    this.clearUserStatsCache();
                }
            }
        } catch (error) {
            console.error('Error reading user stats from cache:', error);
            this.clearUserStatsCache();
        }
        
        return false;
    },
    
    // Save user stats to cache
    saveUserStatsToCache(nickname, stats, sameGenderTitle) {
        try {
            const timestamp = new Date().getTime();
            const cacheData = {
                stats: stats,
                sameGenderTitle: sameGenderTitle,
                timestamp: timestamp
            };
            
            // Calculate expiry time
            const expiryTime = timestamp + CACHE_DURATION_MS;
            
            // Save to storage
            wx.setStorageSync(USER_STATS_CACHE_USER_KEY, nickname);
            wx.setStorageSync(USER_STATS_CACHE_KEY, JSON.stringify(cacheData));
            wx.setStorageSync(USER_STATS_CACHE_EXPIRY_KEY, expiryTime);
            
            console.log('User stats cached successfully. Expires:', new Date(expiryTime));
            
            // Update timestamp in UI
            this.setData({
                lastStatsUpdate: timestamp
            });
        } catch (error) {
            console.error('Error saving user stats to cache:', error);
        }
    },
    
    // Clear user stats cache
    clearUserStatsCache() {
        try {
            wx.removeStorageSync(USER_STATS_CACHE_KEY);
            wx.removeStorageSync(USER_STATS_CACHE_EXPIRY_KEY);
            wx.removeStorageSync(USER_STATS_CACHE_USER_KEY);
            console.log('User stats cache cleared');
        } catch (error) {
            console.error('Error clearing user stats cache:', error);
        }
    },
    
    // Format timestamp to readable format
    formatLastUpdate(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        
        return `${month}月${day}日 ${hours}:${minutes}`;
    },

    // Modified to save stats to cache
    async loadUserStats(nickname) {
        const db = wx.cloud.database();
        function formatPercent(val) {
            if (typeof val !== 'number' || isNaN(val)) return '0.0';
            return (val * 100).toFixed(1);
        }
        try {
            const res = await db.collection('UserPerformance').where({ Name: nickname }).get();
            if (res.data && res.data.length > 0) {
                const stats = res.data[0];
                // Determine same gender title
                let sameGenderTitle = '同性统计';
                if (this.data.currentUser && this.data.currentUser.Gender) {
                    if (this.data.currentUser.Gender === 'male') {
                        sameGenderTitle = '男双';
                    } else if (this.data.currentUser.Gender === 'female') {
                        sameGenderTitle = '女双';
                    }
                }
                
                // Convert ELO to integer if it exists
                const elo = stats.ELO ? Math.round(stats.ELO) : stats.ELO;
                
                // Process stats for display
                const processedStats = {
                    ...stats,
                    ELO: elo, // Use the integer value
                    winRateDisplay: formatPercent(stats.WinRate),
                    sameGenderWinRateDisplay: formatPercent(stats.SameGenderWinRate),
                    mixedWinRateDisplay: formatPercent(stats.MixedWinRate)
                };
                
                this.setData({
                    userStats: processedStats,
                    sameGenderTitle
                });
                
                // Save to cache
                this.saveUserStatsToCache(nickname, processedStats, sameGenderTitle);
                
            } else {
                this.setData({ userStats: null, sameGenderTitle: '同性统计' });
                // Clear any existing cache since we have no data
                this.clearUserStatsCache();
            }
        } catch (error) {
            console.error('Failed to load user stats:', error);
            this.setData({ userStats: null, sameGenderTitle: '同性统计' });
        }
    },

    switchTab: function(e) {
        const tab = e.currentTarget.dataset.tab;
        this.setData({ 
            activeTab: tab,
            isEmpty: tab === 'upcoming' ? this.data.upcomingMatches.length === 0 : this.data.completedMatches.length === 0
        });
    },

    editScore: async function(e) {
        const matchId = e.currentTarget.dataset.matchid;
        console.log('=== EDIT SCORE DEBUG ===');
        console.log('Raw matchId from dataset:', matchId, 'type:', typeof matchId);

        // Query the database to check if the match has already been completed
        const db = wx.cloud.database();
        try {
            const res = await db.collection('Match').where({ MatchId: matchId }).get();
            if (res.data && res.data.length > 0) {
                const match = res.data[0];
                if (match.CompleteTime) {
                    wx.showToast({
                        title: '比分已被他人记录，请前往历史记录查看',
                        icon: 'none',
                        duration: 2000
                    });
                    // Reload upcoming matches
                    if (this.data.currentUser && this.data.currentUser.Name) {
                        await this.loadMatches(this.data.currentUser.Name);
                    }
                    return;
                }
                
                // Check if the current time is after the match start time
                const currentTime = new Date();
                const matchStartTime = match.StartTime ? new Date(match.StartTime) : null;
                
                if (matchStartTime && currentTime < matchStartTime) {
                    wx.showToast({
                        title: '比赛尚未开始，请等待开始时间后再记录比分',
                        icon: 'none',
                        duration: 2000
                    });
                    return;
                }
            }
        } catch (error) {
            console.error('Error checking match completion:', error);
            wx.showToast({
                title: '检查比赛状态失败',
                icon: 'none'
            });
            return;
        }

        // If not completed and after start time, proceed as before
        const match = this.data.upcomingMatches.find(m => m.MatchId === matchId);
        console.log('Found match:', match);
        console.log('Available matches:', this.data.upcomingMatches.map(m => ({ MatchId: m.MatchId, _id: m._id })));
        console.log('=== END EDIT SCORE DEBUG ===');

        if (match) {
            this.setData({
                showScoreInput: true,
                editingMatchId: matchId,
                currentMatch: match, // Store the current match data for display
                teamAScore: '',
                teamBScore: ''
            });
        }
    },

    // Handle Team A score input
    onTeamAScoreInput: function(e) {
        this.setData({
            teamAScore: e.detail.value
        });
    },

    // Handle Team B score input
    onTeamBScoreInput: function(e) {
        this.setData({
            teamBScore: e.detail.value
        });
    },

    // Confirm score input
    confirmScore: function() {
        // Prevent multiple submissions
        if (this.data.isProcessing) {
            return;
        }
        
        const { teamAScore, teamBScore, editingMatchId } = this.data;
        
        const scoreA = parseInt(teamAScore);
        const scoreB = parseInt(teamBScore);
        
        if (isNaN(scoreA) || scoreA < 0) {
            wx.showToast({
                title: '请输入有效的A队分数',
                icon: 'none'
            });
            return;
        }
        
        if (isNaN(scoreB) || scoreB < 0) {
            wx.showToast({
                title: '请输入有效的B队分数',
                icon: 'none'
            });
            return;
        }
        
        if (scoreA === scoreB) {
            wx.showToast({
                title: '分数不能相同',
                icon: 'none'
            });
            return;
        }

        // Badminton score validation
        const maxScore = Math.max(scoreA, scoreB);
        const minScore = Math.min(scoreA, scoreB);
        const scoreDiff = maxScore - minScore;

        // Check if at least one team reaches 21
        if (maxScore < 21) {
            wx.showToast({
                title: '至少有一队需要达到21分',
                icon: 'none'
            });
            return;
        }

        // Check if maximum score is 30
        if (maxScore > 30) {
            wx.showToast({
                title: '单局最高分为30分',
                icon: 'none'
            });
            return;
        }

        // Check win margin rules
        if (maxScore === 21) {
            // If winner reaches exactly 21, they must win by at least 2 points
            if (scoreDiff < 2) {
                wx.showToast({
                    title: '达到21分时需领先至少2分',
                    icon: 'none'
                });
                return;
            }
        } else if (maxScore > 21 && maxScore < 30) {
            // If winner reaches 22-29, they must win by exactly 2 points
            if (scoreDiff !== 2) {
                wx.showToast({
                    title: '22-29分时需领先恰好2分',
                    icon: 'none'
                });
                return;
            }
        } else if (maxScore === 30) {
            // If winner reaches 30, they win regardless of margin
            if (scoreDiff < 1) {
                wx.showToast({
                    title: '达到30分时需领先至少1分',
                    icon: 'none'
                });
                return;
            }
        }
        
        this.completeMatch(editingMatchId, scoreA, scoreB);
    },

    // Cancel score input
    cancelScore: function() {
        this.setData({
            showScoreInput: false,
            editingMatchId: null,
            currentMatch: null, // Clear the current match data
            teamAScore: '',
            teamBScore: '',
            isProcessing: false // Reset processing state
        });
    },

    async completeMatch(matchId, scoreA, scoreB) {
        // Set processing state
        this.setData({ isProcessing: true });
        
        try {
            // Final check: Verify the match hasn't been completed by someone else
            const db = wx.cloud.database();
            const finalCheck = await db.collection('Match').where({ MatchId: matchId }).get();
            
            if (finalCheck.data && finalCheck.data.length > 0) {
                const match = finalCheck.data[0];
                if (match.CompleteTime) {
                    // Match was completed by someone else while user was entering score
                    wx.showToast({
                        title: '比赛已被他人完成，请刷新查看',
                        icon: 'none',
                        duration: 3000
                    });
                    
                    this.setData({
                        showScoreInput: false,
                        editingMatchId: null,
                        currentMatch: null,
                        teamAScore: '',
                        teamBScore: '',
                        isProcessing: false
                    });
                    
                    // Reload matches to show updated status
                    if (this.data.currentUser) {
                        await this.loadMatches(this.data.currentUser.Name);
                    }
                    return;
                }
            }
            
            // Use MatchService to update match scores
            await MatchService.updateMatchScores(matchId, scoreA, scoreB);            
            wx.showToast({
                title: '比赛完成',
                icon: 'success'
            });
            
            this.setData({
                showScoreInput: false,
                editingMatchId: null,
                currentMatch: null, // Clear the current match data
                teamAScore: '',
                teamBScore: '',
                isProcessing: false // Reset processing state
            });
            
            // Reload matches and user stats to reflect changes
            if (this.data.currentUser) {
                await Promise.all([
                    this.loadMatches(this.data.currentUser.Name),
                    this.loadUserStats(this.data.currentUser.Name)
                ]);
            }
        } catch (error) {
            console.error('Error completing match:', error);
            
            // Check if the error is due to match already being completed
            if (error.message && error.message.includes('already completed')) {
                wx.showToast({
                    title: '比赛已被他人完成',
                    icon: 'none',
                    duration: 3000
                });
                
                // Reload matches to show updated status
                if (this.data.currentUser) {
                    await this.loadMatches(this.data.currentUser.Name);
                }
            } else {
                wx.showToast({
                    title: error.message || '完成比赛失败',
                    icon: 'none'
                });
            }
            
            // Reset processing state on error
            this.setData({ isProcessing: false });
        }
    },

    onPullDownRefresh() {
        if (this.data.currentUser) {
            Promise.all([
                this.loadMatches(this.data.currentUser.Name),
                this.loadUserStatsWithCache(this.data.currentUser.Name, true) // Force refresh stats
            ]).then(() => {
                wx.stopPullDownRefresh();
                wx.showToast({
                    title: '数据已更新',
                    icon: 'success'
                });
            });
        } else {
            wx.stopPullDownRefresh();
        }
    },

    toggleStats: function() {
        this.setData({ showStats: !this.data.showStats });
    },

    toggleMatches: function() {
        this.setData({ showMatches: !this.data.showMatches });
    }
});