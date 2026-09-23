"""A made twin bed: oak platform frame, channel-tufted headboard, fitted sheet,
a pressure-inflated pillow and a cloth-simulated buffalo-check flannel duvet
turned down at the head.

Authored in real metres around the mattress centre, then scaled to room units.
"""
import bpy, bmesh, math
import numpy as np
from math import sin, cos, pi
from mathutils import Vector
import shapes as sh

S = 1.5  # room units per metre

# Real twin dimensions (metres).
MW, ML, MT = .99, 1.90, .24      # mattress width, length, thickness
FRAME_W, FRAME_L = 1.07, 2.00
RAIL_LO, RAIL_HI = .12, .30
MATTRESS_TOP = RAIL_HI + MT - .02  # the mattress sits slightly into the frame
HEAD_H = 1.10
DUVET_W, DUVET_L = 1.73, 1.72    # from the turned-down fold to past the foot
FOLD = .50                        # fold line, measured from the head of the mattress
CUFF = .28


def flannel_image(out_dir):
    """Buffalo check with a 2/2 twill: red, black and the mixed squares between."""
    n = 256; check = n // 2
    y, x = np.mgrid[:n, :n]
    warp_red = (x // check) % 2 == 0
    weft_red = (y // check) % 2 == 0
    twill = ((x + y) // 2) % 2 == 0
    red = np.array([.36, .028, .036]); black = np.array([.030, .022, .024])
    thread_red = np.where(twill, warp_red, weft_red)
    rgb = np.where(thread_red[..., None], red, black)
    rng = np.random.default_rng(5)
    fuzz = rng.normal(0, .012, (n, n, 1))
    rgb = rgb * (1 + fuzz * 3) + fuzz * .15
    # Brushed flannel softens the weave.
    k = np.array([.25, .5, .25])
    for axis in (0, 1):
        rgb = sum(np.roll(rgb, s, axis=axis) * w for s, w in zip((-1, 0, 1), k))
    pix = np.ones((n, n, 4)); pix[..., :3] = np.clip(rgb, 0, 1)
    return sh.numpy_image('buffalo-check-flannel', pix, out_dir)


def cotton_image(name, base, out_dir):
    n = 128
    y, x = np.mgrid[:n, :n]
    rng = np.random.default_rng(9)
    v = .012 * np.sin(x * pi) + .012 * np.sin(y * pi) + rng.normal(0, .008, (n, n))
    pix = np.ones((n, n, 4)); pix[..., :3] = np.clip(np.array(base)[None, None] + v[..., None], 0, 1)
    return sh.numpy_image(name, pix, out_dir)


def grid_plane(name, w, l, step, at_h, center_d, mat, tile=.15):
    """A flat cloth panel in (x, depth) with UVs in plaid tiles (one tile = two checks)."""
    nx = max(2, round(w / step)); nl = max(2, round(l / step))
    verts = []; faces = []; uvs = []
    for j in range(nl + 1):
        for i in range(nx + 1):
            x = -w / 2 + w * i / nx; d = center_d - l / 2 + l * j / nl
            verts.append((x, at_h, d)); uvs.append((x / tile, d / tile))
    for j in range(nl):
        for i in range(nx):
            k = j * (nx + 1) + i; faces.append((k, k + 1, k + nx + 2, k + nx + 1))
    return sh.mesh(name, verts, faces, mat, uvs), nx, nl


def simulate(ob, frames, setup, pin=None):
    cloth = ob.modifiers.new('Cloth', 'CLOTH')
    setup(cloth.settings, cloth.collision_settings)
    if pin:
        group = ob.vertex_groups.new(name='Pinned')
        group.add(pin, 1.0, 'REPLACE')
        cloth.settings.vertex_group_mass = group.name; cloth.settings.pin_stiffness = 1
    cloth.point_cache.frame_start = 1; cloth.point_cache.frame_end = frames
    scene = bpy.context.scene
    for f in range(1, frames + 1): scene.frame_set(f)
    ob = sh.bake(ob)
    scene.frame_set(0)
    return ob


def collider(ob, thickness=.004):
    ob.modifiers.new('Collision', 'COLLISION')
    ob.collision.thickness_outer = thickness; ob.collision.cloth_friction = 80
    return ob


def build(BX, BD, out_dir):
    """Builds in metres around the origin, then moves and scales everything into place."""
    oak = bpy.data.materials.get('Natural oak • satin')
    upholstery = sh.material('Headboard / taupe boucle', (.30, .27, .23), .95, sheen=.4, sheen_roughness=.6)
    sheet = sh.material('Bedding / ivory cotton sheet', (.82, .80, .75), .9, sheen=.3, sheen_roughness=.5)
    sh.image_texture(sheet, cotton_image('cotton-percale', (.85, .83, .78), out_dir))
    pillowcase = sh.material('Bedding / ivory pillowcase', (.84, .82, .77), .9, sheen=.3, sheen_roughness=.5)
    sh.image_texture(pillowcase, bpy.data.images['cotton-percale'])
    flannel = sh.material('Bedding / red buffalo-check flannel', (.2, .03, .035), .97, sheen=.12, sheen_roughness=.6, sheen_tint=(.6, .35, .35))
    sh.image_texture(flannel, flannel_image(out_dir))
    shade = sh.material('Bed / shadow gap', (.03, .03, .03), .9)

    made = []
    head_d = -ML / 2  # mattress head edge (toward the headboard)

    # Frame: four slim legs, side and end rails.
    for x in (-FRAME_W / 2 + .03, FRAME_W / 2 - .03):
        for d in (-FRAME_L / 2 + .03, FRAME_L / 2 - .03):
            made.append(sh.box('Bed / tapered oak leg', (x, RAIL_LO / 2, d), (.05, RAIL_LO, .05), oak, .006))
    for x in (-FRAME_W / 2 + .0175, FRAME_W / 2 - .0175):
        made.append(sh.box('Bed / oak side rail', (x, (RAIL_LO + RAIL_HI) / 2, 0), (.035, RAIL_HI - RAIL_LO, FRAME_L), oak, .008))
    made.append(sh.box('Bed / oak foot rail', (0, (RAIL_LO + RAIL_HI) / 2, FRAME_L / 2 - .0175), (FRAME_W, RAIL_HI - RAIL_LO, .035), oak, .008))
    for i, ob in enumerate(made):
        if 'rail' in ob.name: made[i] = collider(sh.bake(ob), .004)
    made.append(sh.box('Bed / slat shadow', (0, RAIL_HI - .03, 0), (FRAME_W - .08, .02, FRAME_L - .08), shade, 0))

    # Headboard: oak back with one padded panel, sewn into vertical channels.
    hb_d = -FRAME_L / 2 - .02
    made.append(sh.box('Bed / oak headboard back', (0, HEAD_H / 2, hb_d - .035), (FRAME_W + .04, HEAD_H, .04), oak, .01))
    pw_, lo, hi = FRAME_W - .03, RAIL_HI + .01, HEAD_H - .035
    channels = 7; nx, nh = 140, 40; verts = []; faces = []
    for j in range(nh + 1):
        for i in range(nx + 1):
            u = i / nx; v = j / nh
            x = -pw_ / 2 + pw_ * u; h = lo + (hi - lo) * v
            edge = min(u, 1 - u) * pw_; top = min(v, 1 - v) * (hi - lo)
            pad = .045 * min(1, (edge / .03)) ** .5 * min(1, (top / .03)) ** .5
            groove = abs(math.sin(pi * channels * u))
            depth = pad * (.72 + .28 * groove ** .35)
            verts.append((x, h, hb_d - .015 + depth))
    for j in range(nh):
        for i in range(nx):
            k = j * (nx + 1) + i; faces.append((k, k + 1, k + nx + 2, k + nx + 1))
    panel = sh.mesh('Bed / channel-tufted headboard', verts, faces, upholstery)
    so = panel.modifiers.new('Panel depth', 'SOLIDIFY'); so.thickness = .02
    made.append(panel)

    # Mattress in its fitted sheet.
    mattress = sh.box('Bedding / mattress in fitted sheet', (0, MATTRESS_TOP - MT / 2, 0), (MW, MT, ML), sheet, .05)
    mattress = sh.bake(mattress); sh.set_smooth(mattress)
    made.append(mattress)
    collider(mattress, .006)

    # Pillow: a thin sewn case inflated with cloth pressure, then settled onto the sheet.
    pw, pd, ph = .66, .46, .05
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0)); pillow = bpy.context.object
    pillow.name = 'Bedding / pressure-filled pillow'; sh.own(pillow)
    pillow.scale = (pw, pd, ph); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bm = bmesh.new(); bm.from_mesh(pillow.data)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=14, use_grid_fill=True)
    bm.to_mesh(pillow.data); bm.free()
    pillow.location = sh.p(0, MATTRESS_TOP + .12, head_d + .30)
    pillow.data.materials.append(pillowcase)
    for poly in pillow.data.polygons: poly.use_smooth = True
    uv = pillow.data.uv_layers.new(name='UVMap')
    for loop in pillow.data.loops:
        co = pillow.data.vertices[loop.vertex_index].co
        uv.data[loop.index].uv = (co.x * 4 + .5, co.y * 4 + .5)
    def pillow_cloth(s, c):
        s.use_pressure = True; s.uniform_pressure_force = 8; s.pressure_factor = 1
        s.tension_stiffness = 30; s.compression_stiffness = 30; s.shear_stiffness = 20; s.bending_stiffness = .6
        s.mass = .2; s.quality = 8; s.effector_weights.gravity = .35
        c.use_collision = True; c.distance_min = .004
    pillow = simulate(pillow, 36, pillow_cloth)
    sh.set_smooth(pillow); made.append(pillow)
    collider(pillow, .004)

    # Duvet: drape from the fold line to past the foot.
    fold_d = head_d + FOLD
    duvet, nx, nl = grid_plane('Bedding / flannel duvet', DUVET_W, DUVET_L, .035, MATTRESS_TOP + .022, fold_d + DUVET_L / 2, flannel)
    if duvet.data.polygons[len(duvet.data.polygons) // 2].normal.z < 0: duvet.data.flip_normals()
    def duvet_cloth(s, c):
        s.mass = .35; s.quality = 8; s.air_damping = 2
        s.tension_stiffness = 20; s.compression_stiffness = 20; s.shear_stiffness = 8; s.bending_stiffness = 6
        c.use_collision = True; c.distance_min = .012; c.use_self_collision = True; c.self_distance_min = .01; c.friction = 80
    # The fold line rests on the mattress; only its middle is held so the ends can drape.
    pin = [i for i in range(nx + 1) if abs(-DUVET_W / 2 + DUVET_W * i / nx) < MW / 2 - .06]
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0)); ground = bpy.context.object; ground.name = 'Sim floor'
    collider(ground, .002)
    duvet = simulate(duvet, 70, duvet_cloth, pin)
    bpy.data.objects.remove(ground, do_unlink=True)

    # The turned-down cuff: the duvet's first rows, lifted above the drape, with a rolled edge.
    bm = bmesh.new(); bm.from_mesh(duvet.data); bm.verts.ensure_lookup_table(); bm.normal_update()
    cuff_rows = max(2, round(CUFF / (DUVET_L / nl)))
    up = 1 if bm.verts[nx // 2].normal.z > 0 else -1
    cuff_verts = []; cuff_uv = []
    for j in range(cuff_rows + 1):
        for i in range(nx + 1):
            v = bm.verts[j * (nx + 1) + i]
            q = v.co + v.normal * up * .028
            cuff_verts.append((q.x, q.z, -q.y)); cuff_uv.append(((i / nx) * DUVET_W / .15 + .37, (1 - j / nl) * DUVET_L / .15 + .5))
    bm.free()
    faces = []
    for j in range(cuff_rows):
        for i in range(nx):
            k = j * (nx + 1) + i; faces.append((k, k + 1, k + nx + 2, k + nx + 1))
    cuff = sh.mesh('Bedding / turned-down cuff', cuff_verts, faces, flannel, cuff_uv)
    roll = []
    for i in range(nx + 1):
        a = Vector(duvet.data.vertices[i].co); b = Vector(cuff.data.vertices[i].co)
        roll.append((a, b))
    rv = []; rf = []; seg = 6
    for i, (a, b) in enumerate(roll):
        mid = (a + b) / 2; half = (b - a) / 2
        out = Vector((0, 1, 0))  # toward the head: Blender +Y is -depth
        for k in range(seg + 1):
            t = pi * k / seg
            q = mid - half * cos(t) + out * sin(t) * half.length * .9
            rv.append((q.x, q.z, -q.y))
    for i in range(nx):
        for k in range(seg):
            a = i * (seg + 1) + k; rf.append((a, a + 1, a + seg + 2, a + seg + 1))
    rolled = sh.mesh('Bedding / rolled fold', rv, rf, flannel, [(i / nx * DUVET_W / .15, k / seg * .4) for i in range(nx + 1) for k in range(seg + 1)])
    rumple = bpy.data.textures.new('Duvet rumple', 'CLOUDS'); rumple.noise_scale = .22; rumple.noise_depth = 1
    for ob, thick in ((duvet, .03), (cuff, .012)):
        dp = ob.modifiers.new('Soft rumple', 'DISPLACE'); dp.texture = rumple; dp.strength = .018; dp.mid_level = .45
        dp.texture_coords = 'GLOBAL'
        so = ob.modifiers.new('Filled duvet edge', 'SOLIDIFY'); so.thickness = thick; so.offset = -1; so.use_rim_only = True
        sub = ob.modifiers.new('Soft drape', 'SUBSURF'); sub.levels = 1
    duvet = sh.bake(duvet); cuff = sh.bake(cuff)
    for ob in (duvet, cuff, rolled): sh.set_smooth(ob); made.append(ob)

    # Remove simulation helpers and place the bed in the room.
    for ob in made:
        for m in list(ob.modifiers):
            if m.type == 'COLLISION': ob.modifiers.remove(m)
    made = [sh.bake(ob) for ob in made]
    from mathutils import Matrix
    place = Matrix.Translation(Vector(sh.p(BX, 0, BD))) @ Matrix.Scale(S, 4)
    for ob in made:
        ob.matrix_world = place @ ob.matrix_world
    bpy.context.view_layer.update()
    return made
