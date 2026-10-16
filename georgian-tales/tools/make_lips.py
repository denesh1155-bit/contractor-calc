# loudness track of each narration: one digit 0-9 per 80 ms, for the cartoon's lips
import json, subprocess, sys, glob, os, array
out = {}
for f in sorted(glob.glob('audio/*.mp3')):
    pcm = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', f, '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], capture_output=True).stdout
    a = array.array('h', pcm); step = 640; vals = []
    for i in range(0, len(a), step):
        seg = a[i:i + step]; rms = (sum(x * x for x in seg) / max(1, len(seg))) ** .5 / 32768
        vals.append(rms)
    peak = sorted(vals)[int(len(vals) * .97)] or 1
    out[os.path.basename(f)[:-4]] = ''.join(str(min(9, int(max(0, v / peak - .08) * 11))) for v in vals)
json.dump(out, open('audio/lips.json', 'w'), separators=(',', ':'))
print(len(out), os.path.getsize('audio/lips.json'))
