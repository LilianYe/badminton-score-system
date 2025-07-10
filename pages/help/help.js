Page({
  data: {
    currentStep: 0,
    totalSteps: 5,
    steps: [
      {
        id: 'step-1',
        stepNumber: 1,
        title: '📱 首次登录',
        subtitle: '开始您的羽毛球之旅',
        content: [
          '1. 点击"我的"，点击"立即登录"按钮',
          '2. 授权微信账号信息',
          '3. 设置您的昵称',
          '4. 选择性别（影响双打配对）',
          '5. 上传头像'
        ],
        tip: '💡 提示：完整的个人信息有助于更好的比赛体验',
        action: '完成后进入下一步'
      },
      {
        id: 'step-2',
        stepNumber: 2,
        title: '🏸 加入活动',
        subtitle: '找到合适的羽毛球活动',
        content: [
          '1. 在"报名"页面浏览当前活动列表',
          '2. 点击感兴趣的活动卡片查看详情',
          '3. 确认时间、地点、人数等信息',
          '4. 点击"我要报名"按钮',
          '5. 等待其他球友加入'
        ],
        tip: '💡 提示：可以下拉刷新获取最新活动信息',
        action: '成功报名一个活动'
      },
      {
        id: 'step-3',
        stepNumber: 3,
        title: '🎯 生成对阵',
        subtitle: '当人数足够时开始配对',
        content: [
          '1. 等待活动人数达到要求（通常4人以上）',
          '2. 活动创建者点击"生成对阵表"',
          '3. 系统根据ELO分数智能配对',
          '4. 查看您的对战安排',
        ],
        tip: '💡 提示：ELO系统确保比赛的公平性和竞技性',
        action: '查看您的比赛安排'
      },
      {
        id: 'step-4',
        stepNumber: 4,
        title: '📊 记录比分',
        subtitle: '及时录入比赛结果',
        content: [
          '1. 一场羽毛球比赛结束后，打开"我的"页面',
          '2. 在"待进行"中找到刚完成的比赛',
          '3. 点击"记录比分"按钮',
          '4. 输入双方的准确比分',
          '5. 确认提交比分结果'
        ],
        tip: '💡 提示：请及时记录比分，避免遗忘影响排名计算',
        action: '成功记录一场比赛比分'
      },
      {
        id: 'step-5',
        stepNumber: 5,
        title: '🏆 查看排名与持续提升',
        subtitle: '了解水平进步，成为更优秀的羽毛球选手',
        content: [
          '1. 点击底部"排名"标签页查看整体ELO排行榜',
          '2. 在"我的"页面查看详细个人统计',
          '3. 在"历史"界面查看已结束活动的统计信息',
          '4. 参加更多活动，挑战更强对手',
          '5. 享受羽毛球带来的快乐和进步'
        ],
        tip: '💡 提示：ELO分数反映真实水平，坚持练习，每一场比赛都是进步的机会',
        action: '开始您的羽毛球进阶之路'
      }
    ],
    quickTips: [
      {
        icon: '📱',
        title: '下拉刷新',
        desc: '获取最新数据'
      },
      {
        icon: '👥',
        title: '分享活动',
        desc: '邀请朋友参加'
      },
      {
        icon: '⚡',
        title: '及时记分',
        desc: '比赛后立即录入'
      },
      {
        icon: '🏆',
        title: '公平竞技',
        desc: 'ELO智能匹配'
      }
    ],
    faq: [
      {
        question: '为什么无法记录比分？',
        answer: '请检查：1) 比赛是否已开始 2) 比分是否已被记录 3) 网络连接是否正常'
      },
      {
        question: 'ELO分数是如何计算的？',
        answer: '基于国际象棋ELO系统，战胜强者得分更多，败给弱者扣分更多，确保排名的准确性'
      },
      {
        question: '如何退出已报名的活动？',
        answer: '进入活动详情页，点击自己头像上的X符号即可。请提前退出，方便其他球友安排'
      },
      {
        question: '数据显示不是最新的怎么办？',
        answer: '尝试下拉刷新页面，系统会重新获取最新数据。如问题持续请联系开发者'
      }
    ]
  },

  onLoad: function() {
    wx.setNavigationBarTitle({
      title: '使用教程'
    });
  },

  // Navigate to specific step
  goToStep: function(e) {
    const stepIndex = e.currentTarget.dataset.step;
    this.setData({
      currentStep: stepIndex
    });
    
    // Scroll to the step
    wx.pageScrollTo({
      selector: `#step-${stepIndex + 1}`,
      duration: 300
    });
  },

  // Previous step
  prevStep: function() {
    if (this.data.currentStep > 0) {
      this.setData({
        currentStep: this.data.currentStep - 1
      });
      
      wx.pageScrollTo({
        selector: `#step-${this.data.currentStep + 1}`,
        duration: 300
      });
    }
  },

  // Next step
  nextStep: function() {
    if (this.data.currentStep < this.data.totalSteps - 1) {
      this.setData({
        currentStep: this.data.currentStep + 1
      });
      
      wx.pageScrollTo({
        selector: `#step-${this.data.currentStep + 1}`,
        duration: 300
      });
    }
  },

  // Navigate to specific section
  scrollToSection: function(e) {
    const sectionId = e.currentTarget.dataset.section;
    wx.pageScrollTo({
      selector: `#${sectionId}`,
      duration: 300
    });
  },

  // Start tutorial from beginning
  startTutorial: function() {
    this.setData({
      currentStep: 0
    });
    
    wx.pageScrollTo({
      selector: '#step-1',
      duration: 500
    });
  },

  // Copy contact info
  copyContact: function() {
    wx.setClipboardData({
      data: '如需技术支持，请联系开发者\n微信：qilixiangdeye',
      success: function() {
        wx.showToast({
          title: '联系方式已复制',
          icon: 'success'
        });
      }
    });
  },

  // Share help page
  onShareAppMessage: function() {
    return {
      title: '羽毛球天梯助手使用教程 - 从新手到高手',
      path: '/pages/help/help',
      imageUrl: ''
    };
  },

  // Share to moments
  onShareTimeline: function() {
    return {
      title: '羽毛球天梯助手使用教程',
      imageUrl: ''
    };
  }
});