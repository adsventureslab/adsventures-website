(function(){
"use strict";
var root=document.documentElement;
var mqReduce=window.matchMedia("(prefers-reduced-motion: reduce)");
var reduced=mqReduce.matches;
if(reduced)root.classList.add("reduced");
if("scrollRestoration" in history)history.scrollRestoration="manual";
var C=JSON.parse(document.getElementById("site-content").textContent);
var hasGsap=typeof window.gsap!=="undefined",hasST=hasGsap&&!!window.ScrollTrigger;
if(hasST)gsap.registerPlugin(ScrollTrigger);
var isMobile=function(){return window.innerWidth<900};

/* ================= safe renderer ================= */
function get(path){return path.split(".").reduce(function(o,k){return o==null?o:o[k]},C)}
function h(tag,attrs,kids){
  var el=document.createElement(tag);
  if(attrs)Object.keys(attrs).forEach(function(k){var v=attrs[k];if(v==null||v===false)return;if(k==="class")el.className=v;else if(k==="text")el.textContent=v;else el.setAttribute(k,v)});
  (kids||[]).forEach(function(c){if(c==null||c===false)return;el.appendChild(typeof c==="string"?document.createTextNode(c):c)});
  return el;
}
function safeUrl(u){u=String(u||"");return /^(https?:|#|\/|data:image\/(png|jpe?g|webp|gif|svg\+xml);|data:video\/)/i.test(u)?u:""}
var SVGNS="http://www.w3.org/2000/svg";
function s(tag,attrs){var e=document.createElementNS(SVGNS,tag);if(attrs)Object.keys(attrs).forEach(function(k){e.setAttribute(k,attrs[k])});return e}
var ICONS={
  users:'M16 19v-1a4 4 0 00-4-4H6a4 4 0 00-4 4v1M9 10a4 4 0 100-8 4 4 0 000 8zM22 19v-1a4 4 0 00-3-3.9M16 2.1a4 4 0 010 7.8',
  user:'M20 21v-1a5 5 0 00-5-5H9a5 5 0 00-5 5v1M12 11a4 4 0 100-8 4 4 0 000 8z',
  heart:'M12 20s-7-4.4-9.2-8.6C1.3 8.4 3 5 6.4 5c2 0 3.6 1.2 4.6 2.6C12 6.2 13.6 5 15.6 5 19 5 20.7 8.4 19.2 11.4 17 15.6 12 20 12 20z',
  bag:'M5 8h14l-1 12H6zM9 8V6a3 3 0 016 0v2',
  chart:'M3 20h18M6 16v-4M11 16V8M16 16v-6M21 4l-5 5-4-3-5 5',
  calendar:'M4 5h16v15H4zM4 10h16M9 3v4M15 3v4',
  camera:'M3 8a2 2 0 012-2h2l1.5-2h7L17 6h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2zM12 17a4 4 0 100-8 4 4 0 000 8z',
  scissors:'M6 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12',
  target:'M12 22a10 10 0 100-20 10 10 0 000 20zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z',
  compass:'M12 21a9 9 0 100-18 9 9 0 000 18zM15.5 8.5l-2 5-5 2 2-5z',
  check:'M4 12.5l5 5 11-11',plus:'M12 5v14M5 12h14',
  star:'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  play:'M7 4v16l13-8z',pause:'M7 4h3v16H7zM14 4h3v16h-3z',arrow:'M5 12h14M13 6l6 6-6 6',left:'M15 5l-7 7 7 7',right:'M9 5l7 7-7 7',x:'M6 6l12 12M18 6L6 18',
  comment:'M4 5h16v11H9l-5 4z',send:'M21 3L10 14M21 3l-7 18-4-7-7-4z',flag:'M5 21V4M5 4h11l-2 4 2 4H5'
};
function icon(name,fill){
  var e=s("svg",{viewBox:"0 0 24 24","aria-hidden":"true",fill:fill?"currentColor":"none"});
  if(!fill){e.setAttribute("stroke","currentColor");e.setAttribute("stroke-width","1.8");e.setAttribute("stroke-linecap","round");e.setAttribute("stroke-linejoin","round")}
  e.appendChild(s("path",{d:ICONS[name]||ICONS.check}));return e;
}
function mount(id,nodes){var el=document.getElementById(id);nodes.forEach(function(n){if(n)el.appendChild(n)});return el}
function rich(el,str){String(str||"").split(/(\*[^*]+\*)/).forEach(function(p){if(/^\*[^*]+\*$/.test(p))el.appendChild(h("em",{text:p.slice(1,-1)}));else if(p)el.appendChild(document.createTextNode(p))})}
function initial(n){var m=String(n||"").replace(/[^A-Za-z]/g,"");return m?m.charAt(0).toUpperCase():"A"}
function pad(n){return String(n).padStart(2,"0")}

/* contour-line texture (the brand's mountain map motif) */
function topo(stroke,alpha,seed){
  var w=1200,hh=1200,out='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+hh+'" fill="none" stroke="'+stroke+'" stroke-opacity="'+alpha+'" stroke-width="1.6">';
  [[380,420],[860,760]].forEach(function(c,ci){
    for(var r=40;r<560;r+=34){
      var d="";for(var a=0;a<=64;a++){var t=a/64*Math.PI*2,k=r*(1+.10*Math.sin(3*t+seed+ci+r*.004)+.06*Math.sin(5*t+seed*2+r*.01)+.03*Math.sin(9*t+ci));d+=(a?"L":"M")+(c[0]+Math.cos(t)*k).toFixed(1)+" "+(c[1]+Math.sin(t)*k*.82).toFixed(1)}
      out+='<path d="'+d+'Z"/>';
    }
  });
  out+="</svg>";
  return 'url("data:image/svg+xml,'+encodeURIComponent(out)+'")';
}
root.style.setProperty("--topo",topo("#F36F25",.35,1.3));
root.style.setProperty("--topo-ink",topo("#141416",1,2.1));

/* ================= bindings ================= */
document.querySelectorAll("[data-text]").forEach(function(el){var v=get(el.dataset.text);if(v!=null)el.textContent=v});
document.querySelectorAll("[data-rich]").forEach(function(el){rich(el,get(el.dataset.rich))});
var logo=safeUrl(C.brand.logo);
["logo-h","logo-f","logo-c","logo-w"].forEach(function(id){document.getElementById(id).src=logo});

/* menu */
mount("menu-links",C.nav.links.map(function(l,i){return h("li",null,[h("a",{href:safeUrl(l.href),style:"--i:"+i},[h("span",{class:"t",text:l.label}),icon("arrow")])])}));
mount("menu-contact",C.contact.details.slice(0,2).map(function(d){return h("span",{text:d.value})}));

/* welcome notifications */
(function(){var w=document.getElementById("welcome");var pos=[[6,18],[70,14],[4,72],[68,76]];
  C.welcome.notifications.forEach(function(n,i){var p=pos[i%4];w.appendChild(h("div",{class:"notif",style:"left:"+p[0]+"%;top:"+p[1]+"%"},[h("span",{class:"ni"},[icon(n.icon)]),h("span",null,[n.title,h("small",{text:n.sub})])]))});})();

/* about: story stops */
mount("stops",C.about.chapters.map(function(c,i){
  var card=h("div",{class:"card"},[
    c.final?h("span",{class:"flag"},[icon("flag")]):null,
    h("span",{class:"chapter",text:"Chapter "+(i+1)+(c.year?" · "+c.year:"")+" · "+c.chapter}),
    h("h3",{text:c.name}),c.full?h("div",{class:"abbr",text:c.full}):null,
    h("p",{text:c.text}),
    h("dl",{class:"grow"},[h("div",null,[h("dt",null,[icon("plus"),"What we adopted"]),h("dd",{text:c.adopted})]),h("div",null,[h("dt",null,[icon("chart"),"What we improved"]),h("dd",{text:c.improved})])])
  ]);
  if(c.final&&C.about.founders&&C.about.founders.length){card.appendChild(h("div",{class:"founders"},C.about.founders.map(function(f){var src=safeUrl(f.photo);return h("div",{class:"founder"},[h("span",{class:"ph-img"},[src?h("img",{src:src,alt:f.name}):"Photo"]),h("span",null,[h("b",{text:f.name}),h("span",{text:f.role})])])})))}
  return h("li",{class:"stop"+(c.final?" final":"")},[h("span",{class:"node","aria-hidden":"true"}),card]);
}));

/* trusted strip (auto-scrolling) */
(function(){var t=document.getElementById("marquee-track");var list=C.clients.list.filter(function(b){return b.featured}).slice(0,10);
  [0,1].forEach(function(r){list.forEach(function(b){var src=safeUrl(b.logo);var c=h("div",{class:"mcard"},[src?h("img",{src:src,alt:r?"":b.name,loading:"lazy"}):b.name]);if(r)c.setAttribute("aria-hidden","true");t.appendChild(c)})});
  var btn=document.getElementById("pause"),m=document.getElementById("marquee");btn.appendChild(icon("pause",true));
  if(reduced){m.classList.add("paused");btn.hidden=true}
  btn.addEventListener("click",function(){var p=!m.classList.contains("paused");m.classList.toggle("paused",p);btn.setAttribute("aria-pressed",String(p));btn.setAttribute("aria-label",p?"Play the moving brand list":"Pause the moving brand list");btn.replaceChildren(icon(p?"play":"pause",true))});
})();

/* all brands directory */
(function(){
  var L=C.clients.list,inds=[];L.forEach(function(b){if(inds.indexOf(b.industry)<0)inds.push(b.industry)});
  var f=document.getElementById("dir-filters"),now=document.getElementById("cl-now");
  ["All brands"].concat(inds).forEach(function(name,i){var n=i===0?L.length:L.filter(function(b){return b.industry===name}).length;
    f.appendChild(h("button",{class:"cl-opt",type:"button","aria-pressed":i===0?"true":"false","data-f":i===0?"*":name},[h("span",{text:name}),h("small",{text:String(n)})]))});
  mount("dir",L.map(function(b){var src=safeUrl(b.logo);return h("div",{class:"btile","data-ind":b.industry,tabindex:"0"},[src?h("img",{src:src,alt:b.name,loading:"lazy"}):h("span",{text:b.name}),h("span",{class:"ind",text:b.industry})])}));
  function label(v,n){now.textContent=(v==="*"?"All brands":v)+" · "+n+" brand"+(n===1?"":"s")}
  label("*",L.length);
  f.addEventListener("click",function(e){var b=e.target.closest(".cl-opt");if(!b)return;f.querySelectorAll(".cl-opt").forEach(function(x){x.setAttribute("aria-pressed",String(x===b))});
    var v=b.dataset.f,shown=[];document.querySelectorAll("#dir .btile").forEach(function(t){var on=v==="*"||t.dataset.ind===v;t.hidden=!on;if(on)shown.push(t)});
    label(v,shown.length);
    if(hasGsap&&!reduced)gsap.fromTo(shown,{opacity:0,scale:.96},{opacity:1,scale:1,duration:.45,stagger:.025,ease:"power2.out"});
    if(hasST)ScrollTrigger.refresh();});
})();

/* services: one illustration per service, replaced by an uploaded image when set */
function svcArt(kind,icn){
  var el;
  if(kind==="calendar"){var cal=h("div",{class:"mk-cal"});var pl={2:"p",5:"r",9:"p",12:"p",16:"r",19:"p",23:"p",26:"r",30:"p"};for(var d=0;d<35;d++)cal.appendChild(h("i",{class:pl[d]||""}));
    el=h("div",{class:"mk"},[h("div",{class:"mk-h"},["Content calendar",h("span",{text:"30 days"})]),cal,h("div",{class:"mk-legend"},[h("span",null,[h("b",{style:"background:#F36F25"}),"Reel"]),h("span",null,[h("b",{style:"background:#141416"}),"Ad"]),h("span",null,[h("b",{style:"background:#F7F7F4;border:1px solid #E2E1DC"}),"Post"])])])}
  else if(kind==="shoot"){el=h("div",{class:"mk-vf"},[h("div",{class:"grid3"}),h("div",{class:"rec"},[h("b",{text:"REC"}),h("span",{text:"4K · 24 fps"})]),h("div",{class:"fr"}),h("div",{class:"btm"},[h("span",{text:"00:12"}),h("span",{class:"shutter"}),h("span",{text:"9:16"})])])}
  else if(kind==="edit"){var tr=h("div",{class:"mk-tracks"},[
      h("div",null,[h("b",{style:"width:30%;background:#F36F25"}),h("b",{style:"width:22%;background:#FDB98F"}),h("b",{style:"width:40%;background:#F36F25"})]),
      h("div",null,[h("b",{style:"width:18%;background:#141416"}),h("b",{style:"width:50%;background:#4B4B52"}),h("b",{style:"width:24%;background:#141416"})]),
      h("div",null,[h("b",{style:"width:92%;background:#FDE6D7"})]),h("span",{class:"ph-line"})]);
    el=h("div",{class:"mk"},[h("div",{class:"mk-h"},["Edit timeline",h("span",{text:"Captions on"})]),h("div",{class:"mk-prev"}),tr])}
  else if(kind==="ads"){el=h("div",{class:"mk mk-ad"},[h("div",{class:"who"},[h("i"),h("span",null,["Your brand",h("small",{text:"Sponsored"})])]),h("div",{class:"img"}),h("div",{class:"cta"},[h("span",{text:"Shop now"}),icon("heart")]),
      h("div",{class:"mk-float"},[h("i",null,[icon("target")]),"New lead"]),h("div",{class:"mk-float b"},[h("i",null,[icon("users")]),"Right audience"])])}
  else if(kind==="brand"){el=h("div",{class:"mk mk-brand"},[h("div",{class:"mk-h"},["Brand guidelines",h("span",{text:"v1.0"})]),h("div",{class:"sw"},[h("i",{style:"background:#F36F25"}),h("i",{style:"background:#141416"}),h("i",{style:"background:#FFF1E7"}),h("i",{style:"background:#FFFFFF"})]),h("div",{class:"ty"},[h("b",{text:"Aa"}),h("span",{class:"mark"}),h("span",null,["Tone of voice",h("br"),"Friendly · Bold"])])])}
  else{var bars=h("div",{class:"mk-bars"});[34,48,40,62,58,80,100].forEach(function(v){bars.appendChild(h("i",{style:"height:"+v+"%"}))});
    el=h("div",{class:"mk"},[h("div",{class:"mk-h"},["Monthly report",h("span",{text:"This month"})]),bars,h("div",{class:"mk-kpis"},[h("div",null,[h("b",null,["Reach ",h("em",{text:"▲"})]),"vs last month"]),h("div",null,[h("b",null,["Leads ",h("em",{text:"▲"})]),"vs last month"])])])}
  return el;
}
mount("svc-stack",C.services.items.map(function(sv,i){
  var alt=i%3===1,src=safeUrl(sv.image);
  return h("article",{class:"svc"+(alt?" alt":""),style:"--i:"+i},[
    h("div",{class:"svc-txt"},[h("div",null,[h("div",{class:"num","aria-hidden":"true",text:pad(i+1)}),h("h3",{text:sv.title,style:"margin-top:14px"}),h("p",{text:sv.text,style:"margin-top:14px"})]),h("ul",null,(sv.includes||[]).map(function(x){return h("li",{text:x})}))]),
    h("div",{class:"svc-art"},[src?h("img",{src:src,alt:sv.title,loading:"lazy"}):h("div",{"aria-hidden":"true",style:"display:contents"},[svcArt(sv.art,sv.icon)])])
  ]);
}));

/* achievements */
mount("stats",C.achievements.items.map(function(a){return h("div",{class:"stat"},[h("div",{class:"n","data-value":a.value},[h("span",{class:"v",text:Number(a.value).toLocaleString()}),h("span",{class:"suf",text:a.suffix||""})]),h("span",{class:"lbl",text:a.label})])}));
(function(){var t=document.getElementById("ticker"),w=C.achievements.ticker||[];[0,1,2].forEach(function(){w.forEach(function(x){t.appendChild(h("span",{text:x}))})})})();
(function(){var h2=document.getElementById("ach-title");h2.classList.add("ach-title");var parts=[];
  [].slice.call(h2.childNodes).forEach(function(n){if(n.nodeType===3){n.textContent.split(/(\s+)/).forEach(function(w){if(!w)return;if(/^\s+$/.test(w))parts.push(document.createTextNode(w));else parts.push(h("span",{class:"w"},[h("span",{text:w})]))})}else{parts.push(h("span",{class:"w"},[n]))}});
  h2.replaceChildren.apply(h2,parts);})();

/* portfolio */
mount("pf-tabs",[["#pf-graphics",C.portfolio.graphics.title],["#pf-ads",C.portfolio.ads.title],["#pf-results",C.portfolio.results.title]].map(function(t,i){return h("a",{class:"chipbtn",href:t[0],style:"text-decoration:none"},[h("small",{text:pad(i+1)}),t[1]])}));
var tints=["linear-gradient(160deg,#FBE3D3,#FFFFFF)","linear-gradient(160deg,#ECEBE6,#FFFFFF)","linear-gradient(160deg,#FCD7C0,#F7F7F4)","linear-gradient(200deg,#F7F7F4,#FDE6D7)"];
function homeList(sec){var n=sec.showOnHome||sec.items.length;return sec.items.slice(0,n)}
mount("htrack",homeList(C.portfolio.graphics).map(function(g,i){
  var src=safeUrl(g.image);
  return h("button",{class:"gfx "+(g.size||"square"),type:"button","data-all":"graphics","data-cursor":"view",style:"background:"+tints[i%4]},[src?h("img",{src:src,alt:g.title,loading:"lazy"}):h("span",{class:"ph",text:"Your graphic here"}),h("span",{class:"cap"},[h("b",{text:g.title}),h("span",{text:g.client})])]);
}).concat([h("button",{class:"gfx more",type:"button","data-all":"graphics","data-cursor":"view"},[h("span",{class:"arw"},[icon("arrow")]),h("b",{text:C.portfolio.graphics.seeAll}),h("span",{class:"n",text:C.portfolio.graphics.items.length+" designs"})])]));
function adMedia(a,controls){
  var src=safeUrl(a.video),poster=safeUrl(a.poster);
  if(src){var v=h("video",{src:src,playsinline:"",preload:"metadata",loop:controls?null:"",controls:controls?"":null});if(poster)v.poster=poster;if(!controls)v.muted=true;return v}
  if(poster)return h("img",{src:poster,alt:a.title});
  return null;
}
function isLand(a){return a.orientation==="horizontal"}
function orientTag(a){return h("span",{class:"orient "+(isLand(a)?"h":"v")},[h("i"),isLand(a)?"Horizontal ad":"Vertical reel"])}
function phoneUi(a){return [h("div",{class:"side"},[icon("heart"),icon("comment"),icon("send")]),h("div",{class:"ui"},[h("b",{text:a.client}),h("small",{text:a.title})])]}
var ADS=homeList(C.portfolio.ads);
var adScreen=document.getElementById("ads-screen");
ADS.forEach(function(a,i){
  adScreen.appendChild(h("div",{class:"slide"+(i===0?" on":""),"data-i":i},[h("div",{class:"tint",style:"background:"+["linear-gradient(170deg,#3A2A22,#141416)","linear-gradient(170deg,#2A2A30,#141416)","linear-gradient(170deg,#4A2A18,#141416)"][i%3]}),adMedia(a)||h("span",{text:(isLand(a)?"Horizontal":"Vertical")+" video ad "+(i+1)+" plays here"})].concat(phoneUi(a))));
});
if(ADS[0])document.getElementById("ad-device").classList.toggle("land",isLand(ADS[0]));
mount("ad-items",ADS.map(function(a,i){
  var mp=h("div",{class:"mphone"},[h("div",{class:"phone"+(isLand(a)?" land":"")},[h("span",{class:"notch"}),h("div",{class:"screen"},[h("div",{class:"slide on"},[h("div",{class:"tint",style:"background:linear-gradient(170deg,#3A2A22,#141416)"}),adMedia(a)||h("span",{text:"Video ad "+(i+1)+" plays here"})].concat(phoneUi(a)))])])]);
  return h("article",{class:"ad-item","data-i":i},[mp,orientTag(a),h("span",{class:"client",text:a.client}),h("h4",{text:a.title}),h("dl",null,[h("div",null,[h("dt",{text:"The message"}),h("dd",{text:a.message})]),h("div",null,[h("dt",{text:"How we made it"}),h("dd",{text:a.how})])])]);
}));
function resCard(r,i){
  var sp=s("svg",{class:"spark",viewBox:"0 0 300 90",preserveAspectRatio:"none","aria-hidden":"true"});
  var pts=[[0,78],[40,70],[80,74],[120,58],[160,60],[200,40],[240,34],[300,12+(i%3)*6]];
  var d=pts.map(function(p,k){return (k?"L":"M")+p[0]+" "+p[1]}).join(" ");
  sp.appendChild(s("path",{d:d+" L300 90 L0 90Z",fill:"#F36F25","fill-opacity":".12"}));
  sp.appendChild(s("path",{class:"sl",d:d,fill:"none",stroke:"#F36F25","stroke-width":"3"}));
  return h("article",{class:"res"},[h("div",{class:"res-top"},[h("b",{text:r.client}),h("span",{text:r.industry})]),sp,h("div",{class:"res-kpis"},r.kpis.map(function(k){return h("div",null,[h("strong",{text:k.value}),h("small",{text:k.label})])})),h("div",{class:"obj",text:r.objective})]);
}
mount("results",homeList(C.portfolio.results).map(resCard));

/* all-work page */
var allwork=document.getElementById("allwork"),awTabs=document.getElementById("aw-tabs"),awPanel=document.getElementById("aw-panel"),awOpener=null;
var AW=[["graphics",C.portfolio.graphics.title],["ads",C.portfolio.ads.title],["results",C.portfolio.results.title]];
AW.forEach(function(t,i){awTabs.appendChild(h("button",{class:"chipbtn",role:"tab",type:"button","aria-selected":"false","data-k":t[0],id:"aw-tab-"+t[0],"aria-controls":"aw-panel"},[t[1]+" ",h("small",{text:"("+C.portfolio[t[0]].items.length+")"})]))});
function awShow(k){
  awTabs.querySelectorAll("button").forEach(function(b){var on=b.dataset.k===k;b.setAttribute("aria-selected",String(on));b.tabIndex=on?0:-1});
  awPanel.setAttribute("aria-labelledby","aw-tab-"+k);
  var node;
  if(k==="graphics")node=h("div",{class:"aw-cols"},C.portfolio.graphics.items.map(function(g,i){var src=safeUrl(g.image),ar={tall:"4/5",square:"1/1",wide:"16/10"}[g.size]||"1/1";return h("div",{class:"aw-g",style:"aspect-ratio:"+ar+";background:"+tints[i%4]},[src?h("img",{src:src,alt:g.title,loading:"lazy"}):h("span",{class:"ph",text:"Your graphic here"}),h("span",{class:"cap"},[h("b",{text:g.title}),h("span",{text:g.client})])])}));
  else if(k==="ads")node=h("div",{class:"aw-cols"},C.portfolio.ads.items.map(function(a,i){return h("article",{class:"aw-v"},[h("div",{class:"vid",style:"aspect-ratio:"+(isLand(a)?"16/9":"9/16")},[adMedia(a,true)||h("span",{text:"Video ad "+(i+1)})]),h("div",{class:"txt"},[orientTag(a),h("small",{text:a.client}),h("b",{text:a.title}),h("p",null,[h("strong",{text:"The message: "}),a.message]),h("p",null,[h("strong",{text:"How we made it: "}),a.how])])])}));
  else node=h("div",{class:"aw-res"},C.portfolio.results.items.map(resCard));
  awPanel.replaceChildren(node);
  if(hasGsap&&!reduced)gsap.from(node.children,{y:40,opacity:0,duration:.7,stagger:.05,ease:"expo.out"});
}
awTabs.addEventListener("click",function(e){var b=e.target.closest("button");if(b)awShow(b.dataset.k)});
awTabs.addEventListener("keydown",function(e){if(e.key!=="ArrowRight"&&e.key!=="ArrowLeft")return;var bs=[].slice.call(awTabs.querySelectorAll("button")),i=bs.indexOf(document.activeElement),n=bs[(i+(e.key==="ArrowRight"?1:-1)+bs.length)%bs.length];n.focus();awShow(n.dataset.k)});
function openAll(k){awOpener=document.activeElement;awShow(k);allwork.classList.add("open");allwork.scrollTop=0;if(lenis)lenis.stop();document.body.classList.add("locked");setTimeout(function(){var b=awTabs.querySelector('[aria-selected="true"]');if(b)b.focus()},reduced?0:300)}
function closeAll(){if(!allwork.classList.contains("open"))return;allwork.classList.remove("open");allwork.querySelectorAll("video").forEach(function(v){v.pause()});if(lenis)lenis.start();document.body.classList.remove("locked");if(awOpener&&awOpener.focus)awOpener.focus({preventScroll:true})}
document.addEventListener("click",function(e){var b=e.target.closest("[data-all]");if(b){e.preventDefault();openAll(b.dataset.all)}});
document.getElementById("aw-close").addEventListener("click",closeAll);
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&allwork.classList.contains("open"))closeAll()});

/* process */
(function(){
  var steps=C.process.steps,roll=document.getElementById("proll");
  steps.forEach(function(x,i){roll.appendChild(h("span",{text:pad(i+1)}))});
  mount("psteps",steps.map(function(x,i){return h("div",{class:"pst"+(i===0?" on":"")},[h("h3",{text:x.title}),h("p",{text:x.text}),h("span",{class:"spec",text:x.spec})])}));
  var svg=document.getElementById("proc-svg");
  var d="M0 500 L90 450 L170 480 L280 380 L360 420 L480 310 L570 350 L700 210 L790 260 L920 70 L1000 140";
  svg.appendChild(s("path",{d:"M0 520 L0 500 L90 450 L170 480 L280 380 L360 420 L480 310 L570 350 L700 210 L790 260 L920 70 L1000 140 L1000 520Z",fill:"#FFFFFF",opacity:".7"}));
  svg.appendChild(s("path",{d:d,fill:"none",stroke:"#D9D7D0","stroke-width":"4","stroke-dasharray":"2 12","stroke-linecap":"round"}));
  svg.appendChild(s("path",{id:"proc-line",d:"M90 450 L170 480 L280 380 L360 420 L480 310 L570 350 L700 210 L790 260 L920 70",fill:"none",stroke:"#F36F25","stroke-width":"7","stroke-linecap":"round","stroke-linejoin":"round"}));
  var camps=[[90,450],[280,380],[480,310],[700,210],[920,70]];
  camps.forEach(function(c,i){var g=s("g",{class:"camp"+(i===0?" on":""),"data-i":i});g.appendChild(s("circle",{class:"c",cx:c[0],cy:c[1],r:16}));var t=s("text",{x:c[0],y:c[1]-34,"text-anchor":"middle"});t.textContent=steps[i]?steps[i].title:"";g.appendChild(t);svg.appendChild(g)});
  var mk=s("g",{id:"proc-marker"});mk.appendChild(s("line",{x1:0,y1:0,x2:0,y2:-70,stroke:"#141416","stroke-width":"4","stroke-linecap":"round"}));mk.appendChild(s("path",{d:"M2 -68 L52 -54 L2 -40Z",fill:"#F36F25"}));svg.appendChild(mk);
})();

/* testimonials */
var V=C.testimonials.videos,R=C.testimonials.reviews,cur=0;
mount("rings",V.map(function(v,i){var src=safeUrl(v.photo);return h("button",{class:"ring",type:"button","aria-current":i===0?"true":"false","data-i":i},[h("span",{class:"rimg"},[h("span",null,[src?h("img",{src:src,alt:""}):initial(v.name)])]),h("b",{text:v.name}),h("small",{text:v.company})])}));
document.getElementById("sbars").append.apply(document.getElementById("sbars"),V.map(function(){return h("i",null,[h("b")])}));
document.getElementById("splay").appendChild(icon("play",true));
function showStory(i){
  cur=(i+V.length)%V.length;var v=V[cur];
  document.querySelectorAll(".ring").forEach(function(r){r.setAttribute("aria-current",String(+r.dataset.i===cur))});
  document.querySelectorAll("#sbars i").forEach(function(b,k){b.classList.toggle("done",k<cur);b.querySelector("b").style.width=k<cur?"100%":"0"});
  var src=safeUrl(v.photo);
  document.getElementById("swho").replaceChildren(h("span",{class:"av"},[src?h("img",{src:src,alt:""}):initial(v.name)]),h("span",null,[h("b",{text:v.name}),h("small",{text:v.company})]));
  var m=document.getElementById("smedia"),vs=safeUrl(v.video),ps=safeUrl(v.poster);
  m.replaceChildren(vs?h("video",{src:vs,playsinline:"",preload:"metadata",poster:ps||null}):ps?h("img",{src:ps,alt:""}):h("span",{class:"ph",style:"color:#BDBDC4",text:"Video review "+(cur+1)+" plays here"}));
  var vid=m.querySelector("video"),pb=document.getElementById("splay");pb.hidden=false;pb.replaceChildren(icon("play",true));pb.setAttribute("aria-label","Play video review");
  if(vid){vid.addEventListener("timeupdate",function(){var b=document.querySelectorAll("#sbars i")[cur];if(b&&vid.duration)b.querySelector("b").style.width=(vid.currentTime/vid.duration*100)+"%"});vid.addEventListener("ended",function(){showStory(cur+1)})}
  document.getElementById("smeta").replaceChildren(h("blockquote",{text:v.quote}),h("p",{text:v.name+", "+v.company}));
}
document.getElementById("rings").addEventListener("click",function(e){var r=e.target.closest(".ring");if(r)showStory(+r.dataset.i)});
document.getElementById("sprev").addEventListener("click",function(){showStory(cur-1)});
document.getElementById("snext").addEventListener("click",function(){showStory(cur+1)});
document.getElementById("splay").addEventListener("click",function(){
  var vid=document.querySelector("#smedia video"),pb=this;
  if(!vid){var bar=document.querySelectorAll("#sbars i")[cur].querySelector("b");if(hasGsap&&!reduced)gsap.fromTo(bar,{width:"0%"},{width:"100%",duration:2.5,ease:"none",onComplete:function(){showStory(cur+1)}});else showStory(cur+1);return}
  if(vid.paused){vid.play().catch(function(){});pb.replaceChildren(icon("pause",true));pb.setAttribute("aria-label","Pause video review")}else{vid.pause();pb.replaceChildren(icon("play",true));pb.setAttribute("aria-label","Play video review")}
});
showStory(0);
mount("dm",R.map(function(r,i){
  var stars=h("span",{class:"stars",role:"img","aria-label":r.rating+" out of 5 stars"});for(var k=0;k<(r.rating||0);k++)stars.appendChild(icon("star",true));
  return h("div",{class:"dm-row"+(i%2?" r":"")},[h("span",{class:"dm-av","aria-hidden":"true",text:initial(r.name)}),h("div",{class:"bubble"},[h("div",{class:"meta"},[h("b",null,[r.name+" ",h("span",{text:"· "+r.company})]),stars]),h("p",{text:r.text})])]);
}));
(function(){var tv=document.getElementById("tab-v"),tt=document.getElementById("tab-t"),pv=document.getElementById("panel-v"),pt=document.getElementById("panel-t"),played=false;
  function sel(v){tv.setAttribute("aria-selected",String(v));tt.setAttribute("aria-selected",String(!v));tv.tabIndex=v?0:-1;tt.tabIndex=v?-1:0;pv.hidden=!v;pt.hidden=v;
    if(!v&&!played){played=true;playDM()}if(hasST)ScrollTrigger.refresh()}
  tv.addEventListener("click",function(){sel(true)});tt.addEventListener("click",function(){sel(false)});
  [tv,tt].forEach(function(b){b.addEventListener("keydown",function(e){if(e.key==="ArrowRight"||e.key==="ArrowLeft"){e.preventDefault();var to=b===tv?tt:tv;to.focus();sel(to===tv)}})});
})();
function playDM(){
  if(!hasGsap||reduced)return;
  var rows=[].slice.call(document.querySelectorAll(".dm-row"));
  gsap.set(rows,{opacity:0,y:20});
  var tl=gsap.timeline();
  rows.forEach(function(r){
    var t=h("div",{class:"dm-row"+(r.classList.contains("r")?" r":"")},[h("span",{class:"dm-av",text:"",style:"visibility:hidden"}),h("span",{class:"typing"},[h("i"),h("i"),h("i")])]);
    tl.add(function(){r.parentNode.insertBefore(t,r)}).to({},{duration:.7}).add(function(){t.remove()}).to(r,{opacity:1,y:0,duration:.5,ease:"back.out(1.6)"});
  });
}

/* packages */
function pkgArt(p){
  var e=s("svg",{viewBox:"0 0 400 170",preserveAspectRatio:"none","aria-hidden":"true"});
  var top=[130,60,95][p.level-1]||100,dark=p.featured;
  e.appendChild(s("path",{d:"M0 170 L0 150 L90 120 L160 140 L250 "+top+" L330 135 L400 120 L400 170Z",fill:dark?"#2A2A30":"#FFFFFF"}));
  e.appendChild(s("path",{d:"M0 150 L90 120 L160 140 L250 "+top+" L330 135 L400 120",fill:"none",stroke:"#F36F25","stroke-width":"3"}));
  if(p.level===3){e.appendChild(s("line",{x1:250,y1:top,x2:250,y2:top-40,stroke:dark?"#FFFFFF":"#141416","stroke-width":"3"}));e.appendChild(s("path",{d:"M251 "+(top-40)+" L282 "+(top-31)+" L251 "+(top-22)+"Z",fill:"#F36F25"}))}
  else if(p.level===2){var c=s("circle",{cx:250,cy:top-26,r:16,fill:"none",stroke:"#141416","stroke-width":"3"});e.appendChild(c);e.appendChild(s("path",{d:"M250 "+(top-38)+" L255 "+(top-26)+" L250 "+(top-14)+" L245 "+(top-26)+"Z",fill:"#F36F25"}))}
  else{e.appendChild(s("circle",{cx:250,cy:top,r:7,fill:"#F36F25"}))}
  return e;
}
mount("packages-list",C.packages.items.map(function(p){
  var ul=h("ul",null,p.features.map(function(f){var plus=f.charAt(0)==="+";return h("li",{class:plus?"plus":null},[h("span",{class:"ck"},[icon(plus?"plus":"check")]),plus?f.slice(1):f])}));
  return h("article",{class:"pkg"+(p.featured?" featured":"")},[
    p.badge?h("span",{class:"badge",text:p.badge}):null,
    h("div",{class:"pkg-art"},[h("div",{class:"topo"}),pkgArt(p),h("span",{class:"alt",text:p.altitude})]),
    h("div",{class:"pkg-body"},[h("div",{class:"name"},[h("h3",{text:p.name}),h("span",{class:"tag",text:p.tag})]),h("p",{class:"for",text:p["for"]}),ul,
      h("a",{class:"btn "+(p.featured?"btn-primary":"btn-ghost"),href:"#contact","data-pkg":p.id},[h("span",{text:p.button}),p.featured?h("span",{class:"dot","aria-hidden":"true"}):null])])
  ]);
}));
document.getElementById("f-pkg").append.apply(document.getElementById("f-pkg"),[h("option",{value:"unsure",text:"Not sure yet, help me choose"})].concat(C.packages.items.map(function(p){return h("option",{value:p.id,text:p.name+" ("+p.tag+")"})})));

/* faq */
mount("faq-list",C.faq.items.map(function(f){return h("details",null,[h("summary",null,[h("span",{text:f.q}),h("span",{class:"pm","aria-hidden":"true"})]),h("p",{class:"ans",text:f.a})])}));

/* gallery */
var G=C.gallery.items,gi=0;
mount("gal-filters",C.gallery.filters.map(function(f,i){return h("button",{class:"chipbtn",type:"button","aria-pressed":i===0?"true":"false","data-f":f,text:f})}));
mount("gallery-grid",G.map(function(g,i){var src=safeUrl(g.image);
  return h("button",{class:"gitem",type:"button","data-i":i,"data-cat":g.category,"data-cursor":"view","aria-label":"Open "+g.caption},[h("span",{class:"gimg",style:"aspect-ratio:"+(g.ratio||"1/1")+";background:"+tints[i%4]},[src?h("img",{src:src,alt:"",loading:"lazy"}):h("span",{class:"ph",text:g.category+" photo"})]),h("span",{class:"gcap",text:g.caption})])}));
document.getElementById("gal-filters").addEventListener("click",function(e){var b=e.target.closest(".chipbtn");if(!b)return;this.querySelectorAll(".chipbtn").forEach(function(x){x.setAttribute("aria-pressed",String(x===b))});
  document.querySelectorAll(".gitem").forEach(function(it){it.hidden=!(b.dataset.f==="All"||it.dataset.cat===b.dataset.f)});if(hasST)ScrollTrigger.refresh()});
var lb=document.getElementById("lightbox");
document.getElementById("lb-prev").appendChild(icon("left"));document.getElementById("lb-next").appendChild(icon("right"));document.getElementById("lb-close").appendChild(icon("x"));
function lbShow(i){var vis=[].slice.call(document.querySelectorAll(".gitem:not([hidden])")).map(function(x){return +x.dataset.i});if(!vis.length)return;var pos=vis.indexOf(i);if(pos<0)pos=0;gi=vis[(pos+vis.length)%vis.length];
  var g=G[gi],src=safeUrl(g.image);document.getElementById("lb-img").replaceChildren(src?h("img",{src:src,alt:g.caption}):h("span",{class:"ph",text:g.caption}));document.getElementById("lb-cap").textContent=g.caption;}
function lbStep(d){var vis=[].slice.call(document.querySelectorAll(".gitem:not([hidden])")).map(function(x){return +x.dataset.i});var p=vis.indexOf(gi);gi=vis[(p+d+vis.length)%vis.length];lbShow(gi)}
document.getElementById("gallery-grid").addEventListener("click",function(e){var it=e.target.closest(".gitem");if(!it)return;lbShow(+it.dataset.i);if(lb.showModal){lb.showModal();if(lenis)lenis.stop()}});
document.getElementById("lb-prev").addEventListener("click",function(){lbStep(-1)});document.getElementById("lb-next").addEventListener("click",function(){lbStep(1)});
document.getElementById("lb-close").addEventListener("click",function(){lb.close()});
lb.addEventListener("close",function(){if(lenis)lenis.start()});
lb.addEventListener("click",function(e){if(e.target===lb)lb.close()});
lb.addEventListener("keydown",function(e){if(e.key==="ArrowRight")lbStep(1);if(e.key==="ArrowLeft")lbStep(-1)});

/* contact + footer */
(function(){var a=document.getElementById("cnt-ads"),r=document.getElementById("cnt-results");if(a)a.textContent="("+C.portfolio.ads.items.length+")";if(r)r.textContent="("+C.portfolio.results.items.length+")"})();
mount("cinfo",C.contact.details.map(function(d){return h("div",null,[h("span",{text:d.label}),h("span",{text:d.value})])}));
mount("foot-links",C.footer.links.map(function(l){return h("li",null,[h("a",{href:safeUrl(l.href),text:l.label})])}));

/* careers */
mount("perks",C.careers.perks.map(function(p){return h("div",{class:"perk"},[h("b",{text:p.title}),h("span",{text:p.text})])}));
var OPENJOBS=(C.careers.jobs||[]).filter(function(j){return j&&j.title&&j.open!==false});
mount("jobs",OPENJOBS.map(function(j,i){
  return h("details",{class:"job"},[h("summary",null,[h("div",null,[h("h3",{text:j.title}),h("div",{class:"tags"},[h("span",{text:j.type}),h("span",{text:j.location}),h("span",{text:j.experience})])]),h("span",{class:"pm","aria-hidden":"true"})]),
    h("div",{class:"body"},[h("div",null,[h("h4",{text:"About the role"}),h("p",{text:j.about}),h("button",{class:"btn btn-primary btn-sm",type:"button","data-job":j.title,style:"margin-top:20px"},[h("span",{text:"Apply for this role"}),h("span",{class:"dot","aria-hidden":"true"})])]),h("div",null,[h("h4",{text:"What you'll do"}),h("ul",null,j.duties.map(function(d){return h("li",{text:d})}))])])]);
}));
(function(){var jobs=OPENJOBS,sec=document.getElementById("openings");
  if(!sec||!jobs.length)return;sec.hidden=false;
  mount("openings-list",jobs.map(function(j){return h("a",{class:"opening",href:"#careers","data-open-job":j.title},[h("div",null,[h("h3",{text:j.title}),h("div",{class:"tags"},[j.type,j.location,j.experience].filter(Boolean).map(function(t){return h("span",{text:t})}))]),h("span",{class:"go","aria-hidden":"true"},[icon("arrow")])])}));
  sec.addEventListener("click",function(e){var b=e.target.closest("[data-open-job]");if(!b)return;e.preventDefault();openCareers();var role=document.getElementById("j-role");role.value=b.dataset.openJob;
    setTimeout(function(){var ap=document.getElementById("apply");careers.scrollTo({top:ap.offsetTop-90,behavior:reduced?"auto":"smooth"})},reduced?50:600)});
})();
document.getElementById("j-role").append.apply(document.getElementById("j-role"),[h("option",{value:"",text:"Choose a position"})].concat(OPENJOBS.map(function(j){return h("option",{value:j.title,text:j.title})})));

/* ================= smooth scroll ================= */
var lenis=null;
if(!reduced&&typeof window.Lenis==="function"){
  try{lenis=new Lenis({duration:1.1,smoothWheel:true,prevent:function(n){return !!(n.closest&&n.closest("#careers,#allwork,#menu,.lightbox"))}});
    if(hasGsap){if(hasST)lenis.on("scroll",ScrollTrigger.update);gsap.ticker.add(function(t){lenis.raf(t*1000)});gsap.ticker.lagSmoothing(0)}
    else{(function r(t){lenis.raf(t);requestAnimationFrame(r)})(0)}
  }catch(e){lenis=null}
}
var header=document.getElementById("site-header"),intro=document.getElementById("home");
function goTo(target){
  if(target==="#careers"){openCareers();return}
  var el=target==="#home"?null:document.querySelector(target);
  if(target!=="#home"&&!el)return;
  var off=el?-(header.offsetHeight+4):0;
  if(target==="#about")off=0;
  if(lenis)lenis.scrollTo(el||0,{offset:off,duration:1.4});
  else window.scrollTo({top:el?el.getBoundingClientRect().top+window.scrollY+off:0,behavior:reduced?"auto":"smooth"});
  if(el){el.setAttribute("tabindex","-1");el.focus({preventScroll:true})}
}
document.addEventListener("click",function(e){
  var a=e.target.closest('a[href^="#"]');if(!a)return;
  var id=a.getAttribute("href");if(id.length<2)return;
  if(a.closest("#careers")&&id!=="#careers"){closeCareers()}
  e.preventDefault();
  if(a.dataset.pkg)document.getElementById("f-pkg").value=a.dataset.pkg;
  if(root.classList.contains("menu-open")){closeMenu(false);setTimeout(function(){goTo(id)},reduced?0:380)}else goTo(id);
});
document.getElementById("skip-intro").addEventListener("click",function(){goTo("#about")});

function headerState(){
  var y=window.scrollY,end=intro.offsetTop+intro.offsetHeight-window.innerHeight*1.02;
  if(reduced||y>=end)header.classList.remove("pre");else header.classList.add("pre");
  header.classList.toggle("solid",y>intro.offsetHeight-window.innerHeight*.5);
}
window.addEventListener("scroll",function(){headerState();if(typeof hdrTone==="function")hdrTone()},{passive:true});window.addEventListener("resize",headerState);

/* menu */
var menu=document.getElementById("menu"),menuBtn=document.querySelector(".menu-btn");
function openMenu(){var r=menuBtn.getBoundingClientRect();menu.style.setProperty("--mx",(r.left+r.width/2)+"px");menu.style.setProperty("--my",(r.top+r.height/2)+"px");
  menu.classList.add("open");root.classList.add("menu-open");menuBtn.setAttribute("aria-expanded","true");menuBtn.setAttribute("aria-label","Close menu");
  if(lenis)lenis.stop();document.body.classList.add("locked");setTimeout(function(){var f=menu.querySelector("a");if(f)f.focus()},reduced?0:250)}
function closeMenu(refocus){if(!menu.classList.contains("open"))return;menu.classList.remove("open");root.classList.remove("menu-open");menuBtn.setAttribute("aria-expanded","false");menuBtn.setAttribute("aria-label","Open menu");
  if(lenis)lenis.start();document.body.classList.remove("locked");if(refocus!==false)menuBtn.focus()}
menuBtn.addEventListener("click",function(){menu.classList.contains("open")?closeMenu():openMenu()});
document.addEventListener("keydown",function(e){
  if(careers.classList.contains("open")&&e.key==="Escape"){closeCareers();return}
  if(!menu.classList.contains("open"))return;
  if(e.key==="Escape"){closeMenu();return}
  if(e.key==="Tab"){var f=[menuBtn].concat([].slice.call(menu.querySelectorAll("a"))),i=f.indexOf(document.activeElement);
    if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus()}}
});

