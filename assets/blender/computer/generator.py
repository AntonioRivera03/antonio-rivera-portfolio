"""Procedural off-white retro computer, authored in Blender.

Creates a separate Resume Computer scene and preserves existing user scenes.
Exports a Y-up GLB with an unobstructed, UV-mapped CRT_Screen mesh.
"""
from pathlib import Path
from math import sin, cos, pi, sqrt
import json
import argparse
import sys

import bpy
import bmesh
import numpy as np
from mathutils import Vector


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parent / "generated")
parser.add_argument("--render-previews", action="store_true", help="Render transparent front, three-quarter, and rear inspection views")
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
OUTPUT = args.output.resolve()
OUTPUT.mkdir(parents=True, exist_ok=True)
TAG = 'portfolio_resume_computer'
previous = bpy.data.scenes.get('Resume Computer')
if previous and previous.get(TAG):
    for obj in list(previous.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.scenes.remove(previous)
scene = bpy.data.scenes.new('Resume Computer')
scene[TAG] = True
bpy.context.window.scene = scene
model = bpy.data.collections.new('Resume Computer · Model')
studio = bpy.data.collections.new('Resume Computer · Studio')
scene.collection.children.link(model)
scene.collection.children.link(studio)
root = bpy.data.objects.new('Resume_Computer', None)
model.objects.link(root)


def material(name, rgb, roughness=0.5, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    return mat


cream = material('CRT · neutral off-white ABS', (0.85, 0.849, 0.837), 0.60)
cream_front = material('CRT · molded off-white front', (0.85, 0.849, 0.837), 0.60)
bezel_mat = material('CRT · graphite inner bezel', (0.015, 0.015, 0.015), 0.42)
screen_mat = material('CRT · opaque glass placeholder', (0.015, 0.015, 0.015), 0.23)
screen_shader = screen_mat.node_tree.nodes.get('Principled BSDF')
screen_shader.inputs['Coat Weight'].default_value = 0.27
screen_shader.inputs['Coat Roughness'].default_value = 0.19
screen_shader.inputs['Emission Color'].default_value = (0, 0, 0, 1)
screen_shader.inputs['Emission Strength'].default_value = 0
recess_mat = material('Case · shadowed recesses', (0.045, 0.044, 0.035), 0.85)
metal_mat = material('Hardware · warm dull nickel', (0.36, 0.34, 0.29), 0.44, 0.6)
led_mat = material('Power · muted green', (0.12, 0.31, 0.11), 0.29)
led_shader = led_mat.node_tree.nodes.get('Principled BSDF')
led_shader.inputs['Emission Color'].default_value = (0.13, 0.33, 0.10, 1)
led_shader.inputs['Emission Strength'].default_value = 0.35


def texture_image(name, rgb, filename, non_color=False):
    height, width = rgb.shape[:2]
    pixels = np.ones((height, width, 4), dtype=np.float32)
    pixels[:, :, :3] = rgb
    image = bpy.data.images.new(name, width=width, height=height, alpha=False)
    if non_color:
        image.colorspace_settings.name = 'Non-Color'
    image.pixels.foreach_set(pixels.ravel())
    image.filepath_raw = str(OUTPUT / filename)
    image.file_format = 'PNG'
    image.save()
    image.pack()
    return image


def image_node(mat, image):
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = image
    return node


# Baked maps retain the molded ABS stipple and varying roughness in glTF.
rng = np.random.default_rng(41)
size = 512
yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) / size
micro = rng.normal(0, 1, (size, size))
micro = (micro + np.roll(micro, 1, 0) + np.roll(micro, 1, 1)) / 3
age = 0.5 + 0.25 * np.sin(xx * 2 * pi) * np.cos(yy * 2 * pi) + 0.20 * np.sin(xx * 4 * pi + yy * 2 * pi)
abs_rgb = np.empty((size, size, 3), dtype=np.float32)
for channel, base in enumerate((0.85, 0.849, 0.837)):
    abs_rgb[:, :, channel] = base * (0.995 + 0.006 * age) + 0.0022 * micro
abs_color = texture_image('ABS · neutral off-white molded color', abs_rgb, 'abs-color.png')
roughness = np.clip(0.60 + 0.030 * micro + 0.012 * age, 0, 1)
abs_rough = texture_image('ABS · baked satin roughness', np.repeat(roughness[:, :, None], 3, 2), 'abs-roughness.png', True)
dx = (np.roll(micro, -1, 1) - np.roll(micro, 1, 1)) * 0.16
dy = (np.roll(micro, -1, 0) - np.roll(micro, 1, 0)) * 0.16
normal = np.stack((-dx, -dy, np.ones_like(dx)), axis=2)
normal /= np.linalg.norm(normal, axis=2, keepdims=True)
abs_normal = texture_image('ABS · baked molded stipple', normal * 0.5 + 0.5, 'abs-normal.png', True)
for mat in (cream, cream_front):
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    links.new(image_node(mat, abs_color).outputs['Color'], shader.inputs['Base Color'])
    links.new(image_node(mat, abs_rough).outputs['Color'], shader.inputs['Roughness'])
    normal_node = nodes.new('ShaderNodeNormalMap')
    normal_node.inputs['Strength'].default_value = 0.62
    links.new(image_node(mat, abs_normal).outputs['Color'], normal_node.inputs['Color'])
    links.new(normal_node.outputs['Normal'], shader.inputs['Normal'])



def link_object(obj, mat):
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    model.objects.link(obj)
    obj.parent = root
    obj.data.materials.append(mat)
    return obj


def apply_modifiers(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    for mod in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False)


def rounded_box(name, location, dimensions, mat, bevel=0.025, segments=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    link_object(obj, mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if bevel:
        mod = obj.modifiers.new('Soft molded edges', 'BEVEL')
        mod.width, mod.segments = bevel, segments
        mod.affect = 'EDGES'
        mod = obj.modifiers.new('Weighted flat face normals', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
        apply_modifiers(obj)
    return obj


def mesh_object(name, vertices, faces, mat, smooth=False):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    model.objects.link(obj)
    obj.parent = root
    mesh.materials.append(mat)
    for poly in mesh.polygons:
        poly.use_smooth = smooth
    return obj


def smooth_normals(obj):
    for poly in obj.data.polygons:
        poly.use_smooth = True
    normal = obj.modifiers.new('Area weighted surface normals', 'WEIGHTED_NORMAL')
    normal.keep_sharp = True
    apply_modifiers(obj)


def assign_surface_uv(obj, scale=1.7, offset=0.0):
    uv = obj.data.uv_layers.active or obj.data.uv_layers.new(name='Surface UV')
    for poly in obj.data.polygons:
        normal = poly.normal
        axis = max(range(3), key=lambda index: abs(normal[index]))
        for loop_index in poly.loop_indices:
            co = obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
            coords = (co.y, co.z) if axis == 0 else ((co.x, co.z) if axis == 1 else (co.x, co.y))
            uv.data[loop_index].uv = (coords[0] * scale + offset, coords[1] * scale + offset)


def cut_recess(target, name, location, dimensions, radius=0.007):
    cutter = rounded_box(name + ' cutter', location, dimensions, recess_mat, radius, 5)
    bpy.context.view_layer.objects.active = target
    modifier = target.modifiers.new(name, 'BOOLEAN')
    modifier.operation = 'DIFFERENCE'
    modifier.solver = 'EXACT'
    modifier.object = cutter
    apply_modifiers(target)
    bpy.data.objects.remove(cutter, do_unlink=True)


def loft(name, loops, mat, close_ends=True, close_ring=False):
    count = len(loops[0])
    vertices = [point for ring in loops for point in ring]
    faces = []
    pairs = [(index, index + 1) for index in range(len(loops) - 1)]
    if close_ring:
        pairs.append((len(loops) - 1, 0))
    for first, second in pairs:
        for index in range(count):
            following = (index + 1) % count
            faces.append((first * count + index, first * count + following, second * count + following, second * count + index))
    if close_ends:
        faces.append(tuple(reversed(range(count))))
        faces.append(tuple((len(loops) - 1) * count + index for index in range(count)))
    obj = mesh_object(name, vertices, faces, mat, smooth=True)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def rect_loop(width, height, radius, center_z, depth, segments=24):
    points = []
    for cx, cz, start in ((width / 2 - radius, height / 2 - radius, 0),
                           (-width / 2 + radius, height / 2 - radius, 90),
                           (-width / 2 + radius, -height / 2 + radius, 180),
                           (width / 2 - radius, -height / 2 + radius, 270)):
        for i in range(segments):
            angle = (start + i * 90 / segments) * pi / 180
            points.append((cx + radius * cos(angle), depth, center_z + cz + radius * sin(angle)))
    return points


# The rear shares the front's rounded profile, stays inside its silhouette and
# narrows toward a backward-sloping rear wall. There is no rectangular rear box.
rounded_box('CRT lower recessed plinth', (0, 0.02, 1.70), (1.65, 1.32, 0.16), cream, 0.050, 8)
shell_sections = [
    (1.885, 1.970, 0.160, 2.7275, -0.735, 0.00),
    (1.884, 1.968, 0.160, 2.7275, -0.640, 0.00),
    (1.775, 1.900, 0.160, 2.7000, 0.420, 0.16),
    (1.690, 1.835, 0.160, 2.6700, 0.790, 0.27),
    (1.650, 1.790, 0.155, 2.6700, 0.865, 0.28),
]
shell_loops = []
for width, height, radius, center, depth, slope in shell_sections:
    shell_loops.append([(x, y - slope * ((z - center) / height + 0.5), z) for x, y, z in rect_loop(width, height, radius, center, depth)])
shell = loft('CRT tapered sloping rear shell', shell_loops, cream)

# Thin reveal is safely inset beneath the front rim; it cannot peek out at the
# top corners when the camera arrives squarely in front of the screen.
seam = loft('CRT inset shell parting line', [
    rect_loop(1.886, 1.972, 0.163, 2.7275, -0.748),
    rect_loop(1.886, 1.972, 0.163, 2.7275, -0.736),
], recess_mat)

loops = [
    rect_loop(1.895, 1.975, 0.165, 2.73, -0.750),
    rect_loop(1.930, 2.020, 0.175, 2.73, -0.805),
    rect_loop(1.930, 2.020, 0.175, 2.73, -0.898),
    rect_loop(1.923, 2.013, 0.173, 2.73, -0.928),
    rect_loop(1.908, 1.998, 0.168, 2.73, -0.950),
    rect_loop(1.890, 1.980, 0.160, 2.73, -0.964),
    rect_loop(1.570, 1.245, 0.120, 2.99, -0.964),
    rect_loop(1.548, 1.215, 0.110, 2.99, -0.946),
    rect_loop(1.465, 1.112, 0.080, 2.99, -0.858),
    rect_loop(1.465, 1.112, 0.080, 2.99, -0.750),
]
frame = loft('CRT rounded open front surround', loops, cream_front, close_ends=False, close_ring=True)
rounded_box('CRT recessed dark gasket', (0, -0.811, 2.99), (1.49, 0.09, 1.135), bezel_mat, 0.065, 12)


# Rounded physical glass clips corner pixels while retaining a full rectangular
# 4:3 coordinate system. Dense arc rows keep the small corner radius smooth.
columns = 48
half_width, half_height, corner_radius = 0.7, 0.525, 0.055
arc_angles = np.linspace(0, pi / 2, 13)
row_heights = (
    [-half_height + corner_radius * (1 - cos(angle)) for angle in arc_angles]
    + list(np.linspace(-half_height + corner_radius, half_height - corner_radius, 37)[1:-1])
    + [half_height - corner_radius + corner_radius * sin(angle) for angle in arc_angles]
)
vertices, faces = [], []
for z in row_heights:
    edge_offset = max(0, abs(z) - (half_height - corner_radius))
    extent = half_width - corner_radius + sqrt(max(0, corner_radius ** 2 - edge_offset ** 2))
    for i in range(columns + 1):
        x = (2 * i / columns - 1) * extent
        bow = 0.08 * max(0, (1 - (x / half_width) ** 2) * (1 - (z / half_height) ** 2))
        vertices.append((x, -0.86 - bow, z))
for j in range(len(row_heights) - 1):
    for i in range(columns):
        a = j * (columns + 1) + i
        faces.append((a, a + 1, a + columns + 2, a + columns + 1))
screen = mesh_object('CRT_Screen', vertices, faces, screen_mat, smooth=True)
screen.location = (0, 0, 2.99)
uv = screen.data.uv_layers.new(name='Screen UV')
for loop in screen.data.loops:
    position = screen.data.vertices[loop.vertex_index].co
    # Blender flips V on glTF export; UVs follow physical coordinates, not rows.
    uv.data[loop.index].uv = (position.x / (2 * half_width) + 0.5, 0.5 - position.z / (2 * half_height))
screen['corner_radius'] = corner_radius
screen['role'] = 'Replace this single opaque material with live document. No overlay glass.'
screen['screen_width'] = 1.4
screen['screen_height'] = 1.05


# A real narrow recessed floppy opening replaces the protruding lips.
cut_recess(frame, 'Floppy molded opening', (0.31, -0.865, 2.180), (0.89, 0.35, 0.044), 0.007)
rounded_box('Floppy dark interior', (0.31, -0.739, 2.180), (0.91, 0.025, 0.046), recess_mat, 0.006, 5)
rounded_box('Floppy inner lower guide', (0.31, -0.914, 2.165), (0.81, 0.067, 0.008), cream, 0.003, 4)
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.006, depth=0.003, location=(0.804, -0.966, 2.180), rotation=(pi / 2, 0, 0))
eject_hole = bpy.context.object
eject_hole.name = 'Floppy recessed eject pinhole'
link_object(eject_hole, recess_mat)
rounded_box('Power status light', (-0.695, -0.972, 1.900), (0.020, 0.012, 0.015), led_mat, 0.006, 6)
rounded_box('Case understated badge inset', (-0.695, -0.968, 2.180), (0.092, 0.006, 0.092), cream, 0.012, 8)
for index in range(3):
    rounded_box(f'Badge fine embossed stripe {index + 1}', (-0.695, -0.973, 2.200 - index * 0.020), (0.050, 0.003, 0.003), metal_mat, 0.001, 3)

# Through-cut horizontal side vents and top slots have actual rounded walls.
for side in (-1, 1):
    for index in range(7):
        cut_recess(shell, f'Lower side cooling slot {side} {index + 1}', (side * 0.91, 0.005, 1.955 + index * 0.045), (0.40, 0.74, 0.023), 0.007)
    rounded_box(f'Side vent internal shadow {side}', (side * 0.715, 0.005, 2.09), (0.008, 0.80, 0.34), recess_mat, 0.003, 3)
for index in range(15):
    cut_recess(shell, f'Top cooling slot {index + 1}', (-0.56 + index * 0.08, -0.05, 3.675), (0.024, 0.46, 0.25), 0.007)
rounded_box('Top vent internal shadow', (0, -0.05, 3.552), (1.22, 0.51, 0.008), recess_mat, 0.003, 3)

# Rear connections sit on the same sloped plane as the housing.
rear_panel = rounded_box('Rear recessed connector panel', (0, 0.831, 2.03), (1.02, 0.019, 0.235), cream, 0.012, 6)
rear_panel.rotation_euler.x = 0.155
for index in range(4):
    port = rounded_box(f'Rear dark connector socket {index + 1}', (-0.345 + index * 0.23, 0.848, 2.03), (0.137, 0.018, 0.067), recess_mat, 0.009, 6)
    port.rotation_euler.x = 0.155
for side in (-1, 1):
    for z in (1.945, 3.37):
        y = 0.865 - 0.28 * ((z - 2.67) / 1.79 + 0.5)
        screw = rounded_box(f'Rear inset fastener {side} {z}', (side * 0.59, y + 0.002, z), (0.028, 0.009, 0.028), recess_mat, 0.012, 8)
        screw.rotation_euler.x = 0.155

for obj in (shell, frame):
    bevel = obj.modifiers.new('Molded recess edge radii', 'BEVEL')
    bevel.width, bevel.segments = 0.0018, 3
    bevel.limit_method = 'ANGLE'
    bevel.angle_limit = 0.25
    apply_modifiers(obj)
    smooth_normals(obj)
for obj in list(model.objects):
    if obj.type == 'MESH' and obj.data.materials[0] in (cream, cream_front):
        assign_surface_uv(obj)


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


camera_data = bpy.data.cameras.new('Resume Computer Camera')
camera = bpy.data.objects.new('Resume Computer Camera', camera_data)
studio.objects.link(camera)
camera.location = (3.5, -6.5, 4.15)
point_at(camera, (0, 0, 2.68))
camera_data.lens = 90
scene.camera = camera
for name, location, energy, size in (
    ('Computer key softbox', (-4, -4, 7), 680, 4.5),
    ('Computer gentle fill', (4, -2, 4.5), 330, 4),
    ('Computer edge softbox', (2, 4, 6), 730, 3.5),
):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.shape, data.size = energy, 'DISK', size
    obj = bpy.data.objects.new(name, data)
    studio.objects.link(obj)
    obj.location = location
    point_at(obj, (0, 0, 2))
world = bpy.data.worlds.new('Resume Computer soft studio')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.32, 0.35, 0.4, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 0.45
scene.world = world
scene.render.engine = 'CYCLES'
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.render.resolution_x = 1100
scene.render.resolution_y = 1100
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(OUTPUT / 'computer-preview.png')
scene.view_settings.view_transform = 'AgX'

bpy.context.view_layer.update()
for obj in bpy.context.selected_objects:
    obj.select_set(False)
for obj in model.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = screen

# Merge static surfaces by material for the website. Editable originals remain
# separate in the Blender scene; CRT_Screen stays independently addressable.
export_objects = [root, screen]
groups = {}
for obj in list(model.objects):
    if obj.type == 'MESH' and obj != screen:
        groups.setdefault(obj.data.materials[0], []).append(obj)
for mat, objects in groups.items():
    for selected in list(bpy.context.selected_objects):
        selected.select_set(False)
    copies = []
    for original in objects:
        duplicate = original.copy()
        duplicate.data = original.data.copy()
        model.objects.link(duplicate)
        duplicate.select_set(True)
        copies.append(duplicate)
    bpy.context.view_layer.objects.active = copies[0]
    if len(copies) > 1:
        bpy.ops.object.join()
    merged = copies[0]
    merged.name = 'Static · ' + mat.name
    export_objects.append(merged)
for selected in list(bpy.context.selected_objects):
    selected.select_set(False)
for obj in export_objects:
    obj.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=str(OUTPUT / 'computer.glb'),
    export_format='GLB', use_selection=True, use_active_scene=True,
    export_apply=True, export_animations=False, export_cameras=False,
    export_lights=False, export_extras=True, export_yup=True,
    export_all_vertex_colors=False,
)
export_mesh_count = len(export_objects) - 1
for merged in export_objects[2:]:
    bpy.data.objects.remove(merged, do_unlink=True)
bpy.data.libraries.write(str(OUTPUT / 'source.blend'), {scene}, fake_user=True, compress=True)
metadata = {
    'glb': str(OUTPUT / 'computer.glb'),
    'blend': str(OUTPUT / 'source.blend'),
    'bytes': (OUTPUT / 'computer.glb').stat().st_size,
    'screen': {
        'name': 'CRT_Screen', 'width': 1.4, 'height': 1.05, 'corner_radius': 0.055,
        'world_center': [0, 2.99, 0.94], 'world_edge_depth': 0.86,
        'object_translation': [0, 2.99, 0],
        'local_bounds': {'min': [-0.7, -0.525, 0.86], 'max': [0.7, 0.525, 0.94]},
        'uv': 'Physical XY maps to full [0,1] rectangle; V increases upward. Radius 0.055 clips corner pixels without stretching.',
        'normal': 'Front +Z. One opaque surface. No glass overlay.',
    },
    'coordinates': 'glTF Y up, front +Z; model root has no authored transform',
    'distant_camera': {'position': [3.5, 4.15, 6.5], 'target': [0, 2.68, 0], 'fov': 23},
    'near_camera': {'position': [0, 2.99, 2.85], 'target': [0, 2.99, 0.94], 'fov': 35},
    'mesh_count': sum(obj.type == 'MESH' for obj in model.objects),
    'runtime_mesh_count': export_mesh_count,
    'vertices': sum(len(obj.data.vertices) for obj in model.objects if obj.type == 'MESH'),
}
(OUTPUT / 'computer-metadata.json').write_text(json.dumps(metadata, indent=2))

if args.render_previews:
    views = [
        ('computer-preview.png', (3.5, -6.5, 4.15), (0, 0, 2.68), 'PERSP', 90),
        ('computer-front.png', (0, -6, 2.68), (0, 0, 2.68), 'ORTHO', 2.50),
        ('computer-rear.png', (-4.5, 6.2, 4.1), (0, 0, 2.68), 'PERSP', 90),
    ]
    for filename, position, target, camera_type, lens_or_scale in views:
        camera.location = position
        point_at(camera, target)
        camera.data.type = camera_type
        if camera_type == 'ORTHO':
            camera.data.ortho_scale = lens_or_scale
        else:
            camera.data.lens = lens_or_scale
        scene.render.filepath = str(OUTPUT / filename)
        bpy.ops.render.render(write_still=True)
    camera.location = (3.5, -6.5, 4.15)
    point_at(camera, (0, 0, 2.68))
    camera.data.type, camera.data.lens = 'PERSP', 90

result = metadata
