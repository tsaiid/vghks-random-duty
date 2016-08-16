### [0.2.4](/vghks-random-duty/ver/0.2.4/) – 2016-08-16

1. Show only the DAY instead of MONTH/DAY in 1-month mode. (#51)
2. Confirm that there is no friday determination error. (#47)

### [0.2.3](/vghks-random-duty/ver/0.2.3/) – 2015-08-22

1. Fix: should calculate ordinary duty for total points. (#45)
2. Fix: ignore if clicking on day not in the month range. (#40)
3. Can summarize week working hours. (#46)
4. Can download screenshot for storing random duty results. (#41)

### [0.2.2](/vghks-random-duty/ver/0.2.2/) – 2015-08-17

1. Fix: correct the path for version info file. (#43)
2. Add more colors for duties. (#38)
3. Add links to all previous releases, and show change logs. (#44)

### [0.2.1](/vghks-random-duty/ver/0.2.1/) – 2015-08-15

1. Fix: update duty status after deleting holiday. (#42)
2. Fix: check current month range if already has random duty. (#37)

### [0.2](/vghks-random-duty/ver/0.2.0/) - 2015-08-10

1. Add a switch to control if VGHKS mode or general mode. (#19)
2. Show QOD status and colorize the duty dates in summary. (#30)
3. Cache deleted gcal events preventing rerendering while changing month. (#32)
4. Use cookie to store preferences. (#33)
5. Show an alert before re-random if a result exists. (#35)
6. Fix some bugs. (#31, #34)
7. Show a loading page before all elements get ready.

### [0.1.1](/vghks-random-duty/ver/0.1.1/) - 2015-08-05

1. Fix #36: Random patterns sometimes do not have a solution!

### [0.1](/vghks-random-duty/ver/0.1.0/) - 2015-07-26

1. Initial release: [official site](http://radtools.tsai.it/vghks-random-duty/).
2. VGHKS Rad mode random duty generator.
3. Use web workers for the heavy calculation of random duties.
4. Can set 1-month or 2-month mode.
5. A suggested duty pattern for each staff can be generted automatically or adjusted manually.
6. Can filter condinuous duty, setting upper limit for QOD duty and standard deviation of duty interval.
7. Can set non-duty and customize holidays.
8. The manually added and automatically generated duties can be dragged, edit, and deleted.