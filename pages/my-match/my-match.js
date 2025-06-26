const app = getApp();
const UserService = require('../../utils/user-service.js');
const MatchService = require('../../utils/match-service.js');

Page({
  data: {
    attentionMatches: [],
    isLoading: false,
    editMatchId: null,
    editScoreA: '',
    editScoreB: '',
    isSaving: false
  },
  onShow() {
    this.loadAttentionMatches();
  },
  async loadAttentionMatches() {
    this.setData({ isLoading: true });
    
    try {
      // Use MatchService to get upcoming matches for current user
      const matches = await MatchService.getUpcomingMatchesForUser();
      
      this.setData({ 
        attentionMatches: matches, 
        isLoading: false 
      });
      
      // Update tab bar red dot
      if (matches.length > 0) {
        wx.showTabBarRedDot({ index: 1 }); // Adjust index as needed
      } else {
        wx.hideTabBarRedDot({ index: 1 });
      }
    } catch (error) {
      console.error('Failed to load matches:', error);
      wx.showToast({ 
        title: error.message || 'Failed to load matches', 
        icon: 'none' 
      });
      this.setData({ isLoading: false });
    }
  },
  onEditTap(e) {
    const matchId = e.currentTarget.dataset.id;
    const match = this.data.attentionMatches.find(m => m._id === matchId);
    this.setData({
      editMatchId: matchId,
      editScoreA: match ? (match.ScoreA !== undefined ? match.ScoreA : '') : '',
      editScoreB: match ? (match.ScoreB !== undefined ? match.ScoreB : '') : '',
      isSaving: false
    });
  },
  onEditScoreAInput(e) {
    this.setData({ editScoreA: e.detail.value });
  },
  onEditScoreBInput(e) {
    this.setData({ editScoreB: e.detail.value });
  },
  async onSaveScore() {
    const { editMatchId, editScoreA, editScoreB } = this.data;
    
    if (!editMatchId) return;
    
    if (editScoreA === '' || editScoreB === '') {
      wx.showToast({ title: 'Please enter both scores', icon: 'none' });
      return;
    }
    
    this.setData({ isSaving: true });
    
    try {
      // Use MatchService to update match scores
      await MatchService.updateMatchScores(editMatchId, editScoreA, editScoreB);
      
      wx.showToast({ title: 'Scores saved', icon: 'success' });
      this.setData({ 
        editMatchId: null, 
        editScoreA: '', 
        editScoreB: '', 
        isSaving: false 
      });
      
      // Reload matches to reflect changes
      this.loadAttentionMatches();
    } catch (error) {
      console.error('Failed to save scores:', error);
      wx.showToast({ 
        title: error.message || 'Failed to save', 
        icon: 'none' 
      });
      this.setData({ isSaving: false });
    }
  },
  onCancelEdit() {
    this.setData({ 
      editMatchId: null, 
      editScoreA: '', 
      editScoreB: '' 
    });
  }
}); 