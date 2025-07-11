
// ==================== Firebase Config ====================
const firebaseConfig = {
  apiKey: "AIzaSyAtSVJILdFOyfJgorHB1jjBCq7LC_XeNF4",
  authDomain: "otpro-86f2e.firebaseapp.com",
  databaseURL: "https://otpro-86f2e-default-rtdb.firebaseio.com",
  projectId: "otpro-86f2e",
  storageBucket: "otpro-86f2e.appspot.com",
  messagingSenderId: "39918992594",
  appId: "1:39918992594:web:d414a30438c3b37d2e810b",
  measurementId: "G-EWKPHP18J7"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
const storage = firebase.storage();
const messaging = firebase.messaging(); // Push

// ==================== Globals ====================
let otList = [];
let editKey = null;
let perfilUsuario = { rol: "operador" };
let charts = {};

// ==================== Auth ====================
auth.onAuthStateChanged(user=>{
  const loginBtn = document.getElementById("loginBtn");
  const userName = document.getElementById("userName");
  if(user){
    loginBtn.style.display="none";
    userName.textContent = `👋 ${user.displayName}`;
    cargarPerfil(user.email);
    renderFromRealtime();
    solicitarPermisoPush();
  }else{
    loginBtn.style.display="block";
    userName.textContent="";
  }
});
document.getElementById("loginBtn").addEventListener("click",()=>{
  const prov = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(prov).catch(e=>showToast("Error login"));
});
function cargarPerfil(email){
  const safe = email.replace(/\./g,"%2E");
  db.ref("usuarios/"+safe).once("value",s=>{
    perfilUsuario = s.val()||{rol:"operador"};
    showToast("Rol: "+perfilUsuario.rol);
    if(perfilUsuario.rol!=="admin" && perfilUsuario.rol!=="supervisor"){
      document.getElementById("exportarZipBtn").style.display="none";
    }
  });
}

// ==================== Push Notifications ====================
function solicitarPermisoPush(){
  messaging.requestPermission().then(()=>{
    messaging.getToken({ vapidKey: "YOUR_PUBLIC_VAPID_KEY" }).then(token=>{
      console.log("Push token:", token);
    });
  }).catch(err=>console.log("Sin permiso push",err));
}

// ==================== UI Navegación ====================
const secciones = ["seccionFormulario","seccionDashboard","seccionHistorial","seccionKanban","seccionCalendario"];
function mostrarSeccion(id){
  secciones.forEach(s=>{
    const el = document.getElementById(s);
    if(el) el.style.display = s===id?"block":"none";
  });
}
document.getElementById("navDashboard").onclick=()=>mostrarSeccion("seccionDashboard");
document.getElementById("navHistorial").onclick=()=>mostrarSeccion("seccionHistorial");
document.getElementById("navNuevaOT").onclick=()=>mostrarSeccion("seccionFormulario");
document.getElementById("navCalendario").onclick=()=>{mostrarSeccion("seccionCalendario");renderCalendar();};

// Dark mode
document.getElementById("toggleMode").onclick=()=>{
  document.body.classList.toggle("dark");
  document.getElementById("toggleMode").textContent=document.body.classList.contains("dark")?'☀️ Modo claro':'🌙 Modo oscuro';
};

// Toast
function showToast(msg="Acción realizada"){
  const t=document.getElementById("toast");
  t.textContent=msg; t.classList.remove("hidden"); t.classList.add("show");
  setTimeout(()=>{t.classList.remove("show");t.classList.add("hidden");},3000);
}

async function obtenerNumeroCorrelativo() {
  const ref = db.ref("contadorOT");
  const snap = await ref.once("value");
  const actual = snap.val() || 0;
  await ref.set(actual + 1);
  return actual + 1;
}



// ==================== Formulario OT ====================
document.getElementById("otForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!auth.currentUser) return showToast("Debes iniciar sesión");

  const data = new FormData(e.target);
  const files = Array.from(e.target.evidencia.files).slice(0, 5);

    const numeroOT = await obtenerNumeroCorrelativo();


  const ot = {
    // 🗓️ Datos generales
      numeroOT: numeroOT,
    fecha: data.get("fecha"),
    area: data.get("area"),
    equipo: data.get("equipo"),

    // 🕒 Tiempos
    horaFalla: data.get("horaFalla"),
    horaNotificacion: data.get("horaNotificacion"),
    horaInicioReparacion: data.get("horaInicioReparacion"),
    horaFinReparacion: data.get("horaFinReparacion"),
    tiempototal: data.get("tiempototal"),

    // 🔧 Información técnica
    descripcionFallaTecnica: data.get("descripcionFallaTecnica"),
    solucionTecnica: data.get("solucionTecnica"),

    // ⚙️ Configuración OT
    tipo: data.get("tipo"),
    prioridad: data.get("prioridad"),
    categoriaFalla: data.get("categoriaFalla"),


    // 🧼 Limpieza y sanitización
    zonaContacto: data.get("zonaContacto"),
    actividadLimpieza: data.get("actividadLimpieza"),
    horaInicioLimpieza: data.get("horaInicioLimpieza"),
    horaFinLimpieza: data.get("horaFinLimpieza"),
    personaLimpieza: data.get("personaLimpieza"),
    inspeccionVisual: data.get("inspeccionVisual"),

    // 🧪 Validación de higiene
    tipoLimpieza: data.get("tipoLimpieza"),
    resultadoATP: data.get("resultadoATP"),

    // 📁 Información adicional
    libre: data.get("libre"),
    zonas: data.get("zonas"),
    estado: data.get("estado"),

    // ✍️ Firmas
    firmaTecnico: data.get("firmaTecnico"),
    firmaOperador: data.get("firmaOperador"),
    firmaSupervisor: data.get("firmaSupervisor"),

    // 🔐 Sistema
    usuario: auth.currentUser.email,
    timestamp: Date.now()
  };

  const ref = editKey ? db.ref("ordenes/" + editKey) : db.ref("ordenes").push();
  const key = ref.key;

  // 📷 Subir imágenes
  if (files.length) {
    ot.evidencias = [];
    for (let i = 0; i < files.length; i++) {
      const snap = await storage.ref("evidencias/" + key + "_" + i).put(files[i]);
      const url = await snap.ref.getDownloadURL();
      ot.evidencias.push(url);
    }
  }

  await ref.set(ot);
  showToast(editKey ? "OT actualizada" : "OT registrada");
  editKey = null;
  e.target.reset();
  renderFromRealtime();
});



