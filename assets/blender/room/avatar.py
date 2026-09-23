"""Seated, typing portrait of Antonio: charcoal quarter-zip fleece, dark jeans,
white sneakers, a short full beard and dark hair with volume on top.

Anatomy is authored in real metres relative to the seat, then scaled to the
desk's units so the person and furniture share one proportion system.
"""
import bpy, bmesh, math
from math import sin, cos, pi, radians, exp, atan2, acos
from mathutils import Vector
import shapes as sh

S = 1.55  # room units per metre (matches desk, chair and keyboard proportions)


def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def gauss(x, width): return exp(-(x / width) ** 2)


def build(PX, SEAT, HIPD):
    def W(x, h, d): return (PX + x * S, SEAT + h * S, HIPD + d * S)
    def Wr(r): return r * S
    def pts(seq): return [W(*q) for q in seq]
    def rads(seq): return [Wr(r) for r in seq]
    def ring(h, d, rx, rd, x=0): return (*W(x, h, d), Wr(rx), Wr(rd))

    M = sh.material
    skin = M('Character / warm olive skin', (.50, .27, .16), .6, sheen=.1, sheen_roughness=.4)
    lips = M('Character / lips', (.20, .07, .05), .55)
    hair_mat = M('Character / near-black hair', (.013, .0095, .008), .5, sheen=.4, sheen_roughness=.3, sheen_tint=(.9, .85, .8))
    beard_mat = M('Character / beard', (.016, .012, .010), .8, sheen=.25, sheen_roughness=.5)
    eye_mat = M('Character / dark eyes', (.012, .008, .006), .15)
    fleece = M('Character / charcoal fleece', (.034, .037, .042), .96, sheen=.5, sheen_roughness=.55, sheen_tint=(.85, .87, .9))
    fleece_rib = M('Character / fleece binding', (.024, .026, .030), .9, sheen=.3)
    zipper = M('Character / gunmetal zipper', (.05, .05, .052), .35, .8)
    denim = M('Character / dark indigo denim', (.026, .038, .070), .88, sheen=.2, sheen_roughness=.6)
    canvas = M('Character / off-white sneaker upper', (.78, .77, .73), .7, sheen=.2)
    sole = M('Character / sneaker sole', (.88, .87, .83), .82)
    lace = M('Character / laces', (.92, .91, .88), .9)

    root = sh.empty('Person_Working', W(0, 0, 0))
    posture = sh.empty('Person / posture', W(0, .20, .02))
    head_root = sh.empty('Person / head turn', W(0, .62, -.08))

    # ---------- jeans: pelvis, thighs and shins fused into one garment ----------
    parts = [sh.loft('pelvis', [ring(.015, .0, .165, .115), ring(.09, .005, .185, .128),
                                ring(.17, .01, .175, .118), ring(.23, .015, .165, .112)], denim, subsurf=1)]
    for s in (-1, 1):
        parts.append(sh.tube('thigh', pts([(s * .088, .092, .02), (s * .098, .098, -.14), (s * .104, .102, -.29), (s * .108, .098, -.425)]),
                             rads([.088, .080, .067, .057]), denim, 20))
        parts.append(sh.tube('shin', pts([(s * .108, .098, -.43), (s * .111, -.05, -.447), (s * .113, -.24, -.458), (s * .115, -.405, -.47)]),
                             rads([.055, .049, .046, .047]), denim, 20))
    trousers = sh.fuse('Person / dark denim jeans', parts, denim, voxel=.009, smooth=.5, repeat=8, ratio=.12)
    sh.parent_keep(trousers, root)

    # ---------- sneakers ----------
    for s in (-1, 1):
        ax = s * .115; base = -.488  # the floor, relative to the seat
        upper = sh.loft('Person / sneaker upper', [ring(base + h, dc, rx, rd, ax) for h, dc, rx, rd in [
            (.016, -.555, .051, .133), (.032, -.550, .052, .129), (.050, -.535, .050, .115), (.070, -.505, .047, .088),
            (.088, -.485, .044, .068), (.098, -.475, .042, .058)]], canvas, n=32, exponents=(.7, .6), subsurf=1)
        sole_ob = sh.loft('Person / sneaker sole', [ring(base + .0015, -.556, .053, .136, ax), ring(base + .022, -.556, .056, .138, ax)],
                          sole, n=32, exponents=(.7, .6), subsurf=1)
        items = [upper, sole_ob]
        for j in range(4):
            d = -.515 - j * .022; h = base + .080 - j * .010
            items.append(sh.line('Person / lace', [W(ax - .022, h, d), W(ax, h + .004, d - .003), W(ax + .022, h, d)], .0035, lace, resolution=1))
        for ob in items: sh.parent_keep(sh.bake(ob), root)

    # ---------- fleece: torso and sleeves fused, with binding, collar and zip ----------
    lean = -.14
    parts = [sh.loft('torso', [ring(h, .02 + lean * h, rx, rd) for h, rx, rd in [
        (.095, .190, .142), (.14, .188, .140), (.20, .180, .132), (.29, .172, .124), (.38, .178, .128), (.46, .190, .128),
        (.53, .196, .120), (.585, .180, .104), (.625, .130, .086), (.65, .080, .072)]], fleece)]
    # A slightly rounded upper back from leaning in toward the screen.
    parts.append(sh.ellipsoid('upper back', W(0, .48, -.01), (Wr(.16), Wr(.12), Wr(.085)), fleece))
    shoulder, elbow, wrist = {}, {}, {}
    for s in (-1, 1):
        shoulder[s] = (s * .190, .555, -.07)
        elbow[s] = (s * .215, .312, -.185)
        wrist[s] = (s * .128, .352, -.425)
        sleeve = [(s * .12, .57, -.068), (s * .165, .567, -.07), shoulder[s], (s * .208, .45, -.115), (s * .216, .365, -.155), elbow[s],
                  (s * .196, .33, -.26), (s * .160, .342, -.35), wrist[s]]
        parts.append(sh.tube('sleeve', pts(sleeve), rads([.058, .060, .060, .054, .050, .047, .045, .041, .036]), fleece, 24))
        parts.append(sh.tube('elbow gather', pts([(s * .205, .35, -.19), (s * .20, .33, -.215), (s * .19, .325, -.24)]),
                             rads([.028, .032, .024]), fleece, 12))
    torso = sh.fuse('Person / charcoal quarter-zip fleece', parts, fleece, voxel=.008, smooth=.5, repeat=10, ratio=.12)
    upper = [torso]
    for s in (-1, 1):
        a = Vector(W(*wrist[s])); b = Vector(W(s * .155, .345, -.37)); axis = (a - b).normalized()
        upper.append(sh.bake(sh.tube('Person / fleece cuff', [tuple(a - axis * .035), tuple(a + axis * .008)], [Wr(.039), Wr(.037)], fleece_rib, 24)))
    collar = sh.loft('Person / stand collar', [ring(.612, -.078, .082, .076), ring(.645, -.087, .070, .066), ring(.676, -.095, .064, .060)],
                     fleece, n=40, subsurf=1, caps=False)
    so = collar.modifiers.new('Collar thickness', 'SOLIDIFY'); so.thickness = Wr(.007); so.offset = 1
    collar = sh.bake(collar); upper.append(collar)
    zp = []
    for h in [.676, .66, .64, .61, .58, .55, .525]:
        start = Vector(sh.p(*W(0, h, -.40))); hit = None
        for target in (torso, collar):
            ok, loc, nor, _ = target.ray_cast(start, Vector((0, -1, 0)))
            if ok and (hit is None or (loc - start).length < (hit[0] - start).length): hit = (loc, nor)
        if hit: zp.append(hit[0] + hit[1] * .003)
    upper.append(sh.bake(sh.line('Person / zipper tape', [(q.x, q.z, -q.y) for q in zp], .0042, zipper, resolution=1)))
    top = zp[1]
    upper.append(sh.box('Person / zipper pull', (top.x, top.z - .022, -top.y - .006), (.012, .034, .005), zipper, .002))
    for ob in upper: sh.parent_keep(ob, posture)

    # ---------- head: skull, jaw, nose, ears and neck fused ----------
    HC = (0, .80, -.125)
    def head_point(u, v):
        """u: azimuth from forward, v: elevation. Local offset from HC in metres."""
        x = sin(u) * cos(v); y = sin(v); f = cos(u) * cos(v)
        sx = .078 * (1 + .06 * max(0, y)) * (1 - .32 * max(0, -y) ** 1.5)
        depth = .097 if f > 0 else .108
        fz = f * depth * (1 - .12 * max(0, f) ** 3)
        if y < -.55 and f > .2: fz += .012 * (f - .2) * min(1, (-y - .55) * 3)  # chin
        return (x * sx, y * .118, -fz)

    vv = []; ff = []; NU, NV = 48, 32
    for j in range(NV + 1):
        v = -pi / 2 + pi * j / NV
        for i in range(NU):
            o = head_point(2 * pi * i / NU, v); vv.append(W(HC[0] + o[0], HC[1] + o[1], HC[2] + o[2]))
    for j in range(NV):
        for i in range(NU):
            k = j * NU + i; kn = j * NU + (i + 1) % NU; ff.append((k, kn, kn + NU, k + NU))
    skull = sh.mesh('skull', vv, ff, skin); sh.normal_out(skull)
    parts = [skull]
    parts.append(sh.tube('neck', pts([(0, .58, -.07), (0, .66, -.09), (0, .71, -.11)]), rads([.062, .060, .057]), skin, 24))
    parts.append(sh.tube('nose', pts([(0, .838, -.207), (0, .812, -.219), (0, .789, -.230), (0, .777, -.219)]), rads([.009, .011, .014, .010]), skin, 16))
    for s in (-1, 1):
        parts.append(sh.ellipsoid('nostril wing', W(s * .013, .779, -.212), (Wr(.009), Wr(.007), Wr(.008)), skin))
        parts.append(sh.ellipsoid('brow ridge', W(s * .033, .836, -.196), (Wr(.025), Wr(.007), Wr(.01)), skin))
        parts.append(sh.ellipsoid('ear', W(s * .080, .798, -.106), (Wr(.013), Wr(.030), Wr(.020)), skin, rot=(radians(-12), 0, s * radians(10))))
        parts.append(sh.ellipsoid('ear rim', W(s * .086, .805, -.098), (Wr(.007), Wr(.024), Wr(.013)), skin, rot=(radians(-12), 0, s * radians(10))))
    head = sh.fuse('Person / sculpted head', parts, skin, voxel=.0042, smooth=.5, repeat=6, ratio=.15)
    head_parts = [head]

    center = Vector(sh.p(*W(*HC)))
    def local_dir(u, v):
        return Vector(sh.p(sin(u) * cos(v), sin(v), -cos(u) * cos(v)))
    def surface(u, v):
        d = local_dir(u, v)
        ok, loc, nor, _ = head.ray_cast(center, d)
        return (loc, nor, d) if ok else (center + d * Wr(.1), d, d)
    def to_xhd(q): return (q.x, q.z, -q.y)

    def shell(name, mat, u0, u1, v_lo, v_hi, lift, nu, nv, wrap=False, keep=lambda u, v: True):
        """A surface that follows the skin between smooth (u, v) boundaries, lifted by `lift`."""
        grid = {}; verts = []; faces = []
        cols = nu if wrap else nu + 1
        for i in range(cols):
            u = u0 + (u1 - u0) * i / nu
            lo, hi = v_lo(u), v_hi(u)
            for j in range(nv + 1):
                v = lo + (hi - lo) * j / nv
                loc, nor, d = surface(u, v)
                grid[(i, j)] = len(verts); verts.append(to_xhd(loc + d * lift(u, v)))
        for i in range(nu if wrap else nu):
            i2 = (i + 1) % cols
            for j in range(nv):
                u = u0 + (u1 - u0) * (i + .5) / nu
                v = v_lo(u) + (v_hi(u) - v_lo(u)) * (j + .5) / nv
                if keep(u, v): faces.append((grid[(i, j)], grid[(i2, j)], grid[(i2, j + 1)], grid[(i, j + 1)]))
        ob = sh.mesh(name, verts, faces, mat)
        bm = bmesh.new(); bm.from_mesh(ob.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(ob.data); bm.free()
        probe = ob.data.polygons[len(ob.data.polygons) // 2]
        if probe.normal.dot(probe.center - center) < 0: ob.data.flip_normals()
        return ob

    # Beard: short and full, from the sideburns along the jaw to the chin, with a mustache.
    def beard_hi(u): return radians(-17 + 21 * smoothstep(22, 84, abs(math.degrees(u))))
    def beard_lo(u): return radians(-80 + 45 * smoothstep(45, 90, abs(math.degrees(u))))
    def mouth(u, v): return abs(math.degrees(u)) < 9.5 and -32 < math.degrees(v) < -27.5
    def beard_lift(u, v):
        a, b = math.degrees(u), math.degrees(v)
        edge = smoothstep(0, 5, math.degrees(beard_hi(u)) - b) * smoothstep(0, 5, b - math.degrees(beard_lo(u))) * smoothstep(85, 80, abs(a))
        chin = gauss(a, 28) * smoothstep(-45, -65, b)
        return Wr(.0007) + Wr(.0027) * edge + Wr(.0016) * chin * edge
    beard = shell('Person / short beard', beard_mat, radians(-85), radians(85), beard_lo, beard_hi, beard_lift, 96, 30,
                  keep=lambda u, v: not mouth(u, v))
    head_parts.append(beard)

    # Features on the fused face.
    for s in (-1, 1):
        loc, nor, d = surface(s * radians(24), radians(9))
        head_parts.append(sh.ellipsoid('Person / eye', to_xhd(loc - nor * Wr(.0015)), (Wr(.0105), Wr(.0052), Wr(.004)), eye_mat, rot=(0, s * radians(-24), 0)))
        brow = []
        for u, v in [(10, 18.5), (20, 20.5), (30, 19.5), (38, 16.5)]:
            l, n, _ = surface(s * radians(u), radians(v)); brow.append(to_xhd(l + n * Wr(.0022)))
        head_parts.append(sh.bake(sh.line('Person / eyebrow', brow, Wr(.0048), hair_mat, resolution=1)))
    mouth_pts = []
    for u in (-13, -6, 0, 6, 13):
        l, n, _ = surface(radians(u), radians(-29.5 - .02 * u * u / 4)); mouth_pts.append(to_xhd(l + n * Wr(.0012)))
    head_parts.append(sh.bake(sh.line('Person / mouth line', mouth_pts, Wr(.0024), lips, resolution=1)))

    # Hair: one closed mass that follows the skull. Strand grooves spiral out
    # from a crown whorl, like real growth; the top holds volume swept forward.
    def hairline(u):
        a = math.degrees(atan2(sin(u), cos(u)))
        base = 11.25 + 37.5 * cos(u) - 8.75 * cos(2 * u)
        base -= 18 * gauss(abs(a) - 80, 8)   # sideburns in front of the ears
        base += 5 * gauss(abs(a) - 40, 12)   # gentle temple corners
        return radians(base)
    whorl = local_dir(radians(180), radians(62))
    e1 = whorl.cross(Vector((0, 0, 1))).normalized(); e2 = whorl.cross(e1).normalized()

    def hair_lift(u, v):
        a, b = math.degrees(u), math.degrees(v); a = (a + 180) % 360 - 180
        above = b - math.degrees(hairline(u))
        front = smoothstep(70, 15, abs(a))
        top = smoothstep(18, 62, b)
        t = Wr(.0016) + Wr(.0032) * smoothstep(0, 16, above)
        pole = smoothstep(70, 88, b)  # every azimuth meets at the crown; blend to one height there
        t += Wr(.022) * top * ((.42 + .62 * max(0, cos(u)) + .12 * max(0, sin(u))) * (1 - pole) + .66 * pole)
        t += Wr(.010) * gauss(a - 18, 30) * gauss(b - 44, 14) * (1 - pole)  # swept front volume
        t += Wr(.008) * front * smoothstep(0, 4, above) * (1 - top * .5)  # the fringe keeps its edge
        dvec = local_dir(u, v)
        psi = atan2(dvec.dot(e2), dvec.dot(e1)); delta = acos(max(-1, min(1, dvec.dot(whorl))))
        groove = (.5 + .5 * cos(20 * psi + 1.1 * delta)) ** 2.2
        t += Wr(.0042) * groove * smoothstep(4, 22, above) * (.35 + .65 * top) * smoothstep(.15, .55, delta)
        return t
    cap = shell('Person / dark swept hair', hair_mat, 0, 2 * pi, hairline, lambda u: radians(89.5), hair_lift, 144, 52, wrap=True)
    so = cap.modifiers.new('Rooted into scalp', 'SOLIDIFY'); so.thickness = Wr(.012); so.offset = -1
    dec = cap.modifiers.new('Web budget', 'DECIMATE'); dec.ratio = .5
    hair = sh.bake(cap); sh.set_smooth(hair)
    head_parts.append(hair)
    for ob in head_parts: sh.parent_keep(ob, head_root)
    sh.parent_keep(head_root, posture)

    # ---------- hands resting on the keys ----------
    animated_hands = []
    for s in (-1, 1):
        wx, wh, wd = wrist[s]
        handroot = sh.empty('Person / typing ' + ('left' if s < 0 else 'right') + ' hand', W(wx, wh, wd))
        parts = [sh.tube('wrist', pts([(wx + s * .004, wh + .002, wd + .03), (wx, wh, wd), (wx - s * .004, wh + .003, wd - .03)]), rads([.030, .029, .031]), skin, 16)]
        parts.append(sh.ellipsoid('palm', W(wx - s * .006, wh + .007, wd - .058), (Wr(.041), Wr(.015), Wr(.047)), skin, rot=(radians(-6), s * radians(8), 0)))
        for f in range(4):  # index (toward the thumb) to pinky
            fx = wx - s * .006 + s * (f - 1.5) * .0205
            spread = s * (f - 1.5) * .004
            length = [.072, .078, .074, .060][f]
            kd = wd - .10
            path = [(fx, wh + .011, kd + .012), (fx + spread * .3, wh + .019, kd - .014), (fx + spread * .6, wh + .014, kd - length * .55),
                    (fx + spread, wh - .002, kd - length * .85), (fx + spread, wh - .011, kd - length * .97)]
            parts.append(sh.tube('finger', pts(path), rads([.0105, .0100, .0090, .0078, .0066]), skin, 12))
        tx = wx - s * .036
        parts.append(sh.tube('thumb', pts([(tx + s * .004, wh + .002, wd - .03), (tx - s * .006, wh - .002, wd - .062), (tx - s * .012, wh - .008, wd - .086)]),
                             rads([.015, .012, .0095]), skin, 12))
        hand = sh.fuse('Person / hand', parts, skin, voxel=.0032, smooth=.5, repeat=4, ratio=.15)
        sh.parent_keep(hand, handroot)
        sh.parent_keep(handroot, root)
        animated_hands.append((handroot, s))

    sh.parent_keep(posture, root)
    return {'root': root, 'posture': posture, 'head': head_root, 'hands': animated_hands}


def animate(rig, scene):
    """A five-second loop: alternating keystrokes, breathing, and glances at the screen."""
    for ob, side in rig['hands']:
        loc = ob.location.copy(); rot = ob.rotation_euler.copy()
        for frame in range(0, 121, 3):
            phase = frame / 120 * 2 * pi * 10 + (0 if side < 0 else pi)
            beat = max(0, sin(phase)) ** 3
            ob.location = loc + Vector((0, 0, .004 * beat))
            ob.rotation_euler = (rot.x + .02 * beat, rot.y, rot.z + .01 * sin(phase * .5))
            ob.keyframe_insert('location', frame=frame); ob.keyframe_insert('rotation_euler', frame=frame)
    head, posture = rig['head'], rig['posture']
    for frame in range(0, 121, 6):
        phase = frame / 120 * 2 * pi
        head.rotation_euler = (.022 * sin(phase), .012 * sin(phase * 2 + .6), .045 * sin(phase * 2))
        head.keyframe_insert('rotation_euler', frame=frame)
        posture.rotation_euler = (.008 * sin(phase * 2), .004 * sin(phase), 0)
        posture.keyframe_insert('rotation_euler', frame=frame)
    scene.frame_set(0)
