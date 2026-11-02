import numpy as np
raw = """1981:149.9,40.9,65.6,88.6,37.2,15.4,40.1,65.8,26.9,26,14,20.5
1982:100.6,47.8,46.6,152.6,17.3,34.4,50.6,22.2,33.7,54.3,21.4,12.3
1983:6,21.9,22.4,19.2,66.4,50.5,45.7,10.1,38.3,20.9,22.8,9.3
1984:10.1,7.7,51.1,15.1,78.3,10.2,36.8,13.3,24.2,43.4,7.9,35.4
1985:52.9,34.3,31.9,49.6,21,40.8,64.3,17.9,13.4,51.3,32.5,40.6
1986:5.4,16.9,21.6,23.7,7.5,46.4,32.8,143.1,27.6,75.1,30.6,22.6
1987:23.7,29.1,20.1,89.9,32.2,76.8,74.3,29.4,49.2,7.8,4.2,16.4
1988:4.6,10.4,32.6,59.9,17.9,38,14,52.1,26.5,16.6,9.8,39.9
1989:9.4,23.7,66.6,91.6,7.5,152.8,27.8,31.4,30,58.7,30.9,5.3
1990:10.4,54.1,23.7,78,42.7,46.8,21.5,15.3,9.2,11.9,11,26.1
1991:27.7,11.3,15,14.5,19.9,25.2,43.4,12.7,20.2,64.4,8.7,13.1
1992:14.9,19.3,35,22.5,25.7,61.4,63.2,21.5,21.7,69.3,37.2,6.4
1993:7.3,37,11.4,114.3,53.3,33.3,52.9,18.5,26.6,8.6,7.9,34
1994:34.3,18.4,50.1,29.8,20.3,49.1,38.9,38.8,18.6,33,5.9,93.3
1995:10.1,20,46.9,33.2,50.2,18.9,25.8,29.8,20.5,27,62.9,86.6
1996:13.8,29.8,17.6,10.3,25.1,20.2,59.2,28.3,35.3,138.8,97.1,27.8
1997:8.8,7.8,54,39.3,71.2,42.2,22,32.4,15.2,26.5,32.5,14
1998:22,13.7,38.4,35.3,63.9,19.2,24.2,26.6,16.5,10.3,73.6,42.4
1999:16.8,17.8,30.6,25.6,33.7,8.3,26.2,31.5,38.2,25,10.8,29.2
2000:52.7,19.8,103.3,12.3,32.5,10.7,30.4,18.9,20.3,18.9,33.5,27.3
2001:16.3,12.9,26.3,37.6,25.5,14.7,47.9,43.9,35.6,40.8,45,9.3
2002:35.5,16.8,8.4,37,52.6,39.9,40.8,43.7,26.5,13,15.1,33.8
2003:26.5,12.2,129,36.3,26,12.2,20.9,59.4,15.3,35.7,6.5,14.1
2004:12.6,24.4,18,64.3,13.7,33.8,40.9,20.1,21.2,71.3,7.5,101.8
2005:40,13.4,19.4,81.8,42,45.6,14.4,31.8,15.8,11.2,40.3,4.7
2006:28.6,26.2,12.3,56.9,50.8,26.6,93.9,135.1,13.8,39.2,17.6,15.6
2007:7.4,31.4,23.2,53.4,57.7,38.2,68.2,26.3,12.1,30,151,67.7
2008:13.3,21.2,18,14.8,20.7,42.3,31.5,48.2,39.8,27.3,134.2,12.2
2009:20.5,16.8,8.2,26.5,21.4,46.9,40.4,17.2,25.1,57.3,30.9,20.6
2010:6.4,21.3,23.5,12.6,27.2,49.2,31.9,20.3,11.2,47.3,22.2,36.6
2011:16.1,28.1,14,16.8,58.3,50.7,64.9,41.7,7.7,15.7,35.4,13.6
2012:9.8,15.3,54.3,39.2,15.7,49,46.4,49.7,19.3,80,10.3,8.3
2013:14.1,26.2,17.9,24.5,14.3,38.8,30.8,65.4,16.5,56.6,51.5,12.7
2014:93,13.2,42.8,46.3,15.6,41.1,23.7,24.3,27.5,14.3,39.6,14.5
2015:13.7,19.6,35.2,18.7,22.4,115.9,55.6,53.5,38.1,19.7,24.7,16.2
2016:39,33.5,37.7,33.9,35.6,46.5,59.9,32.3,40.4,9.9,11.2,11.6
2017:27.1,11.1,10.6,19.5,10.5,31.6,26.4,40.2,16.4,26.5,49.3,8.9
2018:26.1,23.6,27.8,15.1,20.7,32.5,23.7,39.9,48.6,8.9,26.8,15
2019:11,26.6,118.8,25.2,24.2,31.5,32.2,6.6,39.7,39.7,24.4,11.6
2020:66.9,29,35.8,13.6,33.9,47.8,44.2,56.9,32.5,54.2,36.3,25.5
2021:24.2,12.8,64.8,19.3,223.4,35.1,42.7,70.1,11,40.7,54.1,70.1
2022:22.3,31.9,33.8,20.6,31.6,50,18.8,29.1,20.3,17,14.7,96.4
2023:19.7,24.5,128.6,28.8,102.7,97.1,38,18.3,111.7,85.8,5.5,53.3
2024:20.5,24.3,64,96.9,15,93.4,84.6,84.5,36.4,63.5,33.5,9
2025:20.4,36.5,74.2,40,22.3,38.7,42.7,9.8,17.9,13.8,12.2,15.9"""
oni = dict((int(a), float(b)) for a, b in (x.split(':') for x in "1980:0.4,1981:-0.27,1982:0.73,1983:0.62,1984:-0.52,1985:-0.6,1986:0.02,1987:1.11,1988:-1.3,1989:-0.4,1990:0.25,1991:0.63,1992:0.72,1993:0.56,1994:0.23,1995:-0.11,1996:-0.24,1997:1.13,1998:-0.08,1999:-0.84,2000:-0.62,2001:-0.08,2002:0.45,2003:-0.13,2004:0.22,2005:0.09,2006:-0.05,2007:-0.41,2008:-0.56,2009:0.34,2010:-0.66,2011:-0.34,2012:0.03,2013:-0.38,2014:0.22,2015:1.19,2016:0.09,2017:0.32,2018:0.13,2019:0.59,2020:-0.18,2021:-0.31,2022:-0.73,2023:0.73,2024:0.18,2025:-0.02".split(",")))

