# Journey ch5–6 (the cut and the form) as one path-traced shot over the forest plate.
# A (frames 0–120): the culm stands in the forest (frame 0 = the journey's f13 picture). It is cut just BELOW a segment
#   divider, so the piece carries that divider as its natural closed bottom, with the node ring around it. The piece
#   comes out of the pole towards the camera, turns once all the way round and shows its bottom and its open top.
# B (frames 120–270, played while the visitor holds): the piece turns like on a lathe, a real turning tool takes the
#   green skin off from the top down (chips fly), then the laser writes the engraving. The last frame is the finished
#   tube exactly as the live 3D bottle takes it over.
# Units: 1 Blender unit = 100 mm. World z up; the camera looks along +y. Plate rows map to z (mm per px from the culm).
import bpy, bmesh, json, math, os, random, sys
from mathutils import Vector, Euler, Matrix
sys.path.insert(0, os.path.dirname(__file__)); import common
job, chunk, out = common.args(); P = job.get('params', {}); HERE = os.path.dirname(os.path.abspath(__file__)); TEX = os.path.join(HERE, 'tex')
U = .01                                   # mm → BU
FPS = 30; A_END = 120; B_END = 270
TUBE = json.load(open(os.path.join(TEX, 'tube.json'))); PROFILE = TUBE['profile']        # [y mm, r mm], y 0 bottom … 170 rim
FRONT_U = 221 / 516.5; PRINT_H = TUBE['engravingHeight']
clamp01 = lambda x: max(0., min(1., x)); lerp = lambda a, b, t: a + (b - a) * t
def ease(t): t = clamp01(t); return t * t * (3 - 2 * t)
def prof_r(y):
    if y <= PROFILE[0][0]: return PROFILE[0][1]
    for (y0, r0), (y1, r1) in zip(PROFILE, PROFILE[1:]):
        if y <= y1: return lerp(r0, r1, (y - y0) / max(1e-6, y1 - y0))
    return PROFILE[-1][1]

VAR = {'d': dict(res=(1280, 720), plate=(1672, 941), culm=(757, 902), node=747, frac=.66, cy=.474),
       'p': dict(res=(720, 1280), plate=(941, 1672), culm=(321, 605), node=1043, frac=.46, cy=.47)}

