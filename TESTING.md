# Compatibility evidence

Last run: 18 October 2026

This page records observed behavior, not a universal compatibility claim.
Public forms change over time, and a reachable page today may later require
authentication, close, or disappear.

## Method

- Ran Pilot's current parser, classifier, profile mapper, and filler source
  against each live page in Chrome through an isolated Playwright harness.
- Used an obviously synthetic applicant profile (`Pilot Test Applicant`,
  `pilot.test@example.com`, and non-personal placeholder details).
- Never clicked a submit or next button.
- Counted a fill as successful only when Pilot's filler reported success and the
  resulting page state was captured in a screenshot.
- Kept sensitive EEO questions and ambiguous fields out of the silent-fill path.

This run exercises Pilot's core page runtime, not the popup, service worker, or
review-panel interaction. Repository validation and unit tests cover the
Manifest V3 file graph and safety routing; a repeatable end-to-end extension UI
test remains future work.

## Results

| Form | Page state | Pilot result | What the result means |
| --- | --- | --- | --- |
| [Orange Internship Application](https://forms.cloud.microsoft/pages/responsepage.aspx?id=8_JzqsvIhkuIizsiUf6MkbJMrahquPFMqgBrur5UadNUN0ROTDU5Q1owMlJRS0VJUzk4R1VZNlZFMy4u&route=shorturl) | Reachable | 16 fields/groups detected; 4 of 5 safe fill attempts succeeded; 11 fields initially routed to review | Name, email, phone, and university filled. The saved `Senior` value did not match the form's `Year 2`/`Year 3`/`Year 4` choices and was left for review. Gender and resume upload were not silently filled. |
| [ATS Autofill Stress Test](https://docs.google.com/forms/d/e/1FAIpQLSd7IFd2Pg1zk5mtUL-e1Cam4PRpuTXkpYDP2TYSzhJcoCgbnw/viewform) | Reachable | 14 fields/groups detected; 8 of 8 safe fill attempts succeeded; 6 fields routed to review | Bilingual identity fields, university, GPA, degree, and relocation were handled. Veteran/disability stayed in EEO review. Three Google custom dropdown questions were not detected, which is a known parser gap. |
| [Career Development Training Form](https://forms.cloud.microsoft/pages/responsepage.aspx?id=wj8Vf8Qq5UuqXC-xtzNxPBFtcU6XaNJEi0y70fzZrVJUNThUMFpHNjVJN0JVSDAxV0tMRkQyWkRLNC4u&route=shorturl) | Reachable | 9 fields/groups detected; 3 of 3 safe fill attempts succeeded; 6 fields routed to review | Full name, phone, and email filled. Education and open-ended fields remained review-first because Microsoft Forms exposes generic input labels and the classification evidence came from surrounding text. |
| [WideBot AI 2026](https://docs.google.com/forms/d/e/1FAIpQLSf7qbyOQfZEbYmxXQ10epqcD-1zAECwWcyGhv6TPmoPNLRjKg/closedform) | Google sign-in required | Not evaluated | The isolated test browser reached a Google authentication gate rather than the application form. This is not counted as a Pilot pass or failure. |
| [ECPC Receptionist](https://www.ecpc.com.eg/join-us/receptionist/) | Expired | Not evaluated | The page states that the job has expired and exposes no application controls. This is not counted as a Pilot pass or failure. |

“Detected fields/groups” are Pilot's semantic models, not the raw number of DOM
nodes. Radio groups count as one question.

## Bugs found and fixed by this run

The first pass revealed two high-confidence semantic mistakes:

1. “Name of the institution where you received your highest degree” was
   classified as `DEGREE`, which placed a degree value in the institution field.
   A contextual rule now classifies this phrasing as `UNIVERSITY`.
2. “Department Preference” was classified as academic `FACULTY`. It now routes
   to manual review because Pilot has no saved job-department preference field.

“Title of your degree” is now classified as `DEGREE` but still requires review,
because the saved coarse degree value may not be specific enough. Regression
tests cover all three cases.

## Screenshots

The screenshots show the post-fill page state. They contain synthetic data and
were captured before any submission.

- [Orange Internship Application](docs/evidence/orange-internship.png)
- [ATS Autofill Stress Test](docs/evidence/ats-stress-test.png)
- [Career Development Training Form](docs/evidence/career-development-training.png)
- [WideBot sign-in gate](docs/evidence/widebot-ai-2026.png)
- [Expired ECPC listing](docs/evidence/ecpc-receptionist.png)

## Open gaps

- Detect and safely represent Google Forms' custom dropdown questions.
- Add a temporary-browser end-to-end test for the extension widget and review
  panel, not only the page runtime.
- Repeat the matrix with more ATS platforms before making platform-level support
  claims.
- Define a labeled benchmark before publishing an accuracy percentage.
