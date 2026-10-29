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
      syncSome();          // 后台静默跟随地图更新，失败也不影响使用
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
    // 打开详情时顺手跟地图核对一次；有更新就静默改掉并重开（poiSyncedAt 已刷新，不会循环）
    if (placeStale(p)) {
      autoSync(p).then(function (ok) {
        if (!ok) return;
        decorate();
        openPlace(id);
        GG.toast(t('syncedTip'));
      });
    }
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
  var draft = null, PH_MAXF = 6, catSel = (S.cfg.cats[0] || {}).id || '';
  function openAdd(editP) {
    draft = editP ? GG.clone(editP) : {
      id: GG.uid('p'), nameZh: '', nameEn: '', cat: (S.cfg.cats[0] || {}).id || '', dist: '',
      address: '', lat: null, lng: null, phone: '', hours: '', price: '', auds: [],
      reason: '', tips: '', tags: [], stars: [], photos: [], locApprox: false,
      poiId: '', poiLocked: false, poiSyncedAt: 0,
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

    /* ---------- ① 位置：搜名字 or 拖地图，二选一即可，坐标自动得到 ---------- */
    h += '<div class="blk locblk"><h4>📍 ' + esc(t('locTitle')) + ' <span class="req">*</span></h4>' +
      '<div class="rkmeta">' + esc(t('locSearchTip')) + '</div>' +
      '<div class="addrow"><input id="aSearch" placeholder="' + esc(t('searchPh')) + '" autocomplete="off" />' +
      '<button class="mini bl" id="aGo">🔍</button></div>' +
      '<div id="aRes" class="mt8"></div>' +
      '<div class="mapwrap"><div class="minimap" id="aMap"></div><div class="cross">＋</div></div>' +
      '<div id="aLocStat" class="locstat">' + esc(t('dragTip')) + '</div>' +
      '<div id="aPoiCard"></div>' +
      '</div>';

    /* ---------- ② 地图已经帮忙填好的信息（默认收起，需要时再展开改） ---------- */
    h += '<div class="blk autoblk"><div class="autohd" id="aAutoHd">' +
      '<span class="autodot">✅</span><span>' + esc(t('autoFillTitle')) + '</span>' +
      '<b id="aAutoSum" class="autosum"></b>' +
      '<span class="autotog" id="aAutoTog">' + esc(t('manualEdit')) + '</span>' +
      '</div>' +
      '<div id="aAutoBody" class="autobody hide">' +
      '<div class="rkmeta mb8">' + esc(t('autoFillTip')) + '</div>' +
      '<div class="fld"><label>' + esc(t('name')) + '（中）</label><input id="aName" value="' + esc(d.nameZh) + '" /></div>' +
      '<div class="fld"><label>' + esc(t('name')) + '（EN）</label><input id="aNameEn" value="' + esc(d.nameEn || '') + '" /></div>' +
      '<div class="fld"><label>' + esc(t('addrL')) + '</label><input id="aAddr" value="' + esc(d.address || '') + '" /></div>' +
      '<div class="fld"><label>' + esc(t('phoneL')) + '</label><input id="aPhone" value="' + esc(d.phone || '') + '" /></div>' +
      '<div class="fld"><label>' + esc(t('dist')) + '</label><select id="aDist"><option value="">—</option>' +
      (S.cfg.dists || []).map(function (x) {
        return '<option value="' + esc(x.id) + '"' + (d.dist === x.id ? ' selected' : '') + '>' + esc(L(x, 'name')) + '</option>';
      }).join('') +
      '</select></div>' +
      '<button class="mini gh" id="aLockBtn" type="button">' + esc(t('poiLockBtn')) + '</button>' +
      '<div class="hint">' + esc(t('poiLockTip')) + '</div>' +
      '</div></div>';

    /* ---------- ③ 员工真正需要填的：分类 + 理由 + 人群 ---------- */
    h += '<div class="blk"><h4>✍️ ' + esc(t('onlyAsk')) + '</h4>' +
      '<div class="fld"><label>' + esc(t('cat')) + '<span class="req">*</span></label>' +
      '<div class="multi" id="aCat">' +
      (S.cfg.cats || []).map(function (c) {
        return '<span class="m' + (catSel === c.id ? ' on' : '') + '" data-cat="' + esc(c.id) + '">' +
          esc(c.icon || '') + ' ' + esc(L(c, 'name')) + '</span>';
      }).join('') + '</div></div>' +
      '<div class="fld"><label>' + esc(t('reasonL')) + '<span class="req">*</span></label>' +
      '<textarea id="aReason" placeholder="' + esc(t('reasonPh')) + '">' + esc(d.reason || '') + '</textarea></div>' +
      '<div class="fld"><label>' + esc(t('audience')) + '</label><div class="multi" id="aAuds">' +
      (S.cfg.auds || []).map(function (a) {
        return '<span class="m' + ((d.auds || []).indexOf(a.id) >= 0 ? ' on' : '') + '" data-a="' + esc(a.id) + '">' + esc(L(a, 'name')) + '</span>';
      }).join('') + '</div></div>' +
      '</div>';

    /* ---------- ④ 更多详情：选填，默认收起，不占用员工注意力 ---------- */
    h += '<div class="blk"><div class="autohd" id="aMoreHd">' +
      '<span class="autodot">📎</span><span>' + esc(t('moreOpt')) + '</span>' +
      '<span class="autotog" id="aMoreTog">' + esc(t('moreShow')) + '</span></div>' +
      '<div id="aMoreBody" class="autobody hide">' +
      '<div class="fld"><label>' + esc(t('hoursL')) + '</label><input id="aHours" value="' + esc(d.hours || '') + '" /></div>' +
      '<div class="fld"><label>' + esc(t('priceL')) + '（¥）</label><input id="aPrice" inputmode="numeric" value="' + esc(d.price || '') + '" /></div>' +
      '<div class="fld"><label>' + esc(t('tipsL')) + '</label><textarea id="aTips">' + esc(d.tips || '') + '</textarea></div>' +
      '<div class="fld"><label>' + esc(t('tagsL')) + '</label><input id="aTags" value="' + esc((d.tags || []).join(',')) + '" /></div>' +
      '</div></div>';

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
    // 分类改成点标签（单选），比下拉少两步
    Array.prototype.forEach.call($('sheetBody').querySelectorAll('#aCat .m'), function (m) {
      m.addEventListener('click', function () {
        catSel = m.getAttribute('data-cat') || catSel;
        Array.prototype.forEach.call($('sheetBody').querySelectorAll('#aCat .m'), function (x) { x.classList.remove('on'); });
        m.classList.add('on'); onChange();
      });
    });
    bindTog('aAutoHd', 'aAutoBody', 'aAutoTog', 'manualEdit', 'manualHide');
    bindTog('aMoreHd', 'aMoreBody', 'aMoreTog', 'moreShow', 'manualHide');
    $('aCancel').addEventListener('click', closeSheet);
    $('aSave').addEventListener('click', askConfirm);
    $('aGo').addEventListener('click', doSearch);
    $('aSearch').addEventListener('input', onSearchInput);
    $('aSearch').addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });
    if ($('aLockBtn')) $('aLockBtn').addEventListener('click', function () {
      draft.poiLocked = true; GG.toast(t('poiLockTip')); updateAutoSummary();
    });
    $('aStarAdd').addEventListener('click', function () { addFormStar(); });
    $('aStarNew').addEventListener('keydown', function (e) { if (e.key === 'Enter') addFormStar(); });
    $('aPhEnvBtn').addEventListener('click', function () { $('aPhEnv').click(); });
    $('aPhDishBtn').addEventListener('click', function () { $('aPhDish').click(); });
    $('aPhEnv').addEventListener('change', function () { addFormPhotos(this.files, 'env'); this.value = ''; });
    $('aPhDish').addEventListener('change', function () { addFormPhotos(this.files, 'dish'); this.value = ''; });
    if (!estBound) {
      // input/change 监听挂在常驻节点上，只绑一次，避免重复累加
      $('sheetBody').addEventListener('input', onChange);
      $('sheetBody').addEventListener('change', onChange);
      estBound = true;
    }

    renderFormStars(); renderFormPhotos(); onChange(); updateLocUI();

    // 迷你取点地图（失败也不阻塞：可用搜索或跳过）
    setTimeout(function () { initFormPicker(); }, 80);
  }

  function bindTog(hdId, bodyId, togId, showKey, hideKey) {
    var hd = $(hdId), body = $(bodyId), tog = $(togId);
    if (!hd || !body) return;
    hd.addEventListener('click', function () {
      var hidden = body.classList.toggle('hide');
      if (tog) tog.textContent = hidden ? t(showKey) : t(hideKey);
    });
  }

  function coordText(d) {
    if (d.lat == null || d.lng == null) return '<b style="color:var(--warn)">⚠ ' + esc(t('locNone')) + '</b>';
    return '✅ <b>' + esc(t('locOk')) + '：' + d.lat.toFixed(6) + ', ' + d.lng.toFixed(6) + '</b>' +
      (d.locApprox ? ' <span class="apptag">' + esc(t('locApproxTag')) + '</span>' : '');
  }

  /* ============ 地图自动带入：名称 / 地址 / 电话 / 区域 ============ */
  var lastPois = [], lastPoiIdx = 0;

  function distIdOf(name) {
    var ds = (S.cfg && S.cfg.dists) || [];
    if (!name) return '';
    for (var i = 0; i < ds.length; i++) {
      var z = String(ds[i].zh || ''), e = String(ds[i].en || '');
      if (z && (name.indexOf(z) >= 0 || z.indexOf(name) >= 0)) return ds[i].id;
      if (e && name.toLowerCase().indexOf(e.toLowerCase()) >= 0) return ds[i].id;
    }
    return '';
  }
  function distNameOf(id) {
    var ds = (S.cfg && S.cfg.dists) || [];
    for (var i = 0; i < ds.length; i++) if (ds[i].id === id) return L(ds[i], 'name');
    return '';
  }
  // 把地图返回的信息写进草稿 + 折叠区输入框（手动锁定过就不再覆盖）
  function applyPoiInfo(poi, geo) {
    var d = draft;
    geo = geo || {};
    if (!d.poiLocked) {
      if (poi && poi.title) d.nameZh = poi.title;
      if (poi && poi.address) d.address = poi.address;
      if (poi && poi.tel) d.phone = poi.tel || d.phone;
      if (geo.address && !d.address) d.address = geo.address;
    }
    if (poi && poi.id) d.poiId = poi.id;
    var gid = distIdOf(geo.district);
    if (gid) d.dist = gid;
    if (geo.lat != null) { d.lat = geo.lat; d.lng = geo.lng; d.locApprox = false; }
    d.poiSyncedAt = GG.now();
    // 记一份「地图给的快照」，提交确认时用来区分哪些是地图带的、哪些是自己改的
    d.autoSet = { name: d.nameZh || '', address: d.address || '', phone: d.phone || '', dist: gid ? d.dist : (d.autoSet || {}).dist };
    syncAutoInputs(); updateLocUI(); updateAutoSummary(); onChange();
  }
  function srcOf(field) {
    var s = (draft.autoSet || {})[field];
    var v = draft[field === 'name' ? 'nameZh' : field] || '';
    return (v && s && v === s) ? 'map' : (v ? 'self' : '');
  }
  function syncAutoInputs() {
    var d = draft;
    if ($('aName')) $('aName').value = d.nameZh || '';
    if ($('aNameEn')) $('aNameEn').value = d.nameEn || '';
    if ($('aAddr')) $('aAddr').value = d.address || '';
    if ($('aPhone')) $('aPhone').value = d.phone || '';
    if ($('aDist')) $('aDist').value = d.dist || '';
  }
  function updateAutoSummary() {
    var el = $('aAutoSum'); if (!el) return;
    var d = draft, parts = [];
    if (d.nameZh) parts.push(d.nameZh);
    if (d.address) parts.push(d.address);
    if (d.phone) parts.push(d.phone);
    var dn = distNameOf(d.dist);
    if (dn) parts.push(dn);
    el.innerHTML = parts.length ? esc(parts.join(' · ')) : '<span class="rkmeta">' + esc(t('locNone')) + '</span>';
  }
  function updateLocUI() {
    var card = $('aPoiCard'), st = $('aLocStat'), d = draft;
    if (st) {
      st.innerHTML = d.lat != null
        ? '<span class="rkmeta">📍 ' + d.lat.toFixed(6) + ', ' + d.lng.toFixed(6) + '</span>'
        : '<span class="rkmeta">' + esc(t('dragTip')) + '</span>';
    }
    if (!card) return;
    if (!d.nameZh && !d.address && !d.phone) { card.innerHTML = ''; return; }
    var rows = '';
    if (d.nameZh) rows += '<div class="poline pook"><b>🏠 ' + esc(d.nameZh) + '</b></div>';
    if (d.address) rows += '<div class="poline rkmeta">' + esc(d.address) + '</div>';
    if (d.phone) rows += '<div class="poline rkmeta">☎ ' + esc(d.phone) + '</div>';
    var dn = distNameOf(d.dist);
    if (dn) rows += '<div class="poline rkmeta">🗺 ' + esc(dn) + '</div>';
    card.innerHTML = '<div class="poicard"><div class="pohd">✅ ' + esc(t('poiPicked')) + '</div>' + rows +
      '<div class="poacts"><span id="aPoiSwitch">' + esc(t('poiSwitch')) + '</span>' +
      '<span id="aPoiNone">' + esc(t('poiNone')) + '</span></div></div>';
    if ($('aPoiSwitch')) $('aPoiSwitch').addEventListener('click', pickOtherPoi);
    if ($('aPoiNone')) $('aPoiNone').addEventListener('click', function () {
      draft.nameZh = ''; draft.address = ''; draft.phone = '';
      draft.autoSet = {}; draft.poiId = ''; draft.poiLocked = true;   // 地图没匹配对，之后以手动为准
      syncAutoInputs(); updateLocUI(); updateAutoSummary(); onChange();
    });
  }
  // 拖动/点击后反查：自动得到名称、地址、电话、区域
  function reverseFill(lat, lng) {
    var key = (S.cfg && S.cfg.mapKey) || '';
    if (!key) { setCoord(lat, lng, true); return; }
    var st = $('aLocStat');
    if (st) st.innerHTML = '<span class="rkmeta">📍 ' + lat.toFixed(6) + ', ' + lng.toFixed(6) + ' · ' + esc(t('locating')) + '</span>';
    GMap.geocode(lat, lng, key).then(function (g) {
      lastPois = g.pois || []; lastPoiIdx = 0;
      var p = null;
      for (var i = 0; i < lastPois.length; i++) {
        if (draft.nameZh && lastPois[i].title === draft.nameZh) { p = lastPois[i]; break; }
      }
      if (!p) p = lastPois[0] || null;
      applyPoiInfo(p, { address: g.address, district: g.district, lat: lat, lng: lng });
      var s2 = $('aLocStat');
      if (s2) s2.innerHTML = '<span class="rkmeta">📍 ' + lat.toFixed(6) + ', ' + lng.toFixed(6) +
        (p ? '' : ' · ' + esc(t('locNoPoi'))) + '</span>';
    }, function () {
      setCoord(lat, lng, true);
      var s2 = $('aLocStat');
      if (s2) s2.innerHTML = '<span class="rkmeta">📍 ' + lat.toFixed(6) + ', ' + lng.toFixed(6) + ' · ' + esc(t('locNoPoi')) + '</span>';
    });
  }

  function setCoord(lat, lng, silent) {
    draft.lat = lat; draft.lng = lng; draft.locApprox = false;
    updateLocUI(); updateAutoSummary();
    if (!silent) GG.toast(t('locOk'));
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
        reverseFill(x, y);            // 点一下：取点并自动识别是哪家店
      });
      // 拖地图：松手 500ms 后自动反查地址/店名，无需再点任何按钮
      GMap.pickerOnPan(function (c) {
        if (!c) return;
        draft.lat = c.lat; draft.lng = c.lng; draft.locApprox = false;
        var st = $('aLocStat');
        if (st) st.innerHTML = '<span class="rkmeta">📍 ' + c.lat.toFixed(6) + ', ' + c.lng.toFixed(6) + ' · ' + esc(t('locating')) + '</span>';
        clearTimeout(panTimer);
        panTimer = setTimeout(function () { reverseFill(c.lat, c.lng); }, 500);
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
  var panTimer = null;

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

      cat: catSel,
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

  var searchTm = null;
  function onSearchInput() { clearTimeout(searchTm); searchTm = setTimeout(doSearch, 350); }

  function doSearch() {
    var kw = String(($('aSearch') || {}).value || '').trim();
    var res = $('aRes');
    if (!kw) { if (res) res.innerHTML = ''; return; }
    var key = (S.cfg && S.cfg.mapKey) || '';
    if (!key) { if (res) res.innerHTML = '<div class="rkmeta">' + esc(t('mapNoKey')) + '</div>'; return; }
    if (res) res.innerHTML = '<div class="rkmeta">' + esc(t('loading')) + '</div>';
    GMap.search(kw, key, '深圳').then(function (arr) {
      arr = arr || [];
      // 存下来，后面「换附近一个」可以来回切
      lastPois = arr.map(function (o) {
        return {
          id: o.id, title: o.title, address: o.address, tel: o.tel || '',
          ad: (o.ad_info || {}).district || '',
          lat: o.location && o.location.lat, lng: o.location && o.location.lng
        };
      });
      lastPoiIdx = -1;
      if (!res) return;
      res.innerHTML = arr.length ? arr.map(function (o, i) {
        return '<div class="rankrow" data-i="' + i + '" style="cursor:pointer"><div class="rkno">📍</div>' +
          '<div class="rkmain"><div class="rkname">' + esc(o.title) + '</div>' +
          '<div class="rkmeta">' + esc(o.address || '') + '</div></div></div>';
      }).join('') : '<div class="rkmeta">' + esc(t('none')) + '</div>';
      Array.prototype.forEach.call(res.querySelectorAll('.rankrow'), function (r) {
        r.addEventListener('click', function () { pickPoi(+r.getAttribute('data-i')); });
      });
    }, function () { if (res) res.innerHTML = '<div class="rkmeta">' + esc(t('mapKeyFail')) + '</div>'; });
  }

  // 选中一家：名称 / 地址 / 电话 / 区域 / 坐标，一次性全部自动带出
  function pickPoi(i) {
    var p = lastPois[i];
    if (!p) return;
    lastPoiIdx = i;
    applyPoiInfo(
      { id: p.id, title: p.title, address: p.address, tel: p.tel },
      { lat: p.lat, lng: p.lng, address: p.address, district: p.ad }
    );
    if (GMap.ready()) GMap.pickerGo(p.lat, p.lng);
    var res = $('aRes'); if (res) res.innerHTML = '';
    var sb = $('aSearch'); if (sb) sb.value = p.title || '';
  }

  function pickOtherPoi() {
    if (!lastPois.length) return;
    lastPoiIdx = (lastPoiIdx + 1) % lastPois.length;
    var p = lastPois[lastPoiIdx];
    applyPoiInfo(
      { id: p.id, title: p.title, address: p.address, tel: p.tel },
      { lat: p.lat != null ? p.lat : draft.lat, lng: p.lng != null ? p.lng : draft.lng, district: p.ad }
    );
    if (p.lat != null && GMap.ready()) GMap.pickerGo(p.lat, p.lng);
  }

  /* ---------- 提交前确认：地图同步来的信息，让提交者最后过一眼 ---------- */
  function gv(id) { return String(($(id) || {}).value || '').trim(); }

  // 把表单收进草稿（表单被确认卡替换后就读不到了，必须先收）
  function collect() {
    var d = draft;
    if ($('aName')) d.nameZh = gv('aName');
    if ($('aNameEn')) d.nameEn = gv('aNameEn');
    if ($('aAddr')) d.address = gv('aAddr');
    if ($('aPhone')) d.phone = gv('aPhone');
    if ($('aDist')) d.dist = gv('aDist');
    if ($('aHours')) d.hours = gv('aHours');
    if ($('aPrice')) d.price = gv('aPrice');
    if ($('aReason')) d.reason = gv('aReason');
    if ($('aTips')) d.tips = gv('aTips');
    if ($('aTags')) d.tags = gv('aTags').split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
    if ($('sheetBody').querySelector('#aAuds')) {
      d.auds = Array.prototype.map.call($('sheetBody').querySelectorAll('#aAuds .m.on'), function (m) { return m.getAttribute('data-a'); });
    }
    d.cat = catSel || '';
    var e = $('aErr');
    if (!d.nameZh) return { ok: false, msg: t('nameReq2'), el: e };
    if (!d.cat) return { ok: false, msg: t('catReq'), el: e };
    if (!d.reason) return { ok: false, msg: t('reasonReq'), el: e };
    return { ok: true };
  }

  function cfmRow(k, v, src) {
    if (!v) return '';
    var tag = src === 'map' ? '<span class="cfmsrc">' + esc(t('fromMap')) + '</span>'
      : src === 'self' ? '<span class="cfmsrc self">' + esc(t('selfFilled')) + '</span>' : '';
    return '<div class="cfmline"><div class="cfmk">' + esc(k) + '</div><div class="cfmval">' + esc(v) + tag + '</div></div>';
  }

  function askConfirm() {
    var r = collect();
    if (!r.ok) {
      var e = $('aErr');
      if (e) e.textContent = r.msg;
      else GG.toast(r.msg);
      return;
    }
    var d = draft;
    var h = '';
    h += '<div class="cfmbox"><h4>✅ ' + esc(t('confirmTitle')) + '</h4>' +
      '<div class="rkmeta">' + esc(t('confirmTip')) + '</div>' +
      cfmRow(t('name'), d.nameZh, srcOf('name')) +
      cfmRow(t('addrL'), d.address, srcOf('address')) +
      cfmRow(t('phoneL'), d.phone, srcOf('phone')) +
      cfmRow(t('dist'), distNameOf(d.dist), (d.autoSet || {}).dist === d.dist && d.dist ? 'map' : (d.dist ? 'self' : '')) +
      '</div>';

    h += '<div class="cfmbox"><h4>✍️ ' + esc(t('onlyAsk')) + '</h4>' +
      cfmRow(t('cat'), L(catOf(d.cat), 'name'), '') +
      cfmRow(t('reasonL'), d.reason, 'self') +
      cfmRow(t('audience'), (d.auds || []).map(function (a) {
        var o = (S.cfg.auds || []).filter(function (x) { return x.id === a; })[0];
        return o ? L(o, 'name') : '';
      }).filter(Boolean).join('、'), '') +
      '</div>';

    var extras = [];
    if ((d.stars || []).length) extras.push('⭐ ' + t('mustTry') + ' × ' + d.stars.length);
    if ((d.photos || []).length) extras.push('📷 ' + t('photo') + ' × ' + d.photos.length);
    if (d.hours) extras.push('🕒 ' + d.hours);
    if (d.price) extras.push('💰 ¥' + d.price);
    if ((d.tags || []).length) extras.push('🏷 ' + d.tags.join('、'));
    if (extras.length) {
      h += '<div class="cfmbox"><h4>📎 ' + esc(t('moreOpt')) + '</h4>' +
        '<div class="cfmval">' + esc(extras.join(' · ')) + '</div></div>';
    }

    h += '<div class="rkmeta" style="margin-top:8px">📍 ' +
      (d.lat != null ? d.lat.toFixed(6) + ', ' + d.lng.toFixed(6)
        : esc(t('locSkipTip'))) + '</div>';
    h += '<div class="err" id="aErr"></div>';

    openSheet('✅ ' + t('confirmTitle'), h, true);
    $('sheetFoot').innerHTML = '<button class="btn line" id="aBack">' + esc(t('confirmEdit')) + '</button>' +
      '<button class="btn blue" id="aSubmit">' + esc(t('confirmOk')) + '</button>';
    $('aBack').addEventListener('click', function () { renderAdd(); });
    $('aSubmit').addEventListener('click', doSubmit);
  }

  function doSubmit() {
    var d = draft;
    var me = GG.normEmp(S.me.emp);
    (d.photos || []).forEach(function (x) { if (!x.by) { x.by = me; x.ts = x.ts || GG.now(); } });
    (d.stars || []).forEach(function (x) { if (!x.by) { x.by = me; x.ts = x.ts || GG.now(); } });
    if (!d.photos || !d.photos.length) delete d.photos;
    if (!d.stars || !d.stars.length) delete d.stars;

    var e = $('aErr');
    // 名称是地图给的，之后地图改名才允许跟随；员工自己写的名字永远不覆盖
    var as = d.autoSet || {};
    d.nameAuto = !!(as.name && d.nameZh && as.name === d.nameZh);
    // 没选点也不卡住：按所选区域中心生成一个待校准坐标，管理员审核时可微调
    if (d.lat == null || d.lng == null) {
      var dd = (S.cfg.dists || []).filter(function (x) { return x.id === d.dist; })[0];
      var c = (S.cfg.center) || { lat: 22.5376, lng: 114.0235 };
      d.lat = dd ? dd.lat : c.lat;
      d.lng = dd ? dd.lng : c.lng;
      d.locApprox = true;
    } else { d.locApprox = false; }
    d.updatedAt = GG.now();
    if (e) e.textContent = '';
    var btn = $('aSubmit');
    if (btn) btn.disabled = true;
    GG.placesPut(d).then(function () {
      if (btn) btn.disabled = false;
      GG.toast(t('submitOk'));
      closeSheet();
      refresh(true);
    }, function (err) {
      if (btn) btn.disabled = false;
      if (e) e.textContent = (err && err.message) || 'save failed';
    });
  }

  /* ============ 店铺信息随地图自动跟随更新 ============ */
  var SYNC_MS = 7 * 24 * 3600 * 1000;   // 超过 7 天就在打开时静默刷新一次
  function placeStale(p) {
    if (!p || p.poiLocked) return false;
    if (p.lat == null || p.lng == null) return false;
    return (GG.now() - (p.poiSyncedAt || 0)) > SYNC_MS;
  }
  // 只更新「原本就来自地图」的字段，人工改过的绝不覆盖
  function autoSync(p) {
    var key = (S.cfg && S.cfg.mapKey) || '';
    if (!key || !p || p.poiLocked) return Promise.resolve(false);
    if (p.lat == null || p.lng == null) return Promise.resolve(false);
    return GMap.geocode(p.lat, p.lng, key).then(function (g) {
      var pois = g.pois || [], hit = null, i;
      for (i = 0; i < pois.length; i++) {
        if (p.poiId && pois[i].id === p.poiId) { hit = pois[i]; break; }
      }
      if (!hit) for (i = 0; i < pois.length; i++) {
        if (pois[i].title && pois[i].title === p.nameZh) { hit = pois[i]; break; }
      }
      if (!hit && p.poiId) return false;          // 有 POI 绑定却查不到，不动，避免误改
      if (!hit) hit = pois[0] || null;
      var changed = false;
      if (hit) {
        if (hit.id && hit.id !== p.poiId) { p.poiId = hit.id; changed = true; }
        if (p.nameAuto && hit.title && hit.title !== p.nameZh) { p.nameZh = hit.title; changed = true; }
        if (hit.address && hit.address !== p.address) { p.address = hit.address; changed = true; }
        if (hit.tel && hit.tel !== p.phone) { p.phone = hit.tel; changed = true; }
      }
      var gid = distIdOf(g.district);
      if (gid && gid !== p.dist) { p.dist = gid; changed = true; }
      p.poiSyncedAt = GG.now();
      if (changed) { p.updatedAt = GG.now(); return GG.placesPut(p).then(function () { return true; }, function () { return true; }); }
      return false;
    }, function () { return false; });
  }
  // 列表加载后，挑两条陈旧的静默刷新（不打断员工操作）
  function syncSome() {
    var key = (S.cfg && S.cfg.mapKey) || '';
    if (!key) return;
    var q = S.places.filter(placeStale).slice(0, 2);
    q.forEach(function (p) {
      autoSync(p).then(function (ok) { if (ok) { decorate(); renderMap(false); } });
    });
  }

  return { boot: boot, refresh: refresh, openAdd: openAdd, openPlace: openPlace, openRank: openRank, state: S };
})();
