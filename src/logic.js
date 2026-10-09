import { auth, fdb, firebaseApp, firebase, FIREBASE_CONFIG } from './firebase.js';

export function initLogic() {
  if (window._logicInitialized) return;
  window._logicInitialized = true;


let kioskOrders=[],loadedKid="",kioskSeen=false;
const $=s=>document.querySelector(s),E=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ld=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}};
const sv=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const M0=[["Espresso","Coffee",90],["Cappuccino","Coffee",140],["Cafe Latte","Coffee",150],["Filter Coffee","Coffee",60],["Cold Coffee","Cold Drinks",160],["Iced Tea","Cold Drinks",120],["Fresh Lime Soda","Cold Drinks",90],["Oreo Shake","Shakes",180],["Chocolate Shake","Shakes",170],["Masala Chai","Tea",50],["Green Tea","Tea",70],["Veg Sandwich","Snacks",110],["Grilled Cheese Sandwich","Snacks",140],["French Fries","Snacks",120],["Veg Puff","Snacks",40],["Chocolate Brownie","Desserts",120],["Cheesecake Slice","Desserts",170]];
let menu=M0.map((m,i)=>({id:i+1,name:m[0],cat:m[1],price:m[2],on:true})),orders=[],S={name:"2 Friends Cafe",addr:"",gstin:"",gst:5,foot:"Thank you! Visit again.",pw:80};
let db=null,role="view",nm={},roster={},cur={u:"",role:"view"},unsubs=[],rkey="",seedM=0,seedS=0;
let cart={},cat="All",last=null,sendNext=false;
const rs=n=>"₹"+(Math.round(n*100)/100).toFixed(2).replace(/\.00$/,"");
function toast(t){const e=$("#toast");e.textContent=t;e.style.display="block";clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display="none",1800)}
function go(t){document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("on",b.dataset.t==t));document.querySelectorAll(".tab").forEach(s=>s.classList.toggle("on",s.id=="t-"+t));const l=document.querySelector('nav button[data-t="'+t+'"] .l');if($("#ptitle")&&l)$("#ptitle").textContent=l.textContent;document.body.dataset.tab=t;window.scrollTo(0,0)}
$("#nav").onclick=e=>{const b=e.target.closest("button[data-t]");if(!b)return;go(b.dataset.t);render()};
function cats(){return["All",...new Set(menu.map(m=>m.cat))]}
function drawMenu(){const q=$("#q").value.toLowerCase();$("#cats").innerHTML=cats().map(c=>`<button class="chip ${c==cat?"on":""}" data-c="${E(c)}">${E(c)}</button>`).join("");
$("#grid").innerHTML=menu.filter(m=>(cat=="All"||m.cat==cat)&&m.name.toLowerCase().includes(q)).map(m=>{const s=stk[m.id],out=s&&s.qty<=0;return `<button class="item ${m.on&&!out?"":"off"}" data-id="${m.id}"><b>${E(m.name)}</b><span>${rs(m.price)}</span>${s?`<small style="display:block;color:${s.qty<=s.low?"var(--bad)":"var(--mu)"}">${out?"Out of stock":"Left: "+s.qty}</small>`:""}</button>`}).join("")||'<div class="empty">No items found</div>'}
$("#cats").onclick=e=>{if(e.target.dataset.c){cat=e.target.dataset.c;drawMenu()}};
$("#q").oninput=drawMenu;
$("#grid").onclick=e=>{const b=e.target.closest(".item");if(!b)return;const id=b.dataset.id,s=stk[id];if(s&&(cart[id]||0)>=s.qty){toast("Only "+s.qty+" left");return}cart[id]=(cart[id]||0)+1;drawCart()};
function calc(){let sub=0;const lines=Object.keys(cart).map(id=>{const m=menu.find(x=>x.id==id);if(!m)return null;const a=m.price*cart[id];sub+=a;return{name:m.name,qty:cart[id],price:m.price,amt:a,id}}).filter(Boolean);
let d=+$("#disc").value||0;d=$("#dtype").value=="p"?sub*Math.min(d,100)/100:Math.min(d,sub);const tx=sub-d,g=tx*S.gst/100,raw=tx+g,tot=Math.round(raw);return{lines,sub,d,tx,g,tot,ro:tot-raw}}
function drawCart(){const c=calc();$("#cart").innerHTML=c.lines.map(l=>`<div class="line"><div class="n">${E(l.name)}<br><small style="color:var(--mu)">${rs(l.price)} each</small></div><div class="q"><button data-a="-" data-id="${l.id}" aria-label="Remove one">−</button>${l.qty}<button data-a="+" data-id="${l.id}" aria-label="Add one">+</button></div><b>${rs(l.amt)}</b></div>`).join("")||'<div class="empty">Tap an item to start the bill</div>';
$("#sums").innerHTML=`<div class="tot"><span>Subtotal</span><span>${rs(c.sub)}</span></div><div class="tot"><span>Discount</span><span>−${rs(c.d)}</span></div><div class="tot"><span>GST ${S.gst}%</span><span>${rs(c.g)}</span></div><div class="tot g"><span>Total</span><span>${rs(c.tot)}</span></div>`;updBar(c)}
function updBar(c){const n=c.lines.reduce((a,x)=>a+x.qty,0);$("#cn").textContent=n+(n==1?" item":" items");$("#ct").textContent=rs(c.tot);$("#cbar").classList.toggle("has",n>0);if(!n)$("#cpanel").classList.remove("open")}
$("#cbar").onclick=()=>$("#cpanel").classList.add("open");$("#cx").onclick=()=>$("#cpanel").classList.remove("open");
$("#cart").onclick=e=>{const b=e.target.closest("button");if(!b)return;const id=b.dataset.id,s=stk[id];if(b.dataset.a=="+"&&s&&cart[id]>=s.qty){toast("Only "+s.qty+" left");return}cart[id]+=b.dataset.a=="+"?1:-1;if(cart[id]<1)delete cart[id];drawCart()};
$("#disc").oninput=drawCart;$("#dtype").onchange=drawCart;
function reset(){loadedKid="";cart={};$("#cust").value=$("#tbl").value=$("#ph").value="";$("#disc").value=0;drawCart()}
$("#clear").onclick=reset;
$("#gen").onclick=async()=>{const c=calc();if(!c.lines.length){sendNext=false;toast("Add at least one item");return}
const o={by:cur.u,t:Date.now(),day:today(),cust:$("#cust").value.trim(),tbl:$("#tbl").value.trim(),ph:$("#ph").value.trim(),type:document.querySelector("[name=ot]:checked").value,pay:$("#pay").value,lines:c.lines,sub:c.sub,d:c.d,g:c.g,ro:c.ro,tot:c.tot,gst:S.gst};
if(loadedKid){const k=kioskOrders.find(x=>x.id==loadedKid);if(k)o.kt=k.token||""}
if(!await placeOrder(o,loadedKid)){sendNext=false;return}show(o);reset();if(sendNext){sendNext=false;if(waNum(o.ph))$("#wa").click();else{toast("Enter the customer number, then tap Send");$("#wph").focus()}}};
$("#gens").onclick=()=>{sendNext=true;$("#gen").click()};
function show(o){last=o;const dt=new Date(o.t),h=o.gst/2;
$("#receipt").innerHTML=`<div class="c"><img src="/logo.png" alt=""><br><b>${E(S.name)}</b><br>${E(S.addr)}${S.gstin?"<br>GSTIN: "+E(S.gstin):""}</div><hr>
<div class="r"><span>Bill ${E(o.lb||"")}${o.kt?" (Kiosk #"+E(o.kt)+")":""}</span><span>${o.type}</span></div><div>${dt.toLocaleDateString("en-IN")} ${dt.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</div><div>Cashier: ${E(nm[o.by]||"")}</div>${o.cust||o.tbl?`<div>${E(o.cust)} ${E(o.tbl)}</div>`:""}<hr>
${o.lines.map(l=>`<div class="r"><span>${E(l.name)} x${l.qty}</span><span>${l.amt.toFixed(2)}</span></div>`).join("")}<hr>
<div class="r"><span>Subtotal</span><span>${o.sub.toFixed(2)}</span></div>${o.d?`<div class="r"><span>Discount</span><span>-${o.d.toFixed(2)}</span></div>`:""}
<div class="r"><span>CGST ${h}%</span><span>${(o.g/2).toFixed(2)}</span></div><div class="r"><span>SGST ${h}%</span><span>${(o.g/2).toFixed(2)}</span></div>
<div class="r"><span>Round off</span><span>${o.ro.toFixed(2)}</span></div><hr><div class="r"><b>TOTAL</b><b>₹${o.tot.toFixed(2)}</b></div><div>Paid by ${o.pay}</div><hr><div class="c">${E(S.foot)}</div>`;
$("#receipt").style.cssText="width:"+(S.pw||80)+"mm;max-width:100%;margin:0 auto";$("#wph").value=o.ph||"";pimg=null;ppdf=null;rimg(o).then(b=>{if(last===o)pimg=b});billPdf(o).then(b=>{if(last===o)ppdf=b});$("#modal").classList.add("on")}
$("#close").onclick=()=>$("#modal").classList.remove("on");$("#xclose").onclick=()=>$("#modal").classList.remove("on");$("#print").onclick=()=>{const w=S.pw||80;let e=$("#pg");if(!e){e=document.createElement("style");e.id="pg";document.head.appendChild(e)}e.textContent="@page{size:"+w+"mm auto;margin:0}";document.body.classList.toggle("w58",w==58);window.print()};
const pg={o:{p:1,n:10},m:{p:1,n:10},s:{p:1,n:10}};
function paged(k,L,box,redraw){const P=pg[k],pages=Math.max(1,Math.ceil(L.length/P.n));if(P.p>pages)P.p=pages;const a=(P.p-1)*P.n,el=$(box);
el.innerHTML=L.length>P.n||P.n!=10?`<span class="pi">${L.length?a+1:0}-${Math.min(a+P.n,L.length)} of ${L.length}</span><div class="pb"><button data-g="first" ${P.p<=1?"disabled":""} aria-label="First page">&laquo;</button><button data-g="prev" ${P.p<=1?"disabled":""}>&lsaquo; Prev</button><b>${P.p} / ${pages}</b><button data-g="next" ${P.p>=pages?"disabled":""}>Next &rsaquo;</button><button data-g="last" ${P.p>=pages?"disabled":""} aria-label="Last page">&raquo;</button></div><select data-g="size" aria-label="Rows per page">${[10,25,50].map(n=>`<option ${n==P.n?"selected":""}>${n}</option>`).join("")}</select>`:`<span class="pi">${L.length} item${L.length==1?"":"s"}</span>`;
el.onclick=e=>{const g=e.target.dataset.g;if(!g||g=="size")return;P.p=g=="first"?1:g=="last"?pages:P.p+(g=="next"?1:-1);redraw()};
el.onchange=e=>{if(e.target.dataset.g=="size"){P.n=+e.target.value;P.p=1;redraw()}};
return L.slice(a,a+P.n)}
let oq="";
let fd="";const today=()=>new Date().toLocaleDateString("en-CA");
$("#fdate").value=fd=today();$("#oq").oninput=e=>{oq=e.target.value.trim().toLowerCase();pg.o.p=1;drawOrders()};$("#fdate").onchange=e=>{fd=e.target.value;pg.o.p=1;subOrders()};$("#all").onclick=()=>{fd="";pg.o.p=1;$("#fdate").value="";subOrders()};
function drawOrders(){const L=orders.filter(o=>(cur.role=="admin"||o.by==cur.u)&&(!fd||new Date(o.t).toLocaleDateString("en-CA")==fd)),rev=L.reduce((a,o)=>a+o.tot,0),by=p=>L.filter(o=>o.pay==p).reduce((a,o)=>a+o.tot,0);
$("#stats").innerHTML=[["Orders",L.length],["Revenue",rs(rev)],["Average bill",rs(L.length?rev/L.length:0)],["Cash",rs(by("Cash"))],["UPI",rs(by("UPI"))],["Card",rs(by("Card"))]].map(s=>`<div class="card stat"><b>${s[1]}</b><span>${s[0]}</span></div>`).join("");
const LS=oq?L.filter(o=>((o.lb||"")+" "+(o.kt?"kiosk #"+o.kt:"")+" "+(o.cust||"")+" "+(nm[o.by]||"")).toLowerCase().includes(oq)):L;
const KR=kioskOrders.map(o=>`<tr class="kr"><td data-l="Bill">Kiosk #${E(o.token||"")}</td><td data-l="Time">${new Date(o.t).toLocaleString("en-IN",{dateStyle:"short",timeStyle:"short"})}</td><td data-l="By">Kiosk</td><td data-l="Customer">${E(o.cust||"-")}</td><td data-l="Type">${E(o.type||"")}</td><td data-l="Pay">Pending</td><td data-l="Total">${rs(o.tot)}</td><td data-l=""><button class="btn s w" data-kid="${o.id}">Load</button> <button class="btn d w" data-kdel="${o.id}">Dismiss</button></td></tr>`).join("");
$("#olist").innerHTML=KR+paged("o",LS,"#pg-o",drawOrders).map(o=>`<tr><td data-l="Bill">${E(o.lb||"")}${o.kt?` <small style="color:#856404;font-weight:700">Kiosk #${E(o.kt)}</small>`:""}</td><td data-l="Time">${new Date(o.t).toLocaleString("en-IN",{dateStyle:"short",timeStyle:"short"})}</td><td data-l="By">${E(nm[o.by]||"Staff")}</td><td data-l="Customer">${E(o.cust||"-")}</td><td data-l="Type">${o.type}</td><td data-l="Pay">${o.pay}</td><td data-l="Total">${rs(o.tot)}</td><td data-l=""><button class="btn s w" data-v="${o.id}">View</button> <button class="btn d w adm" data-x="${o.id}">Delete</button></td></tr>`).join("")||'<tr><td colspan="8" class="empty">No orders for this date</td></tr>';
const t={};L.forEach(o=>o.lines.forEach(l=>t[l.name]=(t[l.name]||0)+l.qty));
$("#top").innerHTML=Object.entries(t).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([n,q])=>`<div class="line"><span class="n">${E(n)}</span><b>${q}</b></div>`).join("")||'<div class="empty">Nothing sold yet</div>'}
$("#olist").onclick=e=>{if(e.target.dataset.kid||e.target.dataset.kdel)return $("#kiosk-alerts").onclick(e);const v=e.target.dataset.v,x=e.target.dataset.x;if(v)show(orders.find(o=>o.id==v));if(x&&cur.role=="admin"&&confirm("Delete this bill?"))delOrder(x)};
function drawMgr(){$("#cl").innerHTML=cats().slice(1).map(c=>`<option value="${E(c)}">`).join("");
$("#mlist").innerHTML=paged("m",menu,"#pg-m",drawMgr).map(m=>`<tr><td data-l="Item">${E(m.name)}</td><td data-l="Category">${E(m.cat)}</td><td data-l="Price ₹"><input type="number" value="${m.price}" data-p="${m.id}" style="width:90px"></td><td data-l="Available"><input type="checkbox" ${m.on?"checked":""} data-o="${m.id}" style="width:auto" aria-label="Available"></td><td data-l=""><button class="btn d w" data-d="${m.id}">Remove</button></td></tr>`).join("")}
$("#mlist").onchange=e=>{const t=e.target,m=menu.find(x=>x.id==(t.dataset.p||t.dataset.o));if(!m)return;if(t.dataset.p)m.price=Math.max(0,+t.value||0);else m.on=t.checked;saveMenu();toast("Saved")};
$("#mlist").onclick=e=>{const d=e.target.dataset.d;if(d&&confirm("Remove this item?")){menu=menu.filter(m=>m.id!=d);delete cart[d];saveMenu();drawMgr()}};
$("#add").onclick=()=>{const n=$("#nn").value.trim(),c=$("#nc").value.trim()||"Other",p=+$("#np").value;if(!n||!(p>=0)||$("#np").value===""){toast("Enter a name and price");return}
menu.push({id:Date.now(),name:n,cat:c,price:p,on:true});saveMenu();$("#nn").value=$("#nc").value=$("#np").value="";drawMgr();toast("Item added")};
function drawSet(){$("#s-name").value=S.name;$("#s-addr").value=S.addr;$("#s-gstin").value=S.gstin;$("#s-gst").value=S.gst;$("#s-foot").value=S.foot;$("#s-pw").value=S.pw||80}
$("#save").onclick=()=>{S={name:$("#s-name").value||"2 Friends Cafe",addr:$("#s-addr").value,gstin:$("#s-gstin").value,gst:Math.max(0,+$("#s-gst").value||0),foot:$("#s-foot").value,pw:+$("#s-pw").value||80};saveSet();$("#hname").textContent=S.name;drawCart();toast("Settings saved")};
$("#wipe").onclick=()=>{if(cur.role=="admin"&&confirm("Delete all bills currently shown in the Orders tab? This cannot be undone."))wipeOrders()};
function render(){$("#hname").textContent=S.name;drawDash();drawMenu();drawCart();drawOrders();drawMgr();drawSet();drawStock();lowAlert()}
const gate=m=>{$("#gm").textContent=m};
const ini=n=>((n||"").trim().split(/\s+/).map(x=>x[0]||"").join("").slice(0,2)||"XX").toUpperCase();
const em=u=>{u=u.trim().toLowerCase();return u.includes("@")?u:u+"@2friends.app"};
let sec,uo=[],un=[],users={}; window.creating=false;
const off=()=>{un.forEach(f=>f());uo.forEach(f=>f());un=[];uo=[]};
async function saveMenu(){if(cur.role!="admin")return;try{await fdb.doc("menu/main").set({items:menu})}catch(e){toast("Save failed")}}
async function saveSet(){if(cur.role!="admin")return;try{await fdb.doc("settings/main").set(S)}catch(e){toast("Save failed")}}
async function placeOrder(o,kid){try{const kr=kid?fdb.doc("kiosk_orders/"+kid):null,ur=fdb.doc("users/"+cur.u),or=fdb.collection("orders").doc();
await fdb.runTransaction(async t=>{const ks=kr?await t.get(kr):null;if(kr&&!ks.exists)throw new Error("kiosk-gone");const s=await t.get(ur),d=s.data(),n=(d.billCount||0)+1,sk=o.lines.filter(l=>stk[l.id]).map(l=>({r:fdb.doc("stock/"+l.id),q:l.qty})),sn=await Promise.all(sk.map(x=>t.get(x.r)));o.lb=(d.initials||"XX")+"-"+String(n).padStart(4,"0");o.id=or.id;if(kr)t.delete(kr);t.update(ur,{billCount:n});t.set(or,o);sn.forEach((z,i)=>{if(z.exists)t.update(sk[i].r,{qty:Math.max(0,z.data().qty-sk[i].q)})})});return true}catch(e){console.error("placeOrder",e);toast(e&&e.message=="kiosk-gone"?"This kiosk order was already billed or dismissed by someone else.":"Could not save the bill. Check your connection.");if(e&&e.message=="kiosk-gone"){loadedKid="";reset()}return false}}
async function delOrder(id){try{await fdb.doc("orders/"+id).delete()}catch(e){toast("Delete failed")}}
async function wipeOrders(){try{const L=orders.slice();for(let i=0;i<L.length;i+=400){const b=fdb.batch();L.slice(i,i+400).forEach(o=>b.delete(fdb.doc("orders/"+o.id)));await b.commit()}toast("Bills deleted")}catch(e){toast("Delete failed")}}
function subOrders(){uo.forEach(f=>f());uo=[];let q=fdb.collection("orders");
if(cur.role=="admin")q=fd?q.where("day","==",fd):q.orderBy("t","desc").limit(300);else{q=q.where("by","==",cur.u);if(fd)q=q.where("day","==",fd)}
uo.push(q.onSnapshot(s=>{orders=s.docs.map(d=>d.data()).sort((a,b)=>b.t-a.t);drawOrders()},()=>toast("Bills unavailable")))}
function subs(){off();
un.push(fdb.doc("menu/main").onSnapshot(s=>{if(s.exists)menu=s.data().items||[];else if(cur.role=="admin"&&!seedM){seedM=1;saveMenu()}drawMenu();drawCart();drawMgr()}));
un.push(fdb.doc("settings/main").onSnapshot(s=>{if(s.exists)S=Object.assign(S,s.data());else if(cur.role=="admin"&&!seedS){seedS=1;saveSet()}$("#hname").textContent=S.name;drawCart();drawSet()}));
if(cur.role=="admin")un.push(fdb.collection("users").onSnapshot(s=>{users={};s.docs.forEach(d=>{users[d.id]=d.data();nm[d.id]=d.data().name});drawUsers();drawOrders()}));
    un.push(fdb.collection("stock").onSnapshot(s=>{stk={};s.docs.forEach(d=>stk[d.id]=Object.assign({low:5},d.data()));drawMenu();drawStock();lowAlert()},()=>{}));
    un.push(fdb.collection("kiosk_orders").onSnapshot(s=>{
      kioskOrders=s.docs.map(d=>Object.assign({id:d.id},d.data())).sort((a,b)=>a.t-b.t);
      if(kioskSeen&&s.docChanges().some(c=>c.type=="added"))beep();kioskSeen=true;
      document.title=(kioskOrders.length?"("+kioskOrders.length+") ":"")+"2 Friends Cafe - Billing";
      drawKioskAlerts();drawOrders();
    },()=>toast("Kiosk orders unavailable. Check Firestore rules.")));
    subOrders();subDash()
}
let dOrders=[],dayKey="";
function subDash(){const d=new Date();d.setDate(d.getDate()-13);dayKey=today();let q=fdb.collection("orders");
q=cur.role=="admin"?q.where("day",">=",d.toLocaleDateString("en-CA")):q.where("by","==",cur.u).where("day","==",dayKey);
un.push(q.onSnapshot(s=>{dOrders=s.docs.map(x=>x.data());drawDash()},()=>{}))}
setInterval(()=>{if(cur.u&&dayKey&&dayKey!=today())subs()},60000);
function drawDash(){const el=$("#dash");if(!el||!cur.u)return;
const adm=cur.role=="admin",td=today(),yd=new Date(Date.now()-864e5).toLocaleDateString("en-CA"),
T=dOrders.filter(o=>o.day==td),Y=dOrders.filter(o=>o.day==yd),sum=L=>L.reduce((a,o)=>a+o.tot,0),rev=sum(T),yr=sum(Y),
delta=adm&&yr?Math.round((rev-yr)/yr*100):null,h=new Date().getHours(),
gr=h<12?"Good morning":h<17?"Good afternoon":"Good evening",nmx=E((nm[cur.u]||"").split(" ")[0]||"");
const tile=(l,v,sub,c)=>`<div class="dt${c?" "+c:""}"><span>${l}</span><b>${v}</b><small>${sub||"&nbsp;"}</small></div>`;
const bar=(l,v,mx,t)=>`<div class="hb"><span>${E(l)}</span><div><i style="width:${mx?Math.max(v?3:0,Math.round(v/mx*100)):0}%"></i></div><b>${t}</b></div>`;
const pays=["Cash","UPI","Card"].map(p=>[p,T.filter(o=>o.pay==p).reduce((a,o)=>a+o.tot,0)]),pm=Math.max(...pays.map(x=>x[1]),0);
const tp={};T.forEach(o=>o.lines.forEach(l=>tp[l.name]=(tp[l.name]||0)+l.qty));
const top=Object.entries(tp).sort((a,b)=>b[1]-a[1]).slice(0,5),tm=top.length?top[0][1]:0;
let chart="";
if(adm){const days=[];for(let i=6;i>=0;i--){const dt=new Date(Date.now()-i*864e5),k=dt.toLocaleDateString("en-CA");days.push({k,l:dt.toLocaleDateString("en-IN",{weekday:"short"}),v:sum(dOrders.filter(o=>o.day==k))})}
const mx=Math.max(...days.map(x=>x.v),1);
chart=`<div class="card"><b>Last 7 days</b><div class="cols">${days.map(x=>`<div class="col${x.k==td?" now":""}" title="${E(x.k)}: ${rs(x.v)}"><em>${x.v?rs(x.v):""}</em><i style="height:${Math.max(x.v?4:0,Math.round(x.v/mx*100))}%"></i><small>${x.l}</small></div>`).join("")}</div></div>`;
const hr={};T.forEach(o=>{const k=new Date(o.t).getHours();hr[k]=(hr[k]||0)+o.tot});const ks=Object.keys(hr).map(Number);
if(ks.length){const a=Math.min(...ks),z=Math.max(...ks,a+3),m2=Math.max(...Object.values(hr));let r="";for(let k=a;k<=z;k++)r+=bar((k%12||12)+(k<12?" am":" pm"),hr[k]||0,m2,hr[k]?rs(hr[k]):"");chart+=`<div class="card"><b>Busy hours today</b><div class="hbs">${r}</div></div>`}}
const low=menu.filter(m=>stk[m.id]&&stk[m.id].qty<=stk[m.id].low);
el.innerHTML=`<div class="dhead"><div><h2>${gr}${nmx?", "+nmx:""}</h2><small>${new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}${adm?"":" · your bills today"}</small></div><div class="dact"><button class="btn" data-go="bill">+ New bill</button><button class="btn s" data-go="orders">Orders</button></div></div>
<div class="dtiles">${tile("Sales today",rs(rev),delta===null?"":(delta>=0?"▲ ":"▼ ")+Math.abs(delta)+"% vs yesterday",delta===null?"":delta>=0?"up":"dn")}${tile("Bills",T.length,"")}${tile("Average bill",rs(T.length?rev/T.length:0),"")}${tile("Kiosk waiting",kioskOrders.length,kioskOrders.length?"Tap to open":"All clear",kioskOrders.length?"warn":"")}</div>
<div class="dgrid"><div class="card"><b>Payments today</b><div class="hbs">${pays.map(p=>bar(p[0],p[1],pm,rs(p[1]))).join("")}</div></div>
<div class="card"><b>Top sellers today</b><div class="hbs">${top.map(x=>bar(x[0],x[1],tm,x[1]+" sold")).join("")||'<div class="empty">No sales yet today</div>'}</div></div>${chart}
${adm?`<div class="card"><b>Low stock</b>${low.length?low.map(m=>`<div class="line"><span class="n">${E(m.name)}</span><b class="${stk[m.id].qty<=0?"bad":""}">${stk[m.id].qty<=0?"Out":stk[m.id].qty+" left"}</b></div>`).join(""):'<div class="empty">Everything is stocked</div>'}</div>`:""}</div>`}
$("#dash").onclick=e=>{const g=e.target.closest("[data-go]");if(g){go(g.dataset.go);render();return}if(e.target.closest(".dt.warn")){go("orders");render()}};
function beep(){try{const a=new (window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a.destination);o.frequency.value=880;g.gain.setValueAtTime(.2,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.6);o.start();o.stop(a.currentTime+.6)}catch(e){}}
function drawKioskAlerts(){
  const nb=$("#nb-o");if(nb){nb.textContent=kioskOrders.length||"";nb.style.display=kioskOrders.length?"":"none"}drawDash();
  const el=$("#kiosk-alerts");if(!el)return;
  if(!kioskOrders.length){el.innerHTML="";return}
  const ago=t=>{const m=Math.max(0,Math.round((Date.now()-t)/6e4));return m<1?"just now":m<60?m+" min ago":Math.floor(m/60)+"h ago"};
  el.innerHTML=`<div class="kqh"><b>Kiosk orders waiting (${kioskOrders.length})</b><small>oldest first</small></div><div class="kq">${kioskOrders.map(o=>`<div class="kc${o.id==loadedKid?" ld":""}"><div class="kh"><b>#${E(o.token||"")}</b><span>${E(o.type||"")}${o.tbl?" · Table "+E(o.tbl):""}</span><small>${ago(o.t)}</small></div><div class="kn">${E(o.cust||"")} · ${o.lines.reduce((a,l)=>a+l.qty,0)} item${o.lines.reduce((a,l)=>a+l.qty,0)==1?"":"s"} · ${rs(o.tot)}</div><div class="ka">${o.id==loadedKid?'<span class="kl">In current bill</span>':`<button class="btn s w" data-kid="${o.id}">Load</button>`}<button class="btn d w" data-kdel="${o.id}" aria-label="Dismiss order" title="Dismiss">&times;</button></div></div>`).join("")}</div>`;
}
setInterval(()=>{if(cur.u&&kioskOrders.length)drawKioskAlerts()},60000);
$("#kiosk-alerts").onclick=async e=>{
  const kid=e.target.dataset.kid,kdel=e.target.dataset.kdel;
  if(kid){
    const o=kioskOrders.find(x=>x.id==kid);
    if(o){
      if(Object.keys(cart).length&&!confirm("Replace the current bill with this kiosk order?"))return;
      cart={};o.lines.forEach(l=>{cart[l.id]=l.qty});
      $("#cust").value = o.cust || "";
      $("#tbl").value = o.tbl || "";
      $("#ph").value = o.phone || "";
      const rad=document.querySelector(`[name=ot][value="${o.type}"]`);if(rad)rad.checked=true;
      loadedKid=kid;
      const nb=document.querySelector('nav button[data-t="bill"]');if(nb)nb.click();
      drawCart();drawKioskAlerts();toast("Kiosk order loaded. Generate the bill to complete it.");
    }
  }
  if(kdel){if(kdel==loadedKid)loadedKid="";try{await fdb.doc("kiosk_orders/"+kdel).delete()}catch(er){}}
};
function drawUsers(){if(cur.role!="admin")return;$("#ulist").innerHTML=Object.entries(users).map(([id,u])=>`<div class="line"><span class="n"><b>${E(u.name)}</b> (${E(u.email)}), ${u.role}</span>${id==cur.u?"":`<button class="btn d w" data-x="${id}">Remove</button>`}</div>`).join("")}
$("#ulist").onclick=async e=>{const x=e.target.dataset.x;if(x&&cur.role=="admin"&&confirm("Remove this account? They will lose access."))try{await fdb.doc("users/"+x).delete()}catch(er){toast("Could not remove")}};
$("#uadd").onclick=async()=>{if(cur.role!="admin")return;const u=$("#ua").value.trim().toLowerCase(),n=$("#un").value.trim()||u,p=$("#up").value,r=$("#ur").value;
if(!/^[a-z0-9._-]{3,}$/.test(u)){toast("Username: 3+ letters or numbers");return}if(p.length<6){toast("Password needs 6+ characters");return}
try{if(!sec)sec=firebase.initializeApp(FIREBASE_CONFIG,"sec");const sa=sec.auth(),c=await sa.createUserWithEmailAndPassword(em(u),p);await fdb.doc("users/"+c.user.uid).set({email:u,name:n,role:r,initials:ini(n),billCount:0,createdAt:Date.now()});await sa.signOut();$("#ua").value=$("#un").value=$("#up").value="";toast("Account added")}catch(e){toast(e.code=="auth/email-already-in-use"?"Username already used":"Could not add: "+(e.code||"error"))}};
$("#cpb").onclick=async()=>{const u=auth.currentUser,n=$("#np2").value;if(n.length<6){toast("New password needs 6+ characters");return}
try{await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email,$("#cp").value));await u.updatePassword(n);$("#cp").value=$("#np2").value="";toast("Password changed")}catch(e){toast("Current password is wrong")}};
let stk={},rep=null;
const ymd=d=>d.toLocaleDateString("en-CA");
function lowAlert(){const L=menu.filter(m=>stk[m.id]&&stk[m.id].qty<=stk[m.id].low).map(m=>m.name+" ("+stk[m.id].qty+" left)");$("#lowbar").textContent=L.length?"Low stock: "+L.join(", "):""}
function drawStock(){if(cur.role!="admin")return;$("#stlist").innerHTML=paged("s",menu,"#pg-s",drawStock).map(m=>{const s=stk[m.id];return `<tr><td data-l="Item">${E(m.name)}</td><td data-l="In stock"><input type="number" min="0" value="${s?s.qty:""}" placeholder="Not tracked" data-q="${m.id}" style="width:120px"></td><td data-l="Low alert at"><input type="number" min="0" value="${s?s.low:""}" placeholder="5" data-l="${m.id}" style="width:80px"></td><td data-l=""><button class="btn s w" data-a="${m.id}">+ Add</button></td></tr>`}).join("")}
$("#stlist").onchange=async e=>{const t=e.target,id=t.dataset.q||t.dataset.l;if(!id||cur.role!="admin")return;const row=t.closest("tr"),q=row.querySelector("[data-q]").value,l=row.querySelector("[data-l]").value;
try{if(q==="")await fdb.doc("stock/"+id).delete();else await fdb.doc("stock/"+id).set({qty:Math.max(0,+q),low:l===""?5:Math.max(0,+l)});toast("Stock saved")}catch(er){toast("Save failed")}};
$("#stlist").onclick=async e=>{const id=e.target.dataset.a;if(!id||cur.role!="admin")return;const a=+prompt("How many to add?","0");if(!(a>0))return;const s=stk[id]||{qty:0,low:5};
try{await fdb.doc("stock/"+id).set({qty:s.qty+a,low:s.low});toast("Stock updated")}catch(er){toast("Save failed")}};
function preset(p){const n=new Date();let a=new Date(n),b=new Date(n);if(p=="7")a.setDate(a.getDate()-6);else if(p=="m")a=new Date(n.getFullYear(),n.getMonth(),1);else if(p=="pm"){a=new Date(n.getFullYear(),n.getMonth()-1,1);b=new Date(n.getFullYear(),n.getMonth(),0)}$("#rf").value=ymd(a);$("#rt").value=ymd(b);runRep()}
$("#rpre").onclick=e=>{if(e.target.dataset.p!==undefined)preset(e.target.dataset.p)};
$("#rgo").onclick=()=>runRep();
function build(L,a,b){const it={},dy={},st={},pay={Cash:0,UPI:0,Card:0};let rev=0,disc=0,gst=0;
L.forEach(o=>{rev+=o.tot;disc+=o.d||0;gst+=o.g||0;pay[o.pay]=(pay[o.pay]||0)+o.tot;const d=dy[o.day]=dy[o.day]||{n:0,r:0};d.n++;d.r+=o.tot;const s=st[o.by]=st[o.by]||{n:0,r:0};s.n++;s.r+=o.tot;
o.lines.forEach(l=>{const x=it[l.name]=it[l.name]||{q:0,r:0};x.q+=l.qty;x.r+=l.amt})});return{L,a,b,rev,disc,gst,pay,it,dy,st}}
async function runRep(){if(cur.role!="admin")return;const a=$("#rf").value,b=$("#rt").value;if(!a||!b||a>b){toast("Choose a valid date range");return}
$("#rpt").innerHTML='<div class="empty">Loading...</div>';
try{const s=await fdb.collection("orders").where("day",">=",a).where("day","<=",b).get();rep=build(s.docs.map(d=>d.data()).sort((x,y)=>x.t-y.t),a,b);drawRep()}catch(e){$("#rpt").innerHTML='<div class="empty">Could not load the report</div>'}}
const T=(h,rows)=>`<div class="scroll"><table><thead><tr>${h.map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map(c=>`<tr>${c.map(x=>`<td>${x}</td>`).join("")}</tr>`).join("")||'<tr><td>No data</td></tr>'}</tbody></table></div>`;
function drawRep(){const r=rep;if(!r)return;const stat=(v,l)=>`<div class="card stat"><b>${v}</b><span>${l}</span></div>`;
$("#rpt").innerHTML=`<h3 style="margin:0 0 4px">${E(S.name)}: Sales report</h3><div style="color:var(--mu);margin-bottom:10px">${r.a} to ${r.b}</div>
<div class="stats">${stat(r.L.length,"Bills")}${stat(rs(r.rev),"Total sales (incl. GST)")}${stat(rs(r.L.length?r.rev/r.L.length:0),"Average bill")}${stat(rs(r.gst),"GST collected")}${stat(rs(r.disc),"Discounts given")}</div>
<p><b>By payment mode</b></p>${T(["Mode","Amount"],Object.entries(r.pay).map(([k,v])=>[k,rs(v)]))}
<p><b>Item-wise sales</b> <small style="color:var(--mu)">(amounts before discount and GST)</small></p>${T(["Item","Qty sold","Amount"],Object.entries(r.it).sort((x,y)=>y[1].q-x[1].q).map(([k,v])=>[E(k),v.q,rs(v.r)]))}
<p><b>Day-wise sales</b></p>${T(["Date","Bills","Sales"],Object.entries(r.dy).sort().map(([k,v])=>[k,v.n,rs(v.r)]))}
<p><b>By staff</b></p>${T(["Staff","Bills","Sales"],Object.entries(r.st).map(([k,v])=>[E(nm[k]||"Staff"),v.n,rs(v.r)]))}`}
function sheets(){const r=rep;return{Summary:[["Report","Sales report"],["From",r.a],["To",r.b],["Bills",r.L.length],["Total sales incl GST",r.rev],["GST collected",r.gst],["Discounts",r.disc],...Object.entries(r.pay).map(([k,v])=>["Paid by "+k,v])],
Items:[["Item","Qty sold","Amount before discount and GST"],...Object.entries(r.it).sort((x,y)=>y[1].q-x[1].q).map(([k,v])=>[k,v.q,v.r])],
Days:[["Date","Bills","Sales"],...Object.entries(r.dy).sort().map(([k,v])=>[k,v.n,v.r])],
Bills:[["Bill","Date","Time","Cashier","Type","Customer","Payment","Subtotal","Discount","GST","Total"],...r.L.map(o=>[o.lb,o.day,new Date(o.t).toLocaleTimeString("en-IN"),nm[o.by]||"Staff",o.type,o.cust||"",o.pay,o.sub,o.d||0,o.g||0,o.tot])],
Stock:[["Item","In stock now","Low alert at"],...menu.filter(m=>stk[m.id]).map(m=>[m.name,stk[m.id].qty,stk[m.id].low])]}}
const dl=(b,n)=>{const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=n;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)};
function dlCsv(){const q=v=>'"'+String(v).replace(/"/g,'""')+'"';let s="";Object.entries(sheets()).forEach(([n,a])=>{s+=n+"\r\n"+a.map(r=>r.map(q).join(",")).join("\r\n")+"\r\n\r\n"});dl(new Blob(["\ufeff"+s],{type:"text/csv"}),"sales-"+rep.a+"-to-"+rep.b+".csv")}
$("#rcsv").onclick=()=>{if(!rep){toast("Show a report first");return}dlCsv()};
$("#rxl").onclick=()=>{if(!rep){toast("Show a report first");return}if(typeof XLSX=="undefined"){toast("Excel tool not loaded, saving CSV instead");dlCsv();return}
const wb=XLSX.utils.book_new();Object.entries(sheets()).forEach(([n,a])=>XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(a),n));XLSX.writeFile(wb,"sales-"+rep.a+"-to-"+rep.b+".xlsx")};
$("#rpdf").onclick=()=>{if(!rep){toast("Show a report first");return}let e=$("#pg");if(!e){e=document.createElement("style");e.id="pg";document.head.appendChild(e)}e.textContent="@page{size:A4;margin:12mm}";document.body.classList.add("prep");try{window.print()}finally{document.body.classList.remove("prep")}};
$("#rf").value=$("#rt").value=today();
function rtext(o){const dt=new Date(o.t),L=[];L.push("*"+S.name+"*");if(S.addr)L.push(S.addr);if(S.gstin)L.push("GSTIN: "+S.gstin);
L.push("Bill: "+o.lb+" ("+o.type+")",dt.toLocaleDateString("en-IN")+" "+dt.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}));if(o.cust)L.push("Customer: "+o.cust);
L.push("------------------");o.lines.forEach(l=>L.push(l.name+" x"+l.qty+" = "+rs(l.amt)));L.push("------------------","Subtotal: "+rs(o.sub));if(o.d)L.push("Discount: -"+rs(o.d));
L.push("CGST "+o.gst/2+"%: "+rs(o.g/2),"SGST "+o.gst/2+"%: "+rs(o.g/2));if(o.ro)L.push("Round off: "+rs(o.ro));L.push("*TOTAL: "+rs(o.tot)+"*","Paid by "+o.pay,"",S.foot);return L.join("\n")}
function waNum(v){let d=(v||"").replace(/\D/g,"");if(d.length==11&&d[0]=="0")d=d.slice(1);if(d.length==10)d="91"+d;return d.length>=11&&d.length<=15?d:""}
$("#wat").onclick=()=>{const n=waNum($("#wph").value);if(!n){toast("Enter a valid mobile number");return}window.open("https://wa.me/"+n+"?text="+encodeURIComponent(rtext(last)),"_blank")};
let pimg=null,ppdf=null;
const RF='"Courier New",Consolas,monospace',mob=/Android|iPhone|iPad/i.test(navigator.userAgent);
function rimg(o,ty){return new Promise(res=>{const W=420,P=20,sc=2,dt=new Date(o.t),h=o.gst/2,m=v=>v.toFixed(2),R=[],c=document.createElement("canvas"),x=c.getContext("2d");
R.push({k:"logo"},{k:"c",s:S.name,b:1,z:20});if(S.addr)R.push({k:"c",s:S.addr});if(S.gstin)R.push({k:"c",s:"GSTIN: "+S.gstin});
R.push({k:"hr"},{k:"lr",l:"Bill "+o.lb,r:o.type},{k:"l",s:dt.toLocaleDateString("en-IN")+" "+dt.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})});
if(o.cust||o.tbl)R.push({k:"l",s:((o.cust||"")+" "+(o.tbl?"Table "+o.tbl:"")).trim()});
R.push({k:"hr"});o.lines.forEach(l=>R.push({k:"lr",l:l.name+" x"+l.qty,r:m(l.amt)}));
R.push({k:"hr"},{k:"lr",l:"Subtotal",r:m(o.sub)});if(o.d)R.push({k:"lr",l:"Discount",r:"-"+m(o.d)});
R.push({k:"lr",l:"CGST "+h+"%",r:m(o.g/2)},{k:"lr",l:"SGST "+h+"%",r:m(o.g/2)});if(o.ro)R.push({k:"lr",l:"Round off",r:m(o.ro)});
R.push({k:"hr"},{k:"lr",l:"TOTAL",r:"\u20B9"+m(o.tot),b:1,z:20},{k:"l",s:"Paid by "+o.pay},{k:"hr"},{k:"c",s:S.foot||""});
const f=(z,b)=>x.font=(b?"bold ":"")+(z||15)+"px "+RF;
const wrap=(s,w,z,b)=>{f(z,b);const out=[];let cur="";String(s).split(" ").forEach(wd=>{const t=cur?cur+" "+wd:wd;if(x.measureText(t).width>w&&cur){out.push(cur);cur=wd}else cur=t});out.push(cur);return out};
R.forEach(e=>{const z=e.z||15,lh=z+7;if(e.k=="logo")e.h=76;else if(e.k=="hr")e.h=14;
else if(e.k=="lr"){f(z,e.b);const rw=x.measureText(e.r).width;e.ls=wrap(e.l,W-2*P-rw-12,z,e.b);e.h=e.ls.length*lh}
else{e.ls=wrap(e.s,W-2*P,z,e.b);e.h=e.ls.length*lh}});
const H=R.reduce((a,e)=>a+e.h,0)+2*P;c.width=W*sc;c.height=H*sc;x.scale(sc,sc);x.fillStyle="#fff";x.fillRect(0,0,W,H);x.fillStyle="#000";x.textBaseline="top";
const img=new Image();img.onload=img.onerror=()=>{let y=P;R.forEach(e=>{const z=e.z||15,lh=z+7;f(z,e.b);
if(e.k=="logo"){if(img.width)x.drawImage(img,W/2-33,y+2,66,66)}
else if(e.k=="hr"){x.setLineDash([4,3]);x.beginPath();x.moveTo(P,y+7);x.lineTo(W-P,y+7);x.strokeStyle="#000";x.stroke()}
else if(e.k=="lr"){e.ls.forEach((s,i)=>{x.textAlign="left";x.fillText(s,P,y+i*lh)});x.textAlign="right";x.fillText(e.r,W-P,y)}
else e.ls.forEach((s,i)=>{x.textAlign=e.k=="c"?"center":"left";x.fillText(s,e.k=="c"?W/2:P,y+i*lh)});y+=e.h});
c.toBlob(b=>{b.cw=c.width;b.ch=c.height;res(b)},ty||"image/png",0.92)};img.src=document.querySelector("header img").src})}
$("#whint").textContent=mob?"Choose WhatsApp, then the customer's chat.":"On a computer the PDF is saved and the customer's chat opens. Click the clip icon, choose Document, pick the PDF, then Send.";
$("#simg").onclick=async()=>{const b=ppdf||await billPdf(last);dl(b,"bill-"+last.lb+".pdf")};
$("#wimg").onclick=async()=>{const n=waNum($("#wph").value),b=pimg||await rimg(last),nf="bill-"+last.lb+".png",file=new File([b],nf,{type:"image/png"});
if(mob&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:S.name+" bill"});return}catch(e){if(e.name=="AbortError")return}}
let ok=false;try{await navigator.clipboard.write([new ClipboardItem({"image/png":b})]);ok=true}catch(e){}
if(n)window.open("https://wa.me/"+n,"_blank");
if(ok)toast(n?"Bill photo copied. Press Ctrl+V in WhatsApp, then Send":"Photo copied. Open the customer's chat, press Ctrl+V, then Send");else{dl(b,nf);toast("Photo saved. Attach it in WhatsApp with the clip icon")}};

