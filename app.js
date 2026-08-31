import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const cfg=window.APP_CONFIG||{};
const supabase=createClient(cfg.supabaseUrl,cfg.supabaseKey);
const app=document.getElementById("app");
const MODULES=[["dashboard","Início"],["new-order","Nova encomenda"],["orders","Encomendas"],["stock","Stock"],["meta","Meta Ads"],["shipping","Portes"],["expenses","Despesas"]];
const LABEL=Object.fromEntries(MODULES);
const CHANNELS=["Shopify","Instagram","Facebook","WhatsApp","Vinted"];
const STATUSES=["Em trânsito","Entregue","Devolvido","Cancelado antes envio"];
const EXPENSE_TYPES=["Shopify","Apps","Embalagens","Domínio","Material","Outro"];
const state={session:null,access:null,directory:[],workspaces:[],workspace:null,page:"dashboard",stock:[],orders:[],items:[],shipping:[],meta:[],expenses:[],adminUsers:[],dashboardMonth:new Date().toISOString().slice(0,7)};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const eur=n=>new Intl.NumberFormat("pt-PT",{style:"currency",currency:"EUR"}).format(Number(n||0));
const int=n=>new Intl.NumberFormat("pt-PT",{maximumFractionDigits:0}).format(Number(n||0));
const today=()=>new Date().toISOString().slice(0,10);
const initials=n=>String(n||"?").trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()).join("")||"?";
const safeSlug=v=>String(v||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const logo=(url,name,cls="profile-logo")=>`<div class="${cls}">${url?`<img src="${esc(url)}" alt="${esc(name)}">`:esc(initials(name))}</div>`;
const show=(el,text,type="")=>{if(el){el.hidden=false;el.className=`notice ${type}`;el.textContent=text}};
const hide=el=>{if(el)el.hidden=true};
const isAdmin=()=>!!state.access?.is_admin;
const can=m=>isAdmin()||(state.access?.modules||[]).includes(m);
const availableModules=()=>isAdmin()?[]:(state.access?.modules||[]);

async function init(){
  renderChooser();
  try{
    const {data}=await supabase.auth.getSession();
    state.session=data.session||null;
    await loadDirectory();
    if(state.session&&await restoreSession())return;
    renderChooser();
  }catch(err){
    console.error(err);
    renderChooser();
  }
}
async function loadDirectory(){
  const {data}=await supabase.from("login_directory").select("user_id,workspace_id,display_name,login_handle,workspace_name,logo_url,sort_order").eq("is_visible",true).order("sort_order").order("display_name");
  state.directory=data||[];
}
async function restoreSession(){
  const {data,error}=await supabase.from("user_access").select("*").eq("user_id",state.session.user.id).maybeSingle();
  if(error||!data||!data.is_active){await supabase.auth.signOut();state.session=null;state.access=null;return false}
  state.access=data;
  if(data.is_admin){
    state.workspace=null;
    state.page="admin-users";
    await loadAdminWorkspaces();
    renderShell();
    return true;
  }
  const {data:ws}=await supabase.from("workspaces").select("*").eq("id",data.workspace_id).single();
  if(!ws){await supabase.auth.signOut();state.session=null;state.access=null;return false}
  state.workspace=ws;
  const mods=data.modules||[];
  state.page=mods.includes("dashboard")?"dashboard":(mods[0]||"stock");
  await loadWorkspaceData();
  renderShell();
  return true;
}
async function loadAdminWorkspaces(){const {data}=await supabase.from("workspaces").select("*").eq("is_active",true).order("name");state.workspaces=data||[]}
async function clearLogin(){if(state.session)await supabase.auth.signOut();state.session=null;state.access=null;state.workspace=null}

function renderChooser(){
  app.innerHTML=`<main class="auth-page"><div class="auth-wrap"><div class="auth-head"><h1>Quem vai trabalhar?</h1><p>Escolhe o teu utilizador. Cada pessoa vê apenas a área que lhe foi dada.</p></div><div class="profile-grid"><button class="profile-card admin-card" id="adminCard">${logo(null,"Admin")}<strong>Administrador</strong><span>Criar utilizadores e gerir acessos.</span></button>${state.directory.map(p=>`<button class="profile-card" data-profile="${esc(p.login_handle)}">${logo(p.logo_url,p.workspace_name)}<strong>${esc(p.display_name)}</strong><span>${esc(p.workspace_name)}</span></button>`).join("")}</div></div></main>`;
  document.getElementById("adminCard").onclick=renderAdminLogin;
  document.querySelectorAll("[data-profile]").forEach(b=>b.onclick=()=>renderUserLogin(b.dataset.profile));
}
async function renderAdminLogin(){
  await clearLogin();
  app.innerHTML=`<main class="auth-page"><div class="auth-wrap"><section class="login-panel">${logo(null,"Admin","profile-logo login-logo")}<h2>Administrador</h2><p>Entra com o email e palavra-passe que já criaste.</p><div class="grid"><label>Email<input id="aEmail" type="email" autocomplete="email"></label><label>Palavra-passe<input id="aPass" type="password" autocomplete="current-password"></label><div id="loginMsg" class="notice" hidden></div><div class="login-actions"><button id="aEnter" class="btn">Entrar</button><button id="back" class="btn btn-light">Voltar</button></div></div></section></div></main>`;
  document.getElementById("back").onclick=renderChooser;
  document.getElementById("aEnter").onclick=async()=>{const msg=document.getElementById("loginMsg");hide(msg);const email=document.getElementById("aEmail").value.trim(),password=document.getElementById("aPass").value;const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)return show(msg,"Email ou palavra-passe incorretos.","error");state.session=data.session;if(!await restoreSession())return show(msg,"Conta sem acesso.","error");if(!isAdmin()){await logout();alert("Esta conta não é administrador.")}};
}
async function renderUserLogin(handle){
  await clearLogin();const p=state.directory.find(x=>x.login_handle===handle);if(!p)return renderChooser();
  app.innerHTML=`<main class="auth-page"><div class="auth-wrap"><section class="login-panel">${logo(p.logo_url,p.workspace_name,"profile-logo login-logo")}<h2>${esc(p.display_name)}</h2><p>${esc(p.workspace_name)}</p><div class="grid"><label>Palavra-passe<input id="uPass" type="password" autocomplete="current-password" autofocus></label><div id="loginMsg" class="notice" hidden></div><div class="login-actions"><button id="uEnter" class="btn">Entrar</button><button id="back" class="btn btn-light">Voltar</button></div></div></section></div></main>`;
  document.getElementById("back").onclick=renderChooser;
  document.getElementById("uEnter").onclick=async()=>{const msg=document.getElementById("loginMsg");hide(msg);const password=document.getElementById("uPass").value,email=`${p.login_handle}@users.luckymanager.local`;const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)return show(msg,"Palavra-passe incorreta.","error");state.session=data.session;if(!await restoreSession())show(msg,"Utilizador desativado ou sem acesso.","error")};
}
async function logout(){await supabase.auth.signOut();state.session=null;state.access=null;state.workspace=null;state.page="dashboard";await loadDirectory();renderChooser()}

