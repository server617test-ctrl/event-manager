const $ = (id) => document.getElementById(id);

let adminToken = localStorage.getItem("adminToken") || "";
let adminName  = localStorage.getItem("adminName") || "";

let wheelNames = [];
let wheelAngle = 0;
let spinning = false;

let activeTickets = [];
let wipeToken = null;
let wipeExpiresAt = 0;

// ---------- Tabs ----------
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.querySelectorAll("section[id^='tab-']").forEach(s => s.classList.add("hidden"));
    $("tab-" + tab).classList.remove("hidden");
  });
});

// ---------- Auth ----------
function isAdmin(){ return !!adminToken; }

function updateAuthUI(){
  $("authBadge").textContent = isAdmin() ? `Editor: ${adminName || "Admin"}` : "Viewer mode";
  $("requestAccessBtn").classList.toggle("hidden", isAdmin());
  $("logoutBtn").classList.toggle("hidden", !isAdmin());
  applyEditLocks();
}

function authHeaders(){
  return adminToken ? { "Authorization": `Bearer ${adminToken}` } : {};
}

$("requestAccessBtn").addEventListener("click", () => {
  $("modalBack").classList.remove("hidden");
  $("loginStatus").textContent = "";
  $("loginPin").value = "";
});

$("closeModalBtn").addEventListener("click", () => $("modalBack").classList.add("hidden"));

$("loginBtn").addEventListener("click", async () => {
  const pin = $("loginPin").value.trim();
  $("loginStatus").textContent = "Checking…";

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");

    adminToken = data.token;
    adminName = data.name || "Admin";

    localStorage.setItem("adminToken", adminToken);
    localStorage.setItem("adminName", adminName);

    $("modalBack").classList.add("hidden");
    $("loginPin").value = "";
    updateAuthUI();
  } catch (e) {
    $("loginStatus").textContent = "❌ " + e.message;
  }
});

$("logoutBtn").addEventListener("click", async () => {
  try{
    await fetch("/api/logout", { method:"POST", headers: authHeaders() });
  }catch{}
  adminToken = "";
  adminName = "";
  localStorage.removeItem("adminToken");
  localStorage.removeItem("adminName");
  updateAuthUI();
});

// ---------- Locks ----------
function applyEditLocks(){
  // Wheel
  $("wheelNameInput").disabled = !isAdmin();
  $("addWheelNameBtn").disabled = !isAdmin();

  // Raffle
  $("raffleNameInput").disabled = !isAdmin();
  $("raffleTicketCount").disabled = !isAdmin();
  $("raffleAddBtn").disabled = !isAdmin();
  $("ticketDrawBtn").disabled = !isAdmin() || activeTickets.length === 0;

  // Dashboard
  ["p","h","b","s"].forEach(x=>{
    $(x+"_name").disabled = !isAdmin();
    $(x+"_note").disabled = !isAdmin();
    $(x+"_add").disabled = !isAdmin();
  });

  // Wipe
  $("beginWipeBtn").disabled = !isAdmin();
}

// ---------- Crypto random ----------
function cryptoInt(maxExclusive) {
  const limit = Math.floor(0xFFFFFFFF / maxExclusive) * maxExclusive;
  while (true) {
    const x = crypto.getRandomValues(new Uint32Array(1))[0];
    if (x < limit) return x % maxExclusive;
  }
}

// ---------- Wheel drawing ----------
const canvas = $("wheelCanvas");
const ctx = canvas.getContext("2d");

function drawWheel(){
  const names = wheelNames.length ? wheelNames : ["(no names)"];
  const n = names.length;
  const cx = canvas.width/2, cy = canvas.height/2;
  const radius = Math.min(cx,cy)-20;

  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.translate(cx,cy);
  ctx.rotate(wheelAngle);

  for(let i=0;i<n;i++){
    const start = i*2*Math.PI/n;
    const end = (i+1)*2*Math.PI/n;
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.arc(0,0,radius,start,end);
    ctx.closePath();
    ctx.fillStyle = i%2===0 ? "rgba(110,168,255,0.30)" : "rgba(255,255,255,0.10)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.stroke();

    ctx.save();
    ctx.rotate((start+end)/2);
    ctx.textAlign="right";
    ctx.fillStyle="rgba(231,238,252,0.95)";
    ctx.font="bold 20px system-ui";
    ctx.fillText(names[i], radius-16, 8);
    ctx.restore();
  }

  ctx.restore();
  // pointer
  ctx.beginPath();
  ctx.moveTo(cx, cy-radius-6);
  ctx.lineTo(cx-14, cy-radius-36);
  ctx.lineTo(cx+14, cy-radius-36);
  ctx.closePath();
  ctx.fillStyle="rgba(255,90,106,0.95)";
  ctx.fill();
}

function renderWheelList(){
  $("wheelNameList").innerHTML = "";
  wheelNames.forEach(name=>{
    const li = document.createElement("li");
    li.innerHTML = `<span>${escapeHtml(name)}</span>
      <button class="btn secondary" ${isAdmin() ? "" : "disabled"}>Remove</button>`;
    li.querySelector("button").addEventListener("click", ()=> {
      if(!isAdmin()) return;
      removeWheelName(name);
    });
    $("wheelNameList").appendChild(li);
  });
}

