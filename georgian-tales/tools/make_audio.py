"""Озвучка сказок из tales.json бесплатным голосом Piper (ka_GE-natia).
Позже этот скрипт заменим на ElevenLabs — формат файлов останется тем же.
Запуск: python3 tools/make_audio.py <путь к ka_GE-natia-medium.onnx>"""
import hashlib, json, re, subprocess, sys, pathlib, wave
from piper import PiperVoice, SynthesisConfig

root = pathlib.Path(__file__).resolve().parent.parent
voice = PiperVoice.load(sys.argv[1])
# length_scale > 1 — читаем медленнее; сказки перед сном (pace в tales.json) ещё медленнее и с длинными паузами

timings_file, hashes_file = root / "audio" / "timings.json", root / "audio" / "hashes.json"
old_timings = json.loads(timings_file.read_text()) if timings_file.exists() else {}
hashes = json.loads(hashes_file.read_text()) if hashes_file.exists() else {}
timings = {}  # секунда, с которой начинается каждый абзац и каждое предложение — по ним играет мультик
# предложения режем так же, как приложение (sentencesOf в index.html), чтобы кадры совпадали с голосом
sentences = lambda p: [x.strip() for x in re.findall(r'[^.!?…]+(?:[.!?…]+|$)', p) if len(x.strip()) > 1]
VERSION = 'sents2'
for tale in json.loads((root / "tales.json").read_text()):
    # сказку, текст которой не менялся, заново не озвучиваем
    digest = hashlib.sha1((tale["text"] + str(tale.get("pace")) + VERSION).encode()).hexdigest()
    if hashes.get(tale["id"]) == digest and tale["id"] in old_timings and (root / "audio" / f"{tale['id']}.mp3").exists():
        timings[tale["id"]] = old_timings[tale["id"]]
        continue
    wav = root / "audio" / f"{tale['id']}.wav"
    mp3 = root / "audio" / f"{tale['id']}.mp3"
    slow = "pace" in tale
    config = SynthesisConfig(length_scale=tale.get("pace", 1.2))
    SENTENCE_PAUSE, PARAGRAPH_PAUSE = (0.9, 2.2) if slow else (0.5, 1.0)  # секунды тишины
    starts, sents = [], []
    with wave.open(str(wav), "wb") as out:
        rate = voice.config.sample_rate
        out.setnchannels(1); out.setsampwidth(2); out.setframerate(rate)
        silence = lambda sec: b"\x00\x00" * int(rate * sec)
        for paragraph in tale["text"].split("\n\n"):
            starts.append(round(out.tell() / rate, 2))
            row = []
            for sentence in sentences(paragraph) or [paragraph]:
                row.append(round(out.tell() / rate, 2))
                for chunk in voice.synthesize(sentence, config):
                    out.writeframes(chunk.audio_int16_bytes)
                out.writeframes(silence(SENTENCE_PAUSE))
            sents.append(row)
            out.writeframes(silence(PARAGRAPH_PAUSE - SENTENCE_PAUSE))
    timings[tale["id"]] = {"starts": starts, "sents": sents, "duration": None}
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav),
                    "-ac", "1", "-b:a", "32k", str(mp3)], check=True)
    wav.unlink()
    timings[tale["id"]]["duration"] = round(float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(mp3)], capture_output=True, text=True).stdout), 1)
    hashes[tale["id"]] = digest
    print("ok", mp3.name)

timings_file.write_text(json.dumps(timings))
hashes_file.write_text(json.dumps(hashes))
