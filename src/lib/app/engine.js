/* CSHealthED Cardiac Lab: the course engine (strips, practice areas, megacode, results, survey, scoreboard).
   Moved out of the old single page. Each SvelteKit page renders its own markup and calls show("<view>").
   Client-only: imported from the root layout after the page mounts. */
/* eslint-disable */
var IC_EXPAND='<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3h5v5M8 17H3v-5M17 3l-6 6M3 17l6-6"/></svg>';

export function boot(D, nav){
"use strict";
var D = window.TRAINER, P = D.practice, CASES = D.cases, CATS = D.cats;
var N = P.length;
var VIEW = null, VIEW_AREA = null;
var TOTAL_Q = CASES.reduce(function(a,c){return a+c.stages.length},0);
var KEY = "cardiac-lab-v1";
var S = {p:{}, m:{}, pi:1, ci:null};
try{ var raw = localStorage.getItem(KEY); if(raw){ var o = JSON.parse(raw); if(o && o.p) S = Object.assign(S,o); if(S.pi>N) S.pi=1; } }catch(e){}
/* Ectopy answer names now include the underlying rhythm ("Sinus rhythm with PACs"). Answers saved under the old names are carried over. */
var RENAMED = {"Premature atrial contractions (PACs)": "Sinus rhythm with PACs", "Premature junctional contractions (PJCs)": "Sinus rhythm with PJCs", "Junctional escape beat": "Sinus rhythm with a junctional escape beat", "Ventricular bigeminy": "Sinus rhythm with ventricular bigeminy", "Ventricular trigeminy": "Sinus rhythm with ventricular trigeminy", "PVC couplet": "Sinus rhythm with a PVC couplet", "Multifocal PVCs": "Sinus rhythm with multifocal PVCs", "Non-sustained VT (run of VT)": "Sinus rhythm with a run of VT (non-sustained VT)"};
function canon(x){ return (x!=null && RENAMED[x]) || x; }
(function(){ var fix=function(p){ if(p) Object.keys(p).forEach(function(n){ if(RENAMED[p[n]]) p[n]=RENAMED[p[n]]; }); };
  fix(S.p); if(S.ar) Object.keys(S.ar).forEach(function(k){ fix(S.ar[k] && S.ar[k].p); }); })();
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} if(window.__push) window.__push(); }
var $ = function(id){return document.getElementById(id)};
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}

/* ---------- waveform decoding & drawing ---------- */
var cache = {};
function decode(key){
  if(cache[key]) return cache[key];
  var d = D.strips[key].d, v = [], cur = 0, i = 0;
  while(i < d.length){
    var ch = d[i];
    if(ch === "|"){ var j = d.indexOf("|", i+1); cur = parseInt(d.slice(i+1,j),10); v.push(cur); i = j+1; }
    else { cur += d.charCodeAt(i) - 80; v.push(cur); i++; }
  }
  return (cache[key] = v);
}
var H = 960; // viewBox height: -0.9..1.5 mV at 400 units/mV
function Y(mv100){ return ((150 - mv100) * 4).toFixed(1); }
function stripSVG(key, mode, anim, crop){
  var VW = crop || 6000;
  var v = decode(key), pts = new Array(v.length);
  var n = Math.min(v.length, Math.floor(VW/2)+1); pts.length = n;
  for(var i=0;i<n;i++) pts[i] = (i*2) + "," + Y(v[i]);
  var mon = mode === "monitor";
  var stroke = mon ? "var(--mon-trace)" : "var(--trace)";
  var spikes = D.strips[key].s.filter(function(s){return s[0]<=VW}).map(function(s){
    var idx = Math.min(v.length-1, Math.round(s[0]/2)), base = v[idx];
    return '<line x1="'+s[0]+'" x2="'+s[0]+'" y1="'+Y(base)+'" y2="'+Y(base + s[1])+'" stroke="'+(mon?"#F4FFF8":stroke)+'" stroke-width="1.5" vector-effect="non-scaling-stroke"/>';
  }).join("");
  var cls = anim === "loop" ? "trace-loop" : (anim ? "trace-anim" : "");
  var glow = mon ? ' style="filter:drop-shadow(0 0 3px rgba(61,240,142,.55))"' : "";
  return '<svg'+(crop?' class="hero-svg"':'')+' viewBox="0 0 '+VW+' '+H+'" preserveAspectRatio="none" role="img" aria-label="ECG strip">'+
    '<rect width="'+VW+'" height="'+H+'" fill="url(#'+(mon?"mMajor":"pMajor")+')"/>'+
    '<g'+glow+'><polyline class="'+cls+'" pathLength="1" points="'+pts.join(" ")+'" fill="none" stroke="'+stroke+'" stroke-width="'+(mon?2:1.7)+'" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>'+spikes+'</g></svg>';
}

/* ---------- icons ---------- */
var IC = {
  ok:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8.2"/><path d="M6.2 10.3l2.5 2.5 5-5.2"/></svg>',
  no:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10" cy="10" r="8.2"/><path d="M7 7l6 6M13 7l-6 6"/></svg>',
  bulb:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 15h5M8 17.5h4M10 2.5a5 5 0 0 0-3 9c.6.5 1 1.2 1 2V14h4v-.5c0-.8.4-1.5 1-2a5 5 0 0 0-3-9z"/></svg>',
  pt:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="6" r="3.2"/><path d="M3.5 17.5c.8-3.4 3.4-5.2 6.5-5.2s5.7 1.8 6.5 5.2"/></svg>'
};

/* ---------- scoring ---------- */
function stripScore(){ var a=0,c=0; P.forEach(function(q){ var x=S.p[q.n]; if(x!=null){a++; if(x===q.cat)c++;} }); return {a:a,c:c}; }
function megaScore(){ var a=0,c=0; CASES.forEach(function(cs,ci){ cs.stages.forEach(function(st,si){ var x=S.m[ci+"-"+si]; if(x!=null){a++; if(st.options[x].ok)c++;} }); }); return {a:a,c:c}; }
function caseScore(ci){ var cs=CASES[ci],a=0,c=0; cs.stages.forEach(function(st,si){var x=S.m[ci+"-"+si]; if(x!=null){a++; if(st.options[x].ok)c++;}}); return {a:a,c:c,t:cs.stages.length}; }
function pct(c,t){ return t? Math.round(100*c/t) : 0; }
function ring(el, frac, label){
  var r=26, C=2*Math.PI*r;
  el.innerHTML='<circle class="t" cx="32" cy="32" r="'+r+'"/><circle class="v" cx="32" cy="32" r="'+r+'" stroke-dasharray="'+(C*frac).toFixed(1)+' '+C.toFixed(1)+'" transform="rotate(-90 32 32)"/><text x="32" y="36.5" text-anchor="middle">'+label+'</text>';
}
function updateTally(){
  if(typeof renderSurveyPrompts==="function") renderSurveyPrompts();
  var s=stripScore(), m=megaScore();
  $("tStrips").textContent = s.c+"/"+s.a; $("tMega").textContent = m.c+"/"+m.a;
  if($("ringStrips")) ring($("ringStrips"), s.a/N, pct(s.a,N)+"%");   // course rings show progress (answered), not score
  if($("ringMega")) ring($("ringMega"), m.a/TOTAL_Q, pct(m.a,TOTAL_Q)+"%");
  if($("goStrips")) $("goStrips").textContent = s.a===0 ? "Start strips" : (s.a===N ? "Review strips" : "Resume at strip "+S.pi);
  if($("hQ")) $("hQ").textContent = TOTAL_Q;
}

/* ---------- seeded shuffle for megacode options ---------- */
function perm(n, seed){ var a=[]; for(var i=0;i<n;i++)a.push(i); var s=seed*9301+49297; for(var j=n-1;j>0;j--){ s=(s*9301+49297)%233280; var k=Math.floor(s/233280*(j+1)); var t=a[j];a[j]=a[k];a[k]=t; } return a; }

/* ================= STRIPS ================= */
function renderStrip(){
  var q = P[S.pi-1], chosen = S.p[q.n], done = chosen != null;
  $("sNum").textContent = q.n;
  $("sStem").textContent = q.stem;
  Array.prototype.slice.call(document.querySelectorAll("#v-strips .mk-legend")).forEach(function(x){ x.remove(); });
  $("sPaper").innerHTML = stripSVG(q.strip, "paper", false);
  var sc = stripScore();
  $("sAns").textContent = sc.a; $("sCor").textContent = sc.c; $("sPct").textContent = sc.a? pct(sc.c,sc.a)+"%" : "–";
  $("sBar").style.width = pct(sc.a,N)+"%";
  var letters="ABCD";
  $("sOpts").innerHTML = q.options.map(function(o,i){
    var cls = "";
    if(done){ cls = o===q.cat ? "is-right" : (o===chosen ? "is-wrong" : "is-dim"); }
    return '<button class="opt '+cls+'" data-o="'+esc(o)+'" '+(done?"disabled":"")+'><span class="k">'+letters[i]+'</span><span>'+esc(o)+'</span></button>';
  }).join("");
  $("sFb").innerHTML = done ? stripFeedback(q, chosen) : "";
  if(done && chosen!==q.cat) markStrip($("sPaper"), q.strip, q.cat);
  $("sPrev").disabled = S.pi===1;
  $("sNext").textContent = S.pi===N ? "See results →" : (done ? "Next strip →" : "Skip →");
  renderDots();
  updateTally();
}
var REVEALED = "Revealed by the cardiologist";

/* ================= ON-STRIP TEACHING MARKS (shown after a wrong answer) =================
   Uses the beat timings saved with each strip (D.strips[key].m) to label what makes the correct rhythm what it is:
   P waves (red when not conducted), PR intervals, R–R intervals, wide QRS complexes, pacer spikes and capture,
   plus a short note for rhythms with no discrete beats.                                                           */
var MARK_NOTES = {
  "Atrial fibrillation":"No P waves: wavy baseline, and every R–R interval is different",
  "Atrial flutter":"Sawtooth flutter waves instead of P waves",
  "Supraventricular tachycardia (SVT)":"No visible P waves; fast and regular",
  "Multifocal atrial tachycardia (MAT)":"P waves change shape from beat to beat; rate over 100",
  "Wandering atrial pacemaker":"P waves change shape from beat to beat; rate under 100",
  "Ventricular fibrillation (coarse)":"Chaotic: no P, QRS or T anywhere",
  "Ventricular fibrillation (fine)":"Small chaotic waves, not a flat line: no P, QRS or T",
  "Polymorphic VT (torsades de pointes)":"QRS height twists up and down around the baseline",
  "Asystole":"Flat line: no electrical activity (confirm in a second lead)",
  "Agonal rhythm":"Rare, wide, slow complexes",
  "3rd-degree (complete) AV block":"P waves march through on their own; no fixed PR",
  "Junctional rhythm":"No upright P before the QRS", "Junctional bradycardia":"No upright P before the QRS",
  "Accelerated junctional rhythm":"No upright P before the QRS", "Junctional tachycardia":"No upright P before the QRS",
  "Idioventricular rhythm":"Wide QRS, no P waves, rate 20–40", "Accelerated idioventricular rhythm (AIVR)":"Wide QRS, no P waves, rate 40–100",
  "Monomorphic ventricular tachycardia":"Wide, fast, regular, all the same shape",
  "Pacer spikes without capture (asystole)":"Spikes with nothing after them"
};
var NO_RR = {"Ventricular fibrillation (coarse)":1, "Ventricular fibrillation (fine)":1, "Polymorphic VT (torsades de pointes)":1, "Asystole":1};
function markStrip(host, key, cat, item){
  var st=D.strips[key], m=st && st.m, svg=host && host.querySelector("svg:not(.cal-svg)");
  if(!m || !svg) return;
  var box=svg.parentNode; Array.prototype.slice.call(box.querySelectorAll(":scope > .mk-ov")).forEach(function(o){ o.remove(); });
  var VW=+(svg.getAttribute("viewBox")||"0 0 6000").split(/\s+/)[2]||6000, v=decode(key), grp=(CATS[cat]||{}).group, chb=/complete/.test(cat);
  var X=function(ms){ return (ms/VW*100).toFixed(2)+"%"; };
  var edge=function(ms){ var f=ms/VW; return f<0.06 ? " L" : (f>0.94 ? " Rt" : ""); };  // keep labels inside the strip
  var low=function(ms, win){ var a=Math.max(0, Math.round((ms-win)/2)), b=Math.min(v.length-1, Math.round((ms+win)/2)), lo=999; for(var i=a;i<=b;i++) if(v[i]<lo) lo=v[i]; return Y(lo)/H*100; };
  var top=function(ms, win){ var a=Math.max(0, Math.round((ms-(win||0))/2)), b=Math.min(v.length-1, Math.round((ms+(win||0))/2)), hi=-999; for(var i=a;i<=b;i++) if(v[i]>hi) hi=v[i]; return (Y(hi)/H*100).toFixed(1)+"%"; };
  var h="", near=function(list, x, tol){ return list.some(function(y){ return Math.abs(y-x)<=tol; }); };
  var wide=m.w||[], spikes=(st.s||[]).map(function(x){ return x[0]; });
  // pairs: exact from the generator when known, else inferred (a QRS 60–450 ms after the P with no other P between)
  var pairs=m.pr, blocked=m.b;
  if(!pairs){
    pairs=[]; blocked=[];
    m.p.forEach(function(p, i){ var nx=m.p[i+1]==null?1e9:m.p[i+1], q=m.q.filter(function(x){ return x>p+60 && x<p+450 && x<nx; })[0];
      if(q!=null && !near(wide, q, 5)) pairs.push([p, q, q-p]); else if(grp==="block") blocked.push(p); });
  }
  if(chb){ pairs=[]; blocked=[]; }
  // P waves
  m.p.forEach(function(p){ var bad=near(blocked, p, 6);
    h+='<span class="mk mk-p'+(bad?' bad':'')+edge(p)+'" style="left:'+X(p)+';top:'+top(p, 30)+'">'+(bad?'P · not conducted':'P')+'</span>'; });
  // PR intervals (sinus, blocks, atrial ectopy)
  if((grp==="sinus" || grp==="block" || /PACs/.test(cat)) && pairs.length){
    pairs.forEach(function(x){ var q0=x[1]-38, p0=q0-x[2];
      h+='<span class="mk-br pr" style="left:'+X(p0)+';width:'+(x[2]/VW*100).toFixed(2)+'%"><b>PR '+(x[2]/1000).toFixed(2)+'</b></span>'; });
  }
  // R–R intervals
  if(m.q.length>=2 && !NO_RR[cat]){
    for(var i=1;i<m.q.length;i++){ var a=m.q[i-1], d=m.q[i]-a;
      h+='<span class="mk-br rr" style="left:'+X(a)+';width:'+(d/VW*100).toFixed(2)+'%"><b>'+(d/1000).toFixed(2)+'</b></span>'; }
  }
  // wide QRS
  var narrowToo=m.q.length>wide.length;
  var paced = grp==="paced" || spikes.length>0;
  var ront = item && /R-on-T/.test(item.name||""), noted = item && (item.rows||[]).filter(function(r){ return r[0]==="Also noted"; })[0];
  noted = noted ? noted[1] : "";
  wide.forEach(function(q){ var lbl = paced && spikes.some(function(c){ return q>=c-5 && q-c<=140; }) ? 'paced QRS' : (ront ? 'R on T · PVC' : (narrowToo && grp==="ventricular" ? 'PVC · wide' : 'wide QRS'));
    var t=parseFloat(top(q+40, 90));
    var rc = lbl.indexOf("R on T")===0 ? " ront" : "";
    if(t>26) h+='<span class="mk mk-w'+rc+edge(q)+'" style="left:'+X(q)+';top:'+t.toFixed(1)+'%">'+lbl+'</span>';
    else h+='<span class="mk mk-w under'+rc+edge(q)+'" style="left:'+X(q)+';top:'+Math.min(low(q+40, 120), 84).toFixed(1)+'%">'+lbl+'</span>'; });
  // pacer spikes and capture
  if(grp==="paced" || spikes.length){
    spikes.forEach(function(c){ var cap=m.q.some(function(q){ return q>=c-5 && q-c<=140; });
      h+='<span class="mk mk-s'+(cap?'':' bad')+edge(c)+'" style="left:'+X(c)+'">'+(cap?'✓ capture':'✗ no capture')+'</span>'; });
  }
  // field strips: extra findings listed under "Also noted"
  var narrow=m.q.filter(function(q){ return !near(wide, q, 5); });
  if(item && /pre-excitation/.test(item.name||"")) narrow.forEach(function(q){ h+='<span class="mk mk-d'+edge(q)+'" style="left:'+X(q-55)+';top:'+top(q-55, 15)+'">delta</span>'; });
  if(/ST depression/.test(noted)) narrow.forEach(function(q){ h+='<span class="mk-band" style="left:'+X(q+60)+';width:'+(90/VW*100).toFixed(2)+'%"></span>'; });
  var note=MARK_NOTES[cat];
  if(note) h+='<span class="mk-note">'+esc(note)+'</span>';
  var ov=document.createElement("div"); ov.className="mk-ov"; ov.setAttribute("aria-hidden","true"); ov.innerHTML=h;
  box.appendChild(ov);
  // say exactly what was marked
  var said=[], c=function(sel){ return ov.querySelectorAll(sel).length; };
  if(c(".mk-p")) said.push("P waves"+(c(".mk-p.bad")?" (red: not conducted)":""));
  if(c(".mk-br.pr")) said.push("PR intervals");
  if(c(".mk-br.rr")) said.push("R–R intervals (seconds, across the top)");
  if(c(".mk-w.ront")) said.push("R-on-T PVCs landing on the T wave before them (red)");
  if(c(".mk-w:not(.ront)")) said.push("wide QRS complexes");
  if(c(".mk-s")) said.push("pacer spikes and whether they capture");
  if(c(".mk-d")) said.push("delta waves (slurred QRS start)");
  if(c(".mk-band")) said.push("ST depression (blue)");
  // color key under the strip
  var KEY=[[".mk-p:not(.bad)",MKC.p,"P waves"],[".mk-br.pr",MKC.p,"PR interval"],[".mk-p.bad",MKC.miss,"P not conducted"],[".mk-br.rr",MKC.rr,"R–R interval (s)"],
    [".mk-w:not(.ront)",MKC.qrs,"wide QRS"],[".mk-w.ront",MKC.ste,"R on T: PVC lands on the T wave"],[".mk-s:not(.bad)",MKC.pace,"pacer spike that captures"],[".mk-s.bad",MKC.miss,"pacer spike that doesn't"],[".mk-d",MKC.delta,"delta wave"],[".mk-band",MKC.std,"ST depression"]];
  var paper=box.closest(".paper"), keyEl=paper && paper.parentNode.querySelector(".mk-legend"); if(keyEl) keyEl.remove();
  if(paper){ var leg=document.createElement("div"); leg.className="mk-legend";
    leg.innerHTML='<b>Why it\'s '+esc(cat)+':</b>'+KEY.filter(function(k){ return c(k[0]); }).map(function(k){ return '<span><i style="background:'+k[1]+'"></i>'+k[2]+'</span>'; }).join("")+(note?'<span>'+esc(note)+'</span>':'');
    paper.parentNode.insertBefore(leg, paper.nextSibling); }
  var hint=document.querySelector(".mk-hint span");
  if(hint){ var nm=cat.replace(/\s*\(.*\)$/,"");
    hint.textContent = "Look back at the strip: it's now marked up to show what makes this "+nm+"."+(said.length?" Labeled: "+said.join(", ")+".":"")+(note?" "+note+".":""); }
}

/* ----- 12-lead teaching marks (after a wrong answer): colored by what they show ----- */
/* One color per kind of finding, the same on rhythm strips, 12-leads and every color key. */
var MKC = {ste:"#D9121A", std:"#0A6FDD", q:"#E05F00", t:"#8E24AA", qrs:"#00838F", delta:"#C2185B", volt:"#8D5B00", p:"#2E8B00", qt:"#B07A00", rr:"#02245D", pace:"#3949AB", miss:"#5F6B7A"};
var MK12_COLOR = {stu:MKC.ste, j:MKC.ste, brug:MKC.ste, rec:MKC.std, dw:MKC.std, q:MKC.q, tpk:MKC.t, tinv:MKC.t, tbi:MKC.t,
  u:MKC.qt, qt:MKC.qt, rsr:MKC.qrs, sw:MKC.qrs, qs:MKC.qrs, notch:MKC.qrs, delta:MKC.delta, volt:MKC.volt, tallr:MKC.volt, pr:MKC.p};
var MK12_KEY = [[MKC.ste,"ST elevation (and its shape)",["stu","j","brug"]], [MKC.std,"ST depression: reciprocal, diffuse or upsloping",["rec","dw"]],
  [MKC.q,"Q waves",["q"]], [MKC.t,"T-wave changes: peaked, inverted, biphasic",["tpk","tinv","tbi"]],
  [MKC.qrs,"QRS width and bundle branch patterns (rSR′, QS, notched R)",["rsr","sw","qs","notch"]], [MKC.delta,"Delta wave (pre-excitation)",["delta"]],
  [MKC.volt,"Voltage and tall R waves",["volt","tallr"]], [MKC.p,"PR segment",["pr"]], [MKC.qt,"QT interval and U waves",["u","qt"]]];
