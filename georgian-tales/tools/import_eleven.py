"""Кладёт в приложение озвучку из ElevenLabs (голос Кетеван) вместо Piper.
Запуск: python3 tools/import_eleven.py <id сказки> <файл.mp3> [<id> <файл.mp3> ...]
ElevenLabs отдаёт одну цельную запись без разметки, поэтому начала предложений находим по паузам:
для каждой границы предложений берём паузу рядом с местом, где она должна быть по длине текста.
Хэш текста записываем такой же, как в make_audio.py, — Piper эту сказку больше не перезапишет,
пока её текст не поменяется."""
import hashlib, json, re, subprocess, sys, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
tales = {t["id"]: t for t in json.loads((root / "tales.json").read_text())}
timings_file, hashes_file = root / "audio" / "timings.json", root / "audio" / "hashes.json"
timings, hashes = json.loads(timings_file.read_text()), json.loads(hashes_file.read_text())
sentences = lambda p: [x.strip() for x in re.findall(r'[^.!?…]+(?:[.!?…]+|$)', p) if len(x.strip()) > 1]
VERSION = 'sents2'  # как в make_audio.py

def pauses(mp3):
    log = subprocess.run(["ffmpeg", "-i", str(mp3), "-af", "silencedetect=noise=-38dB:d=0.18", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
    return list(zip(starts, ends))

for tid, src in zip(sys.argv[1::2], sys.argv[2::2]):
    tale, mp3 = tales[tid], root / "audio" / f"{tid}.mp3"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-ac", "1", "-b:a", "32k", str(mp3)], check=True)
    duration = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(mp3)],
                                    capture_output=True, text=True).stdout)
    paras = [sentences(p) or [p] for p in tale["text"].split("\n\n")]
    flat = [s for p in paras for s in p]
    gaps = pauses(mp3)
    first = gaps[0][1] if gaps and gaps[0][0] < 0.05 else 0.0
    last = gaps[-1][0] if gaps and gaps[-1][1] >= duration - 0.05 else duration
    total = sum(len(s) for s in flat)
    starts, done, prev = [round(max(0, first - .05), 2)], 0, first
    for s in flat[:-1]:
        done += len(s)
        guess = first + (last - first) * done / total
        cands = [g for g in gaps if g[0] > prev + .5 and abs(g[1] - guess) < 9]
        best = max(cands, key=lambda g: (g[1] - g[0]) - abs(g[1] - guess) * .08, default=None)
        t = best[1] if best else guess
        starts.append(round(max(0, t - .05), 2)); prev = t
    sents, i = [], 0
    for p in paras:
        sents.append(starts[i:i + len(p)]); i += len(p)
    timings[tid] = {"starts": [row[0] for row in sents], "sents": sents, "duration": round(duration, 1), "voice": "ketevan"}
    hashes[tid] = hashlib.sha1((tale["text"] + str(tale.get("pace")) + VERSION).encode()).hexdigest()
    print("ok", tid, round(duration, 1), "s,", len(flat), "sentences")

timings_file.write_text(json.dumps(timings))
hashes_file.write_text(json.dumps(hashes))
