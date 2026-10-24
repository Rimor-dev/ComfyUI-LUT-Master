import os
import json
import numpy as np
import torch
from PIL import Image
from pillow_lut import load_cube_file
import colorsys

try:
    from server import PromptServer
    from aiohttp import web
except ImportError:
    PromptServer = None
    web = None


# ============================================================
# ПУТЬ К LUT-ФАЙЛАМ
# ============================================================
LUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "luts")


def get_available_luts():
    if not os.path.isdir(LUT_DIR):
        return []
    return sorted([
        f for f in os.listdir(LUT_DIR)
        if f.lower().endswith(".cube")
    ])


# ============================================================
# HTTP-ЭНДПОИНТ
# ============================================================
_routes_registered = False


def register_routes():
    global _routes_registered
    if _routes_registered:
        return
    if PromptServer is None or web is None:
        print("\033[93m[LUT Master] PromptServer not available — endpoint skipped\033[0m")
        return

    try:
        @PromptServer.instance.routes.get("/lut_master/list")
        async def lut_list_handler(request):
            return web.json_response({
                "luts": get_available_luts(),
                "dir": LUT_DIR,
            })

        _routes_registered = True
        print(f"\033[92m[LUT Master]\033[0m Endpoint registered: /lut_master/list")
    except Exception as e:
        print(f"\033[91m[LUT Master] Failed to register endpoint: {e}\033[0m")


# ============================================================
# RGB CURVE
# ============================================================
def apply_rgb_curve(image_tensor, a_x, a_y, b_x, b_y):
    a_x = max(0.0, min(1.0, float(a_x)))
    a_y = max(0.0, min(1.0, float(a_y)))
    b_x = max(0.0, min(1.0, float(b_x)))
    b_y = max(0.0, min(1.0, float(b_y)))

    if a_x > b_x:
        a_x, b_x = b_x, a_x
        a_y, b_y = b_y, a_y

    if abs(b_x - a_x) < 1e-6:
        return image_tensor

    img = image_tensor.clone().cpu().numpy()
    if img.shape[-1] == 4:
        img = img[..., :3]
    slope = (b_y - a_y) / (b_x - a_x)

    result = np.where(
        img <= a_x,
        a_y * img / max(a_x, 1e-6),
        np.where(
            img >= b_x,
            b_y + (img - b_x) * (1.0 - b_y) / max(1.0 - b_x, 1e-6),
            a_y + (img - a_x) * slope,
        )
    )

    result = np.clip(result, 0.0, 1.0)
    return torch.from_numpy(result.astype(np.float32))


# ============================================================
# PHOTO FILTER
# ============================================================
PHOTO_FILTERS = {
    "cooling_lbb": (0.0, 0.2, 0.4),
    "cooling_80": (0.0, 0.1, 0.2),
    "warming_85": (0.4, 0.2, 0.0),
    "warming_lba": (0.3, 0.15, 0.0),
    "sepia": (0.4, 0.3, 0.2),
    "deep_red": (0.5, 0.0, 0.0),
    "deep_blue": (0.0, 0.0, 0.5),
    "deep_emerald": (0.0, 0.4, 0.2),
    "deep_yellow": (0.5, 0.4, 0.0),
}


def rgb_to_hsl_np(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    maxc = np.maximum(np.maximum(r, g), b)
    minc = np.minimum(np.minimum(r, g), b)
    l = (maxc + minc) / 2.0
    delta = maxc - minc

    s = np.where(
        delta < 1e-6, 0.0,
        np.where(l < 0.5, delta / np.maximum(maxc + minc, 1e-6),
                 delta / np.maximum(2.0 - maxc - minc, 1e-6))
    )

    h = np.zeros_like(r)
    mask = delta > 1e-6
    r_mask = mask & (maxc == r)
    g_mask = mask & (maxc == g)
    b_mask = mask & (maxc == b)

    h = np.where(r_mask, ((g - b) / np.maximum(delta, 1e-6)) % 6.0, h)
    h = np.where(g_mask, (b - r) / np.maximum(delta, 1e-6) + 2.0, h)
    h = np.where(b_mask, (r - g) / np.maximum(delta, 1e-6) + 4.0, h)
    h = h / 6.0

    return np.stack([h, s, l], axis=-1)


def hsl_to_rgb_np(hsl):
    h, s, l = hsl[..., 0], hsl[..., 1], hsl[..., 2]

    def hue2rgb(p, q, t):
        t = t % 1.0
        return np.where(
            t < 1/6, p + (q - p) * 6 * t,
            np.where(
                t < 1/2, q,
                np.where(t < 2/3, p + (q - p) * (2/3 - t) * 6, p)
            )
        )

    q = np.where(l < 0.5, l * (1 + s), l + s - l * s)
    p = 2 * l - q

    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)

    return np.stack([r, g, b], axis=-1)


def apply_photo_filter(image_tensor, filter_name, density, preserve_lum):
    if filter_name not in PHOTO_FILTERS or density <= 0:
        return image_tensor

    filter_color = np.array(PHOTO_FILTERS[filter_name], dtype=np.float32)
    d = max(0.0, min(100.0, float(density))) / 100.0

    img = image_tensor.clone().cpu().numpy()
    if img.shape[-1] == 4:
        img = img[..., :3]
    filtered = img * filter_color
    result = img * (1.0 - d) + filtered * d

    if preserve_lum:
        orig_hsl = rgb_to_hsl_np(img)
        result_hsl = rgb_to_hsl_np(np.clip(result, 0.0, 1.0))
        result_hsl[..., 2] = orig_hsl[..., 2]
        result = hsl_to_rgb_np(result_hsl)

    result = np.clip(result, 0.0, 1.0)
    return torch.from_numpy(result.astype(np.float32))


