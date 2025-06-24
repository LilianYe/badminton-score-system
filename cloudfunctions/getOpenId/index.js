// Cloud function to get WeChat openid
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  
  try {
    console.log('Getting openid for user');
    console.log('WXContext:', wxContext);
    
    return {
      success: true,
      openid: wxContext.OPENID,
      appid: wxContext.APPID,
      unionid: wxContext.UNIONID,
      env: wxContext.ENV
    };
  } catch (error) {
    console.error('Error getting openid:', error);
    return {
      success: false,
      error: error.message
    };
  }
}; 