"""Source-locked product photography. Run with official Blender 4.5 LTS:
blender --background --factory-startup --python scripts/cycles-render.py -- bundle.json output --proof
The source GLB is freshly exported by cycles-export.js, never the legacy GLB.
Only shaders, camera, lighting and component visibility change after import.
"""
import bpy, sys, json, math, hashlib, base64, pathlib, array, time, shutil, re
from mathutils import Vector

args=sys.argv[sys.argv.index('--')+1:]
bundle_path=pathlib.Path(args[0]).resolve(); output=pathlib.Path(args[1]).resolve(); output.mkdir(parents=True,exist_ok=True)
proof='--proof' in args; samples=48 if proof else 128; size=800 if proof else 1280
executed_recipe_sha=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()
reuse_arg=next((value.split('=',1)[1] for value in args if value.startswith('--reuse-products-from=')),None)
reuse_dir=pathlib.Path(reuse_arg).resolve() if reuse_arg else None
reuse_frames_arg=next((value.split('=',1)[1] for value in args if value.startswith('--reuse-frames-from=')),None)
reuse_frames_dir=pathlib.Path(reuse_frames_arg).resolve() if reuse_frames_arg else None
bundle=json.loads(bundle_path.read_text(encoding='utf8'))
assert bundle['schema']=='bamboo-cycles-source-bundle-v1'
assert bundle['geometry']['positionIndexUvTransformsUnchanged']
binary=base64.b64decode(bundle['glb']['base64']); assert hashlib.sha256(binary).hexdigest()==bundle['glb']['sha256']
gltf=output/'source-operative.glb'; gltf.write_bytes(binary)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(gltf),import_shading='NORMALS')
scene=bpy.context.scene; source_objects=list(scene.objects)
def component(obj):
    while obj:
        if obj.get('component') in ['shell','inlay','cap','seal','liquid']: return obj['component']
        obj=obj.parent
    return None
groups={name:[o for o in source_objects if component(o)==name] for name in ['shell','inlay','cap','seal','liquid']}
assert all(groups.values()),'Missing source component hierarchy'
def geometry_digest():
    result={}
    for obj in source_objects:
        if obj.type!='MESH': continue
        coords=array.array('f',[0])*(len(obj.data.vertices)*3); obj.data.vertices.foreach_get('co',coords)
        loops=array.array('i',[0])*len(obj.data.loops);obj.data.loops.foreach_get('vertex_index',loops)
        result[obj.name]={'vertices':len(obj.data.vertices),'loops':len(obj.data.loops),'positionSha256':hashlib.sha256(coords.tobytes()).hexdigest(),'topologySha256':hashlib.sha256(loops.tobytes()).hexdigest(),'matrixWorld':list(sum((list(row) for row in obj.matrix_world),[]))}
    return result
