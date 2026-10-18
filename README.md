# ComfyUI-LUT-Master

LUT post-processing node for ComfyUI.

<img src="https://github.com/Rimor-dev/ComfyUI-LUT-Master/assets/node.png" alt="main" width="30%"> 


Apply up to 4 `.cube` LUTs sequentially with adjustable strength (0–100%).
Plus exposure, offset, and gamma corrections.

---

## Install

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/Rimor-dev/ComfyUI-LUT-Master.git
cd ComfyUI-LUT-Master
pip install -r requirements.txt
Restart ComfyUI.

Place your .cube files into luts/ inside the node pack.

Usage
Add LUT Master node

Connect image → output

Click + LUT to add a slot (max 4)

Select .cube file + adjust strength (0–100%)

Use Exposure / Offset / Gamma for color corrections

Order of operations: Exposure → Offset → Gamma → LUTs (sequential).
