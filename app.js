const PyLogic = (() => {
  const STORAGE_KEY = "pylogic_students_v1";
  const CURRENT_KEY = "pylogic_current_v1";
  const DOC_PASS = "PyLogic2026";

  let pyodide = null;
  let pyodideLoading = null;
  let state = null;

  const levels = [
    {
      title: "¿Qué es una condición?",
      theory: `Una condición permite que Python tome una decisión. Se escribe con <code>if</code> y una expresión que puede ser verdadera o falsa.`,
      consigna: `Crea un programa que muestre <strong>\"Puede entrar\"</strong> si la variable <code>edad</code> es mayor o igual a 15.`,
      starter: `edad = 16\n\n# Escribe tu condición`,
      expected: ["puede entrar"],
      hints: ["Usa <code>if edad &gt;= 15:</code>.", "Dentro del if coloca un print().", "El texto esperado es \"Puede entrar\"."]
    },
    {
      title: "IF + ELSE",
      theory: `<code>else</code> permite indicar qué debe ocurrir cuando la condición del <code>if</code> es falsa.`,
      consigna: `Si <code>edad</code> es mayor o igual a 15 muestra <strong>\"Puede entrar\"</strong>; en caso contrario muestra <strong>\"No puede entrar\"</strong>.`,
      starter: `edad = 14\n\n# Completa con if y else`,
      expected: ["no puede entrar"],
      hints: ["Necesitas if y else.", "Prueba con <code>if edad &gt;= 15:</code>.", "En este nivel el resultado correcto es \"No puede entrar\"."]
    },
    {
      title: "Comparar números",
      theory: `Python permite comparar valores con <code>==</code>, <code>&gt;</code>, <code>&lt;</code>, <code>&gt;=</code> y <code>&lt;=</code>.`,
      consigna: `Si <code>nota</code> es mayor o igual a 6, muestra <strong>\"Aprobado\"</strong>; si no, muestra <strong>\"No aprobado\"</strong>.`,
      starter: `nota = 8\n\n# Escribe la decisión`,
      expected: ["aprobado"],
      hints: ["Usa >= para comparar.", "La condición debe comprobar si nota alcanza 6.", "Usa print(\"Aprobado\") cuando se cumpla."]
    },
    {
      title: "IF, ELIF y ELSE",
      theory: `Cuando existen varias posibilidades, <code>elif</code> permite comprobar otra condición si la anterior no se cumple.`,
      consigna: `Con <code>nota = 8</code>: 9 o 10 → \"Excelente\"; 6 a 8 → \"Aprobado\"; menos de 6 → \"No aprobado\".`,
      starter: `nota = 8\n\n# Usa if, elif y else`,
      expected: ["aprobado"],
      hints: ["Primero comprueba nota >= 9.", "Después usa elif nota >= 6.", "Finalmente utiliza else."]
    },
    {
      title: "Varias condiciones",
      theory: `Puedes combinar condiciones utilizando <code>and</code> y <code>or</code>.`,
      consigna: `Si la edad está entre 15 y 18 inclusive, muestra <strong>\"Adolescente\"</strong>. De lo contrario muestra <strong>\"Fuera del rango\"</strong>.`,
      starter: `edad = 16\n\n# Resuelve usando and`,
      expected: ["adolescente"],
      hints: ["Necesitas dos comparaciones.", "Puedes usar <code>edad >= 15 and edad <= 18</code>.", "Imprime \"Adolescente\" si ambas son verdaderas."]
    },
    {
      title: "Decisiones con texto",
      theory: `También puedes comparar cadenas de texto. Recuerda escribir los textos entre comillas.`,
      consigna: `Si <code>liceo</code> es igual a <strong>\"Liceo 53\"</strong>, muestra <strong>\"Puede entrar\"</strong>; si no, muestra <strong>\"No puede entrar\"</strong>.`,
      starter: `liceo = "Liceo 53"\n\n# Comprueba el liceo`,
      expected: ["puede entrar"],
      hints: ["Compara usando ==.", "Las cadenas deben estar entre comillas.", "El texto esperado es \"Puede entrar\"."]
    },
    {
      title: "Desafío final",
      theory: `Integra todo lo aprendido. Puedes utilizar <code>if</code>, <code>elif</code>, <code>else</code>, comparaciones y operadores lógicos.`,
      consigna: `Con <code>nota = 10</code>: si es 10 → \"Excelente\"; si es 6 a 9 → \"Aprobado\"; si es menor que 6 → \"Debe mejorar\".`,
      starter: `nota = 10\n\n# Resuelve el desafío final`,
      expected: ["excelente"],
      hints: ["Empieza comprobando nota == 10.", "Luego usa elif para las notas aprobadas.", "Cierra con else."]
    }
  ];

  const $ = id => document.getElementById(id);
  const normalize = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();

  function escapeHTML(s){
    return String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  function emptyLevel(){
    return {attempts:0,hints:0,correct:false,validatedCode:"",executedCode:"",lastOutput:""};
  }

  function newState(){
    return {
      name:"", username:"", group:"", liceo:"",
      currentLevel:0, completed:false, totalAttempts:0, totalHints:0,
      levels: levels.map(() => emptyLevel()),
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString()
    };
  }

  function loadStudents(){
    try{return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")}catch{return []}
  }

  function saveStudents(list){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function saveCurrent(){
    if(!state)return;
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(CURRENT_KEY, JSON.stringify(state));
    upsertStudent(state);
  }

  function upsertStudent(s){
    const list = loadStudents();
    const idx = list.findIndex(x => x.username.toLowerCase() === s.username.toLowerCase());
    if(idx >= 0) list[idx] = JSON.parse(JSON.stringify(s)); else list.push(JSON.parse(JSON.stringify(s)));
    saveStudents(list);
  }

  async function ensurePyodide(){
    if(pyodide)return pyodide;
    if(pyodideLoading)return pyodideLoading;
    if(typeof loadPyodide !== "function") throw new Error("No se pudo cargar Pyodide.");
    pyodideLoading = loadPyodide();
    pyodide = await pyodideLoading;
    return pyodide;
  }

  async function executePython(code){
    const py = await ensurePyodide();
    const output = [];
    py.setStdout({batched: s => output.push(s)});
    py.setStderr({batched: s => output.push(s)});
    py.globals.set("input", (...args) => "");
    try{
      await py.runPythonAsync(code);
      return {ok: true, output: output.join("") || "(El programa no produjo salida.)"};
    }catch(err){
      return {ok: false, output: String(err)};
    }
  }

  function showView(id){
    ["viewLogin","viewLevel","viewFinal"].forEach(v => {
      const el = $(v);
      if(el) el.style.display = (v === id) ? "block" : "none";
    });
  }

  function updateProgress(){
    const totalLevels = levels.length;
    const completed = state ? state.levels.filter(x => x.correct).length : 0;
    const progressBox = $("headerProgressBox");
    if(progressBox) progressBox.style.display = state ? "block" : "none";
    if(!state) return;
    
    $("progressLabelText").textContent = state.completed 
      ? "Desafío completado" 
      : `Nivel ${Math.min(state.currentLevel + 1, totalLevels)} de ${totalLevels}`;
    $("headerProgressBar").style.width = `${(completed / totalLevels) * 100}%`;
  }

  function renderLevel(){
    if(!state) return;
    const i = state.currentLevel;
    const l = levels[i];
    
    if(!l || i >= levels.length){
      renderFinal();
      return;
    }

    showView("viewLevel");
    $("levelBadge").textContent = `NIVEL ${i + 1}`;
    $("levelTitle").textContent = l.title;
    $("levelTheory").innerHTML = l.theory;
    $("levelConsigna").innerHTML = `<strong>🎯 Consigna:</strong><br>${l.consigna}<hr><strong>📌 Código inicial:</strong><pre>${escapeHTML(l.starter)}</pre>`;
    $("codeEditor").value = state.levels[i].executedCode || l.starter;
    $("terminalOutput").textContent = state.levels[i].lastOutput || "Presiona 'Ejecutar' para ver la salida del programa...";
    $("hintCount").textContent = state.levels[i].hints;
    $("hintText").style.display = "none";
    $("hintText").innerHTML = "";
    $("aiPedagogicalMessage").style.display = state.levels[i].attempts > 0 && !state.levels[i].correct ? "block" : "none";
    updateProgress();
  }

  function outputMatches(level, output){
    const o = normalize(output);
    return level.expected.some(e => o.includes(normalize(e)));
  }

  async function ejecutarCodigo(){
    if(!state)return;
    const code = $("codeEditor").value;
    if(!code.trim()){ $("terminalOutput").textContent = "Escribe código antes de ejecutar."; return; }
    $("terminalOutput").textContent = "⏳ Ejecutando Python...";
    state.levels[state.currentLevel].executedCode = code;
    const result = await executePython(code);
    state.levels[state.currentLevel].lastOutput = result.output;
    saveCurrent();
    $("terminalOutput").textContent = (result.ok ? "" : "❌ Error:\n") + result.output;
  }

  async function comprobarSolucion(){
    if(!state)return;
    const i = state.currentLevel;
    const code = $("codeEditor").value;
    if(!code.trim()){ $("terminalOutput").textContent = "Escribe una solución antes de comprobar."; return; }

    state.levels[i].attempts++;
    state.totalAttempts++;
    state.levels[i].executedCode = code;
    $("terminalOutput").textContent = "⏳ Comprobando...";
    const result = await executePython(code);
    state.levels[i].lastOutput = result.output;

    if(result.ok && outputMatches(levels[i], result.output)){
      state.levels[i].correct = true;
      state.levels[i].validatedCode = code;
      state.levels[i].validatedAt = new Date().toISOString();
      $("terminalOutput").textContent = "✅ ¡Solución correcta!\n\n" + result.output;
      saveCurrent();
      setTimeout(() => {
        if(i < levels.length - 1){
          state.currentLevel++;
          saveCurrent();
          renderLevel();
        }else{
          state.completed = true;
          saveCurrent();
          renderFinal();
        }
      }, 700);
    }else{
      state.levels[i].correct = false;
      $("aiPedagogicalMessage").style.display = "block";
      saveCurrent();
      $("terminalOutput").textContent = (result.ok ? "" : "❌ Error:\n") + result.output + "\n\n💡 Revisá la consigna y probá nuevamente.";
    }
    updateProgress();
  }

  function pedirPista(){
    if(!state)return;
    const i = state.currentLevel;
    const lstate = state.levels[i];
    if(lstate.hints >= 3){
      $("hintText").style.display = "block";
      $("hintText").innerHTML = "Ya utilizaste las 3 pistas disponibles para este nivel.";
      return;
    }
    lstate.hints++;
    state.totalHints++;
    saveCurrent();
    $("hintCount").textContent = lstate.hints;
    $("hintText").style.display = "block";
    $("hintText").innerHTML = `💡 ${levels[i].hints[lstate.hints - 1]}`;
  }

  function limpiarEditor(){
    $("codeEditor").value = "";
    $("terminalOutput").textContent = "Editor limpio. Escribe tu código Python.";
  }

  function calculateGrade(s){
    if(!s) return null;
    const correct = s.levels.filter(x => x.correct).length;
    if(!s.completed && correct === 0) return null;
    let grade = (correct / levels.length) * 10;
    const penalty = Math.min(s.totalHints * 0.1, 0.5);
    grade = Math.max(1, grade - penalty);
    return Math.round(grade * 10) / 10;
  }

  function interpretation(n){
    if(n === null) return "En curso";
    if(n >= 9) return "Desempeño excelente";
    if(n >= 7) return "Muy buen desempeño";
    if(n >= 6) return "Desempeño satisfactorio";
    return "Debe continuar practicando";
  }

  function renderFinal(){
    showView("viewFinal");
    const grade = calculateGrade(state);
    const correct = state.levels.filter(x => x.correct).length;
    $("finalNotaLibreta").textContent = grade === null ? "En curso" : `${grade}/10`;
    $("finalInterpretacion").textContent = interpretation(grade);
    $("finalPorcentaje").textContent = `${Math.round((correct / levels.length) * 100)}%`;
    $("finalCorrectas").textContent = `${correct}/${levels.length}`;
    $("finalIntentos").textContent = state.totalAttempts;
    $("finalPistas").textContent = state.totalHints;
    $("finalBadgesContainer").innerHTML = `<span class="master-badge">🐍 IF MASTER</span><span class="master-badge">💻 PYTHON</span>`;
    updateProgress();
  }

  function abrirReporteModal(){
    if(!state){
      try{ state = JSON.parse(localStorage.getItem(CURRENT_KEY) || "null"); }catch{}
    }
    if(!state){
      alert("Para ver el reporte, primero debes ingresar datos y presionar 'Comenzar'.");
      return;
    }
    renderReporte();
    $("modalReporte").style.display = "flex";
  }

  function renderReporte(){
    if(!state) return;
    const correct = state.levels.filter(x => x.correct).length;
    const grade = calculateGrade(state);
    $("repNombre").textContent = state.name;
    $("repUsuario").textContent = state.username;
    $("repGrupo").textContent = state.group;
    $("repLiceo").textContent = state.liceo;
    $("repNotaLibreta").textContent = grade === null ? "En curso" : `${grade}/10`;
    $("repEstadoPill").textContent = state.completed ? "🟢 Finalizado" : "🟡 En curso";
    $("repPorcentaje").textContent = `${Math.round((correct / levels.length) * 100)}%`;
    $("repActividades").textContent = `${correct}/${levels.length}`;
    $("repIntentos").textContent = state.totalAttempts;
    $("repPistas").textContent = state.totalHints;

    $("repTablaNiveles").innerHTML = state.levels.map((l, i) => `
      <tr>
        <td>Nivel ${i + 1}<br><small>${escapeHTML(levels[i]?.title || "")}</small></td>
        <td>${l.correct ? "🟢 Correcto" : "⚪ Pendiente"}</td>
        <td>${l.correct ? "1" : "0"}</td>
        <td>${l.attempts}</td>
        <td>${l.hints}</td>
      </tr>`).join("");

    $("repCodigoValidadoSec").innerHTML = state.levels.map((l, i) => `
      <div class="validated-code-card">
        <div class="validated-code-title">
          Nivel ${i + 1} — ${escapeHTML(levels[i]?.title || "")}
          ${l.correct ? " ✅ VALIDADO" : " — Sin validación"}
        </div>
        <pre class="validated-code">${l.validatedCode ? escapeHTML(l.validatedCode) : "No existe código validado para este nivel."}</pre>
      </div>`).join("");
  }

  function cerrarModal(id){ $(id).style.display = "none"; }

  function descargarPDFReporte(){
    renderReporte();
    const element = $("reporteContenidoImprimible");
    if(typeof html2pdf === "undefined"){
      alert("La biblioteca PDF no se pudo cargar. Utiliza la opción 'Imprimir' y selecciona 'Guardar como PDF'.");
      return;
    }
    const options = {
      margin: 8,
      filename: `PyLogic_Reporte_${state ? state.username : "estudiante"}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 1.5, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    };
    html2pdf().set(options).from(element).save();
  }

  function abrirModalDocente(){
    $("modalDocente").style.display = "flex";
    $("docenteAuthBox").style.display = "block";
    $("docenteDashboardBox").style.display = "none";
  }

  function autenticarDocente(){
    if($("inputPassDocente").value !== DOC_PASS){ alert("Clave incorrecta."); return; }
    $("docenteAuthBox").style.display = "none";
    $("docenteDashboardBox").style.display = "block";
    renderDocente();
  }

  function renderDocente(){
    const list = loadStudents();
    const completed = list.filter(s => s.completed);
    const grades = completed.map(calculateGrade).filter(n => n !== null);
    $("docTotalUsuarios").textContent = list.length;
    $("docUsuariosActivos").textContent = list.filter(s => !s.completed && s.levels.some(x => x.attempts > 0)).length;
    $("docFinalizados").textContent = completed.length;
    $("docPromedioGeneral").textContent = grades.length ? (grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(1) + " / 10" : "0.0 / 10";
    renderDocTable(list);
  }

  function renderDocTable(list){
    const q = normalize($("docSearchInput").value);
    const filtered = list.filter(s => normalize(s.name).includes(q) || normalize(s.username).includes(q));
    $("docTablaEstudiantes").innerHTML = filtered.length ? filtered.map(s => {
      const correct = s.levels.filter(x => x.correct).length;
      const grade = calculateGrade(s);
      return `<tr>
        <td>${escapeHTML(s.name)}</td><td>${escapeHTML(s.username)}</td><td>${escapeHTML(s.group)}</td>
        <td>${correct}/${levels.length}</td><td>${grade === null ? "-" : grade + "/10"}</td>
        <td>${s.completed ? "🟢 Finalizado" : "🟡 En curso"}</td>
        <td><button class="btn btn-small btn-primary" onclick="PyLogic.verReporteEstudiante('${encodeURIComponent(s.username)}')">REPORTE</button></td>
      </tr>`;
    }).join("") : `<tr><td colspan="7">No hay estudiantes registrados.</td></tr>`;
  }

  function filtrarTablaDocente(){ renderDocTable(loadStudents()); }

  function verReporteEstudiante(encoded){
    const username = decodeURIComponent(encoded);
    const found = loadStudents().find(s => s.username === username);
    if(!found) return;
    state = found;
    localStorage.setItem(CURRENT_KEY, JSON.stringify(state));
    abrirReporteModal();
  }

  function reiniciarAvance(){
    if(!confirm("¿Querés reiniciar todos los niveles de este estudiante?")) return;
    const identity = { name: state.name, username: state.username, group: state.group, liceo: state.liceo };
    state = Object.assign(newState(), identity);
    saveCurrent();
    renderLevel();
  }

  function bindEvents(){
    if($("btnPista")) $("btnPista").onclick = pedirPista;
    if($("btnLimpiar")) $("btnLimpiar").onclick = limpiarEditor;
    if($("btnEjecutar")) $("btnEjecutar").onclick = ejecutarCodigo;
    if($("btnComprobar")) $("btnComprobar").onclick = comprobarSolucion;
    if($("btnReporteGlobal")) $("btnReporteGlobal").onclick = abrirReporteModal;
    if($("btnPanelDocente")) $("btnPanelDocente").onclick = abrirModalDocente;
    if($("btnVerReporteFinal")) $("btnVerReporteFinal").onclick = abrirReporteModal;
    if($("btnPDFFinal")) $("btnPDFFinal").onclick = descargarPDFReporte;
    if($("btnReintentar")) $("btnReintentar").onclick = reiniciarAvance;
    if($("closeReporte")) $("closeReporte").onclick = () => cerrarModal("modalReporte");
    if($("btnCerrarReporte")) $("btnCerrarReporte").onclick = () => cerrarModal("modalReporte");
    if($("btnImprimir")) $("btnImprimir").onclick = () => window.print();
    if($("btnPDFReporte")) $("btnPDFReporte").onclick = descargarPDFReporte;
    if($("closeDocente")) $("closeDocente").onclick = () => cerrarModal("modalDocente");
    if($("btnAutenticar")) $("btnAutenticar").onclick = autenticarDocente;
    if($("docSearchInput")) $("docSearchInput").oninput = filtrarTablaDocente;
  }

  return {
    init(){
      bindEvents();
      const current = localStorage.getItem(CURRENT_KEY);
      if(current){
        try{
          const s = JSON.parse(current);
          if(s && s.username && s.levels){
            this.iniciarSesion(s);
          }
        }catch{}
      }
    },
    pedirPista, limpiarEditor, ejecutarCodigo, comprobarSolucion, abrirReporteModal,
    cerrarModal, descargarPDFReporte, abrirModalDocente, autenticarDocente,
    filtrarTablaDocente, verReporteEstudiante, reiniciarAvance,
    iniciarSesion(s){
      state = s; 
      while(state.levels.length < levels.length){
        state.levels.push(emptyLevel());
      }
      saveCurrent();
      if(state.completed) renderFinal(); else renderLevel();
    }
  };
})();

document.addEventListener("DOMContentLoaded", () => {
  PyLogic.init();

  const form = document.getElementById("formIngreso");
  if(form){
    form.addEventListener("submit", e => {
      e.preventDefault();
      const name = document.getElementById("inputNombre").value.trim();
      const username = document.getElementById("inputUsuario").value.trim();
      const group = document.getElementById("inputGrupo").value.trim();
      const liceo = document.getElementById("inputLiceo").value.trim();
      if(!name || !username || !group || !liceo){ form.reportValidity(); return; }

      let list = []; try{ list = JSON.parse(localStorage.getItem("pylogic_students_v1") || "[]"); }catch{}
      let s = list.find(x => x.username.toLowerCase() === username.toLowerCase());

      if(s){
        if(!confirm("Este usuario ya tiene un avance guardado. ¿Querés continuar desde donde quedó?")) return;
        s.name = name; s.group = group; s.liceo = liceo;
      }else{
        s = {
          name, username, group, liceo, currentLevel: 0, completed: false, totalAttempts: 0, totalHints: 0,
          levels: Array.from({length: 7}, () => ({attempts: 0, hints: 0, correct: false, validatedCode: "", executedCode: "", lastOutput: ""})),
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        };
        list.push(s);
      }

      localStorage.setItem("pylogic_current_v1", JSON.stringify(s));
      localStorage.setItem("pylogic_students_v1", JSON.stringify(list));
      PyLogic.iniciarSesion(s);
    });
  }
});