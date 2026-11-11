# connection test: one small Cycles frame (a lit cylinder), to prove Blender renders on this runner
import bpy, os
bpy.ops.wm.read_factory_settings(use_empty=True)
s = bpy.context.scene; s.render.engine = 'CYCLES'; s.cycles.samples = 32; s.render.resolution_x = 640; s.render.resolution_y = 360
bpy.ops.mesh.primitive_cylinder_add(radius=.03, depth=.17, location=(0, 0, .085))
bpy.ops.object.light_add(type='SUN', location=(1, -1, 2)); bpy.context.object.data.energy = 4
bpy.ops.object.camera_add(location=(0, -.5, .12), rotation=(1.5, 0, 0)); s.camera = bpy.context.object
os.makedirs('out', exist_ok=True); s.render.filepath = os.path.abspath('out/probe.png'); bpy.ops.render.render(write_still=True)
