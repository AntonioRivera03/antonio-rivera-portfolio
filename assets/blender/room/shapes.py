"""Shared modelling helpers for the room generator.

Authoring coordinates are (x, height, depth) with +depth toward the viewer;
Blender receives Z-up. glTF export maps these back to (x, y, z).
"""
import bpy, bmesh, math
from mathutils import Vector, Matrix, Euler
from math import sin, cos, pi

COLLECTION = None


def use_collection(col):
    global COLLECTION
    COLLECTION = col


def p(x, h, d): return (x, -d, h)
def vec(t): return Vector(p(*t))


def own(ob, col=None):
    col = col or COLLECTION
    for c in list(ob.users_collection): c.objects.unlink(ob)
    col.objects.link(ob)
    return ob


def material(name, color, roughness=.5, metallic=0, sheen=0, sheen_roughness=.5, sheen_tint=(1, 1, 1)):
    m = bpy.data.materials.new(name); m.diffuse_color = (*color, 1); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Roughness'].default_value = roughness
    bs.inputs['Metallic'].default_value = metallic
    if sheen:
        bs.inputs['Sheen Weight'].default_value = sheen
        bs.inputs['Sheen Roughness'].default_value = sheen_roughness
        bs.inputs['Sheen Tint'].default_value = (*sheen_tint, 1)
    return m


def set_smooth(ob, smooth=True):
    if ob.type == 'MESH':
        ob.data.polygons.foreach_set('use_smooth', [smooth] * len(ob.data.polygons))
    return ob


def finish(ob, name, mat, bevel=0, smooth=True):
    ob.name = name; own(ob)
    if mat: ob.data.materials.append(mat)
    if bevel:
        m = ob.modifiers.new('Soft manufactured edges', 'BEVEL'); m.width = bevel; m.segments = 3
    if smooth and ob.type == 'MESH':
        set_smooth(ob)
        if bevel:
            m = ob.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL'); m.keep_sharp = True; m.weight = 40
    return ob


def box(name, at, dims, mat, bevel=.02):
    bpy.ops.mesh.primitive_cube_add(size=1, location=p(*at)); ob = bpy.context.object
    ob.dimensions = (dims[0], dims[2], dims[1]); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(ob, name, mat, bevel)


def uv_sphere(name, at, dims, mat, segments=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=p(*at)); ob = bpy.context.object
    ob.scale = (dims[0] / 2, dims[2] / 2, dims[1] / 2); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(ob, name, mat)


