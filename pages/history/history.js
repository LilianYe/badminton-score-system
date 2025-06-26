const app = getApp();
const UserService = require('../../utils/user-service.js');
const MatchService = require('../../utils/match-service.js');

Page({
    data: {
        currentUser: null,
        completedMatches: [],
        isLoading: false,
        isEmpty: false
    },

    onShow() {
        this.checkUserAndLoadData();
    },

    async checkUserAndLoadData() {
        try {
            const currentUser = UserService.getCurrentUser();
            if (currentUser && currentUser.Name) {
                this.setData({ currentUser });
                await this.loadMatches(currentUser.Name);
            } else {
                wx.showToast({
                    title: '请先登录',
                    icon: 'none'
                });
                this.setData({ 
                    isLoading: false, 
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
            // Use MatchService to get completed matches for current user
            const completedMatches = await MatchService.getCompletedMatchesForUser();

            this.setData({
                completedMatches: completedMatches,
                isEmpty: completedMatches.length === 0,
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

    onPullDownRefresh() {
        if (this.data.currentUser) {
            this.loadMatches(this.data.currentUser.Name).then(() => {
                wx.stopPullDownRefresh();
            });
        } else {
            wx.stopPullDownRefresh();
        }
    }
});