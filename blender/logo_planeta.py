"""
LOGO PLANETA: script de Blender (probado en Blender 5.2)

Arma la escena completa:
  1. El logo en 3D a partir de su silueta (curva extruida con bordes redondeados).
  2. Un shape key "Planeta" que convierte el logo en una esfera con relieve:
     la misma malla, así el cambio planeta -> logo es un morph continuo.
  3. Material que pasa de planeta (océanos, continentes y nubes) al azul del logo.
  4. Fondo de espacio con nébulas animadas y estrellas (shader del World).
  5. Animación de 6 s: el planeta gira y se transforma en el logo.
  6. Exporta public/3d/logo-planeta.glb (con el morph) para la página web.

Cómo usarlo:
  - Desde Blender: pestaña Scripting > Open > este archivo > Run Script.
  - Sin abrir Blender (desde la raíz del proyecto):
        blender --background --python blender/logo_planeta.py
    Para además renderizar el video:
        blender --background --python blender/logo_planeta.py -- --render
"""

import math
import os
import sys

import bpy
import numpy as np
import bmesh
from mathutils import Matrix, Vector, noise
from mathutils.bvhtree import BVHTree

# ---------------------------------------------------------------------------
# Ajustes
# ---------------------------------------------------------------------------
DEPTH = 0.34            # mitad del grosor del logo
BEVEL = 0.07            # radio del borde redondeado
VOXEL = 0.028           # tamaño del remallado (más chico = más vértices)
PLANET_RADIUS = 1.75    # radio del planeta
RELIEF = 0.02           # altura de montañas del planeta
SHELL = 1.03            # la esfera lisa que cubre el planeta (x radio)
FPS = 30
FRAMES = 180            # 6 s
LOGO_BLUE = (0.16, 0.27, 0.95, 1.0)


def project_root():
    """Carpeta raíz del proyecto (la que contiene /blender y /public)."""
    path = bpy.path.abspath("//") or ""
    here = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else ""
    for base in (here, path, os.getcwd()):
        if base and os.path.isdir(os.path.join(base, "..", "public")):
            return os.path.normpath(os.path.join(base, ".."))
        if base and os.path.isdir(os.path.join(base, "public")):
            return os.path.normpath(base)
    return os.getcwd()


# ---------------------------------------------------------------------------
# 1. Silueta del logo (plano XY, unidades del mundo, y hacia arriba)
# ---------------------------------------------------------------------------
def arc(cx, cy, r, a0, a1, steps=24):
    """Puntos de un arco de a0 a a1 (grados), sin incluir el último."""
    pts = []
    for i in range(steps):
        a = math.radians(a0 + (a1 - a0) * i / steps)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def logo_outline():
    # Contorno exterior en sentido horario
    outer = [(-1.75, 1.5)]
    outer += arc(0.9, 0.65, 0.85, 90, 0)          # esquina superior derecha
    outer += arc(1.1, -0.85, 0.65, 0, -90)        # esquina inferior derecha
    outer += [(1.1, -1.5), (-1.53, -1.5), (-0.08, 0.75), (-1.75, 0.75)]
    # Hueco triangular
    hole = [(0.75, 0.72), (0.75, -0.75), (-0.2, -0.75)]
    return outer, hole


def build_logo():
    outer, hole = logo_outline()
    curve = bpy.data.curves.new("LogoCurve", "CURVE")
    curve.dimensions = "2D"
    curve.fill_mode = "BOTH"
    curve.extrude = DEPTH - BEVEL
    curve.bevel_depth = BEVEL
    curve.bevel_resolution = 6
    for pts in (outer, hole):
        spline = curve.splines.new("POLY")
        spline.points.add(len(pts) - 1)
        for p, (x, y) in zip(spline.points, pts):
            p.co = (x, y, 0.0, 1.0)
        spline.use_cyclic_u = True

    obj = bpy.data.objects.new("LogoPlaneta", curve)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.active_object

    # Remallado uniforme: el morph necesita vértices repartidos parejo
    obj.data.remesh_voxel_size = VOXEL
    obj.data.remesh_voxel_adaptivity = 0.0
    bpy.ops.object.voxel_remesh()

    # Triangular para que la malla se exporte igual a como se ve
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(obj.data)
    bm.free()
    bpy.ops.object.shade_smooth()
    return obj