def ellipsoid(name, at, radii, mat, rot=(0, 0, 0), segments=32, rings=16):
    """radii and rot are given in (x, height, depth); rot is applied x, then height, then depth."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=(0, 0, 0)); ob = bpy.context.object
    ob.scale = (radii[0], radii[2], radii[1]); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    r = Matrix.Rotation(-rot[2], 4, 'Y') @ Matrix.Rotation(rot[1], 4, 'Z') @ Matrix.Rotation(rot[0], 4, 'X')
    ob.data.transform(r); ob.location = p(*at)
    return finish(ob, name, mat)


def cylinder(name, a, b, r, mat, vertices=24, bevel=.005):
    av, bv = vec(a), vec(b); delta = bv - av
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=r, depth=delta.length, location=(av + bv) / 2)
    ob = bpy.context.object; ob.rotation_mode = 'QUATERNION'; ob.rotation_quaternion = delta.to_track_quat('Z', 'Y')
    return finish(ob, name, mat, bevel)


def line(name, points, r, mat, closed=False, resolution=2):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.resolution_u = 1; cu.bevel_depth = r; cu.bevel_resolution = resolution
    spl = cu.splines.new('POLY'); spl.points.add(len(points) - 1)
    for q, co in zip(spl.points, points): q.co = (*p(*co), 1)
    spl.use_cyclic_u = closed
    cu.use_fill_caps = not closed
    ob = bpy.data.objects.new(name, cu); COLLECTION.objects.link(ob); cu.materials.append(mat)
    return ob


def normal_out(ob):
    bm = bmesh.new(); bm.from_mesh(ob.data); bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.to_mesh(ob.data); bm.free()


def mesh(name, vertices, faces, mat, uv=None, smooth=True):
    me = bpy.data.meshes.new(name); me.from_pydata([p(*v) for v in vertices], [], faces); me.update()
    ob = bpy.data.objects.new(name, me); COLLECTION.objects.link(ob)
    if mat: me.materials.append(mat)
    if uv:
        layer = me.uv_layers.new(name='UVMap')
        for loop in me.loops: layer.data[loop.index].uv = uv[loop.vertex_index]
    if smooth: set_smooth(ob)
    return ob


def loft(name, rings, mat, n=36, exponents=(.82, .85), subsurf=2, caps=True):
    """Each ring is (center x, height, center depth, width radius, depth radius)."""
    vv = []; ff = []
    ex, ez = exponents
    for x, h, d, rx, rd in rings:
        for i in range(n):
            a = 2 * pi * i / n
            vv.append((x + math.copysign(abs(cos(a)) ** ex, cos(a)) * rx, h, d + math.copysign(abs(sin(a)) ** ez, sin(a)) * rd))
    for j in range(len(rings) - 1):
        for i in range(n):
            k = j * n + i; kn = j * n + (i + 1) % n; ff.append((k, kn, kn + n, k + n))
    if caps: ff.extend([tuple(range(n - 1, -1, -1)), tuple((len(rings) - 1) * n + i for i in range(n))])
    ob = mesh(name, vv, ff, mat); normal_out(ob)
    if subsurf:
        mod = ob.modifiers.new('Smooth silhouette', 'SUBSURF'); mod.levels = subsurf; mod.render_levels = subsurf
    return ob


def tube(name, points, radii, mat, n=16, subsurf=1, caps=True):
    """A swept tube. Each radius may be a float or (across, second axis)."""
    vv = []; ff = []
    for j, co in enumerate(points):
        c = vec(co)
        tangent = (vec(points[min(len(points) - 1, j + 1)]) - vec(points[max(0, j - 1)])).normalized()
        ref = Vector((1, 0, 0)) if abs(tangent.x) < .8 else Vector((0, 1, 0))
        ax = tangent.cross(ref).normalized(); ay = tangent.cross(ax).normalized()
        radius = radii[j]; rx, ry = radius if isinstance(radius, tuple) else (radius, radius)
        for i in range(n):
            a = 2 * pi * i / n; b = c + ax * (cos(a) * rx) + ay * (sin(a) * ry); vv.append((b.x, b.z, -b.y))
    for j in range(len(points) - 1):
        for i in range(n):
            k = j * n + i; kn = j * n + (i + 1) % n; ff.append((k, kn, kn + n, k + n))
    if caps: ff.extend([tuple(range(n - 1, -1, -1)), tuple((len(points) - 1) * n + i for i in range(n))])
    ob = mesh(name, vv, ff, mat); normal_out(ob)
    if subsurf:
        mod = ob.modifiers.new('Soft organic transitions', 'SUBSURF'); mod.levels = subsurf; mod.render_levels = subsurf
    return ob


def bake(ob):
    """Apply every modifier (and convert curves) without operators; returns the mesh object."""
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    if ob.type == 'MESH':
        old = ob.data; ob.modifiers.clear(); ob.data = me
        if old.users == 0: bpy.data.meshes.remove(old)
        return ob
    new = bpy.data.objects.new(ob.name, me)
    for c in ob.users_collection: c.objects.link(new)
    new.parent = ob.parent; new.matrix_world = ob.matrix_world.copy()
    name = ob.name; bpy.data.objects.remove(ob, do_unlink=True); new.name = name
    return new


def merge(name, parts):
    """Bake parts into one world-space mesh object and delete the originals."""
    bm = bmesh.new()
    materials = []
    bpy.context.view_layer.update()
    for ob in parts:
        ob = bake(ob)
        me = ob.data.copy(); me.transform(ob.matrix_world)
        offset = len(materials)
        for m in me.materials:
            if m not in materials: materials.append(m)
        remap = [materials.index(m) for m in me.materials] if me.materials else []
        if remap:
            idx = [0] * len(me.polygons); me.polygons.foreach_get('material_index', idx)
            me.polygons.foreach_set('material_index', [remap[i] for i in idx])
        bm.from_mesh(me)
        bpy.data.meshes.remove(me); bpy.data.objects.remove(ob, do_unlink=True)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for m in materials: me.materials.append(m)
    ob = bpy.data.objects.new(name, me); COLLECTION.objects.link(ob)
    return ob


def fuse(name, parts, mat, voxel=.006, smooth=.6, repeat=6, ratio=None, volume=True):
    """Union overlapping forms into one seamless surface: voxel remesh, relax, then reduce."""
    ob = merge(name, parts)
    rm = ob.modifiers.new('Seamless union', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = voxel; rm.adaptivity = 0; rm.use_smooth_shade = True
    if repeat:
        sm = ob.modifiers.new('Relax voxel steps', 'LAPLACIANSMOOTH'); sm.lambda_factor = smooth; sm.iterations = repeat
        sm.use_volume_preserve = volume; sm.use_normalized = True
    if ratio:
        dc = ob.modifiers.new('Web budget', 'DECIMATE'); dc.ratio = ratio
    ob = bake(ob)
    ob.data.validate(clean_customdata=False)
    ob.data.materials.clear(); ob.data.materials.append(mat)
    set_smooth(ob)
    return ob


def empty(name, at):
    ob = bpy.data.objects.new(name, None); COLLECTION.objects.link(ob); ob.location = p(*at)
    return ob


def parent_keep(ob, par):
    bpy.context.view_layer.update(); world = ob.matrix_world.copy()
    ob.parent = par; ob.matrix_parent_inverse = Matrix.Identity(4); ob.matrix_world = world


def image_texture(mat, image, to='Base Color', scale=None):
    nodes = mat.node_tree.nodes; links = mat.node_tree.links
    tex = nodes.new('ShaderNodeTexImage'); tex.image = image
    if scale:
        coords = nodes.new('ShaderNodeTexCoord'); mapping = nodes.new('ShaderNodeMapping')
        mapping.inputs['Scale'].default_value = (*scale, 1)
        links.new(coords.outputs['UV'], mapping.inputs['Vector']); links.new(mapping.outputs['Vector'], tex.inputs['Vector'])
    bsdf = nodes['Principled BSDF']
    if to == 'Normal':
        image.colorspace_settings.name = 'Non-Color'
        nm = nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = .6
        links.new(tex.outputs['Color'], nm.inputs['Color']); links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        links.new(tex.outputs['Color'], bsdf.inputs[to])
    return tex


def numpy_image(name, pixels, out_dir=None, non_color=False):
    """pixels: float array (h, w, 4). Packed so the .blend and GLB stay self-contained."""
    import os
    h, w = pixels.shape[:2]
    im = bpy.data.images.new(name, w, h, alpha=False)
    im.pixels.foreach_set(pixels.astype('float32').ravel())
    if out_dir:
        im.filepath_raw = os.path.join(out_dir, name + '.png'); im.file_format = 'PNG'; im.save()
    im.pack()
    if non_color: im.colorspace_settings.name = 'Non-Color'
    return im