/* careers page */
var careers=document.getElementById("careers"),careersOpener=null;
function openCareers(){careersOpener=document.activeElement;careers.classList.add("open");if(lenis)lenis.stop();document.body.classList.add("locked");if(location.hash!=="#careers")history.replaceState(null,"","#careers");setTimeout(function(){document.getElementById("car-close").focus()},reduced?0:300)}
function closeCareers(){if(!careers.classList.contains("open"))return;careers.classList.remove("open");if(lenis)lenis.start();document.body.classList.remove("locked");history.replaceState(null,"",location.pathname+location.search);if(careersOpener&&careersOpener.focus)careersOpener.focus()}
document.getElementById("car-close").addEventListener("click",closeCareers);
careers.addEventListener("click",function(e){var b=e.target.closest("[data-job]");if(!b)return;document.getElementById("j-role").value=b.dataset.job;var ap=document.getElementById("apply");careers.scrollTo({top:ap.offsetTop-90,behavior:reduced?"auto":"smooth"});setTimeout(function(){document.getElementById("j-name").focus({preventScroll:true})},500)});
window.addEventListener("hashchange",function(){if(location.hash==="#careers")openCareers()});

/* marquee-free; cursor */
if(!reduced&&window.matchMedia("(hover:hover) and (pointer:fine)").matches){
  var cu=document.querySelector(".cursor"),cd=document.querySelector(".cursor-dot"),mx=-100,my=-100,cx=-100,cy=-100;
  window.addEventListener("pointermove",function(e){mx=e.clientX;my=e.clientY;root.classList.add("has-cursor")},{passive:true});
  document.addEventListener("pointerleave",function(){root.classList.remove("has-cursor")});
  document.addEventListener("pointerover",function(e){var v=e.target.closest("[data-cursor='view']"),a=e.target.closest("a,button,summary,select,input,textarea,label");cu.classList.toggle("view",!!v);cu.classList.toggle("hover",!v&&!!a)});
  (function loop(){cx+=(mx-cx)*.16;cy+=(my-cy)*.16;cu.style.transform="translate3d("+cx+"px,"+cy+"px,0)";cd.style.transform="translate3d("+mx+"px,"+my+"px,0)";requestAnimationFrame(loop)})();
  /* package tilt */
  document.querySelectorAll(".pkg").forEach(function(c){
    c.addEventListener("pointermove",function(e){var r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;c.style.setProperty("--gx",x*100+"%");c.style.setProperty("--gy",y*100+"%");c.style.transform="rotateY("+((x-.5)*8).toFixed(2)+"deg) rotateX("+((.5-y)*8).toFixed(2)+"deg) translateY(-6px)"});
    c.addEventListener("pointerleave",function(){c.style.transform=""});
  });
}

