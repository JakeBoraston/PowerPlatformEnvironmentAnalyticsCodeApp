# Changelog

Notable changes to Environment Analytics. Each version below has a solution to
import on the [Releases](https://github.com/JakeBoraston/PowerPlatformEnvironmentAnalyticsCodeApp/releases)
page; import a newer one over an older one to upgrade in place.

## [1.1.1] - 2026-09-18

### Fixed

- Flow run durations were a thousand times too long. Dataverse stores a run's
  duration in milliseconds and the app read it as seconds.
- Run time is now the median rather than the average. A few runs left waiting
  days on an approval made the average meaningless. The dashboard and each flow
  show a typical duration, with a count of runs that waited over a day, and the
  optimisation scatter and slowest-flows chart use each flow's median.
- Durations over a day read as days and hours.

## [1.1.0] - 2026-09-17

First public release.

### Added

- Environment health: fourteen checks, ranked, each with a count, what to do
  about it and a link to the records behind it.
- Pages for cloud flows, flow detail, failures, connections, canvas apps,
  model-driven apps, agents, agent detail, solutions, solution history,
  environment variables, system jobs and users.
- Light, dark and system themes.
- A written summary and a data table behind every chart.

### Changed

- Every table is read in full. The Power Apps SDK returns 500 rows per call by
  default, so larger environments were being cut short.
- A source that fails to load says why (missing permission, missing table) and
  shows a dash rather than a zero.
- Accessibility: WCAG 2.2 AA contrast, visible labels, keyboard operation
  throughout.

[1.1.1]: https://github.com/JakeBoraston/PowerPlatformEnvironmentAnalyticsCodeApp/releases/tag/v1.1.1
[1.1.0]: https://github.com/JakeBoraston/PowerPlatformEnvironmentAnalyticsCodeApp/releases/tag/v1.1.0
