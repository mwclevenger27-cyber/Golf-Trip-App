// Real scorecards for the trip's four rounds (from GolfPass, October 2026).
// World Tour and Arrowhead have more than one set of nines, so double-check
// those against the scorecard at the course. Everything here can be edited in
// the app on the Trip tab.

const holes = (pars, sis) => pars.map((par, i) => ({ par, si: sis[i] }));

export const COURSES = [
  {
    name: 'World Tour Golf Links',
    day_label: 'Thu, Apr 1',
    play_date: '2027-04-01',
    tee_time: '2:21 PM',
    holes: holes(
      [4, 5, 3, 4, 5, 4, 3, 4, 4, 4, 5, 3, 4, 3, 5, 4, 4, 4],
      [15, 3, 7, 5, 1, 11, 9, 13, 17, 12, 10, 18, 2, 14, 8, 6, 16, 4],
    ),
    tees: [
      { name: 'Black', yards: 6525, rating: 71.8, slope: 132 },
      { name: 'Gold', yards: 6214, rating: 70.5, slope: 129 },
      { name: 'Silver', yards: 5826, rating: 68.5, slope: 123 },
    ],
    tee_name: 'Gold',
    note: 'Has several sets of nines. Check which ones you are playing.',
  },
  {
    name: 'Myrtle Beach National South Creek',
    day_label: 'Fri, Apr 2 AM',
    play_date: '2027-04-02',
    tee_time: '8:20 AM',
    holes: holes(
      [4, 5, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 4, 4, 5, 3, 4],
      [4, 2, 14, 18, 10, 8, 12, 16, 6, 1, 11, 9, 15, 13, 5, 3, 17, 7],
    ),
    tees: [
      { name: 'Blue', yards: 6416, rating: 70.5, slope: 123 },
      { name: 'White', yards: 6089, rating: 69.1, slope: 118 },
      { name: 'Gold', yards: 5710, rating: 67.3, slope: 112 },
    ],
    tee_name: 'Blue',
    note: '',
  },
  {
    name: "Myrtle Beach National King's North",
    day_label: 'Fri, Apr 2 PM',
    play_date: '2027-04-02',
    tee_time: '2:07 PM',
    holes: holes(
      [5, 4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 3, 4, 4, 5, 4, 3, 4],
      [10, 8, 12, 16, 14, 2, 6, 18, 4, 13, 11, 17, 3, 9, 1, 7, 15, 5],
    ),
    tees: [
      { name: 'Black', yards: 7017, rating: 74.2, slope: 137 },
      { name: 'Gold', yards: 6481, rating: 71.1, slope: 131 },
      { name: 'White', yards: 6024, rating: 69.3, slope: 125 },
      { name: 'Blue', yards: 5662, rating: 67.5, slope: 118 },
    ],
    tee_name: 'Gold',
    note: '',
  },
  {
    name: 'Arrowhead Country Club',
    day_label: 'Sat, Apr 3',
    play_date: '2027-04-03',
    tee_time: '8:42 AM',
    holes: holes(
      [5, 4, 3, 4, 3, 5, 4, 4, 4, 4, 3, 4, 3, 5, 4, 4, 3, 5],
      [11, 1, 13, 5, 17, 7, 3, 15, 9, 10, 18, 2, 8, 16, 6, 14, 12, 4],
    ),
    tees: [
      { name: 'Back', yards: 6519, rating: 70.1, slope: 133 },
      { name: 'Middle', yards: 6130, rating: 68.6, slope: 126 },
      { name: 'Forward', yards: 5324, rating: 67.1, slope: 119 },
    ],
    tee_name: 'Middle',
    note: 'Has 27 holes (Cypress, Lakes, Waterway). Check which nines you are playing.',
  },
];

export const ROSTER = [
  'Brayden West', 'Noah West', 'Derek Null', 'Grant Kiser', 'Tanner Black', 'Eric Price',
  'Lucas Maynard', 'Blake Jordan', 'Blake Hogan', 'Shawn Moore', 'Kade Sword', 'Tristan Johnson',
  "Morgan O'Brian", 'Bryant Payne', 'Brock Turner', 'Matthew Clevenger',
];