async function loadWorkspaceData(){
  const id=state.workspace.id;
  const [s,o,i,p,m,e]=await Promise.all([
    supabase.from("stock_items").select("*").eq("workspace_id",id).order("created_at",{ascending:false}),
    supabase.from("orders").select("*").eq("workspace_id",id).order("order_date",{ascending:false}).order("created_at",{ascending:false}),
    supabase.from("order_items").select("*").eq("workspace_id",id).order("created_at"),
    supabase.from("shipping_rates").select("*").eq("workspace_id",id).order("created_at"),
    supabase.from("meta_ads").select("*").eq("workspace_id",id).order("spend_date",{ascending:false}),
    supabase.from("expenses").select("*").eq("workspace_id",id).order("expense_date",{ascending:false})]);
  state.stock=s.data||[];state.orders=o.data||[];state.items=i.data||[];state.shipping=p.data||[];state.meta=m.data||[];state.expenses=e.data||[];
}
function navItems(){const mods=availableModules();return MODULES.filter(([id])=>mods.includes(id))}
function renderShell(){
  if(isAdmin()){
    app.innerHTML=`<div class="app-shell admin-only-shell"><aside class="sidebar">
      <div class="side-brand">${logo(null,"Admin","side-logo")}<div><strong>Administrador</strong><small>${esc(state.session?.user?.email||"")}</small></div></div>
      <nav class="nav-group"><div class="nav-label">Administração</div><button class="nav-btn active" data-page="admin-users">Utilizadores</button></nav>
      <div class="sidebar-foot"><button id="switchUser">Voltar aos utilizadores</button><button id="logout">Terminar sessão</button></div>
    </aside><main class="main"><div id="page"></div></main></div>`;
    document.getElementById("logout").onclick=logout;
    document.getElementById("switchUser").onclick=logout;
    state.page="admin-users";
    renderPage();
    return;
  }

  const nav=navItems();
  app.innerHTML=`<div class="app-shell"><aside class="sidebar">
    <div class="side-brand">${logo(state.workspace?.logo_url,state.workspace?.name,"side-logo")}<div><strong>${esc(state.workspace?.name||"Gestão")}</strong><small>${esc(state.access?.display_name||"")}</small></div></div>
    <nav class="nav-group"><div class="nav-label">Menu</div>${nav.map(([id,l])=>`<button class="nav-btn ${state.page===id?"active":""}" data-page="${id}">${l}</button>`).join("")}</nav>
    <div class="sidebar-foot"><button id="switchUser">Trocar utilizador</button><button id="logout">Terminar sessão</button></div>
  </aside><main class="main"><div id="page"></div></main><nav class="mobile-nav">${nav.slice(0,5).map(([id,l])=>`<button data-page="${id}" class="${state.page===id?"active":""}">${l}</button>`).join("")}</nav></div>`;
  document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>go(b.dataset.page));
  document.getElementById("logout").onclick=logout;
  document.getElementById("switchUser").onclick=logout;
  renderPage();
}
function go(page){state.page=page;renderShell()}
function pageHead(title,sub="",button=""){return `<div class="page-head"><div><h1>${title}</h1>${sub?`<p>${sub}</p>`:""}</div>${button?`<div class="page-actions">${button}</div>`:""}</div>`}
function renderPage(){
  const t=document.getElementById("page");
  if(isAdmin()){state.page="admin-users";return renderAdminUsers(t)}
  if(state.page==="dashboard")return renderDashboard(t);
  if(state.page==="stock")return renderStock(t);
  if(state.page==="new-order")return renderNewOrder(t);
  if(state.page==="orders")return renderOrders(t);
  if(state.page==="meta")return renderMeta(t);
  if(state.page==="shipping")return renderShipping(t);
  if(state.page==="expenses")return renderExpenses(t);
  state.page=can("stock")?"stock":availableModules()[0];
  renderShell();
}

