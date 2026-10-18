from .lut_master_nodes import LUTMaster, register_routes
from .layer_blend_nodes import LayerBlend

NODE_CLASS_MAPPINGS = {
    "Rimor_LUTMaster": LUTMaster,
    "Rimor_LayerBlend": LayerBlend,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Rimor_LUTMaster": "LUT Master",
    "Rimor_LayerBlend": "Layer Blend",
}

WEB_DIRECTORY = "./web"

register_routes()

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]