import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const cfg = window.APP_CONFIG || {};
const supabase = createClient(cfg.supabaseUrl, cfg.supabaseKey);
const $app = document.getElementById("app");

const CHANNELS = ["Shopify","Instagram","Facebook","WhatsApp","Vinted"];
const STATUSES = ["Em trânsito","Entregue","Devolvido","Cancelado antes envio"];
const EXPENSE_TYPES = ["Shopify","Apps","Embalagens","Domínio","Material","Outro"];

const state = {
  selectedSlug: null,
  session: null,
  workspace: null,
  page: "dashboard",
  stock: [],
  orders: [],
  orderItems: [],
  shipping: [],
  meta: [],
  expenses: []
};

const fmtEur = n => new Intl.NumberFormat("pt-PT",{style:"currency",currency:"EUR"}).format(Number(n||0));
const fmtInt = n => new Intl.NumberFormat("pt-PT",{maximumFractionDigits:0}).format(Number(n||0));
const today = () => new Date().toISOString().slice(0,10);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

function setHTML(html){ $app.innerHTML = html; }
function showMsg(el, text, type=""){ if(el){ el.className=`notice ${type}`; el.textContent=text; el.hidden=false; } }
function hideMsg(el){ if(el) el.hidden=true; }

async function init(){
  const { data } = await supabase.auth.getSession();
  state.session = data.session || null;
  renderWorkspaceChooser();
}

function renderWorkspaceChooser(){
  setHTML(`
    <main class="auth-wrap">
      <div class="auth-box">
        <div class="auth-title">
          <h1>Gestão</h1>
          <p>Escolhe o espaço onde queres trabalhar.</p>
        </div>
        <div class="workspace-cards">
          <button class="workspace-card" data-workspace="lucky-urban">
            <strong>Lucky Urban</strong>
            <span>Encomendas, stock, Meta, portes e despesas da Lucky Urban.</span>
          </button>
          <button class="workspace-card" data-workspace="verseline">
            <strong>Verseline</strong>
            <span>Dados completamente separados da Lucky Urban.</span>
          </button>
        </div>
        ${state.session ? `
          <div class="card" style="text-align:center">
            <div class="muted">Sessão atual: ${esc(state.session.user.email)}</div>
            <button id="logoutChooser" class="btn btn-secondary" style="margin-top:10px">Terminar sessão</button>
          </div>` : ""}
      </div>
    </main>
  `);
  document.querySelectorAll("[data-workspace]").forEach(btn=>{
    btn.addEventListener("click",()=>chooseWorkspace(btn.dataset.workspace));
  });
  document.getElementById("logoutChooser")?.addEventListener("click", logout);
}

async function chooseWorkspace(slug){
  state.selectedSlug = slug;
  if(state.session){
    const ok = await tryEnterWorkspace(slug);
    if(ok) return;
  }
  renderAuth(slug);
}

function workspaceName(slug){ return slug === "lucky-urban" ? "Lucky Urban" : "Verseline"; }

function renderAuth(slug){
  setHTML(`
    <main class="auth-wrap">
      <div class="auth-box">
        <div class="auth-title">
          <h1>${workspaceName(slug)}</h1>
          <p>Entra com o utilizador deste espaço.</p>
        </div>
        <section class="card auth-card">
          <h2>Iniciar sessão</h2>
          <div class="grid">
            <label>Email<input id="email" type="email" autocomplete="email" placeholder="email@exemplo.com"></label>
            <label>Palavra-passe<input id="password" type="password" autocomplete="current-password" placeholder="••••••••"></label>
            <div id="authMsg" class="notice" hidden></div>
            <div class="btn-row">
              <button id="loginBtn" class="btn">Entrar</button>
              <button id="signupBtn" class="btn btn-secondary">Criar utilizador</button>
              <button id="backBtn" class="btn btn-secondary">Voltar</button>
            </div>
          </div>
        </section>
      </div>
    </main>
  `);
  const msg = document.getElementById("authMsg");
  document.getElementById("backBtn").onclick=renderWorkspaceChooser;
  document.getElementById("loginBtn").onclick=async()=>{
    hideMsg(msg);
    const email=document.getElementById("email").value.trim();
    const password=document.getElementById("password").value;
    if(!email||!password) return showMsg(msg,"Preenche o email e a palavra-passe.","error");
    const { data,error }=await supabase.auth.signInWithPassword({email,password});
    if(error) return showMsg(msg,error.message,"error");
    state.session=data.session;
    const ok=await tryEnterWorkspace(slug);
    if(!ok) renderClaim(slug);
  };
  document.getElementById("signupBtn").onclick=async()=>{
    hideMsg(msg);
    const email=document.getElementById("email").value.trim();
    const password=document.getElementById("password").value;
    if(!email||password.length<6) return showMsg(msg,"Usa um email válido e uma palavra-passe com pelo menos 6 caracteres.","error");
    const { data,error }=await supabase.auth.signUp({email,password,options:{data:{display_name:workspaceName(slug)}}});
    if(error) return showMsg(msg,error.message,"error");
    if(data.session){
      state.session=data.session;
      renderClaim(slug);
    }else{
      showMsg(msg,"Utilizador criado. Confirma o email que o Supabase te enviar e depois entra aqui.","success");
    }
  };
}