# ---------------------------------------------------------------------------
# 2. Shape key "Planeta"
# ---------------------------------------------------------------------------
def terrain(d):
    """Relieve del planeta según la dirección (0 en el mar, sube en continentes)."""
    n = noise.fractal(d * 1.6, 0.6, 2.1, 5, noise_basis="PERLIN_ORIGINAL")
    return max(n, 0.0)


def add_planet_shape(obj):
    mesh = obj.data
    bvh = BVHTree.FromPolygons([v.co.copy() for v in mesh.vertices], [p.vertices[:] for p in mesh.polygons])

    obj.shape_key_add(name="Basis", from_mix=False)
    key = obj.shape_key_add(name="Planeta", from_mix=False)

    shrink = [1.0] * len(mesh.vertices)
    dirs = []
    for i, v in enumerate(mesh.vertices):
        d = v.co.normalized() if v.co.length > 1e-6 else Vector((0, 0, 1))
        # ¿Cuántas capas del logo hay más afuera en esta dirección?
        # Las paredes del hueco quedan "dentro" del planeta y no se ven.
        layers, origin = 0, v.co + d * 0.004
        while layers < 4:
            hit, _, _, dist = bvh.ray_cast(origin, d)
            if hit is None:
                break
            layers += 1
            origin = hit + d * 0.004
        shrink[i] = 1.0 - 0.025 * layers
        dirs.append(d)

    # Vecinos de cada vértice (para suavizar)
    edges = np.array([e.vertices[:] for e in mesh.edges])
    count = np.bincount(edges.ravel(), minlength=len(mesh.vertices)).astype(float)[:, None]

    def neighbor_avg(values):
        acc = np.zeros_like(values)
        np.add.at(acc, edges[:, 0], values[edges[:, 1]])
        np.add.at(acc, edges[:, 1], values[edges[:, 0]])
        return acc / np.maximum(count, 1)

    dirs = np.array([tuple(d) for d in dirs])

    # Suaviza también el encogido: sin esto queda una grieta donde una capa
    # interna se une con la superficie exterior.
    shrink = np.array(shrink)[:, None]
    for _ in range(8):
        shrink = 0.5 * shrink + 0.5 * neighbor_avg(shrink)

    for i, d in enumerate(dirs):
        d = Vector(d)
        key.data[i].co = d * PLANET_RADIUS * (1.0 + RELIEF * terrain(d)) * float(shrink[i, 0])

    key.value = 1.0
    return key


