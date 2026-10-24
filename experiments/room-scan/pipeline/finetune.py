# Train from an existing PLY instead of sparse points: metal_gauss.train's own loop, seeded with every splat of --init.
# Pass the usual training flags after --init; budget and start-active are set to the PLY's splat count.
import sys
import numpy as np
import torch
from metal_gauss import train as T
from metal_gauss.io import load_ply

args = sys.argv[1:]
i = args.index('--init')
ply = args[i + 1]
del args[i:i + 2]
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
sys.argv = [sys.argv[0], *args, '--budget', str(n), '--start-active', str(n)]
print(f'fine-tuning {n:,} splats from {ply}', flush=True)
np.random.seed(0)
T.main()
