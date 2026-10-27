/* 星河玩味 · 门禁：通行验证码 + 员工注册/登录（与答题平台同一套工号 + 6 位密码体系） */
var Auth = (function () {
  'use strict';
  var cfg = null, mode = 'register', pendingEmp = '', busy = false;
  var onDone = null;

  function $(id) { return GG.$(id); }
  function t(k) { return GG.t(k); }

  function boot(cb) {
    onDone = cb;
    return GG.cfgGet().then(function (c) {
      cfg = c;
      if (GG.gatePassed() && GG.me()) return finish();
      if (GG.gatePassed()) return showLogin();
      return showGate();
    });
  }
  function finish() { hide('gate'); hide('login'); if (onDone) onDone(GG.me(), cfg); }

  function hide(id) { var e = $(id); if (e) e.classList.add('hidden'); }
  function show(id) { var e = $(id); if (e) e.classList.remove('hidden'); }

  /* ---------------- 第一道门：通行验证码 ---------------- */
  function showGate() {
    hide('login'); hide('main'); show('gate');
    var box = $('gate');
    box.innerHTML =
      '<div class="card">' +
      '<h1>' + t('gateTitle') + '</h1>' +
      '<p class="sub">' + t('gateSub') + '</p>' +
      '<label class="fl">' + t('gateCode') + '</label>' +
      '<input class="inp" id="gateCode" autocomplete="off" autocapitalize="characters" placeholder="' + (cfg && cfg.gateCode ? '• • • • • •' : '') + '" />' +
      '<button class="btn blue" id="gateGo">' + t('gateBtn') + '</button>' +
      '<div class="err" id="gateErr"></div>' +
      '<div class="hint">' + t('app') + ' · ' + (GG.getLang() === 'zh' ? t('tagline') : t('taglineEn')) + '</div>' +
      '</div>';
    var inp = $('gateCode');
    inp.focus();
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') goGate(); });
    $('gateGo').addEventListener('click', goGate);
  }

  function goGate() {
    var code = String(($('gateCode') || {}).value || '').trim().toUpperCase();
    if (!code) return;
    busy = true; $('gateGo').disabled = true;
    var p;
    if (cfg && cfg.gateHash) p = GG.gateHash(code).then(function (h) { return GG.safeEq(h, cfg.gateHash); });
    else p = Promise.resolve(GG.safeEq(code, String((cfg && cfg.gateCode) || 'RC2026').toUpperCase()));
    p.then(function (ok) {
      busy = false;
      var b = $('gateGo'); if (b) b.disabled = false;
      if (!ok) { var e = $('gateErr'); if (e) e.textContent = t('gateWrong'); return; }
      GG.setGatePass((cfg && cfg.gateDays) || 30);
      GG.toast(t('gateOk'));
      showLogin();
    });
  }

  /* ---------------- 第二道门：员工登录 ---------------- */
  function showLogin(preEmp) {
    hide('gate'); hide('main'); show('login');
    var box = $('login');
    box.innerHTML =
      '<div class="card">' +
      '<h1>' + t('loginTitle') + '</h1>' +
      '<p class="sub">' + t('loginSub') + '</p>' +
      '<div id="lgStep"></div>' +
      '<div class="err" id="lgErr"></div>' +
      '<div class="divider"></div>' +
      '<div class="rowline"><button class="linkbtn" id="lgSwitch">' + t('switchUser') + '</button>' +
      '<span class="pill">' + (cfg && cfg.gateCode ? t('gateCode') : '') + '</span></div>' +
      '</div>';
    $('lgSwitch').style.display = 'none';
    step1(preEmp || '');
  }

  function err(m) { var e = $('lgErr'); if (e) e.textContent = m || ''; }
  function step1(emp) {
    err('');
    var s = $('lgStep');
    s.innerHTML =
      '<label class="fl">' + t('empNo') + '</label>' +
      '<input class="inp" id="lgEmp" inputmode="numeric" autocomplete="off" value="' + GG.esc(emp) + '" />' +
      '<button class="btn blue" id="lgNext">' + t('loginBtn') + '</button>';
    var i = $('lgEmp'); i.focus();
    i.addEventListener('keydown', function (e) { if (e.key === 'Enter') next(); });
    $('lgNext').addEventListener('click', next);
  }
  function next() {
    var emp = GG.normEmp(($('lgEmp') || {}).value);
    if (!emp) { err(t('empReq')); return; }
    pendingEmp = emp;
    err('');
    busy = true;
    GG.userGet(emp).then(function (rec) {
      busy = false;
      if (rec && rec.blocked) { err('账号已被停用，请联系培训部'); return; }
      if (!rec) return stepRegister();
      if (rec.pinHash) return stepPin(rec);
      return stepClaim(rec);
    });
  }

  function stepPin(rec) {
    mode = 'pin';
    var s = $('lgStep');
    s.innerHTML =
      '<div class="rowline"><span class="pill">' + t('empNo') + ' ' + GG.esc(pendingEmp) + '</span>' +
      (rec.name ? '<span class="pill">' + GG.esc(GG.getLang() === 'en' && rec.nameEn ? rec.nameEn : rec.name) + '</span>' : '') + '</div>' +
      '<label class="fl">' + t('password') + '</label>' +
      '<input class="inp" id="lgPin" type="password" inputmode="numeric" maxlength="6" autocomplete="off" />' +
      '<button class="btn blue" id="lgGo">' + t('loginBtn') + '</button>';
    var i = $('lgPin'); i.focus();
    i.addEventListener('keydown', function (e) { if (e.key === 'Enter') doPin(); });
    $('lgGo').addEventListener('click', doPin);
  }
  function doPin() {
    var pin = String(($('lgPin') || {}).value || '').trim();
    if (!GG.isPinValid(pin)) { err(t('pinReq')); return; }
    busy = true;
    GG.userGet(pendingEmp).then(function (rec) {
      if (!rec || !rec.pinHash) { busy = false; return stepClaim(rec); }
      return GG.pinHash(pendingEmp, pin).then(function (h) {
        busy = false;
        if (!GG.safeEq(h, rec.pinHash)) { err(t('pinWrong')); return; }
        enter(rec);
      });
    });
  }

  function stepClaim(rec) {
    mode = 'claim';
    var s = $('lgStep');
    s.innerHTML =
      '<div class="banner" style="margin:0 0 10px">' + t('claimTip') + '</div>' +
      '<div class="rowline"><span class="pill">' + t('empNo') + ' ' + GG.esc(pendingEmp) + '</span>' +
      (rec && rec.name ? '<span class="pill">' + GG.esc(rec.name) + '</span>' : '') + '</div>' +
      '<label class="fl">' + t('newPassword') + '</label>' +
      '<input class="inp" id="lgPin" type="password" inputmode="numeric" maxlength="6" autocomplete="off" />' +
      '<button class="btn blue" id="lgGo">' + t('claimBtn') + '</button>';
    var i = $('lgPin'); i.focus();
    i.addEventListener('keydown', function (e) { if (e.key === 'Enter') doClaim(rec); });
    $('lgGo').addEventListener('click', function () { doClaim(rec); });
  }
  function doClaim(rec) {
    var pin = String(($('lgPin') || {}).value || '').trim();
    if (!GG.isPinValid(pin)) { err(t('pinReq')); return; }
    busy = true;
    GG.pinHash(pendingEmp, pin).then(function (h) {
      var u = rec || {};
      u.emp = pendingEmp; u.pinHash = h; u.pinSetAt = GG.now();
      u.createdAt = u.createdAt || GG.now();
      return GG.userPut(u).then(function () { busy = false; enter(u); });
    });
  }

  function stepRegister() {
    mode = 'register';
    var s = $('lgStep');
    s.innerHTML =
      '<div class="rowline"><span class="pill">' + t('empNo') + ' ' + GG.esc(pendingEmp) + '</span><span class="pill">首次使用</span></div>' +
      '<label class="fl">' + t('cnName') + ' <span class="req">*</span></label>' +
      '<input class="inp" id="rgName" autocomplete="off" />' +
      '<div class="grid2">' +
      '<div><label class="fl">' + t('enName') + '</label><input class="inp" id="rgNameEn" autocomplete="off" /></div>' +
      '<div><label class="fl">' + t('dept') + '</label><input class="inp" id="rgDept" autocomplete="off" /></div>' +
      '</div>' +
      '<label class="fl">' + t('newPassword') + '</label>' +
      '<input class="inp" id="lgPin" type="password" inputmode="numeric" maxlength="6" autocomplete="off" />' +
      '<button class="btn blue" id="lgGo">' + t('regBtn') + '</button>';
    $('rgName').focus();
    $('lgGo').addEventListener('click', doRegister);
  }
  function doRegister() {
    var name = String(($('rgName') || {}).value || '').trim();
    var pin = String(($('lgPin') || {}).value || '').trim();
    if (!name) { err(t('nameReq')); return; }
    if (!GG.isPinValid(pin)) { err(t('pinReq')); return; }
    busy = true;
    GG.userGet(pendingEmp).then(function (exist) {
      if (exist) { busy = false; return exist.pinHash ? stepPin(exist) : stepClaim(exist); }
      return GG.pinHash(pendingEmp, pin).then(function (h) {
        var u = {
          emp: pendingEmp, name: name,
          nameEn: String(($('rgNameEn') || {}).value || '').trim(),
          dept: String(($('rgDept') || {}).value || '').trim(),
          pinHash: h, pinSetAt: GG.now(), createdAt: GG.now()
        };
        return GG.userPut(u).then(function () { busy = false; enter(u); });
      });
    });
  }

  function enter(u) {
    GG.setMe(u);
    GG.toast(t('welcomeBack') + (u.name ? '，' + u.name : ''));
    finish();
  }

  function reauth() {
    GG.clearMe();
    showLogin(GG.me() ? GG.me().emp : '');
  }

  return { boot: boot, reauth: reauth, cfg: function () { return cfg; } };
})();
