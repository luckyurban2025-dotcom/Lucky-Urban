import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const cfg=window.APP_CONFIG||{};
const supabase=createClient(cfg.supabaseUrl,cfg.supabaseKey);
const app=document.getElementById("app");
const MODULES=[["dashboard","Início"],["new-order","Nova encomenda"],["orders","Encomendas"],["stock","Stock"],["meta","Meta Ads"],["shipping","Portes"],["expenses","Despesas"]];
const LABEL=Object.fromEntries(MODULES);
const CHANNELS=["Shopify","Instagram","Facebook","WhatsApp","Vinted"];
const STATUSES=["Em trânsito","Entregue","Devolvido","Cancelado antes envio"];
const EXPENSE_TYPES=["Shopify","Apps","Embalagens","Domínio","Material","Outro"];
const state={session:null,access:null,directory:[],workspaces:[],workspace:null,page:"dashboard",stock:[],orders:[],items:[],shipping:[],meta:[],expenses:[],catalog:[],receipts:[],adminUsers:[],dashboardMonth:new Date().toISOString().slice(0,7),ordersMonth:new Date().toISOString().slice(0,7),scanner:null};
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
  const [s,o,i,p,m,e,c,r]=await Promise.all([
    supabase.from("stock_items").select("*").eq("workspace_id",id).order("created_at",{ascending:false}),
    supabase.from("orders").select("*").eq("workspace_id",id).order("order_date",{ascending:false}).order("created_at",{ascending:false}),
    supabase.from("order_items").select("*").eq("workspace_id",id).order("created_at"),
    supabase.from("shipping_rates").select("*").eq("workspace_id",id).order("created_at"),
    supabase.from("meta_ads").select("*").eq("workspace_id",id).order("spend_date",{ascending:false}),
    supabase.from("expenses").select("*").eq("workspace_id",id).order("expense_date",{ascending:false}),
    supabase.from("product_catalog").select("*").eq("workspace_id",id).order("created_at",{ascending:false}),
    supabase.from("stock_receipts").select("*").eq("workspace_id",id).order("received_date",{ascending:false}).order("created_at",{ascending:false})
  ]);
  state.stock=s.data||[];state.orders=o.data||[];state.items=i.data||[];state.shipping=p.data||[];state.meta=m.data||[];state.expenses=e.data||[];state.catalog=c.data||[];state.receipts=r.data||[];
}
function navItems(){
  const mods=availableModules();
  const base=MODULES.filter(([id])=>mods.includes(id));
  const stockIndex=base.findIndex(([id])=>id==="stock");
  const catalogItem=["catalog","Produtos & Códigos"];
  if(stockIndex>=0)base.splice(stockIndex+1,0,catalogItem);
  else base.push(catalogItem);
  return base;
}
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
  if(state.page==="catalog")return renderCatalog(t);
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
  const receiptPurchases=state.receipts.filter(x=>String(x.received_date).startsWith(month)).reduce((a,x)=>a+Number(x.quantity||0)*Number(x.unit_cost||0),0);
  const legacyStockPurchases=state.stock.filter(x=>x.origin==="Compra manual"&&!x.catalog_id&&String(x.created_at).startsWith(month)).reduce((a,x)=>a+Number(x.initial_quantity||0)*Number(x.unit_cost||0),0);
  const stockPurchases=receiptPurchases+legacyStockPurchases;
  const real=orderResult-expenses-stockPurchases;
  const units=state.stock.reduce((a,x)=>a+Math.max(0,Number(x.quantity||0)),0);
  const delivered=orders.filter(x=>x.status==="Entregue").length;
  const returned=orders.filter(x=>x.status==="Devolvido").length;
  const monthOrders=[...orders].sort((a,b)=>String(b.order_date).localeCompare(String(a.order_date))).slice(0,5);
  const monthOrderIds=new Set(orders.map(o=>o.id));
  const supplierItems=state.items.filter(i=>monthOrderIds.has(i.order_id)&&i.source==="purchased");
  const supplierPaid=supplierItems.filter(i=>i.supplier_paid).reduce((a,i)=>a+Number(i.quantity||0)*Number(i.purchase_price||0),0);
  const supplierUnpaid=supplierItems.filter(i=>!i.supplier_paid).reduce((a,i)=>a+Number(i.quantity||0)*Number(i.purchase_price||0),0);
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

    <div class="dashboard-work-stats">
      <div class="soft-card"><div class="stat-label">Encomendas</div><div class="stat-value">${orders.length}</div></div>
      <div class="soft-card"><div class="stat-label">Entregues</div><div class="stat-value good">${delivered}</div></div>
      <div class="soft-card"><div class="stat-label">Devolvidas</div><div class="stat-value bad">${returned}</div></div>
      <div class="soft-card supplier-paid-card"><div class="stat-label">Pago a fornecedores</div><div class="stat-value good">${eur(supplierPaid)}</div><div class="stat-note">encomendas deste mês</div></div>
      <div class="soft-card supplier-unpaid-card"><div class="stat-label">Por pagar a fornecedores</div><div class="stat-value ${supplierUnpaid>0?"bad":""}">${eur(supplierUnpaid)}</div><div class="stat-note">encomendas deste mês</div></div>
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


