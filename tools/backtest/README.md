# Prediction back-tests

Checks the Predictions tab's methods against what really happened, using only the data that was
available at the time (each season or month is predicted from the years before it).

- `rain.py`: growing-season rain (April–October) at Spitskop, 1981–2025, from NASA POWER, with the
  May–July El Niño index. Tests 1996–2025.
- `prices.py` + `series.json`: world prices in Rand per month (World Bank Pink Sheet × Rand/Dollar),
  Oct 2011 – Sep 2026. Tests every month with five years of history, 6, 12 and 18 months ahead.

Run with `python3 -I rain.py` and `python3 -I prices.py` (needs numpy).

Results (November 2026), used for `RAIN_SPREAD` and `PRICE_TREND_WEIGHT` / `PRICE_BAND` in `src/lib/calc/outlook.ts`:

| What | Before | After |
|---|---|---|
| Season rain inside the dry–wet range (should be ~60%) | 47% | 60% |
| "At least this much rain in 9 years in 10" came true | 73% | 87% |
| Price 12 months ahead, average miss | 20,7% (half the trend) | 19,8% (today's price) |
| Price inside the "2 years in 3" band | 57% | 67–72% |
| Price inside the "9 years in 10" band | – | 86–89% |

El Niño shifting the rain helped a little (average miss 62 mm against 63 mm), so it stays. Here El Niño
winters have been wetter than usual and La Niña winters drier.
