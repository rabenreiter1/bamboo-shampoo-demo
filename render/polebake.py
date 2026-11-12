# The bamboo pole's skin, baked flat for the journey's LIVE 3D pole and piece (three.js): what the Blender culm wears,
# unwrapped — x = once round the pole (seamless: the noise is sampled on the cylinder), y = Z0 … Z0 + SPAN mm along it.
# Variant "a_": the colour (albedo). Variant "h_": the relief (height, grey) — the normal map is made from it afterwards.
# Nodes (mm above the piece's bottom cut) at NODES: a dry sheath scar on each ridge, a pale waxy band under it.
import bpy, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common
job, chunk, out = common.args(); P = job.get('params', {})
Z0, SPAN, NODES = -215., 600., [-193., 4., 190., 393.]
W, H = P.get('w', 1024), P.get('h', 4096)

def build(kind):
    bpy.ops.wm.read_factory_settings(use_empty=True); S = bpy.context.scene
    S.render.engine = 'CYCLES'; S.cycles.device = 'CPU'; S.cycles.samples = 4; S.cycles.use_denoising = False; S.cycles.max_bounces = 0
    S.render.resolution_x, S.render.resolution_y = W, H; S.render.resolution_percentage = 100; S.render.film_transparent = False
    S.view_settings.view_transform = 'Standard'; S.view_settings.look = 'None'; S.render.filter_size = 1.0
    asp = H / W
    bpy.ops.mesh.primitive_plane_add(size=1); pl = bpy.context.object; pl.scale = (1, asp, 1); bpy.ops.object.transform_apply(scale=True)   # x −.5….5, y −asp/2…asp/2
    cd = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cd); S.collection.objects.link(cam); S.camera = cam
    cd.type = 'ORTHO'; cd.ortho_scale = asp; cam.location = (0, 0, 5); cd.sensor_fit = 'VERTICAL'
    w = bpy.data.worlds.new('w'); S.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0
    m = bpy.data.materials.new('skin'); m.use_nodes = True; nt = m.node_tree; N = nt.nodes; L = nt.links; N.clear(); pl.data.materials.append(m)
    def nd(kindn, **kw):
        x = N.new(kindn)
        for k, v in kw.items(): setattr(x, k, v)
        return x
    def val(op, a=None, b=None):
        x = nd('ShaderNodeMath', operation=op)
        for i, v in enumerate((a, b)):
            if v is None: continue
            if isinstance(v, (int, float)): x.inputs[i].default_value = v
            else: L.new(v, x.inputs[i])
        return x.outputs[0]
    tc = nd('ShaderNodeTexCoord'); sp = nd('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], sp.inputs[0])
    ang = val('MULTIPLY', val('ADD', sp.outputs['X'], .5), 2 * math.pi)
    zmm = val('ADD', val('MULTIPLY', val('ADD', val('DIVIDE', sp.outputs['Y'], asp), .5), SPAN), Z0)
    cv = nd('ShaderNodeCombineXYZ'); L.new(val('COSINE', ang), cv.inputs[0]); L.new(val('SINE', ang), cv.inputs[1]); L.new(val('DIVIDE', zmm, 29.), cv.inputs[2]); vec = cv.outputs[0]
    def noise(sx, sz, detail=5, rough=.55, seed=0.):
        mp = nd('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (sx, sx, sz); mp.inputs['Location'].default_value = (seed, seed * 1.7, seed * .3); L.new(vec, mp.inputs['Vector'])
        z = nd('ShaderNodeTexNoise'); z.inputs['Scale'].default_value = 1.; z.inputs['Detail'].default_value = detail; z.inputs['Roughness'].default_value = rough; L.new(mp.outputs[0], z.inputs['Vector']); return z.outputs['Fac']
    def ramp(fac, stops):
        r = nd('ShaderNodeValToRGB'); e = r.color_ramp.elements
        while len(e) < len(stops): e.new(.5)
        for el, (p, c) in zip(e, stops): el.position = p; el.color = (*c, 1)
        L.new(fac, r.inputs['Fac']); return r.outputs['Color']
    def mixc(fac, a, b):
        x = nd('ShaderNodeMixRGB', blend_type='MIX')
        if isinstance(fac, (int, float)): x.inputs['Fac'].default_value = fac
        else: L.new(fac, x.inputs['Fac'])
        for i, v in ((1, a), (2, b)):
            if isinstance(v, tuple): x.inputs[i].default_value = (*v, 1)
            else: L.new(v, x.inputs[i])
        return x.outputs[0]
    fib = noise(26, .45, 6, .6); fine = noise(90, 1.2, 4, .65, 3.); blot = noise(1.5, .8, 4, .5, 7.); wax = noise(3., 2., 5, .6, 17.); streak = noise(8, .22, 3, .5, 31.); pores = noise(260, 2.2, 3, .7, 41.)
    base = ramp(fib, [(.2, (.035, .16, .006)), (.5, (.07, .25, .012)), (.85, (.13, .36, .02))])
    base = mixc(val('MULTIPLY', ramp(streak, [(.35, (1, 1, 1)), (.7, (0, 0, 0))]), .5), base, (.02, .09, .005))
    base = mixc(val('MULTIPLY', ramp(blot, [(.3, (0, 0, 0)), (.8, (1, 1, 1))]), .35), base, (.21, .37, .03))
    base = mixc(val('MULTIPLY', ramp(fine, [(.3, (1, 1, 1)), (.65, (0, 0, 0))]), .12), base, (.03, .11, .01))
    base = mixc(val('MULTIPLY', ramp(wax, [(.35, (0, 0, 0)), (.9, (1, 1, 1))]), .12), base, (.5, .66, .44))
    scar = None; band = None; ridge = None
    for nh in NODES:
        nz = val('SUBTRACT', zmm, nh); wob = val('MULTIPLY', val('SUBTRACT', noise(5, 0., 3, .5, 53.), .5), 2.2)      # the scar line is not ruler-straight
        az = val('ABSOLUTE', val('ADD', nz, wob))
        s1 = ramp(val('MULTIPLY', az, .01), [(0., (1, 1, 1)), (.016, (1, 1, 1)), (.04, (0, 0, 0))])
        b1 = ramp(val('MULTIPLY', val('ADD', nz, 15.), .01), [(0., (0, 0, 0)), (.05, (1, 1, 1)), (.11, (1, 1, 1)), (.145, (0, 0, 0))])
        r1 = ramp(val('MULTIPLY', az, .01), [(0., (1, 1, 1)), (.06, (0, 0, 0))])
        scar = s1 if scar is None else val('MAXIMUM', scar, s1); band = b1 if band is None else val('MAXIMUM', band, b1); ridge = r1 if ridge is None else val('MAXIMUM', ridge, r1)
    scarn = noise(40, 6., 3, .6, 23.)
    base = mixc(val('MULTIPLY', band, .3), base, (.62, .72, .52))
    base = mixc(val('MULTIPLY', scar, val('ADD', .6, val('MULTIPLY', scarn, .4))), base, (.62, .42, .13))
    hgt = val('ADD', val('ADD', val('MULTIPLY', fib, .5), val('MULTIPLY', fine, .3)), val('ADD', val('MULTIPLY', pores, .2), val('MULTIPLY', val('MULTIPLY', scar, scarn), .5)))
    em = nd('ShaderNodeEmission'); outn = nd('ShaderNodeOutputMaterial'); L.new(em.outputs[0], outn.inputs['Surface'])
    if kind == 'a': L.new(base, em.inputs['Color'])
    else:
        g = nd('ShaderNodeCombineXYZ'); hv = val('MULTIPLY', hgt, .55)
        for i in range(3): L.new(hv, g.inputs[i])
        L.new(g.outputs[0], em.inputs['Color'])
    return S

log = []
for vnt in job['variants']:
    S = build(vnt['kind']); t = common.render_frames(S, [0], out, tag=vnt['tag'], fmt='PNG'); log.append(f"{vnt['tag']} bake {t[0]:.0f}s")
os.makedirs(out, exist_ok=True); open(os.path.join(out, f'chunk-{chunk}.log'), 'w').write('\n'.join(log) + '\n')