function catalogFullName(p){
  return [p.brand,p.product_name,p.variant].filter(Boolean).join(" · ");
}
function generateCatalogBarcode(){
  const prefix=(state.workspace?.slug||"CAT").replace(/[^a-z0-9]/gi,"").slice(0,5).toUpperCase()||"CAT";
  return `${prefix}-${Date.now().toString().slice(-9)}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
}
function renderBarcodeSvgs(){
  if(!window.JsBarcode)return;
  document.querySelectorAll("svg[data-barcode]").forEach(svg=>{
    try{
      window.JsBarcode(svg,svg.dataset.barcode,{
        format:"CODE128",displayValue:true,height:48,margin:2,fontSize:11,width:1.55
      });
    }catch(e){console.warn("barcode",e)}
  });
}
function catalogImage(p,cls="catalog-photo"){
  return p.image_url?`<img class="${cls}" src="${esc(p.image_url)}" alt="${esc(catalogFullName(p))}">`:`<div class="${cls} catalog-photo-empty">${esc(initials(p.brand||p.product_name))}</div>`;
}
function defaultShoeSizes(){return Array.from({length:11},(_,i)=>String(35+i))}
function parseSizes(value){
  return [...new Set(String(value||"").split(/[,;\s]+/).map(x=>x.trim()).filter(Boolean))];
}

function renderCatalog(t){
  t.innerHTML=`
    ${pageHead("Produtos & Códigos","Cada modelo, foto e código fica guardado só nesta área.",`
      <button class="btn btn-light" id="printCodes">Imprimir códigos</button>
      <button class="btn" id="scanEntry">📷 Scanear entrada</button>`)}
    <div class="two-col catalog-layout">
      <section class="card">
        <div class="section-head">
          <h2>Os teus códigos</h2><span class="spacer"></span>
          <input class="search" id="catalogSearch" placeholder="Pesquisar marca, modelo ou código">
        </div>
        <div id="catalogList"></div>
      </section>
      <section class="card catalog-create-panel">
        <div class="section-head"><h2>+ Criar produto/código</h2></div>
        <div class="grid">
          <label>Marca<input id="catBrand" placeholder="Ex.: NIKE"></label>
          <label>Modelo / produto<input id="catProduct" placeholder="Ex.: AIR FORCE 1"></label>
          <label>Cor / variante<input id="catVariant" placeholder="Ex.: BRANCAS"></label>
          <label>Foto do produto<input id="catImage" type="file" accept="image/png,image/jpeg,image/webp"></label>
          <label>Tamanhos
            <input id="catSizes" value="${defaultShoeSizes().join(", ")}" placeholder="35, 36, 37... ou S, M, L">
          </label>
          <div class="btn-row">
            <button class="btn btn-soft" id="shoeSizes">Calçado 35–45</button>
            <button class="btn btn-soft" id="clothingSizes">Roupa XS–XXL</button>
          </div>
          <label>Custo padrão / unidade (€) <span class="muted">(opcional)</span>
            <input id="catCost" type="number" min="0" step="0.01" value="0">
          </label>
          <label>Código de barras
            <input id="catBarcode" value="${esc(generateCatalogBarcode())}">
          </label>
          <button class="btn" id="saveCatalog">Guardar e gerar código</button>
          <div id="catalogMsg" class="notice" hidden></div>
        </div>
      </section>
    </div>`;

  const search=document.getElementById("catalogSearch");
  const draw=()=>{
    const q=search.value.trim().toLowerCase();
    const list=state.catalog.filter(p=>!q||[p.brand,p.product_name,p.variant,p.barcode].join(" ").toLowerCase().includes(q));
    document.getElementById("catalogList").innerHTML=list.length?`
      <div class="catalog-grid">${list.map(p=>`
        <article class="catalog-card" data-catalog-card="${p.id}">
          <div class="catalog-card-top">
            ${catalogImage(p)}
            <div class="catalog-info">
              <strong>${esc(p.product_name)}</strong>
              <span>${esc([p.brand,p.variant].filter(Boolean).join(" · "))}</span>
              <small>Tamanhos: ${esc((p.sizes||[]).join(", "))}</small>
            </div>
          </div>
          <div class="barcode-box"><svg data-barcode="${esc(p.barcode)}"></svg></div>
          <div class="btn-row">
            <button class="btn btn-light" data-catalog-entry="${p.id}">Dar entrada</button>
            <button class="btn btn-danger" data-catalog-delete="${p.id}">Apagar</button>
          </div>
        </article>`).join("")}</div>`
      :`<div class="empty">Ainda não criaste códigos neste utilizador.</div>`;
    renderBarcodeSvgs();
    document.querySelectorAll("[data-catalog-entry]").forEach(b=>b.onclick=()=>showCatalogEntry(b.dataset.catalogEntry));
    document.querySelectorAll("[data-catalog-delete]").forEach(b=>b.onclick=()=>deleteCatalogProduct(b.dataset.catalogDelete));
  };
  search.oninput=draw;draw();

  document.getElementById("shoeSizes").onclick=()=>document.getElementById("catSizes").value=defaultShoeSizes().join(", ");
  document.getElementById("clothingSizes").onclick=()=>document.getElementById("catSizes").value="XS, S, M, L, XL, XXL";
  document.getElementById("catBarcode").ondblclick=e=>e.target.value=generateCatalogBarcode();
  document.getElementById("saveCatalog").onclick=saveCatalogProduct;
  document.getElementById("scanEntry").onclick=openScannerModal;
  document.getElementById("printCodes").onclick=()=>window.print();
}

async function saveCatalogProduct(){
  const msg=document.getElementById("catalogMsg");hide(msg);
  const brand=document.getElementById("catBrand").value.trim();
  const product_name=document.getElementById("catProduct").value.trim();
  const variant=document.getElementById("catVariant").value.trim()||null;
  const sizes=parseSizes(document.getElementById("catSizes").value);
  const default_unit_cost=Math.max(0,Number(document.getElementById("catCost").value||0));
  const barcode=document.getElementById("catBarcode").value.trim()||generateCatalogBarcode();
  const file=document.getElementById("catImage").files?.[0];

  if(!product_name)return show(msg,"Escreve o modelo/produto.","error");
  if(!sizes.length)return show(msg,"Mete pelo menos um tamanho.","error");
  if(file&&file.size>5*1024*1024)return show(msg,"A foto tem de ter menos de 5 MB.","error");

  const {data:created,error}=await supabase.from("product_catalog").insert({
    workspace_id:state.workspace.id,brand:brand||null,product_name,variant,barcode,sizes,default_unit_cost
  }).select().single();

  if(error)return show(msg,error.code==="23505"?"Esse código já existe nesta conta.":error.message,"error");

  if(file){
    const ext=(file.name.split(".").pop()||"jpg").toLowerCase();
    const path=`${state.workspace.id}/${created.id}.${ext}`;
    const {error:upErr}=await supabase.storage.from("product-images").upload(path,file,{upsert:true,contentType:file.type});
    if(!upErr){
      const {data:urlData}=supabase.storage.from("product-images").getPublicUrl(path);
      await supabase.from("product_catalog").update({image_url:urlData.publicUrl,updated_at:new Date().toISOString()}).eq("id",created.id);
    }
  }

  await loadWorkspaceData();
  renderCatalog(document.getElementById("page"));
}

async function deleteCatalogProduct(id){
  const p=state.catalog.find(x=>x.id===id);
  if(!p||!confirm(`Apagar o código de ${catalogFullName(p)}? O stock existente não é apagado.`))return;
  const {error}=await supabase.from("product_catalog").delete().eq("id",id);
  if(error)return alert(error.message);
  await loadWorkspaceData();
  renderCatalog(document.getElementById("page"));
}

function openScannerModal(){
  document.body.insertAdjacentHTML("beforeend",`<div class="modal-backdrop" id="scannerModal">
    <section class="modal scanner-modal">
      <div class="modal-head"><h2>Scanear entrada de stock</h2><span class="spacer"></span><button class="icon-btn" id="closeScanner">×</button></div>
      <div class="scanner-guide">Aponta a câmara para um código do teu livro.</div>
      <div id="barcodeReader" class="barcode-reader"></div>
      <div class="scanner-manual">
        <span>Ou escreve o código:</span>
        <div class="btn-row"><input id="manualBarcode" placeholder="Código de barras"><button class="btn btn-light" id="manualFind">Procurar</button></div>
      </div>
      <div id="scanResult"></div>
    </section>
  </div>`);

  const close=async()=>{
    await stopScanner();
    document.getElementById("scannerModal")?.remove();
  };
  document.getElementById("closeScanner").onclick=close;
  document.getElementById("manualFind").onclick=()=>lookupBarcode(document.getElementById("manualBarcode").value.trim());
  startScanner();
}

async function startScanner(){
  const reader=document.getElementById("barcodeReader");
  if(!reader)return;
  if(!window.Html5Qrcode){
    reader.innerHTML=`<div class="notice error">O scanner não carregou. Usa o campo manual abaixo.</div>`;
    return;
  }
  try{
    const scanner=new window.Html5Qrcode("barcodeReader");
    state.scanner=scanner;
    await scanner.start(
      {facingMode:"environment"},
      {fps:10,qrbox:{width:280,height:150}},
      async decoded=>{
        await stopScanner();
        lookupBarcode(decoded);
      },
      ()=>{}
    );
  }catch(err){
    console.warn(err);
    reader.innerHTML=`<div class="notice">Não consegui abrir a câmara. Permite acesso à câmara ou escreve o código manualmente.</div>`;
  }
}

async function stopScanner(){
  if(state.scanner){
    try{await state.scanner.stop()}catch(e){}
    try{state.scanner.clear()}catch(e){}
    state.scanner=null;
  }
}

function lookupBarcode(code){
  const normalized=String(code||"").trim();
  const p=state.catalog.find(x=>String(x.barcode).trim()===normalized);
  const result=document.getElementById("scanResult");
  if(!result)return;
  if(!p){
    result.innerHTML=`<div class="notice error">Código não encontrado nesta conta: ${esc(normalized||"—")}</div>`;
    return;
  }
  renderEntryForm(result,p);
}

function showCatalogEntry(id){
  const p=state.catalog.find(x=>x.id===id);if(!p)return;
  document.body.insertAdjacentHTML("beforeend",`<div class="modal-backdrop" id="entryModal">
    <section class="modal"><div class="modal-head"><h2>Dar entrada</h2><span class="spacer"></span><button class="icon-btn" id="closeEntry">×</button></div><div id="entryResult"></div></section>
  </div>`);
  document.getElementById("closeEntry").onclick=()=>document.getElementById("entryModal")?.remove();
  renderEntryForm(document.getElementById("entryResult"),p);
}

function renderEntryForm(container,p){
  container.innerHTML=`
    <div class="scan-product">
      ${catalogImage(p,"scan-photo")}
      <div>
        <span class="scan-ok">✓ Confirma se é este produto</span>
        <h3>${esc(p.product_name)}</h3>
        <p>${esc([p.brand,p.variant].filter(Boolean).join(" · "))}</p>
        <small class="barcode">${esc(p.barcode)}</small>
      </div>
    </div>
    <div class="entry-toolbar">
      <label>Data de entrada<input data-entry-date type="date" value="${today()}"></label>
      <label>Custo / unidade (€)<input data-entry-cost type="number" min="0" step="0.01" value="${Number(p.default_unit_cost||0)}"></label>
    </div>
    <div class="size-entry-grid">
      ${(p.sizes||[]).map(size=>`
        <label class="size-entry-row">
          <span>${esc(size)}</span>
          <input type="number" min="0" step="1" value="0" data-entry-size="${esc(size)}">
        </label>`).join("")}
    </div>
    <div class="btn-row entry-save-row">
      <button class="btn" data-save-entry="${p.id}">Dar entrada no stock</button>
      <span class="muted">Preenche só os tamanhos que chegaram.</span>
    </div>
    <div data-entry-msg class="notice" hidden></div>`;

  container.querySelector(`[data-save-entry="${p.id}"]`).onclick=()=>saveCatalogStockEntry(container,p);
}

async function saveCatalogStockEntry(container,p){
  const msg=container.querySelector("[data-entry-msg]");hide(msg);
  const received_date=container.querySelector("[data-entry-date]").value||today();
  const unit_cost=Math.max(0,Number(container.querySelector("[data-entry-cost]").value||0));
  const entries=[...container.querySelectorAll("[data-entry-size]")].map(inp=>({
    size:inp.dataset.entrySize,quantity:Math.max(0,Math.floor(Number(inp.value||0)))
  })).filter(x=>x.quantity>0);

  if(!entries.length)return show(msg,"Mete quantidade em pelo menos um tamanho.","error");

  for(const entry of entries){
    let stock=state.stock.find(s=>s.catalog_id===p.id&&String(s.size||"")===String(entry.size||""));
    if(stock){
      const {error}=await supabase.from("stock_items").update({
        quantity:Number(stock.quantity)+entry.quantity,
        initial_quantity:Number(stock.initial_quantity||0)+entry.quantity,
        unit_cost,
        product_name:catalogFullName(p),
        updated_at:new Date().toISOString()
      }).eq("id",stock.id);
      if(error)return show(msg,`Erro no tamanho ${entry.size}: ${error.message}`,"error");
    }else{
      const {data:created,error}=await supabase.from("stock_items").insert({
        workspace_id:state.workspace.id,
        catalog_id:p.id,
        product_name:catalogFullName(p),
        size:entry.size,
        quantity:entry.quantity,
        initial_quantity:entry.quantity,
        unit_cost,
        origin:"Compra manual",
        barcode:null
      }).select().single();
      if(error)return show(msg,`Erro no tamanho ${entry.size}: ${error.message}`,"error");
      stock=created;
    }

    const {error:receiptErr}=await supabase.from("stock_receipts").insert({
      workspace_id:state.workspace.id,catalog_id:p.id,stock_item_id:stock.id,
      product_name:catalogFullName(p),size:entry.size,quantity:entry.quantity,unit_cost,received_date
    });
    if(receiptErr)return show(msg,`Stock atualizado, mas falhou o histórico do tamanho ${entry.size}.`,"error");
  }

  await loadWorkspaceData();
  show(msg,`Entrada guardada: ${entries.reduce((a,x)=>a+x.quantity,0)} unidades.`,"success");
  container.querySelectorAll("[data-entry-size]").forEach(inp=>inp.value="0");
}

function renderStock(t){
  t.innerHTML=`${pageHead("Stock","O que existe fisicamente neste espaço")}<div class="two-col"><section class="card"><div class="section-head"><h2>Stock atual</h2><span class="spacer"></span><input class="search" id="stockSearch" placeholder="Pesquisar produto, tamanho ou código"></div><div id="stockList"></div></section><section class="card"><div class="section-head"><h2>Adicionar stock</h2></div><div class="grid"><label>Produto<input id="stProduct" placeholder="Ex.: ADIDAS SAMBA"></label><div class="grid grid-2"><label>Tamanho<input id="stSize" placeholder="38 / M"></label><label>Quantidade<input id="stQty" type="number" min="1" value="1"></label></div><label>Preço de compra / unidade (€)<input id="stCost" type="number" min="0" step="0.01" value="0"></label><label>Código de barras<input id="stBarcode" placeholder="Opcional"></label><div class="btn-row"><button class="btn btn-light" id="genBarcode">Gerar código</button><button class="btn" id="saveStock">Guardar</button></div><div id="stockMsg" class="notice" hidden></div></div></section></div>`;
  const search=document.getElementById("stockSearch");
  const draw=()=>{const q=search.value.trim().toLowerCase();const list=state.stock.filter(x=>Number(x.quantity)>0&&(!q||[x.product_name,x.size,x.barcode].join(" ").toLowerCase().includes(q)));document.getElementById("stockList").innerHTML=list.length?`<div class="stock-grid">${list.map(x=>`<div class="stock-row"><div class="stock-name"><strong>${esc(x.product_name)}</strong><small>${esc(x.size||"Sem tamanho")} ${x.barcode?`· <span class="barcode">${esc(x.barcode)}</span>`:""}</small></div><div class="stock-qty">${int(x.quantity)}</div><div class="stock-cost">${eur(x.unit_cost)}</div><div class="stock-actions"><button class="icon-btn" data-dec="${x.id}">−</button><button class="icon-btn" data-add="${x.id}">+</button><button class="btn btn-light" data-set="${x.id}">Qtd.</button><button class="btn btn-light" data-edit-stock="${x.id}">Editar</button></div></div>`).join("")}</div>`:`<div class="empty">Nenhum stock encontrado.</div>`;document.querySelectorAll("[data-dec]").forEach(b=>b.onclick=()=>changeStock(b.dataset.dec,-1));document.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>changeStock(b.dataset.add,1));document.querySelectorAll("[data-set]").forEach(b=>b.onclick=()=>setStock(b.dataset.set));document.querySelectorAll("[data-edit-stock]").forEach(b=>b.onclick=()=>openEditStock(b.dataset.editStock))};
  search.oninput=draw;draw();
  document.getElementById("genBarcode").onclick=()=>{const p=(state.workspace.slug||"").startsWith("verseline")?"VE":"ST";document.getElementById("stBarcode").value=`${p}-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2,5).toUpperCase()}`};
  document.getElementById("saveStock").onclick=async()=>{const msg=document.getElementById("stockMsg");hide(msg);const product_name=document.getElementById("stProduct").value.trim(),size=document.getElementById("stSize").value.trim()||null,quantity=Math.max(1,Number(document.getElementById("stQty").value||1)),unit_cost=Math.max(0,Number(document.getElementById("stCost").value||0)),barcode=document.getElementById("stBarcode").value.trim()||null;if(!product_name)return show(msg,"Escreve o nome do produto.","error");const {data:created,error}=await supabase.from("stock_items").insert({workspace_id:state.workspace.id,product_name,size,quantity,initial_quantity:quantity,unit_cost,origin:"Compra manual",barcode}).select().single();
    if(error)return show(msg,error.code==="23505"?"Esse código de barras já existe.":error.message,"error");
    await supabase.from("stock_receipts").insert({workspace_id:state.workspace.id,stock_item_id:created?.id||null,product_name,size,quantity,unit_cost,received_date:today()});
    await loadWorkspaceData();renderStock(t)};
}
async function saveStockCorrection(item,changes,note){
  const {data,error}=await supabase.rpc("correct_stock_item",{
    p_stock_item_id:item.id,
    p_product_name:changes.product_name,
    p_size:changes.size||"",
    p_quantity:Number(changes.quantity),
    p_unit_cost:Number(changes.unit_cost||0),
    p_barcode:changes.barcode||"",
    p_note:note||""
  });
  if(error)throw error;
  return data;
}

async function changeStock(id,delta){
  const item=state.stock.find(x=>x.id===id);if(!item)return;
  const next=Number(item.quantity)+delta;if(next<0)return;
  try{
    await saveStockCorrection(item,{...item,quantity:next},delta>0?"Ajuste rápido +1":"Ajuste rápido -1");
    await loadWorkspaceData();renderShell();
  }catch(e){alert("Não foi possível corrigir o stock: "+e.message)}
}

async function setStock(id){
  const item=state.stock.find(x=>x.id===id);if(!item)return;
  const v=prompt(`Quantidade atual: ${item.quantity}\nNova quantidade:`,String(item.quantity));
  if(v===null)return;
  const next=Math.floor(Number(v));if(!Number.isFinite(next)||next<0)return;
  try{
    await saveStockCorrection(item,{...item,quantity:next},"Correção manual de quantidade");
    await loadWorkspaceData();renderShell();
  }catch(e){alert("Não foi possível corrigir o stock: "+e.message)}
}

function openEditStock(id){
  const item=state.stock.find(x=>x.id===id);if(!item)return;
  document.body.insertAdjacentHTML("beforeend",`<div class="modal-backdrop" id="editStockModal"><section class="modal">
    <div class="modal-head"><h2>Editar stock</h2><span class="spacer"></span><button class="icon-btn" id="closeEditStock">×</button></div>
    <div class="grid">
      <label>Produto<input id="esProduct" value="${esc(item.product_name)}"></label>
      <div class="grid grid-2">
        <label>Tamanho<input id="esSize" value="${esc(item.size||"")}"></label>
        <label>Quantidade<input id="esQty" type="number" min="0" step="1" value="${Number(item.quantity||0)}"></label>
      </div>
      <label>Preço de compra / unidade (€)<input id="esCost" type="number" min="0" step="0.01" value="${Number(item.unit_cost||0)}"></label>
      <label>Código de barras<input id="esBarcode" value="${esc(item.barcode||"")}"></label>
      <label>Motivo da correção <span class="muted">(opcional)</span><input id="esNote" placeholder="Ex.: escrevi 10 mas eram 8"></label>
      ${item.catalog_id?`<div class="notice">Este stock veio de um produto do Catálogo. A correção aqui altera o stock; o código/foto principal continuam em Produtos & Códigos.</div>`:""}
      <div id="esMsg" class="notice" hidden></div>
      <button class="btn" id="saveEditStock">Guardar correção</button>
    </div>
  </section></div>`);
  const close=()=>document.getElementById("editStockModal")?.remove();
  document.getElementById("closeEditStock").onclick=close;
  document.getElementById("saveEditStock").onclick=async()=>{
    const msg=document.getElementById("esMsg");hide(msg);
    const product_name=document.getElementById("esProduct").value.trim();
    const size=document.getElementById("esSize").value.trim();
    const quantity=Math.floor(Number(document.getElementById("esQty").value));
    const unit_cost=Number(document.getElementById("esCost").value||0);
    const barcode=document.getElementById("esBarcode").value.trim();
    const note=document.getElementById("esNote").value.trim();
    if(!product_name||!Number.isFinite(quantity)||quantity<0||unit_cost<0)return show(msg,"Confirma produto, quantidade e custo.","error");
    try{
      await saveStockCorrection(item,{product_name,size,quantity,unit_cost,barcode},note||"Edição manual de stock");
      await loadWorkspaceData();close();renderStock(document.getElementById("page"));
    }catch(e){show(msg,e.message,"error")}
  };
}


function orderItemTemplate(i){
  const options=state.stock.filter(s=>Number(s.quantity)>0).map(s=>`<option value="${s.id}">${esc(s.product_name)} · ${esc(s.size||"-")} · ${s.quantity} un.</option>`).join("");
  return `<div class="order-item" data-item="${i}"><div class="order-item-title"><strong>Produto ${i+1}</strong></div><div class="grid grid-3"><label>Vai usar stock?<select data-f="useStock"><option value="yes">SIM — escolher do stock</option><option value="no">NÃO — comprado / sem stock</option></select></label><label>Quantidade<input data-f="qty" type="number" min="1" value="1"></label><label>Preço venda / unidade (€)<input data-f="sale" type="number" min="0" step="0.01" value="0"></label></div><div class="order-box" data-box="stock"><label>Escolhe o artigo<select data-f="stockId"><option value="">— escolher —</option>${options}</select></label></div><div class="order-box hidden" data-box="manual">
  <div class="grid grid-3">
    <label>Produto<input data-f="product"></label>
    <label>Tamanho<input data-f="size"></label>
    <label>Quanto te custou / unidade (€)<input data-f="purchase" type="number" min="0" step="0.01" value="0"></label>
  </div>
  <div class="grid grid-2" style="margin-top:10px">
    <label>Fornecedor <span class="muted">(opcional)</span><input data-f="supplier" placeholder="Ex.: Fornecedor Espanha"></label>
    <label class="check-row supplier-paid-check"><input data-f="supplierPaid" type="checkbox"> Já paguei este produto ao fornecedor</label>
  </div>