async function loadWheel(){
  $("wheelStatus").textContent = "Loading…";
  const res = await fetch("/api/wheel");
  const data = await res.json();
  wheelNames = data.names || [];
  $("wheelStatus").textContent = wheelNames.length ? `Names loaded: ${wheelNames.length}` : "No names yet.";
  $("wheelWinner").textContent = "";
  renderWheelList();
  drawWheel();
}

async function addWheelName(){
  const name = $("wheelNameInput").value.trim();
  if(!name) return;
  const res = await fetch("/api/wheel", {
    method:"POST",
    headers:{ "Content-Type":"application/json", ...authHeaders() },
    body: JSON.stringify({ name })
  });
  const data = await res.json();
  if(!res.ok) return $("wheelStatus").textContent = "❌ " + (data.error || "Error");
  $("wheelNameInput").value = "";
  wheelNames = data.names;
  renderWheelList();
  drawWheel();
  $("wheelStatus").textContent = `Names loaded: ${wheelNames.length}`;
}

async function removeWheelName(name){
  const res = await fetch(`/api/wheel?name=${encodeURIComponent(name)}`, {
    method:"DELETE",
    headers: authHeaders()
  });
  const data = await res.json();
  if(!res.ok) return $("wheelStatus").textContent = "❌ " + (data.error || "Error");
  wheelNames = data.names;
  renderWheelList();
  drawWheel();
}

$("refreshWheelBtn").addEventListener("click", loadWheel);
$("addWheelNameBtn").addEventListener("click", ()=> isAdmin() ? addWheelName() : null);

$("spinBtn").addEventListener("click", ()=>{
  if(spinning) return;
  if(!wheelNames.length){
    $("wheelStatus").textContent = "Add at least 1 name first.";
    return;
  }
  const idx = cryptoInt(wheelNames.length);
  const n = wheelNames.length;
  const slice = (2*Math.PI)/n;
  const targetAngle = -Math.PI/2 - (idx+0.5)*slice;

  const current = wheelAngle;
  const final = targetAngle + (6 + cryptoInt(4)) * 2*Math.PI;
  const duration = 2400 + cryptoInt(1000);
  const start = performance.now();
  spinning = true;

  function easeOut(t){ return 1 - Math.pow(1-t,3); }

  function step(now){
    const t = Math.min(1, (now-start)/duration);
    wheelAngle = current + (final-current)*easeOut(t);
    drawWheel();
    if(t<1) requestAnimationFrame(step);
    else { spinning = false; }
  }
  requestAnimationFrame(step);

  $("wheelWinner").textContent = `Winner: ${wheelNames[idx]}`;
});

// ---------- Raffle ----------
async function loadRaffle(){
  $("raffleStatus").textContent = "Loading…";
  const res = await fetch("/api/raffle");
  const data = await res.json();
  activeTickets = data.active || [];
  renderTickets();
}

function renderTickets(){
  $("raffleActiveList").innerHTML = "";
  activeTickets.slice(0, 80).forEach(t=>{
    const li = document.createElement("li");
    li.innerHTML = `<span><b>#${escapeHtml(t.ticketNumber)}</b> — ${escapeHtml(t.name)}</span><span class="badge">ACTIVE</span>`;
    $("raffleActiveList").appendChild(li);
  });
  $("raffleStatus").textContent = activeTickets.length ? `Active tickets: ${activeTickets.length}` : "No active tickets yet.";
  applyEditLocks();
}

$("refreshRaffleBtn").addEventListener("click", loadRaffle);

$("raffleAddBtn").addEventListener("click", async ()=>{
  if(!isAdmin()) return;
  const name = $("raffleNameInput").value.trim();
  const count = parseInt($("raffleTicketCount").value, 10);
  if(!name || !count || count<1) return $("raffleStatus").textContent = "Enter name + ticket count.";
  $("raffleStatus").textContent = "Adding…";

  const res = await fetch("/api/raffle", {
    method:"POST",
    headers:{ "Content-Type":"application/json", ...authHeaders() },
    body: JSON.stringify({ name, count })
  });
  const data = await res.json();
  if(!res.ok) return $("raffleStatus").textContent = "❌ " + (data.error || "Error");
  activeTickets = data.active || [];
  $("raffleNameInput").value = "";
  $("raffleTicketCount").value = "";
  renderTickets();
});

$("ticketDrawBtn").addEventListener("click", async ()=>{
  if(!isAdmin()) return;
  if(!activeTickets.length) return;

  const res = await fetch("/api/raffle", { method:"PUT", headers: authHeaders() });
  const data = await res.json();
  if(!res.ok) return $("raffleStatus").textContent = "❌ " + (data.error || "Error");

  $("ticketTop").textContent = "WINNING TICKET";
  $("ticketWinner").textContent = data.winner.name;
  $("ticketMeta").textContent = `Ticket #${data.winner.ticketNumber}`;

  activeTickets = data.active || [];
  renderTickets();
});

