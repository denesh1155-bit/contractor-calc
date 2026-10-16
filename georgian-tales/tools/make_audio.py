"""Озвучка сказок из tales.json бесплатным голосом Piper (ka_GE-natia).
Позже этот скрипт заменим на ElevenLabs — формат файлов останется тем же.
Запуск: python3 tools/make_audio.py <путь к ka_GE-natia-medium.onnx>"""
import json, subprocess, sys, pathlib, wave
from piper import PiperVoice, SynthesisConfig

root = pathlib.Path(__file__).resolve().parent.parent
voice = PiperVoice.load(sys.argv[1])
# length_scale > 1 — читаем медленнее, спокойнее, как перед сном
config = SynthesisConfig(length_scale=1.2)
SENTENCE_PAUSE, PARAGRAPH_PAUSE = 0.5, 1.0  # секунды тишины

for tale in json.loads((root / "tales.json").read_text()):
    wav = root / "audio" / f"{tale['id']}.wav"
    mp3 = root / "audio" / f"{tale['id']}.mp3"
    with wave.open(str(wav), "wb") as out:
        rate = voice.config.sample_rate
        out.setnchannels(1); out.setsampwidth(2); out.setframerate(rate)
        silence = lambda sec: b"\x00\x00" * int(rate * sec)
        for paragraph in tale["text"].split("\n\n"):
            for chunk in voice.synthesize(paragraph, config):
                out.writeframes(chunk.audio_int16_bytes + silence(SENTENCE_PAUSE))
            out.writeframes(silence(PARAGRAPH_PAUSE - SENTENCE_PAUSE))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav),
                    "-ac", "1", "-b:a", "64k", str(mp3)], check=True)
    wav.unlink()
    print("ok", mp3.name)