function mkpdf(j,w,h,pw,ph){const en=s=>new TextEncoder().encode(s),P=[],O=[];let off=0;const add=b=>{P.push(b);off+=b.length};
add(en("%PDF-1.4\n"));O[1]=off;add(en("1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"));O[2]=off;add(en("2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"));
O[3]=off;add(en("3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 "+pw+" "+ph+"]/Resources<</XObject<</Im0 4 0 R>>>>/Contents 5 0 R>>endobj\n"));
O[4]=off;add(en("4 0 obj<</Type/XObject/Subtype/Image/Width "+w+"/Height "+h+"/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length "+j.length+">>stream\n"));add(j);add(en("\nendstream\nendobj\n"));
const cs="q "+pw+" 0 0 "+ph+" 0 0 cm /Im0 Do Q";O[5]=off;add(en("5 0 obj<</Length "+cs.length+">>stream\n"+cs+"\nendstream\nendobj\n"));
const x=off;let xr="xref\n0 6\n0000000000 65535 f \n";for(let i=1;i<=5;i++)xr+=String(O[i]).padStart(10,"0")+" 00000 n \n";
add(en(xr+"trailer<</Size 6/Root 1 0 R>>\nstartxref\n"+x+"\n%%EOF"));return new Blob(P,{type:"application/pdf"})}
async function billPdf(o){const b=await rimg(o,"image/jpeg"),u=new Uint8Array(await b.arrayBuffer()),pw=300,ph=Math.round(pw*b.ch/b.cw*100)/100;return mkpdf(u,b.cw,b.ch,pw,ph)}
$("#wa").onclick=async()=>{const n=waNum($("#wph").value),b=ppdf||await billPdf(last),nf="bill-"+last.lb+".pdf",file=new File([b],nf,{type:"application/pdf"});
if(mob&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:S.name+" bill"});return}catch(e){if(e.name=="AbortError")return}}
dl(b,nf);if(n)window.open("https://wa.me/"+n,"_blank");toast("PDF saved. In the WhatsApp chat click the clip icon, choose Document, pick the PDF, then Send")};

