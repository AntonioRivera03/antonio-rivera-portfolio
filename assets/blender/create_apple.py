"""Build the portfolio apple in Blender; retain every pre-existing scene.

Run with Blender's Python console, or:
    blender --background --python create_apple.py

The export is a self-contained, uncompressed glTF 2.0 asset with Y up.
All surface details are authored procedurally; no external assets are used.
"""

from pathlib import Path
from math import sin, cos, pi, exp
import json
import random
import argparse
import sys

import bpy
import bmesh
from mathutils import Vector


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parent / "generated")
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
OUTPUT = args.output.resolve()
OUTPUT.mkdir(parents=True, exist_ok=True)
TAG = 'portfolio_apple_generated'


def create_scene():
    # Only replace a previously generated apple scene, never user content.
    previous = bpy.data.scenes.get('Portfolio Apple')
    if previous and previous.get(TAG):
        for obj in list(previous.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.scenes.remove(previous)
    scene = bpy.data.scenes.new('Portfolio Apple')
    scene[TAG] = True
    bpy.context.window.scene = scene
    model = bpy.data.collections.new('Apple · modeled surfaces')
    studio = bpy.data.collections.new('Studio · preview only')
    scene.collection.children.link(model)
    scene.collection.children.link(studio)
    return scene, model, studio


scene, model, studio = create_scene()
root = bpy.data.objects.new('Apple', None)
model.objects.link(root)
root['description'] = 'Organic five-lobed apple with a recessed crown, curved stem and veined leaf'


def material(name, color, roughness, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Coat Weight'].default_value = coat
    shader.inputs['Coat Roughness'].default_value = 0.28
    return mat, shader


skin, skin_shader = material('Apple skin · wax and lenticels', (0.48, 0.037, 0.016), 0.36, 0.20)
leaf_mat, leaf_shader = material('Leaf · olive green', (0.09, 0.19, 0.035), 0.51, 0.05)
vein_mat, _ = material('Leaf veins · raised midrib', (0.22, 0.30, 0.071), 0.58)
stem_mat, stem_shader = material('Stem · warm weathered wood', (0.17, 0.073, 0.028), 0.73)
cut_mat, _ = material('Stem cut · exposed pale wood', (0.40, 0.25, 0.11), 0.82)
calyx_mat, _ = material('Calyx · dried sepals', (0.10, 0.047, 0.023), 0.88)


def noise_bump(mat, shader, scale, strength, distance):
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    tex = nodes.new('ShaderNodeTexNoise')
    tex.inputs['Scale'].default_value = scale
    tex.inputs['Detail'].default_value = 3.0
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = strength
    bump.inputs['Distance'].default_value = distance
    links.new(tex.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], shader.inputs['Normal'])


noise_bump(skin, skin_shader, 145, 0.12, 0.008)
noise_bump(stem_mat, stem_shader, 32, 0.32, 0.019)
noise_bump(leaf_mat, leaf_shader, 90, 0.10, 0.004)


def mesh_object(name, vertices, faces, mat, colors=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    # Collapse coincident parametric poles so smooth normals remain continuous.
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000001)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    # Vertex colors below use original vertex indices, so body/leaf cleanup
    # happens after those attributes have been populated instead.
    if not colors:
        bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    model.objects.link(obj)
    obj.parent = root
    obj.data.materials.append(mat)
    for poly in mesh.polygons:
        poly.use_smooth = True
    if colors:
        attr = mesh.color_attributes.new(name='Surface color', type='FLOAT_COLOR', domain='POINT')
        for index, color in enumerate(colors):
            attr.data[index].color = (*color, 1)
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        color_node = nodes.new('ShaderNodeVertexColor')
        color_node.layer_name = attr.name
        links.new(color_node.outputs['Color'], nodes.get('Principled BSDF').inputs['Base Color'])
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000001)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(mesh)
        bm.free()
    return obj


def apple_surface(theta, phi):
    # Broad shoulders and narrower base; the five ribs are strongest at the crown.
    top = exp(-((theta - 0.40) / 0.48) ** 2)
    bottom = exp(-((theta - 2.82) / 0.48) ** 2)
    ribs = (0.009 + 0.037 * top + 0.022 * bottom) * cos(5 * phi + 0.16)
    radius = 1.01 * max(0, sin(theta)) ** 0.82 * (1 + 0.12 * cos(theta))
    radius *= 1 + ribs + 0.014 * sin(3 * phi + theta) + 0.007 * sin(7 * phi - 2 * theta)
    z = 1.005 * cos(theta)
    z -= 0.272 * exp(-(theta / 0.29) ** 2)
    z += 0.145 * exp(-((pi - theta) / 0.26) ** 2)
    z += 0.022 * cos(5 * phi + 0.16) * sin(theta) * (top + bottom)
    z += 0.018 * cos(phi + 0.9) * sin(theta)
    x = radius * cos(phi) + 0.025 * cos(theta)
    y = radius * sin(phi) * 0.968 + 0.016 * sin(2 * theta)
    return (x, y, z)


