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
// Para edición: guardar URLs de evidencias existentes
let existingEvidenciasAntes   = [];
let existingEvidenciasDespues = [];


// ==================== Select refs formulario OT (GLOBAL) ====================
const selectArea            = document.getElementById("selectArea");
const selectEquipo          = document.getElementById("selectEquipo");
const selectFirmaTecnico    = document.getElementById("selectFirmaTecnico");
const selectFirmaOperador   = document.getElementById("selectFirmaOperador");
const selectFirmaSupervisor = document.getElementById("selectFirmaSupervisor");
const selectInspeccionVisual = document.getElementById("inspeccionVisual");
const evidenciaAntesInput   = document.getElementById("evidenciaAntes");
const evidenciaDespuesInput = document.getElementById("evidenciaDespues");
const previewAntes          = document.getElementById("previewAntes");
const previewDespues        = document.getElementById("previewDespues");

// ==================== Auth ====================
auth.onAuthStateChanged(user => {
  const loginBtn = document.getElementById("loginBtn");
  const userName = document.getElementById("userName");

  if (user) {
    loginBtn.style.display = "none";
    userName.textContent = `👋 ${user.displayName}`;

    cargarPerfil(user.email);
    renderFromRealtime();
    solicitarPermisoPush();

    // Inicializar selects OT al entrar
    cargarSelectAreasOT();
    cargarSelectUsuarios("tecnico", selectFirmaTecnico);
    cargarSelectUsuarios("supervisor", selectFirmaSupervisor);
    cargarSelectUsuarios("inspector", selectInspeccionVisual);

  } else {
    loginBtn.style.display = "block";
    userName.textContent = "";
  }
});

document.getElementById("loginBtn").addEventListener("click", () => {
  const prov = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(prov).catch(() => showToast("Error login"));
});

function cargarPerfil(email) {
  const safe = email.replace(/\./g, "%2E");
  db.ref(`usuarios/${safe}`).once("value", snap => {
    perfilUsuario = snap.val() || { rol: "operador" };
    showToast(`Rol: ${perfilUsuario.rol}`);
    if (!["admin","supervisor"].includes(perfilUsuario.rol)) {
      document.getElementById("exportarZipBtn").style.display = "none";
    }
  });
}

function solicitarPermisoPush(){
  messaging.requestPermission()
    .then(() => messaging.getToken({ vapidKey: "YOUR_PUBLIC_VAPID_KEY" }))
    .then(token => console.log("Push token:", token))
    .catch(err => console.log("Sin permiso push", err));
}
// ==================== UI Navegación ====================-------------------------------------------------------------------
const secciones = [
  "seccionFormulario","seccionDashboard","seccionHistorial",
  "seccionKanban","seccionCalendario","seccionConfiguracion"
];
function mostrarSeccion(id){
  secciones.forEach(s=>{
    const el = document.getElementById(s);
    if(el) el.style.display = s===id ? "block":"none";
  });
}
document.getElementById("navNuevaOT").addEventListener("click", () => {
  mostrarSeccion("seccionFormulario");
  
  // Recarga listas
  cargarSelectAreasOT();
  cargarSelectUsuarios("tecnico",   selectFirmaTecnico);
  cargarSelectUsuarios("supervisor", selectFirmaSupervisor);
  cargarSelectUsuarios("inspector", selectInspeccionVisual);


  // Limpia dependientes
  selectEquipo.innerHTML        = '<option value="">Seleccione Equipo</option>';
  selectFirmaOperador.innerHTML = '<option value="">Seleccione Operador</option>';
});
document.getElementById("navDashboard").onclick  = () => mostrarSeccion("seccionDashboard");
document.getElementById("navHistorial").onclick  = () => {
  mostrarSeccion("seccionHistorial");
  document.getElementById("filtroEstado").value = "Abierta";
  aplicarFiltros();
};
document.getElementById("navCalendario").onclick = () => {
  mostrarSeccion("seccionCalendario");
  renderCalendar();
};
document.getElementById("navConfiguracion").onclick = () =>
  mostrarSeccion("seccionConfiguracion");

// Dark mode
document.getElementById("toggleMode").onclick = () => {
  document.body.classList.toggle("dark");
  document.getElementById("toggleMode").textContent =
    document.body.classList.contains("dark") ? '☀️ Modo claro' : '🌙 Modo oscuro';
};

// Toast
function showToast(msg="Acción realizada"){
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.remove("hidden"); t.classList.add("show");
  setTimeout(()=>{t.classList.remove("show");t.classList.add("hidden");},3000);
}

// Correlativo OT
async function obtenerNumeroCorrelativo() {
  const ref = db.ref("contadorOT");
  const snap = await ref.once("value");
  const actual = snap.val() || 0;
  await ref.set(actual + 1);
  return actual + 1;
}