def build(o):
    V = VAR[o]; bpy.ops.wm.read_factory_settings(use_empty=True); S = bpy.context.scene
    S.render.engine = 'CYCLES'; S.cycles.device = 'CPU'; S.cycles.samples = job.get('samples', 64); S.cycles.use_adaptive_sampling = True; S.cycles.adaptive_threshold = job.get('noise', .03)
    S.cycles.use_denoising = True
    try: S.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception: pass
    S.render.resolution_x, S.render.resolution_y = V['res']; S.render.resolution_percentage = int(100 * job.get('scale', 1)); S.render.fps = FPS
    S.render.film_transparent = True; S.view_settings.view_transform = 'Standard'; S.view_settings.look = 'None'
    S.render.use_motion_blur = True; S.render.motion_blur_shutter = .5; S.cycles.max_bounces = 6; S.cycles.transparent_max_bounces = 12
    pw, ph = V['plate']; mm = 58. / (V['culm'][1] - V['culm'][0]); Hmm = ph * mm; cxmm = ((V['culm'][0] + V['culm'][1]) / 2 - pw / 2) * mm
    zrow = lambda y: (ph / 2 - y) * mm
    NODE = zrow(V['node']); BOT = NODE - 6.; TOP = BOT + 172.; KERF = 0.
    # ---------- camera (telephoto, like the plate)
    fov = math.radians(P.get('fov', 14.)); D = Hmm / 2 / math.tan(fov / 2)
    cd = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cd); S.collection.objects.link(cam); S.camera = cam
    cd.sensor_fit = 'VERTICAL'; cd.angle_y = fov; cd.clip_start = .5; cd.clip_end = 400
    cam.location = (0, -D * U, 0); cam.rotation_euler = (math.pi / 2, 0, 0)
    cd.dof.use_dof = True; cd.dof.aperture_fstop = P.get('fstop', .1)        # (1 BU = 100 mm: the f-number is scaled with it, this is about f/2.8)
    foc = bpy.data.objects.new('focus', None); S.collection.objects.link(foc); cd.dof.focus_object = foc

    # ---------- helpers
    def mesh_obj(name, verts, faces, smooth=True):
        me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
        if smooth:
            for p in me.polygons: p.use_smooth = True
        ob = bpy.data.objects.new(name, me); S.collection.objects.link(ob); return ob
    def lathe(name, prof, seg=128, close_start=False, close_end=False):
        """prof: [(r mm, z mm)] from one end to the other. Returns an object whose local z is the axis (mm·U)."""
        vs, fs = [], []; n = len(prof)
        for (r, z) in prof:
            for j in range(seg): a = 2 * math.pi * j / seg; vs.append((r * U * math.sin(a), -r * U * math.cos(a), z * U))   # a = 0 faces the camera (−y)
        for i in range(n - 1):
            for j in range(seg): a0 = i * seg + j; a1 = i * seg + (j + 1) % seg; fs.append((a0, a1, a1 + seg, a0 + seg))
        if close_start: vs.append((0, 0, prof[0][1] * U)); c = len(vs) - 1; fs += [(c, (j + 1) % seg, j) for j in range(seg)]
        if close_end: vs.append((0, 0, prof[-1][1] * U)); c = len(vs) - 1; b = (n - 1) * seg; fs += [(c, b + j, b + (j + 1) % seg) for j in range(seg)]
        ob = mesh_obj(name, vs, fs); bpy.context.view_layer.objects.active = ob
        m = ob.modifiers.new('es', 'EDGE_SPLIT'); m.split_angle = math.radians(40)
        return ob
    def new_mat(name):
        m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear(); return m, nt, nt.nodes, nt.links
    def nd(N, kind, **kw):
        x = N.new(kind)
        for k, v in kw.items(): setattr(x, k, v)
        return x
    def val(N, L, op, a=None, b=None):
        x = nd(N, 'ShaderNodeMath', operation=op)
        for i, v in enumerate((a, b)):
            if v is None: continue
            if isinstance(v, (int, float)): x.inputs[i].default_value = v
            else: L.new(v, x.inputs[i])
        return x.outputs[0]
    def cyl_coords(N, L):
        """object coords → (cylinder-wrapped 3D vector for seamless noise, angle u 0..1, height mm)"""
        tc = nd(N, 'ShaderNodeTexCoord'); sp = nd(N, 'ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], sp.inputs[0])
        ang = val(N, L, 'ARCTAN2', sp.outputs['X'], val(N, L, 'MULTIPLY', sp.outputs['Y'], -1))          # 0 at the camera side
        u = val(N, L, 'FRACT', val(N, L, 'ADD', val(N, L, 'DIVIDE', ang, 2 * math.pi), 1.))
        zmm = val(N, L, 'DIVIDE', sp.outputs['Z'], U)
        cv = nd(N, 'ShaderNodeCombineXYZ'); L.new(val(N, L, 'COSINE', ang), cv.inputs[0]); L.new(val(N, L, 'SINE', ang), cv.inputs[1]); L.new(val(N, L, 'DIVIDE', zmm, 29.), cv.inputs[2])
        return cv.outputs[0], u, zmm, tc
    def noise(N, L, vec, sx, sz, detail=5, rough=.55, seed=0.):
        mp = nd(N, 'ShaderNodeMapping'); mp.inputs['Scale'].default_value = (sx, sx, sz); mp.inputs['Location'].default_value = (seed, seed * 1.7, seed * .3); L.new(vec, mp.inputs['Vector'])
        z = nd(N, 'ShaderNodeTexNoise'); z.inputs['Scale'].default_value = 1.; z.inputs['Detail'].default_value = detail; z.inputs['Roughness'].default_value = rough; L.new(mp.outputs[0], z.inputs['Vector']); return z.outputs['Fac']
    def ramp(N, L, fac, stops):
        r = nd(N, 'ShaderNodeValToRGB'); e = r.color_ramp.elements
        while len(e) < len(stops): e.new(.5)
        for el, (p, c) in zip(e, stops): el.position = p; el.color = (*c, 1) if len(c) == 3 else c
        L.new(fac, r.inputs['Fac']); return r.outputs['Color']
    def mixc(N, L, fac, a, b, blend='MIX'):
        x = nd(N, 'ShaderNodeMixRGB', blend_type=blend)
        if isinstance(fac, (int, float)): x.inputs['Fac'].default_value = fac
        else: L.new(fac, x.inputs['Fac'])
        for i, v in ((1, a), (2, b)):
            if isinstance(v, tuple): x.inputs[i].default_value = (*v, 1)
            else: L.new(v, x.inputs[i])
        return x.outputs[0]

    # ---------- materials
    def skin_mat(name, cut=None):
        """fresh green culm skin: long fibres, soft mottling, wax bloom, the node's scar; seamless round the pole.
        cut: a (driver) value node name → above its height (local mm) the skin is gone (milled)."""
        m, nt, N, L = new_mat(name); vec, u, zmm, tc = cyl_coords(N, L)
        fib = noise(N, L, vec, 24, .5, 6, .6); fine = noise(N, L, vec, 80, 1.3, 4, .65, 3.); blot = noise(N, L, vec, 1.5, .8, 4, .5, 7.); wax = noise(N, L, vec, 3., 2., 5, .6, 17.)
        g = P.get('green', 1.)
        base = ramp(N, L, fib, [(.2, (.028 * g, .150 * g, .003)), (.5, (.058 * g, .235 * g, .006)), (.85, (.115 * g, .345 * g, .012))])
        streak = noise(N, L, vec, 7, .25, 3, .5, 31.)
        base = mixc(N, L, val(N, L, 'MULTIPLY', ramp(N, L, streak, [(.35, (1, 1, 1)), (.7, (0, 0, 0))]), .55), base, (.012, .075, .003))
        base = mixc(N, L, val(N, L, 'MULTIPLY', ramp(N, L, blot, [(.3, (0, 0, 0)), (.8, (1, 1, 1))]), .35), base, (.20, .36, .02))
        base = mixc(N, L, val(N, L, 'MULTIPLY', ramp(N, L, fine, [(.3, (1, 1, 1)), (.65, (0, 0, 0))]), .1), base, (.02, .1, .008))
        base = mixc(N, L, val(N, L, 'MULTIPLY', ramp(N, L, wax, [(.35, (0, 0, 0)), (.9, (1, 1, 1))]), .1), base, (.5, .66, .44))
        # the node: a pale waxy band just under the ridge, the dry brown sheath scar on it
        nz = val(N, L, 'SUBTRACT', zmm, NODE_L[name] if name in NODE_L else 1e6)
        scar = ramp(N, L, val(N, L, 'MULTIPLY', val(N, L, 'ABSOLUTE', nz), .01), [(0., (1, 1, 1)), (.02, (1, 1, 1)), (.045, (0, 0, 0))])   # |nz| < ~3 mm (ramp over 0..1 of 100 mm)
        scarn = noise(N, L, vec, 40, 6., 3, .6, 23.)
        base = mixc(N, L, val(N, L, 'MULTIPLY', scar, val(N, L, 'ADD', .55, val(N, L, 'MULTIPLY', scarn, .45))), base, (.62, .42, .13))
        band = ramp(N, L, val(N, L, 'MULTIPLY', val(N, L, 'ADD', nz, 14.), .01), [(0., (0, 0, 0)), (.05, (1, 1, 1)), (.11, (1, 1, 1)), (.14, (0, 0, 0))])   # 5…11 mm under the ridge
        base = mixc(N, L, val(N, L, 'MULTIPLY', band, .28), base, (.62, .72, .52))
        bs = nd(N, 'ShaderNodeBsdfPrincipled'); L.new(base, bs.inputs['Base Color'])
        rg = val(N, L, 'ADD', .3, val(N, L, 'MULTIPLY', ramp(N, L, wax, [(.35, (0, 0, 0)), (.9, (1, 1, 1))]), .22)); L.new(rg, bs.inputs['Roughness'])
        try: bs.inputs['Coat Weight'].default_value = .25; bs.inputs['Coat Roughness'].default_value = .12
        except Exception: pass
        bump = nd(N, 'ShaderNodeBump'); bump.inputs['Strength'].default_value = .12; bump.inputs['Distance'].default_value = .002
        L.new(val(N, L, 'ADD', val(N, L, 'MULTIPLY', fib, .6), val(N, L, 'MULTIPLY', fine, .4)), bump.inputs['Height']); L.new(bump.outputs[0], bs.inputs['Normal'])
        outn = nd(N, 'ShaderNodeOutputMaterial')
        if cut:
            tr = nd(N, 'ShaderNodeBsdfTransparent'); mx = nd(N, 'ShaderNodeMixShader'); cv = nd(N, 'ShaderNodeValue'); cv.name = cv.label = 'CUT'; cv.outputs[0].default_value = 1e4
            L.new(val(N, L, 'GREATER_THAN', zmm, cv.outputs[0]), mx.inputs['Fac']); L.new(bs.outputs[0], mx.inputs[1]); L.new(tr.outputs[0], mx.inputs[2]); L.new(mx.outputs[0], outn.inputs['Surface'])
        else: L.new(bs.outputs[0], outn.inputs['Surface'])
        return m
    def face_mat(name, cut=None, dark=1.):
        """a fresh saw cut through the wall: pale cream, the vascular bundles as fine dots, denser towards the skin"""
        m, nt, N, L = new_mat(name); tc = nd(N, 'ShaderNodeTexCoord'); vor = nd(N, 'ShaderNodeTexVoronoi'); vor.inputs['Scale'].default_value = 900.; L.new(tc.outputs['Object'], vor.inputs['Vector'])
        dots = ramp(N, L, vor.outputs['Distance'], [(.0, (0, 0, 0)), (.28, (0, 0, 0)), (.5, (1, 1, 1))])
        col = mixc(N, L, dots, (.50 * dark, .36 * dark, .17 * dark), (.86 * dark, .77 * dark, .52 * dark))
        bs = nd(N, 'ShaderNodeBsdfPrincipled'); L.new(col, bs.inputs['Base Color']); bs.inputs['Roughness'].default_value = .7
        outn = nd(N, 'ShaderNodeOutputMaterial')
        if cut:
            sp = nd(N, 'ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], sp.inputs[0]); tr = nd(N, 'ShaderNodeBsdfTransparent'); mx = nd(N, 'ShaderNodeMixShader'); cv = nd(N, 'ShaderNodeValue'); cv.name = cv.label = 'CUT'; cv.outputs[0].default_value = 1e4
            L.new(val(N, L, 'GREATER_THAN', val(N, L, 'DIVIDE', sp.outputs['Z'], U), cv.outputs[0]), mx.inputs['Fac']); L.new(bs.outputs[0], mx.inputs[1]); L.new(tr.outputs[0], mx.inputs[2]); L.new(mx.outputs[0], outn.inputs['Surface'])
        else: L.new(bs.outputs[0], outn.inputs['Surface'])
        return m
    def inner_mat(name, cut=None):
        """the natural inside of a culm: pale, matte, papery"""
        m, nt, N, L = new_mat(name); vec, u, zmm, tc = cyl_coords(N, L); f = noise(N, L, vec, 30, .8, 4, .6, 5.)
        bs = nd(N, 'ShaderNodeBsdfPrincipled'); L.new(ramp(N, L, f, [(.3, (.52, .44, .26)), (.7, (.78, .70, .48))]), bs.inputs['Base Color']); bs.inputs['Roughness'].default_value = .85
        outn = nd(N, 'ShaderNodeOutputMaterial')
        if cut:
            tr = nd(N, 'ShaderNodeBsdfTransparent'); mx = nd(N, 'ShaderNodeMixShader'); cv = nd(N, 'ShaderNodeValue'); cv.name = cv.label = 'CUT'; cv.outputs[0].default_value = 1e4
            L.new(val(N, L, 'GREATER_THAN', zmm, cv.outputs[0]), mx.inputs['Fac']); L.new(bs.outputs[0], mx.inputs[1]); L.new(tr.outputs[0], mx.inputs[2]); L.new(mx.outputs[0], outn.inputs['Surface'])
        else: L.new(bs.outputs[0], outn.inputs['Surface'])
        return m
    def tube_mat():
        """the finished tube: the live model's own photographic bamboo albedo (same wrap), satin; below CUT nothing yet
        (the skin is still on); the laser engraving appears above LASER (it burns from the top down), glowing at the line"""
        m, nt, N, L = new_mat('tube'); vec, u, zmm, tc = cyl_coords(N, L)
        uu = val(N, L, 'FRACT', val(N, L, 'ADD', u, FRONT_U)); vv = val(N, L, 'DIVIDE', zmm, 170.)
        uvn = nd(N, 'ShaderNodeCombineXYZ'); L.new(uu, uvn.inputs[0]); L.new(vv, uvn.inputs[1])
        img = nd(N, 'ShaderNodeTexImage'); img.image = bpy.data.images.load(os.path.join(TEX, 'bamboo-albedo.jpg')); img.extension = 'REPEAT'; L.new(uvn.outputs[0], img.inputs['Vector'])
        uve = nd(N, 'ShaderNodeCombineXYZ'); L.new(uu, uve.inputs[0]); L.new(val(N, L, 'DIVIDE', zmm, PRINT_H), uve.inputs[1])
        eng = nd(N, 'ShaderNodeTexImage'); eng.image = bpy.data.images.load(os.path.join(TEX, 'engraving-none.png')); eng.image.colorspace_settings.name = 'Non-Color'; eng.extension = 'CLIP'; L.new(uve.outputs[0], eng.inputs['Vector'])
        lz = nd(N, 'ShaderNodeValue'); lz.name = lz.label = 'LASER'; lz.outputs[0].default_value = 1e4
        done = val(N, L, 'GREATER_THAN', zmm, lz.outputs[0]); ink = val(N, L, 'MULTIPLY', eng.outputs['Color'], done)
        wood = mixc(N, L, 1., img.outputs['Color'], (.80, .76, .70), 'MULTIPLY'); col = mixc(N, L, ink, wood, (.105, .06, .028))
        bs = nd(N, 'ShaderNodeBsdfPrincipled'); L.new(col, bs.inputs['Base Color']); L.new(val(N, L, 'ADD', .62, val(N, L, 'MULTIPLY', ink, .25)), bs.inputs['Roughness'])
        try: bs.inputs['Coat Weight'].default_value = .1; bs.inputs['Coat Roughness'].default_value = .45
        except Exception: pass
        # the burning line: within 1.2 mm above the laser's height, where there is artwork
        near = val(N, L, 'MULTIPLY', val(N, L, 'LESS_THAN', val(N, L, 'ABSOLUTE', val(N, L, 'SUBTRACT', zmm, lz.outputs[0])), 1.2), eng.outputs['Color'])
        try: bs.inputs['Emission Color'].default_value = (1., .45, .12, 1); L.new(val(N, L, 'MULTIPLY', near, 14.), bs.inputs['Emission Strength'])
        except Exception: pass
        bump = nd(N, 'ShaderNodeBump'); bump.inputs['Strength'].default_value = .35; bump.inputs['Distance'].default_value = .002; bump.invert = True; L.new(val(N, L, 'ADD', ink, val(N, L, 'MULTIPLY', noise(N, L, vec, 60, .6, 4, .6, 9.), -.25)), bump.inputs['Height']); L.new(bump.outputs[0], bs.inputs['Normal'])
        tr = nd(N, 'ShaderNodeBsdfTransparent'); mx = nd(N, 'ShaderNodeMixShader'); cv = nd(N, 'ShaderNodeValue'); cv.name = cv.label = 'CUT'; cv.outputs[0].default_value = 1e4
        L.new(val(N, L, 'LESS_THAN', zmm, cv.outputs[0]), mx.inputs['Fac']); L.new(bs.outputs[0], mx.inputs[1]); L.new(tr.outputs[0], mx.inputs[2])
        outn = nd(N, 'ShaderNodeOutputMaterial'); L.new(mx.outputs[0], outn.inputs['Surface']); return m
    def plain(name, col, rough=.5, metal=0.):
        m, nt, N, L = new_mat(name); bs = nd(N, 'ShaderNodeBsdfPrincipled')
        if metal > .5:
            tc = nd(N, 'ShaderNodeTexCoord'); mp = nd(N, 'ShaderNodeMapping'); mp.inputs['Scale'].default_value = (3., 400., 400.); L.new(tc.outputs['Object'], mp.inputs['Vector']); nz = nd(N, 'ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.; nz.inputs['Detail'].default_value = 3.; L.new(mp.outputs[0], nz.inputs['Vector'])
            L.new(val(N, L, 'ADD', rough - .08, val(N, L, 'MULTIPLY', nz.outputs['Fac'], .2)), bs.inputs['Roughness'])
        m_ = None; bs.inputs['Base Color'].default_value = (*col, 1); bs.inputs['Metallic'].default_value = metal
        if metal <= .5: bs.inputs['Roughness'].default_value = rough
        outn = nd(N, 'ShaderNodeOutputMaterial'); L.new(bs.outputs[0], outn.inputs['Surface']); return m

    RO, RI, RN = 29.6, 22.5, 32.2            # natural outer / inner radius, the node ridge
    NODE_L = {'skin_pole': None}             # per material: the node's local height (mm); filled below
    def natural(z0, z1, node=None):          # outer wall profile between two heights (mm, local), with the node's ridge
        pr = []; n = max(2, int((z1 - z0) / 2))
        for i in range(n + 1):
            z = lerp(z0, z1, i / n); r = RO
            if node is not None: d = z - node; r += (RN - RO) * math.exp(-(d / 2.2) ** 2) - .5 * math.exp(-((d - 5.5) / 2.5) ** 2)   # the ridge, a shallow groove above it
            pr.append((r, z))
        return pr
    # ---------- the pole (world) above and below the piece
    NODE_L['skin_pole'] = 1e6; m_skin_pole = skin_mat('skin_pole'); m_face = face_mat('face'); m_inner = inner_mat('inner')
    def hollow(name, z0, z1, mats, node=None, top_face=True, bot_face=True, diaphragm=None):
        o = lathe(name + '_o', natural(z0, z1, node)); o.data.materials.append(mats[0]); parts = [o]
        i = lathe(name + '_i', [(RI, z1), (RI, z0)]); i.data.materials.append(mats[2]); parts.append(i)
        if top_face: t = lathe(name + '_t', [(natural(z1, z1 + 1e-3, node)[0][0], z1), (RI, z1)]); t.data.materials.append(mats[1]); parts.append(t)
        if bot_face: b = lathe(name + '_b', [(RI, z0), (natural(z0, z0 + 1e-3, node)[0][0], z0)]); b.data.materials.append(mats[1]); parts.append(b)
        if diaphragm is not None: dd = lathe(name + '_dd', [(RI, diaphragm - 1.), (.01, diaphragm - 2.2)]); du = lathe(name + '_du', [(.01, diaphragm + 1.2), (RI, diaphragm)]); [x.data.materials.append(mats[2]) for x in (dd, du)]; parts += [dd, du]
        return parts
    up = hollow('up', TOP + KERF, Hmm / 2 + 60, (m_skin_pole, m_face, m_inner), top_face=False)
    low = hollow('low', -Hmm / 2 - 60, BOT - KERF, (m_skin_pole, m_face, m_inner), bot_face=False)
    for ob in up + low: ob.location.x = cxmm * U
    # ---------- the piece: local z 0 = the tube's bottom (170 = its rim). The natural piece runs from −2 to 170
    piece = bpy.data.objects.new('piece', None); S.collection.objects.link(piece); piece.rotation_mode = 'XYZ'
    PZ0 = BOT + 2.                                           # world z of the piece's local 0 at rest
    NL = NODE - PZ0                                          # the node's height in the piece (≈ 4 mm above the bottom)
    NODE_L['skin_piece'] = NL; m_skin = skin_mat('skin_piece', cut=True); m_face_c = face_mat('face_c', cut=True); m_inner_c = inner_mat('inner_c', cut=True)
    nat = hollow('pc', -2., 170., (m_skin, m_face_c, m_inner_c), node=NL, diaphragm=NL + 1.5)
    m_tube = tube_mat(); m_end = face_mat('end', dark=.97); m_bore = plain('bore', (.60, .49, .30), .8)
    tube = lathe('tube', [(prof_r(y), y) for y in [p[0] for p in PROFILE]]); tube.data.materials.append(m_tube)
    rim = lathe('rim', [(prof_r(170.), 170.), (24., 170.)]); rim.data.materials.append(m_tube)
    bore = lathe('bore', [(24., 170.), (24., 5.), (.01, 5.)]); bore.data.materials.append(m_tube)
    foot = lathe('foot', [(.01, 0.), (prof_r(0.), 0.)]); foot.data.materials.append(m_tube)
    pieces = nat + [tube, rim, bore, foot]
    for ob in pieces: ob.parent = piece
    # ---------- the turning tool (world): a steel holder with a carbide insert; its tip at the tool empty's origin
    tool = bpy.data.objects.new('tool', None); S.collection.objects.link(tool)
    m_steel = plain('steel', (.55, .57, .60), .32, 1.); m_black = plain('oxide', (.42, .43, .45), .26, 1.); m_carb = plain('carbide', (.83, .62, .22), .28, 1.)
    def box(name, sx, sy, sz, loc, mat, bevel=.6):
        bpy.ops.mesh.primitive_cube_add(size=1); ob = bpy.context.object; ob.name = name; ob.scale = (sx * U, sy * U, sz * U); ob.location = tuple(c * U for c in loc); bpy.ops.object.transform_apply(scale=True)
        b = ob.modifiers.new('bv', 'BEVEL'); b.width = bevel * U; b.segments = 3; ob.data.materials.append(mat); ob.parent = tool
        for p in ob.data.polygons: p.use_smooth = True
        return ob
    box('shank', 190, 20, 20, (118, 0, -6), m_black, 1.6)                  # the holder runs off to the right
    box('head', 30, 20, 14, (15, 0, -9), m_black, 1.2)
    box('clamp', 16, 9, 5, (17, 0, 1.2), m_steel, .9)
    bpy.ops.mesh.primitive_cylinder_add(radius=3.2 * U, depth=3 * U, location=(21 * U, 0, 4.2 * U), vertices=6); hx = bpy.context.object; hx.data.materials.append(m_black); hx.parent = tool
    # the insert: a rhombic carbide plate lying on the head, its nose at the origin
    vs = [(0, 0), (9, -5.2), (18, 0), (9, 5.2)]; verts = [(x * U, y * U, -.2 * U) for x, y in vs] + [((x * .93 + .6) * U, y * .93 * U, -3.4 * U) for x, y in vs]
    ins = mesh_obj('insert', verts, [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], smooth=False); ins.data.materials.append(m_carb); ins.parent = tool
    b = ins.modifiers.new('bv', 'BEVEL'); b.width = .25 * U; b.segments = 2
    bpy.ops.mesh.primitive_cylinder_add(radius=2.1 * U, depth=1.2 * U, location=(9 * U, 0, -.1 * U)); sc = bpy.context.object; sc.data.materials.append(m_steel); sc.parent = tool
    # ---------- chips: thin curled ribbons of skin, thrown off the cutting point (keyframed ballistics: no caches)
    m_chip = plain('chip', (.30, .46, .10), .55); rnd = random.Random(7)
    def chip_mesh():
        vs, fs = [], []; n = 10; w = rnd.uniform(.5, 1.1); rad = rnd.uniform(.8, 1.8); turns = rnd.uniform(.4, 1.3); ln = rnd.uniform(3., 8.)
        for i in range(n + 1):
            t = i / n; a = t * turns * 2 * math.pi; x = rad * math.cos(a); z = rad * math.sin(a); y = (t - .5) * ln * .3
            vs += [(x * U, (y - w / 2) * U, z * U), (x * U, (y + w / 2) * U, z * U)]
        for i in range(n): fs.append((2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2))
        return vs, fs
    chips = []
    for i in range(P.get('chips', 220)):
        vs, fs = chip_mesh(); c = mesh_obj(f'chip{i}', vs, fs); c.data.materials.append(m_chip); c.rotation_mode = 'XYZ'; chips.append(c)

    # ---------- light: the forest's soft green daylight, the low sun from the upper right behind, a tall soft source front left
    W = bpy.data.worlds.new('w'); S.world = W; W.use_nodes = True; wn = W.node_tree.nodes; wl = W.node_tree.links; wn.clear()
    bgn = wn.new('ShaderNodeBackground'); wo = wn.new('ShaderNodeOutputWorld'); wl.new(bgn.outputs[0], wo.inputs[0])
    env = wn.new('ShaderNodeTexEnvironment')
    # the plate itself lights the scene (blurred, as an equirect stand-in): its greens and its sun side
    from_plate = bpy.data.images.load(os.path.join(TEX, f'cut-bg-{o}.jpg')); env.image = from_plate; env.projection = 'MIRROR_BALL'
    wl.new(env.outputs[0], bgn.inputs['Color']); bgn.inputs['Strength'].default_value = P.get('env', .55)
    def light(kind, name, loc, energy, color, size=1., rot=None, sx=None):
        l = bpy.data.lights.new(name, kind); l.energy = energy; l.color = color
        if kind == 'AREA': l.shape = 'RECTANGLE'; l.size = size; l.size_y = sx or size
        if kind == 'SUN': l.angle = math.radians(6)
        ob = bpy.data.objects.new(name, l); S.collection.objects.link(ob); ob.location = loc
        if rot: ob.rotation_euler = rot
        else: ob.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        return ob
    light('SUN', 'sun', (6, 8, 9), P.get('sun', 3.2), (1., .9, .68))
    light('AREA', 'key', (-7, -12, 3), P.get('key', 1500), (.98, 1., .94), 1.4, sx=16.)
    light('AREA', 'rimr', (10, 2, 2), P.get('rim', 350), (1., .95, .8), 3., sx=12.)

    # ---------- compositor: the render over the forest plate; the plate falls out of focus as the piece comes forward
    S.use_nodes = True; ct = S.node_tree; cn = ct.nodes; cl = ct.links; cn.clear()
    rl = cn.new('CompositorNodeRLayers'); im = cn.new('CompositorNodeImage'); im.image = bpy.data.images.load(os.path.join(TEX, f'cut-bg-{o}.jpg'))
    sc_ = cn.new('CompositorNodeScale'); sc_.space = 'RENDER_SIZE'; sc_.frame_method = 'CROP'; cl.new(im.outputs[0], sc_.inputs[0])
    bl = cn.new('CompositorNodeBlur'); bl.filter_type = 'GAUSS'; bl.use_relative = False; bl.size_x = bl.size_y = int(1000 * V['res'][1] / 720 * job.get('scale', 1)); cl.new(sc_.outputs[0], bl.inputs[0])
    bv = cn.new('CompositorNodeValue'); bv.name = 'BLUR'; bv.outputs[0].default_value = 0.; cl.new(bv.outputs[0], bl.inputs['Size'])
    ao = cn.new('CompositorNodeAlphaOver'); cl.new(bl.outputs[0], ao.inputs[1]); cl.new(rl.outputs['Image'], ao.inputs[2])
    co = cn.new('CompositorNodeComposite'); cl.new(ao.outputs[0], co.inputs[0])

    # ---------- the animation
    Zc = (.5 - V['cy']) * Hmm; scale = V['frac'] * Hmm / 170.                 # the piece's final place: on the lens axis, 170 mm = frac of the frame
    Dend = D / scale                                                         # its distance then
    def piece_pose(f):
        """returns (location mm, yaw, pitch) of the piece's CENTRE (local z 85)"""
        if f <= 0: return Vector((cxmm, 0., PZ0 + 85.)), 0., 0.
        k0 = 0.
        k = ease((f - 14) / 82.)                                             # out of the pole to its place
        p0 = Vector((cxmm, 0., PZ0 + 85. - 1.2 * k0)); p1 = Vector((0., -(D - Dend), Zc * (Dend / D)))
        pos = p0.lerp(p1, k); pos.y -= 0.                                    # (a straight line towards the lens: no swerve)
        yaw = 2 * math.pi * ease((f - 18) / 96.)
        pitch = -math.radians(62) * ease((f - 30) / 16.) * (1 - ease((f - 56) / 16.)) + math.radians(48) * ease((f - 70) / 14.) * (1 - ease((f - 96) / 16.))   # first its bottom (the divider), then its open top
        return pos, yaw, pitch
    MILL0, MILL1 = A_END + 12, A_END + 88; LAS0, LAS1 = A_END + 100, A_END + 144
    def spin_at(f):                                                          # lathe turns (rad): spins up, turns fast while milling, comes to rest facing front
        t0, t1 = A_END + 2, MILL1 - 2; w = 2 * math.pi * 3.2 / FPS          # rad per frame at speed
        if f <= t0: return 0.
        if f >= t1 + 12: g = (t1 + 12 - t0)
        else: g = f - t0
        tot = 0.; steps = int(g * 4)
        for i in range(steps): ff = t0 + i / 4.; tot += w / 4. * ease((ff - t0) / 10.) * (1 - ease((ff - t1) / 12.))
        return tot
    full = spin_at(B_END + 100); turns = round(full / (2 * math.pi)); spin_k = turns * 2 * math.pi / full if full else 1.     # ends on a whole number of turns
    def cut_at(f): return lerp(172., -3., clamp01((f - MILL0) / (MILL1 - MILL0)))            # the mill front (local mm), top → bottom
    def las_at(f): return lerp(152., -2., clamp01((f - LAS0) / (LAS1 - LAS0))) if f >= LAS0 else 1e4
    def set_key(idblock, path, v, f): setattr_path(idblock, path, v); idblock.keyframe_insert(path, frame=f)
    def setattr_path(b, path, v): setattr(b, path, v)
    cutnodes = [m.node_tree.nodes['CUT'].outputs[0] for m in (m_skin, m_face_c, m_inner_c, m_tube)]; lasnode = m_tube.node_tree.nodes['LASER'].outputs[0]
    for f in range(0, B_END + 1):
        pos, yaw, pitch = piece_pose(f); sp = spin_at(f) * spin_k
        R = Euler((pitch, 0, 0), 'XYZ').to_matrix() @ Euler((0, 0, yaw + sp), 'XYZ').to_matrix()
        piece.rotation_euler = R.to_euler('XYZ'); org = pos - R @ Vector((0, 0, 85.))
        piece.location = org * U; piece.keyframe_insert('location', frame=f); piece.keyframe_insert('rotation_euler', frame=f)
        foc.location = pos * U; foc.keyframe_insert('location', frame=f)
        c = cut_at(f) if f >= MILL0 else 1e4
        for cnode in cutnodes: cnode.default_value = c; cnode.keyframe_insert('default_value', frame=f)
        lasnode.default_value = las_at(f); lasnode.keyframe_insert('default_value', frame=f)
        bv.outputs[0].default_value = P.get('blur', .028) * ease((f - 14) / 70.); bv.outputs[0].keyframe_insert('default_value', frame=f)
        # the tool: in from the right, its nose on the surface at the front, out again
        tin = ease((f - (MILL0 - 12)) / 12.) * (1 - ease((f - MILL1) / 10.)); zc = clamp01((cut_at(f) if f >= MILL0 else 172.) / 172.) * 172.
        rr = max(prof_r(max(0., min(170., zc))), 24.) + lerp(420., 0., tin)
        tool.location = (Vector((0, -(D - Dend), Zc * (Dend / D))) + Vector((rr, 0, zc - 85.))) * U; tool.keyframe_insert('location', frame=f)
    for fc in list(piece.animation_data.action.fcurves):
        if fc.data_path == 'rotation_euler':
            pass
    # chips: born along the cut, thrown outward to the right and down
    P1 = Vector((0, -(D - Dend), Zc * (Dend / D)))
    for i, c in enumerate(chips):
        fb = lerp(MILL0 + 1, MILL1 - 1, (i + rnd.random()) / len(chips)); zc = cut_at(fb); r0 = prof_r(max(0., min(170., zc))) + .5
        v = Vector((rnd.uniform(60, 190), rnd.uniform(-150, 40), rnd.uniform(20, 160))); p0 = P1 + Vector((r0, -2., zc - 85.)); rv = Vector((rnd.uniform(-9, 9), rnd.uniform(-9, 9), rnd.uniform(-9, 9))); r0e = Vector((rnd.uniform(0, 6), rnd.uniform(0, 6), rnd.uniform(0, 6)))
        c.scale = (0, 0, 0); c.keyframe_insert('scale', frame=0); c.keyframe_insert('scale', frame=int(fb) - 1)
        for j in range(0, 26, 2):
            t = j / FPS; f = fb + j; p = p0 + v * t + Vector((0, 0, -1700. * t * t)); c.location = p * U; c.rotation_euler = tuple(r0e + rv * t); c.scale = (1, 1, 1)
            c.keyframe_insert('location', frame=f); c.keyframe_insert('rotation_euler', frame=f); c.keyframe_insert('scale', frame=f)
    for ob in list(bpy.data.objects):
        if ob.animation_data and ob.animation_data.action:
            for fc in ob.animation_data.action.fcurves:
                for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
    return S

frames = common.frames_for(job, chunk); log = []
for vnt in job['variants']:
    S = build(vnt['o']); t = common.render_frames(S, frames, out, tag=vnt['tag']); log.append(f"{vnt['tag']} chunk {chunk}: {len(frames)} frames, {sum(t):.0f}s")
open(os.path.join(out, f'chunk{chunk}.log'), 'w').write('\n'.join(log))