/* ================= intro scene ================= */
var scene=document.getElementById("scene"),world=document.getElementById("world");
var ridge=document.getElementById("ridge"),L=ridge.getTotalLength();
var climber=document.getElementById("climber"),cbody=document.getElementById("cbody"),legA=document.getElementById("legA"),legB=document.getElementById("legB"),armA=document.getElementById("armA");
var areaClip=document.getElementById("areaClip"),chipsG=document.getElementById("chips");
(function(){var g=document.getElementById("grid");[940,780,620,460,300,140].forEach(function(y){g.appendChild(s("line",{x1:-1100,x2:2700,y1:y,y2:y,stroke:"#E6E5E0","stroke-dasharray":"4 10"}))})})();
var VB={x:0,y:-260,w:1600,h:1260};
function fitScene(){var a=window.innerWidth/window.innerHeight;scene.setAttribute("preserveAspectRatio",a>=VB.w/VB.h?"xMidYMax meet":"xMidYMax slice")}
fitScene();
var peaks=[[430,790],[720,630],[1000,460],[1230,290]];
var chips=peaks.map(function(p,i){
  var label=C.hero.milestones[i]||"",w=Math.max(150,label.length*15+70),x=p[0]-w/2,y=p[1]-(i===3?220:110);
  var g=s("g",{class:"chip"}),inner=s("g");
  inner.appendChild(s("line",{x1:p[0],x2:p[0],y1:y+56,y2:p[1]-14,stroke:"#D9D7D0","stroke-width":"2","stroke-dasharray":"3 6"}));
  inner.appendChild(s("rect",{x:x,y:y,width:w,height:56,rx:28}));
  inner.appendChild(s("circle",{cx:x+28,cy:y+28,r:8,fill:"#F36F25"}));
  var t=s("text",{x:x+46,y:y+37});t.textContent=label;inner.appendChild(t);
  g.appendChild(inner);g.appendChild(s("circle",{cx:p[0],cy:p[1],r:9,fill:"#FFFFFF",stroke:"#F36F25","stroke-width":"5"}));chipsG.appendChild(g);
  var best=0,bd=1e9;for(var k=0;k<=400;k++){var q=ridge.getPointAtLength(L*k/400),dd=Math.hypot(q.x-p[0],q.y-p[1]);if(dd<bd){bd=dd;best=k/400}}
  return {inner:inner,at:best,shown:false};
});
ridge.style.strokeDasharray=L;ridge.style.strokeDashoffset=L;
function pose(p,phase){
  var pt=ridge.getPointAtLength(L*p),ah=ridge.getPointAtLength(Math.min(L,L*p+6));
  var slope=Math.atan2(ah.y-pt.y,ah.x-pt.x);
  climber.setAttribute("transform","translate("+pt.x.toFixed(1)+" "+(pt.y-3).toFixed(1)+") scale(1.35)");
  cbody.setAttribute("transform","rotate("+(p>=1?0:Math.max(-4,Math.min(16,-slope*180/Math.PI*.35+6))).toFixed(1)+")");
  var a=p>=1?0:Math.sin(phase)*.55,b=-a;
  legA.setAttribute("x2",(Math.sin(a)*24).toFixed(1));legA.setAttribute("y2",(-24+Math.cos(a)*24).toFixed(1));
  legB.setAttribute("x2",(Math.sin(b)*24).toFixed(1));legB.setAttribute("y2",(-24+Math.cos(b)*24).toFixed(1));
  armA.setAttribute("x2",(p>=1?6:Math.sin(b*.8)*18).toFixed(1));armA.setAttribute("y2",(p>=1?-70:-52+Math.cos(b*.8)*18).toFixed(1));
  ridge.style.strokeDashoffset=(L*(1-p)).toFixed(1);
  areaClip.setAttribute("width",Math.max(0,pt.x+1000));
  chips.forEach(function(c){var on=p>=c.at-.002;if(on!==c.shown){c.shown=on;if(hasGsap&&!reduced)gsap.to(c.inner,{scale:on?1:0,opacity:on?1:0,duration:on?.6:.25,ease:on?"back.out(2)":"power2.in",transformOrigin:"50% 100%"});else c.inner.style.opacity=on?1:0}});
  var vw=window.innerWidth,vh=window.innerHeight;
  if(vw/vh<VB.w/VB.h-.02){var visW=VB.h*vw/vh,lim=800-visW/2,off=Math.max(-lim,Math.min(lim,800-pt.x));world.setAttribute("transform","translate("+off.toFixed(1)+" 0)")}else world.removeAttribute("transform");
}
var climbP=0;
window.addEventListener("resize",function(){fitScene();pose(climbP,0)});
chips.forEach(function(c){c.inner.style.opacity=0;if(hasGsap)gsap.set(c.inner,{scale:0,transformOrigin:"50% 100%"})});
var flagInner=document.getElementById("flagInner"),portal=document.getElementById("portal");
var introCopy=document.getElementById("intro-copy"),introEnd=document.getElementById("intro-end"),hint=document.getElementById("hint"),welcome=document.getElementById("welcome");

