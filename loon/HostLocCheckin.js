// ============ HostLoc 每日自动签到（Loon）============
// 用法：同一份代码在 Loon 里建两个本地脚本条目
//   1) 类型 cron，时间 5 9 * * *（每天 9:05）→ 每天定时签到
//   2) 类型 http-request，匹配 ^https?://(www\.)?hostloc\.com/ → 打开 HostLoc 时自动保存 Cookie
//   并在 [MITM] 里加 hostname = hostloc.com（抓 Cookie 才需要 MITM，且要信任证书）
// 原理：先 GET 签到页取 formhash，再 POST 提交签到（Discuz DSU 签到插件）。
// 注意：一天跑一次就够了，别高频跑，论坛有防 CC。

var COOKIE_KEY = 'hostloc_cookie';
var QDXQ = 'kx'; // 签到心情：kx 开心，可改成 ng 难过、ym 郁闷等
var QDMode = 1;

function notify(title, sub, body) {
  $notification.post(title, sub || '', body || '');
}

function finish(obj) {
  if (typeof $done === 'function') $done(obj || {});
}

var UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// ---- 抓 Cookie 模式（http-request）----
if (typeof $request !== 'undefined' && $request) {
  var headers = $request.headers || {};
  var cookie = headers['Cookie'] || headers['cookie'];
  if (cookie) {
    var old = $persistentStore.read(COOKIE_KEY);
    if (old !== cookie) {
      $persistentStore.write(cookie, COOKIE_KEY);
      notify('HostLoc', 'Cookie 已保存', '之后每天 9:05 会自动签到');
    }
  }
  finish({});
} else {
  // ---- 定时签到模式（cron）----
  var cookie = $persistentStore.read(COOKIE_KEY);
  if (!cookie) {
    notify('HostLoc 签到', '没有 Cookie', '请先在登录状态下打开一次 HostLoc');
    finish();
  } else {
    var signPage = 'https://hostloc.com/plugin.php?id=dsu_paulsign:sign';
    $httpClient.get({
      url: signPage,
      headers: { 'Cookie': cookie, 'User-Agent': UA }
    }, function (error, response, data) {
      if (error) {
        notify('HostLoc 签到', '签到页请求失败', String(error));
        finish();
        return;
      }
      var html = data || '';
      if (html.indexOf('请先登录') !== -1 || html.indexOf('您需要先登录') !== -1) {
        notify('HostLoc 签到', 'Cookie 已失效', '请重新打开 HostLoc 抓取 Cookie');
        finish();
        return;
      }
      if (html.indexOf('已经签到') !== -1) {
        notify('HostLoc 签到', '今日已签到', '');
        finish();
        return;
      }
      var m = html.match(/name="formhash" value="([^"]+)"/);
      if (!m) {
        notify('HostLoc 签到', '签到页异常', '没找到 formhash，可能论坛没用 DSU 签到插件或页面变了');
        finish();
        return;
      }
      var formhash = m[1];
      var body = 'formhash=' + encodeURIComponent(formhash) +
        '&qdxq=' + encodeURIComponent(QDXQ) +
        '&qdmode=' + QDMode +
        '&todaysay=' +
        '&fastreply=0';
      $httpClient.post({
        url: 'https://hostloc.com/plugin.php?id=dsu_paulsign:sign&operation=qiandao&infloat=1&inajax=1',
        headers: {
          'Cookie': cookie,
          'Referer': signPage,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': UA
        },
        body: body
      }, function (error2, response2, data2) {
        if (error2) {
          notify('HostLoc 签到', '提交失败', String(error2));
          finish();
          return;
        }
        var text = data2 || '';
        if (text.indexOf('签到成功') !== -1) {
          notify('HostLoc 签到成功', '', '');
        } else if (text.indexOf('已经签到') !== -1) {
          notify('HostLoc 签到', '今日已签到', '');
        } else {
          notify('HostLoc 签到失败', '', text.replace(/<[^>]+>/g, '').slice(0, 200));
        }
        finish();
      });
    });
  }
}
