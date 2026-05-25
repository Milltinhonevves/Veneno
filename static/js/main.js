// IDs do HTML
const btnGravar   = document.getElementById('btn-gravar');
const btnParar    = document.getElementById('btn-parar');
const btnRegravar = document.getElementById('btn-regravar');
const btnApagar   = document.getElementById('btn-apagar');
const btnReusar   = document.getElementById('btn-reusar');
const btnProcessar= document.getElementById('btn-processar');
const timerEl     = document.getElementById('timer');
const statusRec   = document.getElementById('status-rec');
const previewBox  = document.getElementById('preview-box');
const previewAudio= document.getElementById('preview-audio');
const audioInput  = document.getElementById('audio-input');
const ondas       = document.getElementById('ondas');
const form        = document.getElementById('form-veneno');
const resultado   = document.getElementById('resultado');
const player      = document.getElementById('player');
const btnDownload = document.getElementById('btn-download');
const erroBox     = document.getElementById('erro');
const msgErro     = document.getElementById('msg-erro');

let mediaRecorder = null;
let chunks        = [];
let timerInterval = null;
let startTime     = null;
let arquivoAtual  = null;
let blobGravado   = null;

function getMimeType() {
  const tipos = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ];
  for (const t of tipos) {
    try { if (MediaRecorder.isTypeSupported(t)) return t; } catch(e) {}
  }
  return '';
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}

function setGravando(sim) {
  btnGravar.hidden   = sim;
  btnParar.hidden    = !sim;
  ondas.classList.toggle('ativo', sim);
  if (sim) {
    timerEl.textContent = '00:00';
    statusRec.textContent = '🔴 Gravando...';
  }
}

function mostrarPreview(blob, mime) {
  previewBox.hidden = false;
  previewAudio.src  = URL.createObjectURL(blob);
  btnRegravar.hidden = false;
  btnApagar.hidden   = false;
  btnReusar.hidden   = true;
  btnProcessar.disabled = false;
  statusRec.textContent = '✅ Gravação pronta!';
}

// GRAVAR
btnGravar.addEventListener('click', async () => {
  try {
    const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = getMimeType();
    chunks = [];

    mediaRecorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    mediaRecorder.onstop = () => {
      const realMime = mediaRecorder.mimeType || mimeType || 'audio/webm';
      let ext = 'webm';
      if (realMime.includes('ogg')) ext = 'ogg';
      else if (realMime.includes('mp4')) ext = 'mp4';

      blobGravado  = new Blob(chunks, { type: realMime });
      arquivoAtual = new File([blobGravado], `gravacao.${ext}`, { type: realMime });
      stream.getTracks().forEach(t => t.stop());
      clearInterval(timerInterval);
      setGravando(false);
      mostrarPreview(blobGravado, realMime);
    };

    mediaRecorder.start(250);
    startTime = Date.now();
    timerInterval = setInterval(() => {
      timerEl.textContent = formatTime(Date.now() - startTime);
    }, 500);
    setGravando(true);

  } catch(e) {
    alert('Erro ao acessar microfone: ' + e.message);
  }
});

// PARAR
btnParar.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
});

// NOVA GRAVAÇÃO
btnRegravar.addEventListener('click', () => {
  arquivoAtual = null;
  blobGravado  = null;
  previewBox.hidden      = true;
  previewAudio.src       = '';
  btnRegravar.hidden     = true;
  btnApagar.hidden       = true;
  btnReusar.hidden       = true;
  btnProcessar.disabled  = true;
  statusRec.textContent  = 'Pronto para gravar';
  timerEl.textContent    = '00:00';
});

// APAGAR
btnApagar.addEventListener('click', () => {
  btnRegravar.click();
});

// REUSAR
btnReusar.addEventListener('click', () => {
  if (blobGravado) {
    arquivoAtual = new File([blobGravado], arquivoAtual.name, { type: arquivoAtual.type });
    btnReusar.hidden = true;
    btnProcessar.disabled = false;
    statusRec.textContent = '✅ Pronto para processar novamente!';
  }
});

// SELECIONAR ARQUIVO
audioInput.addEventListener('change', () => {
  if (audioInput.files.length > 0) {
    arquivoAtual = audioInput.files[0];
    blobGravado  = null;
    previewBox.hidden = false;
    previewAudio.src  = URL.createObjectURL(arquivoAtual);
    btnProcessar.disabled = false;
    btnRegravar.hidden = true;
    btnApagar.hidden   = true;
    statusRec.textContent = `📂 ${arquivoAtual.name}`;
  }
});

// PROCESSAR
form.addEventListener('submit', async e => {
  e.preventDefault();
  if (!arquivoAtual) { alert('Grave ou selecione um áudio primeiro!'); return; }

  resultado.hidden       = true;
  erroBox.hidden         = true;
  btnProcessar.disabled  = true;
  document.getElementById('btn-texto').hidden   = true;
  document.getElementById('btn-loading').hidden = false;

  const data = new FormData(form);
  data.set('audio', arquivoAtual, arquivoAtual.name);

  try {
    const resp = await fetch('/processar', { method: 'POST', body: data });
    const textoRaw = await resp.text();
    console.log('Resposta servidor:', resp.status, textoRaw);

    let json = null;
    try { json = JSON.parse(textoRaw); } catch(pe) {
      erroBox.hidden = false;
      msgErro.textContent = '❌ Resposta inválida (HTTP ' + resp.status + '): ' + textoRaw.substring(0, 300);
      return;
    }

    if (json && json.sucesso) {
      resultado.hidden = false;
      player.src       = json.url;
      btnDownload.href = json.url;
      btnReusar.hidden = (blobGravado === null);
    } else {
      erroBox.hidden = false;
      const msgFinal = json && json.erro ? json.erro : ('HTTP ' + resp.status + ' - ' + textoRaw.substring(0, 200));
      msgErro.textContent = '❌ ' + msgFinal;
    }
  } catch(err) {
    erroBox.hidden = false;
    msgErro.textContent = '❌ Erro de conexão: ' + err.message;
  } finally {
    btnProcessar.disabled = false;
    document.getElementById('btn-texto').hidden   = false;
    document.getElementById('btn-loading').hidden = true;
  }
});