/* ================= loader ================= */
function runLoader(done){
  var ld=document.getElementById("loader");
  if(!hasGsap){ld.remove();done();return}
  document.body.classList.add("locked");if(lenis)lenis.stop();window.scrollTo(0,0);
  var D=document.getElementById("lg-d"),A=document.getElementById("lg-a"),RS=document.getElementById("lg-rest"),DT=document.getElementById("lg-dot"),bar=document.getElementById("lbar");
  function finish(){document.body.classList.remove("locked");if(lenis)lenis.start();ld.remove();done()}
  if(reduced){ld.classList.add("show-all");gsap.to(ld,{opacity:0,duration:.4,delay:.6,onComplete:finish});return}
  var origin="15.8% 49.5%";
  gsap.set(D,{xPercent:-120,rotation:-540,transformOrigin:origin});
  gsap.set(A,{x:"18%",opacity:0});
  gsap.set(RS,{clipPath:"inset(0 100% 0 0)"});
  gsap.set(DT,{y:-160,opacity:0});
  gsap.set(D,{visibility:"visible"});
  var tl=gsap.timeline({onComplete:finish});
  tl.to(bar,{scaleX:1,duration:2.6,ease:"power1.inOut"},0)
    .to(D,{xPercent:0,rotation:0,duration:1.15,ease:"power3.out"},.15)
    .fromTo(D,{scaleY:1},{scaleY:.86,duration:.12,yoyo:true,repeat:1,ease:"power1.inOut",transformOrigin:"50% 100%"},1.25)
    .to(A,{x:0,opacity:1,duration:.6,ease:"expo.out"},1.35)
    .to(RS,{clipPath:"inset(0 0% 0 0)",duration:.85,ease:"power3.inOut"},1.4)
    .to(DT,{y:0,opacity:1,duration:.8,ease:"bounce.out"},2.0)
    .to(D,{rotation:360,duration:.7,ease:"back.inOut(1.4)"},2.35)
    .to("#lg",{scale:.92,opacity:0,duration:.45,ease:"power2.in"},3.15)
    .to(ld,{clipPath:"inset(0 0 100% 0)",duration:.9,ease:"expo.inOut"},3.3);
  ld.addEventListener("click",function(){tl.progress(1)});
}