# ---------------------------------------------------------------------------
# 3. Material: planeta <-> logo
# ---------------------------------------------------------------------------
def planet_shader(nt, x=0, y=0):
    """Nodos del planeta: ruido sobre la dirección -> mar / costa / tierra / nubes."""
    N, L = nt.nodes, nt.links
    coord = N.new("ShaderNodeTexCoord")
    coord.location = (x - 1200, y)
    norm = N.new("ShaderNodeVectorMath")
    norm.operation = "NORMALIZE"
    norm.location = (x - 1000, y)
    L.new(coord.outputs["Object"], norm.inputs[0])

    land = N.new("ShaderNodeTexNoise")
    land.location = (x - 800, y + 100)
    land.inputs["Scale"].default_value = 1.6
    land.inputs["Detail"].default_value = 8
    L.new(norm.outputs[0], land.inputs["Vector"])
    ramp = N.new("ShaderNodeValToRGB")
    ramp.location = (x - 600, y + 100)
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.5, (0.004, 0.012, 0.09, 1)  # mar profundo
    els[1].position, els[1].color = 0.62, (0.12, 0.35, 0.95, 1)   # tierra azul
    e = els.new(0.53)
    e.color = (0.02, 0.12, 0.45, 1)                                # costa
    L.new(land.outputs["Fac"], ramp.inputs["Fac"])

    clouds = N.new("ShaderNodeTexNoise")
    clouds.location = (x - 800, y - 200)
    clouds.inputs["Scale"].default_value = 3.0
    clouds.inputs["Detail"].default_value = 4
    clouds.inputs["Distortion"].default_value = 1.2
    L.new(norm.outputs[0], clouds.inputs["Vector"])
    cramp = N.new("ShaderNodeMapRange")
    cramp.location = (x - 600, y - 200)
    cramp.inputs["From Min"].default_value = 0.6
    cramp.inputs["From Max"].default_value = 0.78
    cramp.inputs["To Max"].default_value = 0.8
    L.new(clouds.outputs["Fac"], cramp.inputs["Value"])
    cmix = N.new("ShaderNodeMix")
    cmix.data_type = "RGBA"
    cmix.location = (x - 380, y)
    L.new(cramp.outputs[0], cmix.inputs["Factor"])
    L.new(ramp.outputs["Color"], cmix.inputs[6])
    cmix.inputs[7].default_value = (0.85, 0.9, 1.0, 1)

    planet = N.new("ShaderNodeBsdfPrincipled")
    planet.location = (x, y)
    L.new(cmix.outputs[2], planet.inputs["Base Color"])
    planet.inputs["Roughness"].default_value = 0.6
    # Atmósfera: brillo azul en el borde
    fres = N.new("ShaderNodeLayerWeight")
    fres.location = (x - 220, y - 300)
    fres.inputs["Blend"].default_value = 0.45
    rim = N.new("ShaderNodeMath")
    rim.operation = "POWER"
    rim.location = (x - 120, y - 300)
    rim.inputs[1].default_value = 3.0
    L.new(fres.outputs["Facing"], rim.inputs[0])
    L.new(rim.outputs[0], planet.inputs["Emission Strength"])
    planet.inputs["Emission Color"].default_value = (0.3, 0.55, 1.0, 1)
    return planet


def drive_by_shape(socket, key_owner, key, expression):
    """Conecta un valor al shape key: así todo sigue al morph."""
    drv = socket.driver_add("default_value").driver
    drv.type = "SCRIPTED"
    var = drv.variables.new()
    var.name = "planeta"
    var.targets[0].id_type = "KEY"
    var.targets[0].id = key_owner.data.shape_keys
    var.targets[0].data_path = f'key_blocks["{key.name}"].value'
    drv.expression = expression


def build_material(obj, key):
    mat = bpy.data.materials.new("LogoPlanetaMat")
    nt = mat.node_tree
    nt.nodes.clear()
    N, L = nt.nodes, nt.links

    out = N.new("ShaderNodeOutputMaterial")
    out.location = (900, 0)

    # Logo: azul brillante con barniz
    logo = N.new("ShaderNodeBsdfPrincipled")
    logo.location = (300, 350)
    logo.inputs["Base Color"].default_value = LOGO_BLUE
    logo.inputs["Roughness"].default_value = 0.22
    logo.inputs["Coat Weight"].default_value = 0.8
    logo.inputs["Coat Roughness"].default_value = 0.05

    planet = planet_shader(nt, 300, -150)

    # Mezcla controlada por el shape key
    mix = N.new("ShaderNodeMixShader")
    mix.location = (650, 0)
    L.new(logo.outputs[0], mix.inputs[1])
    L.new(planet.outputs[0], mix.inputs[2])
    L.new(mix.outputs[0], out.inputs["Surface"])
    drive_by_shape(mix.inputs["Fac"], obj, key, "min(max((planeta - 0.15) / 0.7, 0), 1)")
    obj.data.materials.append(mat)


