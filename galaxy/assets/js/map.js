/* 星河玩味 · 地图层（腾讯位置服务 JavaScript GL，数据与腾讯地图实时同步） */
var GMap = (function () {
  'use strict';

  var loaded = false, loadErr = null, curKey = '';
  var map = null, markers = null, styles = {};
  var onClickCb = null, onMarkerCb = null;

  function load(key) {
    if (!key) return Promise.reject(new Error('nokey'));
    if (loaded && key === curKey) return Promise.resolve(window.TMap);
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'https://map.qq.com/api/gljs?v=1.exp&key=' + encodeURIComponent(key);
      s.async = true;
      s.onload = function () {
        if (!window.TMap) { loadErr = 'no TMap'; return rej(new Error(loadErr)); }
        loaded = true; curKey = key; res(window.TMap);
      };
      s.onerror = function () { loadErr = 'load failed'; rej(new Error(loadErr)); };
      document.head.appendChild(s);
    });
  }
  function ready() { return !!(loaded && window.TMap); }

  /* ---------- 生成 marker 图标 ---------- */
  function pinSvg(color, tier, size) {
    var D = [26, 32, 38, 46, 56][size] || 32;
    var r = D / 2;
    var fill = color;
    var ring = 'rgba(255,255,255,.95)';
    var ringW = 4;
    var badge = '';
    if (tier === 'gold') { ring = '#C9A227'; ringW = 5; badge = '<circle cx="' + r + '" cy="' + r + '" r="' + (r * 0.44) + '" fill="none" stroke="#F6EBC8" stroke-width="2"/>'; }
    else if (tier === 'grey' || tier === 'black') { fill = desat(color, tier === 'black' ? 0.9 : 0.62); ring = tier === 'black' ? '#2B3138' : '#C9CDD4'; }
    var op = (tier === 'grey' || tier === 'black') ? 0.55 : 1;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + D + '" height="' + (D + 8) + '" viewBox="0 0 ' + D + ' ' + (D + 8) + '">' +
      '<defs><filter id="s" x="-50%" y="-50%" width="200%" height="200%">' +
      '<feDropShadow dx="0" dy="1.5" stdDeviation="1.6" flood-color="rgba(11,31,61,.35)"/></filter></defs>' +
      '<path filter="url(#s)" d="M' + r + ' ' + (D + 7) + ' L' + (r - 6) + ' ' + (D - 2) + ' A' + (r - ringW / 2) + ' ' + (r - ringW / 2) + ' 0 1 1 ' + (r + 6) + ' ' + (D - 2) + ' Z" fill="' + fill + '" opacity="' + op + '"/>' +
      '<circle cx="' + r + '" cy="' + r + '" r="' + (r - ringW) + '" fill="' + fill + '" opacity="' + op + '" stroke="' + ring + '" stroke-width="' + ringW + '"/>' +
      badge +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function desat(hex, amt) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return '#9AA5B1';
    var n = parseInt(m[1], 16), R = (n >> 16) & 255, G = (n >> 8) & 255, B = n & 255;
    var g = Math.round(0.299 * R + 0.587 * G + 0.114 * B);
    R = Math.round(R + (g - R) * amt); G = Math.round(G + (g - G) * amt); B = Math.round(B + (g - B) * amt);
    return '#' + [R, G, B].map(function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  }

  /* ---------- 初始化 ---------- */
  function init(div, center, zoom) {
    if (!ready()) return null;
    map = new window.TMap.Map(div, {
      center: new window.TMap.LatLng(center.lat, center.lng),
      zoom: zoom || 12,
      pitch: 0,
      rotation: 0,
      showControl: true,
      baseMap: { type: 'vector' }
    });
    markers = new window.TMap.MultiMarker({ id: 'gg-marks', map: map, styles: {}, geometries: [] });
    markers.on('click', function (e) { if (onMarkerCb && e.geometry) onMarkerCb(e.geometry.id); });
    map.on('click', function (e) { if (onClickCb && e.latLng) onClickCb(e.latLng.getLat(), e.latLng.getLng()); });
    return map;
  }
  function destroy() {
    try { if (map) map.destroy(); } catch (e) {}
    map = null; markers = null; styles = {};
  }
  function getMap() { return map; }

  function onMapClick(fn) { onClickCb = fn; }
  function onMarkerClick(fn) { onMarkerCb = fn; }

  /* ---------- 渲染点位 ---------- */
  function render(list) {
    if (!ready() || !markers) return;
    var st = {}, geos = [];
    list.forEach(function (p) {
      if (!p || p.lat == null || p.lng == null) return;
      var key = p.cat + '|' + p._tier + '|' + p._size;
      if (!st[key]) {
        var c = (p._catColor || '#2D9CDB');
        var D = [26, 32, 38, 46, 56][p._size] || 32;
        st[key] = new window.TMap.MarkerStyle({
          width: D, height: D + 8, src: pinSvg(c, p._tier, p._size),
          anchor: { x: D / 2, y: D + 6 }
        });
      }
      geos.push({ id: p.id, styleId: key, position: new window.TMap.LatLng(p.lat, p.lng) });
    });
    markers.setStyles(st);
    markers.setGeometries(geos);
  }

  function fit(list) {
    if (!ready() || !map || !list.length) return;
    var b = new window.TMap.LatLngBounds();
    var n = 0;
    list.forEach(function (p) {
      if (p && p.lat != null && p.lng != null) { b.extend(new window.TMap.LatLng(p.lat, p.lng)); n++; }
    });
    if (n === 1) {
      var o = list.filter(function (p) { return p && p.lat != null; })[0];
      map.setCenter(new window.TMap.LatLng(o.lat, o.lng)); map.setZoom(16);
    } else if (n > 1) { map.fitBounds(b, { padding: 70 }); }
  }
  function goto(lat, lng, zoom) {
    if (!ready() || !map) return;
    map.setCenter(new window.TMap.LatLng(lat, lng));
    if (zoom) map.setZoom(zoom);
  }

  /* ---------- 关键字检索（WebService，JSONP 免跨域） ---------- */
  var jsonpSeq = 0;
  function search(keyword, key, city) {
    return new Promise(function (res, rej) {
      var cb = '__ggjsonp' + (++jsonpSeq);
      var s = document.createElement('script');
      var url = 'https://apis.map.qq.com/ws/place/v1/search?keyword=' + encodeURIComponent(keyword) +
        '&boundary=region(' + encodeURIComponent(city || '深圳') + ',0)&page_size=10&output=jsonp&callback=' + cb + '&key=' + encodeURIComponent(key);
      window[cb] = function (d) {
        cleanup();
        if (d && d.status === 0) res(d.data || []); else rej(new Error((d && d.message) || 'search failed'));
      };
      function cleanup() { try { delete window[cb]; } catch (e) {} try { s.remove(); } catch (e) {} }
      s.onerror = function () { cleanup(); rej(new Error('network')); };
      s.src = url;
      document.head.appendChild(s);
      setTimeout(function () { cleanup(); rej(new Error('timeout')); }, 9000);
    });
  }

  /* ---------- 迷你取点地图（提交时用） ---------- */
  var mini = null, miniMark = null, miniCb = null;
  function initPicker(div, lat, lng, cb) {
    if (!ready()) return null;
    miniCb = cb;
    mini = new window.TMap.Map(div, {
      center: new window.TMap.LatLng(lat, lng), zoom: 16, showControl: false, baseMap: { type: 'vector' }
    });
    miniMark = new window.TMap.MultiMarker({
      map: mini,
      styles: { p: new window.TMap.MarkerStyle({ width: 30, height: 38, src: pinSvg('#12305C', 'norm', 1), anchor: { x: 15, y: 36 } }) },
      geometries: [{ id: 'pick', styleId: 'p', position: new window.TMap.LatLng(lat, lng) }]
    });
    mini.on('click', function (e) {
      if (!e.latLng || !miniCb) return;
      var la = e.latLng.getLat(), lo = e.latLng.getLng();
      miniMark.setGeometries([{ id: 'pick', styleId: 'p', position: new window.TMap.LatLng(la, lo) }]);
      miniCb(la, lo);
    });
    return mini;
  }
  function pickerGo(lat, lng) {
    if (!mini) return;
    mini.setCenter(new window.TMap.LatLng(lat, lng));
    if (miniMark) miniMark.setGeometries([{ id: 'pick', styleId: 'p', position: new window.TMap.LatLng(lat, lng) }]);
  }
  // 取当前中心点（"用地图中心点"按钮用，比点击取点更稳、更适合手机）
  function pickerCenter() {
    if (!mini) return null;
    try {
      var c = mini.getCenter();
      return { lat: c.getLat(), lng: c.getLng() };
    } catch (e) { return null; }
  }
  // 地图平移 / 缩放时回调（用于实时显示中心点坐标）
  function pickerOnPan(fn) {
    if (!mini || !fn) return;
    try { mini.on('pan', fn); mini.on('zoom_changed', fn); mini.on('center_changed', fn); } catch (e) {}
  }
  function destroyPicker() { try { if (mini) mini.destroy(); } catch (e) {} mini = null; miniMark = null; miniCb = null; }

  return {
    load: load, ready: ready, init: init, destroy: destroy, getMap: getMap,
    onMapClick: onMapClick, onMarkerClick: onMarkerClick,
    render: render, fit: fit, goto: goto, search: search, desat: desat, pinSvg: pinSvg,
    initPicker: initPicker, pickerGo: pickerGo, pickerCenter: pickerCenter, pickerOnPan: pickerOnPan, destroyPicker: destroyPicker
  };
})();
