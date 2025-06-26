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
        showMatches: true
    },

    onShow: function() {
        this.checkUserAndLoadData();
    },

    async checkUserAndLoadData() {
        try {
            const currentUser = UserService.getCurrentUser();
            if (currentUser && currentUser.Name) {
                console.log('Current user found:', currentUser);
                this.setData({ currentUser });
                await this.loadMatches(currentUser.Name);
                await this.loadUserStats(currentUser.Name);
            } else {
                console.log('No current user found, redirecting to login');
                wx.showToast({
                    title: '请先登录',
                    icon: 'none'
                });
                this.setData({ 
                    isLoading: false, 
                    upcomingMatches: [], 
                    completedMatches: [], 
                    isEmpty: true,
                    currentUser: null 
                });
                
                // Redirect to login page
                setTimeout(() => {
                    wx.navigateTo({
                        url: '/pages/user-login/user-login'
                    });
                }, 1500);
            }
        } catch (error) {
            console.error('Error checking user:', error);
            wx.showToast({
                title: '登录检查失败',
                icon: 'none'
            });
        }
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
                this.setData({
                    userStats: {
                        ...stats,
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

    editScore: function(e) {
        const matchId = e.currentTarget.dataset.matchid;
        console.log('=== EDIT SCORE DEBUG ===');
        console.log('Raw matchId from dataset:', matchId, 'type:', typeof matchId);
        
        const match = this.data.upcomingMatches.find(m => m.MatchId === matchId);
        console.log('Found match:', match);
        console.log('Available matches:', this.data.upcomingMatches.map(m => ({ MatchId: m.MatchId, _id: m._id })));
        console.log('=== END EDIT SCORE DEBUG ===');
        
        if (match) {
            this.setData({
                showScoreInput: true,
                editingMatchId: matchId,
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
        
        this.completeMatch(editingMatchId, scoreA, scoreB);
    },

    // Cancel score input
    cancelScore: function() {
        this.setData({
            showScoreInput: false,
            editingMatchId: null,
            teamAScore: '',
            teamBScore: ''
        });
    },

    async completeMatch(matchId, scoreA, scoreB) {
        try {
            console.log('=== MY-PROFILE COMPLETE MATCH DEBUG ===');
            console.log('my-profile received matchId:', matchId, 'type:', typeof matchId);
            console.log('my-profile received scoreA:', scoreA, 'type:', typeof scoreA);
            console.log('my-profile received scoreB:', scoreB, 'type:', typeof scoreB);
            
            // Use MatchService to update match scores
            await MatchService.updateMatchScores(matchId, scoreA, scoreB);
            
            console.log('=== END MY-PROFILE COMPLETE MATCH DEBUG ===');
            
            wx.showToast({
                title: '比赛完成',
                icon: 'success'
            });
            
            this.setData({
                showScoreInput: false,
                editingMatchId: null,
                teamAScore: '',
                teamBScore: ''
            });
            
            // Reload matches to reflect changes
            if (this.data.currentUser) {
                await this.loadMatches(this.data.currentUser.Name);
            }
        } catch (error) {
            console.error('Error completing match:', error);
            wx.showToast({
                title: error.message || '完成比赛失败',
                icon: 'none'
            });
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