// Al cambiar área en OT
selectArea.addEventListener("change", e => {
  const areaId = e.target.value;
  cargarSelectEquipos(areaId);
  cargarSelectUsuarios("operador", selectFirmaOperador, areaId);
});
// ==== Pestañas de Configuración ====
const tabAreas    = document.getElementById("tabAreas");
const tabEquipos  = document.getElementById("tabEquipos");
const tabUsuarios = document.getElementById("tabUsuarios");

tabAreas.addEventListener("click",   () => switchConfigTab("Areas"));
tabEquipos.addEventListener("click", () => switchConfigTab("Equipos"));
tabUsuarios.addEventListener("click",() => switchConfigTab("Usuarios"));

function switchConfigTab(section) {
  document.querySelectorAll(".config-section").forEach(div => div.classList.add("hidden"));
  document.getElementById("section" + section).classList.remove("hidden");
  if (section === "Areas")    cargarAreas();
  if (section === "Equipos")  cargarEquipos();
  if (section === "Usuarios") cargarUsuarios();
}

// ==== CRUD Áreas ====
const formArea      = document.getElementById("formArea");
const inputAreaName = document.getElementById("areaName");
const btnCancelArea = document.getElementById("btnCancelArea");
const tableAreas    = document.querySelector("#tableAreas tbody");
let editAreaKey     = null;

function cargarAreas() {
  db.ref("master/areas").off();
  tableAreas.innerHTML = "";
  db.ref("master/areas").on("value", snap => {
    tableAreas.innerHTML = "";
    snap.forEach(child => {
      const key = child.key;
      const name = child.val().name;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${name}</td>
        <td>
          <button class="editArea" data-key="${key}">✏️</button>
          <button class="delArea"  data-key="${key}">🗑️</button>
        </td>`;
      tableAreas.appendChild(tr);
    });
    document.querySelectorAll(".editArea")
      .forEach(b => b.onclick = e => iniciarEdicionArea(e.target.dataset.key));
    document.querySelectorAll(".delArea")
      .forEach(b => b.onclick = e => borrarArea(e.target.dataset.key));
  });
}

formArea.addEventListener("submit", async e => {
  e.preventDefault();
  const name = inputAreaName.value.trim();
  if (!name) return;
  if (editAreaKey) {
    await db.ref(`master/areas/${editAreaKey}`).update({ name });
    editAreaKey = null;
    btnCancelArea.classList.add("hidden");
  } else {
    await db.ref("master/areas").push({ name });
  }
  formArea.reset();
  showToast("Área guardada");
});

function iniciarEdicionArea(key) {
  db.ref(`master/areas/${key}`).once("value", snap => {
    inputAreaName.value = snap.val().name;
    editAreaKey = key;
    btnCancelArea.classList.remove("hidden");
  });
}

btnCancelArea.addEventListener("click", () => {
  editAreaKey = null;
  formArea.reset();
  btnCancelArea.classList.add("hidden");
});

async function borrarArea(key) {
  if (confirm("¿Eliminar esta Área?")) {
    await db.ref(`master/areas/${key}`).remove();
    showToast("Área eliminada");
  }
}

// Al cargar la app, iniciar pestaña Áreas
window.addEventListener("load", () => tabAreas.click());
// ==== CRUD Equipos ====
const formEquipo        = document.getElementById("formEquipo");
const inputEquipoName   = document.getElementById("equipoName");
const selectEquipoArea  = document.getElementById("equipoArea");
const btnCancelEquipo   = document.getElementById("btnCancelEquipo");
const tableEquiposBody  = document.querySelector("#tableEquipos tbody");
let editEquipoKey       = null;

// ==== Cargar Select de Áreas en Formulario OT ====
async function cargarSelectAreasOT() {
  selectArea.innerHTML = '<option value="">Seleccione Área</option>';
  const snap = await db.ref("master/areas").once("value");
  snap.forEach(child => {
    const opt = document.createElement("option");
    opt.value = child.key;               // ✅ ID único
    opt.textContent = child.val().name;  // ✅ Nombre del área
    selectArea.appendChild(opt);
  });
}
// ==== Cargar equipos en el formulario OT según área seleccionada ====
async function cargarSelectEquipos(areaId) {
  selectEquipo.innerHTML = '<option value="">Seleccione Equipo</option>';
  if (!areaId) return;

  const snap = await db.ref("master/equipos")
    .orderByChild("areaId")
    .equalTo(areaId)
    .once("value");

  snap.forEach(child => {
    const opt = document.createElement("option");
    opt.value = child.key;
    opt.textContent = child.val().name;
    selectEquipo.appendChild(opt);
  });
}
// ==== Cargar usuarios por rol (y por área si operador) ====
async function cargarSelectUsuarios(role, selectEl, areaId = null) {
  const snap = await db.ref("master/usuarios")
    .orderByChild("role")
    .equalTo(role)
    .once("value");

  selectEl.innerHTML = `<option value="">Seleccione ${role}</option>`;
  snap.forEach(child => {
    const u = child.val();
    if (role === "operador" && areaId && u.areaId !== areaId) return;
    const opt = document.createElement("option");
    opt.value = child.key;
    opt.textContent = u.name;
    selectEl.appendChild(opt);
  });
}

async function cargarEquipos() {
  const areasSnap = await db.ref("master/areas").once("value");
  const areas = {};
  selectEquipoArea.innerHTML = "";
  areasSnap.forEach(child => {
    areas[child.key] = child.val().name;
    const opt = document.createElement("option");
    opt.value = child.key;
    opt.textContent = child.val().name;
    selectEquipoArea.appendChild(opt);
  });
  tableEquiposBody.innerHTML = "";
  db.ref("master/equipos").off();
  db.ref("master/equipos").on("value", snap => {
    tableEquiposBody.innerHTML = "";
    snap.forEach(child => {
      const key = child.key;
      const { name, areaId } = child.val();
      const areaName = areas[areaId] || "–";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${name}</td>
        <td>${areaName}</td>
        <td>
          <button class="editEquipo" data-key="${key}">✏️</button>
          <button class="delEquipo"  data-key="${key}">🗑️</button>
        </td>`;
      tableEquiposBody.appendChild(tr);
    });
    document.querySelectorAll(".editEquipo")
      .forEach(b => b.onclick = e => iniciarEdicionEquipo(e.target.dataset.key));
    document.querySelectorAll(".delEquipo")
      .forEach(b => b.onclick = e => borrarEquipo(e.target.dataset.key));
  });
}

