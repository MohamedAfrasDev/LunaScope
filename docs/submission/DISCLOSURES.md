# AI and software-tool disclosure (DRAFT for the team to confirm)

**Status:** a draft written from the repository's own history. The team must read it, correct it, and match it to what the event's rules require. Nothing here has been submitted.

## AI assistance

This project was built with the help of **Claude Code**, an AI coding assistant from Anthropic, working in the team's repository at the team's direction. It was used to:

- read the product specification and write the implementation specification and phase plan;
- write and refactor application code (the Python science service and the Next.js web app) and its tests;
- run the test suites and a browser-based check of the interface, and report the results;
- draft documentation, including the decision-record evidence, the run records and this disclosure.

The commit history records the work. Scientific decisions (which terrain product, coordinate frame, tolerances, and which sites count as candidates) are **recorded as decisions for the science owner** in `docs/sdr/SDR-001.md`; none has been signed off.

## What the AI did not do

- It did not choose or approve any candidate site (D-09 is open).
- It did not validate any result: every result is labelled `synthetic_demonstration` or `real_data_unverified`.
- It did not obtain organizer permission (D-12 is open).
- It did not generate or alter any NASA logo or insignia; the product uses none.
- The repository contains no voice recording or image of any person (media made outside it is for the team to check).

## Other software

Open-source libraries and their licences are listed in `LICENCES-AND-CITATIONS.md`. Data sources and their citation requests are listed there too.

## For the team to complete before submission

- [ ] Confirm the wording above against the event's disclosure rules.
- [ ] Add any other tools the team used outside this repository (design, slides, video).
- [ ] Confirm that no person under 18 appears in, or is recorded for, any submitted media.
