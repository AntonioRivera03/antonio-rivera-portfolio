import bpy, math, random, os, json, argparse, sys
from mathutils import Vector
from math import sin, cos, pi, sqrt
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument('--output', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'generated'))
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
OUT = os.path.abspath(args.output)
os.makedirs(OUT, exist_ok=True)
random.seed(11)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = 'Antonio — Work and rest'
scene.unit_settings.system = 'METRIC'

# Author in a readable Y-up furniture coordinate system; Blender receives Z-up.
def p(x, h, d): return (x, -d, h)
def vec(t): return Vector(p(*t))
furniture = bpy.data.collections.new('Furniture')
scene.collection.children.link(furniture)
studio = bpy.data.collections.new('Studio — preview only')
scene.collection.children.link(studio)

def own(ob, col=furniture):
    for c in list(ob.users_collection): c.objects.unlink(ob)
    col.objects.link(ob)
    return ob

def material(name, color, roughness=.5, metallic=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=roughness
    bs.inputs['Metallic'].default_value=metallic
    return m

oak=material('Natural oak • satin',(.65,.49,.32),.43)
white=material('Warm porcelain powdercoat',(.88,.865,.83),.37)
linen=material('Washed warm gray linen',(.55,.56,.545),.91)
pillow_mat=material('Ivory cotton percale',(.87,.85,.79),.92)
stitch=material('Linen piping',(.40,.42,.405),.95)
bedfabric=material('Stone woven upholstery',(.64,.62,.575),.89)
charcoal=material('Graphite soft upholstery',(.095,.111,.116),.76)
shell=material('Charcoal polymer',(.068,.077,.080),.42)
black=material('Black glass edge',(.018,.024,.027),.25)
screen=material('Monitor pale blue screen',(.36,.53,.57),.23)
bs=screen.node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Color'].default_value=(.13,.22,.24,1);bs.inputs['Emission Strength'].default_value=.23
silver=material('Brushed aluminum',(.53,.56,.56),.29,.72)
rubber=material('Caster rubber',(.028,.032,.03),.82)
keys=material('PBT warm white keycaps',(.81,.82,.79),.54)
muted=material('Muted desk display green',(.55,.66,.59),.6)

def make_texture(mat, name, base, kind):
    n=384
    yy,xx=np.mgrid[:n,:n]/n
    rng=np.random.default_rng(18)
    if kind=='wood':
        warped=yy+.005*np.sin(xx*15)+.008*np.sin(xx*5+yy*12)
        value=.045*np.sin(warped*230)+.022*np.sin(warped*612)+.015*rng.normal(size=(n,n))
    else:
        value=.018*np.sin(xx*n*pi)+.018*np.sin(yy*n*pi)+.014*rng.normal(size=(n,n))
    rgb=np.clip(np.array(base)[None,None,:]+value[:,:,None],0,1)
    pix=np.ones((n,n,4)); pix[:,:,:3]=rgb
    im=bpy.data.images.new(name,n,n,alpha=False)
    im.pixels.foreach_set(pix.astype(np.float32).ravel())
    im.filepath_raw=os.path.join(OUT,name+'.png');im.file_format='PNG';im.save();im.pack()
    tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im
    mat.node_tree.links.new(tex.outputs['Color'],mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    return im
make_texture(oak,'oak-grain',(.72,.60,.43),'wood')
make_texture(linen,'linen-weave',(.65,.66,.64),'cloth')
make_texture(bedfabric,'upholstery-weave',(.73,.71,.66),'cloth')
make_texture(pillow_mat,'cotton-weave',(.91,.89,.84),'cloth')


# Burgundy buffalo-check flannel with a fine woven twill pattern.
flannel=material('Dark burgundy and black woven flannel',(.24,.025,.039),.96)
flannel_seam=material('Burgundy stitched flannel piping',(.12,.014,.022),.98)
def make_flannel():
    n=768
    yy,xx=np.mgrid[:n,:n]
    checkx=(xx//96)%2;checky=(yy//96)%2
    level=checkx+checky
    palette=np.array([[.050,.025,.031],[.238,.029,.047],[.46,.041,.072]])
    rgb=palette[level]
    rng=np.random.default_rng(33)
    weave=.008*np.sin((xx+yy)*pi/2)+.006*np.sin(xx*pi)+.007*rng.normal(size=(n,n))
    # Subtle thread highlights in each crossing preserve the dark overall color.
    border=((xx%96)<2)|((yy%96)<2)
    rgb=np.clip(rgb+weave[:,:,None]+border[:,:,None]*np.array([.015,.002,.003]),0,1)
    pix=np.ones((n,n,4));pix[:,:,:3]=rgb
    im=bpy.data.images.new('burgundy-flannel',n,n,alpha=False);im.pixels.foreach_set(pix.astype(np.float32).ravel())
    im.filepath_raw=os.path.join(OUT,'burgundy-flannel.png');im.file_format='PNG';im.save();im.pack()
    node=flannel.node_tree.nodes.new('ShaderNodeTexImage');node.image=im
    flannel.node_tree.links.new(node.outputs['Color'],flannel.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
make_flannel()

def finish(ob, name, mat, bevel=0, smooth=True):
    ob.name=name; own(ob)
    if mat: ob.data.materials.append(mat)
    if bevel:
        m=ob.modifiers.new('Soft manufactured edges','BEVEL');m.width=bevel;m.segments=3
    if smooth and ob.type=='MESH':
        for poly in ob.data.polygons:poly.use_smooth=True
        if bevel:
            m=ob.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');m.keep_sharp=True;m.weight=40
    return ob

def box(name, at, dims, mat, bevel=.02):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p(*at));ob=bpy.context.object
    ob.dimensions=(dims[0],dims[2],dims[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(ob,name,mat,bevel)

def uv_sphere(name, at, dims, mat, segments=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=p(*at));ob=bpy.context.object
    ob.scale=(dims[0]/2,dims[2]/2,dims[1]/2);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(ob,name,mat)

def cylinder(name,a,b,r,mat,vertices=24):
    av,bv=vec(a),vec(b);delta=bv-av
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=delta.length,location=(av+bv)/2)
    ob=bpy.context.object;ob.rotation_mode='QUATERNION';ob.rotation_quaternion=delta.to_track_quat('Z','Y')
    return finish(ob,name,mat,.005)

def line(name,points,r,mat,closed=False):
    cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=1;cu.bevel_depth=r;cu.bevel_resolution=2
    spl=cu.splines.new('POLY');spl.points.add(len(points)-1)
    for q,co in zip(spl.points,points):q.co=(*p(*co),1)
    spl.use_cyclic_u=closed
    ob=bpy.data.objects.new(name,cu);furniture.objects.link(ob);cu.materials.append(mat)
    return ob

def mesh(name,vertices,faces,mat,uv=None):
    me=bpy.data.meshes.new(name);me.from_pydata([p(*v) for v in vertices],[],faces);me.update()
    ob=bpy.data.objects.new(name,me);furniture.objects.link(ob);me.materials.append(mat)
    if uv:
        layer=me.uv_layers.new(name='UVMap')
        for loop in me.loops:layer.data[loop.index].uv=uv[loop.vertex_index]
    for po in me.polygons:po.use_smooth=True
    return ob

# LEFT: quiet modern desk; low open frame and slim storage drawer.
DX=-2.5
box('Desk / solid oak top',(DX,1.15,-.06),(3.30,.10,1.28),oak,.045)
box('Desk / floating white drawer',(DX+.84,.975,-.07),(.92,.24,1.05),white,.025)
box('Desk / drawer face',(DX+.84,.975,.474),(.85,.20,.045),white,.018)
box('Desk / recessed finger pull',(DX+.84,1.054,.50),(.58,.018,.012),shell,.004)
for x in [DX-1.40,DX+1.40]:
    for d in [-.51,.39]:
        box('Desk / square tubular leg',(x,.556,d),(.058,1.07,.058),white,.014)
        box('Desk / felt foot',(x,.025,d),(.063,.032,.063),rubber,.008)
    box('Desk / upper rail',(x,1.055,-.06),(.065,.065,.98),white,.012)
box('Desk / back crossbar',(DX,.82,-.51),(2.87,.054,.054),white,.012)

# Accurate desktop monitor with glass, chin, rear body, riser and oval foot.
MX=DX-.18
box('Monitor / aluminum back',(MX,1.585,-.405),(1.12,.665,.050),silver,.028)
box('Monitor / glass black bezel',(MX,1.59,-.371),(1.087,.622,.023),black,.021)
box('Monitor / display',(MX,1.61,-.354),(1.018,.535,.005),screen,.007)
box('Monitor / lower chin',(MX,1.276,-.356),(1.08,.039,.014),silver,.010)
uv_sphere('Monitor / camera dot',(MX,1.888,-.352),(.011,.011,.004),black,12,8)
uv_sphere('Monitor / status LED',(MX+.486,1.278,-.344),(.005,.005,.003),keys,12,8)
box('Monitor / riser',(MX,1.305,-.42),(.085,.26,.058),silver,.018)
box('Monitor / sculpted base',(MX,1.217,-.27),(.37,.031,.28),silver,.045)
# Very restrained screen geometry. No baked web UI.
box('Monitor / sidebar',(MX-.438,1.61,-.350),(.13,.535,.003),muted,.001)
for j, width in enumerate([.49,.38,.56,.31,.44,.51]):
    box('Monitor / code line',(MX-.08+(width-.5)/2,1.79-j*.056,-.347),(width,.008,.002),keys,.001)
line('Monitor / power cable',[(MX,1.25,-.47),(MX,1.10,-.53),(DX-1.40,1.055,-.54),(DX-1.40,.04,-.54)],.008,shell)

# Keyboard, sculpted keycaps, mouse and soft desktop mat.
box('Desk / charcoal felt mat',(DX-.15,1.207,.235),(1.82,.012,.43),charcoal,.041)
box('Keyboard / aluminum tray',(DX-.28,1.236,.255),(.94,.036,.302),silver,.022)
box('Keyboard / inset plate',(DX-.28,1.256,.255),(.903,.012,.271),shell,.012)
for row in range(5):
    for col in range(14):
        if row==4 and 3<=col<=8:continue
        x=DX-.696+col*.064
        d=.148+row*.053
        box('Keyboard / key %02d-%02d'%(row,col),(x,1.273,d),(.054,.025,.044),keys,.007)
box('Keyboard / space bar',(DX-.344,1.273,.36),(.368,.025,.044),keys,.007)
uv_sphere('Mouse / ivory shell',(DX+.44,1.263,.253),(.15,.095,.25),white,24,12)
line('Mouse / center split',[(DX+.44,1.313,.16),(DX+.44,1.312,.20),(DX+.44,1.308,.24)],.0018,shell)
box('Mouse / scroll wheel',(DX+.44,1.31,.205),(.018,.014,.042),rubber,.006)

# Small desk lamp creates a fine, graceful vertical accent.
LX=DX+1.26
box('Lamp / oval foot',(LX,1.229,-.32),(.27,.039,.25),white,.070)
cylinder('Lamp / stem',(LX,1.25,-.35),(LX,1.79,-.35),.018,silver)
cylinder('Lamp / angled arm',(LX,1.79,-.35),(LX-.19,1.88,-.26),.016,silver)
box('Lamp / slim shade',(LX-.24,1.878,-.235),(.36,.054,.17),white,.033)
box('Lamp / diffuser',(LX-.24,1.845,-.235),(.30,.008,.127),pillow_mat,.016)
for i in range(2):
    box('Desk / stacked notebook',(DX-1.12,1.222+i*.045,-.02),(.43,.037,.31),pillow_mat if i==0 else muted,.008)
box('Desk / pen',(DX-1.15,1.291,-.025),(.27,.012,.013),shell,.005)

# CHAIR: upholstered curved shell, lumbar pad, armrests, metal star and casters.
CX=DX-.14;CD=1.12
cylinder('Chair / hydraulic foot',(CX,.19,CD),(CX,.52,CD),.055,silver)
cylinder('Chair / hydraulic sleeve',(CX,.22,CD),(CX,.38,CD),.080,shell)
box('Chair / tilt mechanism',(CX,.53,CD),(.32,.13,.39),shell,.037)
for i in range(5):
    a=2*pi*i/5+.2
    x=CX+sin(a)*.50;d=CD+cos(a)*.50
    cylinder('Chair / star spoke %d'%i,(CX,.23,CD),(x,.16,d),.039,silver)
    cylinder('Chair / wheel fork %d'%i,(x,.16,d),(x,.093,d),.021,silver)
    for off in [-.038,.038]:
        cylinder('Chair / caster %d'%i,(x+off-.020,.083,d),(x+off+.020,.083,d),.077,rubber,20)
        cylinder('Chair / caster hub %d'%i,(x+off-.021,.083,d),(x+off+.021,.083,d),.026,shell,16)
box('Chair / seat underside',(CX,.615,CD),(.74,.105,.68),shell,.13)
box('Chair / seat upholstery',(CX,.691,CD-.005),(.76,.13,.67),charcoal,.15)
# Chair back curves around the sides and leans softly backward toward the viewer.
verts=[];uv=[];faces=[]
NU,NV=30,24
for j in range(NV+1):
    v=j/NV; h=.78+.82*v
    for i in range(NU+1):
        u=i/NU*2-1
        width=.345*(1-.12*v+.06*sin(v*pi))
        x=CX+u*width; d=CD+.30+.10*v-.11*u*u
        verts.append((x,h,d));uv.append((i/NU,j/NV))
for j in range(NV):
    for i in range(NU):
        k=j*(NU+1)+i;faces.append((k,k+1,k+NU+2,k+NU+1))
back=mesh('Chair / contoured upholstered back',verts,faces,charcoal,uv)
s=back.modifiers.new('Upholstery thickness','SOLIDIFY');s.thickness=.070
b=back.modifiers.new('Bound cushion edges','BEVEL');b.width=.045;b.segments=3
perimeter=[]
for i in range(NU+1):perimeter.append(verts[i])
for j in range(1,NV+1):perimeter.append(verts[j*(NU+1)+NU])
for i in range(NU-1,-1,-1):perimeter.append(verts[NV*(NU+1)+i])
for j in range(NV-1,0,-1):perimeter.append(verts[j*(NU+1)])
line('Chair / stitched back perimeter',[(x,h,d+.037) for x,h,d in perimeter],.006,shell,True)
for side in [-1,1]:
    x=CX+side*.425
    cylinder('Chair / arm upright',(x,.63,CD+.14),(x,.98,CD+.13),.024,silver)
    box('Chair / soft armrest',(x,1.005,CD-.025),(.105,.054,.39),shell,.042)
line('Chair / back support',[(CX,.55,CD+.13),(CX,.67,CD+.30),(CX,1.03,CD+.38)],.036,silver)

# Stylized human designed for the seated pose: tailored forms, articulated hands,
# individually modeled facial features and hair. No sphere-stack mannequin.
from mathutils import Matrix
import bmesh
person_before=set(furniture.objects)
skin=material('Character / warm tan skin',(.48,.258,.151),.73)
skin_dark=material('Character / subtle features',(.235,.103,.059),.73)
hair_mat=material('Character / espresso hair',(.023,.016,.012),.65)
shirt_mat=material('Character / oatmeal knit',(.58,.55,.45),.92)
shirt_rib=material('Character / knit ribbing',(.43,.42,.35),.95)
denim=material('Character / ink twill trousers',(.037,.06,.075),.90)
shoe_mat=material('Character / canvas sneakers',(.53,.54,.50),.80)
shoe_sole=material('Character / sneaker rubber sole',(.77,.76,.69),.85)

def empty(name,at):
    ob=bpy.data.objects.new(name,None);furniture.objects.link(ob);ob.location=p(*at)
    return ob

def parent_keep(ob,par):
    bpy.context.view_layer.update();world=ob.matrix_world.copy()
    ob.parent=par;ob.matrix_parent_inverse=Matrix.Identity(4);ob.matrix_world=world

def normal_out(ob):
    bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()

def torso_loft(name,rings,mat,n=36):
    # Each ring is (center x, height, center depth, width radius, depth radius).
    vv=[];ff=[]
    for x,h,d,rx,rd in rings:
        for i in range(n):
            a=2*pi*i/n
            xx=math.copysign(abs(cos(a))**.82,cos(a))*rx
            zz=math.copysign(abs(sin(a))**.85,sin(a))*rd
            vv.append((x+xx,h,d+zz))
    for j in range(len(rings)-1):
        for i in range(n):
            k=j*n+i;kn=j*n+(i+1)%n;ff.append((k,kn,kn+n,k+n))
    ff.extend([tuple(range(n-1,-1,-1)),tuple((len(rings)-1)*n+i for i in range(n))])
    ob=mesh(name,vv,ff,mat);normal_out(ob)
    mod=ob.modifiers.new('Tailored smooth silhouette','SUBSURF');mod.levels=2;mod.render_levels=2
    return ob

def limb(name,points,radii,mat,n=16):
    vv=[];ff=[]
    for j,co in enumerate(points):
        c=vec(co)
        tangent=(vec(points[min(len(points)-1,j+1)])-vec(points[max(0,j-1)])).normalized()
        ref=Vector((1,0,0)) if abs(tangent.x)<.8 else Vector((0,1,0))
        ax=tangent.cross(ref).normalized();ay=tangent.cross(ax).normalized()
        radius=radii[j];rx,ry=radius if isinstance(radius,tuple) else (radius,radius)
        for i in range(n):
            a=2*pi*i/n;b=c+ax*(cos(a)*rx)+ay*(sin(a)*ry);vv.append((b.x,b.z,-b.y))
    for j in range(len(points)-1):
        for i in range(n):
            k=j*n+i;kn=j*n+(i+1)%n;ff.append((k,kn,kn+n,k+n))
    ff.extend([tuple(range(n-1,-1,-1)),tuple((len(points)-1)*n+i for i in range(n))])
    ob=mesh(name,vv,ff,mat);normal_out(ob)
    mod=ob.modifiers.new('Soft organic transitions','SUBSURF');mod.levels=1;mod.render_levels=1
    return ob

PX=CX;PD=1.01
person_root=empty('Person_Working',(PX,.77,PD))
posture_root=empty('Person / posture',(PX,.88,PD))
head_root=empty('Person / head turn',(PX,1.515,.887))

# Seated pelvis and legs have broad thigh forms and shaped knees, not cylinders.
pelvis=torso_loft('Person / tailored seated hips',[
 (PX,.746,1.035,.20,.16),(PX,.78,1.01,.23,.19),
 (PX,.86,.99,.21,.165),(PX,.91,.985,.195,.15)],denim)
for side in [-1,1]:
    x=PX+side*.135
    limb('Person / bent trouser leg '+str(side),[
      (x,.827,1.035),(x,.815,.96),(x+side*.015,.80,.77),
      (x+side*.03,.765,.59),(x+side*.034,.71,.52),
      (x+side*.043,.60,.50),(x+side*.06,.34,.455),(x+side*.055,.17,.40)],
      [(.12,.105),(.12,.115),(.111,.10),(.095,.098),(.087,.09),(.075,.077),(.059,.062),(.055,.05)],denim)
    shoe_x=x+side*.055
    shoe=box('Person / sneaker sole '+str(side),(shoe_x,.075,.32),(.145,.060,.34),shoe_sole,.032)
    uv_sphere('Person / shaped sneaker upper '+str(side),(shoe_x,.126,.335),(.145,.128,.31),shoe_mat,28,14)
    for j in range(3):
        line('Person / shoelace',[(shoe_x-.047,.187-j*.009,.328-j*.031),(shoe_x+.047,.187-j*.009,.328-j*.031)],.0035,shoe_sole)
    line('Person / trouser knee seam',[(x-.047,.796,.496),(x,.803,.491),(x+.048,.792,.499)],.0025,denim)

upper_before=set(furniture.objects)
torso=torso_loft('Person / knit pullover torso',[
 (PX,.855,1.02,.188,.133),(PX,.88,1.012,.211,.15),
 (PX,.99,.997,.193,.153),(PX,1.12,.968,.209,.166),
 (PX,1.27,.936,.241,.176),(PX,1.39,.918,.260,.16),
 (PX,1.445,.905,.220,.128),(PX,1.471,.895,.13,.103),
 (PX,1.476,.895,.086,.077)],shirt_mat)
torso_loft('Person / ribbed hem',[(PX,.864,1.02,.205,.151),(PX,.893,1.015,.209,.154),(PX,.912,1.01,.201,.15)],shirt_rib)
# A few soft hem folds reinforce the fabric rather than hard armor segments.
for side in [-1,1]:
    line('Person / sweater drape crease',[(PX+side*.17,.927,.863),(PX+side*.184,1.025,.805),(PX+side*.193,1.103,.806)],.004,shirt_rib)
neck=limb('Person / neck',[(PX,1.435,.901),(PX,1.498,.892),(PX,1.566,.876)],[.069,.069,.064],skin,24)
# Crewneck rim rests around the base of the neck.
collar=[]
for i in range(49):
    a=2*pi*i/48;collar.append((PX+.094*cos(a),1.465+.012*sin(a),.898+.088*sin(a)))
line('Person / crew neck rib',collar,.010,shirt_rib,True)

hand_specs=[]
for side in [-1,1]:
    shoulder=(PX+side*.235,1.38,.915)
    elbow=(PX+side*.305,1.118,.684)
    wrist=(PX+side*.165,1.31,.392)
    limb('Person / bent sweater sleeve '+str(side),[
      shoulder,(PX+side*.279,1.344,.882),(PX+side*.309,1.238,.80),
      elbow,(PX+side*.285,1.14,.625),(PX+side*.235,1.21,.514),wrist],
      [.096,.093,.085,.080,.075,.061,.050],shirt_mat,20)
    limb('Person / wrist rib cuff '+str(side),[(PX+side*.174,1.30,.411),wrist,(PX+side*.156,1.321,.369)],[.052,.052,.044],shirt_rib,20)
    hand_specs.append((side,(PX+side*.156,1.324,.363)))
for ob in set(furniture.objects)-upper_before:parent_keep(ob,posture_root)

# Sculpted head profile with a chin, jaw, cheeks, brow and cranial dome.
head_before=set(furniture.objects)
head=torso_loft('Person / sculpted head',[
 (PX,1.532,.857,.035,.044),(PX,1.549,.853,.060,.062),
 (PX,1.580,.861,.087,.087),(PX,1.622,.869,.114,.105),
 (PX,1.675,.877,.118,.116),(PX,1.724,.883,.116,.115),
 (PX,1.773,.888,.108,.105),(PX,1.816,.891,.083,.084),
 (PX,1.845,.892,.039,.041),(PX,1.851,.892,.003,.004)],skin,40)
# Nose is a tapered wedge/bridge, not a ball.
limb('Person / nose bridge',[(PX,1.702,.767),(PX,1.685,.750),(PX,1.651,.741),(PX,1.646,.761)],[.015,.015,.020,.015],skin,16)
for side in [-1,1]:
    uv_sphere('Person / ear '+str(side),(PX+side*.12,1.658,.891),(.041,.079,.045),skin,20,12)
    uv_sphere('Person / inner ear '+str(side),(PX+side*.137,1.661,.886),(.009,.038,.022),skin_dark,16,10)
    eye=uv_sphere('Person / eye '+str(side),(PX+side*.049,1.687,.767),(.025,.012,.008),hair_mat,16,10)
    line('Person / eyebrow '+str(side),[(PX+side*.026,1.716,.775),(PX+side*.048,1.719,.765),(PX+side*.073,1.712,.777)],.005,hair_mat)
line('Person / mouth',[(PX-.030,1.601,.768),(PX,1.599,.761),(PX+.029,1.601,.768)],.0032,skin_dark)
# Close-cropped sides, asymmetrical upper volume and a swept fringe.
hv=[];hf=[];NA,NB=48,20
for j in range(NB+1):
    v=j/NB
    for i in range(NA):
        a=2*pi*i/NA
        # Front hairline is higher; sides wrap down to above the ears.
        front=max(0,-sin(a));back=max(0,sin(a))
        bottom=1.715+.032*front-.024*back
        theta=(1-v)*pi/2
        rx=.125*sin(theta);rd=.122*sin(theta)
        x=PX+rx*cos(a)+.014*v
        d=.891+rd*sin(a)
        h=bottom+(1.887-bottom)*cos(theta)+.010*sin(a+1)*sin(theta)*v+.0025*sin(a*10+v*6)*sin(pi*v)
        hv.append((x,h,d))
for j in range(NB):
    for i in range(NA):
        k=j*NA+i;kn=j*NA+(i+1)%NA;hf.append((k,kn,kn+NA,k+NA))
hair=mesh('Person / shaped cropped hair',hv,hf,hair_mat);normal_out(hair)
for side in [-1,1]:
    limb('Person / tapered sideburn '+str(side),[(PX+side*.112,1.742,.854),(PX+side*.12,1.706,.858),(PX+side*.116,1.682,.86)],[.027,.022,.011],hair_mat,12)
for ob in set(furniture.objects)-head_before:parent_keep(ob,head_root)
parent_keep(head_root,posture_root)

# Hands use low, anatomically proportioned palms and three-segment fingers.
animated_hands=[];animated_fingers=[]
for side,at in hand_specs:
    handroot=empty('Person / typing '+('left' if side<0 else 'right')+' hand',at)
    hx,hh,hd=at;before=set(furniture.objects)
    limb('Person / exposed wrist '+str(side),[(hx,hh,hd+.018),(hx,hh+.002,hd-.009),(hx,hh,hd-.030)],[.036,.035,.034],skin,20)
    palm=uv_sphere('Person / palm '+str(side),(hx,hh,hd-.036),(.107,.037,.094),skin,28,14)
    for ob in set(furniture.objects)-before:parent_keep(ob,handroot)
    for f in range(4):
        fx=hx+(f-1.5)*.025
        fd=hd-.074
        fingerroot=empty('Person / '+str(side)+' finger '+str(f),(fx,hh,fd))
        length=[.064,.077,.072,.056][f];before=set(furniture.objects)
        limb('Person / articulated typing finger',[(fx,hh,fd+.004),(fx,hh+.010,fd-.020),(fx,hh+.004,fd-length*.7),(fx,hh-.021,fd-length)],
             [.011,.010,.008,.0065],skin,12)
        uv_sphere('Person / fingertip nail',(fx,hh-.009,fd-length+.008),(.010,.006,.015),pillow_mat,12,8)
        for ob in set(furniture.objects)-before:parent_keep(ob, fingerroot)
        parent_keep(fingerroot,handroot);animated_fingers.append((fingerroot,side,f))
    before=set(furniture.objects)
    limb('Person / thumb '+str(side),[(hx-side*.04,hh,hd-.025),(hx-side*.067,hh-.005,hd-.054),(hx-side*.072,hh-.021,hd-.080)],[.014,.012,.009],skin,12)
    for ob in set(furniture.objects)-before:parent_keep(ob,handroot)
    parent_keep(handroot,person_root);animated_hands.append((handroot,side))

for ob in set(furniture.objects)-person_before:
    if ob not in (person_root,posture_root) and ob.parent is None:parent_keep(ob,person_root)
parent_keep(posture_root,person_root)

# A five-second loop. Keyboards remain in contact with the hands while fingers
# articulate independently. The head periodically checks a line on the monitor.
scene.render.fps=24;scene.frame_start=0;scene.frame_end=120
for ob,side in animated_hands:
    loc=ob.location.copy()
    for frame in range(0,121,4):
        phase=frame/120*2*pi*10+(0 if side<0 else pi)
        ob.location=loc+Vector((0,0,.003*(1-cos(phase))))
        ob.rotation_euler.x=.018*sin(phase)
        ob.keyframe_insert('location',frame=frame);ob.keyframe_insert('rotation_euler',frame=frame)
for ob,side,f in animated_fingers:
    for frame in range(0,121,3):
        phase=frame/120*2*pi*(10+f*2)+(f*.8)+(0 if side<0 else pi)
        ob.rotation_euler.x=.085*sin(phase)
        ob.keyframe_insert('rotation_euler',frame=frame)
for frame in range(0,121,10):
    phase=frame/120*2*pi
    head_root.rotation_euler.x=.025*sin(phase)
    head_root.rotation_euler.z=.042*sin(phase*2)
    head_root.keyframe_insert('rotation_euler',frame=frame)
    posture_root.rotation_euler.x=.009*sin(phase)
    posture_root.rotation_euler.y=.005*sin(phase*2)
    posture_root.keyframe_insert('rotation_euler',frame=frame)
scene.frame_set(0)


# RIGHT: a single upholstered twin bed with a low headboard.
desk_objects=set(furniture.objects)

BX=2.35
for x in [BX-.86,BX+.86]:
    for d in [-.78,1.78]:
        box('Bed / oak inset leg',(x,.17,d),(.12,.32,.12),oak,.022)
box('Bed / oak platform',(BX,.32,.53),(2.09,.20,3.15),oak,.055)
box('Bed / upholstered base',(BX,.445,.54),(2.04,.17,3.08),bedfabric,.070)
box('Bed / mattress',(BX,.595,.54),(1.96,.22,3.01),flannel,.11)
box('Bed / headboard oak back',(BX,.76,-1.027),(2.14,1.35,.12),oak,.055)
box('Bed / soft upholstered headboard',(BX,.91,-.949),(2.07,.99,.085),bedfabric,.080)
# Fine headboard perimeter welt.
head_pts=[]
for i in range(65):
    a=2*pi*i/64
    xx=(1 if cos(a)>=0 else -1)*abs(cos(a))**.17*.991
    hh=(1 if sin(a)>=0 else -1)*abs(sin(a))**.17*.448
    head_pts.append((BX+xx,.91+hh,-.896))
line('Bed / headboard upholstery piping',head_pts,.0048,stitch,True)

# Duvet with a curled upper edge, draped sides and asymmetric linen folds.
def duvet(u,v):
    x=1.073*u;d=-.225+2.48*v
    side=max(0,(abs(u)-.92)/.08)
    foot=max(0,(v-.92)/.08)
    h=.771-.265*side**1.3-.24*foot**1.3
    h+=.018*sin(10*u+9*v)+.010*cos(21*u-17*v)
    h+=.022*sin(31*u+7*v)*(.16+.84*abs(u)**3)
    h+=.035*math.exp(-((v-.035)/.055)**2)*(1+.35*cos(u*8))
    h+=.031*math.exp(-((u+.25-.18*v)/.085)**2)*sin(v*pi)
    h+=.022*math.exp(-((u-.52+.15*v)/.10)**2)*sin(v*pi*1.4)
    d+=.020*sin(u*13)*(v**6)+.009*sin(u*15)*(1-v)**5
    return (BX+x,h,d)
verts=[];uv=[];faces=[];NU,NV=84,112
for j in range(NV+1):
    for i in range(NU+1):
        u=i/NU*2-1;v=j/NV;verts.append(duvet(u,v));uv.append((i/NU,j/NV))
for j in range(NV):
    for i in range(NU):
        k=j*(NU+1)+i;faces.append((k+NU+1,k+NU+2,k+1,k))
duv=mesh('Bedding / naturally rumpled plaid flannel duvet',verts,faces,flannel,uv)
s=duv.modifiers.new('Duvet hem thickness','SOLIDIFY');s.thickness=.018
# Double edge stitch lines visibly travel with the drape.
for side in [-1,1]:
    for inset in [0,.021]:
        points=[]
        for j in range(113):
            x,h,d=duvet(side*(.985-inset),j/112);points.append((x,h+.005,d))
        line('Bedding / long duvet seam',points,.0027,flannel_seam)
for v in [.014,.982]:
    points=[]
    for i in range(101):
        x,h,d=duvet(i/100*2-1,v);points.append((x,h+.004,d))
    line('Bedding / duvet end welt',points,.0035,flannel_seam)
# A broad turned-over cuff, with soft thickness and independent fabric ripples.
cv=[];cu=[];cf=[];NX,NY=64,15
for j in range(NY+1):
    v=.020+.145*j/NY
    for i in range(NX+1):
        u=i/NX*2-1;x,h,d=duvet(u,v)
        cv.append((x,h+.018+.021*sin(j/NY*pi)+.008*cos(u*11),d));cu.append((i/NX,j/NY))
for j in range(NY):
    for i in range(NX):
        k=j*(NX+1)+i;cf.append((k+NX+1,k+NX+2,k+1,k))
cuff=mesh('Bedding / turned plaid flannel cuff',cv,cf,flannel,cu)
s=cuff.modifiers.new('Folded linen thickness','SOLIDIFY');s.thickness=.020

# Pillow: sewn rectangular perimeter and pillowy center with pinched corner wrinkles.
def pillow_surface(name,cx,hh,dd,w,dep,mat,angle=-.045):
    vv=[];uv=[];ff=[];N,M=56,34
    for underside in [False,True]:
        for j in range(M+1):
            v=j/M*2-1
            for i in range(N+1):
                u=i/N*2-1
                # Rounded-square plan, plush center, fine edge creasing.
                x=u*w/2*(1-.055*abs(v)**6)
                d=v*dep/2*(1-.10*abs(u)**6)
                bulge=max(0,(1-u*u)*(1-v*v))**.58
                wrinkle=(.012*sin(34*u+5*v)*abs(v)**5+.008*sin(31*v)*abs(u)**6)*(1-abs(u)**14)*(1-abs(v)**14)
                h=hh+(-.063 if underside else .132)*bulge+wrinkle*(1 if not underside else .25)
                xx=x*cos(angle)-d*sin(angle);zz=x*sin(angle)+d*cos(angle)
                vv.append((cx+xx,h,dd+zz));uv.append((i/N,j/M))
    stride=(N+1)*(M+1)
    for side in range(2):
        for j in range(M):
            for i in range(N):
                k=side*stride+j*(N+1)+i
                ff.append((k+N+1,k+N+2,k+1,k) if side==0 else (k,k+1,k+N+2,k+N+1))
    ob=mesh(name,vv,ff,mat,uv)
    points=[]
    for i in range(N+1):points.append(vv[i])
    for j in range(1,M+1):points.append(vv[j*(N+1)+N])
    for i in range(N-1,-1,-1):points.append(vv[M*(N+1)+i])
    for j in range(M-1,0,-1):points.append(vv[j*(N+1)])
    line(name+' / sewn piping',points,.005,flannel_seam,True)
    return ob
pillow_surface('Bedding / softly creased plaid flannel pillow',BX,.775,-.574,1.48,.62,flannel)
bed_objects=set(furniture.objects)-desk_objects

# Preview studio. This collection is excluded from glTF export.
floor=box('Studio floor',(0,-.038,0),(200,.06,200),material('Studio white',(1,1,1),.85),.001);own(floor,studio)
world=bpy.data.worlds.new('White studio');scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(1,1,1,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.55
def area(name,at,energy,size,target):
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size
    ob=bpy.data.objects.new(name,data);studio.objects.link(ob);ob.location=p(*at);ob.rotation_euler=(vec(target)-ob.location).to_track_quat('-Z','Y').to_euler()
area('Large softbox left',(-4,7,4),1250,6,(0,.5,0))
area('Broad window fill',(4,5,-3),900,5,(0,.7,0))
area('Front soft fill',(1,4,8),500,5,(0,.6,0))
camd=bpy.data.cameras.new('Room camera');cam=bpy.data.objects.new('Room camera',camd);studio.objects.link(cam)
cam.location=p(0,.85+12*math.tan(math.radians(12)),12);target=vec((0,.85,0));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camd.type='ORTHO';camd.ortho_scale=8.8;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=True
scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.render.film_transparent=True
floor.is_shadow_catcher=True


# Apply only geometry modifiers; object animation remains live and exportable.
bpy.ops.object.select_all(action='DESELECT')
for ob in list(furniture.objects):
    if ob.type not in {'MESH','CURVE'}:continue
    ob.select_set(True);bpy.context.view_layer.objects.active=ob
    if ob.type=='CURVE':bpy.ops.object.convert(target='MESH')
    else:
        for mod in list(ob.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
    ob.select_set(False)

# Twin mattress = 1.00 x 1.95 m. Scale the bed around its original mattress center.
# The group itself keeps clean position and yaw transforms for the web scene.
S=Matrix.Diagonal((1.0/1.96,1.95/3.01,.76,1))
bed_matrix=Matrix.Translation(vec((BX,0,0)))@S@Matrix.Translation(-vec((BX,0,.54)))
for ob in bed_objects:ob.matrix_world=bed_matrix@ob.matrix_world
bpy.context.view_layer.update()
# Consistent physical plaid size across fitted sheet, duvet and pillow.
for ob in bed_objects:
    if ob.type=='MESH' and flannel.name in [m.name for m in ob.data.materials]:
        layer=ob.data.uv_layers.active or ob.data.uv_layers.new(name='UVMap')
        for loop in ob.data.loops:
            co=ob.matrix_world@ob.data.vertices[loop.vertex_index].co
            layer.data[loop.index].uv=(co.x-BX+1,-co.y+1)

desk_root=empty('Desk_Setup',(-2.5,0,0))
bed_root=empty('Bed_Setup',(2.35,0,0))
for ob in desk_objects:
    if ob.parent is None:parent_keep(ob,desk_root)
for ob in bed_objects:parent_keep(ob,bed_root)
desk_root.rotation_euler.z=math.radians(45)
bed_root.rotation_euler.z=math.radians(-45)
scene.frame_set(0);bpy.context.view_layer.update()

def bounds(objects):
    mn=[1e9]*3;mx=[-1e9]*3
    for ob in objects:
        if ob.type!='MESH':continue
        for v in ob.bound_box:
            b=ob.matrix_world@Vector(v);q=(b.x,b.z,-b.y)
            mn=[min(mn[i],q[i]) for i in range(3)];mx=[max(mx[i],q[i]) for i in range(3)]
    return {'min':mn,'max':mx}
info={'coordinate_system':'glTF Y-up; +Z faces viewer','bounds':bounds(furniture.objects),
      'groups':{
       'Desk_Setup':{'pivot':[-2.5,0,0],'yaw_degrees':45,'bounds':bounds(desk_objects)},
       'Bed_Setup':{'pivot':[2.35,0,0],'yaw_degrees':-45,'bounds':bounds(bed_objects)}},
      'twin_mattress_meters':[1.0,.1672,1.95],
      'animation':{'name':'Working','duration_seconds':5,'fps':24,'frames':[0,120]}}
# Bounds are written before export so the website's pane anchors can be planned.
with open(os.path.join(OUT,'layout-info.json'),'w') as f:json.dump(info,f,indent=2)
print('LAYOUT_READY',json.dumps(info),flush=True)
triangles=0
for ob in furniture.objects:
    if ob.type=='MESH':ob.data.calc_loop_triangles();triangles+=len(ob.data.loop_triangles)
    ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'room.glb'),export_format='GLB',use_selection=True,
 export_apply=False,export_yup=True,export_cameras=False,export_lights=False,
 export_animations=True,export_animation_mode='ACTIVE_ACTIONS',
 export_nla_strips_merged_animation_name='Working',export_force_sampling=True,export_frame_range=True)
info.update({'triangles':triangles,'objects':len(furniture.objects),'glb_bytes':os.path.getsize(os.path.join(OUT,'room.glb'))})
with open(os.path.join(OUT,'asset-info.json'),'w') as f:json.dump(info,f,indent=2)
bpy.ops.object.select_all(action='DESELECT')
scene.render.filepath=os.path.join(OUT,'preview-front.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'room.blend'))
bpy.ops.render.render(write_still=True)
# A complementary higher angle makes hands, keyboard contact and bedding inspectable.
cam.location=p(5,4.8,11);cam.rotation_euler=(vec((-.4,.8,.1))-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=os.path.join(OUT,'preview-detail.png')
bpy.ops.render.render(write_still=True)
print('ROOM_COMPLETE',json.dumps(info),flush=True)
