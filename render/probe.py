# pipeline test: three small Cycles frames of a lit cylinder
import bpy, os, sys
sys.path.insert(0, os.path.dirname(__file__)); import common
job, chunk, out = common.args()
bpy.ops.wm.read_factory_settings(use_empty=True)
s = bpy.context.scene; s.render.engine = 'CYCLES'; s.cycles.samples = 32; s.cycles.use_denoising = True
s.render.resolution_x, s.render.resolution_y = 640, 360
bpy.ops.mesh.primitive_cylinder_add(radius=.03, depth=.17, location=(0, 0, .085)); cyl = bpy.context.object
cyl.keyframe_insert('rotation_euler', frame=0); cyl.rotation_euler = (0, .6, 0); cyl.keyframe_insert('rotation_euler', frame=4)
bpy.ops.mesh.primitive_plane_add(size=2)
bpy.ops.object.light_add(type='SUN', location=(1, -1, 2)); bpy.context.object.data.energy = 4; bpy.context.object.rotation_euler = (.6, .2, .5)
bpy.ops.object.camera_add(location=(0, -.5, .14), rotation=(1.45, 0, 0)); s.camera = bpy.context.object
w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.5, .6, .8, 1)
t = common.render_frames(s, common.frames_for(job, chunk), out)
open(os.path.join(out, f'chunk{chunk}.log'), 'w').write(f'chunk {chunk}: {len(t)} frames, {sum(t):.1f}s, device {s.cycles.device}, threads {bpy.context.preferences.system.bl_rna and os.cpu_count()}')