;(function(){
  if (formEquipo._submitRegistered) return;
  formEquipo._submitRegistered = true;
  formEquipo.addEventListener("submit", async e => {
    e.preventDefault();
    const name   = inputEquipoName.value.trim();
    const areaId = selectEquipoArea.value;
    if (!name || !areaId) return;
    if (editEquipoKey) {
      await db.ref(`master/equipos/${editEquipoKey}`).update({ name, areaId });
      editEquipoKey = null;
      btnCancelEquipo.classList.add("hidden");
    } else {
      await db.ref("master/equipos").push({ name, areaId });
    }
    formEquipo.reset();
    showToast("Equipo guardado");
    cargarEquipos();
  });
})();

function iniciarEdicionEquipo(key) {
  db.ref(`master/equipos/${key}`).once("value", snap => {
    inputEquipoName.value  = snap.val().name;
    selectEquipoArea.value = snap.val().areaId;
    editEquipoKey = key;
    btnCancelEquipo.classList.remove("hidden");
  });
}

btnCancelEquipo.addEventListener("click", () => {
  editEquipoKey = null;
  formEquipo.reset();
  btnCancelEquipo.classList.add("hidden");
});

async function borrarEquipo(key) {
  if (confirm("¿Eliminar este Equipo?")) {
    await db.ref(`master/equipos/${key}`).remove();
    showToast("Equipo eliminado");
    cargarEquipos();
  }
}

// ==== CRUD Usuarios ====
const formUsuario        = document.getElementById("formUsuario");
const inputUsuarioName   = document.getElementById("usuarioName");
const selectUsuarioRole  = document.getElementById("usuarioRole");
const divAreaUsuario     = document.getElementById("areaSelectorUsuario");
const selectUsuarioArea  = document.getElementById("usuarioArea");
const btnCancelUsuario   = document.getElementById("btnCancelUsuario");
const tableUsuariosBody  = document.querySelector("#tableUsuarios tbody");
let editUsuarioKey       = null;

selectUsuarioRole.addEventListener("change", () => {
  if (selectUsuarioRole.value === "operador") {
    divAreaUsuario.classList.remove("hidden");
    cargarAreasEnUsuario();
  } else {
    divAreaUsuario.classList.add("hidden");
    selectUsuarioArea.innerHTML = "";
  }
});

async function cargarAreasEnUsuario() {
  const snap = await db.ref("master/areas").once("value");
  selectUsuarioArea.innerHTML = '<option value="">Seleccione área</option>';
  snap.forEach(child => {
    const opt = document.createElement("option");
    opt.value = child.key;
    opt.textContent = child.val().name;
    selectUsuarioArea.appendChild(opt);
  });
}

function cargarUsuarios() {
  tableUsuariosBody.innerHTML = "";
  db.ref("master/usuarios").off();
  db.ref("master/usuarios").on("value", snap => {
    tableUsuariosBody.innerHTML = "";
    snap.forEach(child => {
      const key  = child.key;
      const { name, role, areaId } = child.val();
      let areaName = "—";
      if (role === "operador" && areaId) {
        db.ref(`master/areas/${areaId}`).once("value", a => {
          areaName = a.val().name || "—";
          tableUsuariosBody.querySelector(`[data-key="${key}"] td.area-cell`).textContent = areaName;
        });
      }
      const tr = document.createElement("tr");
      tr.dataset.key = key;
      tr.innerHTML = `
        <td>${name}</td>
        <td>${role}</td>
        <td class="area-cell">${areaName}</td>
        <td>
          <button class="editUsuario" data-key="${key}">✏️</button>
          <button class="delUsuario"  data-key="${key}">🗑️</button>
        </td>`;
      tableUsuariosBody.appendChild(tr);
    });
    document.querySelectorAll(".editUsuario")
      .forEach(b => b.onclick = e => iniciarEdicionUsuario(e.target.dataset.key));
    document.querySelectorAll(".delUsuario")
      .forEach(b => b.onclick = e => borrarUsuario(e.target.dataset.key));
  });
}

