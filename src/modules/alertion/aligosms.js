// aligosms.js
const aligoapi = require('aligoapi');

// 실제 환경에 맞는 AuthData 설정 (API Key 등)
const AuthData = {
  key: process.env.ALIGO_API_KEY,
  userid: process.env.ALIGO_USER_ID, // 주의: user_id가 아니라 userid 입니다!
};

const sendSMS = async (receiver, msg, title = '알림') => {
  try {
    // 1. 수신 번호 맨 앞의 '0'이 잘린 경우 복구 (예: 1040747704 -> 01040747704)
    let formattedReceiver = String(receiver);
    if (formattedReceiver.startsWith('10') && formattedReceiver.length === 10) {
      formattedReceiver = '0' + formattedReceiver;
    }

    // 2. Express의 req 객체를 완벽히 모방 (headers 추가)
    const req = {
      headers: {}, // 이거 없으면 aligoapi 내부에서 에러 처리하다 뻗습니다.
      body: {
        sender: '01090347700', // 알리고에 등록된 발신 번호
        receiver: formattedReceiver,
        msg: msg,
        title: title,
        testmode_yn: 'Y' // 테스트 모드는 여기에 넣어야 합니다!
      }
    };

    console.log(`[알리고 발송 준비] 수신번호: ${formattedReceiver}`);

    // 알리고 API 전송
    const result = await aligoapi.send(req, AuthData);
    
    console.log('[알리고 API 응답]:', result);
    return result;

  } catch (err) {
    console.error('❌ SMS 발송 실패:', err);
    throw err;
  }
};

module.exports = { sendSMS };