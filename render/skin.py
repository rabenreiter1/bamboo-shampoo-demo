# Bakes the seamless skin of a fresh bamboo culm (journey ch6: the piece that is cut out): albedo + height/roughness,
# wrapping cleanly around the tube (the pattern lives on a cylinder in 3D, so u = 0 and u = 1 meet).
import bpy, math, os, sys
sys.path.insert(0, os.path.dirname(__file__)); import common
job, chunk, out = common.args(); P = job.get('params', {}); RES = P.get('res', 1024); os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True); S = bpy.context.scene; S.render.engine = 'CYCLES'; S.cycles.device = 'CPU'; S.cycles.samples = 8
bpy.ops.mesh.primitive_plane_add(size=2); ob = bpy.context.object      # default UVs 0..1
m = bpy.data.materials.new('skin'); m.use_nodes = True; nt = m.node_tree; N = nt.nodes; L = nt.links; N.clear(); ob.data.materials.append(m)
def n(kind, **kw):
    x = N.new(kind)
    for k, v in kw.items(): setattr(x, k, v)
    return x
def math_(op, a=None, b=None):
    x = n('ShaderNodeMath', operation=op)
    for i, v in enumerate((a, b)):
        if v is None: continue
        if isinstance(v, (int, float)): x.inputs[i].default_value = v
        else: L.new(v, x.inputs[i])
    return x.outputs[0]
tc = n('ShaderNodeTexCoord'); sp = n('ShaderNodeSeparateXYZ'); L.new(tc.outputs['UV'], sp.inputs[0])
ang = math_('MULTIPLY', sp.outputs['X'], 2 * math.pi); R = P.get('radius', 1.); HH = P.get('height', 7.5)      # in radii: 29 mm radius, ~218 mm tall
cx = math_('MULTIPLY', math_('COSINE', ang), R); cy = math_('MULTIPLY', math_('SINE', ang), R); cz = math_('MULTIPLY', sp.outputs['Y'], HH)
cyl = n('ShaderNodeCombineXYZ'); L.new(cx, cyl.inputs[0]); L.new(cy, cyl.inputs[1]); L.new(cz, cyl.inputs[2])
def noise(scale, sx, sz, detail=5, rough=.55, seed=0.):
    mp = n('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (sx, sx, sz); mp.inputs['Location'].default_value = (seed, seed * 1.7, seed * .3); L.new(cyl.outputs[0], mp.inputs['Vector'])
    z = n('ShaderNodeTexNoise'); z.inputs['Scale'].default_value = scale; z.inputs['Detail'].default_value = detail; z.inputs['Roughness'].default_value = rough; L.new(mp.outputs[0], z.inputs['Vector']); return z.outputs['Fac']
def ramp(fac, stops):
    r = n('ShaderNodeValToRGB'); e = r.color_ramp.elements
    while len(e) < len(stops): e.new(.5)
    for el, (p, c) in zip(e, stops): el.position = p; el.color = (*c, 1)
    L.new(fac, r.inputs['Fac']); return r.outputs['Color']
def mix(fac, a, b, blend='MIX'):
    x = n('ShaderNodeMixRGB', blend_type=blend)
    if isinstance(fac, (int, float)): x.inputs['Fac'].default_value = fac
    else: L.new(fac, x.inputs['Fac'])
    for i, v in ((1, a), (2, b)):
        if isinstance(v, tuple): x.inputs[i].default_value = (*v, 1)
        else: L.new(v, x.inputs[i])
    return x.outputs[0]
fib = noise(1., 26, .55, 6, .6)                    # long fibres running up the culm
fine = noise(1., 85, 1.4, 4, .65, 3.)              # the finest striation
blot = noise(1., 1.6, .9, 4, .5, 7.)               # broad, soft mottling (sun side yellower)
speck = noise(1., 38, 30, 2, .5, 11.)              # pores / specks
base = ramp(fib, [(.25, (.060, .190, .022)), (.5, (.105, .285, .040)), (.78, (.170, .380, .062))])
base = mix(math_('MULTIPLY', ramp(blot, [(.35, (0, 0, 0)), (.75, (1, 1, 1))]), .45), base, (.26, .40, .07))            # yellow-green patches
base = mix(math_('MULTIPLY', ramp(fine, [(.3, (1, 1, 1)), (.62, (0, 0, 0))]), .22), base, (.035, .12, .015))            # dark hairlines
base = mix(math_('MULTIPLY', ramp(speck, [(.70, (0, 0, 0)), (.76, (1, 1, 1))]), .3), base, (.05, .09, .02))             # specks
wax = noise(1., 3.2, 2.2, 5, .6, 17.)                                                                                 # the pale waxy bloom, in soft clouds
base = mix(math_('MULTIPLY', ramp(wax, [(.45, (0, 0, 0)), (.8, (1, 1, 1))]), .16), base, (.55, .66, .50))
# height (R) and roughness (G) in one picture
hgt = math_('ADD', math_('MULTIPLY', fib, .6), math_('MULTIPLY', fine, .4))
rgh = math_('ADD', .34, math_('MULTIPLY', ramp(wax, [(.45, (0, 0, 0)), (.8, (1, 1, 1))]), .3))
hr = n('ShaderNodeCombineColor'); L.new(hgt, hr.inputs[0]); L.new(rgh, hr.inputs[1])
em = n('ShaderNodeEmission'); o = n('ShaderNodeOutputMaterial'); L.new(em.outputs[0], o.inputs['Surface'])
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
for name, src, cs in (('albedo', base, 'sRGB'), ('hr', hr.outputs[0], 'Non-Color')):
    img = bpy.data.images.new(name, RES, RES, alpha=False); img.colorspace_settings.name = cs
    tx = n('ShaderNodeTexImage'); tx.image = img; N.active = tx
    for l in list(em.inputs['Color'].links): L.remove(l)
    L.new(src, em.inputs['Color'])
    bpy.ops.object.bake(type='EMIT')
    img.filepath_raw = os.path.abspath(os.path.join(out, f'keep_culm-{name}.png')); img.file_format = 'PNG'; img.save(); N.remove(tx)
    print('[bake]', name, flush=True)
open(os.path.join(out, f'chunk{chunk}.log'), 'w').write('skin baked')
