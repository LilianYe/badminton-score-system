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
        isEmpty: true
    },

    onShow: function() {
        this.checkUserAndLoadData();
    },

    async checkUserAndLoadData() {
        const currentUser = await app.getCurrentUser();
        if (currentUser && currentUser.nickname) {
            this.setData({ currentUser });
            this.loadMatches(currentUser.nickname);
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

            const userUpcomingMatches = upcomingRes.data.filter(match =>
                [match.PlayerNameA1, match.PlayerNameA2, match.PlayerNameB1, match.PlayerNameB2, match.RefereeName].includes(currentUserName)
            );

            const processedUpcomingMatches = userUpcomingMatches.map(match => ({
                ...match,
                formattedStartTime: formatTime(match.StartTime)
            }));

            // Load completed matches (CompleteTime is not null)
            const completedRes = await db.collection('Match').where({
                CompleteTime: _.neq(null)
            }).orderBy('CompleteTime', 'desc').get();

            const userCompletedMatches = completedRes.data.filter(match =>
                [match.PlayerNameA1, match.PlayerNameA2, match.PlayerNameB1, match.PlayerNameB2, match.RefereeName].includes(currentUserName)
            );

            const processedCompletedMatches = userCompletedMatches.map(match => {
                let result = '';
                const isPlayerA = [match.PlayerNameA1, match.PlayerNameA2].includes(currentUserName);
                const isPlayerB = [match.PlayerNameB1, match.PlayerNameB2].includes(currentUserName);

                if (isPlayerA) {
                    result = match.ScoreA > match.ScoreB ? 'Win' : 'Loss';
                } else if (isPlayerB) {
                    result = match.ScoreB > match.ScoreA ? 'Win' : 'Loss';
                } else {
                    result = 'Referee';
                }
                
                if (match.ScoreA === match.ScoreB) result = 'Draw';

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
            wx.navigateTo({
                url: `/pages/newGame/newGame?matchId=${matchId}&editMode=true`
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
    }
}); 