def build_shell(obj, key):
    """
    Esfera lisa que cubre el planeta al inicio. La malla del logo hecha esfera
    tiene pliegues donde el contorno se dobla; este cascarón los tapa y se
    disuelve justo cuando empieza el morph (el movimiento disimula el cambio).
    """
    bpy.ops.mesh.primitive_uv_sphere_add(segments=128, ring_count=64, radius=PLANET_RADIUS * SHELL)
    shell = bpy.context.active_object
    shell.name = "PlanetaCascaron"
    bpy.ops.object.shade_smooth()
    shell.parent = obj

    mat = bpy.data.materials.new("CascaronMat")
    nt = mat.node_tree
    nt.nodes.clear()
    N, L = nt.nodes, nt.links
    out = N.new("ShaderNodeOutputMaterial")
    out.location = (900, 0)
    planet = planet_shader(nt, 300, 0)
    clear = N.new("ShaderNodeBsdfTransparent")
    clear.location = (300, 250)
    mix = N.new("ShaderNodeMixShader")
    mix.location = (650, 0)
    L.new(clear.outputs[0], mix.inputs[1])
    L.new(planet.outputs[0], mix.inputs[2])
    L.new(mix.outputs[0], out.inputs["Surface"])
    drive_by_shape(mix.inputs["Fac"], obj, key, "min(max((planeta - 0.8) / 0.18, 0), 1)")
    shell.data.materials.append(mat)
    # Se encoge un poco mientras se disuelve
    for axis in range(3):
        fc = shell.driver_add("scale", axis)
        var = fc.driver.variables.new()
        var.name = "planeta"
        var.targets[0].id_type = "KEY"
        var.targets[0].id = obj.data.shape_keys
        var.targets[0].data_path = f'key_blocks["{key.name}"].value'
        fc.driver.expression = "0.94 + 0.06 * min(max((planeta - 0.8) / 0.18, 0), 1)"
    return shell


# ---------------------------------------------------------------------------
# 4. Fondo: nébulas animadas + estrellas
# ---------------------------------------------------------------------------
def build_world():
    world = bpy.data.worlds.new("Espacio")
    bpy.context.scene.world = world
    nt = world.node_tree
    nt.nodes.clear()
    N, L = nt.nodes, nt.links

    out = N.new("ShaderNodeOutputWorld")
    out.location = (900, 0)
    coord = N.new("ShaderNodeTexCoord")
    coord.location = (-900, 0)

    # Nébula: ruido 4D (la 4ª dimensión "w" avanza con el tiempo)
    neb = N.new("ShaderNodeTexNoise")
    neb.noise_dimensions = "4D"
    neb.location = (-600, 150)
    neb.inputs["Scale"].default_value = 1.4
    neb.inputs["Detail"].default_value = 10
    neb.inputs["Roughness"].default_value = 0.62
    neb.inputs["Distortion"].default_value = 0.6
    L.new(coord.outputs["Generated"], neb.inputs["Vector"])
    w = neb.inputs["W"].driver_add("default_value")
    w.driver.expression = "frame * 0.004"

    nramp = N.new("ShaderNodeValToRGB")
    nramp.location = (-350, 150)
    els = nramp.color_ramp.elements
    els[0].position, els[0].color = 0.5, (0.001, 0.0015, 0.008, 1)
    els[1].position, els[1].color = 0.85, (0.35, 0.12, 0.6, 1)
    mid = els.new(0.66)
    mid.color = (0.015, 0.03, 0.22, 1)
    L.new(neb.outputs["Fac"], nramp.inputs["Fac"])

    # Estrellas: puntos de Voronoi muy pequeños
    stars = N.new("ShaderNodeTexVoronoi")
    stars.feature = "DISTANCE_TO_EDGE"
    stars.location = (-600, -200)
    stars.inputs["Scale"].default_value = 260
    L.new(coord.outputs["Generated"], stars.inputs["Vector"])
    vor = N.new("ShaderNodeTexVoronoi")
    vor.location = (-600, -450)
    vor.inputs["Scale"].default_value = 260
    L.new(coord.outputs["Generated"], vor.inputs["Vector"])
    srange = N.new("ShaderNodeMapRange")
    srange.location = (-350, -450)
    srange.inputs["From Min"].default_value = 0.06
    srange.inputs["From Max"].default_value = 0.0
    L.new(vor.outputs["Distance"], srange.inputs["Value"])

    add = N.new("ShaderNodeMix")
    add.data_type = "RGBA"
    add.blend_type = "ADD"
    add.location = (0, 0)
    add.inputs["Factor"].default_value = 1.0
    L.new(nramp.outputs["Color"], add.inputs[6])
    L.new(srange.outputs[0], add.inputs[7])

    bg = N.new("ShaderNodeBackground")
    bg.location = (400, 0)
    bg.inputs["Strength"].default_value = 1.0
    L.new(add.outputs[2], bg.inputs["Color"])
    L.new(bg.outputs[0], out.inputs["Surface"])