async function getMyWorkspaces(){
  const { data: members,error }=await supabase.from("workspace_members").select("workspace_id,role");
  if(error) return [];
  if(!members?.length) return [];
  const ids=members.map(x=>x.workspace_id);
  const { data: spaces }=await supabase.from("workspaces").select("id,name,slug").in("id",ids);
  return spaces || [];
}

async function tryEnterWorkspace(slug){
  const spaces=await getMyWorkspaces();
  const ws=spaces.find(x=>x.slug===slug);
  if(!ws) return false;
  state.workspace=ws;
  await loadAll();
  renderShell();
  return true;
}

function renderClaim(slug){
  setHTML(`
    <main class="auth-wrap">
      <section class="card auth-card">
        <h2>Ativar ${workspaceName(slug)}</h2>
        <p class="muted">Este passo só é feito uma vez neste utilizador.</p>
        <div class="grid">
          <label>Código de ativação<input id="inviteCode" type="text" placeholder="Código privado"></label>
          <div id="claimMsg" class="notice" hidden></div>
          <div class="btn-row">
            <button id="claimBtn" class="btn">Ativar espaço</button>
            <button id="claimLogout" class="btn btn-secondary">Usar outro utilizador</button>
          </div>
        </div>
      </section>
    </main>
  `);
  const msg=document.getElementById("claimMsg");
  document.getElementById("claimLogout").onclick=logout;
  document.getElementById("claimBtn").onclick=async()=>{
    hideMsg(msg);
    const invite_code=document.getElementById("inviteCode").value.trim();
    if(!invite_code) return showMsg(msg,"Mete o código de ativação.","error");
    const { data,error }=await supabase.rpc("claim_workspace",{invite_code,expected_workspace_slug:slug});
    if(error) return showMsg(msg,"Código inválido, já usado ou não corresponde a este utilizador.","error");
    const claimed=Array.isArray(data)?data[0]:data;
    if(!claimed || claimed.workspace_slug!==slug){
      return showMsg(msg,"Esse código pertence a outro espaço. Termina sessão e escolhe o espaço correto.","error");
    }
    await tryEnterWorkspace(slug);
  };
}

async function logout(){
  await supabase.auth.signOut();
  state.session=null; state.workspace=null; state.selectedSlug=null;
  renderWorkspaceChooser();
}

async function loadAll(){
  await Promise.all([loadStock(),loadOrders(),loadShipping(),loadMeta(),loadExpenses()]);
}

async function loadStock(){
  const {data}=await supabase.from("stock_items").select("*")
    .eq("workspace_id",state.workspace.id).order("created_at",{ascending:false});
  state.stock=data||[];
}
async function loadOrders(){
  const [{data:orders},{data:items}]=await Promise.all([
    supabase.from("orders").select("*").eq("workspace_id",state.workspace.id).order("order_date",{ascending:false}).order("created_at",{ascending:false}),
    supabase.from("order_items").select("*").eq("workspace_id",state.workspace.id).order("created_at",{ascending:true})
  ]);
  state.orders=orders||[]; state.orderItems=items||[];
}
async function loadShipping(){
  const {data}=await supabase.from("shipping_rates").select("*").eq("workspace_id",state.workspace.id).order("created_at");
  state.shipping=data||[];
}
async function loadMeta(){
  const {data}=await supabase.from("meta_ads").select("*").eq("workspace_id",state.workspace.id).order("spend_date",{ascending:false});
  state.meta=data||[];
}
async function loadExpenses(){
  const {data}=await supabase.from("expenses").select("*").eq("workspace_id",state.workspace.id).order("expense_date",{ascending:false});
  state.expenses=data||[];
}

const NAV = [
  ["dashboard","Início"],["new-order","Nova encomenda"],["orders","Encomendas"],
  ["stock","Stock"],["meta","Meta Ads"],["shipping","Portes"],["expenses","Despesas"]
];

function renderShell(){
  setHTML(`
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">GESTÃO</div>
        <div class="workspace-pill">${esc(state.workspace.name)}</div>
        <nav class="nav">${NAV.map(([p,l])=>`<button data-page="${p}" class="${state.page===p?"active":""}">${l}</button>`).join("")}</nav>
        <div class="sidebar-bottom">
          <button id="switchWs">Trocar Lucky / Verseline</button>
          <button id="logoutBtn">Terminar sessão</button>
        </div>
      </aside>
      <main class="main">
        <div id="page"></div>
      </main>
      <nav class="mobile-bar">
        ${[["dashboard","Início"],["new-order","Nova"],["orders","Pedidos"],["stock","Stock"],["meta","Meta"]]
          .map(([p,l])=>`<button data-page="${p}" class="${state.page===p?"active":""}">${l}</button>`).join("")}
      </nav>
    </div>
  `);
  document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>go(b.dataset.page));
  document.getElementById("switchWs").onclick=renderWorkspaceChooser;
  document.getElementById("logoutBtn").onclick=logout;
  renderPage();
}

function go(page){ state.page=page; renderShell(); }