// ---------- Dashboard ----------
const map = {
  Participants: { list:"p_list", name:"p_name", note:"p_note", add:"p_add" },
  Hosts:        { list:"h_list", name:"h_name", note:"h_note", add:"h_add" },
  Businesses:   { list:"b_list", name:"b_name", note:"b_note", add:"b_add" },
  Staff:        { list:"s_list", name:"s_name", note:"s_note", add:"s_add" },
};

function renderDashboard(d){
  for(const cat of Object.keys(map)){
    const ul = $(map[cat].list);
    ul.innerHTML = "";
    (d[cat] || []).forEach(item=>{
      const li = document.createElement("li");
      li.innerHTML = `<span><b>${escapeHtml(item.name)}</b> <span class="small">${item.note ? "— "+escapeHtml(item.note) : ""}</span></span>
        <button class="btn secondary" ${isAdmin() ? "" : "disabled"}>Remove</button>`;
      li.querySelector("button").addEventListener("click", ()=> isAdmin() ? removeDash(cat, item.name) : null);
      ul.appendChild(li);
    });
  }
  applyEditLocks();
}

async function loadDashboard(){
  $("dashStatus").textContent = "Loading…";
  const res = await fetch("/api/dashboard");
  const data = await res.json();
  if(!res.ok) return $("dashStatus").textContent = "❌ " + (data.error || "Error");
  renderDashboard(data.dashboard || {});
  $("dashStatus").textContent = "Dashboard loaded.";
}

async function addDash(cat){
  const name = $(map[cat].name).value.trim();
  const note = $(map[cat].note).value.trim();
  if(!name) return;

  const res = await fetch("/api/dashboard", {
    method:"POST",
    headers:{ "Content-Type":"application/json", ...authHeaders() },
    body: JSON.stringify({ category: cat, name, note })
  });
  const data = await res.json();
  if(!res.ok) return $("dashStatus").textContent = "❌ " + (data.error || "Error");
  $(map[cat].name).value = "";
  $(map[cat].note).value = "";
  renderDashboard(data.dashboard);
  $("dashStatus").textContent = `Added "${name}" to ${cat}.`;
}

async function removeDash(cat, name){
  const res = await fetch(`/api/dashboard?category=${encodeURIComponent(cat)}&name=${encodeURIComponent(name)}`, {
    method:"DELETE",
    headers: authHeaders()
  });
  const data = await res.json();
  if(!res.ok) return $("dashStatus").textContent = "❌ " + (data.error || "Error");
  renderDashboard(data.dashboard);
  $("dashStatus").textContent = `Removed "${name}" from ${cat}.`;
}

$("dashRefresh").addEventListener("click", loadDashboard);
Object.keys(map).forEach(cat => {
  $(map[cat].add).addEventListener("click", ()=> isAdmin() ? addDash(cat) : null);
});

// ---------- Wipe ----------
$("beginWipeBtn").addEventListener("click", async ()=>{
  if(!isAdmin()) return;
  $("adminStatus").textContent = "Arming wipe…";
  const res = await fetch("/api/wipe-begin", { method:"POST", headers: authHeaders() });
  const data = await res.json();
  if(!res.ok) return $("adminStatus").textContent = "❌ " + (data.error || "Error");

  wipeToken = data.token;
  wipeExpiresAt = Date.now() + data.expiresInSec * 1000;
  $("wipeConfirmBox").classList.remove("hidden");
  $("wipeInfo").textContent = `Type exactly: "${data.phrase}" (expires ${data.expiresInSec}s)`;
  $("wipePhraseInput").value = "";
  $("adminStatus").textContent = "Wipe armed.";
});

$("confirmWipeBtn").addEventListener("click", async ()=>{
  if(!isAdmin()) return;
  if(!wipeToken || Date.now() > wipeExpiresAt){
    $("adminStatus").textContent = "Wipe token expired. Begin again.";
    $("wipeConfirmBox").classList.add("hidden");
    wipeToken = null;
    return;
  }
  const phrase = $("wipePhraseInput").value.trim();
  $("adminStatus").textContent = "Wiping…";
  const res = await fetch("/api/wipe-confirm", {
    method:"POST",
    headers:{ "Content-Type":"application/json", ...authHeaders() },
    body: JSON.stringify({ token: wipeToken, phrase })
  });
  const data = await res.json();
  if(!res.ok) return $("adminStatus").textContent = "❌ " + (data.error || "Error");

  $("adminStatus").textContent = "✅ Wiped.";
  $("wipeConfirmBox").classList.add("hidden");
  wipeToken = null;

  await loadWheel();
  await loadRaffle();
  await loadDashboard();
});

// ---------- Helpers ----------
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

// ---------- Boot ----------
(async function init(){
  updateAuthUI();
  drawWheel();
  await loadWheel();
  await loadRaffle();
  await loadDashboard();
})();
