/* 星河玩味 · 员工端主逻辑 */
var App = (function () {
  'use strict';
  var S = { me: null, cfg: null, raw: [], places: [], votes: [], users: [], board: [],
    fDist: '', fCat: '', q: '', pickMode: false, photoKind: 'all' };
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
    $('fabRank').addEventListener('click', function () { openRank('star'); });
    $('btnRank').addEventListener('click', function () { openRank('star'); });
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
      S.raw = r[0] || []; S.votes = r[1] || []; S.users = r[2] || [];
      S.places = S.raw.filter(function (p) { return p && p.status === 'approved'; });
      S.board = GG.pointsBoard(S.raw, S.votes, S.cfg);
      decorate();
      renderMap(refit);
      updateBadge();
      updatePtsBadge();
    });
  }
  function updatePtsBadge() {
    var el = $('btnRank');
    if (!el || !S.me) return;
    var mine = GG.pointsOf(S.me.emp, S.raw, S.votes, S.cfg);
    el.textContent = '🏆 ' + t('points') + ' ' + (mine.total || 0);
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

    h += starsBlock(p);
    h += photosBlock(p);

    h += '<div class="votebar">' +
      '<button class="vbtn up' + (mine.v > 0 ? ' on' : '') + '" id="vUp">👍 ' + t('agree') + ' <span class="n">' + p._up + '</span></button>' +
      '<button class="vbtn down' + (mine.v < 0 ? ' on' : '') + '" id="vDn">👎 ' + t('disagree') + ' <span class="n">' + p._down + '</span></button>' +
      '</div>';
    h += '<div class="helperbox"><b>' + t('helper') + '</b><div class="rkmeta">' + t('helperTip') + '</div>' +
      '<div class="addrow"><input type="file" accept="image/*" id="phEnv" hidden /><input type="file" accept="image/*" id="phDish" hidden />' +
      '<button class="mini gh" id="phEnvBtn">📷 ' + esc(t('photoAddEnv')) + '</button>' +
      '<button class="mini gh" id="phDishBtn">🍽 ' + esc(t('photoAddDish')) + '</button></div>' +
      '<div class="addrow"><input id="stNew" placeholder="' + esc(t('mustTryPh')) + '" /><button class="mini bl" id="stAdd">' + esc(t('mustTryAdd')) + '</button></div>' +
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
    bindPlace(p);
  }

  /* ============ 参与：投票 / 备注 / 补照片 / 补必点 ============ */
  function bindPlace(p) {
    $('vUp').addEventListener('click', function () { vote(p, 1); });
    $('vDn').addEventListener('click', function () { vote(p, -1); });
    $('nSend').addEventListener('click', function () { sendNote(p); });
    $('nText').addEventListener('keydown', function (e) { if (e.key === 'Enter') sendNote(p); });
    var mn = myVote(p.id);
    if (mn.note) $('nText').value = mn.note;

    // 补充照片
    var fe = $('phEnv'), fd = $('phDish'), pf = p;
    $('phEnvBtn').addEventListener('click', function () { fe.click(); });
    $('phDishBtn').addEventListener('click', function () { fd.click(); });
    fe.addEventListener('change', function () { addPhotos(pf, fe.files, 'env'); fe.value = ''; });
    fd.addEventListener('change', function () { addPhotos(pf, fd.files, 'dish'); fd.value = ''; });

    // 补充必点 / 必看
    $('stAdd').addEventListener('click', function () { addStar(pf, $('stNew').value); });
    $('stNew').addEventListener('keydown', function (e) { if (e.key === 'Enter') addStar(pf, $('stNew').value); });

    // 照片操作：切换类型 / 删除自己的 / 看大图
    Array.prototype.forEach.call($('sheetBody').querySelectorAll('[data-pimg]'), function (el) {
      el.addEventListener('click', function () {
        var id = el.getAttribute('data-pimg');
        var ph = (pf.photos || []).filter(function (x) { return x.id === id; })[0];
        if (ph) openSheet(t('photo'), '<img class="bigphoto" src="' + ph.url + '" />', true);
      });
    });
    Array.prototype.forEach.call($('sheetBody').querySelectorAll('[data-pdel]'), function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        delPhoto(pf, b.getAttribute('data-pdel'));
      });
    });
    Array.prototype.forEach.call($('sheetBody').querySelectorAll('[data-ptab]'), function (b) {
      b.addEventListener('click', function () {
        S.photoKind = b.getAttribute('data-ptab'); openPlace(pf.id);
      });
    });
  }

  var PH_MAX = 6;
  function addPhotos(p, fileList, kind) {
    var arr = Array.prototype.slice.call(fileList || []);
    if (!arr.length) return;
    var room = PH_MAX - ((p.photos || []).length);
    if (room <= 0) { GG.toast(t('photoFull')); return; }
    arr = arr.slice(0, room);
    GG.toast(t('loading'));
    Promise.all(arr.map(function (f) {
      return GG.compressImg(f, 1000, 0.72).catch(function () { return null; });
    })).then(function (urls) {
      p.photos = p.photos || [];
      var me = GG.normEmp(S.me.emp), n = 0;
      urls.forEach(function (u) {
        if (!u) return;
        p.photos.push({ id: GG.uid('ph'), kind: kind, url: u, by: me, ts: GG.now() }); n++;
      });
      p.updatedAt = GG.now();
      return GG.placesPut(p).then(function () { return refresh(false); }).then(function () { openPlace(p.id); });
    });
  }
  function delPhoto(p, id) {
    p.photos = (p.photos || []).filter(function (x) { return x.id !== id; });
    p.updatedAt = GG.now();
    GG.placesPut(p).then(function () { return refresh(false); }).then(function () { openPlace(p.id); });
  }
  function addStar(p, text) {
    text = String(text || '').trim();
    if (!text) return;
    p.stars = p.stars || [];
    p.stars.push({ id: GG.uid('s'), text: text, by: GG.normEmp(S.me.emp), ts: GG.now() });
    p.updatedAt = GG.now();
    GG.placesPut(p).then(function () { return refresh(false); }).then(function () { openPlace(p.id); });
  }

  function starsBlock(p) {
    var list = p.stars || [];
    var h = '<div class="blk"><h4>⭐ ' + esc(t('mustTry')) + '（' + list.length + '）</h4>';
    if (!list.length) h += '<div class="rkmeta">' + esc(t('mustTryEmpty')) + '</div>';
    else {
      h += '<div class="starlist">' + list.map(function (s) {
        return '<div class="staritem"><span>' + esc(s.text) + '</span>' +
          '<span class="src">' + esc(nameOf(s.by)) + '</span></div>';
      }).join('') + '</div>';
    }
    return h + '</div>';
  }
  function photosBlock(p) {
    var all = p.photos || [];
    var kinds = [['all', t('photo')], ['env', t('photoEnv')], ['dish', t('photoDish')]];
    var list = S.photoKind === 'all' ? all : all.filter(function (x) { return x.kind === S.photoKind; });
    var h = '<div class="blk"><h4>📷 ' + esc(t('photo')) + '（' + all.length + '）</h4>';
    h += '<div class="tabbar small">' + kinds.map(function (k) {
      return '<button class="tb' + (S.photoKind === k[0] ? ' on' : '') + '" data-ptab="' + k[0] + '">' + esc(k[1]) + '</button>';
    }).join('') + '</div><div style="height:8px"></div>';
    if (!all.length) h += '<div class="rkmeta">' + esc(t('photoEmpty')) + '</div>';
    else if (!list.length) h += '<div class="rkmeta">' + esc(t('none')) + '</div>';
    else {
      h += '<div class="phgrid">' + list.map(function (x) {
        var me = GG.normEmp(x.by) === GG.normEmp(S.me.emp);
        return '<div class="phthumb"><img src="' + x.url + '" data-pimg="' + x.id + '" />' +
          '<span class="pkind">' + esc(x.kind === 'env' ? t('photoEnv') : (x.kind === 'dish' ? t('photoDish') : t('photoOther'))) + '</span>' +
          (me ? '<span class="pdel" data-pdel="' + x.id + '">✕</span>' : '') + '</div>';
      }).join('') + '</div>';
    }
    return h + '</div>';
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
    var mine = GG.pointsOf(S.me.emp, S.raw, S.votes, S.cfg);
    var h = '<div class="tabbar">' +
      '<button class="tb' + (rankTab === 'hot' ? ' on' : '') + '" data-r="hot">🔥 ' + t('hot') + '</button>' +
      '<button class="tb' + (rankTab === 'cold' ? ' on' : '') + '" data-r="cold">🕶 ' + t('cold') + '</button>' +
      '<button class="tb' + (rankTab === 'star' ? ' on' : '') + '" data-r="star">🥇 ' + t('rankStar') + '</button>' +
      '<button class="tb' + (rankTab === 'mine' ? ' on' : '') + '" data-r="mine">👤 ' + t('mySub') + '</button>' +
      '</div><div style="height:12px"></div>';

    if (rankTab === 'star') {
      h += '<div class="mypoints"><span>' + esc(t('myPts')) + '</span><b>' + (mine.total || 0) + '</b><i>' + esc(t('ptsUnit')) + '</i></div>';
      var board = (S.board || []).slice(0, 30);
      h += board.length ? '<div class="ptsboard">' + board.map(function (b, i) {
        var u = (S.users || []).filter(function (x) { return GG.normEmp(x.emp) === b.emp; })[0] || {};
        var nm = GG.getLang() === 'en' && u.nameEn ? u.nameEn : (u.name || ('#' + b.emp));
        var isMe = GG.normEmp(b.emp) === GG.normEmp(S.me.emp);
        var top = i === 0 ? ' crown' : (i < 3 ? ' medal' : '');
        return '<div class="ptsrow' + (isMe ? ' me' : '') + '" data-pemp="' + esc(b.emp) + '">' +
          '<div class="pno' + top + '">' + (i === 0 ? '👑' : (i < 3 ? ['🥇', '🥈', '🥉'][i] : (i + 1))) + '</div>' +
          '<div class="pmain"><div class="pname">' + esc(nm) +
          (i === 0 ? ' <span class="mtag">' + esc(t('pointMaster')) + '</span>' : '') + '</div>' +
          '<div class="rkmeta">' + esc(GG.deptLabel(u) || '') + '</div></div>' +
          '<div class="ppts"><b>' + b.total + '</b><span>' + esc(t('ptsUnit')) + '</span></div>' +
          '</div>';
      }).join('') + '</div>' : '<div class="empty">' + t('ptsEmpty') + '</div>';
      h += '<div class="hint">🥇 ' + esc(t('pointMaster')) + '：' + esc(t('ptsHint')) + '<br>' +
        '⭐ ' + esc(t('ptsFloor')) + '：' + esc(t('ptsFloorTip')) + '</div>';
      openSheet('🥇 ' + t('pointBoard'), h, true);
      bindRankEvents();
      return;
    }

    var list = visible().slice();
    list.sort(function (a, b) { return rankTab === 'hot' ? (b._net - a._net) || (b._up - a._up) : (a._net - b._net) || (b._down - a._down); });
    list = list.slice(0, 40);

    if (rankTab === 'mine') {
      h += '<div class="mypoints"><span>' + esc(t('myPts')) + '</span><b>' + (mine.total || 0) + '</b><i>' + esc(t('ptsUnit')) + '</i></div>';
      if (mine.items && mine.items.length) {
        h += '<div class="ptsdetail">' + mine.items.map(function (it) {
          return '<div class="pdrow"><div class="pdl"><b>' + esc(it.name) + '</b>' +
            (it.helper ? ' <span class="mtag">' + esc(t('ptsContrib')) + '</span>' : '') +
            (it.clamped ? ' <span class="apptag">' + esc(t('ptsFloor')) + '</span>' : '') +
            '<div class="rkmeta">' + it.items.map(function (x) { return esc(x.label) + ' ' + (x.pts >= 0 ? '+' : '') + x.pts; }).join(' · ') + '</div></div>' +
            '<div class="pdp' + (it.pts >= 0 ? '' : ' neg') + '">' + (it.pts >= 0 ? '+' : '') + it.pts + '</div></div>';
        }).join('') + '</div>';
      }
      var minePlaces = (S.places || []).filter(function (p) { return GG.normEmp(p.emp) === GG.normEmp(S.me.emp); });
      var pend = GG.lget(GG.LS.places, []).filter(function (p) { return p && GG.normEmp(p.emp) === GG.normEmp(S.me.emp) && p.status !== 'approved'; });
      h += '<h4 style="margin:0 0 8px;color:var(--navy)">' + t('publishTab') + '（' + minePlaces.length + '）</h4>' + rows(minePlaces, false);
      h += '<h4 style="margin:18px 0 8px;color:var(--navy)">' + t('pendingTab') + '（' + pend.length + '）</h4>';
      h += pend.length ? pend.map(function (p) {
        return '<div class="rankrow"><div class="rkno">⏳</div><div class="rkmain"><div class="rkname">' + esc(L(p, 'name')) +
          ' <span class="status pending">' + t('pending') + '</span></div><div class="rkmeta">' + esc(L(catOf(p.cat), 'name')) + '</div></div></div>';
      }).join('') : '<div class="empty">' + t('none') + '</div>';
    } else {
      h += list.length ? rows(list, rankTab === 'hot') : '<div class="empty">' + t('filterEmpty') + '</div>';
    }

    openSheet('🏆 ' + t('rank'), h, true);
    bindRankEvents();
  }
  function bindRankEvents() {
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
    var mine = GG.pointsOf(S.me.emp, S.raw, S.votes, S.cfg);
    var h = '<div class="mypoints"><span>' + esc(t('myPts')) + '</span><b>' + (mine.total || 0) + '</b><i>' + esc(t('ptsUnit')) + '</i></div>' +
      '<div class="kv"><div class="k">' + t('empNo') + '</div><div class="v">' + esc(S.me.emp) + '</div></div>' +
      '<div class="kv"><div class="k">' + t('cnName') + '</div><div class="v">' + esc(S.me.name || '—') + '</div></div>' +
      '<div class="kv"><div class="k">' + t('dept') + '</div><div class="v">' + esc(GG.deptLabel(S.me) || '—') + '</div></div>' +
      '<div class="divider"></div>' +
      '<div class="btnrow">' +
      '<button class="btn sm line" id="mPts">' + t('ptsDetail') + '</button>' +
      '<button class="btn sm line" id="mSub">' + t('mySub') + '</button>' +
      '<button class="btn sm line" id="mLang">' + t('lang') + '</button>' +
      '<button class="btn sm line" id="mSw">' + t('switchUser') + '</button>' +
      '<button class="btn sm line" id="mOut">' + t('logout') + '</button>' +
      (isAdminUnlocked() ? '<button class="btn sm blue" id="mAdm">' + t('adminTitle') + '</button>' : '') +
      '</div>' +
      '<div class="hint">' + t('app') + ' · ' + t('tagline') + '</div>';
    openSheet('👤 ' + (S.me.name || S.me.emp), h);
    if ($('mPts')) $('mPts').addEventListener('click', function () { openRank('mine'); });
    $('mSub').addEventListener('click', function () { openRank('mine'); });
    $('mLang').addEventListener('click', function () { GG.setLang(GG.getLang() === 'zh' ? 'en' : 'zh'); location.reload(); });
    $('mSw').addEventListener('click', function () { Auth.reauth(); });
    $('mOut').addEventListener('click', function () { GG.clearMe(); GG.clearAdmin(); location.reload(); });
    if ($('mAdm')) $('mAdm').addEventListener('click', function () { location.href = 'admin.html'; });
  }
  function isAdminUnlocked() { return !!GG.adminSession(); }

  /* ============ 上传推荐 ============ */
  var draft = null, PH_MAXF = 6;
  function openAdd(editP) {
    draft = editP ? GG.clone(editP) : {
      id: GG.uid('p'), nameZh: '', nameEn: '', cat: (S.cfg.cats[0] || {}).id || '', dist: '',
      address: '', lat: null, lng: null, phone: '', hours: '', price: '', auds: [],
      reason: '', tips: '', tags: [], stars: [], photos: [], locApprox: false,
      emp: GG.normEmp(S.me.emp), empName: S.me.name || '',
      createdAt: GG.now(), status: 'pending', updatedAt: GG.now()
    };
    draft.stars = draft.stars || [];
    draft.photos = draft.photos || [];
    renderAdd();
  }

  function renderAdd() {
    var d = draft;
    var h = '';

    /* ---------- ① 位置（第一步，给足三条路） ---------- */
    h += '<div class="blk locblk"><h4>📍 ' + esc(t('locTitle')) + ' <span class="req">*</span></h4>' +
      '<div class="rkmeta">' + esc(t('locSearchTip')) + '</div>' +
      '<div class="addrow"><input id="aSearch" placeholder="' + esc(t('searchPh')) + '" /><button class="mini bl" id="aGo">🔍</button></div>' +
      '<div id="aRes" class="mt8"></div>' +
      '<div class="mapwrap"><div class="minimap" id="aMap"></div><div class="cross">＋</div></div>' +
      '<div class="pickbar"><span id="aCoord">' + coordText(d) + '</span><span style="flex:1"></span>' +
      '<button class="mini bl" id="aCenter">' + esc(t('locCenter')) + '</button></div>' +
      '<div class="rkmeta mt8">' + esc(t('pickTip2')) + '</div>' +
      '<div class="hint">' + esc(t('locSkipTip')) + '</div>' +
      '</div>';

    /* ---------- ② 基本信息 ---------- */
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
    h += '<div class="grid2">' +
      '<div class="fld"><label>' + t('phoneL') + '</label><input id="aPhone" value="' + esc(d.phone || '') + '" /></div>' +
      '<div class="fld"><label>' + t('hoursL') + '</label><input id="aHours" value="' + esc(d.hours || '') + '" /></div>' +
      '</div>';
    h += '<div class="fld"><label>' + t('priceL') + '（¥）</label><input id="aPrice" inputmode="numeric" value="' + esc(d.price || '') + '" /></div>';
    h += '<div class="fld"><label>' + t('audience') + '</label><div class="multi" id="aAuds">' +
      (S.cfg.auds || []).map(function (a) {
        return '<span class="m' + ((d.auds || []).indexOf(a.id) >= 0 ? ' on' : '') + '" data-a="' + a.id + '">' + esc(L(a, 'name')) + '</span>';
      }).join('') + '</div></div>';

    /* ---------- ③ 推荐理由 / 必点项 / 照片 ---------- */
    h += '<div class="fld"><label>' + t('reasonL') + '<span class="req">*</span></label><textarea id="aReason" placeholder="为什么值得去？">' + esc(d.reason || '') + '</textarea></div>';
    h += '<div class="fld"><label>' + t('tipsL') + '</label><textarea id="aTips">' + esc(d.tips || '') + '</textarea></div>';
    h += '<div class="fld"><label>标签（逗号分隔）</label><input id="aTags" value="' + esc((d.tags || []).join(',')) + '" /></div>';

    h += '<div class="blk"><h4>⭐ ' + esc(t('mustTry')) + '</h4>' +
      '<div class="addrow"><input id="aStarNew" placeholder="' + esc(t('mustTryPh')) + '" /><button class="mini bl" id="aStarAdd">' + esc(t('mustTryAdd')) + '</button></div>' +
      '<div id="aStars" class="mt8"></div></div>';

    h += '<div class="blk"><h4>📷 ' + esc(t('photo')) + '</h4>' +
      '<div class="addrow"><input type="file" accept="image/*" id="aPhEnv" hidden /><input type="file" accept="image/*" id="aPhDish" hidden />' +
      '<button class="mini gh" id="aPhEnvBtn">📷 ' + esc(t('photoAddEnv')) + '</button>' +
      '<button class="mini gh" id="aPhDishBtn">🍽 ' + esc(t('photoAddDish')) + '</button></div>' +
      '<div id="aPhotos" class="mt8"></div></div>';

    /* ---------- ④ 实时积分预告 ---------- */
    h += '<div class="ptsbox"><div class="ptstop"><span>' + esc(t('complete')) + '</span><b id="aPts">—</b></div>' +
      '<div id="aPtsList" class="rkmeta"></div>' +
      '<div class="rkmeta" style="margin-top:6px">⭐ ' + esc(t('ptsReviewed')) + ' · 📈 ' + esc(t('ptsHint')) + '</div></div>';

    h += '<div class="err" id="aErr"></div>';

    openSheet((d.status === 'approved' ? t('edit') : '＋ ' + t('add')), h, true);
    $('sheetFoot').innerHTML = '<button class="btn line" id="aCancel">' + t('cancel') + '</button>' +
      '<button class="btn blue" id="aSave">' + t('submit') + '</button>';

    Array.prototype.forEach.call($('sheetBody').querySelectorAll('#aAuds .m'), function (m) {
      m.addEventListener('click', function () { m.classList.toggle('on'); onChange(); });
    });
    $('aCancel').addEventListener('click', closeSheet);
    $('aSave').addEventListener('click', saveAdd);
    $('aGo').addEventListener('click', doSearch);
    $('aSearch').addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });
    $('aStarAdd').addEventListener('click', function () { addFormStar(); });
    $('aStarNew').addEventListener('keydown', function (e) { if (e.key === 'Enter') addFormStar(); });
    $('aPhEnvBtn').addEventListener('click', function () { $('aPhEnv').click(); });
    $('aPhDishBtn').addEventListener('click', function () { $('aPhDish').click(); });
    $('aPhEnv').addEventListener('change', function () { addFormPhotos(this.files, 'env'); this.value = ''; });
    $('aPhDish').addEventListener('change', function () { addFormPhotos(this.files, 'dish'); this.value = ''; });
    $('aCenter').addEventListener('click', function () {
      var c = GMap.pickerCenter();
      if (!c) { GG.toast(t('mapNoKey')); return; }
      setCoord(c.lat, c.lng);
    });
    if (!estBound) {
      // input/change 监听挂在常驻节点上，只绑一次，避免重复累加
      $('sheetBody').addEventListener('input', onChange);
      $('sheetBody').addEventListener('change', onChange);
      estBound = true;
    }

    renderFormStars(); renderFormPhotos(); onChange();

    // 迷你取点地图（失败也不阻塞：可用搜索或跳过）
    setTimeout(function () { initFormPicker(); }, 80);
  }

  function coordText(d) {
    if (d.lat == null || d.lng == null) return '<b style="color:var(--warn)">⚠ ' + esc(t('locNone')) + '</b>';
    return '✅ <b>' + esc(t('locOk')) + '：' + d.lat.toFixed(6) + ', ' + d.lng.toFixed(6) + '</b>' +
      (d.locApprox ? ' <span class="apptag">' + esc(t('locApproxTag')) + '</span>' : '');
  }
  function setCoord(lat, lng) {
    draft.lat = lat; draft.lng = lng; draft.locApprox = false;
    $('aCoord').innerHTML = coordText(draft);
    GG.toast(t('locOk'));
    onChange();
  }
  function initFormPicker() {
    var key = (S.cfg && S.cfg.mapKey) || '';
    var box = $('aMap');
    if (!box) return;
    var d = draft;
    var la = d.lat != null ? d.lat : ((S.cfg.center || {}).lat || 22.5376);
    var lo = d.lng != null ? d.lng : ((S.cfg.center || {}).lng || 114.0235);
    var done = function () {
      GMap.destroyPicker();   // 二次打开时先清掉旧实例，避免画布叠加导致点不动
      GMap.initPicker(box, la, lo, function (x, y) {
        if (x == null || y == null) return;
        setCoord(x, y);
      });
      GMap.pickerOnPan(function () {
        try {
          var c = GMap.pickerCenter();
          if (c) box.setAttribute('data-c', c.lat.toFixed(5) + ',' + c.lng.toFixed(5));
        } catch (e) {}
      });
    };
    if (GMap.ready()) return done();
    if (!key) {
      box.innerHTML = '<div class="mapfall">' + esc(t('mapNoKey')) + '<br><span class="rkmeta">' + esc(t('locSearchTip')) + '</span></div>';
      return;
    }
    box.innerHTML = '<div class="mapfall">' + esc(t('mapLoading')) + '</div>';
    GMap.load(key).then(done, function () {
      box.innerHTML = '<div class="mapfall">' + esc(t('mapKeyFail')) + '</div>';
    });
  }

  function addFormStar() {
    var v = String($('aStarNew').value || '').trim();
    if (!v) return;
    draft.stars = draft.stars || [];
    draft.stars.push({ id: GG.uid('s'), text: v, by: GG.normEmp(S.me.emp), ts: GG.now() });
    $('aStarNew').value = '';
    renderFormStars(); onChange();
  }
  function renderFormStars() {
    if (!$('aStars')) return;
    var list = draft.stars || [];
    $('aStars').innerHTML = list.length ? '<div class="starlist">' + list.map(function (s) {
      return '<div class="staritem"><span>' + esc(s.text) + '</span>' +
        '<span class="pdel" data-sdel="' + s.id + '">✕</span></div>';
    }).join('') + '</div>' : '<div class="rkmeta">' + esc(t('mustTryEmpty')) + '</div>';
    Array.prototype.forEach.call($('aStars').querySelectorAll('[data-sdel]'), function (b) {
      b.addEventListener('click', function () {
        draft.stars = (draft.stars || []).filter(function (x) { return x.id !== b.getAttribute('data-sdel'); });
        renderFormStars(); onChange();
      });
    });
  }
  function addFormPhotos(fileList, kind) {
    var arr = Array.prototype.slice.call(fileList || []);
    if (!arr.length) return;
    var room = PH_MAXF - ((draft.photos || []).length);
    if (room <= 0) { GG.toast(t('photoFull')); return; }
    arr = arr.slice(0, room);
    GG.toast(t('loading'));
    Promise.all(arr.map(function (f) {
      return GG.compressImg(f, 1000, 0.72).catch(function () { return null; });
    })).then(function (urls) {
      var me = GG.normEmp(S.me.emp);
      urls.forEach(function (u) {
        if (!u) return;
        draft.photos.push({ id: GG.uid('ph'), kind: kind, url: u, by: me, ts: GG.now() });
      });
      renderFormPhotos(); onChange();
    });
  }
  function renderFormPhotos() {
    if (!$('aPhotos')) return;
    var list = draft.photos || [];
    $('aPhotos').innerHTML = list.length ? '<div class="phgrid">' + list.map(function (x) {
      return '<div class="phthumb"><img src="' + x.url + '" />' +
        '<span class="pkind" data-pkind="' + x.id + '">' + esc(x.kind === 'env' ? t('photoEnv') : (x.kind === 'dish' ? t('photoDish') : t('photoOther'))) + '</span>' +
        '<span class="pdel" data-fdel="' + x.id + '">✕</span></div>';
    }).join('') + '</div>' : '<div class="rkmeta">' + esc(t('photoEmpty')) + '</div>';
    Array.prototype.forEach.call($('aPhotos').querySelectorAll('[data-fdel]'), function (b) {
      b.addEventListener('click', function () {
        draft.photos = (draft.photos || []).filter(function (x) { return x.id !== b.getAttribute('data-fdel'); });
        renderFormPhotos(); onChange();
      });
    });
    Array.prototype.forEach.call($('aPhotos').querySelectorAll('[data-pkind]'), function (b) {
      b.addEventListener('click', function () {
        var p = (draft.photos || []).filter(function (x) { return x.id === b.getAttribute('data-pkind'); })[0];
        if (!p) return;
        p.kind = (p.kind === 'env') ? 'dish' : 'env';
        renderFormPhotos();
      });
    });
  }

  /* 实时估算「审核通过后可拿多少分」 */
  var estTm = null, estBound = false;
  function onChange() {
    clearTimeout(estTm);
    estTm = setTimeout(updateEstimate, 120);
  }
  function updateEstimate() {
    if (!$('aPts')) return;
    var g = function (id) { return ($(id) || {}).value; };
    var tmp = {
      address: String(g('aAddr') || '').trim(),
      hours: String(g('aHours') || '').trim(),
      phone: String(g('aPhone') || '').trim(),
      price: String(g('aPrice') || '').trim(),
      nameEn: String(g('aNameEn') || '').trim(),
      tips: String(g('aTips') || '').trim(),
      tags: String(g('aTags') || '').split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean),
      auds: Array.prototype.map.call($('sheetBody').querySelectorAll('#aAuds .m.on'), function (m) { return m.getAttribute('data-a'); }),
      dist: g('aDist')
    };
    var r = GG.draftPts(tmp, S.cfg, (draft.photos || []).length, (draft.stars || []).length);
    $('aPts').textContent = '+' + r.pts + ' ' + t('ptsUnit');
    $('aPtsList').innerHTML = esc(t('ptsEarn')) + '：' + r.items.map(function (x) {
      return '<span class="ptschip">' + esc(x.label) + ' +' + x.pts + '</span>';
    }).join(' ');
  }

  function doSearch() {
    var kw = String($('aSearch').value || '').trim();
    if (!kw) return;
    var key = (S.cfg && S.cfg.mapKey) || '';
    if (!key) { $('aRes').innerHTML = '<div class="rkmeta">' + t('mapNoKey') + '</div>'; return; }
    $('aRes').innerHTML = '<div class="rkmeta">' + t('loading') + '</div>';
    GMap.search(kw, key, '深圳').then(function (arr) {
      arr = arr || [];
      $('aRes').innerHTML = arr.length ? arr.map(function (o, i) {
        return '<div class="rankrow" data-i="' + i + '" style="cursor:pointer"><div class="rkno">📍</div>' +
          '<div class="rkmain"><div class="rkname">' + esc(o.title) + '</div>' +
          '<div class="rkmeta">' + esc(o.address || '') + '</div></div></div>';
      }).join('') : '<div class="rkmeta">' + t('none') + '</div>';
      Array.prototype.forEach.call($('aRes').querySelectorAll('.rankrow'), function (r) {
        r.addEventListener('click', function () {
          var o = arr[+r.getAttribute('data-i')];
          if (!o || !o.location) return;
          setCoord(o.location.lat, o.location.lng);
          if (!$('aName').value) $('aName').value = o.title;
          if (!$('aAddr').value) $('aAddr').value = o.address || '';
          if (GMap.ready()) GMap.pickerGo(o.location.lat, o.location.lng);
          onChange();
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
    var me = GG.normEmp(S.me.emp);
    (d.photos || []).forEach(function (x) { if (!x.by) { x.by = me; x.ts = x.ts || GG.now(); } });
    (d.stars || []).forEach(function (x) { if (!x.by) { x.by = me; x.ts = x.ts || GG.now(); } });
    if (!d.photos || !d.photos.length) delete d.photos;
    if (!d.stars || !d.stars.length) delete d.stars;

    var e = $('aErr');
    if (!d.nameZh) { e.textContent = t('nameReq2'); return; }
    if (!d.cat) { e.textContent = t('catReq'); return; }
    if (!d.reason) { e.textContent = t('reasonReq'); return; }
    // 没选点也不卡住：按所选区域中心生成一个待校准坐标，管理员审核时可微调
    if (d.lat == null || d.lng == null) {
      var dd = (S.cfg.dists || []).filter(function (x) { return x.id === d.dist; })[0];
      var c = (S.cfg.center) || { lat: 22.5376, lng: 114.0235 };
      d.lat = dd ? dd.lat : c.lat;
      d.lng = dd ? dd.lng : c.lng;
      d.locApprox = true;
    } else { d.locApprox = false; }
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
