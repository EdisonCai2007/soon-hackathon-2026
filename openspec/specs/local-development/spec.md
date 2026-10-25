# local-development Specification

## Purpose
The app starts on a developer's own computer, on any shell, with the data its pages read, and says plainly what to do when a step has not been run.

## Requirements
### Requirement: The app starts on a developer's own computer
The repository SHALL provide one command that starts the app locally, and that command SHALL work in every shell the repository supports, including a Windows shell. Starting it SHALL NOT depend on files being reachable that the development server refuses to serve.

#### Scenario: Start it on Windows
- **WHEN** a person runs the documented start command from a Windows shell
- **THEN** the server starts and serves the app, with no unrecognised-command error and no denied-path error

#### Scenario: A dependency has just changed
- **WHEN** the start command runs for the first time after the lockfile changed, so dependencies are re-examined
- **THEN** the server still starts, rather than refusing over a file the Worker reads from the repository

### Requirement: The local database can be put in the state the pages expect
The repository SHALL provide one named command that applies every migration to the local database, and the steps for starting the app locally SHALL say to run it. Starting the app SHALL NOT apply migrations as a side effect.

#### Scenario: A fresh clone
- **WHEN** a person follows the documented local steps on a fresh clone
- **THEN** the pages that read from the database work, rather than failing with a missing table

#### Scenario: Starting the app again
- **WHEN** the app is started locally
- **THEN** no migration is applied without being asked for
