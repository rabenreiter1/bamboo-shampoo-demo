# shared by the render scripts: job/chunk arguments, frame selection, output
import bpy, json, os, sys, time
def args():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    g = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    job = json.load(open(g('--job', 'render/job.json')))
    return job, int(g('--chunk', 0)), g('--out', 'out')
def frames_for(job, chunk):
    fr = job.get('frames') or list(range(job.get('start', 0), job.get('end', 0) + 1, job.get('step', 1)))
    n = job.get('chunks', 1)
    return [f for i, f in enumerate(fr) if i % n == chunk]
def render_frames(scene, frames, out, tag='', fmt='JPEG', quality=95):
    os.makedirs(out, exist_ok=True); scene.render.image_settings.file_format = fmt
    if fmt == 'JPEG': scene.render.image_settings.quality = quality
    t0 = time.time(); times = []
    for f in frames:
        t = time.time(); scene.frame_set(f); scene.render.filepath = os.path.abspath(os.path.join(out, f'{tag}f{f:04d}')); bpy.ops.render.render(write_still=True); times.append(time.time() - t)
        print(f'[render] {tag} frame {f} {times[-1]:.1f}s', flush=True)
    return times
