# The money shot (journey f12): the bamboo shoot rockets up into a full-grown culm; the camera tilts up with it, then
# flies up along it through the backlit canopy into the sun. One continuous move, path-traced (Cycles), with motion blur.
# Units: metres, seconds; 30 fps; u = frame / 30 runs 0 … 3.15 s (the journey's RACE_END).
import bpy, bmesh, math, os, sys, random
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(__file__)); import common
job, chunk, out = common.args()
P = job.get('params', {}); FPS = 30; rnd = random.Random(7)
TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')
clamp01 = lambda x: max(0., min(1., x)); ease = lambda x: (lambda t: t * t * (3 - 2 * t))(clamp01(x)); lerp = lambda a, b, t: a + (b - a) * t

bpy.ops.wm.read_factory_settings(use_empty=True)
S = bpy.context.scene; S.render.fps = FPS
C = S.collection

# ------------------------------------------------------------------ helpers
def new_obj(name, verts, faces, uvs=None, attr=None, smooth=True):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    if uvs is not None:
        uv = me.uv_layers.new(name='uv'); flat = [c for f in uvs for p in f for c in p]; uv.data.foreach_set('uv', flat)
    if attr is not None:
        ca = me.color_attributes.new('nd', 'FLOAT_COLOR', 'POINT'); ca.data.foreach_set('color', [c for a in attr for c in a])
    if smooth: me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    ob = bpy.data.objects.new(name, me); C.objects.link(ob); return ob

def culm_mesh(verts, faces, attr, base, H, r0, r1, segs, inter0, lean=(0, 0), bend=0., seed=0., tip_from=None, tip_len=0., node_k=1.06):
    """one culm: rings along z with a ridge at every node; attr per vertex = (ring, wax, rand, 1). tip_from: above this
    height the radius runs out to a point over tip_len (the shoot's tip)"""
    r_ = random.Random(seed * 977 + 13); zs = []; z = 0.; k = 0
    while z < H:
        L = inter0 * (0.45 + 0.55 * clamp01(k / 6.)) * (0.9 + 0.2 * r_.random())     # short internodes at the foot
        z1 = min(H, z + L)
        for (zz, ring, wax, rk) in ((z + .014, 0, 0, 1.), (z + L * .5, 0, 0, 1.), (z1 - .11, 0, 0, 1.), (z1 - .03, 0, 1, 1.), (z1 - .012, .6, .8, .985), (z1, 1, .3, node_k)):
            if zz < H + 1e-6: zs.append((zz, ring, wax, rk))
        z = z1; k += 1
    zs = [(0., 0, 0, 1.)] + zs
    i0 = len(verts); rv = seed
    for (zz, ring, wax, rk) in zs:
        t = zz / H; r = (r0 + (r1 - r0) * t) * rk
        if tip_from is not None and zz > tip_from: r *= max(0., 1. - (zz - tip_from) / tip_len) ** .75
        ox = base[0] + lean[0] * zz + bend * math.cos(seed * 6.28) * t * t * H; oy = base[1] + lean[1] * zz + bend * math.sin(seed * 6.28) * t * t * H
        for s in range(segs):
            a = 2 * math.pi * s / segs; verts.append((ox + r * math.cos(a), oy + r * math.sin(a), base[2] + zz)); attr.append((ring, wax, rv, 1.))
    for j in range(len(zs) - 1):
        for s in range(segs):
            a = i0 + j * segs + s; b = i0 + j * segs + (s + 1) % segs; faces.append((a, b, b + segs, a + segs))

def mat(name): m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear(); return m, nt, nt.nodes, nt.links
def node(nodes, kind, **props):
    n = nodes.new(kind)
    for k, v in props.items(): setattr(n, k, v)
    return n

