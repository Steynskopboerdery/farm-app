import numpy as np, json, sys
S = json.load(open('series.json'))
def outlook(pts, h, w, volk=1.0, look=60):
    recent = pts[-look:]
    t = np.arange(len(recent)) / 12
    slope = np.polyfit(t, np.log(recent), 1)[0]
    yearly = np.log(pts[12:] / pts[:-12])
    vol = np.std(yearly, ddof=1)
    likely = pts[-1] * np.exp(w * slope * h / 12)
    spread = np.exp(volk * vol * np.sqrt(h / 12))
    return likely / spread, likely, likely * spread
def test(name, h, **kw):
    res = []
    for key, v in S.items():
        v = np.array(v, float)
        for o in range(60, len(v) - h):
            lo, mid, hi = outlook(v[:o + 1], h, **kw)
            a = v[o + h]
            res.append((abs(np.log(a / mid)), lo <= a <= hi))
    r = np.array(res)
    print(f'{name:34s} h={h:2d}  avg miss {np.mean(r[:,0])*100:4.1f}%  inside band {np.mean(r[:,1]):4.0%}')
for h in [6, 12]:
    test('no change (just today)', h, w=0)
    test('half the 5-yr trend (app now)', h, w=0.5)
    test('full 5-yr trend', h, w=1)
    test('half trend, band x1.3', h, w=0.5, volk=1.3)
    test('no change, band x1.3', h, w=0, volk=1.3)
    print()
for h in [6, 12, 18]:
    test('no change, outer band (1.3 x 1.645)', h, w=0, volk=1.3 * 1.645)
    test('no change, outer band (1.3 x 1.4)', h, w=0, volk=1.3 * 1.4)
