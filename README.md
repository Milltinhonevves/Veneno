# 🐍 VENENO — Auto-tune Vocal

App de afinação vocal com auto-tune, desenvolvido por **Miltinho Neves**.

## Funcionalidades

- **Auto-tune** com detecção de pitch via `librosa.pyin`
- **Escalas**: Cromática, Maior, Menor, Pentatônica Maior/Menor
- **Suavização** ajustável (efeito robótico a efeito natural)
- **Efeitos**: Reverb, Chorus, Compressor via `pedalboard`
- **Pitch shift** de alta qualidade via `pyrubberband`

## Como rodar localmente

```bash
# Instalar dependências
pip install -r requirements.txt

# Rodar o servidor
python app.py
```

Acesse: http://localhost:5000

## Deploy (ex: Render, Railway, Heroku)

```bash
# O Procfile já está configurado para gunicorn
gunicorn app:app --workers 2 --timeout 120
```

## Estrutura

```
veneno/
├── app.py               # Backend Flask + lógica de auto-tune
├── templates/
│   └── index.html       # Frontend
├── static/
│   ├── css/style.css    # Estilo dark + verde
│   └── js/main.js       # Lógica do frontend
├── uploads/             # Áudios enviados (temporário)
├── processed/           # Áudios processados
├── requirements.txt
├── Procfile
└── README.md
```

## Formatos suportados

WAV · MP3 · OGG · FLAC · M4A (até 50MB)