# ------------------------------------------------------------------ materials
def culm_material(name, c_dark, c_light, rough, coat, sat=1.):
    m, nt, N, L = mat(name)
    out_ = N.new('ShaderNodeOutputMaterial'); b = N.new('ShaderNodeBsdfPrincipled')
    at = node(N, 'ShaderNodeAttribute', attribute_name='nd'); sep = N.new('ShaderNodeSeparateColor'); L.new(at.outputs['Color'], sep.inputs['Color'])
    tc = N.new('ShaderNodeTexCoord'); mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (38, 38, 1.6); L.new(tc.outputs['Object'], mp.inputs['Vector'])
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.; nz.inputs['Detail'].default_value = 6; nz.inputs['Roughness'].default_value = .62; L.new(mp.outputs['Vector'], nz.inputs['Vector'])
    m1 = node(N, 'ShaderNodeMixRGB'); m1.inputs['Color1'].default_value = (*c_dark, 1); m1.inputs['Color2'].default_value = (*c_light, 1); L.new(nz.outputs['Fac'], m1.inputs['Fac'])
    # per-culm variation: older culms are duller and yellower
    hs = N.new('ShaderNodeHueSaturation'); L.new(m1.outputs['Color'], hs.inputs['Color'])
    mr = node(N, 'ShaderNodeMapRange'); mr.inputs['To Min'].default_value = .47; mr.inputs['To Max'].default_value = .53; L.new(sep.outputs['Blue'], mr.inputs['Value']); L.new(mr.outputs['Result'], hs.inputs['Hue'])
    mv = node(N, 'ShaderNodeMapRange'); mv.inputs['To Min'].default_value = .55 * sat; mv.inputs['To Max'].default_value = 1.15 * sat; L.new(sep.outputs['Blue'], mv.inputs['Value']); L.new(mv.outputs['Result'], hs.inputs['Value'])
    # the pale wax bloom under each node, the dark scar at the node
    m2 = node(N, 'ShaderNodeMixRGB'); m2.inputs['Color2'].default_value = (.62, .72, .55, 1); L.new(hs.outputs['Color'], m2.inputs['Color1'])
    wx = node(N, 'ShaderNodeMath', operation='MULTIPLY'); wx.inputs[1].default_value = .7; L.new(sep.outputs['Green'], wx.inputs[0]); L.new(wx.outputs[0], m2.inputs['Fac'])
    m3 = node(N, 'ShaderNodeMixRGB'); m3.inputs['Color2'].default_value = (.10, .075, .03, 1); L.new(m2.outputs['Color'], m3.inputs['Color1'])
    rg = node(N, 'ShaderNodeMath', operation='MULTIPLY'); rg.inputs[1].default_value = .85; L.new(sep.outputs['Red'], rg.inputs[0]); L.new(rg.outputs[0], m3.inputs['Fac'])
    L.new(m3.outputs['Color'], b.inputs['Base Color'])
    rr = node(N, 'ShaderNodeMath', operation='MULTIPLY_ADD'); rr.inputs[1].default_value = .35; rr.inputs[2].default_value = rough; L.new(sep.outputs['Green'], rr.inputs[0]); L.new(rr.outputs[0], b.inputs['Roughness'])
    b.inputs['Coat Weight'].default_value = coat; b.inputs['Coat Roughness'].default_value = .12
    bm = N.new('ShaderNodeBump'); bm.inputs['Strength'].default_value = .12; bm.inputs['Distance'].default_value = .004; L.new(nz.outputs['Fac'], bm.inputs['Height']); L.new(bm.outputs['Normal'], b.inputs['Normal'])
    L.new(b.outputs['BSDF'], out_.inputs['Surface']); return m

