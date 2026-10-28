/* 星河玩味 · 员工端主逻辑 */
var App = (function () {
  'use strict';
  var S = { me: null, cfg: null, places: [], votes: [], users: [], fDist: '', fCat: '', q: '', pickMode: false };
  var sheetOpen = false;

  function $(id) { return GG.$(id); }
  function t(k) { return GG.t(k); }
  function esc(s) { return GG.esc(s); }
  function L(o, k) { return GG.biling(o, k); }

  /* ============ 启动 ============ */
  function boot(me, cfg) {
    S.me = me; S.cfg = cfg;
    $('main').classList.remove('hidden');
    $('gate').classList.add('hidden');
    $('login').classList.add('hidden');
    bindChrome();
    buildToolbar();
    refresh();
    initMap();
  }

  function bindChrome() {
    $('btnLang').addEventListener('click', function () {
      GG.setLang(GG.getLang() === 'zh' ? 'en' : 'zh');
      location.reload();
    });
    $('btnAdmin').addEventListener('click', function () { location.href = 'admin.html'; });
    $('fabAdd').addEventListener('click', function () { openAdd(); });
    $('fabRank').addEventListener('click', function () { openRank('hot'); });
    $('btnRank').addEventListener('click', function () { openRank('hot'); });
    $('btnAdd').addEventListener('click', function () { openAdd(); });
    $('btnMine').addEventListener('click', openMine);
    $('q').addEventListener('input', function () { S.q = this.value.trim(); refresh(false); });
    $('qclr').addEventListener('click', function () { $('q').value = ''; S.q = ''; refresh(false); });
    $('fDist').addEventListener('change', function () { S.fDist = this.value; refresh(true); });
    $('mask').addEventListener('click', closeSheet);
    $('sheetX').addEventListener('click', closeSheet);
  }

  function buildToolbar() {
    var d = $('fDist');
    d.innerHTML = '<option value="">' + t('allDistrict') + '</option>' +
      (S.cfg.dists || []).map(function (x) { return '<option value="' + x.id + '">' + esc(L(x, 'name')) + '</option>'; }).join('');
    $('btnLang').textContent = t('lang');
    $('btnRank').textContent = '🏆 ' + t('rank');
    $('btnAdd').textContent = '＋ ' + t('add');
    $('btnMine').textContent = '👤 ' + (S.me.name || S.me.emp);
    $('q').placeholder = t('searchPh');
    renderChips();
    renderLegend();
    if (!GG.isCloud()) {
      $('bannerBox').innerHTML = '<div class="banner"><b>' + t('localMode') + '</b> — ' + t('localModeTip') + '</div>';
    }
  }

  function renderChips() {
    var w = $('catChips');
    var all = '<div class="chip' + (S.fCat ? '' : ' on') + '" data-c="">' + t('allCat') + '</div>';
    w.innerHTML = all + (S.cfg.cats || []).map(function (c) {
      return '<div class="chip' + (S.fCat === c.id ? ' on' : '') + '" data-c="' + c.id + '">' +
        '<i class="dot" style="background:' + c.color + '"></i>' + esc(L(c, 'name')) + '</div>';
    }).join('');
    Array.prototype.forEach.call(w.querySelectorAll('.chip'), function (el) {
      el.addEventListener('click', function () { S.fCat = el.getAttribute('data-c') || ''; renderChips(); refresh(true); });
    });
  }

  function renderLegend() {
    var el = $('legend');
    if (!el) return;
    el.innerHTML = '<b>' + t('legendTitle') + '</b>' +
      '<div class="li"><i class="sw" style="background:#C9A227"></i>' + t('gold') + '</div>' +
      '<div class="li"><i class="sw" style="background:#E14B4B"></i>' + t('upT') + '</div>' +
      '<div class="li"><i class="sw" style="background:#2D9CDB"></i>' + t('normT') + '</div>' +
      '<div class="li"><i class="sw" style="background:#9AA5B1"></i>' + t('greyT') + '</div>' +
      '<div class="sz"><i style="width:8px;height:8px"></i><i style="width:12px;height:12px"></i>' +
      '<i style="width:17px;height:17px"></i><i style="width:23px;height:23px"></i></div>' +
      '<div style="color:var(--muted);margin-top:4px">' + t('legendSize') + '</div>';
  }

  /* ============ 数据 ============ */
  function refresh(refit) {
    return Promise.all([GG.placesList(), GG.votesList(), GG.usersList()]).then(function (r) {
      S.places = r[0] || []; S.votes = r[1] || []; S.users = r[2] || [];
      S.places = S.places.filter(function (p) { return p && p.status === 'approved'; });
      decorate();
      renderMap(refit);
      updateBadge();
    });
  }

  function catOf(id) {
    var c = (S.cfg.cats || []).filter(function (x) { return x.id === id; })[0];
    return c || { id: id || 'other', zh: '其它', en: 'Other', color: '#828282', icon: '📍' };
  }
  function distOf(p) {
    if (p.dist) return p.dist;
    var best = '', bd = 1e9;
    (S.cfg.dists || []).forEach(function (d) {
      var dd = (p.lat - d.lat) * (p.lat - d.lat) + (p.lng - d.lng) * (p.lng - d.lng);
      if (dd < bd) { bd = dd; best = d.id; }
    });
    return best;
  }
  function decorate() {
    var thr = (S.cfg && S.cfg.thr) || GG.defaultConfig().thr;
    S.places.forEach(function (p) {
      var g = GG.tally(S.votes, p.id);
      p._up = g.up; p._down = g.down; p._net = g.net; p._notes = g.notes;
      p._tier = GG.tierOf(g.net, g.up, g.down, thr);
      p._size = GG.sizeOf(g.net);
      var c = catOf(p.cat);
      p._catColor = c.color; p._cat = c;
      p._dist = distOf(p);
    });
  }
  function visible() {
    var q = S.q.toLowerCase();
    return S.places.filter(function (p) {
      if (S.fCat && p.cat !== S.fCat) return false;
      if (S.fDist && p._dist !== S.fDist) return false;
      if (q) {
        var hay = [p.nameZh, p.nameEn, p.address, p.reason, p.tips, (p.tags || []).join(' ')].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }
  function updateBadge() {
    var n = visible().length, all = S.places.length;
    var b = $('mapBadge');
    b.classList.remove('hidden');
    b.textContent = t('total') + ' ' + n + (n !== all ? ' / ' + all : '') + (GG.isCloud() ? '' : ' · ' + t('localMode'));
    setTimeout(function () { b.classList.add('hidden'); }, 2600);
  }

  /* ============ 地图 ============ */
  function initMap() {
    var key = (S.cfg && S.cfg.mapKey) || '';
    if (!key) {
      $('mapMsg').classList.remove('hidden');
      $('mapMsg').innerHTML = '<div class="box"><h3 style="margin:0 0 8px;color:var(--navy)">🗺 ' + t('mapNoKey') + '</h3>' +
        '<p style="margin:0;font-size:13px;color:var(--muted);line-height:1.7">' + t('mapNoKeyTip') + '</p>' +
        '<button class="btn sm blue mt14" id="mmRank">' + t('rank') + '</button></div>';
      $('mmRank').addEventListener('click', function () { openRank('hot'); });
      return;
    }
    $('mapMsg').innerHTML = '<div class="box"><span class="spin" style="border-top-color:#12305C;border-color:rgba(18,48,92,.2)"></span> ' + t('mapLoading') + '</div>';
    GMap.load(key).then(function () {
      $('mapMsg').classList.add('hidden');
      var c = (S.cfg && S.cfg.center) || { lat: 22.5376, lng: 114.0235 };
      GMap.init($('map'), c, (S.cfg && S.cfg.zoom) || 12);
      GMap.onMarkerClick(function (id) { openPlace(id); });
      GMap.onMapClick(function () { });
      renderMap(false);
    }, function () {
      $('mapMsg').innerHTML = '<div class="box"><h3 style="margin:0 0 8px;color:var(--danger)">⚠ ' + t('mapKeyFail') + '</h3></div>';
    });
  }

  function renderMap(refit) {
    if (!GMap.ready()) return;
    var list = visible();
    GMap.render(list);
    if (refit && list.length) GMap.fit(list);
  }

  /* ============ 通用弹层 ============ */
  function openSheet(title, html, full) {
    $('sheetTitle').innerHTML = title;
    $('sheetBody').innerHTML = html;
    $('sheetFoot').innerHTML = '';
    $('sheet').classList.add('on');
    $('sheet').classList[full ? 'add' : 'remove']('full');
    $('mask').classList.add('on');
    sheetOpen = true;
    $('sheetBody').scrollTop = 0;
  }
  function closeSheet() {
    $('sheet').classList.remove('on', 'full');
    $('mask').classList.remove('on');
    sheetOpen = false;
    GMap.destroyPicker();
  }

  /* ============ 详情 ============ */
  function openPlace(id) {
    var p = S.places.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var c = p._cat, mine = myVote(p.id);
    var tierName = { gold: t('gold'), up: t('upT'), norm: t('normT'), watch: t('watchT'), grey: t('greyT'), black: t('blackT') }[p._tier];
    var auds = (p.auds || []).map(function (a) {
      var o = (S.cfg.auds || []).filter(function (x) { return x.id === a; })[0];
      return o ? '<span class="audtag">' + esc(L(o, 'name')) + '</span>' : '';
    }).join('');

    var h = '';
    h += '<span class="pd-cat" style="background:' + c.color + '22;color:' + c.color + '">' + c.icon + ' ' + esc(L(c, 'name')) + '</span>' +
      '<span class="tier ' + p._tier + '">' + tierName + '</span>';
    h += '<div class="pd-title">' + esc(L(p, 'name')) + '</div>';
    if (GG.getLang() === 'zh' ? p.nameEn : p.nameZh) h += '<div class="pd-en">' + esc(GG.getLang() === 'zh' ? p.nameEn : p.nameZh) + '</div>';
    if (p.address) h += '<div class="kv"><div class="k">' + t('addrL') + '</div><div class="v">' + esc(p.address) + '</div></div>';
    if (p.hours) h += '<div class="kv"><div class="k">' + t('hoursL') + '</div><div class="v">' + esc(p.hours) + '</div></div>';
    if (p.price) h += '<div class="kv"><div class="k">' + t('priceL') + '</div><div class="v">¥' + esc(p.price) + '</div></div>';
    if (p.phone) h += '<div class="kv"><div class="k">' + t('phoneL') + '</div><div class="v">' + esc(p.phone) + '</div></div>';
    if (auds) h += '<div class="kv"><div class="k">' + t('audienceL') + '</div><div class="v"><div class="audtags">' + auds + '</div></div></div>';
    if (p.reason) h += '<div class="reason"><b>' + t('reasonL') + '：</b>' + esc(p.reason) + '</div>';
    if (p.tips) h += '<div class="reason" style="background:#FFF6E9;border-left-color:#F2994A"><b>' + t('tipsL') + '：</b>' + esc(p.tips) + '</div>';
    h += '<div class="metarow"><span>' + t('by') + ' ' + esc(p.empName || p.emp || '—') + '</span>' +
      '<span>' + esc(L((S.cfg.dists || []).filter(function (d) { return d.id === p._dist; })[0] || {}, 'name') || '') + '</span></div>';

    h += '<div class="votebar">' +
      '<button class="vbtn up' + (mine.v > 0 ? ' on' : '') + '" id="vUp">👍 ' + t('agree') + ' <span class="n">' + p._up + '</span></button>' +
      '<button class="vbtn down' + (mine.v < 0 ? ' on' : '') + '" id="vDn">👎 ' + t('disagree') + ' <span class="n">' + p._down + '</span></button>' +
      '</div>';
    h += '<div class="notes"><h4>' + t('notes') + '（' + p._notes.length + '）</h4>';
    if (!p._notes.length) h += '<div class="rkmeta">' + t('noNote') + '</div>';
    p._notes.forEach(function (n) {
      var who = n.anon ? t('anon') : (S.cfg.showName === false ? '' : nameOf(n.emp));
      h += '<div class="note"><div class="who"><span>' + esc(who || '—') + '</span><span>' + fmtDate(n.ts) + '</span></div>' + esc(n.text) + '</div>';
    });
    h += '<div class="notebox"><input id="nText" placeholder="' + esc(t('notePh')) + '" /><button id="nSend">' + t('noteSend') + '</button></div>';
    if (S.cfg.anonNote) {
      h += '<label class="chkline" style="margin:8px 0 0"><input type="checkbox" id="nAnon" /> ' + esc(t('postAnon')) + '</label>';
    }
    h += '</div>';

    openSheet(t('detail'), h);
    $('vUp').addEventListener('click', function () { vote(p, 1); });
    $('vDn').addEventListener('click', function () { vote(p, -1); });
    $('nSend').addEventListener('click', function () { sendNote(p); });
    $('nText').addEventListener('keydown', function (e) { if (e.key === 'Enter') sendNote(p); });
    if (mine.note) $('nText').value = mine.note;
  }

  function nameOf(emp) {
    var u = (S.users || []).filter(function (x) { return GG.normEmp(x.emp) === GG.normEmp(emp); })[0];
    if (!u) return emp;
    return (GG.getLang() === 'en' && u.nameEn ? u.nameEn : u.name) + ' · ' + u.emp;
  }
  function fmtDate(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    return (d.getMonth() + 1) + '/' + d.getDate();
  }
  function myVote(pid) {
    for (var i = 0; i < S.votes.length; i++) {
      var v = S.votes[i];
      if (v && v.placeId === pid && GG.normEmp(v.emp) === GG.normEmp(S.me.emp)) return { v: v.v || 0, note: v.note || '' };
    }
    return { v: 0, note: '' };
  }
  function vote(p, dir) {
    var mine = myVote(p.id);
    var nv = (mine.v === dir) ? 0 : dir;
    var rec = { placeId: p.id, emp: GG.normEmp(S.me.emp), v: nv, note: mine.note || null, ts: GG.now() };
    GG.votePut(rec).then(function () { refresh(false).then(function () { openPlace(p.id); }); });
  }
  function sendNote(p) {
    var txt = String(($('nText') || {}).value || '').trim();
    if (!txt) return;
    var mine = myVote(p.id);
    var anon = !!(S.cfg.anonNote && $('nAnon') && $('nAnon').checked);
    GG.votePut({ placeId: p.id, emp: GG.normEmp(S.me.emp), v: mine.v || 0, note: txt, anon: anon, ts: GG.now() })
      .then(function () { refresh(false).then(function () { openPlace(p.id); }); });
  }

  /* ============ 排行榜 ============ */
  var rankTab = 'hot';
  function openRank(tab) {
    rankTab = tab || rankTab || 'hot';
    renderRank();
  }
  function renderRank() {
    var list = visible().slice();
    list.sort(function (a, b) { return rankTab === 'hot' ? (b._net - a._net) || (b._up - a._up) : (a._net - b._net) || (b._down - a._down); });
    list = list.slice(0, 40);

    var h = '<div class="tabbar">' +
      '<button class="tb' + (rankTab === 'hot' ? ' on' : '') + '" data-r="hot">🔥 ' + t('hot') + '</button>' +
      '<button class="tb' + (rankTab === 'cold' ? ' on' : '') + '" data-r="cold">🕶 ' + t('cold') + '</button>' +
      '<button class="tb' + (rankTab === 'mine' ? ' on' : '') + '" data-r="mine">👤 ' + t('mySub') + '</button>' +
      '</div><div style="height:12px"></div>';

    if (rankTab === 'mine') {
      var mine = (S.places || []).filter(function (p) { return GG.normEmp(p.emp) === GG.normEmp(S.me.emp); });
      var pend = GG.lget(GG.LS.places, []).filter(function (p) { return p && GG.normEmp(p.emp) === GG.normEmp(S.me.emp) && p.status !== 'approved'; });
      h += '<h4 style="margin:0 0 8px;color:var(--navy)">' + t('publishTab') + '（' + mine.length + '）</h4>' + rows(mine, false);
      h += '<h4 style="margin:18px 0 8px;color:var(--navy)">' + t('pendingTab') + '（' + pend.length + '）</h4>';
      h += pend.length ? pend.map(function (p) {
        return '<div class="rankrow"><div class="rkno">⏳</div><div class="rkmain"><div class="rkname">' + esc(L(p, 'name')) +
          ' <span class="status pending">' + t('pending') + '</span></div><div class="rkmeta">' + esc(L(catOf(p.cat), 'name')) + '</div></div></div>';
      }).join('') : '<div class="empty">' + t('none') + '</div>';
    } else {
      h += list.length ? rows(list, rankTab === 'hot') : '<div class="empty">' + t('filterEmpty') + '</div>';
    }

    openSheet('🏆 ' + t('rank'), h, true);
    Array.prototype.forEach.call($('sheetBody').querySelectorAll('.tb'), function (b) {
      b.addEventListener('click', function () { rankTab = b.getAttribute('data-r'); renderRank(); });
    });
    Array.prototype.forEach.call($('sheetBody').querySelectorAll('.rkrow'), function (r) {
      r.addEventListener('click', function () { openPlace(r.getAttribute('data-id')); });
    });
  }
  function rows(list, hot) {
    return list.map(function (p, i) {
      var tn = { gold: '🥇 ' + t('gold'), up: t('upT'), norm: t('normT'), watch: t('watchT'), grey: t('greyT'), black: t('blackT') }[p._tier];
      return '<div class="rankrow" data-id="' + p.id + '" style="cursor:pointer">' +
        '<div class="rkno' + (hot && i < 3 ? ' top' : '') + '">' + (i + 1) + '</div>' +
        '<div class="rkmain"><div class="rkname">' + esc(L(p, 'name')) +
        '<span class="tier ' + p._tier + '">' + tn + '</span></div>' +
        '<div class="rkmeta">' + p._cat.icon + ' ' + esc(L(p._cat, 'name')) + ' · ' +
        esc(L((S.cfg.dists || []).filter(function (d) { return d.id === p._dist; })[0] || {}, 'name')) + '</div>' +
        (p._notes[0] ? '<div class="rkmeta" style="color:var(--muted)">💬 ' + esc(p._notes[0].text.slice(0, 40)) + '</div>' : '') +
        '</div>' +
        '<div class="rkscore' + (hot ? '' : ' bad') + '"><b>' + (hot ? '+' : '') + p._net + '</b><span>👍' + p._up + ' 👎' + p._down + '</span></div>' +
        '</div>';
    }).join('');
  }

  /* ============ 我的 ============ */
  function openMine() {
    var h = '<div class="kv"><div class="k">' + t('empNo') + '</div><div class="v">' + esc(S.me.emp) + '</div></div>' +
      '<div class="kv"><div class="k">' + t('cnName') + '</div><div class="v">' + esc(S.me.name || '—') + '</div></div>' +
      '<div class="kv"><div class="k">' + t('dept') + '</div><div class="v">' + esc(GG.deptLabel(S.me) || '—') + '</div></div>' +
      '<div class="divider"></div>' +
      '<div class="btnrow">' +
      '<button class="btn sm line" id="mSub">' + t('mySub') + '</button>' +
      '<button class="btn sm line" id="mLang">' + t('lang') + '</button>' +
      '<button class="btn sm line" id="mSw">' + t('switchUser') + '</button>' +
      '<button class="btn sm line" id="mOut">' + t('logout') + '</button>' +
      (isAdminUnlocked() ? '<button class="btn sm blue" id="mAdm">' + t('adminTitle') + '</button>' : '') +
      '</div>' +
      '<div class="hint">' + t('app') + ' · ' + t('tagline') + '</div>';
    openSheet('👤 ' + (S.me.name || S.me.emp), h);
    $('mSub').addEventListener('click', function () { openRank('mine'); });
    $('mLang').addEventListener('click', function () { GG.setLang(GG.getLang() === 'zh' ? 'en' : 'zh'); location.reload(); });
    $('mSw').addEventListener('click', function () { Auth.reauth(); });
    $('mOut').addEventListener('click', function () { GG.clearMe(); GG.clearAdmin(); location.reload(); });
    if ($('mAdm')) $('mAdm').addEventListener('click', function () { location.href = 'admin.html'; });
  }
  function isAdminUnlocked() { return !!GG.adminSession(); }

  /* ============ 上传推荐 ============ */
  var draft = null;
  function openAdd(editP) {
    draft = editP ? GG.clone(editP) : {
      id: GG.uid('p'), nameZh: '', nameEn: '', cat: (S.cfg.cats[0] || {}).id || '', dist: '',
      address: '', lat: null, lng: null, phone: '', hours: '', price: '', auds: [],
      reason: '', tips: '', tags: [], cover: '', emp: GG.normEmp(S.me.emp), empName: S.me.name || '',
      createdAt: GG.now(), status: 'pending', updatedAt: GG.now()
    };
    renderAdd();
  }

  function renderAdd() {
    var d = draft;
    var h = '';
    h += '<div class="grid2">' +
      '<div class="fld"><label>' + t('name') + '（中）<span class="req">*</span></label><input id="aName" value="' + esc(d.nameZh) + '" /></div>' +
      '<div class="fld"><label>' + t('name') + '（EN）</label><input id="aNameEn" value="' + esc(d.nameEn || '') + '" /></div>' +
      '</div>';
    h += '<div class="grid2">' +
      '<div class="fld"><label>' + t('cat') + '<span class="req">*</span></label><select id="aCat">' +
      (S.cfg.cats || []).map(function (c) { return '<option value="' + c.id + '"' + (d.cat === c.id ? ' selected' : '') + '>' + esc(L(c, 'name')) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="fld"><label>' + t('dist') + '</label><select id="aDist"><option value="">—</option>' +
      (S.cfg.dists || []).map(function (x) { return '<option value="' + x.id + '"' + (d.dist === x.id ? ' selected' : '') + '>' + esc(L(x, 'name')) + '</option>'; }).join('') +
      '</select></div></div>';
    h += '<div class="fld"><label>' + t('addrL') + '</label><input id="aAddr" value="' + esc(d.address || '') + '" /></div>';

    h += '<div class="fld"><label>' + t('pickTip') + '</label>' +
      '<div class="minimap" id="aMap"></div>' +
      '<div class="pickbar"><span id="aCoord">' + (d.lat != null ? t('picked') + '：<b>' + d.lat.toFixed(6) + ', ' + d.lng.toFixed(6) + '</b>' : '—') + '</span>' +
      '<span style="flex:1"></span><button class="mini gh" id="aPick">' + t('pickBtn') + '</button></div>' +
      '<div class="rowline mt8"><input id="aSearch" class="inp" style="max-width:220px" placeholder="' + esc(t('searchPh')) + '" /><button class="mini bl" id="aGo">🔍</button></div>' +
      '<div id="aRes" class="mt8"></div>' +
      '</div>';

    h += '<div class="grid2">' +
      '<div class="fld"><label>' + t('phoneL') + '</label><input id="aPhone" value="' + esc(d.phone || '') + '" /></div>' +
      '<div class="fld"><label>' + t('hoursL') + '</label><input id="aHours" value="' + esc(d.hours || '') + '" /></div>' +
      '</div>';
    h += '<div class="fld"><label>' + t('priceL') + '（¥）</label><input id="aPrice" inputmode="numeric" value="' + esc(d.price || '') + '" /></div>';
    h += '<div class="fld"><label>' + t('audience') + '</label><div class="multi" id="aAuds">' +
      (S.cfg.auds || []).map(function (a) {
        return '<span class="m' + ((d.auds || []).indexOf(a.id) >= 0 ? ' on' : '') + '" data-a="' + a.id + '">' + esc(L(a, 'name')) + '</span>';
      }).join('') + '</div></div>';
    h += '<div class="fld"><label>' + t('reasonL') + '<span class="req">*</span></label><textarea id="aReason" placeholder="为什么值得去？">' + esc(d.reason || '') + '</textarea></div>';
    h += '<div class="fld"><label>' + t('tipsL') + '</label><textarea id="aTips">' + esc(d.tips || '') + '</textarea></div>';
    h += '<div class="fld"><label>标签（逗号分隔）</label><input id="aTags" value="' + esc((d.tags || []).join(',')) + '" /></div>';
    h += '<div class="err" id="aErr"></div>';

    openSheet((d.status === 'approved' ? t('edit') : '＋ ' + t('add')), h, true);
    $('sheetFoot').innerHTML = '<button class="btn line" id="aCancel">' + t('cancel') + '</button>' +
      '<button class="btn blue" id="aSave">' + t('submit') + '</button>';

    Array.prototype.forEach.call($('sheetBody').querySelectorAll('#aAuds .m'), function (m) {
      m.addEventListener('click', function () { m.classList.toggle('on'); });
    });
    $('aCancel').addEventListener('click', closeSheet);
    $('aSave').addEventListener('click', saveAdd);
    $('aGo').addEventListener('click', doSearch);
    $('aSearch').addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });
    $('aPick').addEventListener('click', function () {
      $('aMap').style.boxShadow = '0 0 0 3px rgba(195,214,238,.9)';
      GG.toast(t('pickTip'));
    });

    // 迷你取点地图
    setTimeout(function () {
      var key = (S.cfg && S.cfg.mapKey) || '';
      var la = d.lat != null ? d.lat : ((S.cfg.center || {}).lat || 22.5376);
      var lo = d.lng != null ? d.lng : ((S.cfg.center || {}).lng || 114.0235);
      if (!key || !GMap.ready()) {
        $('aMap').innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:14px;color:var(--muted);font-size:12px">' + t('mapNoKey') + '</div>';
        return;
      }
      GMap.initPicker($('aMap'), la, lo, function (x, y) {
        d.lat = x; d.lng = y;
        $('aCoord').innerHTML = t('picked') + '：<b>' + x.toFixed(6) + ', ' + y.toFixed(6) + '</b>';
      });
    }, 60);
  }

  function doSearch() {
    var kw = String($('aSearch').value || '').trim();
    if (!kw) return;
    var key = (S.cfg && S.cfg.mapKey) || '';
    if (!key) { $('aRes').innerHTML = '<div class="rkmeta">' + t('mapNoKey') + '</div>'; return; }
    $('aRes').innerHTML = '<div class="rkmeta">' + t('loading') + '</div>';
    GMap.search(kw, key, '深圳').then(function (arr) {
      $('aRes').innerHTML = (arr || []).map(function (o, i) {
        return '<div class="rankrow" data-i="' + i + '" style="cursor:pointer"><div class="rkno">📍</div>' +
          '<div class="rkmain"><div class="rkname">' + esc(o.title) + '</div>' +
          '<div class="rkmeta">' + esc(o.address || '') + '</div></div></div>';
      }).join('') || '<div class="rkmeta">' + t('none') + '</div>';
      Array.prototype.forEach.call($('aRes').querySelectorAll('.rankrow'), function (r) {
        r.addEventListener('click', function () {
          var o = arr[+r.getAttribute('data-i')];
          draft.lat = o.location.lat; draft.lng = o.location.lng;
          if (!draft.nameZh) { draft.nameZh = o.title; $('aName').value = o.title; }
          if (!draft.address) { draft.address = o.address || ''; $('aAddr').value = o.address || ''; }
          $('aCoord').innerHTML = t('picked') + '：<b>' + o.location.lat.toFixed(6) + ', ' + o.location.lng.toFixed(6) + '</b>';
          if (GMap.ready()) GMap.pickerGo(o.location.lat, o.location.lng);
        });
      });
    }, function () { $('aRes').innerHTML = '<div class="rkmeta">' + t('mapKeyFail') + '</div>'; });
  }

  function saveAdd() {
    var d = draft;
    d.nameZh = String($('aName').value || '').trim();
    d.nameEn = String($('aNameEn').value || '').trim();
    d.cat = $('aCat').value;
    d.dist = $('aDist').value;
    d.address = String($('aAddr').value || '').trim();
    d.phone = String($('aPhone').value || '').trim();
    d.hours = String($('aHours').value || '').trim();
    d.price = String($('aPrice').value || '').trim();
    d.reason = String($('aReason').value || '').trim();
    d.tips = String($('aTips').value || '').trim();
    d.tags = String($('aTags').value || '').split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
    d.auds = Array.prototype.map.call($('sheetBody').querySelectorAll('#aAuds .m.on'), function (m) { return m.getAttribute('data-a'); });

    var e = $('aErr');
    if (!d.nameZh) { e.textContent = t('nameReq2'); return; }
    if (!d.cat) { e.textContent = t('catReq'); return; }
    if (!d.reason) { e.textContent = t('reasonReq'); return; }
    if (d.lat == null || d.lng == null) { e.textContent = t('locReq'); return; }
    d.updatedAt = GG.now();
    e.textContent = '';
    $('aSave').disabled = true;
    GG.placesPut(d).then(function () {
      $('aSave').disabled = false;
      GG.toast(t('submitOk'));
      closeSheet();
      refresh(true);
    });
  }

  return { boot: boot, refresh: refresh, openAdd: openAdd, openPlace: openPlace, openRank: openRank, state: S };
})();
