const app = getApp();

function formatTime(dateInput) {
  if (!dateInput) return '';
  let d;
  if (typeof dateInput === 'string') {
    d = new Date(dateInput);
  } else if (typeof dateInput === 'number') {
    d = new Date(dateInput);
  } else {
    return '';
  }
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
    const db = wx.cloud.database();
    const _ = db.command;
    const currentUser = app.globalData.userInfo;
    if (!currentUser || !currentUser.nickname) {
      wx.showToast({ title: 'Please log in first', icon: 'none' });
      this.setData({ isLoading: false });
      return;
    }
    const currentUserName = currentUser.nickname;
    try {
      const res = await db.collection('Match').where({ CompleteTime: _.eq(null) }).get();
      const matches = res.data.filter(match =>
        [match.PlayerNameA1, match.PlayerNameA2, match.PlayerNameB1, match.PlayerNameB2, match.RefereeName].includes(currentUserName)
      ).map(match => {
        // Parse and format StartTime robustly
        let startTime = '';
        if (match.StartTime) {
          let raw = match.StartTime;
          if (typeof raw === 'object' && raw.$date) {
            startTime = formatTime(raw.$date);
            console.log('Parsed StartTime from $date:', raw.$date, '->', startTime);
          } else if (typeof raw === 'string' || typeof raw === 'number') {
            startTime = formatTime(raw);
            console.log('Parsed StartTime from string/number:', raw, '->', startTime);
          } else {
            // Try to coerce to string and parse
            try {
              startTime = formatTime(String(raw));
              console.log('Parsed StartTime from coerced string:', String(raw), '->', startTime);
            } catch (e) {
              console.log('Unknown StartTime format:', raw);
            }
          }
        }
        return { ...match, formattedStartTime: startTime };
      });
      this.setData({ attentionMatches: matches, isLoading: false });
      if (matches.length > 0) {
        wx.showTabBarRedDot({ index: 1 }); // Adjust index as needed
      } else {
        wx.hideTabBarRedDot({ index: 1 });
      }
    } catch (error) {
      console.error('Failed to load matches:', error);
      wx.showToast({ title: 'Failed to load matches', icon: 'none' });
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
    const { editMatchId, editScoreA, editScoreB, attentionMatches } = this.data;
    if (!editMatchId) return;
    if (editScoreA === '' || editScoreB === '') {
      wx.showToast({ title: 'Please enter both scores', icon: 'none' });
      return;
    }
    this.setData({ isSaving: true });
    const db = wx.cloud.database();
    try {
      const match = attentionMatches.find(m => m._id === editMatchId);
      if (!match) {
        wx.showToast({ title: 'Match not found', icon: 'none' });
        this.setData({ isSaving: false });
        return;
      }
      const now = new Date();
      console.log('[DEBUG] Updating match:', {
        _id: editMatchId,
        ScoreA: Number(editScoreA),
        ScoreB: Number(editScoreB),
        CompleteTime: now,
        updatedTime: now
      });
      const updateRes = await db.collection('Match').doc(editMatchId).update({
        data: {
          ScoreA: Number(editScoreA),
          ScoreB: Number(editScoreB),
          CompleteTime: now,
          updatedAt: now
        }
      });
      console.log('[DEBUG] Update result:', updateRes);
      wx.showToast({ title: 'Scores saved', icon: 'success' });
      this.setData({ editMatchId: null, editScoreA: '', editScoreB: '', isSaving: false });
      this.loadAttentionMatches();
    } catch (error) {
      console.error('[DEBUG] Failed to save scores:', error);
      wx.showToast({ title: 'Failed to save', icon: 'none' });
      this.setData({ isSaving: false });
    }
  },
  onCancelEdit() {
    this.setData({ editMatchId: null, editScoreA: '', editScoreB: '' });
  }
}); 