function monthLabel(key){
  const [y,m]=String(key||today().slice(0,7)).split("-").map(Number);
  return new Intl.DateTimeFormat("pt-PT",{month:"long",year:"numeric"}).format(new Date(y,m-1,1));
}
function shiftDashboardMonth(delta){
  const [y,m]=state.dashboardMonth.split("-").map(Number);
  const d=new Date(y,m-1+delta,1);
  state.dashboardMonth=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  renderDashboard(document.getElementById("page"));
}
function renderDashboard(t){
  const month=state.dashboardMonth||today().slice(0,7);
  const orders=state.orders.filter(x=>String(x.order_date).startsWith(month));
  const revenue=orders.reduce((a,x)=>a+Number(x.revenue||0),0);
  const orderResult=orders.reduce((a,x)=>a+Number(x.result||0),0);
  const meta=state.meta.filter(x=>String(x.spend_date).startsWith(month)).reduce((a,x)=>a+Number(x.amount||0),0);
  const expenses=state.expenses.filter(x=>String(x.expense_date).startsWith(month)).reduce((a,x)=>a+Number(x.amount||0),0);
  const stockPurchases=state.stock.filter(x=>x.origin==="Compra manual"&&String(x.created_at).startsWith(month)).reduce((a,x)=>a+Number(x.initial_quantity||0)*Number(x.unit_cost||0),0);
  const real=orderResult-expenses-stockPurchases;
  const units=state.stock.reduce((a,x)=>a+Math.max(0,Number(x.quantity||0)),0);
  const delivered=orders.filter(x=>x.status==="Entregue").length;
  const returned=orders.filter(x=>x.status==="Devolvido").length;
  const monthOrders=[...orders].sort((a,b)=>String(b.order_date).localeCompare(String(a.order_date))).slice(0,5);
  const label=monthLabel(month);

  t.innerHTML=`
    ${pageHead("Início",`Resumo de ${state.workspace.name}`)}

    <div class="month-toolbar card">
      <button class="btn btn-light month-arrow" id="prevMonth">←</button>
      <div class="month-title">
        <span>Mês a analisar</span>
        <strong>${esc(label)}</strong>
      </div>
      <input id="dashboardMonth" type="month" value="${esc(month)}">
      <button class="btn btn-light month-arrow" id="nextMonth">→</button>
      <button class="btn btn-soft" id="thisMonth">Mês atual</button>
    </div>

    <div class="stats">
      <div class="stat">
        <div class="stat-label">Receita</div>
        <div class="stat-value">${eur(revenue)}</div>
        <div class="stat-note">${esc(label)}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Resultado real</div>
        <div class="stat-value ${real>=0?"good":"bad"}">${eur(real)}</div>
        <div class="stat-note">despesas e compras de stock incluídas</div>
      </div>
      <div class="stat">
        <div class="stat-label">Stock em casa</div>
        <div class="stat-value">${int(units)}</div>
        <div class="stat-note">stock atual, não histórico</div>
      </div>
      <div class="stat">
        <div class="stat-label">Meta Ads</div>
        <div class="stat-value">${eur(meta)}</div>
        <div class="stat-note">${esc(label)}</div>
      </div>
    </div>

    <div class="grid grid-3 dashboard-counts">
      <div class="soft-card"><div class="stat-label">Encomendas</div><div class="stat-value">${orders.length}</div></div>
      <div class="soft-card"><div class="stat-label">Entregues</div><div class="stat-value good">${delivered}</div></div>
      <div class="soft-card"><div class="stat-label">Devolvidas</div><div class="stat-value bad">${returned}</div></div>
    </div>

    <div class="two-col" style="margin-top:16px">
      <section class="card">
        <div class="section-head">
          <h2>Encomendas de ${esc(label)}</h2>
          <span class="spacer"></span>
          ${can("orders")?`<button class="btn btn-light" id="allOrders">Ver todas</button>`:""}
        </div>
        ${monthOrders.length?`<div class="grid">${monthOrders.map(o=>`
          <div class="order-card">
            <div class="order-top">
              <strong>${esc(o.order_ref)}</strong>
              <span class="badge">${esc(o.status)}</span>
              <span class="spacer"></span>
              <strong>${eur(o.revenue)}</strong>
            </div>
            <div class="muted">${esc(o.order_date)} · ${esc(o.channel)}</div>
          </div>`).join("")}</div>`:`<div class="empty">Não existem encomendas neste mês.</div>`}
      </section>

      <section class="card">
        <div class="section-head"><h2>Ações rápidas</h2></div>
        <div class="grid">
          ${can("new-order")?`<button class="btn" id="quickOrder">+ Nova encomenda</button>`:""}
          ${can("stock")?`<button class="btn btn-light" id="quickStock">Abrir stock</button>`:""}
        </div>
      </section>
    </div>`;

  document.getElementById("prevMonth").onclick=()=>shiftDashboardMonth(-1);
  document.getElementById("nextMonth").onclick=()=>shiftDashboardMonth(1);
  document.getElementById("dashboardMonth").onchange=e=>{
    if(e.target.value){
      state.dashboardMonth=e.target.value;
      renderDashboard(document.getElementById("page"));
    }
  };
  document.getElementById("thisMonth").onclick=()=>{
    state.dashboardMonth=today().slice(0,7);
    renderDashboard(document.getElementById("page"));
  };
  document.getElementById("allOrders")?.addEventListener("click",()=>go("orders"));
  document.getElementById("quickOrder")?.addEventListener("click",()=>go("new-order"));
  document.getElementById("quickStock")?.addEventListener("click",()=>go("stock"));
}

function renderStock(t){
  t.innerHTML=`${pageHead("Stock","O que existe fisicamente neste espaço")}<div class="two-col"><section class="card"><div class="section-head"><h2>Stock atual</h2><span class="spacer"></span><input class="search" id="stockSearch" placeholder="Pesquisar produto, tamanho ou código"></div><div id="stockList"></div></section><section class="card"><div class="section-head"><h2>Adicionar stock</h2></div><div class="grid"><label>Produto<input id="stProduct" placeholder="Ex.: ADIDAS SAMBA"></label><div class="grid grid-2"><label>Tamanho<input id="stSize" placeholder="38 / M"></label><label>Quantidade<input id="stQty" type="number" min="1" value="1"></label></div><label>Preço de compra / unidade (€)<input id="stCost" type="number" min="0" step="0.01" value="0"></label><label>Código de barras<input id="stBarcode" placeholder="Opcional"></label><div class="btn-row"><button class="btn btn-light" id="genBarcode">Gerar código</button><button class="btn" id="saveStock">Guardar</button></div><div id="stockMsg" class="notice" hidden></div></div></section></div>`;
  const search=document.getElementById("stockSearch");
  const draw=()=>{const q=search.value.trim().toLowerCase();const list=state.stock.filter(x=>Number(x.quantity)>0&&(!q||[x.product_name,x.size,x.barcode].join(" ").toLowerCase().includes(q)));document.getElementById("stockList").innerHTML=list.length?`<div class="stock-grid">${list.map(x=>`<div class="stock-row"><div class="stock-name"><strong>${esc(x.product_name)}</strong><small>${esc(x.size||"Sem tamanho")} ${x.barcode?`· <span class="barcode">${esc(x.barcode)}</span>`:""}</small></div><div class="stock-qty">${int(x.quantity)}</div><div class="stock-cost">${eur(x.unit_cost)}</div><div class="stock-actions"><button class="icon-btn" data-dec="${x.id}">−</button><button class="icon-btn" data-add="${x.id}">+</button><button class="btn btn-light" data-set="${x.id}">Qtd.</button></div></div>`).join("")}</div>`:`<div class="empty">Nenhum stock encontrado.</div>`;document.querySelectorAll("[data-dec]").forEach(b=>b.onclick=()=>changeStock(b.dataset.dec,-1));document.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>changeStock(b.dataset.add,1));document.querySelectorAll("[data-set]").forEach(b=>b.onclick=()=>setStock(b.dataset.set))};
  search.oninput=draw;draw();
  document.getElementById("genBarcode").onclick=()=>{const p=(state.workspace.slug||"").startsWith("verseline")?"VE":"ST";document.getElementById("stBarcode").value=`${p}-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2,5).toUpperCase()}`};
  document.getElementById("saveStock").onclick=async()=>{const msg=document.getElementById("stockMsg");hide(msg);const product_name=document.getElementById("stProduct").value.trim(),size=document.getElementById("stSize").value.trim()||null,quantity=Math.max(1,Number(document.getElementById("stQty").value||1)),unit_cost=Math.max(0,Number(document.getElementById("stCost").value||0)),barcode=document.getElementById("stBarcode").value.trim()||null;if(!product_name)return show(msg,"Escreve o nome do produto.","error");const {error}=await supabase.from("stock_items").insert({workspace_id:state.workspace.id,product_name,size,quantity,initial_quantity:quantity,unit_cost,origin:"Compra manual",barcode});if(error)return show(msg,error.code==="23505"?"Esse código de barras já existe.":error.message,"error");await loadWorkspaceData();renderStock(t)};
}
async function changeStock(id,delta){const item=state.stock.find(x=>x.id===id);if(!item)return;const next=Number(item.quantity)+delta;if(next<0)return;const {error}=await supabase.from("stock_items").update({quantity:next,updated_at:new Date().toISOString()}).eq("id",id).eq("quantity",item.quantity);if(error)return alert("O stock mudou entretanto. Atualiza e tenta novamente.");await loadWorkspaceData();renderShell()}
async function setStock(id){const item=state.stock.find(x=>x.id===id);if(!item)return;const v=prompt(`Quantidade atual: ${item.quantity}\nNova quantidade:`,String(item.quantity));if(v===null)return;const next=Math.floor(Number(v));if(!Number.isFinite(next)||next<0)return;const {error}=await supabase.from("stock_items").update({quantity:next,updated_at:new Date().toISOString()}).eq("id",id).eq("quantity",item.quantity);if(error)return alert("O stock mudou entretanto. Atualiza e tenta novamente.");await loadWorkspaceData();renderShell()}

