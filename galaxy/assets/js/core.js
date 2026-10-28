/* 星河玩味 · 核心层：配置 / 双语 / 存储 / 工具函数 */
var GG = (function () {
  'use strict';

  var SB_BASE = 'https://hkigwzzmvytpeudgkjik.supabase.co';
  var SB_KEY = 'sb_publishable_L0iHADNzbzl6GNia4npK0Q_djN_Rkes';

  var LS = {
    lang: 'gg.lang',
    me: 'gg.me',
    gate: 'gg.gate.pass',
    admin: 'gg.admin',
    places: 'gg.local.places',
    votes: 'gg.local.votes',
    users: 'gg.local.users',
    cfg: 'gg.local.cfg'
  };

  /* ============ 工具 ============ */
  function $(id) { return document.getElementById(id); }
  // 用数字字符引用，避免源码里写 &xxx; 被折叠
  var ESC_MAP = { '&': 38, '<': 60, '>': 62, '"': 34, "'": 39 };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return '&#' + ESC_MAP[c] + ';';
    });
  }
  function uid(p) { return (p || 'p') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function now() { return Date.now(); }
  function clone(o) { return JSON.parse(JSON.stringify(o == null ? {} : o)); }
  // 对齐答题平台 normEmpNo：纯数字工号去前导零（4 位工号与"补 0 变 5 位"视为同一人）
  function normEmp(s) {
    var v = String(s == null ? '' : s).replace(/\s+/g, '').replace(/^e/i, '').toUpperCase();
    if (/^\d+$/.test(v)) {
      var t = v.replace(/^0+/, '');
      return t === '' ? v : t;
    }
    return v;
  }
  function isPinValid(p) { return /^[0-9]{6}$/.test(String(p || '')); }

  /* 部门结构：与答题平台（刷题平台）完全一致，保证两边的部门口径统一 */
  var DEPTS = [{"en":"Culinary","cn":"厨房部","subs":[{"en":"Culinary Administration","cn":"厨房办公室"},{"en":"All Day Dining Kitchen","cn":"全日制厨房"},{"en":"Banquet Kitchen","cn":"宴会厨房"},{"en":"Chinese Kitchen","cn":"中厨房"},{"en":"Italian Kitchen","cn":"意大利厨房"},{"en":"Pastry","cn":"饼房"},{"en":"Stewarding","cn":"管事部"}]},{"en":"Engineering","cn":"工程部","subs":[{"en":"Engineering Administration","cn":"工程部办公室"},{"en":"Operations","cn":"运营"}]},{"en":"Executive Office","cn":"行政办公室","subs":[{"en":"Executive Office","cn":"行政办公室"}]},{"en":"F&B","cn":"餐饮部","subs":[{"en":"F&B Administration","cn":"餐饮部办公室"},{"en":"Banquet","cn":"宴会部"},{"en":"Curv","cn":"雪茄吧"},{"en":"Fix","cn":"美食屋"},{"en":"Flavorz","cn":"全日制餐厅"},{"en":"In Room Dining","cn":"送餐部"},{"en":"Onyx","cn":"大堂吧"},{"en":"Paletto","cn":"意大利餐厅"},{"en":"XingLi Restaurant","cn":"星丽中餐厅"}]},{"en":"Finance","cn":"财务部","subs":[{"en":"Finance Administration","cn":"财务部办公室"},{"en":"Accounting","cn":"会计部"},{"en":"Purchasing","cn":"采购部"},{"en":"IT","cn":"IT"}]},{"en":"Human Resources","cn":"人力资源部","subs":[{"en":"HR Administration","cn":"人力资源部办公室"},{"en":"Dormitory","cn":"员工宿舍"},{"en":"Employee Dining","cn":"员工餐厅"},{"en":"Learning","cn":"培训部"},{"en":"Personnel","cn":"人事部"}]},{"en":"Rooms","cn":"房务部","subs":[{"en":"Rooms Administration","cn":"房务部办公室"},{"en":"FD & DM","cn":"前台 & 值班经理"},{"en":"GR& GS","cn":"礼宾部 & 宾客关系部"},{"en":"Housekeeping","cn":"客房部"},{"en":"Laundry","cn":"洗衣房"},{"en":"Loss Prevention","cn":"防损部"},{"en":"PBX","cn":"总机"},{"en":"Ritz Club","cn":"行政酒廊"},{"en":"Spa & Fitness","cn":"水疗与健身中心"}]},{"en":"S & M","cn":"市场销售部","subs":[{"en":"S&M Administration","cn":"市场销售部办公室"},{"en":"Catering","cn":"宴会销售部"},{"en":"Public Relations","cn":"公关部"},{"en":"Reservation","cn":"预订部"},{"en":"Sales","cn":"销售部"}]}];
  // 按当前语言取员工部门显示文案（大部门 · 子部门）
  function deptLabel(u) {
    if (!u) return '';
    var en = getLang() === 'en';
    var div = en ? (u.divEn || u.div) : (u.div || u.divEn);
    var dep = en ? (u.deptEn || u.dept) : (u.dept || u.deptEn);
    return [div, dep].filter(Boolean).join(' · ');
  }

  function sha256hex(str) {
    var c = window.crypto || window.msCrypto;
    if (c && c.subtle && c.subtle.digest) {
      return c.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (buf) {
        var a = new Uint8Array(buf), s = '';
        for (var i = 0; i < a.length; i++) s += ('0' + a[i].toString(16)).slice(-2);
        return s;
      });
    }
    // 兜底（非加密环境）：简易混淆，仅供本地演示模式使用
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < str.length; i++) {
      h1 = (h1 ^ str.charCodeAt(i)) * 16777619 >>> 0;
      h2 = (h2 + str.charCodeAt(i) * (i + 7)) >>> 0;
    }
    return Promise.resolve(('f' + h1.toString(16) + h2.toString(16)).slice(0, 64));
  }
  function pinHash(emp, pin) { return sha256hex('rcz9|' + normEmp(emp) + '|' + pin); }
  function gateHash(code) { return sha256hex('gg|gate|' + String(code || '').trim().toUpperCase()); }
  function adminHash(pwd) { return sha256hex('gg|admin|' + String(pwd || '')); }
  function safeEq(a, b) {
    a = String(a || ''); b = String(b || '');
    if (a.length !== b.length) return false;
    var r = 0; for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  }

  /* ============ 双语 ============ */
  var I18N = {
    zh: {
      app: '星河玩味', tagline: '深圳星河丽思卡尔顿 · 内部吃喝玩乐地图',
      appEn: 'Galaxy Guide', taglineEn: 'Galaxy Ritz-Carlton Shenzhen · Insider Map',
      gateTitle: '员工通道', gateSub: '请输入培训部发布的内部通行验证码',
      gateCode: '通行验证码', gateBtn: '进入星河玩味', gateWrong: '验证码不正确，请向培训部确认',
      gateOk: '验证通过',
      loginTitle: '员工登录', loginSub: '使用工号登录，首次使用请设置 6 位密码',
      empNo: '工号', password: '密码（6 位数字）', newPassword: '设置密码（6 位数字）',
      cnName: '中文姓名', enName: 'English Name', dept: '部门',
      div: '大部门', divPh: '请选择大部门', deptPh: '请选择子部门',
      anon: '匿名', postAnon: '匿名写这条备注', allowAnon: '允许员工匿名写备注',
      loginBtn: '登录', regBtn: '注册并进入', claimBtn: '确认并设置密码',
      claimTip: '系统已存在工号记录，请设置密码完成认领',
      empReq: '请输入工号', nameReq: '请输入中文姓名', pinReq: '密码必须是 6 位数字',
      pinWrong: '密码不正确', welcomeBack: '欢迎回来',
      switchUser: '切换账号', logout: '退出登录',
      lang: 'English',
      mapLoading: '地图加载中…', mapNoKey: '尚未配置腾讯地图 Key',
      mapNoKeyTip: '请管理员在后台「系统设置」中填入腾讯地图 Key（免费申请）。未配置期间，列表、红黑榜、上传等功能仍可正常使用。',
      mapKeyFail: '腾讯地图 Key 加载失败，请检查 Key 是否有效、是否开启了 JavaScript GL 与 WebServiceAPI。',
      searchPh: '搜索店名 / 地址…', allDistrict: '深圳全市', allCat: '全部分类',
      rank: '排行榜', hot: '红榜', cold: '黑榜', add: '推荐新店',
      detail: '店铺详情', reasonL: '推荐理由', tipsL: '避坑提示', addrL: '地址',
      hoursL: '营业时间', priceL: '人均', phoneL: '电话', audienceL: '适合人群',
      by: '由', submit: '提交推荐', submitOk: '已提交，等待管理员审核',
      agree: '赞同', disagree: '踩一脚', notePh: '写条备注…（例如：周三有驻唱）',
      noteSend: '发送', myNote: '我的备注', notes: '大家怎么说', noNote: '还没有人写备注',
      score: '热度', pending: '待审核', approved: '已发布', rejected: '已驳回',
      submitter: '推荐人', submitAt: '提交时间',
      pickTip: '点「在地图上取点」后，在地图上点击选择店铺位置',
      pickBtn: '在地图上取点', picked: '已选坐标',
      catReq: '请选择分类', nameReq2: '请填写店铺名称', reasonReq: '请填写推荐理由', locReq: '请在地图上选择位置',
      total: '共', filterEmpty: '该地区还没有符合条件的推荐',
      legendTitle: '图例', legendSize: '赞同越多 · 越大；踩越多 · 越小',
      gold: '金标', upT: '好评', normT: '常规', watchT: '观望', greyT: '灰标', blackT: '黑标',
      confirmDel: '确定删除？', saved: '已保存', cancel: '取消', close: '关闭',
      edit: '编辑', del: '删除', approve: '通过', reject: '驳回', offline: '下架', online: '上架',
      localMode: '本地演示模式', localModeTip: '当前未连接云端数据库（Supabase 表尚未建立）。数据仅保存在本机浏览器，供功能演示；完成一次建表后自动切换为全员共享的云端模式。',
      cloudMode: '云端已连接', loading: '加载中…', retry: '重试',
      mySub: '我的提交', allP: '全部店铺', pendingTab: '待审核', publishTab: '已发布',
      settings: '系统设置', categories: '分类管理', districts: '区域管理', bulk: '批量导入',
      users: '员工管理', colleagues: '员工', thresholds: '热度规则', overview: '总览',
      adminTitle: '管理后台', adminPwd: '管理员口令', adminBtn: '进入后台',
      adminWrong: '管理员口令不正确',
      gateCur: '当前通行验证码', gateNew: '新验证码', gateSet: '更新验证码',
      mapKey: '腾讯地图 Key', mapKeyPh: '在 lbs.qq.com 免费申请',
      admPwdChg: '修改管理员口令', admPwdNew: '新管理员口令',
      catNameZh: '中文名', catNameEn: '英文名', catColor: '颜色', catAdd: '新增分类',
      distAdd: '新增区域', saveAll: '保存全部', importBtn: '导入', tmpl: '下载 CSV 模板',
      thrNet: '好评阈值', thrGrey: '灰标阈值', thrBlack: '黑标阈值', thrSave: '保存规则',
      none: '暂无', actions: '操作', status: '状态', name: '名称', cat: '分类', dist: '区域',
      exportCsv: '导出 CSV', refresh: '刷新', apply: '应用', audit: '审核',
      anonNote: '匿名备注', showName: '显示工号与姓名',
      audience: '适合人群', audEmp: '员工本人', audFam: '员工携亲友', audGuest: '丽思卡尔顿住店客人',
      audBiz: '商务宴请', audTeam: '团队建设', audSolo: '独自一人',
      tutorial: '使用说明', backMap: '返回地图', saved_ok: '已保存并同步'
    },
    en: {
      app: 'Galaxy Guide', tagline: 'Galaxy Ritz-Carlton Shenzhen · Insider Map',
      appEn: 'Galaxy Guide', taglineEn: 'Galaxy Ritz-Carlton Shenzhen · Insider Map',
      gateTitle: 'Colleague Access', gateSub: 'Enter the internal pass code issued by Learning & Development',
      gateCode: 'Pass code', gateBtn: 'Enter Galaxy Guide', gateWrong: 'Incorrect code — please check with L&D',
      gateOk: 'Verified',
      loginTitle: 'Colleague Sign-in', loginSub: 'Sign in with your employee number, or set a 6-digit password on first use',
      empNo: 'Employee No.', password: 'Password (6 digits)', newPassword: 'Set password (6 digits)',
      cnName: 'Chinese name', enName: 'English Name', dept: 'Department',
      div: 'Division', divPh: 'Select a division', deptPh: 'Select a department',
      anon: 'Anonymous', postAnon: 'Post this note anonymously', allowAnon: 'Allow anonymous notes',
      loginBtn: 'Sign in', regBtn: 'Register & enter', claimBtn: 'Confirm & set password',
      claimTip: 'This employee number already exists — set a password to claim it',
      empReq: 'Employee number required', nameReq: 'Chinese name required', pinReq: 'Password must be 6 digits',
      pinWrong: 'Incorrect password', welcomeBack: 'Welcome back',
      switchUser: 'Switch account', logout: 'Sign out',
      lang: '中文',
      mapLoading: 'Loading map…', mapNoKey: 'Tencent Maps key not configured',
      mapNoKeyTip: 'An administrator can add a free Tencent Maps key in Settings. Until then, lists, rankings and submissions all still work.',
      mapKeyFail: 'Failed to load the Tencent Maps key. Please check the key and enable JavaScript GL + WebServiceAPI.',
      searchPh: 'Search name / address…', allDistrict: 'All Shenzhen', allCat: 'All categories',
      rank: 'Rankings', hot: 'Red List', cold: 'Black List', add: 'Add a place',
      detail: 'Place details', reasonL: 'Why we love it', tipsL: 'Watch out', addrL: 'Address',
      hoursL: 'Opening hours', priceL: 'Avg. spend', phoneL: 'Phone', audienceL: 'Best for',
      by: 'by', submit: 'Submit', submitOk: 'Submitted — awaiting admin review',
      agree: 'Agree', disagree: 'Disagree', notePh: 'Add a note… (e.g. live band on Wednesdays)',
      noteSend: 'Send', myNote: 'My note', notes: 'What colleagues say', noNote: 'No notes yet',
      score: 'Heat', pending: 'Pending', approved: 'Published', rejected: 'Rejected',
      submitter: 'Submitted by', submitAt: 'Submitted at',
      pickTip: 'Tap "Pick on map", then tap the map to place the venue',
      pickBtn: 'Pick on map', picked: 'Coordinates set',
      catReq: 'Please choose a category', nameReq2: 'Name required', reasonReq: 'Please tell us why', locReq: 'Please pick a location on the map',
      total: 'Total', filterEmpty: 'No recommendations match this area yet',
      legendTitle: 'Legend', legendSize: 'More agrees · bigger; more disagrees · smaller',
      gold: 'Gold', upT: 'Loved', normT: 'Standard', watchT: 'Watch', greyT: 'Grey', blackT: 'Black',
      confirmDel: 'Delete this?', saved: 'Saved', cancel: 'Cancel', close: 'Close',
      edit: 'Edit', del: 'Delete', approve: 'Approve', reject: 'Reject', offline: 'Hide', online: 'Show',
      localMode: 'Local demo mode', localModeTip: 'Cloud database is not connected yet (Supabase tables not created). Data is stored only in this browser for demo purposes; it switches to shared cloud mode automatically once the tables exist.',
      cloudMode: 'Cloud connected', loading: 'Loading…', retry: 'Retry',
      mySub: 'My submissions', allP: 'All places', pendingTab: 'Pending', publishTab: 'Published',
      settings: 'Settings', categories: 'Categories', districts: 'Districts', bulk: 'Bulk import',
      users: 'Colleagues', colleagues: 'Colleagues', thresholds: 'Heat rules', overview: 'Overview',
      adminTitle: 'Admin console', adminPwd: 'Admin password', adminBtn: 'Enter console',
      adminWrong: 'Incorrect admin password',
      gateCur: 'Current pass code', gateNew: 'New pass code', gateSet: 'Update code',
      mapKey: 'Tencent Maps key', mapKeyPh: 'Free from lbs.qq.com',
      admPwdChg: 'Change admin password', admPwdNew: 'New admin password',
      catNameZh: 'Chinese name', catNameEn: 'English name', catColor: 'Colour', catAdd: 'Add category',
      distAdd: 'Add district', saveAll: 'Save all', importBtn: 'Import', tmpl: 'Download CSV template',
      thrNet: 'Loved threshold', thrGrey: 'Grey threshold', thrBlack: 'Black threshold', thrSave: 'Save rules',
      none: 'None', actions: 'Actions', status: 'Status', name: 'Name', cat: 'Category', dist: 'District',
      exportCsv: 'Export CSV', refresh: 'Refresh', apply: 'Apply', audit: 'Review',
      anonNote: 'Anonymous notes', showName: 'Show employee no. and name',
      audience: 'Best for', audEmp: 'Colleagues', audFam: 'Colleagues + family', audGuest: 'In-house guests',
      audBiz: 'Business dining', audTeam: 'Team building', audSolo: 'Solo',
      tutorial: 'How to use', backMap: 'Back to map', saved_ok: 'Saved & synced'
    }
  };

  var lang = (function () {
    try { return localStorage.getItem(LS.lang) || 'zh'; } catch (e) { return 'zh'; }
  })();
  function t(k) {
    var d = I18N[lang] || I18N.zh;
    return d[k] != null ? d[k] : (I18N.zh[k] != null ? I18N.zh[k] : k);
  }
  function setLang(l) { lang = (l === 'en' ? 'en' : 'zh'); try { localStorage.setItem(LS.lang, lang); } catch (e) {} }
  function getLang() { return lang; }
  // 取双语字段：支持 {nameZh,nameEn} 与 {zh,en} 两种形状
  function biling(o, k) {
    if (!o) return '';
    var zh = (o[k + 'Zh'] != null) ? o[k + 'Zh'] : o.zh;
    var en = (o[k + 'En'] != null) ? o[k + 'En'] : (o.en != null ? o.en : zh);
    if (zh == null) zh = en;
    if (en == null) en = zh;
    return lang === 'en' ? (en || zh || '') : (zh || en || '');
  }

  /* ============ 默认配置 ============ */
  function defaultConfig() {
    return {
      gateHash: '',            // 进入验证码哈希（首次由管理员设置）
      gateCode: 'RC2026',      // 明文备份（仅本地模式/首次引导用）
      gateDays: 30,
      adminHash: '',
      mapKey: 'GGZBZ-FAULA-NWGKD-C47YL-BOIS2-E6FZJ',   // 腾讯位置服务 Key（员工提供，可在后台更换）
      center: { lat: 22.5376, lng: 114.0235 },   // 深圳星河丽思卡尔顿（福田）
      zoom: 12,
      thr: { gold: 8, loved: 3, watch: -2, grey: -3, black: -8, goldRatio: 0.8, goldMin: 10, greyMin: 5 },
      anonNote: true,          // 允许员工写匿名备注（写的时候自己勾选）
      showName: true,
      cats: [
        { id: 'snack', zh: '小吃 · 街边', en: 'Street bites', color: '#F2994A', icon: '🍜' },
        { id: 'dine', zh: '正餐 · 餐厅', en: 'Dining', color: '#2D9CDB', icon: '🍽' },
        { id: 'cafe', zh: '咖啡 · 甜品', en: 'Café & dessert', color: '#9B51E0', icon: '☕' },
        { id: 'bar', zh: '酒吧 · 夜生活', en: 'Bars & nightlife', color: '#EB5757', icon: '🍸' },
        { id: 'music', zh: '音乐馆 · 演出', en: 'Live music', color: '#F2C94C', icon: '🎵' },
        { id: 'museum', zh: '博物馆 · 展览', en: 'Museums', color: '#219653', icon: '🏛' },
        { id: 'cinema', zh: '影院 · 剧场', en: 'Cinema & theatre', color: '#56CCF2', icon: '🎬' },
        { id: 'sport', zh: '运动 · 户外', en: 'Sports & outdoors', color: '#6FCF97', icon: '🏃' },
        { id: 'shop', zh: '购物 · 商场', en: 'Shopping', color: '#BB6BD9', icon: '🛍' },
        { id: 'stay', zh: '酒店 · 周边游', en: 'Staycation', color: '#828282', icon: '🏨' }
      ],
      dists: [
        { id: 'futian', zh: '福田区', en: 'Futian', lat: 22.5429, lng: 114.0596 },
        { id: 'nanshan', zh: '南山区', en: 'Nanshan', lat: 22.5333, lng: 113.9300 },
        { id: 'luohu', zh: '罗湖区', en: 'Luohu', lat: 22.5480, lng: 114.1300 },
        { id: 'baoan', zh: '宝安区', en: "Bao'an", lat: 22.6500, lng: 113.8200 },
        { id: 'longgang', zh: '龙岗区', en: 'Longgang', lat: 22.7200, lng: 114.2500 },
        { id: 'longhua', zh: '龙华区', en: 'Longhua', lat: 22.6500, lng: 114.0300 },
        { id: 'yantian', zh: '盐田区', en: 'Yantian', lat: 22.5600, lng: 114.2400 },
        { id: 'pingshan', zh: '坪山区', en: 'Pingshan', lat: 22.6900, lng: 114.3500 },
        { id: 'guangming', zh: '光明区', en: 'Guangming', lat: 22.7480, lng: 113.9300 },
        { id: 'dapeng', zh: '大鹏新区', en: 'Dapeng', lat: 22.6000, lng: 114.4800 }
      ],
      auds: [
        { id: 'emp', zh: '员工本人', en: 'Colleagues' },
        { id: 'fam', zh: '员工携亲友', en: 'Colleagues + family' },
        { id: 'guest', zh: '丽思卡尔顿住店客人', en: 'In-house guests' },
        { id: 'biz', zh: '商务宴请', en: 'Business dining' },
        { id: 'team', zh: '团队建设', en: 'Team building' },
        { id: 'solo', zh: '独自一人', en: 'Solo' }
      ]
    };
  }

  /* ============ 本地存储 ============ */
  function lget(k, d) {
    try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
  }
  function lset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* ============ Supabase 适配 ============ */
  var mode = null; // null=未知 true=云端 false=本地
  var failCount = 0;

  function sbFetch(path, init, ms) {
    init = init || {};
    init.headers = init.headers || {};
    init.headers['apikey'] = SB_KEY;
    init.headers['Authorization'] = 'Bearer ' + SB_KEY;
    init.headers['Content-Type'] = 'application/json';
    init.cache = 'no-store';
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var tm = setTimeout(function () { if (ctl) ctl.abort(); }, ms || 9000);
    if (ctl) init.signal = ctl.signal;
    return fetch(SB_BASE + '/rest/v1/' + path, init).then(function (r) {
      clearTimeout(tm);
      return r.text().then(function (txt) {
        var j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = null; }
        if (!r.ok) {
          var e = new Error('sb ' + r.status + ' ' + txt);
          e.status = r.status; e.body = j; throw e;
        }
        return j;
      });
    }, function (e) { clearTimeout(tm); throw e; });
  }

  function probe() {
    if (mode !== null) return Promise.resolve(mode);
    return sbFetch('gg_places?select=id&limit=1', {}, 7000).then(function () {
      mode = true; return true;
    }, function (e) {
      // 404 = 表不存在 → 本地演示模式；其它错误也降级
      mode = false; return false;
    });
  }
  function isCloud() { return mode === true; }
  function setMode(m) { mode = m; }

  /* -------- places -------- */
  function placesList() {
    if (mode === true) {
      return sbFetch('gg_places?select=id,data,ver&order=updated_at.desc&limit=2000', {}, 12000)
        .then(function (rows) { return (rows || []).map(function (r) { return r.data; }); })
        .catch(function () { return lget(LS.places, []); });
    }
    return Promise.resolve(lget(LS.places, []));
  }
  function placesPut(p) {
    lsetCachePlace(p);
    if (mode !== true) return Promise.resolve(true);
    return sbFetch('gg_places', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: p.id, data: p, ver: p.updatedAt || now(), updated_at: new Date().toISOString() })
    }, 12000).then(function () { return true; }, function () { return false; });
  }
  function placeDel(id) {
    if (mode !== true) return Promise.resolve(true);
    return sbFetch('gg_places?id=eq.' + encodeURIComponent(id), { method: 'DELETE' }, 9000)
      .then(function () { return true; }, function () { return false; });
  }
  function lsetCachePlace(p) {
    var arr = lget(LS.places, []);
    var i = -1; for (var k = 0; k < arr.length; k++) { if (arr[k] && arr[k].id === p.id) { i = k; break; } }
    if (i >= 0) arr[i] = p; else arr.push(p);
    lset(LS.places, arr);
  }

  /* -------- votes -------- */
  function votesList() {
    if (mode === true) {
      return sbFetch('gg_votes?select=place_id,emp,v,note,anon,updated_at&limit=5000', {}, 12000)
        .then(function (rows) {
          return (rows || []).map(function (r) {
            return { placeId: r.place_id, emp: r.emp, v: r.v, note: r.note, anon: !!r.anon, ts: Date.parse(r.updated_at) || 0 };
          });
        }).catch(function () { return lget(LS.votes, []); });
    }
    return Promise.resolve(lget(LS.votes, []));
  }
  function votePut(v) {
    var arr = lget(LS.votes, []);
    arr = arr.filter(function (x) { return !(x.placeId === v.placeId && x.emp === v.emp); });
    arr.push(v); lset(LS.votes, arr);
    if (mode !== true) return Promise.resolve(true);
    return sbFetch('gg_votes', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        place_id: v.placeId, emp: v.emp, v: v.v, note: v.note || null, anon: !!v.anon, updated_at: new Date(v.ts || now()).toISOString()
      })
    }, 12000).then(function () { return true; }, function () { return false; });
  }

  /* -------- users -------- */
  function usersList() {
    if (mode === true) {
      return sbFetch('gg_users?select=emp,rec&limit=2000', {}, 12000)
        .then(function (rows) { return (rows || []).map(function (r) { return r.rec; }); })
        .catch(function () { return lget(LS.users, []); });
    }
    return Promise.resolve(lget(LS.users, []));
  }
  function userPut(u) {
    var arr = lget(LS.users, []);
    arr = arr.filter(function (x) { return x.emp !== u.emp; });
    arr.push(u); lset(LS.users, arr);
    if (mode !== true) return Promise.resolve(true);
    return sbFetch('gg_users', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ emp: u.emp, rec: u, updated_at: new Date().toISOString() })
    }, 12000).then(function () { return true; }, function () { return false; });
  }
  function userGet(emp) {
    return usersList().then(function (arr) {
      for (var i = 0; i < arr.length; i++) if (arr[i] && normEmp(arr[i].emp) === normEmp(emp)) return arr[i];
      return null;
    });
  }

  /* -------- config -------- */
  function cfgGet() {
    if (mode === true) {
      return sbFetch('gg_config?select=k,v&limit=50', {}, 10000).then(function (rows) {
        var c = defaultConfig();
        (rows || []).forEach(function (r) { if (r && r.k && r.v) c[r.k] = r.v; });
        lset(LS.cfg, c);
        return c;
      }).catch(function () { return lget(LS.cfg, defaultConfig()); });
    }
    return Promise.resolve(lget(LS.cfg, defaultConfig()));
  }
  function cfgSet(k, v) {
    var c = lget(LS.cfg, defaultConfig()); c[k] = v; lset(LS.cfg, c);
    if (mode !== true) return Promise.resolve(true);
    return sbFetch('gg_config', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ k: k, v: v, updated_at: new Date().toISOString() })
    }, 10000).then(function () { return true; }, function () { return false; });
  }

  /* ============ 热度计算 ============ */
  function tally(votes, placeId) {
    var up = 0, down = 0, notes = [];
    for (var i = 0; i < votes.length; i++) {
      var v = votes[i]; if (!v || v.placeId !== placeId) continue;
      if (v.v > 0) up++; else if (v.v < 0) down++;
      if (v.note) notes.push({ emp: v.emp, text: v.note, anon: !!v.anon, ts: v.ts || 0 });
    }
    notes.sort(function (a, b) { return b.ts - a.ts; });
    return { up: up, down: down, net: up - down, notes: notes };
  }
  function tierOf(net, up, down, thr) {
    thr = thr || defaultConfig().thr;
    var tot = up + down;
    var ratio = tot > 0 ? up / tot : 0;
    if (net >= (thr.gold || 8) && up >= (thr.goldMin || 10) && ratio >= (thr.goldRatio || 0.8)) return 'gold';
    if (net >= (thr.loved || 3)) return 'up';
    if (net <= (thr.black != null ? thr.black : -8)) return 'black';
    if (net <= (thr.grey != null ? thr.grey : -3) && down >= (thr.greyMin || 5)) return 'grey';
    if (net <= (thr.watch != null ? thr.watch : -2)) return 'watch';
    return 'norm';
  }
  function sizeOf(net) {
    // 返回 0..4 的尺寸档位（赞同越多越大）
    if (net >= 12) return 4;
    if (net >= 6) return 3;
    if (net >= 2) return 2;
    if (net >= -3) return 1;
    return 0;
  }

  /* ============ 会话 ============ */
  function me() { return lget(LS.me, null); }
  function setMe(u) { lset(LS.me, u); }
  function clearMe() { try { localStorage.removeItem(LS.me); } catch (e) {} }
  function gatePassed() {
    try {
      var s = JSON.parse(localStorage.getItem(LS.gate) || 'null');
      if (!s || !s.until) return false;
      return Date.now() < s.until;
    } catch (e) { return false; }
  }
  function setGatePass(days) {
    lset(LS.gate, { until: Date.now() + (days || 30) * 86400000, at: Date.now() });
  }
  function adminSession() { return lget(LS.admin, null); }
  function setAdmin(a) { lset(LS.admin, a); }
  function clearAdmin() { try { localStorage.removeItem(LS.admin); } catch (e) {} }

  /* ============ Toast ============ */
  var toastTm = null;
  function toast(msg) {
    var el = $('ggToast');
    if (!el) return;
    el.textContent = msg; el.classList.add('on');
    clearTimeout(toastTm);
    toastTm = setTimeout(function () { el.classList.remove('on'); }, 2400);
  }

  return {
    SB_BASE: SB_BASE, SB_KEY: SB_KEY, LS: LS,
    $: $, esc: esc, uid: uid, now: now, clone: clone,
    normEmp: normEmp, isPinValid: isPinValid, sha256hex: sha256hex,
    pinHash: pinHash, gateHash: gateHash, adminHash: adminHash, safeEq: safeEq,
    t: t, setLang: setLang, getLang: getLang, biling: biling, I18N: I18N,
    DEPTS: DEPTS, deptLabel: deptLabel,
    defaultConfig: defaultConfig,
    lget: lget, lset: lset,
    probe: probe, isCloud: isCloud, setMode: setMode,
    placesList: placesList, placesPut: placesPut, placeDel: placeDel,
    votesList: votesList, votePut: votePut,
    usersList: usersList, userPut: userPut, userGet: userGet,
    cfgGet: cfgGet, cfgSet: cfgSet,
    tally: tally, tierOf: tierOf, sizeOf: sizeOf,
    me: me, setMe: setMe, clearMe: clearMe,
    gatePassed: gatePassed, setGatePass: setGatePass,
    adminSession: adminSession, setAdmin: setAdmin, clearAdmin: clearAdmin,
    toast: toast
  };
})();