vertices, faces, colors = [], [], []
latitudes, longitudes = 96, 144
rng = random.Random(18)
for j in range(latitudes + 1):
    theta = pi * j / latitudes
    for i in range(longitudes):
        phi = 2 * pi * i / longitudes
        vertices.append(apple_surface(theta, phi))
        # Slightly mottled red/gold coloring gives the native asset organic detail.
        blush = 0.5 + 0.5 * sin(phi - 0.75)
        stripe = 0.5 + 0.5 * sin(39 * phi + 2.5 * sin(theta * 5) + sin(phi * 8))
        mottling = 0.94 + 0.05 * sin(13 * phi + 9 * theta) + 0.025 * sin(47 * phi - 32 * theta)
        freckle = rng.random() > 0.982 and 0.3 < theta < 2.8
        color = (0.43 + 0.13 * blush, 0.022 + 0.036 * (1 - blush) + 0.015 * stripe, 0.010 + 0.008 * stripe)
        if freckle:
            color = tuple(a * 0.70 + b * 0.30 for a, b in zip(color, (0.61, 0.39, 0.15)))
        colors.append(tuple(c * mottling for c in color))
for j in range(latitudes):
    for i in range(longitudes):
        ni = (i + 1) % longitudes
        a, b = j * longitudes + i, j * longitudes + ni
        c, d = (j + 1) * longitudes + ni, (j + 1) * longitudes + i
        faces.append((a, d, c, b))
body = mesh_object('Apple Body', vertices, faces, skin, colors)