function orderItemTemplate(i){
  const options=state.stock.filter(s=>Number(s.quantity)>0).map(s=>`<option value="${s.id}">${esc(s.product_name)} · ${esc(s.size||"-")} · ${s.quantity} un.</option>`).join("");
  return `<div class="order-item" data-item="${i}"><div class="order-item-title"><strong>Produto ${i+1}</strong></div><div class="grid grid-3"><label>Vai usar stock?<select data-f="useStock"><option value="yes">SIM — escolher do stock</option><option value="no">NÃO — comprado / sem stock</option></select></label><label>Quantidade<input data-f="qty" type="number" min="1" value="1"></label><label>Preço venda / unidade (€)<input data-f="sale" type="number" min="0" step="0.01" value="0"></label></div><div class="order-box" data-box="stock"><label>Escolhe o artigo<select data-f="stockId"><option value="">— escolher —</option>${options}</select></label></div><div class="order-box hidden" data-box="manual"><div class="grid grid-3"><label>Produto<input data-f="product"></label><label>Tamanho<input data-f="size"></label><label>Quanto te custou / unidade (€)<input data-f="purchase" type="number" min="0" step="0.01" value="0"></label></div></div></div>`;
}
function renderNewOrder(t){
  t.innerHTML=`${pageHead("Nova encomenda","Escolhe quantos produtos e só aparecem esses produtos")}<section class="card"><div class="grid grid-4"><label>Data<input id="oDate" type="date" value="${today()}"></label><label>Nº encomenda / referência<input id="oRef" placeholder="#1501"></label><label>Canal<select id="oChannel">${CHANNELS.map(x=>`<option>${x}</option>`).join("")}</select></label><label>Tipo de portes<select id="oShipping">${state.shipping.map(x=>`<option>${esc(x.shipping_type)}</option>`).join("")}</select></label></div><div class="grid grid-2" style="margin-top:14px"><label>Quantos produtos?<select id="oCount">${Array.from({length:10},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join("")}</select></label><label>Estado<select id="oStatus">${STATUSES.map(x=>`<option>${x}</option>`).join("")}</select></label></div><hr class="sep"><div id="orderItems" class="grid"></div><hr class="sep"><div class="btn-row"><button class="btn" id="saveOrder">Guardar encomenda</button><span class="muted" id="orderPreview"></span></div><div id="orderMsg" class="notice" hidden></div></section>`;
  const box=document.getElementById("orderItems"),count=document.getElementById("oCount");
  const draw=()=>{box.innerHTML=Array.from({length:Number(count.value)},(_,i)=>orderItemTemplate(i)).join("");box.querySelectorAll("[data-f='useStock']").forEach(sel=>sel.onchange=()=>{const row=sel.closest("[data-item]");row.querySelector("[data-box='stock']").classList.toggle("hidden",sel.value!=="yes");row.querySelector("[data-box='manual']").classList.toggle("hidden",sel.value==="yes");previewOrder()});box.querySelectorAll("input,select").forEach(x=>x.addEventListener("input",previewOrder));previewOrder()};count.onchange=draw;draw();document.getElementById("saveOrder").onclick=saveOrder;
}
function readItems(){return [...document.querySelectorAll("[data-item]")].map(row=>{const use=row.querySelector("[data-f='useStock']").value==="yes",qty=Math.max(1,Number(row.querySelector("[data-f='qty']").value||1)),sale=Math.max(0,Number(row.querySelector("[data-f='sale']").value||0));if(use){const stockId=row.querySelector("[data-f='stockId']").value,st=state.stock.find(s=>s.id===stockId);return{source:"stock",stockId,stock:st,product_name:st?.product_name||"",size:st?.size||"",qty,sale,purchase:0}}return{source:"purchased",stockId:null,product_name:row.querySelector("[data-f='product']").value.trim(),size:row.querySelector("[data-f='size']").value.trim(),qty,sale,purchase:Math.max(0,Number(row.querySelector("[data-f='purchase']").value||0))}})}
function aggregateStock(items){const m=new Map();for(const it of items.filter(x=>x.source==="stock"&&x.stockId))m.set(it.stockId,(m.get(it.stockId)||0)+it.qty);return m}
function previewOrder(){const el=document.getElementById("orderPreview");if(!el)return;el.textContent=`Total de venda: ${eur(readItems().reduce((a,x)=>a+x.qty*x.sale,0))}`}
async function getMetaPerOrder(date,channel){if(channel==="Vinted")return 0;const spend=state.meta.filter(x=>x.spend_date===date).reduce((a,x)=>a+Number(x.amount||0),0),n=state.orders.filter(x=>x.order_date===date&&x.channel!=="Vinted").length+1;return n?spend/n:0}
async function saveOrder(){
  const msg=document.getElementById("orderMsg");hide(msg);
  const order_date=document.getElementById("oDate").value,order_ref=document.getElementById("oRef").value.trim(),channel=document.getElementById("oChannel").value,shipping_type=document.getElementById("oShipping").value,status=document.getElementById("oStatus").value,items=readItems();
  if(!order_ref)return show(msg,"Mete o Nº encomenda / referência.","error");for(const [i,it] of items.entries())if(!it.product_name)return show(msg,`Falta escolher/escrever o Produto ${i+1}.`,"error");
  const usage=aggregateStock(items);for(const [id,qty] of usage){const st=state.stock.find(x=>x.id===id);if(!st||Number(st.quantity)<qty)return show(msg,`Stock insuficiente de ${st?.product_name||"um artigo"}.`,"error")}
  const rate=state.shipping.find(x=>x.shipping_type===shipping_type),shipping_out=status==="Cancelado antes envio"?0:Number(rate?.outbound_cost||0),shipping_return=status==="Devolvido"?Number(rate?.return_cost||0):0,totalSale=items.reduce((a,x)=>a+x.qty*x.sale,0),productCost=items.reduce((a,x)=>a+(x.source==="purchased"?x.qty*x.purchase:0),0),meta_cost=await getMetaPerOrder(order_date,channel),revenue=status==="Entregue"?totalSale:0,result=revenue-productCost-shipping_out-shipping_return-meta_cost;
  const {data:order,error}=await supabase.from("orders").insert({workspace_id:state.workspace.id,order_ref,order_date,channel,shipping_type,status,shipping_out,shipping_return,meta_cost,revenue,result}).select().single();if(error)return show(msg,error.code==="23505"?"Já existe uma encomenda com essa referência.":error.message,"error");
  const rows=items.map(it=>({workspace_id:state.workspace.id,order_id:order.id,product_name:it.product_name,size:it.size||null,quantity:it.qty,sale_price:it.sale,source:it.source,purchase_price:it.purchase,stock_item_id:it.stockId}));const {error:itemErr}=await supabase.from("order_items").insert(rows);if(itemErr){await supabase.from("orders").delete().eq("id",order.id);return show(msg,"Não foi possível guardar os produtos.","error")}
  if(status==="Em trânsito"||status==="Entregue")for(const [id,qty] of usage){const st=state.stock.find(x=>x.id===id);const {error:se}=await supabase.from("stock_items").update({quantity:Number(st.quantity)-qty,updated_at:new Date().toISOString()}).eq("id",id).eq("quantity",st.quantity);if(se)return show(msg,"Encomenda criada, mas o stock mudou entretanto. Confere o stock antes de continuar.","error")}
  if(status==="Devolvido")for(const it of items.filter(x=>x.source==="purchased"))await supabase.from("stock_items").insert({workspace_id:state.workspace.id,product_name:it.product_name,size:it.size||null,quantity:it.qty,initial_quantity:it.qty,unit_cost:it.purchase,origin:"Devolução",source_order_id:order.id});
  await loadWorkspaceData();await recalcDate(order_date);await loadWorkspaceData();go("orders");
}
async function recalcDate(date){const orders=state.orders.filter(o=>o.order_date===date),spend=state.meta.filter(x=>x.spend_date===date).reduce((a,x)=>a+Number(x.amount||0),0),eligible=orders.filter(x=>x.channel!=="Vinted"),per=eligible.length?spend/eligible.length:0;for(const o of orders){const items=state.items.filter(i=>i.order_id===o.id),cost=items.reduce((a,i)=>a+(i.source==="purchased"?Number(i.quantity)*Number(i.purchase_price):0),0),sale=items.reduce((a,i)=>a+Number(i.quantity)*Number(i.sale_price),0),meta=o.channel==="Vinted"?0:per,revenue=o.status==="Entregue"?sale:0,result=revenue-cost-Number(o.shipping_out||0)-Number(o.shipping_return||0)-meta;await supabase.from("orders").update({meta_cost:meta,revenue,result,updated_at:new Date().toISOString()}).eq("id",o.id)}}
function allowedNext(s){if(s==="Cancelado antes envio")return["Cancelado antes envio","Em trânsito","Entregue"];if(s==="Em trânsito")return["Em trânsito","Entregue","Devolvido"];if(s==="Entregue")return["Entregue","Devolvido"];return["Devolvido"]}
function renderOrders(t){
  t.innerHTML=`${pageHead("Encomendas","Atualiza o estado quando a entrega mudar",`<button class="btn" id="newOrderBtn">+ Nova encomenda</button>`)}<div class="section-head"><input class="search" id="orderSearch" placeholder="Pesquisar encomenda ou produto"></div><div id="orderList" class="grid"></div>`;document.getElementById("newOrderBtn").onclick=()=>go("new-order");
  const search=document.getElementById("orderSearch"),draw=()=>{const q=search.value.toLowerCase().trim(),list=state.orders.filter(o=>!q||[o.order_ref,o.channel,o.status,...state.items.filter(i=>i.order_id===o.id).map(i=>i.product_name)].join(" ").toLowerCase().includes(q));document.getElementById("orderList").innerHTML=list.length?list.map(o=>{const items=state.items.filter(i=>i.order_id===o.id);return`<article class="order-card"><div class="order-top"><strong>${esc(o.order_ref)}</strong><span class="badge">${esc(o.channel)}</span><span class="muted">${esc(o.order_date)}</span><span class="spacer"></span><strong class="${Number(o.result)>=0?"good":"bad"}">${eur(o.result)}</strong></div><div class="order-products">${items.map(i=>`<div>${i.quantity}× <strong>${esc(i.product_name)}</strong> · ${esc(i.size||"-")} · ${eur(i.sale_price)}</div>`).join("")}</div><div class="btn-row"><label style="min-width:220px">Estado<select data-order-status="${o.id}" ${o.status==="Devolvido"?"disabled":""}>${allowedNext(o.status).map(s=>`<option ${s===o.status?"selected":""}>${s}</option>`).join("")}</select></label><span class="muted">Receita ${eur(o.revenue)} · Meta ${eur(o.meta_cost)} · Portes ${eur(Number(o.shipping_out)+Number(o.shipping_return))}</span></div></article>`}).join(""):`<div class="card empty">Ainda não tens encomendas.</div>`;document.querySelectorAll("[data-order-status]").forEach(s=>s.onchange=()=>changeOrderStatus(s.dataset.orderStatus,s.value))};search.oninput=draw;draw();
}
async function changeOrderStatus(id,next){
  const o=state.orders.find(x=>x.id===id);if(!o||o.status===next)return;if(!allowedNext(o.status).includes(next))return alert("Essa mudança não é permitida.");
  const items=state.items.filter(i=>i.order_id===id),old=o.status;
  if(old==="Cancelado antes envio"&&(next==="Em trânsito"||next==="Entregue")){
    const usage=new Map();for(const it of items.filter(i=>i.source==="stock"&&i.stock_item_id))usage.set(it.stock_item_id,(usage.get(it.stock_item_id)||0)+Number(it.quantity));
    for(const [sid,q] of usage){const st=state.stock.find(s=>s.id===sid);if(!st||Number(st.quantity)<q)return alert("Stock insuficiente.")}
    for(const [sid,q] of usage){const st=state.stock.find(s=>s.id===sid);await supabase.from("stock_items").update({quantity:Number(st.quantity)-q,updated_at:new Date().toISOString()}).eq("id",sid).eq("quantity",st.quantity)}
  }
  if((old==="Em trânsito"||old==="Entregue")&&next==="Devolvido"){
    const usage=new Map();for(const it of items.filter(i=>i.source==="stock"&&i.stock_item_id))usage.set(it.stock_item_id,(usage.get(it.stock_item_id)||0)+Number(it.quantity));
    for(const [sid,q] of usage){const st=state.stock.find(s=>s.id===sid);if(st)await supabase.from("stock_items").update({quantity:Number(st.quantity)+q,updated_at:new Date().toISOString()}).eq("id",sid).eq("quantity",st.quantity)}
    for(const it of items.filter(i=>i.source==="purchased"))await supabase.from("stock_items").insert({workspace_id:state.workspace.id,product_name:it.product_name,size:it.size,quantity:it.quantity,initial_quantity:it.quantity,unit_cost:it.purchase_price,origin:"Devolução",source_order_id:o.id});
  }
  const rate=state.shipping.find(x=>x.shipping_type===o.shipping_type),shipping_out=next==="Cancelado antes envio"?0:Number(rate?.outbound_cost||0),shipping_return=next==="Devolvido"?Number(rate?.return_cost||0):0;
  await supabase.from("orders").update({status:next,shipping_out,shipping_return,updated_at:new Date().toISOString()}).eq("id",id);await loadWorkspaceData();await recalcDate(o.order_date);await loadWorkspaceData();renderShell();
}
function renderMeta(t){
  t.innerHTML=`${pageHead("Meta Ads","Só precisas registar o gasto do dia")}<div class="two-col"><section class="card"><div class="section-head"><h2>Histórico</h2></div>${state.meta.length?`<div class="table-wrap"><table><thead><tr><th>Data</th><th>Gasto</th><th>Notas</th></tr></thead><tbody>${state.meta.map(x=>`<tr><td>${esc(x.spend_date)}</td><td>${eur(x.amount)}</td><td>${esc(x.notes||"")}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">Sem gastos registados.</div>`}</section><section class="card"><div class="section-head"><h2>Novo gasto</h2></div><div class="grid"><label>Data<input id="mDate" type="date" value="${today()}"></label><label>Valor (€)<input id="mAmount" type="number" min="0" step="0.01"></label><label>Notas<textarea id="mNotes"></textarea></label><button class="btn" id="saveMeta">Guardar</button><div id="mMsg" class="notice" hidden></div></div></section></div>`;
  document.getElementById("saveMeta").onclick=async()=>{const spend_date=document.getElementById("mDate").value,amount=Number(document.getElementById("mAmount").value||0),notes=document.getElementById("mNotes").value.trim()||null,msg=document.getElementById("mMsg");const {error}=await supabase.from("meta_ads").insert({workspace_id:state.workspace.id,spend_date,amount,notes});if(error)return show(msg,error.message,"error");await loadWorkspaceData();await recalcDate(spend_date);await loadWorkspaceData();renderMeta(t)};
}
function renderShipping(t){
  t.innerHTML=`${pageHead("Portes","Define os valores uma vez")}<section class="card"><div class="table-wrap"><table><thead><tr><th>Tipo</th><th>Ida (€)</th><th>Retorno (€)</th><th></th></tr></thead><tbody>${state.shipping.map(x=>`<tr><td><strong>${esc(x.shipping_type)}</strong></td><td><input id="po-${x.id}" type="number" min="0" step="0.01" value="${Number(x.outbound_cost)}"></td><td><input id="pr-${x.id}" type="number" min="0" step="0.01" value="${Number(x.return_cost)}"></td><td><button class="btn btn-light" data-rate="${x.id}">Guardar</button></td></tr>`).join("")}</tbody></table></div></section>`;
  document.querySelectorAll("[data-rate]").forEach(b=>b.onclick=async()=>{const id=b.dataset.rate;await supabase.from("shipping_rates").update({outbound_cost:Number(document.getElementById(`po-${id}`).value||0),return_cost:Number(document.getElementById(`pr-${id}`).value||0)}).eq("id",id);await loadWorkspaceData();b.textContent="Guardado ✓";setTimeout(()=>b.textContent="Guardar",800)});
}
function renderExpenses(t){
  t.innerHTML=`${pageHead("Despesas","Custos fora das encomendas")}<div class="two-col"><section class="card"><div class="section-head"><h2>Histórico</h2></div>${state.expenses.length?`<div class="table-wrap"><table><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>${state.expenses.map(x=>`<tr><td>${esc(x.expense_date)}</td><td>${esc(x.expense_type)}</td><td>${esc(x.description||"")}</td><td>${eur(x.amount)}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">Sem despesas.</div>`}</section><section class="card"><div class="section-head"><h2>Nova despesa</h2></div><div class="grid"><label>Data<input id="eDate" type="date" value="${today()}"></label><label>Tipo<select id="eType">${EXPENSE_TYPES.map(x=>`<option>${x}</option>`).join("")}</select></label><label>Descrição<input id="eDesc"></label><label>Valor (€)<input id="eAmount" type="number" min="0" step="0.01"></label><button class="btn" id="saveExpense">Guardar</button></div></section></div>`;
  document.getElementById("saveExpense").onclick=async()=>{await supabase.from("expenses").insert({workspace_id:state.workspace.id,expense_date:document.getElementById("eDate").value,expense_type:document.getElementById("eType").value,description:document.getElementById("eDesc").value.trim()||null,amount:Number(document.getElementById("eAmount").value||0)});await loadWorkspaceData();renderExpenses(t)};
}

async function loadAdminUsers(){const {data}=await supabase.from("user_access").select("*").eq("is_admin",false).order("created_at");state.adminUsers=data||[]}
async function invokeAdmin(body){const {data,error}=await supabase.functions.invoke("manage-users",{body});if(error)throw new Error(error.message||"Erro no servidor");if(data?.error)throw new Error(data.error);return data}
function moduleChecks(selected=[]){return MODULES.map(([id,l])=>`<label class="check-row"><input type="checkbox" value="${id}" ${selected.includes(id)?"checked":""}> ${l}</label>`).join("")}
function setChecks(id,mods){document.querySelectorAll(`#${id} input[type=checkbox]`).forEach(c=>c.checked=mods.includes(c.value))}
function getChecks(id){return[...document.querySelectorAll(`#${id} input[type=checkbox]:checked`)].map(c=>c.value)}

async function workspaceForNewUser(accountName,handle){
  await loadAdminWorkspaces();
  await loadAdminUsers();
  const base=safeSlug(accountName)||safeSlug(handle)||"utilizador";
  const occupied=new Set(state.adminUsers.map(u=>u.workspace_id).filter(Boolean));
  const reusable=state.workspaces.find(w=>w.slug===base&&!occupied.has(w.id));
  if(reusable)return reusable;
  let slug=base;
  if(state.workspaces.some(w=>w.slug===slug))slug=`${base}-${safeSlug(handle)||Date.now().toString().slice(-5)}`;
  const created=await invokeAdmin({action:"create_workspace",name:accountName,slug});
  await loadAdminWorkspaces();
  return created.workspace;
}

async function renderAdminUsers(t){
  await loadAdminUsers();await loadAdminWorkspaces();await loadDirectory();
  const full=state.adminUsers.filter(x=>(x.modules||[]).length>=5).length;
  const stockOnly=state.adminUsers.filter(x=>(x.modules||[]).length===1&&x.modules[0]==="stock").length;
  t.innerHTML=`${pageHead("Utilizadores","Cria Lucky Urban, Verseline, o teu irmão ou qualquer outra conta. Cada utilizador fica separado.",`<button class="btn" id="createUserBtn">+ Criar utilizador</button>`)}
    <div class="stats">
      <div class="stat"><div class="stat-label">Utilizadores</div><div class="stat-value">${state.adminUsers.length}</div></div>
      <div class="stat"><div class="stat-label">Gestão completa</div><div class="stat-value">${full}</div></div>
      <div class="stat"><div class="stat-label">Só Stock</div><div class="stat-value">${stockOnly}</div></div>
      <div class="stat"><div class="stat-label">Admin</div><div class="stat-value">1</div><div class="stat-note">não entra nos dados das lojas</div></div>
    </div>
    <section class="card">
      <div class="section-head"><h2>Contas criadas</h2><span class="spacer"></span><span class="muted">A password é mostrada quando crias ou redefinis.</span></div>
      <div class="user-list">${state.adminUsers.length?state.adminUsers.map(userCard).join(""):`<div class="empty">Ainda não criaste utilizadores.</div>`}</div>
    </section>`;
  document.getElementById("createUserBtn").onclick=openCreateUserModal;
  document.querySelectorAll("[data-edit-user]").forEach(b=>b.onclick=()=>openEditUserModal(b.dataset.editUser));
  document.querySelectorAll("[data-delete-user]").forEach(b=>b.onclick=()=>deleteManagedUser(b.dataset.deleteUser));
  document.querySelectorAll("[data-logo-user]").forEach(inp=>inp.onchange=()=>uploadUserLogo(inp.dataset.logoUser,inp.files?.[0]));
}

function userCard(u){
  const d=state.directory.find(x=>x.user_id===u.user_id);
  const ws=state.workspaces.find(x=>x.id===u.workspace_id);
  return `<div class="user-card">
    ${logo(d?.logo_url||ws?.logo_url,u.display_name,"user-avatar")}
    <div class="user-meta">
      <strong>${esc(u.display_name)}</strong>
      <small>@${esc(u.login_handle)}</small>
      <div class="module-tags">${(u.modules||[]).map(m=>`<span class="module-tag">${esc(LABEL[m]||m)}</span>`).join("")}<span class="module-tag">Password protegida</span></div>
    </div>
    <div class="btn-row">
      <label class="btn btn-soft" style="display:inline-flex;align-items:center">Logo<input class="logo-upload" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-logo-user="${u.user_id}"></label>
      <button class="btn btn-light" data-edit-user="${u.user_id}">Acesso / password</button>
      <button class="btn btn-danger" data-delete-user="${u.user_id}">Apagar</button>
    </div>
  </div>`;
}

function openCreateUserModal(){
  document.body.insertAdjacentHTML("beforeend",`<div class="modal-backdrop" id="modal"><section class="modal">
    <div class="modal-head"><h2>Criar utilizador</h2><span class="spacer"></span><button class="icon-btn" id="closeModal">×</button></div>
    <div class="grid">
      <label>Nome que aparece no site<input id="cuName" placeholder="Ex.: Lucky Urban"></label>
      <label>Utilizador<input id="cuHandle" placeholder="Ex.: luckyurban"></label>
      <label>Palavra-passe<input id="cuPass" type="text" autocomplete="off" placeholder="mínimo 6 caracteres"></label>
      <div><strong style="font-size:13px">O que pode ver?</strong><div id="cuModules">${moduleChecks(["stock"])}</div></div>
      <div class="btn-row"><button class="btn btn-soft" id="presetStock">Só Stock</button><button class="btn btn-soft" id="presetFull">Gestão completa</button></div>
      <div id="cuMsg" class="notice" hidden></div>
      <button class="btn" id="saveUser">Criar utilizador</button>
    </div>
  </section></div>`);
  const close=()=>document.getElementById("modal")?.remove();
  document.getElementById("closeModal").onclick=close;
  document.getElementById("presetStock").onclick=()=>setChecks("cuModules",["stock"]);
  document.getElementById("presetFull").onclick=()=>setChecks("cuModules",MODULES.map(x=>x[0]));
  document.getElementById("saveUser").onclick=async()=>{
    const msg=document.getElementById("cuMsg");hide(msg);
    const name=document.getElementById("cuName").value.trim();
    const handle=safeSlug(document.getElementById("cuHandle").value.trim());
    const password=document.getElementById("cuPass").value;
    const modules=getChecks("cuModules");
    if(!name||handle.length<3||password.length<6)return show(msg,"Preenche nome, utilizador e password com pelo menos 6 caracteres.","error");
    try{
      const ws=await workspaceForNewUser(name,handle);
      await invokeAdmin({action:"create_user",display_name:name,login_handle:handle,workspace_id:ws.id,password,modules});
      await loadAdminUsers();await loadDirectory();
      const modal=document.querySelector("#modal .modal");
      modal.innerHTML=`<div class="modal-head"><h2>Utilizador criado ✓</h2></div><div class="grid">
        <div class="notice success">Guarda estes dados agora. Depois a password não pode ser lida, mas podes redefini-la.</div>
        <label>Utilizador<input value="${esc(handle)}" readonly></label>
        <label>Palavra-passe<input value="${esc(password)}" readonly></label>
        <button class="btn" id="finishCreate">Fechar</button>
      </div>`;
      document.getElementById("finishCreate").onclick=()=>{close();renderAdminUsers(document.getElementById("page"))};
    }catch(e){show(msg,e.message,"error")}
  };
}

function openEditUserModal(id){
  const u=state.adminUsers.find(x=>x.user_id===id);if(!u)return;
  document.body.insertAdjacentHTML("beforeend",`<div class="modal-backdrop" id="modal"><section class="modal">
    <div class="modal-head"><h2>${esc(u.display_name)}</h2><span class="spacer"></span><button class="icon-btn" id="closeModal">×</button></div>
    <div class="grid">
      <label>Nome<input id="euName" value="${esc(u.display_name)}"></label>
      <label>Nova palavra-passe<input id="euPass" type="text" autocomplete="off" placeholder="Deixa vazio para manter"></label>
      <div class="notice">Por segurança a password atual não pode ser recuperada. Se precisares, defines uma nova aqui.</div>
      <div><strong style="font-size:13px">Permissões</strong><div id="euModules">${moduleChecks(u.modules||[])}</div></div>
      <label class="check-row"><input id="euActive" type="checkbox" ${u.is_active?"checked":""}> Utilizador ativo</label>
      <div id="euMsg" class="notice" hidden></div>
      <button class="btn" id="saveEditUser">Guardar alterações</button>
    </div>
  </section></div>`);
  const close=()=>document.getElementById("modal")?.remove();
  document.getElementById("closeModal").onclick=close;
  document.getElementById("saveEditUser").onclick=async()=>{
    const msg=document.getElementById("euMsg");hide(msg);
    const password=document.getElementById("euPass").value;
    try{
      await invokeAdmin({action:"update_user",user_id:id,display_name:document.getElementById("euName").value.trim(),password,modules:getChecks("euModules"),is_active:document.getElementById("euActive").checked});
      if(password){
        const modal=document.querySelector("#modal .modal");
        modal.innerHTML=`<div class="modal-head"><h2>Password alterada ✓</h2></div><div class="grid">
          <div class="notice success">Guarda esta nova password.</div>
          <label>Nova palavra-passe<input value="${esc(password)}" readonly></label>
          <button class="btn" id="finishEdit">Fechar</button>
        </div>`;
        document.getElementById("finishEdit").onclick=()=>{close();renderAdminUsers(document.getElementById("page"))};
      }else{
        close();renderAdminUsers(document.getElementById("page"));
      }
    }catch(e){show(msg,e.message,"error")}
  };
}

async function deleteManagedUser(id){const u=state.adminUsers.find(x=>x.user_id===id);if(!u||!confirm(`Apagar o utilizador ${u.display_name}?`))return;try{await invokeAdmin({action:"delete_user",user_id:id});await loadDirectory();renderAdminUsers(document.getElementById("page"))}catch(e){alert(e.message)}}

async function renderAdminSpaces(t){
  await loadAdminWorkspaces();
  t.innerHTML=`${pageHead("Lojas / Espaços","Cada espaço tem dados, stock e logo próprios",`<button class="btn" id="newSpace">+ Criar espaço</button>`)}<div class="workspace-list">${state.workspaces.map(w=>`<div class="workspace-card-admin"><div class="workspace-admin-head">${logo(w.logo_url,w.name,"workspace-admin-logo")}<div><strong>${esc(w.name)}</strong><div class="muted">${esc(w.slug)}</div></div></div><div class="btn-row"><button class="btn btn-light" data-open-space="${w.id}">Abrir</button><label class="btn btn-soft" style="display:inline-flex;align-items:center">Alterar logo<input class="logo-upload" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-logo-space="${w.id}"></label></div></div>`).join("")}</div>`;
  document.getElementById("newSpace").onclick=openCreateSpaceModal;
  document.querySelectorAll("[data-open-space]").forEach(b=>b.onclick=async()=>{state.workspace=state.workspaces.find(w=>w.id===b.dataset.openSpace);state.page="dashboard";await loadWorkspaceData();renderShell()});
  document.querySelectorAll("[data-logo-space]").forEach(inp=>inp.onchange=()=>uploadLogo(inp.dataset.logoSpace,inp.files?.[0]));
}
function openCreateSpaceModal(){
  document.body.insertAdjacentHTML("beforeend",`<div class="modal-backdrop" id="modal"><section class="modal"><div class="modal-head"><h2>Criar loja / espaço</h2><span class="spacer"></span><button class="icon-btn" id="closeModal">×</button></div><div class="grid"><label>Nome<input id="csName" placeholder="Ex.: Loja do João"></label><label>Identificador<input id="csSlug" placeholder="loja-do-joao"></label><div id="csMsg" class="notice" hidden></div><button class="btn" id="saveSpace">Criar espaço</button></div></section></div>`);
  const close=()=>document.getElementById("modal")?.remove();document.getElementById("closeModal").onclick=close;
  document.getElementById("csName").oninput=e=>{if(!document.getElementById("csSlug").dataset.edited)document.getElementById("csSlug").value=safeSlug(e.target.value)};document.getElementById("csSlug").oninput=e=>e.target.dataset.edited="1";
  document.getElementById("saveSpace").onclick=async()=>{const msg=document.getElementById("csMsg");hide(msg);try{await invokeAdmin({action:"create_workspace",name:document.getElementById("csName").value.trim(),slug:document.getElementById("csSlug").value.trim()});close();await loadAdminWorkspaces();renderAdminSpaces(document.getElementById("page"))}catch(e){show(msg,e.message,"error")}};
}
async function uploadUserLogo(userId,file){
  const u=state.adminUsers.find(x=>x.user_id===userId);
  if(!u||!u.workspace_id)return;
  await uploadLogo(u.workspace_id,file,true);
}

async function uploadLogo(workspaceId,file,backToUsers=false){
  if(!file)return;if(file.size>5*1024*1024)return alert("A logo tem de ter menos de 5 MB.");
  const ext=(file.name.split(".").pop()||"png").toLowerCase(),path=`${workspaceId}/${Date.now()}.${ext}`;
  const {error}=await supabase.storage.from("workspace-logos").upload(path,file,{upsert:true,contentType:file.type});if(error)return alert("Erro ao enviar logo: "+error.message);
  const {data}=supabase.storage.from("workspace-logos").getPublicUrl(path),url=data.publicUrl;
  const {error:updateErr}=await supabase.from("workspaces").update({logo_url:url}).eq("id",workspaceId);if(updateErr)return alert(updateErr.message);
  await supabase.from("login_directory").update({logo_url:url}).eq("workspace_id",workspaceId);
  await loadAdminWorkspaces();await loadDirectory();if(backToUsers)return renderAdminUsers(document.getElementById("page"));if(state.workspace?.id===workspaceId)state.workspace=state.workspaces.find(w=>w.id===workspaceId);renderAdminSpaces(document.getElementById("page"));
}

supabase.auth.onAuthStateChange((_e,session)=>state.session=session);
init();
