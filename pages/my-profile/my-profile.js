const app = getApp();
const UserService = require('../../utils/user-service.js');
const MatchService = require('../../utils/match-service.js');

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
        needsLogin: false, // Add this property
        isProcessing: false // Add processing state
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
                await this.loadUserStats(currentUser.Name);
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
                
                this.setData({
                    userStats: {
                        ...stats,
                        ELO: elo, // Use the integer value
                        winRateDisplay: formatPercent(stats.WinRate),
                        sameGenderWinRateDisplay: formatPercent(stats.SameGenderWinRate),
                        mixedWinRateDisplay: formatPercent(stats.MixedWinRate)
                    },
                    sameGenderTitle
                });
            } else {
                this.setData({ userStats: null, sameGenderTitle: '同性统计' });
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
            }
        } catch (error) {
            console.error('Error checking match completion:', error);
            wx.showToast({
                title: '检查比赛状态失败',
                icon: 'none'
            });
            return;
        }

        // If not completed, proceed as before
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
            this.loadMatches(this.data.currentUser.Name).then(() => {
                wx.stopPullDownRefresh();
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