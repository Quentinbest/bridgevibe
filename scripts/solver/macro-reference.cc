// US-17.4 / F2: offline driver for the pinned macroxue public API (never shipped).
#include "solver.h"
#include <iostream>
int main() {
  Deal deal;
  for (int seat : {NORTH, EAST, SOUTH, WEST}) std::getline(std::cin, deal.hands[seat]);
  int table[5][4];
  Solve(deal, {SPADE, HEART, DIAMOND, CLUB, NOTRUMP}, {WEST, NORTH, EAST, SOUTH},
    [](int) {}, [&](int trump, int leader, int ns) {
      int declarer = (leader + 3) % 4;
      table[trump][(declarer + 3) % 4] = IsNs(declarer) ? ns : 13 - ns;
    }, [](int) {});
  for (auto& row : table) for (int value : row) std::cout << value << ' ';
  int strain, leader, count;
  while (std::cin >> strain >> leader >> count) {
    std::vector<int> plays;
    std::string card;
    for (int i = 0; i < count; ++i) { std::cin >> card; plays.push_back(CardOf(CharToSuit(card[0]), CharToRank(card[1]))); }
    Position position = GetPosition(deal, strain, (leader + 1) % 4, plays);
    int legal; std::cin >> legal;
    for (int i = 0; i < legal; ++i) {
      std::cin >> card;
      plays.push_back(CardOf(CharToSuit(card[0]), CharToRank(card[1])));
      int ns = SolvePlay(deal, strain, (leader + 1) % 4, plays);
      plays.pop_back();
      std::cout << (IsNs(position.seat_to_play) ? ns - position.ns_tricks_won
        : 13 - ns - (count / 4 - position.ns_tricks_won)) << ' ';
    }
  }
  std::cout << '\n';
}
