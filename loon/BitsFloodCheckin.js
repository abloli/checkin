// ============ BitsFlood 每日自动签到（Loon）============
// BitsFlood 仿 NodeSeek，签到接口与 NodeSeek 同形：
//   POST https://bitsflood.com/api/attendance?random=true|false
// 用法：同一份代码在 Loon 里建两个本地脚本条目
//   1) 类型 cron，时间 10 9 * * *（每天 9:10）→ 每天定时签到
//   2) 类型 http-request，匹配 ^https://(www\.)?bitsflood\.com/ → 打开 BitsFlood 时自动保存 Cookie
//   并在 [MITM] 里加 hostname = bitsflood.com（抓 Cookie 才需要 MITM，且要信任证书）
// 注意：Cookie 失效时会通知，重新打开一次 BitsFlood 即可重新抓取。

var COOKIE_KEY = 'bitsflood_cookie';
var RANDOM = true; // true = 试试手气（随机鸡腿），false = 固定鸡腿

function notify(title, sub, body) {
  $notification.post(title, sub || '', body || '');
}

function finish(obj) {
  if (typeof $done === 'function') $done(obj || {});
}

// ---- 抓 Cookie 模式（http-request）----
if (typeof $request !== 'undefined' && $request) {
  var headers = $request.headers || {};
  var cookie = headers['Cookie'] || headers['cookie'];
  if (cookie) {
    var old = $persistentStore.read(COOKIE_KEY);
    if (old !== cookie) {
      $persistentStore.write(cookie, COOKIE_KEY);
      notify('BitsFlood', 'Cookie 已保存', '之后每天 9:10 会自动签到');
    }
  }
  finish({});
} else {
  // ---- 定时签到模式（cron）----
  var cookie = $persistentStore.read(COOKIE_KEY);
  if (!cookie) {
    notify('BitsFlood 签到', '没有 Cookie', '请先在登录状态下打开一次 BitsFlood');
    finish();
  } else {
    var url = 'https://bitsflood.com/api/attendance?random=' + (RANDOM ? 'true' : 'false');
    $httpClient.post({
      url: url,
      headers: {
        'Cookie': cookie,
        'Origin': 'https://bitsflood.com',
        'Referer': 'https://bitsflood.com/',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      },
      body: ''
    }, function (error, response, data) {
      if (error) {
        notify('BitsFlood 签到', '请求失败', String(error));
        finish();
        return;
      }
      try {
        var obj = JSON.parse(data);
        var msg = obj.message || '';
        if (obj.success) {
          notify('BitsFlood 签到成功', msg, '当前鸡腿：' + (obj.current != null ? obj.current : '未知'));
        } else if (msg.indexOf('已完成签到') !== -1 || msg.indexOf('已经签到') !== -1) {
          notify('BitsFlood 签到', '今日已签到', msg);
        } else if (obj.status === 404) {
          notify('BitsFlood 签到', 'Cookie 已失效', '请重新打开 BitsFlood 抓取 Cookie');
        } else {
          notify('BitsFlood 签到失败', msg || '未知错误', String(data).slice(0, 200));
        }
      } catch (e) {
        notify('BitsFlood 签到', '返回解析失败', String(data).slice(0, 200));
      }
      finish();
    });
  }
}