// ==================== Renderizar datos ====================
function renderFromRealtime(){
  db.ref("ordenes").once("value",snap=>{
    otList=[]; snap.forEach(c=>{const o=c.val();o._id=c.key;otList.push(o);});
    aplicarFiltros(); updateKPI(); renderKanban(); renderGraficos(); renderCalendar();
  });
}

// Tabla y filtros
["filtroEstado","filtroArea","filtroFecha"].forEach(id=>{
  document.getElementById(id).addEventListener(id==="filtroArea"?"input":"change", aplicarFiltros);
});
function aplicarFiltros(){
  const est=document.getElementById("filtroEstado").value;
  const area=document.getElementById("filtroArea").value.toLowerCase().trim();
  const fec=document.getElementById("filtroFecha").value;
  const filt=otList.filter(o=>(!est||o.estado===est)&&(!area||o.area.toLowerCase().includes(area))&&(!fec||o.fecha===fec));
  renderTable(filt);
}
function renderTable(lista=otList){
  const tb=document.querySelector("#otTable tbody"); tb.innerHTML="";
  lista.forEach(o=>{
    const tr=document.createElement("tr");
    tr.innerHTML = `
      <td>${o.numeroOT || "—"}</td><td>${o.fecha}</td><td>${o.area}</td><td>${o.equipo}</td><td>${o.estado}</td>
  <td>${o.prioridad}</td><td>${o.tipo}</td><td>${o.tiempototal || "N/A"}</td>
  <td>
    <button class="qr-btn" data-equipo="${o.equipo}">🔗</button>
    <button class="edit-btn" data-key="${o._id}">✏️</button>
    <button class="delete-btn" data-key="${o._id}">🗑️</button>
  </td>`;
    tb.appendChild(tr);
  });
  document.querySelectorAll(".edit-btn").forEach(b=>b.onclick=()=>editOT(b.dataset.key));
  document.querySelectorAll(".delete-btn").forEach(b=>b.onclick=()=>delOT(b.dataset.key));
  document.querySelectorAll(".qr-btn").forEach(b=>b.onclick=()=>showQR(b.dataset.equipo));
}
function editOT(id){
  const o = otList.find(x => x._id === id);
  editKey = id;
  mostrarSeccion("seccionFormulario");
  const f = document.getElementById("otForm");

  // Rellenar todos los campos que coincidan con name=""
  for (const k in o) {
    if (f[k]) f[k].value = o[k];
  }

  // Mostrar bloque sanitización si aplica
  if (o.zonaContacto === "Sí") {
    document.getElementById("bloqueSanitizacion").classList.remove("hidden");
  } else {
    document.getElementById("bloqueSanitizacion").classList.add("hidden");
  }
}
function delOT(id){ if(confirm("Eliminar?")) db.ref("ordenes/"+id).remove().then(()=>renderFromRealtime()); }

