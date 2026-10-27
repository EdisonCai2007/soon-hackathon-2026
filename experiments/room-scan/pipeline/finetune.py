# Train from an existing PLY instead of sparse points: metal_gauss.train's own loop, seeded with every splat of --init.
# Pass the usual training flags after --init; budget and start-active are set to the PLY's splat count.
# --freeze-first N keeps the PLY's first N splats still: their gradients are zeroed, and the export puts them back exactly.
import sys
import numpy as np
import torch
from metal_gauss import train as T
from metal_gauss.io import load_ply

args = sys.argv[1:]
i = args.index('--init')
ply = args[i + 1]
del args[i:i + 2]
frozen = 0
if '--freeze-first' in args:
    k = args.index('--freeze-first')
    frozen = int(args[k + 1])
    del args[k:k + 2]
splats = load_ply(ply)
n = len(splats)
assert splats.sh.shape[1] == 16, 'needs degree-3 spherical harmonics'


def from_ply(scene, budget, device):
    assert budget == n, f'budget {budget} must equal the PLY\'s {n} splats'
    opac = splats.opacities.clamp(1e-4, 1 - 1e-4)
    return {
        'means': splats.means.to(device).clone().requires_grad_(True),
        'log_scales': torch.log(splats.scales.clamp_min(1e-8)).to(device).requires_grad_(True),
        'quats': splats.quats.to(device).clone().requires_grad_(True),
        'logit_opac': torch.log(opac / (1 - opac)).to(device).requires_grad_(True),
        'sh': splats.sh.to(device).clone().requires_grad_(True),
    }


T.init_params = from_ply

if frozen:
    split = T.split_sh

    def split_frozen(p):
        p = split(p)
        for leaf in p.values():
            if isinstance(leaf, torch.Tensor) and leaf.requires_grad and leaf.shape[0] == n:
                leaf.register_hook(lambda g: torch.cat([torch.zeros_like(g[:frozen]), g[frozen:]]))
        return p

    T.split_sh = split_frozen
    export = T.export_ply

    def export_restored(p, path, filter_3d=None):
        # Relocation and noise can still nudge a frozen splat; the file gets the original back.
        export(p, path, filter_3d)
        from plyfile import PlyData, PlyElement
        trained = PlyData.read(path)['vertex'].data
        original = PlyData.read(ply)['vertex'].data
        assert trained.dtype == original.dtype, 'the trainer writes a different splat layout than --init'
        trained[:frozen] = original[:frozen]
        PlyData([PlyElement.describe(trained, 'vertex')], text=False).write(path)

    T.export_ply = export_restored
sys.argv = [sys.argv[0], *args, '--budget', str(n), '--start-active', str(n)]
print(f'fine-tuning {n:,} splats from {ply}', flush=True)
np.random.seed(0)
T.main()
