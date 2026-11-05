// ============ BitsFlood 每日自动签到（Loon）============
// 签到页：https://bitsflood.com/my-checkin.htm
// 选项和 NodeSeek 一样：固定鸡腿 x5 / 试试手气（随机）
// BitsFlood 前面有 Cloudflare，会把非浏览器请求认成机器人而拦截。
// 浏览器本身从不弹验证（说明没有 cf_clearance 可复用），所以只能让脚本的请求
// 尽可能像浏览器：抓 Cookie 时把浏览器的整套请求头（UA、Accept、Accept-Language）
// 一起抓下来，签到时原样带上。
// 用法：同一份代码在 Loon 里建两个本地脚本条目
//   1) 类型 cron，时间 10 9 * * *（每天 9:10）→ 每天定时签到
//   2) 类型 http-request，匹配 ^https://(www\.)?bitsflood\.com/ → 打开 BitsFlood 时自动保存 Cookie 和请求头
//   并在 [MITM] 里加 hostname = bitsflood.com（抓 Cookie 才需要 MITM，且要信任证书）
// 注意：Cookie 失效时会通知，重新打开一次 BitsFlood 即可重新抓取。

var COOKIE_KEY = 'bitsflood_cookie';
var UA_KEY = 'bitsflood_ua';
var ACCEPT_KEY = 'bitsflood_accept';
var ACCEPT_LANG_KEY = 'bitsflood_accept_lang';
var DEFAULT_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
var RANDOM = true; // true = 试试手气（随机鸡腿），false = 固定鸡腿 x5

function notify(title, sub, body) {
  $notification.post(title, sub || '', body || '');
}

function finish(obj) {
  if (typeof $done === 'function') $done(obj || {});
}

function saveHeader(key, value) {
  if (value && $persistentStore.read(key) !== value) {
    $persistentStore.write(value, key);
  }
}

// ---- 抓 Cookie + 请求头模式（http-request）----
if (typeof $request !== 'undefined' && $request) {
  var headers = $request.headers || {};
  saveHeader(UA_KEY, headers['User-Agent'] || headers['user-agent']);
  saveHeader(ACCEPT_KEY, headers['Accept'] || headers['accept']);
  saveHeader(ACCEPT_LANG_KEY, headers['Accept-Language'] || headers['accept-language']);
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
    var url = 'https://bitsflood.com/my-checkin.htm?random=' + (RANDOM ? 'true' : 'false');
    $httpClient.post({
      url: url,
      headers: {
        'Cookie': cookie,
        'User-Agent': $persistentStore.read(UA_KEY) || DEFAULT_UA,
        'Accept': $persistentStore.read(ACCEPT_KEY) || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': $persistentStore.read(ACCEPT_LANG_KEY) || 'zh-CN,zh-Hans;q=0.9',
        'Origin': 'https://bitsflood.com',
        'Referer': 'https://bitsflood.com/my-checkin.htm',
        'Content-Type': 'application/json'
      },
      body: ''
    }, function (error, response, data) {
      if (error) {
        notify('BitsFlood 签到', '请求失败', String(error));
        finish();
        return;
      }
      var text = String(data || '');
      // Cloudflare 验证页拦截
      if (text.indexOf('Just a moment') !== -1 || text.indexOf('cf-challenge') !== -1 || text.indexOf('challenge-platform') !== -1) {
        notify('BitsFlood 签到', 'Cloudflare 验证拦截', '请在浏览器里打开一次 BitsFlood，通过验证后再手动跑一次脚本');
        finish();
        return;
      }
      // 先按 JSON 解析（和 NodeSeek 同形）
      try {
        var obj = JSON.parse(text);
        var msg = obj.message || '';
        if (obj.success) {
          notify('BitsFlood 签到成功', msg, '当前鸡腿：' + (obj.current != null ? obj.current : '未知'));
        } else if (msg.indexOf('已完成签到') !== -1 || msg.indexOf('已经签到') !== -1 || msg.indexOf('已签到') !== -1) {
          notify('BitsFlood 签到', '今日已签到', msg);
        } else if (obj.status === 404) {
          notify('BitsFlood 签到', 'Cookie 已失效', '请重新打开 BitsFlood 抓取 Cookie');
        } else {
          notify('BitsFlood 签到失败', msg || '未知错误', text.slice(0, 200));
        }
        finish();
        return;
      } catch (e) {
        // 不是 JSON，按网页处理
      }
      if (text.indexOf('用户登录') !== -1 || text.indexOf('user-login') !== -1) {
        notify('BitsFlood 签到', 'Cookie 已失效', '请重新打开 BitsFlood 抓取 Cookie');
      } else if (text.indexOf('已签到') !== -1 || text.indexOf('今日已签到') !== -1) {
        notify('BitsFlood 签到', '今日已签到', '');
      } else if (text.indexOf('签到成功') !== -1) {
        notify('BitsFlood 签到成功', '签到完成', text.slice(0, 200));
      } else {
        notify('BitsFlood 签到', '返回内容未识别', text.slice(0, 200));
      }
      finish();
    });
  }
}