/* ================= scroll animations ================= */
var BG={paper:"#F7F7F4",white:"#FFFFFF",peach:"#FFF1E7",stone:"#EEEDE8",orange:"#F36F25"};
var curBg="paper";function setBg(k){curBg=k;var c=BG[k]||BG.paper;root.style.setProperty("--page-bg",c);hdrTone()}
function hdrTone(){var y=window.scrollY,ib=intro.offsetTop+intro.offsetHeight,overWelcome=hasST&&!reduced&&y>ib-window.innerHeight*1.6&&y<ib-header.offsetHeight;root.classList.toggle("hdr-dark",curBg==="orange"||overWelcome)}
function bgTrigger(sec){if(!hasST)return;ScrollTrigger.create({trigger:sec,start:"top 55%",end:"bottom 55%",onToggle:function(st){if(st.isActive)setBg(sec.dataset.bg)}})}
function headIn(sec){if(!hasST||reduced)return;var hd=sec.querySelector(".s-head,.story-top");if(hd)gsap.from(hd.children,{y:50,opacity:0,duration:1,ease:"expo.out",stagger:.08,scrollTrigger:{trigger:hd,start:"top 88%",once:true}})}

function initScroll(){
  if(!hasST||reduced){
    pose(1,0);climbP=1;chips.forEach(function(c){c.inner.style.opacity=1;if(hasGsap)gsap.set(c.inner,{scale:1})});
    if(!hasST&&!reduced){intro.style.height="auto";intro.querySelector(".intro-stage").style.position="relative";hint.hidden=true;document.getElementById("skip-intro").hidden=true}
    header.classList.remove("pre");
    document.querySelectorAll(".stop").forEach(function(x){x.classList.add("on")});
    document.getElementById("process").classList.add("static-proc");
    buildTrail(1);
    setBg("paper");
    return;
  }
  /* ---- intro ---- */
  pose(0,0);
  gsap.set(flagInner,{scaleY:0,transformOrigin:"50% 100%"});
  var st={p:0},sw=document.getElementById("swoosh"),swL=sw.getTotalLength();
  sw.style.strokeDasharray=swL;sw.style.strokeDashoffset=swL;
  var notifs=welcome.querySelectorAll(".notif");gsap.set(notifs,{scale:0,opacity:0});
  var wl=welcome.querySelectorAll(".w2 .line>span");
  var tl=gsap.timeline({defaults:{ease:"none"},scrollTrigger:{trigger:intro,start:"top top",end:"bottom bottom",scrub:.8,invalidateOnRefresh:true}});
  tl.to(hint,{opacity:0,y:20,duration:.5},0)
    .to(document.getElementById("skip-intro"),{opacity:0,duration:.3},6.4)
    .to(st,{p:1,duration:6.6,ease:"power1.inOut",onUpdate:function(){climbP=st.p;pose(st.p,st.p*44)}},.3)
    .to(introCopy,{opacity:0,y:-40,duration:1,ease:"power2.in"},isMobile()?.5:3.2)
    .to(flagInner,{scaleY:1,duration:.6,ease:"back.out(2)"},6.9)
    .set(introEnd,{visibility:"visible"},6.9)
    .fromTo(introEnd,{opacity:0,y:40},{opacity:1,y:0,duration:.7,ease:"power2.out"},6.9)
    .to(introEnd,{opacity:0,y:-30,duration:.5,ease:"power2.in"},8.1)
    .to(portal,{attr:{r:2600},duration:1.5,ease:"power2.in"},8.1)
    .set(welcome,{visibility:"visible"},9.4)
    .to(welcome,{opacity:1,duration:.3},9.4)
    .fromTo(wl,{yPercent:110},{yPercent:0,duration:.8,stagger:.2,ease:"power3.out"},9.5)
    .to(sw,{strokeDashoffset:0,duration:.7,ease:"power2.out"},10.2)
    .to(notifs,{scale:1,opacity:1,duration:.5,stagger:.25,ease:"back.out(2)"},10.3)
    .to({},{duration:1.2});
  var mm=window.matchMedia("(max-width:600px)");if(mm.matches)gsap.set(notifs[1],{display:"none"});

  /* ---- about: story trail ---- */
  var about=document.getElementById("about");bgTrigger(about);headIn(about);
  var trail=document.getElementById("trail"),stops=[].slice.call(document.querySelectorAll(".stop"));
  stops.forEach(function(sp){ScrollTrigger.create({trigger:sp,start:"top 72%",onEnter:function(){sp.classList.add("on")},onLeaveBack:function(){sp.classList.remove("on")}})});
  var trailST=ScrollTrigger.create({trigger:trail,start:"top 70%",end:"bottom 85%",scrub:.6,onUpdate:function(x){drawTrail(x.progress)},onRefresh:function(x){buildTrail(x.progress)}});
  /* ---- trusted ---- */
  var tr=document.getElementById("trusted");bgTrigger(tr);headIn(tr);
  /* ---- services stack ---- */
  var sv=document.getElementById("services");bgTrigger(sv);headIn(sv);
  var cards=[].slice.call(document.querySelectorAll(".svc"));
  cards.forEach(function(c,i){
    var mkEl=c.querySelector(".mk,.mk-vf");if(mkEl){gsap.from(mkEl,{y:60,rotateX:-18,transformPerspective:1000,duration:1.2,ease:"expo.out",scrollTrigger:{trigger:c,start:"top 75%",once:true}});gsap.from(mkEl.querySelectorAll(".mk-cal i,.mk-bars i,.mk-tracks b,.sw i,.mk-float"),{scale:0,opacity:0,duration:.6,ease:"back.out(1.8)",stagger:.02,delay:.3,scrollTrigger:{trigger:c,start:"top 75%",once:true}})}
    if(i<cards.length-1)gsap.to(c,{scale:.93,ease:"none",scrollTrigger:{trigger:cards[i+1],start:"top 90%",end:"top 25%",scrub:true}});
  });
  /* ---- achievements ---- */
  var ac=document.getElementById("achievements");bgTrigger(ac);headIn(ac);
  document.querySelectorAll(".stat .n").forEach(function(n){var v=+n.dataset.value,sp=n.querySelector(".v"),o={x:0};sp.textContent="0";
    ScrollTrigger.create({trigger:n,start:"top 88%",once:true,onEnter:function(){gsap.to(o,{x:v,duration:2,ease:"expo.out",onUpdate:function(){sp.textContent=Math.round(o.x).toLocaleString()}})}})});
  gsap.from("#ach-title .w>span",{yPercent:110,duration:1,ease:"expo.out",stagger:.08,scrollTrigger:{trigger:"#ach-title",start:"top 85%",once:true}});
  gsap.from(".stat .lbl",{x:-24,opacity:0,duration:.8,ease:"expo.out",stagger:.1,scrollTrigger:{trigger:"#stats",start:"top 85%",once:true}});
  gsap.fromTo("#ticker",{xPercent:0},{xPercent:-30,ease:"none",scrollTrigger:{trigger:"#achievements",start:"top bottom",end:"bottom top",scrub:.5}});
  /* ---- portfolio ---- */
  var pf=document.getElementById("portfolio");bgTrigger(pf);headIn(pf);
  var track=document.getElementById("htrack"),hp=document.getElementById("hpin");
  gsap.to(track,{x:function(){return -Math.max(0,track.scrollWidth-window.innerWidth)},ease:"none",scrollTrigger:{trigger:hp,start:"center center",end:function(){return "+="+Math.max(1,track.scrollWidth-window.innerWidth)},pin:true,scrub:.6,invalidateOnRefresh:true,anticipatePin:1}});
  track.querySelectorAll(".gfx").forEach(function(g,i){gsap.fromTo(g,{rotate:i%2?3:-3},{rotate:i%2?-3:3,ease:"none",scrollTrigger:{trigger:hp,start:"center center",end:function(){return "+="+Math.max(1,track.scrollWidth-window.innerWidth)},scrub:true}})});
  var slides=[].slice.call(document.querySelectorAll("#ads-screen .slide"));
  document.querySelectorAll(".ad-item").forEach(function(it){
    ScrollTrigger.create({trigger:it,start:"top 55%",end:"bottom 55%",onToggle:function(x){if(!x.isActive)return;var i=+it.dataset.i;
      document.querySelectorAll(".ad-item").forEach(function(o){o.classList.toggle("on",o===it)});
      var dv=document.getElementById("ad-device");if(ADS[i])dv.classList.toggle("land",isLand(ADS[i]));
      slides.forEach(function(sl,k){sl.classList.toggle("on",k===i);var v=sl.querySelector("video");if(v){if(k===i)v.play().catch(function(){});else v.pause()}})}});
  });
  gsap.from("#results .res",{y:90,rotateX:-35,rotateY:function(i){return (i-1)*14},transformPerspective:1200,transformOrigin:"50% 100%",duration:1.2,ease:"expo.out",stagger:.12,scrollTrigger:{trigger:"#results",start:"top 85%",once:true}});
  document.querySelectorAll("#results .sl").forEach(function(p){var l=p.getTotalLength();p.style.strokeDasharray=l;p.style.strokeDashoffset=l;gsap.to(p,{strokeDashoffset:0,duration:1.6,ease:"power2.out",scrollTrigger:{trigger:p,start:"top 90%",once:true}})});
  /* ---- process (pinned climb) ---- */
  var pr=document.getElementById("process");bgTrigger(pr);
  var pl=document.getElementById("proc-line"),plL=pl.getTotalLength(),mk=document.getElementById("proc-marker"),camps=[].slice.call(document.querySelectorAll(".camp")),psts=[].slice.call(document.querySelectorAll(".pst")),roll=document.getElementById("proll");
  pl.style.strokeDasharray=plL;pl.style.strokeDashoffset=plL;
  var campAt=[0,.25,.5,.75,1].map(function(f,i){var target=[[90,450],[280,380],[480,310],[700,210],[920,70]][i],best=0,bd=1e9;for(var k=0;k<=300;k++){var q=pl.getPointAtLength(plL*k/300),d=Math.hypot(q.x-target[0],q.y-target[1]);if(d<bd){bd=d;best=k/300}}return best});
  var lastStep=-1;
  function procUpdate(p){
    var seg=Math.min(4,Math.floor(p*5+1e-6)),local=p*5-seg,lp=campAt[seg]+(campAt[Math.min(4,seg+1)]-campAt[seg])*Math.min(1,Math.max(0,(local-.55)/.45));
    if(seg===4)lp=1;
    pl.style.strokeDashoffset=(plL*(1-lp)).toFixed(1);
    var q=pl.getPointAtLength(plL*lp);mk.setAttribute("transform","translate("+q.x.toFixed(1)+" "+q.y.toFixed(1)+")");
    var step=Math.min(4,Math.round(lp*4*1.0001));step=seg;
    if(step!==lastStep){lastStep=step;psts.forEach(function(x,k){x.classList.toggle("on",k===step)});camps.forEach(function(c,k){c.classList.toggle("on",k<=step)});roll.style.transform="translateY("+(-step)+"em)"}
  }
  procUpdate(0);
  ScrollTrigger.create({trigger:"#proc-pin",start:"top top",end:function(){return "+="+window.innerHeight*3.2},pin:true,scrub:.5,onUpdate:function(x){procUpdate(Math.min(.9999,x.progress))}});
  /* ---- testimonials ---- */
  var te=document.getElementById("testimonials");bgTrigger(te);headIn(te);
  gsap.from(".story-player",{rotateY:-25,rotateX:8,y:60,transformPerspective:1200,duration:1.3,ease:"expo.out",scrollTrigger:{trigger:".story-player",start:"top 85%",once:true}});
  gsap.from(".ring",{scale:0,duration:.7,ease:"back.out(2)",stagger:.08,scrollTrigger:{trigger:"#rings",start:"top 90%",once:true}});
  /* ---- packages ---- */
  var pk=document.getElementById("packages");bgTrigger(pk);headIn(pk);
  gsap.from(".pkg",{y:120,rotateX:-25,transformPerspective:1200,transformOrigin:"50% 100%",duration:1.2,ease:"expo.out",stagger:.12,scrollTrigger:{trigger:"#packages-list",start:"top 85%",once:true}});
  gsap.from(".pkg-art svg path",{yPercent:40,duration:1.2,ease:"expo.out",scrollTrigger:{trigger:"#packages-list",start:"top 80%",once:true}});
  /* ---- faq, gallery, clients, contact ---- */
  ["openings","faq","gallery","clients","contact"].forEach(function(id){var x=document.getElementById(id);bgTrigger(x);headIn(x)});
  gsap.from(".faq-list details",{x:40,opacity:0,duration:.8,ease:"expo.out",stagger:.06,scrollTrigger:{trigger:"#faq-list",start:"top 85%",once:true}});
  ScrollTrigger.batch(".gitem",{start:"top 92%",once:true,onEnter:function(b){gsap.from(b,{y:60,scale:.94,opacity:0,duration:1,ease:"expo.out",stagger:.06})}});
  ScrollTrigger.batch("#dir .btile",{start:"top 94%",once:true,onEnter:function(b){gsap.from(b,{y:30,opacity:0,duration:.7,ease:"power3.out",stagger:.03})}});
  gsap.from("#lead-form",{y:80,rotateX:-12,transformPerspective:1200,duration:1.2,ease:"expo.out",scrollTrigger:{trigger:"#lead-form",start:"top 88%",once:true}});
  ScrollTrigger.create({trigger:"footer",start:"top 80%",onEnter:function(){setBg("paper")},onLeaveBack:function(){setBg("peach")}});
  ScrollTrigger.create({trigger:intro,start:"top top",end:"bottom 40%",onToggle:function(x){if(x.isActive)setBg("paper")}});

  window.addEventListener("load",function(){ScrollTrigger.refresh()});
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){ScrollTrigger.refresh()});
}