before=geometry_digest()
def rgb(hex):
    raw=[int(hex.lstrip('#')[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in raw)+(1,)
def principled(name,color,roughness=.46):
    m=bpy.data.materials.new(name); m.use_nodes=True;n=m.node_tree.nodes;n.clear();out=n.new('ShaderNodeOutputMaterial');p=n.new('ShaderNodeBsdfPrincipled');p.inputs['Base Color'].default_value=rgb(color);p.inputs['Roughness'].default_value=roughness;p.inputs['IOR'].default_value=1.41;m.node_tree.links.new(p.outputs['BSDF'],out.inputs['Surface']);return m,p,out
silicone,sp,so=principled('Studio_moulded_silicone','#BAD1B0')
sp.inputs['Subsurface Weight'].default_value=.035
sp.inputs['Subsurface Radius'].default_value=(.9,.7,.5)
sp.inputs['Subsurface Scale'].default_value=.00008
sn=silicone.node_tree.nodes;sl=silicone.node_tree.links
tex=sn.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=8000;tex.inputs['Detail'].default_value=2;tex.inputs['Roughness'].default_value=.55
coordinates=sn.new('ShaderNodeNewGeometry');sl.new(coordinates.outputs['Position'],tex.inputs['Vector'])
bump=sn.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.6;bump.inputs['Distance'].default_value=.000020;sl.new(tex.outputs['Fac'],bump.inputs['Height'])
# Optical edge smoothing only: no modifier, no moved vertices or silhouettes.
edge=sn.new('ShaderNodeBevel');edge.inputs['Radius'].default_value=.000025;edge.samples=4;sl.new(edge.outputs['Normal'],bump.inputs['Normal']);sl.new(bump.outputs['Normal'],sp.inputs['Normal'])
noise=sn.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=2800;sl.new(coordinates.outputs['Position'],noise.inputs['Vector'])
ramp=sn.new('ShaderNodeMapRange');ramp.inputs['From Min'].default_value=0;ramp.inputs['From Max'].default_value=1;ramp.inputs['To Min'].default_value=.43;ramp.inputs['To Max'].default_value=.49;sl.new(noise.outputs['Fac'],ramp.inputs['Value']);sl.new(ramp.outputs['Result'],sp.inputs['Roughness'])
for o in groups['cap']:
    if o.type=='MESH': o.data.materials.clear();o.data.materials.append(silicone)
pet,pp,po=principled('Studio_clear_thin_PET','#ffffff',.045);pp.inputs['IOR'].default_value=1.57;pp.inputs['Transmission Weight'].default_value=1
for o in groups['inlay']:
    if o.type=='MESH':o.data.materials.clear();o.data.materials.append(pet)
gel,gp,go=principled('Studio_shampoo_volume','#dcf7f0',.065);gp.inputs['IOR'].default_value=1.42;gp.inputs['Transmission Weight'].default_value=.94
absorb=gel.node_tree.nodes.new('ShaderNodeVolumeAbsorption');gel.node_tree.links.new(absorb.outputs[0],go.inputs['Volume'])
for o in groups['liquid']:
    if o.type=='MESH':o.data.materials.clear();o.data.materials.append(gel)
# Cycles tracks a volume by object identity. The live renderer's side, floor
# and free surface are separate meshes; use their exact world-space triangles
# in one render-only optical boundary. No vertex is moved, welded or smoothed.
volume_parts=[o for o in groups['liquid'] if o.type=='MESH' and o.name!='Subtle_contact_meniscus']
proxy_vertices=[];proxy_faces=[]
for obj in volume_parts:
    offset=len(proxy_vertices)
    proxy_vertices.extend(tuple(obj.matrix_world@v.co) for v in obj.data.vertices)
    proxy_faces.extend(tuple(offset+i for i in face.vertices) for face in obj.data.polygons)
proxy_mesh=bpy.data.meshes.new('Unchanged_liquid_triangles_single_optical_boundary')
proxy_mesh.from_pydata(proxy_vertices,[],proxy_faces);proxy_mesh.update()
liquid_proxy=bpy.data.objects.new('Cycles_source_liquid_optical_boundary',proxy_mesh)
scene.collection.objects.link(liquid_proxy);proxy_mesh.materials.append(gel)
for polygon in proxy_mesh.polygons:polygon.use_smooth=True
proxy_proof={'method':'Exact world-space source triangles collected into one Cycles optical boundary; no weld, remesh, bevel or moved vertex','watertight':False,'sourceMeniscusContactGapMillimetres':.20436392741156,'sourceMeshes':[o.name for o in volume_parts],'vertices':len(proxy_vertices),'faces':len(proxy_faces),'sourceWorldPositionsSha256':hashlib.sha256(array.array('d',sum((list(p) for p in proxy_vertices),[])).tobytes()).hexdigest()}
proxy_proof['renderWorldPositionsSha256']=hashlib.sha256(array.array('d',[c for v in proxy_mesh.vertices for c in v.co]).tobytes()).hexdigest()
# Blender mesh storage is Float32. Verify the imported source coordinates after
# the same Float32 conversion, rather than comparing doubles to float storage.
proxy_proof['sourceFloat32PositionsSha256']=hashlib.sha256(array.array('f',[c for p in proxy_vertices for c in p]).tobytes()).hexdigest()
proxy_proof['renderFloat32PositionsSha256']=hashlib.sha256(array.array('f',[c for v in proxy_mesh.vertices for c in v.co]).tobytes()).hexdigest()
assert proxy_proof['sourceFloat32PositionsSha256']==proxy_proof['renderFloat32PositionsSha256']
meniscus_material=gel.copy();meniscus_material.name='Shampoo_meniscus_surface_without_second_volume'
for node in list(meniscus_material.node_tree.nodes):
    if node.type=='VOLUME_ABSORPTION':meniscus_material.node_tree.nodes.remove(node)
for obj in groups['liquid']:
    if obj.name=='Subtle_contact_meniscus':obj.data.materials.clear();obj.data.materials.append(meniscus_material)
# The original wood colour, normal and roughness maps survive glTF import.
# Preserve the source SVG registration and the existing inward laser relief.
for o in groups['shell']:
    if o.type!='MESH':continue
    for material in o.data.materials:
        if not material or not material.use_nodes:continue
        for n in material.node_tree.nodes:
            if n.type=='BSDF_PRINCIPLED':
                n.inputs['IOR'].default_value=1.46
                n.inputs['Coat Weight'].default_value=.10
                n.inputs['Coat Roughness'].default_value=.48

scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=samples;scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.018 if proof else .02;scene.cycles.adaptive_min_samples=32;scene.cycles.use_denoising=True
scene.cycles.max_bounces=12;scene.cycles.transmission_bounces=10;scene.cycles.transparent_max_bounces=12
scene.cycles.diffuse_bounces=4;scene.cycles.glossy_bounces=6;scene.cycles.use_persistent_data=True
scene.render.threads_mode='FIXED';scene.render.threads=8
scene.render.film_transparent=True;scene.cycles.film_transparent_glass=True;scene.cycles.film_transparent_roughness=.1
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='8'
scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=-2.5;scene.view_settings.gamma=1
world=bpy.data.worlds.new('Neutral photographic studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.25,.28,.25,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.07;scene.world=world
def area(name,location,target,power,sx,sy,color):
    light=bpy.data.lights.new(name,'AREA');light.energy=power;light.shape='RECTANGLE';light.size=sx;light.size_y=sy;light.color=color
    obj=bpy.data.objects.new(name,light);scene.collection.objects.link(obj);obj.location=location;obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler();return obj
target=(0,0,.085)
area('Large softbox',(-.28,-.26,.24),target,18,.12,.30,(1,.96,.90))
area('Soft bounce',(.30,-.12,.20),target,1,.20,.30,(.93,.96,1))
area('Narrow rear reflection',(.19,.19,.29),target,3,.065,.24,(1,.98,.94))
area('Overhead film reflection',(-.05,.03,.48),target,2,.23,.15,(1,1,1))
# A real studio's pale backdrop is seen through clear packaging. Keep it out
# of primary camera rays so the asset retains alpha, but let transmission rays
# see the lit neutral field instead of a nearly black transparent-film world.
backdrop=bpy.data.materials.new('Neutral_transmission_backdrop');backdrop.use_nodes=True
bn=backdrop.node_tree.nodes;bn.clear();bo=bn.new('ShaderNodeOutputMaterial');be=bn.new('ShaderNodeEmission');be.inputs['Color'].default_value=rgb('#F8F6EF');be.inputs['Strength'].default_value=5;backdrop.node_tree.links.new(be.outputs[0],bo.inputs['Surface'])
bpy.ops.mesh.primitive_plane_add(size=2,location=(0,.40,.10),rotation=(math.pi/2,0,0));back=bpy.context.object;back.name='Studio_backdrop_seen_only_through_transmission';back.data.materials.append(backdrop)
back.visible_camera=False;back.visible_diffuse=False;back.visible_glossy=False;back.visible_shadow=False
floor_mat,fp,fo=principled('Ivory studio floor','#F8F6EF',.7)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.00012));floor=bpy.context.object;floor.name='Studio_shadow_catcher';floor.data.materials.append(floor_mat);floor.is_shadow_catcher=True
camera_data=bpy.data.cameras.new('Product_camera');camera=bpy.data.objects.new('Product_camera',camera_data);scene.collection.objects.link(camera);scene.camera=camera
camera_data.type='ORTHO';camera_data.lens=85;camera_data.clip_start=.001;camera_data.clip_end=100
macro_finish={}
def refine_cap_macro():
    if macro_finish:return
    # Interpolate side shading across coincident trace vertices without welding
    # them. Preserve flat roofs and corners exceeding the 35-degree threshold.
    for obj in groups['cap']:
        if obj.type!='MESH':continue
        mesh=obj.data;mesh.update()
        axis=(obj.matrix_world.inverted().to_3x3()@Vector((0,0,1))).normalized()
        sides={};normals=[normal.vector.copy() for normal in mesh.corner_normals]
        for polygon in mesh.polygons:
            if abs(polygon.normal.dot(axis))>.5 or polygon.area<1e-12:continue
            for index in polygon.vertices:
                key=tuple(round(value,6) for value in mesh.vertices[index].co)
                sides.setdefault(key,[]).append(polygon.normal.copy())
        for polygon in mesh.polygons:
            if abs(polygon.normal.dot(axis))>.5 or polygon.area<1e-12:continue
            for loop_index in polygon.loop_indices:
                vertex=mesh.vertices[mesh.loops[loop_index].vertex_index]
                key=tuple(round(value,6) for value in vertex.co);average=Vector((0,0,0))
                for normal in sides[key]:
                    if normal.dot(polygon.normal)>.819:average+=normal
                if average.length>0:normals[loop_index]=average.normalized()
        mesh.normals_split_custom_set(normals)
    # Macro shading resolves the same 2.5-micrometre finish as the live viewer;
    # avoid bevel-ray artefacts on the source's subpixel embossed features.
    bump.inputs['Distance'].default_value=.0000025
    for link in list(bump.inputs['Normal'].links):sl.remove(link)
    macro_finish.update({'method':'Corner-normal interpolation only on coincident side vertices; no weld, modifier or moved position','siliconeBumpMetres':.0000025,'opticalBevel':False,'maximumSmoothingAngleDegrees':35})
def frame(mode):
    if mode=='cap':refine_cap_macro()
    # Transparent-film glass alpha is a noisy Monte-Carlo coverage estimate
    # which OIDN cannot denoise. Transparent packaging instead retains the
    # physically transmitted neutral studio backdrop in RGB, with alpha only
    # around the object; opaque product modes keep their existing output.
    scene.cycles.film_transparent_glass=mode not in ['refill','detail']
    visible={'product':['shell','cap','inlay','seal','liquid'],'shell':['shell'],'cap':['cap'],'refill':['inlay','seal','liquid'],'detail':['inlay','seal','liquid']}[mode]
    for name,objects in groups.items():
        for obj in objects:obj.hide_render=name not in visible
    for obj in volume_parts:obj.hide_render=True
    liquid_proxy.hide_render='liquid' not in visible
    elevation={'product':12,'shell':18,'cap':57,'refill':10,'detail':22}[mode]
    center=Vector((0,0,.085 if mode in ['product','shell'] else .088 if mode=='refill' else .163 if mode=='cap' else .156))
    height={'product':.207,'shell':.205,'cap':.087,'refill':.200,'detail':.070}[mode]
    e=math.radians(elevation);camera.location=center+Vector((0,-math.cos(e)*.8,math.sin(e)*.8));camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.ortho_scale=height
    scene.render.resolution_x=1536 if mode=='detail' and not proof else size;scene.render.resolution_y=1024 if mode=='detail' and not proof else int(size*1.25)
    floor.hide_render=mode in ['cap','detail']
    return {'elevation':elevation,'orthographicHeightMetres':height,'camera':list(camera.location),'center':list(center),'width':scene.render.resolution_x,'height':scene.render.resolution_y}
def scent(name):
    sp.inputs['Base Color'].default_value=rgb(bundle['palette'][name]['cap'])
    appearance=bundle['liquidAppearances'][name];gp.inputs['Base Color'].default_value=rgb(appearance['color']);absorb.inputs['Color'].default_value=rgb(appearance['attenuationColor']);absorb.inputs['Density'].default_value=1/(appearance['attenuationDistance']*.001)
    for node in meniscus_material.node_tree.nodes:
        if node.type=='BSDF_PRINCIPLED':node.inputs['Base Color'].default_value=rgb(appearance['color'])

jobs=[('cap','argan')] if '--cap-proof' in args else [('product','aloe'),('cap','argan')] if proof else [('product',s) for s in ['aloe','argan','bamboo']]+[('refill',s) for s in ['aloe','argan','bamboo']]+[('shell','aloe'),('cap','argan'),('detail','aloe')]
if '--refill-proof' in args:jobs=[('refill','aloe')];scene.cycles.samples=32;scene.render.resolution_percentage=40
frames={}
reuse_job=None
complete_reuse=None;complete_reuse_job=None
if reuse_frames_dir:
    complete_reuse=json.loads((reuse_frames_dir/'render-manifest.json').read_text(encoding='utf8'))
    complete_reuse_job=json.loads((reuse_frames_dir/'job-provenance.json').read_text(encoding='utf-8-sig'))
    assert complete_reuse['geometryUnchanged'] and complete_reuse['geometryBefore']==complete_reuse['geometryAfter']
    assert complete_reuse['sourceGlbSha256']==bundle['glb']['sha256'] and complete_reuse['source']==bundle['source']
    assert hashlib.sha256((reuse_frames_dir/complete_reuse_job['renderRecipeSnapshot']).read_bytes()).hexdigest()==complete_reuse_job['renderRecipeSha256']
if reuse_dir:
    reuse_job=json.loads((reuse_dir/'job-provenance.json').read_text(encoding='utf-8-sig'))
    assert hashlib.sha256((reuse_dir/reuse_job['renderRecipeSnapshot']).read_bytes()).hexdigest()==reuse_job['renderRecipeSha256']
    assert hashlib.sha256((reuse_dir/'source-operative.glb').read_bytes()).hexdigest()==bundle['glb']['sha256']
    reuse_log=(reuse_dir.parent/(reuse_dir.name+'.log')).read_text(encoding='utf-8-sig')
for mode,fragrance in jobs:
    scent(fragrance);projection=frame(mode);name=f'{mode}-{fragrance}';scene.render.filepath=str(output/f'{name}.png');start=time.time();print('SOURCE_LOCKED_RENDER',name,flush=True)
    reused_complete=bool(complete_reuse and mode!='cap' and not proof)
    if reused_complete:
        old=complete_reuse['frames'][name];raw=(reuse_frames_dir/f'{name}.png').read_bytes()
        assert hashlib.sha256(raw).hexdigest()==old['sha256'] and old['samples']>=128
        assert all(old[key]==value for key,value in projection.items()),'Camera changed; frame reuse is invalid'
        (output/f'{name}.png').write_bytes(raw)
        frames[name]={**old,'reusedCompletedFrame':True}
        continue
    reused=bool(reuse_dir and mode=='product' and not proof)
    if reused:
        phase=reuse_log.split('SOURCE_LOCKED_RENDER '+name,1)[1].split('SOURCE_LOCKED_RENDER',1)[0]
        assert 'Sample 128/128' in phase and re.search(r"Saved: '[^\n]*"+re.escape(name)+r"\.png'",phase),'Incomplete source frame cannot be reused'
        shutil.copyfile(reuse_dir/f'{name}.png',output/f'{name}.png')
    else:bpy.ops.render.render(write_still=True)
    frames[name]={**projection,'mode':mode,'scent':fragrance,'samples':samples,'adaptiveNoiseThreshold':scene.cycles.adaptive_threshold,'minimumSamples':scene.cycles.adaptive_min_samples,'seconds':None if reused else round(time.time()-start,2),'reusedCompletedOpaqueFrame':reused,'renderRecipeSha256':reuse_job['renderRecipeSha256'] if reused else executed_recipe_sha,'sha256':hashlib.sha256((output/f'{name}.png').read_bytes()).hexdigest()}
after=geometry_digest();assert before==after,'Rendering changed source geometry or transforms'
assert hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()==executed_recipe_sha,'Recipe changed during rendering'
manifest={'schema':'bamboo-cycles-render-v1','blenderVersion':bpy.app.version_string,'sourceGlbSha256':bundle['glb']['sha256'],'source':bundle['source'],'geometryBefore':before,'geometryAfter':after,'geometryUnchanged':True,'liquidOpticalBoundary':proxy_proof,'macroSurfaceShading':macro_finish,'renderRecipeSha256':executed_recipe_sha,'reusedOpaqueJob':reuse_job or (complete_reuse or {}).get('reusedOpaqueJob'),'reusedFrameJob':complete_reuse_job,'originalEngravingSha256':bundle['source']['assembly/original-engraving.svg'],'renderer':'Cycles CPU','colorManagement':'AgX Medium High Contrast, exposure-2.5','geometryModifiers':[],'opticalBevelOnlyMetres':.000025,'frames':frames}
(output/'render-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
print('SOURCE_LOCKED_RENDER_COMPLETE',len(frames),flush=True)