# ---------------------------------------------------------------------------
# 5. Cámara, luces y animación
# ---------------------------------------------------------------------------
def build_scene(obj, key):
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start, scene.frame_end = 1, FRAMES
    scene.render.resolution_x, scene.render.resolution_y = 1920, 1080

    cam_data = bpy.data.cameras.new("Camara")
    cam_data.lens = 50
    cam = bpy.data.objects.new("Camara", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (0, -12, 0)
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.camera = cam

    def area(name, loc, power, color, size):
        light = bpy.data.lights.new(name, "AREA")
        light.energy, light.color, light.size = power, color, size
        o = bpy.data.objects.new(name, light)
        scene.collection.objects.link(o)
        o.location = loc
        o.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

    area("Luz principal", (-4, -6, 5), 900, (1, 1, 1), 3)
    area("Contraluz", (5, 4, -2), 700, (0.35, 0.5, 1.0), 4)
    area("Relleno", (6, -5, -3), 200, (0.6, 0.7, 1.0), 6)

    # Morph: planeta (1) -> logo (0)
    key.value = 1.0
    key.keyframe_insert("value", frame=1)
    key.keyframe_insert("value", frame=45)
    key.value = 0.0
    key.keyframe_insert("value", frame=140)

    # Giro: el planeta rota y frena justo cuando aparece el logo de frente
    obj.rotation_euler = (math.radians(90), 0, math.radians(-360 - 20))
    obj.keyframe_insert("rotation_euler", frame=1)
    obj.rotation_euler = (math.radians(90), 0, math.radians(-20))
    obj.keyframe_insert("rotation_euler", frame=150)

    for fc in obj.animation_data.action.fcurves if hasattr(obj.animation_data.action, "fcurves") else []:
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
            kp.easing = "EASE_IN_OUT"

    scene.view_settings.view_transform = "Standard"
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.image_settings.media_type = "VIDEO"
    scene.render.ffmpeg.format = "MPEG4"
    scene.render.ffmpeg.codec = "H264"
    scene.render.filepath = os.path.join(project_root(), "render", "logo-planeta_")


# ---------------------------------------------------------------------------
# 6. Exportar para la web
# ---------------------------------------------------------------------------
def export_glb(obj, key):
    path = os.path.join(project_root(), "public", "3d", "logo-planeta.glb")
    os.makedirs(os.path.dirname(path), exist_ok=True)

    # Para la web el logo va sin rotación (de frente hacia +Z en three.js)
    saved_rot = obj.rotation_euler.copy()
    saved_anim = obj.animation_data.action if obj.animation_data else None
    if obj.animation_data:
        obj.animation_data.action = None
    obj.rotation_euler = (math.radians(90), 0, 0)
    key.value = 1.0

    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_morph=True,
        export_morph_normal=True,
        export_animations=False,
        export_materials="EXPORT",
        export_yup=True,
    )

    obj.rotation_euler = saved_rot
    if obj.animation_data:
        obj.animation_data.action = saved_anim
    print(f"[logo_planeta] GLB exportado: {path}")


def clean_scene():
    """Borra lo que haya en la escena (sin cerrar el archivo ni el editor de texto)."""
    for coll in (bpy.data.objects, bpy.data.meshes, bpy.data.curves, bpy.data.materials,
                 bpy.data.lights, bpy.data.cameras, bpy.data.worlds, bpy.data.shape_keys):
        for block in list(coll):
            try:
                coll.remove(block)
            except (TypeError, AttributeError, RuntimeError):
                pass


def main():
    clean_scene()
    obj = build_logo()
    key = add_planet_shape(obj)
    build_material(obj, key)
    shell = build_shell(obj, key)
    build_world()
    build_scene(obj, key)
    export_glb(obj, key)
    bpy.context.scene.frame_set(1)
    print(f"[logo_planeta] {len(obj.data.vertices)} vértices")

    if "--render" in sys.argv:
        bpy.ops.render.render(animation=True)


main()
