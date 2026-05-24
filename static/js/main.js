// ─── VENENO — Frontend JS ─────────────────────────────────────────

const form        = document.getElementById('form-veneno');
const audioInput  = document.getElementById('audio-input');
const uploadArea  = document.getElementById('upload-area');
const uploadTexto = document.getElementById('upload-texto');
const btnProcessar= document.getElementById('btn-processar');
const btnTexto    = document.getElementById('btn-texto');
const btnLoading  = document.getElementById('btn-loading');
const resultado   = document.getElementById('resultado');
const player      = document.getElementById('player');
const btnDownload = document.getElementById('btn-download');
const erroDiv     = document.getElementById('erro');
const msgErro     = document.getElementById('msg-erro');
const btnGravar   = document.getElementById('btn-gravar');
const btnPararGravacao = document.getElementById('btn-parar-gravacao');
const statusGravacao = document.getElementById('status-gravacao');

let arquivoAtual = null; // guarda o arquivo pra reusar
let mediaRecorder = null;
let chunks = [];

// ─── UPLOAD VIA ARQUIVO ───────────────────────────────────────────
uploadArea.addEventListener('click', () => audioInput.click());

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('ativo');
});
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('ativo'));
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('ativo');
  const files = e.dataTransfer.files;
  if (files.length > 0) selecionarArquivo(files[0]);
});

audioInput.addEventListener('change', () => {
  if (audioInput.files.length > 0) selecionarArquivo(audioInput.files[0]);
});

function selecionarArquivo(arquivo) {
  arquivoAtual = arquivo;
  uploadTexto.textContent = `✅ ${arquivo.name}`;
  uploadArea.classList.add('ativo');
  btnProcessar.disabled = false;
  esconderResultado();
  document.getElementById('btn-reusar').hidden = false;
}

// ─── GRAVAÇÃO DE VOS ──────────────────────────────────────────────
btnGravar.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/wav' });
      const arquivo = new File([blob], 'gravacao.wav', { type: 'audio/wav' });
      selecionarArquivo(arquivo);
      statusGravacao.textContent = '✅ Gravação concluída!';
      btnGravar.hidden = false;
      btnPararGravacao.hidden = true;
      stream.getTracks().forEach(t => t.stop());
    };
    mediaRecorder.start();
    statusGravacao.textContent = '🔴 Gravando... clique em Parar';
    btnGravar.hidden = true;
    btnPararGravacao.hidden = false;
    esconderResultado();
  } catch (err) {
    statusGravacao.textContent = '❌ Permita o acesso ao microfone!';
  }
});

btnPararGravacao.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
});

// ─── ENVIO DO FORMULÁRIO ──────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!arquivoAtual) {
    mostrarErro('Selecione ou grave um áudio primeiro!');
    return;
  }
  esconderResultado();

  const data = new FormData(form);
  data.set('audio', arquivoAtual, arquivoAtual.name);
  data.set('chorus',     form.querySelector('[name="chorus"]').checked     ? 'true' : 'false');
  data.set('compressor', form.querySelector('[name="compressor"]').checked ? 'true' : 'false');

  btnTexto.hidden   = true;
  btnLoading.hidden = false;
  btnProcessar.disabled = true;

  try {
    const res = await fetch('/processar', { method: 'POST', body: data });
    const json = await res.json();
    if (!res.ok || json.erro) {
      mostrarErro(json.erro || 'Erro desconhecido ao processar.');
    } else {
      mostrarResultado(json.url, json.arquivo);
    }
  } catch (err) {
    mostrarErro('Erro de conexão com o servidor.');
  } finally {
    btnTexto.hidden   = false;
    btnLoading.hidden = true;
    btnProcessar.disabled = false;
  }
});

function mostrarResultado(url, nomeArquivo) {
  player.src        = url;
  btnDownload.href  = url;
  btnDownload.download = nomeArquivo;
  resultado.hidden  = false;
  resultado.scrollIntoView({ behavior: 'smooth' });
  // Mostrar botão de reusar
  document.getElementById('btn-reusar').hidden = false;
}

function mostrarErro(msg) {
  msgErro.textContent = `❌ ${msg}`;
  erroDiv.hidden = false;
  erroDiv.scrollIntoView({ behavior: 'smooth' });
}

function esconderResultado() {
  resultado.hidden = true;
  erroDiv.hidden   = true;
}
