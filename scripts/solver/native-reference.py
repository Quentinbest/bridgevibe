"""US-17.4 / F2: native DDS oracle, JSON in/out; never imported by the app."""
import ctypes
import os
import json
import sys
import endplay
import endplay._dds as dds
from endplay.dds import calc_dd_table, solve_board
from endplay.types import Deal, Denom, Player

cases = json.load(sys.stdin)
results = []
for case in cases:
    table = calc_dd_table(Deal(case['pbn']))
    positions = []
    for position in case['positions']:
        deal = Deal(case['pbn'], first=Player(position['leader']), trump=Denom(position['strain']))
        for card in position['plays']:
            deal.play(card)
        scores = {'SHDC'[card.suit] + card.rank.abbr: tricks for card, tricks in solve_board(deal)}
        positions.append([scores[card] for card in position['legal']])
    results.append({'table': [[table[Denom(suit), Player(seat)] for seat in range(4)] for suit in range(5)], 'positions': positions})
info = dds.DDSInfo()
dds._dll.GetDDSInfo(ctypes.byref(info))
json.dump({'version': endplay.__version__, 'ddsVersion': f'{info.major}.{info.minor}.{info.patch}', 'results': results}, sys.stdout)
sys.stdout.flush()
# DDS's worker threads can abort during interpreter teardown (SIGABRT) after the results are
# complete; exit immediately once the output is flushed so the generator sees a clean exit.
os._exit(0)
