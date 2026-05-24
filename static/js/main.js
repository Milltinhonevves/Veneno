// ─── VENENO — Frontend JS ─────────────────────────────────────────

const form         = document.getElementById('form-veneno');
const audioInput   = document.getElementById('audio-input');
const btnProcessar = document.getElementById('btn-processar');
const btnTexto     = document.getElementById('btn-texto');
const btnLoading   = document.getElementById('btn-loading');
const resultado    = document.getElementById('resultado');
const player       = document.getElementById('player');
const btnDownload  = document.getElementById('btn-download');
const erroDiv      = document.getElementById('erro');
const msgErro      = document.getElementById('msg-erro');

const btnGravar    = document.getElementById('btn-gravar');
const btnParar     = document.getElementById('btn-parar');
const btnReGravar  = document.getElementById('btn-regravar');
const btnReusar    = document.getElementById('btn-reusar');
const btnApagar    = document.getElementById('btn-apagar');
const previewAudio = document.getElementById('preview-audio');
const previewBox   = document.getElementById('preview-box');
const statusRec    = document.getElementById('status-rec');
const timerEl      = document.getElementById('timer');
const ondas        = document.getElementById('ondas');

let mediaRecorder = null;
let chunks = [];
let arquivoAtual = null;
let timerInterval = null;
let segundos = 0;

function formatarTempo(s) {
  const m = Math.floor(s / 60).toString().padStart(2,'0');
  const ss = (s % 60).toString().padStart(2,'0');
  return `${m}:${ss}`;
}

// ─── GRAVAR ──────────────────────────────────────────────────────
btnGravar.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      clearInterval(timerInterval);
      const blob = new Blob(chunks, { type: 'audio/wav' });
      arquivoAtual = new File([blob], 'gravacao.wav', { type: 'audio/wav' });
      previewAudio.src = URL.createObjectURL(blob);
      previewBox.hidden = false;
      btnGravar.hidden = true;
      btnParar.hidden = true;
      btnReGravar.hidden = false;
      btnReusar.hidden = false;
      btnApagar.hidden = false;
      btnProcessar.disabled = false;
      ondas.classList.remove('ativo');
      statusRec.textContent = '✅ Gravação pronta! Ouça antes de processar.';
      stream.getTracks().forEach(t => t.stop());
    };
    mediaRecorder.start();
    segundos = 0;
    timerEl.textContent = '00:00';
    timerInterval = setInterval(() => {
      segundos++;
      timerEl.textContent = formatarTempo(segundos);
    }, 1000);
    btnGravar.hidden = true;
    btnParar.hidden = false;
    btnReGravar.hidden = true;
    btnApagar.hidden = true;
    previewBox.hidden = true;
    ondas.classList.add('ativo');
    statusRec.textContent = '🔴 Gravando...';
    esconderResultado();
  } catch(err) {
    statusRec.textContent = '❌ Permita o acesso ao microfone!';
  }
});

// ─── PARAR ───────────────────────────────────────────────────────
btnParar.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
});

// ─── APAGAR ──────────────────────────────────────────────────────
btnApagar.addEventListener('click', () => {
  arquivoAtual = null;
  previewAudio.src = '';
  previewBox.hidden = true;
  btnGravar.hidden = false;
  btnParar.hidden = true;
  btnReGravar.hidden = true;
  btnReusar.hidden = true;
  btnApagar.hidden = true;
  btnProcessar.disabled = true;
  timerEl.textContent = '00:00';
  statusRec.textContent = 'Pronto para gravar';
  ondas.classList.remove('ativo');
  esconderResultado();
});

// ─── NOVA GRAVAÇÃO ────────────────────────────────────────────────
btnReGravar.addEventListener('click', () => {
  btnApagar.click(); // reutiliza a lógica de apagar
});

// ─── UPLOAD ARQUIVO ──────────────────────────────────────────────
audioInput.addEventListener('change', () => {
  if (audioInput.files.length > 0) {
    arquivoAtual = audioInput.files[0];
    previewAudio.src = URL.createObjectURL(arquivoAtual);
    previewBox.hidden = false;
    btnReusar.hidden = false;
    btnApagar.hidden = false;
    btnProcessar.disabled = false;
    statusRec.textContent = `✅ ${arquivoAtual.name}`;
    esconderResultado();
  }
});

// ─── ENVIO ────────────────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!arquivoAtual) { mostrarErro('Grave ou selecione um áudio primeiro!'); return; }
  esconderResultado();

  const data = new FormData(form);
  data.set('audio', arquivoAtual, arquivoAtual.name);
  data.set('chorus',     form.querySelector('[name="chorus"]').checked ? 'true' : 'false');
  data.set('compressor', form.querySelector('[name="compressor"]').checked ? 'true' : 'false');

  btnTexto.hidden = true;
  btnLoading.hidden = false;
  btnProcessar.disabled = true;

  try {
    const res = await fetch('/processar', { method: 'POST', body: data });
    const json = await res.json();
    if (!res.ok || json.erro) mostrarErro(json.erro || 'Erro desconhecido.');
    else mostrarResultado(json.url, json.arquivo);
  } catch(err) {
    mostrarErro('Erro de conexão com o servidor.');
  } finally {
    btnTexto.hidden = false;
    btnLoading.hidden = true;
    btnProcessar.disabled = false;
  }
});

function mostrarResultado(url, nome) {
  player.src = url;
  btnDownload.href = url;
  btnDownload.download = nome;
  resultado.hidden = false;
  resultado.scrollIntoView({ behavior: 'smooth' });
}
function mostrarErro(msg) {
  msgErro.textContent = `❌ ${msg}`;
  erroDiv.hidden = false;
  erroDiv.scrollIntoView({ behavior: 'smooth' });
}
function esconderResultado() {
  resultado.hidden = true;
  erroDiv.hidden = true;
}