;(function(){
  if (formUsuario._registered) return;
  formUsuario._registered = true;
  formUsuario.addEventListener("submit", async e => {
    e.preventDefault();
    const name   = inputUsuarioName.value.trim();
    const role   = selectUsuarioRole.value;
    const areaId = role === "operador" ? selectUsuarioArea.value : null;
    if (!name || !role || (role==="operador" && !areaId)) return;
    const userData = { name, role };
    if (areaId) userData.areaId = areaId;
    if (editUsuarioKey) {
      await db.ref(`master/usuarios/${editUsuarioKey}`).update(userData);
      editUsuarioKey = null;
      btnCancelUsuario.classList.add("hidden");
    } else {
      await db.ref("master/usuarios").push(userData);
    }
    formUsuario.reset();
    divAreaUsuario.classList.add("hidden");
    showToast("Usuario guardado");
    cargarUsuarios();
  });
})();

function iniciarEdicionUsuario(key) {
  db.ref(`master/usuarios/${key}`).once("value", snap => {
    const { name, role, areaId } = snap.val();
    inputUsuarioName.value   = name;
    selectUsuarioRole.value  = role;
    if (role === "operador") {
      divAreaUsuario.classList.remove("hidden");
      cargarAreasEnUsuario().then(() => selectUsuarioArea.value = areaId || "");
    } else {
      divAreaUsuario.classList.add("hidden");
    }
    editUsuarioKey = key;
    btnCancelUsuario.classList.remove("hidden");
  });
}

btnCancelUsuario.addEventListener("click", () => {
  editUsuarioKey = null;
  formUsuario.reset();
  divAreaUsuario.classList.add("hidden");
  btnCancelUsuario.classList.add("hidden");
});

async function borrarUsuario(key) {
  if (confirm("¿Eliminar este Usuario?")) {
    await db.ref(`master/usuarios/${key}`).remove();
    showToast("Usuario eliminado");
    cargarUsuarios();
  }
}
// ==================== Formulario OT ====================
document.getElementById("otForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!auth.currentUser) {
    return showToast("Debes iniciar sesión");
  }

  const data     = new FormData(e.target);
  const numeroOT = await obtenerNumeroCorrelativo();

  // Captura ID y nombre del inspector de calidad
  const inspeId   = data.get("inspeccionVisual");
  const inspeName = selectInspeccionVisual.selectedOptions[0].textContent;

  // Construcción del objeto OT
  const ot = {
    numeroOT,
    fecha: data.get("fecha"),
    areaId: data.get("area"),
    equipoId: data.get("equipo"),
    firmaTecnicoId: data.get("firmaTecnico"),
    firmaOperadorId: data.get("firmaOperador"),
    firmaSupervisorId: data.get("firmaSupervisor"),
    area: selectArea.selectedOptions[0].textContent,
    equipo: selectEquipo.selectedOptions[0].textContent,
    firmaTecnico: selectFirmaTecnico.selectedOptions[0].textContent,
    firmaOperador: selectFirmaOperador.selectedOptions[0].textContent,
    firmaSupervisor: selectFirmaSupervisor.selectedOptions[0].textContent,
    horaFalla: data.get("horaFalla"),
    horaNotificacion: data.get("horaNotificacion"),
    horaInicioReparacion: data.get("horaInicioReparacion"),
    horaFinReparacion: data.get("horaFinReparacion"),
    tiempototal: data.get("tiempototal"),
    descripcionFallaTecnica: data.get("descripcionFallaTecnica"),
    solucionTecnica: data.get("solucionTecnica"),
    tipo: data.get("tipo"),
    prioridad: data.get("prioridad"),
    categoriaFalla: data.get("categoriaFalla"),
    zonaContacto: data.get("zonaContacto"),
    actividadLimpieza: data.get("actividadLimpieza"),
    horaInicioLimpieza: data.get("horaInicioLimpieza"),
    horaFinLimpieza: data.get("horaFinLimpieza"),
    personaLimpieza: data.get("personaLimpieza"),
    inspeccionVisualId: inspeId,
    inspeccionVisual: inspeName,
    tipoLimpieza: data.get("tipoLimpieza"),
    resultadoATP: data.get("resultadoATP"),
    libre: data.get("libre"),
    zonas: data.get("zonas"),
    estado: data.get("estado"),
    numeroSAP: data.get("numeroSAP"),
    usuario: auth.currentUser.email,
    timestamp: Date.now()
  };

 // Captura y subida de evidencias (máx 2 antes + 2 después)
  const filesAntes   = Array.from(evidenciaAntesInput.files).slice(0, 2);
  const filesDespues = Array.from(evidenciaDespuesInput.files).slice(0, 2);

  // Empieza con las existentes (ya deduplicadas)
  ot.evidenciasAntes   = [...existingEvidenciasAntes];
  ot.evidenciasDespues = [...existingEvidenciasDespues];

  // Subir “Antes”
  for (const file of filesAntes) {
    try {
      const url = await subirImagenImgBB(file);
      ot.evidenciasAntes.push(url);
    } catch (err) {
      console.error("Error ImgBB (antes):", err);
      showToast("Error al subir imagen (antes)");
    }
  }

  // Subir “Después”
  for (const file of filesDespues) {
    try {
      const url = await subirImagenImgBB(file);
      ot.evidenciasDespues.push(url);
    } catch (err) {
      console.error("Error ImgBB (después):", err);
      showToast("Error al subir imagen (después)");
    }
  }

  // Finalmente deduplicar antes de guardar
  ot.evidenciasAntes   = [...new Set(ot.evidenciasAntes)];
  ot.evidenciasDespues = [...new Set(ot.evidenciasDespues)];

  // Guardar en Firebase (nuevo o edición)
  const ref = editKey ? db.ref("ordenes/" + editKey) : db.ref("ordenes").push();
 await ref.set(ot);
 showToast(editKey ? "OT actualizada" : "OT registrada");
