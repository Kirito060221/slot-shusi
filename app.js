"use strict";
// ===== 定数 =====
var RATE_PRESETS = [
  { label:"等価", per100:5 }, { label:"5.6枚", per100:5.6 }, { label:"5.8枚", per100:5.8 },
  { label:"6枚", per100:6 }, { label:"6.5枚", per100:6.5 }, { label:"7枚", per100:7 }
];
var SAVE_UNIT = 20;
var WD = ["日","月","火","水","木","金","土"];

// ===== ヘルパー =====
function unitPrice(p){ return 100 / p; }
function pad(n){ return String(n).padStart(2,"0"); }
function yen(n){ return Math.round(n).toLocaleString("ja-JP"); }
function signedYen(n){ return (n>0?"+":n<0?"−":"") + yen(Math.abs(n)); }
function todayStr(){ var d=new Date(); return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
function compact(n){
  if(!n) return "";
  var a=Math.abs(n), sign=n>0?"+":"−";
  if(a>=10000){ var v=a/10000; return sign + (v>=10?Math.round(v):(v.toFixed(1).replace(/\.0$/,""))) + "万"; }
  return sign + a;
}
function endTotal(s){
  if(s.cashOutMedals===undefined && s.saveMedals===undefined && s.endMedals!==undefined) return Number(s.endMedals||0);
  return Number(s.cashOutMedals||0) + Number(s.saveMedals||0);
}
function sessionProfit(s){
  var u=unitPrice(Number(s.per100)||5), start=Number(s.startMedals||0), cash=Number(s.cashIn||0);
  if(s.cashOutMedals===undefined && s.saveMedals===undefined && s.endMedals!==undefined){
    return (Number(s.endMedals||0)-start)*u - cash;
  }
  return Number(s.cashOutMedals||0)*u + Number(s.saveMedals||0)*SAVE_UNIT - start*SAVE_UNIT - cash;
}
function buildCalendar(y,m){
  var startDow=new Date(y,m,1).getDay(), days=new Date(y,m+1,0).getDate(), c=[];
  for(var i=0;i<startDow;i++) c.push(null);
  for(var d=1;d<=days;d++) c.push(d);
  while(c.length%7!==0) c.push(null);
  return c;
}
function cls(n){ return n>0?"is-plus":n<0?"is-minus":"is-flat"; }

// ===== ストレージ =====
var STORE_OK = (function(){ try{ localStorage.setItem("__t","1"); localStorage.removeItem("__t"); return true; }catch(e){ return false; } })();
function loadSessions(){ try{ var r=localStorage.getItem("sessions"); return r?JSON.parse(r):[]; }catch(e){ return []; } }
function saveSessions(){ if(!STORE_OK) return; try{ localStorage.setItem("sessions", JSON.stringify(state.sessions)); }catch(e){} }
function loadRate(){ try{ var r=localStorage.getItem("lastRate"); return r?Number(r):5; }catch(e){ return 5; } }
function saveRate(p){ if(!STORE_OK) return; try{ localStorage.setItem("lastRate", String(p)); }catch(e){} }

// ===== 状態 =====
var now = new Date();
var state = {
  sessions: loadSessions(),
  tab: "calendar",
  viewYear: now.getFullYear(),
  viewMonth: now.getMonth(),
  defaultRate: loadRate(),
  selectedDate: null,
  form: null
};
function blankForm(date, per100){
  return { id:null, date:date, shop:"", memo:"", expectedValue:"", startMedals:"", cashIn:"", cashOutMedals:"", saveMedals:"", per100:per100, customRate:"" };
}

// ===== 集計 =====
function byDate(){
  var m={}; state.sessions.forEach(function(s){ (m[s.date]=m[s.date]||[]).push(s); }); return m;
}
function computeStats(){
  var profit=0, cash=0, ev=0, dayMap={};
  state.sessions.forEach(function(s){ var p=sessionProfit(s); profit+=p; cash+=Number(s.cashIn||0); ev+=Number(s.expectedValue||0); dayMap[s.date]=(dayMap[s.date]||0)+p; });
  var days=Object.keys(dayMap).map(function(k){ return dayMap[k]; });
  var wins=days.filter(function(v){ return v>0; }).length;
  return { profit:profit, cash:cash, ev:ev, played:days.length, wins:wins, winRate:days.length?Math.round(wins/days.length*100):0 };
}

// ===== フォーム計算 =====
function activePer100(){ return state.form.per100==="custom" ? (Number(state.form.customRate)||0) : Number(state.form.per100); }
function formProfit(){
  var p=activePer100(); if(p<=0) return 0;
  var u=unitPrice(p), f=state.form;
  return Number(f.cashOutMedals||0)*u + Number(f.saveMedals||0)*SAVE_UNIT - Number(f.startMedals||0)*SAVE_UNIT - Number(f.cashIn||0);
}

// ===== レンダリング =====
var app = document.getElementById("app");
var modalRoot = document.getElementById("modal-root");

function render(){
  var st = computeStats();
  var h = "";
  if(!STORE_OK){
    h += '<div class="warn">この開き方ではデータが端末に保存されません。記録を残すには、後述の「データを書き出す」でバックアップするか、URL形式で開いてください。</div>';
  }
  // ヒーロー
  h += '<div class="hero"><div>'
    + '<div class="lab">累計収支</div>'
    + '<div class="amt num '+cls(st.profit)+'">'+(st.profit>=0?"+":"−")+yen(Math.abs(st.profit))+'<span class="y">円</span></div>'
    + '</div><div class="side">'
    + '<div class="k">来店 '+st.played+'回 · 勝率 '+st.winRate+'%</div>'
    + '<div class="v num">投資 '+yen(st.cash)+'円</div>'
    + '<div class="v num '+cls(st.ev)+'" style="margin-top:3px">期待値 '+signedYen(st.ev)+'円</div>'
    + '</div></div>';
  // タブ
  h += '<div class="tabs">'
    + '<button class="tab '+(state.tab==="calendar"?"on":"")+'" data-act="tab" data-tab="calendar">カレンダー</button>'
    + '<button class="tab '+(state.tab==="trend"?"on":"")+'" data-act="tab" data-tab="trend">推移</button>'
    + '</div>';
  h += state.tab==="calendar" ? renderCalendar() : renderTrend(st);
  app.innerHTML = h;
  if(state.tab==="trend") drawCharts();
}

function renderCalendar(){
  var bd=byDate(), cells=buildCalendar(state.viewYear, state.viewMonth);
  var prefix=state.viewYear+"-"+pad(state.viewMonth+1);
  var monthProfit=0, monthEv=0;
  state.sessions.forEach(function(s){ if(s.date && s.date.indexOf(prefix)===0){ monthProfit+=sessionProfit(s); monthEv+=Number(s.expectedValue||0); } });
  var today=todayStr();

  var h='<div class="mnav"><div class="nav">'
    + '<button class="navbtn" data-act="prev">‹</button>'
    + '<div class="ym num" data-act="yearpick"><span class="yy">'+state.viewYear+'</span>'+(state.viewMonth+1)+'月</div>'
    + '<button class="navbtn" data-act="next">›</button>'
    + '</div><div class="msum"><div class="k">月の収支</div>'
    + '<div class="v num '+cls(monthProfit)+'">'+signedYen(monthProfit)+'<span style="font-size:10px;opacity:.6">円</span></div>'
    + '<div class="v num '+cls(monthEv)+'" style="font-size:11.5px;margin-top:2px">期待値 '+signedYen(monthEv)+'<span style="font-size:9px;opacity:.6">円</span></div>'
    + '</div></div>';

  h+='<div class="wd">';
  for(var i=0;i<7;i++) h+='<span class="'+(i===0?"sun":i===6?"sat":"")+'">'+WD[i]+'</span>';
  h+='</div><div class="cal">';

  cells.forEach(function(d,idx){
    if(d===null){ h+='<div class="cell empty"></div>'; return; }
    var key=state.viewYear+"-"+pad(state.viewMonth+1)+"-"+pad(d);
    var list=bd[key]||[], p=0;
    list.forEach(function(s){ p+=sessionProfit(s); });
    var has=list.length>0, tone=has?(p>0?"pos":p<0?"neg":""):"", dow=idx%7;
    h+='<button class="cell '+tone+(key===today?" today":"")+'" data-act="day" data-date="'+key+'">'
      + '<span class="cd dow'+dow+'">'+d+'</span>'
      + (has?'<span class="camt '+(p>0?"pos":p<0?"neg":"")+'">'+compact(p)+'</span>':'')
      + (list.length>1?'<span class="dots">'+list.length+'</span>':'')
      + '</button>';
  });
  h+='</div>';
  h+='<button class="bigbtn" data-act="today">＋ 今日を記録</button>';
  h+='<div class="foot">'
    + '<button data-act="export">データを書き出す</button>'
    + '<button data-act="import">読み込む</button>'
    + '</div>';
  h+='<div class="tip">ブラウザのメニューから「ホーム画面に追加」すると、アプリのように全画面で使えます。</div>';
  return h;
}

function renderTrend(st){
  var h='<div class="stats">'
    + '<div class="stat"><div class="k">来店</div><div class="v num">'+st.played+'<span class="u">回</span></div></div>'
    + '<div class="stat"><div class="k">勝ち</div><div class="v num">'+st.wins+'<span class="u">回</span></div></div>'
    + '<div class="stat"><div class="k">勝率</div><div class="v num">'+st.winRate+'<span class="u">%</span></div></div>'
    + '<div class="stat"><div class="k">投資</div><div class="v num" style="font-size:13px">'+yen(st.cash)+'</div></div>'
    + '</div>';
  h+='<div class="card"><h3>累計収支の推移</h3><div id="trendChart"></div>'
    + '<div style="display:flex;gap:14px;margin-top:10px;font-size:11px;color:var(--ink-dim)">'
    + '<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--ink);margin-right:5px"></span>収支</span>'
    + '<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--gold-bri);margin-right:5px"></span>期待値</span>'
    + '</div></div>';
  h+='<div class="card"><h3>月別の収支</h3><div id="monthlyChart"></div></div>';
  return h;
}

// ===== チャート描画 =====
function drawCharts(){
  // 累計推移
  var sorted = state.sessions.slice().sort(function(a,b){ return a.date<b.date?-1:a.date>b.date?1:a.id-b.id; });
  var cum=0, pts=sorted.map(function(s){ cum+=sessionProfit(s); return cum; });
  var cumE=0, evPts=sorted.map(function(s){ cumE+=Number(s.expectedValue||0); return cumE; });
  var tc=document.getElementById("trendChart");
  if(pts.length<1){ tc.innerHTML='<div class="blank">記録するとここに推移が表示されます</div>'; }
  else{
    var W=480,H=150,padX=8,padY=14;
    var data=pts.length===1?[0,pts[0]]:pts;
    var dataE=evPts.length===1?[0,evPts[0]]:evPts;
    var min=Math.min.apply(null,[0].concat(data,dataE)), max=Math.max.apply(null,[0].concat(data,dataE)), span=(max-min)||1;
    var X=function(i){ return padX+(i/((data.length-1)||1))*(W-padX*2); };
    var Y=function(v){ return padY+(1-(v-min)/span)*(H-padY*2); };
    var zeroY=Y(0), line="", lineE="";
    data.forEach(function(v,i){ line+=(i===0?"M":"L")+X(i).toFixed(1)+","+Y(v).toFixed(1)+" "; });
    dataE.forEach(function(v,i){ lineE+=(i===0?"M":"L")+X(i).toFixed(1)+","+Y(v).toFixed(1)+" "; });
    var area=line+"L"+X(data.length-1).toFixed(1)+","+zeroY.toFixed(1)+" L"+X(0).toFixed(1)+","+zeroY.toFixed(1)+" Z";
    var pos=data[data.length-1]>=0, col=pos?"var(--plus)":"var(--minus)";
    var hasEv = evPts.some(function(v){ return v!==0; });
    tc.innerHTML='<svg class="chart" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="height:150px">'
      + '<defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0%" stop-color="'+col+'" stop-opacity="0.28"/><stop offset="100%" stop-color="'+col+'" stop-opacity="0"/></linearGradient></defs>'
      + '<line x1="'+padX+'" y1="'+zeroY+'" x2="'+(W-padX)+'" y2="'+zeroY+'" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>'
      + '<path d="'+area+'" fill="url(#tg)"/>'
      + '<path d="'+line+'" fill="none" stroke="'+col+'" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>'
      + (hasEv?'<path d="'+lineE+'" fill="none" stroke="var(--gold-bri)" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>':'')
      + '</svg>';
  }
  // 月別
  var mm={}; state.sessions.forEach(function(s){ var k=s.date?s.date.slice(0,7):null; if(k) mm[k]=(mm[k]||0)+sessionProfit(s); });
  var months=Object.keys(mm).sort().slice(-6).map(function(k){ return [k,mm[k]]; });
  var mc=document.getElementById("monthlyChart");
  if(months.length<1){ mc.innerHTML='<div class="blank">記録するとここに月別収支が表示されます</div>'; return; }
  var mx=Math.max.apply(null,[1].concat(months.map(function(p){ return Math.abs(p[1]); })));
  var mh='<div style="display:flex;align-items:stretch;gap:8px;height:160px">';
  months.forEach(function(p){
    var v=p[1], ratio=Math.abs(v)/mx, isPos=v>=0;
    var bar = isPos
      ? '<div style="height:'+(ratio*50)+'%;margin-bottom:50%;background:linear-gradient(180deg,var(--plus),rgba(115,199,155,0.5));border-radius:4px 4px 0 0"></div>'
      : '<div style="height:'+(ratio*50)+'%;margin-top:50%;background:linear-gradient(180deg,rgba(227,115,126,0.5),var(--minus));border-radius:0 0 4px 4px"></div>';
    mh+='<div style="flex:1;display:flex;flex-direction:column">'
      + '<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;position:relative">'
      + '<div style="position:absolute;bottom:50%;left:0;right:0;border-top:1px dashed var(--line)"></div>'+bar+'</div>'
      + '<div class="num" style="text-align:center;margin-top:6px">'
      + '<div style="font-size:10.5px;font-weight:700;color:'+(isPos?"var(--plus)":"var(--minus)")+'">'+compact(v)+'</div>'
      + '<div style="font-size:9.5px;color:var(--ink-dim);margin-top:2px">'+Number(p[0].slice(5,7))+'月</div>'
      + '</div></div>';
  });
  mh+='</div>';
  mc.innerHTML=mh;
}

// ===== モーダル =====
function openDay(dateKey){
  state.selectedDate=dateKey;
  state.form=blankForm(dateKey, state.defaultRate);
  renderModal();
}
function closeModal(){ state.selectedDate=null; modalRoot.innerHTML=""; }

function openYearPicker(){ state.ypYear=state.viewYear; renderYearPicker(); }
function renderYearPicker(){
  var y=state.ypYear, monthProfit=[];
  for(var m=0;m<12;m++){
    var prefix=y+"-"+pad(m+1), p=0;
    state.sessions.forEach(function(s){ if(s.date && s.date.indexOf(prefix)===0) p+=sessionProfit(s); });
    monthProfit.push(p);
  }
  var h='<div class="modal-bg" data-act="yp-bg"><div class="modal" data-stop="1">';
  h+='<div class="mhead"><div class="dt num">月を選ぶ</div><button class="x" data-act="yp-close">×</button></div>';
  h+='<div class="ypnav"><button class="navbtn" data-act="yp-prev">‹</button><div class="yy num">'+y+'</div><button class="navbtn" data-act="yp-next">›</button></div>';
  h+='<div class="ypgrid">';
  for(var i=0;i<12;i++){
    var p2=monthProfit[i], cur=(y===state.viewYear&&i===state.viewMonth);
    h+='<button class="ypcell'+(cur?" cur":"")+'" data-act="yp-month" data-m="'+i+'">'
      + '<div class="m">'+(i+1)+'月</div>'
      + '<div class="p '+cls(p2)+'">'+(p2?signedYen(p2):"—")+'</div>'
      + '</button>';
  }
  h+='</div></div></div>';
  modalRoot.innerHTML=h;
}
function closeYearPicker(){ modalRoot.innerHTML=""; }

function renderModal(){
  var date=state.selectedDate;
  var bd=byDate(), list=bd[date]||[], dayP=0;
  list.forEach(function(s){ dayP+=sessionProfit(s); });
  var wd=WD[new Date(Number(date.slice(0,4)),Number(date.slice(5,7))-1,Number(date.slice(8,10))).getDay()];

  var h='<div class="modal-bg" data-act="bg"><div class="modal" data-stop="1">';
  h+='<div class="mhead"><div class="dt num">'+Number(date.slice(5,7))+'月'+Number(date.slice(8,10))+'日'
    + '<span class="w">('+wd+')</span>'
    + (list.length>0?'<span class="dp '+cls(dayP)+'">'+signedYen(dayP)+'円</span>':'')
    + '</div><button class="x" data-act="close">×</button></div>';
  h+='<div id="daylist"></div>';
  h+='<div id="formArea"></div>';
  h+='</div></div>';
  modalRoot.innerHTML=h;
  renderDayList();
  renderForm();
}

function renderDayList(){
  var el=document.getElementById("daylist"); if(!el) return;
  var bd=byDate(), list=bd[state.selectedDate]||[];
  if(list.length===0){ el.innerHTML=""; return; }
  var h='<div class="daylist">';
  list.forEach(function(s){
    var p=sessionProfit(s), diff=endTotal(s)-Number(s.startMedals||0);
    var rl=(RATE_PRESETS.filter(function(r){ return r.per100===s.per100; })[0]||{label:s.per100+"枚"}).label;
    h+='<div class="di '+(state.form.id===s.id?"editing":"")+'">'
      + '<div class="mid" data-act="edit" data-id="'+s.id+'">'
      + '<div class="shop">'+(s.shop?esc(s.shop):'<span class="nn">店名なし</span>')+' <span class="rl">'+esc(rl)+'</span></div>'
      + '<div class="sub">差引 <b class="'+cls(diff)+'">'+(diff>=0?"+":"−")+yen(Math.abs(diff))+'枚</b>'
      + (Number(s.saveMedals)>0?' · 貯玉 <b>'+yen(s.saveMedals)+'枚</b>':'')
      + (Number(s.cashIn)>0?' · 現金 <b>'+yen(s.cashIn)+'円</b>':'')
      + (Number(s.expectedValue)?' · 期待値 <b class="'+cls(Number(s.expectedValue))+'">'+signedYen(Number(s.expectedValue))+'円</b>':'')
      + '</div>'
      + (s.memo?'<div class="memo-line">'+esc(s.memo)+'</div>':'')
      + '</div>'
      + '<div class="amt num '+cls(p)+'">'+signedYen(p)+'</div>'
      + '<button class="del" data-act="del" data-id="'+s.id+'">×</button>'
      + '</div>';
  });
  h+='</div>';
  el.innerHTML=h;
}

function renderForm(){
  var el=document.getElementById("formArea"); if(!el) return;
  var f=state.form, bd=byDate(), hasList=(bd[state.selectedDate]||[]).length>0;
  var headTxt=f.id?"記録を編集":(hasList?"この日にもう一件追加":"記録を追加");

  var chips="";
  RATE_PRESETS.forEach(function(r){
    chips+='<button type="button" class="chip '+(f.per100===r.per100?"on":"")+'" data-act="rate" data-rate="'+r.per100+'">'+r.label+'</button>';
  });
  chips+='<div class="chip custom '+(f.per100==="custom"?"on":"")+'" data-act="rate-custom">'
    + '<input type="number" inputmode="decimal" placeholder="?.?" value="'+esc(f.customRate)+'" data-field="customRate"><span>枚</span></div>';

  var h='<div class="fhead">'+headTxt+'</div>'
    + '<div class="row"><div class="field"><label>店名・機種（任意）</label>'
    + '<input class="inp text" type="text" placeholder="例：◯◯ホール" value="'+esc(f.shop)+'" data-field="shop"></div></div>'
    + '<div class="row"><div class="field"><label>メモ（任意）</label>'
    + '<textarea class="inp text memo" placeholder="立ち回りや設定推測、台番号など" data-field="memo">'+esc(f.memo)+'</textarea></div></div>'
    + '<div class="row"><div class="field"><label>期待値（任意）</label><div class="suffix"><input class="inp" type="number" inputmode="numeric" placeholder="0" value="'+esc(f.expectedValue)+'" data-field="expectedValue"><span class="s">円</span></div></div></div>'
    + '<div class="row">'
    + '<div class="field"><label>開始持ち玉（下ろした貯玉）</label><div class="suffix"><input class="inp" type="number" inputmode="numeric" placeholder="0" value="'+esc(f.startMedals)+'" data-field="startMedals"><span class="s">枚</span></div></div>'
    + '<div class="field"><label>追加の現金投資</label><div class="suffix"><input class="inp" type="number" inputmode="numeric" placeholder="0" value="'+esc(f.cashIn)+'" data-field="cashIn"><span class="s">円</span></div></div>'
    + '</div>'
    + '<div class="row">'
    + '<div class="field"><label>換金した枚数 <em>交換率</em></label><div class="suffix"><input class="inp" type="number" inputmode="numeric" placeholder="0" value="'+esc(f.cashOutMedals)+'" data-field="cashOutMedals"><span class="s">枚</span></div></div>'
    + '<div class="field"><label>貯玉に戻した枚数 <em>等価</em></label><div class="suffix"><input class="inp" type="number" inputmode="numeric" placeholder="0" value="'+esc(f.saveMedals)+'" data-field="saveMedals"><span class="s">枚</span></div></div>'
    + '</div>'
    + '<div class="field" style="margin-bottom:2px"><label>交換率</label><div class="rates">'+chips+'</div></div>'
    + '<div class="preview"><div><div class="pk">この記録の収支</div><div class="calc" id="calcTxt"></div></div>'
    + '<div class="pv num" id="pvVal"></div></div>'
    + '<button class="save" data-act="save">'+(f.id?"更新する":"記録する")+'</button>'
    + (f.id?'<button class="cancel" data-act="cancel">編集をやめる</button>':'');
  el.innerHTML=h;
  updatePreview();
}

function updatePreview(){
  var calc=document.getElementById("calcTxt"), pv=document.getElementById("pvVal");
  if(!calc||!pv) return;
  var p=activePer100(), f=state.form;
  if(p>0){
    var u=unitPrice(p);
    calc.textContent="換金"+Number(f.cashOutMedals||0)+"枚×"+u.toFixed(1)+" ＋ 貯玉"+Number(f.saveMedals||0)+"枚×20 − 元手"+Number(f.startMedals||0)+"枚×20 − 現金"+yen(Number(f.cashIn||0));
    var prof=formProfit();
    pv.className="pv num "+cls(prof);
    pv.innerHTML=signedYen(prof)+'<span class="y">円</span>';
  } else {
    calc.textContent="交換率を入力してください";
    pv.className="pv num is-flat"; pv.innerHTML='—<span class="y">円</span>';
  }
}
function updateChips(){
  var chips=document.querySelectorAll("#formArea .chip");
  chips.forEach(function(c){
    var on=false;
    if(c.classList.contains("custom")) on=state.form.per100==="custom";
    else on=String(state.form.per100)===c.getAttribute("data-rate");
    c.classList.toggle("on", on);
  });
}

// ===== アクション =====
function setRate(per100){
  state.form.per100=per100;
  if(per100!=="custom"){ state.defaultRate=per100; saveRate(per100); }
  updateChips(); updatePreview();
}
function doSave(){
  var p=activePer100(); var f=state.form;
  if(p<=0){ toast("交換率を入力してください"); return; }
  if(f.cashOutMedals===""&&f.saveMedals===""&&f.startMedals===""&&f.cashIn===""){ toast("枚数か金額を入力してください"); return; }
  var rec={ id:f.id||Date.now(), date:f.date, shop:(f.shop||"").trim(), memo:(f.memo||"").trim(),
    expectedValue:Number(f.expectedValue||0),
    startMedals:Number(f.startMedals||0), cashIn:Number(f.cashIn||0),
    cashOutMedals:Number(f.cashOutMedals||0), saveMedals:Number(f.saveMedals||0), per100:p };
  if(f.id){ state.sessions=state.sessions.map(function(s){ return s.id===f.id?rec:s; }); }
  else{ state.sessions.push(rec); }
  saveSessions();
  toast(f.id?"更新しました":"記録しました");
  state.form=blankForm(state.selectedDate, state.defaultRate);
  renderDayList(); renderForm(); render();
}
function editSession(id){
  var s=state.sessions.filter(function(x){ return x.id===id; })[0]; if(!s) return;
  var isPreset=RATE_PRESETS.some(function(r){ return r.per100===s.per100; });
  var legacy=s.cashOutMedals===undefined&&s.saveMedals===undefined&&s.endMedals!==undefined;
  state.form={ id:s.id, date:s.date, shop:s.shop||"", memo:s.memo||"",
    expectedValue:String(s.expectedValue||""),
    startMedals:String(s.startMedals||""), cashIn:String(s.cashIn||""),
    cashOutMedals:String(legacy?(s.endMedals||""):(s.cashOutMedals||"")),
    saveMedals:String(legacy?"":(s.saveMedals||"")),
    per100:isPreset?s.per100:"custom", customRate:isPreset?"":String(s.per100) };
  renderDayList(); renderForm();
  document.querySelector(".modal").scrollTo({top:document.getElementById("formArea").offsetTop-60,behavior:"smooth"});
}
function removeSession(id){
  state.sessions=state.sessions.filter(function(s){ return s.id!==id; });
  saveSessions();
  if(state.form.id===id) state.form=blankForm(state.selectedDate, state.defaultRate);
  renderDayList(); renderForm(); render();
}
function cancelEdit(){ state.form=blankForm(state.selectedDate, state.defaultRate); renderDayList(); renderForm(); }

function exportData(){
  var blob=new Blob([JSON.stringify(state.sessions,null,2)],{type:"application/json"});
  var url=URL.createObjectURL(blob), a=document.createElement("a");
  a.href=url; a.download="slot-shushi-"+todayStr()+".json"; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
function importData(e){
  var file=e.target.files&&e.target.files[0]; if(!file) return;
  var reader=new FileReader();
  reader.onload=function(){
    try{ var arr=JSON.parse(reader.result); if(Array.isArray(arr)){ state.sessions=arr; saveSessions(); render(); toast("読み込みました"); } }
    catch(err){ toast("ファイルを読めませんでした"); }
  };
  reader.readAsText(file); e.target.value="";
}

var toastTimer=null;
function toast(msg){
  var r=document.getElementById("toast-root");
  r.innerHTML='<div class="toast">'+esc(msg)+'</div>';
  clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){ r.innerHTML=""; }, 1800);
}

