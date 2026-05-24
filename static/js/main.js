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

// Clique na área de upload abre o input
uploadArea.addEventListener('click', () => audioInput.click());

// Drag and drop
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('ativo');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('ativo');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('ativo');
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    audioInput.files = files;
    onArquivoSelecionado(files[0]);
  }
});

// Arquivo selecionado via input
audioInput.addEventListener('change', () => {
  if (audioInput.files.length > 0) {
    onArquivoSelecionado(audioInput.files[0]);
  }
});

function onArquivoSelecionado(arquivo) {
  uploadTexto.textContent = `✅ ${arquivo.name}`;
  uploadArea.classList.add('ativo');
  btnProcessar.disabled = false;
  esconderResultado();
}

// Envio do formulário
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  esconderResultado();

  // Monta o FormData
  const data = new FormData(form);

  // Checkboxes precisam de tratamento manual
  data.set('chorus',     form.querySelector('[name="chorus"]').checked     ? 'true' : 'false');
  data.set('compressor', form.querySelector('[name="compressor"]').checked ? 'true' : 'false');

  // Estado de loading
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