editKey = null;

// 1) Resetear el formulario (incluye inputs de texto, selects y file inputs)
e.target.reset();

// 2) Limpiar explícitamente inputs de evidencia y previews
evidenciaAntesInput.value   = "";
evidenciaDespuesInput.value = "";
previewAntes.innerHTML      = "";
previewDespues.innerHTML    = "";

// 3) Volver a renderizar lista y gráficos
renderFromRealtime();

});



// ==================== Render, filtros y edición ====================
async function renderFromRealtime() {
  otList = [];
  const snap = await db.ref("ordenes").once("value");
  snap.forEach(child => {
    const o = child.val();
    o._id = child.key;
    otList.push(o);
  });

  cargarFiltrosAuto();
  document.getElementById("filtroEstado").value = "Abierta";
  aplicarFiltros();
  renderKanban();
  renderGraficos();
  renderCalendar();
  updateKPI();
}

function cargarFiltrosAuto() {
  const estadoSel = document.getElementById("filtroEstado");
  const areaSel   = document.getElementById("filtroArea");

  estadoSel.innerHTML = '<option value="">Todos los estados</option>';
  areaSel.innerHTML   = '<option value="">Todas las áreas</option>';

  const estados = [...new Set(otList.map(o => o.estado).filter(Boolean))];
  const areas   = [...new Set(otList.map(o => o.area).filter(Boolean))];

  estados.forEach(est => {
    const opt = document.createElement("option");
    opt.value = est;
    opt.textContent = est;
    estadoSel.appendChild(opt);
  });

  areas.forEach(ar => {
    const opt = document.createElement("option");
    opt.value = ar;
    opt.textContent = ar;
    areaSel.appendChild(opt);
  });
}

["filtroEstado","filtroArea","filtroFecha"].forEach(id =>{
  document.getElementById(id)
    .addEventListener(id==="filtroArea"?"input":"change", aplicarFiltros);
});

function aplicarFiltros(){
  const est = document.getElementById("filtroEstado").value;
  const area = document.getElementById("filtroArea").value.toLowerCase().trim();
  const fec = document.getElementById("filtroFecha").value;
  const filt = otList.filter(o =>
    (!est||o.estado===est) &&
    (!area||o.area.toLowerCase().includes(area)) &&
    (!fec||o.fecha===fec)
  );
  renderTable(filt);
}