// ===== イベント =====
app.addEventListener("click", function(e){
  var t=e.target.closest("[data-act]"); if(!t) return;
  var act=t.getAttribute("data-act");
  if(act==="tab"){ state.tab=t.getAttribute("data-tab"); render(); }
  else if(act==="prev"){ if(--state.viewMonth<0){ state.viewMonth=11; state.viewYear--; } render(); }
  else if(act==="next"){ if(++state.viewMonth>11){ state.viewMonth=0; state.viewYear++; } render(); }
  else if(act==="day"){ openDay(t.getAttribute("data-date")); }
  else if(act==="yearpick"){ openYearPicker(); }
  else if(act==="today"){ state.viewYear=now.getFullYear(); state.viewMonth=now.getMonth(); render(); openDay(todayStr()); }
  else if(act==="export"){ exportData(); }
  else if(act==="import"){ document.getElementById("importer").click(); }
});
document.getElementById("importer").addEventListener("change", importData);

modalRoot.addEventListener("click", function(e){
  var t=e.target.closest("[data-act]");
  if(t){
    var act=t.getAttribute("data-act");
    if(act==="close"){ closeModal(); }
    else if(act==="bg" && e.target===t){ closeModal(); }
    else if(act==="yp-close"){ closeYearPicker(); }
    else if(act==="yp-bg" && e.target===t){ closeYearPicker(); }
    else if(act==="yp-prev"){ state.ypYear--; renderYearPicker(); }
    else if(act==="yp-next"){ state.ypYear++; renderYearPicker(); }
    else if(act==="yp-month"){ state.viewYear=state.ypYear; state.viewMonth=Number(t.getAttribute("data-m")); closeYearPicker(); render(); }
    else if(act==="rate"){ setRate(Number(t.getAttribute("data-rate"))); }
    else if(act==="rate-custom"){ setRate("custom"); var ci=t.querySelector("input"); if(ci) ci.focus(); }
    else if(act==="save"){ doSave(); }
    else if(act==="cancel"){ cancelEdit(); }
    else if(act==="edit"){ editSession(Number(t.getAttribute("data-id"))); }
    else if(act==="del"){ removeSession(Number(t.getAttribute("data-id"))); }
  }
});
modalRoot.addEventListener("input", function(e){
  var t=e.target.closest("[data-field]"); if(!t) return;
  var field=t.getAttribute("data-field");
  state.form[field]=t.value;
  if(field==="customRate" && state.form.per100!=="custom"){ state.form.per100="custom"; updateChips(); }
  updatePreview();
});

// ===== 起動 =====
render();
