# Project Tasks

## Phase 1: Setup
– [x] Create project repository
– [x] Configure .gitignore
– [x] Set up development environment

## Phase 2: Implementation
– [x] Create data fetching module
– [ ] Build report template
– [ ] Add formatting logic

## Progress Notes
- Created `module03-task/.venv` and installed the dependencies from `requirements.txt` (`python-pptx` 1.0.2).
- The dependency import check passed. Running `main.py` failed because it imports a `Calculator` class that is not defined in `calculator.py`; resolving that mismatch is outside Phase 1.
- Added `module03-task/data_fetching.py` to collect local Git history and working-tree data for the existing report generator. Jira, capacity, and PM update sources remain unconfigured.