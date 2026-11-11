# collect.py <job.json> <parts dir> <result dir>: frames → mp4 (+ contact sheet, a few stills, a log)
import json, os, subprocess, sys, glob, shutil
job = json.load(open(sys.argv[1])); parts, res = sys.argv[2], sys.argv[3]; os.makedirs(res, exist_ok=True)
log = []
for v in job.get('variants', [{'tag': ''}]):
    tag = v.get('tag', ''); fr = sorted(glob.glob(os.path.join(parts, '**', f'{tag}f*.jpg'), recursive=True) + glob.glob(os.path.join(parts, '**', f'{tag}f*.png'), recursive=True))
    log.append(f'{tag or "main"}: {len(fr)} frames')
    if not fr: continue
    tmp = f'/tmp/seq-{tag}'; shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
    ext = os.path.splitext(fr[0])[1]
    for i, f in enumerate(fr): shutil.copy(f, f'{tmp}/{i:05d}{ext}')
    n = len(fr); cols = min(n, job.get('sheet_cols', 6)); rows = (n + cols - 1) // cols; step = max(1, n // 36)
    sw = job.get('sheet_w', 320)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f'{tmp}/%05d{ext}', '-vf', f"select='not(mod(n\\,{step}))',scale={sw}:-1,tile={cols}x{(n // step + cols) // cols}", '-frames:v', '1', '-q:v', '3', f'{res}/{tag}sheet.jpg'])
    for k in job.get('stills', []):
        if k < n: subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f'{tmp}/{k:05d}{ext}', '-q:v', '2', f'{res}/{tag}still-{k:04d}.jpg'])
    if job.get('encode', True) and n > 8:
        fps = str(job.get('fps', 30)); crf = str(job.get('crf', 20))
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', fps, '-i', f'{tmp}/%05d{ext}', '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-pix_fmt', 'yuv420p', '-g', '12', '-movflags', '+faststart', '-an', f'{res}/{tag}clip.mp4'])
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', fps, '-i', f'{tmp}/%05d{ext}', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', str(int(crf) + 12), '-row-mt', '1', '-g', '12', '-an', f'{res}/{tag}clip.webm'])
for f in glob.glob(os.path.join(parts, '**', '*.log'), recursive=True): log.append(open(f).read().strip())
open(f'{res}/log.txt', 'w').write('\n'.join(log) + '\n'); print('\n'.join(log))