function pageHead(title,subtitle=""){
  return `<div class="topbar"><div><h1>${title}</h1>${subtitle?`<div class="muted">${subtitle}</div>`:""}</div><div class="spacer"></div><span class="badge">${esc(state.workspace.name)}</span></div>`;
}

function renderPage(){
  const target=document.getElementById("page");
  if(!target) return;
  if(state.page==="dashboard") return renderDashboard(target);
  if(state.page==="new-order") return renderNewOrder(target);
  if(state.page==="orders") return renderOrders(target);
  if(state.page==="stock") return renderStock(target);
  if(state.page==="meta") return renderMeta(target);
  if(state.page==="shipping") return renderShipping(target);
  if(state.page==="expenses") return renderExpenses(target);
}

function currentMonthKey(){ return today().slice(0,7); }
function renderDashboard(target){
  const month=currentMonthKey();
  const monthOrders=state.orders.filter(o=>String(o.order_date).startsWith(month));
  const monthMeta=state.meta.filter(x=>String(x.spend_date).startsWith(month)).reduce((a,x)=>a+Number(x.amount||0),0);
  const monthExpenses=state.expenses.filter(x=>String(x.expense_date).startsWith(month)).reduce((a,x)=>a+Number(x.amount||0),0);
  const manualStockCost=state.stock.filter(x=>x.origin==="Compra manual" && String(x.created_at).startsWith(month))
    .reduce((a,x)=>a+Number(x.initial_quantity||0)*Number(x.unit_cost||0),0);
  const revenue=monthOrders.reduce((a,x)=>a+Number(x.revenue||0),0);
  const orderResult=monthOrders.reduce((a,x)=>a+Number(x.result||0),0);
  const realResult=orderResult-manualStockCost-monthExpenses;
  const units=state.stock.reduce((a,x)=>a+Math.max(0,Number(x.quantity||0)),0);
  const delivered=monthOrders.filter(x=>x.status==="Entregue").length;
  const returned=monthOrders.filter(x=>x.status==="Devolvido").length;

  target.innerHTML=`
    ${pageHead("Início","Resumo deste mês")}
    <div class="stats">
      <div class="stat"><span>Receita recebida</span><strong>${fmtEur(revenue)}</strong></div>
      <div class="stat"><span>Resultado real</span><strong class="${realResult>=0?"good":"bad"}">${fmtEur(realResult)}</strong><div class="kpi-note">já desconta despesas e compras manuais de stock</div></div>
      <div class="stat"><span>Stock em casa</span><strong>${fmtInt(units)}</strong><div class="kpi-note">unidades disponíveis</div></div>
      <div class="stat"><span>Meta Ads</span><strong>${fmtEur(monthMeta)}</strong></div>
    </div>
    <div class="grid grid-3">
      <div class="card"><div class="muted">Encomendas</div><h2>${monthOrders.length}</h2></div>
      <div class="card"><div class="muted">Entregues</div><h2 class="good">${delivered}</h2></div>
      <div class="card"><div class="muted">Devolvidas</div><h2 class="bad">${returned}</h2></div>
    </div>
    <div class="hr"></div>
    <div class="two-col">
      <div class="card">
        <div class="section-head"><h2>Últimas encomendas</h2><div class="spacer"></div><button class="btn btn-secondary" id="dashOrders">Ver todas</button></div>
        ${ordersMiniHTML(state.orders.slice(0,5))}
      </div>
      <div class="card">
        <h2 style="margin-top:0">Ações rápidas</h2>
        <div class="grid">
          <button class="btn" id="quickOrder">+ Nova encomenda</button>
          <button class="btn btn-secondary" id="quickStock">+ Adicionar stock</button>
          <button class="btn btn-secondary" id="quickMeta">+ Registar Meta</button>
        </div>
      </div>
    </div>`;
  document.getElementById("dashOrders").onclick=()=>go("orders");
  document.getElementById("quickOrder").onclick=()=>go("new-order");
  document.getElementById("quickStock").onclick=()=>go("stock");
  document.getElementById("quickMeta").onclick=()=>go("meta");
}

function ordersMiniHTML(list){
  if(!list.length) return `<div class="empty">Ainda não tens encomendas.</div>`;
  return `<div class="grid">${list.map(o=>`
    <div class="order-card">
      <div class="order-top"><strong>${esc(o.order_ref)}</strong><span class="badge">${esc(o.status)}</span><span class="spacer"></span><span>${fmtEur(o.revenue)}</span></div>
      <div class="muted">${esc(o.order_date)} · ${esc(o.channel)}</div>
    </div>`).join("")}</div>`;
}