function renderTable(lista = otList) {
  const tb = document.querySelector("#otTable tbody");
  tb.innerHTML = "";
  lista.forEach(o => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${o.numeroOT || "—"}</td>
      <td>${o.fecha}</td>
      <td>${o.area}</td>
      <td>${o.equipo}</td>
      <td>${o.estado}</td>
      <td>${o.prioridad}</td>
      <td>${o.tipo}</td>
      <td>${o.tiempototal || "N/A"}</td>
      <td>
        <button class="pdf-btn"   data-key="${o._id}">📄</button>
        <button class="edit-btn"  data-key="${o._id}">✏️</button>
        <button class="delete-btn"data-key="${o._id}">🗑️</button>
      </td>`;
    tb.appendChild(tr);
  });

  // Eventos
  document.querySelectorAll(".edit-btn")
    .forEach(b => b.onclick = () => editOT(b.dataset.key));
  document.querySelectorAll(".delete-btn")
    .forEach(b => b.onclick = () => delOT(b.dataset.key));
  document.querySelectorAll(".qr-btn")
    .forEach(b => b.onclick = () => showQR(b.dataset.equipo));
  document.querySelectorAll(".pdf-btn")
    .forEach(b => b.onclick = () => {
      const ot = otList.find(o => o._id === b.dataset.key);
      if (!ot) return showToast("OT no encontrada");
      exportOtToPDFDirect(ot); // ✅ nueva versión desacoplada
    });
}


// ==================== Editar OT ====================
async function editOT(id) {
  const o = otList.find(x => x._id === id);
  editKey = id;
  mostrarSeccion("seccionFormulario");
  const f = document.getElementById("otForm");

  // 1) Precargar selects
  await cargarSelectAreasOT();
  await cargarSelectUsuarios("tecnico", selectFirmaTecnico);
  await cargarSelectUsuarios("supervisor", selectFirmaSupervisor);
  await cargarSelectUsuarios("inspector", selectInspeccionVisual);

  // 2) Poblar inputs simples
  for (const k in o) {
    if (
      f[k] &&
      !["area","equipo","firmaTecnico","firmaSupervisor","firmaOperador","inspeccionVisual"].includes(k)
    ) {
      f[k].value = o[k];
    }
  }

  // 3) Área y Equipo
  selectArea.value = o.areaId || "";
  await cargarSelectEquipos(o.areaId);
  selectEquipo.value = o.equipoId || "";

  // 4) Firmas y Operador
  selectFirmaTecnico.value   = o.firmaTecnicoId   || "";
  selectFirmaSupervisor.value= o.firmaSupervisorId|| "";
  await cargarSelectUsuarios("operador", selectFirmaOperador, o.areaId);
  selectFirmaOperador.value  = o.firmaOperadorId  || "";

  // 5) Inspector de calidad
  selectInspeccionVisual.value = o.inspeccionVisualId || "";

  // 6) Sanitización
  f["zonaContacto"].value = o.zonaContacto || "No";
  toggleLimpiezaFields();

  // Número de orden SAP
if (f["numeroSAP"]) {
  f["numeroSAP"].value = o.numeroSAP || "";
}


    // ——— Vistas previas de evidencias para edición ———
  // 1) Trae y limpia
  existingEvidenciasAntes   = [...new Set(o.evidenciasAntes   || [])];
  existingEvidenciasDespues = [...new Set(o.evidenciasDespues || [])];
  previewAntes.innerHTML    = "";
  previewDespues.innerHTML  = "";

  // 2) Renderizar “Antes”
  existingEvidenciasAntes.forEach((url, idx) => {
    const wrapper = document.createElement("div");
    wrapper.className = "preview-wrapper";
    const img = document.createElement("img");
    img.src = url;
    const btn = document.createElement("button");
    btn.className = "remove-img-btn";
    btn.textContent = "×";
    btn.onclick = () => {
      existingEvidenciasAntes.splice(idx, 1);
      wrapper.remove();
    };
    wrapper.append(img, btn);
    previewAntes.appendChild(wrapper);
  });

  // 3) Renderizar “Después” (idem)
  existingEvidenciasDespues.forEach((url, idx) => {
    const wrapper = document.createElement("div");
    wrapper.className = "preview-wrapper";
    const img = document.createElement("img");
    img.src = url;
    const btn = document.createElement("button");
    btn.className = "remove-img-btn";
    btn.textContent = "×";
    btn.onclick = () => {
      existingEvidenciasDespues.splice(idx, 1);
      wrapper.remove();
    };
    wrapper.append(img, btn);
    previewDespues.appendChild(wrapper);
  });

}

function delOT(id){
  if(confirm("Eliminar OT?")) {
    db.ref("ordenes/"+id).remove().then(()=> renderFromRealtime());
  }
}

// ==================== KPIs y Kanban ====================
function updateKPI(){
  const s=id=>document.getElementById(id);
  s("totalOt").textContent=otList.length;
  s("openOt") .textContent=otList.filter(o=>o.estado==="Abierta").length;
  s("progressOt").textContent=otList.filter(o=>o.estado==="En progreso").length;
  s("closedOt").textContent=otList.filter(o=>o.estado==="Cerrada").length;
  s("lateOt") .textContent=otList.filter(o=>new Date(o.finrep)<new Date()&&o.estado!=="Cerrada").length;
}

function renderKanban(){
  const cols={Abierta:"#colAbierta","En progreso":"#colProgreso",Cerrada:"#colCerrada"};
  Object.values(cols).forEach(sel=>document.querySelector(sel+" .kanban-list").innerHTML="");
  otList.forEach(o=>{
    const div=document.createElement("div");
    div.className="kanban-card"; div.draggable=true; div.dataset.id=o._id;
    if(new Date(o.finrep)<new Date()&&o.estado!=="Cerrada") div.classList.add("kanban-alert");
    div.innerHTML=`<strong>${o.equipo}</strong><br>${o.area}<br><em>${o.descripcionFallaTecnica}</em>`;
    document.querySelector(cols[o.estado]+" .kanban-list").appendChild(div);
  });
}

// ==================== Gráficos ====================
function crearChart(id, config) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(document.getElementById(id), config);
}

function renderGraficos() {
  const est={}, area={}, dia={}, tipo={}, prior={}, tipoMin={}, countTipo={}, cat={};
  otList.forEach(o => {
    est[o.estado] = (est[o.estado]||0) + 1;
    area[o.area]  = (area[o.area]||0) + 1;
    dia[o.fecha]  = (dia[o.fecha]||0) + 1;
    tipo[o.tipo]  = (tipo[o.tipo]||0) + 1;
    prior[o.prioridad] = (prior[o.prioridad]||0) + 1;
    const t = parseInt(o.tiempototal,10);
    if (!isNaN(t)) {
      tipoMin[o.tipo] = (tipoMin[o.tipo]||0) + t;
      countTipo[o.tipo] = (countTipo[o.tipo]||0) + 1;
    }
    cat[o.categoriaFalla] = (cat[o.categoriaFalla]||0) + 1;
  });

  crearChart("chartCategoriaFalla", {
    type:"bar",
    data:{ labels:Object.keys(cat), datasets:[{ data:Object.values(cat), label:"OT por Categoría" }] },
    options:{ responsive:true, maintainAspectRatio:false }
  });
  crearChart("chartEstado", {
    type:"bar",
    data:{ labels:Object.keys(est), datasets:[{ data:Object.values(est), label:"OT por Estado", backgroundColor:"#00b4d8" }] },
    options:{ responsive:true, maintainAspectRatio:false }
  });
  crearChart("chartArea", {
    type:"doughnut",
    data:{ labels:Object.keys(area), datasets:[{ data:Object.values(area) }] },
    options:{ responsive:true, maintainAspectRatio:false }
  });
  const fechas = Object.keys(dia).sort();
  crearChart("chartLinea", {
    type:"line",
    data:{ labels:fechas, datasets:[{ label:"OT x día", data:fechas.map(d=>dia[d]), fill:true, tension:0.3 }] },
    options:{ responsive:true, maintainAspectRatio:false }
  });
  crearChart("chartTipoOT", {
    type:"bar",
    data:{ labels:Object.keys(tipo), datasets:[{ data:Object.values(tipo) }] },
    options:{ responsive:true, maintainAspectRatio:false }
  });
  crearChart("chartPrioridad", {
    type:"pie",
    data:{ labels:Object.keys(prior), datasets:[{ data:Object.values(prior) }] },
    options:{ responsive:true, maintainAspectRatio:false }
  });
  crearChart("chartPromedioTiempo", {
    type:"bar",
    data:{ labels:Object.keys(tipo), datasets:[{ data:Object.keys(tipo).map(k=>Math.round((tipoMin[k]||0)/(countTipo[k]||1))) }] },
    options:{ responsive:true, maintainAspectRatio:false }
  });
}

// ==================== Calendario ====================
let calendarObj = null;
function renderCalendar() {
  const div = document.getElementById("calendar");
  if (!div) return;
  if (calendarObj) calendarObj.destroy();
  calendarObj = new FullCalendar.Calendar(div, {
    initialView:"dayGridMonth",
    events: otList.map(o=>({
      title: `${o.equipo} - ${o.tipo}`,
      start: o.fecha,
      backgroundColor: o.estado==="Cerrada" ? "#2a9d8f" : "#e63946"
    }))
  });
  calendarObj.render();
}

// ==================== QR Modal ====================
function showQR(equipo) {
  const modal = document.getElementById("qrModal");
  modal.classList.remove("hidden");
  new QRious({
    element: document.getElementById("qrCanvas"),
    size: 180,
    value: `${location.origin}${location.pathname}?equipo=${encodeURIComponent(equipo)}`
  });
  document.getElementById("closeQr").onclick = () => modal.classList.add("hidden");
}

// Referencias modal de imagen
const imageModal       = document.getElementById("imageModal");
const closeImageModal  = document.getElementById("closeImageModal");
const modalImage       = document.getElementById("modalImage");

// Cerrar modal de imagen
closeImageModal.onclick = () => imageModal.classList.add("hidden");

// Delegación de click en previews
;[previewAntes, previewDespues].forEach(previewEl => {
  if (!previewEl) return;
  previewEl.addEventListener("click", e => {
    if (e.target.tagName === "IMG") {
      modalImage.src = e.target.src;
      imageModal.classList.remove("hidden");
    }
  });
});


// ==================== Init ====================
window.addEventListener("load", () => {
  mostrarSeccion("seccionDashboard");
});
const zonaSel = document.getElementById("zonaContacto");
const bloque   = document.getElementById("bloqueSanitizacion");

zonaSel.addEventListener("change", ({ target }) => {
  // si target.value === "Sí" -> quitar .hidden / si es "No" -> añadir .hidden
  bloque.classList.toggle("hidden", target.value === "No");
});

// Ejecuta una vez al cargar para respetar valor inicial (útil en edición)
bloque.classList.toggle("hidden", zonaSel.value === "No");
function toggleLimpiezaFields() {
  const val = zonaSel.value;
  bloque.classList.toggle("hidden", val === "No");
}

/**
 * Muestra hasta `limit` vistas previas de los archivos seleccionados
 */
function previewImages(inputEl, previewEl, limit) {
  previewEl.innerHTML = "";
  Array.from(inputEl.files)
       .slice(0, limit)
       .forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = document.createElement("img");
      img.src = e.target.result;
      previewEl.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}

// Listeners de cambio para mostrar previews
if (evidenciaAntesInput) {
  evidenciaAntesInput.addEventListener("change", () =>
    previewImages(evidenciaAntesInput, previewAntes, 2)
  );
}
if (evidenciaDespuesInput) {
  evidenciaDespuesInput.addEventListener("change", () =>
    previewImages(evidenciaDespuesInput, previewDespues, 2)
  );
}


// 📦 Subir imagen a ImgBB
async function subirImagenImgBB(file) {
  const apiKey = "7b5b75e47d139cbb56e8e3ab3c3623e8";
  const formData = new FormData();
  formData.append("image", file);

  const res = await fetch("https://api.imgbb.com/1/upload?key=" + apiKey, {
    method: "POST",
    body: formData
  });

  const data = await res.json();
  if (data.success) {
    return data.data.url;  // URL pública de la imagen
  } else {
    console.error("ImgBB error:", data);
    throw new Error("Error al subir imagen");
  }
}
// 3) Función exportOtToPDF en main.js

async function exportOtToPDF() {
  if (!editKey) return showToast("Entra en modo edición antes de exportar");
  const ot = otList.find(o => o._id === editKey);
  if (!ot) return showToast("OT no encontrada");

  await exportOtToPDFDirect(ot); // Reutiliza la nueva función
}


async function exportOtToPDFDirect(ot) {
  try {
   const url = "./docs/ot-template.pdf";
    const bytes = await fetch(url).then(r => {
      if (!r.ok) throw new Error("Plantilla PDF no encontrada");
      return r.arrayBuffer();
    });

    const pdfDoc = await PDFLib.PDFDocument.load(bytes);
    const page   = pdfDoc.getPage(0);
    const { width, height } = page.getSize();
    const helv   = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const fontSize = 7;

    function drawText(value, x, y) {
      const text = value != null ? String(value) : "";
      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font: helv,
        color: PDFLib.rgb(0, 0, 0),
        maxWidth: 400
      });
    }

    function drawParagraph(text, x, yStart, lineHeight = 12, maxChars = 90) {
      if (!text) return;
      const lines = String(text).split("\n").flatMap(line =>
        line.length > maxChars
          ? line.match(new RegExp(`.{1,${maxChars}}`, "g"))
          : [line]
      );
      lines.forEach((line, i) => {
        page.drawText(line.trim(), {
          x,
          y: yStart - i * lineHeight,
          size: fontSize,
          font: helv,
          color: PDFLib.rgb(0, 0, 0)
        });
      });
    }

    // 🧭 Mapeo: usa tus coordenadas actuales
    drawText(ot.fecha,                 25, height - 80);
    drawText(ot.area,                  90, height - 80);
    drawParagraph(ot.equipo,          150, height - 79, 7, 20);
    drawParagraph(ot.firmaOperador,   255, height - 78, 7, 9);
    drawParagraph(ot.firmaSupervisor, 310, height - 78, 7, 8);
    drawText(ot.horaFalla,           430, height - 65);
    drawText(ot.horaInicioReparacion,550, height - 65);
    drawText(ot.horaNotificacion,    430, height - 80);
    drawText(ot.horaFinReparacion,   550, height - 80);
    drawText(ot.categoriaFalla,       35, height - 120);
    drawText(ot.descripcionFallaTecnica, 160, height - 110);
    drawText(ot.tiempototal + " min", 520, height - 97.5);
    drawParagraph(ot.solucionTecnica,   35, height - 160, 11, 120);
    drawText(ot.numeroSAP,           500, height - 160);
    drawText(ot.libre,                45, height - 232);
    drawText(ot.zonas,               110, height - 232);
    drawText(ot.zonaContacto,        165, height - 232);
    drawText(ot.horaInicioLimpieza,  215, height - 232);
    drawText(ot.horaFinLimpieza,     270, height - 232);
    drawText(ot.personaLimpieza,     310, height - 232);
    drawParagraph(ot.inspeccionVisual, 365, height - 229, 7, 9);
    drawText(ot.tipoLimpieza,        215, height - 420);
    drawText(ot.resultadoATP,        560, height - 426);

    const pdfBytes = await pdfDoc.save();
    const blob     = new Blob([pdfBytes], { type: "application/pdf" });
    const blobUrl  = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (err) {
    console.error("Error exportando PDF directo:", err);
    showToast("Error al exportar PDF");
  }
}


// 8) Conecta el botón
document
  .getElementById("btnExportPdf")
  .addEventListener("click", exportOtToPDF);