def tube(name, points, radii, mat, sides=12, bark=False):
    vertices, faces = [], []
    for index, point in enumerate(points):
        previous = Vector(points[max(0, index - 1)])
        following = Vector(points[min(len(points) - 1, index + 1)])
        tangent = (following - previous).normalized()
        reference = Vector((0, 1, 0))
        axis1 = tangent.cross(reference).normalized()
        axis2 = tangent.cross(axis1).normalized()
        for side in range(sides):
            angle = 2 * pi * side / sides
            radius = radii[index]
            if bark:
                radius *= 1 + 0.065 * sin(7 * angle + index * 0.13) + 0.033 * sin(3 * angle - index * 0.22)
            vertices.append(tuple(Vector(point) + radius * (cos(angle) * axis1 + sin(angle) * axis2)))
    for index in range(len(points) - 1):
        for side in range(sides):
            a = index * sides + side
            b = index * sides + (side + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.append(tuple(reversed(range(sides))))
    faces.append(tuple((len(points) - 1) * sides + i for i in range(sides)))
    return mesh_object(name, vertices, faces, mat)


stem_points, stem_radii = [], []
for i in range(33):
    t = i / 32
    stem_points.append((0.023 + 0.045 * t + 0.092 * t * t, 0.018 * sin(t * pi) - 0.025 * t, 0.716 + 0.608 * t))
    stem_radii.append(0.045 * (1 - 0.26 * t) * (1 + 0.09 * sin(9 * t)))
stem = tube('Apple Stem', stem_points, stem_radii, stem_mat, sides=18, bark=True)
stem.data.materials.append(cut_mat)
stem.data.polygons[-1].material_index = 1
stem.data.polygons[-1].use_smooth = False


def leaf_point(t, across):
    width = 0.239 * max(0, sin(pi * t)) ** 0.91 * (1 - 0.13 * t)
    # Tiny edge serrations and a shallow folded midrib survive all rotations.
    width *= 1 + 0.022 * sin(36 * pi * t)
    x = 0.105 - 0.995 * t
    y = -0.015 + 0.095 * sin(pi * t * 0.78) + width * across
    z = 1.160 + 0.345 * sin(pi * t * 0.64)
    z += (0.057 * across - 0.058 * across * across) * sin(pi * t)
    z += 0.012 * sin(5 * pi * t) * across * across
    return Vector((x, y, z))


vertices, faces, colors = [], [], []
length_steps, width_steps = 64, 20
for j in range(length_steps + 1):
    t = j / length_steps
    for i in range(width_steps + 1):
        across = 2 * i / width_steps - 1
        vertices.append(tuple(leaf_point(t, across)))
        tint = 0.83 + 0.13 * sin(pi * t) + 0.07 * cos(across * pi)
        colors.append((0.095 * tint, 0.203 * tint, 0.033 * tint))
for j in range(length_steps):
    for i in range(width_steps):
        a = j * (width_steps + 1) + i
        faces.append((a, a + 1, a + width_steps + 2, a + width_steps + 1))
leaf = mesh_object('Apple Leaf', vertices, faces, leaf_mat, colors)
solidify = leaf.modifiers.new('Delicate leaf thickness', 'SOLIDIFY')
solidify.thickness = 0.0045
solidify.offset = 0
leaf_mat.surface_render_method = 'DITHERED'
leaf_mat.use_backface_culling = False

midrib = [tuple(leaf_point(i / 48, 0) + Vector((0, 0, 0.006))) for i in range(49)]
tube('Leaf Midrib', midrib, [0.009 * (1 - 0.82 * i / 48) for i in range(49)], vein_mat, sides=8)
for side in (-1, 1):
    for index, t0 in enumerate((0.15, 0.27, 0.39, 0.51, 0.63, 0.74)):
        points, radii = [], []
        for j in range(13):
            s = j / 12
            point = leaf_point(t0 + 0.13 * s, side * 0.93 * s)
            point.z += 0.004
            points.append(tuple(point))
            radii.append(0.0039 * (1 - 0.82 * s))
        tube(f'Leaf Vein {side:+d} {index + 1}', points, radii, vein_mat, sides=6)


# Five narrow dried sepals nestle inside the recessed base.
for i in range(5):
    phi = i * 2 * pi / 5 + 0.2
    vertices = [(-0.025, 0, -0.862)]
    for radius, offset, z in ((0.06, -0.28, -0.891), (0.145, 0, -0.928), (0.065, 0.28, -0.894)):
        vertices.append((-0.025 + radius * cos(phi + offset), radius * sin(phi + offset), z))
    mesh_object(f'Calyx Sepal {i + 1}', vertices, [(0, 1, 2), (0, 2, 3)], calyx_mat)


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


camera_data = bpy.data.cameras.new('Apple Preview Camera')
camera = bpy.data.objects.new('Apple Preview Camera', camera_data)
studio.objects.link(camera)
camera.location = (3.0, -6.8, 2.65)
point_at(camera, (0, 0, 0.27))
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 3.30
scene.camera = camera

for name, location, energy, size in (
    ('Key · broad softbox', (-3.5, -4.5, 5), 520, 4.0),
    ('Fill · low softbox', (4, -2, 1.8), 125, 3.0),
    ('Rim · crown light', (1.5, 3, 4), 460, 2.8),
):
    light_data = bpy.data.lights.new(name, 'AREA')
    light_data.energy, light_data.shape, light_data.size = energy, 'DISK', size
    light = bpy.data.objects.new(name, light_data)
    studio.objects.link(light)
    light.location = location
    point_at(light, (0, 0, 0))

world = bpy.data.worlds.new('Apple studio world')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.16, 0.16, 0.16, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 0.35
scene.world = world
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x = 900
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(OUTPUT / 'apple-preview.png')
scene.view_settings.view_transform = 'AgX'

bpy.context.view_layer.update()
for obj in bpy.context.selected_objects:
    obj.select_set(False)
for obj in model.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = body

# Framing the new asset never modifies any pre-existing object or scene.
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.region_3d.view_location = Vector((0, 0, 0.25))
            area.spaces.active.region_3d.view_distance = 4.7
            area.spaces.active.shading.type = 'MATERIAL'

bpy.ops.export_scene.gltf(
    filepath=str(OUTPUT / 'apple.glb'),
    export_format='GLB',
    use_selection=True,
    use_active_scene=True,
    export_apply=True,
    export_animations=False,
    export_cameras=False,
    export_lights=False,
    export_extras=True,
    export_yup=True,
    export_vertex_color='MATERIAL',
    export_all_vertex_colors=False,
)

# Write just the dedicated scene into a separate editable project.
bpy.data.libraries.write(str(OUTPUT / 'apple.blend'), {scene}, fake_user=True, compress=True)
bounds = [obj.matrix_world @ Vector(corner) for obj in model.objects if obj.type == 'MESH' for corner in obj.bound_box]
mins = [min(point[axis] for point in bounds) for axis in range(3)]
maxs = [max(point[axis] for point in bounds) for axis in range(3)]
metadata = {
    'glb': str(OUTPUT / 'apple.glb'),
    'blend': str(OUTPUT / 'apple.blend'),
    'generator': str(OUTPUT / 'create_apple.py'),
    'bytes': (OUTPUT / 'apple.glb').stat().st_size,
    'blender_bounds': {'min': mins, 'max': maxs},
    'gltf_axis': 'Y up; Blender +Z becomes glTF +Y; front is glTF +Z',
    'mesh_count': sum(obj.type == 'MESH' for obj in model.objects),
    'vertices_before_modifiers': sum(len(obj.data.vertices) for obj in model.objects if obj.type == 'MESH'),
    'suggested_camera': {'position': [0, 0.38, 5.6], 'target': [0, 0.24, 0], 'orthographic_height': 3.1},
}
(OUTPUT / 'apple-metadata.json').write_text(json.dumps(metadata, indent=2))
result = metadata