rain = {int(l.split(':')[0]): [float(v) for v in l.split(':')[1].split(',')] for l in raw.splitlines()}
gsr = {y: sum(r[3:10]) for y, r in rain.items()}
years = sorted(gsr)
phase = lambda a: 'el' if a >= 0.5 else 'la' if a <= -0.5 else 'ne'
print('season rain: median %.0f, p20 %.0f, p80 %.0f' % (np.median(list(gsr.values())), np.percentile(list(gsr.values()), 20), np.percentile(list(gsr.values()), 80)))
print('corr MJJ ONI vs GSR: %.2f' % np.corrcoef([oni[y] for y in years], [gsr[y] for y in years])[0, 1])
for p in ['el', 'ne', 'la']:
    v = [gsr[y] for y in years if phase(oni[y]) == p]
    print(p, len(v), 'median %.0f' % np.median(v))

def evaluate(name, predict):
    errs, inside, below, above = [], 0, 0, 0
    test = [y for y in years if y >= 1996]
    for y in test:
        hist = [gsr[x] for x in years if x < y]
        lo, mid, hi = predict(y, hist)
        a = gsr[y]
        errs.append(abs(a - mid))
        inside += lo <= a <= hi; below += a < lo; above += a > hi
    n = len(test)
    print(f'{name:38s} avg miss {np.mean(errs):5.0f} mm   inside range {inside/n:4.0%}  (below {below/n:4.0%}, above {above/n:4.0%})')

