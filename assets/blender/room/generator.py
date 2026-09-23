"""Builds the portfolio room: Antonio working at his desk beside a made twin bed.

Headless:     blender --background --python generator.py -- --output DIR
Interactive:  exec in a running Blender (e.g. over MCP) with __file__ set; the
              scene is cleared in place and preview renders are skipped.
"""
import bpy, math, random, os, json, argparse, sys, importlib
from math import sin, cos, pi
import numpy as np
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path: sys.path.insert(0, HERE)
import shapes as sh, avatar, bed
for module in (sh, avatar, bed): importlib.reload(module)
from shapes import p, vec, own, material, box, uv_sphere, cylinder, line, mesh

parser = argparse.ArgumentParser()
parser.add_argument('--output', default=os.path.join(HERE, 'generated'))
parser.add_argument('--skip-renders', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
INTERACTIVE = not bpy.app.background
OUT = os.path.abspath(args.output)
os.makedirs(OUT, exist_ok=True)
random.seed(11)


def reset_scene():
    if not INTERACTIVE:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        return
    # Clearing data in place keeps add-ons (and an MCP connection) alive.
    for block in (bpy.data.objects, bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.images,
                  bpy.data.textures, bpy.data.lights, bpy.data.cameras, bpy.data.actions, bpy.data.collections, bpy.data.worlds):
        bpy.data.batch_remove(list(block))


reset_scene()
scene = bpy.context.scene
scene.name = 'Antonio — Work and rest'
scene.unit_settings.system = 'METRIC'
scene.frame_start = 0; scene.frame_end = 120; scene.render.fps = 24
scene.frame_set(0)

furniture = bpy.data.collections.new('Furniture')
scene.collection.children.link(furniture)
studio = bpy.data.collections.new('Studio — preview only')
scene.collection.children.link(studio)
sh.use_collection(furniture)

oak = material('Natural oak • satin', (.65, .49, .32), .43)
white = material('Warm porcelain powdercoat', (.88, .865, .83), .37)
pillow_mat = material('Ivory cotton percale', (.87, .85, .79), .92)
charcoal = material('Graphite soft upholstery', (.095, .111, .116), .76)
shell = material('Charcoal polymer', (.068, .077, .080), .42)
black = material('Black glass edge', (.018, .024, .027), .25)
screen = material('Monitor pale blue screen', (.36, .53, .57), .23)
bs = screen.node_tree.nodes.get('Principled BSDF'); bs.inputs['Emission Color'].default_value = (.13, .22, .24, 1); bs.inputs['Emission Strength'].default_value = .23
silver = material('Brushed aluminum', (.53, .56, .56), .29, .72)
rubber = material('Caster rubber', (.028, .032, .03), .82)
keys = material('PBT warm white keycaps', (.81, .82, .79), .54)
muted = material('Muted desk display green', (.55, .66, .59), .6)


def make_texture(mat, name, base, kind):
    n = 384
    yy, xx = np.mgrid[:n, :n] / n
    rng = np.random.default_rng(18)
    if kind == 'wood':
        warped = yy + .005 * np.sin(xx * 15) + .008 * np.sin(xx * 5 + yy * 12)
        value = .045 * np.sin(warped * 230) + .022 * np.sin(warped * 612) + .015 * rng.normal(size=(n, n))
    else:
        value = .018 * np.sin(xx * n * pi) + .018 * np.sin(yy * n * pi) + .014 * rng.normal(size=(n, n))
    rgb = np.clip(np.array(base)[None, None, :] + value[:, :, None], 0, 1)
    pix = np.ones((n, n, 4)); pix[:, :, :3] = rgb
    sh.image_texture(mat, sh.numpy_image(name, pix, OUT))


make_texture(oak, 'oak-grain', (.72, .60, .43), 'wood')

# LEFT: quiet modern desk; low open frame and slim storage drawer.
DX = -2.5
box('Desk / solid oak top', (DX, 1.15, -.06), (3.30, .10, 1.28), oak, .045)
box('Desk / floating white drawer', (DX + .84, .975, -.07), (.92, .24, 1.05), white, .025)
box('Desk / drawer face', (DX + .84, .975, .474), (.85, .20, .045), white, .018)
box('Desk / recessed finger pull', (DX + .84, 1.054, .50), (.58, .018, .012), shell, .004)
for x in [DX - 1.40, DX + 1.40]:
    for d in [-.51, .39]:
        box('Desk / square tubular leg', (x, .556, d), (.058, 1.07, .058), white, .014)
        box('Desk / felt foot', (x, .025, d), (.063, .032, .063), rubber, .008)
    box('Desk / upper rail', (x, 1.055, -.06), (.065, .065, .98), white, .012)
box('Desk / back crossbar', (DX, .82, -.51), (2.87, .054, .054), white, .012)

# Accurate desktop monitor with glass, chin, rear body, riser and oval foot.
MX = DX - .18
box('Monitor / aluminum back', (MX, 1.585, -.405), (1.12, .665, .050), silver, .028)
box('Monitor / glass black bezel', (MX, 1.59, -.371), (1.087, .622, .023), black, .021)
box('Monitor / display', (MX, 1.61, -.354), (1.018, .535, .005), screen, .007)
box('Monitor / lower chin', (MX, 1.276, -.356), (1.08, .039, .014), silver, .010)
uv_sphere('Monitor / camera dot', (MX, 1.888, -.352), (.011, .011, .004), black, 12, 8)
uv_sphere('Monitor / status LED', (MX + .486, 1.278, -.344), (.005, .005, .003), keys, 12, 8)
box('Monitor / riser', (MX, 1.305, -.42), (.085, .26, .058), silver, .018)
box('Monitor / sculpted base', (MX, 1.217, -.27), (.37, .031, .28), silver, .045)
# Very restrained screen geometry. No baked web UI.
box('Monitor / sidebar', (MX - .438, 1.61, -.350), (.13, .535, .003), muted, .001)
for j, width in enumerate([.49, .38, .56, .31, .44, .51]):
    box('Monitor / code line', (MX - .08 + (width - .5) / 2, 1.79 - j * .056, -.347), (width, .008, .002), keys, .001)
line('Monitor / power cable', [(MX, 1.25, -.47), (MX, 1.10, -.53), (DX - 1.40, 1.055, -.54), (DX - 1.40, .04, -.54)], .008, shell)

# Keyboard, sculpted keycaps, mouse and soft desktop mat.
box('Desk / charcoal felt mat', (DX - .15, 1.207, .235), (1.82, .012, .43), charcoal, .041)
box('Keyboard / aluminum tray', (DX - .28, 1.236, .255), (.94, .036, .302), silver, .022)
box('Keyboard / inset plate', (DX - .28, 1.256, .255), (.903, .012, .271), shell, .012)
for row in range(5):
    for col in range(14):
        if row == 4 and 3 <= col <= 8: continue
        box('Keyboard / key %02d-%02d' % (row, col), (DX - .696 + col * .064, 1.273, .148 + row * .053), (.054, .025, .044), keys, .007)
box('Keyboard / space bar', (DX - .344, 1.273, .36), (.368, .025, .044), keys, .007)
uv_sphere('Mouse / ivory shell', (DX + .44, 1.263, .253), (.15, .095, .25), white, 24, 12)
line('Mouse / center split', [(DX + .44, 1.313, .16), (DX + .44, 1.312, .20), (DX + .44, 1.308, .24)], .0018, shell)
box('Mouse / scroll wheel', (DX + .44, 1.31, .205), (.018, .014, .042), rubber, .006)

# Small desk lamp creates a fine, graceful vertical accent.
LX = DX + 1.26
box('Lamp / oval foot', (LX, 1.229, -.32), (.27, .039, .25), white, .070)
cylinder('Lamp / stem', (LX, 1.25, -.35), (LX, 1.79, -.35), .018, silver)
cylinder('Lamp / angled arm', (LX, 1.79, -.35), (LX - .19, 1.88, -.26), .016, silver)
box('Lamp / slim shade', (LX - .24, 1.878, -.235), (.36, .054, .17), white, .033)
box('Lamp / diffuser', (LX - .24, 1.845, -.235), (.30, .008, .127), pillow_mat, .016)
for i in range(2):
    box('Desk / stacked notebook', (DX - 1.12, 1.222 + i * .045, -.02), (.43, .037, .31), pillow_mat if i == 0 else muted, .008)
box('Desk / pen', (DX - 1.15, 1.291, -.025), (.27, .012, .013), shell, .005)

# The person sits centred between the monitor and the keyboard's home row,
# back against the chair, forearms clearing the desk edge.
PX, SEAT, HIPD = DX - .22, .756, 1.08

# CHAIR: upholstered curved shell, armrests, metal star and casters. The front
# two spokes straddle the sneakers.
CX, CD = PX, HIPD - .10
cylinder('Chair / hydraulic foot', (CX, .19, CD), (CX, .52, CD), .055, silver)
cylinder('Chair / hydraulic sleeve', (CX, .22, CD), (CX, .38, CD), .080, shell)
box('Chair / tilt mechanism', (CX, .53, CD), (.32, .13, .39), shell, .037)
for i in range(5):
    a = 2 * pi * i / 5
    x = CX + sin(a) * .50; d = CD + cos(a) * .50
    cylinder('Chair / star spoke %d' % i, (CX, .23, CD), (x, .16, d), .039, silver)
    cylinder('Chair / wheel fork %d' % i, (x, .16, d), (x, .093, d), .021, silver)
    for off in [-.038, .038]:
        cylinder('Chair / caster %d' % i, (x + off - .020, .083, d), (x + off + .020, .083, d), .077, rubber, 20)
        cylinder('Chair / caster hub %d' % i, (x + off - .021, .083, d), (x + off + .021, .083, d), .026, shell, 16)
box('Chair / seat underside', (CX, .615, CD), (.74, .105, .68), shell, .13)
box('Chair / seat upholstery', (CX, .691, CD - .005), (.76, .13, .67), charcoal, .15)
# The back curves around the sides and leans softly backward toward the viewer.
verts = []; uv = []; faces = []
NU, NV = 30, 24
for j in range(NV + 1):
    v = j / NV; h = .92 + .70 * v
    for i in range(NU + 1):
        u = i / NU * 2 - 1
        width = .345 * (1 - .12 * v + .06 * sin(v * pi))
        verts.append((CX + u * width, h, CD + .30 + .10 * v - .11 * u * u)); uv.append((i / NU, j / NV))
for j in range(NV):
    for i in range(NU):
        k = j * (NU + 1) + i; faces.append((k, k + 1, k + NU + 2, k + NU + 1))
back = mesh('Chair / contoured upholstered back', verts, faces, charcoal, uv)
s = back.modifiers.new('Upholstery thickness', 'SOLIDIFY'); s.thickness = .070
b = back.modifiers.new('Bound cushion edges', 'BEVEL'); b.width = .045; b.segments = 3
perimeter = []
for i in range(NU + 1): perimeter.append(verts[i])
for j in range(1, NV + 1): perimeter.append(verts[j * (NU + 1) + NU])
for i in range(NU - 1, -1, -1): perimeter.append(verts[NV * (NU + 1) + i])
for j in range(NV - 1, 0, -1): perimeter.append(verts[j * (NU + 1)])
line('Chair / stitched back perimeter', [(x, h, d + .037) for x, h, d in perimeter], .006, shell, True)
for side in [-1, 1]:
    x = CX + side * .425
    cylinder('Chair / arm upright', (x, .63, CD + .14), (x, .98, CD + .13), .024, silver)
    box('Chair / soft armrest', (x, 1.005, CD - .025), (.105, .054, .39), shell, .042)
line('Chair / back support', [(CX, .55, CD + .13), (CX, .67, CD + .30), (CX, 1.03, CD + .38)], .036, silver)

# Apply geometry modifiers now; object animation stays live and exportable.
for ob in list(furniture.objects):
    if ob.type == 'CURVE' or (ob.type == 'MESH' and ob.modifiers): sh.bake(ob)

rig = avatar.build(PX, SEAT, HIPD)
desk_objects = set(furniture.objects)

# RIGHT: a made twin bed, in the same proportion system as the desk.
bed_objects = bed.build(2.35, .45, OUT)
avatar.animate(rig, scene)

desk_root = sh.empty('Desk_Setup', (-2.5, 0, 0))
bed_root = sh.empty('Bed_Setup', (2.35, 0, 0))
for ob in desk_objects:
    if ob.parent is None: sh.parent_keep(ob, desk_root)
for ob in bed_objects: sh.parent_keep(ob, bed_root)
desk_root.rotation_euler.z = math.radians(45)
bed_root.rotation_euler.z = math.radians(-45)
scene.frame_set(0); bpy.context.view_layer.update()


def bounds(objects):
    mn = [1e9] * 3; mx = [-1e9] * 3
    for ob in objects:
        if ob.type != 'MESH': continue
        for v in ob.bound_box:
            b = ob.matrix_world @ Vector(v); q = (b.x, b.z, -b.y)
            mn = [min(mn[i], q[i]) for i in range(3)]; mx = [max(mx[i], q[i]) for i in range(3)]
    return {'min': mn, 'max': mx}


# Preview studio. This collection is excluded from glTF export.
floor = box('Studio floor', (0, -.038, 0), (200, .06, 200), material('Studio white', (1, 1, 1), .85), .001); own(floor, studio)
world = bpy.data.worlds.new('White studio'); scene.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (1, 1, 1, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = .55


def area(name, at, energy, size, target):
    data = bpy.data.lights.new(name, 'AREA'); data.energy = energy; data.shape = 'DISK'; data.size = size
    ob = bpy.data.objects.new(name, data); studio.objects.link(ob); ob.location = p(*at)
    ob.rotation_euler = (vec(target) - ob.location).to_track_quat('-Z', 'Y').to_euler()


area('Large softbox left', (-4, 7, 4), 1250, 6, (0, .5, 0))
area('Broad window fill', (4, 5, -3), 900, 5, (0, .7, 0))
area('Front soft fill', (1, 4, 8), 500, 5, (0, .6, 0))
camd = bpy.data.cameras.new('Room camera'); cam = bpy.data.objects.new('Room camera', camd); studio.objects.link(cam)
info_bounds = bounds(furniture.objects)
span = max(info_bounds['max'][0] - info_bounds['min'][0], (info_bounds['max'][1] - info_bounds['min'][1]) * 1.6)
cam.location = p(0, .85 + 12 * math.tan(math.radians(12)), 12); target = vec((0, .85, 0))
cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler(); camd.type = 'ORTHO'; camd.ortho_scale = span * 1.06
scene.camera = cam
scene.render.engine = 'CYCLES'; scene.cycles.samples = 64; scene.cycles.use_denoising = True
scene.render.resolution_x = 1600; scene.render.resolution_y = 1000; scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'
scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = True
floor.is_shadow_catcher = True

info = {'coordinate_system': 'glTF Y-up; +Z faces viewer', 'bounds': info_bounds,
        'groups': {
            'Desk_Setup': {'pivot': [-2.5, 0, 0], 'yaw_degrees': 45, 'bounds': bounds(desk_objects)},
            'Bed_Setup': {'pivot': [2.35, 0, 0], 'yaw_degrees': -45, 'bounds': bounds(bed_objects)}},
        'scale': {'desk_and_person_units_per_metre': avatar.S, 'bed_units_per_metre': bed.S},
        'animation': {'name': 'Working', 'duration_seconds': 5, 'fps': 24, 'frames': [0, 120]}}
with open(os.path.join(OUT, 'layout-info.json'), 'w') as f: json.dump(info, f, indent=2)
print('LAYOUT_READY', json.dumps(info), flush=True)

triangles = 0
bpy.ops.object.select_all(action='DESELECT')
for ob in furniture.objects:
    if ob.type == 'MESH': ob.data.calc_loop_triangles(); triangles += len(ob.data.loop_triangles)
    ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'room.glb'), export_format='GLB', use_selection=True,
                          export_apply=False, export_yup=True, export_cameras=False, export_lights=False,
                          export_animations=True, export_animation_mode='ACTIVE_ACTIONS',
                          export_nla_strips_merged_animation_name='Working', export_force_sampling=True, export_frame_range=True)
info.update({'triangles': triangles, 'objects': len(furniture.objects), 'glb_bytes': os.path.getsize(os.path.join(OUT, 'room.glb'))})
with open(os.path.join(OUT, 'asset-info.json'), 'w') as f: json.dump(info, f, indent=2)
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'room.blend'), copy=INTERACTIVE)
if not (INTERACTIVE or args.skip_renders):
    scene.render.filepath = os.path.join(OUT, 'preview-front.png')
    bpy.ops.render.render(write_still=True)
    # A complementary higher angle makes hands, keyboard contact and bedding inspectable.
    cam.location = p(5, 4.8, 11); cam.rotation_euler = (vec((-.4, .8, .1)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = os.path.join(OUT, 'preview-detail.png')
    bpy.ops.render.render(write_still=True)
print('ROOM_COMPLETE', json.dumps(info), flush=True)
