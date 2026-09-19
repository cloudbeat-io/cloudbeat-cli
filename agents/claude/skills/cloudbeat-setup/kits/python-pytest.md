---
flavor: python-pytest
projectType: Pytest
language: python
packages:
  - cloudbeat-pytest
  - cloudbeat-selenium      # only with Selenium
capabilities:
  wrapDriver: true          # Selenium only (EventFiringWebDriver)
  wrapPlaywright: false     # cloudbeat-playwright has no working wrapper yet - do not install it
  browserLogs: false
  networkCapture: false
  screenshotsOnFailure: auto   # once the Selenium driver is wrapped
  consoleCapture: auto      # Python logging and stdout/stderr are captured automatically
  customSteps: opt-in       # @cb.step decorator / cb.step_context
---

# Kit recipe: Python + pytest (+ Selenium)

## How the kit behaves
- `cloudbeat-pytest` is a pytest plugin, registered automatically through its `pytest11` entry point - installing the package is enough, no `conftest.py` or `pytest.ini` change is needed for basic reporting (tests, fixtures' setup/teardown, failures, `logging` output and stdout/stderr).
- The plugin is **inactive outside CloudBeat**. Nothing is reported and nothing is slowed down in local and CI runs.
- Python 3.8+.

## Detection details
- Dependency files: `requirements.txt` (also `requirements-dev.txt`, `requirements/*.txt`), `pyproject.toml` (`[project.dependencies]`, optional groups, Poetry/PDM/uv sections), `setup.cfg`, `Pipfile`.
  **CloudBeat installs from `requirements.txt` in the project root and/or the project itself (`pip install <project>` when a `pyproject.toml`/`setup.py` exists).** A project that declares dependencies only in a Poetry/uv lock file or a `Pipfile` needs a `requirements.txt` - include generating one in the plan (`poetry export`, `uv export`, `pipenv requirements`) and ask before doing it.
- Browser library: `selenium`, `pytest-playwright` / `playwright`, `Appium-Python-Client`.
- The driver fixture in `conftest.py` (`webdriver.Chrome(`, `webdriver.Remote(`), and its scope.
- **Option name clash:** plugin versions that predate the fix register a pytest command line option called `--name`. If the project's `conftest.py` also defines `--name` via `pytest_addoption`, pytest fails at start-up with a conflict. Check for it; if found, tell the user and stop before installing (the project's option would have to be renamed).

## Options

### O1 `wrapDriver` - Wrap the Selenium WebDriver
- **When:** Selenium detected.
- **Default:** yes.
- **User gets:** navigation, clicks, typing and element look-ups as report steps, with a screenshot on failure.
- **Change:** the driver fixture in `conftest.py` wraps the driver when running in CloudBeat. The wrapped object is Selenium's `EventFiringWebDriver`: all WebDriver calls work, but code that checks `isinstance(driver, webdriver.Chrome)` or uses browser-specific methods (`execute_cdp_cmd`) needs `driver.wrapped_driver` - search for such usages and list them in the plan.

### O2 `customSteps` - Named steps
- **When:** the project has page objects or helper functions.
- **Default:** no code changes; show how. Offer to decorate a few page-object methods as an example.
- `@cb.step` / `@cb.step("Login as {username}")` on functions and methods (placeholders are filled from the arguments), or `with cb.step_context("Checkout"):` for a block. Both are no-ops outside CloudBeat, so they are safe to leave in the code.

## Installation

### 1. Dependencies
Add to the file the project already uses for test dependencies (and to the root `requirements.txt` CloudBeat installs from):
```
cloudbeat-pytest
cloudbeat-selenium        # only with O1
```
Follow the project's pinning style; resolve the latest version with `pip index versions cloudbeat-pytest` when pinning. Install into the active virtual environment to verify.

### 2. Wrap the driver (O1)
```python
@pytest.fixture
def driver(request):
    drv = webdriver.Chrome(options=options)      # existing creation code, unchanged
    cb_reporter = getattr(request.config, "cb_reporter", None)   # set by the CloudBeat plugin only when executed by CloudBeat
    if cb_reporter is not None:
        from cloudbeat_selenium.wrapper import CbSeleniumWrapper
        drv = CbSeleniumWrapper(cb_reporter).wrap(drv)
    yield drv
    drv.quit()
```
- Use exactly this form. **Do not use the plugin's `cbx` fixture (`cbx.se.wrap`)**: in released kit versions that predate the fix, `cbx` fails to initialize once `cloudbeat_selenium` is imported. The form above works with every version. For the same reason, do not request `cbx` anywhere else in a project that wraps the driver.
- The import is inside the `if`, so local runs do not even load the CloudBeat module.
- When executed by CloudBeat, the remote WebDriver address is provided in the `CB_SELENIUM_URL` environment variable (`CB_APPIUM_URL` for Appium) and the selected browser in `CB_BROWSER_NAME`. Offer to use them in the fixture: `webdriver.Remote(command_executor=os.environ["CB_SELENIUM_URL"], options=options)` when the variable is set, the existing local driver otherwise.

### 3. Steps (O2)
```python
from cloudbeat_common import cb

class LoginPage:
    @cb.step("Login as {username}")
    def login(self, username, password): ...
```

## Verification
- `python -m pytest --collect-only -q` must succeed and collect the same number of tests as before. A failure mentioning `--name` is the option clash described above.

## Project settings for CloudBeat
- `--type Pytest`. CloudBeat runs `python -m pytest` from the project root with its own test selection; options the project needs must live in `pytest.ini` / `pyproject.toml` (`addopts`), not in a shell script.
- Delivery: source code (Git integration recommended). Virtual environments, `__pycache__` and `.pytest_cache` are never uploaded.

## Not available
- Playwright for Python: tests are reported (pass/fail, logs, output), but there are no action-level steps or screenshots - say this clearly if the project uses Playwright, and do not install `cloudbeat-playwright`.
- Browser console logs and network capture.
