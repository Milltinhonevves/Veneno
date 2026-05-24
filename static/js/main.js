const form        = document.getElementById('tuner-form');
const btnGravar   = document.getElementById('btn-gravar');
const btnParar    = document.getElementById('btn-parar');
const btnDeletar  = document.getElementById('btn-deletar');
const timerEl     = document.getElementById('timer');
const previewAudio= document.getElementById('preview-audio');
const audioInput  = document.getElementById('audio-input');
const statusEl    = document.getElementById('status');
const resultEl    = document.getElementById('result');
const audioResult = document.getElementById('audio-result');
const canvas      = document.getElementById('visualizer');
const canvasCtx   = canvas ? canvas.getContext('2d') : null;

let mediaRecorder = null;
let chunks        = [];
let timerInterval = null;
let startTime     = null;
let arquivoAtual  = null;
let audioContext  = null;
let analyser      = null;
let animFrame     = null;

function getMimeType() {
  const tipos = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ];
  for (const t of tipos) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}

function drawVisualizer() {
  if (!analyser || !canvasCtx) return;
  animFrame = requestAnimationFrame(drawVisualizer);
  const buf = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteTimeDomainData(buf);
  canvasCtx.fillStyle = '#111';
  canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
  canvasCtx.lineWidth = 2;
  canvasCtx.strokeStyle = '#00ff88';
  canvasCtx.beginPath();
  const sl = canvas.width / buf.length;
  let x = 0;
  for (let i = 0; i < buf.length; i++) {
    const y = (buf[i] / 128.0) * (canvas.height / 2);
    i === 0 ? canvasCtx.moveTo(x, y) : canvasCtx.lineTo(x, y);
    x += sl;
  }
  canvasCtx.lineTo(canvas.width, canvas.height / 2);
  canvasCtx.stroke();
}

btnGravar && btnGravar.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = getMimeType();
    chunks = [];

    mediaRecorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    const realMime = mediaRecorder.mimeType || mimeType || 'audio/webm';

    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: realMime });
      // Extensão baseada no mime real
      let ext = 'webm';
      if (realMime.includes('ogg')) ext = 'ogg';
      else if (realMime.includes('mp4')) ext = 'mp4';
      arquivoAtual = new File([blob], `gravacao.${ext}`, { type: realMime });
      previewAudio.src = URL.createObjectURL(blob);
      previewAudio.style.display = 'block';
      if (btnDeletar) btnDeletar.style.display = 'inline-block';
      stream.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(animFrame);
    };

    // Visualizador
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    const src = audioContext.createMediaStreamSource(stream);
    src.connect(analyser);
    drawVisualizer();

    mediaRecorder.start(250);
    startTime = Date.now();
    timerInterval = setInterval(() => {
      if (timerEl) timerEl.textContent = formatTime(Date.now() - startTime);
    }, 500);

    btnGravar.style.display = 'none';
    btnParar.style.display  = 'inline-block';
    if (timerEl) timerEl.style.display = 'block';
  } catch(e) {
    alert('Erro ao acessar microfone: ' + e.message);
  }
});

btnParar && btnParar.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  clearInterval(timerInterval);
  btnParar.style.display  = 'none';
  btnGravar.style.display = 'inline-block';
  if (timerEl) timerEl.style.display = 'none';
});

btnDeletar && btnDeletar.addEventListener('click', () => {
  arquivoAtual = null;
  chunks = [];
  previewAudio.src = '';
  previewAudio.style.display = 'none';
  btnDeletar.style.display = 'none';
  if (timerEl) timerEl.textContent = '00:00';
});

audioInput && audioInput.addEventListener('change', () => {
  if (audioInput.files.length > 0) {
    arquivoAtual = audioInput.files[0];
    previewAudio.src = URL.createObjectURL(arquivoAtual);
    previewAudio.style.display = 'block';
    if (btnDeletar) btnDeletar.style.display = 'inline-block';
  }
});

form && form.addEventListener('submit', async e => {
  e.preventDefault();
  if (!arquivoAtual) { alert('Grave ou selecione um áudio primeiro!'); return; }

  statusEl.style.display = 'block';
  statusEl.textContent   = '⏳ Processando...';
  resultEl.style.display = 'none';

  const data = new FormData(form);
  data.set('audio', arquivoAtual, arquivoAtual.name);

  try {
    const resp = await fetch('/processar', { method: 'POST', body: data });
    const json = await resp.json();
    statusEl.style.display = 'none';

    if (json.sucesso) {
      resultEl.style.display  = 'block';
      resultEl.className      = 'result success';
      audioResult.src         = json.url;
      audioResult.style.display = 'block';
    } else {
      resultEl.style.display = 'block';
      resultEl.className     = 'result error';
      resultEl.innerHTML     = `❌ ${json.erro || 'Erro desconhecido'}`;
    }
  } catch(err) {
    statusEl.style.display = 'none';
    resultEl.style.display = 'block';
    resultEl.className     = 'result error';
    resultEl.innerHTML     = `❌ Erro de conexão: ${err.message}`;
  }
});
