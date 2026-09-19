# Step 2 - Kit options

Goal: choose the optional kit features. The questions are **not** defined here - they come from the "Options" section of the flavor's recipe in `../kits/`, because every kit supports a different set of features.

## How to ask
1. Read the recipe. Its frontmatter `capabilities` tells what exists for this kit:
   - `true` - available, ask according to the recipe
   - `auto` - always on once its prerequisite is enabled; **do not ask**, just mention it
   - `opt-in` - available, off unless the user wants it
   - `manual` - possible only through code the user writes; mention it, do not offer to automate
   - `false` - not available for this framework
2. Evaluate each option's **When** condition against what was detected. Ask only the options whose condition holds.
3. Group up to 4 questions per round. Round 1: every option that does not depend on another one (in recipe order). Following rounds: options whose parent was answered "yes" (e.g. "network capture" depends on "wrap WebDriver"). Aim for two rounds.
4. Every question states: what the user gets in CloudBeat reports, what changes in their code, and any cost (overhead, extra dependency). Pre-select the recipe's default.
5. After the questions, state in one or two sentences what is **not available** for this framework if the user is likely to expect it (typical: network/HAR capture and browser logs outside Java; action-level steps for Python Playwright).

## Shortcut
Before the option questions, ask one preliminary question: **"Use recommended settings" (Recommended) / "Customize"**, listing in the question text what the recommended settings are for this project (each option with its default). "Recommended" applies every default of the recipe and skips the remaining questions. Every option in a recipe must therefore resolve to a concrete default - when a recipe makes the default depend on the project, evaluate the condition and state the result.

## Record
Write the chosen option ids and values to `.cloudbeat/setup.md` under "Kit". When re-run via `/cloudbeat-kit`, show the current values as defaults and produce a plan only for what changed.