function renderStock(target){
  target.innerHTML=`
    ${pageHead("Stock","O que tens fisicamente em casa")}
    <div class="two-col">
      <section class="card">
        <div class="section-head"><h2>Stock atual</h2><div class="spacer"></div><input id="stockSearch" placeholder="Pesquisar produto, tamanho ou código…" style="max-width:330px"></div>
        <div id="stockTable"></div>
      </section>
      <section class="card">
        <h2 style="margin-top:0">+ Adicionar stock</h2>
        <div class="grid">
          <label>Produto<input id="stProduct" placeholder="Ex.: ADIDAS SAMBA"></label>
          <div class="grid grid-2">
            <label>Tamanho<input id="stSize" placeholder="38 / M"></label>
            <label>Quantidade<input id="stQty" type="number" min="1" value="1"></label>
          </div>
          <label>Preço de compra / unidade (€)<input id="stCost" type="number" min="0" step="0.01" value="0"></label>
          <label>Código de barras<input id="stBarcode" placeholder="Podes escrever/ler com scanner"></label>
          <div class="btn-row">
            <button id="genBarcode" class="btn btn-secondary">Gerar código</button>
            <button id="saveStock" class="btn">Guardar stock</button>
          </div>
          <div id="stockMsg" class="notice" hidden></div>
        </div>
      </section>
    </div>`;
  const search=document.getElementById("stockSearch");
  const draw=()=>{
    const q=search.value.trim().toLowerCase();
    const list=state.stock.filter(x=>Number(x.quantity)>0 && (!q || [x.product_name,x.size,x.barcode].join(" ").toLowerCase().includes(q)));
    document.getElementById("stockTable").innerHTML=list.length?`
      <div class="table-wrap"><table><thead><tr><th>Produto</th><th>Tamanho</th><th>Qtd.</th><th>Custo</th><th>Código</th></tr></thead>
      <tbody>${list.map(x=>`<tr><td><strong>${esc(x.product_name)}</strong></td><td>${esc(x.size||"-")}</td><td>${fmtInt(x.quantity)}</td><td>${fmtEur(x.unit_cost)}</td><td class="barcode">${esc(x.barcode||"-")}</td></tr>`).join("")}</tbody></table></div>`
      :`<div class="empty">Nenhum stock encontrado.</div>`;
  };
  search.oninput=draw; draw();
  document.getElementById("genBarcode").onclick=()=>{
    const prefix=state.workspace.slug==="lucky-urban"?"LU":"VE";
    document.getElementById("stBarcode").value=`${prefix}-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  };
  document.getElementById("saveStock").onclick=async()=>{
    const msg=document.getElementById("stockMsg"); hideMsg(msg);
    const product_name=document.getElementById("stProduct").value.trim();
    const size=document.getElementById("stSize").value.trim();
    const quantity=Math.max(1,Number(document.getElementById("stQty").value||1));
    const unit_cost=Math.max(0,Number(document.getElementById("stCost").value||0));
    const barcode=document.getElementById("stBarcode").value.trim()||null;
    if(!product_name) return showMsg(msg,"Escreve o nome do produto.","error");
    const {error}=await supabase.from("stock_items").insert({
      workspace_id:state.workspace.id,product_name,size:size||null,quantity,initial_quantity:quantity,
      unit_cost,origin:"Compra manual",barcode
    });
    if(error) return showMsg(msg,error.message.includes("unique")?"Esse código de barras já existe.":error.message,"error");
    await loadStock(); showMsg(msg,"Stock guardado.","success"); renderStock(target);
  };
}

function itemTemplate(i){
  const stockOptions=state.stock.filter(s=>Number(s.quantity)>0)
    .map(s=>`<option value="${s.id}">${esc(s.product_name)} · ${esc(s.size||"-")} · ${s.quantity} un.</option>`).join("");
  return `<div class="order-item" data-item="${i}">
    <div class="order-item-head"><strong>Produto ${i+1}</strong><span class="spacer"></span></div>
    <div class="grid grid-3">
      <label>Vai usar stock que tens?
        <select data-f="useStock"><option value="yes">SIM — escolher do stock</option><option value="no">NÃO — comprado/sem stock</option></select>
      </label>
      <label>Quantidade<input data-f="qty" type="number" min="1" value="1"></label>
      <label>Preço de venda / unidade (€)<input data-f="sale" type="number" min="0" step="0.01" value="0"></label>
    </div>
    <div class="stock-picker" data-box="stock">
      <label>Escolhe o artigo do teu stock
        <select data-f="stockId"><option value="">— escolher —</option>${stockOptions}</select>
      </label>
    </div>
    <div class="stock-picker" data-box="manual" hidden>
      <div class="grid grid-3">
        <label>Produto<input data-f="product" placeholder="Nome do produto"></label>
        <label>Tamanho<input data-f="size" placeholder="38 / M"></label>
        <label>Quanto te custou / unidade (€)<input data-f="purchase" type="number" min="0" step="0.01" value="0"></label>
      </div>
    </div>
  </div>`;
}

function renderNewOrder(target){
  target.innerHTML=`
    ${pageHead("Nova encomenda","Escolhe quantos produtos e só aparecem esses espaços")}
    <section class="card">
      <div class="grid grid-4">
        <label>Data<input id="ordDate" type="date" value="${today()}"></label>
        <label>Nº encomenda / referência<input id="ordRef" placeholder="#1501 ou nome/referência"></label>
        <label>Canal<select id="ordChannel">${CHANNELS.map(x=>`<option>${x}</option>`).join("")}</select></label>
        <label>Tipo de portes<select id="ordShipping">${state.shipping.map(x=>`<option>${esc(x.shipping_type)}</option>`).join("")}</select></label>
      </div>
      <div class="grid grid-2" style="margin-top:14px">
        <label>Quantos produtos?
          <select id="ordCount">${Array.from({length:10},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join("")}</select>
        </label>
        <label>Estado<select id="ordStatus">${STATUSES.map(x=>`<option>${x}</option>`).join("")}</select></label>
      </div>
      <div class="hr"></div>
      <div id="itemsBox" class="grid"></div>
      <div class="hr"></div>
      <div class="btn-row">
        <button id="saveOrder" class="btn">Guardar encomenda</button>
        <span id="orderTotals" class="muted"></span>
      </div>
      <div id="orderMsg" class="notice" hidden style="margin-top:12px"></div>
    </section>`;
  const itemsBox=document.getElementById("itemsBox");
  const count=document.getElementById("ordCount");
  const drawItems=()=>{
    const n=Number(count.value||1);
    itemsBox.innerHTML=Array.from({length:n},(_,i)=>itemTemplate(i)).join("");
    itemsBox.querySelectorAll("[data-f='useStock']").forEach(sel=>{
      sel.onchange=()=>{
        const item=sel.closest("[data-item]");
        item.querySelector("[data-box='stock']").hidden=sel.value!=="yes";
        item.querySelector("[data-box='manual']").hidden=sel.value==="yes";
        updateOrderTotalPreview();
      };
    });
    itemsBox.querySelectorAll("input,select").forEach(x=>x.addEventListener("input",updateOrderTotalPreview));
    updateOrderTotalPreview();
  };
  count.onchange=drawItems; drawItems();
  document.getElementById("saveOrder").onclick=saveOrder;
}

function readOrderItems(){
  return [...document.querySelectorAll("[data-item]")].map(row=>{
    const useStock=row.querySelector("[data-f='useStock']").value==="yes";
    const qty=Math.max(1,Number(row.querySelector("[data-f='qty']").value||1));
    const sale=Math.max(0,Number(row.querySelector("[data-f='sale']").value||0));
    if(useStock){
      const stockId=row.querySelector("[data-f='stockId']").value;
      const st=state.stock.find(x=>x.id===stockId);
      return {source:"stock",stockId,product_name:st?.product_name||"",size:st?.size||"",qty,sale,purchase:0,stock:st};
    }
    return {
      source:"purchased",stockId:null,product_name:row.querySelector("[data-f='product']").value.trim(),
      size:row.querySelector("[data-f='size']").value.trim(),qty,sale,
      purchase:Math.max(0,Number(row.querySelector("[data-f='purchase']").value||0))
    };
  });
}


function aggregateStockUsage(items){
  const usage = new Map();
  for(const it of items.filter(x=>x.source==="stock" && x.stockId)){
    usage.set(it.stockId,(usage.get(it.stockId)||0)+Number(it.qty||0));
  }
  return usage;
}

function allowedNextStatuses(current){
  if(current==="Cancelado antes envio") return ["Cancelado antes envio","Em trânsito","Entregue"];
  if(current==="Em trânsito") return ["Em trânsito","Entregue","Devolvido"];
  if(current==="Entregue") return ["Entregue","Devolvido"];
  return ["Devolvido"];
}

function updateOrderTotalPreview(){
  const el=document.getElementById("orderTotals"); if(!el) return;
  const items=readOrderItems();
  const sale=items.reduce((a,x)=>a+x.qty*x.sale,0);
  el.textContent=`Total de venda: ${fmtEur(sale)}`;
}

async function getMetaPerOrder(orderDate, channel, includeNew=true){
  if(channel==="Vinted") return 0;
  const metaTotal=state.meta.filter(x=>x.spend_date===orderDate).reduce((a,x)=>a+Number(x.amount||0),0);
  const existing=state.orders.filter(x=>x.order_date===orderDate && x.channel!=="Vinted").length;
  const count=existing+(includeNew?1:0);
  return count?metaTotal/count:0;
}

async function saveOrder(){
  const msg=document.getElementById("orderMsg"); hideMsg(msg);
  const order_date=document.getElementById("ordDate").value;
  const order_ref=document.getElementById("ordRef").value.trim();
  const channel=document.getElementById("ordChannel").value;
  const shipping_type=document.getElementById("ordShipping").value;
  const status=document.getElementById("ordStatus").value;
  const items=readOrderItems();
  if(!order_ref) return showMsg(msg,"Mete o Nº encomenda / referência.","error");
  for(const [i,it] of items.entries()){
    if(!it.product_name) return showMsg(msg,`Falta escolher/escrever o Produto ${i+1}.`,"error");
  }
  const stockUsage=aggregateStockUsage(items);
  for(const [stockId,needed] of stockUsage.entries()){
    const st=state.stock.find(x=>x.id===stockId);
    if(!st || Number(st.quantity)<needed)
      return showMsg(msg,`Não tens stock suficiente de ${st?.product_name||"um dos artigos escolhidos"}. Precisas de ${needed} e tens ${Number(st?.quantity||0)}.`,"error");
  }
  const rate=state.shipping.find(x=>x.shipping_type===shipping_type);
  const shipping_out=status==="Cancelado antes envio"?0:Number(rate?.outbound_cost||0);
  const shipping_return=status==="Devolvido"?Number(rate?.return_cost||0):0;
  const totalSale=items.reduce((a,x)=>a+x.qty*x.sale,0);
  const productCost=items.reduce((a,x)=>a+(x.source==="purchased"?x.qty*x.purchase:0),0);
  const meta_cost=await getMetaPerOrder(order_date,channel,true);
  const revenue=status==="Entregue"?totalSale:0;
  const result=revenue-productCost-shipping_out-shipping_return-meta_cost;

  const {data:order,error}=await supabase.from("orders").insert({
    workspace_id:state.workspace.id,order_ref,order_date,channel,shipping_type,status,
    shipping_out,shipping_return,meta_cost,revenue,result
  }).select().single();
  if(error){
    const friendly=String(error.message||"").toLowerCase().includes("duplicate") || String(error.code||"")==="23505"
      ? "Já existe uma encomenda com esse Nº / referência neste utilizador."
      : error.message;
    return showMsg(msg,friendly,"error");
  }

  const rows=items.map(it=>({
    workspace_id:state.workspace.id,order_id:order.id,product_name:it.product_name,size:it.size||null,
    quantity:it.qty,sale_price:it.sale,source:it.source,purchase_price:it.purchase,stock_item_id:it.stockId
  }));
  const {error:itemErr}=await supabase.from("order_items").insert(rows);
  if(itemErr){
    await supabase.from("orders").delete().eq("id",order.id);
    return showMsg(msg,"Não foi possível guardar os produtos. A encomenda não foi criada: "+itemErr.message,"error");
  }

  if(status==="Em trânsito" || status==="Entregue"){
    for(const [stockId,usedQty] of stockUsage.entries()){
      const st=state.stock.find(x=>x.id===stockId);
      const {error:stockErr}=await supabase.from("stock_items")
        .update({quantity:Number(st.quantity)-usedQty,updated_at:new Date().toISOString()})
        .eq("id",stockId)
        .eq("quantity",st.quantity);
      if(stockErr){
        showMsg(msg,"A encomenda foi criada, mas houve um erro ao atualizar stock. Não cries outra igual; verifica o Stock.","error");
        await loadAll();
        return;
      }
    }
  }
  if(status==="Devolvido"){
    for(const it of items.filter(x=>x.source==="purchased")){
      await supabase.from("stock_items").insert({
        workspace_id:state.workspace.id,product_name:it.product_name,size:it.size||null,quantity:it.qty,initial_quantity:it.qty,
        unit_cost:it.purchase,origin:"Devolução",source_order_id:order.id
      });
    }
  }
  await loadAll();
  await recalcDate(order_date);
  await loadAll();
  showMsg(msg,"Encomenda guardada.","success");
  setTimeout(()=>go("orders"),450);
}

async function recalcDate(date){
  const dayOrders=state.orders.filter(o=>o.order_date===date);
  const metaTotal=state.meta.filter(x=>x.spend_date===date).reduce((a,x)=>a+Number(x.amount||0),0);
  const eligible=dayOrders.filter(o=>o.channel!=="Vinted");
  const per=eligible.length?metaTotal/eligible.length:0;
  for(const o of dayOrders){
    const items=state.orderItems.filter(i=>i.order_id===o.id);
    const cost=items.reduce((a,i)=>a+(i.source==="purchased"?Number(i.quantity)*Number(i.purchase_price):0),0);
    const metaCost=o.channel==="Vinted"?0:per;
    const sale=items.reduce((a,i)=>a+Number(i.quantity)*Number(i.sale_price),0);
    const revenue=o.status==="Entregue"?sale:0;
    const result=revenue-cost-Number(o.shipping_out||0)-Number(o.shipping_return||0)-metaCost;
    await supabase.from("orders").update({meta_cost:metaCost,revenue,result,updated_at:new Date().toISOString()}).eq("id",o.id);
  }
}

function renderOrders(target){
  target.innerHTML=`
    ${pageHead("Encomendas","Atualiza o estado aqui quando o transporte muda")}
    <div class="section-head"><input id="orderSearch" placeholder="Pesquisar nº, produto…" style="max-width:360px"><div class="spacer"></div><button class="btn" id="newOrderTop">+ Nova encomenda</button></div>
    <div id="ordersList" class="grid"></div>`;
  document.getElementById("newOrderTop").onclick=()=>go("new-order");
  const search=document.getElementById("orderSearch");
  const draw=()=>{
    const q=search.value.toLowerCase().trim();
    const list=state.orders.filter(o=>{
      const items=state.orderItems.filter(i=>i.order_id===o.id);
      return !q || [o.order_ref,o.channel,o.status,...items.map(i=>i.product_name)].join(" ").toLowerCase().includes(q);
    });
    document.getElementById("ordersList").innerHTML=list.length?list.map(orderCardHTML).join(""):`<div class="empty card">Ainda não tens encomendas.</div>`;
    document.querySelectorAll("[data-status-order]").forEach(sel=>sel.onchange=()=>changeOrderStatus(sel.dataset.statusOrder,sel.value));
  };
  search.oninput=draw; draw();
}

function orderCardHTML(o){
  const items=state.orderItems.filter(i=>i.order_id===o.id);
  return `<article class="order-card">
    <div class="order-top">
      <strong>${esc(o.order_ref)}</strong><span class="badge">${esc(o.channel)}</span><span class="muted">${esc(o.order_date)}</span><span class="spacer"></span>
      <strong class="${Number(o.result)>=0?"good":"bad"}">${fmtEur(o.result)}</strong>
    </div>
    <div class="order-products">${items.map(i=>`<div>${i.quantity}× <strong>${esc(i.product_name)}</strong> · ${esc(i.size||"-")} · ${fmtEur(i.sale_price)} <span class="muted">(${i.source==="stock"?"stock":"comprado"})</span></div>`).join("")}</div>
    <div class="btn-row">
      <label style="min-width:220px">Estado
        <select data-status-order="${o.id}" ${o.status==="Devolvido"?"disabled":""}>
          ${allowedNextStatuses(o.status).map(s=>`<option ${s===o.status?"selected":""}>${s}</option>`).join("")}
        </select>
      </label>
      <span class="muted">Receita: ${fmtEur(o.revenue)} · Meta: ${fmtEur(o.meta_cost)} · Portes: ${fmtEur(Number(o.shipping_out)+Number(o.shipping_return))}</span>
    </div>
  </article>`;
}

async function changeOrderStatus(orderId,newStatus){
  const o=state.orders.find(x=>x.id===orderId); if(!o||o.status===newStatus) return;
  const old=o.status;
  const allowed=allowedNextStatuses(old);
  if(!allowed.includes(newStatus)){
    alert("Essa mudança de estado não é permitida porque podia deixar o stock incorreto.");
    return renderOrders(document.getElementById("page"));
  }
  if(old==="Devolvido"){
    alert("Uma encomenda devolvida fica fechada para proteger o stock.");
    return renderOrders(document.getElementById("page"));
  }

  const items=state.orderItems.filter(i=>i.order_id===orderId);

  // A encomenda estava cancelada e agora vai realmente sair: retirar stock uma única vez.
  if(old==="Cancelado antes envio" && (newStatus==="Em trânsito"||newStatus==="Entregue")){
    const usage=new Map();
    for(const it of items.filter(i=>i.source==="stock" && i.stock_item_id)){
      usage.set(it.stock_item_id,(usage.get(it.stock_item_id)||0)+Number(it.quantity||0));
    }
    for(const [stockId,needed] of usage.entries()){
      const st=state.stock.find(s=>s.id===stockId);
      if(!st || Number(st.quantity)<needed){
        alert(`Stock insuficiente. Precisas de ${needed} e tens ${Number(st?.quantity||0)}.`);
        return renderOrders(document.getElementById("page"));
      }
    }
    for(const [stockId,needed] of usage.entries()){
      const st=state.stock.find(s=>s.id===stockId);
      const {error}=await supabase.from("stock_items")
        .update({quantity:Number(st.quantity)-needed,updated_at:new Date().toISOString()})
        .eq("id",stockId)
        .eq("quantity",st.quantity);
      if(error){
        alert("Não foi possível atualizar o stock. Tenta novamente.");
        await loadAll();
        return renderShell();
      }
    }
  }

  // Produto regressou fisicamente: devolver ao stock.
  if((old==="Em trânsito"||old==="Entregue") && newStatus==="Devolvido"){
    const returnUsage=new Map();
    for(const it of items.filter(i=>i.source==="stock" && i.stock_item_id)){
      returnUsage.set(it.stock_item_id,(returnUsage.get(it.stock_item_id)||0)+Number(it.quantity||0));
    }
    for(const [stockId,qty] of returnUsage.entries()){
      const st=state.stock.find(s=>s.id===stockId);
      if(st){
        const {error}=await supabase.from("stock_items")
          .update({quantity:Number(st.quantity)+qty,updated_at:new Date().toISOString()})
          .eq("id",stockId)
          .eq("quantity",st.quantity);
        if(error){
          alert("Não foi possível devolver um artigo ao stock. Tenta novamente.");
          await loadAll();
          return renderShell();
        }
      }
    }

    // O que foi comprado especificamente para a encomenda entra agora em stock,
    // mas o custo original já ficou contabilizado na encomenda.
    for(const it of items.filter(i=>i.source==="purchased")){
      const {error}=await supabase.from("stock_items").insert({
        workspace_id:state.workspace.id,product_name:it.product_name,size:it.size,quantity:it.quantity,initial_quantity:it.quantity,
        unit_cost:it.purchase_price,origin:"Devolução",source_order_id:o.id
      });
      if(error){
        alert("Não foi possível registar um produto devolvido no stock. Tenta novamente.");
        await loadAll();
        return renderShell();
      }
    }
  }

  const rate=state.shipping.find(x=>x.shipping_type===o.shipping_type);
  const shipping_out=newStatus==="Cancelado antes envio"?0:Number(rate?.outbound_cost||0);
  const shipping_return=newStatus==="Devolvido"?Number(rate?.return_cost||0):0;
  const {error:updateErr}=await supabase.from("orders")
    .update({status:newStatus,shipping_out,shipping_return,updated_at:new Date().toISOString()})
    .eq("id",orderId);

  if(updateErr){
    alert("Não foi possível atualizar o estado da encomenda.");
    await loadAll();
    return renderShell();
  }

  await loadAll();
  await recalcDate(o.order_date);
  await loadAll();
  renderShell();
}

function renderMeta(target){
  target.innerHTML=`
    ${pageHead("Meta Ads","Regista apenas quanto gastaste em cada dia")}
    <div class="two-col">
      <section class="card">
        <h2 style="margin-top:0">Histórico</h2>
        ${state.meta.length?`<div class="table-wrap"><table><thead><tr><th>Data</th><th>Gasto</th><th>Notas</th></tr></thead><tbody>
          ${state.meta.map(x=>`<tr><td>${esc(x.spend_date)}</td><td>${fmtEur(x.amount)}</td><td>${esc(x.notes||"")}</td></tr>`).join("")}
        </tbody></table></div>`:`<div class="empty">Ainda não registaste Meta Ads.</div>`}
      </section>
      <section class="card">
        <h2 style="margin-top:0">+ Registar gasto</h2>
        <div class="grid">
          <label>Data<input id="metaDate" type="date" value="${today()}"></label>
          <label>Gasto Meta (€)<input id="metaAmount" type="number" min="0" step="0.01"></label>
          <label>Notas<textarea id="metaNotes"></textarea></label>
          <button id="saveMeta" class="btn">Guardar</button>
          <div id="metaMsg" class="notice" hidden></div>
        </div>
      </section>
    </div>`;
  document.getElementById("saveMeta").onclick=async()=>{
    const msg=document.getElementById("metaMsg"); hideMsg(msg);
    const spend_date=document.getElementById("metaDate").value, amount=Number(document.getElementById("metaAmount").value||0);
    if(amount<0) return showMsg(msg,"Valor inválido.","error");
    const {error}=await supabase.from("meta_ads").insert({workspace_id:state.workspace.id,spend_date,amount,notes:document.getElementById("metaNotes").value.trim()||null});
    if(error) return showMsg(msg,error.message,"error");
    await loadAll(); await recalcDate(spend_date); await loadAll(); renderMeta(target);
  };
}

function renderShipping(target){
  target.innerHTML=`
    ${pageHead("Portes","Define uma vez os teus custos de ida e retorno")}
    <section class="card">
      <div class="table-wrap"><table><thead><tr><th>Tipo</th><th>Ida (€)</th><th>Retorno (€)</th><th></th></tr></thead>
      <tbody>${state.shipping.map(x=>`<tr>
        <td><strong>${esc(x.shipping_type)}</strong></td>
        <td><input id="out-${x.id}" type="number" step="0.01" min="0" value="${Number(x.outbound_cost)}"></td>
        <td><input id="ret-${x.id}" type="number" step="0.01" min="0" value="${Number(x.return_cost)}"></td>
        <td><button class="btn btn-secondary" data-save-rate="${x.id}">Guardar</button></td>
      </tr>`).join("")}</tbody></table></div>
    </section>`;
  document.querySelectorAll("[data-save-rate]").forEach(btn=>btn.onclick=async()=>{
    const id=btn.dataset.saveRate;
    await supabase.from("shipping_rates").update({
      outbound_cost:Number(document.getElementById(`out-${id}`).value||0),
      return_cost:Number(document.getElementById(`ret-${id}`).value||0)
    }).eq("id",id);
    await loadShipping(); btn.textContent="Guardado ✓"; setTimeout(()=>btn.textContent="Guardar",900);
  });
}

function renderExpenses(target){
  target.innerHTML=`
    ${pageHead("Despesas","Shopify, apps, embalagens, domínio e outras")}
    <div class="two-col">
      <section class="card">
        <h2 style="margin-top:0">Histórico</h2>
        ${state.expenses.length?`<div class="table-wrap"><table><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>
          ${state.expenses.map(x=>`<tr><td>${esc(x.expense_date)}</td><td>${esc(x.expense_type)}</td><td>${esc(x.description||"")}</td><td>${fmtEur(x.amount)}</td></tr>`).join("")}
        </tbody></table></div>`:`<div class="empty">Sem despesas registadas.</div>`}
      </section>
      <section class="card">
        <h2 style="margin-top:0">+ Nova despesa</h2>
        <div class="grid">
          <label>Data<input id="expDate" type="date" value="${today()}"></label>
          <label>Tipo<select id="expType">${EXPENSE_TYPES.map(x=>`<option>${x}</option>`).join("")}</select></label>
          <label>Descrição<input id="expDesc"></label>
          <label>Valor (€)<input id="expAmount" type="number" step="0.01" min="0"></label>
          <button id="saveExp" class="btn">Guardar despesa</button>
          <div id="expMsg" class="notice" hidden></div>
        </div>
      </section>
    </div>`;
  document.getElementById("saveExp").onclick=async()=>{
    const msg=document.getElementById("expMsg"); hideMsg(msg);
    const amount=Number(document.getElementById("expAmount").value||0);
    const {error}=await supabase.from("expenses").insert({
      workspace_id:state.workspace.id,expense_date:document.getElementById("expDate").value,
      expense_type:document.getElementById("expType").value,description:document.getElementById("expDesc").value.trim()||null,amount
    });
    if(error) return showMsg(msg,error.message,"error");
    await loadExpenses(); renderExpenses(target);
  };
}

supabase.auth.onAuthStateChange((_event,session)=>{ state.session=session; });
init();
