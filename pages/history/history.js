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
        completedMatches: [],
        isLoading: false,
        isEmpty: true,
        currentUser: null,
    },

    onShow: function() {
        this.checkUserAndLoadHistory();
    },

    async checkUserAndLoadHistory() {
        const currentUser = await app.getCurrentUser();
        if (currentUser && currentUser.nickname) {
            this.setData({ currentUser });
            this.loadCompletedMatches(currentUser.nickname);
        } else {
            wx.showToast({
                title: 'Please log in first',
                icon: 'none'
            });
            this.setData({ isLoading: false, completedMatches: [], isEmpty: true });
        }
    },

    async loadCompletedMatches(currentUserName) {
        this.setData({ isLoading: true });
        const db = wx.cloud.database();
        const _ = db.command;

        try {
            const res = await db.collection('Match').where({
                CompleteTime: _.neq(null)
            }).orderBy('CompleteTime', 'desc').get();

            const userMatches = res.data.filter(match => {
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

            const processedMatches = userMatches.map(match => {
                let result = '';
                const isPlayerA = [match.PlayerNameA1?.name, match.PlayerNameA2?.name].includes(currentUserName);
                const isPlayerB = [match.PlayerNameB1?.name, match.PlayerNameB2?.name].includes(currentUserName);

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
            
            this.setData({
                completedMatches: processedMatches,
                isEmpty: processedMatches.length === 0,
                isLoading: false
            });

        } catch (error) {
            console.error('Failed to load completed matches:', error);
            wx.showToast({
                title: 'Failed to load history',
                icon: 'none'
            });
            this.setData({ isLoading: false });
        }
    },
    onPullDownRefresh() {
        if (this.data.currentUser) {
            this.loadCompletedMatches(this.data.currentUser.nickname).then(() => {
                wx.stopPullDownRefresh();
            });
        } else {
            wx.stopPullDownRefresh();
        }
    }
});