</div></div>`;
}
function renderNewOrder(t){
  t.innerHTML=`${pageHead("Nova encomenda","Escolhe quantos produtos e só aparecem esses produtos")}<section class="card"><div class="grid grid-4"><label>Data<input id="oDate" type="date" value="${today()}"></label><label>Nº encomenda / referência<input id="oRef" placeholder="#1501"></label><label>Canal<select id="oChannel">${CHANNELS.map(x=>`<option>${x}</option>`).join("")}</select></label><label>Tipo de portes<select id="oShipping">${state.shipping.map(x=>`<option>${esc(x.shipping_type)}</option>`).join("")}</select></label></div><div class="grid grid-2" style="margin-top:14px"><label>Quantos produtos?<select id="oCount">${Array.from({length:10},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join("")}</select></label><label>Estado<select id="oStatus">${STATUSES.map(x=>`<option>${x}</option>`).join("")}</select></label></div><hr class="sep"><div id="orderItems" class="grid"></div><hr class="sep"><div class="btn-row"><button class="btn" id="saveOrder">Guardar encomenda</button><span class="muted" id="orderPreview"></span></div><div id="orderMsg" class="notice" hidden></div></section>`;
  const box=document.getElementById("orderItems"),count=document.getElementById("oCount");
  const draw=()=>{box.innerHTML=Array.from({length:Number(count.value)},(_,i)=>orderItemTemplate(i)).join("");box.querySelectorAll("[data-f='useStock']").forEach(sel=>sel.onchange=()=>{const row=sel.closest("[data-item]");row.querySelector("[data-box='stock']").classList.toggle("hidden",sel.value!=="yes");row.querySelector("[data-box='manual']").classList.toggle("hidden",sel.value==="yes");previewOrder()});box.querySelectorAll("input,select").forEach(x=>x.addEventListener("input",previewOrder));previewOrder()};count.onchange=draw;draw();document.getElementById("saveOrder").onclick=saveOrder;
}
function readItems(){return [...document.querySelectorAll("[data-item]")].map(row=>{
  const use=row.querySelector("[data-f='useStock']").value==="yes";
  const qty=Math.max(1,Number(row.querySelector("[data-f='qty']").value||1));
  const sale=Math.max(0,Number(row.querySelector("[data-f='sale']").value||0));
  if(use){
    const stockId=row.querySelector("[data-f='stockId']").value,st=state.stock.find(s=>s.id===stockId);
    return{source:"stock",stockId,stock:st,product_name:st?.product_name||"",size:st?.size||"",qty,sale,purchase:0,supplier_name:null,supplier_paid:false}
  }
  return{
    source:"purchased",stockId:null,
    product_name:row.querySelector("[data-f='product']").value.trim(),
    size:row.querySelector("[data-f='size']").value.trim(),
    qty,sale,
    purchase:Math.max(0,Number(row.querySelector("[data-f='purchase']").value||0)),
    supplier_name:row.querySelector("[data-f='supplier']")?.value.trim()||null,
    supplier_paid:!!row.querySelector("[data-f='supplierPaid']")?.checked
  }
})}
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
  const rows=items.map(it=>({
    workspace_id:state.workspace.id,
    order_id:order.id,
    product_name:it.product_name,
    size:it.size||null,
    quantity:it.qty,
    sale_price:it.sale,
    source:it.source,
    purchase_price:it.purchase,
    stock_item_id:it.stockId,
    supplier_name:it.source==="purchased"?(it.supplier_name||null):null,
    supplier_paid:it.source==="purchased"?!!it.supplier_paid:false,
    supplier_paid_at:it.source==="purchased"&&it.supplier_paid?new Date().toISOString():null
  }));const {error:itemErr}=await supabase.from("order_items").insert(rows);if(itemErr){await supabase.from("orders").delete().eq("id",order.id);return show(msg,"Não foi possível guardar os produtos.","error")}
  if(status==="Em trânsito"||status==="Entregue")for(const [id,qty] of usage){const st=state.stock.find(x=>x.id===id);const {error:se}=await supabase.from("stock_items").update({quantity:Number(st.quantity)-qty,updated_at:new Date().toISOString()}).eq("id",id).eq("quantity",st.quantity);if(se)return show(msg,"Encomenda criada, mas o stock mudou entretanto. Confere o stock antes de continuar.","error")}
  if(status==="Devolvido")for(const it of items.filter(x=>x.source==="purchased"))await supabase.from("stock_items").insert({workspace_id:state.workspace.id,product_name:it.product_name,size:it.size||null,quantity:it.qty,initial_quantity:it.qty,unit_cost:it.purchase,origin:"Devolução",source_order_id:order.id});
  await loadWorkspaceData();await recalcDate(order_date);await loadWorkspaceData();go("orders");
}
async function recalcDate(date){const orders=state.orders.filter(o=>o.order_date===date),spend=state.meta.filter(x=>x.spend_date===date).reduce((a,x)=>a+Number(x.amount||0),0),eligible=orders.filter(x=>x.channel!=="Vinted"),per=eligible.length?spend/eligible.length:0;for(const o of orders){const items=state.items.filter(i=>i.order_id===o.id),cost=items.reduce((a,i)=>a+(i.source==="purchased"?Number(i.quantity)*Number(i.purchase_price):0),0),sale=items.reduce((a,i)=>a+Number(i.quantity)*Number(i.sale_price),0),meta=o.channel==="Vinted"?0:per,revenue=o.status==="Entregue"?sale:0,result=revenue-cost-Number(o.shipping_out||0)-Number(o.shipping_return||0)-meta;await supabase.from("orders").update({meta_cost:meta,revenue,result,updated_at:new Date().toISOString()}).eq("id",o.id)}}
function allowedNext(s){if(s==="Cancelado antes envio")return["Cancelado antes envio","Em trânsito","Entregue"];if(s==="Em trânsito")return["Em trânsito","Entregue","Devolvido"];if(s==="Entregue")return["Entregue","Devolvido"];return["Devolvido"]}
function supplierStateForOrder(items){
  const bought=items.filter(i=>i.source==="purchased");
  if(!bought.length)return {key:"stock",label:"Só stock",className:"neutral"};
  const unpaid=bought.filter(i=>!i.supplier_paid);
  if(!unpaid.length)return {key:"paid",label:"Fornecedor pago",className:"paid"};
  return {key:"unpaid",label:`Por pagar (${unpaid.length})`,className:"unpaid"};
}

function supplierCost(items,paidState=null){
  return items
    .filter(i=>i.source==="purchased"&&(paidState===null||!!i.supplier_paid===paidState))
    .reduce((a,i)=>a+Number(i.quantity||0)*Number(i.purchase_price||0),0);
}

async function toggleSupplierPayment(itemId,nextPaid){
  const item=state.items.find(i=>i.id===itemId);
  if(!item||item.source!=="purchased")return;
  if(!nextPaid&&!confirm("Marcar este produto novamente como POR PAGAR?"))return;

  const {error}=await supabase.rpc("set_supplier_paid",{
    p_order_item_id:item.id,
    p_paid:nextPaid,
    p_supplier_name:item.supplier_name||null,
    p_note:null
  });
  if(error)return alert("Não foi possível atualizar o pagamento: "+error.message);

  await loadWorkspaceData();
  renderOrders(document.getElementById("page"));
}

function renderOrders(t){
  const month=state.ordersMonth||today().slice(0,7);
  state.ordersMonth=month;

  t.innerHTML=`
    ${pageHead("Encomendas","Controla encomendas e pagamentos aos fornecedores num só sítio.",`<button class="btn" id="newOrderBtn">+ Nova encomenda</button>`)}

    <section class="card work-orders-toolbar">
      <div class="orders-filter-grid">
        <label>Mês
          <input id="ordersMonth" type="month" value="${esc(month)}">
        </label>
        <label>Fornecedor
          <select id="supplierFilter">
            <option value="all">Todos</option>
            <option value="unpaid">Por pagar</option>
            <option value="paid">Pagos</option>
            <option value="stock">Só artigos do stock</option>
          </select>
        </label>
        <label>Estado
          <select id="orderStatusFilter">
            <option value="all">Todos os estados</option>
            ${STATUSES.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join("")}
          </select>
        </label>
        <label>Pesquisar
          <input id="orderSearch" placeholder="Nº, produto, fornecedor...">
        </label>
      </div>
    </section>

    <div id="supplierSummary"></div>
    <div id="orderList" class="grid"></div>`;

  document.getElementById("newOrderBtn").onclick=()=>go("new-order");
  const monthInput=document.getElementById("ordersMonth");
  const supplierFilter=document.getElementById("supplierFilter");
  const statusFilter=document.getElementById("orderStatusFilter");
  const search=document.getElementById("orderSearch");

  const draw=()=>{
    const selectedMonth=monthInput.value||month;
    state.ordersMonth=selectedMonth;
    const q=search.value.toLowerCase().trim();

    const monthOrders=state.orders.filter(o=>String(o.order_date).startsWith(selectedMonth));
    const monthIds=new Set(monthOrders.map(o=>o.id));
    const monthBought=state.items.filter(i=>monthIds.has(i.order_id)&&i.source==="purchased");
    const totalSupplier=supplierCost(monthBought);
    const paidSupplier=supplierCost(monthBought,true);
    const unpaidSupplier=supplierCost(monthBought,false);

    document.getElementById("supplierSummary").innerHTML=`
      <div class="supplier-summary">
        <div class="supplier-kpi"><span>Encomendas do mês</span><strong>${monthOrders.length}</strong></div>
        <div class="supplier-kpi"><span>Custo fornecedor</span><strong>${eur(totalSupplier)}</strong></div>
        <div class="supplier-kpi paid"><span>Já pago</span><strong>${eur(paidSupplier)}</strong></div>
        <div class="supplier-kpi unpaid"><span>Por pagar</span><strong>${eur(unpaidSupplier)}</strong></div>
      </div>`;

    const list=monthOrders.filter(o=>{
      const items=state.items.filter(i=>i.order_id===o.id);
      const supplierState=supplierStateForOrder(items);

      if(supplierFilter.value!=="all"&&supplierState.key!==supplierFilter.value)return false;
      if(statusFilter.value!=="all"&&o.status!==statusFilter.value)return false;

      if(q){
        const hay=[o.order_ref,o.channel,o.status,
          ...items.flatMap(i=>[i.product_name,i.size,i.supplier_name||""])
        ].join(" ").toLowerCase();
        if(!hay.includes(q))return false;
      }
      return true;
    });

    document.getElementById("orderList").innerHTML=list.length?list.map(o=>{
      const items=state.items.filter(i=>i.order_id===o.id);
      const supplierState=supplierStateForOrder(items);
      const orderSupplierTotal=supplierCost(items);
      const orderUnpaid=supplierCost(items,false);

      return `<article class="order-card work-order-card">
        <div class="order-top">
          <strong>${esc(o.order_ref)}</strong>
          <span class="badge">${esc(o.channel)}</span>
          <span class="badge supplier-status ${supplierState.className}">${esc(supplierState.label)}</span>
          <span class="muted">${esc(o.order_date)}</span>
          <span class="spacer"></span>
          <strong class="${Number(o.result)>=0?"good":"bad"}">${eur(o.result)}</strong>
        </div>

        <div class="order-products supplier-products">
          ${items.map(i=>{
            if(i.source==="stock"){
              return `<div class="supplier-item stock-source">
                <div><strong>${i.quantity}× ${esc(i.product_name)}</strong> · ${esc(i.size||"-")}</div>
                <span class="badge">Do stock</span>
              </div>`;
            }
            const amount=Number(i.quantity||0)*Number(i.purchase_price||0);
            return `<div class="supplier-item ${i.supplier_paid?"is-paid":"is-unpaid"}">
              <div class="supplier-item-main">
                <strong>${i.quantity}× ${esc(i.product_name)}</strong> · ${esc(i.size||"-")}
                <small>Fornecedor: ${esc(i.supplier_name||"Não indicado")} · ${eur(amount)}</small>
              </div>
              <span class="badge supplier-status ${i.supplier_paid?"paid":"unpaid"}">${i.supplier_paid?"PAGO":"POR PAGAR"}</span>
              <button class="btn ${i.supplier_paid?"btn-light":"btn-success"} btn-small" data-supplier-pay="${i.id}" data-next-paid="${i.supplier_paid?"0":"1"}">
                ${i.supplier_paid?"Marcar por pagar":"Marcar pago"}
              </button>
            </div>`;
          }).join("")}
        </div>

        <div class="order-finance-line">
          <span>Venda ${eur(items.reduce((a,i)=>a+Number(i.quantity||0)*Number(i.sale_price||0),0))}</span>
          <span>Fornecedor ${eur(orderSupplierTotal)}</span>
          ${orderUnpaid>0?`<strong class="bad">Falta pagar ${eur(orderUnpaid)}</strong>`:`${orderSupplierTotal>0?`<strong class="good">Fornecedor pago</strong>`:""}`}
          <span>Portes ${eur(Number(o.shipping_out)+Number(o.shipping_return))}</span>
          <span>Meta ${eur(o.meta_cost)}</span>
        </div>

        <div class="btn-row order-actions-row">
          <button class="btn btn-light" data-edit-order="${o.id}">Editar</button>
          <label style="min-width:220px">Estado
            <select data-order-status="${o.id}" ${o.status==="Devolvido"?"disabled":""}>
              ${allowedNext(o.status).map(s=>`<option ${s===o.status?"selected":""}>${s}</option>`).join("")}
            </select>
          </label>
        </div>
      </article>`;
    }).join(""):`<div class="card empty">Não existem encomendas com estes filtros.</div>`;

    document.querySelectorAll("[data-order-status]").forEach(s=>s.onchange=()=>changeOrderStatus(s.dataset.orderStatus,s.value));
    document.querySelectorAll("[data-edit-order]").forEach(b=>b.onclick=()=>openEditOrder(b.dataset.editOrder));
    document.querySelectorAll("[data-supplier-pay]").forEach(b=>b.onclick=()=>toggleSupplierPayment(b.dataset.supplierPay,b.dataset.nextPaid==="1"));
  };

  monthInput.onchange=draw;
  supplierFilter.onchange=draw;
  statusFilter.onchange=draw;
  search.oninput=draw;
  draw();
}

function editStockOptions(selectedId){
  return state.stock.map(s=>`<option value="${s.id}" ${s.id===selectedId?"selected":""}>${esc(s.product_name)} · ${esc(s.size||"-")} · atual ${Number(s.quantity||0)}</option>`).join("");
}

function editOrderItemRow(item,index,locked=false){
  if(locked){
    return `<div class="order-item edit-order-item" data-edit-item="${index}" data-id="${item.id||""}">
      <div class="order-item-title"><strong>Produto ${index+1}</strong><span class="badge">Devolvido — produto bloqueado</span></div>
      <input type="hidden" data-e="source" value="${esc(item.source)}">
      <input type="hidden" data-e="stockId" value="${esc(item.stock_item_id||"")}">
      <div class="grid grid-3">
        <label>Produto<input data-e="product" value="${esc(item.product_name)}" readonly></label>
        <label>Tamanho<input data-e="size" value="${esc(item.size||"")}" readonly></label>
        <label>Quantidade<input data-e="qty" type="number" value="${Number(item.quantity)}" readonly></label>
        <label>Preço venda / unid. (€)<input data-e="sale" type="number" min="0" step="0.01" value="${Number(item.sale_price||0)}"></label>
        <label>Custo / unid. (€)<input data-e="purchase" type="number" min="0" step="0.01" value="${Number(item.purchase_price||0)}"></label>
        ${item.source==="purchased"?`<label>Fornecedor<input data-e="supplier" value="${esc(item.supplier_name||"")}"></label>
        <label class="check-row"><input data-e="supplierPaid" type="checkbox" ${item.supplier_paid?"checked":""}> Pago ao fornecedor</label>`:""}
      </div>
    </div>`;
  }

  const isStock=item.source==="stock";
  return `<div class="order-item edit-order-item" data-edit-item="${index}" data-id="${item.id||""}">
    <div class="order-item-title"><strong>Produto ${index+1}</strong><span class="spacer"></span><button class="btn btn-danger" type="button" data-remove-edit-item>Remover</button></div>
    <div class="grid grid-3">
      <label>Origem<select data-e="source"><option value="stock" ${isStock?"selected":""}>Usar stock</option><option value="purchased" ${!isStock?"selected":""}>Comprado / sem stock</option></select></label>
      <label>Quantidade<input data-e="qty" type="number" min="1" step="1" value="${Number(item.quantity||1)}"></label>
      <label>Preço venda / unid. (€)<input data-e="sale" type="number" min="0" step="0.01" value="${Number(item.sale_price||0)}"></label>
    </div>
    <div class="order-box ${isStock?"":"hidden"}" data-edit-stock-box>
      <label>Artigo do stock<select data-e="stockId"><option value="">— escolher —</option>${editStockOptions(item.stock_item_id)}</select></label>
    </div>
    <div class="order-box ${isStock?"hidden":""}" data-edit-manual-box>
      <div class="grid grid-3">
        <label>Produto<input data-e="product" value="${esc(item.product_name||"")}"></label>
        <label>Tamanho<input data-e="size" value="${esc(item.size||"")}"></label>
        <label>Custo / unid. (€)<input data-e="purchase" type="number" min="0" step="0.01" value="${Number(item.purchase_price||0)}"></label>
      </div>
      <div class="grid grid-2" style="margin-top:10px">
        <label>Fornecedor<input data-e="supplier" value="${esc(item.supplier_name||"")}"></label>
        <label class="check-row"><input data-e="supplierPaid" type="checkbox" ${item.supplier_paid?"checked":""}> Pago ao fornecedor</label>
      </div>
    </div>
  </div>`;
}

function bindEditOrderRows(container){
  container.querySelectorAll(".edit-order-item").forEach(row=>{
    const source=row.querySelector('[data-e="source"]');
    if(source?.tagName==="SELECT"){
      source.onchange=()=>{
        const stockBox=row.querySelector("[data-edit-stock-box]");
        const manualBox=row.querySelector("[data-edit-manual-box]");
        stockBox?.classList.toggle("hidden",source.value!=="stock");
        manualBox?.classList.toggle("hidden",source.value==="stock");
      };
    }
    row.querySelector("[data-remove-edit-item]")?.addEventListener("click",()=>{
      if(container.querySelectorAll(".edit-order-item").length<=1)return alert("A encomenda tem de ter pelo menos um produto.");
      row.remove();
      renumberEditItems(container);
    });
  });
}

function renumberEditItems(container){
  [...container.querySelectorAll(".edit-order-item")].forEach((row,i)=>{
    row.dataset.editItem=i;
    const title=row.querySelector(".order-item-title strong");
    if(title)title.textContent=`Produto ${i+1}`;
  });
}

function emptyEditItem(){
  return {id:"",source:"purchased",stock_item_id:null,product_name:"",size:"",quantity:1,sale_price:0,purchase_price:0,supplier_name:"",supplier_paid:false,supplier_paid_at:null,supplier_note:null};
}

function readEditOrderItems(container,locked){
  return [...container.querySelectorAll(".edit-order-item")].map(row=>{
    const source=row.querySelector('[data-e="source"]').value;
    const qty=Math.max(1,Math.floor(Number(row.querySelector('[data-e="qty"]').value||1)));
    const sale_price=Math.max(0,Number(row.querySelector('[data-e="sale"]').value||0));
    const purchase_price=Math.max(0,Number(row.querySelector('[data-e="purchase"]')?.value||0));
    const id=row.dataset.id||null;
    const original=id?state.items.find(i=>i.id===id):null;

    if(source==="stock"){
      const stock_item_id=row.querySelector('[data-e="stockId"]').value||null;
      const st=state.stock.find(s=>s.id===stock_item_id);
      const productInput=row.querySelector('[data-e="product"]');
      const sizeInput=row.querySelector('[data-e="size"]');
      return {
        id,source,stock_item_id,
        product_name:locked?(productInput?.value||""):(st?.product_name||""),
        size:locked?(sizeInput?.value||""):(st?.size||""),
        quantity:qty,sale_price,purchase_price:0,
        supplier_name:null,supplier_paid:false,supplier_paid_at:null,supplier_note:null
      };
    }

    const supplier_paid=!!row.querySelector('[data-e="supplierPaid"]')?.checked;
    return {
      id,source,stock_item_id:null,
      product_name:row.querySelector('[data-e="product"]').value.trim(),
      size:row.querySelector('[data-e="size"]').value.trim(),
      quantity:qty,sale_price,purchase_price,
      supplier_name:row.querySelector('[data-e="supplier"]')?.value.trim()||null,
      supplier_paid,
      supplier_paid_at:supplier_paid?(original?.supplier_paid_at||null):null,
      supplier_note:original?.supplier_note||null
    };
  });
}

function openEditOrder(id){
  const order=state.orders.find(o=>o.id===id);if(!order)return;
  const items=state.items.filter(i=>i.order_id===id);
  const locked=order.status==="Devolvido";

  document.body.insertAdjacentHTML("beforeend",`<div class="modal-backdrop" id="editOrderModal"><section class="modal edit-order-modal">
    <div class="modal-head"><h2>Editar encomenda ${esc(order.order_ref)}</h2><span class="spacer"></span><button class="icon-btn" id="closeEditOrder">×</button></div>
    <div class="grid grid-2">
      <label>Nº encomenda / referência<input id="eoRef" value="${esc(order.order_ref)}"></label>
      <label>Data<input id="eoDate" type="date" value="${esc(order.order_date)}"></label>
      <label>Canal<select id="eoChannel">${CHANNELS.map(x=>`<option ${x===order.channel?"selected":""}>${x}</option>`).join("")}</select></label>
      <label>Tipo de portes<select id="eoShipping">${state.shipping.map(x=>`<option ${x.shipping_type===order.shipping_type?"selected":""}>${esc(x.shipping_type)}</option>`).join("")}</select></label>
    </div>
    <div class="notice">Estado atual: <strong>${esc(order.status)}</strong>. O Estado continua a ser alterado pelo seletor na lista de encomendas.</div>
    ${locked?`<div class="notice warn">Esta encomenda já foi devolvida. Para proteger o stock, produto/tamanho/quantidade/origem ficam bloqueados; podes corrigir preços, custos e dados da encomenda.</div>`:""}
    <hr class="sep">
    <div id="editOrderItems" class="grid">${items.map((it,i)=>editOrderItemRow(it,i,locked)).join("")}</div>
    ${!locked?`<button class="btn btn-light" id="addEditItem" type="button" style="margin-top:12px">+ Adicionar produto</button>`:""}
    <label style="margin-top:14px">Motivo da correção <span class="muted">(opcional)</span><input id="eoNote" placeholder="Ex.: tamanho estava errado"></label>
    <div id="eoMsg" class="notice" hidden></div>
    <div class="btn-row" style="margin-top:14px"><button class="btn" id="saveEditOrder">Guardar alterações</button></div>
  </section></div>`);

  const modal=document.getElementById("editOrderModal");
  const container=document.getElementById("editOrderItems");
  const close=()=>modal?.remove();
  document.getElementById("closeEditOrder").onclick=close;
  bindEditOrderRows(container);

  document.getElementById("addEditItem")?.addEventListener("click",()=>{
    if(container.querySelectorAll(".edit-order-item").length>=10)return alert("Máximo de 10 produtos.");
    container.insertAdjacentHTML("beforeend",editOrderItemRow(emptyEditItem(),container.querySelectorAll(".edit-order-item").length,false));
    bindEditOrderRows(container);
  });

  document.getElementById("saveEditOrder").onclick=async()=>{
    const msg=document.getElementById("eoMsg");hide(msg);
    const order_ref=document.getElementById("eoRef").value.trim();
    const order_date=document.getElementById("eoDate").value;
    const channel=document.getElementById("eoChannel").value;
    const shipping_type=document.getElementById("eoShipping").value;
    const note=document.getElementById("eoNote").value.trim();
    const editedItems=readEditOrderItems(container,locked);

    if(!order_ref||!order_date)return show(msg,"Confirma referência e data.","error");
    for(const [i,it] of editedItems.entries()){
      if(!it.product_name)return show(msg,`Falta o produto ${i+1}.`,"error");
      if(it.source==="stock"&&!it.stock_item_id)return show(msg,`Escolhe o stock do produto ${i+1}.`,"error");
    }

    try{
      const oldDate=order.order_date;
      const {data,error}=await supabase.rpc("edit_order_full",{
        p_order_id:order.id,
        p_order_ref:order_ref,
        p_order_date:order_date,
        p_channel:channel,
        p_shipping_type:shipping_type,
        p_items:editedItems,
        p_note:note||null
      });
      if(error)throw error;

      await loadWorkspaceData();
      await recalcDate(oldDate);
      if(order_date!==oldDate)await recalcDate(order_date);
      await loadWorkspaceData();
      close();
      renderOrders(document.getElementById("page"));
    }catch(e){
      const text=String(e.message||e);
      show(msg,text.includes("duplicate")||text.includes("unique")?"Já existe uma encomenda com essa referência.":text,"error");
    }
  };
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