function svgEl(tag, at){ var e=document.createElementNS("http://www.w3.org/2000/svg", tag); for(var k in at) e.setAttribute(k, at[k]); return e; }
function markECG12(host, q){
  var svg=host && host.querySelector("svg.ecg12"), m=q.mk; if(!svg || !m) return;
  var old=svg.querySelector("g.mk12"); if(old) old.remove();
  var g=svgEl("g", {"class":"mk12"}), per={}, used={}, sum={};
  var cell=function(ld){ for(var ci=0;ci<LEAD_COLS.length;ci++){ var ri=LEAD_COLS[ci].indexOf(ld); if(ri>=0) return [ri, ci]; } return [3, 0]; };
  m.f.forEach(function(x){
    var ld=x[0], kind=x[1], label=x[2], v=x[3], col=MK12_COLOR[kind]||"#02245D", rc=cell(ld), ri=rc[0], ci=rc[1], y0=ri*1200+760;
    var d=(m.ld && m.ld[ld]) || m.d, lo=ci*2500+120, hi=ci*2500+2380;
    used[kind]=1; var base=label.replace(/\s*[\d.]+\s*mm/g,"").replace(/\s+\(.*\)$/,"").trim(); (sum[base]=sum[base]||[]).indexOf(ld)<0 && sum[base].push(ld);
    m.b.forEach(function(bt){ var c=bt[0], tp=bt[1]; if(c<lo || c>hi) return;
      var sh;
      if(kind==="stu"||kind==="rec"||kind==="j"||kind==="brug"||kind==="dw"){
        var x1=c+d/2, w=kind==="dw"?75:115, h=Math.max(Math.abs(v*400), 16), yy=v>=0 ? y0-h : y0;
        sh=svgEl("rect", {x:x1, y:yy, width:w, height:h, rx:8, fill:col, "fill-opacity":.3, stroke:col, "stroke-width":9});
      } else if(kind==="tpk"||kind==="tinv"||kind==="tbi"||kind==="u"){
        var cx= kind==="u" ? tp+170 : tp, ry=Math.max(Math.abs(v*400)/2+45, 70);
        sh=svgEl("ellipse", {cx:cx, cy:y0-v*200, rx:kind==="u"?85:120, ry:ry, fill:col, "fill-opacity":.14, stroke:col, "stroke-width":9});
      } else if(kind==="pr"){
        sh=svgEl("rect", {x:c-d/2-95, y:y0-55, width:85, height:110, rx:10, fill:col, "fill-opacity":.2, stroke:col, "stroke-width":8});
      } else {
        var a= kind==="delta" ? c-d/2-55 : (kind==="q" ? c-d/2-18 : c-d/2-22), b2= kind==="delta" ? c-d/2+25 : (kind==="q" ? c-d/2+40 : c+d/2+22);
        var top=y0-Math.max(v,0)*400-45, bot=y0-Math.min(v,0)*400+45;
        sh=svgEl("rect", {x:a, y:top, width:b2-a, height:bot-top, rx:12, fill:col, "fill-opacity":.13, stroke:col, "stroke-width":9, "stroke-dasharray":"28 16"});
      }
      g.appendChild(sh); });
    var k=per[ld]=(per[ld]||0)+1;
    var tx=svgEl("text", {x:ci*2500+330, y:ri*1200+175+(k-1)*125, fill:col, "class":"mk12-t"}); tx.textContent=label; g.appendChild(tx);
  });
  if(m.qt){ var yq=3*1200+330, col=MK12_COLOR.qt; used.qt=1;
    g.appendChild(svgEl("path", {d:"M"+m.qt[0]+" "+(yq+60)+"V"+yq+"H"+m.qt[1]+"V"+(yq+60), fill:"none", stroke:col, "stroke-width":14}));
    var tq=svgEl("text", {x:(m.qt[0]+m.qt[1])/2, y:yq-30, fill:col, "class":"mk12-t", "text-anchor":"middle"}); tq.textContent=m.qt[2]; g.appendChild(tq); sum[m.qt[2]]=["II"]; }
  if(m.spr){ var ts=svgEl("text", {x:330, y:3*1200+175, fill:MKC.delta, "class":"mk12-t"}); ts.textContent=m.spr; g.appendChild(ts); used.delta=1; sum[m.spr]=["II"]; }
  svg.appendChild(g);
  // color key under the ECG, then a plain-language summary in the feedback
  var keyEl=host.parentNode.querySelector(".mk-legend"); if(keyEl) keyEl.remove();
  var chips=MK12_KEY.filter(function(k){ return k[2].some(function(x){ return used[x]; }); }).map(function(k){ return '<span><i style="background:'+k[0]+'"></i>'+esc(k[1])+'</span>'; }).join("");
  var leg=document.createElement("div"); leg.className="mk-legend";
  leg.innerHTML='<b>Why it\'s '+esc(q.cat)+':</b>'+(chips || '<span>No ST elevation or depression, normal QRS and intervals: nothing abnormal to mark.</span>');
  host.parentNode.insertBefore(leg, host.nextSibling);
  var hint=document.querySelector(".mk-hint span");
  if(hint){ var parts=Object.keys(sum).map(function(b){ return sum[b][0]==="II" && /QT|PR/.test(b) ? b+" (rhythm strip)" : b+" in "+sum[b].join(", "); });
    hint.textContent="Look back at the ECG: the colored marks show why this is "+q.cat+". "+(parts.length ? parts.join(" · ")+"." : "Nothing abnormal: no ST elevation or depression, normal QRS width and intervals."); }
}
function stripFeedback(q, chosen){
  var ok = chosen===q.cat, C = CATS[q.cat], X = CATS[chosen], revealed = chosen===REVEALED;
  var h = '<div class="fb '+(ok?"ok":"no")+'"><div class="verdict">'+(ok?IC.ok+"Correct":IC.no+(revealed?"Answer revealed · counted as wrong":"Not quite"))+'</div>';
  h += '<div class="answer-name">'+esc(q.name)+'</div>';
  if(!ok) h += '<p class="fb-note mk-hint">'+IC.bulb+'<span>Look back at the strip: it\'s now marked up to show what makes this '+esc(q.cat.replace(/\s*\(.*\)$/,""))+'. P waves'+(' (red if not conducted)')+', PR and R–R intervals in seconds'+', wide QRS complexes and pacer spikes are labeled where they apply.</span></p>';
  if(revealed){
    h += '<p class="fb-note">The cardiologist talked you through this one, so it counts as wrong. Here\'s the full explanation.</p>';
  } else if(!ok){
    h += '<div class="why"><div><small>You chose</small><b>'+esc(chosen)+'</b>'+esc(X.key)+'</div><div><small>This strip is</small><b>'+esc(q.cat)+'</b>'+esc(C.key)+'</div></div>';
  }
  h += '<div class="clue">'+IC.bulb+'<p><b>The tell: </b>'+esc(C.clue)+'</p></div>';
  h += '<div class="interp"><table class="itable"><tbody>'+q.rows.map(function(r){return '<tr><th scope="row">'+esc(r[0])+'</th><td>'+esc(r[1])+'</td></tr>'}).join("")+'</tbody></table>';
  h += '<div class="action"><h4>Field action</h4><ul>'+q.action.map(function(a){return '<li>'+esc(a)+'</li>'}).join("")+'</ul></div></div></div>';
  return h;
}
function renderDots(){
  $("sDots").innerHTML = P.map(function(q){
    var x=S.p[q.n], c = x==null ? "" : (x===q.cat?"r":"w");
    return '<button class="dot '+c+(q.n===S.pi?" cur":"")+'" data-n="'+q.n+'" aria-label="Strip '+q.n+'">'+q.n+'</button>';
  }).join("");
}
function bindStrips(){
$("sOpts").addEventListener("click", function(e){
  var b = e.target.closest(".opt"); if(!b || b.disabled) return;
  S.p[P[S.pi-1].n] = b.getAttribute("data-o"); save(); renderStrip();
  var fb=$("sFb"); if(fb.firstChild && fb.getBoundingClientRect().top > window.innerHeight*0.8) fb.scrollIntoView({behavior:"smooth",block:"nearest"});
});
$("sPrev").addEventListener("click", function(){ if(S.pi>1){S.pi--; save(); renderStrip(); scrollTop();} });
$("sNext").addEventListener("click", function(){ if(S.pi<N){S.pi++; save(); renderStrip(); scrollTop();} else nav("/results"); });
$("sDots").addEventListener("click", function(e){ var b=e.target.closest(".dot"); if(!b)return; S.pi=+b.getAttribute("data-n"); save(); renderStrip(); scrollTop(); });
}
function scrollTop(){ window.scrollTo({top:0,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"}); }
document.addEventListener("keydown", function(e){
  if(VIEW!=="strips" || e.target.closest("input,textarea,.cal-ov")) return;
  var k=e.key.toUpperCase(), idx="ABCD".indexOf(k);
  if(idx>=0){ var btn=$("sOpts").children[idx]; if(btn && !btn.disabled) btn.click(); }
  else if(e.key==="ArrowRight") $("sNext").click();
  else if(e.key==="ArrowLeft") $("sPrev").click();
});

/* ================= MEGACODE ================= */
function renderCases(){
  var m=megaScore(); $("mCor").textContent=m.c; $("mTot").textContent=TOTAL_Q;
  $("mCases").innerHTML = CASES.map(function(cs,ci){
    var s=caseScore(ci), pill = s.a===0 ? '<span class="pill">Not started</span>' : (s.a===s.t ? '<span class="pill done">'+s.c+' / '+s.t+'</span>' : '<span class="pill part">'+s.a+' of '+s.t+' done</span>');
    return '<button class="case" data-c="'+ci+'"><span class="no">CASE '+String(cs.n).padStart(2,"0")+'</span><h3>'+esc(cs.title)+'</h3><span class="focus">'+esc(cs.focus)+'</span><span class="st"><span>'+cs.stages.length+' decisions</span>'+pill+'</span></button>';
  }).join("");
}
function bindMega(){
$("mCases").addEventListener("click", function(e){ var b=e.target.closest(".case"); if(!b)return; openCase(+b.getAttribute("data-c")); });
}
function openCase(ci){ S.ci=ci; var s=caseScore(ci); S.si = s.a>=s.t ? s.t : s.a; save(); renderMega(); megaFit(true); }
/* Bring the monitor and the question into view together: scroll to the case and shrink the monitor just enough to fit. */
var MEGA_Z = 1;
function megaFit(scroll){
  var mon=document.querySelector("#mRun .monitor"), opts=$("mOpts"), scen=document.querySelector("#mRun .scenario");
  if(!mon || !opts){ if(scroll) scrollTop(); return; }
  mon.style.zoom="";
  var bar=document.querySelector(".bar").getBoundingClientRect().height, avail=window.innerHeight-bar-20;
  var top=function(el){ return el.getBoundingClientRect().top+window.scrollY; };
  var monH=mon.getBoundingClientRect().height, below=top(opts)+opts.getBoundingClientRect().height-(top(mon)+monH);
  var start=scen||mon, z=(avail-below-(top(mon)-top(start)))/monH;
  if(z<0.75){ start=mon; z=(avail-below)/monH; }
  MEGA_Z=Math.max(0.5, Math.min(1, z)); if(MEGA_Z>0.995) MEGA_Z=1;
  mon.style.zoom = MEGA_Z<1 ? MEGA_Z.toFixed(3) : "";
  if(scroll) window.scrollTo({top:Math.max(0, top(start)-bar-10), behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
}
var megaRT; window.addEventListener("resize", function(){ if(VIEW!=="megacode" || S.ci==null) return; clearTimeout(megaRT); megaRT=setTimeout(function(){ megaFit(false); }, 150); });
function vitalsFrom(str){
  var v={hr:"--",bp:"--/--",sp:"--",co:"--"};
  var m;
  if((m=str.match(/HR (\d+)/))) v.hr=m[1];
  if((m=str.match(/BP (\d+\/\d+)/))) v.bp=m[1];
  if((m=str.match(/SpO₂ (\d+)/))) v.sp=m[1];
  if((m=str.match(/ETCO₂[^\d]*(\d+)/))) v.co=m[1];
  return v;
}
function renderMega(){
  if(S.ci==null){ $("mList").hidden=false; $("mRun").hidden=true; renderCases(); return; }
  $("mList").hidden=true; $("mRun").hidden=false;
  var ci=S.ci, cs=CASES[ci], s=caseScore(ci);
  var steps = cs.stages.map(function(st,si){ var x=S.m[ci+"-"+si]; var c = x==null ? (si===S.si?"cur":"") : (st.options[x].ok?"r":"w"); return '<i class="'+c+'"></i>'; }).join("");
  var head = '<div class="runner-head"><div><div class="eyebrow">Case '+cs.n+' of 20 · '+esc(cs.focus)+'</div><h2>'+esc(cs.title)+'</h2></div><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div class="steps" aria-label="Progress">'+steps+'</div><button class="btn btn-ghost" id="mBack">All cases</button></div></div>';
  var scen = '<div class="card scenario">'+IC.pt+'<p>'+esc(cs.scenario)+'</p></div>';
  if(S.si >= cs.stages.length){ $("mRun").innerHTML = '<div class="runner">'+head+scen+caseSummary(ci)+'</div>'; bindRun(); return; }
  var si=S.si, st=cs.stages[si], key=ci+"-"+si, chosen=S.m[key], done=chosen!=null, vt=vitalsFrom(st.vitals);
  var pulseless = /Pulse: none/.test(st.vitals);
  if(vt.hr==="--" && st.hr) vt.hr = String(st.hr);
  if(pulseless){ vt.bp="--/--"; vt.sp="--"; }
  var mon = '<div class="monitor"><div class="mon-top"><span class="live">Lead II · Decision '+(si+1)+' of '+cs.stages.length+'</span>'+(done?'<span class="reveal">Rhythm: '+esc(st.rhythm)+'</span>':'<span>25 mm/s</span>')+'</div>'+
    '<div class="mon-body"><div class="mon-screen">'+stripSVG(st.strip,"monitor",!done)+'</div><div class="vitals">'+
    '<div class="vital hr"><small>HR</small><b class="num">'+vt.hr+'</b></div><div class="vital bp"><small>NIBP</small><b class="num">'+vt.bp+'</b></div>'+
    '<div class="vital sp"><small>SpO₂</small><b class="num">'+vt.sp+'</b></div><div class="vital co"><small>ETCO₂</small><b class="num">'+vt.co+'</b></div></div></div>'+
    '<div class="mon-status"><em>Status</em><span>'+esc(st.vitals)+'</span></div></div>';
  var order = perm(st.options.length, (ci+1)*31+si*7+3), letters="ABCD";
  var opts = order.map(function(oi,k){
    var o=st.options[oi], cls = done ? (o.ok ? "is-right" : (oi===chosen ? "is-wrong" : "is-dim")) : "";
    return '<button class="opt '+cls+'" data-i="'+oi+'" '+(done?"disabled":"")+'><span class="k">'+letters[k]+'</span><span>'+esc(o.t)+'</span></button>';
  }).join("");
  var fb = "";
  if(done){
    var c=st.options[chosen], right=st.options.filter(function(o){return o.ok})[0];
    fb = '<div class="fb '+(c.ok?"ok":"no")+'" aria-live="polite"><div class="verdict">'+(c.ok?IC.ok+"Correct":IC.no+"Not the best choice")+'</div>';
    if(!c.ok) fb += '<div class="why"><div><small>Your choice</small><b>'+esc(c.t)+'</b>'+esc(c.why)+'</div><div><small>Best answer</small><b>'+esc(right.t)+'</b>'+esc(right.why)+'</div></div>';
    else fb += '<div class="clue">'+IC.bulb+'<p>'+esc(c.why)+'</p></div>';
    fb += '<div class="clue">'+IC.bulb+'<p><b>Rhythm on the monitor: </b>'+esc(st.rhythm)+'</p></div></div>';
  }
  var last = si===cs.stages.length-1;
  var nav = '<div class="qnav"><button class="btn btn-ghost" id="mPrev" '+(si===0?"disabled":"")+'>← Previous decision</button><button class="btn btn-primary" id="mNext" '+(done?"":"disabled")+'>'+(last?"Finish case →":"Next decision →")+'</button></div>';
  $("mRun").innerHTML = '<div class="runner">'+head+scen+mon+'<div class="card decision"><h3>'+esc(st.prompt)+'</h3><div class="opt-list" id="mOpts">'+opts+'</div>'+fb+nav+'</div></div>';
  if(MEGA_Z<1) document.querySelector("#mRun .monitor").style.zoom=MEGA_Z.toFixed(3);
  bindRun();
  updateTally();
}
function caseSummary(ci){
  var cs=CASES[ci], s=caseScore(ci);
  var items = cs.stages.map(function(st,si){ var x=S.m[ci+"-"+si], o=st.options[x], right=st.options.filter(function(q){return q.ok})[0];
    return '<li><b>'+esc(st.prompt)+'</b> '+(o&&o.ok?'<span style="color:var(--ok)">✓ '+esc(right.t)+'</span>':'<span style="color:var(--bad)">✗ You chose: '+esc(o?o.t:"—")+'</span><span>Best: '+esc(right.t)+'</span>')+'</li>'; }).join("");
  var next = ci<19 ? '<button class="btn btn-primary" id="mNextCase">Next case →</button>' : '<a class="btn btn-primary" href="/results">See results →</a>';
  return '<div class="card case-summary"><div class="verdict" style="color:var(--accent)">Case complete</div><h3 style="font-family:var(--f-display);font-size:42px;text-transform:uppercase;font-weight:600">'+s.c+' / '+s.t+' correct</h3><ol>'+items+'</ol><div class="qnav"><button class="btn btn-ghost" id="mRetry">Retry this case</button>'+next+'</div></div>';
}
function bindRun(){
  var b;
  if((b=$("mBack"))) b.onclick=function(){ S.ci=null; save(); renderMega(); scrollTop(); };
  if((b=$("mOpts"))) b.onclick=function(e){ var o=e.target.closest(".opt"); if(!o||o.disabled)return; S.m[S.ci+"-"+S.si]=+o.getAttribute("data-i"); save(); renderMega();
    var fb=document.querySelector("#mRun .decision .fb"); if(fb && fb.getBoundingClientRect().top > window.innerHeight*0.75) fb.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth", block:"nearest"}); };
  if((b=$("mPrev"))) b.onclick=function(){ if(S.si>0){S.si--; save(); renderMega(); megaFit(true);} };
  if((b=$("mNext"))) b.onclick=function(){ S.si++; save(); renderMega(); megaFit(true); };
  if((b=$("mNextCase"))) b.onclick=function(){ openCase(S.ci+1); };
  if((b=$("mRetry"))) b.onclick=function(){ var cs=CASES[S.ci]; cs.stages.forEach(function(_,si){ delete S.m[S.ci+"-"+si]; }); S.si=0; save(); renderMega(); megaFit(true); };
}

/* ================= RESULTS ================= */
var GROUPS = D.groups;
var confirmReset = false;
function renderResults(){
  var s=stripScore(), m=megaScore(), totC=s.c+m.c, totT=N+TOTAL_Q, done=s.a+m.a;
  var overall = pct(totC,done), r=62, C=2*Math.PI*r;
  var msg = done===0 ? "Answer strips and megacode decisions to build your score." :
    (done<totT ? "Your score is the share of the "+done+" items you've answered that were correct ("+(totT-done)+" still to go). "+(overall>=84 ? "On track: keep going." : "Review the missed items below as you go.") :
    (overall>=90 ? "Excellent. You're reading rhythms and running codes at a high level." : overall>=84 ? "Solid pass-level performance. Review the items below to tighten up." : "Keep practicing. Review the missed strips and retry the cases below."));
  var h = '<div class="card score-hero"><svg class="big-ring" viewBox="0 0 150 150"><circle class="t" cx="75" cy="75" r="'+r+'"/><circle class="v" cx="75" cy="75" r="'+r+'" stroke-dasharray="'+(C*overall/100).toFixed(1)+' '+C.toFixed(1)+'" transform="rotate(-90 75 75)"/><text x="75" y="86" text-anchor="middle" font-size="40">'+(done?overall+'%':'–')+'</text></svg>'+
    '<div><div class="eyebrow">'+(done<totT?'Score so far':'Final score')+'</div><h2><span class="num">'+totC+'</span> of <span class="num">'+done+'</span> answered correct</h2><p>'+msg+'</p>'+
    '<div class="legend" style="margin-top:12px"><span>Strips: <b class="num">'+s.c+'/'+s.a+'</b> ('+(s.a?pct(s.c,s.a)+'%':'–')+') · '+s.a+' of '+N+' answered</span><span>Megacode: <b class="num">'+m.c+'/'+m.a+'</b> ('+(m.a?pct(m.c,m.a)+'%':'–')+') · '+m.a+' of '+TOTAL_Q+' answered</span></div></div></div>';
  var bars = GROUPS.map(function(g){ var t=0,c=0,a=0; P.forEach(function(q){ if(CATS[q.cat].group===g[0]){t++; var x=S.p[q.n]; if(x!=null){a++; if(x===q.cat)c++;}} });
    return '<div class="barrow"><span>'+g[1]+'</span><span class="track"><i style="width:'+pct(c,a)+'%"></i></span><b>'+(a?c+'/'+a:'—')+'</b></div>'; }).join("");
  var missed = P.filter(function(q){ var x=S.p[q.n]; return x!=null && x!==q.cat; });
  var ml = missed.length ? missed.map(function(q){ return '<button data-n="'+q.n+'"><b>#'+q.n+'</b><span style="color:var(--ink)">'+esc(q.name)+'</span></button>'; }).join("") : '<p class="empty">'+(s.a?"No missed strips. Well done.":"No strips answered yet.")+'</p>';
  var cs = CASES.map(function(c,ci){ var k=caseScore(ci); return '<button data-c="'+ci+'"><span style="color:var(--muted);font-size:11.5px">Case '+c.n+'</span><b>'+(k.a?k.c+'/'+k.a:'—')+'</b><span>'+esc(c.title)+'</span></button>'; }).join("");
  h += '<div class="split"><div class="card panel"><h3>Strips by rhythm family <span class="num">'+s.c+'/'+s.a+'</span></h3><div class="bars">'+bars+'</div><h3 style="margin-top:6px">Missed strips <span class="num">'+missed.length+'</span></h3><div class="missed" id="rMissed">'+ml+'</div></div>'+
       '<div class="card panel"><h3>Megacode by case <span class="num">'+m.c+'/'+m.a+'</span></h3><div class="case-scores" id="rCases">'+cs+'</div>'+
       '<h3 style="margin-top:6px">Start over</h3><div class="confirm" id="rReset">'+(confirmReset?'<span>Erase all answers in this browser?</span><button class="btn btn-primary" id="rYes">Erase</button><button class="btn btn-ghost" id="rNo">Cancel</button>':'<button class="btn btn-ghost" id="rAsk">Reset all progress</button>')+'</div></div></div>';
  $("rBody").innerHTML = h;
  $("rMissed").onclick=function(e){ var b=e.target.closest("button"); if(!b)return; S.pi=+b.getAttribute("data-n"); save(); nav("/strips"); };
  $("rCases").onclick=function(e){ var b=e.target.closest("button"); if(!b)return; S.ci=+b.getAttribute("data-c"); var k=caseScore(S.ci); S.si=k.a>=k.t?k.t:k.a; save(); nav("/megacode"); };
  var b; if((b=$("rAsk"))) b.onclick=function(){confirmReset=true; renderResults();};
  if((b=$("rNo"))) b.onclick=function(){confirmReset=false; renderResults();};
  if((b=$("rYes"))) b.onclick=function(){ S={p:{},m:{},pi:1,ci:null,cohort:S.cohort||"",name:S.name||"",code:S.code||"",sid:S.sid,svDone:S.svDone,svAnswers:S.svAnswers,svAnon:S.svAnon,ar:S.ar,df:S.df,cl:S.cl}; save(); confirmReset=false; renderResults(); updateTally(); };
}

/* ================= VIEWS (each SvelteKit page calls show() with its own view) ================= */
function heroKey(){ for(var i=0;i<P.length;i++) if(P[i].cat==="Normal sinus rhythm") return P[i].strip; return P[0].strip; }
function show(v, areaKey){
  VIEW=v; VIEW_AREA = v==="area" ? areaKey : null;
  document.querySelectorAll(".nStrips").forEach(function(e){e.textContent=N});
  if(v==="home"){ bindSignin(); var hs=$("heroScreen"); if(hs) hs.innerHTML = stripSVG(D.strips.p1 ? heroKey() : Object.keys(D.strips)[0], "monitor", "loop", 3000); }
  if(v==="strips") bindStrips();
  if(v==="megacode") bindMega();
  if(v==="scoreboard") bindBoard();
  if(v==="area") renderArea(areaKey); else { CUR_AREA=null; renderCardioPop(null); }
  if(v==="practice" || v==="home" || v==="course") renderAreaTiles();
  defibNav();
  if(v==="strips") renderStrip();
  if(v==="megacode"){ renderMega(); if(S.ci!=null) setTimeout(function(){ megaFit(true); }, 0); }
  if(v==="codelab") renderCodeLab(); else if(window.CodeLab) CodeLab.stop();
  if(v==="defib") renderDefib(); else if(window.DefibLab && v!=="codelab") DefibLab.stop();
  if(v==="results") renderResults();
  if(v==="survey") renderSurvey(); else if(SV.editing && !SV.sending){ SV.editing=false; }
  if(v==="home" || v==="course" || v==="results") renderSurveyPrompts();
  updateTally(); setSync(SB.state);
  if(v==="scoreboard") openBoard(); else stopPoll();
}
function rerender(){ if(VIEW) show(VIEW, VIEW_AREA); }
/* ================= SCORE SHARING (Cardiac Lab API on Netlify + Supabase) ================= */
var API = "/api";
var SB = {online:false, requireCode:false, state:"local", admin:false, pass:null, rows:null, open:null, last:"", timer:null, writing:false, again:false, poll:null, confirmDel:null};
var SYNC_TXT = {local:"Saved on this device", offline:"Saved on this device", needname:"Not shared yet", needcode:"Not shared yet", synced:"Shared with instructor", saving:"Saving…", badcode:"Check class code", error:"Sync paused"};
var SHARE_TXT = {
  local:"Your progress is saved on this device.",
  offline:"Your progress is saved on this device. Score sharing isn't switched on for this site yet.",
  needname:"Enter your name to share your results with your instructor. Your progress is saved on this device either way.",
  needcode:"Enter the class code from your instructor to share your results.",
  synced:"Your results are shared with your instructor automatically after every answer.",
  saving:"Saving your latest answer for your instructor…",
  badcode:"That class code doesn't match. Check it with your instructor. Your progress is still saved on this device.",
  error:"Your last answer couldn't reach the scoreboard. It's saved on this device and will sync on your next answer."};
function setSync(st){ SB.state=st; var c=$("tSync"); c.setAttribute("data-s", st==="synced"?"synced":(st==="saving"?"saving":(st==="badcode"||st==="error"?"error":"local"))); c.textContent=SYNC_TXT[st]; if($("shareMsg")) $("shareMsg").textContent=SHARE_TXT[st]; }
function uuid(){
  if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
  var b=new Uint8Array(16); crypto.getRandomValues(b); b[6]=(b[6]&15)|64; b[8]=(b[8]&63)|128;
  var h=Array.prototype.map.call(b,function(x){return (x+256).toString(16).slice(1)}).join("");
  return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20);
}
if(!S.sid){ S.sid=uuid(); try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} }
function summaryDoc(){
  var s=stripScore(), m=megaScore(), groups={};
  GROUPS.forEach(function(g){ var t=0,c=0,a=0; P.forEach(function(q){ if(CATS[q.cat].group===g[0]){ t++; var x=S.p[q.n]; if(x!=null){a++; if(x===q.cat)c++;} } }); groups[g[0]]=[c,a,t]; });
  var cases=CASES.map(function(_,ci){ var k=caseScore(ci); return [k.c,k.a,k.t]; });
  return {strips:{c:s.c,a:s.a,n:N}, mega:{c:m.c,a:m.a,n:TOTAL_Q}, overall:pct(s.c+m.c, s.a+m.a), groups:groups, cases:cases, areas:areasDoc(), defib:defibDoc(), code:codeDoc(), p:S.p, m:S.m};
}
function pushNow(){
  if(!SB.online) return;
  if(!S.name){ setSync("needname"); return; }
  if(SB.requireCode && !S.code){ setSync("needcode"); return; }
  var body={name:S.name, cohort:S.cohort||"", code:S.code||"", doc:summaryDoc()}, sig=JSON.stringify(body);
  if(sig===SB.last){ if(SB.state!=="badcode") setSync("synced"); return; }
  if(SB.writing){ SB.again=true; return; }
  SB.writing=true; setSync("saving");
  fetch(API+"/scores/"+S.sid, {method:"PUT", headers:{"content-type":"application/json"}, body:sig, keepalive:true})
    .then(function(r){ if(r.ok){ SB.last=sig; setSync("synced"); } else if(r.status===403){ setSync("badcode"); } else setSync("error"); })
    .catch(function(){ setSync("error"); })
    .then(function(){ SB.writing=false; if(SB.again){ SB.again=false; pushNow(); } });
}
window.__push=function(){ if(!SB.online) return; clearTimeout(SB.timer); SB.timer=setTimeout(function(){ SB.timer=null; pushNow(); }, 700); };
// Send a pending save right away if the student leaves or switches tabs.
function flush(){ if(SB.timer){ clearTimeout(SB.timer); SB.timer=null; pushNow(); } }
window.addEventListener("pagehide", flush);
document.addEventListener("visibilitychange", function(){ if(document.visibilityState==="hidden") flush(); });
function bindSignin(){
if(!$("stuName")) return;
$("stuName").value = S.name || ""; $("cohort").value = S.cohort || ""; $("classCode").value = S.code || "";
$("stuName").addEventListener("change", function(){ S.name=this.value.trim().slice(0,60); save(); if(SB.online) pushNow(); });
$("cohort").addEventListener("change", function(){ S.cohort=this.value.trim().slice(0,40); save(); if(SB.online) pushNow();
  // switches can differ by cohort: refresh what this student can see
  fetch(API+"/config?cohort="+encodeURIComponent(S.cohort||""), {cache:"no-store"}).then(function(r){ return r.ok?r.json():null; }).then(function(cfg){ if(cfg && !SB.admin){ SB.features=cfg.features||{}; AREA_META.forEach(function(x){ if(x.gated){ delete AREAS[x.key]; AREA_LOADING[x.key]=null; } }); renderAreaTiles(); defibNav(); } }, function(){}); });
$("classCode").addEventListener("change", function(){ S.code=this.value.trim().slice(0,60); SB.last=""; save(); if(SB.online) pushNow(); });
if($("codeWrap")) $("codeWrap").hidden=!SB.requireCode;
if($("cohortList") && SB.cohortOpts) $("cohortList").innerHTML=SB.cohortOpts;
}

function initShared(){
  fetch(API+"/config?cohort="+encodeURIComponent(S.cohort||""), {cache:"no-store"}).then(function(r){ return r.ok ? r.json() : null; }).then(function(cfg){
    SB.configDone=true;
    SB.features=(cfg && cfg.features) || {};
    if(cfg && cfg.cohorts) SB.cohortOpts=cfg.cohorts.map(function(c){ return '<option value="'+esc(c)+'">'; }).join("");
    renderAreaTiles(); defibNav(); if(VIEW==="area" || VIEW==="defib" || VIEW==="codelab") rerender();
    if(!cfg || !cfg.scoring){ setSync("offline"); if(VIEW==="survey") renderSurvey(); return; }
    SB.online=true; SB.requireCode=!!cfg.requireCode; if($("codeWrap")) $("codeWrap").hidden=!SB.requireCode; if($("cohortList") && SB.cohortOpts) $("cohortList").innerHTML=SB.cohortOpts;
    pushNow();
    if(VIEW==="survey") renderSurvey();
  }).catch(function(){ SB.configDone=true; setSync("offline"); if(VIEW==="survey") renderSurvey(); });
  try{ SB.pass = sessionStorage.getItem("cl-instructor") || null; }catch(e){}
  if(SB.pass) loadBoard(true);
}

/* ----- instructor scoreboard ----- */
function loginHTML(msg){
  return '<div class="card panel login"><h3>Instructor sign-in</h3><p class="empty">Enter the instructor password set in Netlify (INSTRUCTOR_PASSWORD) to see every student\'s results.</p>'+
    '<form id="sbLogin" class="login-f"><label class="cohort" for="sbPass"><span>Instructor password</span><input id="sbPass" type="password" autocomplete="current-password" required></label><button class="btn btn-primary" type="submit">Sign in</button></form>'+
    (msg?'<p class="login-msg" role="alert">'+esc(msg)+'</p>':'')+'</div>';
}
function loadSettings(){
  return fetch(API+"/settings?cohorts=1", {headers:{authorization:"Bearer "+SB.pass}, cache:"no-store"}).then(function(r){ return r.ok ? r.json() : null; })
    .then(function(j){ if(j && j.settings){ SB.settings=j.settings; SB.cohortSet=j.cohorts||{}; SB.cohortList=j.cohortList||[]; if(j.classCode!==undefined){ SB.classCode=j.classCode; SB.codeSource=j.codeSource; } if(j.me) SB.me=j.me; if(!SB.me || SB.me.role==="owner") SB.features=j.settings; renderSettings(); renderAreaTiles(); defibNav(); } }, function(){});
}
function can(p){ return !!SB.me && (SB.me.role==="owner" || !!(SB.me.perms||{})[p]); }
function isOwner(){ return !!SB.me && SB.me.role==="owner"; }
function renderWho(){
  var el=$("sbWho"); if(!el) return;
  if(!SB.admin || !SB.me){ el.textContent=""; return; }
  el.innerHTML = isOwner() ? 'Signed in as the <b>owner</b> · full access' : 'Signed in as <b>'+esc(SB.me.name||"Instructor")+'</b> · '+(SB.me.cohorts||[]).map(esc).join(", ");
}
var SWITCHES = [
  {key:"twelveLead", eyebrow:"Practice area control", title:"12-lead ECG practice area", icon:function(){ return MINI_ECG; }, preview:"/practice/twelve",
   on:"Students see a 12-lead tile on the Home, Course and Practice pages and can work through all 150 ECGs.", off:"Students can't see or open it. Preview it yourself, then open it when the class is ready."},
  {key:"fieldStrips", eyebrow:"Practice area control", title:"Field strips: real-world artifact", icon:function(){ return MINI_ECG; }, preview:"/practice/field",
   on:"Students see a Field strips tile on the Home, Course and Practice pages and work through 100 strips with ambulance artifact.", off:"Students can't see or open it. Preview it yourself, then open it when the class is ready."},
  {key:"codeLab", eyebrow:"Module control", title:"Code lab: defibrillator and megacode together", icon:function(){ return IC_BOLT; }, preview:"/codelab",
   on:"Students see a Code lab tab and run adaptive ACLS cases on the live defibrillator: single algorithms or full megacodes.", off:"Students can't see or open it. Preview it yourself, then open it when the class is ready."},
  {key:"defibLab", eyebrow:"Module control", title:"Defib lab: monitor, defibrillator and pacer", icon:function(){ return IC_BOLT; }, preview:"/defib",
   on:"Students see a Defib lab tab and run 20 scenarios: defibrillation (adult and pediatric), synchronized cardioversion, stable tachycardias, atropine and pacing, and non-shockable arrests.", off:"Students can't see or open it. Preview it yourself, then turn it on when the class is ready."}
];
var IC_BOLT='<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>';
function renderSettings(msg, which){
  var box=$("sbSettings"); if(!box) return;
  if(!SB.admin || !SB.settings || VIEW!=="scoreboard"){ box.innerHTML=""; return; }
  if(SB.me && !isOwner()){ renderCohortSwitches(box, msg, which); return; }
  box.innerHTML=SWITCHES.map(function(w){
    var on=SB.settings[w.key]===true;
    return '<div class="card sb-switch"><div class="sb-switch-ic">'+w.icon()+'</div><div class="sb-switch-t"><div class="eyebrow">'+w.eyebrow+'</div><h3>'+esc(w.title)+' <span class="pill '+(on?'done':'part')+'">'+(on?'Open to students':'Closed to students')+'</span></h3>'+
      '<p>'+(on?w.on:w.off)+'</p>'+(msg && which===w.key?'<p class="login-msg" role="alert">'+esc(msg)+'</p>':'')+'</div>'+
      '<div class="sb-switch-a"><a class="btn btn-ghost" href="'+w.preview+'">Preview</a><button class="btn '+(on?'btn-ghost':'btn-primary')+'" data-switch="'+w.key+'" id="'+(w.key==="twelveLead"?"sbTwelve":"sb_"+w.key)+'">'+(on?'Close to students':'Open to students')+'</button></div></div>';
  }).join("")+classSetupHTML()+instructorsHTML();
  bindClassSetup(); bindInstructors();
  box.querySelectorAll("[data-switch]").forEach(function(btn){ btn.onclick=function(){
    var k=btn.getAttribute("data-switch"), on=SB.settings[k]===true, body={}; body[k]=!on;
    btn.disabled=true; btn.textContent=on?"Closing…":"Opening…";
    fetch(API+"/settings", {method:"PUT", headers:{"content-type":"application/json", authorization:"Bearer "+SB.pass}, body:JSON.stringify(body)})
      .then(function(r){ return r.json().then(function(j){ return {ok:r.ok, j:j}; }); })
      .then(function(x){ if(x.ok){ SB.settings=x.j.settings; SB.features=x.j.settings; renderSettings(); renderAreaTiles(); defibNav(); } else renderSettings((x.j && x.j.detail) || "That didn't save. Try again.", k); },
            function(){ renderSettings("That didn't save. Check your connection and try again.", k); });
  }; });
}

/* ----- instructor (non-owner) switches: one card per switch they were given, a toggle per cohort ----- */
function renderCohortSwitches(box, msg, which){
  var mine=SWITCHES.filter(function(w){ return can(w.key); }), cs=SB.cohortSet||{};
  box.innerHTML=mine.map(function(w){
    var rows=(SB.me.cohorts||[]).map(function(c){ var on=(cs[c]||{})[w.key]===true;
      return '<div class="sb-co"><span>'+esc(c)+'</span><span class="pill '+(on?'done':'part')+'">'+(on?'Open':'Closed')+'</span><button class="btn '+(on?'btn-ghost':'btn-primary')+'" data-cswitch="'+w.key+'" data-cohort="'+esc(c)+'">'+(on?'Close':'Open')+'</button></div>'; }).join("");
    return '<div class="card sb-switch"><div class="sb-switch-ic">'+w.icon()+'</div><div class="sb-switch-t"><div class="eyebrow">'+w.eyebrow+' · your cohorts</div><h3>'+esc(w.title)+'</h3>'+
      '<div class="sb-cos">'+rows+'</div>'+(msg && which===w.key?'<p class="login-msg" role="alert">'+esc(msg)+'</p>':'')+'</div><div class="sb-switch-a"><a class="btn btn-ghost" href="'+w.preview+'">Preview</a></div></div>';
  }).join("");
  box.querySelectorAll("[data-cswitch]").forEach(function(btn){ btn.onclick=function(){
    var k=btn.getAttribute("data-cswitch"), c=btn.getAttribute("data-cohort"), on=((SB.cohortSet||{})[c]||{})[k]===true, body={cohort:c}; body[k]=!on;
    btn.disabled=true; btn.textContent=on?"Closing…":"Opening…";
    fetch(API+"/settings", {method:"PUT", headers:{"content-type":"application/json", authorization:"Bearer "+SB.pass}, body:JSON.stringify(body)})
      .then(function(r){ return r.json().then(function(j){ return {ok:r.ok, j:j}; }); })
      .then(function(x){ if(x.ok){ SB.cohortSet=x.j.cohorts||{}; renderSettings(); } else renderSettings((x.j && x.j.detail) || "That didn't save. Try again.", k); },
            function(){ renderSettings("That didn't save. Check your connection and try again.", k); });
  }; });
}


/* ----- owner: class code and saved cohorts ----- */
function classSetupHTML(){
  if(!isOwner()) return "";
  var src = SB.codeSource==="scoreboard" ? "Set here" : (SB.codeSource==="netlify" ? "From Netlify (CLASS_CODE)" : "No code: anyone with the link can share scores");
  return '<div class="card panel sb-class" id="sbClass"><div class="sv-board-head"><div><div class="eyebrow">Owner only</div><h3>Class setup</h3></div></div>'+
    '<div class="sb-class-grid"><form id="codeForm"><label class="cohort"><span>Class code students enter</span><input id="codeIn" maxlength="60" autocomplete="off" value="'+esc(SB.classCode||"")+'" placeholder="Leave blank for no code"></label>'+
      '<p class="empty" id="codeNote">'+esc(src)+'. Students type it on the Home page; capitals don\'t matter. Changing it doesn\'t sign anyone out, but new saves need the new code.</p>'+
      '<div class="inst-act"><button class="btn btn-primary" type="submit">Save code</button>'+(SB.classCode?'<button class="btn btn-ghost" type="button" id="codeClear">Remove code</button>':'')+'</div></form>'+
    '<div><span class="sb-class-l">Cohorts</span><div class="sb-chips">'+(SB.cohortList||[]).map(function(c){ return '<button class="sb-chip" data-co-rm="'+esc(c)+'" aria-label="Remove '+esc(c)+' from the list">'+esc(c)+' ✕</button>'; }).join("")+'</div>'+
      '<form class="inst-addco" id="coForm"><input id="coIn" maxlength="40" placeholder="Add a cohort, e.g. PCP Spring 2027"><button class="btn btn-ghost" type="submit">Add</button></form>'+
      '<p class="empty">Saved cohorts appear in every cohort dropdown here and as suggestions when students type their cohort. Removing one from the list doesn\'t change any student\'s results.</p></div></div>'+
    '<p class="login-msg" id="classMsg" role="alert" hidden></p></div>';
}
function ownerPut(path, body){
  return fetch(API+path, {method:"PUT", headers:{"content-type":"application/json", authorization:"Bearer "+SB.pass}, body:JSON.stringify(body)}).then(function(r){ return r.json().then(function(j){ return {ok:r.ok, j:j}; }); });
}
function applyClass(x){ if(!x.ok){ var m=$("classMsg"); if(m){ m.textContent=(x.j && x.j.detail) || "That didn't save. Try again."; m.hidden=false; } return; }
  SB.classCode=x.j.classCode; SB.codeSource=x.j.codeSource; SB.cohortList=x.j.cohortList; renderSettings(); renderBoard(); }
function bindClassSetup(){
  var b;
  if((b=$("codeForm"))) b.onsubmit=function(e){ e.preventDefault(); ownerPut("/class-code", {code:$("codeIn").value}).then(applyClass, function(){ applyClass({ok:false}); }); };
  if((b=$("codeClear"))) b.onclick=function(){ ownerPut("/class-code", {code:""}).then(applyClass, function(){ applyClass({ok:false}); }); };
  if((b=$("coForm"))) b.onsubmit=function(e){ e.preventDefault(); var v=$("coIn").value.trim(); if(!v) return; ownerPut("/cohorts", {add:v}).then(applyClass, function(){ applyClass({ok:false}); }); };
  if((b=$("sbClass"))) b.addEventListener("click", function(e){ var x=e.target.closest("[data-co-rm]"); if(x) ownerPut("/cohorts", {remove:x.getAttribute("data-co-rm")}).then(applyClass); });
}
/* ----- owner: instructor accounts ----- */
var INST_PERMS = [["twelveLead","Open or close the 12-lead area"],["fieldStrips","Open or close the field strips"],["defibLab","Open or close the Defib lab"],["codeLab","Open or close the Code lab"],
  ["print","Print reports"],["csv","Download CSV"],["survey","See course survey results"],["delete","Remove students"]];
function loadInstructors(){
  return fetch(API+"/instructors", {headers:{authorization:"Bearer "+SB.pass}, cache:"no-store"}).then(function(r){ return r.ok ? r.json() : null; })
    .then(function(j){ if(j){ SB.inst=j.instructors||[]; renderSettings(); } }, function(){});
}
function instructorsHTML(){
  if(!isOwner()) return "";
  var list=SB.inst||[], ed=SB.instEdit, h='<div class="card panel sb-inst" id="sbInst"><div class="sv-board-head"><div><div class="eyebrow">Owner only</div><h3>Instructors</h3></div>'+
    (ed?'':'<button class="btn btn-primary" id="instAdd">Add instructor</button>')+'</div>'+
    '<p class="empty">Each instructor signs in on this page with their own password. They see only the cohorts you assign, only their students, and only the tools you tick.</p>';
  if(SB.instPw) h+='<div class="inst-pw" role="alert"><div><b>Password for '+esc(SB.instPw.name)+':</b> <code id="instPwVal">'+esc(SB.instPw.pw)+'</code></div><p>Copy it now and give it to them: it won\'t be shown again. You can reset it later.</p><div class="inst-pw-a"><button class="btn btn-ghost" id="instCopy">Copy</button><button class="btn btn-ghost" id="instPwDone">Done</button></div></div>';
  if(ed) h+=instEditorHTML(ed);
  h+= list.length ? '<div class="inst-list">'+list.map(function(i){
      var perms=INST_PERMS.filter(function(p){ return i.perms[p[0]]; }).map(function(p){ return '<span>'+esc(p[1].replace(/^Open or close the /,""))+'</span>'; }).join("") || '<span class="none">View scores only</span>';
      return '<div class="inst-row"><div class="inst-who"><b>'+esc(i.name)+'</b><small>'+i.cohorts.map(esc).join(", ")+' · '+(i.lastSeen?'last signed in '+ago(i.lastSeen):'not signed in yet')+'</small><div class="inst-perms">'+perms+'</div></div>'+
        '<div class="inst-act"><button class="btn btn-ghost" data-iedit="'+esc(i.id)+'">Edit</button><button class="btn btn-ghost" data-ireset="'+esc(i.id)+'">New password</button>'+
        (SB.instDel===i.id?'<button class="btn btn-primary" data-idelyes="'+esc(i.id)+'">Remove '+esc(i.name)+'?</button><button class="btn btn-ghost" data-idelno="1">Cancel</button>':'<button class="btn btn-ghost" data-idel="'+esc(i.id)+'">Remove</button>')+'</div></div>'; }).join("")+'</div>'
    : (ed ? '' : '<p class="empty">No instructors yet.</p>');
  return h+'</div>';
}
function instEditorHTML(ed){
  var i=ed.id ? (SB.inst||[]).filter(function(x){ return x.id===ed.id; })[0] : {name:"", cohorts:[], perms:{}};
  var known=Object.keys(cohortsOf()); (i.cohorts||[]).forEach(function(c){ if(known.indexOf(c)<0) known.push(c); }); (ed.extra||[]).forEach(function(c){ if(known.indexOf(c)<0) known.push(c); }); known.sort();
  var sel=ed.cohorts || i.cohorts || [], perms=ed.perms || i.perms || {};
  return '<form class="inst-ed" id="instForm"><h4>'+(ed.id?'Edit '+esc(i.name):'New instructor')+'</h4>'+
    '<label class="cohort"><span>Name</span><input id="instName" maxlength="60" required value="'+esc(ed.name!=null?ed.name:i.name)+'" placeholder="e.g. Dana Lee"></label>'+
    '<fieldset><legend>Cohorts they can see</legend><div class="inst-chks">'+(known.length?known.map(function(c){ return '<label><input type="checkbox" name="instCo" value="'+esc(c)+'"'+(sel.indexOf(c)>=0?' checked':'')+'><span>'+esc(c)+'</span></label>'; }).join(""):'<p class="empty">No cohorts yet: add one below.</p>')+'</div>'+
      '<div class="inst-addco"><input id="instNewCo" maxlength="40" placeholder="Add a cohort name (as students type it)"><button class="btn btn-ghost" type="button" id="instAddCo">Add</button></div></fieldset>'+
    '<fieldset><legend>What they can do</legend><div class="inst-chks">'+INST_PERMS.map(function(p){ return '<label><input type="checkbox" name="instPerm" value="'+p[0]+'"'+(perms[p[0]]?' checked':'')+'><span>'+esc(p[1])+'</span></label>'; }).join("")+'</div>'+
      '<p class="empty">Everyone can view their students\' scores and charts. Switches they open or close apply only to their cohorts.</p></fieldset>'+
    '<p class="login-msg" id="instMsg" role="alert"'+(ed.msg?'':' hidden')+'>'+esc(ed.msg||"")+'</p>'+
    '<div class="inst-act"><button class="btn btn-primary" type="submit">'+(ed.id?'Save changes':'Create and show password')+'</button><button class="btn btn-ghost" type="button" id="instCancel">Cancel</button></div></form>';
}
function instFormState(){
  var f=$("instForm"); if(!f) return {};
  var co=[].slice.call(f.querySelectorAll("input[name=instCo]:checked")).map(function(x){ return x.value; });
  var pm={}; [].slice.call(f.querySelectorAll("input[name=instPerm]:checked")).forEach(function(x){ pm[x.value]=true; });
  return {name:$("instName").value, cohorts:co, perms:pm};
}
function instCall(method, path, body){
  return fetch(API+"/instructors"+(path||""), {method:method, headers:{"content-type":"application/json", authorization:"Bearer "+SB.pass}, body:body?JSON.stringify(body):undefined})
    .then(function(r){ return r.json().then(function(j){ return {ok:r.ok, j:j}; }, function(){ return {ok:false, j:{}}; }); });
}
function bindInstructors(){
  var box=$("sbInst"); if(!box) return;
  var b;
  if((b=$("instAdd"))) b.onclick=function(){ SB.instEdit={}; SB.instPw=null; renderSettings(); $("instName").focus(); };
  if((b=$("instCancel"))) b.onclick=function(){ SB.instEdit=null; renderSettings(); };
  if((b=$("instPwDone"))) b.onclick=function(){ SB.instPw=null; renderSettings(); };
  if((b=$("instCopy"))) b.onclick=function(){ var v=$("instPwVal").textContent; try{ navigator.clipboard.writeText(v); b.textContent="Copied"; }catch(e){} };
  if((b=$("instAddCo"))) b.onclick=function(){ var v=$("instNewCo").value.trim().slice(0,40); if(!v) return; ownerPut("/cohorts", {add:v}).then(function(x){ if(x.ok){ SB.cohortList=x.j.cohortList; renderBoard(); } }); var st=instFormState(); st.cohorts.push(v); SB.instEdit=Object.assign(SB.instEdit, st, {extra:(SB.instEdit.extra||[]).concat([v])}); renderSettings(); };
  if((b=$("instForm"))) b.onsubmit=function(e){ e.preventDefault(); var st=instFormState(), ed=SB.instEdit;
    if(!st.name.trim() || !st.cohorts.length){ SB.instEdit=Object.assign(ed, st, {msg:"Give them a name and at least one cohort."}); renderSettings(); return; }
    instCall(ed.id?"PUT":"POST", ed.id?"/"+ed.id:"", st).then(function(x){
      if(!x.ok){ SB.instEdit=Object.assign(ed, st, {msg:(x.j && (x.j.detail||x.j.error)) || "That didn't save."}); renderSettings(); return; }
      if(x.j.password) SB.instPw={name:x.j.instructor.name, pw:x.j.password};
      SB.instEdit=null; loadInstructors(); }); };
  box.onclick=function(e){ var t=e.target, id;
    if((id=t.getAttribute("data-iedit"))){ SB.instEdit={id:id}; SB.instPw=null; renderSettings(); return; }
    if((id=t.getAttribute("data-ireset"))){ instCall("PUT", "/"+id, {resetPassword:true}).then(function(x){ if(x.ok){ SB.instPw={name:x.j.instructor.name, pw:x.j.password}; loadInstructors(); } }); return; }
    if((id=t.getAttribute("data-idel"))){ SB.instDel=id; renderSettings(); return; }
    if(t.getAttribute("data-idelno")){ SB.instDel=null; renderSettings(); return; }
    if((id=t.getAttribute("data-idelyes"))){ instCall("DELETE", "/"+id).then(function(){ SB.instDel=null; loadInstructors(); }); return; }
  };
}
function showLogin(msg){
  ["sbCsv","sbRefresh","sbOut"].forEach(function(i){ $(i).hidden=true; });
  if($("sbSettings")) $("sbSettings").innerHTML="";
  if($("sbPick")) $("sbPick").innerHTML="";
  $("sbBody").innerHTML=loginHTML(msg);
  $("sbLogin").addEventListener("submit", function(e){ e.preventDefault(); SB.pass=$("sbPass").value; loadBoard(false); });
  setTimeout(function(){ var p=$("sbPass"); if(p) p.focus(); }, 30);
}
function showProblem(title, detail){
  ["sbCsv"].forEach(function(i){ $(i).hidden=true; });
  $("sbBody").innerHTML='<div class="card panel problem"><h3>'+esc(title)+'</h3><p>'+esc(detail)+'</p>'+
    '<div class="qnav" style="justify-content:flex-start"><button class="btn btn-primary" id="sbRetry">Retry</button><a class="btn btn-ghost" href="/api/health" target="_blank" rel="noopener">Open setup check</a></div>'+
    '<p class="empty">The setup check (/api/health) tests the database connection and says what to change in Netlify.</p></div>';
  $("sbRetry").onclick=function(){ $("sbBody").innerHTML='<div class="card panel"><p class="empty">Loading results…</p></div>'; loadBoard(false); };
}
function loadBoard(silent){
  if(!SB.pass) return;
  fetch(API+"/scores", {headers:{authorization:"Bearer "+SB.pass}, cache:"no-store"}).then(function(r){
    if(r.status===401){ SB.pass=null; SB.admin=false; try{ sessionStorage.removeItem("cl-instructor"); }catch(e){} $("tabBoard").textContent="Instructor sign-in"; if(!silent || VIEW==="scoreboard") showLogin("That password didn't work. Try again."); return null; }
    var isJson=(r.headers.get("content-type")||"").indexOf("application/json")>=0;
    if(r.status===404 || !isJson){
      if(VIEW==="scoreboard" && !(silent && SB.rows)) showProblem("The score API isn't running on this site", "The page loaded, but /api/scores wasn't found (HTTP "+r.status+"). In Netlify, open Logs → Functions and check that a function named \"api\" is listed. If it isn't, open the latest deploy log, fix any build error, and trigger a new deploy. If you opened this page from a file or a different host, open it from your Netlify address instead.");
      return null;
    }
    if(!r.ok){
      return r.json().then(function(j){
        if(VIEW==="scoreboard" && !(silent && SB.rows)) showProblem(r.status===503?"The scoreboard isn't set up yet":"The scoreboard can't reach the database", (j && j.detail) || ("The server returned an error (HTTP "+r.status+")."));
        return null;
      });
    }
    return r.json();
  }).then(function(data){
    if(!data) return;
    SB.admin=true; SB.rows=data.rows||[]; SB.me=data.me||{role:"owner", perms:{}}; $("tabBoard").textContent="Scoreboard"; defibNav();
    if(SB.me.role==="owner" && !SB.inst) loadInstructors();
    renderWho();
    if(!SB.settings) loadSettings();
    renderAreaTiles();
    if((VIEW==="area" && VIEW_AREA==="twelve") && !AREAS.twelve){ AREA_LOADING.twelve=null; rerender(); }
    if(!SV.def) loadSurveyDef().then(function(){ renderBoard(); }, function(){});
    try{ sessionStorage.setItem("cl-instructor", SB.pass); }catch(e){}
    $("sbRefresh").hidden=false; $("sbOut").hidden=false;
    if(VIEW==="scoreboard"){ renderBoard(); startPoll(); }
  }).catch(function(){
    if(VIEW==="scoreboard" && !SB.rows) showProblem("Couldn't reach the server", "Your browser couldn't connect to this site's score API. Check your internet connection and press Retry. If you opened this page from a saved file, open it from your Netlify address instead.");
  });
}
function openBoard(){ if(SB.admin){ renderSettings(); renderBoard(); loadBoard(true); startPoll(); } else if(SB.pass){ $("sbBody").innerHTML='<div class="card panel"><p class="empty">Loading results…</p></div>'; loadBoard(false); } else showLogin(""); }
function startPoll(){ if(SB.poll) return; SB.poll=setInterval(function(){ if(VIEW==="scoreboard" && !document.hidden) loadBoard(true); }, 30000); }
function stopPoll(){ if(SB.poll){ clearInterval(SB.poll); SB.poll=null; } }
function num(x){ return typeof x==="number" && isFinite(x) ? x : 0; }
function boardRows(){
  var rows=(SB.rows||[]).slice(), co=$("sbCohort").value, sort=$("sbSort").value;
  if(co) rows=rows.filter(function(r){return (r.cohort||"")===co});
  rows.forEach(function(r){ r._name=r.name||"Unnamed student"; r._prog=num(r.strips&&r.strips.a)+num(r.mega&&r.mega.a); });
  rows.sort(function(a,b){
    if(sort==="score") return rowOverall(b)-rowOverall(a);
    if(sort==="name") return a._name.localeCompare(b._name);
    if(sort==="progress") return b._prog-a._prog;
    return num(b.updatedAt)-num(a.updatedAt);
  });
  return rows;
}
function ago(ts){ if(!ts) return "—"; var m=Math.round((Date.now()-ts)/60000); if(m<1) return "just now"; if(m<60) return m+" min ago"; var h=Math.round(m/60); if(h<24) return h+" h ago"; return Math.round(h/24)+" d ago"; }
function rowOverall(r){ var s=r.strips||{}, m=r.mega||{}; return pct(num(s.c)+num(m.c), num(s.a)+num(m.a)); }
function rowAnswered(r){ return num(r.strips&&r.strips.a)+num(r.mega&&r.mega.a); }
function mini(c,t){ var p=pct(c,t); return '<div class="mini"><span class="track"><i style="width:'+p+'%"></i></span><b>'+p+'%</b></div>'; }
function renderBoard(){
  if(VIEW!=="scoreboard" || !SB.admin) return;
  var all=SB.rows||[];
  var cohorts=cohortsOf();
  var sel=$("sbCohort"), cur=sel.value;
  sel.innerHTML='<option value="">All</option>'+Object.keys(cohorts).sort().map(function(c){return '<option'+(c===cur?' selected':'')+'>'+esc(c)+'</option>'}).join("");
  renderPicker();
  var rows=selectedRows();
  $("sbCsv").hidden = !rows.length || !can("csv");
  if(!(SB.rows||[]).length){
    $("sbBody").innerHTML='<div class="card panel"><h3>No results yet</h3><p class="empty">Send your students this site\'s link'+'. When they enter their name on the Home page'+', their scores appear here as they answer. The page refreshes every 30 seconds.</p></div>';
    return;
  }
  if(!rows.length){
    $("sbBody").innerHTML='<div class="card panel sb-empty-sel"><h3>No students selected</h3><p class="empty">Tick the students you want to see in the list above, or press <b>Select all</b>. The stats, charts and table below cover only the students you select. Printing a single student or a cohort works without selecting anyone.</p></div>';
    return;
  }
  var n=rows.length, avgOf=function(list, f){ return list.length ? Math.round(list.reduce(function(a,r){ return a+f(r); },0)/list.length) : null; };
  var withAny=rows.filter(function(r){ return rowAnswered(r)>0; }), withS=rows.filter(function(r){ return num(r.strips&&r.strips.a)>0; }), withM=rows.filter(function(r){ return num(r.mega&&r.mega.a)>0; });
  var avg=avgOf(withAny, rowOverall), sAvg=avgOf(withS, function(r){ return pct(num(r.strips.c), num(r.strips.a)); }), mAvg=avgOf(withM, function(r){ return pct(num(r.mega.c), num(r.mega.a)); });
  var done=rows.filter(function(r){ return num(r.strips&&r.strips.a)>=N && num(r.mega&&r.mega.a)>=TOTAL_Q; }).length;
  var h='<div class="stats">'+
    '<div class="card stat"><small>Students</small><b class="num">'+n+'</b><span>selected</span></div>'+
    '<div class="card stat"><small>Average score</small><b class="num">'+(avg==null?'—':avg+'%')+'</b><span>correct of answered</span></div>'+
    '<div class="card stat"><small>Strips</small><b class="num">'+(sAvg==null?'—':sAvg+'%')+'</b><span>class average, of answered</span></div>'+
    '<div class="card stat"><small>Megacode</small><b class="num">'+(mAvg==null?'—':mAvg+'%')+'</b><span>class average, of answered</span></div>'+
    '<div class="card stat"><small>Finished</small><b class="num">'+done+'</b><span>completed both modules</span></div></div>';
  h+=newModulesStatsHTML(rows);
  h+=chartsHTML(rows);
  var body=rows.map(function(r){
    var s=r.strips||{}, m=r.mega||{}, open=SB.open===r.id;
    var weak="—", wv=101; GROUPS.forEach(function(g){ var x=(r.groups||{})[g[0]]; if(x && x[1]>=3){ var p=pct(x[0],x[1]); if(p<wv){wv=p; weak=g[1]+" ("+p+"%)";} } });
    var tr='<tr class="row'+(open?' open':'')+'" data-id="'+esc(r.id)+'" tabindex="0" aria-expanded="'+open+'"><td><div class="who"><div><b>'+esc(r._name)+'</b>'+(r.cohort?'<small>'+esc(r.cohort)+'</small>':'')+'</div>'+
      (!can("print")?'':'<button class="btn btn-ghost sb-pr1" data-print="'+esc(r.id)+'" title="Print '+esc(r._name)+'\'s report" aria-label="Print '+esc(r._name)+'\'s report">'+IC_PRINT+'<span>Print</span></button>')+'</div></td>'+
      '<td class="mono">'+num(s.c)+' / '+num(s.a)+'<br><small style="color:var(--muted)">of '+N+' answered</small></td>'+
      '<td class="mono">'+num(m.c)+' / '+num(m.a)+'<br><small style="color:var(--muted)">of '+TOTAL_Q+' answered</small></td>'+
      '<td>'+(rowAnswered(r)?mini(num(s.c)+num(m.c), rowAnswered(r)):'—')+'</td><td>'+esc(weak)+'</td>'+(r.survey?'<td class="sv-cell"><span class="sv-done">✓ Done</span></td>':'<td class="sv-cell">—</td>')+'<td class="mono">'+practiceCell(r)+'</td><td class="mono">'+defibCell(r)+'</td><td class="mono">'+ago(r.updatedAt)+'</td></tr>';
    if(open) tr+='<tr class="detail"><td colspan="9">'+detailHTML(r)+'</td></tr>';
    return tr;
  }).join("");
  h+='<div class="sb-grid"><div class="card panel"><h3>Students <span class="num">'+n+'</span></h3><div class="tablewrap"><table class="sbt"><thead><tr>'+SORT_COLS.map(sortTh).join('')+'</tr></thead><tbody id="sbRows">'+body+'</tbody></table></div><p class="empty">Scores are correct out of answered, so unanswered items don\'t lower them. Select a student for detail.</p></div>'+
     '<div class="card panel"><h3>Most-missed strips</h3><div class="hard" id="sbHard">'+hardHTML(rows)+'</div></div></div>'+areasPanelHTML(rows)+defibPanelHTML(rows)+(can("survey")?surveyPanelHTML(rows):'');
  $("sbBody").innerHTML=h;
}

var IC_PRINT='<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 7.5V3h9v4.5M5.5 14.5H4a1.5 1.5 0 0 1-1.5-1.5V9A1.5 1.5 0 0 1 4 7.5h12A1.5 1.5 0 0 1 17.5 9v4a1.5 1.5 0 0 1-1.5 1.5h-1.5"/><path d="M5.5 11.5h9V17h-9z"/></svg>';
/* ================= SCOREBOARD: choose students, charts of strong / weak areas, printable reports ================= */
SB.sel = {};
try{ (JSON.parse(localStorage.getItem("cl-sb-sel")||"[]")||[]).forEach(function(id){ SB.sel[id]=1; }); }catch(e){}
function saveSel(){ try{ localStorage.setItem("cl-sb-sel", JSON.stringify(Object.keys(SB.sel))); }catch(e){} }
/* ----- click a column heading to sort the student table (click again to reverse) ----- */
function weakOf(r){ var wv=101, label=""; GROUPS.forEach(function(g){ var x=(r.groups||{})[g[0]]; if(x && x[1]>=3){ var p=pct(x[0],x[1]); if(p<wv){ wv=p; label=g[1]; } } }); return {p:wv<101?wv:null, label:label}; }
var pctOr=function(c,a){ return a ? c/a : null; };
var SORT_COLS = [
  ["name","Student", function(r){ return (r.name||"").toLowerCase(); }, 1],
  ["strips","Strips", function(r){ return pctOr(num(r.strips&&r.strips.c), num(r.strips&&r.strips.a)); }, -1],
  ["mega","Megacode", function(r){ return pctOr(num(r.mega&&r.mega.c), num(r.mega&&r.mega.a)); }, -1],
  ["overall","Overall", function(r){ return rowAnswered(r) ? rowOverall(r) : null; }, -1],
  ["weak","Weakest family", function(r){ return weakOf(r).p; }, 1],
  ["survey","Survey", function(r){ return r.survey ? 1 : 0; }, -1],
  ["practice","Practice areas", function(r){ var t=areaTotals(r); return pctOr(t[0], t[1]); }, -1],
  ["defib","Defib lab", function(r){ var d=defibCounts(r); return d[1] ? d[0] + d[0]/100 : null; }, -1],
  ["recent","Last active", function(r){ return num(r.updatedAt); }, -1]
];
SB.tsort=null;
function sortTh(c){
  var on=SB.tsort && SB.tsort.key===c[0], dir=on ? SB.tsort.dir : 0;
  return '<th aria-sort="'+(on?(dir>0?'ascending':'descending'):'none')+'"><button class="th-sort'+(on?' on':'')+'" data-tsort="'+c[0]+'">'+esc(c[1])+'<span aria-hidden="true">'+(on?(dir>0?'▲':'▼'):'↕')+'</span></button></th>';
}
function sortRows(list){
  var sort=$("sbSort").value;
  list.forEach(function(r){ r._name=r.name||"Unnamed student"; r._prog=num(r.strips&&r.strips.a)+num(r.mega&&r.mega.a); });
  if(SB.tsort){ var col=SORT_COLS.filter(function(c){ return c[0]===SB.tsort.key; })[0], d=SB.tsort.dir;
    if(col) return list.sort(function(a,b){ var x=col[2](a), y=col[2](b);
      if(x==null && y==null) return a._name.localeCompare(b._name); if(x==null) return 1; if(y==null) return -1;   // blanks always last
      var c = typeof x==="string" ? x.localeCompare(y) : x-y; return c*d || a._name.localeCompare(b._name); }); }
  return list.sort(function(a,b){
    if(sort==="score") return rowOverall(b)-rowOverall(a);
    if(sort==="name") return a._name.localeCompare(b._name);
    if(sort==="progress") return b._prog-a._prog;
    return num(b.updatedAt)-num(a.updatedAt);
  });
}
function selectedRows(){ return sortRows((SB.rows||[]).filter(function(r){ return SB.sel[r.id]; })); }
function byName(a,b){ return (a.name||"").localeCompare(b.name||""); }
function cohortsOf(){ var c={}, key={}, nk=function(x){ return String(x||"").trim().toLowerCase(); };
  (SB.cohortList||[]).forEach(function(x){ if(SB.me && !isOwner() && !(SB.me.cohorts||[]).some(function(y){ return nk(y)===nk(x); })) return; key[nk(x)]=x; c[x]=0; });
  (SB.rows||[]).forEach(function(r){ if(!r.cohort) return; var name=key[nk(r.cohort)]||r.cohort; key[nk(r.cohort)]=name; c[name]=(c[name]||0)+1; }); return c; }
function renderPicker(){
  var box=$("sbPick"); if(!box) return;
  if(!SB.admin || !(SB.rows||[]).length){ box.innerHTML=""; return; }
  if(!$("sbPickCard")){
    box.innerHTML='<div class="sb-top">'+
      '<div class="card panel sb-pick" id="sbPickCard"><div class="sb-pick-head"><div><div class="eyebrow">Choose who to view</div><h3>Students <span class="num" id="sbSelCount"></span></h3></div>'+
        '</div>'+
        '<div class="sb-dd"><input type="search" id="sbSearch" placeholder="Search students by name or cohort" aria-label="Search students" autocomplete="off">'+
          '<button class="btn btn-ghost sb-dd-btn" id="sbDrop" aria-expanded="false" aria-controls="sbDropPanel"><span id="sbDropTxt">Choose students</span><span aria-hidden="true">▾</span></button>'+
          '<div class="sb-dd-panel" id="sbDropPanel" hidden><div class="sb-dd-tools"><button class="btn btn-ghost" id="sbSelAll">Select all</button><button class="btn btn-ghost" id="sbSelNone">Clear</button><button class="btn btn-primary" id="sbDropDone">Done</button></div>'+
          '<p class="sb-pick-note" id="sbPickNote"></p><div class="sb-pick-list" id="sbPickList" role="group" aria-label="Students to show"></div></div></div>'+
        '<div class="sb-chips" id="sbChips"></div></div>'+
      '<div class="card panel sb-print" id="sbPrintCard"><div class="eyebrow">Paper copies</div><h3>Print reports</h3>'+
        '<div class="pr-kind" role="radiogroup" aria-label="Report"><label><input type="radio" name="prKind" value="scores" checked><span>Scores report</span></label><label><input type="radio" name="prKind" value="survey"><span>Course survey report</span></label></div>'+
        '<fieldset class="pr-modes"><legend class="sr-only">Who to include</legend>'+
          '<label class="pr-opt"><input type="radio" name="prMode" value="one" checked><span>One student</span></label><select id="prOne" aria-label="Student to print"></select>'+
          '<label class="pr-opt"><input type="radio" name="prMode" value="sel"><span>Selected students <b class="num" id="prSelN"></b></span></label>'+
          '<label class="pr-opt"><input type="radio" name="prMode" value="cohort"><span>Cohort</span></label><select id="prCohort" aria-label="Cohort to print"></select>'+
          '<label class="pr-opt"><input type="radio" name="prMode" value="all"><span>Everyone</span></label></fieldset>'+
        '<label class="pr-chk" id="prSumWrap"><input type="checkbox" id="prSummary" checked><span>Add a class summary page with charts (for a group or cohort)</span></label>'+
        '<p class="pr-kind-note" id="prKindNote" hidden>The survey report summarizes everyone included: ratings, Net Promoter Score, confidence, every answer breakdown, willingness to pay and all comments. Anonymous answers stay anonymous.</p>'+
        '<p class="login-msg" id="prMsg" role="alert" hidden></p><button class="btn btn-primary" id="prGo">Print</button>'+
        '<p class="empty">Each student prints on their own page. Use your browser\'s print dialog to choose a printer or Save as PDF.</p></div></div>';
    $("sbPickList").addEventListener("change", function(e){ var c=e.target.closest("input[data-sel]"); if(!c) return; var id=c.getAttribute("data-sel"); if(c.checked) SB.sel[id]=1; else delete SB.sel[id]; saveSel(); renderBoard(); });
    var openDD=function(v){ $("sbDropPanel").hidden=!v; $("sbDrop").setAttribute("aria-expanded", v?"true":"false"); };
    $("sbSearch").addEventListener("input", function(){ openDD(true); renderPickList(); });
    $("sbSearch").addEventListener("focus", function(){ openDD(true); });
    $("sbDrop").onclick=function(){ openDD($("sbDropPanel").hidden); };
    $("sbDropDone").onclick=function(){ openDD(false); $("sbDrop").focus(); };
    document.addEventListener("click", function(e){ var dd=document.querySelector(".sb-dd"); if(dd && !dd.contains(e.target) && !e.target.closest("[data-unsel]")) openDD(false); });
    $("sbPickCard").addEventListener("keydown", function(e){ if(e.key==="Escape" && !$("sbDropPanel").hidden){ openDD(false); $("sbDrop").focus(); } });
    $("sbChips").addEventListener("click", function(e){ var x=e.target.closest("[data-unsel]"); if(!x) return; delete SB.sel[x.getAttribute("data-unsel")]; saveSel(); renderBoard(); });
    $("sbSelAll").onclick=function(){ pickVisible().forEach(function(r){ SB.sel[r.id]=1; }); saveSel(); renderBoard(); };
    $("sbSelNone").onclick=function(){ SB.sel={}; saveSel(); renderBoard(); };
    $("prGo").onclick=printReports;
    box.addEventListener("change", function(e){ if(e.target.name==="prKind"){ var sv=e.target.value==="survey"; $("prSumWrap").hidden=sv; $("prKindNote").hidden=!sv; } });
    box.addEventListener("change", function(e){ if(e.target.id==="prOne") document.querySelector('input[name=prMode][value=one]').checked=true; if(e.target.id==="prCohort") document.querySelector('input[name=prMode][value=cohort]').checked=true; });
  }
  var evl=document.querySelector('input[name=prMode][value=all]'); if(evl) evl.nextElementSibling.textContent = isOwner() ? "Everyone" : "All my students";
  var pc=$("sbPrintCard"); pc.hidden=!can("print"); pc.parentNode.classList.toggle("solo", !can("print"));
  var svk=document.querySelector('input[name=prKind][value=survey]'); if(svk){ svk.parentNode.hidden=!can("survey"); if(!can("survey")) document.querySelector('input[name=prKind][value=scores]').checked=true; }
  renderPickList();
  var one=$("prOne"), keep=one.value, list=(SB.rows||[]).slice().sort(byName);
  one.innerHTML=list.map(function(r){ return '<option value="'+esc(r.id)+'"'+(r.id===keep?' selected':'')+'>'+esc(r.name||"Unnamed student")+(r.cohort?' · '+esc(r.cohort):'')+'</option>'; }).join("");
  var co=$("prCohort"), keepC=co.value, cs=cohortsOf(), names=Object.keys(cs).sort();
  co.innerHTML=names.length ? names.map(function(c){ return '<option'+(c===keepC?' selected':'')+' value="'+esc(c)+'">'+esc(c)+' ('+cs[c]+')</option>'; }).join("") : '<option value="">No cohorts yet</option>';
  co.disabled=!names.length;
}
function pickVisible(){
  var q=($("sbSearch")||{value:""}).value.trim().toLowerCase(), co=$("sbCohort").value;
  return (SB.rows||[]).filter(function(r){ return (!co || (r.cohort||"")===co) && (!q || ((r.name||"")+" "+(r.cohort||"")).toLowerCase().indexOf(q)>=0); }).sort(byName);
}
function renderPickList(){
  var vis=pickVisible(), all=SB.rows||[], nSel=all.filter(function(r){ return SB.sel[r.id]; }).length;
  $("sbSelCount").textContent=nSel+" of "+all.length+" selected";
  $("sbDropTxt").textContent = nSel ? (nSel===all.length ? "All "+all.length+" students" : nSel+" selected") : "Choose students";
  var chosen=all.filter(function(r){ return SB.sel[r.id]; }).sort(byName);
  $("sbChips").innerHTML = chosen.length && chosen.length<all.length ? chosen.slice(0,30).map(function(r){ return '<button class="sb-chip" data-unsel="'+esc(r.id)+'" aria-label="Remove '+esc(r.name||"student")+'">'+esc(r.name||"Unnamed student")+' ✕</button>'; }).join("")+(chosen.length>30?'<span class="sb-chip more">+'+(chosen.length-30)+' more</span>':'') : '';
  $("prSelN").textContent="("+nSel+")";
  var co=$("sbCohort").value, q=$("sbSearch").value.trim();
  $("sbPickNote").textContent = (co||q) ? "Showing "+vis.length+" of "+all.length+(co?" in "+co:"")+(q?' matching "'+q+'"':"")+". Select all picks just these." : "Select all picks everyone in the list. Narrow the list with the Cohort filter or the search box.";
  $("sbPickList").innerHTML = vis.length ? vis.map(function(r){ var on=!!SB.sel[r.id], sc=rowAnswered(r)?rowOverall(r)+'%':'—';
    return '<label class="sb-pick-item'+(on?' on':'')+'"><input type="checkbox" data-sel="'+esc(r.id)+'"'+(on?' checked':'')+'><b class="pi-n">'+esc(r.name||"Unnamed student")+'</b><span class="pi-c">'+esc(r.cohort||"—")+'</span><span class="pi-s num">'+sc+'</span></label>'; }).join("")
    : '<p class="empty">No students match.</p>';
  if(vis.length) $("sbPickList").insertAdjacentHTML("afterbegin", '<div class="sb-pick-hd" aria-hidden="true"><span></span><span>Student</span><span>Cohort</span><span>Score</span></div>');
}

/* ----- bar charts: one series, one color, sorted, value on every bar, counts on hover ----- */
function hbarHTML(title, sub, items, opts){
  sub = sub + " · gridlines every 25%";
  opts=opts||{};
  var list=items.filter(function(x){ return x.a>0; }).map(function(x){ x.p=pct(x.c,x.a); return x; });
  if(opts.asc) list.sort(function(a,b){ return a.p-b.p || b.a-a.a; }); else list.sort(function(a,b){ return b.p-a.p || b.a-a.a; });
  if(opts.limit) list=list.slice(0, opts.limit);
  var body;
  if(!list.length) body='<p class="empty">No answers yet from the selected students.</p>';
  else {
    var hi=Math.max.apply(null, list.map(function(x){ return x.p; })), lo=Math.min.apply(null, list.map(function(x){ return x.p; }));
    body='<div class="hb" role="list">'+list.map(function(x){
      var tag = opts.tags && list.length>1 && hi!==lo ? (x.p===hi?'<em class="hb-tag good">Strongest</em>':(x.p===lo?'<em class="hb-tag weak">Needs work</em>':'')) : '';
      var tip=x.label+': '+x.p+'% '+(opts.verb||'correct')+' · '+x.c+' of '+x.a+' '+(opts.noun||'answered')+(x.extra?' · '+x.extra:'');
      return '<div class="hb-row" role="listitem" tabindex="0" data-tip="'+esc(tip)+'" aria-label="'+esc(tip)+'"><span class="hb-l">'+esc(x.label)+tag+'</span>'+
        '<span class="hb-t"><i style="width:'+Math.max(x.p,1)+'%"></i></span><b class="hb-v num">'+x.p+'%</b></div>'; }).join("")+'</div>'+
      '';
  }
  return '<div class="card panel hb-card"><h4>'+esc(title)+'</h4><p class="hb-sub">'+esc(sub)+'</p>'+body+'</div>';
}
function chartData(rows){
  var fam=GROUPS.map(function(g){ var c=0,a=0; rows.forEach(function(r){ var v=(r.groups||{})[g[0]]; if(v){ c+=v[0]; a+=v[1]; } }); return {label:g[1], c:c, a:a}; });
  var areas=AREA_META.map(function(m){ var c=0,a=0,k=0; rows.forEach(function(r){ var v=(r.areas||{})[m.key]; if(v && v[1]){ c+=v[0]; a+=v[1]; k++; } }); return {label:m.short, c:c, a:a, extra:k+' student'+(k===1?'':'s')}; });
  var cats={}; rows.forEach(function(r){ var p=r.p||{}; Object.keys(p).forEach(function(n){ var q=P[n-1]; if(!q) return; var x=cats[q.cat]=cats[q.cat]||{label:q.cat, c:0, a:0}; x.a++; if(canon(p[n])===q.cat) x.c++; }); });
  var cases=CASES.map(function(cs,ci){ var c=0,a=0; rows.forEach(function(r){ var k=(r.cases||[])[ci]; if(k){ c+=k[0]; a+=k[1]; } }); return {label:'Case '+cs.n+' · '+cs.title, c:c, a:a}; });
  var defib=DEFIB_LIST.map(function(x){ var p=0,t=0; rows.forEach(function(r){ var v=(r.defib||{})[x[0]]; if(v){ t++; if(v[2]===1) p++; } }); return {label:x[1], c:p, a:t}; });
  var vc=0, va=0, vk=0; rows.forEach(function(r){ var v=(r.areas||{}).vessel; if(v && v[1]){ vc+=v[0]; va+=v[1]; vk++; } });
  if(va) areas.push({label:"STEMI culprit vessel", c:vc, a:va, extra:vk+' student'+(vk===1?'':'s')});
  var code=CODE_LIST.map(function(x){ var p=0,t=0; rows.forEach(function(r){ var v=(r.code||{})[x[0]]; if(v){ t++; if(v[2]===1) p++; } }); return {label:x[1], c:p, a:t}; });
  return {code:code, fam:fam, areas:areas, cats:Object.keys(cats).map(function(k){ return cats[k]; }).filter(function(x){ return x.a>=3; }), cases:cases, defib:defib};
}
function chartsHTML(rows){
  var d=chartData(rows);
  return '<section class="sb-charts" aria-labelledby="sbChartsT"><div class="sv-board-head"><div><div class="eyebrow">Selected students</div><h3 id="sbChartsT">Strengths and weak areas</h3></div></div><div class="hb-grid">'+
    hbarHTML("Strips by rhythm family", "Class accuracy on answered strips, strongest first", d.fam, {tags:true})+
    hbarHTML("Practice areas", "Accuracy on answered practice strips and 12-leads", d.areas, {tags:true})+
    hbarHTML("Most-missed rhythm types", "Lowest accuracy first (rhythms answered 3 or more times)", d.cats, {asc:true, limit:10})+
    hbarHTML("Hardest megacode cases", "Lowest share of correct decisions first", d.cases, {asc:true, limit:10, noun:'decisions'})+
    hbarHTML("Defib lab scenarios", "Pass rate among students who ran each scenario, lowest first", d.defib, {asc:true, limit:10, verb:'passed', noun:'students who tried'})+
    hbarHTML("Code lab cases", "Pass rate among students who ran each case, lowest first", d.code, {asc:true, limit:12, verb:'passed', noun:'students who tried'})+
  '</div></section>';
}
(function(){
  var tip=document.createElement("div"); tip.className="hb-tip"; tip.setAttribute("role","tooltip"); tip.hidden=true; document.body.appendChild(tip);
  var show=function(row, x, y){ tip.textContent=row.getAttribute("data-tip"); tip.hidden=false;
    var w=tip.offsetWidth, h=tip.offsetHeight; tip.style.left=Math.min(window.innerWidth-w-8, Math.max(8, x+14))+"px"; tip.style.top=Math.max(8, y-h-12)+"px"; };
  document.addEventListener("mousemove", function(e){ var row=e.target.closest && e.target.closest(".hb-row"); if(row) show(row, e.clientX, e.clientY); else tip.hidden=true; });
  document.addEventListener("focusin", function(e){ var row=e.target.closest && e.target.closest(".hb-row"); if(row){ var r=row.getBoundingClientRect(); show(row, r.left+r.width*0.4, r.top); } else tip.hidden=true; });
  document.addEventListener("scroll", function(){ tip.hidden=true; }, true);
})();

/* ----- printable reports ----- */
function printReports(){
  var mode=(document.querySelector("input[name=prMode]:checked")||{}).value, rows=[], title="", msg=$("prMsg");
  if(mode==="one"){ var id=$("prOne").value; rows=(SB.rows||[]).filter(function(r){ return r.id===id; }); title=rows[0] ? (rows[0].name||"Unnamed student") : ""; }
  else if(mode==="sel"){ rows=(SB.rows||[]).filter(function(r){ return SB.sel[r.id]; }).sort(byName); title="Selected students"; }
  else if(mode==="all"){ rows=(SB.rows||[]).slice().sort(byName); title="All students"; }
  else { var c=$("prCohort").value; rows=(SB.rows||[]).filter(function(r){ return c && (r.cohort||"")===c; }).sort(byName); title="Cohort: "+c; }
  if(!rows.length){ msg.textContent = mode==="sel" ? "No students are selected yet. Tick some in the list first." : "There's no one to print for that choice."; msg.hidden=false; return; }
  msg.hidden=true;
  rows.forEach(function(r){ r._name=r.name||"Unnamed student"; });
  if((document.querySelector("input[name=prKind]:checked")||{}).value==="survey"){ printSurvey(rows, title, mode==="one"); return; }
  printScores(rows, title, rows.length>1 && $("prSummary").checked);
}
function printScores(rows, title, withSummary){
  rows.forEach(function(r){ r._name=r.name||"Unnamed student"; });
  var area=$("printArea"); if(!area){ area=document.createElement("div"); area.id="printArea"; document.body.appendChild(area); }
  var when=new Date().toLocaleDateString(undefined, {year:"numeric", month:"long", day:"numeric"});
  var h='';
  if(withSummary) h+=printSummaryHTML(rows, title, when);
  h+=rows.map(function(r){ return printStudentHTML(r, when); }).join("");
  area.innerHTML=h;
  window.print();
}
function prHead(title, sub, when){
  return '<header class="pr-head"><div><b class="pr-brand">CSHealthED</b><span>ECG &amp; Megacode Lab</span></div><div class="pr-when">Printed '+esc(when)+'</div></header><h1>'+esc(title)+'</h1>'+(sub?'<p class="pr-sub">'+esc(sub)+'</p>':'');
}
function prStat(label, val, sub){ return '<div class="pr-stat"><small>'+esc(label)+'</small><b>'+val+'</b>'+(sub?'<span>'+esc(sub)+'</span>':'')+'</div>'; }

/* ----- course survey report (separate from the scores report) ----- */
function printSurvey(rows, title, single){
  loadSurveyDef().then(function(){
    var area=$("printArea"); if(!area){ area=document.createElement("div"); area.id="printArea"; document.body.appendChild(area); }
    var when=new Date().toLocaleDateString(undefined, {year:"numeric", month:"long", day:"numeric"});
    area.innerHTML = single ? surveyStudentPage(rows[0], when) : surveyGroupPage(rows, title, when);
    window.print();
  }, function(){ var m=$("prMsg"); if(m){ m.textContent="The survey questions didn't load. Check your connection and try again."; m.hidden=false; } });
}
function surveyGroupPage(rows, title, when){
  var resp=rows.filter(function(r){ return r.survey && r.survey.answers; });
  var panel=surveyPanelHTML(rows).replace(/<button class="btn btn-ghost" id="svCsv">[^<]*<\/button>/, "").replace(/<button class="btn btn-ghost" id="svPrint">[^<]*<\/button>/, "");
  var list=resp.slice().sort(function(a,b){ return num(b.surveyAt)-num(a.surveyAt); }).map(function(r){ var a=r.survey.answers;
    return '<tr><td>'+(r.surveyAnonymous?'Anonymous':esc(r.name||"Unnamed student"))+'</td><td>'+esc(r.cohort||"")+'</td><td>'+(r.surveyAt?new Date(r.surveyAt).toLocaleDateString():'—')+'</td><td>'+(a.overall!=null?a.overall+' / 5':'—')+'</td><td>'+(a.recommend!=null?a.recommend+' / 10':'—')+'</td></tr>'; }).join("");
  return '<section class="pr-page pr-survey">'+prHead(title+' · course survey', rows.length+' student'+(rows.length===1?'':'s')+' included · '+resp.length+' response'+(resp.length===1?'':'s'), when)+panel+
    (resp.length?'<h4>Responses</h4><table class="pr-table"><thead><tr><th>Student</th><th>Cohort</th><th>Submitted</th><th>Overall</th><th>Would recommend</th></tr></thead><tbody>'+list+'</tbody></table>':'')+'</section>';
}
function surveyStudentPage(r, when){
  var body;
  if(!r.survey || !r.survey.answers) body='<p>'+esc(r.name||"This student")+' hasn\'t submitted the course survey'+(rowEligible(r)?' yet (it\'s unlocked).':'. It opens at '+SURVEY_UNLOCK_PCT+'% of the course.')+'</p>';
  else if(r.surveyAnonymous) body='<p>'+esc(r.name||"This student")+' submitted the survey on '+new Date(r.surveyAt).toLocaleDateString()+' and chose to share the answers anonymously, so they aren\'t printed under their name. They appear, without a name, in the group survey report.</p>';
  else body=surveyDetailHTML(r).replace(/<h4[^>]*>[^<]*<\/h4>/, '<h4>Submitted '+new Date(r.surveyAt).toLocaleDateString()+'</h4>');
  return '<section class="pr-page pr-survey">'+prHead((r.name||"Unnamed student")+' · course survey', r.cohort?'Cohort: '+r.cohort:'', when)+body+'</section>';
}
function printSummaryHTML(rows, title, when){
  var avg=function(list, f){ return list.length ? Math.round(list.reduce(function(a,r){ return a+f(r); },0)/list.length)+'%' : '—'; };
  var any=rows.filter(function(r){ return rowAnswered(r)>0; }), sR=rows.filter(function(r){ return num(r.strips&&r.strips.a)>0; }), mR=rows.filter(function(r){ return num(r.mega&&r.mega.a)>0; });
  var done=rows.filter(function(r){ return num(r.strips&&r.strips.a)>=N && num(r.mega&&r.mega.a)>=TOTAL_Q; }).length;
  return '<section class="pr-page">'+prHead(title+' · class summary', rows.length+' students', when)+
    '<div class="pr-stats">'+prStat("Average score", avg(any, rowOverall), "correct of answered")+prStat("Strips", avg(sR, function(r){ return pct(r.strips.c, r.strips.a); }), "class average")+
      prStat("Megacode", avg(mR, function(r){ return pct(r.mega.c, r.mega.a); }), "class average")+prStat("Finished", done+' of '+rows.length, "both modules")+'</div>'+
    chartsHTML(rows)+
    '<table class="pr-table"><thead><tr><th>Student</th><th>Cohort</th><th>Strips</th><th>Megacode</th><th>Score</th><th>Practice</th><th>Defib</th><th>Survey</th></tr></thead><tbody>'+
    rows.map(function(r){ var s=r.strips||{}, m=r.mega||{}, t=areaTotals(r), d=defibCounts(r);
      return '<tr><td>'+esc(r._name)+'</td><td>'+esc(r.cohort||'')+'</td><td>'+num(s.c)+'/'+num(s.a)+'</td><td>'+num(m.c)+'/'+num(m.a)+'</td><td>'+(rowAnswered(r)?rowOverall(r)+'%':'—')+'</td><td>'+(t[1]?pct(t[0],t[1])+'% of '+t[1]:'—')+'</td><td>'+(d[1]?d[0]+'/'+d[1]+' passed':'—')+'</td><td>'+(r.survey?'Done':'—')+'</td></tr>'; }).join("")+
    '</tbody></table></section>';
}
function printStudentHTML(r, when){
  var s=r.strips||{}, m=r.mega||{}, t=areaTotals(r), d=defibCounts(r);
  var fam=GROUPS.map(function(g){ var v=(r.groups||{})[g[0]]||[0,0,0]; return {label:g[1], c:v[0], a:v[1]}; });
  var ar=AREA_META.map(function(x){ var v=(r.areas||{})[x.key]||[0,0,0]; return {label:x.short, c:v[0], a:v[1]}; });
  if((r.areas||{}).vessel) ar.push({label:"STEMI vessel", c:r.areas.vessel[0], a:r.areas.vessel[1]});
  var missed=P.filter(function(q){ var x=canon((r.p||{})[q.n]); return x!=null && x!==q.cat; });
  var cases=CASES.map(function(cs,ci){ var k=(r.cases||[])[ci]; return k&&k[1] ? '<li>Case '+cs.n+' · '+esc(cs.title)+': <b>'+k[0]+'/'+k[1]+'</b></li>' : ''; }).join("");
  var df=DEFIB_LIST.filter(function(x){ return (r.defib||{})[x[0]]; }).map(function(x){ var v=r.defib[x[0]]; return '<li>'+(v[2]?'✓ ':'✗ ')+esc(x[1])+' · '+v[0]+'/'+v[1]+' steps</li>'; }).join("");
  return '<section class="pr-page">'+prHead(r._name, (r.cohort?'Cohort: '+r.cohort+' · ':'')+'Last active '+(r.updatedAt?new Date(r.updatedAt).toLocaleDateString():'—'), when)+
    '<div class="pr-stats">'+prStat("Score", rowAnswered(r)?rowOverall(r)+'%':'—', "correct of answered")+prStat("Strips", num(s.c)+'/'+num(s.a), "of "+N+" answered")+
      prStat("Megacode", num(m.c)+'/'+num(m.a), "of "+TOTAL_Q+" decisions")+prStat("Practice areas", t[1]?pct(t[0],t[1])+'%':'—', t[1]?t[0]+' of '+t[1]+' correct':'not started')+
      prStat("Defib lab", d[1]?d[0]+'/'+d[1]:'—', d[1]?'scenarios passed':'not started')+prStat("Survey", r.survey?'Done':'—', "")+'</div>'+
    '<div class="pr-cols">'+hbarHTML("Strips by rhythm family", "Correct of answered", fam, {tags:true})+hbarHTML("Practice areas", "Correct of answered", ar, {tags:true})+'</div>'+
    '<div class="pr-cols"><div><h4>Missed strips ('+missed.length+')</h4>'+(missed.length?'<ul class="pr-list">'+missed.map(function(q){ return '<li>#'+q.n+' '+esc(q.name)+'</li>'; }).join("")+'</ul>':'<p>None missed.</p>')+'</div>'+
      '<div><h4>Megacode cases</h4>'+(cases?'<ul class="pr-list">'+cases+'</ul>':'<p>No cases started.</p>')+'<h4>Defib lab</h4>'+(df?'<ul class="pr-list">'+df+'</ul>':'<p>No scenarios run.</p>')+'</div></div>'+
    '</section>';
}
function detailHTML(r){
  var g=GROUPS.map(function(x){ var v=(r.groups||{})[x[0]]||[0,0,0]; return '<div class="barrow"><span>'+esc(x[1])+'</span><span class="track"><i style="width:'+pct(v[0],v[1])+'%"></i></span><b>'+(v[1]?v[0]+'/'+v[1]:'—')+'</b></div>'; }).join("");
  var missed=P.filter(function(q){ var x=canon((r.p||{})[q.n]); return x!=null && x!==q.cat; });
  var ml=missed.length? missed.slice(0,40).map(function(q){ return '<span>#'+q.n+' '+esc(q.name)+'</span>'; }).join("")+(missed.length>40?'<span>+'+(missed.length-40)+' more</span>':'') : '<span>None missed</span>';
  var cs=(r.cases||[]).map(function(k,ci){ return k&&k[1]? '<span>Case '+(ci+1)+': '+k[0]+'/'+k[1]+'</span>' : ''; }).join("") || '<span>No cases started</span>';
  var del = SB.confirmDel===r.id
    ? '<div class="confirm"><span>Remove '+esc(r._name)+'\'s results permanently?</span><button class="btn btn-primary" data-del-yes="'+esc(r.id)+'">Remove</button><button class="btn btn-ghost" data-del-no="1">Cancel</button></div>'
    : '<button class="btn btn-ghost" data-del="'+esc(r.id)+'">Remove this student</button>';
  if(!can("delete")) del='';
  del = (can("print") ? '<button class="btn btn-ghost" data-print="'+esc(r.id)+'">'+IC_PRINT+' Print report</button> '+(can("survey")?'<button class="btn btn-ghost" data-print-sv="'+esc(r.id)+'">'+IC_PRINT+' Print survey answers</button> ':'') : '')+del;
  var ap=AREA_META.map(function(x){ var v=(r.areas||{})[x.key]||[0,0,x.size||AREA_SIZE]; return '<div class="barrow"><span>'+esc(x.short)+'</span><span class="track"><i style="width:'+pct(v[0],v[1])+'%;background:'+x.color+'"></i></span><b>'+(v[1]?v[0]+'/'+v[1]:'—')+'</b></div>'; }).join("");
  var vv=(r.areas||{}).vessel; if(vv && vv[1]) ap+='<div class="barrow"><span>STEMI vessel</span><span class="track"><i style="width:'+pct(vv[0],vv[1])+'%;background:'+MKC.ste+'"></i></span><b>'+vv[0]+'/'+vv[1]+'</b></div>';
  return '<div class="inner"><div><h4>Strips by rhythm family · correct / answered</h4><div class="bars">'+g+'</div><h4 style="margin-top:14px">Practice areas · correct / answered</h4><div class="bars">'+ap+'</div><div style="margin-top:14px">'+del+'</div></div><div><h4>Missed strips ('+missed.length+')</h4><div class="tags">'+ml+'</div><h4 style="margin-top:14px">Megacode cases</h4><div class="tags">'+cs+'</div>'+defibDetailHTML(r)+codeDetailHTML(r)+(can("survey")?surveyDetailHTML(r):'')+'</div></div>';
}
function hardHTML(rows){
  var stat={}; rows.forEach(function(r){ var p=r.p||{}; Object.keys(p).forEach(function(n){ var q=P[n-1]; if(!q) return; p[n]=canon(p[n]); stat[n]=stat[n]||[0,0]; stat[n][1]++; if(p[n]!==q.cat) stat[n][0]++; }); });
  var list=Object.keys(stat).filter(function(n){return stat[n][0]>0}).sort(function(a,b){ return (stat[b][0]/stat[b][1])-(stat[a][0]/stat[a][1]) || stat[b][0]-stat[a][0]; }).slice(0,12);
  if(!list.length) return '<p class="empty">No missed strips yet.</p>';
  return list.map(function(n){ var q=P[n-1], s=stat[n]; return '<button data-n="'+n+'"><b>#'+n+'</b><span>'+esc(q.name)+'</span><em>'+s[0]+'/'+s[1]+'</em></button>'; }).join("");
}
function bindBoard(){
$("sbBody").addEventListener("click", function(e){
  var t=e.target;
  var ts=t.closest("[data-tsort]"); if(ts){ var k=ts.getAttribute("data-tsort"), def=SORT_COLS.filter(function(c){ return c[0]===k; })[0][3];
    SB.tsort = SB.tsort && SB.tsort.key===k ? {key:k, dir:-SB.tsort.dir} : {key:k, dir:def}; renderBoard();
    var again=document.querySelector('[data-tsort="'+k+'"]'); if(again) again.focus(); return; }
  var pb=t.closest("[data-print]"); if(pb){ e.stopPropagation(); var pr=(SB.rows||[]).filter(function(x){ return x.id===pb.getAttribute("data-print"); }); if(pr.length) printScores(pr, pr[0].name||"Unnamed student", false); return; }
  var ps=t.closest("[data-print-sv]"); if(ps){ var sr1=(SB.rows||[]).filter(function(x){ return x.id===ps.getAttribute("data-print-sv"); }); if(sr1.length) printSurvey(sr1, sr1[0].name||"Unnamed student", true); return; }
  if(t.closest("#svPrint")){ var sr=selectedRows(); sr.forEach(function(r){ r._name=r.name||"Unnamed student"; }); printSurvey(sr, "Selected students", false); return; }
  if(t.closest("#svCsv")){ downloadCsv(surveyCsv(selectedRows()), "cardiac-lab-survey-"+new Date().toISOString().slice(0,10)+".csv"); return; }
  if(t.closest(".sv-board")) return;
  var hb=t.closest(".hard button"); if(hb){ S.pi=+hb.getAttribute("data-n"); save(); nav("/strips"); return; }
  var d=t.closest("[data-del]"); if(d){ SB.confirmDel=d.getAttribute("data-del"); renderBoard(); return; }
  if(t.closest("[data-del-no]")){ SB.confirmDel=null; renderBoard(); return; }
  var y=t.closest("[data-del-yes]"); if(y){ var id=y.getAttribute("data-del-yes");
    fetch(API+"/scores/"+id, {method:"DELETE", headers:{authorization:"Bearer "+SB.pass}}).then(function(r){ if(r.ok){ SB.rows=SB.rows.filter(function(x){return x.id!==id}); SB.open=null; } SB.confirmDel=null; renderBoard(); });
    return; }
  if(t.closest(".detail")) return;
  var tr=t.closest("tr.row"); if(tr){ var id2=tr.getAttribute("data-id"); SB.open = SB.open===id2 ? null : id2; SB.confirmDel=null; renderBoard(); }
});
$("sbBody").addEventListener("keydown", function(e){ if((e.key==="Enter"||e.key===" ") && e.target.matches("tr.row")){ e.preventDefault(); e.target.click(); } });
$("sbCohort").addEventListener("change", renderBoard);
$("sbSort").addEventListener("change", function(){ SB.tsort=null; renderBoard(); });
$("sbRefresh").addEventListener("click", function(){ loadBoard(true); });
$("sbOut").addEventListener("click", function(){ SB.pass=null; SB.admin=false; SB.rows=null; SB.settings=null; SB.me=null; SB.inst=null; SB.instPw=null; SB.instEdit=null; SB.cohortSet=null; renderWho(); AREA_META.forEach(function(x){ if(x.gated){ delete AREAS[x.key]; AREA_LOADING[x.key]=null; } }); renderAreaTiles(); defibNav(); stopPoll(); try{ sessionStorage.removeItem("cl-instructor"); }catch(e){} $("tabBoard").textContent="Instructor sign-in"; showLogin(""); });
$("sbCsv").addEventListener("click", function(){
  var rows=selectedRows();
  var head=["Student","Cohort","Strips correct","Strips answered","Strips total","Megacode correct","Megacode answered","Megacode total","Score % (correct of answered)"].concat(GROUPS.map(function(g){return g[1]+" %"})).concat(AREA_META.map(function(x){ return x.short+" practice answered"; })).concat(AREA_META.map(function(x){ return x.short+" practice %"; })).concat(["Defib scenarios passed","Defib scenarios attempted","Code lab cases passed","Code lab cases attempted"]).concat(DEFIB_LIST.map(function(x){ return "Defib: "+x[1]; })).concat(["Survey submitted","Last active"]);
  var lines=[head].concat(rows.map(function(r){ var s=r.strips||{}, m=r.mega||{};
    return [r._name, r.cohort||"", num(s.c), num(s.a), N, num(m.c), num(m.a), TOTAL_Q, rowAnswered(r)?rowOverall(r):""].concat(GROUPS.map(function(g){ var v=(r.groups||{})[g[0]]; return v&&v[1]?pct(v[0],v[1]):""; })).concat(AREA_META.map(function(x){ var v=(r.areas||{})[x.key]; return v?v[1]:0; })).concat(AREA_META.map(function(x){ var v=(r.areas||{})[x.key]; return v&&v[1]?pct(v[0],v[1]):""; })).concat(defibCounts(r)).concat(codeCounts(r)).concat(DEFIB_LIST.map(function(x){ var v=(r.defib||{})[x[0]]; return v ? (v[2]?"Passed ":"Review ")+v[0]+"/"+v[1] : ""; })).concat([r.surveyAt? new Date(r.surveyAt).toISOString():"", r.updatedAt? new Date(r.updatedAt).toISOString():""]); }));
  downloadCsv(lines, "cardiac-lab-scores-"+new Date().toISOString().slice(0,10)+".csv");
});
}
function downloadCsv(lines, filename){
  var csv=lines.map(function(l){ return l.map(function(c){ c=String(c); if(/^[=+\-@]/.test(c)) c="'"+c; return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c; }).join(","); }).join("\n");
  var url=URL.createObjectURL(new Blob(["\ufeff"+csv], {type:"text/csv;charset=utf-8"}));
  var a=document.createElement("a"); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
}

/* ================= DEFIB LAB (public/defib.js, loaded on demand) ================= */
var DEFIB_LIST = [["vf","VF"],["pvt","Pulseless VT"],["tdp","Torsades"],["fvf","Fine VF"],["refvf","Refractory VF"],["pvf","Pediatric VF"],["syncvf","VF left in SYNC"],["ptdp","Torsades with a pulse"],["uvt","Unstable VT"],["svt","Unstable SVT"],["af","Unstable AF"],["afl","Unstable flutter"],["stvt","Stable VT"],["ssvt","Stable SVT"],["sb","Sinus brady: atropine"],["sbf","Brady: atropine fails"],["chb","Complete heart block"],["b21","2:1 block"],["asy","Asystole"],["pea","PEA"]];
var DEFIB_LOADING = null;
function defibOpen(){ return (SB.features||{}).defibLab===true; }
function defibNav(){
  $("tabCode").hidden = !(codeOpen() || SB.admin);
  var show = defibOpen() || SB.admin;
  $("tabDefib").hidden = !show;
  var h=$("homeDefib"); if(!h) return;
  h.innerHTML=""; if(typeof renderAreaTiles==="function") renderAreaTiles(); return;
  var c=defibCounts({defib:defibDoc()});
  h.innerHTML='<a class="card df-home" href="/defib"><span class="df-home-ic">'+IC_BOLT+'</span><span class="df-home-t"><span class="eyebrow">'+(defibOpen()?'New module':'Closed to students · instructor preview')+'</span><b>Defib lab: monitor, defibrillator and pacer</b>'+
    '<span>Run a real-time monitor with sound. Select energy, charge, shock, synchronize, pace and give drugs through '+DEFIB_LIST.length+' scenarios, then get step-by-step feedback.</span></span><span class="df-home-n num">'+c[0]+'/'+DEFIB_LIST.length+'<small>passed</small></span></a>';
}
function defibDoc(){ var out={}, d=S.df||{}; Object.keys(d).forEach(function(k){ var r=d[k]; if(r && r.score) out[k]=[r.score[0], r.score[1], r.ok?1:0]; }); return out; }
function defibCounts(r){ var d=r.defib||{}, p=0, a=0; Object.keys(d).forEach(function(k){ a++; if(d[k][2]===1) p++; }); return [p, a]; }
function renderDefib(){
  var root=$("dfRoot");
  if(!defibOpen() && !SB.admin){
    if(!SB.configDone){ root.innerHTML='<div class="card panel"><p class="empty">Loading…</p></div>'; return; }
    root.innerHTML='<div class="card panel area-locked" style="--ac:var(--band-red)"><span class="sv-ic">'+IC_LOCK+'</span><h3>The Defib lab isn\'t open yet</h3><p class="empty">Your instructor will turn on the monitor, defibrillator and pacer scenarios when the class is ready.</p><a class="btn btn-primary" href="/">Back to Home</a></div>';
    return;
  }
  var go=function(){ if(VIEW!=="defib") return; DefibLab.render(root, {
    esc:esc,
    load:function(id){ return (S.df||{})[id]||null; },
    save:function(id, r){ S.df=S.df||{}; var old=S.df[id], keep=old && old.ok && !r.ok;  // a later failed retry doesn't erase a pass
      S.df[id]={ok:keep?true:!!r.ok, score:keep?old.score:r.score, last:r.score, lastOk:!!r.ok, at:r.at, tries:((old&&old.tries)||0)+1}; save(); defibNav(); }
  }); if(!defibOpen()) root.insertAdjacentHTML("afterbegin", '<p class="df-preview">Instructor preview: students can\'t see the Defib lab until you open it on the scoreboard.</p>'); };
  if(window.DefibLab){ go(); return; }
  root.innerHTML='<div class="card panel"><p class="empty">Loading the Defib lab…</p></div>';
  if(!DEFIB_LOADING) DEFIB_LOADING=new Promise(function(res, rej){ import("../sim/defib.js").then(function(){ res(); }, function(){ DEFIB_LOADING=null; rej(); }); });
  DEFIB_LOADING.then(go, function(){ root.innerHTML='<div class="card panel problem"><h3>The Defib lab didn\'t load</h3><p>Check your connection and reload the page.</p></div>'; });
}
function areaTotals(r){ var c=0,a=0; Object.keys(r.areas||{}).forEach(function(k){ if(k==="vessel") return; var v=r.areas[k]; if(v){ c+=v[0]; a+=v[1]; } }); return [c,a]; }
function practiceCell(r){ var t=areaTotals(r); return t[1] ? t[0]+' / '+t[1]+'<br><small style="color:var(--muted)">'+pct(t[0],t[1])+'% correct</small>' : '—'; }
function defibCell(r){ var c=defibCounts(r); return c[1] ? c[0]+' / '+c[1]+'<br><small style="color:var(--muted)">passed of '+DEFIB_LIST.length+'</small>' : '—'; }
function newModulesStatsHTML(rows){
  var prac=rows.filter(function(r){ return areaTotals(r)[1]>0; }), pc=0, pa=0; prac.forEach(function(r){ var t=areaTotals(r); pc+=t[0]; pa+=t[1]; });
  var tw=rows.filter(function(r){ var v=(r.areas||{}).twelve; return v && v[1]>0; }), tc=0, ta=0; tw.forEach(function(r){ tc+=r.areas.twelve[0]; ta+=r.areas.twelve[1]; });
  var df=rows.filter(function(r){ return defibCounts(r)[1]>0; }), dp=0, da=0; df.forEach(function(r){ var c=defibCounts(r); dp+=c[0]; da+=c[1]; });
  var sv=rows.filter(function(r){ return r.survey; }).length, el=rows.filter(rowEligible).length;
  return '<div class="stats stats-4">'+
    '<div class="card stat"><small>Practice areas</small><b class="num">'+(pa?pct(pc,pa)+'%':'—')+'</b><span>'+prac.length+' student'+(prac.length===1?'':'s')+' · '+pa+' strips answered</span></div>'+
    '<div class="card stat"><small>12-lead ECGs</small><b class="num">'+(ta?pct(tc,ta)+'%':'—')+'</b><span>'+tw.length+' student'+(tw.length===1?'':'s')+' · '+ta+' ECGs answered</span></div>'+
    '<div class="card stat"><small>Defib lab</small><b class="num">'+(da?pct(dp,da)+'%':'—')+'</b><span>'+df.length+' student'+(df.length===1?'':'s')+' · '+dp+' of '+da+' runs passed</span></div>'+
    '<div class="card stat"><small>Course survey</small><b class="num">'+sv+'</b><span>of '+el+' eligible submitted</span></div></div>';
}
function defibPanelHTML(rows){
  var cells=DEFIB_LIST.map(function(x){
    var tried=rows.filter(function(r){ return r.defib && r.defib[x[0]]; }), pass=tried.filter(function(r){ return r.defib[x[0]][2]===1; }).length;
    return '<div class="ar-cell" style="--ac:var(--band-red);--ai:var(--brand-red)"><b>'+esc(x[1])+'</b><span class="ar-big num">'+(tried.length?pct(pass,tried.length)+'%':'—')+'</span><span>passed of students who tried</span><span class="progress"><i style="width:'+pct(tried.length,rows.length||1)+'%"></i></span><small class="num">'+tried.length+' tried · '+pass+' passed</small></div>';
  }).join("");
  return '<div class="card panel ar-board"><div class="sv-board-head"><div><div class="eyebrow">Monitor · defibrillator · pacer</div><h3>Defib lab</h3></div></div><div class="ar-board-grid df-board">'+cells+'</div></div>';
}
function codeDetailHTML(r){
  var d=r.code||{}; if(!Object.keys(d).length) return '';
  return '<h4 style="margin-top:14px">Code lab</h4><div class="tags">'+CODE_LIST.filter(function(x){ return d[x[0]]; }).map(function(x){ var v=d[x[0]]; return '<span>'+(v[2]?'✓ ':'✗ ')+esc(x[1])+' '+Math.round(100*v[0]/v[1])+'%'+(v[3]!=null&&LVL_N[v[3]]?' · '+LVL_N[v[3]]:'')+'</span>'; }).join("")+'</div>';
}
function defibDetailHTML(r){
  var d=r.defib||{}; if(!Object.keys(d).length) return '';
  return '<h4 style="margin-top:14px">Defib lab</h4><div class="tags">'+DEFIB_LIST.filter(function(x){ return d[x[0]]; }).map(function(x){ var v=d[x[0]]; return '<span>'+(v[2]?'✓ ':'✗ ')+esc(x[1])+' '+v[0]+'/'+v[1]+'</span>'; }).join("")+'</div>';
}


/* ================= CODE LAB (public/codelab.js + the defib device; instructor switch codeLab) ================= */
var CODE_LIST = [["vf1","VF: collapse at the gym"],["pvt1","Pulseless VT"],["asy1","Asystole"],["pea1","PEA: hyperkalemia"],["brady1","Bradycardia: pacing"],["svt1","SVT"],
  ["vt1","VT with a pulse"],["af1","Unstable AF"],["post1","Post-arrest care"],["mega1","Megacode: chest pain to VF"],["mega2","Megacode: slow, then pulseless"],["mega3","Megacode: racing heart to flat line"]];
var CODE_LOADING = null;
function codeOpen(){ return (SB.features||{}).codeLab===true; }
var LVL_I={beg:0,int:1,pro:2}, LVL_N=["Beginner","Intermediate","“I Got This”"];
function codeDoc(){ var out={}, d=S.cl||{}; Object.keys(d).forEach(function(k){ var r=d[k]; if(r && r.m2) out[k]=[Math.min(r.p2, r.m2), r.m2, r.ok?1:0].concat(LVL_I[r.lvl]!=null?[LVL_I[r.lvl]]:[]); }); return out; }
function codeCounts(r){ var d=r.code||{}, p=0, a=0; Object.keys(d).forEach(function(k){ a++; if(d[k][2]===1) p++; }); return [p, a]; }
function loadScript(src){ return new Promise(function(res, rej){ var sc=document.createElement("script"); sc.src=src; sc.onload=res; sc.onerror=rej; document.head.appendChild(sc); }); }
function renderCodeLab(){
  var root=$("clRoot");
  if(!codeOpen() && !SB.admin){
    if(!SB.configDone){ root.innerHTML='<div class="card panel"><p class="empty">Loading…</p></div>'; return; }
    root.innerHTML='<div class="card panel area-locked" style="--ac:var(--band-red)"><span class="sv-ic">'+IC_LOCK+'</span><h3>The Code lab isn\'t open yet</h3><p class="empty">Your instructor will open it when the class is ready.</p><a class="btn btn-primary" href="/">Back to Home</a></div>';
    return;
  }
  var go=function(){ if(VIEW!=="codelab") return; CodeLab.render(root, {
    esc:esc,
    load:function(id){ return (S.cl||{})[id]||null; },
    save:function(id, r){ S.cl=S.cl||{}; var old=S.cl[id], keep=old && old.ok && !r.ok;   // a later failed run doesn't erase a pass
      S.cl[id]= keep ? Object.assign({}, old, {tries:(old.tries||0)+1, last:r.pct}) : Object.assign({}, r, {tries:((old&&old.tries)||0)+1}); save(); renderAreaTiles(); }
  }); if(!codeOpen()) root.insertAdjacentHTML("afterbegin", '<p class="df-preview">Instructor preview: students can\'t see the Code lab until you open it on the scoreboard.</p>'); };
  if(window.CodeLab && window.DefibLab){ go(); return; }
  root.innerHTML='<div class="card panel"><p class="empty">Loading the Code lab…</p></div>';
  if(!CODE_LOADING) CODE_LOADING=(window.DefibLab ? Promise.resolve() : (DEFIB_LOADING || import("../sim/defib.js"))).then(function(){ return window.CodeLab ? null : import("../sim/codelab.js"); });
  CODE_LOADING.then(go, function(){ CODE_LOADING=null; root.innerHTML='<div class="card panel problem"><h3>The Code lab didn\'t load</h3><p>Check your connection and reload the page.</p></div>'; });
}
function codeTileHTML(){
  if(!(codeOpen() || SB.admin)) return "";
  var c=codeCounts({code:codeDoc()}), n=CODE_LIST.length;
  return '<a class="area-tile wide" href="/codelab" style="--ac:linear-gradient(120deg,var(--band-navy),var(--band-red) 60%,var(--band-orange));--as:var(--red-soft);--ai:var(--brand-red)">'+
    '<span class="area-band"><span class="area-ecg">'+MINI_ECG+'</span><span class="area-count num">'+n+' cases · '+(codeOpen()?'New':'closed to students · preview')+'</span></span>'+
    '<span class="area-body"><b>Code lab: run a real code</b><span class="area-blurb">The live defibrillator and ACLS decisions together. Practice one algorithm or a full megacode from pre-arrest to post-arrest care, with coaching when a choice isn\'t the best one.</span>'+
    '<span class="progress"><i style="width:'+pct(c[1],n)+'%"></i></span>'+
    '<span class="area-foot"><span class="num">'+(c[1]? c[1]+' of '+n+' run · '+c[0]+' passed' : 'Not started')+'</span><span class="area-go">'+(c[1]?'Resume':'Start')+' →</span></span></span></a>';
}
/* ================= PRACTICE AREAS (50 strips per rhythm family) ================= */
var AREA_META = [
  {key:"sinus", title:"Sinus rhythms", short:"Sinus", color:"var(--band-green)", soft:"var(--green-soft)", ink:"var(--green)", blurb:"Normal sinus, bradycardia, tachycardia, sinus arrhythmia, sinus arrest and SA exit block."},
  {key:"atrial", title:"Atrial rhythms", short:"Atrial", color:"var(--band-blue)", soft:"var(--blue-soft)", ink:"var(--blue)", blurb:"PACs, wandering atrial pacemaker, MAT, SVT, atrial flutter and atrial fibrillation."},
  {key:"junctional", title:"Junctional rhythms", short:"Junctional", color:"var(--band-teal)", soft:"var(--teal-soft)", ink:"var(--teal)", blurb:"Junctional, junctional bradycardia, accelerated junctional, junctional tachycardia, PJCs and escape beats."},
  {key:"ventricular", title:"Ventricular rhythms", short:"Ventricular", color:"var(--band-red)", soft:"var(--red-soft)", ink:"var(--brand-red)", blurb:"PVC patterns, runs of VT, idioventricular and AIVR, VT, torsades, VF, asystole and agonal rhythm."},
  {key:"block", title:"AV blocks", short:"AV blocks", color:"var(--band-orange)", soft:"var(--orange-soft)", ink:"var(--orange)", blurb:"1st degree, Wenckebach, Mobitz II, 2:1, high-grade and complete heart block."},
  {key:"paced", title:"Paced rhythms", short:"Paced", color:"var(--band-navy)", soft:"var(--navy-soft)", ink:"var(--navy)", blurb:"Atrial, ventricular and dual-chamber pacing, demand pacing, pacer malfunction and transcutaneous pacing."},
  {key:"field", title:"Field strips: the back of the ambulance", lockName:"The field strips", short:"Field", gated:"fieldStrips", size:100, unit:"strips", color:"linear-gradient(120deg,#3A4148,var(--band-orange) 60%,var(--band-red))", soft:"var(--orange-soft)", ink:"var(--orange)", blurb:"100 randomized strips from every rhythm family, the way they really look on a moving rig: breathing wander, road vibration, bumps, shivering, a patient who won\u2019t lie still and the odd loose electrode. Read the rhythm through the mess."},
  {key:"twelve", title:"12-lead ECGs", short:"12-lead", gated:"twelveLead", size:150, color:"linear-gradient(120deg,var(--band-navy),var(--band-teal) 55%,var(--band-red))", soft:"var(--navy-soft)", ink:"var(--navy)", blurb:"STEMI territories and equivalents (Wellens, de Winter, aVR), bundle branch blocks, WPW, LVH, Brugada, long QT, potassium problems, pericarditis and early repolarization, on full 12-lead printouts, including 50 recorded on scene from real-looking patients. Stuck? Call the cardiologist."}
];
function areaOpen(m){ return !m.gated || (SB.features||{})[m.gated]===true; }
var AREA_SIZE = 50;
function areaSize(key){ var m=areaMeta(key); return (AREAS[key] && AREAS[key].items.length) || (m && m.size) || AREA_SIZE; }
var AREAS = {}, AREA_LOADING = {};
function areaMeta(key){ for(var i=0;i<AREA_META.length;i++) if(AREA_META[i].key===key) return AREA_META[i]; return null; }
function areaState(key){ S.ar = S.ar || {}; if(!S.ar[key]) S.ar[key] = {pi:1, p:{}}; return S.ar[key]; }
function areaScore(key){
  var st=(S.ar||{})[key], a=0, c=0, data=AREAS[key];
  if(!st) return {a:0, c:0, t:areaSize(key)};
  Object.keys(st.p).forEach(function(n){ a++; if(data){ var q=data.items[n-1]; if(q && st.p[n]===q.cat) c++; } else if(st.ok && st.ok[n]) c++; });
  return {a:a, c:c, t:areaSize(key)};
}
function loadArea(key){
  if(AREAS[key]) return Promise.resolve(AREAS[key]);
  var m=areaMeta(key), url = m && m.gated ? API+"/areas/"+key+"?cohort="+encodeURIComponent(S.cohort||"") : "/areas/"+key+".json";
  var opts = {cache:"no-cache"}; if(m && m.gated && SB.pass) opts.headers={authorization:"Bearer "+SB.pass};
  if(!AREA_LOADING[key]) AREA_LOADING[key] = fetch(url, opts).then(function(r){ if(r.status===403){ var e=new Error("locked"); e.locked=true; throw e; } if(!r.ok) throw new Error("http "+r.status); return r.json(); })
    .then(function(d){ if(d.strips) Object.keys(d.strips).forEach(function(k){ D.strips[k]=d.strips[k]; }); if(d.cats) Object.keys(d.cats).forEach(function(k){ CATS[k]=d.cats[k]; }); AREAS[key]=d; return d; }, function(e){ AREA_LOADING[key]=null; throw e; });
  return AREA_LOADING[key];
}
var MINI_ECG = '<svg viewBox="0 0 120 30" aria-hidden="true"><path d="M0 18h22l4-6 4 6h8l4-15 5 26 4-11h14l5-6 5 6h45" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function areaTilesHTML(){
  return AREA_META.filter(function(m){ return areaOpen(m) || SB.admin; }).map(function(m){
    var sc=areaScore(m.key), done=sc.a>=sc.t, started=sc.a>0;
    var unit = m.unit || "ECGs";
    var lockNote = m.gated ? (areaOpen(m) ? '<span class="area-count num">'+areaSize(m.key)+' '+unit+' · New</span>' : '<span class="area-count num">'+areaSize(m.key)+' '+unit+' · closed to students · preview</span>') : '<span class="area-count num">'+areaSize(m.key)+' strips</span>';
    return '<a class="area-tile'+(m.gated?' wide':'')+'" href="/practice/'+m.key+'" style="--ac:'+m.color+';--as:'+m.soft+';--ai:'+m.ink+'">'+
      '<span class="area-band"><span class="area-ecg">'+MINI_ECG+'</span>'+lockNote+'</span>'+
      '<span class="area-body"><b>'+esc(m.title)+'</b><span class="area-blurb">'+esc(m.blurb)+'</span>'+
      '<span class="progress"><i style="width:'+pct(sc.a,sc.t)+'%"></i></span>'+
      '<span class="area-foot"><span class="num">'+(started? sc.a+' of '+sc.t+' answered · '+pct(sc.c,sc.a)+'% correct' : 'Not started')+'</span><span class="area-go">'+(done?'Review':(started?'Resume':'Start'))+' →</span></span></span></a>';
  }).join("")+defibTileHTML()+codeTileHTML();
}
/* the Defib lab, drawn as one of the practice tiles */
function defibTileHTML(){
  if(!(defibOpen() || SB.admin) || typeof DEFIB_LIST==="undefined") return "";
  var c=defibCounts({defib:defibDoc()}), n=DEFIB_LIST.length, tried=c[1], passed=c[0];
  var note=defibOpen() ? n+' scenarios · New' : n+' scenarios · closed to students · preview';
  return '<a class="area-tile wide" href="/defib" style="--ac:linear-gradient(120deg,#3A4148,var(--band-red) 55%,var(--band-orange));--as:var(--red-soft);--ai:var(--brand-red)">'+
    '<span class="area-band"><span class="area-ecg area-bolt">'+IC_BOLT+'</span><span class="area-count num">'+note+'</span></span>'+
    '<span class="area-body"><b>Defib lab: monitor, defibrillator and pacer</b><span class="area-blurb">Run a real-time monitor with sound. Select energy, charge, shock, synchronize, pace and give drugs, then get step-by-step feedback on every scenario.</span>'+
    '<span class="progress"><i style="width:'+pct(tried,n)+'%"></i></span>'+
    '<span class="area-foot"><span class="num">'+(tried? tried+' of '+n+' run · '+passed+' passed' : 'Not started')+'</span><span class="area-go">'+(tried>=n?'Review':(tried?'Resume':'Start'))+' →</span></span></span></a>';
}
function stripsTileHTML(){
  var sc=stripScore(), started=sc.a>0, done=sc.a>=N;
  return '<a class="area-tile wide" href="/strips" style="--ac:linear-gradient(120deg,var(--band-blue),var(--band-navy));--as:var(--blue-soft);--ai:var(--blue)">'+
    '<span class="area-band"><span class="area-ecg">'+MINI_ECG+'</span><span class="area-count num">'+N+' strips · all rhythm families</span></span>'+
    '<span class="area-body"><b>Random ECG Practice Strips</b><span class="area-blurb">A mixed set of '+N+' strips from every rhythm family, in random order, with a scenario for each and a full interpretation after you answer.</span>'+
    '<span class="progress"><i style="width:'+pct(sc.a,N)+'%"></i></span>'+
    '<span class="area-foot"><span class="num">'+(started? sc.a+' of '+N+' answered · '+pct(sc.c,sc.a)+'% correct' : 'Not started')+'</span><span class="area-go">'+(done?'Review':(started?'Resume at strip '+S.pi:'Start'))+' →</span></span></span></a>';
}
function renderAreaTiles(){
  var h=$("homeAreas"); if(h) h.innerHTML=areaTilesHTML();
  var p=$("practiceAreas"); if(p) p.innerHTML=areaTilesHTML()+stripsTileHTML();
}
var CUR_AREA=null;
function renderArea(key){
  CUR_AREA=key;
  var m=areaMeta(key), body=$("arBody");
  $("v-area").style.setProperty("--accent", m.ink); $("v-area").style.setProperty("--accent-soft", m.soft);
  var lockedHTML='<div class="card panel area-locked" style="--ac:'+m.color+'"><span class="sv-ic">'+IC_LOCK+'</span><h3>'+esc(m.lockName||m.title)+' aren\'t open yet</h3><p class="empty">Your instructor will open this practice area when the class is ready for it. In the meantime, keep working in the other areas.</p><a class="btn btn-primary" href="/practice">Back to practice areas</a></div>';
  if(!AREAS[key] && !areaOpen(m) && !SB.admin && SB.configDone){ body.innerHTML=lockedHTML; return; }
  if(!AREAS[key]){
    body.innerHTML='<div class="card panel"><p class="empty">Loading '+esc(m.title.toLowerCase())+'…</p></div>';
    loadArea(key).then(function(){ if(CUR_AREA===key && (VIEW==="area" && VIEW_AREA===key)) renderArea(key); }, function(err){
      if(err && err.locked){ body.innerHTML=lockedHTML; return; }
      body.innerHTML='<div class="card panel"><h3>This practice area couldn\'t load</h3><p class="empty">Check your connection and try again.</p><button class="btn btn-primary" id="arRetry">Try again</button></div>';
      $("arRetry").onclick=function(){ renderArea(key); };
    });
    return;
  }
  var data=AREAS[key], st=areaState(key), total=data.items.length, unit=(data.items[0] && data.items[0].leads) ? "ECG" : "Strip";
  if(st.pi>total+1) st.pi=1;
  var sc=areaScore(key);
  var head='<div class="qhead"><div><div class="eyebrow">Practice area · '+esc(m.title)+'</div><h2>'+(st.pi>total?'Results':unit+' <span class="num">'+st.pi+'</span><span> / '+total+'</span>')+'</h2></div>'+
    '<div class="qstats"><span>Answered <b class="num">'+sc.a+'</b></span><span>Correct <b class="num">'+sc.c+'</b></span><span>Score <b class="num">'+(sc.a?pct(sc.c,sc.a)+'%':'–')+'</b></span>'+(key==="twelve" && vesselScore().a ? '<span>Vessel <b class="num">'+vesselScore().c+'/'+vesselScore().a+'</b></span>' : '')+'<a class="btn btn-ghost" href="/practice">All areas</a></div></div>'+
    '<div class="progress" style="margin-bottom:16px"><i style="width:'+pct(sc.a,total)+'%"></i></div>';
  if(st.pi>total){ body.innerHTML=head+areaSummaryHTML(key); bindAreaSummary(key); return; }
  var q=data.items[st.pi-1], chosen=st.p[q.n], done=chosen!=null, letters="ABCD";
  var opts=q.options.map(function(o,i){
    var cls = done ? (o===q.cat ? "is-right" : (o===chosen ? "is-wrong" : "is-dim")) : "";
    return '<button class="opt '+cls+'" data-o="'+esc(o)+'" '+(done?"disabled":"")+'><span class="k">'+letters[i]+'</span><span>'+esc(o)+'</span></button>';
  }).join("");
  var dots=data.items.map(function(it){ var x=st.p[it.n], c = x==null ? "" : (x===it.cat?"r":"w"); return '<button class="dot '+c+(it.n===st.pi?" cur":"")+'" data-n="'+it.n+'" aria-label="Strip '+it.n+'">'+it.n+'</button>'; }).join("");
  body.innerHTML=head+'<div class="card qcard"><div class="strip-top"><div class="stem"><span class="tag">'+esc(m.short)+'</span><p>'+(q.leads?'Interpret this 12-lead ECG.':'Identify this rhythm.')+'</p></div>'+(q.hints?cardioBtnHTML(q, st, done):'')+'</div>'+
    ('<p class="ecg-tip">'+IC_EXPAND+'<span><b>Tip:</b> click the '+(q.leads?'ECG':'strip')+' to open it full screen. Zoom with + / −, the mouse wheel or a pinch, double-click to zoom in on a spot, and drag to move around.</span></p>')+
    '<div><div class="paper">'+(q.leads?ecg12SVG(q):stripSVG(q.strip,"paper",false))+'</div><div class="paper-meta"><span>'+(q.leads?'12-lead · 25 mm/s · 10 mm/mV · bottom row: lead II rhythm strip'+(q.field?' · recorded on scene, real patient':'')+'</span><span><button class="btn btn-ghost ecg-expand" id="ecgExpand" data-expand="1" type="button">'+IC_EXPAND+'Expand and zoom</button>':'Lead II · 25 mm/s · 6-second strip'+(key==="field"?' · recorded in a moving ambulance':''))+'</span><span class="scroll-hint"></span></div></div>'+
    (vesselHTML(q, st) && q.leads
      ? '<div class="answered-line '+(chosen===q.cat?'ok':'no')+'"><span class="eyebrow">Your interpretation</span><b>'+esc(chosen===REVEALED?'Revealed by the cardiologist':chosen)+'</b><span>'+(chosen===q.cat?'✓ Correct':'✗ It\'s '+esc(q.cat))+'</span><div class="opts" id="arOpts" hidden>'+opts+'</div></div>'+vesselHTML(q, st)
      : '<div><div class="eyebrow" style="margin-bottom:10px">'+(q.leads?'What does it show?':'Identify the rhythm')+'</div><div class="opts" id="arOpts" role="group" aria-label="Answer choices">'+opts+'</div></div>')+
    '<div aria-live="polite">'+(done?stripFeedback(q, chosen):'')+'</div>'+
    '<div class="qnav"><button class="btn btn-ghost" id="arPrev" '+(st.pi===1?'disabled':'')+'>← Previous</button><button class="btn btn-primary" id="arNext">'+(st.pi===total?'See area results →':(done?'Next '+unit.toLowerCase()+' →':'Skip →'))+'</button></div></div>'+
    '<details class="card grid-nav"><summary>All '+total+' '+unit.toLowerCase()+'s in this area</summary><div class="dots" id="arDots">'+dots+'</div><div class="legend"><span><i style="background:var(--ok)"></i>Correct</span><span><i style="background:var(--bad)"></i>Incorrect</span><span><i style="background:var(--line-2)"></i>Not answered</span></div></details>';
  if($("arCardioBtn")) $("arCardioBtn").onclick=function(){ callCardiologist(key, q, st); };
  if($("arCardioShow")) $("arCardioShow").onclick=function(){ S.cmin=false; save(); renderCardioPop(q, st, done); };
  renderCardioPop(q.hints ? q : null, st, done);
  $("arOpts").onclick=function(e){ var b=e.target.closest(".opt"); if(!b||b.disabled) return; st.p[q.n]=b.getAttribute("data-o"); st.ok=st.ok||{}; st.ok[q.n]=st.p[q.n]===q.cat; st.lastAnswered=q.n; save(); renderArea(key); };
  if(done && $("arVessel") && !(st.v||{}).hasOwnProperty(q.n) && st.lastAnswered===q.n){ st.lastAnswered=null; setTimeout(function(){ var vq=document.querySelector("#v-area .vessel-q"); if(vq) vq.scrollIntoView({block:"nearest"}); }, 60); }
  if($("arVessel")) $("arVessel").onclick=function(e){ var b=e.target.closest(".opt"); if(!b||b.disabled) return; st.v=st.v||{}; st.v[q.n]=+b.getAttribute("data-v"); st.vok=st.vok||{}; st.vok[q.n]=st.v[q.n]===VESSEL_OF[q.cat][0]; save(); renderArea(key);
    var vq=document.querySelector("#v-area .vessel-q .fb"); if(vq) vq.scrollIntoView({block:"nearest", behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"}); };
  $("arPrev").onclick=function(){ if(st.pi>1){ st.pi--; save(); renderArea(key); scrollTop(); } };
  $("arNext").onclick=function(){ st.pi++; save(); renderArea(key); scrollTop(); };
  $("arDots").onclick=function(e){ var b=e.target.closest(".dot"); if(!b) return; st.pi=+b.getAttribute("data-n"); save(); renderArea(key); scrollTop(); };
  updateTally();
  if(q && done && chosen!==q.cat){ if(q.leads) markECG12(document.querySelector("#v-area .paper"), q); else markStrip(document.querySelector("#v-area .paper"), q.strip, q.cat, q); }
  if(q){ var fk=key+":"+q.n, fresh=FIT12_LAST!==fk; FIT12_LAST=fk; fit12(false); setTimeout(function(){ fit12(fresh); }, 0); } else FIT12_LAST=null;
}
/* Practice areas (rhythm strips and 12-leads): scale the whole ECG to the screen and line it up at the top, so no scrolling is needed to see it */
var FIT12_LAST=null;
function fit12(scroll){
  var svg=document.querySelector("#v-area .paper svg:not(.cal-svg)"); if(!svg || $("v-area").hidden) return;
  var vb=(svg.getAttribute("viewBox")||"0 0 6000 1000").split(/\s+/), aspect=(+vb[2])/(+vb[3]||1);
  var paper=svg.closest(".paper"), wrap=svg.closest(".cal-wrap"), card=paper.closest(".qcard")||paper, meta=paper.nextElementSibling;
  var bar=document.querySelector(".bar").getBoundingClientRect().height;
  var top=function(el){ return el.getBoundingClientRect().top+window.scrollY; };
  var band=wrap && wrap.classList.contains("cal-on") ? 80 : 0, metaH=meta ? meta.getBoundingClientRect().height+10 : 0;
  var availH=window.innerHeight-bar-20-(top(paper)-top(card))-band-metaH-4, availW=paper.clientWidth;
  var w=Math.floor(Math.max(Math.min(300, availW), Math.min(availW, availH*aspect)));
  if(wrap){ svg.style.width=""; svg.style.minWidth=""; wrap.style.width=w+"px"; wrap.style.minWidth="0"; wrap.style.margin="0 auto"; }
  else { svg.style.width=w+"px"; svg.style.minWidth="0"; svg.style.margin="0 auto"; }
  if(window.__calUpdate) window.__calUpdate();  // the calipers redraw for the new size
  if(scroll) window.scrollTo({top:Math.max(0, top(card)-bar-10), behavior:"auto"});
}
window.addEventListener("resize", function(){ if(VIEW==="area") fit12(false); });
window.fit12 = fit12;  // the calipers call this when they open or close the band above the ECG
function areaSummaryHTML(key){
  var data=AREAS[key], st=areaState(key), sc=areaScore(key), byCat={};
  data.categories.forEach(function(c){ byCat[c]=[0,0,0]; });
  data.items.forEach(function(q){ var b=byCat[q.cat]; b[2]++; var x=st.p[q.n]; if(x!=null){ b[1]++; if(x===q.cat) b[0]++; } });
  var rows=data.categories.map(function(c){ var b=byCat[c]; return '<div class="barrow"><span>'+esc(c)+'</span><span class="track"><i style="width:'+pct(b[0],b[1])+'%"></i></span><b>'+(b[1]?b[0]+'/'+b[1]:'—')+'</b></div>'; }).join("");
  var missed=data.items.filter(function(q){ var x=st.p[q.n]; return x!=null && x!==q.cat; });
  var skipped=data.items.filter(function(q){ return st.p[q.n]==null; }).length;
  return '<div class="card panel area-sum"><div class="area-sum-top"><div><div class="eyebrow">Area score</div><h3 class="num">'+sc.c+' of '+sc.a+' answered correct</h3><p class="empty">'+(skipped?skipped+' strip'+(skipped===1?' was':'s were')+' skipped. They don\'t count against your score, but you can go back to them.':'Every strip answered.')+'</p></div>'+
    '<div class="area-big num">'+(sc.a?pct(sc.c,sc.a)+'%':'–')+'</div></div><h4>By rhythm type</h4><div class="bars">'+rows+'</div>'+
    (missed.length?'<h4>Missed strips</h4><div class="missed" id="arMissed">'+missed.map(function(q){ return '<button data-n="'+q.n+'"><b>#'+q.n+'</b><span style="color:var(--ink)">'+esc(q.name)+'</span></button>'; }).join("")+'</div>':'')+
    '<div class="qnav" style="justify-content:flex-start"><a class="btn btn-primary" href="/practice">Choose another area</a><button class="btn btn-ghost" id="arReview">Review from strip 1</button><span id="arReset"><button class="btn btn-ghost" id="arAsk">Start this area over</button></span></div></div>';
}
function bindAreaSummary(key){
  var st=areaState(key);
  if($("arMissed")) $("arMissed").onclick=function(e){ var b=e.target.closest("button"); if(!b) return; st.pi=+b.getAttribute("data-n"); save(); renderArea(key); scrollTop(); };
  $("arReview").onclick=function(){ st.pi=1; save(); renderArea(key); scrollTop(); };
  $("arAsk").onclick=function(){ $("arReset").innerHTML='<span class="confirm"><span>Clear your answers in this area?</span><button class="btn btn-primary" id="arYes">Clear</button><button class="btn btn-ghost" id="arNo">Cancel</button></span>';
    $("arYes").onclick=function(){ S.ar[key]={pi:1, p:{}}; save(); renderArea(key); renderAreaTiles(); scrollTop(); };
    $("arNo").onclick=function(){ renderArea(key); }; };
}
document.addEventListener("keydown", function(e){
  if(VIEW!=="area" || e.target.closest("input,textarea,.cal-ov") || !$("arOpts")) return;
  var idx="ABCD".indexOf(e.key.toUpperCase());
  if(e.key.toUpperCase()==="H" && $("arCardioBtn")){ $("arCardioBtn").click(); return; }
  if(idx>=0){ var btn=$("arOpts").children[idx]; if(btn && !btn.disabled) btn.click(); }
  else if(e.key==="ArrowRight") $("arNext").click();
  else if(e.key==="ArrowLeft" && !$("arPrev").disabled) $("arPrev").click();
});
/* ----- 12-lead printout: four columns of three leads + a lead II rhythm strip ----- */
function decodeStr(d){ var v=[], cur=0, i=0; while(i<d.length){ var ch=d[i]; if(ch==="|"){ var j=d.indexOf("|",i+1); cur=parseInt(d.slice(i+1,j),10); v.push(cur); i=j+1; } else { cur+=d.charCodeAt(i)-80; v.push(cur); i++; } } return v; }
var LEAD_COLS=[["I","II","III"],["aVR","aVL","aVF"],["V1","V2","V3"],["V4","V5","V6"]];
function ecg12SVG(q){
  var RH=1200, BASE=760, lines="", labels="";
  function pts(arr, x0, y0){ var o=new Array(arr.length); for(var i=0;i<arr.length;i++){ var v=Math.max(-110, Math.min(185, arr[i])); o[i]=(x0+i*2)+","+(y0-v*4).toFixed(1); } return o.join(" "); }
  LEAD_COLS.forEach(function(col, ci){ col.forEach(function(ld, ri){
    var y0=ri*RH+BASE, x0=ci*2500;
    lines+='<polyline points="'+pts(decodeStr(q.leads[ld]), x0, y0)+'"/>';
    labels+='<text x="'+(x0+50)+'" y="'+(ri*RH+190)+'">'+ld+'</text>';
    if(ci>0) lines+='<polyline points="'+x0+','+(y0-170)+' '+x0+','+(y0+170)+'"/>';
  }); });
  lines+='<polyline points="'+pts(decodeStr(q.leads.rhythm), 0, 3*RH+BASE)+'"/>';
  labels+='<text x="50" y="'+(3*RH+190)+'">II</text>';
  return '<svg class="ecg12" viewBox="0 0 10000 4800" role="img" aria-label="12-lead ECG"><rect width="10000" height="4800" fill="url(#pMajor)"/>'+
    '<g fill="none" stroke="var(--trace)" stroke-width="1.9" stroke-linejoin="round" vector-effect="non-scaling-stroke">'+lines+'</g>'+
    '<g class="ldl" fill="var(--trace)">'+labels+'</g></svg>';
}
/* ----- "Call the cardiologist" (12-lead): three hints, then the answer ----- */
var IC_PHONE='<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.2 2.8h2.4l1.2 3.4-1.7 1.1a9.6 9.6 0 0 0 5.6 5.6l1.1-1.7 3.4 1.2v2.4a1.6 1.6 0 0 1-1.7 1.6A14.2 14.2 0 0 1 3.6 4.5a1.6 1.6 0 0 1 1.6-1.7z"/></svg>';
function cardioBtnHTML(q, st, done){
  st.h = st.h || {};
  var used = Math.min(st.h[q.n]||0, 3);
  if(done) return used ? '<button class="btn cardio-btn ghost" id="arCardioShow">'+IC_PHONE+'<span>Cardiologist</span><small>'+(st.p[q.n]===REVEALED?'answer revealed':used+' hint'+(used===1?'':'s')+' used')+'</small></button>' : '';
  var tip = 'Each call gives you a hint. The 4th call reveals the answer and counts it as wrong.';
  return used < 3
    ? '<button class="btn cardio-btn" id="arCardioBtn" title="'+tip+'">'+IC_PHONE+'<span>Call the cardiologist</span><small>hint '+(used+1)+' of 3</small></button>'
    : '<button class="btn cardio-btn reveal" id="arCardioBtn" title="'+tip+'">'+IC_PHONE+'<span>Call again for the answer</span><small>counts as wrong</small></button>';
}
var POP_Q = null;
function renderCardioPop(q, st, done, fresh){
  var pop = $("cardioPop");
  if(!q || VIEW!=="area"){ pop.hidden = true; POP_Q = null; return; }
  st.h = st.h || {};
  var used = Math.min(st.h[q.n]||0, 3), revealed = st.p[q.n]===REVEALED;
  if(!used){ pop.hidden = true; POP_Q = null; return; }
  var min = !!S.cmin;
  var sub = revealed ? 'Answer revealed after 3 hints' : (done ? used+' hint'+(used===1?'':'s')+' used' : used+' of 3 hints'+(used===3?' · next call reveals the answer':''));
  var list = q.hints.slice(0, used).map(function(h, i){ return '<li class="'+(fresh && i===used-1 ? 'new' : '')+'"><b>Hint '+(i+1)+'</b><p>'+esc(h)+'</p></li>'; }).join("");
  pop.className = 'cardio-pop'+(min?' min':'');
  pop.innerHTML = '<button class="cardio-pop-head" id="cardioToggle" aria-expanded="'+(!min)+'" aria-controls="cardioPopBody" title="'+(min?'Show hints':'Minimize')+'">'+
      '<span class="cardio-av">'+IC_PHONE+'</span><span class="cardio-pop-t"><b>Cardiologist on the line</b><small>'+sub+'</small></span>'+
      '<span class="cardio-min" aria-hidden="true">'+(min?'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12l5-5 5 5"/></svg>':'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 10h10"/></svg>')+'</span></button>'+
    '<div class="cardio-pop-body" id="cardioPopBody" role="status" aria-live="polite"'+(min?' hidden':'')+'><ol class="cardio-hints">'+list+'</ol>'+
      (!done && used < 3 ? '<p class="cardio-pop-note">Still stuck? Call again for hint '+(used+1)+' of 3.</p>' : '')+
      (!done && used === 3 ? '<p class="cardio-pop-note">One more call reveals the answer and counts it as wrong.</p>' : '')+'</div>';
  pop.hidden = false; POP_Q = q;
  $("cardioToggle").onclick = function(){ S.cmin = !S.cmin; try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} renderCardioPop(q, st, done); };
}
function callCardiologist(key, q, st){
  st.h = st.h || {};
  var used = st.h[q.n]||0;
  if(st.p[q.n]!=null) return;
  if(used < 3){ st.h[q.n] = used+1; }
  else { st.h[q.n] = 4; st.p[q.n] = REVEALED; st.ok = st.ok || {}; st.ok[q.n] = false; }
  S.cmin = false;  // a new hint always opens the panel
  save(); renderArea(key);
  if(used < 3) renderCardioPop(q, st, false, true);
  else { var el = document.querySelector("#v-area .fb"); if(el) el.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center"}); }
}

/* ----- 12-lead follow-up: which coronary artery? (STEMI and STEMI equivalents) ----- */
var VESSELS = ["Right coronary artery (RCA)", "Left anterior descending (LAD), mid or distal", "Proximal LAD", "Left circumflex (LCx)", "Left main or multivessel disease"];
var VESSEL_OF = {
  "Inferior STEMI": [0, "Inferior STEMI is usually the RCA (about 80%); the rest are the circumflex. ST elevation bigger in III than II, with reciprocal depression in I and aVL, points to the RCA. Check V4R for right-ventricular involvement and be careful with nitrates."],
  "Anterior STEMI": [1, "Anterior STEMI (V1–V4) is the left anterior descending artery, which supplies the front of the left ventricle and the septum."],
  "Anterolateral STEMI": [2, "Elevation across the anterior and lateral leads (V2–V6, I, aVL) means a big territory: a proximal LAD occlusion before the diagonal branches. High risk of shock and arrhythmias."],
  "Lateral STEMI": [3, "Lateral STEMI (I, aVL, V5, V6) is usually the left circumflex (sometimes a diagonal branch of the LAD). Reciprocal depression shows up inferiorly."],
  "Posterior MI": [3, "Posterior MI is usually the left circumflex (sometimes the RCA's posterior descending branch). Confirm with posterior leads V7–V9."],
  "Wellens syndrome": [2, "Wellens T waves mean a critical proximal LAD stenosis that has reperfused. It can occlude again at any time: no stress testing, urgent cath."],
  "De Winter T waves": [2, "De Winter T waves are a STEMI equivalent from an acute proximal LAD occlusion: activate the cath lab."],
  "ST elevation in aVR with diffuse ST depression": [4, "ST elevation in aVR with widespread depression suggests left main or severe multivessel (often three-vessel) ischemia, or global subendocardial ischemia from another cause."]
};
function vesselHTML(q, st){
  var v=VESSEL_OF[q.cat]; if(!v || st.p[q.n]==null) return "";
  st.v=st.v||{}; var picked=st.v[q.n], done=picked!=null, letters="ABCDE";
  var opts=VESSELS.map(function(o,i){ var cls = done ? (i===v[0] ? "is-right" : (i===picked ? "is-wrong" : "is-dim")) : "";
    return '<button class="opt '+cls+'" data-v="'+i+'" '+(done?"disabled":"")+'><span class="k">'+letters[i]+'</span><span>'+esc(o)+'</span></button>'; }).join("");
  var fb = done ? '<div class="fb '+(picked===v[0]?'ok':'no')+'"><div class="verdict">'+(picked===v[0]?IC.ok+'Correct':IC.no+'Not quite: it\'s the '+esc(VESSELS[v[0]].replace(/ \(.*\)/,"").replace(/, mid or distal/,""))+'')+'</div><p class="fb-note">'+esc(v[1])+'</p></div>' : '';
  return '<div class="card panel vessel-q"><div class="eyebrow">Follow-up question</div><h4>Which coronary artery is most likely involved?</h4><div class="opts" id="arVessel" role="group" aria-label="Culprit artery">'+opts+'</div><div aria-live="polite">'+fb+'</div></div>';
}
function vesselScore(){ var st=(S.ar||{}).twelve, data=AREAS.twelve, c=0, a=0; if(!st || !st.v) return {c:0, a:0};
  Object.keys(st.v).forEach(function(n){ a++; var q=data && data.items[n-1], v=q && VESSEL_OF[q.cat]; if(v ? v[0]===st.v[n] : (st.vok||{})[n]) c++; }); return {c:c, a:a}; }
function areasDoc(){ var out={}; AREA_META.forEach(function(m){ var sc=areaScore(m.key); out[m.key]=[sc.c, sc.a, sc.t]; }); var vs=vesselScore(); if(vs.a) out.vessel=[vs.c, vs.a, vs.a]; return out; }
function areasPanelHTML(rows){
  var h='<div class="card panel ar-board"><div class="sv-board-head"><div><div class="eyebrow">Practice by rhythm family</div><h3>Practice areas</h3></div></div><div class="ar-board-grid">';
  h+=AREA_META.map(function(m){
    var started=rows.filter(function(r){ var v=(r.areas||{})[m.key]; return v && v[1]>0; });
    var finished=started.filter(function(r){ return r.areas[m.key][1]>=r.areas[m.key][2]; }).length;
    var c=0,a=0; started.forEach(function(r){ c+=r.areas[m.key][0]; a+=r.areas[m.key][1]; });
    return '<div class="ar-cell" style="--ac:'+m.color+';--ai:'+m.ink+'"><b>'+esc(m.title)+'</b><span class="ar-big num">'+(a?pct(c,a)+'%':'—')+'</span><span>accuracy on answered strips</span>'+
      '<span class="progress"><i style="width:'+pct(finished,rows.length||1)+'%"></i></span><small class="num">'+started.length+' started · '+finished+' finished</small></div>';
  }).join("");
  return h+'</div></div>';
}

/* ================= COURSE SURVEY ================= */
var SV = {def:null, loading:null, sending:false, msg:"", missing:null, editing:false};
function programCounts(){ var s=stripScore(), m=megaScore(); return {done:s.a+m.a, total:N+TOTAL_Q, strips:s.a, mega:m.a}; }
var SURVEY_UNLOCK_PCT = 10;  // matches lib/api.mjs
function surveyNeed(){ return Math.ceil((N+TOTAL_Q)*SURVEY_UNLOCK_PCT/100); }
function surveyEligible(sa, ma){ return (sa+ma)*100 >= (N+TOTAL_Q)*SURVEY_UNLOCK_PCT; }
function programDone(){ var c=programCounts(); return surveyEligible(c.strips, c.mega); }
function rowEligible(r){ return surveyEligible(num(r.strips&&r.strips.a), num(r.mega&&r.mega.a)); }
function loadSurveyDef(){
  if(SV.def) return Promise.resolve(SV.def);
  if(!SV.loading) SV.loading = fetch(API+"/survey", {cache:"no-store"}).then(function(r){ if(!r.ok) throw new Error("http "+r.status); return r.json(); })
    .then(function(d){ SV.def=d; return d; }, function(e){ SV.loading=null; throw e; });
  return SV.loading;
}
function svQuestions(){ var out=[]; (SV.def?SV.def.sections:[]).forEach(function(s){ s.questions.forEach(function(q){ out.push(q); }); }); return out; }
var IC_LOCK='<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="9" width="12" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/></svg>';
var IC_CLIP='<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3.5" width="12" height="14" rx="2"/><path d="M7.5 3.5h5v2.5h-5zM7 10l2 2 4-4"/></svg>';

/* ----- home card + results prompt ----- */
function surveyPromptHTML(where){
  var c=programCounts();
  if(!programDone()){
    return '<div class="sv-prompt locked"><span class="sv-ic">'+IC_LOCK+'</span><div class="sv-t"><div class="eyebrow">Course survey</div><h3>Opens after '+SURVEY_UNLOCK_PCT+'% of the course</h3>'+
      '<p>Answer '+surveyNeed()+' strips or megacode decisions to unlock a short survey about the course.</p>'+
      '<div class="progress"><i style="width:'+pct(c.done,surveyNeed())+'%"></i></div><small class="num">'+c.done+' of '+surveyNeed()+' answered</small></div></div>';
  }
  if(S.svDone){
    return '<div class="sv-prompt done"><span class="sv-ic">'+IC_CLIP+'</span><div class="sv-t"><div class="eyebrow">Course survey</div><h3>Thanks for your feedback</h3>'+
      '<p>Your survey was submitted '+ago(S.svDone)+'. You can update your answers at any time.</p></div><a class="btn btn-ghost" href="/survey">Edit my answers</a></div>';
  }
  return '<div class="sv-prompt open"><span class="sv-ic">'+IC_CLIP+'</span><div class="sv-t"><div class="eyebrow">Course survey · about 4 minutes</div><h3>Tell us how the course is going</h3>'+
    '<p>Your answers help your instructor improve the course. You can update them any time as you keep going.</p></div><a class="btn btn-primary" href="/survey">Take the survey</a></div>';
}
function renderSurveyPrompts(){
  var h=$("homeSurvey"); if(h) h.innerHTML=surveyPromptHTML("home");
  var r=$("rSurvey"); if(r) r.innerHTML=surveyPromptHTML("results");
}

/* ----- survey page ----- */
function svScale(q, name, labels, val, lo, hi, cls, ends){
  var h='<div class="sv-scale '+cls+'" role="radiogroup" aria-label="'+esc(q.text)+'">';
  for(var v=lo; v<=hi; v++){
    var id="sv-"+name+"-"+v, lab = labels ? labels[v-lo] : String(v);
    h+='<input type="radio" id="'+id+'" name="'+name+'" value="'+v+'"'+(val===v?' checked':'')+'><label for="'+id+'"'+(labels?' title="'+esc(lab)+'"':'')+'>'+(cls==="stars"?'<span aria-hidden="true">★</span><span class="sr">'+v+' of 5</span>':(cls==="likert"?'<b>'+v+'</b><span>'+esc(lab)+'</span>':esc(lab)))+'</label>';
  }
  h+='</div>';
  if(ends) h+='<div class="sv-ends"><span>'+esc(ends[0])+'</span><span>'+esc(ends[1])+'</span></div>';
  return h;
}
function svQuestionHTML(q, ans, n){
  var v = ans[q.id], bad = SV.missing && SV.missing.indexOf(q.id)>=0;
  var h='<fieldset class="sv-q'+(bad?' sv-bad':'')+'" id="svq-'+q.id+'"><legend><span class="num">'+n+'.</span> '+esc(q.text)+(q.required?'':' <em>(optional)</em>')+'</legend>';
  if(q.type==="choice"){
    h+='<div class="sv-choices">'+q.options.map(function(o,i){ var id="sv-"+q.id+"-"+i; return '<input type="radio" id="'+id+'" name="'+q.id+'" value="'+esc(o)+'"'+(v===o?' checked':'')+'><label for="'+id+'">'+esc(o)+'</label>'; }).join("")+'</div>';
  } else if(q.type==="multi"){
    var picked=Array.isArray(v)?v:[], max=q.maxPicks||q.options.length;
    h+='<div class="sv-choices" data-max="'+max+'">'+q.options.map(function(o,i){ var id="sv-"+q.id+"-"+i, on=picked.indexOf(o)>=0; return '<input type="checkbox" id="'+id+'" name="'+q.id+'" value="'+esc(o)+'"'+(on?' checked':'')+(!on&&picked.length>=max?' disabled':'')+'><label for="'+id+'">'+esc(o)+'</label>'; }).join("")+'</div><div class="sv-ends"><span id="svc-'+q.id+'">'+picked.length+' of '+max+' chosen</span></div>';
  } else if(q.type==="likert"){
    h+=svScale(q, q.id, SV.def.likert, v, 1, 5, "likert");
  } else if(q.type==="stars"){
    h+=svScale(q, q.id, null, v, 1, 5, "stars", ["Poor","Excellent"]);
  } else if(q.type==="nps"){
    h+=svScale(q, q.id, null, v, 0, 10, "nps", ["Not at all likely","Extremely likely"]);
  } else if(q.type==="confidence"){
    var c=v||{};
    h+='<div class="sv-conf"><span class="sv-when">Before this course</span>'+svScale(q, q.id+"__before", null, c.before, 1, 5, "conf")+
       '<span class="sv-when">Now</span>'+svScale(q, q.id+"__now", null, c.now, 1, 5, "conf")+'</div>'+
       '<div class="sv-ends"><span>1 = '+esc(SV.def.confidence[0])+'</span><span>5 = '+esc(SV.def.confidence[4])+'</span></div>';
  } else if(q.type==="text"){
    h+='<textarea name="'+q.id+'" id="sv-'+q.id+'" rows="3" maxlength="'+(q.max||1000)+'" aria-label="'+esc(q.text)+'">'+esc(v||"")+'</textarea>';
  }
  return h+'</fieldset>';
}
function readSurveyForm(){
  var f=$("svForm"), a={};
  svQuestions().forEach(function(q){
    if(q.type==="confidence"){
      var b=f.querySelector('input[name="'+q.id+'__before"]:checked'), n=f.querySelector('input[name="'+q.id+'__now"]:checked');
      if(b||n) a[q.id]={before:b?+b.value:null, now:n?+n.value:null};
    } else if(q.type==="multi"){
      var picks=Array.prototype.map.call(f.querySelectorAll('input[name="'+q.id+'"]:checked'), function(el){ return el.value; });
      if(picks.length) a[q.id]=picks;
    } else if(q.type==="text"){
      var t=f.elements[q.id].value.trim(); if(t) a[q.id]=t;
    } else {
      var el=f.querySelector('input[name="'+q.id+'"]:checked');
      if(el) a[q.id] = q.type==="choice" ? el.value : +el.value;
    }
  });
  return a;
}
function svMissing(a){
  return svQuestions().filter(function(q){
    if(!q.required) return false;
    var v=a[q.id];
    if(q.type==="confidence") return !v || v.before==null || v.now==null;
    if(q.type==="multi") return !v || !v.length;
    return v===undefined || v===null || v==="";
  }).map(function(q){ return q.id; });
}
function renderSurvey(){
  var body=$("svBody");
  var head='<div class="qhead"><div><div class="eyebrow">Course survey</div><h2>Tell us about the course</h2></div></div>';
  if(!programDone()){ body.innerHTML=head+'<div class="card panel">'+surveyPromptHTML("page")+'<div class="qnav" style="justify-content:flex-start"><a class="btn btn-primary" href="/strips">Go to strips</a><a class="btn btn-ghost" href="/megacode">Go to megacode</a></div></div>'; return; }
  if(!SB.online && !SB.configDone){ body.innerHTML=head+'<div class="card panel"><p class="empty">Loading the survey…</p></div>'; return; }
  if(!SB.online){ body.innerHTML=head+'<div class="card panel"><h3>The survey isn\'t available on this site yet</h3><p class="empty">Survey answers are sent to your instructor, and score sharing isn\'t switched on here. Ask your instructor about it.</p></div>'; return; }
  if(S.svDone && !SV.editing){
    body.innerHTML=head+'<div class="card panel sv-thanks"><span class="sv-ic">'+IC_CLIP+'</span><h3>Thank you, '+esc(S.name||"")+'</h3><p>Your survey was submitted '+ago(S.svDone)+(S.svAnon?' with your name hidden next to your answers':'')+'. Your instructor can see your responses on the scoreboard.</p>'+
      '<div class="qnav" style="justify-content:flex-start"><button class="btn btn-ghost" id="svEdit">Edit my answers</button><a class="btn btn-primary" href="/results">See my results</a></div></div>';
    $("svEdit").onclick=function(){ SV.editing=true; renderSurvey(); };
    return;
  }
  body.innerHTML=head+'<div class="card panel"><p class="empty">Loading the survey…</p></div>';
  loadSurveyDef().then(function(){
    var ans = S.svDraft || S.svAnswers || {}, n=0;
    var who = '';
    if(!S.name || (SB.requireCode && !S.code)){
      who='<div class="card sv-sec sv-who"><h3>Before you start</h3><p class="empty">Your survey is sent to your instructor along with your results.</p><div class="share-f">'+
        (!S.name?'<label class="cohort" for="svName"><span>Your name</span><input id="svName" type="text" maxlength="60" autocomplete="name"></label>':'')+
        (SB.requireCode && !S.code?'<label class="cohort" for="svCode"><span>Class code</span><input id="svCode" type="text" maxlength="60" autocomplete="off"></label>':'')+'</div></div>';
    }
    var secs = SV.def.sections.map(function(s){
      return '<section class="card sv-sec"><h3>'+esc(s.title)+'</h3>'+(s.intro?'<p class="sv-intro">'+esc(s.intro)+'</p>':'')+s.questions.map(function(q){ n++; return svQuestionHTML(q, ans, n); }).join("")+'</section>';
    }).join("");
    var anon = S.svDraftAnon!=null ? S.svDraftAnon : !!S.svAnon;
    body.innerHTML = head+'<p class="sv-lede">Thanks for working through the course. This survey takes about 4 minutes, and you can update your answers later. Questions marked (optional) can be skipped.</p>'+
      '<form id="svForm" novalidate>'+who+secs+
      '<div class="card sv-sec sv-submit"><label class="sv-anon" for="svAnon"><input type="checkbox" id="svAnon"'+(anon?' checked':'')+'><span><b>Hide my name next to my answers</b><br>Your instructor will see that you completed the survey, but your answers and comments are listed as "Anonymous".</span></label>'+
      '<div class="sv-msg" id="svMsg" role="alert">'+esc(SV.msg)+'</div><div class="qnav" style="justify-content:flex-start"><button class="btn btn-primary" type="submit" id="svSend"'+(SV.sending?' disabled':'')+'>'+(S.svDone?'Update my answers':'Submit survey')+'</button>'+(S.svDone?'<button class="btn btn-ghost" type="button" id="svCancel">Cancel</button>':'')+'</div></div></form>';
    var f=$("svForm");
    f.addEventListener("change", function(e){
      var box=e.target.closest(".sv-choices[data-max]");
      if(box){ var max=+box.getAttribute("data-max"), boxes=box.querySelectorAll('input[type="checkbox"]'), n2=box.querySelectorAll('input:checked').length;
        boxes.forEach(function(el){ el.disabled = !el.checked && n2>=max; });
        var cnt=$("svc-"+e.target.name); if(cnt) cnt.textContent=n2+" of "+max+" chosen"; }
    });
    f.addEventListener("change", function(){ S.svDraft=readSurveyForm(); S.svDraftAnon=$("svAnon").checked; if(SV.missing){ SV.missing=svMissing(S.svDraft); f.querySelectorAll(".sv-q").forEach(function(el){ el.classList.toggle("sv-bad", SV.missing.indexOf(el.id.slice(4))>=0); }); setSvMsg(SV.missing.length ? (SV.missing.length===1 ? "One required question still needs an answer." : SV.missing.length+" required questions still need an answer.") : ""); } try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} });
    f.addEventListener("submit", function(e){ e.preventDefault(); submitSurvey(); });
    if($("svCancel")) $("svCancel").onclick=function(){ SV.editing=false; SV.msg=""; SV.missing=null; renderSurvey(); scrollTop(); };
  }, function(){
    body.innerHTML=head+'<div class="card panel"><h3>The survey couldn\'t load</h3><p class="empty">Check your connection and try again.</p><button class="btn btn-primary" id="svRetry">Try again</button></div>';
    $("svRetry").onclick=renderSurvey;
  });
}
function setSvMsg(t){ SV.msg=t; var m=$("svMsg"); if(m) m.textContent=t; }
function submitSurvey(retried){
  if(SV.sending) return;
  if($("svName")){ var nm=$("svName").value.trim().slice(0,60); if(!nm){ setSvMsg("Enter your name at the top of the survey."); $("svName").focus(); return; } S.name=nm; $("stuName").value=nm; }
  if($("svCode")){ var cd=$("svCode").value.trim().slice(0,60); if(!cd){ setSvMsg("Enter the class code from your instructor at the top of the survey."); $("svCode").focus(); return; } S.code=cd; $("classCode").value=cd; SB.last=""; }
  var a=readSurveyForm(), miss=svMissing(a);
  S.svDraft=a; S.svDraftAnon=$("svAnon").checked;
  if(miss.length){
    SV.missing=miss;
    document.querySelectorAll("#svForm .sv-q").forEach(function(el){ el.classList.toggle("sv-bad", miss.indexOf(el.id.slice(4))>=0); });
    setSvMsg(miss.length===1 ? "One required question still needs an answer." : miss.length+" required questions still need an answer.");
    var first=$("svq-"+miss[0]); if(first) first.scrollIntoView({behavior:"smooth", block:"center"});
    return;
  }
  SV.missing=null; SV.sending=true; $("svSend").disabled=true; setSvMsg("Sending…");
  var anon=$("svAnon").checked;
  // Make sure the server has the finished results first, then send the survey.
  var ready = (SB.state==="synced" && !SB.timer) ? Promise.resolve() : syncNow();
  ready.then(function(){
    return fetch(API+"/scores/"+S.sid+"/survey", {method:"PUT", headers:{"content-type":"application/json"}, body:JSON.stringify({code:S.code||"", anonymous:anon, answers:a})});
  }).then(function(r){
    SV.sending=false;
    if(r.ok){ S.svDone=Date.now(); S.svAnswers=a; S.svAnon=anon; delete S.svDraft; delete S.svDraftAnon; SV.editing=false; SV.msg=""; save(); renderSurvey(); renderSurveyPrompts(); scrollTop(); return; }
    if(r.status===403){ setSvMsg("That class code doesn't match. Check it on the Home page and try again."); }
    else if(r.status===409 && !retried){ SB.last=""; setTimeout(function(){ submitSurvey(true); }, 1500); setSvMsg("Saving your latest results first…"); return; }
    else if(r.status===409){ setSvMsg("Your latest results haven't reached the scoreboard yet. Check that you're online and that the top bar says \"Shared with instructor\", then try again."); }
    else setSvMsg("The survey couldn't be sent. Check your connection and try again.");
    $("svSend").disabled=false;
  }, function(){ SV.sending=false; $("svSend").disabled=false; setSvMsg("The survey couldn't be sent. Check your connection and try again."); });
}
// Sends the latest results right away and resolves when done.
function syncNow(){
  clearTimeout(SB.timer); SB.timer=null; SB.last="";
  return new Promise(function(res){
    pushNow();
    var tries=0, t=setInterval(function(){ tries++; if(!SB.writing || tries>40){ clearInterval(t); res(); } }, 150);
  });
}

/* ----- instructor survey summary ----- */
function avg(list){ return list.length ? list.reduce(function(a,b){return a+b},0)/list.length : null; }
function f1(x){ return x==null ? "—" : (Math.round(x*10)/10).toFixed(1); }
function surveyPanelHTML(rows){
  if(!SV.def) return '<div class="card panel sv-board"><h3>Course survey</h3><p class="empty">Loading survey results…</p></div>';
  var finished=rows.filter(rowEligible);
  var resp=rows.filter(function(r){ return r.survey && r.survey.answers; });
  var A=function(id){ return resp.map(function(r){ return r.survey.answers[id]; }).filter(function(v){ return v!==undefined && v!==null && v!==""; }); };
  var head='<div class="sv-board-head"><div><div class="eyebrow">End-of-course survey</div><h3>Course survey</h3></div>'+(resp.length?'<div class="sv-head-tools"><button class="btn btn-ghost" id="svPrint">Print survey report</button><button class="btn btn-ghost" id="svCsv">Download survey CSV</button></div>':'')+'</div>';
  if(!resp.length) return '<div class="card panel sv-board">'+head+'<p class="empty">No survey responses yet. Students see the survey once they\'ve answered '+SURVEY_UNLOCK_PCT+'% of the strips and megacode decisions'+(finished.length?' ('+finished.length+' student'+(finished.length===1?' has':'s have')+' unlocked it so far)':'')+'.</p></div>';
  var stars=avg(A("overall")), npsV=A("recommend"), prom=npsV.filter(function(v){return v>=9}).length, det=npsV.filter(function(v){return v<=6}).length, pas=npsV.length-prom-det;
  var nps = npsV.length ? Math.round(100*(prom-det)/npsV.length) : null;
  var qs=svQuestions(), conf=qs.filter(function(q){return q.type==="confidence"});
  var gains=[]; conf.forEach(function(q){ A(q.id).forEach(function(v){ gains.push(v.now-v.before); }); });
  var h='<div class="card panel sv-board">'+head+
    '<div class="stats sv-stats">'+
    '<div class="card stat"><small>Responses</small><b class="num">'+resp.length+'</b><span>of '+finished.length+' eligible student'+(finished.length===1?'':'s')+'</span></div>'+
    '<div class="card stat"><small>Overall rating</small><b class="num">'+f1(stars)+'<i class="sv-of">/5</i></b><span class="sv-stars" aria-hidden="true">'+starRow(stars)+'</span></div>'+
    '<div class="card stat"><small>Net Promoter Score</small><b class="num">'+(nps==null?"—":(nps>0?"+":"")+nps)+'</b><span>from −100 to +100</span></div>'+
    '<div class="card stat"><small>Confidence gain</small><b class="num">'+(gains.length?(avg(gains)>=0?"+":"")+f1(avg(gains)):"—")+'</b><span>average, on a 1–5 scale</span></div></div>';
  // Willingness to pay
  var qById={}; qs.forEach(function(q){ qById[q.id]=q; });
  if(qById.would_buy && qById.max_monthly){
    var wb=A("would_buy"), top2=wb.filter(function(x){ return qById.would_buy.options.indexOf(x)<=1; }).length;
    var medianOf=function(id){ var q=qById[id]; if(!q) return "—"; var idx=A(id).map(function(x){return q.options.indexOf(x)}).filter(function(i){return i>=0}).sort(function(a,b){return a-b}); return idx.length ? q.options[idx[Math.floor((idx.length-1)/2)]] : "—"; };
    var topOf=function(id){ var q=qById[id]; if(!q) return "—"; var v=A(id), best=null, bc=0; q.options.forEach(function(o){ var c=v.filter(function(x){return x===o}).length; if(c>bc){bc=c; best=o;} }); return best ? best+" ("+pct(bc,v.length)+"%)" : "—"; };
    h+='<div><h4>Willingness to pay</h4><div class="stats sv-stats sv-pay">'+
      '<div class="card stat"><small>Would buy</small><b class="num">'+(wb.length?pct(top2,wb.length)+'%':'—')+'</b><span>definitely or probably</span></div>'+
      '<div class="card stat"><small>Most they\'d pay</small><b class="sv-pay-v">'+esc(medianOf("max_monthly").replace(/ \(.*\)$/,""))+'</b><span>per month, median answer</span></div>'+
      '<div class="card stat"><small>Too expensive at</small><b class="sv-pay-v">'+esc(medianOf("too_expensive"))+'</b><span>per month, median answer</span></div>'+
      '<div class="card stat"><small>Preferred billing</small><b class="sv-pay-v sv-pay-t">'+esc(topOf("billing"))+'</b><span>most common answer</span></div></div></div>';
  }
  // Likert statements
  var lik=qs.filter(function(q){return q.type==="likert"});
  h+='<div class="sv-cols"><div><h4>Course statements</h4><div class="sv-likert">'+lik.map(function(q){
    var v=A(q.id), a=avg(v), agree=v.filter(function(x){return x>=4}).length;
    return '<div class="sv-lrow"><span class="sv-ltext">'+esc(q.text)+'</span><span class="track"><i style="width:'+(a==null?0:Math.round((a-1)/4*100))+'%"></i></span><b class="num">'+f1(a)+'</b><small class="num">'+pct(agree,v.length)+'% agree</small></div>';
  }).join("")+'</div><p class="empty">Average on a 1–5 scale (5 = strongly agree).</p></div>';
  // Confidence before/now
  h+='<div><h4>Confidence: before → now</h4><div class="sv-dumb">'+conf.map(function(q){
    var v=A(q.id), b=avg(v.map(function(x){return x.before})), n2=avg(v.map(function(x){return x.now}));
    var x1=b==null?0:(b-1)/4*100, x2=n2==null?0:(n2-1)/4*100;
    return '<div class="sv-drow"><span class="sv-ltext">'+esc(q.text)+'</span><span class="dumb"><i class="seg" style="left:'+Math.min(x1,x2)+'%;width:'+Math.abs(x2-x1)+'%"></i><i class="pt b" style="left:'+x1+'%"></i><i class="pt n" style="left:'+x2+'%"></i></span><b class="num">'+f1(b)+' → '+f1(n2)+'</b></div>';
  }).join("")+'</div><div class="legend"><span><i style="background:var(--muted)"></i>Before</span><span><i style="background:var(--orange)"></i>Now</span></div></div></div>';
  // NPS + choices
  var choiceQs=qs.filter(function(q){return q.type==="choice"||q.type==="multi"});
  h+='<div class="sv-cols"><div><h4>Would recommend</h4>'+(npsV.length?'<div class="npsbar"><i class="d" style="width:'+pct(det,npsV.length)+'%"></i><i class="p2" style="width:'+pct(pas,npsV.length)+'%"></i><i class="pr" style="width:'+pct(prom,npsV.length)+'%"></i></div><div class="legend"><span><i style="background:var(--bad)"></i>Detractors 0–6: '+det+'</span><span><i style="background:var(--line-2)"></i>Passives 7–8: '+pas+'</span><span><i style="background:var(--ok)"></i>Promoters 9–10: '+prom+'</span></div>':'<p class="empty">No answers.</p>')+
    choiceQs.map(function(q){ var v=A(q.id); return '<h4 style="margin-top:16px">'+esc(q.text)+'</h4><div class="bars">'+q.options.map(function(o){ var c=v.filter(function(x){return q.type==="multi" ? x.indexOf(o)>=0 : x===o}).length; return '<div class="barrow"><span>'+esc(o)+'</span><span class="track"><i style="width:'+pct(c,v.length||1)+'%"></i></span><b>'+c+'</b></div>'; }).join("")+'</div>'; }).join("")+'</div>';
  // Comments
  var textQs=qs.filter(function(q){return q.type==="text"});
  h+='<div><h4>Comments</h4>'+textQs.map(function(q){
    var list=resp.filter(function(r){ return r.survey.answers[q.id]; }).sort(function(a,b){ return num(b.surveyAt)-num(a.surveyAt); });
    return '<details class="sv-comments"'+(list.length?' open':'')+'><summary>'+esc(q.text)+' <span class="num">('+list.length+')</span></summary>'+(list.length?list.map(function(r){
      return '<blockquote><p>'+esc(r.survey.answers[q.id])+'</p><cite>'+(r.surveyAnonymous?'Anonymous':esc(r._name||r.name||"Student"))+(r.cohort&&!r.surveyAnonymous?' · '+esc(r.cohort):'')+' · '+ago(r.surveyAt)+'</cite></blockquote>'; }).join(""):'<p class="empty">No comments.</p>')+'</details>';
  }).join("")+'</div></div></div>';
  return h;
}
function starRow(x){ var s=""; for(var i=1;i<=5;i++) s+='<span class="'+(x!=null && x>=i-0.25?"on":"")+'">★</span>'; return s; }
function surveyDetailHTML(r){
  if(!r.survey || !r.survey.answers) return '<h4 style="margin-top:14px">Course survey</h4><div class="tags"><span>'+(rowEligible(r)?'Unlocked, survey not submitted yet':'Opens at '+SURVEY_UNLOCK_PCT+'% of the course')+'</span></div>';
  if(r.surveyAnonymous) return '<h4 style="margin-top:14px">Course survey</h4><div class="tags"><span>Submitted '+ago(r.surveyAt)+' · answers shared anonymously</span></div>';
  if(!SV.def) return '';
  var a=r.survey.answers;
  var items=svQuestions().filter(function(q){ return a[q.id]!==undefined; }).map(function(q){
    var v=a[q.id], t;
    if(q.type==="likert") t=v+" · "+SV.def.likert[v-1];
    else if(q.type==="confidence") t=v.before+" → "+v.now;
    else if(q.type==="stars") t=v+" / 5";
    else if(q.type==="nps") t=v+" / 10";
    else if(q.type==="multi") t=v.join(", ");
    else t=v;
    return '<li><span>'+esc(q.text)+'</span><b>'+esc(t)+'</b></li>';
  }).join("");
  return '<h4 style="margin-top:14px">Course survey · submitted '+ago(r.surveyAt)+'</h4><ul class="sv-answers">'+items+'</ul>';
}
function surveyCsv(rows){
  var qs=svQuestions(), resp=rows.filter(function(r){ return r.survey && r.survey.answers; });
  var head=["Student","Cohort","Submitted"];
  qs.forEach(function(q){ if(q.type==="confidence"){ head.push(q.text+" (before)", q.text+" (now)"); } else head.push(q.text); });
  var lines=[head].concat(resp.map(function(r){
    var a=r.survey.answers, line=[r.surveyAnonymous?"Anonymous":(r._name||r.name||""), r.surveyAnonymous?"":(r.cohort||""), r.surveyAt?new Date(r.surveyAt).toISOString():""];
    qs.forEach(function(q){ var v=a[q.id]; if(q.type==="confidence"){ line.push(v?v.before:"", v?v.now:""); } else if(q.type==="multi"){ line.push(v?v.join("; "):""); } else line.push(v==null?"":v); });
    return line;
  }));
  return lines;
}

initShared();
return { show: show, rerender: rerender };
}

(function(){
var $ = function(id){ return document.getElementById(id); };
var ECGV = {s:1, x:0, y:0, w:0, h:0, ptrs:{}, pinch:null, last:null, opener:null};
function ecgViewerOpen(srcSvg, title){
  var ov=$("ecgView");
  if(!ov){
    ov=document.createElement("div"); ov.id="ecgView"; ov.className="ecgv"; ov.setAttribute("role","dialog"); ov.setAttribute("aria-modal","true"); ov.setAttribute("aria-labelledby","ecgvTitle");
    ov.innerHTML='<div class="ecgv-bar"><b id="ecgvTitle">12-lead ECG</b><span class="ecgv-help">Scroll or pinch to zoom · drag to move · double-click to zoom in</span>'+
      '<div class="ecgv-tools"><button class="btn btn-ghost" id="ecgvOut" aria-label="Zoom out">−</button><output id="ecgvPct" aria-live="polite">100%</output><button class="btn btn-ghost" id="ecgvIn" aria-label="Zoom in">+</button>'+
      '<button class="btn btn-ghost" id="ecgvFit">Fit</button><button class="btn btn-primary" id="ecgvClose" aria-label="Close the viewer">Close ✕</button></div></div>'+
      '<div class="ecgv-stage" id="ecgvStage" tabindex="0" aria-label="12-lead ECG. Use plus and minus to zoom and the arrow keys to move."><div class="ecgv-inner" id="ecgvInner"></div></div>';
    document.body.appendChild(ov);
    var st=$("ecgvStage");
    $("ecgvClose").onclick=ecgViewerClose;
    $("ecgvIn").onclick=function(){ ecgZoomAt(1.5); };
    $("ecgvOut").onclick=function(){ ecgZoomAt(1/1.5); };
    $("ecgvFit").onclick=ecgFit;
    st.addEventListener("wheel", function(e){ e.preventDefault(); var r=st.getBoundingClientRect(); ecgZoomAt(Math.exp(-e.deltaY*0.0018), e.clientX-r.left, e.clientY-r.top); }, {passive:false});
    st.addEventListener("dblclick", function(e){ var r=st.getBoundingClientRect(); ecgZoomAt(2, e.clientX-r.left, e.clientY-r.top); });
    st.addEventListener("pointerdown", function(e){ st.setPointerCapture(e.pointerId); ECGV.ptrs[e.pointerId]={x:e.clientX, y:e.clientY}; ECGV.last={x:e.clientX, y:e.clientY}; st.classList.add("grab"); ECGV.pinch=null; });
    st.addEventListener("pointermove", function(e){
      var p=ECGV.ptrs[e.pointerId]; if(!p) return;
      p.x=e.clientX; p.y=e.clientY;
      var ids=Object.keys(ECGV.ptrs);
      if(ids.length>=2){ var a=ECGV.ptrs[ids[0]], b=ECGV.ptrs[ids[1]], d=Math.hypot(a.x-b.x, a.y-b.y), r=st.getBoundingClientRect();
        if(ECGV.pinch) ecgZoomAt(d/ECGV.pinch, (a.x+b.x)/2-r.left, (a.y+b.y)/2-r.top); ECGV.pinch=d; return; }
      ECGV.x+=e.clientX-ECGV.last.x; ECGV.y+=e.clientY-ECGV.last.y; ECGV.last={x:e.clientX, y:e.clientY}; ecgApply();
    });
    var up=function(e){ delete ECGV.ptrs[e.pointerId]; ECGV.pinch=null; var ids=Object.keys(ECGV.ptrs); if(ids.length) ECGV.last={x:ECGV.ptrs[ids[0]].x, y:ECGV.ptrs[ids[0]].y}; else st.classList.remove("grab"); };
    st.addEventListener("pointerup", up); st.addEventListener("pointercancel", up);
    ov.addEventListener("keydown", function(e){
      if(e.key==="Escape"){ e.preventDefault(); ecgViewerClose(); return; }
      if(e.key==="+"||e.key==="="){ ecgZoomAt(1.5); } else if(e.key==="-"||e.key==="_"){ ecgZoomAt(1/1.5); } else if(e.key==="0"){ ecgFit(); }
      else if(e.key==="ArrowLeft"){ ECGV.x+=80; ecgApply(); } else if(e.key==="ArrowRight"){ ECGV.x-=80; ecgApply(); }
      else if(e.key==="ArrowUp"){ ECGV.y+=80; ecgApply(); } else if(e.key==="ArrowDown"){ ECGV.y-=80; ecgApply(); }
      else if(e.key==="Tab"){ var f=[].slice.call(ov.querySelectorAll("button,[tabindex='0']")), i=f.indexOf(document.activeElement); if(e.shiftKey && i<=0){ e.preventDefault(); f[f.length-1].focus(); } else if(!e.shiftKey && i===f.length-1){ e.preventDefault(); f[0].focus(); } return; }
      else return;
      e.preventDefault();
    });
    window.addEventListener("resize", function(){ if(!$("ecgView").hidden) ecgFit(); });
  }
  ECGV.opener=document.activeElement;
  var clone=srcSvg.cloneNode(true); clone.removeAttribute("style"); clone.removeAttribute("class"); clone.classList.add("ecgv-svg"); if(srcSvg.classList.contains("ecg12")) clone.classList.add("ecg12");
  $("ecgvInner").innerHTML=""; $("ecgvInner").appendChild(clone);
  var mk=srcSvg.parentNode.querySelector(":scope > .mk-ov"); if(mk){ var mc=mk.cloneNode(true); mc.style.top="0"; $("ecgvInner").appendChild(mc); }
  $("ecgvInner").classList.toggle("mon", !!srcSvg.closest(".mon-screen"));
  $("ecgvTitle").textContent=title||"12-lead ECG";
  ov.hidden=false; document.documentElement.classList.add("ecgv-open");
  ecgFit(); $("ecgvStage").focus();
}
function ecgViewerClose(){ var ov=$("ecgView"); if(!ov) return; ov.hidden=true; document.documentElement.classList.remove("ecgv-open"); if(ECGV.opener && ECGV.opener.focus) ECGV.opener.focus(); }
function ecgFit(){
  var st=$("ecgvStage"), r=st.getBoundingClientRect(), svg=$("ecgvInner").querySelector("svg"); if(!svg) return;
  var vb=svg.getAttribute("viewBox").split(/\s+/), asp=(+vb[2])/(+vb[3]);
  var w=Math.min(r.width-16, (r.height-16)*asp); ECGV.w=w; ECGV.h=w/asp;
  $("ecgvInner").style.width=w+"px"; $("ecgvInner").style.height=ECGV.h+"px";
  ECGV.s=1; ECGV.x=(r.width-w)/2; ECGV.y=(r.height-ECGV.h)/2; ecgApply();
}
function ecgZoomAt(f, px, py){
  var st=$("ecgvStage"), r=st.getBoundingClientRect();
  if(px==null){ px=r.width/2; py=r.height/2; }
  var ns=Math.max(1, Math.min(14, ECGV.s*f)); f=ns/ECGV.s;
  ECGV.x=px-(px-ECGV.x)*f; ECGV.y=py-(py-ECGV.y)*f; ECGV.s=ns; ecgApply();
}
function ecgApply(){
  var st=$("ecgvStage"), r=st.getBoundingClientRect(), W=ECGV.w*ECGV.s, Hh=ECGV.h*ECGV.s;
  // keep the ECG on screen: centered when it's smaller than the window, otherwise no empty gap at the edges
  ECGV.x = W<=r.width ? (r.width-W)/2 : Math.min(0, Math.max(r.width-W, ECGV.x));
  ECGV.y = Hh<=r.height ? (r.height-Hh)/2 : Math.min(0, Math.max(r.height-Hh, ECGV.y));
  $("ecgvInner").style.transform="translate("+ECGV.x+"px,"+ECGV.y+"px) scale("+ECGV.s+")";
  $("ecgvPct").textContent=Math.round(ECGV.s*100)+"%";
  $("ecgvOut").disabled=ECGV.s<=1.001; $("ecgvIn").disabled=ECGV.s>=13.99;
}
document.addEventListener("click", function(e){
  if(!e.target.closest) return;
  var b=e.target.closest("[data-expand]");
  if(e.target.closest(".cal-ov, .cal-toggle")) return;   // calipers keep their own clicks
  var svg=!b && e.target.closest(".paper svg:not(.cal-svg), .mon-screen svg:not(.hero-svg):not(.cal-svg)");
  if(!b && !svg) return;
  var view=(b||svg).closest(".view"), src=b ? view.querySelector(".paper svg:not(.cal-svg), .mon-screen svg:not(.hero-svg):not(.cal-svg)") : svg; if(!src) return;
  var h2=view && view.querySelector(".qhead h2, .runner-head h2"), twelve=src.classList.contains("ecg12");
  ecgViewerOpen(src, (h2 ? h2.textContent.replace(/\s+/g," ").trim()+" · " : "")+(twelve?"12-lead ECG":"Rhythm strip"));
});
})();
/* ================= CALIPERS (strips, practice areas, 12-lead and the megacode monitor; not the Defib lab) =================
   Two legs joined by a bar. Drag a knob or leg, or focus one and use the arrow keys (1 small box = 0.04 s; Shift for 0.01 s).
   Positions are shared across strips, so the calipers stay where you left them as you move on.                                  */
(function(){
  var CAL = {on:false, a:0.2, b:0.2+800/6000, march:false};
  try{ var saved = JSON.parse(localStorage.getItem("cl-calipers")||"null"); if(saved){ CAL.on=!!saved.on; CAL.march=!!saved.march; if(saved.a>=0&&saved.a<=1) CAL.a=saved.a; if(saved.b>=0&&saved.b<=1) CAL.b=saved.b; } }catch(e){}
  function persist(){ try{ localStorage.setItem("cl-calipers", JSON.stringify(CAL)); }catch(e){} }
  var IC_CAL='<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 6.2 4.2 18M10 6.2l5.8 11.8"/><circle cx="10" cy="5.2" r="2.2"/><path d="M10 1.4V3"/></svg>';
  var hosts = [], CAL_SEQ = 0, CAL_BAND = 80, CAL_DIP = 40;
  function clamp(x){ return Math.max(0, Math.min(1, x)); }
  function msOf(h){ return +h.getAttribute("data-cal-ms") || 6000; }
  function fmtS(ms){ return (ms/1000).toFixed(2)+" s"; }

  function attach(host, ms){
    host.classList.add("cal-host"); host.setAttribute("data-cal-ms", ms);
    var btn=document.createElement("button");
    btn.type="button"; btn.className="cal-toggle"; btn.setAttribute("aria-pressed", CAL.on?"true":"false");
    btn.setAttribute("aria-label", "Calipers"); btn.title="Calipers: measure intervals and rate";
    btn.innerHTML=IC_CAL+'<span>Calipers</span>';
    btn.addEventListener("click", function(){ CAL.on=!CAL.on; persist(); renderAll(); if(CAL.on){ var l=host.querySelector(".cal-leg"); if(l) l.focus(); } });
    host.appendChild(btn); hosts.push(host); render(host);
  }
  function scan(){
    hosts = hosts.filter(function(h){ return document.body.contains(h); });
    document.querySelectorAll(".paper > svg, .mon-screen > svg:not(.hero-svg)").forEach(function(svg){
      if(svg.closest(".cal-wrap") || svg.closest("#heroScreen")) return;
      var vb=(svg.getAttribute("viewBox")||"0 0 6000 1").split(/\s+/), ms=+vb[2]||6000;
      var wrap=document.createElement("div"); wrap.className="cal-wrap"+(svg.classList.contains("ecg12")?" wide":"");
      svg.parentNode.insertBefore(wrap, svg); wrap.appendChild(svg);
      Array.prototype.slice.call(wrap.parentNode.querySelectorAll(":scope > .mk-ov")).forEach(function(o){ wrap.appendChild(o); });
      attach(wrap, ms);
    });
    document.querySelectorAll("[data-cal-ms]:not(.cal-host)").forEach(function(h){ attach(h, +h.getAttribute("data-cal-ms")); });
    if(window.fit12 && document.getElementById("v-area")) fit12(false);
  }
  function render(host){
    var ov=host.querySelector(".cal-ov"); if(ov) ov.remove();
    var btn=host.querySelector(".cal-toggle"); if(btn){ btn.setAttribute("aria-pressed", CAL.on?"true":"false"); btn.classList.toggle("on", CAL.on); }
    host.classList.toggle("cal-on", CAL.on);  // opens a band above the tracing for the caliper body
    if(!CAL.on) return;
    ov=document.createElement("div"); ov.className="cal-ov";
    var gid="calg"+(++CAL_SEQ);
    ov.innerHTML='<svg class="cal-svg" aria-hidden="true" focusable="false"><defs>'+
        '<linearGradient id="'+gid+'m" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7C8790"/><stop offset=".35" stop-color="#F4F7F9"/><stop offset=".6" stop-color="#C3CBD1"/><stop offset="1" stop-color="#6A757E"/></linearGradient>'+
        '<radialGradient id="'+gid+'h" cx=".35" cy=".35" r=".8"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".45" stop-color="#C9D1D7"/><stop offset="1" stop-color="#5E6972"/></radialGradient>'+
        '<filter id="'+gid+'s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1.5" dy="2" stdDeviation="1.6" flood-color="#000" flood-opacity=".35"/></filter></defs>'+
        '<g class="cal-guides"></g><g class="cal-ticks"></g><g class="cal-body" filter="url(#'+gid+'s)"></g></svg>'+
      '<div class="cal-bar" role="slider" tabindex="0" aria-label="Calipers hinge: move both legs"></div>'+
      '<div class="cal-leg" data-k="a" role="slider" tabindex="0" aria-label="Caliper leg 1"><i></i></div>'+
      '<div class="cal-leg" data-k="b" role="slider" tabindex="0" aria-label="Caliper leg 2"><i></i></div>'+
      '<div class="cal-read"><output class="cal-val" aria-live="polite"></output>'+
      '<button type="button" class="cal-march" aria-pressed="'+CAL.march+'" title="March the interval across the strip">March</button>'+
      '<button type="button" class="cal-x" aria-label="Close calipers" title="Close calipers">×</button></div>';
    host.appendChild(ov);
    ov.querySelector(".cal-x").onclick=function(){ CAL.on=false; persist(); renderAll(); var b=host.querySelector(".cal-toggle"); if(b) b.focus(); };
    ov.querySelector(".cal-march").onclick=function(){ CAL.march=!CAL.march; persist(); updateAll(); };
    ov.querySelectorAll(".cal-leg, .cal-bar").forEach(function(el){
      var k=el.getAttribute("data-k");
      el.addEventListener("pointerdown", function(e){
        e.preventDefault(); el.setPointerCapture(e.pointerId); el.focus({preventScroll:true});
        var r=ov.getBoundingClientRect(), x0=e.clientX, a0=CAL.a, b0=CAL.b;
        var move=function(ev){
          var f=(ev.clientX-r.left)/r.width;
          if(k){ CAL[k]=clamp(f); }
          else { var d=(ev.clientX-x0)/r.width, lo=Math.min(a0,b0), hi=Math.max(a0,b0); d=Math.max(-lo, Math.min(1-hi, d)); CAL.a=a0+d; CAL.b=b0+d; }
          updateAll();
        };
        var up=function(){ el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); persist(); };
        el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
      });
      el.addEventListener("keydown", function(e){
        var ms=msOf(host), step=(e.shiftKey?10:40)/ms, d=0;
        if(e.key==="ArrowRight"||e.key==="ArrowUp") d=step; else if(e.key==="ArrowLeft"||e.key==="ArrowDown") d=-step;
        else if(e.key==="PageUp") d=200/ms; else if(e.key==="PageDown") d=-200/ms;
        else if(e.key==="Home"&&k){ CAL[k]=0; } else if(e.key==="End"&&k){ CAL[k]=1; }
        else if(e.key==="Escape"){ CAL.on=false; persist(); renderAll(); var b=host.querySelector(".cal-toggle"); if(b) b.focus(); return; }
        else return;
        e.preventDefault(); e.stopPropagation();
        if(k) CAL[k]=clamp(CAL[k]+d);
        else { var lo=Math.min(CAL.a,CAL.b), hi=Math.max(CAL.a,CAL.b); d=Math.max(-lo, Math.min(1-hi, d)); CAL.a+=d; CAL.b+=d; }
        persist(); updateAll();
      });
    });
    update(host);
  }
  function update(host){
    var ov=host.querySelector(".cal-ov"); if(!ov) return;
    var ms=msOf(host), lo=Math.min(CAL.a,CAL.b), hi=Math.max(CAL.a,CAL.b), d=(hi-lo)*ms;
    var legs=ov.querySelectorAll(".cal-leg");
    [["a",legs[0]],["b",legs[1]]].forEach(function(x){ var v=CAL[x[0]]*ms; x[1].style.left=(CAL[x[0]]*100)+"%";
      x[1].setAttribute("aria-valuemin","0"); x[1].setAttribute("aria-valuemax", String(Math.round(ms))); x[1].setAttribute("aria-valuenow", String(Math.round(v)));
      x[1].setAttribute("aria-valuetext", "at "+fmtS(v)+"; interval "+fmtS(d)); });
    var W=ov.clientWidth||720, Hh=ov.clientHeight||170;
    var hingeY=48, tipY=CAL_BAND+CAL_DIP;  // hinge in the band above the ECG; slim steel legs run down into the tracing, ending in a short fine point
    var xa=CAL.a*W, xb=CAL.b*W, hx=(xa+xb)/2, gid=ov.querySelector("linearGradient").id.slice(0,-1);
    var leg=function(tx){
      var dx=tx-hx, dy=tipY-hingeY, L=Math.sqrt(dx*dx+dy*dy)||1, ux=dx/L, uy=dy/L, nx=-uy, ny=ux;
      var nl=Math.min(7, L*0.12), px=tx-ux*nl, py=tipY-uy*nl, w0=3.4, w1=1.15;
      var poly=[[hx+nx*w0,hingeY+ny*w0],[px+nx*w1,py+ny*w1],[px-nx*w1,py-ny*w1],[hx-nx*w0,hingeY-ny*w0]].map(function(p){ return p[0].toFixed(1)+","+p[1].toFixed(1); }).join(" ");
      return '<polygon points="'+poly+'" fill="url(#'+gid+'m)" stroke="#3A434A" stroke-width=".6" stroke-linejoin="round"/>'+
        '<line x1="'+px.toFixed(1)+'" y1="'+py.toFixed(1)+'" x2="'+tx.toFixed(1)+'" y2="'+tipY+'" stroke="#2B3238" stroke-width=".8" stroke-linecap="round"/>';
    };
    var body=leg(xa)+leg(xb)+
      '<rect x="'+(hx-6).toFixed(1)+'" y="'+(hingeY-22)+'" width="12" height="13" rx="2.5" fill="url(#'+gid+'m)" stroke="#3A434A" stroke-width=".8"/>'+
      [-3,0,3].map(function(o){ return '<line x1="'+(hx+o).toFixed(1)+'" y1="'+(hingeY-20)+'" x2="'+(hx+o).toFixed(1)+'" y2="'+(hingeY-11)+'" stroke="#4A545B" stroke-width=".7"/>'; }).join("")+
      '<circle cx="'+hx.toFixed(1)+'" cy="'+hingeY+'" r="9.5" fill="url(#'+gid+'h)" stroke="#3A434A" stroke-width=".9"/>'+
      '<circle cx="'+hx.toFixed(1)+'" cy="'+hingeY+'" r="3.6" fill="#59636B" stroke="#2B3238" stroke-width=".6"/>'+
      '<line x1="'+(hx-2.6).toFixed(1)+'" y1="'+(hingeY+1.2)+'" x2="'+(hx+2.6).toFixed(1)+'" y2="'+(hingeY-1.2)+'" stroke="#D5DBDF" stroke-width=".9" stroke-linecap="round"/>';
    var gd=function(x){ return '<line x1="'+x.toFixed(1)+'" y1="'+tipY+'" x2="'+x.toFixed(1)+'" y2="'+Hh+'"/><circle cx="'+x.toFixed(1)+'" cy="'+tipY+'" r="1.3"/>'; };
    var svg=ov.querySelector(".cal-svg"); svg.setAttribute("viewBox","0 0 "+W+" "+Hh);
    ov.querySelector(".cal-body").innerHTML=body; ov.querySelector(".cal-guides").innerHTML=gd(xa)+gd(xb);
    [legs[0],legs[1]].forEach(function(el){ el.style.top=(tipY-28)+"px"; el.querySelector("i").style.top="19px"; });
    var bar=ov.querySelector(".cal-bar"); bar.style.left=(hx/W*100)+"%"; bar.style.top=(hingeY-24)+"px";
    bar.setAttribute("aria-valuemin","0"); bar.setAttribute("aria-valuemax", String(Math.round(ms))); bar.setAttribute("aria-valuenow", String(Math.round(lo*ms)));
    bar.setAttribute("aria-valuetext", "interval "+fmtS(d)+" starting at "+fmtS(lo*ms));
    var boxes=d/40, rate=d>=200?Math.round(60000/d):null;
    var narrow=(ov.clientWidth||720)<480;
    var txt=fmtS(d)+(narrow?"":" · "+(Math.round(boxes*10)/10)+" small boxes")+(rate?" · "+rate+"/min":"");
    if(narrow) ov.querySelector(".cal-val").setAttribute("aria-label", fmtS(d)+", "+(Math.round(boxes*10)/10)+" small boxes"+(rate?", "+rate+" per minute":""));
    var out=ov.querySelector(".cal-val"); if(out.textContent!==txt) out.textContent=txt;
    var rd=ov.querySelector(".cal-read"), Wl=ov.clientWidth||720, rw=rd.offsetWidth||300, cx=(lo+hi)/2*Wl;
    rd.style.left=(rw>=Wl-4 ? Wl/2 : Math.max(rw/2+2, Math.min(Wl-rw/2-2, cx)))+"px";  // keep the readout fully inside the ECG
    var mb=ov.querySelector(".cal-march"); mb.setAttribute("aria-pressed", CAL.march?"true":"false"); mb.classList.toggle("on", CAL.march);
    var tk=ov.querySelector(".cal-ticks"), h="", tick=function(f){ var x=(f*W).toFixed(1); return '<line x1="'+x+'" y1="'+tipY+'" x2="'+x+'" y2="'+Hh+'"/><path d="M'+x+' '+tipY+'l-4 -8h8z"/>'; };
    if(CAL.march && hi-lo>0.004){ var w=hi-lo; for(var x=lo-w; x>-0.0001; x-=w) h+=tick(x); for(var y=hi+w; y<1.0001; y+=w) h+=tick(y); }
    if(tk.innerHTML!==h) tk.innerHTML=h;
  }
  function renderAll(){ hosts.forEach(render); if(window.fit12) fit12(false); }
  function updateAll(){ hosts.forEach(update); }
  window.__calUpdate = updateAll;
  var pend=false;
  new MutationObserver(function(){ if(pend) return; pend=true; requestAnimationFrame(function(){ pend=false; scan(); }); }).observe(document.body, {childList:true, subtree:true});
  window.addEventListener("resize", function(){ updateAll(); });
  scan();
})();
