"""Озвучка сказок из tales.json бесплатным голосом Piper (ka_GE-natia).
Позже этот скрипт заменим на ElevenLabs — формат файлов останется тем же.
Запуск: python3 tools/make_audio.py <путь к ka_GE-natia-medium.onnx>"""
import json, subprocess, sys, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
model = sys.argv[1]
for tale in json.loads((root / "tales.json").read_text()):
    wav = root / "audio" / f"{tale['id']}.wav"
    mp3 = root / "audio" / f"{tale['id']}.mp3"
    # length_scale > 1 — читаем медленнее, спокойнее, как перед сном
    subprocess.run([sys.executable, "-m", "piper", "-m", model, "-f", str(wav), "-af", "loudnorm",
                    "--length-scale", "1.2", "--sentence-silence", "0.6"],
                   input=tale["text"].encode(), check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-af", "loudnorm",
                    "-ac", "1", "-b:a", "64k", str(mp3)], check=True)
    wav.unlink()
    print("ok", mp3.name)
