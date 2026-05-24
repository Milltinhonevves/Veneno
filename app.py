import os
import uuid
import io
import numpy as np
import librosa
import soundfile as sf
from flask import Flask, request, jsonify, render_template, send_from_directory
from pedalboard import Pedalboard, Chorus, Reverb, Compressor, Gain
import traceback

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['PROCESSED_FOLDER'] = 'processed'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

def converter_para_wav(caminho_entrada, caminho_saida):
    """Converte qualquer formato para WAV usando pydub"""
    from pydub import AudioSegment
    audio = AudioSegment.from_file(caminho_entrada)
    audio = audio.set_channels(1).set_frame_rate(44100)
    audio.export(caminho_saida, format="wav")

NOTAS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
ESCALAS = {
    'maior':  [0, 2, 4, 5, 7, 9, 11],
    'menor':  [0, 2, 3, 5, 7, 8, 10],
    'pentatonica_maior': [0, 2, 4, 7, 9],
    'pentatonica_menor': [0, 3, 5, 7, 10],
    'cromatica': list(range(12)),
}

def hz_para_midi(hz):
    return 69 + 12 * np.log2(hz / 440.0)

def nota_mais_proxima(midi_note, escala_notas_midi):
    if len(escala_notas_midi) == 0:
        return midi_note
    diferencas = np.abs(np.array(escala_notas_midi) - midi_note)
    return escala_notas_midi[np.argmin(diferencas)]

def gerar_notas_escala(tonica, escala):
    idx_tonica = NOTAS.index(tonica)
    intervalos = ESCALAS.get(escala, ESCALAS['cromatica'])
    notas = []
    for oitava in range(-1, 9):
        for intervalo in intervalos:
            midi = (oitava + 1) * 12 + idx_tonica + intervalo
            notas.append(midi)
    return notas

def autotune(y, sr, tonica='C', escala='cromatica', strength=1.0, smoothing=0.0):
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
    shifts = np.zeros(len(f0))

    for i, freq in enumerate(f0):
        if voiced_flag[i] and freq is not None and freq > 0 and not np.isnan(freq):
            midi_atual = hz_para_midi(freq)
            midi_alvo = nota_mais_proxima(midi_atual, notas_escala)
            shifts[i] = (midi_alvo - midi_atual) * strength

    if smoothing > 0:
        from scipy.ndimage import uniform_filter1d
        window = max(1, int(smoothing * 20))
        shifts = uniform_filter1d(shifts, size=window)

    voiced_shifts = shifts[voiced_flag]
    if len(voiced_shifts) == 0 or np.all(np.isnan(voiced_shifts)):
        return y

    shift_semitones = float(np.nanmean(voiced_shifts))
    if abs(shift_semitones) < 0.01:
        return y

    return librosa.effects.pitch_shift(y, sr=sr, n_steps=shift_semitones)

def aplicar_efeitos(y, sr, reverb=0.0, chorus=False, compressor=True):
    board = Pedalboard([])
    if compressor:
        board.append(Compressor(threshold_db=-20, ratio=4))
    if chorus:
        board.append(Chorus())
    if reverb > 0:
        board.append(Reverb(room_size=reverb))
    board.append(Gain(gain_db=2))
    return board(y.astype(np.float32), sr)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/processar', methods=['POST'])
def processar():
    if 'audio' not in request.files:
        return jsonify({'erro': 'Nenhum arquivo enviado'}), 400

    arquivo = request.files['audio']

    tonica     = request.form.get('tonica', 'C')
    escala     = request.form.get('escala', 'cromatica')
    strength   = float(request.form.get('strength', 1.0))
    smoothing  = float(request.form.get('smoothing', 0.0))
    reverb     = float(request.form.get('reverb', 0.0))
    chorus     = request.form.get('chorus', 'false') == 'true'
    compressor = request.form.get('compressor', 'true') == 'true'

    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['PROCESSED_FOLDER'], exist_ok=True)

    uid = str(uuid.uuid4())
    caminho_temp = os.path.join(app.config['UPLOAD_FOLDER'], f"{uid}_orig")
    caminho_wav  = os.path.join(app.config['UPLOAD_FOLDER'], f"{uid}.wav")

    arquivo.save(caminho_temp)

    try:
        converter_para_wav(caminho_temp, caminho_wav)
    except Exception as e:
        print("ERRO conversão:", traceback.format_exc())
        return jsonify({'erro': f'Não foi possível ler o áudio: {str(e)}'}), 400
    finally:
        try: os.remove(caminho_temp)
        except: pass

    try:
        y, sr = librosa.load(caminho_wav, sr=None, mono=True)

        if len(y) == 0:
            return jsonify({'erro': 'Áudio vazio, grave novamente.'}), 400

        y_afinado = autotune(y, sr, tonica=tonica, escala=escala,
                             strength=strength, smoothing=smoothing)
        y_final   = aplicar_efeitos(y_afinado, sr, reverb=reverb,
                                    chorus=chorus, compressor=compressor)

        nome_saida    = f"veneno_{uuid.uuid4()}.wav"
        caminho_saida = os.path.join(app.config['PROCESSED_FOLDER'], nome_saida)
        sf.write(caminho_saida, y_final, sr)

        return jsonify({'sucesso': True, 'arquivo': nome_saida, 'url': f'/download/{nome_saida}'})

    except Exception as e:
        print("ERRO processamento:", traceback.format_exc())
        return jsonify({'erro': f'Erro ao processar: {str(e)}'}), 500
    finally:
        try: os.remove(caminho_wav)
        except: pass

@app.route('/download/<nome_arquivo>')
def download(nome_arquivo):
    return send_from_directory(app.config['PROCESSED_FOLDER'], nome_arquivo)

if __name__ == '__main__':
    os.makedirs('uploads', exist_ok=True)
    os.makedirs('processed', exist_ok=True)
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
