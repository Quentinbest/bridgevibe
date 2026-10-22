// US-41.2 / F2: the shipped macroxue binding, built by scripts/solver/build-macroxue.sh.
// Same arithmetic as macro-reference.cc, but on an ending: the hands at the start of the
// current trick, so the adapter never needs the earlier tricks.
#include "solver.h"
#include <emscripten/emscripten.h>
#include <sstream>
#include <string>

static std::string out;
static Deal ReadHands(std::istream& in) {
  Deal deal;
  for (int seat : {NORTH, EAST, SOUTH, WEST}) std::getline(in, deal.hands[seat]);
  return deal;
}
extern "C" {
// Input: four hand lines N, E, S, W. Output: 20 numbers, strains S/H/D/C/NT by declarer N/E/S/W.
EMSCRIPTEN_KEEPALIVE const char* bv_table(const char* input) {
  std::istringstream in(input);
  Deal deal = ReadHands(in);
  int table[5][4];
  Solve(deal, {SPADE, HEART, DIAMOND, CLUB, NOTRUMP}, {WEST, NORTH, EAST, SOUTH},
    [](int) {}, [&](int trump, int leader, int ns) {
      int declarer = (leader + 3) % 4;
      table[trump][(declarer + 3) % 4] = IsNs(declarer) ? ns : NumTricks(deal) - ns;
    }, [](int) {});
  std::ostringstream text;
  for (auto& row : table) for (int value : row) text << value << ' ';
  return (out = text.str()).c_str();
}
// Input: four hand lines N, E, S, W (the ending at the start of the current trick), then
// "<strain 0-4 S/H/D/C/NT> <leader 0-3 N/E/S/W> <count> <cards played to this trick> <legal count> <legal cards>".
// Output: for each legal card, the tricks the side to act takes from this trick on.
EMSCRIPTEN_KEEPALIVE const char* bv_position(const char* input) {
  std::istringstream in(input);
  Deal deal = ReadHands(in);
  int strain, leader, count, legal;
  std::string card;
  in >> strain >> leader >> count;
  std::vector<int> plays;
  for (int i = 0; i < count; ++i) { in >> card; plays.push_back(CardOf(CharToSuit(card[0]), CharToRank(card[1]))); }
  Position position = GetPosition(deal, strain, (leader + 1) % 4, plays);
  std::ostringstream text;
  in >> legal;
  for (int i = 0; i < legal; ++i) {
    in >> card;
    plays.push_back(CardOf(CharToSuit(card[0]), CharToRank(card[1])));
    int ns = SolvePlay(deal, strain, (leader + 1) % 4, plays);
    plays.pop_back();
    text << (IsNs(position.seat_to_play) ? ns : NumTricks(deal) - ns) << ' ';
  }
  return (out = text.str()).c_str();
}
}
