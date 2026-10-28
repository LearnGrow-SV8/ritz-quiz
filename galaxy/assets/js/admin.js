/* 星河玩味 · 管理后台 */
var Adm = (function () {
  'use strict';
  var S = { cfg: null, places: [], votes: [], users: [], tab: 'overview', filter: 'pending' };
  var DEFAULT_ADMIN = 'RCSZ20090315';

  function $(id) { return GG.$(id); }
  function t(k) { return GG.t(k); }
  function esc(s) { return GG.esc(s); }
  function L(o, k) { return GG.biling(o, k); }

  function boot() {
    $('admLoginWrap').classList.remove('hidden');
    $('admMain').classList.add('hidden');
    $('admGo').addEventListener('click', login);
    $('admPwd').addEventListener('keydown', function (e) { if (e.key === 'Enter') login(); });
    $('admLang').addEventListener('click', function () {
      GG.setLang(GG.getLang() === 'zh' ? 'en' : 'zh'); location.reload();
    });
    document.title = GG.getLang() === 'zh' ? t('adminTitle') + ' · ' + t('app') : t('adminTitle') + ' · ' + t('appEn');
  }

  function login() {
    var pwd = String($('admPwd').value || '');
    var e = $('admErr'); e.textContent = '';
    GG.probe().then(function () { return GG.cfgGet(); }).then(function (cfg) {
      S.cfg = cfg;
      var p;
      if (cfg && cfg.adminHash) p = GG.adminHash(pwd).then(function (h) { return GG.safeEq(h, cfg.adminHash); });
      else p = Promise.resolve(GG.safeEq(pwd, DEFAULT_ADMIN));
      return p.then(function (ok) {
        if (!ok) { e.textContent = t('adminWrong'); return; }
        GG.setAdmin({ at: GG.now() });
        enter();
      });
    });
  }

  function enter() {
    $('admLoginWrap').classList.add('hidden');
    $('admMain').classList.remove('hidden');
    if (!GG.isCloud()) {
      $('admBanner').innerHTML = '<div class="banner"><b>' + t('localMode') + '</b> — ' + t('localModeTip') + '</div>';
    }
    render();
  }

  function reload() {
    return Promise.all([GG.cfgGet(), GG.placesList(), GG.votesList(), GG.usersList()]).then(function (r) {
      S.cfg = r[0]; S.places = r[1] || []; S.votes = r[2] || []; S.users = r[3] || [];
    });
  }

  function render() {
    reload().then(function () {
      var nav = [['overview', t('overview')], ['audit', t('audit')], ['places', t('allP')],
        ['cats', t('categories')], ['dists', t('districts')], ['thr', t('thresholds')],
        ['bulk', t('bulk')], ['users', t('users')], ['config', t('settings')]];
      $('admNav').innerHTML = nav.map(function (n) {
        return '<button class="ni' + (S.tab === n[0] ? ' on' : '') + '" data-n="' + n[0] + '">' + n[1] + '</button>';
      }).join('');
      Array.prototype.forEach.call($('admNav').querySelectorAll('.ni'), function (b) {
        b.addEventListener('click', function () { S.tab = b.getAttribute('data-n'); render(); });
      });
      var f = { overview: viewOverview, audit: viewAudit, places: viewPlaces, cats: viewCats,
        dists: viewDists, thr: viewThr, bulk: viewBulk, users: viewUsers, config: viewConfig }[S.tab];
      $('admBody').innerHTML = f ? f() : '';
      if (f) f.bind && f.bind();
    });
  }

  function catOf(id) {
    return (S.cfg.cats || []).filter(function (x) { return x.id === id; })[0] || { id: id, zh: '其它', en: 'Other', color: '#828282', icon: '📍' };
  }
  function distName(id, p) {
    var d = (S.cfg.dists || []).filter(function (x) { return x.id === id; })[0];
    if (d) return L(d, 'name');
    if (p && p.lat != null) { // 未指定区域时按坐标就近推断
      var best = null, bd = 1e9;
      (S.cfg.dists || []).forEach(function (x) {
        var dd = (p.lat - x.lat) * (p.lat - x.lat) + (p.lng - x.lng) * (p.lng - x.lng);
        if (dd < bd) { bd = dd; best = x; }
      });
      return best ? L(best, 'name') : '';
    }
    return '';
  }
  function fmt(ts) {
    if (!ts) return '—';
    var d = new Date(ts), p = function (x) { return ('0' + x).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function stat(p) {
    var g = GG.tally(S.votes, p.id);
    p._up = g.up; p._down = g.down; p._net = g.net;
    p._tier = GG.tierOf(g.net, g.up, g.down, (S.cfg && S.cfg.thr));
    return p;
  }

  /* ---------------- 总览 ---------------- */
  function viewOverview() {
    var pend = S.places.filter(function (p) { return p.status === 'pending'; });
    var appr = S.places.filter(function (p) { return p.status === 'approved'; });
    var rej = S.places.filter(function (p) { return p.status === 'rejected'; });
    var voted = {};
    S.votes.forEach(function (v) { if (v) voted[v.emp] = 1; });
    var h = '<h2>' + t('overview') + '</h2><div class="dsc">' + (GG.isCloud() ? '☁ ' + t('cloudMode') : '⚠ ' + t('localMode')) + '</div>';
    h += '<div class="statgrid">' +
      '<div class="stat"><b>' + pend.length + '</b><span>' + t('pending') + '</span></div>' +
      '<div class="stat"><b>' + appr.length + '</b><span>' + t('approved') + '</span></div>' +
      '<div class="stat"><b>' + rej.length + '</b><span>' + t('rejected') + '</span></div>' +
      '<div class="stat"><b>' + S.users.length + '</b><span>' + t('colleagues') + '</span></div>' +
      '<div class="stat"><b>' + S.votes.length + '</b><span>投票/备注</span></div>' +
      '<div class="stat"><b>' + Object.keys(voted).length + '</b><span>参与员工</span></div>' +
      '</div>';
    h += '<div class="panel mt14"><h3>' + t('audit') + '</h3>' + (pend.length
      ? '<div class="hint">有 <b>' + pend.length + '</b> 条待审核，点击左侧「' + t('audit') + '」处理。</div>' +
        '<button class="btn sm blue mt8" id="ovGo">' + t('audit') + '</button>'
      : '<div class="empty">' + t('none') + '</div>') + '</div>';
    h += '<div class="panel"><h3>' + t('settings') + '</h3>' +
      '<div class="kv"><div class="k">' + t('gateCur') + '</div><div class="v mono">' + esc(S.cfg.gateCode || '—') + '</div></div>' +
      '<div class="kv"><div class="k">' + t('mapKey') + '</div><div class="v mono">' + (S.cfg.mapKey ? esc(S.cfg.mapKey.slice(0, 8)) + '••••••' : '（未配置）') + '</div></div>' +
      '</div>';
    viewOverview.bind = function () {
      if ($('ovGo')) $('ovGo').addEventListener('click', function () { S.tab = 'audit'; render(); });
    };
    return h;
  }

  /* ---------------- 审核 ---------------- */
  function viewAudit() {
    var list = S.places.filter(function (p) { return S.filter === 'pending' ? p.status === 'pending' : true; })
      .sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    var h = '<h2>' + t('audit') + '</h2><div class="dsc">' + t('pending') + ' ' +
      S.places.filter(function (p) { return p.status === 'pending'; }).length + ' · ' + t('total') + ' ' + S.places.length + '</div>';
    h += '<div class="btnrow mb8">' +
      '<button class="mini ' + (S.filter === 'pending' ? 'bl' : 'gh') + '" id="fP">' + t('pending') + '</button>' +
      '<button class="mini ' + (S.filter === 'all' ? 'bl' : 'gh') + '" id="fA">' + t('allP') + '</button>' +
      '<button class="mini gh" id="fR">' + t('refresh') + '</button></div>';
    h += '<div class="panel"><table class="tbl"><thead><tr><th>' + t('name') + '</th><th>' + t('cat') + '</th><th>' +
      t('dist') + '</th><th>' + t('submitter') + '</th><th>' + t('reasonL') + '</th><th>' + t('status') + '</th><th>' + t('actions') + '</th></tr></thead><tbody>';
    h += list.length ? list.map(function (p) {
      var c = catOf(p.cat);
      return '<tr><td><b>' + esc(L(p, 'name')) + '</b><div class="rkmeta">' + (p.lat != null ? p.lat.toFixed(4) + ',' + p.lng.toFixed(4) : '无坐标') + '</div></td>' +
        '<td><span class="pd-cat" style="background:' + c.color + '22;color:' + c.color + '">' + c.icon + ' ' + esc(L(c, 'name')) + '</span></td>' +
        '<td>' + esc(distName(p.dist, p)) + '</td>' +
        '<td>' + esc(p.empName || p.emp || '—') + '<div class="rkmeta">' + fmt(p.createdAt) + '</div></td>' +
        '<td style="max-width:220px"><div style="max-height:56px;overflow:auto">' + esc(p.reason || '') + '</div></td>' +
        '<td>' + statusTag(p.status) + '</td>' +
        '<td class="nowrap"><button class="mini ok" data-ok="' + p.id + '"' + (p.status === 'approved' ? ' disabled' : '') + '>' + t('approve') + '</button> ' +
        '<button class="mini no" data-rj="' + p.id + '"' + (p.status === 'rejected' ? ' disabled' : '') + '>' + t('reject') + '</button> ' +
        '<button class="mini gh" data-ed="' + p.id + '">' + t('edit') + '</button> ' +
        '<button class="mini gh" data-dl="' + p.id + '">' + t('del') + '</button></td></tr>';
    }).join('') : '<tr><td colspan="7"><div class="empty">' + t('none') + '</div></td></tr>';
    h += '</tbody></table></div>';
    viewAudit.bind = function () {
      if ($('fP')) $('fP').addEventListener('click', function () { S.filter = 'pending'; render(); });
      if ($('fA')) $('fA').addEventListener('click', function () { S.filter = 'all'; render(); });
      if ($('fR')) $('fR').addEventListener('click', function () { render(); });
      Array.prototype.forEach.call($('admBody').querySelectorAll('[data-ok]'), function (b) {
        b.addEventListener('click', function () { setStatus(b.getAttribute('data-ok'), 'approved'); });
      });
      Array.prototype.forEach.call($('admBody').querySelectorAll('[data-rj]'), function (b) {
        b.addEventListener('click', function () { setStatus(b.getAttribute('data-rj'), 'rejected'); });
      });
      Array.prototype.forEach.call($('admBody').querySelectorAll('[data-ed]'), function (b) {
        b.addEventListener('click', function () { editPlace(b.getAttribute('data-ed')); });
      });
      Array.prototype.forEach.call($('admBody').querySelectorAll('[data-dl]'), function (b) {
        b.addEventListener('click', function () {
          if (!confirm(t('confirmDel'))) return;
          GG.placeDel(b.getAttribute('data-dl')).then(function () {
            var arr = GG.lget(GG.LS.places, []).filter(function (x) { return x.id !== b.getAttribute('data-dl'); });
            GG.lset(GG.LS.places, arr); render();
          });
        });
      });
    };
    return h;
  }
  function statusTag(s) {
    var m = { pending: 'pending', approved: 'approved', rejected: 'rejected', off: 'off' };
    var n = { pending: t('pending'), approved: t('approved'), rejected: t('rejected'), off: t('offline') };
    return '<span class="status ' + (m[s] || 'off') + '">' + (n[s] || s) + '</span>';
  }
  function setStatus(id, st) {
    var p = S.places.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    p.status = st; p.updatedAt = GG.now(); p.reviewBy = (GG.me() && GG.me().emp) || 'admin'; p.reviewAt = GG.now();
    GG.placesPut(p).then(function () { GG.toast(t('saved')); render(); });
  }

  /* ---------------- 编辑店铺 ---------------- */
  function editPlace(id) {
    var p = S.places.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var h = '<h2>' + t('edit') + '</h2><div class="dsc">' + esc(L(p, 'name')) + '</div><div class="panel">' +
      fld(t('name') + '（中）', '<input id="eName" value="' + esc(p.nameZh || '') + '">') +
      fld(t('name') + '（EN）', '<input id="eNameEn" value="' + esc(p.nameEn || '') + '">') +
      fld(t('cat'), '<select id="eCat">' + (S.cfg.cats || []).map(function (c) {
        return '<option value="' + c.id + '"' + (p.cat === c.id ? ' selected' : '') + '>' + esc(L(c, 'name')) + '</option>'; }).join('') + '</select>') +
      fld(t('dist'), '<select id="eDist"><option value="">—</option>' + (S.cfg.dists || []).map(function (d) {
        return '<option value="' + d.id + '"' + (p.dist === d.id ? ' selected' : '') + '>' + esc(L(d, 'name')) + '</option>'; }).join('') + '</select>') +
      fld(t('addrL'), '<input id="eAddr" value="' + esc(p.address || '') + '">') +
      fld('经纬度 lat,lng', '<input id="eLatLng" value="' + (p.lat != null ? p.lat + ',' + p.lng : '') + '">') +
      fld(t('phoneL'), '<input id="ePhone" value="' + esc(p.phone || '') + '">') +
      fld(t('hoursL'), '<input id="eHours" value="' + esc(p.hours || '') + '">') +
      fld(t('priceL'), '<input id="ePrice" value="' + esc(p.price || '') + '">') +
      fld(t('reasonL'), '<textarea id="eReason">' + esc(p.reason || '') + '</textarea>') +
      fld(t('tipsL'), '<textarea id="eTips">' + esc(p.tips || '') + '</textarea>') +
      fld('标签', '<input id="eTags" value="' + esc((p.tags || []).join(',')) + '">') +
      fld(t('audience'), '<div class="multi" id="eAuds">' + (S.cfg.auds || []).map(function (a) {
        return '<span class="m' + ((p.auds || []).indexOf(a.id) >= 0 ? ' on' : '') + '" data-a="' + a.id + '">' + esc(L(a, 'name')) + '</span>'; }).join('') + '</div>') +
      fld(t('status'), '<select id="eStatus">' + ['pending', 'approved', 'rejected', 'off'].map(function (s) {
        return '<option value="' + s + '"' + (p.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>') +
      '<div class="btnrow"><button class="btn sm blue" id="eSave">' + t('saveAll') + '</button>' +
      '<button class="btn sm line" id="eBack">' + t('cancel') + '</button></div></div>';
    $('admBody').innerHTML = h;
    Array.prototype.forEach.call($('admBody').querySelectorAll('#eAuds .m'), function (m) {
      m.addEventListener('click', function () { m.classList.toggle('on'); });
    });
    $('eSave').addEventListener('click', function () {
      p.nameZh = $('eName').value.trim(); p.nameEn = $('eNameEn').value.trim();
      p.cat = $('eCat').value; p.dist = $('eDist').value; p.address = $('eAddr').value.trim();
      var ll = $('eLatLng').value.split(',');
      p.lat = ll[0] ? parseFloat(ll[0]) : null; p.lng = ll[1] ? parseFloat(ll[1]) : null;
      p.phone = $('ePhone').value.trim(); p.hours = $('eHours').value.trim(); p.price = $('ePrice').value.trim();
      p.reason = $('eReason').value.trim(); p.tips = $('eTips').value.trim();
      p.tags = $('eTags').value.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
      p.auds = Array.prototype.map.call($('admBody').querySelectorAll('#eAuds .m.on'), function (m) { return m.getAttribute('data-a'); });
      p.status = $('eStatus').value; p.updatedAt = GG.now();
      GG.placesPut(p).then(function () { GG.toast(t('saved_ok')); S.tab = 'audit'; render(); });
    });
    $('eBack').addEventListener('click', function () { S.tab = 'audit'; render(); });
  }
  function fld(label, inner) { return '<div class="fld"><label>' + esc(label) + '</label>' + inner + '</div>'; }

  /* ---------------- 全部店铺 ---------------- */
  function viewPlaces() {
    var list = S.places.slice().sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    var h = '<h2>' + t('allP') + '</h2><div class="dsc">' + t('total') + ' ' + list.length + '</div>';
    h += '<div class="panel"><div class="btnrow mb8"><button class="mini gh" id="pExp">' + t('exportCsv') + '</button>' +
      '<button class="mini gh" id="pNew">＋ ' + t('add') + '</button></div>' +
      '<table class="tbl"><thead><tr><th>' + t('name') + '</th><th>' + t('cat') + '</th><th>' + t('dist') + '</th>' +
      '<th>👍</th><th>👎</th><th>' + t('score') + '</th><th>' + t('status') + '</th><th>' + t('actions') + '</th></tr></thead><tbody>';
    h += list.length ? list.map(function (p) { stat(p); var c = catOf(p.cat);
      return '<tr><td><b>' + esc(L(p, 'name')) + '</b></td>' +
        '<td><span class="pd-cat" style="background:' + c.color + '22;color:' + c.color + '">' + c.icon + '</span></td>' +
        '<td>' + esc(distName(p.dist, p)) + '</td><td>' + p._up + '</td><td>' + p._down + '</td>' +
        '<td><b style="color:' + (p._net >= 0 ? 'var(--up)' : 'var(--down)') + '">' + p._net + '</b> <span class="tier ' + p._tier + '">' + p._tier + '</span></td>' +
        '<td>' + statusTag(p.status) + '</td>' +
        '<td class="nowrap"><button class="mini gh" data-ed="' + p.id + '">' + t('edit') + '</button> ' +
        '<button class="mini ' + (p.status === 'approved' ? 'no' : 'ok') + '" data-tg="' + p.id + '">' + (p.status === 'approved' ? t('offline') : t('online')) + '</button></td></tr>';
    }).join('') : '<tr><td colspan="8"><div class="empty">' + t('none') + '</div></td></tr>';
    h += '</tbody></table></div>';
    viewPlaces.bind = function () {
      Array.prototype.forEach.call($('admBody').querySelectorAll('[data-ed]'), function (b) {
        b.addEventListener('click', function () { editPlace(b.getAttribute('data-ed')); });
      });
      Array.prototype.forEach.call($('admBody').querySelectorAll('[data-tg]'), function (b) {
        b.addEventListener('click', function () {
          var p = S.places.filter(function (x) { return x.id === b.getAttribute('data-tg'); })[0];
          if (!p) return;
          setStatus(p.id, p.status === 'approved' ? 'off' : 'approved');
        });
      });
      if ($('pExp')) $('pExp').addEventListener('click', exportCsv);
      if ($('pNew')) $('pNew').addEventListener('click', function () { newByAdmin(); });
    };
    return h;
  }

  function newByAdmin() {
    var p = { id: GG.uid('p'), nameZh: '', nameEn: '', cat: (S.cfg.cats[0] || {}).id, dist: '', address: '', lat: null, lng: null,
      phone: '', hours: '', price: '', auds: [], reason: '', tips: '', tags: [], emp: 'admin', empName: '管理员导入',
      createdAt: GG.now(), status: 'approved', updatedAt: GG.now() };
    S.places.push(p); editPlace(p.id);
  }

  function exportCsv() {
    var rows = [['nameZh', 'nameEn', 'cat', 'dist', 'address', 'lat', 'lng', 'phone', 'hours', 'price', 'auds', 'reason', 'tips', 'tags', 'status']];
    S.places.forEach(function (p) {
      rows.push([p.nameZh, p.nameEn, p.cat, p.dist, p.address, p.lat, p.lng, p.phone, p.hours, p.price,
        (p.auds || []).join('|'), p.reason, p.tips, (p.tags || []).join('|'), p.status]);
    });
    var csv = rows.map(function (r) {
      return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\r\n');
    dl('galaxy-places.csv', '\ufeff' + csv);
  }
  function dl(name, content) {
    var b = new Blob([content], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
  }

  /* ---------------- 分类 / 区域 ---------------- */
  function viewCats() {
    var h = '<h2>' + t('categories') + '</h2><div class="dsc">颜色决定地图上点位的配色；中英文名随语言自动切换</div>' +
      '<div class="panel"><div id="catList">' + (S.cfg.cats || []).map(function (c, i) {
        return '<div class="catline"><input type="color" value="' + c.color + '" data-i="' + i + '" data-f="color">' +
          '<input type="text" value="' + esc(c.zh) + '" data-i="' + i + '" data-f="zh" placeholder="' + t('catNameZh') + '">' +
          '<input type="text" value="' + esc(c.en) + '" data-i="' + i + '" data-f="en" placeholder="' + t('catNameEn') + '">' +
          '<input type="text" value="' + esc(c.icon || '') + '" data-i="' + i + '" data-f="icon" style="width:60px" placeholder="图标">' +
          '<span class="mono" style="color:var(--muted)">' + esc(c.id) + '</span>' +
          '<button class="mini gh" data-del="' + i + '">' + t('del') + '</button></div>';
      }).join('') + '</div>' +
      '<div class="btnrow mt14"><button class="mini bl" id="catAdd">＋ ' + t('catAdd') + '</button>' +
      '<button class="mini ok" id="catSave">' + t('saveAll') + '</button></div></div>';
    viewCats.bind = function () {
      $('catAdd').addEventListener('click', function () {
        S.cfg.cats.push({ id: GG.uid('c'), zh: '新分类', en: 'New', color: '#2D9CDB', icon: '📍' }); render();
      });
      $('catSave').addEventListener('click', function () {
        Array.prototype.forEach.call($('catList').querySelectorAll('[data-f]'), function (el) {
          S.cfg.cats[+el.getAttribute('data-i')][el.getAttribute('data-f')] = el.value;
        });
        GG.cfgSet('cats', S.cfg.cats).then(function () { GG.toast(t('saved_ok')); render(); });
      });
      Array.prototype.forEach.call($('catList').querySelectorAll('[data-del]'), function (b) {
        b.addEventListener('click', function () { S.cfg.cats.splice(+b.getAttribute('data-del'), 1); render(); });
      });
    };
    return h;
  }

  function viewDists() {
    var h = '<h2>' + t('districts') + '</h2><div class="dsc">区域用于筛选与红黑榜单；坐标为点击该区域时地图的落点</div>' +
      '<div class="panel"><div id="distList">' + (S.cfg.dists || []).map(function (d, i) {
        return '<div class="catline"><input type="text" value="' + esc(d.zh) + '" data-i="' + i + '" data-f="zh">' +
          '<input type="text" value="' + esc(d.en) + '" data-i="' + i + '" data-f="en">' +
          '<input type="text" value="' + (d.lat != null ? d.lat + ',' + d.lng : '') + '" data-i="' + i + '" data-f="ll" placeholder="lat,lng">' +
          '<span class="mono" style="color:var(--muted)">' + esc(d.id) + '</span>' +
          '<button class="mini gh" data-del="' + i + '">' + t('del') + '</button></div>';
      }).join('') + '</div>' +
      '<div class="btnrow mt14"><button class="mini bl" id="distAdd">＋ ' + t('distAdd') + '</button>' +
      '<button class="mini ok" id="distSave">' + t('saveAll') + '</button></div></div>';
    viewDists.bind = function () {
      $('distAdd').addEventListener('click', function () {
        S.cfg.dists.push({ id: GG.uid('d'), zh: '新区域', en: 'New', lat: 22.5376, lng: 114.0235 }); render();
      });
      $('distSave').addEventListener('click', function () {
        Array.prototype.forEach.call($('distList').querySelectorAll('[data-f]'), function (el) {
          var i = +el.getAttribute('data-i'), f = el.getAttribute('data-f');
          if (f === 'll') {
            var a = el.value.split(',');
            S.cfg.dists[i].lat = parseFloat(a[0]) || 0; S.cfg.dists[i].lng = parseFloat(a[1]) || 0;
          } else S.cfg.dists[i][f] = el.value;
        });
        GG.cfgSet('dists', S.cfg.dists).then(function () { GG.toast(t('saved_ok')); render(); });
      });
      Array.prototype.forEach.call($('distList').querySelectorAll('[data-del]'), function (b) {
        b.addEventListener('click', function () { S.cfg.dists.splice(+b.getAttribute('data-del'), 1); render(); });
      });
    };
    return h;
  }

  /* ---------------- 热度规则 ---------------- */
  function viewThr() {
    var x = (S.cfg && S.cfg.thr) || GG.defaultConfig().thr;
    var h = '<h2>' + t('thresholds') + '</h2><div class="dsc">决定点位在地图上的等级与大小。热度 = 赞同数 − 踩数</div>' +
      '<div class="panel"><div class="grid2">' +
      fld('🥇 ' + t('gold') + ' 热度 ≥', '<input id="thGold" type="number" value="' + x.gold + '">') +
      fld('🥇 最少赞同数', '<input id="thGoldMin" type="number" value="' + (x.goldMin || 10) + '">') +
      fld('🥇 赞同占比 ≥', '<input id="thRatio" type="number" step="0.05" value="' + (x.goldRatio || 0.8) + '">') +
      fld('👍 ' + t('upT') + ' 热度 ≥', '<input id="thLoved" type="number" value="' + x.loved + '">') +
      fld('👀 ' + t('watchT') + ' 热度 ≤', '<input id="thWatch" type="number" value="' + x.watch + '">') +
      fld('🕶 ' + t('greyT') + ' 热度 ≤', '<input id="thGrey" type="number" value="' + x.grey + '">') +
      fld('🕶 最少踩数', '<input id="thGreyMin" type="number" value="' + (x.greyMin || 5) + '">') +
      fld('⬛ ' + t('blackT') + ' 热度 ≤', '<input id="thBlack" type="number" value="' + x.black + '">') +
      '</div>' +
      '<div class="btnrow mt14"><button class="mini ok" id="thSave">' + t('thrSave') + '</button></div>' +
      '<div class="hint mt14">点位大小按热度自动分 5 档：≥12 最大，6–11，2–5，−3–1，≤−4 最小。管理员驳回或下架后点位不再出现在地图上。</div></div>';
    viewThr.bind = function () {
      $('thSave').addEventListener('click', function () {
        var n = {
          gold: +$('thGold').value, goldMin: +$('thGoldMin').value, goldRatio: +$('thRatio').value,
          loved: +$('thLoved').value, watch: +$('thWatch').value, grey: +$('thGrey').value,
          greyMin: +$('thGreyMin').value, black: +$('thBlack').value
        };
        GG.cfgSet('thr', n).then(function () { GG.toast(t('saved_ok')); render(); });
      });
    };
    return h;
  }

  /* ---------------- 批量导入 ---------------- */
  function viewBulk() {
    var cats = (S.cfg.cats || []).map(function (c) { return c.id + '=' + L(c, 'name'); }).join('，');
    var dists = (S.cfg.dists || []).map(function (d) { return d.id + '=' + L(d, 'name'); }).join('，');
    var tmpl = 'nameZh,nameEn,cat,dist,address,lat,lng,phone,hours,price,auds,reason,tips,tags\n' +
      '陈鹏鹏潮汕牛肉,Chan Pengpeng Beef Hotpot,dine,futian,福田区福华三路88号,22.5376,114.0235,0755-8888,11:00-22:00,120,emp|guest,牛肉现切，晚市要排队,七点后必等位,火锅|潮汕';
    var h = '<h2>' + t('bulk') + '</h2><div class="dsc">支持 CSV 粘贴导入。导入的记录默认「' + t('approved') + '」，可直接上线</div>' +
      '<div class="panel"><div class="hint mb8">可用分类 id：' + esc(cats) + '<br>可用区域 id：' + esc(dists) + '<br>auds 用 | 分隔：' +
      esc((S.cfg.auds || []).map(function (a) { return a.id; }).join('|')) + '</div>' +
      '<div class="btnrow mb8"><button class="mini gh" id="bTmpl">' + t('tmpl') + '</button>' +
      '<button class="mini bl" id="bPrev">解析预览</button>' +
      '<button class="mini ok" id="bGo" disabled>' + t('importBtn') + '</button></div>' +
      '<textarea class="code" id="bText" placeholder="nameZh,nameEn,cat,dist,address,lat,lng,phone,hours,price,auds,reason,tips,tags"></textarea>' +
      '<div class="mt14" id="bOut"></div></div>';
    var parsed = [];
    viewBulk.bind = function () {
      $('bTmpl').addEventListener('click', function () { $('bText').value = tmpl; });
      $('bPrev').addEventListener('click', function () {
        parsed = parseCsv($('bText').value);
        var ok = parsed.filter(function (r) { return r.nameZh && r.lat != null; });
        $('bOut').innerHTML = '<div class="hint">解析到 <b>' + parsed.length + '</b> 行，其中坐标有效 ' + ok.length + ' 行。</div>' +
          '<table class="tbl mt8"><thead><tr><th>' + t('name') + '</th><th>' + t('cat') + '</th><th>' + t('dist') + '</th><th>坐标</th></tr></thead><tbody>' +
          parsed.slice(0, 30).map(function (r) {
            return '<tr><td>' + esc(r.nameZh || '') + '</td><td>' + esc(r.cat || '') + '</td><td>' + esc(r.dist || '') + '</td><td>' +
              (r.lat != null ? r.lat + ',' + r.lng : '<span style="color:var(--danger)">缺坐标</span>') + '</td></tr>';
          }).join('') + '</tbody></table>';
        $('bGo').disabled = !ok.length;
      });
      $('bGo').addEventListener('click', function () {
        var ok = parsed.filter(function (r) { return r.nameZh; });
        var i = 0;
        (function step() {
          if (i >= ok.length) { GG.toast(t('importBtn') + ' ' + ok.length + ' ✓'); return render(); }
          var r = ok[i++];
          var p = {
            id: GG.uid('p'), nameZh: r.nameZh, nameEn: r.nameEn || '', cat: r.cat || (S.cfg.cats[0] || {}).id,
            dist: r.dist || '', address: r.address || '', lat: r.lat, lng: r.lng, phone: r.phone || '',
            hours: r.hours || '', price: r.price || '', auds: (r.auds || '').split('|').filter(Boolean),
            reason: r.reason || '', tips: r.tips || '', tags: (r.tags || '').split('|').filter(Boolean),
            emp: 'admin', empName: '批量导入', createdAt: GG.now(), status: 'approved', updatedAt: GG.now()
          };
          GG.placesPut(p).then(step, step);
        })();
      });
    };
    return h;
  }
  function parseCsv(text) {
    var lines = String(text || '').replace(/\r/g, '').split('\n').filter(function (l) { return l.trim(); });
    if (!lines.length) return [];
    var head = splitCsv(lines[0]).map(function (s) { return s.trim().toLowerCase(); });
    var out = [];
    for (var i = 1; i < lines.length; i++) {
      var cells = splitCsv(lines[i]), o = {};
      head.forEach(function (k, j) { o[k] = (cells[j] || '').trim(); });
      o.lat = o.lat ? parseFloat(o.lat) : null;
      o.lng = o.lng ? parseFloat(o.lng) : null;
      out.push(o);
    }
    return out;
  }
  function splitCsv(line) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (c === ',' && !q) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur); return out;
  }

  /* ---------------- 员工管理 ---------------- */
  function viewUsers() {
    var list = S.users.slice().sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    var h = '<h2>' + t('users') + '</h2><div class="dsc">' + t('total') + ' ' + list.length + '</div>' +
      '<div class="panel"><table class="tbl"><thead><tr><th>' + t('empNo') + '</th><th>' + t('cnName') + '</th><th>' +
      t('dept') + '</th><th>注册时间</th><th>密码</th><th>' + t('status') + '</th><th>' + t('actions') + '</th></tr></thead><tbody>';
    h += list.length ? list.map(function (u) {
      var vc = S.votes.filter(function (v) { return v && GG.normEmp(v.emp) === GG.normEmp(u.emp); }).length;
      return '<tr><td><b>' + esc(u.emp) + '</b></td><td>' + esc(u.name || '') + ' <span class="rkmeta">' + esc(u.nameEn || '') + '</span></td>' +
        '<td>' + esc(GG.deptLabel(u)) + '</td><td>' + fmt(u.createdAt) + '</td>' +
        '<td>' + (u.pinHash ? '已设置' : '<span style="color:var(--warn)">未设置</span>') + '</td>' +
        '<td>' + (u.blocked ? '<span class="status rejected">已停用</span>' : '<span class="status approved">正常</span>') +
        ' <span class="rkmeta">' + vc + ' 次互动</span></td>' +
        '<td class="nowrap"><button class="mini gh" data-rp="' + esc(u.emp) + '">重置密码</button> ' +
        '<button class="mini ' + (u.blocked ? 'ok' : 'no') + '" data-bk="' + esc(u.emp) + '">' + (u.blocked ? '启用' : '停用') + '</button></td></tr>';
    }).join('') : '<tr><td colspan="7"><div class="empty">' + t('none') + '</div></td></tr>';
    h += '</tbody></table></div>';
    viewUsers.bind = function () {
      Array.prototype.forEach.call($('admBody').querySelectorAll('[data-rp]'), function (b) {
        b.addEventListener('click', function () {
          var u = S.users.filter(function (x) { return x.emp === b.getAttribute('data-rp'); })[0];
          if (!u) return;
          u.pinHash = ''; u.pinResetAt = GG.now();
          GG.userPut(u).then(function () { GG.toast('已重置，该员工下次登录将重新设置密码'); render(); });
        });
      });
      Array.prototype.forEach.call($('admBody').querySelectorAll('[data-bk]'), function (b) {
        b.addEventListener('click', function () {
          var u = S.users.filter(function (x) { return x.emp === b.getAttribute('data-bk'); })[0];
          if (!u) return;
          u.blocked = !u.blocked;
          GG.userPut(u).then(function () { GG.toast(t('saved')); render(); });
        });
      });
    };
    return h;
  }

  /* ---------------- 系统设置 ---------------- */
  function viewConfig() {
    var h = '<h2>' + t('settings') + '</h2><div class="dsc">' + (GG.isCloud() ? '☁ ' + t('cloudMode') : '⚠ ' + t('localMode')) + '</div>' +
      '<div class="panel"><h3>' + t('gateCode') + '</h3>' +
      fld(t('gateCur'), '<input value="' + esc(S.cfg.gateCode || '') + '" disabled>') +
      fld(t('gateNew'), '<input id="cGate" placeholder="例如 RC2026SZ">') +
      fld('有效期（天）', '<input id="cGateDays" type="number" value="' + ((S.cfg && S.cfg.gateDays) || 30) + '">') +
      '<button class="mini bl" id="cGateSave">' + t('gateSet') + '</button></div>' +
      '<div class="panel"><h3>' + t('mapKey') + '</h3>' +
      fld(t('mapKey'), '<input id="cKey" value="' + esc(S.cfg.mapKey || '') + '" placeholder="' + esc(t('mapKeyPh')) + '">') +
      '<button class="mini bl" id="cKeySave">' + t('saved_ok') + '</button>' +
      '<div class="hint">在 lbs.qq.com → 控制台 → 创建应用 → 添加 Key，勾选「JavaScript GL」与「WebServiceAPI」，域名白名单可留空或填部署域名。</div></div>' +
      '<div class="panel"><h3>' + t('admPwdChg') + '</h3>' +
      fld(t('admPwdNew'), '<input id="cAdm" type="password" placeholder="' + esc(t('admPwdNew')) + '">') +
      '<button class="mini bl" id="cAdmSave">' + t('saved_ok') + '</button>' +
      '<div class="hint">初始管理员口令：' + esc(DEFAULT_ADMIN) + '，请尽快修改。</div></div>' +
      '<div class="panel"><h3>地图默认落点</h3>' +
      fld('中心经纬度', '<input id="cCenter" value="' + ((S.cfg.center || {}).lat || 22.5376) + ',' + ((S.cfg.center || {}).lng || 114.0235) + '">') +
      fld('默认缩放', '<input id="cZoom" type="number" value="' + ((S.cfg && S.cfg.zoom) || 12) + '">') +
      '<button class="mini bl" id="cCenterSave">' + t('saved_ok') + '</button></div>' +
      '<div class="panel"><h3>隐私</h3>' +
      '<label class="chkline"><input type="checkbox" id="cAnon"' + (S.cfg.anonNote ? ' checked' : '') + '> ' + t('allowAnon') + '</label>' +
      '<label class="chkline"><input type="checkbox" id="cShow"' + (S.cfg.showName !== false ? ' checked' : '') + '> ' + t('showName') + '</label>' +
      '<button class="mini bl mt8" id="cPrivSave">' + t('saved_ok') + '</button></div>' +
      '<div class="panel"><div class="btnrow"><button class="mini gh" id="cOut">' + t('logout') + '</button>' +
      '<button class="mini gh" id="cHome">← 前台地图</button></div></div>';
    viewConfig.bind = function () {
      $('cGateSave').addEventListener('click', function () {
        var v = String($('cGate').value || '').trim().toUpperCase();
        if (!v) return;
        var days = +$('cGateDays').value || 30;
        GG.gateHash(v).then(function (h) {
          S.cfg.gateCode = v; S.cfg.gateHash = h; S.cfg.gateDays = days;
          return GG.cfgSet('gateCode', v).then(function () { return GG.cfgSet('gateHash', h); })
            .then(function () { return GG.cfgSet('gateDays', days); });
        }).then(function () { GG.toast(t('saved_ok')); render(); });
      });
      $('cKeySave').addEventListener('click', function () {
        GG.cfgSet('mapKey', $('cKey').value.trim()).then(function () { GG.toast(t('saved_ok')); render(); });
      });
      $('cAdmSave').addEventListener('click', function () {
        var v = String($('cAdm').value || '');
        if (!v) return;
        GG.adminHash(v).then(function (h) {
          return GG.cfgSet('adminHash', h).then(function () { GG.toast(t('saved_ok')); $('cAdm').value = ''; render(); });
        });
      });
      $('cCenterSave').addEventListener('click', function () {
        var a = $('cCenter').value.split(',');
        GG.cfgSet('center', { lat: parseFloat(a[0]) || 22.5376, lng: parseFloat(a[1]) || 114.0235 })
          .then(function () { return GG.cfgSet('zoom', +$('cZoom').value || 12); })
          .then(function () { GG.toast(t('saved_ok')); render(); });
      });
      $('cPrivSave').addEventListener('click', function () {
        GG.cfgSet('anonNote', $('cAnon').checked).then(function () { return GG.cfgSet('showName', $('cShow').checked); })
          .then(function () { GG.toast(t('saved_ok')); render(); });
      });
      $('cOut').addEventListener('click', function () { GG.clearAdmin(); location.reload(); });
      $('cHome').addEventListener('click', function () { location.href = 'index.html'; });
    };
    return h;
  }

  return { boot: boot };
})();