/* story trail: path through the nodes */
var tline=document.getElementById("tline"),tbg=document.getElementById("tline-bg"),tdot=document.getElementById("tdot"),tL=1,trailPts=[];
function buildTrail(p){
  var trail=document.getElementById("trail"),tr=trail.getBoundingClientRect(),nodes=[].slice.call(trail.querySelectorAll(".node"));
  if(!nodes.length)return;
  trailPts=nodes.map(function(n){var r=n.getBoundingClientRect();return [r.left+r.width/2-tr.left,r.top+r.height/2-tr.top]});
  var first=trailPts[0],d="M"+first[0]+" "+(first[1]-60)+" L"+first[0]+" "+first[1];
  var wig=isMobile()?0:90;
  for(var i=1;i<trailPts.length;i++){var a=trailPts[i-1],b=trailPts[i],my=(a[1]+b[1])/2,dir=i%2?1:-1;
    d+=" C"+(a[0]+wig*dir)+" "+(a[1]+(b[1]-a[1])*.35)+" "+(b[0]-wig*dir)+" "+(b[1]-(b[1]-a[1])*.35)+" "+b[0]+" "+b[1]}
  tline.setAttribute("d",d);tbg.setAttribute("d",d);tL=tline.getTotalLength();tline.style.strokeDasharray=tL;drawTrail(p||0);
}
function drawTrail(p){
  if(!trailPts.length)return;
  tline.style.strokeDashoffset=(tL*(1-p)).toFixed(1);
  var q=tline.getPointAtLength(tL*p);tdot.setAttribute("cx",q.x);tdot.setAttribute("cy",q.y);
}
window.addEventListener("resize",function(){if(!hasST||reduced)buildTrail(1)});

