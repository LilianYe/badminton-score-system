const app = getApp();

function formatTime(dateInput) {
    if (!dateInput) return '';
    let d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const h = d.getHours().toString().padStart(2, '0');
    const min = d.getMinutes().toString().padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
}

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
        const currentUser = await app.getCurrentUser();
        if (currentUser && currentUser.nickname) {
            this.setData({ currentUser });
            this.loadMatches(currentUser.nickname);
            this.loadUserStats(currentUser.nickname);
        } else {
            wx.showToast({
                title: 'Please log in first',
                icon: 'none'
            });
            this.setData({ isLoading: false, upcomingMatches: [], completedMatches: [], isEmpty: true });
        }
    },

    async loadMatches(currentUserName) {
        this.setData({ isLoading: true });
        const db = wx.cloud.database();
        const _ = db.command;

        try {
            // Load upcoming matches (CompleteTime is null)
            const upcomingRes = await db.collection('Match').where({
                CompleteTime: null
            }).orderBy('StartTime', 'asc').get();

            const userUpcomingMatches = upcomingRes.data.filter(match => {
                // Check if current user is in any of the player fields (now objects)
                const playerNames = [
                    match.PlayerNameA1?.name,
                    match.PlayerNameA2?.name,
                    match.PlayerNameB1?.name,
                    match.PlayerNameB2?.name,
                    match.RefereeName
                ].filter(Boolean);
                
                return playerNames.includes(currentUserName);
            });

            const processedUpcomingMatches = userUpcomingMatches.map(match => ({
                ...match,
                formattedStartTime: formatTime(match.StartTime)
            }));

            // Load completed matches (CompleteTime is not null)
            const completedRes = await db.collection('Match').where({
                CompleteTime: _.neq(null)
            }).orderBy('CompleteTime', 'desc').get();

            const userCompletedMatches = completedRes.data.filter(match => {
                // Check if current user is in any of the player fields (now objects)
                const playerNames = [
                    match.PlayerNameA1?.name,
                    match.PlayerNameA2?.name,
                    match.PlayerNameB1?.name,
                    match.PlayerNameB2?.name,
                    match.RefereeName
                ].filter(Boolean);
                
                return playerNames.includes(currentUserName);
            });

            const processedCompletedMatches = userCompletedMatches.map(match => {
                let result = '';
                const playerNames = [
                    match.PlayerNameA1?.name,
                    match.PlayerNameA2?.name,
                    match.PlayerNameB1?.name,
                    match.PlayerNameB2?.name
                ].filter(Boolean);
                
                const isPlayerA = [match.PlayerNameA1?.name, match.PlayerNameA2?.name].includes(currentUserName);
                const isPlayerB = [match.PlayerNameB1?.name, match.PlayerNameB2?.name].includes(currentUserName);

                if (isPlayerA) {
                    result = match.ScoreA > match.ScoreB ? 'Win' : 'Loss';
                } else if (isPlayerB) {
                    result = match.ScoreB > match.ScoreA ? 'Win' : 'Loss';
                } else {
                    result = 'Referee';
                }

                return {
                    ...match,
                    formattedCompleteTime: formatTime(match.CompleteTime),
                    result: result
                };
            });

            const currentMatches = this.data.activeTab === 'upcoming' ? processedUpcomingMatches : processedCompletedMatches;
            
            this.setData({
                upcomingMatches: processedUpcomingMatches,
                completedMatches: processedCompletedMatches,
                isEmpty: currentMatches.length === 0,
                isLoading: false
            });

        } catch (error) {
            console.error('Failed to load matches:', error);
            wx.showToast({
                title: 'Failed to load matches',
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
                if (this.data.currentUser && this.data.currentUser.gender) {
                    if (this.data.currentUser.gender === 'male') {
                        sameGenderTitle = '男双';
                    } else if (this.data.currentUser.gender === 'female') {
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
        const match = this.data.upcomingMatches.find(m => m.MatchId === matchId);
        
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
                title: 'Invalid Team A score',
                icon: 'none'
            });
            return;
        }
        
        if (isNaN(scoreB) || scoreB < 0) {
            wx.showToast({
                title: 'Invalid Team B score',
                icon: 'none'
            });
            return;
        }
        
        // Check for equal scores (no draws in badminton)
        if (scoreA === scoreB) {
            wx.showToast({
                title: 'Scores cannot be equal. Badminton matches must have a winner.',
                icon: 'none'
            });
            return;
        }
        
        this.setData({
            showScoreInput: false,
            editingMatchId: null,
            teamAScore: '',
            teamBScore: ''
        });
        
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
        wx.showLoading({
            title: 'Completing match...'
        });

        try {
            const result = await wx.cloud.callFunction({
                name: 'completeMatch',
                data: {
                    matchId: matchId,
                    scoreA: scoreA,
                    scoreB: scoreB
                }
            });

            wx.hideLoading();

            if (result.result && result.result.success) {
                wx.showToast({
                    title: 'Match completed!',
                    icon: 'success'
                });

                // Refresh the data
                if (this.data.currentUser) {
                    this.loadMatches(this.data.currentUser.nickname);
                }
            } else {
                wx.showToast({
                    title: result.result?.error || 'Failed to complete match',
                    icon: 'none'
                });
            }
        } catch (error) {
            wx.hideLoading();
            console.error('Error completing match:', error);
            wx.showToast({
                title: 'Failed to complete match',
                icon: 'none'
            });
        }
    },

    onPullDownRefresh() {
        if (this.data.currentUser) {
            this.loadMatches(this.data.currentUser.nickname).then(() => {
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