// KPI
function updateKPI(){
  const s=id=>document.getElementById(id);
  s("totalOt").textContent=otList.length;
  s("openOt").textContent=otList.filter(o=>o.estado==="Abierta").length;
  s("progressOt").textContent=otList.filter(o=>o.estado==="En progreso").length;
  s("closedOt").textContent=otList.filter(o=>o.estado==="Cerrada").length;
  s("lateOt").textContent=otList.filter(o=>new Date(o.finrep)<new Date()&&o.estado!=="Cerrada").length;
}

// Kanban
function renderKanban(){
  const cols={Abierta:"#colAbierta","En progreso":"#colProgreso",Cerrada:"#colCerrada"};
  Object.values(cols).forEach(sel=>document.querySelector(sel+" .kanban-list").innerHTML="");
  otList.forEach(o=>{
    const div=document.createElement("div");div.className="kanban-card";div.draggable=true;div.dataset.id=o._id;
    if(new Date(o.finrep)<new Date()&&o.estado!=="Cerrada") div.classList.add("kanban-alert");
    div.innerHTML=`<strong>${o.equipo}</strong><br>${o.area}<br><em>${o.falla}</em>`;
    document.querySelector(cols[o.estado]+" .kanban-list").appendChild(div);
  });
}

// Graficos
function crearChart(id,config){ if(charts[id]) charts[id].destroy(); charts[id]=new Chart(document.getElementById(id),config); }
function renderGraficos(){
  const est={},area={},dia={},tipo={},prior={},tipoMin={},cTipo={};
  otList.forEach(o=>{
    est[o.estado]=(est[o.estado]||0)+1;
    area[o.area]=(area[o.area]||0)+1;
    dia[o.fecha]=(dia[o.fecha]||0)+1;
    tipo[o.tipo]=(tipo[o.tipo]||0)+1;
    prior[o.prioridad]=(prior[o.prioridad]||0)+1;
    const t=parseInt(o.tiempototal);if(!isNaN(t)){tipoMin[o.tipo]=(tipoMin[o.tipo]||0)+t;cTipo[o.tipo]=(cTipo[o.tipo]||0)+1;}
  });

  const cat={};
otList.forEach(o=>{ cat[o.categoriaFalla]=(cat[o.categoriaFalla]||0)+1; });

crearChart("chartCategoriaFalla",{
  type:"bar",
  data:{labels:Object.keys(cat),datasets:[{data:Object.values(cat),label:"OT por Categoría"}]},
  options:{responsive:true,maintainAspectRatio:false}
});

  crearChart("chartEstado",{type:"bar",data:{labels:Object.keys(est),datasets:[{data:Object.values(est),label:"OT por Estado",backgroundColor:"#00b4d8"}]},options:{responsive:true,maintainAspectRatio:false}});
  crearChart("chartArea",{type:"doughnut",data:{labels:Object.keys(area),datasets:[{data:Object.values(area)}]},options:{responsive:true,maintainAspectRatio:false}});
  const dias=Object.keys(dia).sort();
  crearChart("chartLinea",{type:"line",data:{labels:dias,datasets:[{data:dias.map(d=>dia[d]),fill:true,label:"OT x día",tension:0.3}]},options:{responsive:true,maintainAspectRatio:false}});
  crearChart("chartTipoOT",{type:"bar",data:{labels:Object.keys(tipo),datasets:[{data:Object.values(tipo)}]},options:{responsive:true,maintainAspectRatio:false}});
  crearChart("chartPrioridad",{type:"pie",data:{labels:Object.keys(prior),datasets:[{data:Object.values(prior)}]},options:{responsive:true,maintainAspectRatio:false}});
  crearChart("chartPromedioTiempo",{type:"bar",data:{labels:Object.keys(tipo),datasets:[{data:Object.keys(tipo).map(k=>Math.round((tipoMin[k]||0)/(cTipo[k]||1)))}]},options:{responsive:true,maintainAspectRatio:false}});
}

// Calendario
let calendarObj=null;
function renderCalendar(){
  const div=document.getElementById("calendar");
  if(!div) return;
  if(calendarObj){calendarObj.destroy();}
  calendarObj = new FullCalendar.Calendar(div,{initialView:"dayGridMonth",
    events:otList.map(o=>({title:o.equipo+" - "+o.tipo,start:o.fecha,backgroundColor:o.estado==="Cerrada"?"#2a9d8f":"#e63946"}))
  });
  calendarObj.render();
}

// QR
function showQR(equipo){
  const modal=document.getElementById("qrModal");
  modal.classList.remove("hidden");
  const qr=new QRious({element:document.getElementById("qrCanvas"),size:180,value:location.origin+location.pathname+"?equipo="+encodeURIComponent(equipo)});
  document.getElementById("closeQr").onclick=()=>modal.classList.add("hidden");
}

// Init
window.addEventListener("load",()=>{mostrarSeccion("seccionDashboard");});
