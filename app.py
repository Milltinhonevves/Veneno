import os
import uuid
import numpy as np
import librosa
import soundfile as sf
import pyrubberband as pyrb
from flask import Flask, request, jsonify, render_template, send_from_directory
from pedalboard import Pedalboard, Chorus, Reverb, Compressor, Gain
from pedalboard.io import AudioFile

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['PROCESSED_FOLDER'] = 'processed'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max

ALLOWED_EXTENSIONS = {'wav', 'mp3', 'ogg', 'flac', 'm4a'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ─── NÚCLEO DE AFINAÇÃO ──────────────────────────────────────────────────────

NOTAS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
ESCALAS = {
    'maior':  [0, 2, 4, 5, 7, 9, 11],
    'menor':  [0, 2, 3, 5, 7, 8, 10],
    'pentatonica_maior': [0, 2, 4, 7, 9],
    'pentatonica_menor': [0, 3, 5, 7, 10],
    'cromatica': list(range(12)),
}

def hz_para_midi(hz):
    """Converte frequência Hz para número MIDI."""
    return 69 + 12 * np.log2(hz / 440.0)

def midi_para_hz(midi):
    """Converte número MIDI para frequência Hz."""
    return 440.0 * (2 ** ((midi - 69) / 12.0))

def nota_mais_proxima(midi_note, escala_notas_midi):
    """Encontra a nota mais próxima na escala."""
    if len(escala_notas_midi) == 0:
        return midi_note
    diferencas = np.abs(np.array(escala_notas_midi) - midi_note)
    return escala_notas_midi[np.argmin(diferencas)]

def gerar_notas_escala(tonica, escala):
    """Gera todas as notas MIDI de uma escala ao longo de 10 oitavas."""
    idx_tonica = NOTAS.index(tonica)
    intervalos = ESCALAS.get(escala, ESCALAS['cromatica'])
    notas = []
    for oitava in range(-1, 9):
        for intervalo in intervalos:
            midi = (oitava + 1) * 12 + idx_tonica + intervalo
            notas.append(midi)
    return notas

def autotune(y, sr, tonica='C', escala='cromatica', strength=1.0, smoothing=0.0):
    """
    Aplica auto-tune na voz.
    
    Parâmetros:
        y         : array de áudio
        sr        : sample rate
        tonica    : nota tônica (ex: 'C', 'A#')
        escala    : tipo de escala
        strength  : intensidade do efeito (0.0 a 1.0)
        smoothing : suavização da correção (0.0 = robótico, 1.0 = suave)
    """
    # Detecta o pitch frame a frame
    frame_length = 2048
    hop_length = 512

    f0, voiced_flag, voiced_probs = librosa.pyin(
        y,
        fmin=librosa.note_to_hz('C2'),
        fmax=librosa.note_to_hz('C7'),
        sr=sr,
        frame_length=frame_length,
        hop_length=hop_length
    )

    notas_escala = gerar_notas_escala(tonica, escala)
    
    # Calcula os shifts necessários frame a frame
    shifts = np.zeros(len(f0))
    for i, freq in enumerate(f0):
        if voiced_flag[i] and freq > 0 and not np.isnan(freq):
            midi_atual = hz_para_midi(freq)
            midi_alvo = nota_mais_proxima(midi_atual, notas_escala)
            diferenca = midi_alvo - midi_atual
            shifts[i] = diferenca * strength

    # Suavização dos shifts (evita artefatos)
    if smoothing > 0:
        from scipy.ndimage import uniform_filter1d
        window = max(1, int(smoothing * 20))
        shifts = uniform_filter1d(shifts, size=window)

    # Shift médio para aplicar com pyrubberband
    shift_semitones = float(np.nanmean(shifts[voiced_flag]))
    
    if abs(shift_semitones) < 0.01:
        return y

    # Aplica o pitch shift com pyrubberband (qualidade alta)
    y_afinado = pyrb.pitch_shift(y, sr, shift_semitones)
    
    return y_afinado


def aplicar_efeitos(y, sr, reverb=0.0, chorus=False, compressor=True):
    """Aplica efeitos opcionais com pedalboard."""
    board = Pedalboard([])
    
    if compressor:
        board.append(Compressor(threshold_db=-20, ratio=4))
    
    if chorus:
        board.append(Chorus())
    
    if reverb > 0:
        board.append(Reverb(room_size=reverb))
    
    board.append(Gain(gain_db=2))

    y_float32 = y.astype(np.float32)
    y_processado = board(y_float32, sr)
    return y_processado


# ─── ROTAS ───────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/processar', methods=['POST'])
def processar():
    if 'audio' not in request.files:
        return jsonify({'erro': 'Nenhum arquivo enviado'}), 400

    arquivo = request.files['audio']
    if arquivo.filename == '' or not allowed_file(arquivo.filename):
        return jsonify({'erro': 'Arquivo inválido'}), 400

    # Parâmetros do formulário
    tonica    = request.form.get('tonica', 'C')
    escala    = request.form.get('escala', 'cromatica')
    strength  = float(request.form.get('strength', 1.0))
    smoothing = float(request.form.get('smoothing', 0.0))
    reverb    = float(request.form.get('reverb', 0.0))
    chorus    = request.form.get('chorus', 'false') == 'true'
    compressor = request.form.get('compressor', 'true') == 'true'

    # Salva o arquivo original
    ext = arquivo.filename.rsplit('.', 1)[1].lower()
    nome_original = f"{uuid.uuid4()}.{ext}"
    caminho_original = os.path.join(app.config['UPLOAD_FOLDER'], nome_original)
    arquivo.save(caminho_original)

    # Processa o áudio
    try:
        y, sr = librosa.load(caminho_original, sr=None, mono=True)
        
        # Auto-tune
        y_afinado = autotune(y, sr, tonica=tonica, escala=escala,
                             strength=strength, smoothing=smoothing)
        
        # Efeitos
        y_final = aplicar_efeitos(y_afinado, sr, reverb=reverb,
                                   chorus=chorus, compressor=compressor)

        # Salva o resultado
        nome_saida = f"veneno_{uuid.uuid4()}.wav"
        caminho_saida = os.path.join(app.config['PROCESSED_FOLDER'], nome_saida)
        sf.write(caminho_saida, y_final, sr)

        return jsonify({
            'sucesso': True,
            'arquivo': nome_saida,
            'url': f'/download/{nome_saida}'
        })

    except Exception as e:
        return jsonify({'erro': str(e)}), 500


@app.route('/download/<nome_arquivo>')
def download(nome_arquivo):
    return send_from_directory(app.config['PROCESSED_FOLDER'], nome_arquivo)


if __name__ == '__main__':
    os.makedirs('uploads', exist_ok=True)
    os.makedirs('processed', exist_ok=True)
    app.run(debug=True, port=5000)