def base(y, h, q=(20, 50, 80)): return [np.percentile(h, q_) for q_ in q]
evaluate('All years, 20/50/80 (app now)', base)
evaluate('Last 30 years only', lambda y, h: base(y, h[-30:]))
evaluate('Last 15 years only', lambda y, h: base(y, h[-15:]))
def trend(y, h):
    xs = np.arange(len(h)); b = np.polyfit(xs, h, 1)
    resid = np.array(h) - np.polyval(b, xs); c = np.polyval(b, len(h))
    return [c + np.percentile(resid, 20), c + np.median(resid), c + np.percentile(resid, 80)]
evaluate('Straight trend line', trend)
# El Nino tilt as in the app, with the known winter phase as 70 % chance (a typical forecast)
def tilt(y, h, known=0.7):
    hy = [x for x in years if x < y]
    med = np.median(h)
    pct = {}
    for p in ['el', 'ne', 'la']:
        v = [gsr[x] for x in hy if phase(oni[x]) == p]
        pct[p] = np.median(v) / med if len(v) >= 3 else 1
    ph = phase(oni[y]); w = {p: (known if p == ph else (1 - known) / 2) for p in pct}
    f = sum(w[p] * pct[p] for p in pct)
    return [v * f for v in base(y, h)]
evaluate('El Nino tilt (70% sure of the phase)', tilt)
evaluate('El Nino tilt, half strength', lambda y, h: [ (a+b)/2 for a, b in zip(tilt(y, h), base(y, h))])
evaluate('Wider range 15/50/85', lambda y, h: base(y, h, (15, 50, 85)))
# recent decades vs earlier
print('mean 1981-2000 %.0f, 2001-2025 %.0f, 2016-2025 %.0f' % (np.mean([gsr[y] for y in years if y <= 2000]), np.mean([gsr[y] for y in years if y > 2000]), np.mean([gsr[y] for y in years if y > 2015])))
print()
def ladder(name, qfun):
    test = [y for y in years if y >= 1996]
    out = []
    for c in [90, 70, 50, 30, 10]:
        hits = sum(gsr[y] >= qfun(y, [gsr[x] for x in years if x < y], 100 - c) for y in test)
        out.append(f'{c}%→{hits/len(test):.0%}')
    print(f'{name:38s} chance-of-at-least: ' + '  '.join(out))
ladder('All years (app now)', lambda y, h, q: np.percentile(h, q))
ladder('Last 30 years', lambda y, h, q: np.percentile(h[-30:], q))
def tq(y, h, q, n=None, s=1.0):
    hh = h[-n:] if n else h
    f = tilt(y, hh)[1] / np.median(hh)
    return np.percentile(hh, q) * (1 + (f - 1) * s)
ladder('All years + El Nino tilt', lambda y, h, q: tq(y, h, q))
ladder('Last 30 years + El Nino tilt', lambda y, h, q: tq(y, h, q, 30))
# smoothed / widened: blend each quantile 25% towards the more extreme
def wide(y, h, q, k=1.25, n=None):
    hh = h[-n:] if n else h
    m = np.median(hh); return m + (np.percentile(hh, q) - m) * k
ladder('All years, spread x1.25', wide)
ladder('All years + tilt, spread x1.25', lambda y, h, q: wide(y, h, q) * tilt(y, h)[1] / np.median(h))
print()
for k in [1.0, 1.25, 1.5]:
    evaluate(f'tilt + spread x{k}', lambda y, h, k=k: [ (np.median(h) + (v - np.median(h)) * k) * tilt(y, h)[1] / np.median(h) for v in base(y, h)])
evaluate('tilt + 10/50/90', lambda y, h: [v * tilt(y, h)[1] / np.median(h) for v in base(y, h, (10, 50, 90))])
