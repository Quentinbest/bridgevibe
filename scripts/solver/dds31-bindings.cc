// US-41.2 / F2 (#63): the shipped DDS 3.1 single-threaded binding, built by scripts/solver/build-dds31.sh.
// Text in, text out, like macroxue-bindings.cc: no Emscripten JS loader is shipped.
#include "api/dll.h"
#include <emscripten/emscripten.h>
#include <cstdio>
#include <cstring>
#include <sstream>
#include <string>

static std::string out;
extern "C" {
// Single-threaded: one solver context, never a worker thread.
EMSCRIPTEN_KEEPALIVE int bv_init() { SetMaxThreads(1); return 0; }
// Input: a PBN deal ("N:AKQ.. ..."). Output: 20 numbers, strains S/H/D/C/NT by hand N/E/S/W,
// the same layout as bridge-dds's resTable.
EMSCRIPTEN_KEEPALIVE const char* bv_table(const char* pbn) {
  DdTableDealPBN deal{};
  std::strncpy(deal.cards, pbn, sizeof(deal.cards) - 1);
  DdTableResults table{};
  int status = CalcDDtablePBNN(deal, &table, 1);
  std::ostringstream text;
  if (status != 1) { text << "error " << status; return (out = text.str()).c_str(); }
  for (auto& row : table.res_table) for (int value : row) text << value << ' ';
  return (out = text.str()).c_str();
}
// Input: "trump first s0 s1 s2 r0 r1 r2\n<remaining cards PBN>" (the SolveBoardPBN fields).
// Output: "cards" then, per card, "suit rank equals score" (solutions=3, mode=1, as bridge-dds).
EMSCRIPTEN_KEEPALIVE const char* bv_solve(const char* input) {
  std::istringstream in(input);
  DealPBN deal{};
  in >> deal.trump >> deal.first;
  for (int& s : deal.currentTrickSuit) in >> s;
  for (int& r : deal.currentTrickRank) in >> r;
  std::string rest;
  std::getline(in, rest);
  std::getline(in, rest);
  std::strncpy(deal.remainCards, rest.c_str(), sizeof(deal.remainCards) - 1);
  FutureTricks fut{};
  int status = SolveBoardPBN(deal, -1, 3, 1, &fut, 0);
  std::ostringstream text;
  if (status != 1) { text << "error " << status; return (out = text.str()).c_str(); }
  text << fut.cards;
  for (int i = 0; i < fut.cards; ++i) text << ' ' << fut.suit[i] << ' ' << fut.rank[i] << ' ' << fut.equals[i] << ' ' << fut.score[i];
  return (out = text.str()).c_str();
}
}