# ============================================================
# LUT
# ============================================================
def apply_lut_to_tensor(image_tensor, lut_filename, strength=100.0):
    if not lut_filename:
        return image_tensor

    s = max(0.0, min(100.0, float(strength))) / 100.0
    if s <= 0.0:
        return image_tensor

    lut_path = os.path.join(LUT_DIR, lut_filename)
    if not os.path.isfile(lut_path):
        print(f"\033[93m[LUT Master] LUT not found: {lut_path}\033[0m")
        return image_tensor

    try:
        lut = load_cube_file(lut_path)
    except Exception as e:
        print(f"\033[91m[LUT Master] Failed to load LUT: {e}\033[0m")
        return image_tensor

    results = []
    for i in range(image_tensor.shape[0]):
        img_np = (image_tensor[i].cpu().numpy() * 255).astype(np.uint8)
        img_pil = Image.fromarray(img_np).convert("RGB")

        img_lut = img_pil.filter(lut)

        if s < 1.0:
            img_orig_np = np.array(img_pil, dtype=np.float32)
            img_lut_np = np.array(img_lut, dtype=np.float32)
            blended = img_orig_np * (1.0 - s) + img_lut_np * s
            img_lut = Image.fromarray(np.clip(blended, 0, 255).astype(np.uint8))

        results.append(np.array(img_lut, dtype=np.float32) / 255.0)

    return torch.from_numpy(np.stack(results, axis=0))


# ============================================================
# КОРРЕКЦИИ
# ============================================================
def apply_corrections(image_tensor, exposure=0.0, offset=0.0, gamma=1.0):
    img = image_tensor.clone()

    if exposure != 0.0:
        img = img * (2.0 ** exposure)

    if offset != 0.0:
        img = img + offset

    img = torch.clamp(img, 0.0, 1.0)

    if gamma != 1.0 and gamma > 0.0:
        img = torch.pow(img, 1.0 / gamma)

    img = torch.clamp(img, 0.0, 1.0)
    return img


# ============================================================
# LUT MASTER NODE
# ============================================================
class LUTMaster:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "lut_config": ("STRING", {"default": "[]", "multiline": False}),
                "exposure": ("FLOAT", {"default": 0.0, "min": -5.0, "max": 5.0, "step": 0.01}),
                "offset": ("FLOAT", {"default": 0.0, "min": -1.0, "max": 1.0, "step": 0.01}),
                "gamma": ("FLOAT", {"default": 1.0, "min": 0.1, "max": 3.0, "step": 0.01}),
                "curve_a_x": ("FLOAT", {"default": 0.25, "min": 0.0, "max": 1.0, "step": 0.01}),
                "curve_a_y": ("FLOAT", {"default": 0.25, "min": 0.0, "max": 1.0, "step": 0.01}),
                "curve_b_x": ("FLOAT", {"default": 0.75, "min": 0.0, "max": 1.0, "step": 0.01}),
                "curve_b_y": ("FLOAT", {"default": 0.75, "min": 0.0, "max": 1.0, "step": 0.01}),
                "photo_filter": (list(PHOTO_FILTERS.keys()), {"default": "cooling_lbb"}),
                "photo_filter_density": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 100.0, "step": 0.1}),
                "photo_filter_preserve_lum": ("BOOLEAN", {"default": False}),
                "photo_filter_after_lut": ("BOOLEAN", {"default": False}),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "apply"
    CATEGORY = "Rimor_dev/postprocess"

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("nan")

    def apply(
        self, image, lut_config="[]",
        exposure=0.0, offset=0.0, gamma=1.0,
        curve_a_x=0.25, curve_a_y=0.25, curve_b_x=0.75, curve_b_y=0.75,
        photo_filter="cooling_lbb", photo_filter_density=0.0,
        photo_filter_preserve_lum=False, photo_filter_after_lut=False,
    ):
        try:
            luts = json.loads(lut_config) if lut_config else []
        except json.JSONDecodeError:
            luts = []

        print(f"\033[92m[LUT Master]\033[0m "
              f"luts: {len(luts)} | "
              f"exp: {exposure:.2f} | off: {offset:.2f} | gamma: {gamma:.2f} | "
              f"curve: ({curve_a_x:.2f},{curve_a_y:.2f})->({curve_b_x:.2f},{curve_b_y:.2f}) | "
              f"filter: {photo_filter} @ {photo_filter_density:.0f}% | "
              f"preserve_lum: {photo_filter_preserve_lum} | "
              f"after_lut: {photo_filter_after_lut}")

        result = apply_corrections(image, exposure, offset, gamma)
        result = apply_rgb_curve(result, curve_a_x, curve_a_y, curve_b_x, curve_b_y)

        if not photo_filter_after_lut and photo_filter_density > 0:
            result = apply_photo_filter(result, photo_filter, photo_filter_density, photo_filter_preserve_lum)

        for lut_entry in luts:
            filename = lut_entry.get("file", "")
            strength = lut_entry.get("strength", 100.0)
            if filename:
                print(f"  -> applying {filename} @ {strength:.0f}%")
                result = apply_lut_to_tensor(result, filename, strength)

        if photo_filter_after_lut and photo_filter_density > 0:
            result = apply_photo_filter(result, photo_filter, photo_filter_density, photo_filter_preserve_lum)

        return (result,)


NODE_CLASS_MAPPINGS = {
    "Rimor_LUTMaster": LUTMaster,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Rimor_LUTMaster": "LUT Master",
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "register_routes"]