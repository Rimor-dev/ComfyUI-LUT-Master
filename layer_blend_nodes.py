import torch
import numpy as np
from comfy_api.latest import ComfyExtension, io


# ============================================================
# BLEND MODES (numpy, 0..1)
# ============================================================
def blend_normal(base, top):
    return top


def blend_multiply(base, top):
    return base * top


def blend_screen(base, top):
    return 1.0 - (1.0 - base) * (1.0 - top)


def blend_overlay(base, top):
    return np.where(base < 0.5, 2.0 * base * top, 1.0 - 2.0 * (1.0 - base) * (1.0 - top))


def blend_soft_light(base, top):
    return np.where(
        top < 0.5,
        2.0 * base * top + base * base * (1.0 - 2.0 * top),
        2.0 * base * (1.0 - top) + np.sqrt(base) * (2.0 * top - 1.0),
    )


def blend_hard_light(base, top):
    return np.where(top < 0.5, 2.0 * base * top, 1.0 - 2.0 * (1.0 - base) * (1.0 - top))


def blend_add(base, top):
    return np.clip(base + top, 0.0, 1.0)


def blend_subtract(base, top):
    return np.clip(base - top, 0.0, 1.0)


def blend_difference(base, top):
    return np.abs(base - top)


BLEND_MODES = {
    "normal": blend_normal,
    "multiply": blend_multiply,
    "screen": blend_screen,
    "overlay": blend_overlay,
    "soft_light": blend_soft_light,
    "hard_light": blend_hard_light,
    "add": blend_add,
    "subtract": blend_subtract,
    "difference": blend_difference,
}


# ============================================================
# NODE
# ============================================================
class LayerBlend(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="Rimor_LayerBlend",
            display_name="Layer Blend",
            category="Rimor_dev/postprocess",
            description="Blend two images with blend modes and opacity. "
                        "image_a is base, image_b is the top layer.",
            inputs=[
                io.Image.Input("image_a", display_name="Image A (base)"),
                io.Image.Input("image_b", display_name="Image B (top)"),
                io.Combo.Input(
                    "blend_mode",
                    options=list(BLEND_MODES.keys()),
                    default="normal",
                    display_name="Blend Mode",
                ),
                io.Float.Input(
                    "opacity", default=100.0, min=0.0, max=100.0, step=0.1,
                    display_name="Opacity (%)",
                ),
            ],
            outputs=[
                io.Image.Output(display_name="image"),
            ],
        )

    @classmethod
    def execute(cls, image_a, image_b, blend_mode="normal", opacity=100.0, **kwargs) -> io.NodeOutput:
        # Приводим к numpy
        a = image_a.cpu().numpy() if isinstance(image_a, torch.Tensor) else np.array(image_a)
        b = image_b.cpu().numpy() if isinstance(image_b, torch.Tensor) else np.array(image_b)

        # Batch: приводим к одному размеру
        batch = min(a.shape[0], b.shape[0])
        a = a[:batch]
        b = b[:batch]

        # Если размеры не совпадают — ресайз b под a (простой nearest)
        if a.shape[1:3] != b.shape[1:3]:
            from PIL import Image
            new_h, new_w = a.shape[1], a.shape[2]
            b_resized = []
            for i in range(b.shape[0]):
                img = Image.fromarray((b[i] * 255).astype(np.uint8))
                img = img.resize((new_w, new_h), Image.BILINEAR)
                b_resized.append(np.array(img, dtype=np.float32) / 255.0)
            b = np.stack(b_resized, axis=0)

        # Blend
        fn = BLEND_MODES.get(blend_mode, blend_normal)
        blended = fn(a, b)

        # Opacity
        alpha = max(0.0, min(100.0, float(opacity))) / 100.0
        if alpha < 1.0:
            blended = a * (1.0 - alpha) + blended * alpha

        blended = np.clip(blended, 0.0, 1.0)

        print(f"\033[92m[Layer Blend]\033[0m "
              f"mode: {blend_mode} | opacity: {opacity:.0f}% | "
              f"batch: {batch} | shape: {blended.shape}")

        return io.NodeOutput(torch.from_numpy(blended).float())

    blend = execute


# ============================================================
# REGISTRATION
# ============================================================
NODE_CLASS_MAPPINGS = {
    "Rimor_LayerBlend": LayerBlend,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Rimor_LayerBlend": "Layer Blend",
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]