async function showLogin(){off();orders=[];cur={u:"",role:"view"};document.body.className="out";$("#login").style.display="flex";$("#lp").value="";$("#lf").style.display="";$("#sf").style.display="none";
try{const s=await fdb.doc("meta/init").get(),f=!s.exists;$("#lf").style.display=f?"none":"";$("#sf").style.display=f?"":"none";gate(f?"First-time setup: create the owner account.":"")}catch(e){gate("Cannot reach the database. Check the Firestore rules and your internet.")}}
async function enter(u){try{const d=await fdb.doc("users/"+u.uid).get();if(!d.exists)throw{code:"permission-denied"};const x=d.data();
cur={u:u.uid,role:x.role};nm[u.uid]=x.name;document.body.className=x.role=="admin"?"":"staff";$("#ub").textContent=x.name+" ("+x.role+")";$("#login").style.display="none";
go(x.role=="admin"?"dash":"bill");subs();render()}
catch(e){await auth.signOut();$("#le").textContent=e.code=="permission-denied"?"This account has no access. Ask the owner.":"Connection problem. Try again."}}
$("#lb").onclick=async()=>{try{await auth.signInWithEmailAndPassword(em($("#lu").value),$("#lp").value);$("#le").textContent=""}catch(e){$("#le").textContent="Wrong username or password"}};
document.querySelectorAll("[data-eye]").forEach(b=>b.onclick=()=>{const i=b.previousElementSibling,s=i.type=="password";i.type=s?"text":"password";b.textContent=s?"Hide":"Show";b.setAttribute("aria-label",s?"Hide password":"Show password")});
$("#lp").onkeydown=e=>{if(e.key=="Enter")$("#lb").click()};
$("#lo").onclick=()=>{reset();auth.signOut()};
$("#sb").onclick=async()=>{const n=$("#sn").value.trim(),e=$("#se").value.trim().toLowerCase(),p=$("#sp").value;
if(!n||!e.includes("@")||p.length<6){$("#le2").textContent="Enter your name, a real email, and a 6+ character password";return}
window.creating=true;try{const c=await auth.createUserWithEmailAndPassword(e,p),b=fdb.batch();b.set(fdb.doc("users/"+c.user.uid),{email:e,name:n,role:"admin",initials:ini(n),billCount:0,createdAt:Date.now()});b.set(fdb.doc("meta/init"),{t:Date.now()});await b.commit();window.creating=false;enter(c.user)}catch(x){window.creating=false;$("#le2").textContent=x.message;if(auth.currentUser)auth.signOut()}};

  auth.onAuthStateChanged(u=>{if(window.creating)return;u?enter(u):showLogin()});


}