def sheath_material():
    m, nt, N, L = mat('sheath'); out_ = N.new('ShaderNodeOutputMaterial'); b = N.new('ShaderNodeBsdfPrincipled')
    tc = N.new('ShaderNodeTexCoord'); mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (60, 60, 7); L.new(tc.outputs['Object'], mp.inputs['Vector'])
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.; nz.inputs['Detail'].default_value = 8; L.new(mp.outputs['Vector'], nz.inputs['Vector'])
    vo = N.new('ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value = 140; L.new(tc.outputs['Object'], vo.inputs['Vector'])
    cr = N.new('ShaderNodeValToRGB'); e = cr.color_ramp.elements; e[0].position = .28; e[0].color = (.07, .04, .02, 1); e[1].position = .78; e[1].color = (.42, .27, .13, 1); L.new(nz.outputs['Fac'], cr.inputs['Fac'])
    sp = node(N, 'ShaderNodeMath', operation='LESS_THAN'); sp.inputs[1].default_value = .05; L.new(vo.outputs['Distance'], sp.inputs[0])
    mx = node(N, 'ShaderNodeMixRGB'); mx.inputs['Color2'].default_value = (.03, .018, .01, 1); L.new(cr.outputs['Color'], mx.inputs['Color1']); L.new(sp.outputs[0], mx.inputs['Fac'])
    L.new(mx.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = .55; b.inputs['Sheen Weight'].default_value = .4
    bm = N.new('ShaderNodeBump'); bm.inputs['Strength'].default_value = .3; bm.inputs['Distance'].default_value = .003; L.new(nz.outputs['Fac'], bm.inputs['Height']); L.new(bm.outputs['Normal'], b.inputs['Normal'])
    L.new(b.outputs['BSDF'], out_.inputs['Surface']); return m

def leaf_material(name, img):
    """a leaf card: the photo's colour on a diffuse + translucent leaf (backlit leaves glow), cut out by its alpha"""
    m, nt, N, L = mat(name); out_ = N.new('ShaderNodeOutputMaterial')
    tx = N.new('ShaderNodeTexImage'); tx.image = bpy.data.images.load(os.path.join(TEX, img)); tx.extension = 'CLIP'
    hs = N.new('ShaderNodeHueSaturation'); hs.inputs['Saturation'].default_value = 1.05; hs.inputs['Value'].default_value = .85; L.new(tx.outputs['Color'], hs.inputs['Color'])
    d = N.new('ShaderNodeBsdfDiffuse'); L.new(hs.outputs['Color'], d.inputs['Color'])
    tl = N.new('ShaderNodeBsdfTranslucent'); h2 = N.new('ShaderNodeHueSaturation'); h2.inputs['Hue'].default_value = .485; h2.inputs['Saturation'].default_value = 1.15; h2.inputs['Value'].default_value = 1.5; L.new(tx.outputs['Color'], h2.inputs['Color']); L.new(h2.outputs['Color'], tl.inputs['Color'])
    g = N.new('ShaderNodeBsdfGlossy'); g.inputs['Roughness'].default_value = .32; g.inputs['Color'].default_value = (.9, 1, .85, 1)
    m1 = N.new('ShaderNodeMixShader'); m1.inputs['Fac'].default_value = P.get('leaf_trans', .58); L.new(d.outputs[0], m1.inputs[1]); L.new(tl.outputs[0], m1.inputs[2])
    m2 = N.new('ShaderNodeMixShader'); m2.inputs['Fac'].default_value = .08; L.new(m1.outputs[0], m2.inputs[1]); L.new(g.outputs[0], m2.inputs[2])
    tr = N.new('ShaderNodeBsdfTransparent'); m3 = N.new('ShaderNodeMixShader'); L.new(tx.outputs['Alpha'], m3.inputs['Fac']); L.new(tr.outputs[0], m3.inputs[1]); L.new(m2.outputs[0], m3.inputs[2])
    L.new(m3.outputs[0], out_.inputs['Surface']); m.blend_method = 'HASHED' if hasattr(m, 'blend_method') else m.blend_method; return m

def ground_material():
    m, nt, N, L = mat('ground'); out_ = N.new('ShaderNodeOutputMaterial'); b = N.new('ShaderNodeBsdfPrincipled')
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 9; nz.inputs['Detail'].default_value = 9
    cr = N.new('ShaderNodeValToRGB'); e = cr.color_ramp.elements; e[0].color = (.018, .012, .007, 1); e[1].color = (.13, .085, .04, 1); L.new(nz.outputs['Fac'], cr.inputs['Fac'])
    L.new(cr.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = .85
    bm = N.new('ShaderNodeBump'); bm.inputs['Strength'].default_value = .8; bm.inputs['Distance'].default_value = .04; L.new(nz.outputs['Fac'], bm.inputs['Height']); L.new(bm.outputs['Normal'], b.inputs['Normal'])
    L.new(b.outputs['BSDF'], out_.inputs['Surface']); return m

# ------------------------------------------------------------------ the forest
HERO_L = 23.; HERO_R = P.get('hero_r', .085); TIP = 1.35
CAM_D = P.get('cam_d', .34)
def too_close(x, y, d0): return math.hypot(x, y) < d0 or math.hypot(x, y + CAM_D) < .95
culms = []
for i in range(P.get('n_near', 150)):
    for _ in range(40):
        a = rnd.random() * 2 * math.pi; r = 1.25 + 13.5 * math.sqrt(rnd.random()); x, y = r * math.cos(a), r * math.sin(a)
        if not too_close(x, y, 1.25) and all(math.hypot(x - c[0], y - c[1]) > .45 for c in culms): break
    culms.append((x, y, 14.5 + 5.5 * rnd.random(), .048 + .034 * rnd.random(), rnd.random()))
v, f, at = [], [], []
for (x, y, H, r, sd) in culms:
    la = rnd.random() * 6.283; ln = .012 + .03 * rnd.random()
    culm_mesh(v, f, at, (x, y, 0), H, r, r * .28, 14, .34 + .1 * rnd.random(), lean=(ln * math.cos(la), ln * math.sin(la)), bend=.035 + .05 * rnd.random(), seed=sd)
near = new_obj('culms', v, f, attr=at); near.data.materials.append(culm_material('culm', (.035, .12, .02), (.11, .27, .05), .44, 0.))
v, f, at = [], [], []
for i in range(P.get('n_far', 320)):
    a = rnd.random() * 2 * math.pi; r = 15 + 30 * rnd.random(); H = 14 + 6 * rnd.random(); rr = .04 + .03 * rnd.random(); la = rnd.random() * 6.283
    culm_mesh(v, f, at, (r * math.cos(a), r * math.sin(a), 0), H, rr, rr * .3, 8, 1.2, lean=(.03 * math.cos(la), .03 * math.sin(la)), bend=.05, seed=rnd.random())
far = new_obj('culms_far', v, f, attr=at); far.data.materials.append(near.data.materials[0])

# the hero: a young culm (fresh green, glossy, waxy rings) with the sheathed tip of the shoot on top
v, f, at = [], [], []
culm_mesh(v, f, at, (0, 0, 0), HERO_L, HERO_R * 1.12, HERO_R, 48, .4, seed=.37, tip_from=HERO_L - TIP, tip_len=TIP, node_k=1.085)
hero = new_obj('hero', v, f, attr=at); hero.data.materials.append(culm_material('hero', (.045, .19, .02), (.15, .38, .05), .3, .2, sat=1.1))
v, f = [], []
def r_at(z): return HERO_R * (max(0., 1. - (z - (HERO_L - TIP)) / TIP) ** .75 if z > HERO_L - TIP else 1.)
NS = 17
for k in range(NS):
    zb = HERO_L - TIP - .55 + (TIP + .5) * (k / NS) ** .9; ln = .42 - .2 * k / NS; th = k * math.pi + .35 * math.sin(k * 1.7); i0 = len(v); rows, segs = 7, 40
    for j in range(rows):
        t = j / (rows - 1)
        for s in range(segs):
            a = 2 * math.pi * s / segs; blade = max(0., math.cos(a - th)) ** 5
            z = zb + ln * t * (.55 + .45 * blade) + (.16 * blade * t * t)
            r = r_at(min(z, HERO_L - .01)) * (1.13 - .09 * t) + .004 + .012 * blade * t * t      # hugs the culm, the blade's tip peels away a little
            v.append((r * math.cos(a), r * math.sin(a), min(z, HERO_L + .05)))
    for j in range(rows - 1):
        for s in range(segs): a = i0 + j * segs + s; b = i0 + j * segs + (s + 1) % segs; f.append((a, b, b + segs, a + segs))
sheaths = new_obj('sheaths', v, f); sheaths.data.materials.append(sheath_material()); sheaths.parent = hero
sol = sheaths.modifiers.new('solid', 'SOLIDIFY'); sol.thickness = .0025

# leaves: cards on drooping twigs around the upper half of every culm; an opening above the hero (the sun's way in)
def opening(x, y, z): return math.hypot(x, y - .2) < P.get('open0', .42) + P.get('open1', .075) * max(0., z - 8.)
lv, lf, luv = {'spray.png': [], 'blade.png': []}, {'spray.png': [], 'blade.png': []}, {'spray.png': [], 'blade.png': []}
def card(tex, c, udir, ndir, w, h, flip):
    u = Vector(udir).normalized(); n = Vector(ndir).normalized(); vv = n.cross(u).normalized(); c = Vector(c); V = lv[tex]; i = len(V)
    V += [tuple(c), tuple(c + u * w), tuple(c + u * w + vv * h), tuple(c + vv * h)]; lf[tex].append((i, i + 1, i + 2, i + 3))
    luv[tex].append([(0, 0), (1, 0), (1, 1), (0, 1)] if not flip else [(0, 1), (1, 1), (1, 0), (0, 0)])
def twig(x, y, z, scale=1.):
    phi = rnd.random() * 6.283; r0 = .05; w = (.8 + .9 * rnd.random()) * scale; droop = math.radians(12 + 38 * rnd.random()); tilt = rnd.gauss(0, math.radians(32))
    u = (math.cos(phi) * math.cos(droop), math.sin(phi) * math.cos(droop), -math.sin(droop))
    side = Vector((-math.sin(phi), math.cos(phi), 0)); up = Vector(u).cross(side); n = (up * math.cos(tilt) + side * math.sin(tilt))
    c = (x + r0 * math.cos(phi), y + r0 * math.sin(phi), z)
    mid = Vector(c) + Vector(u) * w * .5
    if opening(mid.x, mid.y, mid.z) or opening(c[0] + u[0] * w, c[1] + u[1] * w, mid.z): return
    tex = 'spray.png' if rnd.random() < .82 else 'blade.png'; h = w * (440 / 1024 if tex == 'spray.png' else 560 / 1024)
    vv = Vector(n).cross(Vector(u)).normalized(); c0 = Vector(c) - vv * h * (.25 if tex == 'spray.png' else .5)   # the twig's stem sits in the upper left of the picture
    card(tex, c0, u, n, w, h, rnd.random() < .5)
for (x, y, H, r, sd) in culms:
    z = H * (P.get('leaf_from', .6) + .12 * rnd.random())
    while z < H:
        for _ in range(rnd.choice((2, 3, 3, 4, 4, 5))):
            twig(x + rnd.gauss(0, .12), y + rnd.gauss(0, .12), z + rnd.uniform(-.1, .1), 1. + .5 * (z / H - .5))
        z += .2 + .16 * rnd.random()
for i in range(P.get('n_skirt', 2600)):                      # the canopy further out (bigger, sparser cards)
    a = rnd.random() * 6.283; r = 13 + 26 * rnd.random(); twig(r * math.cos(a), r * math.sin(a), 10 + 9 * rnd.random(), 2.2)
nl = 0
for tex in lv:
    if not lv[tex]: continue
    ob = new_obj('leaves_' + tex, lv[tex], lf[tex], uvs=luv[tex], smooth=False); ob.data.materials.append(leaf_material('leaf_' + tex, tex)); nl += len(lf[tex])
print('[scene] culms', len(culms), 'leaf cards', nl, flush=True)

bpy.ops.mesh.primitive_plane_add(size=160); gr = bpy.context.object; gr.data.materials.append(ground_material())
# a dark wall of forest far out (no bright horizon between the trunks)
bpy.ops.mesh.primitive_cylinder_add(radius=48, depth=30, location=(0, 0, 15), end_fill_type='NOTHING'); wall = bpy.context.object
wm, nt, N, L = mat('wall'); o_ = N.new('ShaderNodeOutputMaterial'); d = N.new('ShaderNodeBsdfDiffuse'); d.inputs['Color'].default_value = (.006, .016, .005, 1); L.new(d.outputs[0], o_.inputs['Surface']); wall.data.materials.append(wm)

# ------------------------------------------------------------------ light: a low-haze sky with the sun high in the opening
W = bpy.data.worlds.new('sky'); S.world = W; W.use_nodes = True; N = W.node_tree.nodes; L = W.node_tree.links; N.clear()
wo = N.new('ShaderNodeOutputWorld'); sky = N.new('ShaderNodeTexSky'); sky.sky_type = 'NISHITA'; sky.sun_elevation = math.radians(P.get('sun_el', 79)); sky.sun_rotation = math.radians(P.get('sun_rot', 0))
sky.sun_size = math.radians(P.get('sun_size', 2.2)); sky.sun_intensity = P.get('sun_int', .9); sky.air_density = 1.; sky.dust_density = P.get('dust', 1.); sky.ozone_density = 1.
bg = N.new('ShaderNodeBackground'); L.new(sky.outputs[0], bg.inputs['Color']); bg.inputs['Strength'].default_value = P.get('sky_strength', .17)
nb = N.new('ShaderNodeBackground'); nb.inputs['Color'].default_value = (.035, .05, .11, 1); nb.inputs['Strength'].default_value = P.get('night_strength', .9)
mxw = N.new('ShaderNodeMixShader'); L.new(nb.outputs[0], mxw.inputs[1]); L.new(bg.outputs[0], mxw.inputs[2]); L.new(mxw.outputs[0], wo.inputs['Surface'])

# moonlight for the first moments (the shot starts in the night forest of the last picture), gone by morning
moon_d = bpy.data.lights.new('moon', 'SUN'); moon_d.color = (.5, .68, 1.); moon_d.angle = math.radians(3); moon = bpy.data.objects.new('moon', moon_d); C.objects.link(moon)
moon.rotation_euler = (math.radians(38), 0, math.radians(-150))
# a little haze in the air: the sun's shafts through the canopy
if P.get('haze', .003) > 0:
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 12)); hz = bpy.context.object; hz.scale = (70, 70, 26)
    hm, nt_, N_, L_ = mat('haze'); o_ = N_.new('ShaderNodeOutputMaterial'); vs = N_.new('ShaderNodeVolumeScatter'); vs.inputs['Density'].default_value = P.get('haze', .003); vs.inputs['Anisotropy'].default_value = .78; vs.inputs['Color'].default_value = (1, .96, .86, 1)
    L_.new(vs.outputs[0], o_.inputs['Volume']); hz.data.materials.append(hm)
# ------------------------------------------------------------------ the move
def tip_h(u):
    if u <= 1.3: return .91 + 13.1 * (max(u, 0) / 1.3) ** 2.2
    return 14.01 + 5.2 * (1 - math.exp(-(u - 1.3) * 22.17 / 5.2))
def cam_pose(u):
    pitch = math.radians(8 + 72 * (1 - (1 - clamp01(u / 1.2)) ** 1.8) + 7 * ease((u - 1.2) / 1.3))      # tilts fast at first (as the shot it takes over from), then eases onto the culm
    d = lerp(.95, CAM_D, ease(u / 1.3))
    z = .28 + 1.3 * ease(u / 1.3) + 1.1 * ease((u - 1.3) / .6) + P.get('climb', 15.2) * clamp01((u - 1.9) / 1.15) ** 2.6
    return Vector((0, -d, z)), Vector((0, math.cos(pitch), math.sin(pitch)))
SHOT = P.get('shot', 'money')
# the dive (journey f05): from above the crowns down through the opening beside the hero culm, levelling out among the
# culms, and into one giant backlit leaf that fills the lens (the journey's own leaf wipe takes over there). 2.4 s.
DIVE_T = 2.4; DIVE_X = P.get('dive_x', .62)
def dive_pose(u):
    k = clamp01(u / DIVE_T); e = 1 - (1 - k) ** P.get('dive_pow', 2.2)
    pitch = math.radians(lerp(-80, P.get('dive_end_pitch', 9), ease(k * 1.12)))
    return Vector((DIVE_X, lerp(-2.6, -.55, e), lerp(P.get('dive_z0', 36.), 7.2, e))), Vector((0, math.cos(pitch), math.sin(pitch)))
if SHOT == 'dive':
    pe, de = dive_pose(DIVE_T); LW, LH = P.get('leaf_l', 1.0), P.get('leaf_w', .34); v, f, uvs = [], [], []; NX, NY = 40, 12
    rt = Vector((1, 0, 0)); up = rt.cross(de).normalized() * -1; rot = -.5
    ax = rt * math.cos(rot) + up * math.sin(rot); br = -rt * math.sin(rot) + up * math.cos(rot); c0 = pe + de * P.get('leaf_d', .04)
    for j in range(NY + 1):
        for i in range(NX + 1):
            a_, b_ = i / NX - .5, j / NY - .5; wv = (1 - (2 * a_) ** 2) ** .6                       # the blade's outline: pointed at both ends
            p = c0 + ax * (a_ * LW) + br * (b_ * LH * wv) + de * (.25 * LH * (2 * b_) ** 2 * wv + .05 * a_ * a_)   # a shallow keel
            v.append(tuple(p)); uvs.append((i / NX, j / NY))
    for j in range(NY):
        for i in range(NX): q = j * (NX + 1) + i; f.append((q, q + 1, q + NX + 2, q + NX + 1))
    big = new_obj('bigleaf', v, f, uvs=[[uvs[k] for k in fc] for fc in f])
    m, nt_, N_, L_ = mat('bigleaf'); o_ = N_.new('ShaderNodeOutputMaterial'); tc = N_.new('ShaderNodeTexCoord'); sp = N_.new('ShaderNodeSeparateXYZ'); L_.new(tc.outputs['UV'], sp.inputs[0])
    wvn = N_.new('ShaderNodeTexWave'); wvn.wave_type = 'BANDS'; wvn.bands_direction = 'Y'; wvn.inputs['Scale'].default_value = 26; wvn.inputs['Distortion'].default_value = .6; wvn.inputs['Detail'].default_value = 2; L_.new(tc.outputs['UV'], wvn.inputs['Vector'])
    mid = node(N_, 'ShaderNodeMath', operation='SUBTRACT'); mid.inputs[1].default_value = .5; L_.new(sp.outputs['Y'], mid.inputs[0]); ab = node(N_, 'ShaderNodeMath', operation='ABSOLUTE'); L_.new(mid.outputs[0], ab.inputs[0])
    rib = node(N_, 'ShaderNodeMapRange'); rib.inputs['From Min'].default_value = 0; rib.inputs['From Max'].default_value = .035; L_.new(ab.outputs[0], rib.inputs['Value'])
    cr = N_.new('ShaderNodeValToRGB'); e_ = cr.color_ramp.elements; e_[0].position = .3; e_[0].color = (.03, .15, .008, 1); e_[1].position = .7; e_[1].color = (.17, .48, .04, 1); L_.new(wvn.outputs['Fac'], cr.inputs['Fac'])
    mx_ = node(N_, 'ShaderNodeMixRGB'); mx_.inputs['Color1'].default_value = (.22, .5, .07, 1); L_.new(rib.outputs['Result'], mx_.inputs['Fac']); L_.new(cr.outputs['Color'], mx_.inputs['Color2'])
    d_ = N_.new('ShaderNodeBsdfDiffuse'); tl_ = N_.new('ShaderNodeBsdfTranslucent'); g_ = N_.new('ShaderNodeBsdfGlossy'); g_.inputs['Roughness'].default_value = .3
    L_.new(mx_.outputs['Color'], d_.inputs['Color']); L_.new(mx_.outputs['Color'], tl_.inputs['Color'])
    m1_ = N_.new('ShaderNodeMixShader'); m1_.inputs['Fac'].default_value = .7; L_.new(d_.outputs[0], m1_.inputs[1]); L_.new(tl_.outputs[0], m1_.inputs[2])
    m2_ = N_.new('ShaderNodeMixShader'); m2_.inputs['Fac'].default_value = .07; L_.new(m1_.outputs[0], m2_.inputs[1]); L_.new(g_.outputs[0], m2_.inputs[2])
    em_ = N_.new('ShaderNodeEmission'); em_.inputs['Strength'].default_value = P.get('leaf_glow', .22); L_.new(mx_.outputs['Color'], em_.inputs['Color'])   # the sun behind it
    ad_ = N_.new('ShaderNodeAddShader'); L_.new(m2_.outputs[0], ad_.inputs[0]); L_.new(em_.outputs[0], ad_.inputs[1]); L_.new(ad_.outputs[0], o_.inputs['Surface'])
    big.data.materials.append(m)
cam_d = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_d); C.objects.link(cam); S.camera = cam
cam_d.lens = P.get('lens', 16); cam_d.sensor_width = 36; cam_d.clip_start = .02; cam_d.clip_end = 400
END = job.get('end_frame', 95)
for fr in range(-2, END + 3):
    u = fr / FPS
    hero.location = (0, 0, (tip_h(u) if SHOT == 'money' else HERO_L - 1.5) - HERO_L); hero.keyframe_insert('location', frame=fr)
    p, dv = cam_pose(u) if SHOT == 'money' else dive_pose(u); cam.location = p; cam.rotation_euler = dv.to_track_quat('-Z', 'Y').to_euler(); cam.keyframe_insert('location', frame=fr); cam.keyframe_insert('rotation_euler', frame=fr)
    mxw.inputs['Fac'].default_value = ease((u - .15) / 1.0); mxw.inputs['Fac'].keyframe_insert('default_value', frame=fr)
    moon_d.energy = P.get('moon', 1.4) * (1 - ease((u - .2) / .9)); moon_d.keyframe_insert('energy', frame=fr)
    S.view_settings.exposure = P.get('exposure', 0.) + P.get('burn', 5.) * ease((u - 2.72) / .4) ** 1.5; S.view_settings.keyframe_insert('exposure', frame=fr)
    if SHOT != 'money':                                  # daylight throughout, no burn
        mxw.inputs['Fac'].default_value = 1; mxw.inputs['Fac'].keyframe_insert('default_value', frame=fr); moon_d.energy = 0; moon_d.keyframe_insert('energy', frame=fr)
        S.view_settings.exposure = P.get('exposure', 0.) + P.get('under', 1.7) * ease(u / DIVE_T * 1.5 - .15); S.view_settings.keyframe_insert('exposure', frame=fr)   # the eye opens up under the canopy