/* ================= forms ================= */
var LIVE=document.documentElement.getAttribute("data-live")==="1";
function collect(form){
  var out={},files=[];
  form.querySelectorAll("input,select,textarea").forEach(function(el){if(!el.id||el.closest(".hp"))return;
    if(el.type==="file"){if(el.files&&el.files[0])files.push([el.id,el.files[0]]);return}
    out[el.id]=el.value.trim().slice(0,4000)});
  return Promise.all(files.map(function(f){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(){out[f[0]]={name:f[1].name.slice(0,120),type:f[1].type,data:String(r.result).split(",")[1]};res()};r.onerror=rej;r.readAsDataURL(f[1])})})).then(function(){return out});
}
function makeForm(formId,rules,okText){
  var form=document.getElementById(formId);
  var startedAt=Date.now();
  function errEl(id){return document.getElementById(form.id==="job-form"?"e-"+id.slice(2)+"-j":"e-"+id.slice(2))}
  function check(id){var el=document.getElementById(id),m=rules[id](el);var e=errEl(id);if(e)e.textContent=m;el.setAttribute("aria-invalid",m?"true":"false");return m}
  Object.keys(rules).forEach(function(id){var el=document.getElementById(id);
    el.addEventListener("blur",function(){if(el.value||el.getAttribute("aria-invalid")==="true")check(id)});
    el.addEventListener("change",function(){if(el.getAttribute("aria-invalid")==="true"||el.type==="file")check(id)});
    el.addEventListener("input",function(){if(el.getAttribute("aria-invalid")==="true")check(id)});});
  form.addEventListener("submit",function(ev){
    ev.preventDefault();var old=form.querySelector(".summary");if(old)old.remove();
    var hp=form.querySelector(".hp input");if(hp&&hp.value)return;
    var bad=[];Object.keys(rules).forEach(function(id){var m=check(id);if(m)bad.push([id,m])});
    if(bad.length){
      var box=h("div",{class:"summary",role:"alert",tabindex:"-1"},[h("h3",{text:bad.length===1?"One thing to fix":"There are "+bad.length+" things to fix"}),h("ul",null,bad.map(function(b){var a=h("a",{href:"#"+b[0],text:b[1]});a.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();document.getElementById(b[0]).focus()});return h("li",null,[a])}))]);
      form.insertBefore(box,form.firstChild);box.focus();return;
    }
    var btn=form.querySelector("button[type=submit]"),btnText=btn.querySelector("span").textContent;btn.disabled=true;btn.querySelector("span").textContent="Sending…";
    function ok(msg){var done=h("div",{class:"success",role:"status",tabindex:"-1"},[h("h3",{text:okText()}),h("p",{text:msg})]);form.replaceChildren(done);done.focus()}
    function fail(msg){btn.disabled=false;btn.querySelector("span").textContent=btnText;var box=h("div",{class:"summary",role:"alert",tabindex:"-1"},[h("h3",{text:msg})]);form.insertBefore(box,form.firstChild);box.focus()}
    if(!LIVE){setTimeout(function(){ok("This is a prototype, so nothing was sent. On the live site this goes straight to your inbox.")},900);return}
    collect(form).then(function(data){
      data._t=startedAt;data._hp=hp?hp.value:"";
      return fetch(form.id==="job-form"?"/api/apply":"/api/inquiry",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(data)});
    }).then(function(r){return r.json().catch(function(){return {}}).then(function(j){if(r.ok&&j.ok)ok(C.forms&&C.forms.sent||"We got it and will reply soon.");else fail(j.error||"Something went wrong. Please try again, or email us.")})})
      .catch(function(){fail("We couldn't send this. Check your internet and try again.")});
  });
}
var reqText=function(min,msg){return function(el){return el.value.trim().length<min?msg:""}};
var emailRule=function(el){var v=el.value.trim();if(!v)return "Enter your email so we can reply.";return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)?"":"Check the email address. It should look like name@business.com."};
var phoneRule=function(optional){return function(el){var v=el.value.trim();if(!v)return optional?"":"Enter your phone number.";return /^\+?[0-9\s\-()]{7,20}$/.test(v)?"":"Use digits only, with a country code, like +91 98765 43210."}};
makeForm("lead-form",{"f-name":reqText(2,"Enter your name so we know who to reply to."),"f-biz":reqText(2,"Enter your business name."),"f-email":emailRule,"f-phone":phoneRule(true)},function(){return "Thanks, "+document.getElementById("f-name").value.trim().split(/\s+/)[0]+". We'll be in touch soon."});
makeForm("job-form",{
  "j-name":reqText(2,"Enter your full name."),"j-email":emailRule,"j-phone":phoneRule(false),
  "j-role":function(el){return el.value?"":"Choose the position you're applying for."},
  "j-link":function(el){var v=el.value.trim();if(!v)return "";return /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(v)?"":"Enter a full link starting with https://"},
  "j-cv":function(el){var f=el.files&&el.files[0];if(!f)return "Attach your resume.";if(!/\.(pdf|docx?)$/i.test(f.name))return "Upload a PDF or Word file.";if(f.size>3*1024*1024)return "The file is larger than 3 MB. Upload a smaller file.";return ""}
},function(){return "Thanks, "+document.getElementById("j-name").value.trim().split(/\s+/)[0]+". Your application is in."});

/* ================= start ================= */
if(reduced){document.querySelectorAll(".stop").forEach(function(x){x.classList.add("on")})}
runLoader(function(){
  initScroll();headerState();
  if(hasST&&!reduced){gsap.from("#intro-copy .wrap>*",{y:40,opacity:0,duration:1,ease:"expo.out",stagger:.1})}
  if(location.hash==="#careers")openCareers();
});
mqReduce.addEventListener&&mqReduce.addEventListener("change",function(){location.reload()});
})();