if SHOT == 'dive': cam_d.dof.use_dof = True; cam_d.dof.focus_distance = P.get('focus', 7.); cam_d.dof.aperture_fstop = P.get('fstop', 1.4)
for ob in (hero, cam):
    for fc in ob.animation_data.action.fcurves:
        for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'

# ------------------------------------------------------------------ render
S.render.engine = 'CYCLES'; cy = S.cycles; cy.device = 'CPU'
cy.samples = job.get('samples', 96); cy.use_adaptive_sampling = True; cy.adaptive_threshold = job.get('noise', .03); cy.use_denoising = True
cy.volume_bounces = 0; cy.volume_step_rate = 4; cy.volume_max_steps = 64; cy.max_bounces = 8; cy.diffuse_bounces = 3; cy.glossy_bounces = 3; cy.transmission_bounces = 6; cy.transparent_max_bounces = 28; cy.sample_clamp_indirect = 8; cy.caustics_reflective = False; cy.caustics_refractive = False
S.render.use_motion_blur = job.get('mblur', True); S.render.motion_blur_shutter = job.get('shutter', .6)
S.render.use_persistent_data = True; S.render.threads_mode = 'AUTO'
S.view_settings.view_transform = 'AgX'
try: S.view_settings.look = 'AgX - Medium High Contrast'
except Exception as e: print('look', e)
# the sun blooms in the lens
S.use_nodes = True; nt = S.node_tree; nt.nodes.clear(); rl = nt.nodes.new('CompositorNodeRLayers'); gl = nt.nodes.new('CompositorNodeGlare'); gl.glare_type = 'FOG_GLOW'; gl.quality = 'MEDIUM'; gl.threshold = P.get('glare_thr', 2.); gl.size = 8; gl.mix = P.get('glare_mix', -.6)
co = nt.nodes.new('CompositorNodeComposite'); nt.links.new(rl.outputs['Image'], gl.inputs['Image']); nt.links.new(gl.outputs['Image'], co.inputs['Image'])

frames = common.frames_for(job, chunk); logs = []
for vnt in job.get('variants', [{'tag': '', 'res': [1280, 720], 'shift': 0.}]):
    S.render.resolution_x, S.render.resolution_y = vnt['res']; S.render.resolution_percentage = 100; cam_d.shift_x = vnt.get('shift', 0.); cam_d.lens = vnt.get('lens', P.get('lens', 16))
    t = []
    for fr in frames:                                  # a longer shutter while the camera whips up (the hand-over hides in the streaks)
        S.render.motion_blur_shutter = job.get('shutter', .6) * ((1 + 1.6 * (1 - ease((fr / FPS - .25) / .5))) if SHOT == 'money' else 1); t += common.render_frames(S, [fr], out, tag=vnt['tag'])
    logs.append(f"chunk {chunk} {vnt['tag']}: {len(t)} frames, avg {sum(t) / max(1, len(t)):.1f}s, max {max(t or [0]):.1f}s")
open(os.path.join(out, f'chunk{chunk}.log'), 'w').write('\n'.join(logs))
